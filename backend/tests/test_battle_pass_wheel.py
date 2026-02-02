"""
Test Suite for Battle Pass and Lucky Wheel Features
Tests: Battle Pass API, Lucky Wheel API, Navbar integration
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
    assert response.status_code == 200, f"Customer login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json().get("token")


class TestBattlePassAPI:
    """Battle Pass API endpoint tests"""
    
    def test_battle_pass_current_requires_auth(self):
        """Test that /api/battle-pass/current requires authentication"""
        response = requests.get(f"{BASE_URL}/api/battle-pass/current")
        assert response.status_code == 401, "Should require authentication"
    
    def test_battle_pass_current_returns_season(self, customer_token):
        """Test GET /api/battle-pass/current returns season data"""
        response = requests.get(
            f"{BASE_URL}/api/battle-pass/current",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify season data
        assert "season" in data
        season = data["season"]
        assert "id" in season
        assert "name" in season
        assert "theme" in season
        assert "season_number" in season
        assert "days_remaining" in season
        assert "end_date" in season
        
        # Verify theme structure
        theme = season["theme"]
        assert "name" in theme
        assert "color" in theme
        assert "icon" in theme
    
    def test_battle_pass_current_returns_user_progress(self, customer_token):
        """Test GET /api/battle-pass/current returns user progress"""
        response = requests.get(
            f"{BASE_URL}/api/battle-pass/current",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify user progress
        assert "user_progress" in data
        progress = data["user_progress"]
        assert "current_tier" in progress
        assert "current_xp" in progress
        assert "xp_in_tier" in progress
        assert "xp_to_next_tier" in progress
        assert "xp_progress_percent" in progress
        assert "has_premium" in progress
        assert "claimed_free" in progress
        assert "claimed_premium" in progress
        
        # Verify types
        assert isinstance(progress["current_tier"], int)
        assert isinstance(progress["current_xp"], int)
        assert isinstance(progress["has_premium"], bool)
        assert isinstance(progress["claimed_free"], list)
        assert isinstance(progress["claimed_premium"], list)
    
    def test_battle_pass_current_returns_rewards(self, customer_token):
        """Test GET /api/battle-pass/current returns rewards track"""
        response = requests.get(
            f"{BASE_URL}/api/battle-pass/current",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify rewards
        assert "rewards" in data
        rewards = data["rewards"]
        assert len(rewards) > 0, "Should have rewards"
        
        # Check first reward structure
        first_reward = rewards[0]
        assert "tier" in first_reward
        assert "free" in first_reward
        assert "premium" in first_reward
    
    def test_battle_pass_current_returns_prices(self, customer_token):
        """Test GET /api/battle-pass/current returns prices"""
        response = requests.get(
            f"{BASE_URL}/api/battle-pass/current",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify prices
        assert "prices" in data
        prices = data["prices"]
        assert "premium" in prices
        assert "premium_plus" in prices
        assert prices["premium"] == 9.99
        assert prices["premium_plus"] == 19.99
    
    def test_battle_pass_purchase_requires_auth(self):
        """Test that /api/battle-pass/purchase requires authentication"""
        response = requests.post(f"{BASE_URL}/api/battle-pass/purchase")
        assert response.status_code == 401, "Should require authentication"
    
    def test_battle_pass_purchase_returns_checkout_url(self, customer_token):
        """Test POST /api/battle-pass/purchase returns Stripe checkout URL"""
        response = requests.post(
            f"{BASE_URL}/api/battle-pass/purchase",
            headers={"Authorization": f"Bearer {customer_token}"},
            json={"premium_plus": False}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify checkout URL
        assert "checkout_url" in data
        assert "session_id" in data
        assert "stripe.com" in data["checkout_url"]
    
    def test_battle_pass_claim_invalid_tier(self, customer_token):
        """Test claiming invalid tier returns error"""
        response = requests.post(
            f"{BASE_URL}/api/battle-pass/claim/999?track=free",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 400, "Should reject invalid tier"
    
    def test_battle_pass_claim_unreached_tier(self, customer_token):
        """Test claiming unreached tier returns error"""
        response = requests.post(
            f"{BASE_URL}/api/battle-pass/claim/50?track=free",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        # Should fail because user hasn't reached tier 50
        assert response.status_code in [400, 404], "Should reject unreached tier"


class TestLuckyWheelAPI:
    """Lucky Wheel API endpoint tests"""
    
    def test_wheel_prizes_public(self):
        """Test GET /api/wheel/prizes is public"""
        response = requests.get(f"{BASE_URL}/api/wheel/prizes")
        assert response.status_code == 200
        data = response.json()
        
        assert "prizes" in data
        prizes = data["prizes"]
        assert len(prizes) > 0, "Should have prizes"
        
        # Check prize structure
        for prize in prizes:
            assert "type" in prize
            assert "value" in prize
            assert "label" in prize
    
    def test_wheel_status_requires_auth(self):
        """Test GET /api/wheel/status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/wheel/status")
        assert response.status_code == 401, "Should require authentication"
    
    def test_wheel_status_returns_can_spin(self, customer_token):
        """Test GET /api/wheel/status returns spin status"""
        response = requests.get(
            f"{BASE_URL}/api/wheel/status",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "can_spin" in data
        assert isinstance(data["can_spin"], bool)
        
        # If can't spin, should have next_spin_time
        if not data["can_spin"]:
            assert "next_spin_time" in data
    
    def test_wheel_spin_requires_auth(self):
        """Test POST /api/wheel/spin requires authentication"""
        response = requests.post(f"{BASE_URL}/api/wheel/spin")
        assert response.status_code == 401, "Should require authentication"
    
    def test_wheel_spin_returns_prize_or_cooldown(self, customer_token):
        """Test POST /api/wheel/spin returns prize or cooldown error"""
        response = requests.post(
            f"{BASE_URL}/api/wheel/spin",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        # Either success with prize or 400 if already spun today
        if response.status_code == 200:
            data = response.json()
            assert "success" in data
            assert "prize" in data
            assert "message" in data
            
            prize = data["prize"]
            assert "type" in prize
            assert "value" in prize
            assert "label" in prize
        else:
            assert response.status_code == 400
            data = response.json()
            assert "detail" in data
            # German error message for already spun
            assert "schon gedreht" in data["detail"].lower() or "already" in data["detail"].lower()
    
    def test_wheel_history_requires_auth(self):
        """Test GET /api/wheel/history requires authentication"""
        response = requests.get(f"{BASE_URL}/api/wheel/history")
        assert response.status_code == 401, "Should require authentication"
    
    def test_wheel_history_returns_spins(self, customer_token):
        """Test GET /api/wheel/history returns spin history"""
        response = requests.get(
            f"{BASE_URL}/api/wheel/history",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "spins" in data
        assert isinstance(data["spins"], list)


class TestBattlePassAdmin:
    """Battle Pass Admin endpoint tests"""
    
    def test_admin_stats_requires_admin(self, customer_token):
        """Test admin stats requires admin role"""
        response = requests.get(
            f"{BASE_URL}/api/battle-pass/admin/stats",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 403, "Should require admin role"
    
    def test_admin_stats_returns_data(self, admin_token):
        """Test admin stats returns statistics"""
        response = requests.get(
            f"{BASE_URL}/api/battle-pass/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "season" in data
        assert "total_users" in data
        assert "premium_users" in data
        assert "conversion_rate" in data
        assert "average_tier" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
