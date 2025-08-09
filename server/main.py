import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import httpx
from urllib.parse import quote

try:
    import yt_dlp as youtube_dl
except Exception as e:
    raise e

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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/api/extract", response_model=ExtractResponse)
async def extract_media(req: ExtractRequest):
    if not req.url:
        raise HTTPException(status_code=400, detail="Missing url")

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "restrictfilenames": True,
        "noplaylist": True,
        "skip_download": True,
        "cachedir": False,
        "nocheckcertificate": True,
        # favor muxed best, otherwise best video+audio
        "format": "best[ext=mp4][vcodec!*=av01]/best/bv*+ba/b",
        # Some sites need a proper UA
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
            )
        },
    }

    try:
        with youtube_dl.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(req.url, download=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Extraction failed: {e}")

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
            )
        )

    # Sort formats: muxed first, then by resolution/bitrate descending
    def sort_key(fmt: FormatModel):
        # Muxed preferred (both audio+video)
        muxed_priority = 0 if (fmt.vcodec and fmt.acodec and fmt.vcodec != "none" and fmt.acodec != "none") else 1
        # resolution height if available
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
        return (muxed_priority, -height_val, -bitrate_val)

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
async def proxy_download(source: str, format_id: str):
    if not source or not format_id:
        raise HTTPException(status_code=400, detail="Missing source or format_id")

    # Re-extract to get fresh format URL and headers
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "restrictfilenames": True,
        "noplaylist": True,
        "skip_download": True,
        "cachedir": False,
        "nocheckcertificate": True,
        "format": f"{format_id}",
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
            )
        },
    }

    try:
        with youtube_dl.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(source, download=False)
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
    headers = info.get("http_headers") or {}
    # Some formats have per-format headers
    if target.get("http_headers"):
        headers.update(target.get("http_headers") or {})

    # Build filename
    title = info.get("title") or "download"
    ext = target.get("ext") or "bin"
    filename = f"{title}.{ext}"

    async def iter_stream():
        async with httpx.AsyncClient(follow_redirects=True, timeout=None) as client:
            async with client.stream("GET", direct_url, headers=headers) as resp:
                resp.raise_for_status()
                async for chunk in resp.aiter_bytes(chunk_size=64 * 1024):
                    if chunk:
                        yield chunk

    # We do not know Content-Length reliably; stream chunked
    return StreamingResponse(
        iter_stream(),
        media_type=target.get("http_headers", {}).get("Content-Type") or "application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
            "Cache-Control": "no-store",
        },
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