"""
Iteration 149 - Testing:
1. Mobility Frequent Routes in Mobility Center
2. POST /api/mobility-platform/frequent-routes saves new Frequent Route
3. POST /api/mobility-platform/best-route-book books a saved Frequent Route
4. Game Center XP-Claim Buttons for Season Milestones
5. VIP-Perk-Aktivierungen in Game Center and /vip
6. StaffManagement/Admin historical warning fixes (no regression)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_session():
    """Authenticate as admin user and return session with cookies."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    login_res = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@bidblitz.com",
        "password": "BidBlitz2026!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    return session


class TestMobilityFrequentRoutes:
    """Test Frequent Routes feature in Mobility Center"""
    
    def test_get_frequent_routes_endpoint(self, auth_session):
        """GET /api/mobility-platform/frequent-routes returns routes list"""
        res = auth_session.get(f"{BASE_URL}/api/mobility-platform/frequent-routes")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "routes" in data, "Response should contain 'routes' key"
        assert isinstance(data["routes"], list), "Routes should be a list"
    
    def test_save_frequent_route(self, auth_session):
        """POST /api/mobility-platform/frequent-routes saves a new Frequent Route"""
        payload = {
            "label": "Test Route Home to Work",
            "pickup": {
                "address": "Alexanderplatz, Berlin",
                "lat": 52.5219,
                "lng": 13.4132
            },
            "dropoff": {
                "address": "Potsdamer Platz, Berlin",
                "lat": 52.5096,
                "lng": 13.3761
            },
            "preferred_transport_type": "taxi",
            "payment_method": "wallet"
        }
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/frequent-routes", json=payload)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data.get("ok") is True, "Response should have ok=True"
        assert "route_id" in data, "Response should contain route_id"
        assert data["route_id"].startswith("fr-"), "Route ID should start with 'fr-'"
    
    def test_frequent_route_appears_in_list(self, auth_session):
        """Saved Frequent Route should appear in GET /api/mobility-platform/frequent-routes"""
        # First save a route
        payload = {
            "label": "Test Frequent Route Verify",
            "pickup": {
                "address": "Brandenburger Tor, Berlin",
                "lat": 52.5163,
                "lng": 13.3777
            },
            "dropoff": {
                "address": "Checkpoint Charlie, Berlin",
                "lat": 52.5075,
                "lng": 13.3904
            },
            "preferred_transport_type": "scooter",
            "payment_method": "wallet"
        }
        save_res = auth_session.post(f"{BASE_URL}/api/mobility-platform/frequent-routes", json=payload)
        assert save_res.status_code == 200
        
        # Now fetch the list
        list_res = auth_session.get(f"{BASE_URL}/api/mobility-platform/frequent-routes")
        assert list_res.status_code == 200
        data = list_res.json()
        routes = data.get("routes", [])
        
        # Check if our route is in the list
        found = any(r.get("label") == "Test Frequent Route Verify" for r in routes)
        assert found, "Saved frequent route should appear in the list"


class TestBestRouteBook:
    """Test One-Tap Rebook feature for Frequent Routes"""
    
    def test_best_route_book_requires_route_id(self, auth_session):
        """POST /api/mobility-platform/best-route-book requires route_id"""
        payload = {
            "transport_type": "taxi",
            "payment_method": "wallet"
        }
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/best-route-book", json=payload)
        # Should fail validation without route_id
        assert res.status_code in [400, 422], f"Expected 400/422 without route_id, got {res.status_code}"
    
    def test_best_route_book_with_saved_route(self, auth_session):
        """POST /api/mobility-platform/best-route-book books a saved Frequent Route"""
        # First save a route
        save_payload = {
            "label": "Rebook Test Route",
            "pickup": {
                "address": "Hauptbahnhof Berlin",
                "lat": 52.5251,
                "lng": 13.3694
            },
            "dropoff": {
                "address": "Friedrichstraße, Berlin",
                "lat": 52.5206,
                "lng": 13.3862
            },
            "preferred_transport_type": "taxi",
            "payment_method": "wallet"
        }
        save_res = auth_session.post(f"{BASE_URL}/api/mobility-platform/frequent-routes", json=save_payload)
        assert save_res.status_code == 200
        route_id = save_res.json().get("route_id")
        
        # Now try to rebook
        book_payload = {
            "route_id": route_id,
            "transport_type": "taxi",
            "payment_method": "wallet"
        }
        book_res = auth_session.post(f"{BASE_URL}/api/mobility-platform/best-route-book", json=book_payload)
        
        # May fail due to insufficient wallet balance, but should not be 404 or 500
        if book_res.status_code == 200:
            data = book_res.json()
            assert data.get("ok") is True, "Booking should succeed"
            assert "booking" in data, "Response should contain booking"
        elif book_res.status_code == 400:
            # Wallet balance issue is acceptable
            data = book_res.json()
            assert "detail" in data or "error" in data, "Should have error message"
        else:
            pytest.fail(f"Unexpected status {book_res.status_code}: {book_res.text}")
    
    def test_best_route_book_invalid_route_id(self, auth_session):
        """POST /api/mobility-platform/best-route-book with invalid route_id returns 404"""
        payload = {
            "route_id": "fr-nonexistent123",
            "transport_type": "taxi",
            "payment_method": "wallet"
        }
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/best-route-book", json=payload)
        assert res.status_code == 404, f"Expected 404 for invalid route_id, got {res.status_code}"


class TestGameCenterXPClaims:
    """Test XP-Claim Buttons for Season Milestones in Game Center"""
    
    def test_game_center_overview_has_milestones(self, auth_session):
        """GET /api/gaming/game-center-overview returns season milestones"""
        res = auth_session.get(f"{BASE_URL}/api/gaming/game-center-overview")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        
        assert "season" in data, "Response should contain 'season'"
        season = data["season"]
        assert "milestones" in season, "Season should contain 'milestones'"
        milestones = season["milestones"]
        assert isinstance(milestones, list), "Milestones should be a list"
        assert len(milestones) > 0, "Should have at least one milestone"
        
        # Check milestone structure
        for milestone in milestones:
            assert "points" in milestone, "Milestone should have 'points'"
            assert "reward" in milestone, "Milestone should have 'reward'"
            assert "claimed" in milestone, "Milestone should have 'claimed' status"
    
    def test_season_claim_endpoint_exists(self, auth_session):
        """POST /api/gaming/season-claim endpoint exists"""
        # Try to claim a milestone (may fail due to insufficient XP, but endpoint should exist)
        payload = {"points": 500}
        res = auth_session.post(f"{BASE_URL}/api/gaming/season-claim", json=payload)
        
        # Should not be 404 (endpoint exists)
        assert res.status_code != 404, "Season claim endpoint should exist"
        
        # Expected responses: 200 (success), 400 (not enough XP or already claimed)
        assert res.status_code in [200, 400], f"Expected 200 or 400, got {res.status_code}: {res.text}"
    
    def test_season_claim_invalid_milestone(self, auth_session):
        """POST /api/gaming/season-claim with invalid milestone returns 404"""
        payload = {"points": 99999}  # Non-existent milestone
        res = auth_session.post(f"{BASE_URL}/api/gaming/season-claim", json=payload)
        assert res.status_code == 404, f"Expected 404 for invalid milestone, got {res.status_code}"


class TestVIPPerkActivations:
    """Test VIP-Perk-Aktivierungen in Game Center and /vip"""
    
    def test_game_center_overview_has_vip_perks(self, auth_session):
        """GET /api/gaming/game-center-overview returns VIP claimable perks"""
        res = auth_session.get(f"{BASE_URL}/api/gaming/game-center-overview")
        assert res.status_code == 200
        data = res.json()
        
        assert "vip_club" in data, "Response should contain 'vip_club'"
        vip_club = data["vip_club"]
        assert "claimable_perks" in vip_club, "VIP club should have 'claimable_perks'"
        perks = vip_club["claimable_perks"]
        assert isinstance(perks, list), "Claimable perks should be a list"
        
        # Check perk structure
        for perk in perks:
            assert "id" in perk, "Perk should have 'id'"
            assert "label" in perk, "Perk should have 'label'"
            assert "claimed" in perk, "Perk should have 'claimed' status"
    
    def test_vip_claim_endpoint_exists(self, auth_session):
        """POST /api/gaming/vip-claim endpoint exists"""
        payload = {"perk_type": "vip_spin"}
        res = auth_session.post(f"{BASE_URL}/api/gaming/vip-claim", json=payload)
        
        # Should not be 404 (endpoint exists)
        assert res.status_code != 404, "VIP claim endpoint should exist"
        
        # Expected: 200 (success), 400 (VIP not active or already claimed)
        assert res.status_code in [200, 400], f"Expected 200 or 400, got {res.status_code}: {res.text}"
    
    def test_vip_claim_invalid_perk(self, auth_session):
        """POST /api/gaming/vip-claim with invalid perk_type returns 400 or 404"""
        payload = {"perk_type": "nonexistent_perk"}
        res = auth_session.post(f"{BASE_URL}/api/gaming/vip-claim", json=payload)
        # API returns 400 for VIP not active or 404 for unknown perk
        assert res.status_code in [400, 404], f"Expected 400 or 404 for invalid perk, got {res.status_code}"
    
    def test_subscription_plans_endpoint(self, auth_session):
        """GET /api/subscription/plans returns VIP plans"""
        res = auth_session.get(f"{BASE_URL}/api/subscription/plans")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        data = res.json()
        assert "plans" in data, "Response should contain 'plans'"
    
    def test_subscription_my_endpoint(self, auth_session):
        """GET /api/subscription/my returns user subscription status"""
        res = auth_session.get(f"{BASE_URL}/api/subscription/my")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        data = res.json()
        assert "has_subscription" in data, "Response should contain 'has_subscription'"


class TestStaffManagementNoRegression:
    """Test StaffManagement/Admin pages have no regression after ESLint fixes"""
    
    def test_staff_subscription_status_endpoint(self, auth_session):
        """GET /api/staff/subscription/status returns subscription info"""
        res = auth_session.get(f"{BASE_URL}/api/staff/subscription/status")
        # May return 200 or 404 depending on setup, but should not error
        assert res.status_code in [200, 404], f"Unexpected status {res.status_code}: {res.text}"
    
    def test_staff_members_endpoint(self, auth_session):
        """GET /api/staff/members returns staff list"""
        res = auth_session.get(f"{BASE_URL}/api/staff/members")
        # May require subscription, but endpoint should exist
        assert res.status_code in [200, 400, 403], f"Unexpected status {res.status_code}: {res.text}"
    
    def test_admin_overview_endpoint(self, auth_session):
        """GET /api/admin/overview returns admin dashboard data"""
        res = auth_session.get(f"{BASE_URL}/api/admin/overview")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        # Should have some overview data
        assert isinstance(data, dict), "Response should be a dict"
    
    def test_admin_users_endpoint(self, auth_session):
        """GET /api/admin/users returns user list"""
        res = auth_session.get(f"{BASE_URL}/api/admin/users")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "users" in data, "Response should contain 'users'"


class TestMobilityCenterDataTestIds:
    """Verify data-testid elements exist for Frequent Routes in Mobility Center"""
    
    def test_frequent_routes_have_route_id(self, auth_session):
        """Frequent routes should have route_id for data-testid binding"""
        res = auth_session.get(f"{BASE_URL}/api/mobility-platform/frequent-routes")
        assert res.status_code == 200
        data = res.json()
        routes = data.get("routes", [])
        
        for route in routes:
            assert "route_id" in route, "Each route should have 'route_id'"
            assert "label" in route, "Each route should have 'label'"
            assert "pickup" in route, "Each route should have 'pickup'"
            assert "dropoff" in route, "Each route should have 'dropoff'"
            assert "transport_type" in route, "Each route should have 'transport_type'"
