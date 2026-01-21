"""
Backend API Tests for Auction Scheduling Feature
Tests the three scheduling modes: immediate, scheduled, custom
"""
import pytest
import requests
import os
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pennyauction.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.de"
ADMIN_PASSWORD = "Admin123!"
CUSTOMER_EMAIL = "kunde@bidblitz.de"
CUSTOMER_PASSWORD = "Kunde123!"


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["is_admin"] == True
        assert data["user"]["email"] == ADMIN_EMAIL
    
    def test_customer_login_success(self):
        """Test customer login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["is_admin"] == False
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401


class TestProductEndpoints:
    """Product endpoint tests"""
    
    def test_get_products(self):
        """Test getting all products"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            product = data[0]
            assert "id" in product
            assert "name" in product
            assert "retail_price" in product


class TestAuctionSchedulingModes:
    """Tests for the three auction scheduling modes"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture
    def customer_token(self):
        """Get customer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Customer authentication failed")
    
    @pytest.fixture
    def product_id(self):
        """Get a product ID for testing"""
        response = requests.get(f"{BASE_URL}/api/products")
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        pytest.skip("No products available for testing")
    
    def test_create_immediate_auction(self, admin_token, product_id):
        """Test creating auction with 'immediate' mode (traditional duration-based)"""
        response = requests.post(
            f"{BASE_URL}/api/admin/auctions",
            json={
                "product_id": product_id,
                "starting_price": 0.01,
                "bid_increment": 0.02,
                "duration_seconds": 300  # 5 minutes
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify auction was created with active status
        assert data["status"] == "active"
        assert data["current_price"] == 0.01
        assert data["bid_increment"] == 0.02
        assert "end_time" in data
        
        # Cleanup - delete the test auction
        auction_id = data["id"]
        requests.delete(
            f"{BASE_URL}/api/admin/auctions/{auction_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_create_scheduled_auction(self, admin_token, product_id):
        """Test creating auction with 'scheduled' mode (future start time + duration)"""
        # Schedule auction to start 1 hour from now
        start_time = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        
        response = requests.post(
            f"{BASE_URL}/api/admin/auctions",
            json={
                "product_id": product_id,
                "starting_price": 0.05,
                "bid_increment": 0.03,
                "start_time": start_time,
                "duration_seconds": 600  # 10 minutes
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify auction was created with scheduled status
        assert data["status"] == "scheduled"
        assert data["current_price"] == 0.05
        assert "start_time" in data
        assert "end_time" in data
        
        # Verify start_time is in the future
        auction_start = datetime.fromisoformat(data["start_time"].replace('Z', '+00:00'))
        assert auction_start > datetime.now(timezone.utc)
        
        # Cleanup
        auction_id = data["id"]
        requests.delete(
            f"{BASE_URL}/api/admin/auctions/{auction_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_create_custom_auction(self, admin_token, product_id):
        """Test creating auction with 'custom' mode (explicit start and end times)"""
        # Custom start and end times
        start_time = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        end_time = (datetime.now(timezone.utc) + timedelta(hours=5)).isoformat()
        
        response = requests.post(
            f"{BASE_URL}/api/admin/auctions",
            json={
                "product_id": product_id,
                "starting_price": 0.10,
                "bid_increment": 0.05,
                "start_time": start_time,
                "end_time": end_time
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify auction was created with scheduled status
        assert data["status"] == "scheduled"
        assert data["current_price"] == 0.10
        assert "start_time" in data
        assert "end_time" in data
        
        # Cleanup
        auction_id = data["id"]
        requests.delete(
            f"{BASE_URL}/api/admin/auctions/{auction_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )


class TestScheduledAuctionBehavior:
    """Tests for scheduled auction behavior"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture
    def customer_token(self):
        """Get customer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Customer authentication failed")
    
    def test_get_auctions_list(self):
        """Test getting auctions list includes scheduled auctions"""
        response = requests.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Check if there are any scheduled auctions
        scheduled_auctions = [a for a in data if a["status"] == "scheduled"]
        print(f"Found {len(scheduled_auctions)} scheduled auctions")
        
        # Verify scheduled auctions have start_time
        for auction in scheduled_auctions:
            assert "start_time" in auction
            assert auction["start_time"] is not None
    
    def test_get_auctions_by_status(self):
        """Test filtering auctions by status"""
        # Get scheduled auctions
        response = requests.get(f"{BASE_URL}/api/auctions?status=scheduled")
        assert response.status_code == 200
        data = response.json()
        
        # All returned auctions should be scheduled
        for auction in data:
            assert auction["status"] == "scheduled"
    
    def test_bidding_not_allowed_on_scheduled_auction(self, customer_token):
        """Test that bidding is NOT allowed on scheduled auctions"""
        # First, find a scheduled auction
        response = requests.get(f"{BASE_URL}/api/auctions?status=scheduled")
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No scheduled auctions available for testing")
        
        scheduled_auction = response.json()[0]
        auction_id = scheduled_auction["id"]
        
        # Try to place a bid on the scheduled auction
        bid_response = requests.post(
            f"{BASE_URL}/api/auctions/{auction_id}/bid",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        # Should fail because auction is not active
        assert bid_response.status_code == 400
        assert "not active" in bid_response.json().get("detail", "").lower()
    
    def test_scheduled_auction_has_start_time(self):
        """Test that scheduled auctions have start_time field"""
        response = requests.get(f"{BASE_URL}/api/auctions?status=scheduled")
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No scheduled auctions available for testing")
        
        for auction in response.json():
            assert "start_time" in auction
            assert auction["start_time"] is not None
            # Verify start_time is a valid ISO datetime
            start_time = datetime.fromisoformat(auction["start_time"].replace('Z', '+00:00'))
            assert isinstance(start_time, datetime)


class TestAuctionDetailEndpoint:
    """Tests for auction detail endpoint"""
    
    def test_get_auction_detail(self):
        """Test getting auction detail"""
        # First get an auction ID
        response = requests.get(f"{BASE_URL}/api/auctions")
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No auctions available for testing")
        
        auction_id = response.json()[0]["id"]
        
        # Get auction detail
        detail_response = requests.get(f"{BASE_URL}/api/auctions/{auction_id}")
        assert detail_response.status_code == 200
        data = detail_response.json()
        
        # Verify all required fields
        assert "id" in data
        assert "product_id" in data
        assert "current_price" in data
        assert "bid_increment" in data
        assert "end_time" in data
        assert "status" in data
        assert "total_bids" in data
    
    def test_get_scheduled_auction_detail(self):
        """Test getting scheduled auction detail includes start_time"""
        response = requests.get(f"{BASE_URL}/api/auctions?status=scheduled")
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No scheduled auctions available for testing")
        
        auction_id = response.json()[0]["id"]
        
        # Get auction detail
        detail_response = requests.get(f"{BASE_URL}/api/auctions/{auction_id}")
        assert detail_response.status_code == 200
        data = detail_response.json()
        
        # Verify scheduled auction has start_time
        assert data["status"] == "scheduled"
        assert "start_time" in data
        assert data["start_time"] is not None


class TestAdminAuctionManagement:
    """Tests for admin auction management"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_admin_can_see_all_auctions(self, admin_token):
        """Test admin can see all auctions including scheduled"""
        response = requests.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200
        data = response.json()
        
        # Count auctions by status
        statuses = {}
        for auction in data:
            status = auction["status"]
            statuses[status] = statuses.get(status, 0) + 1
        
        print(f"Auction statuses: {statuses}")
        assert isinstance(data, list)
    
    def test_admin_can_update_auction_times(self, admin_token):
        """Test admin can update auction start/end times"""
        # Get a scheduled auction
        response = requests.get(f"{BASE_URL}/api/auctions?status=scheduled")
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No scheduled auctions available for testing")
        
        auction = response.json()[0]
        auction_id = auction["id"]
        
        # Update the end time
        new_end_time = (datetime.now(timezone.utc) + timedelta(hours=10)).isoformat()
        
        update_response = requests.put(
            f"{BASE_URL}/api/admin/auctions/{auction_id}",
            json={"end_time": new_end_time},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert update_response.status_code == 200


class TestBotSystemWithActiveAuctions:
    """Tests for bot system with active auctions"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_get_bots(self, admin_token):
        """Test getting all bots"""
        response = requests.get(
            f"{BASE_URL}/api/admin/bots",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_bot_cannot_bid_on_scheduled_auction(self, admin_token):
        """Test that bots cannot bid on scheduled auctions"""
        # Get bots
        bots_response = requests.get(
            f"{BASE_URL}/api/admin/bots",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if bots_response.status_code != 200 or len(bots_response.json()) == 0:
            pytest.skip("No bots available for testing")
        
        bot_id = bots_response.json()[0]["id"]
        
        # Get a scheduled auction
        auctions_response = requests.get(f"{BASE_URL}/api/auctions?status=scheduled")
        if auctions_response.status_code != 200 or len(auctions_response.json()) == 0:
            pytest.skip("No scheduled auctions available for testing")
        
        auction_id = auctions_response.json()[0]["id"]
        
        # Try to make bot bid on scheduled auction
        bid_response = requests.post(
            f"{BASE_URL}/api/admin/bots/bid",
            json={"auction_id": auction_id, "bot_id": bot_id},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Should fail because auction is not active
        assert bid_response.status_code == 400


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
