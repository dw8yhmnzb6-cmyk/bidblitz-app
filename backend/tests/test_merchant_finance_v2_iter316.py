import os
from pathlib import Path
import uuid

import pytest
import requests




def resolve_base_url() -> str:
    env_url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if env_url:
        return env_url.rstrip("/")
    frontend_env = Path("/app/frontend/.env")
    if frontend_env.exists():
        for line in frontend_env.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    return ""


BASE_URL = resolve_base_url()
MERCHANT_EMAIL = "haendler@bidblitz.ae"
MERCHANT_PASSWORD = "Haendler2026!"
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def merchant_session():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={"email": MERCHANT_EMAIL, "password": MERCHANT_PASSWORD})
    if response.status_code != 200:
        pytest.skip(f"Merchant-Login fehlgeschlagen: {response.status_code} - {response.text}")
    return session


@pytest.fixture(scope="module")
def admin_session():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if response.status_code != 200:
        pytest.skip(f"Admin-Login fehlgeschlagen: {response.status_code} - {response.text}")
    return session


@pytest.fixture(scope="module")
def merchant_id(merchant_session):
    response = merchant_session.get(f"{BASE_URL}/api/merchant/command-center")
    if response.status_code != 200:
        pytest.skip(f"Command-Center nicht verfügbar: {response.status_code} - {response.text}")
    return response.json().get("merchant", {}).get("merchant_id")


def test_merchant_overview_contains_finance_v2_blocks(merchant_session):
    response = merchant_session.get(f"{BASE_URL}/api/merchant-settlements/overview")
    assert response.status_code == 200, response.text
    data = response.json()
    assert "reserves" in data
    assert "adjustments" in data
    assert "disputes" in data


def test_admin_settlements_contains_finance_v2_blocks(admin_session):
    response = admin_session.get(f"{BASE_URL}/api/admin/merchant-settlements")
    assert response.status_code == 200, response.text
    data = response.json()
    assert "reserves" in data
    assert "adjustments" in data
    assert "disputes" in data


def test_admin_can_create_reserve_rule(admin_session, merchant_id):
    response = admin_session.post(f"{BASE_URL}/api/admin/merchant-settlements/reserves", json={
        "merchant_id": merchant_id,
        "percentage_basis_points": 750,
        "fixed_minor": 0,
        "reason": "Finance V2 Test Reserve",
        "hold_days": 21,
    })
    assert response.status_code == 200, response.text
    data = response.json()
    assert data.get("merchant_id") == merchant_id
    assert data.get("hold_days") == 21


def test_admin_can_create_and_approve_adjustment(admin_session, merchant_id):
    create_response = admin_session.post(f"{BASE_URL}/api/admin/merchant-settlements/adjustments", json={
        "merchant_id": merchant_id,
        "amount_minor": 1234,
        "direction": "credit",
        "reason": "Finance V2 Test Adjustment",
        "evidence": "QA evidence",
        "idempotency_key": f"adj-{uuid.uuid4().hex}",
        "adjustment_type": "correction",
    })
    assert create_response.status_code == 200, create_response.text
    adjustment = create_response.json().get("adjustment", {})
    assert adjustment.get("status") == "pending_approval"
    review_response = admin_session.post(f"{BASE_URL}/api/admin/merchant-settlements/adjustments/{adjustment['adjustment_id']}/action", json={
        "action": "approve",
        "note": "QA approve",
    })
    assert review_response.status_code == 200, review_response.text
    reviewed = review_response.json().get("adjustment", {})
    assert reviewed.get("status") == "applied"


def test_admin_can_create_and_review_dispute(admin_session, merchant_id):
    create_response = admin_session.post(f"{BASE_URL}/api/admin/merchant-settlements/disputes", json={
        "merchant_id": merchant_id,
        "amount_minor": 999,
        "sale_id": "",
        "reason": "Finance V2 Test Dispute",
        "evidence": "Chargeback evidence",
        "idempotency_key": f"dsp-{uuid.uuid4().hex}",
    })
    assert create_response.status_code == 200, create_response.text
    dispute = create_response.json().get("dispute", {})
    assert dispute.get("status") == "open"
    review_response = admin_session.post(f"{BASE_URL}/api/admin/merchant-settlements/disputes/{dispute['dispute_id']}/action", json={
        "action": "under_review",
        "note": "QA review",
    })
    assert review_response.status_code == 200, review_response.text
    reviewed = review_response.json().get("dispute", {})
    assert reviewed.get("status") == "under_review"


def test_merchant_finance_export_adjustments_csv(merchant_session):
    response = merchant_session.get(f"{BASE_URL}/api/merchant-settlements/exports/adjustments.csv")
    assert response.status_code == 200, response.text
    assert "Adjustment-ID" in response.text


def test_admin_finance_export_disputes_csv(admin_session):
    response = admin_session.get(f"{BASE_URL}/api/admin/merchant-settlements/exports/disputes.csv")
    assert response.status_code == 200, response.text
    assert "Dispute-ID" in response.text