"""
Test suite for Manager System - 3-tier hierarchy: Admin -> Manager -> Influencer
Tests Manager login, dashboard, admin create/list, and influencer management
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://auction-hub-81.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "Admin123!"
MANAGER_EMAIL = "manager.berlin@bidblitz.ae"
MANAGER_PASSWORD = "Manager123!"


class TestManagerLogin:
    """Test Manager Login API - POST /api/manager/login"""
    
    def test_manager_login_success(self):
        """Test successful manager login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/manager/login", json={
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASSWORD
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Login should return success=True"
        assert "manager" in data, "Response should contain manager object"
        
        manager = data["manager"]
        assert "id" in manager, "Manager should have id"
        assert "name" in manager, "Manager should have name"
        assert "email" in manager, "Manager should have email"
        assert "cities" in manager, "Manager should have cities list"
        assert "commission_percent" in manager, "Manager should have commission_percent"
        
        # Verify commission is 15%
        assert manager["commission_percent"] == 15.0, f"Commission should be 15%, got {manager['commission_percent']}"
        
        # Verify cities are assigned
        assert isinstance(manager["cities"], list), "Cities should be a list"
        assert len(manager["cities"]) > 0, "Manager should have at least one city"
        
        print(f"SUCCESS: Manager login - {manager['name']} with cities: {manager['cities']}")
        return manager
    
    def test_manager_login_invalid_credentials(self):
        """Test manager login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/manager/login", json={
            "email": "invalid@bidblitz.ae",
            "password": "WrongPassword123!"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Invalid credentials correctly rejected with 401")
    
    def test_manager_login_missing_fields(self):
        """Test manager login with missing fields"""
        response = requests.post(f"{BASE_URL}/api/manager/login", json={
            "email": MANAGER_EMAIL
        })
        
        assert response.status_code == 422, f"Expected 422 for missing password, got {response.status_code}"
        print("SUCCESS: Missing fields correctly rejected with 422")


class TestManagerDashboard:
    """Test Manager Dashboard API - GET /api/manager/dashboard/{id}"""
    
    @pytest.fixture
    def manager_id(self):
        """Get manager ID by logging in"""
        response = requests.post(f"{BASE_URL}/api/manager/login", json={
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["manager"]["id"]
    
    def test_manager_dashboard_success(self, manager_id):
        """Test successful dashboard retrieval"""
        response = requests.get(f"{BASE_URL}/api/manager/dashboard/{manager_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify manager info
        assert "manager" in data, "Response should contain manager object"
        manager = data["manager"]
        assert "id" in manager
        assert "name" in manager
        assert "email" in manager
        assert "cities" in manager
        assert "commission_percent" in manager
        
        # Verify statistics
        assert "statistics" in data, "Response should contain statistics"
        stats = data["statistics"]
        assert "total_influencers" in stats
        assert "active_influencers" in stats
        assert "total_influencer_revenue" in stats
        assert "total_influencer_commission" in stats
        assert "manager_commission" in stats
        assert "pending_payout" in stats
        assert "total_paid_out" in stats
        
        # Verify influencers list
        assert "influencers" in data, "Response should contain influencers list"
        assert isinstance(data["influencers"], list)
        
        print(f"SUCCESS: Dashboard loaded - {stats['total_influencers']} influencers, €{stats['manager_commission']} commission")
        return data
    
    def test_manager_dashboard_invalid_id(self):
        """Test dashboard with invalid manager ID"""
        response = requests.get(f"{BASE_URL}/api/manager/dashboard/invalid-id-12345")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Invalid manager ID correctly rejected with 401")


class TestAdminManagerCreate:
    """Test Admin Manager Create API - POST /api/manager/admin/create"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed - skipping admin tests")
        return response.json().get("token")
    
    def test_create_manager_success(self, admin_token):
        """Test creating a new manager (admin only)"""
        import uuid
        test_email = f"test.manager.{uuid.uuid4().hex[:8]}@bidblitz.ae"
        
        response = requests.post(
            f"{BASE_URL}/api/manager/admin/create",
            json={
                "name": "Test Manager",
                "email": test_email,
                "password": "TestManager123!",
                "cities": ["Frankfurt", "Köln"],
                "commission_percent": 15.0
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "manager" in data
        
        manager = data["manager"]
        assert manager["name"] == "Test Manager"
        assert manager["email"] == test_email
        assert manager["cities"] == ["Frankfurt", "Köln"]
        assert manager["commission_percent"] == 15.0
        assert manager["is_active"] == True
        
        print(f"SUCCESS: Created manager {manager['name']} with ID {manager['id']}")
        return manager
    
    def test_create_manager_duplicate_email(self, admin_token):
        """Test creating manager with duplicate email"""
        response = requests.post(
            f"{BASE_URL}/api/manager/admin/create",
            json={
                "name": "Duplicate Manager",
                "email": MANAGER_EMAIL,  # Already exists
                "password": "Test123!",
                "cities": ["Berlin"]
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}"
        print("SUCCESS: Duplicate email correctly rejected with 400")
    
    def test_create_manager_unauthorized(self):
        """Test creating manager without admin auth"""
        response = requests.post(
            f"{BASE_URL}/api/manager/admin/create",
            json={
                "name": "Unauthorized Manager",
                "email": "unauth@bidblitz.ae",
                "password": "Test123!",
                "cities": ["Berlin"]
            }
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: Unauthorized request correctly rejected")


class TestAdminManagerList:
    """Test Admin Manager List API - GET /api/manager/admin/list"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed - skipping admin tests")
        return response.json().get("token")
    
    def test_list_managers_success(self, admin_token):
        """Test listing all managers (admin only)"""
        response = requests.get(
            f"{BASE_URL}/api/manager/admin/list",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "managers" in data, "Response should contain managers list"
        
        managers = data["managers"]
        assert isinstance(managers, list)
        assert len(managers) > 0, "Should have at least one manager"
        
        # Verify manager structure
        for manager in managers:
            assert "id" in manager
            assert "name" in manager
            assert "email" in manager
            assert "cities" in manager
            assert "commission_percent" in manager
            assert "is_active" in manager
            # Should have computed stats
            assert "influencer_count" in manager
            assert "total_influencer_revenue" in manager
            assert "manager_commission" in manager
        
        print(f"SUCCESS: Listed {len(managers)} managers")
        return managers
    
    def test_list_managers_unauthorized(self):
        """Test listing managers without admin auth"""
        response = requests.get(f"{BASE_URL}/api/manager/admin/list")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: Unauthorized request correctly rejected")


class TestManagerInfluencerManagement:
    """Test Manager Influencer Approve/Block APIs"""
    
    @pytest.fixture
    def manager_data(self):
        """Get manager ID and cities by logging in"""
        response = requests.post(f"{BASE_URL}/api/manager/login", json={
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["manager"]
    
    def test_approve_influencer_endpoint_exists(self, manager_data):
        """Test that approve influencer endpoint exists"""
        manager_id = manager_data["id"]
        
        # Test with a fake influencer ID - should return 404 (not found) not 405 (method not allowed)
        response = requests.post(
            f"{BASE_URL}/api/manager/{manager_id}/influencer/approve/fake-influencer-id"
        )
        
        # Should be 404 (influencer not found) not 405 (endpoint doesn't exist)
        assert response.status_code in [404, 401], f"Expected 404 or 401, got {response.status_code}"
        print("SUCCESS: Approve influencer endpoint exists and returns proper error")
    
    def test_block_influencer_endpoint_exists(self, manager_data):
        """Test that block influencer endpoint exists"""
        manager_id = manager_data["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/manager/{manager_id}/influencer/block/fake-influencer-id"
        )
        
        assert response.status_code in [404, 401], f"Expected 404 or 401, got {response.status_code}"
        print("SUCCESS: Block influencer endpoint exists and returns proper error")


class TestManagerCommissionCalculation:
    """Test Manager Commission (15% of influencer earnings)"""
    
    def test_commission_percent_is_15(self):
        """Verify manager commission is 15%"""
        response = requests.post(f"{BASE_URL}/api/manager/login", json={
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASSWORD
        })
        
        assert response.status_code == 200
        manager = response.json()["manager"]
        
        assert manager["commission_percent"] == 15.0, f"Expected 15%, got {manager['commission_percent']}%"
        print(f"SUCCESS: Manager commission is correctly set to {manager['commission_percent']}%")
    
    def test_dashboard_shows_commission_calculation(self):
        """Verify dashboard shows proper commission calculation"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/manager/login", json={
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASSWORD
        })
        assert login_response.status_code == 200
        manager_id = login_response.json()["manager"]["id"]
        
        # Get dashboard
        dashboard_response = requests.get(f"{BASE_URL}/api/manager/dashboard/{manager_id}")
        assert dashboard_response.status_code == 200
        
        data = dashboard_response.json()
        stats = data["statistics"]
        
        # Verify commission calculation (manager_commission should be 15% of total_influencer_commission)
        if stats["total_influencer_commission"] > 0:
            expected_commission = stats["total_influencer_commission"] * 0.15
            actual_commission = stats["manager_commission"]
            
            # Allow small floating point difference
            assert abs(actual_commission - expected_commission) < 0.01, \
                f"Commission mismatch: expected {expected_commission}, got {actual_commission}"
            print(f"SUCCESS: Commission calculation correct - €{actual_commission} (15% of €{stats['total_influencer_commission']})")
        else:
            print("INFO: No influencer commission yet, skipping calculation verification")


class TestAdminPanelManagerTab:
    """Test Admin Panel has Manager tab functionality"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed - skipping admin tests")
        return response.json().get("token")
    
    def test_admin_can_access_manager_list(self, admin_token):
        """Test admin can access manager list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/manager/admin/list",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "managers" in data
        print(f"SUCCESS: Admin can access manager list - {len(data['managers'])} managers found")
    
    def test_admin_can_access_cities_list(self, admin_token):
        """Test admin can access cities list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/manager/admin/cities",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "cities" in data
        print(f"SUCCESS: Admin can access cities list - {len(data['cities'])} cities found")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
