import math
import pytest

from server.main import human_readable_bytes


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
    ],
)
def test_human_readable_bytes(num, expected):
    assert human_readable_bytes(num) == expected

