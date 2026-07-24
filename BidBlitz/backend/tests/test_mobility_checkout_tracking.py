"""
Iteration 141 - Mobility Checkout & Tracking Tests
Tests for:
- GET/POST /api/mobility-platform/preferences (AI preferences persistence)
- POST /api/mobility-platform/checkout/session (Stripe checkout session)
- GET /api/mobility-platform/booking/{booking_id} (Tracking data)
- POST /api/mobility-platform/booking/{booking_id}/cancel (Cancel booking)
- Regression: /api/mobility-platform/route and /api/mobility-platform/ai-recommendation
"""

import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

class TestMobilityPreferences:
    """Test AI preferences persistence"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        # Login as admin
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.com",
            "password": "BidBlitz2026!"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        yield
        self.session.close()
    
    def test_get_preferences_default(self):
        """GET /api/mobility-platform/preferences returns default preferences"""
        res = self.session.get(f"{BASE_URL}/api/mobility-platform/preferences")
        assert res.status_code == 200
        data = res.json()
        assert "preferences" in data
        prefs = data["preferences"]
        assert "priority" in prefs
        assert "luggage" in prefs
        assert "childSeat" in prefs
    
    def test_post_preferences_saves(self):
        """POST /api/mobility-platform/preferences saves preferences"""
        payload = {
            "priority": "fastest",
            "luggage": True,
            "childSeat": False
        }
        res = self.session.post(f"{BASE_URL}/api/mobility-platform/preferences", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data.get("ok") == True
        assert data["preferences"]["priority"] == "fastest"
        assert data["preferences"]["luggage"] == True
        assert data["preferences"]["childSeat"] == False
    
    def test_preferences_persist_after_save(self):
        """Preferences persist after saving"""
        # Save new preferences
        payload = {
            "priority": "eco",
            "luggage": False,
            "childSeat": True
        }
        save_res = self.session.post(f"{BASE_URL}/api/mobility-platform/preferences", json=payload)
        assert save_res.status_code == 200
        
        # Verify they persist
        get_res = self.session.get(f"{BASE_URL}/api/mobility-platform/preferences")
        assert get_res.status_code == 200
        data = get_res.json()
        assert data["preferences"]["priority"] == "eco"
        assert data["preferences"]["luggage"] == False
        assert data["preferences"]["childSeat"] == True


class TestMobilityCheckoutSession:
    """Test Stripe checkout session creation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.com",
            "password": "BidBlitz2026!"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        yield
        self.session.close()
    
    def test_checkout_session_qr_method(self):
        """POST /api/mobility-platform/checkout/session creates Stripe session for QR"""
        payload = {
            "transport_type": "taxi",
            "payment_method": "qr",
            "origin_url": "https://super-app-staging-2.preview.emergentagent.com",
            "pickup": {"address": "Pristina Center", "lat": 42.6629, "lng": 21.1655},
            "dropoff": {"address": "Pristina Airport", "lat": 42.5728, "lng": 21.0358},
            "preferences": {"priority": "balance", "luggage": False, "childSeat": False},
            "ai_recommendation": None
        }
        res = self.session.post(f"{BASE_URL}/api/mobility-platform/checkout/session", json=payload)
        assert res.status_code == 200, f"Checkout session failed: {res.text}"
        data = res.json()
        assert "checkout_url" in data, "Missing checkout_url"
        assert "session_id" in data, "Missing session_id"
        assert "booking_id" in data, "Missing booking_id"
        assert data["checkout_url"].startswith("https://checkout.stripe.com"), f"Invalid checkout URL: {data['checkout_url']}"
        assert data["booking_id"].startswith("mob-"), f"Invalid booking_id format: {data['booking_id']}"
    
    def test_checkout_session_apple_pay(self):
        """POST /api/mobility-platform/checkout/session creates Stripe session for Apple Pay"""
        payload = {
            "transport_type": "scooter",
            "payment_method": "apple_pay",
            "origin_url": "https://super-app-staging-2.preview.emergentagent.com",
            "pickup": {"address": "Pristina Center", "lat": 42.6629, "lng": 21.1655},
            "dropoff": {"address": "Pristina Airport", "lat": 42.5728, "lng": 21.0358}
        }
        res = self.session.post(f"{BASE_URL}/api/mobility-platform/checkout/session", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "checkout_url" in data
        assert "session_id" in data
        assert "booking_id" in data
    
    def test_checkout_session_google_pay(self):
        """POST /api/mobility-platform/checkout/session creates Stripe session for Google Pay"""
        payload = {
            "transport_type": "car_rental",
            "payment_method": "google_pay",
            "origin_url": "https://super-app-staging-2.preview.emergentagent.com",
            "pickup": {"address": "Pristina Center", "lat": 42.6629, "lng": 21.1655},
            "dropoff": {"address": "Pristina Airport", "lat": 42.5728, "lng": 21.0358}
        }
        res = self.session.post(f"{BASE_URL}/api/mobility-platform/checkout/session", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "checkout_url" in data
        assert "session_id" in data
    
    def test_checkout_session_nfc(self):
        """POST /api/mobility-platform/checkout/session creates Stripe session for NFC"""
        payload = {
            "transport_type": "vip",
            "payment_method": "nfc",
            "origin_url": "https://super-app-staging-2.preview.emergentagent.com",
            "pickup": {"address": "Pristina Center", "lat": 42.6629, "lng": 21.1655},
            "dropoff": {"address": "Pristina Airport", "lat": 42.5728, "lng": 21.0358}
        }
        res = self.session.post(f"{BASE_URL}/api/mobility-platform/checkout/session", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "checkout_url" in data


class TestMobilityBookingTracking:
    """Test booking detail and tracking endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.com",
            "password": "BidBlitz2026!"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        yield
        self.session.close()
    
    def test_get_booking_detail(self):
        """GET /api/mobility-platform/booking/{booking_id} returns tracking data"""
        # First create a booking via wallet
        book_payload = {
            "transport_type": "taxi",
            "transport_label": "Taxi",
            "price_eur": 5.50,
            "duration_min": 15,
            "distance_km": 8.5,
            "payment_method": "wallet",
            "pickup": {"address": "TEST_Pristina Center", "lat": 42.6629, "lng": 21.1655},
            "dropoff": {"address": "TEST_Pristina Airport", "lat": 42.5728, "lng": 21.0358}
        }
        book_res = self.session.post(f"{BASE_URL}/api/mobility-platform/book", json=book_payload)
        assert book_res.status_code == 200, f"Booking failed: {book_res.text}"
        booking_id = book_res.json()["booking"]["booking_id"]
        
        # Get booking detail
        detail_res = self.session.get(f"{BASE_URL}/api/mobility-platform/booking/{booking_id}")
        assert detail_res.status_code == 200
        data = detail_res.json()
        
        # Verify booking data
        assert "booking" in data
        assert data["booking"]["booking_id"] == booking_id
        assert data["booking"]["transport_type"] == "taxi"
        assert data["booking"]["status"] == "confirmed"
        
        # Verify tracking data
        assert "tracking" in data
        assert "status" in data["tracking"]
        assert "eta_minutes" in data["tracking"]
        assert "can_cancel" in data["tracking"]
    
    def test_booking_detail_not_found(self):
        """GET /api/mobility-platform/booking/{invalid_id} returns 404"""
        res = self.session.get(f"{BASE_URL}/api/mobility-platform/booking/invalid-booking-id")
        assert res.status_code == 404
    
    def test_cancel_booking(self):
        """POST /api/mobility-platform/booking/{booking_id}/cancel cancels booking"""
        # Create a booking
        book_payload = {
            "transport_type": "scooter",
            "transport_label": "E-Scooter",
            "price_eur": 2.80,
            "duration_min": 10,
            "distance_km": 3.2,
            "payment_method": "wallet",
            "pickup": {"address": "TEST_Cancel Start", "lat": 42.6629, "lng": 21.1655},
            "dropoff": {"address": "TEST_Cancel End", "lat": 42.5728, "lng": 21.0358}
        }
        book_res = self.session.post(f"{BASE_URL}/api/mobility-platform/book", json=book_payload)
        assert book_res.status_code == 200
        booking_id = book_res.json()["booking"]["booking_id"]
        
        # Cancel the booking
        cancel_res = self.session.post(f"{BASE_URL}/api/mobility-platform/booking/{booking_id}/cancel")
        assert cancel_res.status_code == 200
        data = cancel_res.json()
        assert data.get("ok") == True
        assert data["status"] == "cancelled"
        
        # Verify booking is cancelled
        detail_res = self.session.get(f"{BASE_URL}/api/mobility-platform/booking/{booking_id}")
        assert detail_res.status_code == 200
        assert detail_res.json()["booking"]["status"] == "cancelled"
    
    def test_cancel_already_cancelled_fails(self):
        """POST /api/mobility-platform/booking/{booking_id}/cancel fails for already cancelled"""
        # Create and cancel a booking
        book_payload = {
            "transport_type": "bike",
            "transport_label": "Fahrrad",
            "price_eur": 1.50,
            "duration_min": 20,
            "distance_km": 5.0,
            "payment_method": "wallet",
            "pickup": {"address": "TEST_Double Cancel Start", "lat": 42.6629, "lng": 21.1655},
            "dropoff": {"address": "TEST_Double Cancel End", "lat": 42.5728, "lng": 21.0358}
        }
        book_res = self.session.post(f"{BASE_URL}/api/mobility-platform/book", json=book_payload)
        assert book_res.status_code == 200
        booking_id = book_res.json()["booking"]["booking_id"]
        
        # First cancel
        cancel_res1 = self.session.post(f"{BASE_URL}/api/mobility-platform/booking/{booking_id}/cancel")
        assert cancel_res1.status_code == 200
        
        # Second cancel should fail
        cancel_res2 = self.session.post(f"{BASE_URL}/api/mobility-platform/booking/{booking_id}/cancel")
        assert cancel_res2.status_code == 400


class TestWalletBookingStillWorks:
    """Regression: Wallet booking still works"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.com",
            "password": "BidBlitz2026!"
        })
        assert login_res.status_code == 200
        yield
        self.session.close()
    
    def test_wallet_booking_works(self):
        """POST /api/mobility-platform/book with wallet payment works"""
        payload = {
            "transport_type": "taxi",
            "transport_label": "Taxi",
            "price_eur": 4.50,
            "duration_min": 12,
            "distance_km": 6.0,
            "payment_method": "wallet",
            "pickup": {"address": "TEST_Wallet Booking Start", "lat": 42.6629, "lng": 21.1655},
            "dropoff": {"address": "TEST_Wallet Booking End", "lat": 42.5728, "lng": 21.0358}
        }
        res = self.session.post(f"{BASE_URL}/api/mobility-platform/book", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data.get("ok") == True
        assert "booking" in data
        assert "new_balance" in data
        assert data["booking"]["status"] == "confirmed"
        assert data["booking"]["payment_status"] == "paid"


class TestRegressionRouteAndAI:
    """Regression: Route and AI recommendation endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.com",
            "password": "BidBlitz2026!"
        })
        assert login_res.status_code == 200
        yield
        self.session.close()
    
    def test_route_endpoint_works(self):
        """POST /api/mobility-platform/route returns transport options"""
        payload = {
            "pickup_lat": 42.6629,
            "pickup_lng": 21.1655,
            "dropoff_lat": 42.5728,
            "dropoff_lng": 21.0358,
            "pickup_address": "Pristina Center",
            "dropoff_address": "Pristina Airport"
        }
        res = self.session.post(f"{BASE_URL}/api/mobility-platform/route", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "options" in data
        assert len(data["options"]) == 6  # 6 transport types
        assert "recommendations" in data
        assert "distance_km" in data
        assert "duration_min" in data
    
    def test_ai_recommendation_works(self):
        """POST /api/mobility-platform/ai-recommendation returns AI response"""
        # First get route options
        route_payload = {
            "pickup_lat": 42.6629,
            "pickup_lng": 21.1655,
            "dropoff_lat": 42.5728,
            "dropoff_lng": 21.0358,
            "pickup_address": "Pristina Center",
            "dropoff_address": "Pristina Airport"
        }
        route_res = self.session.post(f"{BASE_URL}/api/mobility-platform/route", json=route_payload)
        assert route_res.status_code == 200
        route_data = route_res.json()
        
        # Get AI recommendation
        ai_payload = {
            "pickup_address": "Pristina Center",
            "dropoff_address": "Pristina Airport",
            "distance_km": route_data["distance_km"],
            "duration_min": route_data["duration_min"],
            "options": route_data["options"],
            "recommendations": route_data["recommendations"],
            "preferences": {"priority": "balance", "luggage": False, "childSeat": False}
        }
        ai_res = self.session.post(f"{BASE_URL}/api/mobility-platform/ai-recommendation", json=ai_payload)
        assert ai_res.status_code == 200
        data = ai_res.json()
        assert "headline" in data
        assert "summary" in data


class TestPaymentOptions:
    """Test payment options endpoint returns all methods"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.com",
            "password": "BidBlitz2026!"
        })
        assert login_res.status_code == 200
        yield
        self.session.close()
    
    def test_payment_options_returns_all_methods(self):
        """GET /api/mobility-platform/payment-options returns wallet, nfc, qr, apple_pay, google_pay"""
        res = self.session.get(f"{BASE_URL}/api/mobility-platform/payment-options")
        assert res.status_code == 200
        data = res.json()
        assert "wallet_balance" in data
        assert "methods" in data
        method_ids = [m["id"] for m in data["methods"]]
        assert "wallet" in method_ids
        assert "nfc" in method_ids
        assert "qr" in method_ids
        assert "apple_pay" in method_ids
        assert "google_pay" in method_ids
