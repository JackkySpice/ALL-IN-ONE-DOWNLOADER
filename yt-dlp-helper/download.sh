#!/usr/bin/env bash
set -euo pipefail

# Ensure yt-dlp in PATH for this session
export PATH="$HOME/.local/bin:$PATH"

if ! command -v yt-dlp >/dev/null 2>&1; then
  echo "yt-dlp not found in PATH. Aborting." >&2
  exit 1
fi

if [ $# -lt 1 ]; then
  echo "Usage: $0 <url> [yt-dlp args...]" >&2
  exit 2
fi

URL="$1"; shift || true
DOMAIN="$(printf "%s" "$URL" | awk -F/ '{print $3}' | tr '[:upper:]' '[:lower:]')"

COOKIES=""
case "$DOMAIN" in
  *youtube.com|*youtu.be)
    if [ -f "/workspace/cookies/youtube.txt" ]; then
      COOKIES="/workspace/cookies/youtube.txt"
    elif [ -f "/workspace/cookies/all.txt" ]; then
      COOKIES="/workspace/cookies/all.txt"
    fi
    ;;
  *facebook.com|*fb.watch)
    if [ -f "/workspace/cookies/facebook.txt" ]; then
      COOKIES="/workspace/cookies/facebook.txt"
    elif [ -f "/workspace/cookies/all.txt" ]; then
      COOKIES="/workspace/cookies/all.txt"
    fi
    ;;
  *)
    if [ -f "/workspace/cookies/all.txt" ]; then
      COOKIES="/workspace/cookies/all.txt"
    fi
    ;;
esac

OUTDIR="/workspace/downloads"
mkdir -p "$OUTDIR"

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"

ARGS=(
  --no-playlist
  --sleep-requests 0.5
  --sleep-interval 1
  --max-sleep-interval 3
  --concurrent-fragments 4
  --user-agent "$UA"
  --merge-output-format mp4
  -o "$OUTDIR/%(title).200B-%(id)s.%(ext)s"
)

if [ -n "$COOKIES" ]; then
  ARGS+=( --cookies "$COOKIES" )
else
  echo "Note: No cookies file found for $DOMAIN. If you hit LOGIN_REQUIRED, place a cookies.txt in /workspace/cookies/ (e.g., youtube.txt, facebook.txt, or all.txt)." >&2
fi

exec yt-dlp "${ARGS[@]}" "$URL" "$@"
