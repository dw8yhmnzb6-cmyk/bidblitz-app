import os
import uuid
import requests
from dotenv import dotenv_values


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL") or "").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"
CUSTOMER_EMAIL = "agimk@me.com"


def _admin_session():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200, f"Admin login failed: {resp.status_code} {resp.text}"
    return session


def _target_user_id(session):
    resp = session.get(f"{BASE_URL}/api/admin/wallet/reconciliation", params={"q": CUSTOMER_EMAIL, "limit": 5})
    assert resp.status_code == 200, resp.text
    rows = resp.json().get("rows", [])
    assert rows, "No reconciliation rows found for target user"
    return rows[0]["user_id"]


def test_repair_cannot_run_without_reason():
    session = _admin_session()
    user_id = _target_user_id(session)
    resp = session.post(f"{BASE_URL}/api/admin/wallet/reconciliation/repair/preview", json={
        "user_id": user_id,
        "action_type": "mark_reviewed",
        "reason": "",
    })
    assert resp.status_code in (400, 422), resp.text


def test_repair_cannot_set_balance_to_zero_accidentally():
    session = _admin_session()
    user_id = _target_user_id(session)
    detail = session.get(f"{BASE_URL}/api/admin/wallet/reconciliation/history/{user_id}")
    assert detail.status_code == 200, detail.text
    users_balance = float(detail.json()["user"]["users_balance"])
    resp = session.post(f"{BASE_URL}/api/admin/wallet/reconciliation/repair/preview", json={
        "user_id": user_id,
        "action_type": "create_adjustment_entry",
        "reason": "dangerous zero attempt",
        "adjustment_amount": -users_balance,
    })
    assert resp.status_code == 400, resp.text


def test_repair_preview_creates_pending_audit_record():
    session = _admin_session()
    user_id = _target_user_id(session)
    resp = session.post(f"{BASE_URL}/api/admin/wallet/reconciliation/repair/preview", json={
        "user_id": user_id,
        "action_type": "ignore_legacy_wallet",
        "reason": f"iter212 preview {uuid.uuid4().hex[:8]}",
    })
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("ok") is True
    assert data.get("confirmation_required") is True
    assert data.get("automatic_changes_performed") == "NO"
    repair = data.get("repair", {})
    assert repair.get("repair_id")
    assert repair.get("status") == "pending_approval"


def test_repair_history_endpoint_exists():
    session = _admin_session()
    resp = session.get(f"{BASE_URL}/api/admin/wallet/reconciliation/repair-history", params={"limit": 20})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "repairs" in data
    assert data.get("automatic_changes_performed") == "NO"


def test_no_automatic_repair_runs():
    session = _admin_session()
    resp = session.get(f"{BASE_URL}/api/admin/wallet/reconciliation/final-report")
    assert resp.status_code == 200, resp.text
    assert resp.json().get("automatic_changes_performed") == "NO"


def test_repair_approve_requires_password():
    session = _admin_session()
    user_id = _target_user_id(session)
    preview = session.post(f"{BASE_URL}/api/admin/wallet/reconciliation/repair/preview", json={
        "user_id": user_id,
        "action_type": "mark_reviewed",
        "reason": f"iter212 approve guard {uuid.uuid4().hex[:8]}",
    })
    assert preview.status_code == 200, preview.text
    repair_id = preview.json()["repair"]["repair_id"]
    approve = session.post(f"{BASE_URL}/api/admin/wallet/reconciliation/repair/approve", json={
        "repair_id": repair_id,
        "reason": "attempt without password",
        "admin_password": "",
    })
    assert approve.status_code in (400, 422, 403), approve.text


def test_ignored_legacy_wallet_can_be_approved_and_is_audited():
    session = _admin_session()
    user_id = _target_user_id(session)
    preview = session.post(f"{BASE_URL}/api/admin/wallet/reconciliation/repair/preview", json={
        "user_id": user_id,
        "action_type": "ignore_legacy_wallet",
        "reason": f"iter212 ignore legacy {uuid.uuid4().hex[:8]}",
    })
    assert preview.status_code == 200, preview.text
    repair_id = preview.json()["repair"]["repair_id"]
    approve = session.post(f"{BASE_URL}/api/admin/wallet/reconciliation/repair/approve", json={
        "repair_id": repair_id,
        "reason": "manual ignore legacy approval",
        "admin_password": ADMIN_PASSWORD,
    })
    assert approve.status_code == 200, approve.text
    data = approve.json()
    assert data.get("repair", {}).get("status") == "approved"


def test_adjustment_preview_records_safe_metadata_only():
    session = _admin_session()
    user_id = _target_user_id(session)
    preview = session.post(f"{BASE_URL}/api/admin/wallet/reconciliation/repair/preview", json={
        "user_id": user_id,
        "action_type": "create_adjustment_entry",
        "reason": f"iter212 adjustment preview {uuid.uuid4().hex[:8]}",
        "adjustment_amount": 1.25,
    })
    assert preview.status_code == 200, preview.text
    repair = preview.json()["repair"]
    assert repair["status"] == "pending_approval"
    assert repair["audit_metadata"]["adjustment_amount"] == 1.25
