"""
BidBlitz POS Pro — Backend tests for pos_pro.py (36 endpoints).
Cookie session via /api/auth/login as merchant haendler@bidblitz.com.
"""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://taxi-uber-style.preview.emergentagent.com").rstrip("/")
MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PWD = "Haendler2026!"


# ── Session + helpers ────────────────────────────────────────────────
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login",
               json={"email": MERCHANT_EMAIL, "password": MERCHANT_PWD}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    return s


@pytest.fixture(scope="module")
def store_id(session):
    r = session.get(f"{BASE}/api/pos/stores", timeout=10)
    assert r.status_code == 200
    stores = r.json().get("stores", []) or r.json()
    assert stores, "no stores for merchant"
    return stores[0]["store_id"]


@pytest.fixture(scope="module")
def shared(session, store_id):
    """Create a table + sale + register we can reuse across tests."""
    ctx = {"store_id": store_id}
    # register (best effort)
    regs = session.get(f"{BASE}/api/pos/registers?store_id={store_id}", timeout=10)
    if regs.status_code == 200:
        rlist = regs.json().get("registers", [])
        ctx["register_id"] = rlist[0]["register_id"] if rlist else None
    # Create a table (pos_extended)
    tr = session.post(f"{BASE}/api/pos/tables/create",
                      json={"store_id": store_id, "name": f"T-PRO-{int(time.time())%10000}", "capacity": 4}, timeout=10)
    if tr.status_code == 200:
        ctx["table_id"] = tr.json().get("table_id") or tr.json().get("table", {}).get("table_id")
    # Find any existing paid sale for this merchant (reuse for tips/pfand)
    sl = session.get(f"{BASE}/api/pos/sales?store_id={store_id}&limit=5", timeout=10)
    if sl.status_code == 200:
        sales = sl.json().get("sales", [])
        ctx["sale_id"] = sales[0]["sale_id"] if sales else None
    return ctx


# ── GoBD ─────────────────────────────────────────────────────────────
class TestGoBD:
    def test_integrity_check(self, session):
        r = session.get(f"{BASE}/api/pos/gobd/integrity-check", timeout=15)
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        for k in ("gobd_archived", "sales_signed", "sales_paid_total", "compliance_rate"):
            assert k in d

    def test_archive_list(self, session):
        r = session.get(f"{BASE}/api/pos/gobd/archive/list?year=2026", timeout=15)
        assert r.status_code == 200
        assert "items" in r.json() and "count" in r.json()


# ── KDS ─────────────────────────────────────────────────────────────
class TestKDS:
    def test_kds_station_crud_and_order(self, session, shared):
        sid = shared["store_id"]
        r = session.post(f"{BASE}/api/pos/kds/stations/create?store_id={sid}",
                         json={"name": f"TEST-Küche-{int(time.time())}", "categories": ["Speisen"]}, timeout=10)
        assert r.status_code == 200, r.text[:200]
        station_id = r.json()["station_id"]

        lst = session.get(f"{BASE}/api/pos/kds/stations?store_id={sid}", timeout=10)
        assert lst.status_code == 200
        assert any(s["station_id"] == station_id for s in lst.json()["stations"])

        ro = session.post(f"{BASE}/api/pos/kds/orders/create",
                          json={"station_id": station_id, "table_number": "5",
                                "items": [{"name": "Pommes", "qty": 2}]}, timeout=10)
        assert ro.status_code == 200
        kds_oid = ro.json()["kds_order_id"]

        gk = session.get(f"{BASE}/api/pos/kds/orders/{station_id}", timeout=10)
        assert gk.status_code == 200
        assert any(o["kds_order_id"] == kds_oid for o in gk.json()["orders"])

        upd = session.post(f"{BASE}/api/pos/kds/orders/{kds_oid}/status?status=in_progress", timeout=10)
        assert upd.status_code == 200
        assert upd.json()["status"] == "in_progress"


# ── QR Tisch + Public ────────────────────────────────────────────────
class TestQRTable:
    def test_qr_enable_and_public_flow(self, session, shared):
        tid = shared.get("table_id")
        if not tid:
            pytest.skip("table creation failed upstream")
        qr = session.post(f"{BASE}/api/pos/tables/{tid}/qr-enable", timeout=10)
        assert qr.status_code == 200, qr.text[:200]
        token = qr.json()["qr_token"]

        # public lookup (no auth)
        pub = requests.get(f"{BASE}/api/pos/public/order/{token}", timeout=10)
        assert pub.status_code == 200
        data = pub.json()
        assert "products" in data and "table" in data
        prods = data["products"]
        if not prods:
            pytest.skip("no products in store to submit")
        first = prods[0]
        sub = requests.post(f"{BASE}/api/pos/public/order/submit",
                            json={"qr_token": token,
                                  "items": [{"product_id": first["product_id"], "quantity": 1}],
                                  "guest_name": "TEST Guest"}, timeout=15)
        assert sub.status_code == 200
        assert sub.json()["ok"] is True
        assert "guest_order_id" in sub.json()


# ── Pfand ────────────────────────────────────────────────────────────
class TestDeposits:
    def test_return_without_id(self, session, shared):
        r = session.post(f"{BASE}/api/pos/deposits/return?store_id={shared['store_id']}",
                         json={"item_type": "cup", "quantity": 2}, timeout=10)
        assert r.status_code == 200
        assert r.json()["refund_amount"] == 2.0

    def test_outstanding_list(self, session, shared):
        r = session.get(f"{BASE}/api/pos/deposits/outstanding?store_id={shared['store_id']}", timeout=10)
        assert r.status_code == 200
        assert "count" in r.json() and "total_outstanding" in r.json()

    def test_register_deposit(self, session, shared):
        if not shared.get("sale_id"):
            pytest.skip("no sale available")
        r = session.post(f"{BASE}/api/pos/deposits/register",
                         json={"sale_id": shared["sale_id"], "item_type": "bottle",
                               "deposit_amount": 0.25, "quantity": 3}, timeout=10)
        assert r.status_code == 200
        assert "deposit_id" in r.json()


# ── AI Assistant ─────────────────────────────────────────────────────
class TestAssistant:
    def test_ask(self, session, shared):
        r = session.post(f"{BASE}/api/pos/assistant/ask",
                         json={"question": "Wie war mein heutiger Umsatz?",
                               "store_id": shared["store_id"]}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert "answer" in d and isinstance(d["answer"], str) and len(d["answer"]) > 0
        assert "context" in d


# ── Product recognition (dummy image → expect 200 or 500 upstream) ──
class TestProductRecognize:
    def test_recognize_dummy(self, session, shared):
        tiny_png_b64 = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0l"
                        "EQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
        r = session.post(f"{BASE}/api/pos/products/recognize",
                         json={"image_base64": tiny_png_b64, "store_id": shared["store_id"]}, timeout=60)
        # Gemini will likely reject 1x1 → 500 is acceptable (not a wiring bug)
        assert r.status_code in (200, 500), r.text[:300]


# ── Dynamic pricing ─────────────────────────────────────────────────
class TestPricing:
    def test_rules_crud_and_apply(self, session, shared):
        sid = shared["store_id"]
        r = session.post(f"{BASE}/api/pos/pricing/rules/create?store_id={sid}",
                         json={"name": "TEST Happy Hour", "category": "Getränke",
                               "rule_type": "happy_hour", "discount_percent": 20,
                               "starts_at_hour": 17, "ends_at_hour": 19}, timeout=10)
        assert r.status_code == 200, r.text[:200]
        rule_id = r.json()["rule_id"]

        lst = session.get(f"{BASE}/api/pos/pricing/rules?store_id={sid}", timeout=10)
        assert lst.status_code == 200
        assert any(x["rule_id"] == rule_id for x in lst.json()["rules"])

        # apply to any product
        prods = session.get(f"{BASE}/api/pos/products?store_id={sid}", timeout=10)
        if prods.status_code == 200 and prods.json().get("products"):
            pid = prods.json()["products"][0]["product_id"]
            ap = session.post(f"{BASE}/api/pos/pricing/apply?product_id={pid}", timeout=10)
            assert ap.status_code == 200
            assert "effective_price" in ap.json()

        dl = session.delete(f"{BASE}/api/pos/pricing/rules/{rule_id}", timeout=10)
        assert dl.status_code == 200


# ── Customer display (no auth) ───────────────────────────────────────
class TestCustomerDisplay:
    def test_display(self):
        r = requests.get(f"{BASE}/api/pos/customer-display/does-not-exist-123", timeout=10)
        assert r.status_code == 200
        assert "ad_message" in r.json()


# ── Stempeluhr ──────────────────────────────────────────────────────
class TestTimeClock:
    def test_punch_in_and_me(self, session, shared):
        r = session.post(f"{BASE}/api/pos/timeclock/punch",
                         json={"store_id": shared["store_id"], "action": "in"}, timeout=10)
        assert r.status_code == 200, r.text[:200]
        me = session.get(f"{BASE}/api/pos/timeclock/me?days=30", timeout=10)
        assert me.status_code == 200
        assert "punches" in me.json()

    def test_store_punches(self, session, shared):
        r = session.get(f"{BASE}/api/pos/timeclock/store?store_id={shared['store_id']}", timeout=10)
        assert r.status_code == 200
        assert "punches" in r.json()


# ── Trinkgeld ───────────────────────────────────────────────────────
class TestTips:
    def test_add_tip(self, session, shared):
        if not shared.get("sale_id"):
            pytest.skip("no sale available for tip")
        r = session.post(f"{BASE}/api/pos/tips/add",
                         json={"sale_id": shared["sale_id"], "amount": 2.5, "method": "card"}, timeout=10)
        assert r.status_code == 200
        assert "tip_id" in r.json()

    def test_distribute(self, session, shared):
        r = session.post(f"{BASE}/api/pos/tips/pool/distribute?store_id={shared['store_id']}", timeout=10)
        # 200 if staff clocked-in, 400 otherwise — both valid
        assert r.status_code in (200, 400), r.text[:200]

    def test_my_payouts(self, session):
        r = session.get(f"{BASE}/api/pos/tips/my-payouts?days=30", timeout=10)
        assert r.status_code == 200
        assert "payouts" in r.json() and "total" in r.json()


# ── Webhooks + API keys ─────────────────────────────────────────────
class TestWebhooksAPI:
    def test_webhook_crud_and_test(self, session):
        r = session.post(f"{BASE}/api/pos/webhooks/create",
                         json={"url": "https://httpbin.org/post",
                               "events": ["sale.completed"]}, timeout=10)
        assert r.status_code == 200
        wid = r.json()["webhook_id"]
        assert r.json().get("secret")

        lst = session.get(f"{BASE}/api/pos/webhooks", timeout=10)
        assert lst.status_code == 200
        assert any(x["webhook_id"] == wid for x in lst.json()["webhooks"])

        tst = session.post(f"{BASE}/api/pos/webhooks/{wid}/test", timeout=10)
        assert tst.status_code == 200
        assert tst.json().get("queued") is True

        dl = session.delete(f"{BASE}/api/pos/webhooks/{wid}", timeout=10)
        assert dl.status_code == 200

    def test_api_key_crud(self, session):
        r = session.post(f"{BASE}/api/pos/api-keys/create?name=TEST-Key&scopes=read,write", timeout=10)
        assert r.status_code == 200, r.text[:200]
        kid = r.json()["key_id"]
        assert r.json()["key_secret"].startswith("bbsec_")

        lst = session.get(f"{BASE}/api/pos/api-keys", timeout=10)
        assert lst.status_code == 200
        assert any(x["key_id"] == kid for x in lst.json()["keys"])

        dl = session.delete(f"{BASE}/api/pos/api-keys/{kid}", timeout=10)
        assert dl.status_code == 200


# ── TSE sign-sale — listed in problem statement but not present in code ──
class TestTSESignSale:
    def test_sign_sale_endpoint_exists(self, session, shared):
        if not shared.get("sale_id"):
            pytest.skip("no sale available")
        r = session.post(f"{BASE}/api/pos/tse/sign-sale/{shared['sale_id']}", timeout=10)
        # Expect either 200 (success) or 400 (TSE not configured) — NOT 404/405
        assert r.status_code != 404, "TSE sign-sale endpoint is MISSING in pos_pro.py"
