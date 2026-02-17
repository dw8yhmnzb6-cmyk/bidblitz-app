"""
BidBlitz Penny Auction Platform - Backend API Tests
Tests for refactored modular architecture with routers
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://auction-hub-80.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "Admin123!"
CUSTOMER_EMAIL = "kunde@bidblitz.ae"
CUSTOMER_PASSWORD = "Kunde123!"


class TestHealthAndPublicEndpoints:
    """Test health check and public endpoints"""
    
    def test_health_check(self):
        """Test /api/health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        print(f"✓ Health check passed: {data}")
    
    def test_root_endpoint(self):
        """Test root endpoint"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"✓ Root endpoint: {data}")
    
    def test_get_bid_packages(self):
        """Test /api/bid-packages endpoint"""
        response = requests.get(f"{BASE_URL}/api/bid-packages")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify package structure
        for pkg in data:
            assert "id" in pkg
            assert "name" in pkg
            assert "bids" in pkg
            assert "price" in pkg
        print(f"✓ Bid packages: {len(data)} packages found")
    
    def test_get_products(self):
        """Test /api/products endpoint"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify product structure
        for product in data[:3]:  # Check first 3
            assert "id" in product
            assert "name" in product
            assert "retail_price" in product
            assert "category" in product
        print(f"✓ Products: {len(data)} products found")
    
    def test_get_auctions(self):
        """Test /api/auctions endpoint"""
        response = requests.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Auctions: {len(data)} auctions found")
    
    def test_get_active_auctions(self):
        """Test /api/auctions/active endpoint"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify all returned auctions are active
        for auction in data:
            assert auction.get("status") == "active"
            assert "product" in auction  # Should have product info attached
        print(f"✓ Active auctions: {len(data)} active auctions found")
    
    def test_get_winners(self):
        """Test /api/winners endpoint"""
        response = requests.get(f"{BASE_URL}/api/winners")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Winners gallery: {len(data)} winners found")
    
    def test_get_categories(self):
        """Test /api/categories endpoint"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Categories: {data}")


class TestAuthentication:
    """Test authentication endpoints"""
    
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
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["is_admin"] == True
        print(f"✓ Admin login successful: {data['user']['email']}")
        return data["token"]
    
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
        assert data["user"]["email"] == CUSTOMER_EMAIL
        assert data["user"]["is_admin"] == False
        print(f"✓ Customer login successful: {data['user']['email']}")
        return data["token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials rejected correctly")
    
    def test_get_current_user(self):
        """Test /api/auth/me endpoint"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        token = login_response.json()["token"]
        
        # Get current user
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == CUSTOMER_EMAIL
        assert "bids_balance" in data
        assert "referral_code" in data
        print(f"✓ Get current user: {data['email']}, bids: {data['bids_balance']}")


class TestUserEndpoints:
    """Test user profile and dashboard endpoints"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_user_profile(self, customer_token):
        """Test /api/user/profile endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "bids_balance" in data
        assert "total_bids_placed" in data
        assert "referral_code" in data
        print(f"✓ User profile: {data['email']}, bids: {data['bids_balance']}")
    
    def test_get_user_dashboard(self, customer_token):
        """Test /api/user/dashboard endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/user/dashboard",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "bids_balance" in data
        assert "total_bids_placed" in data
        assert "won_auctions_count" in data
        print(f"✓ User dashboard: bids={data['bids_balance']}, won={data['won_auctions_count']}")
    
    def test_get_user_wishlist(self, customer_token):
        """Test /api/user/wishlist endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/user/wishlist",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ User wishlist: {len(data)} items")
    
    def test_get_user_referrals(self, customer_token):
        """Test /api/user/referrals endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/user/referrals",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "referral_code" in data
        assert "total_referrals" in data
        assert "share_url" in data
        print(f"✓ User referrals: code={data['referral_code']}, total={data['total_referrals']}")
    
    def test_unauthorized_access(self):
        """Test that user endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/user/profile")
        assert response.status_code == 401
        print("✓ Unauthorized access rejected correctly")


class TestAdminEndpoints:
    """Test admin-only endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_admin_stats(self, admin_token):
        """Test /api/admin/stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "auctions" in data
        assert "revenue" in data
        assert "products" in data
        print(f"✓ Admin stats: users={data['users']['total']}, auctions={data['auctions']['total']}, revenue=€{data['revenue']['total']}")
    
    def test_admin_stats_requires_admin(self, customer_token):
        """Test that admin stats requires admin role"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 403
        print("✓ Admin stats correctly requires admin role")
    
    def test_get_admin_users(self, admin_token):
        """Test /api/admin/users endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify password is not exposed
        for user in data[:3]:
            assert "password" not in user
            assert "two_factor_secret" not in user
        print(f"✓ Admin users: {len(data)} users found")
    
    def test_get_admin_transactions(self, admin_token):
        """Test /api/admin/transactions endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/transactions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin transactions: {len(data)} transactions found")
    
    def test_get_admin_security_logs(self, admin_token):
        """Test /api/admin/security-logs endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/security-logs",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin security logs: {len(data)} logs found")
    
    def test_get_email_stats(self, admin_token):
        """Test /api/admin/email/stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/email/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "active_users" in data
        assert "email_configured" in data
        print(f"✓ Email stats: total={data['total_users']}, active={data['active_users']}")
    
    def test_get_email_templates(self, admin_token):
        """Test /api/admin/email/templates endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/email/templates",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Email templates: {len(data)} templates found")


class TestBotSeeding:
    """Test bot seeding functionality"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_seed_bots(self, admin_token):
        """Test /api/admin/bots/seed endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/admin/bots/seed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "total" in data
        assert "created" in data
        print(f"✓ Bot seeding: {data['message']}, total bots: {data['total']}")


class TestAuctionEndpoints:
    """Test auction-specific endpoints"""
    
    def test_get_single_auction(self):
        """Test /api/auctions/{id} endpoint"""
        # First get list of auctions
        list_response = requests.get(f"{BASE_URL}/api/auctions")
        auctions = list_response.json()
        
        if auctions:
            auction_id = auctions[0]["id"]
            response = requests.get(f"{BASE_URL}/api/auctions/{auction_id}")
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == auction_id
            assert "product" in data
            print(f"✓ Single auction: {data['id'][:8]}... - {data.get('product', {}).get('name', 'N/A')}")
        else:
            pytest.skip("No auctions available to test")
    
    def test_get_auction_bid_history(self):
        """Test /api/auctions/{id}/bid-history endpoint"""
        # First get list of auctions
        list_response = requests.get(f"{BASE_URL}/api/auctions")
        auctions = list_response.json()
        
        if auctions:
            auction_id = auctions[0]["id"]
            response = requests.get(f"{BASE_URL}/api/auctions/{auction_id}/bid-history")
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            print(f"✓ Bid history: {len(data)} bids for auction {auction_id[:8]}...")
        else:
            pytest.skip("No auctions available to test")
    
    def test_auction_not_found(self):
        """Test 404 for non-existent auction"""
        response = requests.get(f"{BASE_URL}/api/auctions/non-existent-id")
        assert response.status_code == 404
        print("✓ Non-existent auction returns 404")


class TestPasswordReset:
    """Test password reset flow"""
    
    def test_forgot_password(self):
        """Test /api/auth/forgot-password endpoint"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": CUSTOMER_EMAIL
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        # In demo mode, should return demo_code
        if "demo_code" in data:
            print(f"✓ Forgot password: demo code = {data['demo_code']}")
        else:
            print("✓ Forgot password: email sent (production mode)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
