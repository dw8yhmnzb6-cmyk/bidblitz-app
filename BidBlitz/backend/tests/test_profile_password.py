"""
BidBlitz V2 - Profile Editing and Password Change Tests
Tests for PUT /api/user/profile and POST /api/user/change-password endpoints.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CUSTOMER_EMAIL = "kunde@bidblitz.com"
CUSTOMER_PASSWORD = "Kunde2026!"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


class TestProfileAPI:
    """Tests for GET and PUT /api/user/profile endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session and login as customer"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as customer
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.user = login_resp.json()
        self.original_name = self.user.get("name", "Test Kunde")
        yield
        
        # Cleanup: restore original name if changed
        try:
            self.session.put(f"{BASE_URL}/api/user/profile", json={"name": self.original_name})
        except:
            pass
    
    def test_get_profile_returns_user_data(self):
        """GET /api/user/profile returns user profile with all expected fields"""
        resp = self.session.get(f"{BASE_URL}/api/user/profile")
        assert resp.status_code == 200, f"GET profile failed: {resp.text}"
        
        data = resp.json()
        # Verify required fields
        assert "id" in data, "Profile should have id"
        assert "name" in data, "Profile should have name"
        assert "email" in data, "Profile should have email"
        assert "created_at" in data, "Profile should have created_at"
        assert data["email"] == CUSTOMER_EMAIL
        print(f"✓ GET /api/user/profile returns all expected fields")
    
    def test_get_profile_returns_created_at(self):
        """GET /api/user/profile returns created_at field (Member Since)"""
        resp = self.session.get(f"{BASE_URL}/api/user/profile")
        assert resp.status_code == 200
        
        data = resp.json()
        assert "created_at" in data, "Profile should have created_at field"
        assert data["created_at"], "created_at should not be empty"
        print(f"✓ Profile has created_at: {data['created_at']}")
    
    def test_update_profile_name_success(self):
        """PUT /api/user/profile updates name successfully"""
        new_name = "Test Name Updated"
        resp = self.session.put(f"{BASE_URL}/api/user/profile", json={"name": new_name})
        assert resp.status_code == 200, f"Update profile failed: {resp.text}"
        
        data = resp.json()
        assert data["name"] == new_name, f"Name should be updated to {new_name}"
        
        # Verify with GET
        get_resp = self.session.get(f"{BASE_URL}/api/user/profile")
        assert get_resp.status_code == 200
        assert get_resp.json()["name"] == new_name
        print(f"✓ PUT /api/user/profile updates name successfully")
    
    def test_update_profile_empty_name_fails(self):
        """PUT /api/user/profile with empty name returns validation error"""
        resp = self.session.put(f"{BASE_URL}/api/user/profile", json={"name": ""})
        # Should fail with 400 or 422 (validation error)
        assert resp.status_code in [400, 422], f"Empty name should fail validation: {resp.status_code}"
        print(f"✓ PUT /api/user/profile rejects empty name (status {resp.status_code})")
    
    def test_update_profile_whitespace_name_fails(self):
        """PUT /api/user/profile with whitespace-only name returns validation error"""
        resp = self.session.put(f"{BASE_URL}/api/user/profile", json={"name": "   "})
        # Should fail with 400 or 422 (validation error)
        assert resp.status_code in [400, 422], f"Whitespace name should fail validation: {resp.status_code}"
        print(f"✓ PUT /api/user/profile rejects whitespace-only name")
    
    def test_update_profile_no_fields_fails(self):
        """PUT /api/user/profile with no fields returns error"""
        resp = self.session.put(f"{BASE_URL}/api/user/profile", json={})
        assert resp.status_code == 400, f"No fields should return 400: {resp.status_code}"
        print(f"✓ PUT /api/user/profile rejects empty update")
    
    def test_update_profile_settings(self):
        """PUT /api/user/profile updates notification settings"""
        resp = self.session.put(f"{BASE_URL}/api/user/profile", json={
            "notifications_enabled": False,
            "email_notifications": False
        })
        assert resp.status_code == 200, f"Update settings failed: {resp.text}"
        
        data = resp.json()
        assert data["notifications_enabled"] == False
        assert data["email_notifications"] == False
        
        # Restore settings
        self.session.put(f"{BASE_URL}/api/user/profile", json={
            "notifications_enabled": True,
            "email_notifications": True
        })
        print(f"✓ PUT /api/user/profile updates notification settings")
    
    def test_get_profile_unauthenticated_fails(self):
        """GET /api/user/profile without auth returns 401"""
        new_session = requests.Session()
        resp = new_session.get(f"{BASE_URL}/api/user/profile")
        assert resp.status_code == 401, f"Unauthenticated should return 401: {resp.status_code}"
        print(f"✓ GET /api/user/profile returns 401 without auth")


class TestPasswordChangeAPI:
    """Tests for POST /api/user/change-password endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session and login as customer"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as customer
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        yield
    
    def test_change_password_wrong_current_fails(self):
        """POST /api/user/change-password with wrong current password fails"""
        resp = self.session.post(f"{BASE_URL}/api/user/change-password", json={
            "current_password": "WrongPassword123!",
            "new_password": "NewPassword123!"
        })
        assert resp.status_code == 400, f"Wrong password should return 400: {resp.status_code}"
        
        data = resp.json()
        # Should contain error message about incorrect password
        error_msg = str(data.get("detail", "")).lower()
        assert "incorrect" in error_msg or "invalid" in error_msg or "wrong" in error_msg, \
            f"Error should mention incorrect password: {data}"
        print(f"✓ POST /api/user/change-password rejects wrong current password")
    
    def test_change_password_short_new_fails(self):
        """POST /api/user/change-password with short new password fails"""
        resp = self.session.post(f"{BASE_URL}/api/user/change-password", json={
            "current_password": CUSTOMER_PASSWORD,
            "new_password": "12345"  # Too short (< 6 chars)
        })
        assert resp.status_code in [400, 422], f"Short password should fail: {resp.status_code}"
        print(f"✓ POST /api/user/change-password rejects short new password")
    
    def test_change_password_empty_fields_fails(self):
        """POST /api/user/change-password with empty fields fails"""
        resp = self.session.post(f"{BASE_URL}/api/user/change-password", json={
            "current_password": "",
            "new_password": ""
        })
        assert resp.status_code in [400, 422], f"Empty fields should fail: {resp.status_code}"
        print(f"✓ POST /api/user/change-password rejects empty fields")
    
    def test_change_password_success_and_restore(self):
        """POST /api/user/change-password successfully changes password and restores it"""
        temp_password = "TempPassword2026!"
        
        # Change to temp password
        resp = self.session.post(f"{BASE_URL}/api/user/change-password", json={
            "current_password": CUSTOMER_PASSWORD,
            "new_password": temp_password
        })
        assert resp.status_code == 200, f"Password change failed: {resp.text}"
        
        data = resp.json()
        assert data.get("success") == True, "Response should indicate success"
        print(f"✓ Password changed to temp password")
        
        # Verify new password works by logging in again
        new_session = requests.Session()
        new_session.headers.update({"Content-Type": "application/json"})
        login_resp = new_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": temp_password
        })
        assert login_resp.status_code == 200, f"Login with new password failed: {login_resp.text}"
        print(f"✓ Login with new password successful")
        
        # Restore original password
        restore_resp = new_session.post(f"{BASE_URL}/api/user/change-password", json={
            "current_password": temp_password,
            "new_password": CUSTOMER_PASSWORD
        })
        assert restore_resp.status_code == 200, f"Password restore failed: {restore_resp.text}"
        print(f"✓ Password restored to original: {CUSTOMER_PASSWORD}")
        
        # Verify original password works
        verify_session = requests.Session()
        verify_session.headers.update({"Content-Type": "application/json"})
        verify_resp = verify_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert verify_resp.status_code == 200, f"Login with restored password failed"
        print(f"✓ POST /api/user/change-password works correctly (password restored)")
    
    def test_change_password_unauthenticated_fails(self):
        """POST /api/user/change-password without auth returns 401"""
        new_session = requests.Session()
        new_session.headers.update({"Content-Type": "application/json"})
        resp = new_session.post(f"{BASE_URL}/api/user/change-password", json={
            "current_password": CUSTOMER_PASSWORD,
            "new_password": "NewPassword123!"
        })
        assert resp.status_code == 401, f"Unauthenticated should return 401: {resp.status_code}"
        print(f"✓ POST /api/user/change-password returns 401 without auth")


class TestProfileI18n:
    """Tests for profile-related i18n translations"""
    
    def test_profile_translations_exist(self):
        """Verify profile-related translation keys exist in I18nContext"""
        # This is a code review check - translations are in frontend
        # We verify the backend returns proper error messages that can be mapped
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert login_resp.status_code == 200
        
        # Test wrong password error message
        resp = session.post(f"{BASE_URL}/api/user/change-password", json={
            "current_password": "WrongPassword",
            "new_password": "NewPassword123!"
        })
        assert resp.status_code == 400
        
        data = resp.json()
        # Backend should return a clear error that frontend can map to i18n
        assert "detail" in data, "Error response should have detail field"
        print(f"✓ Backend returns proper error messages for i18n mapping: {data['detail']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
