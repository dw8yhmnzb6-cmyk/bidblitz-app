"""
bidblitz.ae Penny Auction API Tests
Tests for auctions, products, auth, and bidding functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://gaming-platform-129.preview.emergentagent.com')

class TestPublicEndpoints:
    """Test public API endpoints that don't require authentication"""
    
    def test_health_check(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("✅ Health check passed")
    
    def test_get_active_auctions(self):
        """Test getting active auctions"""
        response = requests.get(f"{BASE_URL}/api/auctions?status=active")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} active auctions")
        
        # Verify auction structure
        if len(data) > 0:
            auction = data[0]
            assert "id" in auction
            assert "current_price" in auction
            assert "end_time" in auction
            assert "status" in auction
            print("✅ Auction structure is correct")
    
    def test_get_products(self):
        """Test getting products"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} products")
        
        # Verify product structure
        if len(data) > 0:
            product = data[0]
            assert "id" in product
            assert "name" in product
            assert "retail_price" in product
            print("✅ Product structure is correct")
    
    def test_get_business_hours(self):
        """Test business hours endpoint"""
        response = requests.get(f"{BASE_URL}/api/auctions/business-hours")
        assert response.status_code == 200
        data = response.json()
        assert "is_open" in data
        assert "business_start" in data
        assert "business_end" in data
        print(f"✅ Business hours: {data['business_start']} - {data['business_end']}, Open: {data['is_open']}")
    
    def test_get_featured_auction(self):
        """Test featured auction endpoint"""
        response = requests.get(f"{BASE_URL}/api/auctions/featured")
        assert response.status_code == 200
        print("✅ Featured auction endpoint works")
    
    def test_get_auction_of_the_day(self):
        """Test auction of the day endpoint"""
        response = requests.get(f"{BASE_URL}/api/auction-of-the-day")
        assert response.status_code == 200
        print("✅ Auction of the day endpoint works")


class TestLegalPages:
    """Test legal page content endpoints"""
    
    def test_impressum_page(self):
        """Test impressum page API"""
        response = requests.get(f"{BASE_URL}/api/pages/impressum")
        # May return 404 if using fallback content
        assert response.status_code in [200, 404]
        print("✅ Impressum page endpoint accessible")
    
    def test_agb_page(self):
        """Test AGB page API"""
        response = requests.get(f"{BASE_URL}/api/pages/agb")
        assert response.status_code in [200, 404]
        print("✅ AGB page endpoint accessible")
    
    def test_datenschutz_page(self):
        """Test Datenschutz page API"""
        response = requests.get(f"{BASE_URL}/api/pages/datenschutz")
        assert response.status_code in [200, 404]
        print("✅ Datenschutz page endpoint accessible")


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_with_valid_credentials(self):
        """Test login with valid customer credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kunde@bidblitz.ae",
            "password": "Kunde123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data or "token" in data
        print("✅ Login successful with valid credentials")
        return data.get("access_token") or data.get("token")
    
    def test_login_with_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 400, 404]
        print("✅ Login correctly rejected invalid credentials")
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.ae",
            "password": "Admin123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data or "token" in data
        print("✅ Admin login successful")


class TestAuthenticatedEndpoints:
    """Test endpoints that require authentication"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kunde@bidblitz.ae",
            "password": "Kunde123!"
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip("Authentication failed")
    
    def test_get_user_profile(self, auth_token):
        """Test getting user profile"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        print(f"✅ Got user profile: {data.get('email')}")
    
    def test_get_wishlist(self, auth_token):
        """Test getting user wishlist"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/wishlist", headers=headers)
        assert response.status_code == 200
        print("✅ Wishlist endpoint works")
    
    def test_get_autobidders(self, auth_token):
        """Test getting user autobidders"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/autobidder/my", headers=headers)
        assert response.status_code == 200
        print("✅ Autobidders endpoint works")
    
    def test_get_orders(self, auth_token):
        """Test getting user orders"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/orders/my", headers=headers)
        assert response.status_code == 200
        print("✅ Orders endpoint works")


class TestBiddingFunctionality:
    """Test bidding functionality"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kunde@bidblitz.ae",
            "password": "Kunde123!"
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def active_auction_id(self):
        """Get an active auction ID"""
        response = requests.get(f"{BASE_URL}/api/auctions?status=active")
        if response.status_code == 200:
            auctions = response.json()
            if len(auctions) > 0:
                return auctions[0]["id"]
        pytest.skip("No active auctions available")
    
    def test_place_bid(self, auth_token, active_auction_id):
        """Test placing a bid on an auction"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/auctions/{active_auction_id}/bid",
            headers=headers
        )
        # Should succeed or fail with specific error (not enough bids, etc.)
        assert response.status_code in [200, 400, 403]
        if response.status_code == 200:
            data = response.json()
            assert "new_price" in data or "message" in data
            print("✅ Bid placed successfully")
        else:
            print(f"⚠️ Bid not placed: {response.json().get('detail', 'Unknown error')}")
    
    def test_bid_without_auth(self, active_auction_id):
        """Test that bidding requires authentication"""
        response = requests.post(f"{BASE_URL}/api/auctions/{active_auction_id}/bid")
        assert response.status_code in [401, 403, 422]
        print("✅ Bidding correctly requires authentication")


class TestAuctionDetails:
    """Test individual auction endpoints"""
    
    @pytest.fixture
    def active_auction_id(self):
        """Get an active auction ID"""
        response = requests.get(f"{BASE_URL}/api/auctions?status=active")
        if response.status_code == 200:
            auctions = response.json()
            if len(auctions) > 0:
                return auctions[0]["id"]
        pytest.skip("No active auctions available")
    
    def test_get_auction_by_id(self, active_auction_id):
        """Test getting auction by ID"""
        response = requests.get(f"{BASE_URL}/api/auctions/{active_auction_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == active_auction_id
        assert "current_price" in data
        assert "end_time" in data
        print(f"✅ Got auction details: {data.get('id')}")
    
    def test_get_nonexistent_auction(self):
        """Test getting non-existent auction"""
        response = requests.get(f"{BASE_URL}/api/auctions/nonexistent-id-12345")
        assert response.status_code == 404
        print("✅ Non-existent auction returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
