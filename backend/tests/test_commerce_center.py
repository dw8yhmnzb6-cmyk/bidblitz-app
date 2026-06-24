"""
Commerce Center API Tests - Iteration 145
Tests for Commerce Center V1 feature including:
- GET /api/commerce-center/overview (stats, flash sales, marketplace, penny auctions)
- POST /api/commerce-center/flash-sales/{sale_id}/buy (wallet purchase flow)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://commerce-hub-565.preview.emergentagent.com"

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


class TestCommerceCenterOverview:
    """Tests for GET /api/commerce-center/overview endpoint"""

    def test_overview_returns_200(self):
        """Overview endpoint should return 200 OK"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/commerce-center/overview returns 200")

    def test_overview_contains_stats(self):
        """Overview should contain stats object with required keys"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        assert response.status_code == 200
        data = response.json()
        
        assert "stats" in data, "Response missing 'stats' key"
        stats = data["stats"]
        
        required_stat_keys = [
            "active_marketplace",
            "active_flash_sales", 
            "active_penny_auctions",
            "active_live_auctions",
            "active_live_streams"
        ]
        
        for key in required_stat_keys:
            assert key in stats, f"Stats missing '{key}' key"
            assert isinstance(stats[key], int), f"Stats['{key}'] should be int, got {type(stats[key])}"
        
        print(f"✓ Stats: marketplace={stats['active_marketplace']}, flash_sales={stats['active_flash_sales']}, penny_auctions={stats['active_penny_auctions']}")

    def test_overview_contains_flash_sales(self):
        """Overview should contain flash_sales array"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        assert response.status_code == 200
        data = response.json()
        
        assert "flash_sales" in data, "Response missing 'flash_sales' key"
        assert isinstance(data["flash_sales"], list), "flash_sales should be a list"
        
        if len(data["flash_sales"]) > 0:
            sale = data["flash_sales"][0]
            required_keys = ["sale_id", "title", "sale_price", "original_price", "discount_pct", "remaining_seconds"]
            for key in required_keys:
                assert key in sale, f"Flash sale missing '{key}' key"
            print(f"✓ Flash sales: {len(data['flash_sales'])} items, first: {sale.get('title', 'N/A')[:40]}")
        else:
            print("✓ Flash sales: 0 items (empty but valid)")

    def test_overview_contains_marketplace(self):
        """Overview should contain marketplace array"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        assert response.status_code == 200
        data = response.json()
        
        assert "marketplace" in data, "Response missing 'marketplace' key"
        assert isinstance(data["marketplace"], list), "marketplace should be a list"
        
        if len(data["marketplace"]) > 0:
            item = data["marketplace"][0]
            required_keys = ["listing_id", "title", "price"]
            for key in required_keys:
                assert key in item, f"Marketplace item missing '{key}' key"
            print(f"✓ Marketplace: {len(data['marketplace'])} items")
        else:
            print("✓ Marketplace: 0 items (empty but valid)")

    def test_overview_contains_penny_auctions(self):
        """Overview should contain penny_auctions array"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        assert response.status_code == 200
        data = response.json()
        
        assert "penny_auctions" in data, "Response missing 'penny_auctions' key"
        assert isinstance(data["penny_auctions"], list), "penny_auctions should be a list"
        
        if len(data["penny_auctions"]) > 0:
            auction = data["penny_auctions"][0]
            required_keys = ["auction_id", "title", "current_price"]
            for key in required_keys:
                assert key in auction, f"Penny auction missing '{key}' key"
            print(f"✓ Penny auctions: {len(data['penny_auctions'])} items")
        else:
            print("✓ Penny auctions: 0 items (empty but valid)")

    def test_overview_contains_live_sections(self):
        """Overview should contain live_auctions, live_streams, upcoming_streams"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        assert response.status_code == 200
        data = response.json()
        
        assert "live_auctions" in data, "Response missing 'live_auctions' key"
        assert "live_streams" in data, "Response missing 'live_streams' key"
        assert "upcoming_streams" in data, "Response missing 'upcoming_streams' key"
        
        assert isinstance(data["live_auctions"], list), "live_auctions should be a list"
        assert isinstance(data["live_streams"], list), "live_streams should be a list"
        assert isinstance(data["upcoming_streams"], list), "upcoming_streams should be a list"
        
        print(f"✓ Live sections: auctions={len(data['live_auctions'])}, streams={len(data['live_streams'])}, upcoming={len(data['upcoming_streams'])}")

    def test_overview_no_serialization_errors(self):
        """Overview should not contain MongoDB ObjectId or datetime serialization errors"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        assert response.status_code == 200
        
        # If we got here without 500 error, serialization is working
        data = response.json()
        
        # Check that no _id fields leaked through
        def check_no_id(obj, path=""):
            if isinstance(obj, dict):
                assert "_id" not in obj, f"Found _id at {path}"
                for k, v in obj.items():
                    check_no_id(v, f"{path}.{k}")
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    check_no_id(item, f"{path}[{i}]")
        
        check_no_id(data)
        print("✓ No serialization errors (_id excluded, dates serialized)")


class TestFlashSalePurchase:
    """Tests for POST /api/commerce-center/flash-sales/{sale_id}/buy endpoint"""

    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
        return session

    @pytest.fixture
    def active_flash_sale(self):
        """Get an active flash sale ID for testing"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        if response.status_code != 200:
            pytest.skip("Could not fetch overview")
        
        data = response.json()
        flash_sales = data.get("flash_sales", [])
        
        if not flash_sales:
            pytest.skip("No active flash sales available for testing")
        
        return flash_sales[0]

    def test_buy_requires_auth(self, active_flash_sale):
        """Flash sale purchase should require authentication"""
        sale_id = active_flash_sale["sale_id"]
        response = requests.post(
            f"{BASE_URL}/api/commerce-center/flash-sales/{sale_id}/buy",
            json={"use_shipping": False}
        )
        assert response.status_code == 401, f"Expected 401 for unauthenticated request, got {response.status_code}"
        print(f"✓ POST /api/commerce-center/flash-sales/{sale_id}/buy requires auth (401)")

    def test_buy_invalid_sale_returns_404(self, auth_session):
        """Buying non-existent flash sale should return 404"""
        response = auth_session.post(
            f"{BASE_URL}/api/commerce-center/flash-sales/invalid_sale_id_xyz/buy",
            json={"use_shipping": False}
        )
        assert response.status_code == 404, f"Expected 404 for invalid sale, got {response.status_code}"
        print("✓ Invalid sale_id returns 404")

    def test_buy_flash_sale_success(self, auth_session, active_flash_sale):
        """Authenticated user can buy a flash sale with wallet"""
        sale_id = active_flash_sale["sale_id"]
        sale_price = active_flash_sale.get("sale_price", 0)
        
        # First check wallet balance
        wallet_response = auth_session.get(f"{BASE_URL}/api/wallet")
        if wallet_response.status_code != 200:
            pytest.skip("Could not fetch wallet")
        
        wallet_data = wallet_response.json()
        balance = wallet_data.get("balance", 0)
        
        if balance < sale_price:
            pytest.skip(f"Insufficient wallet balance ({balance}) for flash sale ({sale_price})")
        
        # Attempt purchase
        response = auth_session.post(
            f"{BASE_URL}/api/commerce-center/flash-sales/{sale_id}/buy",
            json={"use_shipping": False}
        )
        
        # Could be 200 (success), 400 (already sold/own item), or 404 (expired)
        if response.status_code == 200:
            data = response.json()
            assert data.get("ok") == True, "Response should have ok=True"
            assert "order" in data, "Response should contain order"
            assert "new_balance" in data, "Response should contain new_balance"
            print(f"✓ Flash sale purchase successful: order_id={data['order'].get('order_id')}")
        elif response.status_code == 400:
            # Sale might be sold out or user owns it
            print(f"✓ Flash sale purchase returned 400 (expected for edge cases): {response.json().get('detail', 'N/A')}")
        elif response.status_code == 404:
            print(f"✓ Flash sale expired/unavailable (404)")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")


class TestCommerceCenterIntegration:
    """Integration tests for Commerce Center with existing systems"""

    def test_overview_marketplace_links_to_existing_listings(self):
        """Marketplace items in overview should have valid listing_ids"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        assert response.status_code == 200
        data = response.json()
        
        marketplace = data.get("marketplace", [])
        if marketplace:
            # Check first item has listing_id format
            item = marketplace[0]
            listing_id = item.get("listing_id", "")
            assert listing_id.startswith("mp_"), f"listing_id should start with 'mp_', got {listing_id}"
            print(f"✓ Marketplace items have valid listing_id format")
        else:
            print("✓ No marketplace items to validate (empty)")

    def test_overview_penny_auctions_links_to_existing_auctions(self):
        """Penny auctions in overview should have valid auction_ids"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        assert response.status_code == 200
        data = response.json()
        
        penny_auctions = data.get("penny_auctions", [])
        if penny_auctions:
            auction = penny_auctions[0]
            auction_id = auction.get("auction_id", "")
            assert auction_id, "auction_id should not be empty"
            print(f"✓ Penny auctions have valid auction_id: {auction_id[:20]}...")
        else:
            print("✓ No penny auctions to validate (empty)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
