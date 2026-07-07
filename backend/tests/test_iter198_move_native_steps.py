"""
Test iteration 198: Move & Earn Native Steps Integration
Tests the extended sync-steps endpoint with native_provider, native_platform, 
permission_state, distance_meters, sample_count, used_fallback fields.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


class TestMoveNativeStepsIntegration:
    """Tests for Move & Earn native steps sync with extended payload"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json().get("user", {})
        yield
        # Cleanup
        self.session.close()
    
    def test_move_status_endpoint(self):
        """Test GET /api/move/status returns expected structure"""
        response = self.session.get(f"{BASE_URL}/api/move/status")
        assert response.status_code == 200, f"Move status failed: {response.text}"
        
        data = response.json()
        # Verify profile structure
        assert "profile" in data
        assert "daily" in data
        assert "missions" in data
        assert "ai_coach" in data
        assert "claim_cards" in data
        
        # Verify daily structure has scoring
        daily = data.get("daily", {})
        assert "accepted_steps" in daily
        assert "goal" in daily
        assert "progress_pct" in daily
        assert "scoring" in daily
        
        print(f"✓ Move status returned with {daily.get('accepted_steps', 0)} accepted steps")
    
    def test_sync_steps_with_native_provider_fields(self):
        """Test POST /api/move/sync-steps accepts extended native fields"""
        # Get current status first
        status_response = self.session.get(f"{BASE_URL}/api/move/status")
        assert status_response.status_code == 200
        current_steps = status_response.json().get("daily", {}).get("latest_device_total", 0)
        
        # Sync with native provider fields
        sync_payload = {
            "total_steps": current_steps + 1500,
            "source": "native_health",
            "native_provider": "healthkit",
            "native_platform": "ios",
            "permission_state": "authorized",
            "distance_meters": 1200.5,
            "sample_count": 45,
            "used_fallback": False,
            "device_fingerprint": "test-native-ios-device",
            "sensor_confidence": 0.95,
            "gps_distance_km": 1.2,
            "duration_minutes": 20,
            "gps_points": 35,
            "route_variance_score": 0.85,
            "activity_type": "walking",
            "background_tracking_minutes": 18
        }
        
        response = self.session.post(f"{BASE_URL}/api/move/sync-steps", json=sync_payload)
        assert response.status_code == 200, f"Sync failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True
        assert "accepted_delta" in data
        assert "scoring" in data
        assert "status" in data
        
        # Verify scoring was computed
        scoring = data.get("scoring", {})
        assert "trust_score" in scoring
        assert "gps_score" in scoring
        assert "sensor_score" in scoring
        assert "behavior_score" in scoring
        
        print(f"✓ Native sync accepted: +{data.get('accepted_delta', 0)} steps, trust={scoring.get('trust_score', 0)}")
    
    def test_sync_steps_with_health_connect_fields(self):
        """Test sync with Health Connect (Android) native fields"""
        status_response = self.session.get(f"{BASE_URL}/api/move/status")
        assert status_response.status_code == 200
        current_steps = status_response.json().get("daily", {}).get("latest_device_total", 0)
        
        sync_payload = {
            "total_steps": current_steps + 2000,
            "source": "native_health",
            "native_provider": "health_connect",
            "native_platform": "android",
            "permission_state": "authorized",
            "distance_meters": 1600.0,
            "sample_count": 60,
            "used_fallback": False,
            "device_fingerprint": "test-native-android-device",
            "sensor_confidence": 0.92,
            "gps_distance_km": 1.6,
            "duration_minutes": 25,
            "gps_points": 42,
            "route_variance_score": 0.78,
            "activity_type": "walking",
            "background_tracking_minutes": 22
        }
        
        response = self.session.post(f"{BASE_URL}/api/move/sync-steps", json=sync_payload)
        assert response.status_code == 200, f"Sync failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True
        print(f"✓ Health Connect sync accepted: +{data.get('accepted_delta', 0)} steps")
    
    def test_sync_steps_with_web_fallback(self):
        """Test sync with web preview fallback (no native health)"""
        status_response = self.session.get(f"{BASE_URL}/api/move/status")
        assert status_response.status_code == 200
        current_steps = status_response.json().get("daily", {}).get("latest_device_total", 0)
        
        sync_payload = {
            "total_steps": current_steps + 1000,
            "source": "mobile_preview",
            "native_provider": "web_preview",
            "native_platform": "web",
            "permission_state": "preview",
            "distance_meters": 0,
            "sample_count": 0,
            "used_fallback": True,
            "device_fingerprint": "test-web-preview-device",
            "sensor_confidence": 0.42,
            "gps_distance_km": 0.12,
            "duration_minutes": 15,
            "gps_points": 2,
            "route_variance_score": 0.14,
            "activity_type": "walking",
            "background_tracking_minutes": 2
        }
        
        response = self.session.post(f"{BASE_URL}/api/move/sync-steps", json=sync_payload)
        assert response.status_code == 200, f"Sync failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True
        
        # Web fallback should have lower trust score
        scoring = data.get("scoring", {})
        trust_score = scoring.get("trust_score", 0)
        assert trust_score < 70, f"Web fallback trust score should be lower, got {trust_score}"
        
        print(f"✓ Web fallback sync accepted: +{data.get('accepted_delta', 0)} steps, trust={trust_score}")
    
    def test_sync_steps_permission_denied_state(self):
        """Test sync with permission denied state"""
        status_response = self.session.get(f"{BASE_URL}/api/move/status")
        assert status_response.status_code == 200
        current_steps = status_response.json().get("daily", {}).get("latest_device_total", 0)
        
        sync_payload = {
            "total_steps": current_steps + 800,
            "source": "native_health",
            "native_provider": "healthkit",
            "native_platform": "ios",
            "permission_state": "denied",
            "distance_meters": 0,
            "sample_count": 0,
            "used_fallback": True,
            "device_fingerprint": "test-permission-denied-device",
            "sensor_confidence": 0.3,
            "duration_minutes": 12
        }
        
        response = self.session.post(f"{BASE_URL}/api/move/sync-steps", json=sync_payload)
        assert response.status_code == 200, f"Sync failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True
        print(f"✓ Permission denied sync accepted: +{data.get('accepted_delta', 0)} steps")
    
    def test_move_history_endpoint(self):
        """Test GET /api/move/history returns reward history"""
        response = self.session.get(f"{BASE_URL}/api/move/history", params={"limit": 40})
        assert response.status_code == 200, f"History failed: {response.text}"
        
        data = response.json()
        assert "rewards" in data
        assert "days" in data
        assert "reward_transactions" in data
        
        print(f"✓ Move history returned {len(data.get('rewards', []))} rewards, {len(data.get('days', []))} days")
    
    def test_move_leaderboard_endpoint(self):
        """Test GET /api/move/leaderboard returns rankings"""
        response = self.session.get(f"{BASE_URL}/api/move/leaderboard", params={"limit": 20})
        assert response.status_code == 200, f"Leaderboard failed: {response.text}"
        
        data = response.json()
        assert "leaderboard" in data
        
        leaderboard = data.get("leaderboard", [])
        if leaderboard:
            first = leaderboard[0]
            assert "rank" in first
            assert "user_name" in first
            assert "total_xp" in first
            assert "total_steps" in first
        
        print(f"✓ Leaderboard returned {len(leaderboard)} entries")
    
    def test_admin_move_settings_endpoint(self):
        """Test GET /api/admin/move/settings returns admin settings"""
        response = self.session.get(f"{BASE_URL}/api/admin/move/settings")
        assert response.status_code == 200, f"Admin settings failed: {response.text}"
        
        data = response.json()
        assert "settings" in data
        
        settings = data.get("settings", {})
        assert "daily_step_goal" in settings
        assert "max_steps_per_day" in settings
        assert "premium_multiplier" in settings
        assert "ai_coach_enabled" in settings
        assert "gps_quality_weight" in settings
        assert "sensor_quality_weight" in settings
        assert "behavior_quality_weight" in settings
        
        print(f"✓ Admin settings returned with daily_goal={settings.get('daily_step_goal')}")
    
    def test_admin_move_stats_endpoint(self):
        """Test GET /api/admin/move/stats returns admin statistics"""
        response = self.session.get(f"{BASE_URL}/api/admin/move/stats")
        assert response.status_code == 200, f"Admin stats failed: {response.text}"
        
        data = response.json()
        assert "summary" in data
        assert "top_users" in data
        assert "growth" in data
        assert "roi" in data
        
        summary = data.get("summary", {})
        assert "profiles_count" in summary
        assert "active_today" in summary
        
        print(f"✓ Admin stats returned: {summary.get('profiles_count', 0)} profiles, {summary.get('active_today', 0)} active today")
    
    def test_coach_session_endpoint(self):
        """Test GET /api/move/coach-session returns AI coach data"""
        response = self.session.get(f"{BASE_URL}/api/move/coach-session")
        assert response.status_code == 200, f"Coach session failed: {response.text}"
        
        data = response.json()
        assert "coach" in data
        
        coach = data.get("coach", {})
        assert "average_steps_last_7d" in coach
        assert "suggested_goal" in coach
        assert "next_hint" in coach
        
        print(f"✓ Coach session returned with suggested_goal={coach.get('suggested_goal')}")
    
    def test_refresh_coach_session_endpoint(self):
        """Test POST /api/move/coach-session refreshes AI coach"""
        response = self.session.post(f"{BASE_URL}/api/move/coach-session", json={
            "focus": "daily_plan"
        })
        assert response.status_code == 200, f"Refresh coach failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True
        assert "coach" in data
        
        coach = data.get("coach", {})
        assert "headline" in coach
        assert "action_plan" in coach
        
        print(f"✓ Coach refresh returned: {coach.get('headline', '')[:50]}...")


class TestMoveNativeStepsValidation:
    """Tests for validation of native steps sync payload"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200
        yield
        self.session.close()
    
    def test_sync_rejects_negative_steps(self):
        """Test that negative total_steps is rejected"""
        response = self.session.post(f"{BASE_URL}/api/move/sync-steps", json={
            "total_steps": -100,
            "source": "test"
        })
        assert response.status_code == 422, f"Should reject negative steps: {response.text}"
        print("✓ Negative steps correctly rejected")
    
    def test_sync_rejects_excessive_steps(self):
        """Test that excessive total_steps (>300000) is rejected"""
        response = self.session.post(f"{BASE_URL}/api/move/sync-steps", json={
            "total_steps": 500000,
            "source": "test"
        })
        assert response.status_code == 422, f"Should reject excessive steps: {response.text}"
        print("✓ Excessive steps correctly rejected")
    
    def test_sync_accepts_optional_native_fields(self):
        """Test that all native fields are optional"""
        status_response = self.session.get(f"{BASE_URL}/api/move/status")
        current_steps = status_response.json().get("daily", {}).get("latest_device_total", 0)
        
        # Minimal payload without native fields
        response = self.session.post(f"{BASE_URL}/api/move/sync-steps", json={
            "total_steps": current_steps + 500,
            "source": "minimal_test"
        })
        assert response.status_code == 200, f"Minimal sync failed: {response.text}"
        print("✓ Minimal sync (without native fields) accepted")
    
    def test_sync_validates_distance_meters_range(self):
        """Test distance_meters validation (0-500000)"""
        status_response = self.session.get(f"{BASE_URL}/api/move/status")
        current_steps = status_response.json().get("daily", {}).get("latest_device_total", 0)
        
        # Valid distance
        response = self.session.post(f"{BASE_URL}/api/move/sync-steps", json={
            "total_steps": current_steps + 100,
            "source": "test",
            "distance_meters": 5000.0
        })
        assert response.status_code == 200, f"Valid distance failed: {response.text}"
        
        # Invalid negative distance
        response = self.session.post(f"{BASE_URL}/api/move/sync-steps", json={
            "total_steps": current_steps + 100,
            "source": "test",
            "distance_meters": -100.0
        })
        assert response.status_code == 422, f"Should reject negative distance: {response.text}"
        
        print("✓ Distance meters validation working correctly")
    
    def test_sync_validates_sample_count_range(self):
        """Test sample_count validation (0-20000)"""
        status_response = self.session.get(f"{BASE_URL}/api/move/status")
        current_steps = status_response.json().get("daily", {}).get("latest_device_total", 0)
        
        # Valid sample count
        response = self.session.post(f"{BASE_URL}/api/move/sync-steps", json={
            "total_steps": current_steps + 100,
            "source": "test",
            "sample_count": 500
        })
        assert response.status_code == 200, f"Valid sample count failed: {response.text}"
        
        # Invalid negative sample count
        response = self.session.post(f"{BASE_URL}/api/move/sync-steps", json={
            "total_steps": current_steps + 100,
            "source": "test",
            "sample_count": -10
        })
        assert response.status_code == 422, f"Should reject negative sample count: {response.text}"
        
        print("✓ Sample count validation working correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
