"""
Test Move & Earn ROI v2 - Commerce/Merchant Conversions Integration
Iteration 199: Validates new ROI v2 fields for real conversions

Tests:
- GET /api/admin/move/stats returns ROI v2 fields
- commerce_roi object with summary, channels, attribution_windows
- Trend panel includes attributed_conversion_orders and attributed_revenue_eur
- API stability when attributed conversions are 0
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def admin_session():
    """Authenticate as admin and return session with token"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    login_response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if login_response.status_code != 200:
        pytest.skip(f"Admin login failed: {login_response.status_code} - {login_response.text}")
    
    data = login_response.json()
    token = data.get("token") or data.get("access_token")
    if token:
        session.headers.update({"Authorization": f"Bearer {token}"})
    
    return session


class TestMoveROIv2Backend:
    """Test ROI v2 fields in /api/admin/move/stats"""

    def test_admin_move_stats_returns_200(self, admin_session):
        """GET /api/admin/move/stats should return 200 for admin"""
        response = admin_session.get(f"{BASE_URL}/api/admin/move/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: GET /api/admin/move/stats returns 200")

    def test_admin_move_stats_has_roi_object(self, admin_session):
        """Response should contain roi object with ROI v2 fields"""
        response = admin_session.get(f"{BASE_URL}/api/admin/move/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "roi" in data, "Missing 'roi' object in response"
        roi = data["roi"]
        
        # ROI v2 fields
        roi_v2_fields = [
            "conversion_orders",
            "conversion_gmv_eur",
            "conversion_platform_revenue_eur",
            "attributed_conversion_orders",
            "attributed_conversion_gmv_eur",
            "attributed_conversion_revenue_eur",
            "attributed_conversion_buyers",
            "conversion_rate_mau_pct",
            "cost_per_conversion",
            "revenue_per_reward_eur",
            "gmv_per_reward_eur",
            "sponsored_conversion_orders",
            "sponsored_reward_impact",
        ]
        
        for field in roi_v2_fields:
            assert field in roi, f"Missing ROI v2 field: {field}"
            print(f"  - roi.{field}: {roi[field]}")
        
        print("PASS: roi object contains all ROI v2 fields")

    def test_admin_move_stats_has_commerce_roi_object(self, admin_session):
        """Response should contain commerce_roi object with summary, channels, attribution_windows"""
        response = admin_session.get(f"{BASE_URL}/api/admin/move/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "commerce_roi" in data, "Missing 'commerce_roi' object in response"
        commerce_roi = data["commerce_roi"]
        
        # commerce_roi structure
        assert "summary" in commerce_roi, "Missing 'summary' in commerce_roi"
        assert "channels" in commerce_roi, "Missing 'channels' in commerce_roi"
        assert "attribution_windows" in commerce_roi, "Missing 'attribution_windows' in commerce_roi"
        
        print("PASS: commerce_roi object has summary, channels, attribution_windows")

    def test_commerce_roi_summary_fields(self, admin_session):
        """commerce_roi.summary should contain all required fields"""
        response = admin_session.get(f"{BASE_URL}/api/admin/move/stats")
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("commerce_roi", {}).get("summary", {})
        
        summary_fields = [
            "conversion_orders",
            "conversion_gmv_eur",
            "conversion_platform_revenue_eur",
            "attributed_conversion_orders",
            "attributed_conversion_gmv_eur",
            "attributed_conversion_revenue_eur",
            "attributed_conversion_buyers",
            "conversion_rate_mau_pct",
            "cost_per_conversion_eur",
            "revenue_per_reward_eur",
            "gmv_per_reward_eur",
            "sponsored_conversion_orders",
            "sponsored_reward_impact",
        ]
        
        for field in summary_fields:
            assert field in summary, f"Missing commerce_roi.summary field: {field}"
            print(f"  - commerce_roi.summary.{field}: {summary[field]}")
        
        print("PASS: commerce_roi.summary contains all required fields")

    def test_commerce_roi_channels_structure(self, admin_session):
        """commerce_roi.channels should be a list with channel breakdown"""
        response = admin_session.get(f"{BASE_URL}/api/admin/move/stats")
        assert response.status_code == 200
        data = response.json()
        
        channels = data.get("commerce_roi", {}).get("channels", [])
        assert isinstance(channels, list), "commerce_roi.channels should be a list"
        
        # Each channel should have required fields
        channel_fields = [
            "channel",
            "orders",
            "gmv_eur",
            "platform_revenue_eur",
            "buyers",
            "attributed_orders",
            "attributed_gmv_eur",
            "attributed_platform_revenue_eur",
            "attributed_buyers",
            "attributed_share_pct",
            "sponsored_orders",
        ]
        
        for channel in channels:
            for field in channel_fields:
                assert field in channel, f"Missing field '{field}' in channel: {channel.get('channel', 'unknown')}"
            print(f"  - Channel: {channel['channel']} | Orders: {channel['orders']} | Attributed: {channel['attributed_orders']}")
        
        print(f"PASS: commerce_roi.channels has {len(channels)} channels with correct structure")

    def test_commerce_roi_attribution_windows_structure(self, admin_session):
        """commerce_roi.attribution_windows should be a list with window breakdown"""
        response = admin_session.get(f"{BASE_URL}/api/admin/move/stats")
        assert response.status_code == 200
        data = response.json()
        
        windows = data.get("commerce_roi", {}).get("attribution_windows", [])
        assert isinstance(windows, list), "commerce_roi.attribution_windows should be a list"
        
        window_fields = [
            "channel",
            "orders",
            "gmv_eur",
            "platform_revenue_eur",
            "buyers",
        ]
        
        for window in windows:
            for field in window_fields:
                assert field in window, f"Missing field '{field}' in attribution_window: {window.get('channel', 'unknown')}"
            print(f"  - Window: {window['channel']} | Orders: {window['orders']} | GMV: €{window['gmv_eur']}")
        
        print(f"PASS: commerce_roi.attribution_windows has {len(windows)} windows with correct structure")

    def test_trend_14d_has_attributed_conversion_fields(self, admin_session):
        """trend_14d should include attributed_conversion_orders and attributed_revenue_eur"""
        response = admin_session.get(f"{BASE_URL}/api/admin/move/stats")
        assert response.status_code == 200
        data = response.json()
        
        trend = data.get("trend_14d", [])
        assert isinstance(trend, list), "trend_14d should be a list"
        
        if len(trend) > 0:
            sample = trend[0]
            assert "attributed_conversion_orders" in sample, "Missing attributed_conversion_orders in trend_14d"
            assert "attributed_revenue_eur" in sample, "Missing attributed_revenue_eur in trend_14d"
            print(f"  - Sample trend row: date={sample.get('date')} | attributed_orders={sample.get('attributed_conversion_orders')} | attributed_revenue=€{sample.get('attributed_revenue_eur')}")
        
        print(f"PASS: trend_14d has {len(trend)} rows with attributed conversion fields")

    def test_api_stable_with_zero_conversions(self, admin_session):
        """API should be stable and return valid data even when attributed conversions are 0"""
        response = admin_session.get(f"{BASE_URL}/api/admin/move/stats")
        assert response.status_code == 200
        data = response.json()
        
        roi = data.get("roi", {})
        commerce_roi = data.get("commerce_roi", {})
        
        # All numeric fields should be valid numbers (not None, not NaN)
        numeric_fields = [
            ("roi.conversion_orders", roi.get("conversion_orders")),
            ("roi.attributed_conversion_orders", roi.get("attributed_conversion_orders")),
            ("roi.cost_per_conversion", roi.get("cost_per_conversion")),
            ("roi.revenue_per_reward_eur", roi.get("revenue_per_reward_eur")),
            ("commerce_roi.summary.conversion_orders", commerce_roi.get("summary", {}).get("conversion_orders")),
            ("commerce_roi.summary.attributed_conversion_orders", commerce_roi.get("summary", {}).get("attributed_conversion_orders")),
        ]
        
        for field_name, value in numeric_fields:
            assert value is not None, f"{field_name} should not be None"
            assert isinstance(value, (int, float)), f"{field_name} should be a number, got {type(value)}"
            print(f"  - {field_name}: {value}")
        
        print("PASS: API returns valid numeric values even with zero conversions")

    def test_summary_has_roi_v2_fields(self, admin_session):
        """summary object should include ROI v2 aggregated fields"""
        response = admin_session.get(f"{BASE_URL}/api/admin/move/stats")
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        
        summary_roi_fields = [
            "attributed_conversion_orders_30",
            "attributed_conversion_gmv_30",
            "attributed_conversion_revenue_30",
            "attributed_conversion_buyers_30",
            "conversion_rate_mau_30",
            "cost_per_conversion_30",
            "revenue_per_reward_eur_30",
        ]
        
        for field in summary_roi_fields:
            assert field in summary, f"Missing summary field: {field}"
            print(f"  - summary.{field}: {summary[field]}")
        
        print("PASS: summary contains ROI v2 aggregated fields")


class TestMoveStatusEndpoint:
    """Test /api/move/status endpoint still works (no regression)"""

    def test_move_status_returns_200(self, admin_session):
        """GET /api/move/status should return 200"""
        response = admin_session.get(f"{BASE_URL}/api/move/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: GET /api/move/status returns 200")

    def test_move_status_has_required_fields(self, admin_session):
        """Response should contain profile, daily, missions, ai_coach"""
        response = admin_session.get(f"{BASE_URL}/api/move/status")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["profile", "daily", "missions", "ai_coach", "claim_cards"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        print("PASS: /api/move/status has all required fields")


class TestMoveAdminSettings:
    """Test /api/admin/move/settings endpoint (no regression)"""

    def test_admin_move_settings_returns_200(self, admin_session):
        """GET /api/admin/move/settings should return 200"""
        response = admin_session.get(f"{BASE_URL}/api/admin/move/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: GET /api/admin/move/settings returns 200")

    def test_admin_move_settings_has_required_fields(self, admin_session):
        """Response should contain settings object with required fields"""
        response = admin_session.get(f"{BASE_URL}/api/admin/move/settings")
        assert response.status_code == 200
        data = response.json()
        
        assert "settings" in data, "Missing 'settings' object"
        settings = data["settings"]
        
        required_fields = [
            "daily_step_goal",
            "max_steps_per_day",
            "premium_multiplier",
            "ai_coach_enabled",
            "gps_quality_weight",
            "sensor_quality_weight",
            "behavior_quality_weight",
        ]
        
        for field in required_fields:
            assert field in settings, f"Missing settings field: {field}"
        
        print("PASS: /api/admin/move/settings has all required fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
