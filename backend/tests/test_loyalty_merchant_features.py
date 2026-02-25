"""
Test Customer Loyalty & Merchant Features APIs
Tests for:
- Customer Loyalty: /api/customer-loyalty/status, /api/customer-loyalty/points/history, /api/customer-loyalty/referral
- Merchant Dashboard: /api/merchant/dashboard
- Merchant Products: /api/merchant/products
- Merchant Coupons: /api/merchant/coupons
- Public Merchant Finder: /api/merchant/public/find
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
CUSTOMER_EMAIL = "kunde@bidblitz.ae"
CUSTOMER_PASSWORD = "Kunde123!"
MERCHANT_EMAIL = "demo@grosshandel.de"
MERCHANT_PASSWORD = "Haendler123!"
MERCHANT_LOGIN_ENDPOINT = "/api/wholesale/auth/login"


class TestCustomerLoyaltyAPIs:
    """Customer Loyalty System API Tests - VIP Tiers, Points, Cashback, Referrals"""
    
    @pytest.fixture(scope="class")
    def customer_token(self):
        """Get customer authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("access_token")
        pytest.skip(f"Customer login failed: {response.status_code} - {response.text}")
    
    def test_loyalty_status_endpoint(self, customer_token):
        """Test GET /api/customer-loyalty/status - should return tier, points, cashback info"""
        response = requests.get(
            f"{BASE_URL}/api/customer-loyalty/status",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify required fields for loyalty status
        assert "tier" in data, "Response should contain 'tier'"
        assert "tier_name" in data, "Response should contain 'tier_name'"
        assert "points" in data, "Response should contain 'points'"
        assert "cashback_percent" in data, "Response should contain 'cashback_percent'"
        assert "benefits" in data, "Response should contain 'benefits'"
        assert "referral_code" in data, "Response should contain 'referral_code'"
        
        # Verify tier is valid
        valid_tiers = ["bronze", "silver", "gold", "platinum"]
        assert data["tier"] in valid_tiers, f"Tier should be one of {valid_tiers}, got {data['tier']}"
        
        # Verify data types
        assert isinstance(data["points"], (int, float)), "Points should be numeric"
        assert isinstance(data["cashback_percent"], (int, float)), "Cashback percent should be numeric"
        assert isinstance(data["benefits"], list), "Benefits should be a list"
        
        print(f"✓ Loyalty Status: Tier={data['tier']}, Points={data['points']}, Cashback={data['cashback_percent']}%")
    
    def test_loyalty_status_without_auth(self):
        """Test GET /api/customer-loyalty/status without authentication - should return 401"""
        response = requests.get(f"{BASE_URL}/api/customer-loyalty/status")
        
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Loyalty status correctly requires authentication")
    
    def test_points_history_endpoint(self, customer_token):
        """Test GET /api/customer-loyalty/points/history - should return points history"""
        response = requests.get(
            f"{BASE_URL}/api/customer-loyalty/points/history",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "history" in data, "Response should contain 'history'"
        assert isinstance(data["history"], list), "History should be a list"
        
        # If there are history entries, verify structure
        if data["history"]:
            entry = data["history"][0]
            assert "type" in entry or "points" in entry, "History entry should have type or points"
        
        print(f"✓ Points History: {len(data['history'])} entries found")
    
    def test_referral_info_endpoint(self, customer_token):
        """Test GET /api/customer-loyalty/referral - should return referral code and info"""
        response = requests.get(
            f"{BASE_URL}/api/customer-loyalty/referral",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify required referral fields
        assert "referral_code" in data, "Response should contain 'referral_code'"
        assert "referral_link" in data, "Response should contain 'referral_link'"
        assert "total_referrals" in data, "Response should contain 'total_referrals'"
        assert "bonus_per_referral" in data, "Response should contain 'bonus_per_referral'"
        
        # Verify referral code format
        assert data["referral_code"], "Referral code should not be empty"
        assert data["referral_code"].startswith("REF-"), f"Referral code should start with REF-, got {data['referral_code']}"
        
        print(f"✓ Referral Info: Code={data['referral_code']}, Total Referrals={data['total_referrals']}")
    
    def test_cashback_history_endpoint(self, customer_token):
        """Test GET /api/customer-loyalty/cashback/history - should return cashback history"""
        response = requests.get(
            f"{BASE_URL}/api/customer-loyalty/cashback/history",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "history" in data, "Response should contain 'history'"
        assert "total_earned" in data, "Response should contain 'total_earned'"
        
        print(f"✓ Cashback History: Total Earned=€{data['total_earned']}")
    
    def test_wallet_card_endpoint(self, customer_token):
        """Test GET /api/customer-loyalty/wallet-card - should return digital wallet card info"""
        response = requests.get(
            f"{BASE_URL}/api/customer-loyalty/wallet-card",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify wallet card fields
        assert "card_type" in data, "Response should contain 'card_type'"
        assert "customer_number" in data, "Response should contain 'customer_number'"
        assert "tier" in data, "Response should contain 'tier'"
        assert "barcode" in data, "Response should contain 'barcode'"
        
        print(f"✓ Wallet Card: Customer={data['customer_number']}, Tier={data['tier']}")


class TestMerchantAPIs:
    """Merchant Features API Tests - Dashboard, Products, Coupons"""
    
    @pytest.fixture(scope="class")
    def merchant_token(self):
        """Get merchant authentication token via wholesale login"""
        response = requests.post(
            f"{BASE_URL}{MERCHANT_LOGIN_ENDPOINT}",
            json={"email": MERCHANT_EMAIL, "password": MERCHANT_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("access_token")
        pytest.skip(f"Merchant login failed: {response.status_code} - {response.text}")
    
    def test_merchant_login(self):
        """Test merchant login via wholesale auth endpoint"""
        response = requests.post(
            f"{BASE_URL}{MERCHANT_LOGIN_ENDPOINT}",
            json={"email": MERCHANT_EMAIL, "password": MERCHANT_PASSWORD}
        )
        
        assert response.status_code == 200, f"Merchant login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "token" in data or "access_token" in data, "Response should contain token"
        
        print(f"✓ Merchant login successful")
    
    def test_merchant_dashboard(self, merchant_token):
        """Test GET /api/merchant/dashboard - should return merchant stats"""
        response = requests.get(
            f"{BASE_URL}/api/merchant/dashboard",
            headers={"Authorization": f"Bearer {merchant_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify dashboard fields
        assert "merchant_name" in data, "Response should contain 'merchant_name'"
        assert "today" in data, "Response should contain 'today' stats"
        assert "this_week" in data, "Response should contain 'this_week' stats"
        assert "this_month" in data, "Response should contain 'this_month' stats"
        
        # Verify stats structure
        if "today" in data:
            today_stats = data["today"]
            assert "total" in today_stats or "count" in today_stats, "Today stats should have total or count"
        
        print(f"✓ Merchant Dashboard: {data.get('merchant_name', 'Unknown')}")
    
    def test_merchant_dashboard_without_auth(self):
        """Test GET /api/merchant/dashboard without authentication - should return 401"""
        response = requests.get(f"{BASE_URL}/api/merchant/dashboard")
        
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Merchant dashboard correctly requires authentication")
    
    def test_merchant_products_list(self, merchant_token):
        """Test GET /api/merchant/products - should return merchant's products"""
        response = requests.get(
            f"{BASE_URL}/api/merchant/products",
            headers={"Authorization": f"Bearer {merchant_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "products" in data, "Response should contain 'products'"
        assert isinstance(data["products"], list), "Products should be a list"
        
        print(f"✓ Merchant Products: {len(data['products'])} products found")
    
    def test_merchant_create_product(self, merchant_token):
        """Test POST /api/merchant/products - should create a new product"""
        test_product = {
            "title": f"TEST_Product_{uuid.uuid4().hex[:8]}",
            "description": "Test product for API testing",
            "category": "Electronics",
            "start_price": 10.0,
            "market_value": 50.0,
            "auction_duration_hours": 24
        }
        
        response = requests.post(
            f"{BASE_URL}/api/merchant/products",
            headers={"Authorization": f"Bearer {merchant_token}"},
            json=test_product
        )
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data or "product_id" in data, "Response should indicate success or return product_id"
        
        if "product_id" in data:
            print(f"✓ Product Created: ID={data['product_id']}")
        else:
            print(f"✓ Product Creation Response: {data}")
    
    def test_merchant_coupons_list(self, merchant_token):
        """Test GET /api/merchant/coupons - should return merchant's coupons"""
        response = requests.get(
            f"{BASE_URL}/api/merchant/coupons",
            headers={"Authorization": f"Bearer {merchant_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "coupons" in data, "Response should contain 'coupons'"
        assert isinstance(data["coupons"], list), "Coupons should be a list"
        
        print(f"✓ Merchant Coupons: {len(data['coupons'])} coupons found")
    
    def test_merchant_create_coupon(self, merchant_token):
        """Test POST /api/merchant/coupons - should create a new coupon"""
        test_coupon = {
            "code": f"TEST{uuid.uuid4().hex[:6].upper()}",
            "discount_percent": 10.0,
            "min_purchase": 20.0,
            "max_uses": 50,
            "valid_days": 30,
            "description": "Test coupon for API testing"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/merchant/coupons",
            headers={"Authorization": f"Bearer {merchant_token}"},
            json=test_coupon
        )
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data or "coupon_id" in data, "Response should indicate success or return coupon_id"
        
        if "code" in data:
            print(f"✓ Coupon Created: Code={data['code']}")
        else:
            print(f"✓ Coupon Creation Response: {data}")
    
    def test_merchant_profile(self, merchant_token):
        """Test GET /api/merchant/profile - should return merchant profile"""
        response = requests.get(
            f"{BASE_URL}/api/merchant/profile",
            headers={"Authorization": f"Bearer {merchant_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Profile should have basic merchant info
        assert data is not None, "Profile should not be empty"
        
        print(f"✓ Merchant Profile retrieved")
    
    def test_merchant_commissions(self, merchant_token):
        """Test GET /api/merchant/commissions - should return commission info"""
        response = requests.get(
            f"{BASE_URL}/api/merchant/commissions",
            headers={"Authorization": f"Bearer {merchant_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "commissions" in data, "Response should contain 'commissions'"
        assert "total_earned" in data, "Response should contain 'total_earned'"
        
        print(f"✓ Merchant Commissions: Total Earned=€{data['total_earned']}")
    
    def test_merchant_staff_list(self, merchant_token):
        """Test GET /api/merchant/staff - should return staff list"""
        response = requests.get(
            f"{BASE_URL}/api/merchant/staff",
            headers={"Authorization": f"Bearer {merchant_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "staff" in data, "Response should contain 'staff'"
        assert isinstance(data["staff"], list), "Staff should be a list"
        
        print(f"✓ Merchant Staff: {len(data['staff'])} staff members")


class TestPublicMerchantAPIs:
    """Public Merchant APIs - No authentication required"""
    
    def test_public_merchant_finder(self):
        """Test GET /api/merchant/public/find - should return list of merchants"""
        response = requests.get(f"{BASE_URL}/api/merchant/public/find")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "merchants" in data, "Response should contain 'merchants'"
        assert isinstance(data["merchants"], list), "Merchants should be a list"
        
        print(f"✓ Public Merchant Finder: {len(data['merchants'])} merchants found")
    
    def test_public_merchant_finder_with_city(self):
        """Test GET /api/merchant/public/find with city filter"""
        response = requests.get(
            f"{BASE_URL}/api/merchant/public/find",
            params={"city": "Berlin"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "merchants" in data, "Response should contain 'merchants'"
        
        print(f"✓ Public Merchant Finder (Berlin): {len(data['merchants'])} merchants found")
    
    def test_public_merchant_finder_with_coordinates(self):
        """Test GET /api/merchant/public/find with lat/lon coordinates"""
        response = requests.get(
            f"{BASE_URL}/api/merchant/public/find",
            params={"lat": 52.52, "lon": 13.405}  # Berlin coordinates
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "merchants" in data, "Response should contain 'merchants'"
        
        print(f"✓ Public Merchant Finder (Coordinates): {len(data['merchants'])} merchants found")


class TestVIPTierSystem:
    """Test VIP Tier definitions and calculations"""
    
    @pytest.fixture(scope="class")
    def customer_token(self):
        """Get customer authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("access_token")
        pytest.skip(f"Customer login failed: {response.status_code}")
    
    def test_all_tiers_info_in_status(self, customer_token):
        """Test that all VIP tiers info is returned in status"""
        response = requests.get(
            f"{BASE_URL}/api/customer-loyalty/status",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Check if all_tiers is present
        if "all_tiers" in data:
            all_tiers = data["all_tiers"]
            expected_tiers = ["bronze", "silver", "gold", "platinum"]
            
            for tier in expected_tiers:
                assert tier in all_tiers, f"Tier '{tier}' should be in all_tiers"
                tier_info = all_tiers[tier]
                assert "name" in tier_info, f"Tier {tier} should have 'name'"
                assert "cashback_percent" in tier_info, f"Tier {tier} should have 'cashback_percent'"
                assert "benefits" in tier_info, f"Tier {tier} should have 'benefits'"
            
            print(f"✓ All VIP Tiers present: {list(all_tiers.keys())}")
        else:
            print("⚠ all_tiers not in response (may be optional)")
    
    def test_next_tier_progression(self, customer_token):
        """Test that next tier info is provided for progression"""
        response = requests.get(
            f"{BASE_URL}/api/customer-loyalty/status",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        current_tier = data.get("tier")
        
        # If not platinum, should have next tier info
        if current_tier != "platinum":
            assert "next_tier" in data, "Should have next_tier for non-platinum users"
            assert "amount_to_next_tier" in data, "Should have amount_to_next_tier"
            print(f"✓ Tier Progression: Current={current_tier}, Next={data.get('next_tier')}, Amount needed=€{data.get('amount_to_next_tier')}")
        else:
            print(f"✓ User is at Platinum tier (highest)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
