import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import httpx
import anyio
import threading
import queue as thread_queue
from urllib.parse import quote, urlparse

try:
    import yt_dlp as youtube_dl
except Exception as e:
    raise e

# Optional curl_cffi for hardened downloads (e.g., TikTok anti-bot)
try:
    from curl_cffi import requests as curl_requests  # type: ignore
except Exception:
    curl_requests = None

APP_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(APP_DIR, os.pardir))
DIST_DIR = os.path.join(REPO_ROOT, "web", "dist")
INDEX_FILE = os.path.join(DIST_DIR, "index.html")


class ExtractRequest(BaseModel):
    url: str


class FormatModel(BaseModel):
    format_id: str
    ext: Optional[str] = None
    resolution: Optional[str] = None
    fps: Optional[int] = None
    acodec: Optional[str] = None
    vcodec: Optional[str] = None
    filesize: Optional[int] = None
    filesize_pretty: Optional[str] = None
    audio_bitrate: Optional[int] = None
    direct_url: Optional[str] = None
    is_audio_only: bool = False
    # Protocol hint (http, m3u8, etc.) for better client decisions
    protocol: Optional[str] = None


class ExtractResponse(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    thumbnail: Optional[str] = None
    duration: Optional[float] = None
    webpage_url: Optional[str] = None
    extractor: Optional[str] = None
    formats: List[FormatModel]


def human_readable_bytes(num_bytes: Optional[int]) -> Optional[str]:
    if not num_bytes or num_bytes <= 0:
        return None
    step = 1024.0
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(num_bytes)
    unit_idx = 0
    while size >= step and unit_idx < len(units) - 1:
        size /= step
        unit_idx += 1
    if unit_idx == 0:
        return f"{int(size)} {units[unit_idx]}"
    return f"{size:.2f} {units[unit_idx]}"


app = FastAPI(title="All-in-One Downloader API")

# CORS: keep permissive since we also serve the frontend from the same origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_default_user_agent() -> str:
    # Reasonably up-to-date desktop UA; can be overridden via env
    return (
        os.getenv("AOI_USER_AGENT")
        or "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )


def _build_referer_for(url: str) -> Optional[str]:
    try:
        parsed = urlparse(url)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}/"
    except Exception:
        pass
    return None


def build_ydl_opts(source_url: Optional[str] = None, format_selector: Optional[str] = None) -> dict:
    """Construct yt-dlp options with env-driven overrides and robust defaults."""
    user_agent = _get_default_user_agent()
    referer = _build_referer_for(source_url) if source_url else None

    # Allow env-driven YouTube client fallback list (comma-separated)
    yt_clients_env = os.getenv("AOI_YT_CLIENTS", "android,ios,webmobile,web").split(",")
    yt_clients = [c.strip() for c in yt_clients_env if c.strip()]

    ydl_opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "restrictfilenames": True,
        "noplaylist": True,
        "skip_download": True,
        "cachedir": False,
        # Keep certificate verification; only disable if you must (e.g., behind broken corporate proxies)
        # "nocheckcertificate": True,
        # Prefer IPv4 to avoid some CDN / IPv6 edge cases
        "prefer_ipv4": True,
        "retries": 5,
        "extractor_retries": 3,
        "fragment_retries": 5,
        # Prefer muxed MP4 (non-AV1), otherwise best.
        "format": format_selector
        or "best[ext=mp4][vcodec!*=av01]/best/bv*+ba/b",
        # Some sites need proper headers
        "http_headers": {
            "User-Agent": user_agent,
            "Accept-Language": os.getenv("AOI_ACCEPT_LANGUAGE", "en-US,en;q=0.9"),
            **({"Referer": referer} if referer else {}),
            # Some CDNs (e.g., TikTok, Facebook) validate Origin
            **({"Origin": referer[:-1]} if referer else {}),
        },
        # Improve success rate across geo/IPv6/proxy constraints
        "geo_bypass": True,
        **({"source_address": os.getenv("AOI_SOURCE_ADDRESS")} if os.getenv("AOI_SOURCE_ADDRESS") else {}),
        **({"proxy": os.getenv("AOI_PROXY")} if os.getenv("AOI_PROXY") else {}),
        # YouTube tweaks
        "extractor_args": {
            "youtube": {
                # Try multiple clients to dodge age/signature/region gates
                "player_client": yt_clients,
            }
        },
    }

    cookiefile = os.getenv("AOI_COOKIEFILE")
    if cookiefile and os.path.exists(cookiefile):
        ydl_opts["cookiefile"] = cookiefile

    return ydl_opts


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/api/extract", response_model=ExtractResponse)
async def extract_media(req: ExtractRequest):
    if not req.url:
        raise HTTPException(status_code=400, detail="Missing url")

    # First attempt with default options
    try:
        with youtube_dl.YoutubeDL(build_ydl_opts(req.url)) as ydl:
            info = ydl.extract_info(req.url, download=False)
    except Exception as first_err:
        # Best-effort fallback: switch UA to mobile and adjust YouTube client ordering
        try:
            mobile_ua = (
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
                "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            )
            os.environ.setdefault("AOI_USER_AGENT", mobile_ua)
            with youtube_dl.YoutubeDL(
                build_ydl_opts(req.url, format_selector="best/bv*+ba/b")
            ) as ydl:
                info = ydl.extract_info(req.url, download=False)
        except Exception as second_err:
            raise HTTPException(status_code=400, detail=f"Extraction failed: {second_err}") from second_err

    # If it's a playlist, pick the first entry
    if info.get("entries"):
        info = info["entries"][0]

    formats: List[FormatModel] = []
    for f in info.get("formats", []) or []:
        # Only include formats with a direct URL
        direct_url = f.get("url")
        if not direct_url:
            continue

        height = f.get("height")
        width = f.get("width")
        resolution = None
        if height and width:
            resolution = f"{width}x{height}"
        elif height:
            resolution = f"{height}p"

        filesize = (
            f.get("filesize")
            or f.get("filesize_approx")
            or None
        )

        acodec = f.get("acodec")
        vcodec = f.get("vcodec")
        is_audio_only = (vcodec == "none") or (f.get("video") is None and f.get("audio") is not None)

        bitrate = f.get("abr") or f.get("tbr")
        audio_bitrate = int(bitrate) if isinstance(bitrate, (int, float)) else None

        protocol = f.get("protocol")

        formats.append(
            FormatModel(
                format_id=str(f.get("format_id")),
                ext=f.get("ext"),
                resolution=resolution,
                fps=f.get("fps"),
                acodec=acodec,
                vcodec=vcodec,
                filesize=filesize,
                filesize_pretty=human_readable_bytes(filesize),
                audio_bitrate=audio_bitrate,
                direct_url=direct_url,
                is_audio_only=is_audio_only,
                protocol=protocol,
            )
        )

    # Sort formats: prefer direct HTTP(S) muxed MP4, then by resolution/bitrate
    def sort_key(fmt: FormatModel):
        muxed_priority = 0 if (fmt.vcodec and fmt.acodec and fmt.vcodec != "none" and fmt.acodec != "none") else 1
        # Prefer non-HLS/DASH protocols for browser-friendly direct downloads
        protocol_penalty = 0
        if fmt.protocol:
            if "m3u8" in fmt.protocol or "dash" in fmt.protocol:
                protocol_penalty = 2
            elif fmt.protocol.startswith("http"):
                protocol_penalty = 0
            else:
                protocol_penalty = 1
        ext_penalty = 0 if (fmt.ext or "").lower() == "mp4" else 1
        height_val = 0
        if fmt.resolution:
            if "x" in fmt.resolution:
                try:
                    height_val = int(fmt.resolution.split("x")[1])
                except Exception:
                    height_val = 0
            elif fmt.resolution.endswith("p"):
                try:
                    height_val = int(fmt.resolution[:-1])
                except Exception:
                    height_val = 0
        bitrate_val = fmt.audio_bitrate or 0
        return (protocol_penalty, ext_penalty, muxed_priority, -height_val, -bitrate_val)

    formats.sort(key=sort_key)

    return ExtractResponse(
        id=info.get("id"),
        title=info.get("title"),
        thumbnail=info.get("thumbnail"),
        duration=info.get("duration") or info.get("duration_float"),
        webpage_url=info.get("webpage_url"),
        extractor=info.get("extractor"),
        formats=formats,
    )


@app.get("/api/download")
async def proxy_download(request: Request, source: str, format_id: str):
    if not source or not format_id:
        raise HTTPException(status_code=400, detail="Missing source or format_id")

    # Re-extract to get fresh format URL and headers, and capture cookies
    cookie_header: Optional[str] = None
    try:
        with youtube_dl.YoutubeDL(build_ydl_opts(source, format_selector=f"{format_id}")) as ydl:
            info = ydl.extract_info(source, download=False)
            # Prepare cookie header for the eventual direct URL domain
            try:
                # We'll compute exact host later; temporarily keep full cookie jar
                ydl_cookiejar = getattr(ydl, "cookiejar", None)
                if ydl_cookiejar is not None:
                    # defer building cookie header until we know direct_url
                    pass
            except Exception:
                pass
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Extraction failed: {e}")

    if info.get("entries"):
        info = info["entries"][0]

    target = None
    for f in info.get("formats", []) or []:
        if str(f.get("format_id")) == str(format_id) and f.get("url"):
            target = f
            break

    if not target:
        raise HTTPException(status_code=404, detail="Format not found")

    direct_url = target.get("url")

    # Merge headers: info-level + per-format + inferred referer
    headers = (info.get("http_headers") or {}).copy()
    if target.get("http_headers"):
        headers.update(target.get("http_headers") or {})

    # Ensure we always include a decent UA and a sensible Referer / Origin
    headers.setdefault("User-Agent", _get_default_user_agent())
    referer = _build_referer_for(source)
    if referer:
        headers.setdefault("Referer", referer)
        headers.setdefault("Origin", referer[:-1])

    # If yt-dlp had cookies for this host, include them
    try:
        parsed_direct = urlparse(direct_url)
        host = parsed_direct.hostname
        if host:
            # Build cookie header from info-level cookies if present (yt-dlp cookiejar not exposed via info)
            # Attempt to attach any cookies present in info["http_headers"] first
            cookie_from_info = (info.get("http_headers") or {}).get("Cookie")
            if cookie_from_info:
                headers.setdefault("Cookie", cookie_from_info)
            else:
                # No Cookie header provided by extractor; try reconstructing from cookiejar on a best-effort basis
                try:
                    with youtube_dl.YoutubeDL(build_ydl_opts(source)) as y2:
                        cj = getattr(y2, "cookiejar", None)
                except Exception:
                    cj = None
                if cj:
                    cookie_pairs = []
                    for c in cj:
                        # Match domain loosely
                        if not getattr(c, "domain", None):
                            continue
                        dom = c.domain.lstrip(".")
                        if host.endswith(dom):
                            cookie_pairs.append(f"{c.name}={c.value}")
                    if cookie_pairs:
                        headers.setdefault("Cookie", "; ".join(cookie_pairs))
    except Exception:
        pass

    # Forward client Range if present (enables resumable/partial content)
    client_range = request.headers.get("Range")
    if client_range:
        headers["Range"] = client_range

    # Build filename
    title = info.get("title") or "download"
    ext = target.get("ext") or "bin"
    filename = f"{title}.{ext}"

    # Open upstream connection first to obtain real status and headers (supports 206 for Range)
    # Enable HTTP/2 if available for better CDN compatibility (requires httpx[http2])
    client = httpx.AsyncClient(
        follow_redirects=True,
        timeout=None,
        http2=True,
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
    )
    request_up = client.build_request("GET", direct_url, headers=headers)
    resp = await client.send(request_up, stream=True)

    upstream_status = resp.status_code
    upstream_headers = resp.headers

    passthrough_header_names = [
        "Content-Type",
        "Content-Length",
        "Content-Range",
        "Accept-Ranges",
        "Content-Encoding",
        "ETag",
        "Last-Modified",
        "Cache-Control",
    ]
    response_headers = {
        # Always set Content-Disposition for nicer filename
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
        # Don't cache proxied downloads
        "Cache-Control": "no-store",
        # Encourage proxies not to buffer large downloads
        "X-Accel-Buffering": "no",
    }
    for name in passthrough_header_names:
        if name in upstream_headers and upstream_headers.get(name):
            response_headers[name] = upstream_headers.get(name)

    media_type = upstream_headers.get("Content-Type") or "application/octet-stream"

    # If we hit common anti-bot statuses, retry with curl_cffi (Chrome impersonation)
    if upstream_status in {401, 403, 405, 409, 410, 412, 418, 421, 429, 451} and curl_requests:
        try:
            # Close httpx stream before retry
            await resp.aclose()
            await client.aclose()

            impersonate = os.getenv("AOI_IMPERSONATE", "chrome")
            # curl_cffi is synchronous; wrap its streaming in an async generator
            sess = curl_requests.Session()
            # Allow redirects and stream content
            curl_resp = sess.get(
                direct_url,
                headers=dict(headers),
                stream=True,
                allow_redirects=True,
                impersonate=impersonate,
            )

            # Merge headers again from curl response
            ch = curl_resp.headers or {}
            media_type = ch.get("Content-Type", media_type)
            for name in passthrough_header_names:
                if name in ch and ch.get(name):
                    response_headers[name] = ch.get(name)

            # Stream response from a background thread to avoid blocking the event loop
            async def curl_body_iter():
                q: thread_queue.Queue[Optional[bytes]] = thread_queue.Queue(maxsize=10)

                def producer():
                    try:
                        for chunk in curl_resp.iter_content(chunk_size=64 * 1024):
                            if chunk:
                                q.put(chunk)
                    finally:
                        q.put(None)

                t = threading.Thread(target=producer, daemon=True)
                t.start()

                try:
                    while True:
                        chunk = await anyio.to_thread.run_sync(q.get)
                        if chunk is None:
                            break
                        if chunk:
                            yield chunk
                finally:
                    try:
                        curl_resp.close()
                        sess.close()
                    except Exception:
                        pass

            return StreamingResponse(
                curl_body_iter(),
                media_type=media_type,
                headers=response_headers,
                status_code=curl_resp.status_code,
            )
        except Exception:
            # Fall back to original resp below
            pass

    async def body_iter():
        try:
            async for chunk in resp.aiter_bytes(chunk_size=64 * 1024):
                if chunk:
                    yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    return StreamingResponse(
        body_iter(),
        media_type=media_type,
        headers=response_headers,
        status_code=upstream_status,
    )


# Serve frontend (Vite build) if present
if os.path.exists(DIST_DIR):
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="static")

    @app.get("/")
    async def serve_index() -> FileResponse:
        return FileResponse(INDEX_FILE)

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str) -> FileResponse:
        # Let API routes be handled by FastAPI; spa catch-all for others
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        return FileResponse(INDEX_FILE)