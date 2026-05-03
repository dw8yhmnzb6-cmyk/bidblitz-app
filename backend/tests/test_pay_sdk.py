"""BidBlitz Pay SDK — backend regression tests (iteration 39)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://bidblitz-release.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PW = "BidBlitz2026!"


# ─── fixtures ──────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def second_user_session():
    """Create a fresh user, ensure wallet balance via admin topup if available."""
    s = requests.Session()
    email = f"TEST_payer_{uuid.uuid4().hex[:8]}@example.com"
    pw = "Payer2026!"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "Pay Tester"}, timeout=15)
    if r.status_code not in (200, 201):
        pytest.skip(f"register failed: {r.status_code} {r.text[:200]}")
    return s, email, pw


@pytest.fixture(scope="module")
def created_key(admin_session):
    r = admin_session.post(
        f"{API}/pay/admin/keys/create",
        json={"merchant_email": ADMIN_EMAIL, "label": "TEST_sdk"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("ok") is True
    return data["keys"]


# ─── admin key endpoints ───────────────────────────────────────────────────
class TestAdminKeys:
    def test_create_keys_format(self, created_key):
        assert created_key["public_key"].startswith("pk_live_")
        assert created_key["secret_key"].startswith("sk_live_")
        assert created_key["revoked"] is False
        assert "key_id" in created_key

    def test_list_keys_hides_secret(self, admin_session, created_key):
        r = admin_session.get(f"{API}/pay/admin/keys", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["count"] >= 1
        for k in body["keys"]:
            assert "secret_key" not in k, "SECURITY: secret_key leaked in list"
        assert any(k["key_id"] == created_key["key_id"] for k in body["keys"])

    def test_create_keys_requires_admin(self, second_user_session, created_key):
        s, _, _ = second_user_session
        r = s.post(f"{API}/pay/admin/keys/create",
                   json={"merchant_email": ADMIN_EMAIL, "label": "x"}, timeout=15)
        assert r.status_code in (401, 403)


# ─── session endpoints ─────────────────────────────────────────────────────
class TestSession:
    def test_create_session_ok(self, created_key):
        r = requests.post(f"{API}/pay/session", json={
            "public_key": created_key["public_key"], "amount": 12.50,
            "currency": "EUR", "order_id": "TEST_ORD_1",
            "description": "Unit test",
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["session_id"].startswith("cs_")
        assert "/pay/checkout/" in d["checkout_url"]
        assert d["status"] == "pending"
        pytest.shared_session_id = d["session_id"]

    def test_create_session_invalid_key(self):
        r = requests.post(f"{API}/pay/session",
                          json={"public_key": "pk_live_invalid_xxx", "amount": 5.0}, timeout=15)
        assert r.status_code == 401

    def test_create_session_amount_zero(self, created_key):
        r = requests.post(f"{API}/pay/session",
                          json={"public_key": created_key["public_key"], "amount": 0}, timeout=15)
        assert r.status_code == 422

    def test_get_session_hides_public_key(self):
        sid = getattr(pytest, "shared_session_id", None)
        assert sid, "session must be created first"
        r = requests.get(f"{API}/pay/session/{sid}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "public_key" not in d, "SECURITY: public_key leaked in session GET"
        assert d["session_id"] == sid
        assert d["amount"] == 12.50
        assert d["status"] == "pending"

    def test_confirm_requires_auth(self):
        sid = pytest.shared_session_id
        r = requests.post(f"{API}/pay/session/{sid}/confirm", timeout=15)
        assert r.status_code in (401, 403)


# ─── full payment flow (admin pays admin = merchant) ───────────────────────
class TestPaymentFlow:
    def test_confirm_payment_full_flow(self, admin_session, created_key):
        # Get balance before
        me_before = admin_session.get(f"{API}/users/me", timeout=15).json()
        bal_before = float(me_before.get("balance", 0))

        # Create fresh session for 1 EUR (admin is both merchant & payer)
        r = requests.post(f"{API}/pay/session", json={
            "public_key": created_key["public_key"], "amount": 1.0,
            "order_id": "TEST_FLOW_1", "description": "Flow test",
        }, timeout=15)
        assert r.status_code == 200
        sid = r.json()["session_id"]

        # Confirm
        c = admin_session.post(f"{API}/pay/session/{sid}/confirm", timeout=15)
        if c.status_code == 400 and "Unzureichend" in c.text:
            pytest.skip(f"Admin wallet insufficient: {bal_before}")
        assert c.status_code == 200, c.text
        body = c.json()
        assert body["ok"] is True
        assert body["status"] == "paid"
        assert body.get("transaction_id")

        # Verify GET shows paid
        s = requests.get(f"{API}/pay/session/{sid}", timeout=15).json()
        assert s["status"] == "paid"
        assert s.get("transaction_id")

        # Double confirm → 400
        again = admin_session.post(f"{API}/pay/session/{sid}/confirm", timeout=15)
        assert again.status_code == 400

        # Wallet balance unchanged (admin=merchant, debit+credit = net 0)
        me_after = admin_session.get(f"{API}/users/me", timeout=15).json()
        bal_after = float(me_after.get("balance", 0))
        assert abs(bal_after - bal_before) < 0.001, f"balance moved unexpectedly: {bal_before}->{bal_after}"

        # Transactions — 2 entries (debit + credit) both referencing session
        tx = admin_session.get(f"{API}/transactions", timeout=15)
        assert tx.status_code == 200
        tx_data = tx.json()
        tx_list = tx_data.get("transactions", tx_data) if isinstance(tx_data, dict) else tx_data
        refs = [t for t in tx_list if t.get("reference") == sid]
        types = {t.get("type") for t in refs}
        assert "pay_sdk_debit" in types, f"missing debit tx for {sid}: {types}"
        assert "pay_sdk_credit" in types, f"missing credit tx for {sid}: {types}"

    def test_cancel_session(self, created_key, admin_session):
        r = requests.post(f"{API}/pay/session", json={
            "public_key": created_key["public_key"], "amount": 2.0, "order_id": "TEST_CANCEL"
        }, timeout=15)
        sid = r.json()["session_id"]
        c = admin_session.post(f"{API}/pay/session/{sid}/cancel", timeout=15)
        assert c.status_code == 200
        assert c.json()["status"] == "cancelled"
        # GET shows cancelled
        s = requests.get(f"{API}/pay/session/{sid}", timeout=15).json()
        assert s["status"] == "cancelled"


# ─── revoke + my-sessions + pay.js ─────────────────────────────────────────
class TestAdminRevoke:
    def test_revoke_key_blocks_new_sessions(self, admin_session):
        # Fresh throwaway key
        r = admin_session.post(f"{API}/pay/admin/keys/create",
                               json={"merchant_email": ADMIN_EMAIL, "label": "TEST_revoke"}, timeout=15)
        assert r.status_code == 200
        k = r.json()["keys"]
        # Revoke
        rv = admin_session.post(f"{API}/pay/admin/keys/{k['key_id']}/revoke", timeout=15)
        assert rv.status_code == 200
        assert rv.json()["ok"] is True
        # New session with revoked key → 401
        bad = requests.post(f"{API}/pay/session",
                            json={"public_key": k["public_key"], "amount": 5.0}, timeout=15)
        assert bad.status_code == 401


class TestMerchantOwn:
    def test_my_sessions_summary(self, admin_session):
        r = admin_session.get(f"{API}/pay/my-sessions", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "sessions" in data and "summary" in data
        s = data["summary"]
        for k in ("total", "paid_count", "paid_amount", "pending_count"):
            assert k in s
        # none of returned sessions should leak public_key
        for ses in data["sessions"]:
            assert "public_key" not in ses


class TestPayJs:
    def test_pay_js_served(self):
        r = requests.get(f"{API}/pay.js", timeout=15)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "javascript" in ct.lower(), f"unexpected content-type: {ct}"
        assert "BidBlitz Pay JS SDK" in r.text or "BidBlitz" in r.text
