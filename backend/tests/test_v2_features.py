"""
BidBlitz V2 - Feature Flags, Kids Subscription, and Admin Feature Flags Tests
Tests for: Feature Flags API, Kids Paywall API, Admin Feature Flag Management
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"
CUSTOMER_EMAIL = "kunde@bidblitz.com"
CUSTOMER_PASSWORD = "Kunde2026!"
MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PASSWORD = "Haendler2026!"


class TestFeatureFlagsPublic:
    """Public Feature Flags API tests (no auth required)"""
    
    def test_get_feature_flags_no_auth(self):
        """GET /api/feature-flags should return flags without authentication"""
        response = requests.get(f"{BASE_URL}/api/feature-flags")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "flags" in data, "Response should contain 'flags' key"
        
        flags = data["flags"]
        # Verify expected flags exist
        expected_flags = ["kids", "activity_feed", "support_center", "referral", "admin_tools"]
        for flag in expected_flags:
            assert flag in flags, f"Flag '{flag}' should exist"
            assert "enabled" in flags[flag], f"Flag '{flag}' should have 'enabled' field"
            assert "access" in flags[flag], f"Flag '{flag}' should have 'access' field"
        
        print(f"Feature flags returned: {list(flags.keys())}")
    
    def test_feature_flags_structure(self):
        """Verify feature flag structure has enabled and access fields"""
        response = requests.get(f"{BASE_URL}/api/feature-flags")
        assert response.status_code == 200
        
        data = response.json()
        flags = data["flags"]
        
        for flag_name, flag_data in flags.items():
            assert isinstance(flag_data.get("enabled"), bool), f"Flag '{flag_name}' enabled should be boolean"
            assert flag_data.get("access") in ["all", "admin", "merchant", "beta"], f"Flag '{flag_name}' access should be valid"
        
        print("All flags have correct structure")


class TestAdminFeatureFlags:
    """Admin Feature Flags API tests (requires admin auth)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and get session"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.text}")
        print(f"Admin logged in successfully")
    
    def test_get_admin_feature_flags(self):
        """GET /api/admin/feature-flags should return full flag data for admin"""
        response = self.session.get(f"{BASE_URL}/api/admin/feature-flags")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "flags" in data, "Response should contain 'flags' key"
        
        flags = data["flags"]
        # Admin endpoint should return label field too
        for flag_name, flag_data in flags.items():
            assert "enabled" in flag_data, f"Flag '{flag_name}' should have 'enabled'"
            assert "access" in flag_data, f"Flag '{flag_name}' should have 'access'"
            # Label may or may not be present depending on implementation
        
        print(f"Admin feature flags: {list(flags.keys())}")
    
    def test_update_feature_flag_toggle(self):
        """PUT /api/admin/feature-flags/{name} should toggle flag on/off"""
        flag_name = "kids"
        
        # Get current state
        get_response = self.session.get(f"{BASE_URL}/api/admin/feature-flags")
        assert get_response.status_code == 200
        original_state = get_response.json()["flags"].get(flag_name, {}).get("enabled", True)
        
        # Toggle to opposite state
        new_state = not original_state
        update_response = self.session.put(
            f"{BASE_URL}/api/admin/feature-flags/{flag_name}",
            json={"enabled": new_state}
        )
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        # Verify change
        verify_response = self.session.get(f"{BASE_URL}/api/admin/feature-flags")
        assert verify_response.status_code == 200
        updated_state = verify_response.json()["flags"].get(flag_name, {}).get("enabled")
        assert updated_state == new_state, f"Flag should be {new_state}, got {updated_state}"
        
        # Restore original state
        self.session.put(
            f"{BASE_URL}/api/admin/feature-flags/{flag_name}",
            json={"enabled": original_state}
        )
        print(f"Flag '{flag_name}' toggled from {original_state} to {new_state} and restored")
    
    def test_update_feature_flag_access(self):
        """PUT /api/admin/feature-flags/{name} should update access level"""
        flag_name = "kids"
        
        # Get current state
        get_response = self.session.get(f"{BASE_URL}/api/admin/feature-flags")
        assert get_response.status_code == 200
        original_access = get_response.json()["flags"].get(flag_name, {}).get("access", "all")
        
        # Change access to admin
        new_access = "admin" if original_access != "admin" else "all"
        update_response = self.session.put(
            f"{BASE_URL}/api/admin/feature-flags/{flag_name}",
            json={"access": new_access}
        )
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        # Verify change
        verify_response = self.session.get(f"{BASE_URL}/api/admin/feature-flags")
        assert verify_response.status_code == 200
        updated_access = verify_response.json()["flags"].get(flag_name, {}).get("access")
        assert updated_access == new_access, f"Access should be {new_access}, got {updated_access}"
        
        # Restore original access
        self.session.put(
            f"{BASE_URL}/api/admin/feature-flags/{flag_name}",
            json={"access": original_access}
        )
        print(f"Flag '{flag_name}' access changed from {original_access} to {new_access} and restored")


class TestAdminFeatureFlagsUnauthorized:
    """Test admin feature flags endpoints require admin role"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as customer (non-admin)"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Customer login failed: {login_response.text}")
        print(f"Customer logged in successfully")
    
    def test_get_admin_feature_flags_forbidden(self):
        """GET /api/admin/feature-flags should return 403 for non-admin"""
        response = self.session.get(f"{BASE_URL}/api/admin/feature-flags")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("Non-admin correctly denied access to admin feature flags")
    
    def test_update_feature_flag_forbidden(self):
        """PUT /api/admin/feature-flags/{name} should return 403 for non-admin"""
        response = self.session.put(
            f"{BASE_URL}/api/admin/feature-flags/kids",
            json={"enabled": False}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("Non-admin correctly denied access to update feature flags")


class TestKidsSubscription:
    """Kids Subscription API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as customer"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Customer login failed: {login_response.text}")
        print(f"Customer logged in successfully")
    
    def test_get_kids_subscription_status(self):
        """GET /api/kids/subscription should return subscription status"""
        response = self.session.get(f"{BASE_URL}/api/kids/subscription")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "status" in data, "Response should contain 'status'"
        assert data["status"] in ["none", "trial", "active", "expired"], f"Invalid status: {data['status']}"
        
        # If no subscription, trial_available should be True
        if data["status"] == "none":
            assert data.get("trial_available") == True, "Trial should be available for new users"
        
        print(f"Kids subscription status: {data}")
    
    def test_start_kids_trial(self):
        """POST /api/kids/start-trial should create a 7-day trial"""
        # First check current status
        status_response = self.session.get(f"{BASE_URL}/api/kids/subscription")
        assert status_response.status_code == 200
        current_status = status_response.json()
        
        if current_status.get("status") != "none":
            pytest.skip("User already has a subscription or trial")
        
        # Start trial
        response = self.session.post(f"{BASE_URL}/api/kids/start-trial")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "trial", f"Expected trial status, got {data.get('status')}"
        assert "expires_at" in data, "Response should contain 'expires_at'"
        
        print(f"Trial started: {data}")
    
    def test_start_trial_already_used(self):
        """POST /api/kids/start-trial should fail if trial already used"""
        # First check current status
        status_response = self.session.get(f"{BASE_URL}/api/kids/subscription")
        assert status_response.status_code == 200
        current_status = status_response.json()
        
        if current_status.get("status") == "none":
            # Start trial first
            self.session.post(f"{BASE_URL}/api/kids/start-trial")
        
        # Try to start trial again
        response = self.session.post(f"{BASE_URL}/api/kids/start-trial")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Duplicate trial correctly rejected")


class TestKidsSubscriptionUnauthorized:
    """Test kids subscription endpoints require authentication"""
    
    def test_get_subscription_unauthorized(self):
        """GET /api/kids/subscription should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/kids/subscription")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Unauthenticated request correctly rejected")
    
    def test_start_trial_unauthorized(self):
        """POST /api/kids/start-trial should return 401 without auth"""
        response = requests.post(f"{BASE_URL}/api/kids/start-trial")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Unauthenticated trial request correctly rejected")


class TestKidsCheckout:
    """Kids Checkout API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as merchant (different user to avoid trial conflicts)"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": MERCHANT_EMAIL, "password": MERCHANT_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Merchant login failed: {login_response.text}")
        print(f"Merchant logged in successfully")
    
    def test_create_kids_checkout_monthly(self):
        """POST /api/kids/create-checkout should create Stripe checkout for monthly plan"""
        response = self.session.post(
            f"{BASE_URL}/api/kids/create-checkout",
            json={"plan": "monthly", "origin_url": "https://auction-2026-staging.preview.emergentagent.com"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "checkout_url" in data, "Response should contain 'checkout_url'"
        assert "session_id" in data, "Response should contain 'session_id'"
        assert "stripe.com" in data["checkout_url"], "Checkout URL should be Stripe URL"
        
        print(f"Monthly checkout created: session_id={data['session_id']}")
    
    def test_create_kids_checkout_yearly(self):
        """POST /api/kids/create-checkout should create Stripe checkout for yearly plan"""
        response = self.session.post(
            f"{BASE_URL}/api/kids/create-checkout",
            json={"plan": "yearly", "origin_url": "https://auction-2026-staging.preview.emergentagent.com"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "checkout_url" in data, "Response should contain 'checkout_url'"
        assert "session_id" in data, "Response should contain 'session_id'"
        
        print(f"Yearly checkout created: session_id={data['session_id']}")
    
    def test_create_kids_checkout_invalid_plan(self):
        """POST /api/kids/create-checkout should reject invalid plan"""
        response = self.session.post(
            f"{BASE_URL}/api/kids/create-checkout",
            json={"plan": "invalid_plan", "origin_url": "https://auction-2026-staging.preview.emergentagent.com"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Invalid plan correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
