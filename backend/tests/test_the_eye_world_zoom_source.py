"""Source-level guardrails for the THE EYE interactive world map.

These checks complement, but do not replace, browser interaction tests.
"""
from pathlib import Path

PAGE = Path(__file__).resolve().parents[2] / "frontend" / "src" / "pages" / "TheEyePage.jsx"


def _source():
    return PAGE.read_text(encoding="utf-8")


def test_zoom_does_not_remount_world_map():
    source = _source()
    start = source.index("worldMapMode ? (")
    end = source.index("</MapContainer>", start)
    map_source = source[start:end]
    assert 'key={`world-${worldZoom}`}' not in map_source
    assert "<WorldZoomSync zoom={worldZoom} onZoomChange={setWorldZoom} />" in map_source
    assert "useMapEvents" in source
    assert "zoomend:" in source


def test_map_zoom_controls_are_bounded():
    source = _source()
    assert "Math.min(9, z + 1)" in source
    assert "Math.max(2, z - 1)" in source
    assert 'disabled={Boolean(mapFocus)}' in source


def test_world_map_coordinates_are_validated():
    source = _source()
    start = source.index("worldMapMode ? (")
    end = source.index("</MapContainer>", start)
    map_source = source[start:end]
    for expected in (
        "Number.isFinite(lat)",
        "Number.isFinite(lng)",
        "lat >= -90 && lat <= 90",
        "lng >= -180 && lng <= 180",
    ):
        assert expected in map_source
