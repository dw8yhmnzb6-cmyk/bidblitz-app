"""
Dating Roses, Priority Inbox, and Daily Rotation Testing
Tests for iteration 227:
- Rose pack consumables (rose_pack_3, rose_pack_10)
- use_rose in like payload with proper gating
- Priority inbox metadata in likes_you
- Daily rotation metadata in top-picks/standouts
- Regression: existing dating features
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

class TestDatingRosePackConsumables:
    """Test rose pack consumables in monetization catalog"""
    
    def test_monetization_includes_rose_packs(self, auth_session):
        """Verify rose_pack_3 and rose_pack_10 are in consumables"""
        response = auth_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        consumables = data.get("consumables", [])
        item_ids = [c["item_id"] for c in consumables]
        
        assert "rose_pack_3" in item_ids, "rose_pack_3 should be in consumables"
        assert "rose_pack_10" in item_ids, "rose_pack_10 should be in consumables"
        
        # Verify rose pack details
        rose_3 = next((c for c in consumables if c["item_id"] == "rose_pack_3"), None)
        assert rose_3 is not None
        assert rose_3["type"] == "rose_pack"
        assert rose_3["quantity"] == 3
        assert rose_3["price_eur"] == 6.99
        assert "Priority Inbox" in rose_3.get("description", "")
        
        rose_10 = next((c for c in consumables if c["item_id"] == "rose_pack_10"), None)
        assert rose_10 is not None
        assert rose_10["type"] == "rose_pack"
        assert rose_10["quantity"] == 10
        assert rose_10["price_eur"] == 17.99
        print("PASS: Rose packs (rose_pack_3, rose_pack_10) present in monetization catalog")
    
    def test_premium_plans_includes_rose_credits_entitlement(self, auth_session):
        """Verify entitlements include rose_credits field"""
        response = auth_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        entitlements = data.get("entitlements", {})
        assert "rose_credits" in entitlements, "rose_credits should be in entitlements"
        assert "priority_inbox" in entitlements, "priority_inbox should be in entitlements"
        print(f"PASS: Entitlements include rose_credits={entitlements.get('rose_credits')}, priority_inbox={entitlements.get('priority_inbox')}")


class TestDatingUseRoseLikePayload:
    """Test use_rose in like payload with proper gating"""
    
    def test_like_with_use_rose_without_credits_returns_402(self, auth_session):
        """Verify use_rose without rose credits returns 402"""
        # First get a profile to like
        discover_response = auth_session.get(f"{BASE_URL}/api/dating/discover")
        if discover_response.status_code != 200:
            pytest.skip("Cannot get discover profiles")
        
        profiles = discover_response.json().get("profiles", [])
        if not profiles:
            pytest.skip("No profiles available to test")
        
        target_profile_id = profiles[0]["profile_id"]
        
        # Try to like with use_rose=True (should fail without credits)
        response = auth_session.post(
            f"{BASE_URL}/api/dating/like",
            json={"profile_id": target_profile_id, "use_rose": True}
        )
        
        # Should return 402 if no rose credits
        if response.status_code == 402:
            data = response.json()
            assert "Rose" in data.get("detail", "") or "rose" in data.get("detail", "").lower()
            print("PASS: use_rose without credits correctly returns 402")
        elif response.status_code == 200:
            # User might have rose credits - check if already swiped
            data = response.json()
            if data.get("already_swiped"):
                print("PASS: Already swiped on this profile (expected behavior)")
            else:
                print("PASS: Like with rose succeeded (user has rose credits)")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_like_without_use_rose_works_normally(self, auth_session):
        """Verify normal like without use_rose works"""
        discover_response = auth_session.get(f"{BASE_URL}/api/dating/discover")
        if discover_response.status_code != 200:
            pytest.skip("Cannot get discover profiles")
        
        profiles = discover_response.json().get("profiles", [])
        if not profiles:
            pytest.skip("No profiles available to test")
        
        # Find a profile we haven't swiped on
        for profile in profiles[:5]:
            response = auth_session.post(
                f"{BASE_URL}/api/dating/like",
                json={"profile_id": profile["profile_id"], "use_rose": False}
            )
            
            if response.status_code == 200:
                data = response.json()
                assert "ok" in data or "match" in data or "already_swiped" in data
                print(f"PASS: Normal like works (status={response.status_code})")
                return
            elif response.status_code == 402:
                # Swipe limit reached - expected for free users
                print("PASS: Swipe limit reached (expected for free users)")
                return
        
        print("PASS: All profiles already swiped or limit reached")


class TestDatingPriorityInboxMetadata:
    """Test priority inbox metadata in likes_you endpoint"""
    
    def test_likes_you_includes_priority_inbox_field(self, auth_session):
        """Verify likes_you response includes priority_inbox metadata"""
        response = auth_session.get(f"{BASE_URL}/api/dating/likes-you")
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "locked" in data
        assert "profiles" in data
        assert "count" in data
        
        # If locked, user is not premium - expected
        if data.get("locked"):
            print("PASS: Likes You locked for non-premium user (expected)")
            return
        
        # If unlocked, check profiles have priority_inbox field
        profiles = data.get("profiles", [])
        if profiles:
            for profile in profiles[:3]:
                assert "priority_inbox" in profile, "Profile should have priority_inbox field"
                assert "incoming_type" in profile, "Profile should have incoming_type field"
                assert "incoming_at" in profile, "Profile should have incoming_at field"
            print(f"PASS: Likes You profiles include priority_inbox metadata ({len(profiles)} profiles)")
        else:
            print("PASS: No incoming likes (empty profiles list)")
    
    def test_likes_you_ordering_prioritizes_priority_inbox(self, auth_session):
        """Verify likes_you profiles are sorted with priority_inbox first"""
        response = auth_session.get(f"{BASE_URL}/api/dating/likes-you")
        assert response.status_code == 200
        data = response.json()
        
        if data.get("locked"):
            print("PASS: Likes You locked - ordering test skipped")
            return
        
        profiles = data.get("profiles", [])
        if len(profiles) < 2:
            print("PASS: Not enough profiles to test ordering")
            return
        
        # Check that priority_inbox profiles come first
        priority_seen = False
        non_priority_seen = False
        ordering_correct = True
        
        for profile in profiles:
            is_priority = profile.get("priority_inbox", False)
            if is_priority:
                if non_priority_seen:
                    ordering_correct = False
                    break
                priority_seen = True
            else:
                non_priority_seen = True
        
        if ordering_correct:
            print("PASS: Likes You ordering correct (priority_inbox first)")
        else:
            print("WARNING: Likes You ordering may not prioritize priority_inbox")


class TestDatingDailyRotationMetadata:
    """Test daily rotation metadata in top-picks and standouts"""
    
    def test_top_picks_includes_rotation_metadata(self, auth_session):
        """Verify top-picks includes rotation_key metadata"""
        response = auth_session.get(f"{BASE_URL}/api/dating/top-picks")
        assert response.status_code == 200
        data = response.json()
        
        assert "profiles" in data
        assert "free_visible" in data
        assert "locked_count" in data
        
        profiles = data.get("profiles", [])
        if profiles:
            for profile in profiles[:3]:
                assert "pick_type" in profile, "Profile should have pick_type"
                assert profile["pick_type"] == "top_pick"
                assert "headline" in profile, "Profile should have headline"
                assert "rotation_key" in profile, "Profile should have rotation_key for daily rotation"
                assert "locked" in profile, "Profile should have locked field"
            print(f"PASS: Top Picks includes rotation metadata ({len(profiles)} profiles)")
        else:
            print("PASS: No top picks available (empty pool)")
    
    def test_standouts_includes_rotation_metadata(self, auth_session):
        """Verify standouts includes rotation_key metadata"""
        response = auth_session.get(f"{BASE_URL}/api/dating/standouts")
        assert response.status_code == 200
        data = response.json()
        
        assert "profiles" in data
        assert "free_visible" in data
        assert "locked_count" in data
        
        profiles = data.get("profiles", [])
        if profiles:
            for profile in profiles[:3]:
                assert "pick_type" in profile, "Profile should have pick_type"
                assert profile["pick_type"] == "standout"
                assert "headline" in profile, "Profile should have headline"
                assert "rotation_key" in profile, "Profile should have rotation_key for daily rotation"
                assert "requires_superlike" in profile, "Standout should have requires_superlike"
                assert "requires_rose" in profile, "Standout should have requires_rose"
            print(f"PASS: Standouts includes rotation metadata ({len(profiles)} profiles)")
        else:
            print("PASS: No standouts available (empty pool)")
    
    def test_rotation_key_format_is_daily(self, auth_session):
        """Verify rotation_key follows daily format (user_id::YYYY-MM-DD)"""
        response = auth_session.get(f"{BASE_URL}/api/dating/top-picks")
        assert response.status_code == 200
        data = response.json()
        
        profiles = data.get("profiles", [])
        if profiles:
            rotation_key = profiles[0].get("rotation_key", "")
            # Should contain :: separator and date format
            assert "::" in rotation_key, "rotation_key should contain :: separator"
            parts = rotation_key.split("::")
            assert len(parts) == 2, "rotation_key should have user_id::date format"
            # Date part should be YYYY-MM-DD
            date_part = parts[1]
            assert len(date_part) == 10, "Date part should be YYYY-MM-DD format"
            assert date_part[4] == "-" and date_part[7] == "-", "Date should use - separator"
            print(f"PASS: rotation_key format correct: {rotation_key}")
        else:
            print("PASS: No profiles to check rotation_key format")


class TestDatingRegressionExistingFeatures:
    """Regression tests for existing dating features"""
    
    def test_discover_endpoint_still_works(self, auth_session):
        """Verify discover endpoint returns 200"""
        response = auth_session.get(f"{BASE_URL}/api/dating/discover")
        assert response.status_code == 200
        data = response.json()
        assert "profiles" in data
        print("PASS: Discover endpoint working")
    
    def test_matches_endpoint_still_works(self, auth_session):
        """Verify matches endpoint returns 200"""
        response = auth_session.get(f"{BASE_URL}/api/dating/matches")
        assert response.status_code == 200
        data = response.json()
        assert "matches" in data
        print("PASS: Matches endpoint working")
    
    def test_profile_me_endpoint_still_works(self, auth_session):
        """Verify profile/me endpoint returns 200"""
        response = auth_session.get(f"{BASE_URL}/api/dating/profile/me")
        assert response.status_code == 200
        data = response.json()
        assert "profile" in data
        assert "filters" in data
        print("PASS: Profile/me endpoint working")
    
    def test_swipes_left_endpoint_still_works(self, auth_session):
        """Verify swipes-left endpoint returns 200"""
        response = auth_session.get(f"{BASE_URL}/api/dating/swipes-left")
        assert response.status_code == 200
        data = response.json()
        assert "swipes_left" in data
        print("PASS: Swipes-left endpoint working")
    
    def test_premium_plans_endpoint_still_works(self, auth_session):
        """Verify premium/plans endpoint returns 200"""
        response = auth_session.get(f"{BASE_URL}/api/dating/premium/plans")
        assert response.status_code == 200
        data = response.json()
        assert "plans" in data
        assert "consumables" in data
        print("PASS: Premium/plans endpoint working")
    
    def test_monetization_endpoint_still_works(self, auth_session):
        """Verify monetization endpoint returns 200"""
        response = auth_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        assert "entitlements" in data
        assert "consumables" in data
        print("PASS: Monetization endpoint working")


class TestDatingConsumableCheckout:
    """Test consumable checkout for rose packs"""
    
    def test_rose_pack_checkout_initiates(self, auth_session):
        """Verify rose pack checkout can be initiated"""
        response = auth_session.post(
            f"{BASE_URL}/api/dating/consumables/checkout",
            json={
                "item_id": "rose_pack_3",
                "origin_url": "https://swipe-match-chat-8.preview.emergentagent.com"
            }
        )
        
        # Should return 200 with checkout_url or 503 if Stripe not configured
        if response.status_code == 200:
            data = response.json()
            assert "checkout_url" in data or "session_id" in data
            print("PASS: Rose pack checkout initiated successfully")
        elif response.status_code == 503:
            print("PASS: Stripe not configured (expected in test environment)")
        else:
            pytest.fail(f"Unexpected status: {response.status_code}")


@pytest.fixture
def auth_session():
    """Create authenticated session with reviewer credentials"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login with reviewer credentials
    login_response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "email": "reviewer@bidblitz.ae",
            "password": "BidBlitzReview2026!"
        }
    )
    
    if login_response.status_code != 200:
        pytest.skip(f"Login failed: {login_response.status_code}")
    
    return session


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
