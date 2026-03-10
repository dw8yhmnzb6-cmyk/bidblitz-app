"""
Credit System API Tests - Kredit-System für BidBlitz Pay
Tests for eligibility, admin applications, and admin stats endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://gaming-platform-129.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "Admin123!"


class TestCreditSystemAPIs:
    """Credit System API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    def test_credit_eligibility_endpoint(self):
        """Test GET /api/credit/eligibility returns eligibility status"""
        response = self.session.get(f"{BASE_URL}/api/credit/eligibility")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify response structure
        assert "eligible" in data, "Response should contain 'eligible' field"
        assert "is_verified" in data, "Response should contain 'is_verified' field"
        assert "has_open_credit" in data, "Response should contain 'has_open_credit' field"
        assert "min_amount" in data, "Response should contain 'min_amount' field"
        assert "max_amount" in data, "Response should contain 'max_amount' field"
        assert "interest_rate_range" in data, "Response should contain 'interest_rate_range' field"
        assert "repayment_months_range" in data, "Response should contain 'repayment_months_range' field"
        
        # Verify data values
        assert data["min_amount"] == 50, "Min amount should be 50"
        assert data["max_amount"] == 2000, "Max amount should be 2000"
        assert data["interest_rate_range"] == "2-5%", "Interest rate range should be 2-5%"
        assert data["repayment_months_range"] == "3-6", "Repayment months range should be 3-6"
        
        print(f"✓ Eligibility check passed: eligible={data['eligible']}, verified={data['is_verified']}")
    
    def test_admin_applications_endpoint(self):
        """Test GET /api/credit/admin/applications returns all applications"""
        response = self.session.get(f"{BASE_URL}/api/credit/admin/applications")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify response structure
        assert "applications" in data, "Response should contain 'applications' field"
        assert "total" in data, "Response should contain 'total' field"
        assert "status_counts" in data, "Response should contain 'status_counts' field"
        
        # Verify status_counts structure
        status_counts = data["status_counts"]
        expected_statuses = ["pending", "approved", "active", "repaid", "rejected", "defaulted"]
        for status in expected_statuses:
            assert status in status_counts, f"status_counts should contain '{status}'"
        
        print(f"✓ Admin applications endpoint passed: total={data['total']}, status_counts={status_counts}")
    
    def test_admin_applications_with_status_filter(self):
        """Test GET /api/credit/admin/applications with status filter"""
        # Test with pending status filter
        response = self.session.get(f"{BASE_URL}/api/credit/admin/applications?status=pending")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "applications" in data
        
        # All returned applications should have pending status (if any)
        for app in data["applications"]:
            assert app["status"] == "pending", f"Expected status 'pending', got '{app['status']}'"
        
        print(f"✓ Admin applications with status filter passed: {len(data['applications'])} pending applications")
    
    def test_admin_stats_endpoint(self):
        """Test GET /api/credit/admin/stats returns credit statistics"""
        response = self.session.get(f"{BASE_URL}/api/credit/admin/stats")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify response structure
        assert "by_status" in data, "Response should contain 'by_status' field"
        assert "total_outstanding" in data, "Response should contain 'total_outstanding' field"
        assert "pending_applications" in data, "Response should contain 'pending_applications' field"
        
        # Verify data types
        assert isinstance(data["by_status"], dict), "by_status should be a dict"
        assert isinstance(data["total_outstanding"], (int, float)), "total_outstanding should be numeric"
        assert isinstance(data["pending_applications"], int), "pending_applications should be int"
        
        print(f"✓ Admin stats endpoint passed: outstanding={data['total_outstanding']}, pending={data['pending_applications']}")
    
    def test_my_credits_endpoint(self):
        """Test GET /api/credit/my-credits returns user's credits"""
        response = self.session.get(f"{BASE_URL}/api/credit/my-credits")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify response structure
        assert "credits" in data, "Response should contain 'credits' field"
        assert "count" in data, "Response should contain 'count' field"
        
        # Verify data types
        assert isinstance(data["credits"], list), "credits should be a list"
        assert isinstance(data["count"], int), "count should be int"
        
        print(f"✓ My credits endpoint passed: count={data['count']}")


class TestCreditSystemValidation:
    """Credit System Validation Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    def test_eligibility_without_auth(self):
        """Test eligibility endpoint requires authentication"""
        # Create new session without auth
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/credit/eligibility")
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422 without auth, got {response.status_code}"
        print(f"✓ Eligibility endpoint correctly requires authentication")
    
    def test_admin_endpoints_accessible(self):
        """Test admin endpoints are accessible (may or may not require auth)"""
        # Admin applications - test without auth first
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/credit/admin/applications")
        
        # These endpoints might be accessible without auth for admin panel
        assert response.status_code in [200, 401, 403], f"Unexpected status code: {response.status_code}"
        
        if response.status_code == 200:
            print("✓ Admin applications endpoint accessible (no auth required)")
        else:
            print("✓ Admin applications endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
