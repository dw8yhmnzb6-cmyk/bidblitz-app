"""
Test Suite for 9 New BidBlitz Features
- Bid Alarm API
- Welcome Bonus API
- Activity Feed API
- Tournament API
- Auction Chat API
- Recommendations API
- Watchers API
- Revenge Bid API
- Wallet API
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.de"
ADMIN_PASSWORD = "Admin123!"


class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health endpoint working")
    
    def test_login_success(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print(f"✓ Login successful, token received")
        return data["token"]


class TestActivityFeedAPI:
    """Activity Feed API tests - Public endpoints"""
    
    def test_get_activity_stats(self):
        """GET /api/activity-feed/stats - Platform statistics"""
        response = requests.get(f"{BASE_URL}/api/activity-feed/stats")
        assert response.status_code == 200
        data = response.json()
        assert "active_auctions" in data
        assert "wins_today" in data
        assert "bids_today" in data
        assert "total_savings" in data
        assert "active_users" in data
        print(f"✓ Activity stats: {data['active_auctions']} active auctions, {data['active_users']} active users")
    
    def test_get_recent_wins(self):
        """GET /api/activity-feed/wins - Recent auction wins"""
        response = requests.get(f"{BASE_URL}/api/activity-feed/wins")
        assert response.status_code == 200
        data = response.json()
        assert "wins" in data
        assert isinstance(data["wins"], list)
        print(f"✓ Recent wins: {len(data['wins'])} wins returned")
    
    def test_get_live_bids(self):
        """GET /api/activity-feed/live-bids - Live bid feed"""
        response = requests.get(f"{BASE_URL}/api/activity-feed/live-bids")
        assert response.status_code == 200
        data = response.json()
        assert "bids" in data
        assert isinstance(data["bids"], list)
        print(f"✓ Live bids: {len(data['bids'])} bids returned")
    
    def test_get_recent_activity(self):
        """GET /api/activity-feed/recent - Recent platform activity"""
        response = requests.get(f"{BASE_URL}/api/activity-feed/recent")
        assert response.status_code == 200
        data = response.json()
        assert "activities" in data
        assert "count" in data
        print(f"✓ Recent activity: {data['count']} activities")


class TestTournamentAPI:
    """Tournament API tests - Public endpoints"""
    
    def test_get_current_tournament(self):
        """GET /api/tournament/current - Current active tournament"""
        response = requests.get(f"{BASE_URL}/api/tournament/current")
        assert response.status_code == 200
        data = response.json()
        assert "tournament" in data
        assert "time_remaining" in data
        tournament = data["tournament"]
        assert "id" in tournament
        assert "name" in tournament
        assert "status" in tournament
        print(f"✓ Current tournament: {tournament['name']}, status: {tournament['status']}")
        print(f"  Time remaining: {data['time_remaining']['days']}d {data['time_remaining']['hours']}h {data['time_remaining']['minutes']}m")
    
    def test_get_tournament_leaderboard(self):
        """GET /api/tournament/leaderboard - Tournament rankings"""
        response = requests.get(f"{BASE_URL}/api/tournament/leaderboard")
        assert response.status_code == 200
        data = response.json()
        assert "tournament" in data
        assert "leaderboard" in data
        assert "prizes" in data
        assert "total_participants" in data
        print(f"✓ Leaderboard: {data['total_participants']} participants, {len(data['leaderboard'])} shown")
    
    def test_get_tournament_history(self):
        """GET /api/tournament/history - Past tournaments"""
        response = requests.get(f"{BASE_URL}/api/tournament/history")
        assert response.status_code == 200
        data = response.json()
        assert "tournaments" in data
        print(f"✓ Tournament history: {len(data['tournaments'])} past tournaments")


class TestRecommendationsAPI:
    """Recommendations API tests - Public endpoints"""
    
    def test_get_trending_auctions(self):
        """GET /api/recommendations/trending - Trending auctions"""
        response = requests.get(f"{BASE_URL}/api/recommendations/trending")
        assert response.status_code == 200
        data = response.json()
        assert "trending" in data
        assert "period" in data
        print(f"✓ Trending auctions: {len(data['trending'])} auctions, period: {data['period']}")
    
    def test_get_ending_soon(self):
        """GET /api/recommendations/ending-soon - Auctions ending soon"""
        response = requests.get(f"{BASE_URL}/api/recommendations/ending-soon")
        assert response.status_code == 200
        data = response.json()
        assert "ending_soon" in data
        assert "within_minutes" in data
        print(f"✓ Ending soon: {len(data['ending_soon'])} auctions within {data['within_minutes']} minutes")
    
    def test_get_hot_deals(self):
        """GET /api/recommendations/hot-deals - Best deals"""
        response = requests.get(f"{BASE_URL}/api/recommendations/hot-deals")
        assert response.status_code == 200
        data = response.json()
        assert "hot_deals" in data
        print(f"✓ Hot deals: {len(data['hot_deals'])} deals returned")


class TestWatchersAPI:
    """Watchers API tests - Public endpoints"""
    
    def test_get_watcher_stats(self):
        """GET /api/watchers/stats - Overall watcher statistics"""
        response = requests.get(f"{BASE_URL}/api/watchers/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_viewers" in data
        assert "auctions_being_watched" in data
        assert "average_per_auction" in data
        print(f"✓ Watcher stats: {data['total_viewers']} viewers, {data['auctions_being_watched']} auctions watched")
    
    def test_get_hot_auctions(self):
        """GET /api/watchers/hot-auctions - Most watched auctions"""
        response = requests.get(f"{BASE_URL}/api/watchers/hot-auctions")
        assert response.status_code == 200
        data = response.json()
        assert "hot_auctions" in data
        print(f"✓ Hot auctions: {len(data['hot_auctions'])} most watched auctions")


class TestAuctionChatAPI:
    """Auction Chat API tests - Public endpoints"""
    
    def test_get_available_reactions(self):
        """GET /api/auction-chat/reactions - Available reaction emojis"""
        response = requests.get(f"{BASE_URL}/api/auction-chat/reactions")
        assert response.status_code == 200
        data = response.json()
        assert "reactions" in data
        assert isinstance(data["reactions"], list)
        assert len(data["reactions"]) > 0
        print(f"✓ Available reactions: {data['reactions']}")


class TestAuthenticatedEndpoints:
    """Tests for endpoints requiring authentication"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_welcome_bonus_status(self, auth_headers):
        """GET /api/welcome-bonus/status - User's bonus status"""
        response = requests.get(f"{BASE_URL}/api/welcome-bonus/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "welcome_bids" in data
        assert "first_win_guarantee" in data
        assert "is_new_user" in data
        print(f"✓ Welcome bonus status: welcome_bids claimed={data['welcome_bids']['claimed']}, is_new_user={data['is_new_user']}")
    
    def test_get_available_bonuses(self, auth_headers):
        """GET /api/welcome-bonus/available-bonuses - Available bonuses for user"""
        response = requests.get(f"{BASE_URL}/api/welcome-bonus/available-bonuses", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "bonuses" in data
        assert "count" in data
        print(f"✓ Available bonuses: {data['count']} bonuses available")
    
    def test_get_my_bid_alarms(self, auth_headers):
        """GET /api/bid-alarm/my-alarms - User's bid alarms"""
        response = requests.get(f"{BASE_URL}/api/bid-alarm/my-alarms", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "alarms" in data
        assert "count" in data
        print(f"✓ My bid alarms: {data['count']} alarms")
    
    def test_get_my_wallet_passes(self, auth_headers):
        """GET /api/wallet/my-passes - User's wallet passes"""
        response = requests.get(f"{BASE_URL}/api/wallet/my-passes", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "passes" in data
        assert "total" in data
        print(f"✓ My wallet passes: {data['total']} passes")
    
    def test_get_my_tournament_rank(self, auth_headers):
        """GET /api/tournament/my-rank - User's tournament rank"""
        response = requests.get(f"{BASE_URL}/api/tournament/my-rank", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Either has rank or message about not participating
        assert "rank" in data or "message" in data
        print(f"✓ My tournament rank: {data.get('rank', 'Not participating')}")
    
    def test_get_personalized_recommendations(self, auth_headers):
        """GET /api/recommendations/for-you - Personalized recommendations"""
        response = requests.get(f"{BASE_URL}/api/recommendations/for-you", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "recommendations" in data
        print(f"✓ Personalized recommendations: {len(data['recommendations'])} auctions")
    
    def test_get_revenge_stats(self, auth_headers):
        """GET /api/revenge-bid/stats - User's revenge bid statistics"""
        response = requests.get(f"{BASE_URL}/api/revenge-bid/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_revenge_bids" in data
        assert "auctions_won_after_revenge" in data
        assert "success_rate" in data
        print(f"✓ Revenge stats: {data['total_revenge_bids']} revenge bids, {data['success_rate']}% success rate")
    
    def test_get_my_revenge_history(self, auth_headers):
        """GET /api/revenge-bid/my-revenges - User's revenge bid history"""
        response = requests.get(f"{BASE_URL}/api/revenge-bid/my-revenges", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "revenge_bids" in data
        print(f"✓ My revenge history: {len(data['revenge_bids'])} revenge bids")


class TestUnauthorizedAccess:
    """Test that auth-required endpoints return 401/403 without token"""
    
    def test_welcome_bonus_status_unauthorized(self):
        """GET /api/welcome-bonus/status without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/welcome-bonus/status")
        assert response.status_code in [401, 403]
        print("✓ Welcome bonus status correctly requires auth")
    
    def test_bid_alarm_my_alarms_unauthorized(self):
        """GET /api/bid-alarm/my-alarms without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/bid-alarm/my-alarms")
        assert response.status_code in [401, 403]
        print("✓ Bid alarm my-alarms correctly requires auth")
    
    def test_wallet_my_passes_unauthorized(self):
        """GET /api/wallet/my-passes without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/wallet/my-passes")
        assert response.status_code in [401, 403]
        print("✓ Wallet my-passes correctly requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
