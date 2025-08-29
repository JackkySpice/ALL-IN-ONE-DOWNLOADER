import os
import pytest

from ..main import human_readable_bytes, build_ydl_opts, FormatModel


@pytest.mark.parametrize(
    "num,expected",
    [
        (None, None),
        (-1, None),
        (0, None),
        (1, "1 B"),
        (1023, "1023 B"),
        (1024, "1.00 KB"),
        (10 * 1024, "10.00 KB"),
        (1024 * 1024, "1.00 MB"),
        (10 * 1024 * 1024, "10.00 MB"),
        (1024 * 1024 * 1024, "1.00 GB"),
        (1024 * 1024 * 1024 * 1024, "1.00 TB"),
        (10 * 1024 * 1024 * 1024 * 1024, "10.00 TB"),
        (1024 * 1024 * 1024 * 1024 * 1024, "1.00 PB"),
        (10 * 1024 * 1024 * 1024 * 1024 * 1024, "10.00 PB"),
        (1024 * 1024 * 1024 * 1024 * 1024 * 1024, "1.00 EB"),
    ],
)
def test_human_readable_bytes(num, expected):
    assert human_readable_bytes(num) == expected


def test_build_ydl_opts_user_agent_override_does_not_mutate_env(monkeypatch):
    monkeypatch.delenv("AOI_USER_AGENT", raising=False)
    override = "TestAgent/1.0"
    opts = build_ydl_opts(source_url="https://example.com/video", user_agent_override=override)
    # The constructed headers should include the override UA
    assert opts["http_headers"]["User-Agent"] == override
    # But environment should still not contain AOI_USER_AGENT unless explicitly set
    assert os.getenv("AOI_USER_AGENT") is None


def test_formatmodel_allows_fractional_fps():
    # fps can be non-integer like 29.97; ensure model accepts and preserves it
    fmt = FormatModel(format_id="test", fps=29.97)
    assert isinstance(fmt.fps, float)
    assert fmt.fps == 29.97
