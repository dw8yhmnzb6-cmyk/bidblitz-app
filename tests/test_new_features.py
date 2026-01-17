"""
Backend API Tests for New Features:
- Legal pages (Impressum, Datenschutz, AGB) - Frontend only, no backend endpoints
- Password Reset Flow (forgot-password, verify-reset-code, reset-password)
- User Profile Management (update profile, change password)
- Bid History
- Purchases
- Admin Payments Overview
- Admin System Logs
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.de"
ADMIN_PASSWORD = "Admin123!"
CUSTOMER_EMAIL = "kunde@bidblitz.de"
CUSTOMER_PASSWORD = "Kunde123!"


class TestPasswordResetFlow:
    """Test the 3-step password reset process"""
    
    def test_forgot_password_valid_email(self):
        """Step 1: Request password reset code"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": CUSTOMER_EMAIL
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        # Demo mode returns the code
        assert "demo_code" in data
        print(f"Reset code received: {data.get('demo_code')}")
    
    def test_forgot_password_invalid_email(self):
        """Step 1: Request with non-existent email (should still return success to prevent enumeration)"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "nonexistent@test.com"
        })
        # Should return 200 to prevent email enumeration
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
    
    def test_verify_reset_code_invalid(self):
        """Step 2: Verify with invalid code"""
        response = requests.post(f"{BASE_URL}/api/auth/verify-reset-code", json={
            "email": CUSTOMER_EMAIL,
            "code": "INVALID"
        })
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
    
    def test_full_password_reset_flow(self):
        """Complete 3-step password reset flow"""
        # Step 1: Request reset code
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": CUSTOMER_EMAIL
        })
        assert response.status_code == 200
        data = response.json()
        reset_code = data.get("demo_code")
        assert reset_code is not None, "Demo code not returned"
        print(f"Step 1 - Got reset code: {reset_code}")
        
        # Step 2: Verify code
        response = requests.post(f"{BASE_URL}/api/auth/verify-reset-code", json={
            "email": CUSTOMER_EMAIL,
            "code": reset_code
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("valid") == True
        print("Step 2 - Code verified successfully")
        
        # Step 3: Reset password (use same password to not break other tests)
        response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "email": CUSTOMER_EMAIL,
            "code": reset_code,
            "new_password": CUSTOMER_PASSWORD  # Keep same password
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("Step 3 - Password reset successfully")
        
        # Verify login still works
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200
        print("Login verified after password reset")


class TestUserProfileManagement:
    """Test user profile update and password change"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Customer login failed")
        return response.json().get("token")
    
    def test_get_profile_unauthorized(self):
        """Test profile access without auth"""
        response = requests.put(f"{BASE_URL}/api/user/profile", json={
            "name": "Test"
        })
        assert response.status_code == 401 or response.status_code == 403
    
    def test_update_profile_name(self, customer_token):
        """Test updating user name"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Update name
        response = requests.put(f"{BASE_URL}/api/user/profile", json={
            "name": "Kunde Test"
        }, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert data["user"]["name"] == "Kunde Test"
        print(f"Profile updated: {data['user']['name']}")
        
        # Restore original name
        response = requests.put(f"{BASE_URL}/api/user/profile", json={
            "name": "Kunde"
        }, headers=headers)
        assert response.status_code == 200
    
    def test_update_profile_email_already_taken(self, customer_token):
        """Test updating email to one that's already taken"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        response = requests.put(f"{BASE_URL}/api/user/profile", json={
            "email": ADMIN_EMAIL  # Try to use admin's email
        }, headers=headers)
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"Email conflict handled: {data['detail']}")
    
    def test_change_password_wrong_current(self, customer_token):
        """Test password change with wrong current password"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        response = requests.put(f"{BASE_URL}/api/user/change-password", json={
            "current_password": "WrongPassword123!",
            "new_password": "NewPassword123!"
        }, headers=headers)
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"Wrong password handled: {data['detail']}")
    
    def test_change_password_success(self, customer_token):
        """Test successful password change"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Change password
        response = requests.put(f"{BASE_URL}/api/user/change-password", json={
            "current_password": CUSTOMER_PASSWORD,
            "new_password": "TempPassword123!"
        }, headers=headers)
        assert response.status_code == 200
        print("Password changed successfully")
        
        # Login with new password
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": "TempPassword123!"
        })
        assert response.status_code == 200
        new_token = response.json().get("token")
        print("Login with new password successful")
        
        # Change back to original password
        headers = {"Authorization": f"Bearer {new_token}"}
        response = requests.put(f"{BASE_URL}/api/user/change-password", json={
            "current_password": "TempPassword123!",
            "new_password": CUSTOMER_PASSWORD
        }, headers=headers)
        assert response.status_code == 200
        print("Password restored to original")


class TestBidHistory:
    """Test bid history endpoint"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Customer login failed")
        return response.json().get("token")
    
    def test_get_bid_history_unauthorized(self):
        """Test bid history without auth"""
        response = requests.get(f"{BASE_URL}/api/user/bid-history")
        assert response.status_code == 401 or response.status_code == 403
    
    def test_get_bid_history(self, customer_token):
        """Test getting bid history"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        response = requests.get(f"{BASE_URL}/api/user/bid-history", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Bid history returned {len(data)} entries")
        
        # Verify structure if there are bids
        if len(data) > 0:
            bid = data[0]
            assert "auction_id" in bid
            assert "price" in bid
            assert "timestamp" in bid
            assert "won" in bid
            assert "auction_ended" in bid
            print(f"Sample bid: auction={bid['auction_id'][:8]}..., price={bid['price']}, won={bid['won']}")


class TestPurchases:
    """Test purchases endpoint"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Customer login failed")
        return response.json().get("token")
    
    def test_get_purchases_unauthorized(self):
        """Test purchases without auth"""
        response = requests.get(f"{BASE_URL}/api/user/purchases")
        assert response.status_code == 401 or response.status_code == 403
    
    def test_get_purchases(self, customer_token):
        """Test getting purchase history"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        response = requests.get(f"{BASE_URL}/api/user/purchases", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Purchases returned {len(data)} entries")
        
        # Verify structure if there are purchases
        if len(data) > 0:
            purchase = data[0]
            assert "user_id" in purchase or "amount" in purchase
            print(f"Sample purchase found")


class TestAdminPayments:
    """Test admin payments overview endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json().get("token")
    
    @pytest.fixture
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Customer login failed")
        return response.json().get("token")
    
    def test_get_payments_unauthorized(self):
        """Test payments without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/payments")
        assert response.status_code == 401 or response.status_code == 403
    
    def test_get_payments_non_admin(self, customer_token):
        """Test payments with non-admin user"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        response = requests.get(f"{BASE_URL}/api/admin/payments", headers=headers)
        assert response.status_code == 403
        print("Non-admin access correctly denied")
    
    def test_get_payments_admin(self, admin_token):
        """Test getting payments as admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/admin/payments", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Admin payments returned {len(data)} transactions")


class TestAdminLogs:
    """Test admin system logs endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json().get("token")
    
    @pytest.fixture
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Customer login failed")
        return response.json().get("token")
    
    def test_get_logs_unauthorized(self):
        """Test logs without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/logs")
        assert response.status_code == 401 or response.status_code == 403
    
    def test_get_logs_non_admin(self, customer_token):
        """Test logs with non-admin user"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        response = requests.get(f"{BASE_URL}/api/admin/logs", headers=headers)
        assert response.status_code == 403
        print("Non-admin access to logs correctly denied")
    
    def test_get_logs_admin(self, admin_token):
        """Test getting logs as admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/admin/logs", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Admin logs returned {len(data)} entries")
        
        # Verify log structure if there are logs
        if len(data) > 0:
            log = data[0]
            assert "type" in log
            assert "message" in log
            assert "timestamp" in log
            print(f"Sample log: type={log['type']}, message={log['message'][:50]}...")


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["is_admin"] == True
        print(f"Admin login successful: {data['user']['name']}")
    
    def test_customer_login(self):
        """Test customer login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["is_admin"] == False
        print(f"Customer login successful: {data['user']['name']}")
    
    def test_invalid_login(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
