"""
Test suite for Wholesale API and Translation features
Tests:
1. Wholesale approval without user account
2. Maintenance mode toggle
3. Translation keys verification
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWholesaleAPI:
    """Test wholesale API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        # Login as admin to get token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.de",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_get_wholesale_applications(self):
        """Test getting wholesale applications list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/wholesale/applications",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Found {len(data)} wholesale applications")
    
    def test_get_wholesale_customers(self):
        """Test getting wholesale customers list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/wholesale/customers",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Found {len(data)} wholesale customers")
        
        # Check if any customer has user_id = null (approved without user account)
        customers_without_user = [c for c in data if c.get("user_id") is None]
        print(f"✓ Found {len(customers_without_user)} customers without user account")
    
    def test_wholesale_apply_and_approve_without_user(self):
        """Test wholesale application and approval without existing user account"""
        import time
        unique_email = f"test_wholesale_{int(time.time())}@example.com"
        
        # Step 1: Create wholesale application
        apply_response = requests.post(f"{BASE_URL}/api/wholesale/apply", json={
            "company_name": "TEST_WholesaleNoUser GmbH",
            "contact_name": "Test Contact",
            "email": unique_email,
            "phone": "+49 123 456789",
            "expected_volume": "500-1000",
            "message": "Testing wholesale approval without user account"
        })
        assert apply_response.status_code == 200
        apply_data = apply_response.json()
        assert apply_data.get("success") == True
        application_id = apply_data.get("application_id")
        print(f"✓ Created wholesale application: {application_id}")
        
        # Step 2: Approve the application (without user account)
        approve_response = requests.post(
            f"{BASE_URL}/api/admin/wholesale/approve/{application_id}",
            headers=self.headers,
            json={
                "discount_percent": 15,
                "credit_limit": 1000,
                "payment_terms": "net30",
                "notes": "Test approval without user account"
            }
        )
        assert approve_response.status_code == 200
        approve_data = approve_response.json()
        assert approve_data.get("success") == True
        assert approve_data.get("user_linked") == False, "Expected user_linked to be False"
        assert "Benutzerkonto wird bei Registrierung verknüpft" in approve_data.get("message", "")
        print(f"✓ Approved wholesale without user account: {approve_data.get('wholesale_id')}")
        
        # Step 3: Verify customer was created with null user_id
        customers_response = requests.get(
            f"{BASE_URL}/api/admin/wholesale/customers",
            headers=self.headers
        )
        customers = customers_response.json()
        new_customer = next((c for c in customers if c.get("email") == unique_email), None)
        assert new_customer is not None, "New customer not found"
        assert new_customer.get("user_id") is None, "Expected user_id to be None"
        print(f"✓ Verified customer has null user_id")


class TestMaintenanceAPI:
    """Test maintenance mode API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.de",
            "password": "Admin123!"
        })
        assert response.status_code == 200
        self.admin_token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_maintenance_status_public(self):
        """Test public maintenance status endpoint"""
        response = requests.get(f"{BASE_URL}/api/maintenance/status")
        assert response.status_code == 200
        data = response.json()
        assert "enabled" in data
        assert "message" in data
        print(f"✓ Maintenance status: enabled={data.get('enabled')}")
    
    def test_maintenance_toggle_enable(self):
        """Test enabling maintenance mode"""
        response = requests.post(
            f"{BASE_URL}/api/maintenance/toggle",
            headers=self.headers,
            params={
                "enabled": True,
                "message": "Test maintenance mode",
                "estimated_minutes": 30
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("enabled") == True
        print(f"✓ Maintenance mode enabled")
        
        # Verify status
        status_response = requests.get(f"{BASE_URL}/api/maintenance/status")
        status_data = status_response.json()
        assert status_data.get("enabled") == True
        print(f"✓ Verified maintenance mode is enabled")
    
    def test_maintenance_toggle_disable(self):
        """Test disabling maintenance mode"""
        response = requests.post(
            f"{BASE_URL}/api/maintenance/toggle",
            headers=self.headers,
            params={"enabled": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("enabled") == False
        print(f"✓ Maintenance mode disabled")
        
        # Verify status
        status_response = requests.get(f"{BASE_URL}/api/maintenance/status")
        status_data = status_response.json()
        assert status_data.get("enabled") == False
        print(f"✓ Verified maintenance mode is disabled")


class TestTranslations:
    """Test translation keys exist in frontend"""
    
    def test_translation_keys_in_file(self):
        """Verify translation keys exist in translations.js"""
        import subprocess
        
        # Check for uvp key in all languages
        result = subprocess.run(
            ["grep", "-c", "uvp:", "/app/frontend/src/i18n/translations.js"],
            capture_output=True, text=True
        )
        uvp_count = int(result.stdout.strip())
        assert uvp_count >= 20, f"Expected at least 20 uvp translations, found {uvp_count}"
        print(f"✓ Found {uvp_count} uvp translations")
        
        # Check for lastSoldFor key
        result = subprocess.run(
            ["grep", "-c", "lastSoldFor:", "/app/frontend/src/i18n/translations.js"],
            capture_output=True, text=True
        )
        last_sold_count = int(result.stdout.strip())
        assert last_sold_count >= 10, f"Expected at least 10 lastSoldFor translations, found {last_sold_count}"
        print(f"✓ Found {last_sold_count} lastSoldFor translations")
        
        # Check for activity key
        result = subprocess.run(
            ["grep", "-c", "activity:", "/app/frontend/src/i18n/translations.js"],
            capture_output=True, text=True
        )
        activity_count = int(result.stdout.strip())
        assert activity_count >= 10, f"Expected at least 10 activity translations, found {activity_count}"
        print(f"✓ Found {activity_count} activity translations")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
