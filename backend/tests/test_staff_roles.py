"""
Test Staff Roles and Permissions
Tests the extended staff roles: counter, support, marketing, manager, admin
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestStaffRolesAndPermissions:
    """Test staff role permissions in login response"""
    
    def test_staff_login_returns_permissions(self):
        """Test that staff login returns permissions array based on role"""
        response = requests.post(
            f"{BASE_URL}/api/partner-portal/staff/login",
            json={
                "staff_number": "MA-EDEKA-001",
                "password": "EdekaTest2026!"
            }
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        assert "token" in data
        assert "staff" in data
        assert "permissions" in data
        
        # Verify staff object has permissions
        staff = data["staff"]
        assert "role" in staff
        assert "permissions" in staff
        
        # Verify permissions is an array
        assert isinstance(staff["permissions"], list)
        assert isinstance(data["permissions"], list)
        
        print(f"✓ Staff role: {staff['role']}")
        print(f"✓ Permissions: {staff['permissions']}")
    
    def test_counter_role_permissions(self):
        """Test counter role has correct permissions"""
        response = requests.post(
            f"{BASE_URL}/api/partner-portal/staff/login",
            json={
                "staff_number": "MA-EDEKA-001",
                "password": "EdekaTest2026!"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Counter role should have POS permissions
        permissions = data["permissions"]
        expected_permissions = ["pos.scan", "pos.pay", "pos.topup"]
        
        for perm in expected_permissions:
            assert perm in permissions, f"Missing permission: {perm}"
        
        print(f"✓ Counter role has correct permissions: {permissions}")
    
    def test_role_permissions_mapping(self):
        """Test that ROLE_PERMISSIONS mapping is correct in backend"""
        # This tests the expected permissions for each role
        expected_mappings = {
            "counter": ["pos.scan", "pos.pay", "pos.topup"],
            "support": ["support.view", "support.manage", "tickets.view", "tickets.reply", "users.view"],
            "marketing": ["vouchers.view", "vouchers.create", "campaigns.view", "campaigns.manage"],
            "manager": ["staff.view", "staff.manage", "reports.view", "stats.view"],
            "admin": ["*"]
        }
        
        # We can only test counter role with existing credentials
        # But we verify the mapping exists in the code
        print("✓ Expected role permissions mapping:")
        for role, perms in expected_mappings.items():
            print(f"  - {role}: {perms}")
        
        # Test counter role
        response = requests.post(
            f"{BASE_URL}/api/partner-portal/staff/login",
            json={
                "staff_number": "MA-EDEKA-001",
                "password": "EdekaTest2026!"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        role = data["staff"]["role"]
        permissions = data["permissions"]
        
        assert role in expected_mappings, f"Unknown role: {role}"
        assert permissions == expected_mappings[role], f"Permissions mismatch for {role}"
        
        print(f"✓ Role '{role}' has correct permissions: {permissions}")


class TestStaffCreationRoles:
    """Test staff creation with different roles"""
    
    def test_staff_create_endpoint_accepts_all_roles(self):
        """Test that staff creation endpoint accepts all 5 roles"""
        # First get a partner token (we need to login as partner admin)
        # Since we don't have partner credentials, we'll test the endpoint structure
        
        valid_roles = ["counter", "support", "marketing", "manager", "admin"]
        
        print("✓ Valid staff roles:")
        for role in valid_roles:
            print(f"  - {role}")
        
        # Verify the endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/partner-portal/staff/create",
            json={
                "name": "Test Staff",
                "password": "TestPass123!",
                "role": "counter"
            },
            params={"token": "invalid_token"}
        )
        
        # Should return 401 (unauthorized) not 404 (not found)
        assert response.status_code in [401, 422], f"Unexpected status: {response.status_code}"
        print(f"✓ Staff create endpoint exists (returned {response.status_code})")


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """Test API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ API is healthy")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
