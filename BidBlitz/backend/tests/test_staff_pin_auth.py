"""
Test Staff PIN Authentication - Iteration 161
Tests for:
1. POST /api/staff/auth/terminal-pin - PIN login with identifier
2. GET /api/staff/auth/me - Session verification after PIN login
3. Normal .ae admin/merchant login regression
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestStaffPinAuth:
    """Staff PIN Authentication Tests"""
    
    def test_staff_pin_login_with_identifier(self):
        """Test staff PIN login with email identifier"""
        session = requests.Session()
        
        # Test PIN login with identifier
        response = session.post(
            f"{BASE_URL}/api/staff/auth/terminal-pin",
            json={
                "identifier": "mitarbeiter@bidblitz.ae",
                "pin": "1234"
            },
            headers={"Content-Type": "application/json"}
        )
        
        print(f"PIN Login Response Status: {response.status_code}")
        print(f"PIN Login Response: {response.text[:500]}")
        
        # Should return 200 with member info
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        assert "member" in data, f"Expected 'member' in response, got {data}"
        
        member = data["member"]
        assert "id" in member, f"Expected 'id' in member, got {member}"
        assert "name" in member, f"Expected 'name' in member, got {member}"
        
        print(f"Staff member logged in: {member.get('name')} (ID: {member.get('id')})")
        
        # Verify session cookie was set
        cookies = session.cookies.get_dict()
        print(f"Cookies after PIN login: {list(cookies.keys())}")
        assert "staff_session" in cookies, f"Expected 'staff_session' cookie, got {list(cookies.keys())}"
        
        return session
    
    def test_staff_auth_me_after_pin_login(self):
        """Test GET /api/staff/auth/me after PIN login"""
        session = requests.Session()
        
        # First login with PIN
        login_response = session.post(
            f"{BASE_URL}/api/staff/auth/terminal-pin",
            json={
                "identifier": "mitarbeiter@bidblitz.ae",
                "pin": "1234"
            },
            headers={"Content-Type": "application/json"}
        )
        
        assert login_response.status_code == 200, f"PIN login failed: {login_response.text}"
        
        # Now test /api/staff/auth/me
        me_response = session.get(
            f"{BASE_URL}/api/staff/auth/me",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Staff /me Response Status: {me_response.status_code}")
        print(f"Staff /me Response: {me_response.text[:500]}")
        
        assert me_response.status_code == 200, f"Expected 200, got {me_response.status_code}: {me_response.text}"
        
        data = me_response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        assert "staff" in data, f"Expected 'staff' in response, got {data}"
        
        staff = data["staff"]
        assert "id" in staff, f"Expected 'id' in staff, got {staff}"
        assert "name" in staff, f"Expected 'name' in staff, got {staff}"
        
        print(f"Staff /me verified: {staff.get('name')} (ID: {staff.get('id')})")
    
    def test_staff_pin_login_demo_fallback(self):
        """Test staff PIN login with demo PIN 1234 (fallback)"""
        session = requests.Session()
        
        # Test PIN login without identifier (demo mode)
        response = session.post(
            f"{BASE_URL}/api/staff/auth/terminal-pin",
            json={
                "pin": "1234"
            },
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Demo PIN Login Response Status: {response.status_code}")
        print(f"Demo PIN Login Response: {response.text[:500]}")
        
        # Should return 200 with member info (demo fallback)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        assert "member" in data, f"Expected 'member' in response, got {data}"
    
    def test_staff_pin_invalid_pin(self):
        """Test staff PIN login with invalid PIN"""
        session = requests.Session()
        
        response = session.post(
            f"{BASE_URL}/api/staff/auth/terminal-pin",
            json={
                "identifier": "mitarbeiter@bidblitz.ae",
                "pin": "9999"
            },
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Invalid PIN Response Status: {response.status_code}")
        print(f"Invalid PIN Response: {response.text[:300]}")
        
        # Should return 404 (PIN not found)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
    
    def test_staff_pin_short_pin(self):
        """Test staff PIN login with too short PIN"""
        session = requests.Session()
        
        response = session.post(
            f"{BASE_URL}/api/staff/auth/terminal-pin",
            json={
                "pin": "12"
            },
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Short PIN Response Status: {response.status_code}")
        
        # Should return 400 (PIN must be at least 4 digits)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"


class TestMerchantLoginRegression:
    """Regression tests for normal .ae admin/merchant login"""
    
    def test_merchant_login_ae_domain(self):
        """Test merchant login with .ae domain"""
        session = requests.Session()
        
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "haendler@bidblitz.ae",
                "password": "Haendler2026!"
            },
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Merchant Login Response Status: {response.status_code}")
        print(f"Merchant Login Response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "email" in data, f"Expected 'email' in response, got {data}"
        
        print(f"Merchant logged in: {data.get('email')}")
    
    def test_admin_login_ae_domain(self):
        """Test admin login with .ae domain"""
        session = requests.Session()
        
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "admin@bidblitz.ae",
                "password": "BidBlitz2026!"
            },
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Admin Login Response Status: {response.status_code}")
        print(f"Admin Login Response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "email" in data, f"Expected 'email' in response, got {data}"
        assert data.get("role") == "admin", f"Expected role='admin', got {data.get('role')}"
        
        print(f"Admin logged in: {data.get('email')} (role: {data.get('role')})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
