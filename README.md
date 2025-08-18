# All-In-One Downloader

Beautiful, fast, and free downloader for YouTube, Facebook, TikTok, Instagram, and SoundCloud. Paste a link, pick your quality, and download directly.

- Gorgeous React + Tailwind UI
- FastAPI backend powered by `yt-dlp`
- Works for: YouTube, Facebook, TikTok, Instagram, SoundCloud (and many more supported by `yt-dlp`)
- Single-service deploy (frontend + backend) via Docker

## One‑click deploy (free)

Click to deploy on Render (free tier):

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

Render will detect the Dockerfile and set everything up automatically. After deploy, open the service URL to use the app.

### Passing cookies for private/age‑gated videos (YouTube/Facebook)

Some videos need authentication. You can provide cookies to the server in either way:

- Set env var `AOI_COOKIEFILE` to the path of a Netscape cookie file inside the container, OR
- Set env var `AOI_COOKIES_BASE64` to a base64‑encoded Netscape cookie file. On startup the server writes it to an internal file and uses it for yt‑dlp.

How to export cookies:
- Use the browser extension “Get cookies.txt” to export as Netscape format, then base64‑encode it and set `AOI_COOKIES_BASE64` in your hosting provider.
- Or run locally: `yt-dlp --cookies-from-browser chrome --dump-user-agent` to verify extraction works, then export cookies with the extension above.

Optional: you can fine‑tune YouTube client selection via `AOI_YT_CLIENTS` (comma‑separated, e.g. `android,ios,tv_embedded,mweb,web`).

## Run locally (Docker)

```bash
# From repo root
docker build -t all-in-one-downloader .
docker run -p 8000:8000 all-in-one-downloader
# Open http://localhost:8000
```

## Run locally (without Docker)

Requirements: Python 3.11+, Node 18+

```bash
# Backend
python -m venv .venv && . .venv/bin/activate
pip install -r server/requirements.txt

# Frontend
cd web && npm ci && npm run build && cd ..

# Run server
uvicorn server.main:app --host 0.0.0.0 --port 8000
```

## Legal

This project uses `yt-dlp` under the hood. Always respect each service’s Terms of Service and copyright. Only download content you own or have permission to use.