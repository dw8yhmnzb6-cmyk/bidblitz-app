"""
Credit Score API Tests - Kredit-Score System für BidBlitz Pay
Tests for credit score, eligibility with score info, and tier-based benefits
Score Tiers: Rot (0-300) no credit, Gelb (301-500) €500/5%, Grün (501-700) €1500/3%, 
             Gold (701-900) €2000/2%, Diamant (901+) €2000/1.5%
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bidgenie.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "Admin123!"


class TestCreditScoreAPIs:
    """Credit Score API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    def test_credit_score_endpoint(self):
        """Test GET /api/credit/score returns score, tier, next_tier, tips, history"""
        response = self.session.get(f"{BASE_URL}/api/credit/score")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "score" in data, "Response should contain 'score' field"
        assert "tier" in data, "Response should contain 'tier' field"
        assert "next_tier" in data, "Response should contain 'next_tier' field"
        assert "tips" in data, "Response should contain 'tips' field"
        assert "history" in data, "Response should contain 'history' field"
        assert "stats" in data, "Response should contain 'stats' field"
        assert "progress_percent" in data, "Response should contain 'progress_percent' field"
        
        # Verify score is numeric and within range
        assert isinstance(data["score"], (int, float)), "Score should be numeric"
        assert 0 <= data["score"] <= 1000, f"Score should be 0-1000, got {data['score']}"
        
        # Verify tier structure
        tier = data["tier"]
        assert "key" in tier, "Tier should have 'key'"
        assert "name" in tier, "Tier should have 'name'"
        assert "name_en" in tier, "Tier should have 'name_en'"
        assert "icon" in tier, "Tier should have 'icon'"
        assert "color" in tier, "Tier should have 'color'"
        assert "max_credit" in tier, "Tier should have 'max_credit'"
        assert "interest_rate" in tier, "Tier should have 'interest_rate'"
        
        # Verify tier key is valid
        valid_tiers = ["red", "yellow", "green", "gold", "diamond"]
        assert tier["key"] in valid_tiers, f"Tier key should be one of {valid_tiers}, got {tier['key']}"
        
        # Verify stats structure
        stats = data["stats"]
        assert "total_credits_completed" in stats, "Stats should have 'total_credits_completed'"
        assert "total_on_time_payments" in stats, "Stats should have 'total_on_time_payments'"
        assert "total_late_payments" in stats, "Stats should have 'total_late_payments'"
        
        # Verify tips is a list
        assert isinstance(data["tips"], list), "Tips should be a list"
        
        # Verify history is a list
        assert isinstance(data["history"], list), "History should be a list"
        
        print(f"✓ Credit score endpoint passed: score={data['score']}, tier={tier['name']} ({tier['key']})")
        print(f"  Max credit: €{tier['max_credit']}, Interest rate: {tier['interest_rate']}%")
        print(f"  Stats: completed={stats['total_credits_completed']}, on_time={stats['total_on_time_payments']}, late={stats['total_late_payments']}")
    
    def test_credit_score_tier_benefits(self):
        """Test that tier benefits match expected values"""
        response = self.session.get(f"{BASE_URL}/api/credit/score")
        
        assert response.status_code == 200
        data = response.json()
        
        tier = data["tier"]
        score = data["score"]
        
        # Verify tier matches score range
        expected_tiers = {
            "red": {"min": 0, "max": 300, "max_credit": 0, "interest": 5.0},
            "yellow": {"min": 301, "max": 500, "max_credit": 500, "interest": 5.0},
            "green": {"min": 501, "max": 700, "max_credit": 1500, "interest": 3.0},
            "gold": {"min": 701, "max": 900, "max_credit": 2000, "interest": 2.0},
            "diamond": {"min": 901, "max": 1000, "max_credit": 2000, "interest": 1.5}
        }
        
        tier_key = tier["key"]
        expected = expected_tiers[tier_key]
        
        # Verify score is in correct tier range
        assert expected["min"] <= score <= expected["max"], \
            f"Score {score} should be in range {expected['min']}-{expected['max']} for tier {tier_key}"
        
        # Verify tier benefits
        assert tier["max_credit"] == expected["max_credit"], \
            f"Max credit for {tier_key} should be €{expected['max_credit']}, got €{tier['max_credit']}"
        assert tier["interest_rate"] == expected["interest"], \
            f"Interest rate for {tier_key} should be {expected['interest']}%, got {tier['interest_rate']}%"
        
        print(f"✓ Tier benefits verified for {tier_key}: max_credit=€{tier['max_credit']}, interest={tier['interest_rate']}%")
    
    def test_credit_score_next_tier(self):
        """Test next_tier information is correct"""
        response = self.session.get(f"{BASE_URL}/api/credit/score")
        
        assert response.status_code == 200
        data = response.json()
        
        tier = data["tier"]
        next_tier = data["next_tier"]
        score = data["score"]
        
        # If not at diamond tier, next_tier should exist
        if tier["key"] != "diamond":
            assert next_tier is not None, "next_tier should exist for non-diamond tiers"
            assert "key" in next_tier, "next_tier should have 'key'"
            assert "name" in next_tier, "next_tier should have 'name'"
            assert "points_needed" in next_tier, "next_tier should have 'points_needed'"
            assert "max_credit" in next_tier, "next_tier should have 'max_credit'"
            assert "interest_rate" in next_tier, "next_tier should have 'interest_rate'"
            
            # Verify points_needed is positive
            assert next_tier["points_needed"] > 0, "points_needed should be positive"
            
            print(f"✓ Next tier: {next_tier['name']} ({next_tier['key']}), {next_tier['points_needed']} points needed")
        else:
            # Diamond tier should have no next tier
            assert next_tier is None, "Diamond tier should have no next_tier"
            print("✓ Diamond tier - no next tier (max tier reached)")
    
    def test_credit_score_tips(self):
        """Test tips are provided based on tier"""
        response = self.session.get(f"{BASE_URL}/api/credit/score")
        
        assert response.status_code == 200
        data = response.json()
        
        tips = data["tips"]
        tier_key = data["tier"]["key"]
        
        # Tips should be a list
        assert isinstance(tips, list), "Tips should be a list"
        
        # Each tip should have required fields
        for tip in tips:
            assert "title" in tip, "Tip should have 'title'"
            assert "description" in tip, "Tip should have 'description'"
            assert "points" in tip, "Tip should have 'points'"
            assert isinstance(tip["points"], int), "Tip points should be integer"
        
        print(f"✓ Tips for tier {tier_key}: {len(tips)} tips provided")
        for tip in tips:
            print(f"  - {tip['title']}: +{tip['points']} points")
    
    def test_credit_score_history(self):
        """Test score history is returned"""
        response = self.session.get(f"{BASE_URL}/api/credit/score")
        
        assert response.status_code == 200
        data = response.json()
        
        history = data["history"]
        
        # History should be a list
        assert isinstance(history, list), "History should be a list"
        
        # If history exists, verify structure
        if len(history) > 0:
            entry = history[0]
            assert "event" in entry, "History entry should have 'event'"
            assert "change" in entry, "History entry should have 'change'"
            assert "score_after" in entry, "History entry should have 'score_after'"
            assert "date" in entry, "History entry should have 'date'"
            assert "description" in entry, "History entry should have 'description'"
        
        print(f"✓ Score history: {len(history)} entries")
    
    def test_eligibility_includes_score_info(self):
        """Test GET /api/credit/eligibility includes score and tier information"""
        response = self.session.get(f"{BASE_URL}/api/credit/eligibility")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify score-related fields
        assert "score" in data, "Eligibility should include 'score'"
        assert "tier" in data, "Eligibility should include 'tier'"
        assert "score_eligible" in data, "Eligibility should include 'score_eligible'"
        
        # Verify tier structure in eligibility
        tier = data["tier"]
        assert "key" in tier, "Tier should have 'key'"
        assert "name" in tier, "Tier should have 'name'"
        assert "icon" in tier, "Tier should have 'icon'"
        assert "color" in tier, "Tier should have 'color'"
        
        # Verify max_amount and interest_rate are tier-based
        assert "max_amount" in data, "Eligibility should include 'max_amount'"
        assert "interest_rate" in data, "Eligibility should include 'interest_rate'"
        
        print(f"✓ Eligibility includes score info: score={data['score']}, tier={tier['name']}")
        print(f"  Tier-based: max_amount=€{data['max_amount']}, interest_rate={data['interest_rate']}%")
        print(f"  Score eligible: {data['score_eligible']}")
    
    def test_eligibility_tier_affects_limits(self):
        """Test that tier affects max_amount and interest_rate in eligibility"""
        response = self.session.get(f"{BASE_URL}/api/credit/eligibility")
        
        assert response.status_code == 200
        data = response.json()
        
        score = data["score"]
        tier_key = data["tier"]["key"]
        max_amount = data["max_amount"]
        interest_rate = data["interest_rate"]
        
        # Expected values per tier
        expected = {
            "red": {"max_credit": 0, "interest": 5.0},
            "yellow": {"max_credit": 500, "interest": 5.0},
            "green": {"max_credit": 1500, "interest": 3.0},
            "gold": {"max_credit": 2000, "interest": 2.0},
            "diamond": {"max_credit": 2000, "interest": 1.5}
        }
        
        expected_tier = expected[tier_key]
        
        # Verify max_amount matches tier
        assert max_amount == expected_tier["max_credit"], \
            f"Max amount for {tier_key} should be €{expected_tier['max_credit']}, got €{max_amount}"
        
        # Verify interest_rate matches tier
        assert interest_rate == expected_tier["interest"], \
            f"Interest rate for {tier_key} should be {expected_tier['interest']}%, got {interest_rate}%"
        
        print(f"✓ Eligibility limits match tier {tier_key}: max=€{max_amount}, interest={interest_rate}%")


class TestCreditScoreValidation:
    """Credit Score Validation Tests"""
    
    def test_score_endpoint_requires_auth(self):
        """Test /api/credit/score requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/credit/score")
        
        assert response.status_code in [401, 403, 422], \
            f"Expected 401/403/422 without auth, got {response.status_code}"
        
        print("✓ Score endpoint correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
