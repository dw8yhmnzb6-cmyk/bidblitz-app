import os

import requests
from dotenv import dotenv_values


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL") or "").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


def _admin_session():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert response.status_code == 200, f"Admin login failed: {response.status_code} {response.text}"
    return session


def test_master_roadmap_dashboard_contract():
    session = _admin_session()
    response = session.get(f"{BASE_URL}/api/master-roadmap/dashboard", timeout=30)
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload.get("schema_version") == "final-completion-phase-v1"
    assert payload.get("launch_readiness", {}).get("launch_ready") is False
    assert any(phase.get("title") == "PHASE 1 – P0 LAUNCH BLOCKERS" for phase in payload.get("phases", []))
    assert any(task.get("task_id") == "P1-WALLET-001" for task in payload.get("tasks", []))
    assert any(gate.get("gate_key") == "wallet_consistency" for gate in payload.get("release_gates", []))
    assert any(item.get("module_key") == "wallet" for item in payload.get("feature_registry", []))
    assert payload.get("final_acceptance", {}).get("ready_for_beta") is False


def test_investor_progress_contract_is_restricted_but_available_for_admin():
    session = _admin_session()
    response = session.get(f"{BASE_URL}/api/master-roadmap/investor-progress", timeout=30)
    assert response.status_code == 200, response.text
    payload = response.json()
    assert "disclosure_policy" in payload
    assert "Keine Kundendaten" in payload["disclosure_policy"]
    assert "current_development_phase" in payload
    assert "next_planned_milestones" in payload
    assert "released_app_versions" in payload