"""
Test Staff Login with Mitarbeiternummer (staff_number)
Tests the /api/partner-portal/staff/login endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestStaffLogin:
    """Test staff login with staff_number (Mitarbeiternummer)"""
    
    def test_staff_login_with_staff_number(self):
        """Test login with valid staff_number"""
        response = requests.post(
            f"{BASE_URL}/api/partner-portal/staff/login",
            json={
                "staff_number": "MA-EDEKA-001",
                "password": "EdekaTest2026!"
            }
        )
        
        # Should succeed
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "token" in data
        assert "staff" in data
        assert data["staff"]["staff_number"] == "MA-EDEKA-001"
        assert data["is_staff"] == True
        print(f"✓ Staff login successful: {data['staff']['name']}")
    
    def test_staff_login_with_uppercase_staff_number(self):
        """Test login with uppercase staff_number (should work)"""
        response = requests.post(
            f"{BASE_URL}/api/partner-portal/staff/login",
            json={
                "staff_number": "ma-edeka-001",  # lowercase
                "password": "EdekaTest2026!"
            }
        )
        
        # Should succeed (backend converts to uppercase)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print("✓ Staff login with lowercase staff_number works")
    
    def test_staff_login_invalid_password(self):
        """Test login with invalid password"""
        response = requests.post(
            f"{BASE_URL}/api/partner-portal/staff/login",
            json={
                "staff_number": "MA-EDEKA-001",
                "password": "WrongPassword123!"
            }
        )
        
        # Should fail with 401
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid password correctly rejected")
    
    def test_staff_login_invalid_staff_number(self):
        """Test login with non-existent staff_number"""
        response = requests.post(
            f"{BASE_URL}/api/partner-portal/staff/login",
            json={
                "staff_number": "MA-NONEXISTENT-999",
                "password": "EdekaTest2026!"
            }
        )
        
        # Should fail with 401
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Non-existent staff_number correctly rejected")
    
    def test_staff_login_response_structure(self):
        """Test that login response has correct structure"""
        response = requests.post(
            f"{BASE_URL}/api/partner-portal/staff/login",
            json={
                "staff_number": "MA-EDEKA-001",
                "password": "EdekaTest2026!"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "success" in data
        assert "token" in data
        assert "staff" in data
        assert "partner" in data
        assert "is_staff" in data
        assert "role" in data
        
        # Check staff object structure
        staff = data["staff"]
        assert "id" in staff
        assert "name" in staff
        assert "staff_number" in staff
        assert "role" in staff
        assert "partner_id" in staff
        
        # Check partner object structure
        partner = data["partner"]
        assert "id" in partner
        assert "business_type" in partner
        
        print("✓ Response structure is correct")


class TestEnterpriseLogin:
    """Test enterprise login (fallback for backwards compatibility)"""
    
    def test_enterprise_login(self):
        """Test enterprise login with email"""
        response = requests.post(
            f"{BASE_URL}/api/enterprise/login",
            json={
                "email": "admin@edeka-test.de",
                "password": "EdekaTest2026!"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "token" in data
        print(f"✓ Enterprise login successful: {data.get('company_name')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
