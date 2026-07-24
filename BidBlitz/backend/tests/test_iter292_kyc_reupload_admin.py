"""
Test KYC Admin Reupload Feature - Iteration 292
Tests:
1. Admin can set decision=reupload for KYC
2. Backend sets reupload_requested and admin_note correctly
3. Customer sees admin hints in KYC status
"""
import os
import pytest
import requests
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"
KYC_TEST_USER_EMAIL = "kyc.manual.1784792934@test.com"
KYC_TEST_USER_PASSWORD = "TestPass2026!"


@pytest.fixture(scope="module")
def admin_session():
    """Login as admin and return session with cookies"""
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    assert data.get("role") == "admin", "User is not admin"
    return session


@pytest.fixture(scope="module")
def kyc_user_session():
    """Login as KYC test user and return session with cookies"""
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": KYC_TEST_USER_EMAIL, "password": KYC_TEST_USER_PASSWORD},
    )
    assert response.status_code == 200, f"KYC user login failed: {response.text}"
    return session


@pytest.fixture(scope="module")
def kyc_user_id(kyc_user_session):
    """Get the KYC test user ID"""
    response = kyc_user_session.get(f"{BASE_URL}/api/auth/me")
    assert response.status_code == 200
    return response.json().get("id")


class TestAdminKYCReuploadDecision:
    """Test admin KYC reupload decision endpoint"""

    def test_admin_can_set_reupload_decision(self, admin_session, kyc_user_id):
        """Admin can set decision=reupload with a custom reason"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/customers/{kyc_user_id}/kyc",
            json={
                "decision": "reupload",
                "reason": "Bitte die Vorderseite ohne Spiegelung und vollständig hochladen.",
            },
        )
        assert response.status_code == 200, f"Reupload decision failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("ok") is True
        assert data.get("user_id") == kyc_user_id
        assert data.get("reupload_requested") is True
        assert data.get("kyc_verified") is False
        # Status should be rejected when reupload is requested
        assert data.get("kyc_status") == "rejected"

    def test_customer_sees_reupload_requested_flag(self, kyc_user_session):
        """Customer KYC status shows reupload_requested=true"""
        response = kyc_user_session.get(f"{BASE_URL}/api/kyc/status")
        assert response.status_code == 200, f"KYC status failed: {response.text}"
        data = response.json()
        
        assert data.get("reupload_requested") is True, "reupload_requested should be True"

    def test_customer_sees_admin_note(self, kyc_user_session):
        """Customer KYC status shows admin_note"""
        response = kyc_user_session.get(f"{BASE_URL}/api/kyc/status")
        assert response.status_code == 200
        data = response.json()
        
        admin_note = data.get("admin_note")
        assert admin_note is not None, "admin_note should be set"
        assert len(admin_note) > 0, "admin_note should not be empty"

    def test_customer_sees_admin_message_in_user_feedback(self, kyc_user_session):
        """Customer KYC status includes admin message in user_feedback"""
        response = kyc_user_session.get(f"{BASE_URL}/api/kyc/status")
        assert response.status_code == 200
        data = response.json()
        
        user_feedback = data.get("user_feedback", [])
        assert len(user_feedback) > 0, "user_feedback should contain admin message"

    def test_failed_attempts_reset_on_reupload(self, kyc_user_session):
        """Failed attempts should be reset to 0 when reupload is requested"""
        response = kyc_user_session.get(f"{BASE_URL}/api/kyc/status")
        assert response.status_code == 200
        data = response.json()
        
        # When admin requests reupload, failed_attempts should be reset
        assert data.get("failed_attempts") == 0, "failed_attempts should be reset to 0"


class TestAdminKYCDecisionValidation:
    """Test validation of KYC decision endpoint"""

    def test_invalid_decision_rejected(self, admin_session, kyc_user_id):
        """Invalid decision value should be rejected"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/customers/{kyc_user_id}/kyc",
            json={"decision": "invalid_decision", "reason": "Test"},
        )
        assert response.status_code == 422, "Invalid decision should return 422"

    def test_approve_decision_works(self, admin_session, kyc_user_id):
        """Approve decision should work"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/customers/{kyc_user_id}/kyc",
            json={"decision": "approve", "reason": "Manuell geprüft und freigegeben"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("kyc_status") == "approved"
        assert data.get("kyc_verified") is True
        assert data.get("reupload_requested") is False

    def test_reject_decision_works(self, admin_session, kyc_user_id):
        """Reject decision should work"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/customers/{kyc_user_id}/kyc",
            json={"decision": "reject", "reason": "Dokument nicht lesbar"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("kyc_status") == "rejected"
        assert data.get("kyc_verified") is False


class TestKYCStatusResponseStructure:
    """Test KYC status response has all required fields"""

    def test_kyc_status_has_reupload_fields(self, kyc_user_session):
        """KYC status response includes reupload-related fields"""
        response = kyc_user_session.get(f"{BASE_URL}/api/kyc/status")
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields exist
        assert "reupload_requested" in data, "reupload_requested field missing"
        assert "admin_note" in data, "admin_note field missing"
        assert "user_feedback" in data, "user_feedback field missing"
        assert "failure_reasons" in data, "failure_reasons field missing"
        assert "can_request_manual_review" in data, "can_request_manual_review field missing"
        assert "manual_review_requested" in data, "manual_review_requested field missing"


class TestAdminKYCListEndpoint:
    """Test admin KYC list endpoint"""

    def test_admin_can_list_kyc_reviews(self, admin_session):
        """Admin can list KYC reviews"""
        response = admin_session.get(f"{BASE_URL}/api/kyc/admin/list")
        assert response.status_code == 200
        data = response.json()
        assert "reviews" in data
        assert "total" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
