"""
iter113 — Backend Multi-Signal-Boost tests for Staff Geofence check-presence.
Tests wifi_ssid + bluetooth_beacons match-source logic alongside GPS.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "https://swipe-match-chat-8.preview.emergentagent.com"

MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PW = "Haendler2026!"
STAFF_SESSION = "ee9686ea-739b-4ba9-9872-650cb0955fae"
GEOFENCE_ID = "4f75e706-b703-44fb-9fec-e02826fd55f3"
WIFI_SSID = "Termokos-Office"
BEACON_ID = "TERMOKOS-BEACON-001"
TERMOKOS_LAT = 42.6629
TERMOKOS_LNG = 21.1655
FAR_LAT = 52.0
FAR_LNG = 13.0


@pytest.fixture(scope="module")
def merchant_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": MERCHANT_EMAIL, "password": MERCHANT_PW}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"merchant login failed: {r.status_code} {r.text[:200]}")
    return s


@pytest.fixture(scope="module")
def staff_session():
    s = requests.Session()
    s.cookies.set("staff_session", STAFF_SESSION)
    return s


class TestGeofencePatch:
    """Verify merchant can patch geofence with wifi_ssid + bluetooth_beacon_id."""

    def test_patch_geofence_wifi_bluetooth(self, merchant_session):
        r = merchant_session.patch(
            f"{BASE_URL}/api/staff/geofence/{GEOFENCE_ID}",
            json={"wifi_ssid": WIFI_SSID, "bluetooth_beacon_id": BEACON_ID},
            timeout=20,
        )
        assert r.status_code == 200, f"PATCH failed: {r.status_code} {r.text[:300]}"
        data = r.json()
        assert data.get("success") is True
        assert data["updated"].get("wifi_ssid") == WIFI_SSID
        assert data["updated"].get("bluetooth_beacon_id") == BEACON_ID

    def test_geofence_persisted(self, merchant_session):
        r = merchant_session.get(f"{BASE_URL}/api/staff/geofence", timeout=20)
        assert r.status_code == 200
        fences = r.json().get("geofences", [])
        match = next((f for f in fences if f.get("id") == GEOFENCE_ID), None)
        assert match is not None, "Geofence not found in merchant list"
        assert match.get("wifi_ssid") == WIFI_SSID
        assert match.get("bluetooth_beacon_id") == BEACON_ID


class TestCheckPresenceMultiSignal:
    """check-presence: WiFi/Bluetooth boost + GPS combinations."""

    def test_wifi_match_far_gps(self, staff_session):
        """GPS far away, WiFi SSID matches → inside_fence not null, match_source='wifi'."""
        r = staff_session.post(
            f"{BASE_URL}/api/staff/geofence/check-presence",
            json={"lat": FAR_LAT, "lng": FAR_LNG, "accuracy_m": 20, "wifi_ssid": WIFI_SSID},
            timeout=20,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        d = r.json()
        assert d.get("wifi_match") == GEOFENCE_ID, f"wifi_match should be {GEOFENCE_ID}, got {d.get('wifi_match')}"
        assert d.get("inside_fence") is not None, f"inside_fence should be set via wifi boost, got {d.get('inside_fence')}"
        assert d.get("match_source") == "wifi", f"match_source should be 'wifi', got {d.get('match_source')}"

    def test_bluetooth_match_far_gps(self, staff_session):
        """GPS far away, BT beacon matches → match_source='bluetooth'."""
        r = staff_session.post(
            f"{BASE_URL}/api/staff/geofence/check-presence",
            json={
                "lat": FAR_LAT,
                "lng": FAR_LNG,
                "accuracy_m": 20,
                "bluetooth_beacons": [{"id": BEACON_ID, "rssi": -55}],
            },
            timeout=20,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        d = r.json()
        assert d.get("bluetooth_match") == GEOFENCE_ID, f"bluetooth_match should be {GEOFENCE_ID}, got {d.get('bluetooth_match')}"
        assert d.get("inside_fence") is not None, "inside_fence should be set via bluetooth boost"
        assert d.get("match_source") == "bluetooth", f"match_source should be 'bluetooth', got {d.get('match_source')}"

    def test_combined_gps_inside_plus_wifi(self, staff_session):
        """GPS inside fence AND WiFi matches → match_source='combined'."""
        r = staff_session.post(
            f"{BASE_URL}/api/staff/geofence/check-presence",
            json={"lat": TERMOKOS_LAT, "lng": TERMOKOS_LNG, "accuracy_m": 15, "wifi_ssid": WIFI_SSID},
            timeout=20,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        d = r.json()
        assert d.get("inside_fence") is not None
        assert d.get("wifi_match") == GEOFENCE_ID
        assert d.get("match_source") == "combined", f"match_source should be 'combined', got {d.get('match_source')}"

    def test_wifi_mismatch_far_gps(self, staff_session):
        """GPS far away, WiFi SSID does NOT match → wifi_match null, match_source null/not wifi."""
        r = staff_session.post(
            f"{BASE_URL}/api/staff/geofence/check-presence",
            json={"lat": FAR_LAT, "lng": FAR_LNG, "accuracy_m": 20, "wifi_ssid": "Falsche-SSID"},
            timeout=20,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        d = r.json()
        assert d.get("wifi_match") is None, f"wifi_match should be None, got {d.get('wifi_match')}"
        # Should NOT be wifi/bluetooth/combined
        assert d.get("match_source") in (None, "gps"), f"match_source unexpected: {d.get('match_source')}"
        # GPS is far, no beacon → inside_fence should be None
        assert d.get("inside_fence") is None

    def test_wifi_mismatch_gps_inside(self, staff_session):
        """GPS inside but WiFi mismatch → match_source='gps'."""
        r = staff_session.post(
            f"{BASE_URL}/api/staff/geofence/check-presence",
            json={"lat": TERMOKOS_LAT, "lng": TERMOKOS_LNG, "accuracy_m": 15, "wifi_ssid": "Falsche-SSID"},
            timeout=20,
        )
        assert r.status_code == 200
        d = r.json()
        assert d.get("inside_fence") is not None
        assert d.get("wifi_match") is None
        assert d.get("match_source") == "gps", f"expected match_source=gps, got {d.get('match_source')}"
