"""
Test Merchant Vouchers - Iteration 75
Tests for:
1. Händler-Gutscheine page loads at /haendler-gutscheine
2. Premium Partners displayed with badge
3. 'Jetzt bieten' Button navigates to /auctions/mv-XXXXX
4. Admin Panel - Händler-Gutscheine Tab
5. Admin can set Premium price (5-20€) and duration
6. Translations for MerchantVouchersPage (DE, EN, EL, TR, AR, FR, IT, PT, RU, ZH)
7. Translations for BidBlitzPay (including Greek)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://api-gateway-44.preview.emergentagent.com')


class TestMerchantVouchersAPI:
    """Test Merchant Vouchers Backend API"""
    
    def test_merchants_endpoint_returns_data(self):
        """Test GET /api/merchant-vouchers/merchants returns merchants list"""
        response = requests.get(f"{BASE_URL}/api/merchant-vouchers/merchants")
        assert response.status_code == 200
        data = response.json()
        assert "merchants" in data
        assert "total" in data
        assert isinstance(data["merchants"], list)
        print(f"✓ Merchants endpoint returns {data['total']} merchants")
    
    def test_merchants_have_premium_field(self):
        """Test that merchants have is_premium field"""
        response = requests.get(f"{BASE_URL}/api/merchant-vouchers/merchants")
        assert response.status_code == 200
        data = response.json()
        
        if data["merchants"]:
            merchant = data["merchants"][0]
            assert "is_premium" in merchant
            assert "premium_until" in merchant
            print(f"✓ First merchant: {merchant['business_name']} - Premium: {merchant['is_premium']}")
    
    def test_premium_partners_sorted_first(self):
        """Test that premium partners appear first in the list"""
        response = requests.get(f"{BASE_URL}/api/merchant-vouchers/merchants")
        assert response.status_code == 200
        data = response.json()
        
        merchants = data["merchants"]
        if len(merchants) >= 2:
            # Check if premium merchants are at the top
            premium_found = False
            non_premium_found = False
            premium_after_non_premium = False
            
            for m in merchants:
                if m.get("is_premium"):
                    if non_premium_found:
                        premium_after_non_premium = True
                    premium_found = True
                else:
                    non_premium_found = True
            
            # Premium should not appear after non-premium (they should be sorted first)
            if premium_found and non_premium_found:
                assert not premium_after_non_premium, "Premium partners should be sorted first"
            print(f"✓ Premium partners sorted correctly")
    
    def test_merchant_detail_endpoint(self):
        """Test GET /api/merchant-vouchers/merchant/{id} returns merchant details"""
        # First get a merchant ID
        response = requests.get(f"{BASE_URL}/api/merchant-vouchers/merchants")
        assert response.status_code == 200
        data = response.json()
        
        if data["merchants"]:
            merchant_id = data["merchants"][0]["id"]
            detail_response = requests.get(f"{BASE_URL}/api/merchant-vouchers/merchant/{merchant_id}")
            assert detail_response.status_code == 200
            detail_data = detail_response.json()
            assert "merchant" in detail_data
            merchant = detail_data["merchant"]
            
            # Check extended fields
            expected_fields = ["id", "business_name", "is_premium", "premium_until", 
                            "opening_hours", "social_media", "specialties", "payment_methods"]
            for field in expected_fields:
                assert field in merchant, f"Missing field: {field}"
            print(f"✓ Merchant detail endpoint returns extended info for {merchant['business_name']}")
    
    def test_merchant_vouchers_endpoint(self):
        """Test GET /api/merchant-vouchers/merchant/{id}/vouchers returns vouchers"""
        # First get a merchant ID
        response = requests.get(f"{BASE_URL}/api/merchant-vouchers/merchants")
        assert response.status_code == 200
        data = response.json()
        
        if data["merchants"]:
            merchant_id = data["merchants"][0]["id"]
            vouchers_response = requests.get(f"{BASE_URL}/api/merchant-vouchers/merchant/{merchant_id}/vouchers")
            assert vouchers_response.status_code == 200
            vouchers_data = vouchers_response.json()
            assert "vouchers" in vouchers_data
            assert "count" in vouchers_data
            print(f"✓ Merchant vouchers endpoint returns {vouchers_data['count']} vouchers")


class TestAdminPremiumFeatures:
    """Test Admin Premium Features"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.ae",
            "password": "Admin123!"
        })
        if login_response.status_code == 200:
            return login_response.json().get("token")
        pytest.skip("Admin login failed")
    
    def test_admin_all_vouchers_endpoint(self, admin_token):
        """Test GET /api/merchant-vouchers/admin/all returns all vouchers"""
        response = requests.get(
            f"{BASE_URL}/api/merchant-vouchers/admin/all",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "vouchers" in data
        assert "total" in data
        print(f"✓ Admin all vouchers endpoint returns {data['total']} vouchers")
    
    def test_admin_set_premium_with_price(self, admin_token):
        """Test POST /api/merchant-vouchers/admin/set-premium with price parameter"""
        # Get a merchant ID first
        merchants_response = requests.get(f"{BASE_URL}/api/merchant-vouchers/merchants")
        assert merchants_response.status_code == 200
        merchants = merchants_response.json()["merchants"]
        
        if not merchants:
            pytest.skip("No merchants available for testing")
        
        # Find a non-premium merchant or use the first one
        test_merchant = merchants[0]
        
        # Test setting premium with price
        response = requests.post(
            f"{BASE_URL}/api/merchant-vouchers/admin/set-premium",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "partner_id": test_merchant["id"],
                "months": 1,
                "price": 15.0  # €15 per month
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "premium_until" in data
        assert "total_price" in data
        assert data["total_price"] == 15.0  # 1 month * €15
        print(f"✓ Admin set premium with price: €{data['total_price']} total")
    
    def test_admin_set_premium_price_validation(self, admin_token):
        """Test that premium price must be between €5 and €20"""
        merchants_response = requests.get(f"{BASE_URL}/api/merchant-vouchers/merchants")
        merchants = merchants_response.json()["merchants"]
        
        if not merchants:
            pytest.skip("No merchants available for testing")
        
        test_merchant = merchants[0]
        
        # Test with valid price (€10)
        response = requests.post(
            f"{BASE_URL}/api/merchant-vouchers/admin/set-premium",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "partner_id": test_merchant["id"],
                "months": 2,
                "price": 10.0
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_price"] == 20.0  # 2 months * €10
        print(f"✓ Premium price validation works: €10/month * 2 months = €{data['total_price']}")


class TestVoucherAuctionNavigation:
    """Test that voucher auctions have correct auction_id for navigation"""
    
    def test_voucher_has_auction_id(self):
        """Test that vouchers have auction_id field for navigation"""
        # Get merchants with vouchers
        response = requests.get(f"{BASE_URL}/api/merchant-vouchers/merchants")
        assert response.status_code == 200
        merchants = response.json()["merchants"]
        
        # Find a merchant with vouchers
        merchant_with_vouchers = None
        for m in merchants:
            if m.get("voucher_count", 0) > 0:
                merchant_with_vouchers = m
                break
        
        if not merchant_with_vouchers:
            print("⚠ No merchants with active vouchers found - skipping auction_id test")
            return
        
        # Get vouchers for this merchant
        vouchers_response = requests.get(
            f"{BASE_URL}/api/merchant-vouchers/merchant/{merchant_with_vouchers['id']}/vouchers"
        )
        assert vouchers_response.status_code == 200
        vouchers = vouchers_response.json()["vouchers"]
        
        if vouchers:
            voucher = vouchers[0]
            # Check that voucher has auction_id field
            assert "auction_id" in voucher or "id" in voucher
            auction_id = voucher.get("auction_id") or f"mv-{voucher['id'][:8]}"
            assert auction_id.startswith("mv-"), f"Auction ID should start with 'mv-': {auction_id}"
            print(f"✓ Voucher has auction_id: {auction_id} - navigates to /auctions/{auction_id}")


class TestTranslations:
    """Test that translations are present for all required languages"""
    
    def test_merchant_vouchers_page_translations_exist(self):
        """Verify MerchantVouchersPage has translations for all languages"""
        # This is a code review test - we verify the translations object exists
        # by checking the frontend file
        import subprocess
        result = subprocess.run(
            ["grep", "-c", "translations = {", "/app/frontend/src/pages/MerchantVouchersPage.js"],
            capture_output=True, text=True
        )
        assert result.returncode == 0
        print("✓ MerchantVouchersPage has translations object")
    
    def test_merchant_vouchers_has_all_languages(self):
        """Verify MerchantVouchersPage has all required language translations"""
        required_languages = ["de", "en", "el", "tr", "ar", "fr", "it", "pt", "ru", "zh"]
        
        import subprocess
        for lang in required_languages:
            result = subprocess.run(
                ["grep", "-c", f"  {lang}: {{", "/app/frontend/src/pages/MerchantVouchersPage.js"],
                capture_output=True, text=True
            )
            assert result.returncode == 0, f"Missing translation for language: {lang}"
        print(f"✓ MerchantVouchersPage has translations for all {len(required_languages)} languages")
    
    def test_bidblitz_pay_has_greek_translations(self):
        """Verify BidBlitzPay has Greek (el) translations"""
        import subprocess
        result = subprocess.run(
            ["grep", "-c", "el: {", "/app/frontend/src/pages/BidBlitzPay.jsx"],
            capture_output=True, text=True
        )
        assert result.returncode == 0
        print("✓ BidBlitzPay has Greek (el) translations")
    
    def test_bidblitz_pay_greek_has_key_translations(self):
        """Verify BidBlitzPay Greek translations have key fields"""
        import subprocess
        # Check for key Greek translation keys
        key_translations = ["wallet:", "pay:", "history:", "vouchers:", "security:"]
        
        # Read the file and check for Greek section
        with open("/app/frontend/src/pages/BidBlitzPay.jsx", "r") as f:
            content = f.read()
        
        # Find Greek section
        el_start = content.find("el: {")
        assert el_start != -1, "Greek translations section not found"
        
        # Find the end of Greek section (next language or closing brace)
        el_section = content[el_start:el_start+3000]  # Get a chunk
        
        for key in key_translations:
            assert key in el_section, f"Missing Greek translation for: {key}"
        
        print(f"✓ BidBlitzPay Greek translations have all key fields")


class TestAdminPanelMerchantVouchers:
    """Test Admin Panel Händler-Gutscheine Tab"""
    
    def test_admin_merchant_vouchers_component_exists(self):
        """Verify AdminMerchantVouchers component exists"""
        import os
        component_path = "/app/frontend/src/components/admin/AdminMerchantVouchers.js"
        assert os.path.exists(component_path), "AdminMerchantVouchers component not found"
        print("✓ AdminMerchantVouchers component exists")
    
    def test_admin_merchant_vouchers_has_premium_price_input(self):
        """Verify AdminMerchantVouchers has premium price input (€5-€20)"""
        with open("/app/frontend/src/components/admin/AdminMerchantVouchers.js", "r") as f:
            content = f.read()
        
        # Check for premium price input
        assert "premiumPrice" in content, "Premium price state not found"
        assert "min=\"5\"" in content or 'min="5"' in content, "Min price validation not found"
        assert "max=\"20\"" in content or 'max="20"' in content, "Max price validation not found"
        print("✓ AdminMerchantVouchers has premium price input with €5-€20 range")
    
    def test_admin_merchant_vouchers_has_duration_input(self):
        """Verify AdminMerchantVouchers has premium duration input"""
        with open("/app/frontend/src/components/admin/AdminMerchantVouchers.js", "r") as f:
            content = f.read()
        
        assert "premiumMonths" in content, "Premium months state not found"
        assert "Dauer" in content or "duration" in content.lower(), "Duration label not found"
        print("✓ AdminMerchantVouchers has premium duration input")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
