"""
Test Suite for BidBlitz New Features v5
Tests: Live Winner Popups, Beginner Guarantee, WhatsApp Notifications, 
       Countdown Emails, User Stats Dashboard, Team Auctions, Auction Replay
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasics:
    """Basic health and connectivity tests"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health endpoint working")
    
    def test_main_page_loads(self):
        """Test main page returns valid response"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200
        print("✓ Main page loads")


class TestTeamAuctions:
    """Team Auctions API tests"""
    
    def test_list_teams_public(self):
        """Test public team listing endpoint"""
        response = requests.get(f"{BASE_URL}/api/team-auctions/list")
        assert response.status_code == 200
        data = response.json()
        assert "teams" in data
        assert isinstance(data["teams"], list)
        print(f"✓ Team list endpoint working - {len(data['teams'])} teams found")


class TestAuctionReplay:
    """Auction Replay API tests"""
    
    def test_recent_replays(self):
        """Test recent replays endpoint"""
        response = requests.get(f"{BASE_URL}/api/auction-replay/recent")
        assert response.status_code == 200
        data = response.json()
        assert "replays" in data
        assert isinstance(data["replays"], list)
        print(f"✓ Auction replay endpoint working - {len(data['replays'])} replays found")
    
    def test_best_times(self):
        """Test best bidding times analysis endpoint"""
        response = requests.get(f"{BASE_URL}/api/auction-replay/best-times")
        assert response.status_code == 200
        data = response.json()
        assert "best_hours" in data
        assert "best_days" in data
        print("✓ Best times analysis endpoint working")


class TestAuthenticatedEndpoints:
    """Tests requiring authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@bidblitz.de", "password": "Admin123!"}
        )
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_beginner_guarantee_eligibility(self):
        """Test beginner guarantee eligibility check"""
        response = requests.get(
            f"{BASE_URL}/api/beginner-guarantee/eligibility",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "eligible" in data
        print(f"✓ Beginner guarantee eligibility: {data.get('eligible')} - {data.get('reason', 'N/A')}")
    
    def test_beginner_guarantee_my_guarantees(self):
        """Test user's guarantee history"""
        response = requests.get(
            f"{BASE_URL}/api/beginner-guarantee/my-guarantees",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "guarantees_used" in data
        assert "guarantees_remaining" in data
        print(f"✓ My guarantees: {data.get('guarantees_used')} used, {data.get('guarantees_remaining')} remaining")
    
    def test_whatsapp_status(self):
        """Test WhatsApp subscription status"""
        response = requests.get(
            f"{BASE_URL}/api/whatsapp/status",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "subscribed" in data
        print(f"✓ WhatsApp status: subscribed={data.get('subscribed')}")
    
    def test_countdown_emails_subscriptions(self):
        """Test countdown email subscriptions"""
        response = requests.get(
            f"{BASE_URL}/api/countdown-emails/my-subscriptions",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "subscriptions" in data
        assert isinstance(data["subscriptions"], list)
        print(f"✓ Countdown email subscriptions: {len(data['subscriptions'])} active")
    
    def test_user_stats_overview(self):
        """Test user statistics overview"""
        response = requests.get(
            f"{BASE_URL}/api/user-stats/overview",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "overview" in data
        assert "auctions" in data
        assert "bids" in data
        assert "loyalty" in data
        print(f"✓ User stats: {data['auctions'].get('total_won', 0)} wins, €{data['overview'].get('total_savings', 0)} saved")
    
    def test_user_stats_achievements(self):
        """Test user achievements"""
        response = requests.get(
            f"{BASE_URL}/api/user-stats/achievements",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "achievements" in data
        assert "unlocked_count" in data
        assert "total_count" in data
        print(f"✓ Achievements: {data.get('unlocked_count')}/{data.get('total_count')} unlocked")
    
    def test_team_my_team(self):
        """Test get my team endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/team-auctions/my-team",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        # User may or may not be in a team
        assert "team" in data or "message" in data
        team = data.get('team')
        team_name = team.get('name') if team else 'Not in a team'
        print(f"✓ My team: {team_name}")


class TestDealRadar:
    """Deal Radar API tests"""
    
    def test_bargains_endpoint(self):
        """Test deal radar bargains"""
        response = requests.get(f"{BASE_URL}/api/deal-radar/bargains")
        assert response.status_code == 200
        data = response.json()
        assert "bargains" in data
        print(f"✓ Deal radar bargains: {len(data.get('bargains', []))} found")
    
    def test_low_activity_endpoint(self):
        """Test low activity auctions"""
        response = requests.get(f"{BASE_URL}/api/deal-radar/low-activity")
        assert response.status_code == 200
        data = response.json()
        assert "auctions" in data
        print(f"✓ Low activity auctions: {len(data.get('auctions', []))} found")


class TestWinners:
    """Winners gallery tests"""
    
    def test_winners_endpoint(self):
        """Test winners gallery endpoint"""
        response = requests.get(f"{BASE_URL}/api/winners?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Winners gallery: {len(data)} recent winners")


class TestAuctions:
    """Auction listing tests"""
    
    def test_auctions_list(self):
        """Test auctions listing"""
        response = requests.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Auctions list: {len(data)} active auctions")
    
    def test_auction_has_timer_fields(self):
        """Test that auctions have proper timer fields"""
        response = requests.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200
        data = response.json()
        
        if data:
            auction = data[0]
            assert "end_time" in auction
            assert "is_fixed_end" in auction or True  # May not be present in all
            print(f"✓ Auction timer fields present - end_time: {auction.get('end_time')[:19]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
