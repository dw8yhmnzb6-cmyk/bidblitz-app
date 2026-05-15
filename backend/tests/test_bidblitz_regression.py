"""
BidBlitz V2 Regression Test – iteration 17
Covers: Auth, Auctions (images), Admin auction PATCH/upload, Wallet, Feature flags, Health
"""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://super-app-portal.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@bidblitz.com", "password": "BidBlitz2026!"}
KUNDE = {"email": "kunde@bidblitz.com", "password": "Kunde2026!"}


def _login_session(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"Login failed {r.status_code}: {r.text[:200]}"
    assert "access_token" in s.cookies, f"No access_token cookie: {dict(s.cookies)}"
    return s


@pytest.fixture(scope="session")
def admin_token():
    return _login_session(ADMIN)


@pytest.fixture(scope="session")
def kunde_token():
    return _login_session(KUNDE)


# ---------- Health ----------
def test_api_root_health():
    r = requests.get(f"{API}/", timeout=15)
    assert r.status_code in (200, 404), f"Unexpected root status {r.status_code}"


def test_feature_flags_public():
    r = requests.get(f"{API}/feature-flags", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, (dict, list))


# ---------- Auth ----------
def test_admin_login(admin_token):
    assert "access_token" in admin_token.cookies


def test_kunde_login(kunde_token):
    assert "access_token" in kunde_token.cookies


def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": "x@y.z", "password": "bad"}, timeout=15)
    assert r.status_code in (400, 401, 403)


# ---------- Auctions list ----------
def test_auctions_list_has_items():
    r = requests.get(f"{API}/auctions/", timeout=20)
    assert r.status_code == 200, r.text[:200]
    data = r.json()
    items = data if isinstance(data, list) else data.get("auctions") or data.get("items") or []
    assert len(items) >= 1, f"No auctions returned. Keys: {list(data.keys()) if isinstance(data, dict) else 'list'}"
    # Check image fields
    with_images = [a for a in items if a.get("image_url")]
    assert len(with_images) > 0, "No auctions have image_url set"


def test_auctions_airpods_image_is_apple():
    r = requests.get(f"{API}/auctions/", timeout=20)
    data = r.json()
    items = data if isinstance(data, list) else data.get("auctions") or data.get("items") or []
    airpods = [a for a in items if "airpods" in (a.get("title") or "").lower()]
    if not airpods:
        pytest.skip("No AirPods auction found in list")
    for a in airpods:
        url = (a.get("image_url") or "").lower()
        # must not be generic nothing/ear products
        assert "nothing" not in url, f"AirPods auction has Nothing Ear image: {url}"


# ---------- Admin auction PATCH ----------
def test_admin_patch_auction_image(admin_token):
    # Get one auction
    r = requests.get(f"{API}/auctions/", timeout=20)
    data = r.json()
    items = data if isinstance(data, list) else data.get("auctions") or data.get("items") or []
    if not items:
        pytest.skip("no auctions")
    aid = items[0].get("auction_id") or items[0].get("id")
    original = items[0].get("image_url", "")
    # PATCH with new url
    new_url = "https://example.com/test_image_TEST.jpg"
    r = admin_token.patch(
        f"{API}/auctions/admin/auction/{aid}",
        json={"image_url": new_url},
        timeout=15,
    )
    assert r.status_code == 200, f"PATCH failed {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("ok") is True
    assert "image_url" in body.get("updated_fields", [])
    # Restore
    if original:
        admin_token.patch(
            f"{API}/auctions/admin/auction/{aid}",
            json={"image_url": original},
            timeout=15,
        )


def test_admin_patch_auction_requires_admin(kunde_token):
    r = requests.get(f"{API}/auctions/", timeout=20)
    data = r.json()
    items = data if isinstance(data, list) else data.get("auctions") or data.get("items") or []
    if not items:
        pytest.skip()
    aid = items[0].get("auction_id") or items[0].get("id")
    r = kunde_token.patch(
        f"{API}/auctions/admin/auction/{aid}",
        json={"image_url": "https://x.y/z.jpg"},
        timeout=15,
    )
    assert r.status_code in (401, 403)


def test_admin_patch_nonexistent_auction(admin_token):
    r = admin_token.patch(
        f"{API}/auctions/admin/auction/nonexistent_xyz_12345",
        json={"image_url": "https://x.y/z.jpg"},
        timeout=15,
    )
    assert r.status_code == 404


def test_admin_upload_image_endpoint_exists(admin_token):
    r = requests.get(f"{API}/auctions/", timeout=20)
    data = r.json()
    items = data if isinstance(data, list) else data.get("auctions") or data.get("items") or []
    if not items:
        pytest.skip()
    aid = items[0].get("auction_id") or items[0].get("id")
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0"
        b"\x00\x00\x00\x03\x00\x01\x5c\xcd\xff\x69\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    files = {"file": ("test.png", io.BytesIO(png), "image/png")}
    r = admin_token.post(
        f"{API}/auctions/admin/auction/{aid}/upload-image",
        files=files,
        timeout=20,
    )
    assert r.status_code == 200, f"Upload failed {r.status_code}: {r.text[:300]}"
    body = r.json()
    assert body.get("ok") is True
    assert body.get("image_url", "").startswith("/api/uploads/auctions/")


# ---------- Wallet ----------
def test_wallet_balance(kunde_token):
    for path in ["/wallet/balance", "/wallet", "/blitzpay/wallet"]:
        r = kunde_token.get(f"{API}{path}", timeout=15)
        if r.status_code == 200:
            return
    pytest.fail("No wallet endpoint returned 200")


# ---------- Mobility map data ----------
def test_mobility_cars_endpoint():
    r = requests.get(f"{API}/mobility/cars", timeout=15)
    # endpoint may be public or protected; just ensure not 5xx
    assert r.status_code < 500, f"Mobility endpoint 5xx: {r.status_code} {r.text[:200]}"
