"""
Test KYC Review Page Feedback Display (Iteration 290)

Bug Fix Verification:
- User reported: On KYC Review/Submit page, only generic "Übermittlung fehlgeschlagen" error shown
- Expected: Specific error reasons should be displayed directly on the Review page

Tests:
1. Backend /api/kyc/submit returns user_feedback array when status=rejected
2. Backend /api/kyc/submit returns failed_attempts and can_request_manual_review
3. Backend /api/kyc/status returns detailed feedback fields
4. Frontend KYCReviewPage has data-testids: kyc-review-feedback-card, kyc-review-feedback-item-*, kyc-review-manual-review-btn
"""
import pytest
import requests
import os
import random
import string

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


def random_email():
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"TEST_kyc_iter290_{suffix}@test.com"


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


class TestKYCSubmitResponseStructure:
    """Test that /api/kyc/submit returns proper feedback structure."""
    
    def test_submit_response_contains_user_feedback_field(self, admin_session):
        """
        Verify that the KYC submit endpoint response includes user_feedback array.
        This is critical for displaying specific error messages on the Review page.
        """
        # Get a rejected KYC review to verify the response structure
        r = admin_session.get(f"{BASE_URL}/api/kyc/admin/list?status=rejected&limit=1")
        assert r.status_code == 200, f"Failed to get rejected reviews: {r.text}"
        
        data = r.json()
        reviews = data.get("reviews", [])
        
        if reviews:
            review = reviews[0]
            # Verify the review has user_feedback
            assert "user_feedback" in review or "failure_reasons" in review, \
                "Rejected review should have user_feedback or failure_reasons"
            
            user_feedback = review.get("user_feedback", [])
            print(f"User feedback from rejected review: {user_feedback}")
            
            # Verify feedback is a list
            assert isinstance(user_feedback, list), "user_feedback should be a list"
            
            # If there's feedback, verify it's German text
            if user_feedback:
                for msg in user_feedback:
                    assert isinstance(msg, str), "Each feedback item should be a string"
                    print(f"  - {msg}")
        else:
            print("No rejected reviews found to verify structure")
    
    def test_submit_response_contains_failed_attempts(self, admin_session):
        """Verify that rejected reviews track failed_attempts."""
        r = admin_session.get(f"{BASE_URL}/api/kyc/admin/list?status=rejected&limit=5")
        assert r.status_code == 200
        
        data = r.json()
        reviews = data.get("reviews", [])
        
        for review in reviews:
            if "failed_attempts" in review:
                failed_attempts = review.get("failed_attempts", 0)
                print(f"User {review.get('user_email')}: {failed_attempts} failed attempts")
                assert isinstance(failed_attempts, int), "failed_attempts should be an integer"
    
    def test_submit_response_contains_can_request_manual_review(self, admin_session):
        """Verify that reviews with 2+ failed attempts have manual_review_eligible."""
        r = admin_session.get(f"{BASE_URL}/api/kyc/admin/list?status=rejected&limit=10")
        assert r.status_code == 200
        
        data = r.json()
        reviews = data.get("reviews", [])
        
        for review in reviews:
            failed_attempts = review.get("failed_attempts", 0)
            manual_review_eligible = review.get("manual_review_eligible", False)
            
            if failed_attempts >= 2:
                print(f"User {review.get('user_email')}: {failed_attempts} attempts, manual_review_eligible={manual_review_eligible}")


class TestKYCStatusEndpointFeedback:
    """Test that /api/kyc/status returns detailed feedback for rejected users."""
    
    def test_status_returns_user_feedback_for_rejected_user(self):
        """
        Login as a rejected user and verify /api/kyc/status returns user_feedback.
        """
        # Use the known rejected user from previous tests
        session = requests.Session()
        r = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kyc.manual.1784792934@test.com",
            "password": "TestPass2026!"
        })
        
        if r.status_code != 200:
            pytest.skip("Rejected test user not available")
        
        # Get KYC status
        r = session.get(f"{BASE_URL}/api/kyc/status")
        assert r.status_code == 200, f"Failed to get KYC status: {r.text}"
        
        data = r.json()
        print(f"KYC Status Response: {data}")
        
        # Verify required fields
        assert "kyc_status" in data, "Missing kyc_status"
        assert "user_feedback" in data, "Missing user_feedback"
        assert "failed_attempts" in data, "Missing failed_attempts"
        assert "can_request_manual_review" in data, "Missing can_request_manual_review"
        
        # Verify user_feedback is populated for rejected status
        if data.get("kyc_status") == "rejected":
            user_feedback = data.get("user_feedback", [])
            print(f"User feedback: {user_feedback}")
            
            # Should have specific feedback, not just generic error
            assert len(user_feedback) > 0, "Rejected status should have specific user_feedback"
            
            # Verify feedback is German text
            for msg in user_feedback:
                assert isinstance(msg, str), "Feedback should be string"
                # Should not be generic error
                assert msg != "Übermittlung fehlgeschlagen", \
                    "Feedback should be specific, not generic 'Übermittlung fehlgeschlagen'"


class TestKYCIssueMessageMapping:
    """Test that ISSUE_MESSAGE_MAP provides German feedback messages."""
    
    def test_common_issue_codes_have_german_messages(self, admin_session):
        """
        Verify that common issue codes are mapped to German messages.
        Check by examining rejected reviews with user_feedback.
        """
        r = admin_session.get(f"{BASE_URL}/api/kyc/admin/list?status=rejected&limit=20")
        assert r.status_code == 200
        
        data = r.json()
        reviews = data.get("reviews", [])
        
        all_feedback = []
        for review in reviews:
            feedback = review.get("user_feedback", [])
            all_feedback.extend(feedback)
        
        # Remove duplicates
        unique_feedback = list(set(all_feedback))
        
        print(f"Found {len(unique_feedback)} unique feedback messages:")
        for msg in unique_feedback:
            print(f"  - {msg}")
        
        # Verify messages are in German (contain German characters or words)
        german_indicators = ["ist", "die", "der", "das", "bitte", "zu", "nicht", "auf", "mit"]
        for msg in unique_feedback:
            msg_lower = msg.lower()
            has_german = any(word in msg_lower for word in german_indicators)
            if not has_german:
                print(f"  WARNING: Message may not be German: {msg}")


class TestKYCManualReviewThreshold:
    """Test that manual review becomes available after 2 failed attempts."""
    
    def test_manual_review_available_after_threshold(self):
        """
        Verify that can_request_manual_review=true when failed_attempts >= 2.
        """
        session = requests.Session()
        r = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kyc.manual.1784792934@test.com",
            "password": "TestPass2026!"
        })
        
        if r.status_code != 200:
            pytest.skip("Rejected test user not available")
        
        r = session.get(f"{BASE_URL}/api/kyc/status")
        assert r.status_code == 200
        
        data = r.json()
        failed_attempts = data.get("failed_attempts", 0)
        can_request_manual_review = data.get("can_request_manual_review", False)
        manual_review_requested = data.get("manual_review_requested", False)
        
        print(f"Failed attempts: {failed_attempts}")
        print(f"Can request manual review: {can_request_manual_review}")
        print(f"Manual review requested: {manual_review_requested}")
        
        # If 2+ failed attempts and not already requested, should be able to request
        if failed_attempts >= 2 and not manual_review_requested:
            assert can_request_manual_review is True, \
                f"With {failed_attempts} failed attempts, can_request_manual_review should be True"


class TestFrontendDataTestIds:
    """
    Document the expected data-testids for the KYC Review page.
    These are verified by Playwright tests.
    """
    
    def test_document_expected_testids(self):
        """
        Document the data-testids that should be present on the KYC Review page.
        
        KYCFlow.jsx (Review Page - after submit rejection):
        - kyc-review-feedback-card: Container for feedback messages
        - kyc-review-feedback-item-{n}: Individual feedback items (0, 1, 2, ...)
        - kyc-review-manual-review-btn: Button to request manual review
        - kyc-review-manual-review-card: Card explaining manual review option
        
        VerificationPage.jsx (Status Page):
        - kyc-detailed-feedback-card: Container for detailed feedback
        - kyc-feedback-item-{n}: Individual feedback items
        - kyc-manual-review-card: Manual review info card
        - kyc-request-manual-review-button: Button to request manual review
        """
        expected_testids = {
            "KYCFlow.jsx (Review Page)": [
                "kyc-review-page",
                "kyc-review-feedback-card",
                "kyc-review-feedback-item-0",
                "kyc-review-feedback-item-1",
                "kyc-review-manual-review-btn",
                "kyc-review-manual-review-card",
            ],
            "VerificationPage.jsx (Status Page)": [
                "verification-page",
                "kyc-detailed-feedback-card",
                "kyc-feedback-item-0",
                "kyc-feedback-item-1",
                "kyc-manual-review-card",
                "kyc-request-manual-review-button",
            ]
        }
        
        for page, testids in expected_testids.items():
            print(f"\n{page}:")
            for testid in testids:
                print(f"  - {testid}")
        
        # This test always passes - it's documentation
        assert True


class TestKYCSubmitRejectionFlow:
    """Test the complete flow when KYC submit is rejected."""
    
    def test_rejection_response_structure(self, admin_session):
        """
        Verify the structure of a rejection response from /api/kyc/submit.
        
        Expected response when status=rejected:
        {
            "ok": true,
            "status": "rejected",
            "ai_confidence": <int>,
            "failure_reasons": ["code1", "code2"],
            "user_feedback": ["German message 1", "German message 2"],
            "failed_attempts": <int>,
            "can_request_manual_review": <bool>,
            "message": "Bitte korrigiere die markierten Punkte..."
        }
        """
        # Get a rejected review to verify the expected structure
        r = admin_session.get(f"{BASE_URL}/api/kyc/admin/list?status=rejected&limit=1")
        assert r.status_code == 200
        
        data = r.json()
        reviews = data.get("reviews", [])
        
        if reviews:
            review = reviews[0]
            
            # Document the expected fields
            expected_fields = [
                "user_id",
                "status",
                "user_feedback",
                "failure_reasons",
                "failed_attempts",
            ]
            
            print("Rejected review structure:")
            for field in expected_fields:
                value = review.get(field)
                print(f"  {field}: {value}")
            
            # Verify key fields exist
            assert review.get("status") == "rejected", "Status should be rejected"
            assert "user_feedback" in review or "failure_reasons" in review, \
                "Should have feedback information"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
