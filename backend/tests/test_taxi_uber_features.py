"""
Taxi Uber-like Features Tests - Iteration 155
Tests for:
1. Taxi search/geocode functionality
2. Active ride with live movement data (driver_lat, driver_lng, driver_bearing, driver_path)
3. Ride chat/messages APIs
4. ActiveRideTracker features (Chat, Call, Share buttons)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PASSWORD = "Haendler2026!"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


class TestTaxiGeocode:
    """Test taxi geocode/search functionality"""
    
    def test_geocode_search_pris(self):
        """Test geocode search returns results for 'Pris' (regression test)"""
        response = requests.get(
            f"{BASE_URL}/api/taxi/geocode",
            params={"q": "Pris", "limit": 5, "country": "de,at,ch"}
        )
        assert response.status_code == 200, f"Geocode failed: {response.status_code}"
        data = response.json()
        assert "features" in data, "Response missing 'features' key"
        assert len(data["features"]) > 0, "No geocode results for 'Pris'"
        # Verify first result has required fields
        first = data["features"][0]
        assert "center" in first, "Feature missing 'center'"
        assert len(first["center"]) == 2, "Center should have [lng, lat]"
        print(f"PASS: Geocode search for 'Pris' returned {len(data['features'])} results")
    
    def test_geocode_search_berlin(self):
        """Test geocode search for 'Berlin'"""
        response = requests.get(
            f"{BASE_URL}/api/taxi/geocode",
            params={"q": "Berlin", "limit": 5, "country": "de,at,ch"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data.get("features", [])) > 0, "No results for 'Berlin'"
        print(f"PASS: Geocode search for 'Berlin' returned {len(data['features'])} results")
    
    def test_geocode_search_with_proximity(self):
        """Test geocode search with proximity bias"""
        response = requests.get(
            f"{BASE_URL}/api/taxi/geocode",
            params={"q": "Alexanderplatz", "limit": 5, "lat": 52.52, "lng": 13.405, "country": "de,at,ch"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data.get("features", [])) > 0, "No results for 'Alexanderplatz'"
        print(f"PASS: Geocode search with proximity returned {len(data['features'])} results")


class TestActiveRideWithLiveMovement:
    """Test active ride endpoint returns live movement data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as merchant user"""
        self.session = requests.Session()
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": MERCHANT_EMAIL, "password": MERCHANT_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.user = response.json()
        print(f"Logged in as {self.user['email']}")
    
    def test_active_ride_endpoint(self):
        """Test /api/taxi/rides/active returns ride data"""
        response = self.session.get(f"{BASE_URL}/api/taxi/rides/active")
        assert response.status_code == 200, f"Active ride failed: {response.status_code}"
        data = response.json()
        assert "has_active" in data, "Response missing 'has_active'"
        assert "rides" in data, "Response missing 'rides'"
        print(f"PASS: Active ride endpoint returned has_active={data['has_active']}")
        return data
    
    def test_active_ride_has_driver_location(self):
        """Test active ride includes driver_lat, driver_lng when driver assigned"""
        response = self.session.get(f"{BASE_URL}/api/taxi/rides/active")
        assert response.status_code == 200
        data = response.json()
        
        if not data.get("has_active") or not data.get("rides"):
            pytest.skip("No active ride to test driver location")
        
        ride = data["rides"][0]
        status = ride.get("status")
        
        # Only check driver location for accepted/arriving/started rides
        if status in ["accepted", "arriving", "started"]:
            assert "driver_lat" in ride, f"Ride missing driver_lat (status={status})"
            assert "driver_lng" in ride, f"Ride missing driver_lng (status={status})"
            assert ride["driver_lat"] is not None, "driver_lat is None"
            assert ride["driver_lng"] is not None, "driver_lng is None"
            print(f"PASS: Active ride has driver_lat={ride['driver_lat']}, driver_lng={ride['driver_lng']}")
        else:
            print(f"SKIP: Ride status is '{status}', driver location not expected")
    
    def test_active_ride_has_driver_bearing(self):
        """Test active ride includes driver_bearing for map rotation"""
        response = self.session.get(f"{BASE_URL}/api/taxi/rides/active")
        assert response.status_code == 200
        data = response.json()
        
        if not data.get("has_active") or not data.get("rides"):
            pytest.skip("No active ride to test driver bearing")
        
        ride = data["rides"][0]
        status = ride.get("status")
        
        if status in ["accepted", "arriving", "started"]:
            assert "driver_bearing" in ride, f"Ride missing driver_bearing (status={status})"
            bearing = ride["driver_bearing"]
            assert bearing is not None, "driver_bearing is None"
            assert 0 <= bearing <= 360, f"driver_bearing out of range: {bearing}"
            print(f"PASS: Active ride has driver_bearing={bearing}")
        else:
            print(f"SKIP: Ride status is '{status}', driver bearing not expected")
    
    def test_active_ride_has_driver_path(self):
        """Test active ride includes driver_path for live movement trail"""
        response = self.session.get(f"{BASE_URL}/api/taxi/rides/active")
        assert response.status_code == 200
        data = response.json()
        
        if not data.get("has_active") or not data.get("rides"):
            pytest.skip("No active ride to test driver path")
        
        ride = data["rides"][0]
        status = ride.get("status")
        
        if status in ["accepted", "arriving", "started"]:
            assert "driver_path" in ride, f"Ride missing driver_path (status={status})"
            path = ride["driver_path"]
            assert isinstance(path, list), "driver_path should be a list"
            if len(path) > 0:
                point = path[0]
                assert "lat" in point, "Path point missing 'lat'"
                assert "lng" in point, "Path point missing 'lng'"
                print(f"PASS: Active ride has driver_path with {len(path)} points")
            else:
                print(f"PASS: Active ride has empty driver_path (driver hasn't moved yet)")
        else:
            print(f"SKIP: Ride status is '{status}', driver path not expected")
    
    def test_active_ride_has_driver_nested_object(self):
        """Test active ride includes enriched driver object"""
        response = self.session.get(f"{BASE_URL}/api/taxi/rides/active")
        assert response.status_code == 200
        data = response.json()
        
        if not data.get("has_active") or not data.get("rides"):
            pytest.skip("No active ride to test driver object")
        
        ride = data["rides"][0]
        
        if ride.get("driver_id"):
            assert "driver" in ride, "Ride missing 'driver' nested object"
            driver = ride["driver"]
            assert "name" in driver, "Driver missing 'name'"
            assert "phone" in driver, "Driver missing 'phone'"
            assert "rating" in driver, "Driver missing 'rating'"
            assert "vehicle" in driver, "Driver missing 'vehicle'"
            print(f"PASS: Active ride has enriched driver object: {driver.get('name')}")
        else:
            print(f"SKIP: No driver assigned yet")


class TestRideMessages:
    """Test ride chat/messages APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as merchant user"""
        self.session = requests.Session()
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": MERCHANT_EMAIL, "password": MERCHANT_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.user = response.json()
        
        # Get active ride ID
        active_response = self.session.get(f"{BASE_URL}/api/taxi/rides/active")
        if active_response.status_code == 200:
            data = active_response.json()
            if data.get("has_active") and data.get("rides"):
                self.ride_id = data["rides"][0]["ride_id"]
            else:
                self.ride_id = None
        else:
            self.ride_id = None
    
    def test_get_ride_messages(self):
        """Test GET /api/taxi/rides/{ride_id}/messages"""
        if not self.ride_id:
            pytest.skip("No active ride to test messages")
        
        response = self.session.get(f"{BASE_URL}/api/taxi/rides/{self.ride_id}/messages")
        assert response.status_code == 200, f"Get messages failed: {response.status_code}"
        data = response.json()
        assert data.get("ok") is True, "Response not ok"
        assert "messages" in data, "Response missing 'messages'"
        assert "role" in data, "Response missing 'role'"
        assert isinstance(data["messages"], list), "messages should be a list"
        print(f"PASS: Got {len(data['messages'])} messages, role={data['role']}")
    
    def test_send_ride_message(self):
        """Test POST /api/taxi/rides/{ride_id}/messages"""
        if not self.ride_id:
            pytest.skip("No active ride to test sending messages")
        
        test_text = "Test message from pytest"
        response = self.session.post(
            f"{BASE_URL}/api/taxi/rides/{self.ride_id}/messages",
            json={"text": test_text}
        )
        assert response.status_code == 200, f"Send message failed: {response.status_code}"
        data = response.json()
        assert data.get("ok") is True, "Response not ok"
        assert "message" in data, "Response missing 'message'"
        msg = data["message"]
        assert msg.get("text") == test_text, "Message text mismatch"
        assert "message_id" in msg, "Message missing 'message_id'"
        assert "sender_role" in msg, "Message missing 'sender_role'"
        assert "sent_at" in msg, "Message missing 'sent_at'"
        print(f"PASS: Sent message with id={msg['message_id']}")
    
    def test_send_empty_message_fails(self):
        """Test sending empty message returns error"""
        if not self.ride_id:
            pytest.skip("No active ride to test")
        
        response = self.session.post(
            f"{BASE_URL}/api/taxi/rides/{self.ride_id}/messages",
            json={"text": ""}
        )
        # 422 is Pydantic validation error, 400 is manual validation - both are acceptable
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        print("PASS: Empty message correctly rejected")
    
    def test_get_messages_unauthorized(self):
        """Test getting messages for non-existent ride returns 404"""
        response = self.session.get(f"{BASE_URL}/api/taxi/rides/nonexistent123/messages")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Non-existent ride correctly returns 404")


class TestTaxiStatus:
    """Test taxi module status endpoint"""
    
    def test_taxi_status(self):
        """Test /api/taxi/status returns module status"""
        response = requests.get(f"{BASE_URL}/api/taxi/status")
        assert response.status_code == 200, f"Status failed: {response.status_code}"
        data = response.json()
        assert "module_enabled" in data, "Response missing 'module_enabled'"
        assert data["module_enabled"] is True, "Taxi module should be enabled"
        print(f"PASS: Taxi module enabled, operators={data.get('operators_active', 0)}")


class TestTaxiEstimate:
    """Test taxi fare estimation"""
    
    def test_estimate_ride(self):
        """Test /api/taxi/estimate returns fare estimates"""
        response = requests.post(
            f"{BASE_URL}/api/taxi/estimate",
            json={
                "pickup_lat": 52.52,
                "pickup_lng": 13.405,
                "dropoff_lat": 52.5163,
                "dropoff_lng": 13.3777
            }
        )
        assert response.status_code == 200, f"Estimate failed: {response.status_code}"
        data = response.json()
        assert "estimates" in data, "Response missing 'estimates'"
        assert len(data["estimates"]) > 0, "No estimates returned"
        
        # Check estimate structure
        estimate = data["estimates"][0]
        assert "vehicle_type" in estimate, "Estimate missing 'vehicle_type'"
        assert "fare" in estimate, "Estimate missing 'fare'"
        assert "eta_minutes" in estimate, "Estimate missing 'eta_minutes'"
        print(f"PASS: Got {len(data['estimates'])} estimates, first fare={estimate['fare']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
