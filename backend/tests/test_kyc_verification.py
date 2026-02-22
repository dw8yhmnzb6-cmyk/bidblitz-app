"""
KYC Verification System Tests - Using existing users
Tests for KYC document upload, submission, status, and admin approval/rejection
"""
import pytest
import requests
import os
import time
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "Admin123!"

# Use existing approved KYC user for testing
EXISTING_KYC_USER_EMAIL = "kyc-test-1771766626@test.de"
EXISTING_KYC_USER_PASSWORD = "Test123!"
EXISTING_KYC_USER_ID = "c0d2d5d0-87e6-4a1d-aad2-9bdd5212879f"


class TestKYCVerificationAPIs:
    """KYC Verification API Tests"""
    
    admin_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    # ==================== ADMIN LOGIN ====================
    
    def test_01_admin_login(self):
        """Test admin login to get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data.get("user", {}).get("is_admin") == True, "User is not admin"
        
        TestKYCVerificationAPIs.admin_token = data["token"]
        print(f"✓ Admin login successful")
    
    # ==================== KYC PENDING ENDPOINT ====================
    
    def test_02_get_pending_kyc_users(self):
        """Test getting pending KYC users"""
        response = self.session.get(
            f"{BASE_URL}/api/auth/kyc/pending",
            headers={"Authorization": f"Bearer {TestKYCVerificationAPIs.admin_token}"}
        )
        
        assert response.status_code == 200, f"Get pending users failed: {response.text}"
        data = response.json()
        assert "pending_users" in data, "No pending_users in response"
        assert "count" in data, "No count in response"
        assert isinstance(data["pending_users"], list), "pending_users should be a list"
        
        print(f"✓ Get pending KYC users works (count: {data['count']})")
    
    # ==================== KYC ALL USERS ENDPOINT ====================
    
    def test_03_get_all_kyc_users(self):
        """Test getting all users with KYC info"""
        response = self.session.get(
            f"{BASE_URL}/api/auth/kyc/all",
            headers={"Authorization": f"Bearer {TestKYCVerificationAPIs.admin_token}"}
        )
        
        assert response.status_code == 200, f"Get all users failed: {response.text}"
        data = response.json()
        assert "users" in data, "No users in response"
        assert "count" in data, "No count in response"
        assert isinstance(data["users"], list), "users should be a list"
        
        print(f"✓ Get all KYC users works (count: {data['count']})")
    
    def test_04_get_kyc_users_filtered_pending(self):
        """Test getting KYC users filtered by pending status"""
        response = self.session.get(
            f"{BASE_URL}/api/auth/kyc/all?status=pending",
            headers={"Authorization": f"Bearer {TestKYCVerificationAPIs.admin_token}"}
        )
        
        assert response.status_code == 200, f"Get filtered users failed: {response.text}"
        data = response.json()
        
        # All returned users should have pending status
        for user in data.get("users", []):
            if user.get("kyc_status"):
                assert user.get("kyc_status") == "pending", f"User has wrong status: {user.get('kyc_status')}"
        
        print(f"✓ Filter KYC users by pending status works")
    
    def test_05_get_kyc_users_filtered_approved(self):
        """Test getting KYC users filtered by approved status"""
        response = self.session.get(
            f"{BASE_URL}/api/auth/kyc/all?status=approved",
            headers={"Authorization": f"Bearer {TestKYCVerificationAPIs.admin_token}"}
        )
        
        assert response.status_code == 200, f"Get filtered users failed: {response.text}"
        data = response.json()
        
        # All returned users should have approved status
        for user in data.get("users", []):
            if user.get("kyc_status"):
                assert user.get("kyc_status") == "approved", f"User has wrong status: {user.get('kyc_status')}"
        
        print(f"✓ Filter KYC users by approved status works")
    
    def test_06_get_kyc_users_filtered_rejected(self):
        """Test getting KYC users filtered by rejected status"""
        response = self.session.get(
            f"{BASE_URL}/api/auth/kyc/all?status=rejected",
            headers={"Authorization": f"Bearer {TestKYCVerificationAPIs.admin_token}"}
        )
        
        assert response.status_code == 200, f"Get filtered users failed: {response.text}"
        data = response.json()
        
        # All returned users should have rejected status
        for user in data.get("users", []):
            if user.get("kyc_status"):
                assert user.get("kyc_status") == "rejected", f"User has wrong status: {user.get('kyc_status')}"
        
        print(f"✓ Filter KYC users by rejected status works")
    
    # ==================== KYC APPROVAL/REJECTION ====================
    
    def test_07_approve_kyc_user(self):
        """Test approving a KYC user"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/kyc/approve",
            json={
                "user_id": EXISTING_KYC_USER_ID,
                "approved": True
            },
            headers={"Authorization": f"Bearer {TestKYCVerificationAPIs.admin_token}"}
        )
        
        assert response.status_code == 200, f"KYC approval failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Approval not successful"
        
        print(f"✓ KYC approval works")
    
    def test_08_reject_kyc_user_with_reason(self):
        """Test rejecting a KYC user with reason"""
        # First set to pending to test rejection
        response = self.session.post(
            f"{BASE_URL}/api/auth/kyc/approve",
            json={
                "user_id": EXISTING_KYC_USER_ID,
                "approved": False,
                "rejection_reason": "Test rejection - documents unclear"
            },
            headers={"Authorization": f"Bearer {TestKYCVerificationAPIs.admin_token}"}
        )
        
        assert response.status_code == 200, f"KYC rejection failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Rejection not successful"
        
        print(f"✓ KYC rejection with reason works")
    
    def test_09_approve_kyc_user_again(self):
        """Test approving the user again after rejection"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/kyc/approve",
            json={
                "user_id": EXISTING_KYC_USER_ID,
                "approved": True
            },
            headers={"Authorization": f"Bearer {TestKYCVerificationAPIs.admin_token}"}
        )
        
        assert response.status_code == 200, f"KYC approval failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Approval not successful"
        
        print(f"✓ KYC re-approval works")
    
    # ==================== VERIFIED USER LOGIN ====================
    
    def test_10_verified_user_can_login(self):
        """Test that verified user can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_KYC_USER_EMAIL,
            "password": EXISTING_KYC_USER_PASSWORD
        })
        
        assert response.status_code == 200, f"Verified user login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        
        print(f"✓ Verified user can login successfully")
    
    # ==================== KYC STATUS ENDPOINT ====================
    
    def test_11_get_kyc_status_for_verified_user(self):
        """Test getting KYC status for verified user"""
        # First login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_KYC_USER_EMAIL,
            "password": EXISTING_KYC_USER_PASSWORD
        })
        user_token = login_response.json().get("token")
        
        response = self.session.get(
            f"{BASE_URL}/api/auth/kyc/status",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200, f"KYC status check failed: {response.text}"
        data = response.json()
        
        assert data.get("status") == "approved", f"Expected approved status, got: {data.get('status')}"
        assert data.get("id_front_uploaded") == True, "ID front should be uploaded"
        assert data.get("id_back_uploaded") == True, "ID back should be uploaded"
        assert data.get("selfie_uploaded") == True, "Selfie should be uploaded"
        
        print(f"✓ KYC status endpoint works for verified user")
    
    # ==================== ADMIN EXEMPTION ====================
    
    def test_12_admin_bypasses_kyc(self):
        """Test that admin login bypasses KYC check"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data.get("user", {}).get("is_admin") == True, "User is not admin"
        
        print(f"✓ Admin login bypasses KYC check")
    
    # ==================== NON-ADMIN ACCESS DENIED ====================
    
    def test_13_non_admin_cannot_access_pending_users(self):
        """Test that non-admin cannot access pending KYC users"""
        # Login as regular user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_KYC_USER_EMAIL,
            "password": EXISTING_KYC_USER_PASSWORD
        })
        user_token = login_response.json().get("token")
        
        response = self.session.get(
            f"{BASE_URL}/api/auth/kyc/pending",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 403, f"Expected 403, got: {response.status_code}"
        print(f"✓ Non-admin cannot access pending KYC users")
    
    def test_14_non_admin_cannot_approve_kyc(self):
        """Test that non-admin cannot approve KYC"""
        # Login as regular user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_KYC_USER_EMAIL,
            "password": EXISTING_KYC_USER_PASSWORD
        })
        user_token = login_response.json().get("token")
        
        response = self.session.post(
            f"{BASE_URL}/api/auth/kyc/approve",
            json={
                "user_id": "some-user-id",
                "approved": True
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 403, f"Expected 403, got: {response.status_code}"
        print(f"✓ Non-admin cannot approve KYC")
    
    # ==================== KYC UPLOAD ENDPOINT ====================
    
    def test_15_kyc_upload_endpoint_works(self):
        """Test KYC document upload endpoint"""
        # Login as regular user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_KYC_USER_EMAIL,
            "password": EXISTING_KYC_USER_PASSWORD
        })
        user_token = login_response.json().get("token")
        
        # Create a simple test image (1x1 pixel PNG)
        test_image = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        files = {"file": ("test_id.png", test_image, "image/png")}
        
        response = requests.post(
            f"{BASE_URL}/api/auth/kyc/upload?document_type=id_front",
            files=files,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200, f"KYC upload failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Upload not successful"
        assert data.get("document_type") == "id_front", "Wrong document type"
        assert "url" in data, "No URL in response"
        
        print(f"✓ KYC upload endpoint works")
    
    def test_16_kyc_upload_invalid_type_rejected(self):
        """Test KYC upload with invalid document type is rejected"""
        # Login as regular user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_KYC_USER_EMAIL,
            "password": EXISTING_KYC_USER_PASSWORD
        })
        user_token = login_response.json().get("token")
        
        test_image = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        files = {"file": ("test.png", test_image, "image/png")}
        
        response = requests.post(
            f"{BASE_URL}/api/auth/kyc/upload?document_type=invalid_type",
            files=files,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid type, got: {response.status_code}"
        print(f"✓ Invalid document type correctly rejected")
    
    # ==================== KYC SUBMIT ENDPOINT ====================
    
    def test_17_kyc_submit_endpoint_works(self):
        """Test KYC document submission endpoint"""
        # Login as regular user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_KYC_USER_EMAIL,
            "password": EXISTING_KYC_USER_PASSWORD
        })
        user_token = login_response.json().get("token")
        
        test_data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        response = self.session.post(
            f"{BASE_URL}/api/auth/kyc/submit",
            json={
                "id_front_url": test_data_url,
                "id_back_url": test_data_url,
                "selfie_url": test_data_url
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200, f"KYC submission failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Submission not successful"
        
        print(f"✓ KYC submit endpoint works")
    
    # ==================== KYC RESUBMIT ENDPOINT ====================
    
    def test_18_kyc_resubmit_requires_rejected_status(self):
        """Test KYC resubmit requires rejected status"""
        # Login as regular user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_KYC_USER_EMAIL,
            "password": EXISTING_KYC_USER_PASSWORD
        })
        user_token = login_response.json().get("token")
        
        # User is currently approved, so resubmit should fail
        response = self.session.post(
            f"{BASE_URL}/api/auth/kyc/resubmit",
            json={},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # Should fail because user is not rejected
        assert response.status_code == 400, f"Expected 400 for non-rejected user, got: {response.status_code}"
        print(f"✓ KYC resubmit correctly requires rejected status")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
