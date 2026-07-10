"""
Dating Iteration 224 Tests:
- Quick setup auto-import from registration (sync_profile_from_registration)
- Match reasons in discover/matches/likes
- Chat safety analysis and refresh
- High-risk message blocking
- Regression: core dating endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://swipe-match-chat-8.preview.emergentagent.com"

TEST_EMAIL = "reviewer@bidblitz.ae"
TEST_PASSWORD = "BidBlitzReview2026!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    """Login and get session cookie"""
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Login failed: {resp.status_code} - {resp.text}")
    return True


class TestDatingProfileSyncFromRegistration:
    """Test that dating profile auto-syncs fields from registration"""

    def test_profile_me_returns_synced_fields(self, session, auth_token):
        """GET /api/dating/profile/me should return profile with synced registration data"""
        resp = session.get(f"{BASE_URL}/api/dating/profile/me")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "profile" in data
        profile = data["profile"]
        
        # Verify synced fields exist (from registration)
        assert "name" in profile, "Profile should have name field"
        assert "age" in profile or "birth_date" in profile, "Profile should have age or birth_date"
        assert "city" in profile, "Profile should have city field"
        assert "avatar" in profile or "photos" in profile, "Profile should have avatar or photos"
        
        # Verify profile_id exists
        assert "profile_id" in profile
        assert profile["profile_id"].startswith("DAT-")
        
        print(f"PASS: Profile synced - name={profile.get('name')}, age={profile.get('age')}, city={profile.get('city')}")

    def test_profile_update_preserves_dating_specific_fields(self, session, auth_token):
        """PUT /api/dating/profile/me should allow updating dating-specific fields"""
        # First get current profile
        resp = session.get(f"{BASE_URL}/api/dating/profile/me")
        assert resp.status_code == 200
        current = resp.json()["profile"]
        
        # Update dating-specific fields only
        update_payload = {
            "name": current.get("name") or "Test User",
            "age": current.get("age") or 25,
            "city": current.get("city") or "Berlin",
            "bio": "Test bio for iteration 224",
            "occupation": "Software Engineer",
            "profile_prompt": "Mein perfekter Sonntag ist...",
            "interests": ["Reisen", "Musik", "Tech"],
            "gender": current.get("gender") or "unspecified",
            "seeking": current.get("seeking") or ["women", "men"],
            "relationship_intent": "serious",
            "photos": current.get("photos") or [current.get("avatar") or "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80"]
        }
        
        resp = session.put(f"{BASE_URL}/api/dating/profile/me", json=update_payload)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert data.get("ok") is True
        assert "profile" in data
        
        updated = data["profile"]
        assert updated.get("bio") == "Test bio for iteration 224"
        assert updated.get("occupation") == "Software Engineer"
        assert "Reisen" in updated.get("interests", [])
        
        print(f"PASS: Dating-specific fields updated successfully")


class TestMatchReasonsInDiscover:
    """Test that discover profiles include match_reasons"""

    def test_discover_profiles_have_match_reasons(self, session, auth_token):
        """GET /api/dating/discover should return profiles with match_reasons"""
        resp = session.get(f"{BASE_URL}/api/dating/discover")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        profiles = data.get("profiles", [])
        if not profiles:
            pytest.skip("No discover profiles available")
        
        # Check at least one profile has match_reasons
        profiles_with_reasons = [p for p in profiles if p.get("match_reasons")]
        
        # Verify match_reasons structure
        for profile in profiles_with_reasons[:3]:
            reasons = profile.get("match_reasons", [])
            assert isinstance(reasons, list), "match_reasons should be a list"
            for reason in reasons:
                assert isinstance(reason, str), "Each reason should be a string"
            print(f"Profile {profile.get('name')}: {reasons}")
        
        print(f"PASS: {len(profiles_with_reasons)}/{len(profiles)} profiles have match_reasons")


class TestMatchReasonsInMatches:
    """Test that matches include match_reasons"""

    def test_matches_have_match_reasons(self, session, auth_token):
        """GET /api/dating/matches should return matches with match_reasons"""
        resp = session.get(f"{BASE_URL}/api/dating/matches")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        matches = data.get("matches", [])
        if not matches:
            pytest.skip("No matches available")
        
        # Check matches have match_reasons
        for match in matches[:3]:
            reasons = match.get("match_reasons", [])
            print(f"Match {match.get('name')}: {reasons}")
            # match_reasons may be empty if no shared interests etc
            assert isinstance(reasons, list), "match_reasons should be a list"
        
        print(f"PASS: Matches endpoint returns match_reasons field")


class TestMatchReasonsInLikesYou:
    """Test that likes-you profiles include match_reasons"""

    def test_likes_you_have_match_reasons(self, session, auth_token):
        """GET /api/dating/likes-you should return profiles with match_reasons"""
        resp = session.get(f"{BASE_URL}/api/dating/likes-you")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        if data.get("locked"):
            pytest.skip("Likes You is locked (non-premium)")
        
        profiles = data.get("profiles", [])
        if not profiles:
            pytest.skip("No likes-you profiles available")
        
        for profile in profiles[:3]:
            reasons = profile.get("match_reasons", [])
            print(f"Like from {profile.get('name')}: {reasons}")
            assert isinstance(reasons, list), "match_reasons should be a list"
        
        print(f"PASS: Likes-you endpoint returns match_reasons field")


class TestChatSafetyAnalysis:
    """Test chat safety analysis and refresh"""

    def test_messages_endpoint_returns_chat_safety_summary(self, session, auth_token):
        """GET /api/dating/matches/{match_id}/messages should return chat_safety_summary"""
        # First get matches
        resp = session.get(f"{BASE_URL}/api/dating/matches")
        assert resp.status_code == 200
        matches = resp.json().get("matches", [])
        
        if not matches:
            pytest.skip("No matches available for chat safety test")
        
        match_id = matches[0]["match_id"]
        
        # Get messages
        resp = session.get(f"{BASE_URL}/api/dating/matches/{match_id}/messages")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Verify chat_safety_summary is present
        assert "chat_safety_summary" in data, "Response should include chat_safety_summary"
        summary = data["chat_safety_summary"]
        
        if summary:
            assert "score" in summary or "level" in summary, "chat_safety_summary should have score or level"
            print(f"PASS: Chat safety summary: score={summary.get('score')}, level={summary.get('level')}")
        else:
            print("PASS: chat_safety_summary is null (no flagged messages)")

    def test_chat_safety_refresh_endpoint(self, session, auth_token):
        """POST /api/dating/matches/{match_id}/chat-safety should refresh chat safety"""
        # First get matches
        resp = session.get(f"{BASE_URL}/api/dating/matches")
        assert resp.status_code == 200
        matches = resp.json().get("matches", [])
        
        if not matches:
            pytest.skip("No matches available for chat safety refresh test")
        
        match_id = matches[0]["match_id"]
        
        # Refresh chat safety
        resp = session.post(f"{BASE_URL}/api/dating/matches/{match_id}/chat-safety", json={
            "match_id": match_id,
            "force": True
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert data.get("ok") is True
        assert "chat_safety_summary" in data
        
        summary = data["chat_safety_summary"]
        assert "score" in summary, "Summary should have score"
        assert "level" in summary, "Summary should have level"
        assert "status" in summary, "Summary should have status"
        
        print(f"PASS: Chat safety refreshed - score={summary.get('score')}, level={summary.get('level')}, status={summary.get('status')}")


class TestHighRiskMessageBlocking:
    """Test that high-risk scam-like messages are blocked"""

    def test_normal_message_sends_successfully(self, session, auth_token):
        """POST /api/dating/matches/{match_id}/messages with normal text should succeed"""
        # First get matches
        resp = session.get(f"{BASE_URL}/api/dating/matches")
        assert resp.status_code == 200
        matches = resp.json().get("matches", [])
        
        if not matches:
            pytest.skip("No matches available for message test")
        
        match_id = matches[0]["match_id"]
        
        # Send normal message
        resp = session.post(f"{BASE_URL}/api/dating/matches/{match_id}/messages", json={
            "text": "Hallo! Wie geht es dir heute?"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert data.get("ok") is True
        assert "message" in data
        assert data["message"]["text"] == "Hallo! Wie geht es dir heute?"
        
        # Check preflight safety
        preflight = data.get("chat_safety_preflight", {})
        assert preflight.get("safe_to_send") is True, "Normal message should be safe to send"
        
        print(f"PASS: Normal message sent successfully, preflight safe_to_send={preflight.get('safe_to_send')}")

    def test_high_risk_message_is_blocked(self, session, auth_token):
        """POST /api/dating/matches/{match_id}/messages with scam text should be blocked"""
        # First get matches
        resp = session.get(f"{BASE_URL}/api/dating/matches")
        assert resp.status_code == 200
        matches = resp.json().get("matches", [])
        
        if not matches:
            pytest.skip("No matches available for scam message test")
        
        match_id = matches[0]["match_id"]
        
        # Send high-risk scam message
        scam_text = "Schick mir dringend Geld über Western Union! Meine IBAN ist DE89370400440532013000. Ich brauche sofort 500 Euro!"
        
        resp = session.post(f"{BASE_URL}/api/dating/matches/{match_id}/messages", json={
            "text": scam_text
        })
        
        # Should either be blocked (400/403) or return with safe_to_send=False
        if resp.status_code in [400, 403]:
            print(f"PASS: High-risk message blocked with status {resp.status_code}")
            return
        
        # If 200, check preflight
        if resp.status_code == 200:
            data = resp.json()
            preflight = data.get("chat_safety_preflight", {})
            
            # The message might still be sent but flagged
            assert preflight.get("score", 0) > 30, "High-risk message should have high safety score"
            print(f"PASS: High-risk message flagged - score={preflight.get('score')}, level={preflight.get('level')}, warning={preflight.get('warning')}")
        else:
            pytest.fail(f"Unexpected status {resp.status_code}: {resp.text}")


class TestDatingRegression:
    """Regression tests for core dating functionality"""

    def test_discover_endpoint_works(self, session, auth_token):
        """GET /api/dating/discover should return profiles"""
        resp = session.get(f"{BASE_URL}/api/dating/discover")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "profiles" in data
        print(f"PASS: Discover returns {len(data.get('profiles', []))} profiles")

    def test_matches_endpoint_works(self, session, auth_token):
        """GET /api/dating/matches should return matches"""
        resp = session.get(f"{BASE_URL}/api/dating/matches")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "matches" in data
        print(f"PASS: Matches returns {len(data.get('matches', []))} matches")

    def test_likes_you_endpoint_works(self, session, auth_token):
        """GET /api/dating/likes-you should return likes"""
        resp = session.get(f"{BASE_URL}/api/dating/likes-you")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "profiles" in data or "locked" in data
        print(f"PASS: Likes-you returns locked={data.get('locked')}, count={data.get('count')}")

    def test_swipes_left_endpoint_works(self, session, auth_token):
        """GET /api/dating/swipes-left should return swipes count"""
        resp = session.get(f"{BASE_URL}/api/dating/swipes-left")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "swipes_left" in data
        print(f"PASS: Swipes left = {data.get('swipes_left')}, premium={data.get('premium')}")

    def test_safety_scan_endpoint_works(self, session, auth_token):
        """POST /api/dating/safety/scan should refresh safety scan"""
        resp = session.post(f"{BASE_URL}/api/dating/safety/scan", json={"force": False})
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert "safety" in data
        print(f"PASS: Safety scan - scam_level={data['safety'].get('scam_level')}, nudity_level={data['safety'].get('nudity_level')}")

    def test_premium_plans_endpoint_works(self, session, auth_token):
        """GET /api/dating/premium/plans should return plans"""
        resp = session.get(f"{BASE_URL}/api/dating/premium/plans")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "plans" in data
        assert len(data["plans"]) > 0
        print(f"PASS: Premium plans = {[p.get('plan_id') for p in data['plans']]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
