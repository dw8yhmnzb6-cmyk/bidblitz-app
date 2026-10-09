"""Static regression checks for THE EYE's optional Mapbox globe.

A browser/WebGL integration test is still needed before production release.
"""
from pathlib import Path

GLOBE = Path(__file__).resolve().parents[2] / "frontend" / "src" / "pages" / "TheEyeGlobe.jsx"


def test_globe_requires_configured_public_mapbox_token():
    source = GLOBE.read_text(encoding="utf-8")
    assert 'process.env.REACT_APP_MAPBOX_ACCESS_TOKEN' in source
    assert 'if (!token || !host.current) return undefined;' in source
    assert 'if (!process.env.REACT_APP_MAPBOX_ACCESS_TOKEN) return null;' in source


def test_globe_uses_real_device_coordinates_with_validation():
    source = GLOBE.read_text(encoding="utf-8")
    for text in (
        'Number.isFinite(lat)', 'Number.isFinite(lng)',
        'lat >= -90 && lat <= 90', 'lng >= -180 && lng <= 180',
        'coordinates: [Number(item.location.lng), Number(item.location.lat)]',
    ):
        assert text in source


def test_globe_releases_mapbox_instance_on_unmount():
    source = GLOBE.read_text(encoding="utf-8")
    assert 'return () => { mapRef.current = null; map.remove(); };' in source
    assert 'return () => map.off("style.load", update);' in source


def test_globe_distinguishes_four_device_statuses():
    source = GLOBE.read_text(encoding="utf-8")
    for color in ('#2fe18a', '#ffb63e', '#ff6767', '#8294a2'):
        assert color in source
