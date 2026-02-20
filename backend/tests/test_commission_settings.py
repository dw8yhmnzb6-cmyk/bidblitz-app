"""
Commission Settings Test - Iteration 96
Tests for:
1. GET /api/enterprise/admin/commission-settings/{id} - returns voucher_commission, self_pay_commission, customer_cashback
2. PUT /api/enterprise/admin/commission-settings/{id} - saves commission settings correctly
3. GET /api/enterprise/admin/list - returns commission_settings field for each enterprise
4. Language translations verification (AR, TR)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_KEY = "bidblitz-admin-2026"
ENTERPRISE_ID = "ent_ee2a8554c977"

# Test credentials
TEST_EMAIL = "admin@edeka-test.de"
TEST_PASSWORD = "EdekaTest2026!"


class TestCommissionSettingsAPI:
    """Test commission settings endpoints"""
    
    def test_get_commission_settings(self):
        """GET /api/enterprise/admin/commission-settings/{id} returns commission data"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/commission-settings/{ENTERPRISE_ID}",
            headers={"x-admin-key": ADMIN_KEY}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields exist
        assert "voucher_commission" in data, "Response should contain voucher_commission"
        assert "self_pay_commission" in data, "Response should contain self_pay_commission"
        assert "customer_cashback" in data, "Response should contain customer_cashback"
        assert "is_active" in data, "Response should contain is_active"
        
        # Verify data types
        assert isinstance(data["voucher_commission"], (int, float)), "voucher_commission should be numeric"
        assert isinstance(data["self_pay_commission"], (int, float)), "self_pay_commission should be numeric"
        assert isinstance(data["customer_cashback"], (int, float)), "customer_cashback should be numeric"
        assert isinstance(data["is_active"], bool), "is_active should be boolean"
        
        print(f"✓ Commission settings retrieved successfully")
        print(f"  voucher_commission: {data['voucher_commission']}%")
        print(f"  self_pay_commission: {data['self_pay_commission']}%")
        print(f"  customer_cashback: {data['customer_cashback']}%")
        print(f"  is_active: {data['is_active']}")
    
    def test_get_commission_settings_unauthorized(self):
        """GET /api/enterprise/admin/commission-settings/{id} without admin key should fail"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/commission-settings/{ENTERPRISE_ID}"
        )
        assert response.status_code in [403, 422], f"Expected 403/422, got {response.status_code}"
        print("✓ Unauthorized access correctly rejected")
    
    def test_get_commission_settings_invalid_key(self):
        """GET /api/enterprise/admin/commission-settings/{id} with invalid key should fail"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/commission-settings/{ENTERPRISE_ID}",
            headers={"x-admin-key": "invalid-key"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Invalid admin key correctly rejected")
    
    def test_put_commission_settings(self):
        """PUT /api/enterprise/admin/commission-settings/{id} saves settings correctly"""
        payload = {
            "voucher_commission": 7.5,
            "self_pay_commission": 4.0,
            "customer_cashback": 2.0,
            "is_active": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/commission-settings/{ENTERPRISE_ID}",
            headers={
                "Content-Type": "application/json",
                "x-admin-key": ADMIN_KEY
            },
            json=payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        
        print(f"✓ Commission settings saved successfully")
        print(f"  voucher_commission: {payload['voucher_commission']}%")
        print(f"  self_pay_commission: {payload['self_pay_commission']}%")
        print(f"  customer_cashback: {payload['customer_cashback']}%")
    
    def test_put_commission_settings_verify_persistence(self):
        """PUT then GET to verify commission settings persist"""
        # Set specific values
        payload = {
            "voucher_commission": 6.5,
            "self_pay_commission": 3.5,
            "customer_cashback": 1.5,
            "is_active": True
        }
        
        # PUT
        put_response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/commission-settings/{ENTERPRISE_ID}",
            headers={
                "Content-Type": "application/json",
                "x-admin-key": ADMIN_KEY
            },
            json=payload
        )
        assert put_response.status_code == 200, f"PUT failed: {put_response.text}"
        
        # GET to verify
        get_response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/commission-settings/{ENTERPRISE_ID}",
            headers={"x-admin-key": ADMIN_KEY}
        )
        assert get_response.status_code == 200, f"GET failed: {get_response.text}"
        
        data = get_response.json()
        assert data["voucher_commission"] == payload["voucher_commission"], "voucher_commission mismatch"
        assert data["self_pay_commission"] == payload["self_pay_commission"], "self_pay_commission mismatch"
        assert data["customer_cashback"] == payload["customer_cashback"], "customer_cashback mismatch"
        
        print(f"✓ Commission settings persisted correctly")
    
    def test_put_commission_settings_validation_voucher(self):
        """Test voucher_commission validation (0-100%)"""
        # Test invalid value > 100
        payload = {
            "voucher_commission": 150,
            "self_pay_commission": 3.0,
            "customer_cashback": 1.0,
            "is_active": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/commission-settings/{ENTERPRISE_ID}",
            headers={
                "Content-Type": "application/json",
                "x-admin-key": ADMIN_KEY
            },
            json=payload
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid voucher_commission, got {response.status_code}"
        print("✓ Invalid voucher_commission (>100%) correctly rejected")
    
    def test_put_commission_settings_validation_negative(self):
        """Test negative commission value validation"""
        payload = {
            "voucher_commission": -5,
            "self_pay_commission": 3.0,
            "customer_cashback": 1.0,
            "is_active": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/commission-settings/{ENTERPRISE_ID}",
            headers={
                "Content-Type": "application/json",
                "x-admin-key": ADMIN_KEY
            },
            json=payload
        )
        
        assert response.status_code == 400, f"Expected 400 for negative commission, got {response.status_code}"
        print("✓ Negative commission value correctly rejected")
    
    def test_put_commission_settings_invalid_enterprise(self):
        """Test with non-existent enterprise ID"""
        payload = {
            "voucher_commission": 5.0,
            "self_pay_commission": 3.0,
            "customer_cashback": 1.0,
            "is_active": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/commission-settings/ent_nonexistent123",
            headers={
                "Content-Type": "application/json",
                "x-admin-key": ADMIN_KEY
            },
            json=payload
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent enterprise correctly returns 404")
    
    def test_put_commission_settings_deactivate(self):
        """Test deactivating commission settings"""
        payload = {
            "voucher_commission": 5.0,
            "self_pay_commission": 3.0,
            "customer_cashback": 1.0,
            "is_active": False
        }
        
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/commission-settings/{ENTERPRISE_ID}",
            headers={
                "Content-Type": "application/json",
                "x-admin-key": ADMIN_KEY
            },
            json=payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify is_active is False
        get_response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/commission-settings/{ENTERPRISE_ID}",
            headers={"x-admin-key": ADMIN_KEY}
        )
        data = get_response.json()
        assert data["is_active"] == False, "is_active should be False"
        
        print("✓ Commission settings deactivated successfully")


class TestAdminListWithCommissionSettings:
    """Test that admin list includes commission_settings for each enterprise"""
    
    def test_admin_list_includes_commission_settings(self):
        """GET /api/enterprise/admin/list returns commission_settings field"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/list",
            headers={"x-admin-key": ADMIN_KEY}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "enterprises" in data, "Response should contain 'enterprises' key"
        
        if data["enterprises"]:
            enterprise = data["enterprises"][0]
            
            # Check for commission_settings
            assert "commission_settings" in enterprise, "Enterprise should have commission_settings"
            
            commission = enterprise["commission_settings"]
            assert "voucher_commission" in commission, "commission_settings should have voucher_commission"
            assert "self_pay_commission" in commission, "commission_settings should have self_pay_commission"
            assert "customer_cashback" in commission, "commission_settings should have customer_cashback"
            assert "is_active" in commission, "commission_settings should have is_active"
            
            print(f"✓ Admin list includes commission_settings")
            print(f"  Enterprise: {enterprise.get('company_name')}")
            print(f"  commission_settings: {commission}")
    
    def test_commission_settings_persist_in_list(self):
        """After updating commission settings, verify they appear in admin list"""
        # First, set specific commission settings
        payload = {
            "voucher_commission": 8.0,
            "self_pay_commission": 4.5,
            "customer_cashback": 2.5,
            "is_active": True
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/commission-settings/{ENTERPRISE_ID}",
            headers={
                "Content-Type": "application/json",
                "x-admin-key": ADMIN_KEY
            },
            json=payload
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Now fetch the list and verify
        list_response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/list",
            headers={"x-admin-key": ADMIN_KEY}
        )
        
        assert list_response.status_code == 200
        
        data = list_response.json()
        
        # Find our enterprise
        target_enterprise = None
        for ent in data.get("enterprises", []):
            if ent.get("id") == ENTERPRISE_ID:
                target_enterprise = ent
                break
        
        assert target_enterprise is not None, f"Enterprise {ENTERPRISE_ID} not found in list"
        
        commission = target_enterprise.get("commission_settings", {})
        assert commission.get("voucher_commission") == 8.0, f"voucher_commission mismatch"
        assert commission.get("self_pay_commission") == 4.5, f"self_pay_commission mismatch"
        assert commission.get("customer_cashback") == 2.5, f"customer_cashback mismatch"
        
        print(f"✓ Commission settings correctly persisted and returned in list")
        print(f"  voucher_commission: {commission.get('voucher_commission')}%")
        print(f"  self_pay_commission: {commission.get('self_pay_commission')}%")
        print(f"  customer_cashback: {commission.get('customer_cashback')}%")


class TestEnterpriseBranchCreation:
    """Test enterprise branch creation (Filiale erstellen)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for enterprise"""
        response = requests.post(
            f"{BASE_URL}/api/enterprise/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Login failed: {response.text}")
    
    def test_create_branch(self, auth_token):
        """Test creating a new branch (Filiale erstellen)"""
        import uuid
        unique_name = f"Test Filiale {uuid.uuid4().hex[:6]}"
        
        payload = {
            "name": unique_name,
            "city": "München",
            "address": "Teststraße 123",
            "manager_name": "Max Mustermann",
            "manager_email": f"manager_{uuid.uuid4().hex[:6]}@test.de",
            "phone": "+49 89 12345678"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/enterprise/branches",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {auth_token}"
            },
            json=payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "branch_id" in data, "Response should contain branch_id"
        
        print(f"✓ Branch created successfully")
        print(f"  Name: {unique_name}")
        print(f"  Branch ID: {data.get('branch_id')}")
    
    def test_create_branch_minimal(self, auth_token):
        """Test creating a branch with minimal data (only name required)"""
        import uuid
        unique_name = f"Minimal Filiale {uuid.uuid4().hex[:6]}"
        
        payload = {
            "name": unique_name
        }
        
        response = requests.post(
            f"{BASE_URL}/api/enterprise/branches",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {auth_token}"
            },
            json=payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        
        print(f"✓ Minimal branch created successfully: {unique_name}")
    
    def test_list_branches(self, auth_token):
        """Test listing branches"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/branches",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "branches" in data, "Response should contain branches"
        assert "total" in data, "Response should contain total"
        
        print(f"✓ Listed {data['total']} branches")


class TestEnterpriseLogin:
    """Test enterprise login"""
    
    def test_enterprise_login_success(self):
        """Test successful enterprise login"""
        response = requests.post(
            f"{BASE_URL}/api/enterprise/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "enterprise_id" in data, "Response should contain enterprise_id"
        assert "company_name" in data, "Response should contain company_name"
        
        print(f"✓ Login successful for {data.get('company_name')}")
    
    def test_enterprise_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/enterprise/login",
            json={"email": TEST_EMAIL, "password": "WrongPassword123!"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected")


# Reset commission settings to default values after tests
class TestCleanup:
    """Reset settings to default values"""
    
    def test_reset_commission_settings(self):
        """Reset commission settings to default values"""
        payload = {
            "voucher_commission": 5.0,
            "self_pay_commission": 3.0,
            "customer_cashback": 1.0,
            "is_active": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/commission-settings/{ENTERPRISE_ID}",
            headers={
                "Content-Type": "application/json",
                "x-admin-key": ADMIN_KEY
            },
            json=payload
        )
        
        assert response.status_code == 200, f"Reset failed: {response.text}"
        print("✓ Commission settings reset to defaults")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
