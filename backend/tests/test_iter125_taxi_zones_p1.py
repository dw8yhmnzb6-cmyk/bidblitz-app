"""
Iteration 125 - P1 Taxi Tariff Zones Admin Testing
===================================================
Tests for:
1. Backend starts without missing router_registry entries (routes.taxi_operator / routes.taxi_driver removed)
2. Public GET /api/taxi/tariff-zones returns active zones
3. Admin can create tariff zone via POST /api/taxi/admin/tariff-zones
4. Admin can delete/deactivate zone via DELETE /api/taxi/admin/tariff-zones/{zid}
5. Zone list updates after create/delete
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://kyc-approval-hub.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


class TestBackendStartup:
    """Verify backend starts without dead router imports"""
    
    def test_health_check(self):
        """Backend should be running and healthy"""
        response = requests.get(f"{BASE_URL}/api/readiness", timeout=10)
        # 200 or 404 (if readiness endpoint not implemented) both indicate server is up
        assert response.status_code in [200, 404], f"Backend not responding: {response.status_code}"
        print(f"✓ Backend is running (status: {response.status_code})")
    
    def test_no_dead_router_imports(self):
        """Backend should not have routes.taxi_operator or routes.taxi_driver in registry"""
        # If backend started successfully with 166 routers, dead imports are removed
        # We verify by checking that the taxi tariff zones endpoint works
        response = requests.get(f"{BASE_URL}/api/taxi/tariff-zones", timeout=10)
        assert response.status_code == 200, f"Tariff zones endpoint failed: {response.status_code}"
        print("✓ Backend started without dead router imports (taxi_operator/taxi_driver removed)")


class TestTaxiTariffZonesAPI:
    """Test Taxi Tariff Zones CRUD operations"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        print(f"✓ Admin logged in successfully")
        return session
    
    def test_public_get_tariff_zones(self):
        """Public GET /api/taxi/tariff-zones should return active zones"""
        response = requests.get(f"{BASE_URL}/api/taxi/tariff-zones", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "items" in data, "Response should have 'items' key"
        assert isinstance(data["items"], list), "items should be a list"
        print(f"✓ Public GET /api/taxi/tariff-zones returns {len(data['items'])} zones")
    
    def test_admin_create_zone(self, admin_session):
        """Admin can create a new tariff zone"""
        zone_name = f"TEST_Zone_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": zone_name,
            "center_lat": 52.52,
            "center_lng": 13.405,
            "radius_km": 15.0,
            "base_fare": 3.50,
            "per_km": 1.80,
            "per_min": 0.30,
            "night_multiplier": 1.20,
            "weekend_multiplier": 1.15
        }
        response = admin_session.post(
            f"{BASE_URL}/api/taxi/admin/tariff-zones",
            json=payload,
            timeout=10
        )
        assert response.status_code == 200, f"Create zone failed: {response.status_code} - {response.text}"
        data = response.json()
        assert data.get("success") is True, "Response should indicate success"
        assert "zone" in data, "Response should contain zone data"
        zone = data["zone"]
        assert zone["name"] == zone_name, "Zone name should match"
        assert zone["id"], "Zone should have an ID"
        print(f"✓ Admin created zone: {zone_name} (id: {zone['id']})")
        
        # Store zone ID for cleanup
        admin_session.test_zone_id = zone["id"]
        admin_session.test_zone_name = zone_name
    
    def test_zone_appears_in_list(self, admin_session):
        """Newly created zone should appear in the list"""
        response = requests.get(f"{BASE_URL}/api/taxi/tariff-zones", timeout=10)
        assert response.status_code == 200
        data = response.json()
        zone_names = [z["name"] for z in data["items"]]
        assert hasattr(admin_session, "test_zone_name"), "Zone should have been created in previous test"
        assert admin_session.test_zone_name in zone_names, f"Zone {admin_session.test_zone_name} should be in list"
        print(f"✓ Zone {admin_session.test_zone_name} appears in public list")
    
    def test_admin_delete_zone(self, admin_session):
        """Admin can delete/deactivate a zone"""
        assert hasattr(admin_session, "test_zone_id"), "Zone should have been created in previous test"
        zone_id = admin_session.test_zone_id
        
        response = admin_session.delete(
            f"{BASE_URL}/api/taxi/admin/tariff-zones/{zone_id}",
            timeout=10
        )
        assert response.status_code == 200, f"Delete zone failed: {response.status_code} - {response.text}"
        data = response.json()
        assert data.get("success") is True, "Response should indicate success"
        print(f"✓ Admin deleted/deactivated zone: {zone_id}")
    
    def test_deleted_zone_not_in_list(self, admin_session):
        """Deleted zone should not appear in active zones list"""
        response = requests.get(f"{BASE_URL}/api/taxi/tariff-zones", timeout=10)
        assert response.status_code == 200
        data = response.json()
        zone_ids = [z["id"] for z in data["items"]]
        assert hasattr(admin_session, "test_zone_id"), "Zone should have been created"
        assert admin_session.test_zone_id not in zone_ids, "Deleted zone should not be in active list"
        print(f"✓ Deleted zone {admin_session.test_zone_id} no longer in active list")


class TestTaxiTariffZonesValidation:
    """Test validation and edge cases"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        assert login_response.status_code == 200
        return session
    
    def test_create_zone_missing_name(self, admin_session):
        """Creating zone without name should fail validation"""
        payload = {
            "center_lat": 52.52,
            "center_lng": 13.405,
            "radius_km": 15.0,
            "base_fare": 3.50,
            "per_km": 1.80,
            "per_min": 0.30,
            "night_multiplier": 1.20,
            "weekend_multiplier": 1.15
        }
        response = admin_session.post(
            f"{BASE_URL}/api/taxi/admin/tariff-zones",
            json=payload,
            timeout=10
        )
        assert response.status_code == 422, f"Expected 422 validation error, got {response.status_code}"
        print("✓ Validation rejects zone without name (422)")
    
    def test_create_zone_short_name(self, admin_session):
        """Creating zone with too short name should fail validation"""
        payload = {
            "name": "X",  # Too short (min 2 chars)
            "center_lat": 52.52,
            "center_lng": 13.405,
            "radius_km": 15.0,
            "base_fare": 3.50,
            "per_km": 1.80,
            "per_min": 0.30,
            "night_multiplier": 1.20,
            "weekend_multiplier": 1.15
        }
        response = admin_session.post(
            f"{BASE_URL}/api/taxi/admin/tariff-zones",
            json=payload,
            timeout=10
        )
        assert response.status_code == 422, f"Expected 422 validation error, got {response.status_code}"
        print("✓ Validation rejects zone with name < 2 chars (422)")
    
    def test_unauthenticated_create_fails(self):
        """Unauthenticated user cannot create zones"""
        payload = {
            "name": "Unauthorized Zone",
            "center_lat": 52.52,
            "center_lng": 13.405,
            "radius_km": 15.0,
            "base_fare": 3.50,
            "per_km": 1.80,
            "per_min": 0.30,
            "night_multiplier": 1.20,
            "weekend_multiplier": 1.15
        }
        response = requests.post(
            f"{BASE_URL}/api/taxi/admin/tariff-zones",
            json=payload,
            timeout=10
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated create rejected ({response.status_code})")
    
    def test_unauthenticated_delete_fails(self):
        """Unauthenticated user cannot delete zones"""
        response = requests.delete(
            f"{BASE_URL}/api/taxi/admin/tariff-zones/fake-zone-id",
            timeout=10
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated delete rejected ({response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
