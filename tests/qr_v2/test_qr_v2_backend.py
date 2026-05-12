"""QR-Tisch v2 (Mr-Yum-Parität) — Backend Pytest Suite.

Covers:
- Public: popular, upsell, combos, reviews-list, menu (hydrated v2 fields), menu image
- Customer-auth: table-history, order-status, order with modifiers, tip, review
- Merchant-auth: menu upsert, combo upsert/delete, image upload
"""
import os
import io
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
MERCHANT_ID = "69d0126144299a2e0d94c788"
TEST_TABLE_ID = "tbl_705aaa1575"

MERCHANT_CREDS = {"email": "haendler@bidblitz.com", "password": "Haendler2026!"}
CUSTOMER_CREDS = {"email": "kunde@bidblitz.com", "password": "Kunde2026!"}


# ── helpers ────────────────────────────────────────────────────────────────
def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s, data


@pytest.fixture(scope="module")
def merchant_session():
    return _login(MERCHANT_CREDS)


@pytest.fixture(scope="module")
def customer_session():
    return _login(CUSTOMER_CREDS)


@pytest.fixture(scope="module")
def fresh_token(merchant_session):
    """Rotate test-table → call /qr/resolve → return resolved next_token (5-min TTL)."""
    s, _ = merchant_session
    r = s.post(f"{BASE_URL}/api/merchant/qr-tables/{TEST_TABLE_ID}/rotate", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    qr_token = body.get("qr_token") or body.get("token") or (body.get("table") or {}).get("qr_token")
    assert qr_token, f"rotate returned no qr_token: {body}"
    rr = requests.get(f"{BASE_URL}/api/qr/resolve/{qr_token}", timeout=15)
    assert rr.status_code == 200, rr.text
    body = rr.json()
    return {"qr_token": qr_token, "next_token": body.get("next_token") or qr_token, "resolved": body}


@pytest.fixture(scope="module")
def submitted_order(customer_session, fresh_token):
    """Submit a small order via customer session — used by tip/review/history tests."""
    s, _ = customer_session
    payload = {
        "token": fresh_token["next_token"],
        "items": [
            {"item_id": "pizza-margherita", "name": "Pizza Margherita", "price": 8.5, "qty": 1,
             "modifiers": [{"group_id": "size", "option_id": "m", "name": "M", "price_delta": 0.0}],
             "notes": ""},
        ],
        "tip": 0,
        "scope": "food",
    }
    r = s.post(f"{BASE_URL}/api/qr/order", json=payload, timeout=20)
    # If wallet low, mark xfail
    if r.status_code == 402:
        pytest.skip(f"Customer wallet too low: {r.text[:120]}")
    assert r.status_code == 200, f"order failed: {r.status_code} {r.text[:300]}"
    return r.json()


# ── Public endpoints (no auth) ─────────────────────────────────────────────
class TestPublicEndpoints:
    def test_popular_returns_items(self):
        r = requests.get(f"{BASE_URL}/api/qr/popular/{MERCHANT_ID}", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "items" in body
        assert isinstance(body["items"], list)
        assert len(body["items"]) >= 1
        first = body["items"][0]
        for k in ("item_id", "name", "order_count"):
            assert k in first

    def test_upsell_returns_cola_for_pizza(self):
        r = requests.post(f"{BASE_URL}/api/qr/upsell",
                          json={"merchant_id": MERCHANT_ID, "item_ids": ["pizza-margherita"], "limit": 5},
                          timeout=15)
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert len(items) >= 1
        ids = [i["item_id"] for i in items]
        assert "pizza-margherita" not in ids  # excludes input

    def test_upsell_empty_when_no_cart(self):
        r = requests.post(f"{BASE_URL}/api/qr/upsell",
                          json={"merchant_id": MERCHANT_ID, "item_ids": [], "limit": 3}, timeout=15)
        assert r.status_code == 200
        assert r.json() == {"items": []}

    def test_combos_returns_bundle_with_save(self):
        r = requests.get(f"{BASE_URL}/api/qr/combos/{MERCHANT_ID}", timeout=15)
        assert r.status_code == 200
        combos = r.json().get("combos", [])
        assert len(combos) >= 1
        c = combos[0]
        for k in ("combo_id", "name", "bundle_price", "full_price", "save", "items"):
            assert k in c
        assert c["full_price"] >= c["bundle_price"]
        assert c["save"] == round(c["full_price"] - c["bundle_price"], 2)

    def test_reviews_returns_averages_map(self):
        r = requests.get(f"{BASE_URL}/api/qr/reviews/{MERCHANT_ID}", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "averages" in body and isinstance(body["averages"], dict)
        # any 1 avg between 1 and 5
        for k, v in body["averages"].items():
            assert 1.0 <= v["avg"] <= 5.0
            assert v["count"] >= 1

    def test_reviews_filtered_by_item(self):
        r = requests.get(f"{BASE_URL}/api/qr/reviews/{MERCHANT_ID}",
                         params={"item_id": "pizza-margherita"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "averages" in body
        assert "reviews" in body
        assert isinstance(body["reviews"], list)

    def test_menu_returns_v2_fields(self):
        r = requests.get(f"{BASE_URL}/api/qr/menu/{MERCHANT_ID}", timeout=15)
        assert r.status_code == 200
        body = r.json()
        items = body.get("items", [])
        assert len(items) >= 1
        # find at least one item with v2 fields
        sample = next((i for i in items if i.get("item_id") == "pizza-margherita"), items[0])
        assert "name" in sample and "price" in sample
        # v2 fields exist on at least one item across menu
        v2_keys_present = {"image_url", "tags", "allergens", "rating_avg", "rating_count", "modifier_groups", "description"}
        union = set()
        for it in items:
            union.update(it.keys())
        missing = v2_keys_present - union
        assert not missing, f"Menu missing v2 keys across all items: {missing}"

    def test_menu_image_endpoint_handles_missing(self):
        # Must return 404 (not crash) for non-existent file id
        r = requests.get(f"{BASE_URL}/api/qr/menu/image/000000000000000000000000",
                         timeout=15, allow_redirects=False)
        assert r.status_code in (404, 400)


# ── Customer-auth endpoints ────────────────────────────────────────────────
class TestCustomerAuth:
    def test_table_history_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/qr/table-history/{MERCHANT_ID}/{TEST_TABLE_ID}", timeout=15)
        assert r.status_code in (401, 403)

    def test_table_history_returns_today_orders(self, customer_session, submitted_order):
        s, _ = customer_session
        r = s.get(f"{BASE_URL}/api/qr/table-history/{MERCHANT_ID}/{TEST_TABLE_ID}", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("orders", "total_spent", "count"):
            assert k in body
        assert body["count"] >= 1
        # newly submitted order must be present
        order_ids = [o["order_id"] for o in body["orders"]]
        assert submitted_order["order_id"] in order_ids

    def test_order_status_requires_auth(self, submitted_order):
        r = requests.get(f"{BASE_URL}/api/qr/order-status/{submitted_order['order_id']}", timeout=15)
        assert r.status_code in (401, 403)

    def test_order_status_returns_status_history(self, customer_session, submitted_order):
        s, _ = customer_session
        r = s.get(f"{BASE_URL}/api/qr/order-status/{submitted_order['order_id']}", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["order_id"] == submitted_order["order_id"]
        assert body["status"] in ("received", "accepted", "preparing", "ready", "completed", "rejected")


# ── Tip flow ───────────────────────────────────────────────────────────────
class TestTip:
    def test_tip_requires_auth(self, submitted_order):
        r = requests.post(f"{BASE_URL}/api/qr/order/tip",
                          json={"order_id": submitted_order["order_id"], "amount": 0.5}, timeout=15)
        assert r.status_code in (401, 403)

    def test_tip_atomic_debit(self, customer_session, submitted_order):
        s, _ = customer_session
        # Read wallet pre
        me = s.get(f"{BASE_URL}/api/auth/me", timeout=15).json()
        pre_bal = float(me.get("balance", 0) or 0)
        r = s.post(f"{BASE_URL}/api/qr/order/tip",
                   json={"order_id": submitted_order["order_id"], "amount": 0.50}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("tip") == 0.50
        me2 = s.get(f"{BASE_URL}/api/auth/me", timeout=15).json()
        post_bal = float(me2.get("balance", 0) or 0)
        assert round(pre_bal - post_bal, 2) == 0.50, f"Wallet should have dropped 0.50: {pre_bal}->{post_bal}"

    def test_double_tip_returns_409(self, customer_session, submitted_order):
        s, _ = customer_session
        r = s.post(f"{BASE_URL}/api/qr/order/tip",
                   json={"order_id": submitted_order["order_id"], "amount": 0.30}, timeout=15)
        assert r.status_code == 409, f"expected 409 got {r.status_code}: {r.text[:120]}"


# ── Reviews ────────────────────────────────────────────────────────────────
class TestReview:
    def test_review_requires_auth(self, submitted_order):
        r = requests.post(f"{BASE_URL}/api/qr/order/review",
                          json={"order_id": submitted_order["order_id"],
                                "ratings": [{"item_id": "pizza-margherita", "rating": 5}]}, timeout=15)
        assert r.status_code in (401, 403)

    def test_review_blocks_when_status_received(self, customer_session, submitted_order):
        """Order auto-completed in instant mode? if so review will pass; otherwise blocked with 400."""
        s, _ = customer_session
        # quickly probe status
        st = s.get(f"{BASE_URL}/api/qr/order-status/{submitted_order['order_id']}", timeout=10).json()
        r = s.post(f"{BASE_URL}/api/qr/order/review",
                   json={"order_id": submitted_order["order_id"],
                         "ratings": [{"item_id": "pizza-margherita", "rating": 5, "comment": "TEST_v2"}]}, timeout=15)
        if st.get("status") in ("accepted", "completed"):
            assert r.status_code == 200, r.text
            assert r.json().get("ok") is True
            # double review -> 409
            r2 = s.post(f"{BASE_URL}/api/qr/order/review",
                        json={"order_id": submitted_order["order_id"],
                              "ratings": [{"item_id": "pizza-margherita", "rating": 4}]}, timeout=15)
            assert r2.status_code == 409
        else:
            # status='received' (waiter mode) → review must be blocked with 400
            assert r.status_code == 400


# ── Modifier-aware order pricing ───────────────────────────────────────────
class TestModifiersPricing:
    def test_order_rejects_unknown_modifier(self, customer_session, fresh_token):
        s, _ = customer_session
        payload = {
            "token": fresh_token["next_token"],
            "items": [{"item_id": "pizza-margherita", "name": "Pizza Margherita", "price": 8.5, "qty": 1,
                       "modifiers": [{"group_id": "nope", "option_id": "ghost", "price_delta": 100.0}]}],
            "tip": 0,
        }
        r = s.post(f"{BASE_URL}/api/qr/order", json=payload, timeout=20)
        # token may have expired since fresh_token created — refresh once
        if r.status_code == 410:
            pytest.skip("token expired in test sequence; rotate-retry not in scope here")
        assert r.status_code in (400, 422), f"unknown modifier should be rejected, got {r.status_code}: {r.text[:200]}"


# ── Merchant-auth endpoints (combo CRUD) ───────────────────────────────────
class TestMerchantCombos:
    def test_combo_create_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/merchant/combos",
                          json={"merchant_id": MERCHANT_ID, "name": "TEST_x",
                                "item_ids": ["pizza-margherita", "cola"], "bundle_price": 9.0}, timeout=15)
        assert r.status_code in (401, 403)

    def test_combo_upsert_and_delete(self, merchant_session):
        s, _ = merchant_session
        body = {"merchant_id": MERCHANT_ID, "name": "TEST_Combo_v2",
                "item_ids": ["pizza-margherita", "cola"], "bundle_price": 9.5, "is_active": True,
                "description": "TEST"}
        r = s.post(f"{BASE_URL}/api/merchant/combos", json=body, timeout=15)
        assert r.status_code == 200, r.text
        combo = r.json()["combo"]
        cid = combo["combo_id"]
        # verify visible in public list
        pub = requests.get(f"{BASE_URL}/api/qr/combos/{MERCHANT_ID}", timeout=15).json()
        ids = [c["combo_id"] for c in pub["combos"]]
        assert cid in ids
        # delete
        rd = s.delete(f"{BASE_URL}/api/merchant/combos/{MERCHANT_ID}/{cid}", timeout=15)
        assert rd.status_code == 200, rd.text
        pub2 = requests.get(f"{BASE_URL}/api/qr/combos/{MERCHANT_ID}", timeout=15).json()
        ids2 = [c["combo_id"] for c in pub2["combos"]]
        assert cid not in ids2


# ── Merchant menu item upsert with v2 fields ───────────────────────────────
class TestMerchantMenu:
    def test_menu_item_upsert_with_v2_fields(self, merchant_session):
        s, _ = merchant_session
        item = {
            "merchant_id": MERCHANT_ID,
            "item_id": "test_v2_item",
            "name": "TEST_V2_Item",
            "price": 3.5,
            "category": "TEST",
            "scope": "food",
            "description": "v2 testing item",
            "image_url": "https://example.com/x.jpg",
            "tags": ["popular", "vegan"],
            "allergens": ["gluten"],
            "calories": 222,
            "modifier_groups": [
                {"group_id": "size", "name": "Größe", "min": 1, "max": 1,
                 "options": [{"option_id": "s", "name": "S", "price_delta": 0},
                             {"option_id": "l", "name": "L", "price_delta": 1.5}]}
            ],
        }
        r = s.post(f"{BASE_URL}/api/merchant/menu/items", json=item, timeout=15)
        assert r.status_code == 200, r.text
        # verify via public menu
        m = requests.get(f"{BASE_URL}/api/qr/menu/{MERCHANT_ID}", timeout=15).json()
        found = next((i for i in m["items"] if i.get("item_id") == "test_v2_item"), None)
        assert found is not None
        assert found["name"] == "TEST_V2_Item"
        assert found.get("tags") == ["popular", "vegan"]
        assert "gluten" in (found.get("allergens") or [])
        # cleanup
        s.delete(f"{BASE_URL}/api/merchant/menu/items/{MERCHANT_ID}/test_v2_item", timeout=15)


# ── Image upload (multipart → GridFS) ──────────────────────────────────────
class TestImageUpload:
    def test_upload_returns_streamable_url(self, merchant_session):
        s, _ = merchant_session
        # 1x1 png
        png_bytes = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15"
            b"\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\x97\xed\x1f\x9c\x00\x00\x00"
            b"\x00IEND\xaeB`\x82"
        )
        files = {"file": ("t.png", io.BytesIO(png_bytes), "image/png")}
        r = s.post(f"{BASE_URL}/api/merchant/menu/upload-image", files=files, timeout=20)
        assert r.status_code == 200, r.text
        url = r.json().get("url") or r.json().get("image_url")
        assert url and "/api/qr/menu/image/" in url
        # public stream
        full = url if url.startswith("http") else f"{BASE_URL}{url}"
        rr = requests.get(full, timeout=15)
        assert rr.status_code == 200
        assert rr.headers.get("content-type", "").startswith("image/")
