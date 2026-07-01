"""
BioPay V4 - Admin Audit Center, Terminal Diagnostics, FacePay Readiness, Advanced Fraud Scoring
Tests for iteration 170 features
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials from test_credentials.md
MERCHANT_EMAIL = "haendler@bidblitz.ae"
MERCHANT_PASSWORD = "Haendler2026!"
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"
STORE_ID = "69d23d461f01d08a8214f6a0"
REGISTER_ID = "DEV-A1DAE025"
BIOPAY_TERMINAL_ID = "BIO-A326ED0A62"


@pytest.fixture(scope="module")
def merchant_session():
    """Login as merchant and return session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": MERCHANT_EMAIL,
        "password": MERCHANT_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Merchant login failed: {resp.status_code} - {resp.text}")
    return session


@pytest.fixture(scope="module")
def admin_session():
    """Login as admin and return session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Admin login failed: {resp.status_code} - {resp.text}")
    return session


# ═══════════════════════════════════════════════════════════════════════════════
# MERCHANT BIOPAY ENDPOINTS - Fraud Summary, FacePay Readiness, Diagnostics
# ═══════════════════════════════════════════════════════════════════════════════

class TestMerchantBioPayFraudSummary:
    """Test GET /api/biopay/fraud-summary endpoint"""

    def test_fraud_summary_returns_structured_data(self, merchant_session):
        """Fraud summary should return network_risk_score, cashier_risk_scores, terminal_risk_scores, etc."""
        resp = merchant_session.get(f"{BASE_URL}/api/biopay/fraud-summary?store_id={STORE_ID}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        # Verify required fields exist
        assert "network_risk_score" in data, "Missing network_risk_score"
        assert "cashier_risk_scores" in data, "Missing cashier_risk_scores"
        assert "terminal_risk_scores" in data, "Missing terminal_risk_scores"
        assert "pending_approvals" in data, "Missing pending_approvals"
        assert "sessions_last_24h" in data, "Missing sessions_last_24h"
        assert "generated_at" in data, "Missing generated_at"
        
        # Verify data types
        assert isinstance(data["network_risk_score"], (int, float)), "network_risk_score should be numeric"
        assert isinstance(data["cashier_risk_scores"], list), "cashier_risk_scores should be a list"
        assert isinstance(data["terminal_risk_scores"], list), "terminal_risk_scores should be a list"
        assert isinstance(data["pending_approvals"], int), "pending_approvals should be int"
        assert isinstance(data["sessions_last_24h"], int), "sessions_last_24h should be int"
        
        print(f"✓ Fraud summary: network_risk={data['network_risk_score']}, pending_approvals={data['pending_approvals']}, sessions_24h={data['sessions_last_24h']}")


class TestMerchantFacePayReadiness:
    """Test GET /api/biopay/facepay-readiness endpoint"""

    def test_facepay_readiness_returns_flags_and_guidance(self, merchant_session):
        """FacePay readiness should return facepay_enabled, readiness_flags, recommended_next_steps"""
        resp = merchant_session.get(f"{BASE_URL}/api/biopay/facepay-readiness?store_id={STORE_ID}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        # Verify required fields
        assert "facepay_enabled" in data, "Missing facepay_enabled"
        assert "readiness_flags" in data, "Missing readiness_flags"
        assert "recommended_next_steps" in data, "Missing recommended_next_steps"
        assert "diagnostics" in data, "Missing diagnostics"
        
        # Verify data types
        assert isinstance(data["facepay_enabled"], bool), "facepay_enabled should be bool"
        assert isinstance(data["readiness_flags"], list), "readiness_flags should be a list"
        assert isinstance(data["recommended_next_steps"], list), "recommended_next_steps should be a list"
        assert isinstance(data["diagnostics"], list), "diagnostics should be a list"
        
        # FacePay flag should be disabled (as per test context)
        if not data["facepay_enabled"]:
            assert "feature_flag_disabled" in data["readiness_flags"], "Should have feature_flag_disabled flag when FacePay is off"
        
        print(f"✓ FacePay readiness: enabled={data['facepay_enabled']}, flags={data['readiness_flags']}, steps={len(data['recommended_next_steps'])}")

    def test_facepay_readiness_with_terminal_id(self, merchant_session):
        """FacePay readiness with specific terminal_id should return target_terminal info"""
        resp = merchant_session.get(f"{BASE_URL}/api/biopay/facepay-readiness?store_id={STORE_ID}&terminal_id={BIOPAY_TERMINAL_ID}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        # target_terminal may be None if terminal doesn't exist
        if data.get("target_terminal"):
            assert "terminal_id" in data["target_terminal"], "target_terminal should have terminal_id"
            assert "health_status" in data["target_terminal"], "target_terminal should have health_status"
            assert "diagnostic_score" in data["target_terminal"], "target_terminal should have diagnostic_score"
            print(f"✓ FacePay readiness with terminal: {data['target_terminal']['terminal_id']}")
        else:
            print(f"✓ FacePay readiness: terminal {BIOPAY_TERMINAL_ID} not found (expected if not created)")


class TestMerchantBioPayDiagnostics:
    """Test GET/POST /api/biopay/diagnostics endpoints"""

    def test_get_diagnostics_list(self, merchant_session):
        """GET diagnostics should return list of terminal diagnostics"""
        resp = merchant_session.get(f"{BASE_URL}/api/biopay/diagnostics?store_id={STORE_ID}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        assert "diagnostics" in data, "Missing diagnostics field"
        assert isinstance(data["diagnostics"], list), "diagnostics should be a list"
        
        # If there are diagnostics, verify structure
        if data["diagnostics"]:
            diag = data["diagnostics"][0]
            assert "diagnostic_id" in diag, "diagnostic should have diagnostic_id"
            assert "terminal_id" in diag, "diagnostic should have terminal_id"
            assert "check_type" in diag, "diagnostic should have check_type"
            assert "score" in diag, "diagnostic should have score"
            assert "flags" in diag, "diagnostic should have flags"
            assert "created_at" in diag, "diagnostic should have created_at"
            # Verify no ObjectId leak
            assert "_id" not in diag, "diagnostic should not expose _id"
            print(f"✓ Diagnostics list: {len(data['diagnostics'])} entries")
        else:
            print("✓ Diagnostics list: empty (no diagnostics yet)")

    def test_write_diagnostic_entry(self, merchant_session):
        """POST diagnostic should create a new diagnostic entry and update terminal health"""
        # First, get terminals to find a valid terminal_id
        terminals_resp = merchant_session.get(f"{BASE_URL}/api/biopay/terminals?store_id={STORE_ID}")
        if terminals_resp.status_code != 200:
            pytest.skip("Could not get terminals list")
        
        terminals = terminals_resp.json().get("terminals", [])
        if not terminals:
            pytest.skip("No terminals available to write diagnostic")
        
        terminal_id = terminals[0]["terminal_id"]
        
        # Write diagnostic
        payload = {
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "terminal_id": terminal_id,
            "check_type": "test_manual_check",
            "score": 88.5,
            "flags": ["test_flag_1", "test_flag_2"],
            "details": {"note": "Test diagnostic from iteration 170"}
        }
        resp = merchant_session.post(f"{BASE_URL}/api/biopay/diagnostics", json=payload)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        assert data.get("ok") is True, "Response should have ok=True"
        assert "diagnostic" in data, "Response should have diagnostic"
        
        diag = data["diagnostic"]
        assert diag["terminal_id"] == terminal_id, "diagnostic terminal_id should match"
        assert diag["check_type"] == "test_manual_check", "diagnostic check_type should match"
        assert diag["score"] == 88.5, "diagnostic score should match"
        assert "test_flag_1" in diag["flags"], "diagnostic flags should contain test_flag_1"
        assert "_id" not in diag, "diagnostic should not expose _id"
        
        print(f"✓ Wrote diagnostic: {diag['diagnostic_id']} for terminal {terminal_id}")
        
        # Verify diagnostic appears in list
        list_resp = merchant_session.get(f"{BASE_URL}/api/biopay/diagnostics?store_id={STORE_ID}")
        assert list_resp.status_code == 200
        diagnostics = list_resp.json().get("diagnostics", [])
        found = any(d["diagnostic_id"] == diag["diagnostic_id"] for d in diagnostics)
        assert found, "New diagnostic should appear in diagnostics list"
        print(f"✓ Diagnostic {diag['diagnostic_id']} verified in list")


class TestMerchantBioPayDashboard:
    """Test GET /api/biopay/dashboard endpoint - comprehensive dashboard data"""

    def test_dashboard_returns_all_sections(self, merchant_session):
        """Dashboard should return profiles_total, terminals, sessions, diagnostics, fraud_summary, facepay_enabled"""
        resp = merchant_session.get(f"{BASE_URL}/api/biopay/dashboard?store_id={STORE_ID}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        # Verify all required sections
        assert "profiles_total" in data, "Missing profiles_total"
        assert "terminals" in data, "Missing terminals"
        assert "sessions" in data, "Missing sessions"
        assert "diagnostics" in data, "Missing diagnostics"
        assert "fraud_summary" in data, "Missing fraud_summary"
        assert "facepay_enabled" in data, "Missing facepay_enabled"
        
        # Verify fraud_summary structure
        fraud = data["fraud_summary"]
        assert "network_risk_score" in fraud, "fraud_summary missing network_risk_score"
        assert "cashier_risk_scores" in fraud, "fraud_summary missing cashier_risk_scores"
        assert "terminal_risk_scores" in fraud, "fraud_summary missing terminal_risk_scores"
        assert "pending_approvals" in fraud, "fraud_summary missing pending_approvals"
        
        # Verify no ObjectId leaks in any list
        for terminal in data["terminals"]:
            assert "_id" not in terminal, "terminal should not expose _id"
        for session in data["sessions"]:
            assert "_id" not in session, "session should not expose _id"
        for diag in data["diagnostics"]:
            assert "_id" not in diag, "diagnostic should not expose _id"
        
        print(f"✓ Dashboard: {data['profiles_total']} profiles, {len(data['terminals'])} terminals, {len(data['sessions'])} sessions, {len(data['diagnostics'])} diagnostics")


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN BIOPAY AUDIT CENTER ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestAdminBioPayOverview:
    """Test GET /api/admin/biopay/overview endpoint"""

    def test_admin_overview_returns_all_data(self, admin_session):
        """Admin overview should return terminals, sessions, diagnostics, fraud_by_merchant"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/biopay/overview")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        # Verify required fields
        assert "terminals" in data, "Missing terminals"
        assert "sessions" in data, "Missing sessions"
        assert "diagnostics" in data, "Missing diagnostics"
        assert "fraud_by_merchant" in data, "Missing fraud_by_merchant"
        
        # Verify data types
        assert isinstance(data["terminals"], list), "terminals should be a list"
        assert isinstance(data["sessions"], list), "sessions should be a list"
        assert isinstance(data["diagnostics"], list), "diagnostics should be a list"
        assert isinstance(data["fraud_by_merchant"], list), "fraud_by_merchant should be a list"
        
        # Verify no ObjectId leaks
        for terminal in data["terminals"]:
            assert "_id" not in terminal, "terminal should not expose _id"
        for session in data["sessions"]:
            assert "_id" not in session, "session should not expose _id"
        for diag in data["diagnostics"]:
            assert "_id" not in diag, "diagnostic should not expose _id"
        
        # Verify fraud_by_merchant structure
        if data["fraud_by_merchant"]:
            fraud = data["fraud_by_merchant"][0]
            assert "merchant_id" in fraud, "fraud_by_merchant item should have merchant_id"
            assert "network_risk_score" in fraud, "fraud_by_merchant item should have network_risk_score"
        
        print(f"✓ Admin overview: {len(data['terminals'])} terminals, {len(data['sessions'])} sessions, {len(data['diagnostics'])} diagnostics, {len(data['fraud_by_merchant'])} merchants")


class TestAdminBioPayAuditCenter:
    """Test GET /api/admin/biopay/audit-center endpoint"""

    def test_audit_center_returns_logs_and_alerts(self, admin_session):
        """Audit center should return audit_logs and alerts"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/biopay/audit-center")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        # Verify required fields
        assert "audit_logs" in data, "Missing audit_logs"
        assert "alerts" in data, "Missing alerts"
        
        # Verify data types
        assert isinstance(data["audit_logs"], list), "audit_logs should be a list"
        assert isinstance(data["alerts"], list), "alerts should be a list"
        
        # Verify no ObjectId leaks
        for log in data["audit_logs"]:
            assert "_id" not in log, "audit_log should not expose _id"
        for alert in data["alerts"]:
            assert "_id" not in alert, "alert should not expose _id"
        
        # Verify audit_log structure if present
        if data["audit_logs"]:
            log = data["audit_logs"][0]
            assert "event" in log, "audit_log should have event"
            assert "timestamp" in log, "audit_log should have timestamp"
        
        # Verify alert structure if present
        if data["alerts"]:
            alert = data["alerts"][0]
            assert "alert_id" in alert or "type" in alert, "alert should have alert_id or type"
        
        print(f"✓ Audit center: {len(data['audit_logs'])} logs, {len(data['alerts'])} alerts")

    def test_audit_center_with_limit(self, admin_session):
        """Audit center should respect limit parameter"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/biopay/audit-center?limit=5")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        # Limit should be respected (max 5 logs)
        assert len(data.get("audit_logs", [])) <= 5, "audit_logs should respect limit"
        print(f"✓ Audit center with limit=5: {len(data.get('audit_logs', []))} logs")


class TestAdminBioPayTerminalDiagnostics:
    """Test GET /api/admin/biopay/terminal-diagnostics endpoint"""

    def test_terminal_diagnostics_returns_all_merchants(self, admin_session):
        """Terminal diagnostics should aggregate diagnostics from all merchants"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/biopay/terminal-diagnostics")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        # Verify required fields
        assert "diagnostics" in data, "Missing diagnostics"
        assert isinstance(data["diagnostics"], list), "diagnostics should be a list"
        
        # Verify no ObjectId leaks
        for diag in data["diagnostics"]:
            assert "_id" not in diag, "diagnostic should not expose _id"
            # Verify structure
            if diag:
                assert "diagnostic_id" in diag, "diagnostic should have diagnostic_id"
                assert "terminal_id" in diag, "diagnostic should have terminal_id"
                assert "score" in diag, "diagnostic should have score"
        
        print(f"✓ Admin terminal diagnostics: {len(data['diagnostics'])} entries")


class TestAdminBioPayAccessControl:
    """Test that admin endpoints require admin role"""

    def test_overview_requires_admin(self, merchant_session):
        """Non-admin should get 403 on admin endpoints"""
        resp = merchant_session.get(f"{BASE_URL}/api/admin/biopay/overview")
        assert resp.status_code == 403, f"Expected 403 for non-admin, got {resp.status_code}"
        print("✓ Admin overview correctly requires admin role")

    def test_audit_center_requires_admin(self, merchant_session):
        """Non-admin should get 403 on audit-center"""
        resp = merchant_session.get(f"{BASE_URL}/api/admin/biopay/audit-center")
        assert resp.status_code == 403, f"Expected 403 for non-admin, got {resp.status_code}"
        print("✓ Admin audit-center correctly requires admin role")

    def test_terminal_diagnostics_requires_admin(self, merchant_session):
        """Non-admin should get 403 on terminal-diagnostics"""
        resp = merchant_session.get(f"{BASE_URL}/api/admin/biopay/terminal-diagnostics")
        assert resp.status_code == 403, f"Expected 403 for non-admin, got {resp.status_code}"
        print("✓ Admin terminal-diagnostics correctly requires admin role")


# ═══════════════════════════════════════════════════════════════════════════════
# REGRESSION TESTS - Existing BioPay flows still work
# ═══════════════════════════════════════════════════════════════════════════════

class TestBioPayRegressionMerchantSecurity:
    """Regression tests for existing merchant security flows"""

    def test_security_dashboard_still_works(self, merchant_session):
        """POS Security dashboard should still return all sections"""
        resp = merchant_session.get(f"{BASE_URL}/api/pos/security/dashboard?store_id={STORE_ID}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        # Verify existing sections still present
        assert "alerts" in data or "fraud_alerts" in data, "Missing alerts section"
        assert "approval_queue" in data, "Missing approval_queue"
        assert "transaction_limits" in data, "Missing transaction_limits"
        print("✓ Security dashboard regression: all sections present")

    def test_biopay_terminals_list_still_works(self, merchant_session):
        """BioPay terminals list should still work"""
        resp = merchant_session.get(f"{BASE_URL}/api/biopay/terminals?store_id={STORE_ID}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        assert "terminals" in data, "Missing terminals"
        assert "facepay_enabled" in data, "Missing facepay_enabled"
        print(f"✓ BioPay terminals regression: {len(data['terminals'])} terminals")

    def test_biopay_sessions_list_still_works(self, merchant_session):
        """BioPay sessions list should still work"""
        resp = merchant_session.get(f"{BASE_URL}/api/biopay/sessions?store_id={STORE_ID}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        assert "sessions" in data, "Missing sessions"
        print(f"✓ BioPay sessions regression: {len(data['sessions'])} sessions")


# ═══════════════════════════════════════════════════════════════════════════════
# NO OBJECTID SERIALIZATION LEAKS
# ═══════════════════════════════════════════════════════════════════════════════

class TestNoObjectIdLeaks:
    """Verify no MongoDB ObjectId serialization leaks in any response"""

    def test_fraud_summary_no_objectid(self, merchant_session):
        """Fraud summary should not expose _id"""
        resp = merchant_session.get(f"{BASE_URL}/api/biopay/fraud-summary?store_id={STORE_ID}")
        assert resp.status_code == 200
        text = resp.text
        assert '"_id"' not in text, "Response should not contain _id field"
        assert "ObjectId" not in text, "Response should not contain ObjectId"
        print("✓ Fraud summary: no ObjectId leaks")

    def test_facepay_readiness_no_objectid(self, merchant_session):
        """FacePay readiness should not expose _id"""
        resp = merchant_session.get(f"{BASE_URL}/api/biopay/facepay-readiness?store_id={STORE_ID}")
        assert resp.status_code == 200
        text = resp.text
        assert '"_id"' not in text, "Response should not contain _id field"
        assert "ObjectId" not in text, "Response should not contain ObjectId"
        print("✓ FacePay readiness: no ObjectId leaks")

    def test_admin_overview_no_objectid(self, admin_session):
        """Admin overview should not expose _id"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/biopay/overview")
        assert resp.status_code == 200
        text = resp.text
        assert '"_id"' not in text, "Response should not contain _id field"
        assert "ObjectId" not in text, "Response should not contain ObjectId"
        print("✓ Admin overview: no ObjectId leaks")

    def test_admin_audit_center_no_objectid(self, admin_session):
        """Admin audit center should not expose _id"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/biopay/audit-center")
        assert resp.status_code == 200
        text = resp.text
        assert '"_id"' not in text, "Response should not contain _id field"
        assert "ObjectId" not in text, "Response should not contain ObjectId"
        print("✓ Admin audit center: no ObjectId leaks")

    def test_admin_terminal_diagnostics_no_objectid(self, admin_session):
        """Admin terminal diagnostics should not expose _id"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/biopay/terminal-diagnostics")
        assert resp.status_code == 200
        text = resp.text
        assert '"_id"' not in text, "Response should not contain _id field"
        assert "ObjectId" not in text, "Response should not contain ObjectId"
        print("✓ Admin terminal diagnostics: no ObjectId leaks")
