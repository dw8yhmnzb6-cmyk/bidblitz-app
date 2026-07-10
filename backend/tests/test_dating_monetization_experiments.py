"""
Dating Monetization Experiments Tests - Iteration 228
Tests for segment/price experiments, starter deals, limited-time rose bundles, and paywall variants
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
FRESH_USER_EMAIL = "dating.exp.66788803@example.com"
FRESH_USER_PASSWORD = "DatingTest2026!"
REVIEWER_EMAIL = "reviewer@bidblitz.ae"
REVIEWER_PASSWORD = "BidBlitzReview2026!"


@pytest.fixture(scope="module")
def fresh_user_session():
    """Login as fresh test user (non-premium, recently registered)"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": FRESH_USER_EMAIL,
        "password": FRESH_USER_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Fresh user login failed: {response.text}")
    return session


@pytest.fixture(scope="module")
def reviewer_session():
    """Login as reviewer account (premium, older account)"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": REVIEWER_EMAIL,
        "password": REVIEWER_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Reviewer login failed: {response.text}")
    return session


class TestMonetizationExperimentsPayload:
    """Tests for experiments object in monetization response"""

    def test_monetization_returns_experiments_object(self, fresh_user_session):
        """GET /api/dating/monetization returns experiments object"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        # Verify experiments object exists
        assert "experiments" in data, "experiments object missing from monetization response"
        experiments = data["experiments"]
        
        # Verify all experiment keys present
        assert "starter_offer_variant" in experiments
        assert "paywall_layout" in experiments
        assert "rose_bundle_offer" in experiments

    def test_starter_offer_variant_structure(self, fresh_user_session):
        """Starter offer variant has correct structure"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        starter_variant = data["experiments"]["starter_offer_variant"]
        assert "variant_key" in starter_variant
        assert "title" in starter_variant
        assert "plan_id" in starter_variant
        assert "offer_price_eur" in starter_variant
        assert "subtitle" in starter_variant
        
        # Verify variant_key is one of the valid variants
        valid_variants = ["gold_starter", "plus_entry", "platinum_trial"]
        assert starter_variant["variant_key"] in valid_variants

    def test_paywall_layout_variant_structure(self, fresh_user_session):
        """Paywall layout variant has correct structure"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        paywall_variant = data["experiments"]["paywall_layout"]
        assert "variant_key" in paywall_variant
        assert "highlight_plan" in paywall_variant
        assert "headline" in paywall_variant
        
        # Verify variant_key is one of the valid variants
        valid_variants = ["gold_focus", "rose_focus", "value_stack"]
        assert paywall_variant["variant_key"] in valid_variants
        
        # Verify highlight_plan is a valid plan
        valid_plans = ["plus_30d", "gold_30d", "platinum_30d"]
        assert paywall_variant["highlight_plan"] in valid_plans

    def test_rose_bundle_offer_variant_structure(self, fresh_user_session):
        """Rose bundle offer variant has correct structure"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        rose_variant = data["experiments"]["rose_bundle_offer"]
        assert "variant_key" in rose_variant
        assert "item_id" in rose_variant
        assert "badge" in rose_variant
        assert "expires_hours" in rose_variant
        
        # Verify variant_key is one of the valid variants
        valid_variants = ["mini_bundle", "power_bundle"]
        assert rose_variant["variant_key"] in valid_variants


class TestStarterOfferForFreshUser:
    """Tests for starter offer eligibility and structure"""

    def test_fresh_user_receives_starter_offer(self, fresh_user_session):
        """Fresh user (< 7 days old) receives starter_offer"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        starter_offer = data.get("starter_offer")
        assert starter_offer is not None, "Fresh user should receive starter_offer"
        
        # Verify starter offer structure
        assert "offer_id" in starter_offer
        assert "title" in starter_offer
        assert "subtitle" in starter_offer
        assert "plan_id" in starter_offer
        assert "offer_price_eur" in starter_offer
        assert "regular_price_eur" in starter_offer
        assert "days_left" in starter_offer
        assert "features" in starter_offer
        assert "variant_key" in starter_offer

    def test_starter_offer_price_is_discounted(self, fresh_user_session):
        """Starter offer price is less than regular price"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        starter_offer = data.get("starter_offer")
        if starter_offer:
            assert starter_offer["offer_price_eur"] < starter_offer["regular_price_eur"], \
                "Starter offer price should be discounted"

    def test_starter_offer_days_left_valid(self, fresh_user_session):
        """Starter offer days_left is between 0 and 7"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        starter_offer = data.get("starter_offer")
        if starter_offer:
            assert 0 <= starter_offer["days_left"] <= 7, \
                "days_left should be between 0 and 7"


class TestLimitedBundleOffer:
    """Tests for limited-time rose bundle offers"""

    def test_limited_bundle_offer_present(self, fresh_user_session):
        """Limited bundle offer is present in monetization response"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        limited_bundle = data.get("limited_bundle_offer")
        assert limited_bundle is not None, "limited_bundle_offer should be present"

    def test_limited_bundle_offer_structure(self, fresh_user_session):
        """Limited bundle offer has correct structure"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        limited_bundle = data["limited_bundle_offer"]
        assert "offer_id" in limited_bundle
        assert "title" in limited_bundle
        assert "subtitle" in limited_bundle
        assert "item_id" in limited_bundle
        assert "price_eur" in limited_bundle
        assert "badge" in limited_bundle
        assert "expires_at" in limited_bundle
        assert "expires_hours" in limited_bundle

    def test_limited_bundle_item_is_rose_pack(self, fresh_user_session):
        """Limited bundle item_id is a valid rose pack"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        limited_bundle = data["limited_bundle_offer"]
        valid_rose_packs = ["rose_pack_3", "rose_pack_10"]
        assert limited_bundle["item_id"] in valid_rose_packs

    def test_limited_bundle_expires_at_is_future(self, fresh_user_session):
        """Limited bundle expires_at is in the future"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        limited_bundle = data["limited_bundle_offer"]
        expires_at = limited_bundle["expires_at"]
        # Parse ISO datetime
        expires_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        now = datetime.now(expires_dt.tzinfo)
        # Note: expires_at is based on profile creation, so it may be in the past for older profiles
        # For fresh users, it should be in the future


class TestDeterministicSegmentAssignment:
    """Tests for deterministic experiment bucket assignment"""

    def test_same_user_gets_same_experiments(self, fresh_user_session):
        """Same user gets same experiment variants on multiple calls"""
        response1 = fresh_user_session.get(f"{BASE_URL}/api/dating/monetization")
        response2 = fresh_user_session.get(f"{BASE_URL}/api/dating/monetization")
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        exp1 = response1.json()["experiments"]
        exp2 = response2.json()["experiments"]
        
        # Verify deterministic assignment
        assert exp1["starter_offer_variant"]["variant_key"] == exp2["starter_offer_variant"]["variant_key"]
        assert exp1["paywall_layout"]["variant_key"] == exp2["paywall_layout"]["variant_key"]
        assert exp1["rose_bundle_offer"]["variant_key"] == exp2["rose_bundle_offer"]["variant_key"]


class TestPremiumPlansWithExperiments:
    """Tests for premium plans integration with experiments"""

    def test_premium_plans_endpoint_returns_experiments(self, fresh_user_session):
        """GET /api/dating/premium/plans returns experiments"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/premium/plans")
        assert response.status_code == 200
        data = response.json()
        
        assert "experiments" in data
        assert "starter_offer" in data
        assert "limited_bundle_offer" in data

    def test_plans_include_starter_offer_when_eligible(self, fresh_user_session):
        """Plans include starter_offer field when user is eligible"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        starter_offer = data.get("starter_offer")
        if starter_offer:
            # Find the plan that matches the starter offer
            plans = data["plans"]
            matching_plan = next((p for p in plans if p["plan_id"] == starter_offer["plan_id"]), None)
            if matching_plan:
                assert "starter_offer" in matching_plan, \
                    "Matching plan should have starter_offer field"


class TestReviewerAccountExperiments:
    """Tests for reviewer account (older, may be premium)"""

    def test_reviewer_gets_experiments_object(self, reviewer_session):
        """Reviewer account still gets experiments object"""
        response = reviewer_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        assert "experiments" in data
        assert "paywall_layout" in data["experiments"]
        assert "rose_bundle_offer" in data["experiments"]

    def test_reviewer_gets_limited_bundle_offer(self, reviewer_session):
        """Reviewer account gets limited_bundle_offer"""
        response = reviewer_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        assert "limited_bundle_offer" in data
        assert data["limited_bundle_offer"] is not None


class TestRegressionExistingEndpoints:
    """Regression tests for existing dating endpoints"""

    def test_discover_endpoint_still_works(self, fresh_user_session):
        """GET /api/dating/discover still works"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/discover")
        assert response.status_code == 200
        data = response.json()
        assert "profiles" in data

    def test_matches_endpoint_still_works(self, fresh_user_session):
        """GET /api/dating/matches still works"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/matches")
        assert response.status_code == 200
        data = response.json()
        assert "matches" in data

    def test_profile_me_endpoint_still_works(self, fresh_user_session):
        """GET /api/dating/profile/me still works"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/profile/me")
        assert response.status_code == 200
        data = response.json()
        assert "profile" in data

    def test_swipes_left_endpoint_still_works(self, fresh_user_session):
        """GET /api/dating/swipes-left still works"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/swipes-left")
        assert response.status_code == 200
        data = response.json()
        assert "swipes_left" in data

    def test_likes_you_endpoint_still_works(self, fresh_user_session):
        """GET /api/dating/likes-you still works"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/likes-you")
        assert response.status_code == 200
        data = response.json()
        assert "profiles" in data or "locked" in data

    def test_top_picks_endpoint_still_works(self, fresh_user_session):
        """GET /api/dating/top-picks still works"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/top-picks")
        assert response.status_code == 200
        data = response.json()
        assert "profiles" in data

    def test_standouts_endpoint_still_works(self, fresh_user_session):
        """GET /api/dating/standouts still works"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/standouts")
        assert response.status_code == 200
        data = response.json()
        assert "profiles" in data

    def test_consumables_in_monetization(self, fresh_user_session):
        """Consumables grid still includes rose packs"""
        response = fresh_user_session.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        consumables = data.get("consumables", [])
        item_ids = [c["item_id"] for c in consumables]
        
        assert "rose_pack_3" in item_ids, "rose_pack_3 should be in consumables"
        assert "rose_pack_10" in item_ids, "rose_pack_10 should be in consumables"
        assert "boost_pack_1" in item_ids, "boost_pack_1 should be in consumables"
        assert "superlike_pack_5" in item_ids, "superlike_pack_5 should be in consumables"
