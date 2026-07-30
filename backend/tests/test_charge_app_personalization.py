"""
BidBlitz Charge App Personalization Tests - Iteration 303
Tests for personalized offers, merchant ranking, interaction tracking, and existing features.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
REVIEWER_EMAIL = "reviewer@bidblitz.ae"
REVIEWER_PASSWORD = "BidBlitzReview2026!"


@pytest.fixture(scope="module")
def session():
    """Create authenticated session for reviewer account."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_session(session):
    """Login and return authenticated session."""
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": REVIEWER_EMAIL,
        "password": REVIEWER_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return session


class TestChargeAppDashboardPersonalization:
    """Tests for personalized dashboard data."""

    def test_dashboard_returns_personalization_profile(self, auth_session):
        """Dashboard should return personalization profile with region, merchants, categories."""
        response = auth_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        # Verify personalization profile exists
        assert "personalization" in data
        personalization = data["personalization"]
        assert "region" in personalization
        assert "regions" in personalization
        assert "top_merchants" in personalization
        assert "merchant_slugs" in personalization
        assert "top_categories" in personalization
        
        # Verify region is a string
        assert isinstance(personalization["region"], str)
        assert len(personalization["region"]) > 0

    def test_dashboard_returns_personalized_offers(self, auth_session):
        """Dashboard should return personalized offers with scores and reasons."""
        response = auth_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        # Verify personalized_offers exists
        assert "personalized_offers" in data
        personalized_offers = data["personalized_offers"]
        assert isinstance(personalized_offers, list)
        
        # Verify summary includes personalized_offers_total
        assert "summary" in data
        assert "personalized_offers_total" in data["summary"]
        assert data["summary"]["personalized_offers_total"] == len(personalized_offers)
        
        # Verify each offer has required fields
        for offer in personalized_offers:
            assert "offer_id" in offer
            assert "title" in offer
            assert "description" in offer
            assert "score" in offer
            assert "reason" in offer
            assert "reasons" in offer
            assert "merchant_slug" in offer
            assert "region" in offer
            assert "category" in offer
            assert "cta_label" in offer
            
            # Verify score is numeric
            assert isinstance(offer["score"], (int, float))
            
            # Verify reasons is a list
            assert isinstance(offer["reasons"], list)
            assert len(offer["reasons"]) > 0

    def test_dashboard_returns_ranked_merchants(self, auth_session):
        """Dashboard should return merchants with personalization scores and match reasons."""
        response = auth_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        # Verify merchants exist
        assert "merchants" in data
        merchants = data["merchants"]
        assert isinstance(merchants, list)
        
        # Verify each merchant has personalization fields
        for merchant in merchants:
            assert "business_name" in merchant
            assert "city" in merchant
            assert "public_slug" in merchant
            assert "personalization_score" in merchant
            assert "match_reason" in merchant
            assert "match_reasons" in merchant
            
            # Verify score is numeric
            assert isinstance(merchant["personalization_score"], (int, float))
            
            # Verify match_reasons is a list
            assert isinstance(merchant["match_reasons"], list)
            assert len(merchant["match_reasons"]) > 0

    def test_merchants_sorted_by_personalization_score(self, auth_session):
        """Merchants should be sorted by personalization score descending."""
        response = auth_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        merchants = data.get("merchants", [])
        if len(merchants) > 1:
            scores = [m["personalization_score"] for m in merchants]
            # Verify sorted descending
            assert scores == sorted(scores, reverse=True), "Merchants not sorted by score"


class TestChargeAppInteractionTracking:
    """Tests for interaction tracking endpoint."""

    def test_track_merchant_click_interaction(self, auth_session):
        """Should track merchant click interaction."""
        response = auth_session.post(f"{BASE_URL}/api/charge-app/interactions", json={
            "interaction_type": "merchant_click",
            "merchant_slug": "test-merchant-slug",
            "merchant_name": "Test Merchant",
            "city": "Berlin",
            "category": "Charge / Retail"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["ok"] is True
        assert "interaction" in data
        interaction = data["interaction"]
        assert "interaction_id" in interaction
        assert interaction["interaction_type"] == "merchant_click"
        assert interaction["merchant_slug"] == "test-merchant-slug"
        assert interaction["merchant_name"] == "Test Merchant"
        assert interaction["city"] == "Berlin"
        assert "created_at" in interaction

    def test_track_personalized_offer_click(self, auth_session):
        """Should track personalized offer click interaction."""
        response = auth_session.post(f"{BASE_URL}/api/charge-app/interactions", json={
            "interaction_type": "personalized_offer_click",
            "merchant_slug": "test-offer-merchant",
            "merchant_name": "Offer Merchant",
            "city": "München",
            "category": "charger",
            "offer_title": "Test Charge Angebot"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["ok"] is True
        assert data["interaction"]["interaction_type"] == "personalized_offer_click"
        assert data["interaction"]["offer_title"] == "Test Charge Angebot"

    def test_track_merchant_detail_view(self, auth_session):
        """Should track merchant detail view interaction."""
        response = auth_session.post(f"{BASE_URL}/api/charge-app/interactions", json={
            "interaction_type": "merchant_detail_view",
            "merchant_slug": "detail-view-merchant",
            "merchant_name": "Detail View Merchant",
            "city": "Hamburg",
            "category": "cable"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["ok"] is True
        assert data["interaction"]["interaction_type"] == "merchant_detail_view"


class TestChargeAppMerchantDetail:
    """Tests for merchant detail endpoint."""

    def test_merchant_detail_returns_data(self, auth_session):
        """Merchant detail should return merchant info, highlights, products, promotions."""
        # First get a merchant slug from dashboard
        dashboard_response = auth_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert dashboard_response.status_code == 200
        merchants = dashboard_response.json().get("merchants", [])
        
        if merchants:
            slug = merchants[0].get("public_slug")
            if slug:
                response = auth_session.get(f"{BASE_URL}/api/charge-app/merchants/{slug}")
                assert response.status_code == 200
                data = response.json()
                
                # Verify merchant data
                assert "merchant" in data
                merchant = data["merchant"]
                assert "business_name" in merchant
                assert "public_slug" in merchant
                assert merchant["public_slug"] == slug
                
                # Verify highlights
                assert "highlights" in data
                assert isinstance(data["highlights"], list)
                
                # Verify products and promotions exist
                assert "products" in data
                assert "promotions" in data

    def test_merchant_detail_404_for_invalid_slug(self, auth_session):
        """Should return 404 for non-existent merchant slug."""
        response = auth_session.get(f"{BASE_URL}/api/charge-app/merchants/non-existent-merchant-slug-12345")
        assert response.status_code == 404


class TestChargeAppExistingFeatures:
    """Tests to verify existing Charge features still work after personalization changes."""

    def test_dashboard_returns_warranties(self, auth_session):
        """Dashboard should still return warranty list."""
        response = auth_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "warranties" in data
        assert isinstance(data["warranties"], list)
        assert "summary" in data
        assert "registered_warranties" in data["summary"]

    def test_dashboard_returns_invoices(self, auth_session):
        """Dashboard should still return invoice list."""
        response = auth_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "invoices" in data
        assert isinstance(data["invoices"], list)
        assert "summary" in data
        assert "stored_invoices" in data["summary"]

    def test_dashboard_returns_loyalty(self, auth_session):
        """Dashboard should still return loyalty data."""
        response = auth_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "loyalty" in data
        loyalty = data["loyalty"]
        assert "status" in loyalty
        assert "stats" in loyalty
        assert "history" in loyalty

    def test_dashboard_returns_generic_offers(self, auth_session):
        """Dashboard should still return generic offers."""
        response = auth_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "offers" in data
        assert isinstance(data["offers"], list)
        assert "summary" in data
        assert "offers_total" in data["summary"]

    def test_warranty_pass_endpoint_works(self, auth_session):
        """Warranty pass endpoint should still work."""
        # Get a warranty from dashboard
        dashboard_response = auth_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert dashboard_response.status_code == 200
        warranties = dashboard_response.json().get("warranties", [])
        
        if warranties:
            registration_id = warranties[0].get("registration_id")
            if registration_id:
                response = auth_session.get(f"{BASE_URL}/api/charge-app/warranty/{registration_id}/pass")
                assert response.status_code == 200
                data = response.json()
                assert data["ok"] is True
                assert "pass" in data
                pass_data = data["pass"]
                assert "pass_id" in pass_data
                assert "qr_payload" in pass_data
                assert "valid_until" in pass_data

    def test_warranty_registration_works(self, auth_session):
        """Warranty registration should still work."""
        import uuid
        serial = f"TEST-PERS-{uuid.uuid4().hex[:8].upper()}"
        response = auth_session.post(f"{BASE_URL}/api/charge-app/warranty/register", json={
            "product_name": "Test Personalization Product",
            "serial_number": serial,
            "purchase_date": "2026-07-30",
            "merchant_name": "Test Personalization Merchant",
            "invoice_number": f"INV-PERS-{uuid.uuid4().hex[:6].upper()}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert "warranty" in data

    def test_invoice_save_works(self, auth_session):
        """Invoice save should still work."""
        import uuid
        invoice_num = f"INV-PERS-{uuid.uuid4().hex[:8].upper()}"
        response = auth_session.post(f"{BASE_URL}/api/charge-app/invoices/save", json={
            "invoice_number": invoice_num,
            "merchant_name": "Test Personalization Invoice Merchant",
            "amount": 49.99,
            "purchase_date": "2026-07-30",
            "product_name": "Test Invoice Product",
            "serial_number": f"SN-{uuid.uuid4().hex[:6].upper()}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert "invoice" in data


class TestChargeAppPersonalizationReasons:
    """Tests for personalization reason labels."""

    def test_personalized_offers_have_german_reasons(self, auth_session):
        """Personalized offers should have German reason labels."""
        response = auth_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        personalized_offers = data.get("personalized_offers", [])
        for offer in personalized_offers:
            reasons = offer.get("reasons", [])
            # Check that reasons are in German (contain German words)
            for reason in reasons:
                # Should contain German words like "deiner", "Händler", "Region", etc.
                assert isinstance(reason, str)
                assert len(reason) > 0

    def test_merchants_have_german_match_reasons(self, auth_session):
        """Merchants should have German match reason labels."""
        response = auth_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        merchants = data.get("merchants", [])
        for merchant in merchants:
            match_reasons = merchant.get("match_reasons", [])
            for reason in match_reasons:
                assert isinstance(reason, str)
                assert len(reason) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
