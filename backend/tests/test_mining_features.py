"""
Backend API Tests for BidBlitz Mining Features
Tests: Friends, Events, Store, Loans, VIP, Auction, Coin Hunt, Merchant, Marketplace, Games
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://gaming-platform-129.preview.emergentagent.com')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestFriendsSystem:
    """Friends System API Tests"""
    
    def test_get_friends_list(self, api_client):
        """Test GET /api/app/friends/list"""
        response = api_client.get(f"{BASE_URL}/api/app/friends/list")
        assert response.status_code == 200
        data = response.json()
        assert "friends" in data
        assert "count" in data
        assert isinstance(data["friends"], list)
    
    def test_add_friend(self, api_client):
        """Test POST /api/app/friends/add"""
        response = api_client.post(f"{BASE_URL}/api/app/friends/add", json={
            "friend_name": "TestFriend_Pytest"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "friend" in data
        assert data["friend"]["name"] == "TestFriend_Pytest"
    
    def test_send_coins_to_friend(self, api_client):
        """Test POST /api/app/friends/send-coins"""
        response = api_client.post(f"{BASE_URL}/api/app/friends/send-coins", json={
            "to": "TestFriend",
            "amount": 5
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "new_balance" in data


class TestEventsSystem:
    """Events System API Tests"""
    
    def test_get_events_list(self, api_client):
        """Test GET /api/app/events/list"""
        response = api_client.get(f"{BASE_URL}/api/app/events/list")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert len(data["events"]) >= 1
        # Verify event structure
        event = data["events"][0]
        assert "id" in event
        assert "name" in event
        assert "reward" in event
    
    def test_join_event(self, api_client):
        """Test POST /api/app/events/join"""
        response = api_client.post(f"{BASE_URL}/api/app/events/join", json={
            "event_id": 2
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["event_id"] == 2


class TestStoreSystem:
    """Store System API Tests"""
    
    def test_buy_store_item(self, api_client):
        """Test POST /api/app/store/buy"""
        response = api_client.post(f"{BASE_URL}/api/app/store/buy", json={
            "item_id": "mystery_box",
            "price": 50
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "new_balance" in data


class TestLoanSystem:
    """Loan System API Tests"""
    
    def test_get_active_loans(self, api_client):
        """Test GET /api/app/loans/active"""
        response = api_client.get(f"{BASE_URL}/api/app/loans/active")
        assert response.status_code == 200
        data = response.json()
        assert "has_active_loan" in data
    
    def test_request_loan(self, api_client):
        """Test POST /api/app/loans/request"""
        # First check if there's an active loan
        check_response = api_client.get(f"{BASE_URL}/api/app/loans/active")
        check_data = check_response.json()
        
        if check_data.get("has_active_loan"):
            # Repay existing loan first
            api_client.post(f"{BASE_URL}/api/app/loans/repay", json={"loan_id": 1})
        
        response = api_client.post(f"{BASE_URL}/api/app/loans/request", json={
            "amount": 100,
            "interest_rate": 10
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "loan_id" in data or "amount" in data
        assert data.get("amount") == 100 or "loan_id" in data
    
    def test_repay_loan(self, api_client):
        """Test POST /api/app/loans/repay"""
        response = api_client.post(f"{BASE_URL}/api/app/loans/repay", json={
            "loan_id": 1
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True


class TestVIPSystem:
    """VIP System API Tests"""
    
    def test_get_vip_status(self, api_client):
        """Test GET /api/app/vip/status"""
        response = api_client.get(f"{BASE_URL}/api/app/vip/status")
        assert response.status_code == 200
        data = response.json()
        assert "level" in data
        assert "name" in data
        assert "bonus" in data
    
    def test_vip_upgrade(self, api_client):
        """Test POST /api/app/vip/upgrade"""
        # First add coins to ensure we have enough
        api_client.post(f"{BASE_URL}/api/app/wallet/add-coins?amount=1000")
        
        response = api_client.post(f"{BASE_URL}/api/app/vip/upgrade", json={
            "level": 2,
            "price": 500
        })
        # May fail if already at level 2 or not enough coins
        assert response.status_code in [200, 400]
        if response.status_code == 200:
            data = response.json()
            assert data["success"] == True
            assert "new_balance" in data


class TestAuctionSystem:
    """Auction System API Tests"""
    
    def test_get_active_auctions(self, api_client):
        """Test GET /api/app/auction/active"""
        response = api_client.get(f"{BASE_URL}/api/app/auction/active")
        assert response.status_code == 200
        data = response.json()
        assert "auctions" in data
        assert len(data["auctions"]) >= 1
        # Verify auction structure
        auction = data["auctions"][0]
        assert "id" in auction
        assert "name" in auction
        assert "current_bid" in auction
    
    def test_place_auction_bid(self, api_client):
        """Test POST /api/app/auction/bid"""
        response = api_client.post(f"{BASE_URL}/api/app/auction/bid", json={
            "item_id": 1,
            "bid_amount": 20
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "new_balance" in data


class TestCoinHuntSystem:
    """Coin Hunt (Map) System API Tests"""
    
    def test_collect_coin(self, api_client):
        """Test POST /api/app/coins/collect"""
        import random
        coin_id = f"test_coin_{random.randint(1000, 9999)}"
        response = api_client.post(f"{BASE_URL}/api/app/coins/collect", json={
            "coin_id": coin_id,
            "value": 10
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "new_balance" in data
    
    def test_get_collected_coins(self, api_client):
        """Test GET /api/app/coins/collected"""
        response = api_client.get(f"{BASE_URL}/api/app/coins/collected")
        assert response.status_code == 200
        data = response.json()
        assert "collected" in data
        assert "total_value" in data
        assert "count" in data


class TestMerchantSystem:
    """Merchant System API Tests"""
    
    def test_get_merchant_status(self, api_client):
        """Test GET /api/app/merchant/status"""
        response = api_client.get(f"{BASE_URL}/api/app/merchant/status")
        assert response.status_code == 200
        data = response.json()
        assert "is_registered" in data
    
    def test_merchant_receive_payment(self, api_client):
        """Test POST /api/app/merchant/receive"""
        response = api_client.post(f"{BASE_URL}/api/app/merchant/receive", json={
            "amount": 25,
            "from_user": "test_customer"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "new_balance" in data


class TestMarketplaceSystem:
    """Marketplace System API Tests"""
    
    def test_create_marketplace_listing(self, api_client):
        """Test POST /api/app/marketplace/create"""
        response = api_client.post(f"{BASE_URL}/api/app/marketplace/create", json={
            "title": "Test Listing Pytest",
            "price": 150
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "listing_id" in data


class TestGamesSystem:
    """Games System API Tests"""
    
    def test_play_game(self, api_client):
        """Test POST /api/app/games/play"""
        response = api_client.post(f"{BASE_URL}/api/app/games/play", json={
            "game_type": "wheel"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "reward" in data
        assert data["reward"] >= 10 and data["reward"] <= 50
        assert "new_balance" in data
    
    def test_get_games_history(self, api_client):
        """Test GET /api/app/games/history"""
        response = api_client.get(f"{BASE_URL}/api/app/games/history")
        assert response.status_code == 200
        data = response.json()
        assert "history" in data


class TestWalletSystem:
    """Wallet System API Tests"""
    
    def test_get_wallet_balance(self, api_client):
        """Test GET /api/app/wallet/balance"""
        response = api_client.get(f"{BASE_URL}/api/app/wallet/balance")
        assert response.status_code == 200
        data = response.json()
        assert "coins" in data
        assert isinstance(data["coins"], int)
