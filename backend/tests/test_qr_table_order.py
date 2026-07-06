"""QR Table Order backend tests"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://kyc-approval-hub.preview.emergentagent.com").rstrip("/")
MERCHANT_ID = "69d0126144299a2e0d94c788"

MERCHANT_CREDS = {"email": "haendler@bidblitz.com", "password": "Haendler2026!"}
CUSTOMER_CREDS = {"email": "kunde@bidblitz.com", "password": "Kunde2026!"}


def login(creds):
    s = requests.Session()
    # try a few endpoints
    for path in ["/api/auth/login", "/api/login"]:
        r = s.post(f"{BASE_URL}{path}", json=creds, timeout=15)
        if r.status_code == 200:
            data = r.json()
            tok = data.get("access_token") or data.get("token")
            if tok:
                s.headers.update({"Authorization": f"Bearer {tok}"})
            return s, data
    raise RuntimeError(f"Login failed: {r.status_code} {r.text[:200]}")


@pytest.fixture(scope="module")
def merchant_session():
    s, data = login(MERCHANT_CREDS)
    return s, data


@pytest.fixture(scope="module")
def customer_session():
    s, data = login(CUSTOMER_CREDS)
    return s, data


@pytest.fixture(scope="module")
def created_table(merchant_session):
    s, _ = merchant_session
    r = s.post(f"{BASE_URL}/api/merchant/qr-tables",
               json={"merchant_id": MERCHANT_ID, "label": "TEST_Table", "capacity": 4}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    table = body["table"]
    assert "table_id" in table and "qr_token" in table
    return table


# 1. Create table
def test_create_table_requires_auth():
    r = requests.post(f"{BASE_URL}/api/merchant/qr-tables",
                      json={"merchant_id": MERCHANT_ID, "label": "X", "capacity": 4}, timeout=15)
    assert r.status_code in (401, 403)


def test_create_table_success(created_table):
    assert created_table["label"] == "TEST_Table"
    assert created_table["capacity"] == 4


# 2. List tables
def test_list_tables(merchant_session, created_table):
    s, _ = merchant_session
    r = s.get(f"{BASE_URL}/api/merchant/qr-tables/{MERCHANT_ID}", timeout=15)
    assert r.status_code == 200
    tables = r.json().get("tables", [])
    ids = [t.get("table_id") for t in tables]
    assert created_table["table_id"] in ids


# 3. Resolve token (public)
def test_resolve_token(created_table):
    tok = created_table["qr_token"]
    r = requests.get(f"{BASE_URL}/api/qr/resolve/{tok}", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["merchant_id"] == MERCHANT_ID
    assert data["table_label"] == "TEST_Table"
    assert data.get("next_token")
    # update token for subsequent tests
    created_table["qr_token"] = data["next_token"]


def test_resolve_token_invalid():
    r = requests.get(f"{BASE_URL}/api/qr/resolve/invalid_xyz_token_xx", timeout=15)
    assert r.status_code == 410


# 4. Get menu (public)
def test_get_menu():
    r = requests.get(f"{BASE_URL}/api/qr/menu/{MERCHANT_ID}", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "items" in body


# 5. Rotate
def test_rotate_token(merchant_session, created_table):
    s, _ = merchant_session
    tid = created_table["table_id"]
    r = s.post(f"{BASE_URL}/api/merchant/qr-tables/{tid}/rotate", timeout=15)
    assert r.status_code == 200
    new_token = r.json().get("token")
    assert new_token
    created_table["qr_token"] = new_token


# 6. QR-settings upsert
def test_qr_settings_upsert(merchant_session):
    s, _ = merchant_session
    r = s.post(f"{BASE_URL}/api/merchant/qr-settings",
               json={"merchant_id": MERCHANT_ID, "acceptance_mode": "waiter", "scopes": ["food", "drinks"]}, timeout=15)
    assert r.status_code == 200
    assert r.json()["settings"]["acceptance_mode"] == "waiter"
    # reset to instant for downstream order tests
    r2 = s.post(f"{BASE_URL}/api/merchant/qr-settings",
                json={"merchant_id": MERCHANT_ID, "acceptance_mode": "instant", "scopes": ["food", "drinks"]}, timeout=15)
    assert r2.status_code == 200


# 7. Place order
@pytest.fixture(scope="module")
def fresh_token_for_order(merchant_session, created_table):
    s, _ = merchant_session
    tid = created_table["table_id"]
    r = s.post(f"{BASE_URL}/api/merchant/qr-tables/{tid}/rotate", timeout=15)
    assert r.status_code == 200
    return r.json()["token"]


def test_place_order_and_refund(customer_session, fresh_token_for_order, merchant_session):
    cs, _ = customer_session
    ms, _ = merchant_session
    # fetch menu first
    mr = requests.get(f"{BASE_URL}/api/qr/menu/{MERCHANT_ID}", timeout=15).json()
    items = mr.get("items", [])
    if not items:
        pytest.skip("Merchant has no menu items")
    first = items[0]
    item_id = str(first.get("item_id") or first.get("id") or first.get("name"))

    payload = {
        "token": fresh_token_for_order,
        "scope": "food",
        "items": [{"item_id": item_id, "name": first["name"], "price": float(first["price"]), "qty": 1}],
    }
    r = cs.post(f"{BASE_URL}/api/qr/order", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    od = r.json()
    assert od["ok"] is True
    assert od["status"] == "accepted"
    order_id = od["order_id"]

    # merchant lists orders
    lr = ms.get(f"{BASE_URL}/api/merchant/qr-orders/{MERCHANT_ID}", timeout=15)
    assert lr.status_code == 200
    ids = [o["order_id"] for o in lr.json().get("orders", [])]
    assert order_id in ids

    # reject + refund
    rr = ms.post(f"{BASE_URL}/api/merchant/qr-orders/{order_id}/reject", timeout=15)
    assert rr.status_code == 200
    assert rr.json().get("refunded") == od["total"]


def test_place_order_requires_auth(fresh_token_for_order):
    r = requests.post(f"{BASE_URL}/api/qr/order",
                      json={"token": fresh_token_for_order, "scope": "food", "items": []}, timeout=15)
    assert r.status_code in (401, 403)
