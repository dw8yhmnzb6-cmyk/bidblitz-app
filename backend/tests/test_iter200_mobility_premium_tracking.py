"""
Iteration 200: Mobility Premium Tracking Tests
Tests for airport_shuttle and vip live-tracking with approach/trip phases, checkpoints, shuttle stops
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

class TestMobilityPremiumTracking:
    """Tests for premium mobility tracking (VIP and Airport Shuttle)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.ae",
            "password": "BidBlitz2026!"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.user = login_resp.json()
    
    def test_vip_booking_returns_premium_tracking_fields(self):
        """GET /api/mobility-platform/booking/{booking_id} returns extended tracking fields for VIP"""
        # Use existing VIP booking
        booking_id = "mob-8cf63d8dff6b"
        resp = self.session.get(f"{BASE_URL}/api/mobility-platform/booking/{booking_id}")
        assert resp.status_code == 200, f"Failed to get booking: {resp.text}"
        
        data = resp.json()
        booking = data.get("booking", {})
        tracking = data.get("tracking", {})
        
        # Verify booking has transport_type vip
        assert booking.get("transport_type") == "vip", "Expected transport_type to be vip"
        
        # Verify premium tracking fields exist
        assert "vehicle_phase" in tracking, "Missing vehicle_phase in tracking"
        assert "approach_progress_percent" in tracking, "Missing approach_progress_percent"
        assert "trip_progress_percent" in tracking, "Missing trip_progress_percent"
        assert "checkpoints" in tracking, "Missing checkpoints"
        assert "shuttle_stops" in tracking, "Missing shuttle_stops"
        
        # Verify assigned_resource has approach/trip positions
        assigned_resource = tracking.get("assigned_resource", {})
        assert "approach_position" in assigned_resource, "Missing approach_position in assigned_resource"
        assert "trip_position" in assigned_resource, "Missing trip_position in assigned_resource"
        
        # Verify approach_position structure
        approach_pos = assigned_resource.get("approach_position", {})
        assert "lat" in approach_pos, "Missing lat in approach_position"
        assert "lng" in approach_pos, "Missing lng in approach_position"
        
        # Verify trip_position structure
        trip_pos = assigned_resource.get("trip_position", {})
        assert "lat" in trip_pos, "Missing lat in trip_position"
        assert "lng" in trip_pos, "Missing lng in trip_position"
        
        print(f"VIP booking {booking_id} has all premium tracking fields")
    
    def test_vip_tracking_has_checkpoints(self):
        """VIP booking tracking includes checkpoints array with correct structure"""
        booking_id = "mob-8cf63d8dff6b"
        resp = self.session.get(f"{BASE_URL}/api/mobility-platform/booking/{booking_id}")
        assert resp.status_code == 200
        
        tracking = resp.json().get("tracking", {})
        checkpoints = tracking.get("checkpoints", [])
        
        # VIP should have checkpoints
        assert isinstance(checkpoints, list), "checkpoints should be a list"
        assert len(checkpoints) >= 1, "VIP booking should have at least 1 checkpoint"
        
        # Verify checkpoint structure
        for cp in checkpoints:
            assert "checkpoint_id" in cp, "Missing checkpoint_id"
            assert "label" in cp, "Missing label"
            assert "lat" in cp, "Missing lat"
            assert "lng" in cp, "Missing lng"
            assert "passed" in cp, "Missing passed flag"
            assert isinstance(cp["passed"], bool), "passed should be boolean"
        
        print(f"VIP booking has {len(checkpoints)} checkpoints with correct structure")
    
    def test_vip_tracking_vehicle_phase(self):
        """VIP booking tracking has vehicle_phase (approach or trip)"""
        booking_id = "mob-8cf63d8dff6b"
        resp = self.session.get(f"{BASE_URL}/api/mobility-platform/booking/{booking_id}")
        assert resp.status_code == 200
        
        tracking = resp.json().get("tracking", {})
        vehicle_phase = tracking.get("vehicle_phase")
        
        assert vehicle_phase in ["approach", "trip"], f"vehicle_phase should be 'approach' or 'trip', got: {vehicle_phase}"
        print(f"VIP booking vehicle_phase: {vehicle_phase}")
    
    def test_vip_tracking_progress_percentages(self):
        """VIP booking tracking has approach_progress_percent and trip_progress_percent"""
        booking_id = "mob-8cf63d8dff6b"
        resp = self.session.get(f"{BASE_URL}/api/mobility-platform/booking/{booking_id}")
        assert resp.status_code == 200
        
        tracking = resp.json().get("tracking", {})
        
        approach_pct = tracking.get("approach_progress_percent")
        trip_pct = tracking.get("trip_progress_percent")
        
        assert isinstance(approach_pct, (int, float)), "approach_progress_percent should be numeric"
        assert isinstance(trip_pct, (int, float)), "trip_progress_percent should be numeric"
        assert 0 <= approach_pct <= 100, f"approach_progress_percent out of range: {approach_pct}"
        assert 0 <= trip_pct <= 100, f"trip_progress_percent out of range: {trip_pct}"
        
        print(f"VIP tracking progress: approach={approach_pct}%, trip={trip_pct}%")
    
    def test_existing_tracking_fields_still_present(self):
        """Existing tracking fields (route_points, progress_percent, timeline, eta_minutes) still exist"""
        booking_id = "mob-8cf63d8dff6b"
        resp = self.session.get(f"{BASE_URL}/api/mobility-platform/booking/{booking_id}")
        assert resp.status_code == 200
        
        tracking = resp.json().get("tracking", {})
        
        # Verify existing fields still present
        assert "route_points" in tracking, "Missing route_points"
        assert "progress_percent" in tracking, "Missing progress_percent"
        assert "timeline" in tracking, "Missing timeline"
        assert "eta_minutes" in tracking, "Missing eta_minutes"
        assert "status" in tracking, "Missing status"
        assert "live_status" in tracking, "Missing live_status"
        assert "phase_label" in tracking, "Missing phase_label"
        assert "next_event_label" in tracking, "Missing next_event_label"
        assert "can_cancel" in tracking, "Missing can_cancel"
        
        # Verify route_points is a list
        route_points = tracking.get("route_points", [])
        assert isinstance(route_points, list), "route_points should be a list"
        
        # Verify timeline is a list with correct structure
        timeline = tracking.get("timeline", [])
        assert isinstance(timeline, list), "timeline should be a list"
        assert len(timeline) > 0, "timeline should not be empty"
        
        for step in timeline:
            assert "id" in step, "Missing id in timeline step"
            assert "label" in step, "Missing label in timeline step"
            assert "done" in step, "Missing done in timeline step"
            assert "active" in step, "Missing active in timeline step"
        
        print("All existing tracking fields are present and valid")
    
    def test_my_bookings_endpoint_works(self):
        """GET /api/mobility-platform/my-bookings returns bookings list"""
        resp = self.session.get(f"{BASE_URL}/api/mobility-platform/my-bookings")
        assert resp.status_code == 200, f"Failed to get my-bookings: {resp.text}"
        
        data = resp.json()
        assert "bookings" in data, "Missing bookings in response"
        assert isinstance(data["bookings"], list), "bookings should be a list"
        
        print(f"my-bookings returned {len(data['bookings'])} bookings")


class TestMobilityTrackingRegression:
    """Regression tests for non-premium mobility tracking"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.ae",
            "password": "BidBlitz2026!"
        })
        assert login_resp.status_code == 200
    
    def test_route_endpoint_works(self):
        """POST /api/mobility-platform/route returns route with options"""
        resp = self.session.post(f"{BASE_URL}/api/mobility-platform/route", json={
            "pickup_lat": 42.6629,
            "pickup_lng": 21.1655,
            "dropoff_lat": 42.5728,
            "dropoff_lng": 21.0358,
            "pickup_address": "Test Start",
            "dropoff_address": "Test End"
        })
        assert resp.status_code == 200, f"Route calculation failed: {resp.text}"
        
        data = resp.json()
        assert "options" in data, "Missing options in route response"
        assert "distance_km" in data, "Missing distance_km"
        assert "duration_min" in data, "Missing duration_min"
        
        # Verify vip and airport_shuttle options exist
        option_types = [opt.get("type") for opt in data.get("options", [])]
        assert "vip" in option_types, "Missing vip option"
        assert "airport_shuttle" in option_types, "Missing airport_shuttle option"
        
        print(f"Route calculated: {data['distance_km']}km, {data['duration_min']}min, {len(data['options'])} options")
    
    def test_search_endpoint_works(self):
        """GET /api/mobility-platform/search returns search results"""
        resp = self.session.get(f"{BASE_URL}/api/mobility-platform/search", params={
            "q": "Pristina",
            "lang": "de"
        })
        assert resp.status_code == 200, f"Search failed: {resp.text}"
        
        data = resp.json()
        assert "results" in data, "Missing results in search response"
        print(f"Search returned {len(data.get('results', []))} results")
    
    def test_preferences_endpoint_works(self):
        """GET /api/mobility-platform/preferences returns user preferences"""
        resp = self.session.get(f"{BASE_URL}/api/mobility-platform/preferences")
        assert resp.status_code == 200, f"Preferences failed: {resp.text}"
        
        data = resp.json()
        assert "preferences" in data, "Missing preferences in response"
        print(f"Preferences: {data.get('preferences')}")
    
    def test_frequent_routes_endpoint_works(self):
        """GET /api/mobility-platform/frequent-routes returns routes list"""
        resp = self.session.get(f"{BASE_URL}/api/mobility-platform/frequent-routes")
        assert resp.status_code == 200, f"Frequent routes failed: {resp.text}"
        
        data = resp.json()
        assert "routes" in data, "Missing routes in response"
        print(f"Frequent routes: {len(data.get('routes', []))} routes")


class TestMobilityBookingCancel:
    """Tests for booking cancellation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.ae",
            "password": "BidBlitz2026!"
        })
        assert login_resp.status_code == 200
    
    def test_cancel_button_available_for_pending_booking(self):
        """VIP booking with payment_pending status should have can_cancel=true"""
        booking_id = "mob-8cf63d8dff6b"
        resp = self.session.get(f"{BASE_URL}/api/mobility-platform/booking/{booking_id}")
        assert resp.status_code == 200
        
        tracking = resp.json().get("tracking", {})
        booking = resp.json().get("booking", {})
        
        # If status is payment_pending or confirmed, can_cancel should be true
        if booking.get("status") in ["payment_pending", "confirmed"]:
            assert tracking.get("can_cancel") == True, "can_cancel should be true for pending/confirmed bookings"
            print(f"Booking {booking_id} can be cancelled (status: {booking.get('status')})")
        else:
            print(f"Booking {booking_id} status is {booking.get('status')}, can_cancel={tracking.get('can_cancel')}")
