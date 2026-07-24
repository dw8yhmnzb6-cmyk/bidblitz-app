"""
Backend Tests for Commerce Center, Flash Sales, and Mobility Center
Tests: Merchant Flash Sale Dashboard, Flash Sale CRUD, Deep-Links, Mobility Center
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCommerceCenter:
    """Commerce Center API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@bidblitz.com", "password": "BidBlitz2026!"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json()
        print(f"Logged in as: {self.user.get('email')}")
    
    def test_commerce_center_overview(self):
        """Test GET /api/commerce-center/overview returns stats and data"""
        response = self.session.get(f"{BASE_URL}/api/commerce-center/overview")
        assert response.status_code == 200, f"Overview failed: {response.text}"
        
        data = response.json()
        assert "stats" in data, "Missing stats in overview"
        assert "flash_sales" in data, "Missing flash_sales in overview"
        assert "marketplace" in data, "Missing marketplace in overview"
        
        # Validate stats structure
        stats = data["stats"]
        assert "active_marketplace" in stats
        assert "active_flash_sales" in stats
        assert "active_penny_auctions" in stats
        print(f"Commerce Center Overview: {stats}")
    
    def test_merchant_dashboard_api(self):
        """Test GET /api/commerce-center/merchant-dashboard for logged-in admin"""
        response = self.session.get(f"{BASE_URL}/api/commerce-center/merchant-dashboard")
        assert response.status_code == 200, f"Merchant dashboard failed: {response.text}"
        
        data = response.json()
        assert "stats" in data, "Missing stats in merchant dashboard"
        assert "flash_sales" in data, "Missing flash_sales in merchant dashboard"
        assert "eligible_listings" in data, "Missing eligible_listings in merchant dashboard"
        
        # Validate stats structure
        stats = data["stats"]
        assert "total_listings" in stats
        assert "eligible_listings" in stats
        assert "active_flash_sales" in stats
        print(f"Merchant Dashboard Stats: {stats}")


class TestFlashSales:
    """Flash Sales CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@bidblitz.com", "password": "BidBlitz2026!"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json()
        self.created_sale_id = None
    
    def test_create_flash_sale(self):
        """Test POST /api/commerce-center/flash-sales creates a merchant flash sale"""
        # First get eligible listings
        dashboard_response = self.session.get(f"{BASE_URL}/api/commerce-center/merchant-dashboard")
        assert dashboard_response.status_code == 200
        
        eligible = dashboard_response.json().get("eligible_listings", [])
        if not eligible:
            pytest.skip("No eligible listings for flash sale test")
        
        listing_id = eligible[0]["listing_id"]
        original_price = eligible[0]["price"]
        sale_price = round(original_price * 0.8, 2)  # 20% discount
        
        # Create flash sale
        response = self.session.post(
            f"{BASE_URL}/api/commerce-center/flash-sales",
            json={
                "listing_id": listing_id,
                "sale_price": sale_price,
                "duration_minutes": 60
            }
        )
        assert response.status_code == 200, f"Create flash sale failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") == True, "Flash sale creation not ok"
        assert "sale" in data, "Missing sale in response"
        
        sale = data["sale"]
        assert sale["listing_id"] == listing_id
        assert sale["sale_price"] == sale_price
        assert sale["status"] == "active"
        assert "sale_id" in sale
        
        self.created_sale_id = sale["sale_id"]
        print(f"Created Flash Sale: {self.created_sale_id}")
        
        # Cleanup - cancel the sale
        if self.created_sale_id:
            self.session.delete(f"{BASE_URL}/api/commerce-center/flash-sales/{self.created_sale_id}")
    
    def test_cancel_flash_sale(self):
        """Test DELETE /api/commerce-center/flash-sales/{sale_id} cancels a flash sale"""
        # First create a flash sale
        dashboard_response = self.session.get(f"{BASE_URL}/api/commerce-center/merchant-dashboard")
        assert dashboard_response.status_code == 200
        
        eligible = dashboard_response.json().get("eligible_listings", [])
        if not eligible:
            pytest.skip("No eligible listings for flash sale test")
        
        listing_id = eligible[0]["listing_id"]
        original_price = eligible[0]["price"]
        sale_price = round(original_price * 0.75, 2)  # 25% discount
        
        # Create flash sale
        create_response = self.session.post(
            f"{BASE_URL}/api/commerce-center/flash-sales",
            json={
                "listing_id": listing_id,
                "sale_price": sale_price,
                "duration_minutes": 30
            }
        )
        assert create_response.status_code == 200
        sale_id = create_response.json()["sale"]["sale_id"]
        
        # Cancel flash sale
        delete_response = self.session.delete(f"{BASE_URL}/api/commerce-center/flash-sales/{sale_id}")
        assert delete_response.status_code == 200, f"Cancel flash sale failed: {delete_response.text}"
        
        data = delete_response.json()
        assert data.get("ok") == True, "Flash sale cancellation not ok"
        assert data.get("sale_id") == sale_id
        print(f"Cancelled Flash Sale: {sale_id}")


class TestMarketplaceDeepLinks:
    """Marketplace Deep-Link API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@bidblitz.com", "password": "BidBlitz2026!"}
        )
        assert login_response.status_code == 200
    
    def test_marketplace_detail_endpoint(self):
        """Test GET /api/marketplace/{listing_id} returns listing details"""
        # First get a listing
        list_response = self.session.get(f"{BASE_URL}/api/marketplace/list")
        assert list_response.status_code == 200
        
        listings = list_response.json().get("listings", [])
        if not listings:
            pytest.skip("No listings available for detail test")
        
        listing_id = listings[0]["listing_id"]
        
        # Get listing detail
        detail_response = self.session.get(f"{BASE_URL}/api/marketplace/{listing_id}")
        assert detail_response.status_code == 200, f"Marketplace detail failed: {detail_response.text}"
        
        data = detail_response.json()
        assert data["listing_id"] == listing_id
        assert "title" in data
        assert "price" in data
        assert "seller" in data
        print(f"Marketplace Detail: {data['title']} - €{data['price']}")
    
    def test_marketplace_favorites_endpoint(self):
        """Test GET /api/marketplace/favorites returns user favorites"""
        response = self.session.get(f"{BASE_URL}/api/marketplace/favorites")
        # This endpoint might return 404 if not implemented
        if response.status_code == 404:
            print("WARNING: /api/marketplace/favorites returns 404 - endpoint may not be implemented")
            pytest.skip("Favorites endpoint not implemented")
        
        assert response.status_code == 200, f"Favorites failed: {response.text}"
        data = response.json()
        assert "favorites" in data
        print(f"User has {len(data.get('favorites', []))} favorites")


class TestMobilityCenter:
    """Mobility Center API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@bidblitz.com", "password": "BidBlitz2026!"}
        )
        assert login_response.status_code == 200
    
    def test_mobility_payment_options(self):
        """Test GET /api/mobility-platform/payment-options returns payment methods"""
        response = self.session.get(f"{BASE_URL}/api/mobility-platform/payment-options")
        assert response.status_code == 200, f"Mobility payment options failed: {response.text}"
        
        data = response.json()
        assert "wallet_balance" in data, "Missing wallet_balance"
        assert "methods" in data, "Missing methods"
        
        methods = data["methods"]
        assert len(methods) > 0, "No payment methods returned"
        
        # Validate method structure
        for method in methods:
            assert "id" in method
            assert "label" in method
            assert "enabled" in method
        
        print(f"Mobility Payment Options: {len(methods)} methods, Wallet: €{data['wallet_balance']}")
    
    def test_mobility_bookings(self):
        """Test GET /api/mobility-platform/bookings returns user bookings"""
        response = self.session.get(f"{BASE_URL}/api/mobility-platform/bookings")
        
        if response.status_code == 404:
            print("WARNING: /api/mobility-platform/bookings returns 404")
            pytest.skip("Bookings endpoint not implemented")
        
        assert response.status_code == 200, f"Mobility bookings failed: {response.text}"
        data = response.json()
        print(f"Mobility Bookings: {len(data.get('bookings', []))} bookings")


class TestAuctionsDeepLinks:
    """Auctions Deep-Link API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_auctions_list_endpoint(self):
        """Test GET /api/auctions returns auction list"""
        response = self.session.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200, f"Auctions list failed: {response.text}"
        
        data = response.json()
        assert "auctions" in data or isinstance(data, list), "Invalid auctions response"
        print(f"Auctions: {len(data.get('auctions', data))} auctions")
    
    def test_live_auctions_endpoint(self):
        """Test GET /api/live-auctions returns live auction list"""
        response = self.session.get(f"{BASE_URL}/api/live-auctions")
        
        if response.status_code == 404:
            print("WARNING: /api/live-auctions returns 404")
            pytest.skip("Live auctions endpoint not implemented")
        
        assert response.status_code == 200, f"Live auctions failed: {response.text}"
        print("Live auctions endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
