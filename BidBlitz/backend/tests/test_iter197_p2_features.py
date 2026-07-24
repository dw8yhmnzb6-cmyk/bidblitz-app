"""
Iteration 197 - P2 Features Testing
Tests for:
- Admin BioPay Vendor Diagnostics + Warning Workflows + Terminal Readiness
- Merchant Portal V5 Ops Suite (Multi-Company, Document Center, Maintenance Tracker)
- Arcade Hub Overview (Season/Leaderboard/Personal Best)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"
MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PASSWORD = "Haendler2026!"


@pytest.fixture(scope="module")
def admin_session():
    """Login as admin and return session with cookies"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    return session


@pytest.fixture(scope="module")
def merchant_session():
    """Login as merchant and return session with cookies"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": MERCHANT_EMAIL,
        "password": MERCHANT_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Merchant login failed: {response.status_code} - {response.text}")
    return session


class TestAdminBioPayVendorDiagnostics:
    """Admin BioPay Vendor Diagnostics endpoint tests"""

    def test_vendor_diagnostics_endpoint_returns_200(self, admin_session):
        """Test /api/admin/biopay/vendor-diagnostics returns 200"""
        response = admin_session.get(f"{BASE_URL}/api/admin/biopay/vendor-diagnostics")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_vendor_diagnostics_has_required_fields(self, admin_session):
        """Test vendor diagnostics response has vendors, warning_workflows, terminals"""
        response = admin_session.get(f"{BASE_URL}/api/admin/biopay/vendor-diagnostics")
        assert response.status_code == 200
        data = response.json()
        
        # Check required top-level fields
        assert "vendors" in data, "Response missing 'vendors' field"
        assert "warning_workflows" in data, "Response missing 'warning_workflows' field"
        assert "terminals" in data, "Response missing 'terminals' field"
        assert "generated_at" in data, "Response missing 'generated_at' field"
        
        # Verify arrays
        assert isinstance(data["vendors"], list), "vendors should be a list"
        assert isinstance(data["warning_workflows"], list), "warning_workflows should be a list"
        assert isinstance(data["terminals"], list), "terminals should be a list"

    def test_vendor_diagnostics_vendor_structure(self, admin_session):
        """Test vendor objects have expected structure"""
        response = admin_session.get(f"{BASE_URL}/api/admin/biopay/vendor-diagnostics")
        assert response.status_code == 200
        data = response.json()
        
        # If vendors exist, check structure
        if data["vendors"]:
            vendor = data["vendors"][0]
            expected_fields = ["vendor_name", "terminals_total", "critical_terminals", "warning_terminals", "avg_score"]
            for field in expected_fields:
                assert field in vendor, f"Vendor missing '{field}' field"

    def test_vendor_diagnostics_warning_workflow_structure(self, admin_session):
        """Test warning workflow objects have expected structure"""
        response = admin_session.get(f"{BASE_URL}/api/admin/biopay/vendor-diagnostics")
        assert response.status_code == 200
        data = response.json()
        
        # If warning_workflows exist, check structure
        if data["warning_workflows"]:
            workflow = data["warning_workflows"][0]
            expected_fields = ["workflow_id", "terminal_id", "severity", "title", "recommended_action"]
            for field in expected_fields:
                assert field in workflow, f"Warning workflow missing '{field}' field"

    def test_vendor_diagnostics_terminal_structure(self, admin_session):
        """Test terminal objects have expected structure"""
        response = admin_session.get(f"{BASE_URL}/api/admin/biopay/vendor-diagnostics")
        assert response.status_code == 200
        data = response.json()
        
        # If terminals exist, check structure
        if data["terminals"]:
            terminal = data["terminals"][0]
            expected_fields = ["terminal_id", "health_status"]
            for field in expected_fields:
                assert field in terminal, f"Terminal missing '{field}' field"

    def test_vendor_diagnostics_requires_admin(self):
        """Test vendor diagnostics requires admin role"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        response = session.get(f"{BASE_URL}/api/admin/biopay/vendor-diagnostics")
        # Should fail without auth
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"


class TestMerchantOpsSuite:
    """Merchant Portal V5 Ops Suite endpoint tests"""

    def test_ops_suite_endpoint_returns_200(self, merchant_session):
        """Test /api/merchant-portal/v5/ops-suite returns 200"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant-portal/v5/ops-suite")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_ops_suite_has_required_fields(self, merchant_session):
        """Test ops suite response has summary, companies, documents, maintenance"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant-portal/v5/ops-suite")
        assert response.status_code == 200
        data = response.json()
        
        # Check required top-level fields
        assert "summary" in data, "Response missing 'summary' field"
        assert "companies" in data, "Response missing 'companies' field"
        assert "documents" in data, "Response missing 'documents' field"
        assert "maintenance" in data, "Response missing 'maintenance' field"
        assert "generated_at" in data, "Response missing 'generated_at' field"

    def test_ops_suite_summary_structure(self, merchant_session):
        """Test ops suite summary has expected counts"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant-portal/v5/ops-suite")
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        expected_fields = ["companies_total", "documents_total", "documents_expiring_soon", "maintenance_open"]
        for field in expected_fields:
            assert field in summary, f"Summary missing '{field}' field"

    def test_ops_suite_companies_upsert(self, merchant_session):
        """Test creating a company via /api/merchant-portal/v5/companies/upsert"""
        payload = {
            "name": "TEST_Company_Iter197",
            "legal_name": "TEST Company GmbH",
            "country": "Kosovo",
            "status": "active",
            "manager_email": "test@company.com",
            "tax_id": "XK123456",
            "wallet_budget": 1000,
            "branch_count": 2
        }
        response = merchant_session.post(f"{BASE_URL}/api/merchant-portal/v5/companies/upsert", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("ok") == True, "Company upsert should return ok=True"
        # company_id is nested inside company object
        assert "company" in data or "company_id" in data, "Response should include company or company_id"
        if "company" in data:
            assert "company_id" in data["company"], "Company object should include company_id"

    def test_ops_suite_documents_upsert(self, merchant_session):
        """Test creating a document via /api/merchant-portal/v5/documents/upsert"""
        payload = {
            "title": "TEST_Document_Iter197",
            "category": "compliance",
            "status": "draft",
            "linked_company_id": "",
            "expiry_date": "2027-01-01",
            "external_url": "https://example.com/doc",
            "notes": "Test document for iteration 197"
        }
        response = merchant_session.post(f"{BASE_URL}/api/merchant-portal/v5/documents/upsert", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("ok") == True, "Document upsert should return ok=True"
        # document_id is nested inside document object
        assert "document" in data or "document_id" in data, "Response should include document or document_id"
        if "document" in data:
            assert "document_id" in data["document"], "Document object should include document_id"

    def test_ops_suite_maintenance_upsert(self, merchant_session):
        """Test creating a maintenance ticket via /api/merchant-portal/v5/maintenance/upsert"""
        payload = {
            "asset_name": "TEST_Terminal_Iter197",
            "asset_type": "terminal",
            "priority": "medium",
            "status": "open",
            "linked_company_id": "",
            "vendor_name": "Test Vendor",
            "next_check_at": "2026-02-01",
            "notes": "Test maintenance ticket for iteration 197"
        }
        response = merchant_session.post(f"{BASE_URL}/api/merchant-portal/v5/maintenance/upsert", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("ok") == True, "Maintenance upsert should return ok=True"
        # ticket_id is nested inside ticket object
        assert "ticket" in data or "ticket_id" in data, "Response should include ticket or ticket_id"
        if "ticket" in data:
            assert "ticket_id" in data["ticket"], "Ticket object should include ticket_id"

    def test_ops_suite_verify_created_data(self, merchant_session):
        """Test that created company, document, maintenance appear in ops-suite"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant-portal/v5/ops-suite")
        assert response.status_code == 200
        data = response.json()
        
        # Check summary counts are > 0 after creating test data
        summary = data.get("summary", {})
        assert summary.get("companies_total", 0) >= 1, "Should have at least 1 company"
        assert summary.get("documents_total", 0) >= 1, "Should have at least 1 document"
        # maintenance_open may be 0 if status changed, so just check it exists
        assert "maintenance_open" in summary


class TestArcadeHubOverview:
    """Arcade Hub Overview endpoint tests"""

    def test_arcade_hub_overview_returns_200(self, merchant_session):
        """Test /api/arcade/hub-overview returns 200"""
        response = merchant_session.get(f"{BASE_URL}/api/arcade/hub-overview")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_arcade_hub_overview_has_required_fields(self, merchant_session):
        """Test arcade hub overview has stats, leaderboards, personal_best"""
        response = merchant_session.get(f"{BASE_URL}/api/arcade/hub-overview")
        assert response.status_code == 200
        data = response.json()
        
        # Check required top-level fields
        assert "balance_blz" in data, "Response missing 'balance_blz' field"
        assert "season_id" in data, "Response missing 'season_id' field"
        assert "stats" in data, "Response missing 'stats' field"
        assert "leaderboards" in data, "Response missing 'leaderboards' field"
        assert "personal_best" in data, "Response missing 'personal_best' field"

    def test_arcade_hub_overview_stats_structure(self, merchant_session):
        """Test arcade hub stats has expected fields"""
        response = merchant_session.get(f"{BASE_URL}/api/arcade/hub-overview")
        assert response.status_code == 200
        data = response.json()
        
        stats = data.get("stats", {})
        expected_fields = ["games_played", "unique_games", "top_score", "total_reward_blz"]
        for field in expected_fields:
            assert field in stats, f"Stats missing '{field}' field"

    def test_arcade_hub_overview_leaderboards_structure(self, merchant_session):
        """Test arcade hub leaderboards has season and all_time"""
        response = merchant_session.get(f"{BASE_URL}/api/arcade/hub-overview")
        assert response.status_code == 200
        data = response.json()
        
        leaderboards = data.get("leaderboards", {})
        assert "season" in leaderboards, "Leaderboards missing 'season' field"
        assert "all_time" in leaderboards, "Leaderboards missing 'all_time' field"
        assert isinstance(leaderboards["season"], list), "season should be a list"
        assert isinstance(leaderboards["all_time"], list), "all_time should be a list"


class TestAdminBioPayOverview:
    """Admin BioPay Overview endpoint tests"""

    def test_biopay_overview_returns_200(self, admin_session):
        """Test /api/admin/biopay/overview returns 200"""
        response = admin_session.get(f"{BASE_URL}/api/admin/biopay/overview")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_biopay_audit_center_returns_200(self, admin_session):
        """Test /api/admin/biopay/audit-center returns 200"""
        response = admin_session.get(f"{BASE_URL}/api/admin/biopay/audit-center")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_biopay_terminal_diagnostics_returns_200(self, admin_session):
        """Test /api/admin/biopay/terminal-diagnostics returns 200"""
        response = admin_session.get(f"{BASE_URL}/api/admin/biopay/terminal-diagnostics")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"


class TestMerchantPortalV5Dashboard:
    """Merchant Portal V5 Dashboard endpoint tests"""

    def test_v5_dashboard_returns_200(self, merchant_session):
        """Test /api/merchant-portal/v5/dashboard returns 200"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant-portal/v5/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_v5_dashboard_has_executive_overview(self, merchant_session):
        """Test V5 dashboard has executive_overview"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant-portal/v5/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "executive_overview" in data, "Response missing 'executive_overview' field"
        assert "financials" in data, "Response missing 'financials' field"
        assert "merchant_kpis" in data, "Response missing 'merchant_kpis' field"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
