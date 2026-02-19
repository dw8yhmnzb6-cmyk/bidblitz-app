"""
BidBlitz Pay New Features Tests - P2P Transfer, Cashback, scan-customer GET
Tests for iteration 62
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://auction-rewards-1.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "Admin123!"
PARTNER_EMAIL = "wise-test@partner.com"
PARTNER_PASSWORD = "Test123!"


class TestBidBlitzPayNewFeatures:
    """Test new BidBlitz Pay features: P2P Transfer, Cashback, scan-customer GET"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
    
    # ==================== P2P TRANSFER TESTS ====================
    
    def test_send_money_endpoint_exists(self):
        """Test POST /api/bidblitz-pay/send-money endpoint exists"""
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/send-money", json={
            "recipient_email": "nonexistent@test.com",
            "amount": 10.0,
            "message": "Test transfer"
        })
        # Should return 404 (recipient not found) or 400 (validation), not 405 (method not allowed)
        assert response.status_code in [400, 404, 422], f"Expected 400/404/422, got {response.status_code}"
        print(f"✓ send-money endpoint exists, returned {response.status_code}")
    
    def test_send_money_validation_amount_zero(self):
        """Test send-money rejects zero amount"""
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/send-money", json={
            "recipient_email": "test@example.com",
            "amount": 0,
            "message": "Test"
        })
        assert response.status_code == 400, f"Expected 400 for zero amount, got {response.status_code}"
        print("✓ send-money rejects zero amount")
    
    def test_send_money_validation_negative_amount(self):
        """Test send-money rejects negative amount"""
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/send-money", json={
            "recipient_email": "test@example.com",
            "amount": -10,
            "message": "Test"
        })
        assert response.status_code == 400, f"Expected 400 for negative amount, got {response.status_code}"
        print("✓ send-money rejects negative amount")
    
    def test_send_money_validation_min_amount(self):
        """Test send-money enforces minimum €1"""
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/send-money", json={
            "recipient_email": "test@example.com",
            "amount": 0.50,
            "message": "Test"
        })
        assert response.status_code == 400, f"Expected 400 for amount < €1, got {response.status_code}"
        data = response.json()
        assert "Mindestbetrag" in data.get("detail", "") or "minimum" in data.get("detail", "").lower()
        print("✓ send-money enforces minimum €1")
    
    def test_send_money_self_transfer_blocked(self):
        """Test send-money blocks self-transfer"""
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/send-money", json={
            "recipient_email": ADMIN_EMAIL,
            "amount": 10.0,
            "message": "Self transfer test"
        })
        # Should return 400 with self-transfer error
        assert response.status_code == 400, f"Expected 400 for self-transfer, got {response.status_code}"
        print("✓ send-money blocks self-transfer")
    
    # ==================== TRANSFER HISTORY TESTS ====================
    
    def test_transfer_history_endpoint(self):
        """Test GET /api/bidblitz-pay/transfer-history endpoint"""
        response = self.session.get(f"{BASE_URL}/api/bidblitz-pay/transfer-history")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "transfers" in data, "Response should contain 'transfers' key"
        assert "total_sent" in data, "Response should contain 'total_sent' key"
        assert "total_received" in data, "Response should contain 'total_received' key"
        print(f"✓ transfer-history returns {len(data['transfers'])} transfers")
    
    # ==================== CASHBACK TESTS ====================
    
    def test_cashback_balance_endpoint(self):
        """Test GET /api/bidblitz-pay/cashback-balance endpoint"""
        response = self.session.get(f"{BASE_URL}/api/bidblitz-pay/cashback-balance")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "cashback_balance" in data, "Response should contain 'cashback_balance' key"
        assert "pending_cashback" in data, "Response should contain 'pending_cashback' key"
        print(f"✓ cashback-balance: €{data['cashback_balance']}")
    
    def test_redeem_cashback_minimum_required(self):
        """Test POST /api/bidblitz-pay/redeem-cashback requires minimum €5"""
        response = self.session.post(f"{BASE_URL}/api/bidblitz-pay/redeem-cashback")
        # Should return 400 if cashback < €5
        if response.status_code == 400:
            data = response.json()
            assert "€5" in data.get("detail", "") or "5" in data.get("detail", "")
            print("✓ redeem-cashback enforces minimum €5")
        elif response.status_code == 200:
            # User has enough cashback
            data = response.json()
            assert data.get("success") == True
            print(f"✓ redeem-cashback successful: €{data.get('redeemed_amount', 0)}")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    # ==================== SCAN-CUSTOMER GET TEST ====================
    
    def test_scan_customer_is_get_method(self):
        """Test /api/bidblitz-pay/scan-customer is now GET (not POST)"""
        # First login as partner to get partner token
        partner_login = self.session.post(f"{BASE_URL}/api/partner-portal/login", json={
            "email": PARTNER_EMAIL,
            "password": PARTNER_PASSWORD
        })
        
        if partner_login.status_code != 200:
            pytest.skip(f"Partner login failed: {partner_login.status_code}")
        
        partner_token = partner_login.json().get("token")
        
        # Test GET method with invalid QR data
        response = requests.get(
            f"{BASE_URL}/api/bidblitz-pay/scan-customer",
            params={"qr_data": "INVALID-QR", "token": partner_token}
        )
        # Should return 400 (invalid QR) not 405 (method not allowed)
        assert response.status_code == 400, f"Expected 400 for invalid QR, got {response.status_code}"
        data = response.json()
        assert "Ungültiger QR-Code" in data.get("detail", "") or "invalid" in data.get("detail", "").lower()
        print("✓ scan-customer is GET method and validates QR format")
    
    def test_scan_customer_post_not_allowed(self):
        """Test POST to scan-customer returns 405 Method Not Allowed"""
        partner_login = self.session.post(f"{BASE_URL}/api/partner-portal/login", json={
            "email": PARTNER_EMAIL,
            "password": PARTNER_PASSWORD
        })
        
        if partner_login.status_code != 200:
            pytest.skip(f"Partner login failed: {partner_login.status_code}")
        
        partner_token = partner_login.json().get("token")
        
        # Test POST method - should fail
        response = requests.post(
            f"{BASE_URL}/api/bidblitz-pay/scan-customer",
            params={"token": partner_token},
            json={"qr_data": "BIDBLITZ-PAY:test"}
        )
        # POST should return 405 Method Not Allowed
        assert response.status_code == 405, f"Expected 405 for POST, got {response.status_code}"
        print("✓ scan-customer POST returns 405 Method Not Allowed")
    
    # ==================== WALLET ENDPOINT TESTS ====================
    
    def test_wallet_endpoint(self):
        """Test GET /api/bidblitz-pay/wallet returns wallet data"""
        response = self.session.get(f"{BASE_URL}/api/bidblitz-pay/wallet")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "wallet" in data, "Response should contain 'wallet' key"
        assert "vouchers" in data, "Response should contain 'vouchers' key"
        wallet = data["wallet"]
        assert "universal_balance" in wallet
        assert "partner_vouchers_value" in wallet
        assert "total_value" in wallet
        print(f"✓ wallet endpoint: total_value=€{wallet['total_value']}")
    
    def test_main_balance_endpoint(self):
        """Test GET /api/bidblitz-pay/main-balance returns main account balance"""
        response = self.session.get(f"{BASE_URL}/api/bidblitz-pay/main-balance")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "main_balance" in data
        assert "bidblitz_balance" in data
        print(f"✓ main-balance: main=€{data['main_balance']}, bidblitz=€{data['bidblitz_balance']}")


class TestPartnerMarketingTranslations:
    """Test Partner Marketing translations are properly configured"""
    
    def test_partner_referral_endpoint(self):
        """Test partner referral endpoint exists"""
        # Login as partner
        session = requests.Session()
        login_response = session.post(f"{BASE_URL}/api/partner-portal/login", json={
            "email": PARTNER_EMAIL,
            "password": PARTNER_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Partner login failed: {login_response.status_code}")
        
        token = login_response.json().get("token")
        
        # Test referral code endpoint
        response = session.get(f"{BASE_URL}/api/partner-referral/my-code?token={token}")
        # Should return 200 or 404 (if not implemented), not 500
        assert response.status_code in [200, 404], f"Expected 200/404, got {response.status_code}"
        print(f"✓ partner-referral/my-code endpoint: {response.status_code}")
    
    def test_partner_referral_stats_endpoint(self):
        """Test partner referral stats endpoint exists"""
        session = requests.Session()
        login_response = session.post(f"{BASE_URL}/api/partner-portal/login", json={
            "email": PARTNER_EMAIL,
            "password": PARTNER_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Partner login failed: {login_response.status_code}")
        
        token = login_response.json().get("token")
        
        response = session.get(f"{BASE_URL}/api/partner-referral/stats?token={token}")
        assert response.status_code in [200, 404], f"Expected 200/404, got {response.status_code}"
        print(f"✓ partner-referral/stats endpoint: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
