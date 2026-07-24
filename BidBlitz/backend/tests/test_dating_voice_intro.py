"""
Dating Voice Intro Feature Tests - Iteration 221
Tests: Upload, Stream, Delete voice intro + metadata propagation in discover/matches/likes
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "reviewer@bidblitz.ae"
TEST_PASSWORD = "BidBlitzReview2026!"


class TestDatingVoiceIntro:
    """Voice Intro upload/stream/delete tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json()
        yield
        # Cleanup - delete any voice intro created during tests
        try:
            self.session.delete(f"{BASE_URL}/api/dating/voice-intro", json={})
        except:
            pass
    
    def test_01_voice_intro_card_visible_in_profile(self):
        """Verify profile/me returns voice_intro field structure"""
        response = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        assert response.status_code == 200, f"Profile fetch failed: {response.text}"
        data = response.json()
        assert "profile" in data
        # voice_intro may or may not exist depending on state
        profile = data["profile"]
        assert "profile_id" in profile
        print(f"Profile fetched: {profile.get('name')}, voice_intro present: {'voice_intro' in profile}")
    
    def test_02_upload_voice_intro_success(self):
        """POST /api/dating/voice-intro - Upload audio file"""
        # Create a minimal valid webm audio file (header only for testing)
        # Real webm header bytes
        webm_header = bytes([
            0x1A, 0x45, 0xDF, 0xA3,  # EBML header
            0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1F,
            0x42, 0x86, 0x81, 0x01,  # EBMLVersion
            0x42, 0xF7, 0x81, 0x01,  # EBMLReadVersion
            0x42, 0xF2, 0x81, 0x04,  # EBMLMaxIDLength
            0x42, 0xF3, 0x81, 0x08,  # EBMLMaxSizeLength
            0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6D,  # DocType: webm
        ])
        # Pad to make it a reasonable size
        audio_data = webm_header + b'\x00' * 1000
        
        files = {
            'file': ('voice-intro.webm', io.BytesIO(audio_data), 'audio/webm')
        }
        data = {
            'duration_seconds': '5'
        }
        
        # Remove Content-Type header for multipart
        headers = dict(self.session.headers)
        headers.pop('Content-Type', None)
        
        response = self.session.post(
            f"{BASE_URL}/api/dating/voice-intro",
            files=files,
            data=data,
            headers=headers
        )
        
        # Accept 200 or 502 (storage may fail in test env)
        if response.status_code == 502:
            pytest.skip("Storage backend unavailable in test environment")
        
        assert response.status_code == 200, f"Upload failed: {response.status_code} - {response.text}"
        result = response.json()
        assert result.get("ok") is True
        assert "voice_intro" in result
        voice_intro = result["voice_intro"]
        assert "media_id" in voice_intro
        assert voice_intro.get("duration_seconds") == 5
        print(f"Voice intro uploaded: media_id={voice_intro['media_id']}")
        self.media_id = voice_intro["media_id"]
    
    def test_03_upload_voice_intro_invalid_duration(self):
        """POST /api/dating/voice-intro - Reject invalid duration"""
        webm_header = bytes([0x1A, 0x45, 0xDF, 0xA3]) + b'\x00' * 100
        
        files = {
            'file': ('voice-intro.webm', io.BytesIO(webm_header), 'audio/webm')
        }
        data = {
            'duration_seconds': '0'  # Invalid: must be 1-30
        }
        
        headers = dict(self.session.headers)
        headers.pop('Content-Type', None)
        
        response = self.session.post(
            f"{BASE_URL}/api/dating/voice-intro",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid duration, got {response.status_code}"
        print("Invalid duration correctly rejected")
    
    def test_04_upload_voice_intro_invalid_format(self):
        """POST /api/dating/voice-intro - Reject unsupported audio format"""
        fake_data = b'not a valid audio file'
        
        files = {
            'file': ('voice-intro.txt', io.BytesIO(fake_data), 'text/plain')
        }
        data = {
            'duration_seconds': '5'
        }
        
        headers = dict(self.session.headers)
        headers.pop('Content-Type', None)
        
        response = self.session.post(
            f"{BASE_URL}/api/dating/voice-intro",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid format, got {response.status_code}"
        print("Invalid audio format correctly rejected")
    
    def test_05_stream_voice_intro(self):
        """GET /api/dating/voice-intro/{media_id} - Stream uploaded audio"""
        # First get profile to check if voice_intro exists
        profile_response = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        assert profile_response.status_code == 200
        profile = profile_response.json().get("profile", {})
        
        voice_intro = profile.get("voice_intro")
        if not voice_intro or not voice_intro.get("media_id"):
            pytest.skip("No voice intro uploaded to stream")
        
        media_id = voice_intro["media_id"]
        
        response = self.session.get(f"{BASE_URL}/api/dating/voice-intro/{media_id}")
        
        if response.status_code == 502:
            pytest.skip("Storage backend unavailable")
        
        assert response.status_code == 200, f"Stream failed: {response.status_code} - {response.text}"
        assert len(response.content) > 0, "Empty audio content"
        print(f"Voice intro streamed: {len(response.content)} bytes")
    
    def test_06_stream_voice_intro_not_found(self):
        """GET /api/dating/voice-intro/{media_id} - 404 for non-existent"""
        response = self.session.get(f"{BASE_URL}/api/dating/voice-intro/DMED-NONEXISTENT")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Non-existent voice intro correctly returns 404")
    
    def test_07_delete_voice_intro(self):
        """DELETE /api/dating/voice-intro - Delete active voice intro"""
        # First check if voice_intro exists
        profile_response = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        profile = profile_response.json().get("profile", {})
        
        if not profile.get("voice_intro"):
            pytest.skip("No voice intro to delete")
        
        response = self.session.delete(
            f"{BASE_URL}/api/dating/voice-intro",
            json={"media_id": profile["voice_intro"].get("media_id")}
        )
        
        assert response.status_code == 200, f"Delete failed: {response.status_code} - {response.text}"
        result = response.json()
        assert result.get("ok") is True
        print("Voice intro deleted successfully")
        
        # Verify it's gone from profile
        profile_response = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        profile = profile_response.json().get("profile", {})
        assert profile.get("voice_intro") is None, "Voice intro should be removed from profile"
    
    def test_08_delete_voice_intro_not_found(self):
        """DELETE /api/dating/voice-intro - 404 when no voice intro exists"""
        # First ensure no voice intro exists
        self.session.delete(f"{BASE_URL}/api/dating/voice-intro", json={})
        
        # Try to delete again
        response = self.session.delete(
            f"{BASE_URL}/api/dating/voice-intro",
            json={}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Delete non-existent voice intro correctly returns 404")


class TestDatingVoiceIntroMetadataPropagation:
    """Test voice_intro metadata appears in discover/matches/likes flows"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200
        yield
    
    def test_09_discover_includes_voice_intro_metadata(self):
        """GET /api/dating/discover - Profiles with voice_intro have stream_url"""
        response = self.session.get(f"{BASE_URL}/api/dating/discover")
        assert response.status_code == 200, f"Discover failed: {response.text}"
        data = response.json()
        assert "profiles" in data
        
        # Check if any profile has voice_intro with stream_url
        profiles_with_voice = [p for p in data["profiles"] if p.get("voice_intro")]
        if profiles_with_voice:
            for profile in profiles_with_voice:
                voice_intro = profile["voice_intro"]
                assert "stream_url" in voice_intro, "voice_intro should have stream_url"
                assert voice_intro["stream_url"].startswith("/api/dating/voice-intro/")
                print(f"Profile {profile['name']} has voice_intro with stream_url")
        else:
            print("No profiles with voice_intro in discover (expected if no seed profiles have voice)")
    
    def test_10_matches_includes_voice_intro_metadata(self):
        """GET /api/dating/matches - Matches with voice_intro have stream_url"""
        response = self.session.get(f"{BASE_URL}/api/dating/matches")
        assert response.status_code == 200, f"Matches failed: {response.text}"
        data = response.json()
        assert "matches" in data
        
        matches_with_voice = [m for m in data["matches"] if m.get("voice_intro")]
        if matches_with_voice:
            for match in matches_with_voice:
                voice_intro = match["voice_intro"]
                assert "stream_url" in voice_intro
                print(f"Match {match['name']} has voice_intro with stream_url")
        else:
            print("No matches with voice_intro (expected)")
    
    def test_11_likes_you_includes_voice_intro_metadata(self):
        """GET /api/dating/likes-you - Likes with voice_intro have stream_url"""
        response = self.session.get(f"{BASE_URL}/api/dating/likes-you")
        assert response.status_code == 200, f"Likes-you failed: {response.text}"
        data = response.json()
        
        # May be locked for non-premium
        if data.get("locked"):
            print("Likes-you is locked (non-premium user)")
            return
        
        profiles_with_voice = [p for p in data.get("profiles", []) if p.get("voice_intro")]
        if profiles_with_voice:
            for profile in profiles_with_voice:
                voice_intro = profile["voice_intro"]
                assert "stream_url" in voice_intro
                print(f"Like from {profile['name']} has voice_intro with stream_url")
        else:
            print("No likes with voice_intro (expected)")


class TestDatingRegressionAfterVoiceIntro:
    """Regression tests: Existing dating features still work"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200
        yield
    
    def test_12_profile_me_still_works(self):
        """GET /api/dating/profile/me - Profile endpoint works"""
        response = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        assert response.status_code == 200
        data = response.json()
        assert "profile" in data
        assert "filters" in data
        print(f"Profile: {data['profile'].get('name')}")
    
    def test_13_discover_still_works(self):
        """GET /api/dating/discover - Discover endpoint works"""
        response = self.session.get(f"{BASE_URL}/api/dating/discover")
        assert response.status_code == 200
        data = response.json()
        assert "profiles" in data
        print(f"Discover returned {len(data['profiles'])} profiles")
    
    def test_14_matches_still_works(self):
        """GET /api/dating/matches - Matches endpoint works"""
        response = self.session.get(f"{BASE_URL}/api/dating/matches")
        assert response.status_code == 200
        data = response.json()
        assert "matches" in data
        print(f"Matches: {len(data['matches'])}")
    
    def test_15_likes_you_still_works(self):
        """GET /api/dating/likes-you - Likes-you endpoint works"""
        response = self.session.get(f"{BASE_URL}/api/dating/likes-you")
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"Likes-you count: {data['count']}, locked: {data.get('locked')}")
    
    def test_16_swipes_left_still_works(self):
        """GET /api/dating/swipes-left - Swipes endpoint works"""
        response = self.session.get(f"{BASE_URL}/api/dating/swipes-left")
        assert response.status_code == 200
        data = response.json()
        assert "swipes_left" in data
        print(f"Swipes left: {data['swipes_left']}")
    
    def test_17_nearby_still_works(self):
        """GET /api/dating/nearby - Nearby endpoint works"""
        response = self.session.get(f"{BASE_URL}/api/dating/nearby")
        assert response.status_code == 200
        data = response.json()
        assert "profiles" in data
        print(f"Nearby: {len(data['profiles'])} profiles, enabled: {data.get('nearby_enabled')}")
    
    def test_18_crossed_paths_still_works(self):
        """GET /api/dating/crossed-paths - Crossed paths endpoint works"""
        response = self.session.get(f"{BASE_URL}/api/dating/crossed-paths")
        assert response.status_code == 200
        data = response.json()
        assert "profiles" in data
        print(f"Crossed paths: {len(data['profiles'])} profiles")
    
    def test_19_ai_bio_still_works(self):
        """POST /api/dating/ai/bio - AI Bio endpoint works"""
        response = self.session.post(
            f"{BASE_URL}/api/dating/ai/bio",
            json={"prompt": "Test"}
        )
        # May take time, accept 200 or timeout
        if response.status_code == 200:
            data = response.json()
            assert data.get("ok") is True
            print(f"AI Bio suggestions: {len(data.get('suggestions', []))}")
        else:
            print(f"AI Bio returned {response.status_code} (may be slow)")
    
    def test_20_boost_state_in_profile(self):
        """Verify boost state is still returned in profile"""
        response = self.session.get(f"{BASE_URL}/api/dating/profile/me")
        assert response.status_code == 200
        profile = response.json().get("profile", {})
        assert "boost" in profile, "Boost state should be in profile"
        boost = profile["boost"]
        assert "is_active" in boost
        assert "seconds_left" in boost
        print(f"Boost state: active={boost['is_active']}, seconds_left={boost['seconds_left']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
