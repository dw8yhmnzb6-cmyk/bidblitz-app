"""
Mobility Platform API Tests - Phase 3 BidBlitz Mobility Ecosystem
Tests for: /api/mobility-platform/* endpoints
- Search (Nominatim autocomplete)
- Reverse geocoding
- Route calculation with 6 transport options
- Nearby vehicles/services
- Payment options
- Saved/Recent locations
"""

import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_session():
    """Create authenticated session for tests"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login with admin credentials
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@bidblitz.com",
        "password": "BidBlitz2026!"
    })
    
    if response.status_code != 200:
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    return session


class TestMobilityPlatformSearch:
    """Tests for /api/mobility-platform/search endpoint"""
    
    def test_search_berlin_hauptbahnhof(self, auth_session):
        """Search for Berlin Hauptbahnhof returns results"""
        response = auth_session.get(
            f"{BASE_URL}/api/mobility-platform/search",
            params={"q": "Berlin Hauptbahnhof", "lang": "de", "limit": 5}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0
        
        # Verify first result contains Berlin
        first_result = data["results"][0]
        assert "name" in first_result
        assert "address" in first_result
        assert "lat" in first_result
        assert "lng" in first_result
        assert "Berlin" in first_result.get("address", "") or "Berlin" in first_result.get("name", "")
    
    def test_search_with_proximity(self, auth_session):
        """Search with lat/lng proximity bias"""
        response = auth_session.get(
            f"{BASE_URL}/api/mobility-platform/search",
            params={"q": "Flughafen", "lang": "de", "limit": 5, "lat": 52.52, "lng": 13.405}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
    
    def test_search_short_query_returns_empty(self, auth_session):
        """Search with query < 2 chars returns empty results"""
        response = auth_session.get(
            f"{BASE_URL}/api/mobility-platform/search",
            params={"q": "B", "lang": "de"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["results"] == []


class TestMobilityPlatformReverse:
    """Tests for /api/mobility-platform/reverse endpoint"""
    
    def test_reverse_geocode_berlin(self, auth_session):
        """Reverse geocode Berlin coordinates"""
        response = auth_session.get(
            f"{BASE_URL}/api/mobility-platform/reverse",
            params={"lat": 52.5200, "lng": 13.4050, "lang": "de"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "address" in data
        assert "lat" in data
        assert "lng" in data
        assert data["lat"] == 52.5200
        assert data["lng"] == 13.4050
        # Should contain Berlin in address
        assert "Berlin" in data.get("address", "") or "Berlin" in data.get("city", "")
    
    def test_reverse_geocode_pristina(self, auth_session):
        """Reverse geocode Pristina coordinates (default map center)"""
        response = auth_session.get(
            f"{BASE_URL}/api/mobility-platform/reverse",
            params={"lat": 42.6489, "lng": 21.1743, "lang": "de"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "address" in data


class TestMobilityPlatformRoute:
    """Tests for /api/mobility-platform/route endpoint"""
    
    def test_route_calculation_berlin(self, auth_session):
        """Calculate route within Berlin returns 6 transport options"""
        response = auth_session.post(
            f"{BASE_URL}/api/mobility-platform/route",
            json={
                "pickup_lat": 52.5200,
                "pickup_lng": 13.4050,
                "dropoff_lat": 52.5070,
                "dropoff_lng": 13.3320,
                "pickup_address": "Berlin Mitte",
                "dropoff_address": "Berlin Zoo"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify route data
        assert "distance_km" in data
        assert "duration_min" in data
        assert "options" in data
        assert "recommendations" in data
        assert "geometry" in data
        
        # Verify 6 transport options
        assert len(data["options"]) == 6
        
        # Verify all transport types present
        option_types = [opt["type"] for opt in data["options"]]
        expected_types = ["taxi", "scooter", "bike", "car_rental", "airport_shuttle", "vip"]
        for expected in expected_types:
            assert expected in option_types, f"Missing transport type: {expected}"
        
        # Verify each option has required fields
        for option in data["options"]:
            assert "type" in option
            assert "label" in option
            assert "price_eur" in option
            assert "duration_min" in option
            assert "distance_km" in option
            assert "eco_score" in option
            assert "payment_methods" in option
            assert option["price_eur"] > 0
        
        # Verify recommendations
        assert "cheapest" in data["recommendations"]
        assert "fastest" in data["recommendations"]
        assert "balance" in data["recommendations"]
        assert "eco" in data["recommendations"]
    
    def test_route_long_distance(self, auth_session):
        """Calculate long distance route (Kosovo to Berlin)"""
        response = auth_session.post(
            f"{BASE_URL}/api/mobility-platform/route",
            json={
                "pickup_lat": 42.6489,
                "pickup_lng": 21.1743,
                "dropoff_lat": 52.5200,
                "dropoff_lng": 13.4050,
                "pickup_address": "Pristina, Kosovo",
                "dropoff_address": "Berlin, Germany"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Long distance should have higher prices
        assert data["distance_km"] > 1000
        
        # VIP should be most expensive
        vip_option = next((opt for opt in data["options"] if opt["type"] == "vip"), None)
        assert vip_option is not None
        assert vip_option["price_eur"] > 1000


class TestMobilityPlatformNearby:
    """Tests for /api/mobility-platform/nearby endpoint"""
    
    def test_nearby_vehicles(self, auth_session):
        """Get nearby vehicles/services"""
        response = auth_session.get(
            f"{BASE_URL}/api/mobility-platform/nearby",
            params={"lat": 42.6489, "lng": 21.1743, "radius": 6}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "center" in data
        assert "radius_km" in data
        assert "counts" in data
        assert "markers" in data
        assert "available_modes" in data
        
        # Verify counts structure
        assert "taxi" in data["counts"]
        assert "scooter" in data["counts"]
        assert "car_rental" in data["counts"]
        
        # Verify available_modes has 6 transport types
        assert len(data["available_modes"]) == 6
        mode_types = [m["type"] for m in data["available_modes"]]
        for expected in ["taxi", "scooter", "bike", "car_rental", "airport_shuttle", "vip"]:
            assert expected in mode_types


class TestMobilityPlatformPaymentOptions:
    """Tests for /api/mobility-platform/payment-options endpoint"""
    
    def test_payment_options(self, auth_session):
        """Get payment options returns wallet balance and methods"""
        response = auth_session.get(f"{BASE_URL}/api/mobility-platform/payment-options")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify wallet balance
        assert "wallet_balance" in data
        assert isinstance(data["wallet_balance"], (int, float))
        assert data["wallet_balance"] >= 0
        
        # Verify payment methods
        assert "methods" in data
        assert len(data["methods"]) == 5
        
        method_ids = [m["id"] for m in data["methods"]]
        expected_methods = ["wallet", "nfc", "qr", "apple_pay", "google_pay"]
        for expected in expected_methods:
            assert expected in method_ids, f"Missing payment method: {expected}"


class TestMobilityPlatformSavedLocations:
    """Tests for /api/mobility-platform/saved-locations endpoint"""
    
    def test_get_saved_locations(self, auth_session):
        """Get saved locations returns list"""
        response = auth_session.get(f"{BASE_URL}/api/mobility-platform/saved-locations")
        
        assert response.status_code == 200
        data = response.json()
        assert "locations" in data
        assert isinstance(data["locations"], list)
    
    def test_save_location(self, auth_session):
        """Save a new location"""
        response = auth_session.post(
            f"{BASE_URL}/api/mobility-platform/saved-locations",
            json={
                "label": "TEST_home",
                "address": "Test Address 123, Berlin",
                "lat": 52.5200,
                "lng": 13.4050,
                "kind": "home"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        
        # Verify location was saved
        get_response = auth_session.get(f"{BASE_URL}/api/mobility-platform/saved-locations")
        assert get_response.status_code == 200
        locations = get_response.json().get("locations", [])
        test_location = next((loc for loc in locations if loc.get("label") == "TEST_home"), None)
        assert test_location is not None


class TestMobilityPlatformRecentLocations:
    """Tests for /api/mobility-platform/recent-locations endpoint"""
    
    def test_get_recent_locations(self, auth_session):
        """Get recent locations returns list"""
        response = auth_session.get(f"{BASE_URL}/api/mobility-platform/recent-locations")
        
        assert response.status_code == 200
        data = response.json()
        assert "locations" in data
        assert isinstance(data["locations"], list)
    
    def test_add_recent_location(self, auth_session):
        """Add a recent location"""
        response = auth_session.post(
            f"{BASE_URL}/api/mobility-platform/recent-locations",
            json={
                "label": "TEST_recent",
                "address": "Test Recent Address, Munich",
                "lat": 48.1351,
                "lng": 11.5820,
                "kind": "recent"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
