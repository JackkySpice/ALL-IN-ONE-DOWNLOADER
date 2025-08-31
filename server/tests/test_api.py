import asyncio
import types
from typing import Any, Dict, List, Optional

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def app(monkeypatch, tmp_path):
    import server.main as main

    # Isolate users DB to a temp file for auth tests
    users_path = tmp_path / "users.json"
    monkeypatch.setattr(main, "USERS_DB_PATH", str(users_path))

    # Ensure cookies are not forced secure for tests
    monkeypatch.setenv("AOI_COOKIE_SECURE", "0")

    return main.app


@pytest.fixture()
def client(app):
    return TestClient(app)


def test_health_returns_ok(client: TestClient):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_auth_flow_signup_login_me_logout_delete_me(client: TestClient):
    # Signup
    r = client.post("/api/auth/signup", json={"email": "a@b.com", "password": "secret123"})
    assert r.status_code == 200
    user = r.json()
    assert user["id"] and user["guest"] is False

    # Me
    r2 = client.get("/api/auth/me")
    assert r2.status_code == 200
    assert r2.json()["email"] == "a@b.com"

    # Logout
    r3 = client.post("/api/auth/logout")
    assert r3.status_code == 200

    # Me after logout
    r4 = client.get("/api/auth/me")
    assert r4.status_code == 200
    assert r4.json() is None

    # Guest
    r5 = client.post("/api/auth/guest")
    assert r5.status_code == 200
    assert r5.json()["guest"] is True

    # Delete me (guest is idempotent)
    r6 = client.delete("/api/auth/me")
    assert r6.status_code == 200
    assert r6.json()["ok"] is True


def _fake_info_single() -> Dict[str, Any]:
    return {
        "id": "abc123",
        "title": "Test Video",
        "thumbnail": "https://example.com/thumb.jpg",
        "duration": 125,
        "webpage_url": "https://example.com/watch?v=abc123",
        "extractor": "youtube",
        "http_headers": {"User-Agent": "UA"},
        "formats": [
            {
                "format_id": "18",
                "ext": "mp4",
                "height": 360,
                "width": 640,
                "fps": 30,
                "acodec": "aac",
                "vcodec": "h264",
                "filesize": 1000,
                "url": "https://cdn.example.com/v.mp4",
                "protocol": "https",
            },
            {
                "format_id": "140",
                "ext": "m4a",
                "acodec": "aac",
                "vcodec": "none",
                "abr": 128,
                "filesize_approx": 500,
                "url": "https://cdn.example.com/a.m4a",
                "protocol": "https",
            },
        ],
        "subtitles": {
            "en": [
                {"ext": "vtt", "url": "https://subs.example.com/en.vtt"},
                {"ext": "srt", "url": "https://subs.example.com/en.srt"},
            ]
        },
        "automatic_captions": {
            "en": [
                {"ext": "vtt", "url": "https://subs.example.com/en.auto.vtt"},
            ]
        },
    }


@pytest.fixture()
def mock_extract(monkeypatch):
    import server.main as main

    async def fake_extract(url: str, ydl_opts: dict) -> Dict[str, Any]:
        assert "http" in url
        return _fake_info_single()

    monkeypatch.setattr(main, "_extract_info_threaded", fake_extract)
    return fake_extract


def test_extract_returns_formats_and_subtitles(client: TestClient, mock_extract):
    r = client.post("/api/extract", json={"url": "https://example.com/x"})
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == "abc123"
    assert data["title"] == "Test Video"
    assert isinstance(data["formats"], list) and len(data["formats"]) >= 2
    # Audio-only format should be marked
    audio = next((f for f in data["formats"] if f["format_id"] == "140"), None)
    assert audio and audio["is_audio_only"] is True
    # Subtitles present
    assert any(s["lang"] == "en" for s in data.get("subtitles", []))


def test_proxy_download_streams_and_headers(monkeypatch, client: TestClient, mock_extract):
    import server.main as main

    captured = {"headers": None, "url": None}

    class FakeResponse:
        def __init__(self):
            self.status_code = 200
            self.headers = {
                "Content-Type": "video/mp4",
                "Content-Length": "4",
                "Accept-Ranges": "bytes",
            }

        async def aiter_bytes(self, chunk_size=65536):  # type: ignore
            yield b"test"

        async def aclose(self):
            return None

    class FakeClient:
        def __init__(self, *args, **kwargs):
            self._req = None

        def build_request(self, method, url, headers=None):
            captured["headers"] = headers
            captured["url"] = url
            self._req = (method, url, headers)
            return self._req

        async def send(self, request, stream=True):
            return FakeResponse()

        async def aclose(self):
            return None

    monkeypatch.setattr(main.httpx, "AsyncClient", FakeClient)

    # Prevent real yt-dlp usage inside /api/download by faking YoutubeDL
    class FakeYDL:
        def __init__(self, opts=None):
            self.opts = opts or {}
            self.cookiejar = []

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def extract_info(self, source: str, download: bool = False):
            return _fake_info_single()

    # Patch the YoutubeDL class on the module imported as youtube_dl
    monkeypatch.setattr(main.youtube_dl, "YoutubeDL", FakeYDL)

    params = {
        "source": "https://example.com/watch?v=abc123",
        "format_id": "18",
    }
    r = client.get("/api/download", params=params, headers={"Range": "bytes=0-3"})
    assert r.status_code == 200
    assert r.headers["Content-Type"].startswith("video/")
    assert "attachment; filename*=" in r.headers["Content-Disposition"]
    # Range forwarded upstream
    assert captured["headers"]["Range"] == "bytes=0-3"
    assert captured["url"].startswith("https://cdn.example.com/")
    assert r.content == b"test"


def test_proxy_subtitle_downloads(monkeypatch, client: TestClient, mock_extract):
    import server.main as main

    class FakeResponse:
        def __init__(self):
            self.status_code = 200
            self.headers = {"Content-Type": "text/vtt", "Content-Length": "6"}

        async def aiter_bytes(self, chunk_size=65536):  # type: ignore
            yield b"WEBVTT"

        async def aclose(self):
            return None

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def build_request(self, method, url, headers=None):
            return (method, url, headers)

        async def send(self, request, stream=True):
            return FakeResponse()

        async def aclose(self):
            return None

    monkeypatch.setattr(main.httpx, "AsyncClient", FakeClient)

    r = client.get(
        "/api/subtitle",
        params={"source": "https://example.com/watch?v=abc123", "lang": "en", "ext": "vtt"},
    )
    assert r.status_code == 200
    assert r.headers["Content-Type"].startswith("text/")
    assert "en.vtt" in r.headers["Content-Disposition"]
    assert b"WEBVTT" in r.content


def test_convert_mp3_streams(monkeypatch, client: TestClient, mock_extract):
    import server.main as main

    class FakeStdout:
        def __init__(self, chunks: List[bytes]):
            self._chunks = chunks
            self._idx = 0

        async def read(self, n: int) -> bytes:
            if self._idx >= len(self._chunks):
                return b""
            b = self._chunks[self._idx]
            self._idx += 1
            return b

    class FakeProc:
        def __init__(self):
            self.stdout = FakeStdout([b"ID3", b"\x00\x00\x00"])
            self.stderr = None
            self.returncode = None

        def kill(self):
            self.returncode = 0

    async def fake_create_subprocess_exec(*args, **kwargs):
        return FakeProc()

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    r = client.get(
        "/api/convert_mp3",
        params={"source": "https://example.com/watch?v=abc123", "format_id": "140", "bitrate_kbps": 192},
    )
    assert r.status_code == 200
    assert r.headers["Content-Type"] == "audio/mpeg"
    assert "attachment; filename*=" in r.headers["Content-Disposition"]
    assert r.content.startswith(b"ID3")


def test_cookies_status(monkeypatch, client: TestClient, tmp_path):
    # Force AOI_COOKIEFILE to a non-existent path so candidate auto-detect is skipped
    nonexistent = tmp_path / "definitely_missing.cookies"
    if nonexistent.exists():
        nonexistent.unlink()
    monkeypatch.setenv("AOI_COOKIEFILE", str(nonexistent))
    r = client.get("/api/cookies/status")
    assert r.status_code == 200
    assert r.json()["enabled"] is False

    # Now set to a real file path
    cookiefile = tmp_path / ".cookies.txt"
    cookiefile.write_text("# Netscape HTTP Cookie File\n")
    monkeypatch.setenv("AOI_COOKIEFILE", str(cookiefile))
    r2 = client.get("/api/cookies/status")
    assert r2.status_code == 200
    assert r2.json()["enabled"] is True

