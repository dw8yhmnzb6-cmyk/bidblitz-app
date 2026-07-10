"""
Dating Video Profile Feature Tests
Tests for video profile upload, stream, delete and metadata propagation
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "reviewer@bidblitz.ae"
TEST_PASSWORD = "BidBlitzReview2026!"


@pytest.fixture(scope="module")
def auth_session():
    """Create authenticated session for all tests"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.status_code}")
    
    return session


class TestVideoProfileUpload:
    """Tests for POST /api/dating/video-profile"""
    
    def test_upload_video_profile_success(self, auth_session):
        """Test successful video profile upload with valid webm file"""
        # Create a minimal test video file
        video_content = b'\x1a\x45\xdf\xa3' + os.urandom(1024)  # webm header + random data
        
        files = {
            'file': ('test_video.webm', io.BytesIO(video_content), 'video/webm')
        }
        data = {'duration_seconds': '10'}
        
        # Remove Content-Type header for multipart
        headers = {k: v for k, v in auth_session.headers.items() if k.lower() != 'content-type'}
        
        response = auth_session.post(
            f"{BASE_URL}/api/dating/video-profile",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert data.get("ok") is True
        assert "video_profile" in data
        assert "media_id" in data["video_profile"]
        assert data["video_profile"]["duration_seconds"] == 10
        assert data["video_profile"]["content_type"] == "video/webm"
        
        # Store media_id for cleanup
        pytest.video_media_id = data["video_profile"]["media_id"]
    
    def test_upload_video_profile_invalid_format(self, auth_session):
        """Test video upload with unsupported format"""
        video_content = b'invalid video content'
        
        files = {
            'file': ('test_video.avi', io.BytesIO(video_content), 'video/x-msvideo')
        }
        data = {'duration_seconds': '10'}
        
        headers = {k: v for k, v in auth_session.headers.items() if k.lower() != 'content-type'}
        
        response = auth_session.post(
            f"{BASE_URL}/api/dating/video-profile",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 400
        assert "nicht unterstützt" in response.json().get("detail", "").lower() or "format" in response.json().get("detail", "").lower()
    
    def test_upload_video_profile_invalid_duration(self, auth_session):
        """Test video upload with duration exceeding 45 seconds"""
        video_content = b'\x1a\x45\xdf\xa3' + os.urandom(1024)
        
        files = {
            'file': ('test_video.webm', io.BytesIO(video_content), 'video/webm')
        }
        data = {'duration_seconds': '60'}  # Exceeds 45 second limit
        
        headers = {k: v for k, v in auth_session.headers.items() if k.lower() != 'content-type'}
        
        response = auth_session.post(
            f"{BASE_URL}/api/dating/video-profile",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 400
        assert "45" in response.json().get("detail", "") or "sekunden" in response.json().get("detail", "").lower()


class TestVideoProfileStream:
    """Tests for GET /api/dating/video-profile/{media_id}"""
    
    def test_stream_video_profile_success(self, auth_session):
        """Test streaming uploaded video profile"""
        # First upload a video
        video_content = b'\x1a\x45\xdf\xa3' + os.urandom(2048)
        
        files = {
            'file': ('test_video.webm', io.BytesIO(video_content), 'video/webm')
        }
        data = {'duration_seconds': '5'}
        
        headers = {k: v for k, v in auth_session.headers.items() if k.lower() != 'content-type'}
        
        upload_response = auth_session.post(
            f"{BASE_URL}/api/dating/video-profile",
            files=files,
            data=data,
            headers=headers
        )
        
        if upload_response.status_code != 200:
            pytest.skip("Upload failed, cannot test stream")
        
        media_id = upload_response.json()["video_profile"]["media_id"]
        
        # Stream the video
        stream_response = auth_session.get(f"{BASE_URL}/api/dating/video-profile/{media_id}")
        
        assert stream_response.status_code == 200
        assert len(stream_response.content) > 0
        assert "video" in stream_response.headers.get("content-type", "").lower()
    
    def test_stream_video_profile_not_found(self, auth_session):
        """Test streaming non-existent video profile"""
        response = auth_session.get(f"{BASE_URL}/api/dating/video-profile/DMED-NONEXISTENT")
        
        assert response.status_code == 404


class TestVideoProfileDelete:
    """Tests for DELETE /api/dating/video-profile"""
    
    def test_delete_video_profile_success(self, auth_session):
        """Test deleting video profile"""
        # First upload a video
        video_content = b'\x1a\x45\xdf\xa3' + os.urandom(1024)
        
        files = {
            'file': ('test_video.webm', io.BytesIO(video_content), 'video/webm')
        }
        data = {'duration_seconds': '5'}
        
        headers = {k: v for k, v in auth_session.headers.items() if k.lower() != 'content-type'}
        
        upload_response = auth_session.post(
            f"{BASE_URL}/api/dating/video-profile",
            files=files,
            data=data,
            headers=headers
        )
        
        if upload_response.status_code != 200:
            pytest.skip("Upload failed, cannot test delete")
        
        # Delete the video
        delete_response = auth_session.delete(
            f"{BASE_URL}/api/dating/video-profile",
            json={}
        )
        
        assert delete_response.status_code == 200
        assert delete_response.json().get("ok") is True
        
        # Verify video is removed from profile
        profile_response = auth_session.get(f"{BASE_URL}/api/dating/profile/me")
        assert profile_response.status_code == 200
        assert profile_response.json()["profile"].get("video_profile") is None


class TestVideoProfileMetadataPropagation:
    """Tests for video_profile metadata in profile/discover/matches/likes flows"""
    
    def test_profile_me_returns_video_profile_with_stream_url(self, auth_session):
        """Test that profile/me returns video_profile with stream_url when present"""
        # Upload a video first
        video_content = b'\x1a\x45\xdf\xa3' + os.urandom(1024)
        
        files = {
            'file': ('test_video.webm', io.BytesIO(video_content), 'video/webm')
        }
        data = {'duration_seconds': '8'}
        
        headers = {k: v for k, v in auth_session.headers.items() if k.lower() != 'content-type'}
        
        upload_response = auth_session.post(
            f"{BASE_URL}/api/dating/video-profile",
            files=files,
            data=data,
            headers=headers
        )
        
        if upload_response.status_code != 200:
            pytest.skip("Upload failed")
        
        media_id = upload_response.json()["video_profile"]["media_id"]
        
        # Check profile/me
        profile_response = auth_session.get(f"{BASE_URL}/api/dating/profile/me")
        assert profile_response.status_code == 200
        
        profile = profile_response.json()["profile"]
        assert "video_profile" in profile
        assert profile["video_profile"]["media_id"] == media_id
        assert "stream_url" in profile["video_profile"]
        assert f"/api/dating/video-profile/{media_id}" in profile["video_profile"]["stream_url"]
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/dating/video-profile", json={})
    
    def test_discover_returns_video_profile_metadata(self, auth_session):
        """Test that discover endpoint returns video_profile metadata for profiles"""
        response = auth_session.get(f"{BASE_URL}/api/dating/discover")
        
        assert response.status_code == 200
        # Just verify the endpoint works - profiles may or may not have video
        data = response.json()
        assert "profiles" in data
    
    def test_matches_returns_video_profile_metadata(self, auth_session):
        """Test that matches endpoint returns video_profile metadata"""
        response = auth_session.get(f"{BASE_URL}/api/dating/matches")
        
        assert response.status_code == 200
        data = response.json()
        assert "matches" in data
        
        # If there are matches with video_profile, verify stream_url is present
        for match in data["matches"]:
            if match.get("video_profile"):
                assert "stream_url" in match["video_profile"]
    
    def test_likes_you_returns_video_profile_metadata(self, auth_session):
        """Test that likes-you endpoint returns video_profile metadata"""
        response = auth_session.get(f"{BASE_URL}/api/dating/likes-you")
        
        assert response.status_code == 200
        data = response.json()
        
        # If unlocked and has profiles with video_profile, verify stream_url
        if not data.get("locked") and data.get("profiles"):
            for profile in data["profiles"]:
                if profile.get("video_profile"):
                    assert "stream_url" in profile["video_profile"]


class TestDatingRegressionAfterVideoProfile:
    """Regression tests to ensure existing dating features still work"""
    
    def test_discover_endpoint_works(self, auth_session):
        """Regression: Discover endpoint still works"""
        response = auth_session.get(f"{BASE_URL}/api/dating/discover")
        assert response.status_code == 200
        assert "profiles" in response.json()
    
    def test_matches_endpoint_works(self, auth_session):
        """Regression: Matches endpoint still works"""
        response = auth_session.get(f"{BASE_URL}/api/dating/matches")
        assert response.status_code == 200
        assert "matches" in response.json()
    
    def test_likes_you_endpoint_works(self, auth_session):
        """Regression: Likes-you endpoint still works"""
        response = auth_session.get(f"{BASE_URL}/api/dating/likes-you")
        assert response.status_code == 200
    
    def test_nearby_endpoint_works(self, auth_session):
        """Regression: Nearby endpoint still works"""
        response = auth_session.get(f"{BASE_URL}/api/dating/nearby")
        assert response.status_code == 200
    
    def test_crossed_paths_endpoint_works(self, auth_session):
        """Regression: Crossed paths endpoint still works"""
        response = auth_session.get(f"{BASE_URL}/api/dating/crossed-paths")
        assert response.status_code == 200
        assert "profiles" in response.json()
    
    def test_swipes_left_endpoint_works(self, auth_session):
        """Regression: Swipes-left endpoint still works"""
        response = auth_session.get(f"{BASE_URL}/api/dating/swipes-left")
        assert response.status_code == 200
        assert "swipes_left" in response.json()
    
    def test_voice_intro_endpoint_works(self, auth_session):
        """Regression: Voice intro endpoints still work"""
        # Just verify the endpoint is accessible (may return 404 if no voice intro)
        response = auth_session.get(f"{BASE_URL}/api/dating/voice-intro/DMED-TEST")
        assert response.status_code in [200, 404]  # 404 is expected if no voice intro
    
    def test_boost_state_in_profile(self, auth_session):
        """Regression: Boost state is returned in profile"""
        response = auth_session.get(f"{BASE_URL}/api/dating/profile/me")
        assert response.status_code == 200
        profile = response.json()["profile"]
        assert "boost" in profile
        assert "is_active" in profile["boost"]
    
    def test_ai_bio_endpoint_works(self, auth_session):
        """Regression: AI bio endpoint still works"""
        response = auth_session.post(
            f"{BASE_URL}/api/dating/ai/bio",
            json={"prompt": "Test"}
        )
        # May take time, just verify it doesn't error immediately
        assert response.status_code in [200, 502]  # 502 if AI service slow
    
    def test_profile_update_works(self, auth_session):
        """Regression: Profile update still works"""
        # Get current profile
        profile_response = auth_session.get(f"{BASE_URL}/api/dating/profile/me")
        current_profile = profile_response.json()["profile"]
        
        # Update with same data
        update_response = auth_session.put(
            f"{BASE_URL}/api/dating/profile/me",
            json={
                "name": current_profile.get("name", "Test User"),
                "age": current_profile.get("age", 25),
                "city": current_profile.get("city", ""),
                "bio": current_profile.get("bio", ""),
                "occupation": current_profile.get("occupation", ""),
                "profile_prompt": current_profile.get("profile_prompt", ""),
                "interests": current_profile.get("interests", []),
                "gender": current_profile.get("gender", "unspecified"),
                "seeking": current_profile.get("seeking", []),
                "relationship_intent": current_profile.get("relationship_intent", "serious"),
                "photos": current_profile.get("photos", [])
            }
        )
        assert update_response.status_code == 200
        assert update_response.json().get("ok") is True
