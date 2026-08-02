"""
Master Roadmap Control Center - Full Test Suite
Tests for /admin/master-roadmap and /investors/progress features
"""
import os
import pytest
import requests
from dotenv import dotenv_values

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL") or "").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def admin_session():
    """Create authenticated admin session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert response.status_code == 200, f"Admin login failed: {response.status_code} {response.text}"
    return session


@pytest.fixture(scope="module")
def guest_session():
    """Create unauthenticated session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestMasterRoadmapDashboard:
    """Tests for /api/master-roadmap/dashboard endpoint"""

    def test_dashboard_returns_200_for_admin(self, admin_session):
        """Admin can access master roadmap dashboard"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/dashboard", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_dashboard_requires_admin_auth(self, guest_session):
        """Unauthenticated users cannot access dashboard"""
        response = guest_session.get(f"{BASE_URL}/api/master-roadmap/dashboard", timeout=30)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"

    def test_dashboard_schema_version(self, admin_session):
        """Dashboard returns correct schema version"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/dashboard", timeout=30)
        data = response.json()
        assert data.get("schema_version") == "final-completion-phase-v1"

    def test_dashboard_launch_readiness_not_ready_with_open_p0(self, admin_session):
        """Launch readiness must NOT show ready while P0 tasks remain open"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/dashboard", timeout=30)
        data = response.json()
        launch_readiness = data.get("launch_readiness", {})
        # With open P0 tasks, launch_ready must be False
        assert launch_readiness.get("launch_ready") is False, "Launch should NOT be ready with open P0 tasks"
        assert launch_readiness.get("open_p0_tasks", 0) > 0, "Should have open P0 tasks"

    def test_dashboard_contains_phases(self, admin_session):
        """Dashboard contains all 8 phases"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/dashboard", timeout=30)
        data = response.json()
        phases = data.get("phases", [])
        assert len(phases) >= 8, f"Expected at least 8 phases, got {len(phases)}"
        phase_titles = [p.get("title", "") for p in phases]
        assert any("P0 LAUNCH BLOCKERS" in t for t in phase_titles)
        assert any("CORE USER FLOWS" in t for t in phase_titles)
        assert any("FINAL ACCEPTANCE" in t for t in phase_titles)

    def test_dashboard_contains_tasks(self, admin_session):
        """Dashboard contains tasks with required fields"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/dashboard", timeout=30)
        data = response.json()
        tasks = data.get("tasks", [])
        assert len(tasks) > 0, "Should have tasks"
        # Check first task has required fields
        task = tasks[0]
        required_fields = ["task_id", "title", "status", "priority", "phase"]
        for field in required_fields:
            assert field in task, f"Task missing field: {field}"

    def test_dashboard_contains_release_gates(self, admin_session):
        """Dashboard contains release gates"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/dashboard", timeout=30)
        data = response.json()
        gates = data.get("release_gates", [])
        assert len(gates) > 0, "Should have release gates"
        gate_keys = [g.get("gate_key") for g in gates]
        assert "wallet_consistency" in gate_keys
        assert "environment_separation" in gate_keys

    def test_dashboard_contains_feature_registry(self, admin_session):
        """Dashboard contains feature registry"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/dashboard", timeout=30)
        data = response.json()
        registry = data.get("feature_registry", [])
        assert len(registry) > 0, "Should have feature registry items"
        module_keys = [r.get("module_key") for r in registry]
        assert "wallet" in module_keys
        assert "account" in module_keys

    def test_dashboard_contains_final_acceptance(self, admin_session):
        """Dashboard contains final acceptance report"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/dashboard", timeout=30)
        data = response.json()
        final = data.get("final_acceptance", {})
        assert "rows" in final
        assert "ready_for_beta" in final
        assert final.get("ready_for_beta") is False, "Should not be ready for beta with open P0"


class TestMasterRoadmapTaskUpdate:
    """Tests for PATCH /api/master-roadmap/tasks/{task_id}"""

    def test_update_task_status_success(self, admin_session):
        """Admin can update task status"""
        # First get a task ID
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/dashboard", timeout=30)
        tasks = response.json().get("tasks", [])
        assert len(tasks) > 0
        task_id = tasks[0]["task_id"]
        original_status = tasks[0]["status"]
        
        # Update to a different status
        new_status = "In Progress" if original_status != "In Progress" else "Ready"
        response = admin_session.patch(
            f"{BASE_URL}/api/master-roadmap/tasks/{task_id}",
            json={"status": new_status},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert response.json().get("success") is True
        
        # Restore original status
        admin_session.patch(
            f"{BASE_URL}/api/master-roadmap/tasks/{task_id}",
            json={"status": original_status},
            timeout=30
        )

    def test_update_task_invalid_status_returns_400(self, admin_session):
        """Invalid status returns 400"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/dashboard", timeout=30)
        tasks = response.json().get("tasks", [])
        task_id = tasks[0]["task_id"]
        
        response = admin_session.patch(
            f"{BASE_URL}/api/master-roadmap/tasks/{task_id}",
            json={"status": "InvalidStatus123"},
            timeout=30
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"

    def test_update_nonexistent_task_returns_404(self, admin_session):
        """Updating nonexistent task returns 404"""
        response = admin_session.patch(
            f"{BASE_URL}/api/master-roadmap/tasks/NONEXISTENT-TASK-999",
            json={"status": "In Progress"},
            timeout=30
        )
        assert response.status_code == 404


class TestMasterRoadmapGateUpdate:
    """Tests for PATCH /api/master-roadmap/release-gates/{gate_key}"""

    def test_update_gate_status_success(self, admin_session):
        """Admin can update release gate status"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/dashboard", timeout=30)
        gates = response.json().get("release_gates", [])
        assert len(gates) > 0
        gate_key = gates[0]["gate_key"]
        original_status = gates[0]["status"]
        
        # Update to a different status
        new_status = "incomplete" if original_status != "incomplete" else "blocked"
        response = admin_session.patch(
            f"{BASE_URL}/api/master-roadmap/release-gates/{gate_key}",
            json={"status": new_status},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert response.json().get("success") is True
        
        # Restore original status
        admin_session.patch(
            f"{BASE_URL}/api/master-roadmap/release-gates/{gate_key}",
            json={"status": original_status},
            timeout=30
        )

    def test_update_gate_invalid_status_returns_400(self, admin_session):
        """Invalid gate status returns 400"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/dashboard", timeout=30)
        gates = response.json().get("release_gates", [])
        gate_key = gates[0]["gate_key"]
        
        response = admin_session.patch(
            f"{BASE_URL}/api/master-roadmap/release-gates/{gate_key}",
            json={"status": "invalid-status-xyz"},
            timeout=30
        )
        assert response.status_code == 400


class TestMasterRoadmapFeatureRegistry:
    """Tests for PATCH /api/master-roadmap/feature-registry/{module_key}"""

    def test_update_feature_registry_toggle(self, admin_session):
        """Admin can toggle feature registry flags"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/dashboard", timeout=30)
        registry = response.json().get("feature_registry", [])
        assert len(registry) > 0
        
        # Find a module to toggle
        module = registry[0]
        module_key = module["module_key"]
        original_store_safe = module.get("store_safe", False)
        
        # Toggle store_safe
        response = admin_session.patch(
            f"{BASE_URL}/api/master-roadmap/feature-registry/{module_key}",
            json={"store_safe": not original_store_safe},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert response.json().get("success") is True
        
        # Restore original value
        admin_session.patch(
            f"{BASE_URL}/api/master-roadmap/feature-registry/{module_key}",
            json={"store_safe": original_store_safe},
            timeout=30
        )


class TestInvestorProgress:
    """Tests for /api/master-roadmap/investor-progress endpoint"""

    def test_investor_progress_returns_200_for_admin(self, admin_session):
        """Admin can access investor progress"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/investor-progress", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_investor_progress_requires_auth(self, guest_session):
        """Unauthenticated users cannot access investor progress"""
        response = guest_session.get(f"{BASE_URL}/api/master-roadmap/investor-progress", timeout=30)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_investor_progress_contains_disclosure_policy(self, admin_session):
        """Investor progress contains disclosure policy"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/investor-progress", timeout=30)
        data = response.json()
        assert "disclosure_policy" in data
        assert "Keine Kundendaten" in data["disclosure_policy"]

    def test_investor_progress_does_not_expose_sensitive_data(self, admin_session):
        """Investor progress does not expose customer data, credentials, or security details"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/investor-progress", timeout=30)
        data = response.json()
        payload_str = str(data).lower()
        
        # Should NOT contain actual sensitive data patterns (not feature names like "Password reset")
        sensitive_patterns = [
            "secret_key", "api_key=", "access_token=", "credential=",
            "private_key", "bcrypt", "$2b$", "mongodb://", "postgres://"
        ]
        for pattern in sensitive_patterns:
            assert pattern not in payload_str, f"Investor progress should not contain '{pattern}'"
        
        # Verify no customer emails or user IDs are exposed (except generic module names)
        assert "@icloud.com" not in payload_str
        assert "@gmail.com" not in payload_str

    def test_investor_progress_contains_required_fields(self, admin_session):
        """Investor progress contains required fields"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/investor-progress", timeout=30)
        data = response.json()
        required_fields = [
            "completed_milestones",
            "current_development_phase",
            "next_planned_milestones",
            "released_app_versions",
            "product_status",
            "disclosure_policy"
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"


class TestFinalAcceptance:
    """Tests for /api/master-roadmap/final-acceptance endpoint"""

    def test_final_acceptance_returns_200_for_admin(self, admin_session):
        """Admin can access final acceptance report"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/final-acceptance", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_final_acceptance_requires_admin(self, guest_session):
        """Unauthenticated users cannot access final acceptance"""
        response = guest_session.get(f"{BASE_URL}/api/master-roadmap/final-acceptance", timeout=30)
        assert response.status_code in [401, 403]

    def test_final_acceptance_contains_rows(self, admin_session):
        """Final acceptance contains feature rows"""
        response = admin_session.get(f"{BASE_URL}/api/master-roadmap/final-acceptance", timeout=30)
        data = response.json()
        assert "rows" in data
        assert len(data["rows"]) > 0
        # Check row structure
        row = data["rows"][0]
        assert "feature" in row
        assert "web_status" in row
        assert "ready_for_beta" in row


class TestWalletConsistency:
    """Tests for wallet consistency API contract"""

    def test_wallet_endpoint_returns_canonical_source(self, admin_session):
        """Wallet endpoint returns canonical_source metadata"""
        response = admin_session.get(f"{BASE_URL}/api/wallet", timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert "canonical_source" in data
        assert data["canonical_source"] == "users.balance"

    def test_wallet_balance_endpoint_returns_canonical_source(self, admin_session):
        """Wallet balance endpoint returns canonical_source metadata"""
        response = admin_session.get(f"{BASE_URL}/api/wallet/balance", timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert "canonical_source" in data
        assert data["canonical_source"] == "users.balance"

    def test_wallet_endpoints_return_same_balance(self, admin_session):
        """Both wallet endpoints return the same EUR balance"""
        response1 = admin_session.get(f"{BASE_URL}/api/wallet", timeout=30)
        response2 = admin_session.get(f"{BASE_URL}/api/wallet/balance", timeout=30)
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        balance1 = response1.json().get("balance")
        balance2 = response2.json().get("balance")
        
        assert balance1 == balance2, f"Wallet balance mismatch: {balance1} vs {balance2}"
