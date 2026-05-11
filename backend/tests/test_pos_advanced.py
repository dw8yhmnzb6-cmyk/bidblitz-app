"""
POS Advanced Suite - Backend integration tests (28 endpoints + OCR + Voice).
Uses cookie-based auth via /api/auth/login.
"""
import os
import io
import base64
import csv
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ocpp-csms-platform.preview.emergentagent.com").rstrip("/")

MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PASSWORD = "Haendler2026!"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text[:200]}"
    return s


@pytest.fixture(scope="module")
def merchant_session():
    return _login(MERCHANT_EMAIL, MERCHANT_PASSWORD)


@pytest.fixture(scope="module")
def admin_session():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def bootstrap(merchant_session, admin_session):
    """Ensure merchant, store, register, and one product exist."""
    s = merchant_session
    # Merchant
    r = s.get(f"{BASE_URL}/api/pos/merchants/me", timeout=30)
    merchant = r.json().get("merchant")
    if not merchant:
        r = s.post(f"{BASE_URL}/api/pos/merchants/register", json={
            "business_name": "TEST BidBlitz Shop", "business_type": "retail", "country": "DE",
        }, timeout=30)
        assert r.status_code == 200, r.text
        merchant = r.json()["merchant"]
    merchant_id = merchant["merchant_id"]

    # Approve merchant via admin so wallet pay works (not strictly needed for these endpoints but nice)
    try:
        admin_session.post(f"{BASE_URL}/api/pos/admin/merchants/{merchant_id}/approve", timeout=15)
    except Exception:
        pass

    # Store
    r = s.get(f"{BASE_URL}/api/pos/stores", timeout=30)
    stores = r.json().get("stores", [])
    if stores:
        store_id = stores[0]["store_id"]
    else:
        r = s.post(f"{BASE_URL}/api/pos/stores/create", json={
            "name": "TEST Store", "address": "Teststr 1", "city": "Berlin", "country": "DE",
        }, timeout=30)
        assert r.status_code == 200, r.text
        store_id = r.json()["store"]["store_id"]

    # Register
    r = s.get(f"{BASE_URL}/api/pos/registers", params={"store_id": store_id}, timeout=30)
    regs = r.json().get("registers", [])
    if regs:
        register_id = regs[0]["register_id"]
    else:
        r = s.post(f"{BASE_URL}/api/pos/registers/create", json={"store_id": store_id, "name": "Kasse TEST"}, timeout=30)
        assert r.status_code == 200, r.text
        register_id = r.json()["register"]["register_id"]

    # Product (create one with low stock for auto-order testing)
    r = s.post(f"{BASE_URL}/api/pos/products/create", json={
        "store_id": store_id, "name": "TEST Product Cola", "barcode": "TEST-123",
        "price": 1.50, "purchase_price": 0.80, "stock": 1, "minimum_stock": 10,
        "track_stock": True,
    }, timeout=30)
    # If the product exists or creation fails, still proceed; just grab an existing product
    prod = None
    if r.status_code == 200:
        prod = r.json().get("product")
    if not prod:
        r2 = s.get(f"{BASE_URL}/api/pos/products/search", params={"store_id": store_id, "limit": 1}, timeout=30)
        prods = r2.json().get("products", [])
        prod = prods[0] if prods else None
    assert prod, "No product available"

    return {
        "merchant_id": merchant_id,
        "store_id": store_id,
        "register_id": register_id,
        "product_id": prod["product_id"],
    }


# ── Core endpoints ─────────────────────────────────────────────────────
class TestPOSAdvanced:
    def test_bulk_export(self, merchant_session, bootstrap):
        r = merchant_session.get(f"{BASE_URL}/api/pos/products/bulk-export",
                                 params={"store_id": bootstrap["store_id"]}, timeout=30)
        assert r.status_code == 200, r.text
        assert "text/csv" in r.headers.get("content-type", "")
        assert "name" in r.text.splitlines()[0]

    def test_bulk_import(self, merchant_session, bootstrap):
        csv_bytes = b"name;barcode;price;stock\nTEST Import Item;TEST-IMP-1;2.50;5\n"
        r = merchant_session.post(
            f"{BASE_URL}/api/pos/products/bulk-import",
            params={"store_id": bootstrap["store_id"]},
            files={"file": ("products.csv", io.BytesIO(csv_bytes), "text/csv")},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["created"] >= 1

    def test_auto_order_run(self, merchant_session, bootstrap):
        r = merchant_session.post(f"{BASE_URL}/api/pos/auto-order/run",
                                  params={"store_id": bootstrap["store_id"]}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "created_pos" in data and "low_stock_count" in data

    def test_labels_generate(self, merchant_session, bootstrap):
        r = merchant_session.post(f"{BASE_URL}/api/pos/labels/generate",
                                  json={"product_ids": [bootstrap["product_id"]], "copies_per_product": 2},
                                  timeout=30)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type") == "application/pdf"
        assert r.content[:4] == b"%PDF"

    def test_stocktake_flow(self, merchant_session, bootstrap):
        r = merchant_session.post(f"{BASE_URL}/api/pos/stocktake/start",
                                  json={"store_id": bootstrap["store_id"], "name": "TEST Inventur"}, timeout=30)
        assert r.status_code == 200, r.text
        sid = r.json()["stocktake"]["stocktake_id"]

        r = merchant_session.get(f"{BASE_URL}/api/pos/stocktake/list",
                                 params={"store_id": bootstrap["store_id"]}, timeout=30)
        assert r.status_code == 200
        assert any(st["stocktake_id"] == sid for st in r.json()["stocktakes"])

        r = merchant_session.post(f"{BASE_URL}/api/pos/stocktake/{sid}/finalize", timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True

    def test_batches(self, merchant_session, bootstrap):
        r = merchant_session.post(f"{BASE_URL}/api/pos/batches/create", json={
            "product_id": bootstrap["product_id"], "batch_number": "TEST-BATCH-1",
            "quantity": 10, "expiry_date": "2026-02-01",
        }, timeout=30)
        assert r.status_code == 200, r.text
        r = merchant_session.get(f"{BASE_URL}/api/pos/batches/expiring",
                                 params={"store_id": bootstrap["store_id"], "days": 365}, timeout=30)
        assert r.status_code == 200
        assert "expiring" in r.json()

    def test_recipes(self, merchant_session, bootstrap):
        r = merchant_session.post(f"{BASE_URL}/api/pos/recipes/create", json={
            "product_id": bootstrap["product_id"],
            "components": [{"product_id": bootstrap["product_id"], "quantity": 1}],
        }, timeout=30)
        assert r.status_code == 200, r.text
        r = merchant_session.get(f"{BASE_URL}/api/pos/recipes/{bootstrap['product_id']}", timeout=30)
        assert r.status_code == 200

    def test_schedule(self, merchant_session, bootstrap):
        r = merchant_session.post(f"{BASE_URL}/api/pos/schedule/add", json={
            "store_id": bootstrap["store_id"], "user_id": "u1", "user_name": "Test",
            "start": "2026-01-20T09:00:00", "end": "2026-01-20T17:00:00", "role": "cashier",
        }, timeout=30)
        assert r.status_code == 200, r.text
        r = merchant_session.get(f"{BASE_URL}/api/pos/schedule/week",
                                 params={"store_id": bootstrap["store_id"], "week_start": "2026-01-20T00:00:00"},
                                 timeout=30)
        assert r.status_code == 200

    def test_performance_cashiers(self, merchant_session, bootstrap):
        r = merchant_session.get(f"{BASE_URL}/api/pos/performance/cashiers",
                                 params={"store_id": bootstrap["store_id"], "days": 30}, timeout=30)
        assert r.status_code == 200, r.text
        assert "cashiers" in r.json()

    def test_forecast_sales(self, merchant_session, bootstrap):
        r = merchant_session.get(f"{BASE_URL}/api/pos/forecast/sales",
                                 params={"store_id": bootstrap["store_id"], "days_ahead": 7}, timeout=30)
        assert r.status_code == 200, r.text
        assert "forecast" in r.json()

    def test_cross_sell(self, merchant_session, bootstrap):
        r = merchant_session.get(f"{BASE_URL}/api/pos/cross-sell/{bootstrap['product_id']}",
                                 params={"store_id": bootstrap["store_id"]}, timeout=30)
        assert r.status_code == 200, r.text
        assert "suggestions" in r.json()

    def test_datev_export(self, merchant_session, bootstrap):
        r = merchant_session.get(f"{BASE_URL}/api/pos/accounting/datev/export",
                                 params={"store_id": bootstrap["store_id"], "year": 2026, "month": 1}, timeout=30)
        assert r.status_code == 200, r.text
        assert "text/csv" in r.headers.get("content-type", "")

    def test_lexoffice_export(self, merchant_session, bootstrap):
        r = merchant_session.get(f"{BASE_URL}/api/pos/accounting/lexoffice/export",
                                 params={"store_id": bootstrap["store_id"], "year": 2026, "month": 1}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["format"] == "lexoffice-v1"

    def test_pnl_today(self, merchant_session, bootstrap):
        r = merchant_session.get(f"{BASE_URL}/api/pos/pnl/today",
                                 params={"store_id": bootstrap["store_id"]}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("revenue", "cogs", "gross_margin", "fees", "margin_pct"):
            assert k in d

    def test_public_catalog_no_auth(self, bootstrap):
        r = requests.get(f"{BASE_URL}/api/pos/public/catalog/{bootstrap['store_id']}", timeout=30)
        assert r.status_code == 200, r.text
        assert "products" in r.json()

    def test_reservations(self, merchant_session, bootstrap):
        r = merchant_session.post(f"{BASE_URL}/api/pos/reservations/create", json={
            "store_id": bootstrap["store_id"], "name": "TEST Guest", "guests": 2,
            "when": "2026-01-25T19:00:00",
        }, timeout=30)
        assert r.status_code == 200, r.text
        r = merchant_session.get(f"{BASE_URL}/api/pos/reservations",
                                 params={"store_id": bootstrap["store_id"]}, timeout=30)
        assert r.status_code == 200

    def test_giftcards(self, merchant_session):
        r = merchant_session.post(f"{BASE_URL}/api/pos/giftcards/create",
                                  json={"amount": 25.00, "recipient_name": "TEST"}, timeout=30)
        assert r.status_code == 200, r.text
        code = r.json()["giftcard"]["code"]
        r = merchant_session.post(f"{BASE_URL}/api/pos/giftcards/redeem",
                                  json={"code": code, "amount": 5.00}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["remaining_balance"] == 20.00

    def test_marketing_campaign(self, merchant_session):
        # Allowed to fail softly if email service missing — but must not 404/500 on import
        r = merchant_session.post(f"{BASE_URL}/api/pos/marketing/campaigns/send", json={
            "name": "TEST Campaign", "subject": "Hallo", "html": "<p>test</p>",
        }, timeout=30)
        # 200 (sent/0), 500 (email unavailable) acceptable; 404 is NOT
        assert r.status_code in (200, 500), f"Unexpected: {r.status_code} {r.text[:200]}"

    def test_age_check_requires_cart(self, merchant_session):
        # Use a fake cart id – expect 404 (proves route mounted + validates)
        r = merchant_session.post(f"{BASE_URL}/api/pos/age-check/log", json={
            "cart_id": "CRT-NOPE", "cashier_id": "x", "age_verified": True,
        }, timeout=30)
        assert r.status_code == 404


# ── OCR + Voice (should reach upstream LLM — 200 or 500 acceptable, NOT 404) ──
class TestPOSAI:
    def test_ocr_delivery_note(self, merchant_session, bootstrap):
        # 1x1 transparent PNG
        img = base64.b64encode(base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII="
        )).decode()
        r = merchant_session.post(f"{BASE_URL}/api/pos/ocr/delivery-note", json={
            "image_base64": img, "store_id": bootstrap["store_id"],
        }, timeout=90)
        # Accept either 200 with items, or 500 from upstream LLM — must NOT be import error (would be 500 with traceback but not 404/422)
        assert r.status_code in (200, 500), f"OCR route unexpected: {r.status_code} {r.text[:300]}"
        if r.status_code == 500:
            detail = r.json().get("detail", "")
            assert "ImportError" not in detail and "AttributeError" not in detail, f"Import issue: {detail}"

    def test_voice_transcribe(self, merchant_session):
        # Tiny dummy webm bytes (not real audio — expect upstream rejection but no import error)
        audio_b64 = base64.b64encode(b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01").decode()
        r = merchant_session.post(f"{BASE_URL}/api/pos/voice/transcribe",
                                  json={"audio_base64": audio_b64}, timeout=60)
        assert r.status_code in (200, 500), f"Voice route unexpected: {r.status_code} {r.text[:300]}"
        if r.status_code == 500:
            detail = r.json().get("detail", "")
            assert "ImportError" not in detail and "AttributeError" not in detail, f"Import issue: {detail}"


# ── Sanity: app started cleanly ─────────────────────────────────────────
def test_openapi_mounts_pos_advanced():
    r = requests.get(f"{BASE_URL}/api/openapi.json", timeout=30)
    if r.status_code != 200:
        # Fall back to /openapi.json if ingress strips prefix
        r = requests.get(f"{BASE_URL}/openapi.json", timeout=30)
    if r.status_code != 200:
        pytest.skip("OpenAPI not exposed on public URL")
    try:
        paths = r.json().get("paths", {})
    except Exception:
        pytest.skip("OpenAPI not JSON on public URL")
        expected = [
            "/api/pos/ocr/delivery-note", "/api/pos/voice/transcribe",
            "/api/pos/labels/generate", "/api/pos/auto-order/run",
            "/api/pos/products/bulk-import", "/api/pos/products/bulk-export",
            "/api/pos/stocktake/start", "/api/pos/batches/create",
            "/api/pos/recipes/create", "/api/pos/schedule/add",
            "/api/pos/performance/cashiers", "/api/pos/forecast/sales",
            "/api/pos/accounting/datev/export", "/api/pos/pnl/today",
            "/api/pos/reservations/create", "/api/pos/giftcards/create",
            "/api/pos/age-check/log",
        ]
        missing = [p for p in expected if p not in paths]
        assert not missing, f"Routes missing from OpenAPI: {missing}"
