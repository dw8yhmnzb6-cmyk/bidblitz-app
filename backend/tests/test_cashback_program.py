"""
Test Cashback Program API
Tests for:
- /api/cashback/info - Public endpoint for program details
- /api/cashback/balance - Authenticated endpoint for user balance
- /api/cashback/history - Authenticated endpoint for transaction history
- /api/cashback/active-promotions - Public endpoint for active promotions
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCashbackPublicEndpoints:
    """Test public cashback endpoints (no auth required)"""
    
    def test_cashback_info_returns_program_details(self):
        """Test /api/cashback/info returns correct program configuration"""
        response = requests.get(f"{BASE_URL}/api/cashback/info")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify program details
        assert data["program_name"] == "BidBlitz Cashback"
        assert data["base_rate"] == 1  # 1%
        assert data["base_rate_display"] == "1%"
        assert data["expiry_months"] == 6
        assert data["min_redemption"] == 0  # Sofort einlösbar
        assert data["instant_redemption"] == True
        
        # Verify description
        assert "1% Cashback" in data["description"]
        assert "6 Monate" in data["description"]
        
        # Verify features list
        assert "features" in data
        assert len(data["features"]) >= 4
        assert any("1% Cashback" in f for f in data["features"])
        assert any("Sofort einlösbar" in f for f in data["features"])
        assert any("6 Monate" in f for f in data["features"])
    
    def test_active_promotions_returns_list(self):
        """Test /api/cashback/active-promotions returns promotions list"""
        response = requests.get(f"{BASE_URL}/api/cashback/active-promotions")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "promotions" in data
        assert "total" in data
        assert isinstance(data["promotions"], list)
        assert isinstance(data["total"], int)


class TestCashbackAuthenticatedEndpoints:
    """Test authenticated cashback endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@bidblitz.ae", "password": "Admin123!"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_cashback_balance_requires_auth(self):
        """Test /api/cashback/balance returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/cashback/balance")
        
        assert response.status_code == 401
    
    def test_cashback_balance_returns_user_balance(self, auth_token):
        """Test /api/cashback/balance returns balance for authenticated user"""
        response = requests.get(
            f"{BASE_URL}/api/cashback/balance",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify balance structure - may have different field names
        # Check for either available_balance or balance field
        has_balance_field = "available_balance" in data or "balance" in data
        assert has_balance_field, f"Expected balance field in response: {data}"
    
    def test_cashback_history_requires_auth(self):
        """Test /api/cashback/history returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/cashback/history")
        
        assert response.status_code == 401
    
    def test_cashback_history_returns_transactions(self, auth_token):
        """Test /api/cashback/history returns transaction list"""
        response = requests.get(
            f"{BASE_URL}/api/cashback/history",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "transactions" in data
        assert isinstance(data["transactions"], list)
    
    def test_cashback_redeem_requires_auth(self):
        """Test /api/cashback/redeem returns 401 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/cashback/redeem",
            json={"amount": 1.0}
        )
        
        assert response.status_code == 401
    
    def test_cashback_redeem_validates_amount(self, auth_token):
        """Test /api/cashback/redeem validates amount > available balance"""
        response = requests.post(
            f"{BASE_URL}/api/cashback/redeem",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json={"amount": 999999.99}  # Amount higher than any balance
        )
        
        # Should return 400 for insufficient balance
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
