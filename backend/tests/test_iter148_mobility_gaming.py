"""
Iteration 148 - Mobility Center V1 + Game Center V1 Backend Tests
Tests for:
- POST /api/mobility-platform/compare-summary (4-way comparison)
- POST /api/mobility-platform/route (includes EV)
- GET /api/gaming/game-center-overview (Season, Achievements, VIP)
- GET /api/gamification/achievements
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://kyc-approval-hub.preview.emergentagent.com")

@pytest.fixture(scope="module")
def auth_session():
    """Authenticate and return session with cookies"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    login_res = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@bidblitz.com",
        "password": "BidBlitz2026!"
    })
    
    if login_res.status_code != 200:
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    return session


class TestMobilityCompareSummary:
    """Tests for POST /api/mobility-platform/compare-summary"""
    
    def test_compare_summary_returns_4_cards(self, auth_session):
        """Compare summary should return exactly 4 cards for focus_modes"""
        payload = {
            "pickup": {"address": "Berlin Hauptbahnhof", "lat": 52.5251, "lng": 13.3694},
            "dropoff": {"address": "Berlin Alexanderplatz", "lat": 52.5219, "lng": 13.4132},
            "focus_modes": ["taxi", "scooter", "ev", "car_rental"]
        }
        
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/compare-summary", json=payload)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "cards" in data, "Response should contain 'cards'"
        assert len(data["cards"]) == 4, f"Expected 4 cards, got {len(data['cards'])}"
        
        card_types = [card["type"] for card in data["cards"]]
        assert "taxi" in card_types, "Should include taxi"
        assert "scooter" in card_types, "Should include scooter"
        assert "ev" in card_types, "Should include ev"
        assert "car_rental" in card_types, "Should include car_rental"
    
    def test_compare_summary_has_best_values(self, auth_session):
        """Compare summary should return best values for cheapest, fastest, eco, balance"""
        payload = {
            "pickup": {"address": "Berlin Hauptbahnhof", "lat": 52.5251, "lng": 13.3694},
            "dropoff": {"address": "Berlin Alexanderplatz", "lat": 52.5219, "lng": 13.4132},
            "focus_modes": ["taxi", "scooter", "ev", "car_rental"]
        }
        
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/compare-summary", json=payload)
        assert res.status_code == 200
        
        data = res.json()
        assert "best" in data, "Response should contain 'best'"
        
        best = data["best"]
        assert "cheapest" in best, "Should have cheapest"
        assert "fastest" in best, "Should have fastest"
        assert "eco" in best, "Should have eco"
        assert "balance" in best, "Should have balance"
        
        # Each best should have type, label, reason
        for key in ["cheapest", "fastest", "eco", "balance"]:
            assert "type" in best[key], f"{key} should have type"
            assert "label" in best[key], f"{key} should have label"
            assert "reason" in best[key], f"{key} should have reason"
    
    def test_compare_summary_cards_have_delta_values(self, auth_session):
        """Each card should have price_delta_vs_taxi and time_delta_vs_taxi"""
        payload = {
            "pickup": {"address": "Berlin Hauptbahnhof", "lat": 52.5251, "lng": 13.3694},
            "dropoff": {"address": "Berlin Alexanderplatz", "lat": 52.5219, "lng": 13.4132},
            "focus_modes": ["taxi", "scooter", "ev", "car_rental"]
        }
        
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/compare-summary", json=payload)
        assert res.status_code == 200
        
        data = res.json()
        for card in data["cards"]:
            assert "price_delta_vs_taxi" in card, f"Card {card['type']} should have price_delta_vs_taxi"
            assert "time_delta_vs_taxi" in card, f"Card {card['type']} should have time_delta_vs_taxi"
            assert "tags" in card, f"Card {card['type']} should have tags"
    
    def test_compare_summary_route_info(self, auth_session):
        """Compare summary should include route info"""
        payload = {
            "pickup": {"address": "Berlin Hauptbahnhof", "lat": 52.5251, "lng": 13.3694},
            "dropoff": {"address": "Berlin Alexanderplatz", "lat": 52.5219, "lng": 13.4132},
            "focus_modes": ["taxi", "scooter", "ev", "car_rental"]
        }
        
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/compare-summary", json=payload)
        assert res.status_code == 200
        
        data = res.json()
        assert "route" in data, "Response should contain 'route'"
        
        route = data["route"]
        assert "pickup" in route, "Route should have pickup"
        assert "dropoff" in route, "Route should have dropoff"
        assert "distance_km" in route, "Route should have distance_km"
        assert "duration_min" in route, "Route should have duration_min"


class TestMobilityRouteEV:
    """Tests for POST /api/mobility-platform/route - EV inclusion"""
    
    def test_route_includes_ev_option(self, auth_session):
        """Route should include EV Drive option"""
        payload = {
            "pickup_lat": 52.5251,
            "pickup_lng": 13.3694,
            "dropoff_lat": 52.5219,
            "dropoff_lng": 13.4132,
            "pickup_address": "Berlin Hauptbahnhof",
            "dropoff_address": "Berlin Alexanderplatz"
        }
        
        res = auth_session.post(f"{BASE_URL}/api/mobility-platform/route", json=payload)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "options" in data, "Response should contain 'options'"
        
        option_types = [opt["type"] for opt in data["options"]]
        assert "ev" in option_types, "Options should include 'ev'"
        
        ev_option = next(opt for opt in data["options"] if opt["type"] == "ev")
        assert ev_option["label"] == "EV Drive", "EV option should have label 'EV Drive'"
        assert "price_eur" in ev_option, "EV option should have price_eur"
        assert "duration_min" in ev_option, "EV option should have duration_min"
        assert "eco_score" in ev_option, "EV option should have eco_score"


class TestGameCenterOverview:
    """Tests for GET /api/gaming/game-center-overview"""
    
    def test_game_center_overview_returns_profile(self, auth_session):
        """Game center overview should return profile with coins"""
        res = auth_session.get(f"{BASE_URL}/api/gaming/game-center-overview")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "profile" in data, "Response should contain 'profile'"
        
        profile = data["profile"]
        assert "coins" in profile, "Profile should have coins"
        assert "coins_eur_value" in profile, "Profile should have coins_eur_value"
    
    def test_game_center_overview_returns_season(self, auth_session):
        """Game center overview should return season info"""
        res = auth_session.get(f"{BASE_URL}/api/gaming/game-center-overview")
        assert res.status_code == 200
        
        data = res.json()
        assert "season" in data, "Response should contain 'season'"
        
        season = data["season"]
        assert "season_id" in season, "Season should have season_id"
        assert "name" in season, "Season should have name"
        assert "days_left" in season, "Season should have days_left"
        assert "user_rank" in season, "Season should have user_rank"
        assert "user_points" in season, "Season should have user_points"
        assert "target_points" in season, "Season should have target_points"
        assert "progress_pct" in season, "Season should have progress_pct"
        assert "podium" in season, "Season should have podium"
        assert "milestones" in season, "Season should have milestones"
    
    def test_game_center_overview_returns_achievements(self, auth_session):
        """Game center overview should return achievements summary"""
        res = auth_session.get(f"{BASE_URL}/api/gaming/game-center-overview")
        assert res.status_code == 200
        
        data = res.json()
        assert "achievements" in data, "Response should contain 'achievements'"
        
        achievements = data["achievements"]
        assert "total_unlocked" in achievements, "Achievements should have total_unlocked"
        assert "reward_blz" in achievements, "Achievements should have reward_blz"
    
    def test_game_center_overview_returns_vip_club(self, auth_session):
        """Game center overview should return VIP club info"""
        res = auth_session.get(f"{BASE_URL}/api/gaming/game-center-overview")
        assert res.status_code == 200
        
        data = res.json()
        assert "vip_club" in data, "Response should contain 'vip_club'"
        
        vip = data["vip_club"]
        assert "active" in vip, "VIP club should have active"
        assert "plan_name" in vip, "VIP club should have plan_name"
        assert "perks" in vip, "VIP club should have perks"
    
    def test_game_center_milestones_structure(self, auth_session):
        """Season milestones should have points and reward"""
        res = auth_session.get(f"{BASE_URL}/api/gaming/game-center-overview")
        assert res.status_code == 200
        
        data = res.json()
        milestones = data["season"]["milestones"]
        
        assert len(milestones) >= 1, "Should have at least 1 milestone"
        
        for milestone in milestones:
            assert "points" in milestone, "Milestone should have points"
            assert "reward" in milestone, "Milestone should have reward"


class TestAchievementsPage:
    """Tests for GET /api/gamification/achievements"""
    
    def test_achievements_endpoint_accessible(self, auth_session):
        """Achievements endpoint should be accessible"""
        res = auth_session.get(f"{BASE_URL}/api/gamification/achievements")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "achievements" in data, "Response should contain 'achievements'"
        assert "stats" in data, "Response should contain 'stats'"
    
    def test_achievements_stats_structure(self, auth_session):
        """Achievements stats should have required fields"""
        res = auth_session.get(f"{BASE_URL}/api/gamification/achievements")
        assert res.status_code == 200
        
        data = res.json()
        stats = data["stats"]
        
        assert "total_unlocked" in stats, "Stats should have total_unlocked"
        assert "total_available" in stats, "Stats should have total_available"
        assert "completion_pct" in stats, "Stats should have completion_pct"


class TestMobilityNearbyEV:
    """Tests for GET /api/mobility-platform/nearby - EV in live counters"""
    
    def test_nearby_includes_ev_count(self, auth_session):
        """Nearby endpoint should include EV count"""
        res = auth_session.get(f"{BASE_URL}/api/mobility-platform/nearby?lat=52.5251&lng=13.3694&radius=10")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "counts" in data, "Response should contain 'counts'"
        
        counts = data["counts"]
        assert "ev" in counts, "Counts should include 'ev'"
        assert "taxi" in counts, "Counts should include 'taxi'"
        assert "scooter" in counts, "Counts should include 'scooter'"
        assert "car_rental" in counts, "Counts should include 'car_rental'"
    
    def test_nearby_available_modes_includes_ev(self, auth_session):
        """Available modes should include EV Drive"""
        res = auth_session.get(f"{BASE_URL}/api/mobility-platform/nearby?lat=52.5251&lng=13.3694&radius=10")
        assert res.status_code == 200
        
        data = res.json()
        assert "available_modes" in data, "Response should contain 'available_modes'"
        
        mode_types = [mode["type"] for mode in data["available_modes"]]
        assert "ev" in mode_types, "Available modes should include 'ev'"
        
        ev_mode = next(mode for mode in data["available_modes"] if mode["type"] == "ev")
        assert ev_mode["label"] == "EV Drive", "EV mode should have label 'EV Drive'"
