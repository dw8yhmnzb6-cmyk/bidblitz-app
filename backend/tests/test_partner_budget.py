"""
Partner Budget System API Tests
Tests for voucher budget, earnings, and payout settings
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PARTNER_EMAIL = "wise-test@partner.com"
PARTNER_PASSWORD = "Test123!"


class TestPartnerBudgetAPIs:
    """Partner Budget System API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        response = requests.post(
            f"{BASE_URL}/api/partner-portal/login",
            json={"email": PARTNER_EMAIL, "password": PARTNER_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("token")
        self.partner = data.get("partner")
        assert self.token, "No token received"
        assert self.partner, "No partner data received"
    
    def test_partner_login_success(self):
        """Test partner login returns correct data"""
        response = requests.post(
            f"{BASE_URL}/api/partner-portal/login",
            json={"email": PARTNER_EMAIL, "password": PARTNER_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "token" in data
        assert "partner" in data
        assert data["partner"]["email"] == PARTNER_EMAIL
        assert "id" in data["partner"]
        assert "name" in data["partner"]
    
    def test_get_my_budget(self):
        """Test GET /api/partner-budget/my-budget returns budget data"""
        response = requests.get(
            f"{BASE_URL}/api/partner-budget/my-budget",
            params={"token": self.token}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify voucher_budget structure
        assert "voucher_budget" in data
        voucher_budget = data["voucher_budget"]
        assert "total_available" in voucher_budget
        assert "freibetrag_remaining" in voucher_budget
        assert "paid_credit" in voucher_budget
        assert "freibetrag_total" in voucher_budget
        assert "freibetrag_used" in voucher_budget
        
        # Verify earnings structure
        assert "earnings" in data
        earnings = data["earnings"]
        assert "available_for_payout" in earnings
        assert "total_earnings" in earnings
        assert "total_paid_out" in earnings
        
        # Verify payout_settings structure
        assert "payout_settings" in data
        payout_settings = data["payout_settings"]
        assert "frequency" in payout_settings
        assert "min_amount" in payout_settings
        
        # Verify can_create_vouchers flag
        assert "can_create_vouchers" in data
        assert isinstance(data["can_create_vouchers"], bool)
    
    def test_get_my_budget_freibetrag_value(self):
        """Test that Freibetrag is €500.00 as expected"""
        response = requests.get(
            f"{BASE_URL}/api/partner-budget/my-budget",
            params={"token": self.token}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify Freibetrag is €500.00
        assert data["voucher_budget"]["freibetrag_total"] == 500.0
        assert data["voucher_budget"]["total_available"] >= 500.0
    
    def test_get_wise_payment_details(self):
        """Test GET /api/partner-budget/wise-payment-details generates payment info"""
        amount = 100.0
        response = requests.get(
            f"{BASE_URL}/api/partner-budget/wise-payment-details",
            params={"token": self.token, "amount": amount}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify payment_details structure
        assert "payment_details" in data
        payment_details = data["payment_details"]
        assert "account_holder" in payment_details
        assert "iban" in payment_details
        assert "bic" in payment_details
        assert "bank_name" in payment_details
        assert "amount" in payment_details
        assert "currency" in payment_details
        assert "reference" in payment_details
        
        # Verify values
        assert payment_details["account_holder"] == "BidBlitz GmbH"
        assert payment_details["amount"] == amount
        assert payment_details["currency"] == "EUR"
        assert payment_details["reference"].startswith("BIDBLITZ-")
        
        # Verify instructions
        assert "instructions" in data
        assert "de" in data["instructions"]
        assert "en" in data["instructions"]
        
        # Verify request_id
        assert "request_id" in data
    
    def test_get_wise_payment_details_different_amounts(self):
        """Test payment details generation with different amounts"""
        amounts = [50.0, 100.0, 250.0, 500.0, 1000.0]
        
        for amount in amounts:
            response = requests.get(
                f"{BASE_URL}/api/partner-budget/wise-payment-details",
                params={"token": self.token, "amount": amount}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["payment_details"]["amount"] == amount
    
    def test_get_payment_history(self):
        """Test GET /api/partner-budget/my-payment-history returns history"""
        response = requests.get(
            f"{BASE_URL}/api/partner-budget/my-payment-history",
            params={"token": self.token}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "payments_to_bidblitz" in data
        assert "payouts_from_bidblitz" in data
        assert isinstance(data["payments_to_bidblitz"], list)
        assert isinstance(data["payouts_from_bidblitz"], list)
    
    def test_update_payout_settings(self):
        """Test POST /api/partner-budget/update-payout-settings"""
        settings = {
            "payout_frequency": "weekly",
            "min_payout_amount": 50.0,
            "wise_email": "test@wise.com",
            "bank_iban": "DE89370400440532013000",
            "bank_holder_name": "Test Partner"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/partner-budget/update-payout-settings",
            params={"token": self.token},
            json=settings
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
        # Verify settings were saved by fetching budget again
        budget_response = requests.get(
            f"{BASE_URL}/api/partner-budget/my-budget",
            params={"token": self.token}
        )
        assert budget_response.status_code == 200
        budget_data = budget_response.json()
        
        assert budget_data["payout_settings"]["frequency"] == "weekly"
        assert budget_data["payout_settings"]["min_amount"] == 50.0
    
    def test_update_payout_settings_different_frequencies(self):
        """Test payout settings with different frequencies"""
        frequencies = ["daily", "weekly", "monthly", "manual"]
        
        for freq in frequencies:
            settings = {
                "payout_frequency": freq,
                "min_payout_amount": 50.0
            }
            
            response = requests.post(
                f"{BASE_URL}/api/partner-budget/update-payout-settings",
                params={"token": self.token},
                json=settings
            )
            assert response.status_code == 200
            
            # Verify
            budget_response = requests.get(
                f"{BASE_URL}/api/partner-budget/my-budget",
                params={"token": self.token}
            )
            assert budget_response.json()["payout_settings"]["frequency"] == freq
    
    def test_request_payout_insufficient_balance(self):
        """Test payout request with insufficient balance"""
        # First check current balance
        budget_response = requests.get(
            f"{BASE_URL}/api/partner-budget/my-budget",
            params={"token": self.token}
        )
        budget_data = budget_response.json()
        available = budget_data["earnings"]["available_for_payout"]
        min_amount = budget_data["payout_settings"]["min_amount"]
        
        if available < min_amount:
            # Should fail with insufficient balance
            response = requests.post(
                f"{BASE_URL}/api/partner-budget/request-payout",
                params={"token": self.token}
            )
            assert response.status_code == 400
            assert "Mindestbetrag" in response.json().get("detail", "")
    
    def test_unauthorized_access(self):
        """Test API returns 401 for invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/partner-budget/my-budget",
            params={"token": "invalid_token_12345"}
        )
        assert response.status_code == 401
    
    def test_can_create_vouchers_flag(self):
        """Test can_create_vouchers flag is True when budget available"""
        response = requests.get(
            f"{BASE_URL}/api/partner-budget/my-budget",
            params={"token": self.token}
        )
        assert response.status_code == 200
        data = response.json()
        
        total_available = data["voucher_budget"]["total_available"]
        can_create = data["can_create_vouchers"]
        
        # If budget > 0, should be able to create vouchers
        if total_available > 0:
            assert can_create == True
        else:
            assert can_create == False


class TestPartnerDashboard:
    """Partner Dashboard API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        response = requests.post(
            f"{BASE_URL}/api/partner-portal/login",
            json={"email": PARTNER_EMAIL, "password": PARTNER_PASSWORD}
        )
        assert response.status_code == 200
        self.token = response.json().get("token")
    
    def test_get_dashboard(self):
        """Test GET /api/partner-portal/dashboard returns dashboard data"""
        response = requests.get(
            f"{BASE_URL}/api/partner-portal/dashboard",
            params={"token": self.token}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify dashboard structure
        assert "stats" in data
        assert "vouchers" in data
        assert "recent_redemptions" in data
    
    def test_get_statistics(self):
        """Test GET /api/partner-portal/statistics returns statistics"""
        response = requests.get(
            f"{BASE_URL}/api/partner-portal/statistics",
            params={"token": self.token}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify statistics structure
        assert isinstance(data, dict)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
