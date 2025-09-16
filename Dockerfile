# Base image that includes both Python and Node.js
FROM nikolaik/python-nodejs:python3.11-nodejs20

WORKDIR /app

# Install system deps for yt-dlp extractors
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Copy source
COPY server/ server/
COPY web/ web/

# Install Python dependencies
RUN pip install --no-cache-dir -r server/requirements.txt

# Build frontend
RUN cd web \
    && npm ci \
    && npm run build

ENV PORT=8000
ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# Start uvicorn server
CMD ["bash","-lc","uvicorn server.main:app --host 0.0.0.0 --port ${PORT:-8000} --log-level info --access-log"]
