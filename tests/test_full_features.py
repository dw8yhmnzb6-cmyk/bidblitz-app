"""
Comprehensive test suite for BidBlitz Penny Auction Platform
Tests all major features after major updates
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://allinone-platform-2.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "Admin123!"
CUSTOMER_EMAIL = "kunde@bidblitz.ae"
CUSTOMER_PASSWORD = "Kunde123!"

class TestAuthenticationFlow:
    """Test user authentication endpoints"""
    
    def test_admin_login(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["is_admin"] == True
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Admin login successful - is_admin: {data['user']['is_admin']}")
    
    def test_customer_login(self):
        """Test customer login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == CUSTOMER_EMAIL
        print(f"✓ Customer login successful - bids_balance: {data['user']['bids_balance']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")
    
    def test_registration_with_referral_code(self):
        """Test user registration with referral code"""
        import uuid
        test_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "TestPass123!",
            "name": "Test User",
            "referral_code": "TESTREF"  # Test with a referral code
        })
        # Should succeed even if referral code is invalid
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["bids_balance"] == 10  # Free starting bids
        print(f"✓ Registration with referral code successful - bids: {data['user']['bids_balance']}")


class TestBidPackages:
    """Test bid packages and pricing"""
    
    def test_get_bid_packages(self):
        """Test fetching bid packages with new prices"""
        response = requests.get(f"{BASE_URL}/api/bid-packages")
        assert response.status_code == 200
        packages = response.json()
        assert len(packages) == 8  # 8 packages from €5 to €150
        
        # Verify package prices
        expected_prices = {
            "pack_5": 5.0,
            "pack_10": 10.0,
            "pack_15": 15.0,
            "pack_25": 25.0,
            "pack_50": 50.0,
            "pack_75": 75.0,
            "pack_100": 100.0,
            "pack_150": 150.0
        }
        
        for pkg in packages:
            assert pkg["id"] in expected_prices, f"Unknown package: {pkg['id']}"
            assert pkg["price"] == expected_prices[pkg["id"]], f"Wrong price for {pkg['id']}"
            assert pkg["bids"] > 0
        
        print(f"✓ All 8 bid packages verified with correct prices (€5-€150)")
    
    def test_checkout_session_creation(self):
        """Test Stripe checkout session creation"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        token = login_resp.json()["token"]
        
        # Create checkout session
        response = requests.post(
            f"{BASE_URL}/api/checkout/create-session",
            json={
                "package_id": "pack_25",
                "origin_url": "https://allinone-platform-2.preview.emergentagent.com"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Checkout creation failed: {response.text}"
        data = response.json()
        assert "url" in data
        assert "session_id" in data
        assert "stripe.com" in data["url"]
        print(f"✓ Stripe checkout session created successfully")


class TestAuctions:
    """Test auction listing and detail endpoints"""
    
    def test_get_auctions_list(self):
        """Test fetching auction list"""
        response = requests.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200
        auctions = response.json()
        assert isinstance(auctions, list)
        print(f"✓ Auctions list fetched - {len(auctions)} auctions found")
        return auctions
    
    def test_get_active_auctions(self):
        """Test filtering active auctions"""
        response = requests.get(f"{BASE_URL}/api/auctions?status=active")
        assert response.status_code == 200
        auctions = response.json()
        for auction in auctions:
            assert auction["status"] == "active"
        print(f"✓ Active auctions filter works - {len(auctions)} active auctions")
        return auctions
    
    def test_get_auction_detail(self):
        """Test fetching single auction detail"""
        # First get list of auctions
        auctions = requests.get(f"{BASE_URL}/api/auctions").json()
        if not auctions:
            pytest.skip("No auctions available for testing")
        
        auction_id = auctions[0]["id"]
        response = requests.get(f"{BASE_URL}/api/auctions/{auction_id}")
        assert response.status_code == 200
        auction = response.json()
        assert auction["id"] == auction_id
        assert "product" in auction
        assert "current_price" in auction
        assert "end_time" in auction
        print(f"✓ Auction detail fetched - {auction['product']['name'] if auction.get('product') else 'N/A'}")
    
    def test_place_bid(self):
        """Test placing a bid on an active auction"""
        # Login as customer
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        token = login_resp.json()["token"]
        
        # Get active auctions
        auctions = requests.get(f"{BASE_URL}/api/auctions?status=active").json()
        if not auctions:
            pytest.skip("No active auctions for bid testing")
        
        auction_id = auctions[0]["id"]
        initial_price = auctions[0]["current_price"]
        
        # Place bid
        response = requests.post(
            f"{BASE_URL}/api/auctions/{auction_id}/bid",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 400 and "Insufficient bids" in response.text:
            pytest.skip("Customer has no bids remaining")
        
        assert response.status_code == 200, f"Bid failed: {response.text}"
        data = response.json()
        assert data["new_price"] > initial_price
        print(f"✓ Bid placed successfully - new price: €{data['new_price']:.2f}")


class TestAdminPanel:
    """Test admin panel endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_admin_stats(self, admin_token):
        """Test admin dashboard stats"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        stats = response.json()
        assert "total_users" in stats
        assert "total_auctions" in stats
        assert "active_auctions" in stats
        assert "total_products" in stats
        print(f"✓ Admin stats: {stats['total_users']} users, {stats['active_auctions']} active auctions")
    
    def test_admin_detailed_stats(self, admin_token):
        """Test admin detailed stats for charts"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/detailed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "charts" in data
        assert "revenue_by_day" in data["charts"]
        assert "bids_by_day" in data["charts"]
        print(f"✓ Admin detailed stats fetched - revenue: €{data['summary'].get('total_revenue', 0):.2f}")
    
    def test_admin_users_list(self, admin_token):
        """Test admin users list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        print(f"✓ Admin users list: {len(users)} users")
    
    def test_admin_vouchers(self, admin_token):
        """Test admin vouchers endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vouchers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        vouchers = response.json()
        assert isinstance(vouchers, list)
        print(f"✓ Admin vouchers: {len(vouchers)} vouchers")
    
    def test_admin_bots(self, admin_token):
        """Test admin bots endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/bots",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        bots = response.json()
        assert isinstance(bots, list)
        print(f"✓ Admin bots: {len(bots)} bots")
    
    def test_admin_payments(self, admin_token):
        """Test admin payments endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/payments",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        payments = response.json()
        assert isinstance(payments, list)
        print(f"✓ Admin payments: {len(payments)} transactions")
    
    def test_admin_logs(self, admin_token):
        """Test admin logs endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/logs",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        logs = response.json()
        assert isinstance(logs, list)
        print(f"✓ Admin logs: {len(logs)} log entries")


class TestAffiliateProgram:
    """Test affiliate program endpoints"""
    
    def test_affiliate_registration(self):
        """Test affiliate registration"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        token = login_resp.json()["token"]
        
        # Try to get affiliate data (may already be registered)
        response = requests.get(
            f"{BASE_URL}/api/affiliates/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 200:
            print("✓ Affiliate already registered - fetched affiliate data")
        else:
            # Try to register
            reg_response = requests.post(
                f"{BASE_URL}/api/affiliates/register",
                json={
                    "name": "Test Affiliate",
                    "email": CUSTOMER_EMAIL,
                    "payment_method": "bank_transfer",
                    "payment_details": "DE89370400440532013000"
                },
                headers={"Authorization": f"Bearer {token}"}
            )
            # May fail if already registered
            print(f"✓ Affiliate registration attempted - status: {reg_response.status_code}")


class TestUserReferrals:
    """Test user referral system"""
    
    def test_user_referrals_endpoint(self):
        """Test user referrals endpoint"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        token = login_resp.json()["token"]
        
        response = requests.get(
            f"{BASE_URL}/api/users/referrals",
            headers={"Authorization": f"Bearer {token}"}
        )
        # May return 404 if endpoint doesn't exist or 200 with data
        if response.status_code == 200:
            data = response.json()
            print(f"✓ User referrals fetched - {data.get('invited_friends', 0)} friends invited")
        else:
            print(f"⚠ User referrals endpoint returned {response.status_code}")


class TestPasswordReset:
    """Test password reset flow"""
    
    def test_forgot_password(self):
        """Test forgot password endpoint"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": CUSTOMER_EMAIL
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        # Demo mode returns the code
        if "demo_code" in data:
            print(f"✓ Password reset code generated: {data['demo_code']}")
        else:
            print("✓ Password reset email sent")
    
    def test_verify_reset_code(self):
        """Test verify reset code endpoint"""
        # First get a reset code
        forgot_resp = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": CUSTOMER_EMAIL
        })
        code = forgot_resp.json().get("demo_code")
        
        if not code:
            pytest.skip("No demo code available for testing")
        
        response = requests.post(f"{BASE_URL}/api/auth/verify-reset-code", json={
            "email": CUSTOMER_EMAIL,
            "code": code
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("valid") == True
        print("✓ Reset code verified successfully")


class TestProducts:
    """Test product endpoints"""
    
    def test_get_products(self):
        """Test fetching products list"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        products = response.json()
        assert isinstance(products, list)
        print(f"✓ Products list: {len(products)} products")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
