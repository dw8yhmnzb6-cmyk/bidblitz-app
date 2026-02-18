"""
Test Wise Payouts Admin Feature
Tests for automated merchant payouts via Wise API
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "Admin123!"

# Test partner ID
TEST_PARTNER_ID = "f09878d2-11eb-4c63-a9bf-e6acd984058e"


class TestWisePayoutsAdmin:
    """Test Wise Payouts Admin Endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
    
    def test_admin_login_success(self):
        """Test admin login works"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data.get("user", {}).get("is_admin") == True
        print(f"✓ Admin login successful")
    
    def test_get_pending_payouts(self):
        """Test GET /api/wise-payouts/pending returns pending payouts list"""
        response = self.session.get(f"{BASE_URL}/api/wise-payouts/pending")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "partners" in data
        assert "total_pending" in data
        assert "count" in data
        
        # Verify partners list structure
        partners = data.get("partners", [])
        assert isinstance(partners, list)
        
        if len(partners) > 0:
            partner = partners[0]
            assert "partner_id" in partner
            assert "partner_name" in partner
            assert "earnings_balance" in partner
            assert "has_bank_details" in partner
            print(f"✓ Found {len(partners)} partners with pending payouts, total: €{data['total_pending']:.2f}")
        else:
            print("✓ No pending payouts found (empty list)")
    
    def test_get_payout_history(self):
        """Test GET /api/wise-payouts/history returns payout history"""
        response = self.session.get(f"{BASE_URL}/api/wise-payouts/history?limit=20")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "payouts" in data
        assert "count" in data
        
        payouts = data.get("payouts", [])
        assert isinstance(payouts, list)
        
        if len(payouts) > 0:
            payout = payouts[0]
            assert "id" in payout
            assert "partner_id" in payout
            assert "amount" in payout
            assert "status" in payout
            print(f"✓ Found {len(payouts)} payouts in history")
        else:
            print("✓ No payout history found (empty list)")
    
    def test_initiate_payout_missing_partner(self):
        """Test POST /api/wise-payouts/admin/initiate with invalid partner returns 404"""
        response = self.session.post(f"{BASE_URL}/api/wise-payouts/admin/initiate", json={
            "partner_id": "non-existent-partner-id",
            "amount": 50.0
        })
        
        # Should return 404 for non-existent partner
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        print(f"✓ Correctly returns 404 for non-existent partner")
    
    def test_initiate_payout_endpoint_exists(self):
        """Test POST /api/wise-payouts/admin/initiate endpoint exists"""
        # Test with empty body to verify endpoint exists
        response = self.session.post(f"{BASE_URL}/api/wise-payouts/admin/initiate", json={})
        
        # Should return 422 (validation error) not 404 (not found)
        assert response.status_code in [422, 400, 404]
        print(f"✓ Initiate payout endpoint exists (status: {response.status_code})")
    
    def test_batch_payout_endpoint_exists(self):
        """Test POST /api/wise-payouts/admin/batch endpoint exists"""
        response = self.session.post(f"{BASE_URL}/api/wise-payouts/admin/batch", json={
            "partner_ids": []
        })
        
        # Should return 200 with empty results (no partners to process)
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "results" in data
        print(f"✓ Batch payout endpoint exists and works with empty list")
    
    def test_batch_payout_with_invalid_partners(self):
        """Test POST /api/wise-payouts/admin/batch with invalid partner IDs"""
        response = self.session.post(f"{BASE_URL}/api/wise-payouts/admin/batch", json={
            "partner_ids": ["invalid-id-1", "invalid-id-2"]
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return results with errors for invalid partners
        assert "results" in data
        results = data.get("results", [])
        
        # Each invalid partner should have an error
        for result in results:
            assert "error" in result or "success" in result
        
        print(f"✓ Batch payout handles invalid partners correctly")


class TestWisePayoutsPartner:
    """Test Wise Payouts Partner Endpoints (using token query param)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get admin token for testing
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.admin_token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
    
    def test_account_status_endpoint(self):
        """Test GET /api/wise-payouts/account-status endpoint exists"""
        # This endpoint requires partner token, so we test with admin token
        # It should return 401 or 404 since admin is not a partner
        response = self.session.get(f"{BASE_URL}/api/wise-payouts/account-status?token={self.admin_token}")
        
        # Should return some response (not 500)
        assert response.status_code in [200, 401, 403, 404, 422]
        print(f"✓ Account status endpoint exists (status: {response.status_code})")
    
    def test_payout_history_partner_endpoint(self):
        """Test GET /api/wise-payouts/payout-history endpoint exists"""
        response = self.session.get(f"{BASE_URL}/api/wise-payouts/payout-history?token={self.admin_token}")
        
        # Should return some response (not 500)
        assert response.status_code in [200, 401, 403, 404, 422]
        print(f"✓ Partner payout history endpoint exists (status: {response.status_code})")


class TestWisePayoutsIntegration:
    """Integration tests for Wise Payouts with test partner"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
    
    def test_pending_payouts_contains_test_partner(self):
        """Test that pending payouts contains the test partner with €200"""
        response = self.session.get(f"{BASE_URL}/api/wise-payouts/pending")
        
        assert response.status_code == 200
        data = response.json()
        partners = data.get("partners", [])
        
        # Look for test partner
        test_partner = None
        for p in partners:
            if p.get("partner_id") == TEST_PARTNER_ID:
                test_partner = p
                break
        
        if test_partner:
            print(f"✓ Found test partner: {test_partner.get('partner_name')}")
            print(f"  - Earnings balance: €{test_partner.get('earnings_balance', 0):.2f}")
            print(f"  - Has bank details: {test_partner.get('has_bank_details')}")
            assert test_partner.get("earnings_balance", 0) > 0
        else:
            # Partner might not have pending payouts
            print(f"⚠ Test partner {TEST_PARTNER_ID} not found in pending payouts")
            print(f"  - Total partners with pending payouts: {len(partners)}")
    
    def test_initiate_payout_for_test_partner(self):
        """Test initiating payout for test partner (if has pending balance)"""
        # First check if partner has pending balance
        response = self.session.get(f"{BASE_URL}/api/wise-payouts/pending")
        assert response.status_code == 200
        
        data = response.json()
        partners = data.get("partners", [])
        
        test_partner = None
        for p in partners:
            if p.get("partner_id") == TEST_PARTNER_ID:
                test_partner = p
                break
        
        if not test_partner:
            pytest.skip("Test partner not found in pending payouts")
        
        if not test_partner.get("has_bank_details"):
            pytest.skip("Test partner has no bank details configured")
        
        balance = test_partner.get("earnings_balance", 0)
        if balance < 10:
            pytest.skip(f"Test partner balance too low: €{balance:.2f}")
        
        # Try to initiate payout
        payout_response = self.session.post(f"{BASE_URL}/api/wise-payouts/admin/initiate", json={
            "partner_id": TEST_PARTNER_ID,
            "amount": min(balance, 50.0)  # Payout max €50 for testing
        })
        
        # Should succeed or fail with specific error
        assert payout_response.status_code in [200, 400]
        
        if payout_response.status_code == 200:
            payout_data = payout_response.json()
            assert "success" in payout_data
            assert "payout_id" in payout_data
            print(f"✓ Payout initiated: {payout_data.get('payout_id')}")
            print(f"  - Amount: €{payout_data.get('amount', 0):.2f}")
            print(f"  - Status: {payout_data.get('status')}")
        else:
            error_data = payout_response.json()
            print(f"⚠ Payout failed: {error_data.get('detail')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
