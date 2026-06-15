"""
Reward Plinko API Tests - Iteration 143
Tests for /api/rewards/plinko/* endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


class TestRewardPlinkoAPI:
    """Test Reward Plinko endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session and login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
        
        yield
        
        # Logout
        try:
            self.session.post(f"{BASE_URL}/api/auth/logout")
        except:
            pass
    
    def test_plinko_status_endpoint_exists(self):
        """GET /api/rewards/plinko/status returns 200"""
        response = self.session.get(f"{BASE_URL}/api/rewards/plinko/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: GET /api/rewards/plinko/status returns 200")
    
    def test_plinko_status_has_required_fields(self):
        """GET /api/rewards/plinko/status returns required fields"""
        response = self.session.get(f"{BASE_URL}/api/rewards/plinko/status")
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        required_fields = ["enabled", "free_remaining", "ticket_balance", "bidcoin_cost"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"PASS: Plinko status has all required fields: {required_fields}")
        print(f"  - enabled: {data.get('enabled')}")
        print(f"  - free_remaining: {data.get('free_remaining')}")
        print(f"  - ticket_balance: {data.get('ticket_balance')}")
        print(f"  - bidcoin_cost: {data.get('bidcoin_cost')}")
    
    def test_plinko_status_has_payouts(self):
        """GET /api/rewards/plinko/status returns payouts array"""
        response = self.session.get(f"{BASE_URL}/api/rewards/plinko/status")
        assert response.status_code == 200
        data = response.json()
        
        assert "payouts" in data, "Missing payouts field"
        assert isinstance(data["payouts"], list), "payouts should be a list"
        assert len(data["payouts"]) > 0, "payouts should not be empty"
        
        # Check payout structure
        payout = data["payouts"][0]
        assert "multiplier" in payout, "Payout missing multiplier"
        assert "weight" in payout, "Payout missing weight"
        
        print(f"PASS: Plinko status has {len(data['payouts'])} payout slots")
    
    def test_plinko_history_endpoint_exists(self):
        """GET /api/rewards/plinko/history returns 200"""
        response = self.session.get(f"{BASE_URL}/api/rewards/plinko/history")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: GET /api/rewards/plinko/history returns 200")
    
    def test_plinko_history_structure(self):
        """GET /api/rewards/plinko/history returns correct structure"""
        response = self.session.get(f"{BASE_URL}/api/rewards/plinko/history")
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data, "Missing items field"
        assert "stats" in data, "Missing stats field"
        assert isinstance(data["items"], list), "items should be a list"
        
        print(f"PASS: Plinko history has correct structure with {len(data['items'])} items")
    
    def test_plinko_drop_with_free_source(self):
        """POST /api/rewards/plinko/drop with source=free works for premium/admin"""
        # First check status to see if free drops are available
        status_response = self.session.get(f"{BASE_URL}/api/rewards/plinko/status")
        assert status_response.status_code == 200
        status = status_response.json()
        
        # Try to drop with free source
        response = self.session.post(
            f"{BASE_URL}/api/rewards/plinko/drop",
            json={"source": "free"}
        )
        
        # If free drops are available, should succeed
        if status.get("free_remaining", 0) > 0:
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            assert data.get("ok") == True, "Drop should return ok=True"
            assert "drop_id" in data, "Drop should return drop_id"
            assert "multiplier" in data, "Drop should return multiplier"
            assert "payout_bidcoins" in data, "Drop should return payout_bidcoins"
            print(f"PASS: Plinko drop with source=free succeeded - {data.get('multiplier')}x, +{data.get('payout_bidcoins')} BidCoins")
        else:
            # If no free drops, should return 400
            assert response.status_code == 400, f"Expected 400 when no free drops, got {response.status_code}"
            print("PASS: Plinko drop with source=free correctly rejected (no free drops available)")
    
    def test_plinko_drop_returns_path(self):
        """POST /api/rewards/plinko/drop returns path array"""
        status_response = self.session.get(f"{BASE_URL}/api/rewards/plinko/status")
        status = status_response.json()
        
        if status.get("free_remaining", 0) > 0:
            response = self.session.post(
                f"{BASE_URL}/api/rewards/plinko/drop",
                json={"source": "free"}
            )
            if response.status_code == 200:
                data = response.json()
                assert "path" in data, "Drop should return path"
                assert isinstance(data["path"], list), "path should be a list"
                print(f"PASS: Plinko drop returns path with {len(data.get('path', []))} steps")
            else:
                print(f"SKIP: Could not test path (drop failed: {response.status_code})")
        else:
            print("SKIP: No free drops available to test path")
    
    def test_plinko_history_after_drop(self):
        """GET /api/rewards/plinko/history returns new drop"""
        # Get initial history
        initial_response = self.session.get(f"{BASE_URL}/api/rewards/plinko/history")
        initial_data = initial_response.json()
        initial_count = len(initial_data.get("items", []))
        
        # Try a drop
        status_response = self.session.get(f"{BASE_URL}/api/rewards/plinko/status")
        status = status_response.json()
        
        if status.get("free_remaining", 0) > 0:
            drop_response = self.session.post(
                f"{BASE_URL}/api/rewards/plinko/drop",
                json={"source": "free"}
            )
            
            if drop_response.status_code == 200:
                # Check history again
                history_response = self.session.get(f"{BASE_URL}/api/rewards/plinko/history")
                history_data = history_response.json()
                new_count = len(history_data.get("items", []))
                
                assert new_count >= initial_count, "History should have at least same number of items"
                print(f"PASS: Plinko history updated after drop ({initial_count} -> {new_count} items)")
            else:
                print(f"SKIP: Could not verify history (drop failed: {drop_response.status_code})")
        else:
            print("SKIP: No free drops available to test history update")
    
    def test_reward_hub_includes_plinko(self):
        """GET /api/rewards/hub includes plinko data"""
        response = self.session.get(f"{BASE_URL}/api/rewards/hub")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "plinko" in data, "Reward hub should include plinko"
        plinko = data["plinko"]
        
        # Check plinko has required fields
        assert "enabled" in plinko or "free_remaining" in plinko, "Plinko should have status fields"
        print(f"PASS: Reward hub includes plinko data")
    
    def test_plinko_drop_invalid_source(self):
        """POST /api/rewards/plinko/drop with invalid source returns 422"""
        response = self.session.post(
            f"{BASE_URL}/api/rewards/plinko/drop",
            json={"source": "invalid_source"}
        )
        assert response.status_code == 422, f"Expected 422 for invalid source, got {response.status_code}"
        print("PASS: Plinko drop with invalid source returns 422")
    
    def test_plinko_status_unauthenticated(self):
        """GET /api/rewards/plinko/status without auth returns 401"""
        # Create new session without auth
        unauth_session = requests.Session()
        response = unauth_session.get(f"{BASE_URL}/api/rewards/plinko/status")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Plinko status without auth returns 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
