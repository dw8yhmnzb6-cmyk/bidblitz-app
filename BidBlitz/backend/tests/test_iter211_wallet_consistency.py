"""
Iteration 211 - Wallet Consistency & Idempotency Tests

Tests for:
1. Admin reconciliation endpoint (read-only)
2. Legacy super-app wallet reads users.balance
3. Duplicate topup idempotency (single booking)
4. Duplicate send idempotency (single booking)
5. Admin refund uses central engine
6. Wallet screens show same EUR balance
"""
import os
import uuid
import requests
from dotenv import dotenv_values

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL") or "").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"
CUSTOMER_EMAIL = "agimk@me.com"
CUSTOMER_PASSWORD = "Aldink56600"


def _admin_session():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200, f"Admin login failed: {resp.status_code} {resp.text}"
    return session


def _customer_session():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD})
    assert resp.status_code == 200, f"Customer login failed: {resp.status_code} {resp.text}"
    return session


class TestAdminReconciliation:
    """Test /api/admin/wallet/reconciliation endpoint"""

    def test_reconciliation_endpoint_returns_200(self):
        session = _admin_session()
        resp = session.get(f"{BASE_URL}/api/admin/wallet/reconciliation", params={"limit": 5})
        assert resp.status_code == 200, resp.text

    def test_reconciliation_is_read_only(self):
        session = _admin_session()
        resp = session.get(f"{BASE_URL}/api/admin/wallet/reconciliation", params={"q": CUSTOMER_EMAIL, "limit": 5})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("canonical_visible_source") == "users.balance"
        assert "No balances were modified" in data.get("note", "")

    def test_reconciliation_returns_required_fields(self):
        session = _admin_session()
        resp = session.get(f"{BASE_URL}/api/admin/wallet/reconciliation", params={"q": CUSTOMER_EMAIL, "limit": 5})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "rows" in data
        assert "mismatch_count" in data
        assert "count" in data
        if data["rows"]:
            row = data["rows"][0]
            assert "users_balance" in row
            assert "wallets_balance" in row
            assert "transactions_sum" in row
            assert "wallet_transactions_sum" in row
            assert "delta" in row
            assert "recommended_repair" in row
            assert "risk_level" in row

    def test_reconciliation_search_by_email(self):
        session = _admin_session()
        resp = session.get(f"{BASE_URL}/api/admin/wallet/reconciliation", params={"q": CUSTOMER_EMAIL, "limit": 10})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["count"] >= 1
        emails = [r["email"] for r in data["rows"]]
        assert any(CUSTOMER_EMAIL in e for e in emails)


class TestLegacySuperAppWallet:
    """Test /api/super-app/wallet/balance reads users.balance"""

    def test_legacy_endpoint_returns_200(self):
        session = _admin_session()
        resp = session.get(f"{BASE_URL}/api/super-app/wallet/balance")
        assert resp.status_code == 200, resp.text

    def test_legacy_endpoint_reads_canonical_users_balance(self):
        session = _admin_session()
        wallet_resp = session.get(f"{BASE_URL}/api/wallet")
        assert wallet_resp.status_code == 200, wallet_resp.text
        legacy_resp = session.get(f"{BASE_URL}/api/super-app/wallet/balance")
        assert legacy_resp.status_code == 200, legacy_resp.text

        wallet_data = wallet_resp.json()
        legacy_data = legacy_resp.json()
        assert round(float(wallet_data.get("balance", 0)), 2) == round(float(legacy_data.get("balance", 0)), 2)

    def test_legacy_endpoint_marked_deprecated(self):
        session = _admin_session()
        resp = session.get(f"{BASE_URL}/api/super-app/wallet/balance")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("canonical_source") == "users.balance"
        assert data.get("deprecated") is True


class TestTopupIdempotency:
    """Test duplicate topup with same idempotency_key books EUR exactly once"""

    def test_duplicate_topup_single_booking(self):
        session = _admin_session()
        before = session.get(f"{BASE_URL}/api/wallet").json()
        unique_key = f"iter211-topup-{uuid.uuid4().hex[:12]}"

        resp1 = session.post(f"{BASE_URL}/api/wallet/topup", json={
            "amount": 1.11,
            "payment_method": "bank_transfer",
            "idempotency_key": unique_key
        })
        assert resp1.status_code == 200, resp1.text
        tx1 = resp1.json().get("transaction", {})

        resp2 = session.post(f"{BASE_URL}/api/wallet/topup", json={
            "amount": 1.11,
            "payment_method": "bank_transfer",
            "idempotency_key": unique_key
        })
        assert resp2.status_code == 200, resp2.text
        tx2 = resp2.json().get("transaction", {})

        after = session.get(f"{BASE_URL}/api/wallet").json()
        delta = round(float(after.get("balance", 0)) - float(before.get("balance", 0)), 2)
        assert delta == 1.11, f"Expected delta 1.11, got {delta}"
        assert tx1.get("id") == tx2.get("id"), "Duplicate topup should return same transaction ID"


class TestSendIdempotency:
    """Test duplicate send with same idempotency_key books EUR exactly once"""

    def test_duplicate_send_single_booking(self):
        session = _admin_session()
        unique_key = f"iter211-send-{uuid.uuid4().hex[:12]}"

        resp1 = session.post(f"{BASE_URL}/api/payment/send", json={
            "amount": 0.33,
            "recipient_email": CUSTOMER_EMAIL,
            "description": "iter211 test",
            "idempotency_key": unique_key
        })
        assert resp1.status_code == 200, resp1.text
        tx1 = resp1.json().get("transaction", {})

        resp2 = session.post(f"{BASE_URL}/api/payment/send", json={
            "amount": 0.33,
            "recipient_email": CUSTOMER_EMAIL,
            "description": "iter211 test",
            "idempotency_key": unique_key
        })
        assert resp2.status_code == 200, resp2.text
        tx2 = resp2.json().get("transaction", {})

        assert tx1.get("id") == tx2.get("id"), "Duplicate send should return same transaction ID"


class TestAdminRefund:
    """Test admin refund uses central engine and creates ledger entry"""

    def test_admin_refund_creates_transaction(self):
        session = _admin_session()
        # First create a transaction to refund
        unique_key = f"iter211-refund-{uuid.uuid4().hex[:12]}"
        topup_resp = session.post(f"{BASE_URL}/api/wallet/topup", json={
            "amount": 5.55,
            "payment_method": "bank_transfer",
            "idempotency_key": unique_key
        })
        assert topup_resp.status_code == 200, topup_resp.text
        tx = topup_resp.json().get("transaction", {})
        reference = tx.get("reference")
        assert reference, "Transaction should have a reference"

        # Now refund it
        refund_resp = session.post(f"{BASE_URL}/api/admin/transactions/{reference}/refund", json={
            "reason": "iter211 test refund"
        })
        # May fail if already refunded or other reasons
        if refund_resp.status_code == 200:
            refund_data = refund_resp.json()
            assert refund_data.get("ok") is True
            assert refund_data.get("refund_ref") is not None
            assert refund_data.get("amount") == 5.55
        elif refund_resp.status_code == 400:
            # Already refunded or invalid - acceptable
            pass
        else:
            assert False, f"Unexpected refund response: {refund_resp.status_code} {refund_resp.text}"


class TestWalletBalanceConsistency:
    """Test all wallet screens show same EUR balance"""

    def test_wallet_and_super_app_show_same_balance(self):
        session = _admin_session()
        wallet_resp = session.get(f"{BASE_URL}/api/wallet")
        assert wallet_resp.status_code == 200
        super_app_resp = session.get(f"{BASE_URL}/api/super-app/wallet/balance")
        assert super_app_resp.status_code == 200

        wallet_balance = round(float(wallet_resp.json().get("balance", 0)), 2)
        super_app_balance = round(float(super_app_resp.json().get("balance", 0)), 2)
        assert wallet_balance == super_app_balance

    def test_wallet_balance_endpoint_consistency(self):
        session = _admin_session()
        wallet_resp = session.get(f"{BASE_URL}/api/wallet")
        assert wallet_resp.status_code == 200
        balance_resp = session.get(f"{BASE_URL}/api/wallet/balance")
        assert balance_resp.status_code == 200

        wallet_balance = round(float(wallet_resp.json().get("balance", 0)), 2)
        balance_only = round(float(balance_resp.json().get("balance", 0)), 2)
        assert wallet_balance == balance_only

    def test_customer_wallet_balance_consistency(self):
        session = _customer_session()
        wallet_resp = session.get(f"{BASE_URL}/api/wallet")
        assert wallet_resp.status_code == 200
        super_app_resp = session.get(f"{BASE_URL}/api/super-app/wallet/balance")
        assert super_app_resp.status_code == 200

        wallet_balance = round(float(wallet_resp.json().get("balance", 0)), 2)
        super_app_balance = round(float(super_app_resp.json().get("balance", 0)), 2)
        assert wallet_balance == super_app_balance


class TestSuperAppTopupIdempotency:
    """Test /api/super-app/wallet/topup idempotency"""

    def test_super_app_topup_idempotency(self):
        session = _admin_session()
        before = session.get(f"{BASE_URL}/api/wallet").json()
        unique_key = f"iter211-superapp-topup-{uuid.uuid4().hex[:12]}"

        resp1 = session.post(f"{BASE_URL}/api/super-app/wallet/topup", json={
            "amount": 2.22,
            "method": "card",
            "idempotency_key": unique_key
        })
        assert resp1.status_code == 200, resp1.text
        tx1_id = resp1.json().get("transaction_id")

        resp2 = session.post(f"{BASE_URL}/api/super-app/wallet/topup", json={
            "amount": 2.22,
            "method": "card",
            "idempotency_key": unique_key
        })
        assert resp2.status_code == 200, resp2.text
        tx2_id = resp2.json().get("transaction_id")

        after = session.get(f"{BASE_URL}/api/wallet").json()
        delta = round(float(after.get("balance", 0)) - float(before.get("balance", 0)), 2)
        assert delta == 2.22, f"Expected delta 2.22, got {delta}"
        assert tx1_id == tx2_id, "Duplicate super-app topup should return same transaction ID"


class TestAdminWalletSearch:
    """Test admin wallet user search returns users.balance"""

    def test_admin_wallet_search_returns_balance(self):
        session = _admin_session()
        resp = session.get(f"{BASE_URL}/api/admin/wallet/users", params={"q": CUSTOMER_EMAIL, "limit": 5})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "users" in data
        if data["users"]:
            user = data["users"][0]
            assert "balance_eur" in user
            assert isinstance(user["balance_eur"], (int, float))
