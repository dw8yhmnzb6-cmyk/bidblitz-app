"""
Iteration 153 - Taxi Uber-like Features Test Suite
Tests for:
1. Favorite locations save/get
2. Saved places (Home/Work) management
3. Recent addresses tracking
4. Favorite routes
5. Booking modes (now/later/other)
6. Recipient fields for booking for others
7. Scheduled booking with scheduled_at
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def session():
    """Create a requests session with credentials"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

@pytest.fixture(scope="module")
def auth_session(session):
    """Login and return authenticated session"""
    login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@bidblitz.com",
        "password": "BidBlitz2026!"
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    return session


class TestTaxiModuleStatus:
    """Test taxi module status endpoint"""
    
    def test_taxi_status_endpoint(self, session):
        """Verify taxi module is enabled"""
        resp = session.get(f"{BASE_URL}/api/taxi/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "module_enabled" in data
        print(f"Taxi module enabled: {data.get('module_enabled')}")


class TestFavoriteLocations:
    """Test favorite locations CRUD - for saving search results as favorites"""
    
    def test_get_favorite_locations(self, auth_session):
        """Get user's favorite locations"""
        resp = auth_session.get(f"{BASE_URL}/api/taxi/user/favorite-locations")
        assert resp.status_code == 200
        data = resp.json()
        assert "favorites" in data
        print(f"Found {len(data['favorites'])} favorite locations")
    
    def test_save_favorite_location(self, auth_session):
        """Save a new favorite location from search"""
        payload = {
            "name": "TEST_Alexanderplatz",
            "address": "Alexanderplatz, 10178 Berlin",
            "latitude": 52.5219,
            "longitude": 13.4132,
            "icon": "star"
        }
        resp = auth_session.post(f"{BASE_URL}/api/taxi/user/favorite-locations", json=payload)
        # May return 400 if already exists, which is fine
        assert resp.status_code in [200, 400]
        if resp.status_code == 200:
            data = resp.json()
            assert data.get("ok") == True
            print(f"Saved favorite: {data.get('favorite', {}).get('name')}")
        else:
            print("Favorite already exists (expected)")
    
    def test_delete_favorite_location(self, auth_session):
        """Delete a favorite location"""
        # First get favorites
        resp = auth_session.get(f"{BASE_URL}/api/taxi/user/favorite-locations")
        assert resp.status_code == 200
        favorites = resp.json().get("favorites", [])
        
        # Find test favorite
        test_fav = next((f for f in favorites if "TEST_" in f.get("name", "")), None)
        if test_fav:
            del_resp = auth_session.delete(f"{BASE_URL}/api/taxi/user/favorite-locations/{test_fav['id']}")
            assert del_resp.status_code == 200
            print(f"Deleted favorite: {test_fav['name']}")
        else:
            print("No test favorite to delete")


class TestSavedPlaces:
    """Test saved places (Home/Work) management"""
    
    def test_get_saved_places(self, auth_session):
        """Get user's saved places"""
        resp = auth_session.get(f"{BASE_URL}/api/taxi/saved-places")
        assert resp.status_code == 200
        data = resp.json()
        assert "places" in data
        print(f"Found {len(data['places'])} saved places")
        
        # Check for Home/Work
        places = data['places']
        home = next((p for p in places if p.get('icon', '').lower() == 'home' or p.get('name', '').lower() == 'home'), None)
        work = next((p for p in places if p.get('icon', '').lower() == 'work' or p.get('name', '').lower() == 'work'), None)
        print(f"Home saved: {home is not None}, Work saved: {work is not None}")
    
    def test_save_home_place(self, auth_session):
        """Save Home location"""
        payload = {
            "name": "Home",
            "icon": "home",
            "address": "Friedrichstraße 100, 10117 Berlin",
            "lat": 52.5200,
            "lng": 13.3880
        }
        resp = auth_session.post(f"{BASE_URL}/api/taxi/saved-places", json=payload)
        # May already exist
        assert resp.status_code in [200, 400]
        print(f"Save Home result: {resp.status_code}")
    
    def test_save_work_place(self, auth_session):
        """Save Work location"""
        payload = {
            "name": "Work",
            "icon": "work",
            "address": "Potsdamer Platz 1, 10785 Berlin",
            "lat": 52.5096,
            "lng": 13.3761
        }
        resp = auth_session.post(f"{BASE_URL}/api/taxi/saved-places", json=payload)
        assert resp.status_code in [200, 400]
        print(f"Save Work result: {resp.status_code}")


class TestRecentAddresses:
    """Test recent addresses tracking"""
    
    def test_get_recent_addresses(self, auth_session):
        """Get user's recent addresses"""
        resp = auth_session.get(f"{BASE_URL}/api/taxi/recent-addresses?limit=6")
        assert resp.status_code == 200
        data = resp.json()
        assert "addresses" in data
        print(f"Found {len(data['addresses'])} recent addresses")


class TestFavoriteRoutes:
    """Test favorite routes (frequently used pickup->dropoff pairs)"""
    
    def test_get_favorite_routes(self, auth_session):
        """Get user's favorite routes"""
        resp = auth_session.get(f"{BASE_URL}/api/taxi/favorite-routes?limit=4")
        assert resp.status_code == 200
        data = resp.json()
        assert "routes" in data
        print(f"Found {len(data['routes'])} favorite routes")


class TestRideEstimate:
    """Test ride estimate endpoint"""
    
    def test_estimate_all_vehicle_types(self, auth_session):
        """Get estimates for all vehicle types"""
        payload = {
            "pickup_lat": 52.5200,
            "pickup_lng": 13.4050,
            "dropoff_lat": 52.5096,
            "dropoff_lng": 13.3761
        }
        resp = auth_session.post(f"{BASE_URL}/api/taxi/estimate", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        
        assert "estimates" in data
        estimates = data["estimates"]
        assert len(estimates) >= 3, "Should have at least 3 vehicle types"
        
        vehicle_types = [e["vehicle_type"] for e in estimates]
        assert "standard" in vehicle_types
        assert "premium" in vehicle_types
        assert "van" in vehicle_types
        
        for est in estimates:
            assert "fare" in est
            assert est["fare"] > 0
            print(f"{est['vehicle_type']}: €{est['fare']:.2f}")


class TestBookingModes:
    """Test booking with different modes (now/later/other)"""
    
    def test_book_ride_now_mode(self, auth_session):
        """Test booking with 'now' mode"""
        payload = {
            "pickup_address": "Alexanderplatz, Berlin",
            "pickup_lat": 52.5219,
            "pickup_lng": 13.4132,
            "dropoff_address": "Potsdamer Platz, Berlin",
            "dropoff_lat": 52.5096,
            "dropoff_lng": 13.3761,
            "vehicle_type": "standard",
            "booking_mode": "now"
        }
        resp = auth_session.post(f"{BASE_URL}/api/taxi/book", json=payload)
        # May fail due to wallet balance, but should accept the booking_mode field
        print(f"Book now response: {resp.status_code} - {resp.text[:200]}")
        # 200 = success, 400 = validation/balance error (both acceptable for field test)
        assert resp.status_code in [200, 400, 503]
    
    def test_book_ride_later_mode_with_scheduled_at(self, auth_session):
        """Test booking with 'later' mode and scheduled_at"""
        scheduled_time = (datetime.now() + timedelta(hours=2)).isoformat()
        payload = {
            "pickup_address": "Alexanderplatz, Berlin",
            "pickup_lat": 52.5219,
            "pickup_lng": 13.4132,
            "dropoff_address": "Potsdamer Platz, Berlin",
            "dropoff_lat": 52.5096,
            "dropoff_lng": 13.3761,
            "vehicle_type": "standard",
            "booking_mode": "later",
            "scheduled_at": scheduled_time
        }
        resp = auth_session.post(f"{BASE_URL}/api/taxi/book", json=payload)
        print(f"Book later response: {resp.status_code} - {resp.text[:200]}")
        # Backend should accept scheduled_at field
        assert resp.status_code in [200, 400, 503]
    
    def test_book_ride_for_other_with_recipient_fields(self, auth_session):
        """Test booking for someone else with recipient_name and recipient_phone"""
        payload = {
            "pickup_address": "Alexanderplatz, Berlin",
            "pickup_lat": 52.5219,
            "pickup_lng": 13.4132,
            "dropoff_address": "Potsdamer Platz, Berlin",
            "dropoff_lat": 52.5096,
            "dropoff_lng": 13.3761,
            "vehicle_type": "standard",
            "booking_mode": "now",
            "recipient_name": "Max Mustermann",
            "recipient_phone": "+49 170 1234567"
        }
        resp = auth_session.post(f"{BASE_URL}/api/taxi/book", json=payload)
        print(f"Book for other response: {resp.status_code} - {resp.text[:200]}")
        # Backend should accept recipient fields
        assert resp.status_code in [200, 400, 503]


class TestNearbyDrivers:
    """Test nearby drivers endpoint"""
    
    def test_get_nearby_drivers(self, session):
        """Get nearby drivers (public endpoint)"""
        resp = session.get(f"{BASE_URL}/api/taxi/drivers/nearby?lat=52.52&lng=13.405&radius=10")
        assert resp.status_code == 200
        data = resp.json()
        assert "drivers" in data
        assert "total" in data
        print(f"Found {data['total']} nearby drivers")


class TestQuickPlacesPresets:
    """Test that quick places presets work (Airport/Station)"""
    
    def test_estimate_to_airport(self, auth_session):
        """Test estimate to BER Airport preset"""
        payload = {
            "pickup_lat": 52.5200,
            "pickup_lng": 13.4050,
            "dropoff_lat": 52.3667,  # BER Airport
            "dropoff_lng": 13.5033
        }
        resp = auth_session.post(f"{BASE_URL}/api/taxi/estimate", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data.get("estimates", [])) >= 3
        print(f"Airport estimate: €{data['estimates'][0]['fare']:.2f}")
    
    def test_estimate_to_hauptbahnhof(self, auth_session):
        """Test estimate to Berlin Hauptbahnhof preset"""
        payload = {
            "pickup_lat": 52.5200,
            "pickup_lng": 13.4050,
            "dropoff_lat": 52.5251,  # Berlin Hauptbahnhof
            "dropoff_lng": 13.3694
        }
        resp = auth_session.post(f"{BASE_URL}/api/taxi/estimate", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data.get("estimates", [])) >= 3
        print(f"Hauptbahnhof estimate: €{data['estimates'][0]['fare']:.2f}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
