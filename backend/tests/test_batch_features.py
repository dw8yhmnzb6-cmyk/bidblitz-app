"""
Test suite for Batch Features: Mystery Box, Price Alerts, Social Share, PWA, Google OAuth
Tests the new features implemented in the batch update.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CUSTOMER_EMAIL = "kunde@bidblitz.de"
CUSTOMER_PASSWORD = "Kunde123!"
ADMIN_EMAIL = "admin@bidblitz.de"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def customer_token():
    """Get customer authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CUSTOMER_EMAIL,
        "password": CUSTOMER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Customer authentication failed")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


class TestMysteryBoxAPI:
    """Mystery Box API tests"""
    
    def test_get_active_mystery_auctions(self):
        """GET /api/mystery-box/active - returns auctions and tiers"""
        response = requests.get(f"{BASE_URL}/api/mystery-box/active")
        assert response.status_code == 200
        
        data = response.json()
        assert "auctions" in data
        assert "tiers" in data
        assert isinstance(data["auctions"], list)
        assert isinstance(data["tiers"], dict)
    
    def test_mystery_box_tiers_structure(self):
        """Verify 4 tier levels exist: bronze, silver, gold, diamond"""
        response = requests.get(f"{BASE_URL}/api/mystery-box/active")
        assert response.status_code == 200
        
        tiers = response.json()["tiers"]
        expected_tiers = ["bronze", "silver", "gold", "diamond"]
        
        for tier in expected_tiers:
            assert tier in tiers, f"Missing tier: {tier}"
            assert "name" in tiers[tier]
            assert "min_value" in tiers[tier]
            assert "max_value" in tiers[tier]
            assert "icon" in tiers[tier]
            assert "color" in tiers[tier]
    
    def test_mystery_box_tier_values(self):
        """Verify tier value ranges are correct"""
        response = requests.get(f"{BASE_URL}/api/mystery-box/active")
        assert response.status_code == 200
        
        tiers = response.json()["tiers"]
        
        # Bronze: €50 - €150
        assert tiers["bronze"]["min_value"] == 50
        assert tiers["bronze"]["max_value"] == 150
        
        # Silver: €150 - €400
        assert tiers["silver"]["min_value"] == 150
        assert tiers["silver"]["max_value"] == 400
        
        # Gold: €400 - €1000
        assert tiers["gold"]["min_value"] == 400
        assert tiers["gold"]["max_value"] == 1000
        
        # Diamond: €1000 - €5000
        assert tiers["diamond"]["min_value"] == 1000
        assert tiers["diamond"]["max_value"] == 5000


class TestPriceAlertsAPI:
    """Price Alerts (Schnäppchen-Alarm) API tests"""
    
    def test_get_my_alerts_requires_auth(self):
        """GET /api/alerts/my-alerts requires authentication"""
        response = requests.get(f"{BASE_URL}/api/alerts/my-alerts")
        assert response.status_code == 401
    
    def test_get_my_alerts_authenticated(self, customer_token):
        """GET /api/alerts/my-alerts returns alerts array"""
        response = requests.get(
            f"{BASE_URL}/api/alerts/my-alerts",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "alerts" in data
        assert isinstance(data["alerts"], list)
    
    def test_create_alert_requires_auth(self):
        """POST /api/alerts/create requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/alerts/create",
            json={"target_price": 5.0}
        )
        assert response.status_code == 401
    
    def test_create_alert_requires_product_or_auction(self, customer_token):
        """POST /api/alerts/create requires product_id or auction_id"""
        response = requests.post(
            f"{BASE_URL}/api/alerts/create",
            headers={"Authorization": f"Bearer {customer_token}"},
            json={"target_price": 5.0}
        )
        # Should return 400 or 422 for missing required field
        assert response.status_code in [400, 422]


class TestSocialShareAPI:
    """Social Share (Teilen & Verdienen) API tests"""
    
    def test_get_shareable_wins_requires_auth(self):
        """GET /api/social/shareable-wins requires authentication"""
        response = requests.get(f"{BASE_URL}/api/social/shareable-wins")
        assert response.status_code == 401
    
    def test_get_shareable_wins_authenticated(self, customer_token):
        """GET /api/social/shareable-wins returns wins array"""
        response = requests.get(
            f"{BASE_URL}/api/social/shareable-wins",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "wins" in data
        assert isinstance(data["wins"], list)
    
    def test_shareable_wins_count(self, customer_token):
        """Verify shareable wins count (expected: 13 wins)"""
        response = requests.get(
            f"{BASE_URL}/api/social/shareable-wins",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        
        wins = response.json()["wins"]
        # Test user should have 13 shareable wins
        assert len(wins) == 13, f"Expected 13 wins, got {len(wins)}"
    
    def test_shareable_wins_structure(self, customer_token):
        """Verify win object structure"""
        response = requests.get(
            f"{BASE_URL}/api/social/shareable-wins",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        
        wins = response.json()["wins"]
        if len(wins) > 0:
            win = wins[0]
            assert "auction_id" in win
            assert "product" in win
            assert "can_share" in win
            assert "bonus_bids" in win
    
    def test_get_my_shares_authenticated(self, customer_token):
        """GET /api/social/my-shares returns share history"""
        response = requests.get(
            f"{BASE_URL}/api/social/my-shares",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "shares" in data
        assert "total_shares" in data
        assert "total_bonus_earned" in data


class TestPWAManifest:
    """PWA manifest.json tests"""
    
    def test_manifest_exists(self):
        """GET /manifest.json returns valid JSON"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, dict)
    
    def test_manifest_required_fields(self):
        """Verify manifest has required PWA fields"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200
        
        data = response.json()
        
        # Required fields for PWA
        assert "name" in data
        assert "short_name" in data
        assert "start_url" in data
        assert "display" in data
        assert "icons" in data
    
    def test_manifest_bidblitz_values(self):
        """Verify manifest has correct BidBlitz values"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200
        
        data = response.json()
        
        assert data["name"] == "BidBlitz"
        assert data["short_name"] == "BidBlitz"
        assert data["display"] == "standalone"
        assert data["lang"] == "de"
    
    def test_manifest_icons(self):
        """Verify manifest has icons defined"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200
        
        icons = response.json()["icons"]
        assert len(icons) >= 2, "Should have at least 2 icon sizes"
        
        # Check icon structure
        for icon in icons:
            assert "src" in icon
            assert "sizes" in icon


class TestGoogleOAuth:
    """Google OAuth endpoint tests"""
    
    def test_google_oauth_endpoint_exists(self):
        """POST /api/auth/google endpoint exists"""
        # Without valid session_id, should return 422 (validation error)
        response = requests.post(
            f"{BASE_URL}/api/auth/google",
            json={"session_id": "invalid_session"}
        )
        # Should return 401 (invalid session) or 422 (validation error), not 404
        assert response.status_code in [401, 422, 500]
        assert response.status_code != 404, "Google OAuth endpoint not found"
    
    def test_google_oauth_requires_session_id(self):
        """POST /api/auth/google requires session_id"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google",
            json={}
        )
        # Should return validation error for missing session_id
        assert response.status_code in [422, 400]


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """POST /api/auth/login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == CUSTOMER_EMAIL
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
    
    def test_get_me_authenticated(self, customer_token):
        """GET /api/auth/me returns user info"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "name" in data
        assert "bids_balance" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
