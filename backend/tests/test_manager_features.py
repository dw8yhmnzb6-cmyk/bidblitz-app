"""
Test suite for Manager Dashboard Enhancement Features
- Manager Login functionality
- Manager Dashboard with influencer management
- Admin Manager List and Details
- Admin Manager Activities (activity log)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.de"
ADMIN_PASSWORD = "Admin123!"
MANAGER_EMAIL = "manager.prishtina@bidblitz.de"
MANAGER_PASSWORD = "Prishtina2024!"
MANAGER_ID = "b8bb850e-ad00-4bbc-84c7-2ef162347712"


class TestManagerLogin:
    """Manager login functionality tests"""
    
    def test_manager_login_success(self):
        """Test successful manager login"""
        response = requests.post(f"{BASE_URL}/api/manager/login", json={
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "manager" in data
        assert data["manager"]["id"] == MANAGER_ID
        assert data["manager"]["email"] == MANAGER_EMAIL
        assert data["manager"]["name"] == "Prishtina Manager"
        assert "cities" in data["manager"]
        assert len(data["manager"]["cities"]) > 0
        assert "commission_percent" in data["manager"]
        print(f"✓ Manager login successful: {data['manager']['name']}")
    
    def test_manager_login_invalid_credentials(self):
        """Test manager login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/manager/login", json={
            "email": "invalid@bidblitz.de",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print("✓ Invalid credentials correctly rejected")
    
    def test_manager_login_wrong_password(self):
        """Test manager login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/manager/login", json={
            "email": MANAGER_EMAIL,
            "password": "WrongPassword123!"
        })
        assert response.status_code == 401
        print("✓ Wrong password correctly rejected")


class TestManagerDashboard:
    """Manager dashboard functionality tests"""
    
    def test_manager_dashboard_get(self):
        """Test getting manager dashboard data"""
        response = requests.get(f"{BASE_URL}/api/manager/dashboard/{MANAGER_ID}")
        assert response.status_code == 200
        data = response.json()
        
        # Check manager info
        assert "manager" in data
        assert data["manager"]["id"] == MANAGER_ID
        assert "cities" in data["manager"]
        
        # Check statistics
        assert "statistics" in data
        stats = data["statistics"]
        assert "total_influencers" in stats
        assert "active_influencers" in stats
        assert "total_influencer_revenue" in stats
        assert "total_influencer_commission" in stats
        assert "manager_commission" in stats
        assert "pending_payout" in stats
        
        # Check influencers list
        assert "influencers" in data
        assert isinstance(data["influencers"], list)
        
        print(f"✓ Manager dashboard loaded: {stats['total_influencers']} influencers, €{stats['manager_commission']:.2f} commission")
    
    def test_manager_dashboard_invalid_id(self):
        """Test dashboard with invalid manager ID"""
        response = requests.get(f"{BASE_URL}/api/manager/dashboard/invalid-id-12345")
        assert response.status_code == 401
        print("✓ Invalid manager ID correctly rejected")


class TestAdminManagerList:
    """Admin manager list functionality tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_admin_manager_list(self, admin_token):
        """Test getting list of all managers (Admin only)"""
        response = requests.get(
            f"{BASE_URL}/api/manager/admin/list",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "managers" in data
        assert isinstance(data["managers"], list)
        
        # Find our test manager
        prishtina_manager = None
        for mgr in data["managers"]:
            if mgr["id"] == MANAGER_ID:
                prishtina_manager = mgr
                break
        
        assert prishtina_manager is not None, "Prishtina manager not found in list"
        assert prishtina_manager["name"] == "Prishtina Manager"
        assert prishtina_manager["email"] == MANAGER_EMAIL
        assert "cities" in prishtina_manager
        assert "influencer_count" in prishtina_manager
        assert "manager_commission" in prishtina_manager
        
        print(f"✓ Admin manager list: {len(data['managers'])} managers found")
    
    def test_admin_manager_list_unauthorized(self):
        """Test manager list without admin token"""
        response = requests.get(f"{BASE_URL}/api/manager/admin/list")
        assert response.status_code in [401, 403]
        print("✓ Unauthorized access correctly rejected")


class TestAdminManagerInfluencers:
    """Admin manager influencers functionality tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_admin_manager_influencers(self, admin_token):
        """Test getting influencers for a specific manager (Admin only)"""
        response = requests.get(
            f"{BASE_URL}/api/manager/admin/{MANAGER_ID}/influencers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "manager_id" in data
        assert data["manager_id"] == MANAGER_ID
        assert "manager_name" in data
        assert "cities" in data
        assert "influencers" in data
        assert "total_count" in data
        assert isinstance(data["influencers"], list)
        
        # Check influencer data structure if any exist
        if len(data["influencers"]) > 0:
            inf = data["influencers"][0]
            assert "id" in inf or "code" in inf
            assert "name" in inf or "code" in inf
        
        print(f"✓ Admin manager influencers: {data['total_count']} influencers for {data['manager_name']}")
    
    def test_admin_manager_influencers_invalid_id(self, admin_token):
        """Test getting influencers for invalid manager ID"""
        response = requests.get(
            f"{BASE_URL}/api/manager/admin/invalid-manager-id/influencers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404
        print("✓ Invalid manager ID correctly returns 404")


class TestAdminManagerActivities:
    """Admin manager activities (activity log) functionality tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_admin_manager_activities(self, admin_token):
        """Test getting activity log for a specific manager (Admin only)"""
        response = requests.get(
            f"{BASE_URL}/api/manager/admin/{MANAGER_ID}/activities?limit=20",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "manager_id" in data
        assert data["manager_id"] == MANAGER_ID
        assert "manager_name" in data
        assert "activities" in data
        assert "total_count" in data
        assert isinstance(data["activities"], list)
        
        # Check activity data structure if any exist
        if len(data["activities"]) > 0:
            activity = data["activities"][0]
            assert "id" in activity
            assert "manager_id" in activity
            assert "action" in activity
            assert "description" in activity
            assert "created_at" in activity
            
            # Verify action types
            valid_actions = ["login", "influencer_approved", "influencer_blocked", "influencer_city_assigned"]
            assert activity["action"] in valid_actions, f"Unknown action type: {activity['action']}"
        
        print(f"✓ Admin manager activities: {data['total_count']} activities for {data['manager_name']}")
    
    def test_admin_manager_activities_invalid_id(self, admin_token):
        """Test getting activities for invalid manager ID"""
        response = requests.get(
            f"{BASE_URL}/api/manager/admin/invalid-manager-id/activities",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404
        print("✓ Invalid manager ID correctly returns 404")
    
    def test_admin_all_manager_activities(self, admin_token):
        """Test getting all manager activities (Admin only)"""
        response = requests.get(
            f"{BASE_URL}/api/manager/admin/all-activities?limit=50",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "activities" in data
        assert "total_count" in data
        assert isinstance(data["activities"], list)
        
        # Check that activities have manager_name enriched
        if len(data["activities"]) > 0:
            activity = data["activities"][0]
            assert "manager_name" in activity
        
        print(f"✓ Admin all manager activities: {data['total_count']} total activities")


class TestManagerInfluencerActions:
    """Manager influencer approve/block functionality tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_manager_approve_influencer_invalid_id(self):
        """Test approving non-existent influencer"""
        response = requests.post(
            f"{BASE_URL}/api/manager/{MANAGER_ID}/influencer/approve/invalid-influencer-id"
        )
        assert response.status_code == 404
        print("✓ Approve invalid influencer correctly returns 404")
    
    def test_manager_block_influencer_invalid_id(self):
        """Test blocking non-existent influencer"""
        response = requests.post(
            f"{BASE_URL}/api/manager/{MANAGER_ID}/influencer/block/invalid-influencer-id"
        )
        assert response.status_code == 404
        print("✓ Block invalid influencer correctly returns 404")
    
    def test_activity_logged_after_login(self, admin_token):
        """Test that login activity is logged"""
        # First login as manager
        login_response = requests.post(f"{BASE_URL}/api/manager/login", json={
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASSWORD
        })
        assert login_response.status_code == 200
        
        # Then check activities
        activities_response = requests.get(
            f"{BASE_URL}/api/manager/admin/{MANAGER_ID}/activities?limit=10",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert activities_response.status_code == 200
        data = activities_response.json()
        
        # Find login activity
        login_activities = [a for a in data["activities"] if a["action"] == "login"]
        assert len(login_activities) > 0, "No login activities found"
        
        print(f"✓ Login activity logged: {len(login_activities)} login activities found")


class TestManagerEndpointSecurity:
    """Security tests for manager endpoints"""
    
    def test_admin_endpoints_require_auth(self):
        """Test that admin endpoints require authentication"""
        endpoints = [
            f"/api/manager/admin/list",
            f"/api/manager/admin/{MANAGER_ID}/influencers",
            f"/api/manager/admin/{MANAGER_ID}/activities",
            f"/api/manager/admin/all-activities"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [401, 403], f"Endpoint {endpoint} should require auth"
        
        print("✓ All admin endpoints require authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
