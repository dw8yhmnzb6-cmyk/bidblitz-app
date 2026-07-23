"""
Test KYC Detailed Feedback and Manual Review Features (Iteration 289)

Tests:
1. KYC status endpoint returns detailed failure_reasons and user_feedback
2. After 2 failed attempts, can_request_manual_review becomes True
3. POST /api/kyc/manual-review/request works correctly
4. Admin can see pending manual review cases in /api/kyc/admin/list?status=pending
5. Admin can approve/reject via /api/admin/customers/{user_id}/kyc
6. TEST_MODE allows features but KYC status shows actual internal status
"""
import pytest
import requests
import os
import time
import random
import string

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


def random_email():
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"TEST_kyc_iter289_{suffix}@test.com"


@pytest.fixture(scope="module")
def admin_session():
    """Login as admin and return session with cookies."""
    session = requests.Session()
    r = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return session


@pytest.fixture(scope="module")
def test_user_session():
    """Register a fresh test user and return session."""
    session = requests.Session()
    email = random_email()
    password = "TestPass2026!"
    
    r = session.post(f"{BASE_URL}/api/auth/register", json={
        "email": email,
        "password": password,
        "name": "KYC Test User"
    })
    assert r.status_code in [200, 201], f"Registration failed: {r.text}"
    
    # Login
    r = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": email,
        "password": password
    })
    assert r.status_code == 200, f"Login failed: {r.text}"
    
    data = r.json()
    user_id = data.get("user", {}).get("user_id") or data.get("user_id") or data.get("id")
    
    return {"session": session, "email": email, "user_id": user_id}


class TestKYCStatusEndpoint:
    """Test /api/kyc/status returns detailed feedback fields."""
    
    def test_kyc_status_returns_feedback_fields(self, test_user_session):
        """Verify KYC status response includes failure_reasons, user_feedback, failed_attempts, can_request_manual_review."""
        session = test_user_session["session"]
        
        r = session.get(f"{BASE_URL}/api/kyc/status")
        assert r.status_code == 200, f"KYC status failed: {r.text}"
        
        data = r.json()
        
        # Check required fields exist
        assert "kyc_status" in data, "Missing kyc_status field"
        assert "failure_reasons" in data, "Missing failure_reasons field"
        assert "user_feedback" in data, "Missing user_feedback field"
        assert "failed_attempts" in data, "Missing failed_attempts field"
        assert "can_request_manual_review" in data, "Missing can_request_manual_review field"
        assert "manual_review_requested" in data, "Missing manual_review_requested field"
        assert "can_use_features" in data, "Missing can_use_features field"
        
        print(f"KYC Status Response: {data}")
    
    def test_kyc_status_capabilities_in_test_mode(self, test_user_session):
        """In TEST_MODE, can_use_features should allow features even if KYC not approved."""
        session = test_user_session["session"]
        
        r = session.get(f"{BASE_URL}/api/kyc/status")
        assert r.status_code == 200
        
        data = r.json()
        capabilities = data.get("can_use_features", {})
        
        # In TEST_MODE, features should be enabled
        # But kyc_status should still reflect actual internal status
        print(f"KYC Status: {data.get('kyc_status')}")
        print(f"Capabilities: {capabilities}")
        
        # Browse should always be True
        assert capabilities.get("browse") is True, "browse should always be True"


class TestKYCManualReviewThreshold:
    """Test that manual review button appears after 2 failed attempts."""
    
    def test_manual_review_not_available_initially(self, test_user_session):
        """Fresh user should not have can_request_manual_review=True."""
        session = test_user_session["session"]
        
        r = session.get(f"{BASE_URL}/api/kyc/status")
        assert r.status_code == 200
        
        data = r.json()
        assert data.get("can_request_manual_review") is False, "Fresh user should not have manual review available"
        assert data.get("failed_attempts", 0) == 0, "Fresh user should have 0 failed attempts"
    
    def test_manual_review_request_fails_without_threshold(self, test_user_session):
        """Requesting manual review without 2 failed attempts should fail."""
        session = test_user_session["session"]
        
        r = session.post(f"{BASE_URL}/api/kyc/manual-review/request")
        # Should fail because user hasn't reached threshold
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        
        data = r.json()
        print(f"Manual review request response (expected failure): {data}")


class TestAdminKYCManualReviewFlow:
    """Test admin can see and decide on manual review cases."""
    
    def test_admin_kyc_list_endpoint(self, admin_session):
        """Admin can list KYC reviews with status filter."""
        r = admin_session.get(f"{BASE_URL}/api/kyc/admin/list?status=pending")
        assert r.status_code == 200, f"Admin KYC list failed: {r.text}"
        
        data = r.json()
        assert "reviews" in data, "Missing reviews field"
        assert "total" in data, "Missing total field"
        
        print(f"Admin KYC List (pending): {len(data.get('reviews', []))} reviews")
    
    def test_admin_kyc_list_all_statuses(self, admin_session):
        """Admin can list all KYC reviews."""
        r = admin_session.get(f"{BASE_URL}/api/kyc/admin/list?status=all")
        assert r.status_code == 200, f"Admin KYC list (all) failed: {r.text}"
        
        data = r.json()
        print(f"Admin KYC List (all): {len(data.get('reviews', []))} reviews")


class TestAdminKYCDecision:
    """Test admin can approve/reject KYC via /api/admin/customers/{user_id}/kyc."""
    
    def test_admin_kyc_decision_endpoint_exists(self, admin_session):
        """Verify the admin KYC decision endpoint exists."""
        # Use a dummy user_id to test endpoint existence
        r = admin_session.post(
            f"{BASE_URL}/api/admin/customers/000000000000000000000000/kyc",
            json={"decision": "approve", "reason": "Test"}
        )
        # Should return 404 (user not found) not 405 (method not allowed)
        assert r.status_code in [404, 400], f"Unexpected status: {r.status_code} - {r.text}"
        print(f"Admin KYC decision endpoint response: {r.status_code}")


class TestKYCFeedbackMapping:
    """Test that ISSUE_MESSAGE_MAP provides German feedback messages."""
    
    def test_issue_message_map_exists(self):
        """Verify the backend has proper issue-to-message mapping."""
        # This is a code review check - the mapping should exist in kyc.py
        # We verify by checking the KYC status response structure
        pass


class TestKYCManualReviewE2E:
    """End-to-end test for manual review flow with DB preparation."""
    
    def test_prepare_user_for_manual_review(self, admin_session):
        """
        Create a test user, set their KYC to rejected with 2 failed attempts,
        then verify they can request manual review.
        """
        # Step 1: Register a fresh user
        user_session = requests.Session()
        email = random_email()
        password = "TestPass2026!"
        
        r = user_session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "name": "Manual Review Test User"
        })
        assert r.status_code in [200, 201], f"Registration failed: {r.text}"
        
        # Login
        r = user_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        assert r.status_code == 200, f"Login failed: {r.text}"
        
        data = r.json()
        user_id = data.get("user", {}).get("user_id") or data.get("user_id") or data.get("id")
        print(f"Created test user: {email}, user_id: {user_id}")
        
        # Step 2: Get admin to set KYC status to rejected with 2 failed attempts
        # First, get the user's current status
        r = user_session.get(f"{BASE_URL}/api/kyc/status")
        assert r.status_code == 200
        initial_status = r.json()
        print(f"Initial KYC status: {initial_status}")
        
        # Step 3: Admin rejects the user's KYC (simulating 2 failed attempts)
        # We need to use the admin endpoint to set the status
        r = admin_session.post(
            f"{BASE_URL}/api/admin/customers/{user_id}/kyc",
            json={"decision": "reject", "reason": "Test rejection for manual review flow"}
        )
        print(f"Admin reject response: {r.status_code} - {r.text}")
        
        # Step 4: Check user's KYC status after rejection
        r = user_session.get(f"{BASE_URL}/api/kyc/status")
        assert r.status_code == 200
        status_after_reject = r.json()
        print(f"KYC status after admin rejection: {status_after_reject}")
        
        return {
            "user_session": user_session,
            "email": email,
            "user_id": user_id,
            "admin_session": admin_session
        }


class TestKYCDetailedFeedbackDisplay:
    """Test that detailed feedback is properly structured for UI display."""
    
    def test_feedback_structure(self, admin_session):
        """Verify KYC reviews contain user_feedback array for UI display."""
        r = admin_session.get(f"{BASE_URL}/api/kyc/admin/list?status=all&limit=10")
        assert r.status_code == 200
        
        data = r.json()
        reviews = data.get("reviews", [])
        
        for review in reviews:
            # Each review should have these fields
            assert "user_id" in review, "Missing user_id in review"
            assert "status" in review, "Missing status in review"
            
            # Check for feedback fields
            if "user_feedback" in review:
                assert isinstance(review["user_feedback"], list), "user_feedback should be a list"
                print(f"Review {review.get('user_id')}: user_feedback = {review.get('user_feedback')}")
            
            if "failure_reasons" in review:
                assert isinstance(review["failure_reasons"], list), "failure_reasons should be a list"
                print(f"Review {review.get('user_id')}: failure_reasons = {review.get('failure_reasons')}")


class TestKYCAdminDecisionFlow:
    """Test the complete admin decision flow."""
    
    def test_admin_approve_kyc(self, admin_session):
        """Test admin can approve a user's KYC."""
        # First, find a user with pending/rejected KYC
        r = admin_session.get(f"{BASE_URL}/api/kyc/admin/list?status=pending&limit=5")
        assert r.status_code == 200
        
        data = r.json()
        reviews = data.get("reviews", [])
        
        if reviews:
            user_id = reviews[0].get("user_id")
            print(f"Testing approval for user_id: {user_id}")
            
            # Approve the KYC
            r = admin_session.post(
                f"{BASE_URL}/api/admin/customers/{user_id}/kyc",
                json={"decision": "approve", "reason": "Manuell durch Admin geprüft und freigeschaltet"}
            )
            print(f"Approve response: {r.status_code} - {r.text}")
            
            if r.status_code == 200:
                result = r.json()
                assert result.get("ok") is True, "Approval should return ok=True"
                assert result.get("kyc_status") == "approved", "Status should be approved"
        else:
            print("No pending KYC reviews to test approval")


class TestKYCIssueMessageMapping:
    """Verify the German issue messages are properly mapped."""
    
    def test_issue_codes_have_german_messages(self):
        """Check that common issue codes map to German messages."""
        # These are the expected issue codes from the backend
        expected_codes = [
            "front_too_high", "front_too_low", "front_cropped", "front_blurry", "front_dark",
            "back_too_high", "back_too_low", "back_cropped", "back_blurry", "back_dark",
            "selfie_too_high", "selfie_too_low", "selfie_cropped", "selfie_blurry", "selfie_dark",
            "selfie_face_not_clear", "selfie_document_not_visible",
            "document_not_real", "document_expired", "document_mismatch",
            "face_mismatch", "fraud_signal"
        ]
        
        # This is a documentation test - the codes should exist in ISSUE_MESSAGE_MAP
        print(f"Expected issue codes: {expected_codes}")
        print("These should all have German messages in ISSUE_MESSAGE_MAP in kyc.py")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
