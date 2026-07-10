"""
Dating Monetization Tests - Iteration 225
Tests for multi-tier premium plans (Plus/Gold/Platinum), consumable packs,
entitlements, starter offers, and conversion triggers.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://swipe-match-chat-8.preview.emergentagent.com"

TEST_EMAIL = "reviewer@bidblitz.ae"
TEST_PASSWORD = "BidBlitzReview2026!"


@pytest.fixture(scope="module")
def session():
    """Create authenticated session"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    """Login and get authenticated session"""
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.status_code}")
    return session


class TestDatingPremiumPlansMultiTier:
    """Test multi-tier premium plans (Plus/Gold/Platinum)"""
    
    def test_premium_plans_returns_three_tiers(self, auth_token):
        """GET /api/dating/premium/plans returns Plus, Gold, Platinum tiers"""
        response = auth_token.get(f"{BASE_URL}/api/dating/premium/plans")
        assert response.status_code == 200
        data = response.json()
        
        # Should have plans array
        assert "plans" in data
        plans = data["plans"]
        assert len(plans) >= 3, f"Expected at least 3 plans, got {len(plans)}"
        
        # Check for Plus, Gold, Platinum tiers
        plan_ids = [p["plan_id"] for p in plans]
        assert "plus_30d" in plan_ids, "Missing plus_30d plan"
        assert "gold_30d" in plan_ids, "Missing gold_30d plan"
        assert "platinum_30d" in plan_ids, "Missing platinum_30d plan"
        
        # Verify tier labels
        tiers = {p["plan_id"]: p.get("tier") for p in plans}
        assert tiers.get("plus_30d") == "plus"
        assert tiers.get("gold_30d") == "gold"
        assert tiers.get("platinum_30d") == "platinum"
    
    def test_premium_plans_have_correct_pricing(self, auth_token):
        """Each tier has correct pricing structure"""
        response = auth_token.get(f"{BASE_URL}/api/dating/premium/plans")
        assert response.status_code == 200
        data = response.json()
        
        plans_by_id = {p["plan_id"]: p for p in data["plans"]}
        
        # Plus should be cheapest
        plus = plans_by_id.get("plus_30d")
        assert plus is not None
        assert plus["price_eur"] == 9.99
        assert "Unbegrenzte Likes" in plus.get("features", [])
        
        # Gold should be mid-tier
        gold = plans_by_id.get("gold_30d")
        assert gold is not None
        assert gold["price_eur"] == 19.99
        assert "Likes You sehen" in gold.get("features", [])
        
        # Platinum should be premium
        platinum = plans_by_id.get("platinum_30d")
        assert platinum is not None
        assert platinum["price_eur"] == 29.99
        assert "Priorisierte Likes" in platinum.get("features", [])
    
    def test_premium_plans_have_starter_prices(self, auth_token):
        """Each tier has starter price for new users"""
        response = auth_token.get(f"{BASE_URL}/api/dating/premium/plans")
        assert response.status_code == 200
        data = response.json()
        
        for plan in data["plans"]:
            if plan["plan_id"] in ["plus_30d", "gold_30d", "platinum_30d"]:
                # Starter price should be lower than regular price
                if "starter_price_eur" in plan:
                    assert plan["starter_price_eur"] < plan["price_eur"]


class TestDatingConsumables:
    """Test consumable packs (boosts, super likes, rewinds)"""
    
    def test_monetization_returns_consumables(self, auth_token):
        """GET /api/dating/monetization returns consumable packs"""
        response = auth_token.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        assert "consumables" in data
        consumables = data["consumables"]
        assert len(consumables) >= 3, f"Expected at least 3 consumables, got {len(consumables)}"
        
        # Check for boost, superlike, rewind packs
        item_ids = [c["item_id"] for c in consumables]
        assert any("boost" in item_id for item_id in item_ids), "Missing boost pack"
        assert any("superlike" in item_id for item_id in item_ids), "Missing superlike pack"
        assert any("rewind" in item_id for item_id in item_ids), "Missing rewind pack"
    
    def test_consumables_have_correct_structure(self, auth_token):
        """Each consumable has required fields"""
        response = auth_token.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        for consumable in data["consumables"]:
            assert "item_id" in consumable
            assert "type" in consumable
            assert "label" in consumable
            assert "price_eur" in consumable
            assert "quantity" in consumable
            assert "description" in consumable
            assert consumable["price_eur"] > 0
            assert consumable["quantity"] > 0
    
    def test_consumable_checkout_creates_stripe_session(self, auth_token):
        """POST /api/dating/consumables/checkout creates real Stripe session"""
        response = auth_token.post(f"{BASE_URL}/api/dating/consumables/checkout", json={
            "item_id": "boost_pack_1",
            "origin_url": "https://swipe-match-chat-8.preview.emergentagent.com"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("ok") is True
        assert "checkout_url" in data
        assert "session_id" in data
        assert "item" in data
        
        # Checkout URL should be valid Stripe URL
        checkout_url = data["checkout_url"]
        assert "stripe.com" in checkout_url or "checkout" in checkout_url
        
        # Item should match requested
        assert data["item"]["item_id"] == "boost_pack_1"
    
    def test_consumable_checkout_invalid_item(self, auth_token):
        """POST /api/dating/consumables/checkout rejects invalid item"""
        response = auth_token.post(f"{BASE_URL}/api/dating/consumables/checkout", json={
            "item_id": "invalid_item_xyz",
            "origin_url": "https://swipe-match-chat-8.preview.emergentagent.com"
        })
        assert response.status_code == 400


class TestDatingEntitlements:
    """Test entitlements based on premium tier"""
    
    def test_monetization_returns_entitlements(self, auth_token):
        """GET /api/dating/monetization returns entitlements"""
        response = auth_token.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        assert "entitlements" in data
        entitlements = data["entitlements"]
        
        # Check entitlement structure
        assert "plan_id" in entitlements
        assert "is_plus" in entitlements
        assert "is_gold" in entitlements
        assert "is_platinum" in entitlements
        assert "can_see_likes_you" in entitlements
        assert "priority_likes" in entitlements
        assert "boost_credits" in entitlements
        assert "superlike_credits" in entitlements
        assert "rewind_credits" in entitlements
    
    def test_swipes_left_returns_entitlements(self, auth_token):
        """GET /api/dating/swipes-left returns entitlements"""
        response = auth_token.get(f"{BASE_URL}/api/dating/swipes-left")
        assert response.status_code == 200
        data = response.json()
        
        assert "entitlements" in data
        assert "swipes_left" in data


class TestDatingStarterOffer:
    """Test starter offer for new users"""
    
    def test_monetization_returns_starter_offer_metadata(self, auth_token):
        """GET /api/dating/monetization returns starter_offer field"""
        response = auth_token.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        # starter_offer can be null for existing users
        assert "starter_offer" in data
        
        # If starter offer exists, check structure
        if data["starter_offer"]:
            offer = data["starter_offer"]
            assert "offer_id" in offer
            assert "title" in offer
            assert "plan_id" in offer
            assert "offer_price_eur" in offer
            assert "regular_price_eur" in offer
            assert "days_left" in offer
            assert offer["offer_price_eur"] < offer["regular_price_eur"]
    
    def test_premium_plans_include_starter_offer_on_eligible_plans(self, auth_token):
        """GET /api/dating/premium/plans includes starter_offer on eligible plans"""
        response = auth_token.get(f"{BASE_URL}/api/dating/premium/plans")
        assert response.status_code == 200
        data = response.json()
        
        # Check if any plan has starter_offer attached
        # (depends on user eligibility)
        for plan in data["plans"]:
            if "starter_offer" in plan and plan["starter_offer"]:
                offer = plan["starter_offer"]
                assert "offer_id" in offer
                assert "offer_price_eur" in offer
                assert "days_left" in offer


class TestDatingLikesYouPaywall:
    """Test Likes You paywall for non-eligible tiers"""
    
    def test_likes_you_returns_locked_status(self, auth_token):
        """GET /api/dating/likes-you returns locked status for non-gold users"""
        response = auth_token.get(f"{BASE_URL}/api/dating/likes-you")
        assert response.status_code == 200
        data = response.json()
        
        # Should have locked field
        assert "locked" in data
        assert "count" in data
        
        # If locked, profiles should be empty or blurred
        if data["locked"]:
            # Locked users get count but no profiles
            assert isinstance(data["count"], int)
    
    def test_likes_you_count_visible_even_when_locked(self, auth_token):
        """Likes count is visible even when locked (conversion trigger)"""
        response = auth_token.get(f"{BASE_URL}/api/dating/likes-you")
        assert response.status_code == 200
        data = response.json()
        
        # Count should always be present
        assert "count" in data
        assert isinstance(data["count"], int)


class TestDatingMonetizationEndpoint:
    """Test combined monetization endpoint"""
    
    def test_monetization_returns_complete_catalog(self, auth_token):
        """GET /api/dating/monetization returns complete monetization catalog"""
        response = auth_token.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        # Should have all monetization components
        assert "plans" in data
        assert "consumables" in data
        assert "entitlements" in data
        assert "starter_offer" in data
        assert "likes_you_count" in data
        assert "profile_completion" in data
        
        # Plans should be multi-tier
        assert len(data["plans"]) >= 3
        
        # Consumables should exist
        assert len(data["consumables"]) >= 3
    
    def test_monetization_likes_you_count_for_conversion(self, auth_token):
        """Monetization endpoint returns likes_you_count for conversion triggers"""
        response = auth_token.get(f"{BASE_URL}/api/dating/monetization")
        assert response.status_code == 200
        data = response.json()
        
        assert "likes_you_count" in data
        assert isinstance(data["likes_you_count"], int)


class TestDatingPremiumCheckoutMultiTier:
    """Test premium checkout for different tiers"""
    
    def test_checkout_plus_tier(self, auth_token):
        """POST /api/dating/premium/checkout works for Plus tier"""
        response = auth_token.post(f"{BASE_URL}/api/dating/premium/checkout", json={
            "plan_id": "plus_30d",
            "origin_url": "https://swipe-match-chat-8.preview.emergentagent.com"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("ok") is True
        assert "checkout_url" in data
        assert data["plan"]["plan_id"] == "plus_30d"
    
    def test_checkout_gold_tier(self, auth_token):
        """POST /api/dating/premium/checkout works for Gold tier"""
        response = auth_token.post(f"{BASE_URL}/api/dating/premium/checkout", json={
            "plan_id": "gold_30d",
            "origin_url": "https://swipe-match-chat-8.preview.emergentagent.com"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("ok") is True
        assert "checkout_url" in data
        assert data["plan"]["plan_id"] == "gold_30d"
    
    def test_checkout_platinum_tier(self, auth_token):
        """POST /api/dating/premium/checkout works for Platinum tier"""
        response = auth_token.post(f"{BASE_URL}/api/dating/premium/checkout", json={
            "plan_id": "platinum_30d",
            "origin_url": "https://swipe-match-chat-8.preview.emergentagent.com"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("ok") is True
        assert "checkout_url" in data
        assert data["plan"]["plan_id"] == "platinum_30d"


class TestDatingRegression:
    """Regression tests for existing dating features"""
    
    def test_discover_endpoint_works(self, auth_token):
        """GET /api/dating/discover still works"""
        response = auth_token.get(f"{BASE_URL}/api/dating/discover")
        assert response.status_code == 200
        data = response.json()
        assert "profiles" in data
    
    def test_matches_endpoint_works(self, auth_token):
        """GET /api/dating/matches still works"""
        response = auth_token.get(f"{BASE_URL}/api/dating/matches")
        assert response.status_code == 200
        data = response.json()
        assert "matches" in data
    
    def test_profile_me_endpoint_works(self, auth_token):
        """GET /api/dating/profile/me still works"""
        response = auth_token.get(f"{BASE_URL}/api/dating/profile/me")
        assert response.status_code == 200
        data = response.json()
        assert "profile" in data
    
    def test_safety_scan_endpoint_works(self, auth_token):
        """POST /api/dating/safety/scan still works"""
        response = auth_token.post(f"{BASE_URL}/api/dating/safety/scan", json={
            "force": False
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") is True
    
    def test_demo_upgrade_still_exists(self, auth_token):
        """POST /api/dating/premium/demo-upgrade still exists for backward compatibility"""
        response = auth_token.post(f"{BASE_URL}/api/dating/premium/demo-upgrade")
        # Should return 200 (MOCKED endpoint)
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") is True
