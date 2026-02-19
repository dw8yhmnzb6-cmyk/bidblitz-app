"""
Test Referral Program & Notifications APIs
- Referral code generation and usage
- Flash bonus promotions
- User notifications
- Partner deposit commissions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CUSTOMER_EMAIL = "kunde@bidblitz.ae"
CUSTOMER_PASSWORD = "Kunde123!"
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "Admin123!"


class TestReferralAPIs:
    """Test referral system endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_customer_token(self):
        """Get customer auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        return None
    
    def get_admin_token(self):
        """Get admin auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        return None
    
    def test_get_my_referral_code(self):
        """Test GET /api/referral/my-code - Get user's referral code"""
        token = self.get_customer_token()
        assert token is not None, "Failed to get customer token"
        
        response = self.session.get(
            f"{BASE_URL}/api/referral/my-code",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "code" in data, "Response should contain 'code'"
        assert data["code"] is not None, "Referral code should not be None"
        assert data["code"].startswith("REF-"), f"Referral code should start with 'REF-', got {data['code']}"
        
        # Verify additional fields
        assert "reward" in data or "uses" in data, "Response should contain reward or uses info"
        print(f"✓ Referral code retrieved: {data['code']}")
    
    def test_get_my_referral_code_unauthenticated(self):
        """Test GET /api/referral/my-code without auth - should fail"""
        response = self.session.get(f"{BASE_URL}/api/referral/my-code")
        
        # Should return 401 or 403 for unauthenticated request
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print("✓ Unauthenticated request correctly rejected")
    
    def test_get_my_referrals(self):
        """Test GET /api/referral/my-referrals - Get list of referred users"""
        token = self.get_customer_token()
        assert token is not None, "Failed to get customer token"
        
        response = self.session.get(
            f"{BASE_URL}/api/referral/my-referrals",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "referrals" in data, "Response should contain 'referrals'"
        assert "total_earned" in data, "Response should contain 'total_earned'"
        assert "uses" in data, "Response should contain 'uses'"
        assert isinstance(data["referrals"], list), "Referrals should be a list"
        print(f"✓ Referrals retrieved: {data['uses']} uses, €{data['total_earned']} earned")


class TestActivePromotions:
    """Test flash bonus promotions endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_get_active_promotions_default_language(self):
        """Test GET /api/referral/active-promotions - Get active flash promotions (German)"""
        response = self.session.get(f"{BASE_URL}/api/referral/active-promotions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "promotions" in data, "Response should contain 'promotions'"
        assert isinstance(data["promotions"], list), "Promotions should be a list"
        
        if len(data["promotions"]) > 0:
            promo = data["promotions"][0]
            # Verify promotion structure
            assert "bonus_percentage" in promo, "Promotion should have bonus_percentage"
            assert "valid_until" in promo, "Promotion should have valid_until"
            assert "min_deposit" in promo, "Promotion should have min_deposit"
            assert "hours_remaining" in promo or "minutes_remaining" in promo, "Promotion should have time remaining"
            print(f"✓ Active promotion found: +{promo['bonus_percentage']}% bonus")
        else:
            print("✓ No active promotions (expected behavior if none created)")
    
    def test_get_active_promotions_english(self):
        """Test GET /api/referral/active-promotions?language=en - English translations"""
        response = self.session.get(f"{BASE_URL}/api/referral/active-promotions?language=en")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "promotions" in data, "Response should contain 'promotions'"
        
        if len(data["promotions"]) > 0:
            promo = data["promotions"][0]
            # Check for English name/description
            assert "name" in promo or "name_en" in promo, "Promotion should have name"
            print(f"✓ English promotion retrieved: {promo.get('name', promo.get('name_en', 'N/A'))}")
        else:
            print("✓ No active promotions (expected)")
    
    def test_get_active_promotions_turkish(self):
        """Test GET /api/referral/active-promotions?language=tr - Turkish translations"""
        response = self.session.get(f"{BASE_URL}/api/referral/active-promotions?language=tr")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "promotions" in data, "Response should contain 'promotions'"
        print("✓ Turkish promotions endpoint working")


class TestNotifications:
    """Test user notifications endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_customer_token(self):
        """Get customer auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        return None
    
    def test_get_notifications(self):
        """Test GET /api/referral/notifications - Get user notifications"""
        token = self.get_customer_token()
        assert token is not None, "Failed to get customer token"
        
        response = self.session.get(
            f"{BASE_URL}/api/referral/notifications",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "notifications" in data, "Response should contain 'notifications'"
        assert "unread_count" in data, "Response should contain 'unread_count'"
        assert isinstance(data["notifications"], list), "Notifications should be a list"
        assert isinstance(data["unread_count"], int), "Unread count should be an integer"
        print(f"✓ Notifications retrieved: {len(data['notifications'])} total, {data['unread_count']} unread")
    
    def test_get_notifications_with_limit(self):
        """Test GET /api/referral/notifications?limit=5 - Get limited notifications"""
        token = self.get_customer_token()
        assert token is not None, "Failed to get customer token"
        
        response = self.session.get(
            f"{BASE_URL}/api/referral/notifications?limit=5",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert len(data["notifications"]) <= 5, "Should return at most 5 notifications"
        print(f"✓ Limited notifications retrieved: {len(data['notifications'])} items")
    
    def test_get_notifications_unauthenticated(self):
        """Test GET /api/referral/notifications without auth - should fail"""
        response = self.session.get(f"{BASE_URL}/api/referral/notifications")
        
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print("✓ Unauthenticated notification request correctly rejected")
    
    def test_mark_all_notifications_read(self):
        """Test POST /api/referral/notifications/read-all - Mark all as read"""
        token = self.get_customer_token()
        assert token is not None, "Failed to get customer token"
        
        response = self.session.post(
            f"{BASE_URL}/api/referral/notifications/read-all",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        print("✓ Mark all notifications as read successful")


class TestPartnerDepositCommissions:
    """Test partner deposit commissions endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        """Get admin auth token (for partner portal)"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        return None
    
    def test_partner_stats_endpoint_exists(self):
        """Test GET /api/deposit-offers/partner/stats - Partner commission stats"""
        # This endpoint requires partner token, test that it exists
        response = self.session.get(f"{BASE_URL}/api/deposit-offers/partner/stats")
        
        # Should return 422 (missing token) or 401/403, not 404
        assert response.status_code != 404, "Partner stats endpoint should exist"
        print(f"✓ Partner stats endpoint exists (status: {response.status_code})")


class TestReferralCodeUsage:
    """Test referral code usage flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_customer_token(self):
        """Get customer auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        return None
    
    def test_use_invalid_referral_code(self):
        """Test POST /api/referral/use with invalid code"""
        token = self.get_customer_token()
        assert token is not None, "Failed to get customer token"
        
        response = self.session.post(
            f"{BASE_URL}/api/referral/use",
            headers={"Authorization": f"Bearer {token}"},
            json={"referral_code": "INVALID-CODE-12345"}
        )
        
        # Should return 404 (code not found) or 400 (already used/invalid)
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}"
        print(f"✓ Invalid referral code correctly rejected (status: {response.status_code})")
    
    def test_use_referral_code_unauthenticated(self):
        """Test POST /api/referral/use without auth - should fail"""
        response = self.session.post(
            f"{BASE_URL}/api/referral/use",
            json={"referral_code": "REF-123456"}
        )
        
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print("✓ Unauthenticated referral use correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
