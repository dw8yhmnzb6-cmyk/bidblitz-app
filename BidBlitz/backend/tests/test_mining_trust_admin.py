"""
Mining Trust Admin API Tests - Iteration 233
Tests for:
- GET /api/mining/trust/public (videos array)
- GET /api/mining/trust/leads (admin only)
- POST /api/mining/trust/leads/{lead_id}/status (admin only)
- GET /api/mining/trust/videos (admin only)
- POST /api/mining/trust/videos (admin only - upsert)
"""

import pytest
import requests
import os
import secrets

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials from test_credentials.md
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


class TestMiningTrustPublicAPI:
    """Test public mining trust API endpoints"""
    
    def test_public_endpoint_returns_videos_array(self):
        """GET /api/mining/trust/public should include videos array"""
        response = requests.get(f"{BASE_URL}/api/mining/trust/public")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "proof_metrics" in data, "Response should contain proof_metrics"
        assert "network" in data, "Response should contain network"
        assert "videos" in data, "Response should contain videos array"
        assert isinstance(data["videos"], list), "videos should be a list"
        
        print(f"✓ Public endpoint returns videos array with {len(data['videos'])} items")
        return data


class TestMiningTrustAdminAuth:
    """Test admin authentication for mining trust endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Create authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code} - {login_response.text}")
        
        print(f"✓ Admin login successful")
        return session
    
    def test_leads_endpoint_requires_admin(self):
        """GET /api/mining/trust/leads should require admin auth"""
        response = requests.get(f"{BASE_URL}/api/mining/trust/leads")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Leads endpoint correctly requires authentication")
    
    def test_videos_admin_endpoint_requires_admin(self):
        """GET /api/mining/trust/videos should require admin auth"""
        response = requests.get(f"{BASE_URL}/api/mining/trust/videos")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Videos admin endpoint correctly requires authentication")


class TestMiningTrustLeadsAdmin:
    """Test admin leads management endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Create authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        
        return session
    
    def test_get_leads_as_admin(self, admin_session):
        """GET /api/mining/trust/leads should return leads list for admin"""
        response = admin_session.get(f"{BASE_URL}/api/mining/trust/leads")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "leads" in data, "Response should contain leads array"
        assert isinstance(data["leads"], list), "leads should be a list"
        
        print(f"✓ Admin can fetch leads - found {len(data['leads'])} leads")
        return data["leads"]
    
    def test_create_lead_and_update_status(self, admin_session):
        """Create a lead via public endpoint, then update status as admin"""
        # First create a test lead via public endpoint
        test_lead = {
            "name": f"TEST_Lead_{secrets.token_hex(4)}",
            "email": f"test.lead.{secrets.token_hex(4)}@example.com",
            "company": "Test Company",
            "message": "Test message for admin CRM testing"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/mining/trust/lead",
            json=test_lead,
            headers={"Content-Type": "application/json"}
        )
        assert create_response.status_code == 200, f"Lead creation failed: {create_response.text}"
        
        created_lead = create_response.json()
        assert "lead" in created_lead, "Response should contain lead"
        lead_id = created_lead["lead"]["lead_id"]
        print(f"✓ Created test lead: {lead_id}")
        
        # Now update the lead status as admin
        status_response = admin_session.post(
            f"{BASE_URL}/api/mining/trust/leads/{lead_id}/status",
            json={"status": "contacted"}
        )
        assert status_response.status_code == 200, f"Status update failed: {status_response.text}"
        
        updated_lead = status_response.json()
        assert updated_lead.get("ok") == True, "Response should have ok: true"
        assert updated_lead["lead"]["status"] == "contacted", "Status should be updated to 'contacted'"
        
        print(f"✓ Lead status updated to 'contacted'")
        
        # Update to another status
        status_response2 = admin_session.post(
            f"{BASE_URL}/api/mining/trust/leads/{lead_id}/status",
            json={"status": "qualified"}
        )
        assert status_response2.status_code == 200
        assert status_response2.json()["lead"]["status"] == "qualified"
        
        print(f"✓ Lead status updated to 'qualified'")
        return lead_id


class TestMiningTrustVideosAdmin:
    """Test admin video management endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Create authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        
        return session
    
    def test_get_videos_as_admin(self, admin_session):
        """GET /api/mining/trust/videos should return videos list for admin"""
        response = admin_session.get(f"{BASE_URL}/api/mining/trust/videos")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "videos" in data, "Response should contain videos array"
        assert isinstance(data["videos"], list), "videos should be a list"
        
        print(f"✓ Admin can fetch videos - found {len(data['videos'])} videos")
        return data["videos"]
    
    def test_upsert_video_dubai(self, admin_session):
        """POST /api/mining/trust/videos should upsert Dubai video"""
        video_data = {
            "city": "Dubai",
            "title": "Dubai Mining Facility",
            "description": "Our state-of-the-art mining facility in Dubai",
            "video_url": "https://example.com/dubai-mining-video.mp4",
            "thumbnail_url": "https://example.com/dubai-thumbnail.jpg"
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/mining/trust/videos",
            json=video_data
        )
        assert response.status_code == 200, f"Video upsert failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") == True, "Response should have ok: true"
        assert "video" in data, "Response should contain video"
        assert data["video"]["city"] == "Dubai", "City should be Dubai"
        assert data["video"]["video_url"] == video_data["video_url"], "Video URL should match"
        
        print(f"✓ Dubai video upserted successfully")
        return data["video"]
    
    def test_upsert_video_abu_dhabi(self, admin_session):
        """POST /api/mining/trust/videos should upsert Abu Dhabi video"""
        video_data = {
            "city": "Abu Dhabi",
            "title": "Abu Dhabi Mining Center",
            "description": "Our mining operations in Abu Dhabi",
            "video_url": "https://example.com/abudhabi-mining-video.mp4",
            "thumbnail_url": "https://example.com/abudhabi-thumbnail.jpg"
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/mining/trust/videos",
            json=video_data
        )
        assert response.status_code == 200, f"Video upsert failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") == True
        assert data["video"]["city"] == "Abu Dhabi"
        
        print(f"✓ Abu Dhabi video upserted successfully")
        return data["video"]
    
    def test_public_endpoint_reflects_saved_videos(self, admin_session):
        """Verify public endpoint shows saved videos"""
        # First save a video
        video_data = {
            "city": "Dubai",
            "title": "Dubai Test Video",
            "description": "Test description",
            "video_url": "https://test.example.com/dubai-test.mp4",
            "thumbnail_url": ""
        }
        
        save_response = admin_session.post(
            f"{BASE_URL}/api/mining/trust/videos",
            json=video_data
        )
        assert save_response.status_code == 200
        
        # Now check public endpoint
        public_response = requests.get(f"{BASE_URL}/api/mining/trust/public")
        assert public_response.status_code == 200
        
        public_data = public_response.json()
        videos = public_data.get("videos", [])
        
        # Find Dubai video
        dubai_video = next((v for v in videos if v.get("city") == "Dubai"), None)
        assert dubai_video is not None, "Dubai video should be in public response"
        assert dubai_video["video_url"] == video_data["video_url"], "Video URL should match saved value"
        
        print(f"✓ Public endpoint reflects saved video data")


class TestMiningTrustRegression:
    """Regression tests for existing functionality"""
    
    def test_public_page_api_still_works(self):
        """Verify public API still returns expected structure"""
        response = requests.get(f"{BASE_URL}/api/mining/trust/public")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check proof_metrics structure
        assert "proof_metrics" in data
        metrics = data["proof_metrics"]
        assert "hashrate_cluster_phs" in metrics
        assert "uptime_percent" in metrics
        assert "cooling_status" in metrics
        assert "monitoring" in metrics
        assert "locations" in metrics
        
        # Check network structure
        assert "network" in data
        network = data["network"]
        assert "active_miners" in network
        assert "wallets" in network
        assert "registered_hashrate_ths" in network
        
        print(f"✓ Public API structure intact - hashrate: {metrics['hashrate_cluster_phs']} PH/s")
    
    def test_lead_form_still_works(self):
        """Verify lead submission still works"""
        test_lead = {
            "name": "Regression Test User",
            "email": f"regression.{secrets.token_hex(4)}@test.com",
            "company": "Test Corp",
            "message": "Regression test message"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/mining/trust/lead",
            json=test_lead,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("ok") == True
        assert "lead" in data
        assert data["lead"]["email"] == test_lead["email"].lower()
        
        print(f"✓ Lead form submission still works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
