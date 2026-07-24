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


class TestMobilityPlatformBooking:
    """Tests for /api/mobility-platform/book and /api/mobility-platform/my-bookings endpoints - Direct Wallet Booking"""
    
    def test_book_transport_with_wallet(self, auth_session):
        """Book transport with wallet payment returns booking and new_balance"""
        response = auth_session.post(
            f"{BASE_URL}/api/mobility-platform/book",
            json={
                "transport_type": "taxi",
                "transport_label": "Taxi",
                "price_eur": 5.50,
                "duration_min": 10,
                "distance_km": 3.2,
                "payment_method": "wallet",
                "pickup": {
                    "address": "Berlin Mitte Test",
                    "lat": 52.5200,
                    "lng": 13.4050
                },
                "dropoff": {
                    "address": "Berlin Zoo Test",
                    "lat": 52.5070,
                    "lng": 13.3320
                },
                "preferences": {"priority": "balance", "luggage": False, "childSeat": False},
                "ai_recommendation": {"headline": "Test AI", "best_option_type": "taxi"}
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify booking response structure
        assert data.get("ok") == True, f"Booking should succeed, got: {data}"
        assert "booking" in data
        assert "new_balance" in data
        
        booking = data["booking"]
        assert "booking_id" in booking
        assert booking["booking_id"].startswith("mob-")
        assert booking["transport_type"] == "taxi"
        assert booking["transport_label"] == "Taxi"
        assert booking["price_eur"] == 5.50
        assert booking["payment_method"] == "wallet"
        assert booking["payment_status"] == "paid"
        assert booking["status"] == "confirmed"
        assert "pickup" in booking
        assert "dropoff" in booking
        assert booking["pickup"]["address"] == "Berlin Mitte Test"
        assert booking["dropoff"]["address"] == "Berlin Zoo Test"
        
        # Verify new_balance is a number
        assert isinstance(data["new_balance"], (int, float))
    
    def test_book_scooter_with_wallet(self, auth_session):
        """Book E-Scooter with wallet payment"""
        response = auth_session.post(
            f"{BASE_URL}/api/mobility-platform/book",
            json={
                "transport_type": "scooter",
                "transport_label": "E-Scooter",
                "price_eur": 2.80,
                "duration_min": 8,
                "distance_km": 2.1,
                "payment_method": "wallet",
                "pickup": {
                    "address": "Pristina Center",
                    "lat": 42.6489,
                    "lng": 21.1743
                },
                "dropoff": {
                    "address": "Pristina Airport",
                    "lat": 42.5728,
                    "lng": 21.0358
                }
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        assert data["booking"]["transport_type"] == "scooter"
    
    def test_book_non_wallet_payment_fails(self, auth_session):
        """Booking with non-wallet payment method should fail (only wallet supported currently)"""
        response = auth_session.post(
            f"{BASE_URL}/api/mobility-platform/book",
            json={
                "transport_type": "taxi",
                "transport_label": "Taxi",
                "price_eur": 10.00,
                "duration_min": 15,
                "distance_km": 5.0,
                "payment_method": "nfc",  # Non-wallet payment
                "pickup": {
                    "address": "Test Pickup",
                    "lat": 52.5200,
                    "lng": 13.4050
                },
                "dropoff": {
                    "address": "Test Dropoff",
                    "lat": 52.5070,
                    "lng": 13.3320
                }
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "wallet" in data["detail"].lower()
    
    def test_get_my_bookings(self, auth_session):
        """Get my mobility bookings returns list of bookings"""
        response = auth_session.get(f"{BASE_URL}/api/mobility-platform/my-bookings")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "bookings" in data
        assert isinstance(data["bookings"], list)
        
        # Should have at least the bookings we created in previous tests
        if len(data["bookings"]) > 0:
            booking = data["bookings"][0]
            assert "booking_id" in booking
            assert "transport_type" in booking
            assert "transport_label" in booking
            assert "price_eur" in booking
            assert "status" in booking
            assert "pickup" in booking
            assert "dropoff" in booking
            assert "created_at" in booking
    
    def test_booking_persists_in_my_bookings(self, auth_session):
        """Verify booking appears in my-bookings after creation"""
        # Create a unique booking
        import time
        unique_address = f"TEST_Booking_Verify_{int(time.time())}"
        
        book_response = auth_session.post(
            f"{BASE_URL}/api/mobility-platform/book",
            json={
                "transport_type": "bike",
                "transport_label": "Fahrrad",
                "price_eur": 1.50,
                "duration_min": 12,
                "distance_km": 2.5,
                "payment_method": "wallet",
                "pickup": {
                    "address": unique_address,
                    "lat": 52.5200,
                    "lng": 13.4050
                },
                "dropoff": {
                    "address": "Test Dropoff Verify",
                    "lat": 52.5070,
                    "lng": 13.3320
                }
            }
        )
        
        assert book_response.status_code == 200
        booking_id = book_response.json()["booking"]["booking_id"]
        
        # Verify booking appears in my-bookings
        list_response = auth_session.get(f"{BASE_URL}/api/mobility-platform/my-bookings")
        assert list_response.status_code == 200
        
        bookings = list_response.json()["bookings"]
        found_booking = next((b for b in bookings if b["booking_id"] == booking_id), None)
        
        assert found_booking is not None, f"Booking {booking_id} should appear in my-bookings"
        assert found_booking["pickup"]["address"] == unique_address


class TestMobilityPlatformAiRecommendation:
    """Tests for /api/mobility-platform/ai-recommendation endpoint - AI Route Recommendations via Universal Key"""
    
    def test_ai_recommendation_returns_valid_response(self, auth_session):
        """AI recommendation endpoint returns valid response with provider and model"""
        response = auth_session.post(
            f"{BASE_URL}/api/mobility-platform/ai-recommendation",
            json={
                "pickup_address": "Berlin Mitte",
                "dropoff_address": "Berlin Zoo",
                "distance_km": 5.2,
                "duration_min": 12,
                "options": [
                    {"type": "taxi", "label": "Taxi", "price_eur": 12.50, "duration_min": 12, "distance_km": 5.2, "eco_score": 55},
                    {"type": "scooter", "label": "E-Scooter", "price_eur": 3.80, "duration_min": 15, "distance_km": 5.2, "eco_score": 86},
                    {"type": "bike", "label": "Fahrrad", "price_eur": 2.10, "duration_min": 23, "distance_km": 5.2, "eco_score": 96},
                    {"type": "car_rental", "label": "Mietwagen", "price_eur": 10.20, "duration_min": 13, "distance_km": 5.2, "eco_score": 48},
                    {"type": "airport_shuttle", "label": "Airport Shuttle", "price_eur": 8.50, "duration_min": 14, "distance_km": 5.2, "eco_score": 63},
                    {"type": "vip", "label": "VIP Chauffeur", "price_eur": 22.00, "duration_min": 11, "distance_km": 5.2, "eco_score": 28}
                ],
                "recommendations": {
                    "cheapest": {"type": "bike", "label": "Fahrrad"},
                    "fastest": {"type": "vip", "label": "VIP Chauffeur"},
                    "balance": {"type": "scooter", "label": "E-Scooter"},
                    "eco": {"type": "bike", "label": "Fahrrad"}
                }
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify AI response structure
        assert "available" in data
        assert data["available"] == True, "AI should be available with EMERGENT_LLM_KEY"
        
        # Verify provider and model (primary fallback is openai/gpt-5.2)
        assert "provider" in data
        assert "model" in data
        assert data["provider"] in ["openai", "gemini", "anthropic"], f"Unexpected provider: {data['provider']}"
        
        # Verify German language response fields
        assert "headline" in data
        assert "summary" in data
        assert len(data["headline"]) > 0, "Headline should not be empty"
        assert len(data["summary"]) > 0, "Summary should not be empty"
        
        # Verify best option type is valid
        assert "best_option_type" in data
        valid_types = ["taxi", "scooter", "bike", "car_rental", "airport_shuttle", "vip"]
        if data["best_option_type"]:
            assert data["best_option_type"] in valid_types, f"Invalid best_option_type: {data['best_option_type']}"
        
        # Verify secondary option type if present
        if data.get("secondary_option_type"):
            assert data["secondary_option_type"] in valid_types, f"Invalid secondary_option_type: {data['secondary_option_type']}"
        
        # Verify confidence score
        assert "confidence" in data
        assert isinstance(data["confidence"], int)
        assert 0 <= data["confidence"] <= 100
        
        # Verify watchouts is a list
        assert "watchouts" in data
        assert isinstance(data["watchouts"], list)
    
    def test_ai_recommendation_primary_provider_gpt52(self, auth_session):
        """AI recommendation should use GPT-5.2 as primary provider"""
        response = auth_session.post(
            f"{BASE_URL}/api/mobility-platform/ai-recommendation",
            json={
                "pickup_address": "Pristina, Kosovo",
                "dropoff_address": "Flughafen Pristina",
                "distance_km": 18.5,
                "duration_min": 25,
                "options": [
                    {"type": "taxi", "label": "Taxi", "price_eur": 25.00, "duration_min": 25, "distance_km": 18.5, "eco_score": 55},
                    {"type": "airport_shuttle", "label": "Airport Shuttle", "price_eur": 12.00, "duration_min": 30, "distance_km": 18.5, "eco_score": 63}
                ],
                "recommendations": {
                    "cheapest": {"type": "airport_shuttle", "label": "Airport Shuttle"},
                    "fastest": {"type": "taxi", "label": "Taxi"}
                }
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Primary provider should be openai with gpt-5.2
        if data.get("available"):
            assert data.get("provider") == "openai", f"Expected openai as primary provider, got: {data.get('provider')}"
            assert data.get("model") == "gpt-5.2", f"Expected gpt-5.2 as model, got: {data.get('model')}"
    
    def test_ai_recommendation_empty_options_returns_400(self, auth_session):
        """AI recommendation with empty options returns 400 error"""
        response = auth_session.post(
            f"{BASE_URL}/api/mobility-platform/ai-recommendation",
            json={
                "pickup_address": "Berlin Mitte",
                "dropoff_address": "Berlin Zoo",
                "distance_km": 5.2,
                "duration_min": 12,
                "options": []  # Empty options should fail
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
    
    def test_ai_recommendation_german_language_response(self, auth_session):
        """AI recommendation returns German language response"""
        response = auth_session.post(
            f"{BASE_URL}/api/mobility-platform/ai-recommendation",
            json={
                "pickup_address": "München Hauptbahnhof",
                "dropoff_address": "Marienplatz",
                "distance_km": 2.1,
                "duration_min": 8,
                "options": [
                    {"type": "taxi", "label": "Taxi", "price_eur": 8.50, "duration_min": 8, "distance_km": 2.1, "eco_score": 55},
                    {"type": "bike", "label": "Fahrrad", "price_eur": 1.20, "duration_min": 12, "distance_km": 2.1, "eco_score": 96}
                ],
                "recommendations": {
                    "cheapest": {"type": "bike", "label": "Fahrrad"},
                    "fastest": {"type": "taxi", "label": "Taxi"}
                }
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        if data.get("available"):
            # Check for German language indicators in response
            summary = data.get("summary", "")
            headline = data.get("headline", "")
            combined = f"{headline} {summary}".lower()
            
            # German words that should appear in the response
            german_indicators = ["und", "für", "mit", "ist", "der", "die", "das", "ein", "eine", "bei", "oder", "als", "wenn", "km", "min"]
            has_german = any(word in combined for word in german_indicators)
            assert has_german, f"Response should be in German. Got: {combined[:200]}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
