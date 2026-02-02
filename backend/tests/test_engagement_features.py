"""
Test Suite for BidBlitz Engagement Features (Batch 2)
Tests 10 new customer engagement features:
1. Favorites with Smart Alerts
2. Team Auctions (Group Bidding)
3. Bid Refund for VIP
4. Auction Replay & Statistics
5. Flash Coupons
6. VIP Lounge Chat
7. Birthday Bonus
8. Auction Insurance
9. Product Wishlist Voting
10. Streak Protection
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


class TestAuthentication:
    """Get auth tokens for testing"""
    
    @pytest.fixture(scope="class")
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Customer authentication failed")
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")


# ==================== FAVORITES API TESTS ====================

class TestFavoritesAPI:
    """Test Favorites with Smart Alerts feature"""
    
    @pytest.fixture(scope="class")
    def token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_my_favorites(self, token):
        """GET /api/favorites/my-favorites - Get user favorites"""
        response = requests.get(
            f"{BASE_URL}/api/favorites/my-favorites",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "favorites" in data
        assert "count" in data
        assert isinstance(data["favorites"], list)
    
    def test_add_favorite_category(self, token):
        """POST /api/favorites/add - Add category to favorites"""
        response = requests.post(
            f"{BASE_URL}/api/favorites/add",
            headers={"Authorization": f"Bearer {token}"},
            json={"category": "electronics", "price_alert": 50.0}
        )
        # Either success or already exists
        assert response.status_code in [200, 400]
        data = response.json()
        if response.status_code == 200:
            assert data.get("success") == True
            assert "favorite_id" in data
    
    def test_add_favorite_requires_auth(self):
        """POST /api/favorites/add - Requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/favorites/add",
            json={"category": "gaming"}
        )
        assert response.status_code == 401
    
    def test_get_live_alerts(self, token):
        """GET /api/favorites/live-alerts - Get live alerts for favorites"""
        response = requests.get(
            f"{BASE_URL}/api/favorites/live-alerts",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "alerts" in data
        assert "count" in data


# ==================== TEAMS API TESTS ====================

class TestTeamsAPI:
    """Test Team Auctions (Group Bidding) feature"""
    
    @pytest.fixture(scope="class")
    def token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_team_leaderboard(self):
        """GET /api/teams/leaderboard - Get team leaderboard (public)"""
        response = requests.get(f"{BASE_URL}/api/teams/leaderboard")
        assert response.status_code == 200
        data = response.json()
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)
    
    def test_get_my_team(self, token):
        """GET /api/teams/my-team - Get user's team"""
        response = requests.get(
            f"{BASE_URL}/api/teams/my-team",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "has_team" in data
        # Either has team or doesn't
        if data["has_team"]:
            assert "team" in data
            assert data["team"] is not None
    
    def test_create_team(self, token):
        """POST /api/teams/create - Create new team"""
        import uuid
        team_name = f"TestTeam_{uuid.uuid4().hex[:6]}"
        response = requests.post(
            f"{BASE_URL}/api/teams/create",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": team_name, "max_members": 3}
        )
        # Either success or already in a team
        assert response.status_code in [200, 400]
        data = response.json()
        if response.status_code == 200:
            assert data.get("success") == True
            assert "team" in data
            assert data["team"]["name"] == team_name
    
    def test_create_team_requires_auth(self):
        """POST /api/teams/create - Requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/teams/create",
            json={"name": "UnauthorizedTeam"}
        )
        assert response.status_code == 401


# ==================== BID REFUND API TESTS ====================

class TestBidRefundAPI:
    """Test Bid Refund for VIP feature"""
    
    @pytest.fixture(scope="class")
    def token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_refund_stats(self, token):
        """GET /api/bid-refund/stats - Get refund statistics"""
        response = requests.get(
            f"{BASE_URL}/api/bid-refund/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Verify response structure
        assert "is_vip" in data
        assert "total_refunds_claimed" in data
        assert "total_bids_refunded" in data
        assert "refund_rates" in data
        assert "min_bids_required" in data
    
    def test_get_my_refunds(self, token):
        """GET /api/bid-refund/my-refunds - Get user's refund history"""
        response = requests.get(
            f"{BASE_URL}/api/bid-refund/my-refunds",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "refunds" in data
        assert "total_refunds" in data
        assert "total_bids_refunded" in data


# ==================== AUCTION REPLAY API TESTS ====================

class TestAuctionReplayAPI:
    """Test Auction Replay & Statistics feature"""
    
    @pytest.fixture(scope="class")
    def token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_best_times(self):
        """GET /api/auction-replay/best-times - Get best bidding times (public)"""
        response = requests.get(f"{BASE_URL}/api/auction-replay/best-times")
        assert response.status_code == 200
        data = response.json()
        assert "best_hours" in data
        assert "best_days" in data
        # API returns total_analyzed instead of analysis_period_days
        assert "total_analyzed" in data or "tip" in data


# ==================== FLASH COUPONS API TESTS ====================

class TestFlashCouponsAPI:
    """Test Flash Coupons feature"""
    
    @pytest.fixture(scope="class")
    def token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_active_coupons(self, token):
        """GET /api/flash-coupons/active - Get active flash coupons"""
        response = requests.get(
            f"{BASE_URL}/api/flash-coupons/active",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "coupons" in data
        assert isinstance(data["coupons"], list)
    
    def test_get_my_coupons(self, token):
        """GET /api/flash-coupons/my-coupons - Get user's claimed coupons"""
        response = requests.get(
            f"{BASE_URL}/api/flash-coupons/my-coupons",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "coupons" in data


# ==================== VIP LOUNGE API TESTS ====================

class TestVIPLoungeAPI:
    """Test VIP Lounge Chat feature"""
    
    @pytest.fixture(scope="class")
    def token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_check_vip_access(self, token):
        """GET /api/vip-lounge/access - Check VIP lounge access"""
        response = requests.get(
            f"{BASE_URL}/api/vip-lounge/access",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "has_access" in data
        # Non-VIP users should get upgrade hint
        if not data["has_access"]:
            assert "upgrade_hint" in data
    
    def test_get_lounge_messages(self, token):
        """GET /api/vip-lounge/messages - Get lounge messages"""
        response = requests.get(
            f"{BASE_URL}/api/vip-lounge/messages",
            headers={"Authorization": f"Bearer {token}"}
        )
        # Either 200 (VIP) or 403 (non-VIP)
        assert response.status_code in [200, 403]


# ==================== BIRTHDAY API TESTS ====================

class TestBirthdayAPI:
    """Test Birthday Bonus feature"""
    
    @pytest.fixture(scope="class")
    def token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_birthday_status(self, token):
        """GET /api/birthday/status - Get birthday status"""
        response = requests.get(
            f"{BASE_URL}/api/birthday/status",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "has_birthday" in data
        assert "bonus_amount" in data
    
    def test_set_birthday(self, token):
        """POST /api/birthday/set - Set birthday"""
        response = requests.post(
            f"{BASE_URL}/api/birthday/set",
            headers={"Authorization": f"Bearer {token}"},
            json={"birthday": "1990-06-15"}
        )
        # Either success or already set
        assert response.status_code in [200, 400]
        data = response.json()
        if response.status_code == 200:
            assert data.get("success") == True
    
    def test_birthday_requires_auth(self):
        """GET /api/birthday/status - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/birthday/status")
        assert response.status_code == 401


# ==================== INSURANCE API TESTS ====================

class TestInsuranceAPI:
    """Test Auction Insurance feature"""
    
    @pytest.fixture(scope="class")
    def token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_insurance_stats(self, token):
        """GET /api/insurance/stats - Get insurance statistics"""
        response = requests.get(
            f"{BASE_URL}/api/insurance/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_policies" in data
        assert "claims_made" in data
        assert "insurance_price" in data
        assert "refund_rate" in data
    
    def test_get_my_insurance(self, token):
        """GET /api/insurance/my-insurance - Get user's insurance policies"""
        response = requests.get(
            f"{BASE_URL}/api/insurance/my-insurance",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "policies" in data
        assert "total_policies" in data


# ==================== WISHLIST API TESTS ====================

class TestWishlistAPI:
    """Test Product Wishlist Voting feature"""
    
    @pytest.fixture(scope="class")
    def token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_top_wishes(self):
        """GET /api/wishlist/top - Get top product wishes (public)"""
        response = requests.get(f"{BASE_URL}/api/wishlist/top")
        assert response.status_code == 200
        data = response.json()
        assert "wishes" in data
        assert isinstance(data["wishes"], list)
    
    def test_suggest_product(self, token):
        """POST /api/wishlist/suggest - Suggest a product"""
        import uuid
        product_name = f"TestProduct_{uuid.uuid4().hex[:6]}"
        response = requests.post(
            f"{BASE_URL}/api/wishlist/suggest",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "product_name": product_name,
                "category": "electronics",
                "description": "Test product suggestion"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "wish_id" in data
    
    def test_get_categories(self):
        """GET /api/wishlist/categories - Get wish categories (public)"""
        response = requests.get(f"{BASE_URL}/api/wishlist/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert len(data["categories"]) > 0
    
    def test_get_my_wishes(self, token):
        """GET /api/wishlist/my-wishes - Get user's suggested wishes"""
        response = requests.get(
            f"{BASE_URL}/api/wishlist/my-wishes",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "wishes" in data


# ==================== STREAK PROTECTION API TESTS ====================

class TestStreakProtectionAPI:
    """Test Streak Protection feature"""
    
    @pytest.fixture(scope="class")
    def token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_streak_status(self, token):
        """GET /api/streak-protection/status - Get streak status"""
        response = requests.get(
            f"{BASE_URL}/api/streak-protection/status",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "current_streak" in data
        assert "streak_active" in data
        assert "has_protection" in data
        assert "streak_rewards" in data
    
    def test_get_claimed_rewards(self, token):
        """GET /api/streak-protection/claimed-rewards - Get claimed rewards"""
        response = requests.get(
            f"{BASE_URL}/api/streak-protection/claimed-rewards",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "claimed" in data
        assert "claimed_milestones" in data
        assert "all_milestones" in data
    
    def test_get_protection_history(self, token):
        """GET /api/streak-protection/history - Get protection history"""
        response = requests.get(
            f"{BASE_URL}/api/streak-protection/history",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "protections" in data
    
    def test_streak_requires_auth(self):
        """GET /api/streak-protection/status - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/streak-protection/status")
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
