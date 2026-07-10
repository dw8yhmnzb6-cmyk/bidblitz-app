"""
Iteration 156 - Mobility Booking Tracking Tests
Tests for the new tracking payload with live_status, phase_label, next_event_label, 
progress_percent, timeline and route_points.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://swipe-match-chat-8.preview.emergentagent.com"

# Test credentials
MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PASSWORD = "Haendler2026!"
TEST_BOOKING_ID = "mob-c3970bb1ccbb"


@pytest.fixture(scope="module")
def merchant_session():
    """Login as merchant and return session with cookies"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": MERCHANT_EMAIL,
        "password": MERCHANT_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return session


class TestMobilityBookingDetailTracking:
    """Tests for GET /api/mobility-platform/booking/{booking_id} tracking payload"""
    
    def test_booking_detail_returns_200(self, merchant_session):
        """Booking detail endpoint returns 200 OK"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/booking/{TEST_BOOKING_ID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_booking_detail_has_tracking_object(self, merchant_session):
        """Response contains tracking object"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/booking/{TEST_BOOKING_ID}")
        data = response.json()
        assert "tracking" in data, "Response missing 'tracking' object"
        assert data["tracking"] is not None, "Tracking object is None"
    
    def test_tracking_has_live_status(self, merchant_session):
        """Tracking contains live_status field"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/booking/{TEST_BOOKING_ID}")
        tracking = response.json().get("tracking", {})
        assert "live_status" in tracking, "Tracking missing 'live_status'"
        assert tracking["live_status"] in [
            "payment_pending", "confirmed", "resource_assigned", 
            "en_route", "almost_arrived", "completed", "cancelled"
        ], f"Invalid live_status: {tracking['live_status']}"
    
    def test_tracking_has_phase_label(self, merchant_session):
        """Tracking contains phase_label field"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/booking/{TEST_BOOKING_ID}")
        tracking = response.json().get("tracking", {})
        assert "phase_label" in tracking, "Tracking missing 'phase_label'"
        assert isinstance(tracking["phase_label"], str), "phase_label should be string"
        assert len(tracking["phase_label"]) > 0, "phase_label should not be empty"
    
    def test_tracking_has_next_event_label(self, merchant_session):
        """Tracking contains next_event_label field"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/booking/{TEST_BOOKING_ID}")
        tracking = response.json().get("tracking", {})
        assert "next_event_label" in tracking, "Tracking missing 'next_event_label'"
        assert isinstance(tracking["next_event_label"], str), "next_event_label should be string"
        assert len(tracking["next_event_label"]) > 0, "next_event_label should not be empty"
    
    def test_tracking_has_progress_percent(self, merchant_session):
        """Tracking contains progress_percent field"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/booking/{TEST_BOOKING_ID}")
        tracking = response.json().get("tracking", {})
        assert "progress_percent" in tracking, "Tracking missing 'progress_percent'"
        assert isinstance(tracking["progress_percent"], int), "progress_percent should be int"
        assert 0 <= tracking["progress_percent"] <= 100, f"progress_percent out of range: {tracking['progress_percent']}"
    
    def test_tracking_has_timeline(self, merchant_session):
        """Tracking contains timeline array"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/booking/{TEST_BOOKING_ID}")
        tracking = response.json().get("tracking", {})
        assert "timeline" in tracking, "Tracking missing 'timeline'"
        assert isinstance(tracking["timeline"], list), "timeline should be list"
        assert len(tracking["timeline"]) >= 5, f"timeline should have at least 5 steps, got {len(tracking['timeline'])}"
    
    def test_timeline_step_structure(self, merchant_session):
        """Each timeline step has required fields"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/booking/{TEST_BOOKING_ID}")
        tracking = response.json().get("tracking", {})
        timeline = tracking.get("timeline", [])
        
        for step in timeline:
            assert "id" in step, "Timeline step missing 'id'"
            assert "label" in step, "Timeline step missing 'label'"
            assert "detail" in step, "Timeline step missing 'detail'"
            assert "done" in step, "Timeline step missing 'done'"
            assert "active" in step, "Timeline step missing 'active'"
            assert isinstance(step["done"], bool), "done should be boolean"
            assert isinstance(step["active"], bool), "active should be boolean"
    
    def test_tracking_has_route_points(self, merchant_session):
        """Tracking contains route_points array"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/booking/{TEST_BOOKING_ID}")
        tracking = response.json().get("tracking", {})
        assert "route_points" in tracking, "Tracking missing 'route_points'"
        assert isinstance(tracking["route_points"], list), "route_points should be list"
    
    def test_route_points_structure(self, merchant_session):
        """Route points have lat/lng coordinates"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/booking/{TEST_BOOKING_ID}")
        tracking = response.json().get("tracking", {})
        route_points = tracking.get("route_points", [])
        
        if len(route_points) > 0:
            for point in route_points[:5]:  # Check first 5 points
                assert "lat" in point, "Route point missing 'lat'"
                assert "lng" in point, "Route point missing 'lng'"
                assert isinstance(point["lat"], (int, float)), "lat should be numeric"
                assert isinstance(point["lng"], (int, float)), "lng should be numeric"
    
    def test_tracking_has_assigned_resource_with_live_position(self, merchant_session):
        """Assigned resource contains live_position"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/booking/{TEST_BOOKING_ID}")
        tracking = response.json().get("tracking", {})
        resource = tracking.get("assigned_resource", {})
        
        assert resource is not None, "assigned_resource should not be None"
        # live_position is interpolated based on progress
        if "live_position" in resource:
            assert "lat" in resource["live_position"], "live_position missing 'lat'"
            assert "lng" in resource["live_position"], "live_position missing 'lng'"
    
    def test_tracking_has_eta_minutes(self, merchant_session):
        """Tracking contains eta_minutes"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/booking/{TEST_BOOKING_ID}")
        tracking = response.json().get("tracking", {})
        assert "eta_minutes" in tracking, "Tracking missing 'eta_minutes'"
        assert isinstance(tracking["eta_minutes"], int), "eta_minutes should be int"
        assert tracking["eta_minutes"] >= 0, "eta_minutes should be non-negative"
    
    def test_tracking_has_can_cancel(self, merchant_session):
        """Tracking contains can_cancel flag"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/booking/{TEST_BOOKING_ID}")
        tracking = response.json().get("tracking", {})
        assert "can_cancel" in tracking, "Tracking missing 'can_cancel'"
        assert isinstance(tracking["can_cancel"], bool), "can_cancel should be boolean"


class TestMobilityMyBookings:
    """Tests for GET /api/mobility-platform/my-bookings"""
    
    def test_my_bookings_returns_200(self, merchant_session):
        """My bookings endpoint returns 200 OK"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/my-bookings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_my_bookings_has_bookings_array(self, merchant_session):
        """Response contains bookings array"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/my-bookings")
        data = response.json()
        assert "bookings" in data, "Response missing 'bookings'"
        assert isinstance(data["bookings"], list), "bookings should be list"
    
    def test_booking_has_status_for_tracking_entry(self, merchant_session):
        """Bookings have status field for Tracking Entry Card"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/my-bookings")
        bookings = response.json().get("bookings", [])
        
        if len(bookings) > 0:
            booking = bookings[0]
            assert "status" in booking, "Booking missing 'status'"
            assert "transport_label" in booking, "Booking missing 'transport_label'"
            assert "pickup" in booking, "Booking missing 'pickup'"
            assert "dropoff" in booking, "Booking missing 'dropoff'"


class TestMobilityEndpointsNoErrors:
    """Tests to ensure no 500 errors on mobility endpoints"""
    
    def test_booking_detail_no_500(self, merchant_session):
        """Booking detail does not return 500"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/booking/{TEST_BOOKING_ID}")
        assert response.status_code != 500, f"Got 500 error: {response.text}"
    
    def test_my_bookings_no_500(self, merchant_session):
        """My bookings does not return 500"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/my-bookings")
        assert response.status_code != 500, f"Got 500 error: {response.text}"
    
    def test_frequent_routes_no_500(self, merchant_session):
        """Frequent routes does not return 500"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/frequent-routes")
        assert response.status_code != 500, f"Got 500 error: {response.text}"
    
    def test_payment_options_no_500(self, merchant_session):
        """Payment options does not return 500"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/payment-options")
        assert response.status_code != 500, f"Got 500 error: {response.text}"
    
    def test_saved_locations_no_500(self, merchant_session):
        """Saved locations does not return 500"""
        response = merchant_session.get(f"{BASE_URL}/api/mobility-platform/saved-locations")
        assert response.status_code != 500, f"Got 500 error: {response.text}"


class TestMobilityBookingCancel:
    """Tests for booking cancellation"""
    
    def test_cancel_booking_endpoint_exists(self, merchant_session):
        """Cancel booking endpoint exists (may return 400 if already cancelled)"""
        response = merchant_session.post(f"{BASE_URL}/api/mobility-platform/booking/{TEST_BOOKING_ID}/cancel")
        # Should not be 404 or 500
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
