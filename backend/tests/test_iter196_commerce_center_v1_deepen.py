"""
Iteration 196 - Commerce Center V1 Deepen Tests
Tests for new Commerce Analytics, Program Schedule, Performance Rankings, and Event Tracking
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def session():
    """Authenticated session for admin user"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Login as admin
    resp = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if resp.status_code != 200:
        pytest.skip(f"Admin login failed: {resp.status_code}")
    return s


class TestCommerceCenterOverviewNewFields:
    """Tests for new fields in /api/commerce-center/overview endpoint"""

    def test_overview_returns_analytics_cards(self, session):
        """Verify analytics_cards array is returned with 4 items"""
        resp = session.get(f"{BASE_URL}/api/commerce-center/overview")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        
        assert "analytics_cards" in data, "analytics_cards field missing"
        analytics_cards = data["analytics_cards"]
        assert isinstance(analytics_cards, list), "analytics_cards should be a list"
        assert len(analytics_cards) == 4, f"Expected 4 analytics cards, got {len(analytics_cards)}"
        
        # Verify expected card IDs
        card_ids = [card["id"] for card in analytics_cards]
        expected_ids = ["revenue_24h", "cta_clicks_24h", "conversion_rate", "live_viewers_now"]
        for expected_id in expected_ids:
            assert expected_id in card_ids, f"Missing analytics card: {expected_id}"
        
        # Verify card structure
        for card in analytics_cards:
            assert "id" in card, "Card missing id"
            assert "label" in card, "Card missing label"
            assert "value" in card, "Card missing value"
            assert "value_type" in card, "Card missing value_type"
            assert "detail" in card, "Card missing detail"

    def test_overview_returns_performance_rankings(self, session):
        """Verify performance_rankings array is returned"""
        resp = session.get(f"{BASE_URL}/api/commerce-center/overview")
        assert resp.status_code == 200
        data = resp.json()
        
        assert "performance_rankings" in data, "performance_rankings field missing"
        rankings = data["performance_rankings"]
        assert isinstance(rankings, list), "performance_rankings should be a list"
        # Should have at least some rankings (depends on seed data)
        
        # Verify ranking structure if any exist
        for ranking in rankings:
            assert "rank_id" in ranking, "Ranking missing rank_id"
            assert "label" in ranking, "Ranking missing label"
            assert "title" in ranking, "Ranking missing title"
            assert "metric_label" in ranking, "Ranking missing metric_label"
            assert "metric_value" in ranking, "Ranking missing metric_value"
            assert "route" in ranking, "Ranking missing route"
            assert "accent" in ranking, "Ranking missing accent"

    def test_overview_returns_program_schedule(self, session):
        """Verify program_schedule array is returned"""
        resp = session.get(f"{BASE_URL}/api/commerce-center/overview")
        assert resp.status_code == 200
        data = resp.json()
        
        assert "program_schedule" in data, "program_schedule field missing"
        schedule = data["program_schedule"]
        assert isinstance(schedule, list), "program_schedule should be a list"
        
        # Verify schedule item structure if any exist
        for item in schedule:
            assert "schedule_id" in item, "Schedule item missing schedule_id"
            assert "type" in item, "Schedule item missing type"
            assert "title" in item, "Schedule item missing title"
            assert "subtitle" in item, "Schedule item missing subtitle"
            assert "state" in item, "Schedule item missing state"
            assert "cta_label" in item, "Schedule item missing cta_label"
            assert "route" in item, "Schedule item missing route"
            assert "accent" in item, "Schedule item missing accent"
            
            # Verify state is valid
            assert item["state"] in ["live", "scheduled", "active"], f"Invalid state: {item['state']}"
            
            # Verify type is valid
            valid_types = ["live_stream", "upcoming_stream", "live_auction", "flash_sale"]
            assert item["type"] in valid_types, f"Invalid type: {item['type']}"

    def test_overview_existing_fields_still_present(self, session):
        """Verify existing fields are still returned"""
        resp = session.get(f"{BASE_URL}/api/commerce-center/overview")
        assert resp.status_code == 200
        data = resp.json()
        
        # Check existing fields
        expected_fields = [
            "stats", "flash_sales", "marketplace", "penny_auctions",
            "live_auctions", "live_streams", "upcoming_streams",
            "spotlight", "category_mix", "live_insights"
        ]
        for field in expected_fields:
            assert field in data, f"Missing existing field: {field}"


class TestCommerceCenterEventTracking:
    """Tests for event tracking endpoint"""

    def test_track_page_view_event(self, session):
        """Test tracking a page_view event"""
        resp = session.post(f"{BASE_URL}/api/commerce-center/events", json={
            "event_type": "page_view",
            "target_type": "hub",
            "target_id": "overview",
            "source": "commerce_center",
            "metadata": {}
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data.get("ok") is True, "Event tracking should return ok: true"

    def test_track_cta_click_event(self, session):
        """Test tracking a cta_click event"""
        resp = session.post(f"{BASE_URL}/api/commerce-center/events", json={
            "event_type": "cta_click",
            "target_type": "flash_sale_buy",
            "target_id": "test_sale_123",
            "source": "commerce_center",
            "metadata": {"test": True}
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("ok") is True

    def test_track_category_filter_event(self, session):
        """Test tracking a category_filter event"""
        resp = session.post(f"{BASE_URL}/api/commerce-center/events", json={
            "event_type": "category_filter",
            "target_type": "category",
            "target_id": "tech",
            "source": "commerce_center",
            "metadata": {}
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("ok") is True


class TestCommerceCenterRouteIntegrity:
    """Tests for route integrity in program schedule and performance rankings"""

    def test_program_schedule_routes_are_valid(self, session):
        """Verify program schedule routes point to valid destinations"""
        resp = session.get(f"{BASE_URL}/api/commerce-center/overview")
        assert resp.status_code == 200
        data = resp.json()
        
        schedule = data.get("program_schedule", [])
        for item in schedule:
            route = item.get("route", "")
            # Routes should start with /
            assert route.startswith("/"), f"Invalid route format: {route}"
            # Routes should be valid commerce/live destinations
            valid_prefixes = ["/live", "/marketplace", "/auctions", "/live-auctions"]
            assert any(route.startswith(prefix) for prefix in valid_prefixes), f"Unexpected route: {route}"

    def test_performance_rankings_routes_are_valid(self, session):
        """Verify performance ranking routes point to valid destinations"""
        resp = session.get(f"{BASE_URL}/api/commerce-center/overview")
        assert resp.status_code == 200
        data = resp.json()
        
        rankings = data.get("performance_rankings", [])
        for item in rankings:
            route = item.get("route", "")
            assert route.startswith("/"), f"Invalid route format: {route}"
            valid_prefixes = ["/live", "/marketplace", "/auctions", "/live-auctions"]
            assert any(route.startswith(prefix) for prefix in valid_prefixes), f"Unexpected route: {route}"


class TestCommerceCenterAnalyticsCardValues:
    """Tests for analytics card value types and formats"""

    def test_analytics_card_value_types(self, session):
        """Verify analytics cards have correct value types"""
        resp = session.get(f"{BASE_URL}/api/commerce-center/overview")
        assert resp.status_code == 200
        data = resp.json()
        
        analytics_cards = data.get("analytics_cards", [])
        value_type_map = {
            "revenue_24h": "currency",
            "cta_clicks_24h": "count",
            "conversion_rate": "percent",
            "live_viewers_now": "count"
        }
        
        for card in analytics_cards:
            card_id = card.get("id")
            if card_id in value_type_map:
                expected_type = value_type_map[card_id]
                actual_type = card.get("value_type")
                assert actual_type == expected_type, f"Card {card_id} has wrong value_type: {actual_type}, expected {expected_type}"


class TestCommerceCenterPublicAccess:
    """Tests for public (unauthenticated) access to overview"""

    def test_overview_accessible_without_auth(self):
        """Verify overview endpoint is accessible without authentication"""
        resp = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        assert resp.status_code == 200, f"Overview should be public, got {resp.status_code}"
        data = resp.json()
        # Should still return all fields
        assert "analytics_cards" in data
        assert "performance_rankings" in data
        assert "program_schedule" in data
