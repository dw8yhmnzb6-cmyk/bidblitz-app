"""Regression checks for THE EYE world-map device status colors.

These checks inspect the existing React component without requiring a browser.
"""
from pathlib import Path

PAGE = Path(__file__).resolve().parents[2] / "frontend" / "src" / "pages" / "TheEyePage.jsx"


def test_world_map_has_distinct_online_warning_offline_unknown_colors():
    source = PAGE.read_text(encoding="utf-8")
    block_start = source.index("worldMapMode ? (")
    block_end = source.index("</MapContainer>", block_start)
    map_source = source[block_start:block_end]
    expected = {
        "online": '#2fe18a',
        "warning": '#ffb63e',
        "offline": '#ff6767',
        "unknown": '#8294a2',
    }
    for status, color in expected.items():
        assert color in map_source, f"Missing {status} marker color"
    assert 'device.connection_status === "offline"' in map_source
    assert 'device.connection_status === "warning"' in map_source
    assert 'device.connection_status === "online"' in map_source


def test_map_rejects_invalid_coordinates():
    source = PAGE.read_text(encoding="utf-8")
    block_start = source.index("worldMapMode ? (")
    block_end = source.index("</MapContainer>", block_start)
    map_source = source[block_start:block_end]
    assert "Number.isFinite(lat)" in map_source
    assert "Number.isFinite(lng)" in map_source
    assert "lat >= -90 && lat <= 90" in map_source
    assert "lng >= -180 && lng <= 180" in map_source
