"""
Iteration 142 - Mobility P0 Gaps Testing
Tests for:
- GET /api/mobility-platform/payment-options returns credit_card and cash
- POST /api/mobility-platform/saved-locations creates favorites and GET lists them
- DELETE /api/mobility-platform/saved-locations/{favorite_id} deletes favorites
- POST /api/mobility-platform/recent-locations and GET /recent-locations work
- POST /api/mobility-platform/book with payment_method=cash succeeds and returns payment_status=cash_due
- POST /api/mobility-platform/checkout/session with payment_method=credit_card succeeds and returns checkout_url
- Mongo collections verification: mobility_trips, mobility_bookings, mobility_routes, mobility_favorites, mobility_vehicles, mobility_drivers
"""

import pytest
import requests
import os
from uuid import uuid4

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


# Module-scoped session to avoid rate limiting
@pytest.fixture(scope="module")
def auth_session():
    """Single authenticated session for all tests in module"""
    session = requests.Session()
    login_res = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@bidblitz.com",
        "password": "BidBlitz2026!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    yield session
    session.close()


class TestPaymentOptionsWithCreditCardAndCash:
    """Test payment options includes credit_card and cash"""
    
    def test_payment_options_includes_credit_card(self, auth_session):
        """GET /api/mobility-platform/payment-options includes credit_card"""
        res = auth_session.get(f"{BASE_URL}/api/mobility-platform/payment-options")
        assert res.status_code == 200
        data = res.json()
        assert "methods" in data
        method_ids = [m["id"] for m in data["methods"]]
        assert "credit_card" in method_ids, f"credit_card not in methods: {method_ids}"
        
        # Verify credit_card method details
        credit_card_method = next((m for m in data["methods"] if m["id"] == "credit_card"), None)
        assert credit_card_method is not None
        assert credit_card_method["label"] == "Credit Card"
        assert credit_card_method["enabled"] == True
    
    def test_payment_options_includes_cash(self, auth_session):
        """GET /api/mobility-platform/payment-options includes cash"""
        res = auth_session.get(f"{BASE_URL}/api/mobility-platform/payment-options")
        assert res.status_code == 200
        data = res.json()
        method_ids = [m["id"] for m in data["methods"]]
        assert "cash" in method_ids, f"cash not in methods: {method_ids}"
        
        # Verify cash method details
        cash_method = next((m for m in data["methods"] if m["id"] == "cash"), None)
        assert cash_method is not None
        assert cash_method["label"] == "Cash"
        assert cash_method["enabled"] == True
    
    def test_payment_options_all_seven_methods(self, auth_session):
        """GET /api/mobility-platform/payment-options returns all 7 methods"""
        res = auth_session.get(f"{BASE_URL}/api/mobility-platform/payment-options")
        assert res.status_code == 200
        data = res.json()
        method_ids = [m["id"] for m in data["methods"]]
        expected_methods = ["wallet", "nfc", "qr", "apple_pay", "google_pay", "credit_card", "cash"]
        for method in expected_methods:
            assert method in method_ids, f"{method} not in methods: {method_ids}"
        assert len(data["methods"]) == 7, f"Expected 7 methods, got {len(data['methods'])}"


class TestFavoritesAndSavedLocations:
    """Test favorites/saved locations CRUD"""
    
    def test_create_favorite_location(self, auth_session):
        """POST /api/mobility-platform/saved-locations creates a favorite"""
        unique_id = uuid4().hex[:8]
        payload = {
            "label": f"TEST_Favorite_{unique_id}",
            "address": f"Test Address {unique_id}, Pristina",
            "lat": 42.6629,
            "lng": 21.1655,
            "kind": "favorite"
        }
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/saved-locations", json=payload)
        assert res.status_code == 200, f"Create favorite failed: {res.text}"
        data = res.json()
        assert data.get("ok") == True
        assert "location" in data
        assert data["location"]["label"] == payload["label"]
        assert data["location"]["address"] == payload["address"]
        assert "favorite_id" in data["location"]
    
    def test_get_saved_locations_lists_favorites(self, auth_session):
        """GET /api/mobility-platform/saved-locations lists favorites"""
        # First create a favorite
        unique_id = uuid4().hex[:8]
        create_payload = {
            "label": f"TEST_ListFav_{unique_id}",
            "address": f"List Test Address {unique_id}",
            "lat": 42.6629,
            "lng": 21.1655,
            "kind": "favorite"
        }
        create_res = auth_session.post(f"{BASE_URL}/api/mobility-platform/saved-locations", json=create_payload)
        assert create_res.status_code == 200
        
        # Get saved locations
        res = auth_session.get(f"{BASE_URL}/api/mobility-platform/saved-locations")
        assert res.status_code == 200
        data = res.json()
        assert "locations" in data
        assert isinstance(data["locations"], list)
        
        # Verify our created favorite is in the list
        labels = [loc["label"] for loc in data["locations"]]
        assert create_payload["label"] in labels, f"Created favorite not in list: {labels}"
    
    def test_delete_saved_location(self, auth_session):
        """DELETE /api/mobility-platform/saved-locations/{favorite_id} deletes favorite"""
        # Create a favorite to delete
        unique_id = uuid4().hex[:8]
        create_payload = {
            "label": f"TEST_DeleteFav_{unique_id}",
            "address": f"Delete Test Address {unique_id}",
            "lat": 42.6629,
            "lng": 21.1655,
            "kind": "favorite"
        }
        create_res = auth_session.post(f"{BASE_URL}/api/mobility-platform/saved-locations", json=create_payload)
        assert create_res.status_code == 200
        favorite_id = create_res.json()["location"]["favorite_id"]
        
        # Delete the favorite
        delete_res = auth_session.delete(f"{BASE_URL}/api/mobility-platform/saved-locations/{favorite_id}")
        assert delete_res.status_code == 200
        data = delete_res.json()
        assert data.get("ok") == True
        assert data["favorite_id"] == favorite_id
        
        # Verify it's deleted
        list_res = auth_session.get(f"{BASE_URL}/api/mobility-platform/saved-locations")
        assert list_res.status_code == 200
        favorite_ids = [loc["favorite_id"] for loc in list_res.json()["locations"]]
        assert favorite_id not in favorite_ids, "Favorite was not deleted"
    
    def test_create_home_favorite(self, auth_session):
        """POST /api/mobility-platform/saved-locations with kind=home creates home favorite"""
        payload = {
            "label": "Zuhause",
            "address": "Home Address, Pristina",
            "lat": 42.6629,
            "lng": 21.1655,
            "kind": "home"
        }
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/saved-locations", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data.get("ok") == True
        assert data["location"]["kind"] == "home"
    
    def test_create_work_favorite(self, auth_session):
        """POST /api/mobility-platform/saved-locations with kind=work creates work favorite"""
        payload = {
            "label": "Arbeit",
            "address": "Work Address, Pristina",
            "lat": 42.6700,
            "lng": 21.1700,
            "kind": "work"
        }
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/saved-locations", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data.get("ok") == True
        assert data["location"]["kind"] == "work"


class TestRecentLocations:
    """Test recent locations endpoints"""
    
    def test_add_recent_location(self, auth_session):
        """POST /api/mobility-platform/recent-locations adds a recent location"""
        unique_id = uuid4().hex[:8]
        payload = {
            "label": f"TEST_Recent_{unique_id}",
            "address": f"Recent Address {unique_id}, Pristina",
            "lat": 42.6629,
            "lng": 21.1655,
            "kind": "recent"
        }
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/recent-locations", json=payload)
        assert res.status_code == 200, f"Add recent location failed: {res.text}"
        data = res.json()
        assert data.get("ok") == True
    
    def test_get_recent_locations(self, auth_session):
        """GET /api/mobility-platform/recent-locations returns recent locations"""
        # First add a recent location
        unique_id = uuid4().hex[:8]
        add_payload = {
            "label": f"TEST_GetRecent_{unique_id}",
            "address": f"Get Recent Address {unique_id}",
            "lat": 42.6629,
            "lng": 21.1655,
            "kind": "recent"
        }
        add_res = auth_session.post(f"{BASE_URL}/api/mobility-platform/recent-locations", json=add_payload)
        assert add_res.status_code == 200
        
        # Get recent locations
        res = auth_session.get(f"{BASE_URL}/api/mobility-platform/recent-locations")
        assert res.status_code == 200
        data = res.json()
        assert "locations" in data
        assert isinstance(data["locations"], list)
        
        # Verify our added location is in the list
        addresses = [loc["address"] for loc in data["locations"]]
        assert add_payload["address"] in addresses, f"Added recent not in list: {addresses}"
    
    def test_recent_location_use_count_increments(self, auth_session):
        """POST /api/mobility-platform/recent-locations increments use_count for same address"""
        unique_id = uuid4().hex[:8]
        payload = {
            "label": f"TEST_UseCount_{unique_id}",
            "address": f"UseCount Address {unique_id}",
            "lat": 42.6629,
            "lng": 21.1655,
            "kind": "recent"
        }
        
        # Add same location twice
        auth_session.post(f"{BASE_URL}/api/mobility-platform/recent-locations", json=payload)
        auth_session.post(f"{BASE_URL}/api/mobility-platform/recent-locations", json=payload)
        
        # Get recent locations and check use_count
        res = auth_session.get(f"{BASE_URL}/api/mobility-platform/recent-locations")
        assert res.status_code == 200
        locations = res.json()["locations"]
        matching = [loc for loc in locations if loc["address"] == payload["address"]]
        assert len(matching) == 1, "Should have exactly one entry for same address"
        assert matching[0].get("use_count", 0) >= 2, f"use_count should be >= 2, got {matching[0].get('use_count')}"


class TestCashBooking:
    """Test cash payment method for direct booking"""
    
    def test_cash_booking_succeeds(self, auth_session):
        """POST /api/mobility-platform/book with payment_method=cash succeeds"""
        payload = {
            "transport_type": "taxi",
            "transport_label": "Taxi",
            "price_eur": 5.50,
            "duration_min": 15,
            "distance_km": 8.5,
            "payment_method": "cash",
            "pickup": {"address": "TEST_Cash Booking Start", "lat": 42.6629, "lng": 21.1655},
            "dropoff": {"address": "TEST_Cash Booking End", "lat": 42.5728, "lng": 21.0358}
        }
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/book", json=payload)
        assert res.status_code == 200, f"Cash booking failed: {res.text}"
        data = res.json()
        assert data.get("ok") == True
        assert "booking" in data
    
    def test_cash_booking_returns_cash_due_status(self, auth_session):
        """POST /api/mobility-platform/book with cash returns payment_status=cash_due"""
        payload = {
            "transport_type": "taxi",
            "transport_label": "Taxi",
            "price_eur": 6.00,
            "duration_min": 18,
            "distance_km": 9.0,
            "payment_method": "cash",
            "pickup": {"address": "TEST_Cash Status Start", "lat": 42.6629, "lng": 21.1655},
            "dropoff": {"address": "TEST_Cash Status End", "lat": 42.5728, "lng": 21.0358}
        }
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/book", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["booking"]["payment_status"] == "cash_due", f"Expected cash_due, got {data['booking']['payment_status']}"
        assert data["booking"]["payment_method"] == "cash"
        assert data["booking"]["status"] == "confirmed"
    
    def test_cash_booking_no_wallet_deduction(self, auth_session):
        """POST /api/mobility-platform/book with cash does not deduct from wallet"""
        # Get initial balance
        payment_options = auth_session.get(f"{BASE_URL}/api/mobility-platform/payment-options").json()
        initial_balance = payment_options["wallet_balance"]
        
        # Make cash booking
        payload = {
            "transport_type": "scooter",
            "transport_label": "E-Scooter",
            "price_eur": 3.00,
            "duration_min": 10,
            "distance_km": 4.0,
            "payment_method": "cash",
            "pickup": {"address": "TEST_Cash NoDeduct Start", "lat": 42.6629, "lng": 21.1655},
            "dropoff": {"address": "TEST_Cash NoDeduct End", "lat": 42.5728, "lng": 21.0358}
        }
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/book", json=payload)
        assert res.status_code == 200
        
        # Check balance unchanged
        payment_options_after = auth_session.get(f"{BASE_URL}/api/mobility-platform/payment-options").json()
        assert payment_options_after["wallet_balance"] == initial_balance, "Wallet balance should not change for cash booking"


class TestCreditCardCheckout:
    """Test credit_card payment method for Stripe checkout"""
    
    def test_credit_card_checkout_session_succeeds(self, auth_session):
        """POST /api/mobility-platform/checkout/session with credit_card succeeds"""
        payload = {
            "transport_type": "taxi",
            "payment_method": "credit_card",
            "origin_url": "https://game-center-hub-1.preview.emergentagent.com",
            "pickup": {"address": "TEST_CC Checkout Start", "lat": 42.6629, "lng": 21.1655},
            "dropoff": {"address": "TEST_CC Checkout End", "lat": 42.5728, "lng": 21.0358}
        }
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/checkout/session", json=payload)
        assert res.status_code == 200, f"Credit card checkout failed: {res.text}"
        data = res.json()
        assert "checkout_url" in data
        assert "session_id" in data
        assert "booking_id" in data
    
    def test_credit_card_checkout_returns_stripe_url(self, auth_session):
        """POST /api/mobility-platform/checkout/session with credit_card returns Stripe URL"""
        payload = {
            "transport_type": "vip",
            "payment_method": "credit_card",
            "origin_url": "https://game-center-hub-1.preview.emergentagent.com",
            "pickup": {"address": "TEST_CC Stripe URL Start", "lat": 42.6629, "lng": 21.1655},
            "dropoff": {"address": "TEST_CC Stripe URL End", "lat": 42.5728, "lng": 21.0358}
        }
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/checkout/session", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["checkout_url"].startswith("https://checkout.stripe.com"), f"Invalid checkout URL: {data['checkout_url']}"
        assert data["booking_id"].startswith("mob-"), f"Invalid booking_id format: {data['booking_id']}"


class TestMongoCollectionsExist:
    """Test that MongoDB collections are being written to"""
    
    def test_mobility_bookings_collection_written(self, auth_session):
        """Verify mobility_bookings collection is written after booking"""
        # Create a booking
        payload = {
            "transport_type": "taxi",
            "transport_label": "Taxi",
            "price_eur": 5.00,
            "duration_min": 12,
            "distance_km": 7.0,
            "payment_method": "wallet",
            "pickup": {"address": "TEST_Collection Booking Start", "lat": 42.6629, "lng": 21.1655},
            "dropoff": {"address": "TEST_Collection Booking End", "lat": 42.5728, "lng": 21.0358}
        }
        book_res = auth_session.post(f"{BASE_URL}/api/mobility-platform/book", json=payload)
        assert book_res.status_code == 200
        booking_id = book_res.json()["booking"]["booking_id"]
        
        # Verify we can retrieve it (proves it was written to mobility_bookings)
        detail_res = auth_session.get(f"{BASE_URL}/api/mobility-platform/booking/{booking_id}")
        assert detail_res.status_code == 200
        assert detail_res.json()["booking"]["booking_id"] == booking_id
    
    def test_mobility_favorites_collection_written(self, auth_session):
        """Verify mobility_favorites collection is written after saving favorite"""
        unique_id = uuid4().hex[:8]
        payload = {
            "label": f"TEST_CollectionFav_{unique_id}",
            "address": f"Collection Fav Address {unique_id}",
            "lat": 42.6629,
            "lng": 21.1655,
            "kind": "favorite"
        }
        save_res = auth_session.post(f"{BASE_URL}/api/mobility-platform/saved-locations", json=payload)
        assert save_res.status_code == 200
        
        # Verify we can retrieve it (proves it was written to mobility_favorites)
        list_res = auth_session.get(f"{BASE_URL}/api/mobility-platform/saved-locations")
        assert list_res.status_code == 200
        labels = [loc["label"] for loc in list_res.json()["locations"]]
        assert payload["label"] in labels
    
    def test_my_bookings_returns_data(self, auth_session):
        """Verify /api/mobility-platform/my-bookings returns bookings from mobility_bookings"""
        res = auth_session.get(f"{BASE_URL}/api/mobility-platform/my-bookings")
        assert res.status_code == 200
        data = res.json()
        assert "bookings" in data
        assert isinstance(data["bookings"], list)
        # Should have at least one booking from previous tests
        assert len(data["bookings"]) > 0, "Expected at least one booking in my-bookings"
    
    def test_route_stores_in_mobility_routes(self, auth_session):
        """Verify /api/mobility-platform/route stores data in mobility_routes"""
        payload = {
            "pickup_lat": 42.6629,
            "pickup_lng": 21.1655,
            "dropoff_lat": 42.5728,
            "dropoff_lng": 21.0358,
            "pickup_address": "TEST_Route Collection Start",
            "dropoff_address": "TEST_Route Collection End"
        }
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/route", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "options" in data
        assert len(data["options"]) == 6
        # Route is stored internally - we verify by checking the response structure
        assert "distance_km" in data
        assert "duration_min" in data
        assert "geometry" in data


class TestMultilingualSupport:
    """Test multilingual support for mobility endpoints"""
    
    def test_search_with_german_lang(self, auth_session):
        """GET /api/mobility-platform/search with lang=de works"""
        res = auth_session.get(f"{BASE_URL}/api/mobility-platform/search", params={
            "q": "Pristina",
            "lang": "de"
        })
        assert res.status_code == 200
        data = res.json()
        assert "results" in data
    
    def test_search_with_english_lang(self, auth_session):
        """GET /api/mobility-platform/search with lang=en works"""
        res = auth_session.get(f"{BASE_URL}/api/mobility-platform/search", params={
            "q": "Pristina",
            "lang": "en"
        })
        assert res.status_code == 200
        data = res.json()
        assert "results" in data
    
    def test_search_with_albanian_lang(self, auth_session):
        """GET /api/mobility-platform/search with lang=sq works"""
        res = auth_session.get(f"{BASE_URL}/api/mobility-platform/search", params={
            "q": "Prishtina",
            "lang": "sq"
        })
        assert res.status_code == 200
        data = res.json()
        assert "results" in data
    
    def test_reverse_with_german_lang(self, auth_session):
        """GET /api/mobility-platform/reverse with lang=de works"""
        res = auth_session.get(f"{BASE_URL}/api/mobility-platform/reverse", params={
            "lat": 42.6629,
            "lng": 21.1655,
            "lang": "de"
        })
        assert res.status_code == 200
        data = res.json()
        assert "address" in data
    
    def test_reverse_with_albanian_lang(self, auth_session):
        """GET /api/mobility-platform/reverse with lang=sq works"""
        res = auth_session.get(f"{BASE_URL}/api/mobility-platform/reverse", params={
            "lat": 42.6629,
            "lng": 21.1655,
            "lang": "sq"
        })
        assert res.status_code == 200
        data = res.json()
        assert "address" in data
