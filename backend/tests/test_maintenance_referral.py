"""
Test Maintenance Mode and Referral Features
Tests for newly implemented features:
1. Maintenance Mode API endpoints
2. Referral link visibility (frontend test)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMaintenanceAPI:
    """Test Maintenance Mode API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@bidblitz.de"
        self.admin_password = "Admin123!"
        self.token = None
        
    def get_admin_token(self):
        """Get admin authentication token"""
        if self.token:
            return self.token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        if response.status_code == 200:
            self.token = response.json().get("token")
            return self.token
        return None
    
    def test_maintenance_status_public(self):
        """Test public maintenance status endpoint"""
        response = requests.get(f"{BASE_URL}/api/maintenance/status")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions
        data = response.json()
        assert "enabled" in data, "Response should contain 'enabled' field"
        assert "message" in data, "Response should contain 'message' field"
        assert "estimated_end" in data, "Response should contain 'estimated_end' field"
        assert isinstance(data["enabled"], bool), "'enabled' should be boolean"
        print(f"✓ Maintenance status: enabled={data['enabled']}")
    
    def test_maintenance_admin_status_requires_auth(self):
        """Test that admin status endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/maintenance/admin/status")
        
        # Should return 401 without auth
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Admin status endpoint requires authentication")
    
    def test_maintenance_admin_status_with_auth(self):
        """Test admin maintenance status with authentication"""
        token = self.get_admin_token()
        assert token is not None, "Failed to get admin token"
        
        response = requests.get(
            f"{BASE_URL}/api/maintenance/admin/status",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions
        data = response.json()
        assert "enabled" in data, "Response should contain 'enabled' field"
        assert "message" in data, "Response should contain 'message' field"
        assert "estimated_end" in data, "Response should contain 'estimated_end' field"
        assert "updated_by" in data, "Response should contain 'updated_by' field"
        assert "updated_at" in data, "Response should contain 'updated_at' field"
        print(f"✓ Admin maintenance status: enabled={data['enabled']}, updated_by={data.get('updated_by')}")
    
    def test_maintenance_toggle_requires_auth(self):
        """Test that toggle endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/maintenance/toggle")
        
        # Should return 401 without auth
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Toggle endpoint requires authentication")
    
    def test_maintenance_toggle_enable(self):
        """Test enabling maintenance mode"""
        token = self.get_admin_token()
        assert token is not None, "Failed to get admin token"
        
        # Enable maintenance
        response = requests.post(
            f"{BASE_URL}/api/maintenance/toggle",
            params={
                "enabled": True,
                "message": "Test maintenance message",
                "estimated_minutes": 30
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert data.get("enabled") == True, "Maintenance should be enabled"
        assert data.get("message") == "Test maintenance message", "Message should match"
        assert data.get("estimated_end") is not None, "Estimated end should be set"
        print(f"✓ Maintenance enabled: {data}")
        
        # Verify via public endpoint
        status_response = requests.get(f"{BASE_URL}/api/maintenance/status")
        status_data = status_response.json()
        assert status_data.get("enabled") == True, "Public status should show enabled"
        print("✓ Public status confirms maintenance is enabled")
    
    def test_maintenance_toggle_disable(self):
        """Test disabling maintenance mode"""
        token = self.get_admin_token()
        assert token is not None, "Failed to get admin token"
        
        # Disable maintenance
        response = requests.post(
            f"{BASE_URL}/api/maintenance/toggle",
            params={"enabled": False},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert data.get("enabled") == False, "Maintenance should be disabled"
        print(f"✓ Maintenance disabled: {data}")
        
        # Verify via public endpoint
        status_response = requests.get(f"{BASE_URL}/api/maintenance/status")
        status_data = status_response.json()
        assert status_data.get("enabled") == False, "Public status should show disabled"
        print("✓ Public status confirms maintenance is disabled")


class TestReferralAPI:
    """Test Referral API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@bidblitz.de"
        self.admin_password = "Admin123!"
        self.token = None
        
    def get_admin_token(self):
        """Get admin authentication token"""
        if self.token:
            return self.token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        if response.status_code == 200:
            self.token = response.json().get("token")
            return self.token
        return None
    
    def test_referral_stats_requires_auth(self):
        """Test that referral stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/referrals/stats")
        
        # Should return 401 without auth
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Referral stats endpoint requires authentication")
    
    def test_referral_stats_with_auth(self):
        """Test referral stats with authentication"""
        token = self.get_admin_token()
        assert token is not None, "Failed to get admin token"
        
        response = requests.get(
            f"{BASE_URL}/api/referrals/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions - check actual response structure
        data = response.json()
        # Response has: code, pending_referrals, successful_referrals, total_earned, total_referrals
        assert "total_referrals" in data, "Response should contain 'total_referrals'"
        assert "successful_referrals" in data, "Response should contain 'successful_referrals'"
        assert "total_earned" in data, "Response should contain 'total_earned'"
        print(f"✓ Referral stats: code={data.get('code')}, total={data.get('total_referrals')}, earned={data.get('total_earned')}")


class TestInfluencerAPI:
    """Test Influencer API endpoints (verify still working)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@bidblitz.de"
        self.admin_password = "Admin123!"
        self.token = None
        
    def get_admin_token(self):
        """Get admin authentication token"""
        if self.token:
            return self.token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        if response.status_code == 200:
            self.token = response.json().get("token")
            return self.token
        return None
    
    def test_influencer_list_requires_auth(self):
        """Test that influencer list requires authentication"""
        response = requests.get(f"{BASE_URL}/api/influencer/admin/list")
        
        # Should return 401 without auth
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Influencer list endpoint requires authentication")
    
    def test_influencer_list_with_auth(self):
        """Test influencer list with authentication"""
        token = self.get_admin_token()
        assert token is not None, "Failed to get admin token"
        
        response = requests.get(
            f"{BASE_URL}/api/influencer/admin/list",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Influencer list: {len(data)} influencers found")
        
        # Check structure of first influencer if exists
        if len(data) > 0:
            influencer = data[0]
            assert "name" in influencer, "Influencer should have 'name'"
            assert "code" in influencer, "Influencer should have 'code'"
            assert "is_active" in influencer, "Influencer should have 'is_active'"
            print(f"  First influencer: {influencer.get('name')} ({influencer.get('code')})")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
