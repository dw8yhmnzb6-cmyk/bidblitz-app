"""
Test suite for BidBlitz Charge App Admin Offer Rules
Tests: Admin CRUD for offer rules, toggle, personalization integration
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"
REVIEWER_EMAIL = "reviewer@bidblitz.ae"
REVIEWER_PASSWORD = "BidBlitzReview2026!"


@pytest.fixture(scope="module")
def admin_session():
    """Create authenticated admin session"""
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return session


@pytest.fixture(scope="module")
def reviewer_session():
    """Create authenticated reviewer (non-admin) session"""
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": REVIEWER_EMAIL, "password": REVIEWER_PASSWORD}
    )
    assert response.status_code == 200, f"Reviewer login failed: {response.text}"
    return session


class TestChargeOfferRulesAdminEndpoints:
    """Test admin CRUD endpoints for Charge offer rules"""

    def test_admin_list_offer_rules(self, admin_session):
        """GET /api/charge-app/admin/offer-rules - Admin can list rules"""
        response = admin_session.get(f"{BASE_URL}/api/charge-app/admin/offer-rules")
        assert response.status_code == 200, f"List rules failed: {response.text}"
        data = response.json()
        assert "ok" in data
        assert "rules" in data
        assert "summary" in data
        assert isinstance(data["rules"], list)
        assert "total" in data["summary"]
        assert "active" in data["summary"]
        print(f"✓ Admin list rules: {data['summary']['total']} total, {data['summary']['active']} active")

    def test_admin_create_offer_rule(self, admin_session):
        """POST /api/charge-app/admin/offer-rules - Admin can create rule"""
        payload = {
            "name": "TEST-RULE-Region-Deutschland",
            "region": "Deutschland",
            "merchant_slug": "",
            "category": "charger",
            "reason_label": "Testlabel für Deutschland",
            "offer_title": "Test Charge Angebot",
            "offer_hint": "Exklusives Testangebot für Charge-Kunden in Deutschland",
            "score_boost": 25,
            "priority": 60,
            "active": True
        }
        response = admin_session.post(
            f"{BASE_URL}/api/charge-app/admin/offer-rules",
            json=payload
        )
        assert response.status_code == 200, f"Create rule failed: {response.text}"
        data = response.json()
        assert data.get("ok") is True
        assert "rule" in data
        rule = data["rule"]
        assert rule["name"] == payload["name"]
        assert rule["region"] == payload["region"]
        assert rule["category"] == payload["category"]
        assert rule["score_boost"] == payload["score_boost"]
        assert rule["priority"] == payload["priority"]
        assert rule["active"] is True
        assert "rule_id" in rule
        print(f"✓ Admin created rule: {rule['rule_id']} - {rule['name']}")
        return rule["rule_id"]

    def test_admin_update_offer_rule(self, admin_session):
        """PUT /api/charge-app/admin/offer-rules/{rule_id} - Admin can update rule"""
        # First create a rule to update
        create_payload = {
            "name": "TEST-RULE-Update-Test",
            "region": "Berlin",
            "category": "cable",
            "reason_label": "Original Label",
            "score_boost": 15,
            "priority": 40,
            "active": True
        }
        create_response = admin_session.post(
            f"{BASE_URL}/api/charge-app/admin/offer-rules",
            json=create_payload
        )
        assert create_response.status_code == 200
        rule_id = create_response.json()["rule"]["rule_id"]

        # Update the rule
        update_payload = {
            "name": "TEST-RULE-Update-Test-UPDATED",
            "region": "München",
            "category": "powerbank",
            "reason_label": "Updated Label",
            "offer_title": "Updated Offer Title",
            "offer_hint": "Updated hint text",
            "score_boost": 30,
            "priority": 80,
            "active": True
        }
        response = admin_session.put(
            f"{BASE_URL}/api/charge-app/admin/offer-rules/{rule_id}",
            json=update_payload
        )
        assert response.status_code == 200, f"Update rule failed: {response.text}"
        data = response.json()
        assert data.get("ok") is True
        rule = data["rule"]
        assert rule["name"] == update_payload["name"]
        assert rule["region"] == update_payload["region"]
        assert rule["score_boost"] == update_payload["score_boost"]
        print(f"✓ Admin updated rule: {rule_id}")

    def test_admin_toggle_offer_rule(self, admin_session):
        """PUT /api/charge-app/admin/offer-rules/{rule_id}/toggle - Admin can toggle rule"""
        # First create a rule to toggle
        create_payload = {
            "name": "TEST-RULE-Toggle-Test",
            "region": "Hamburg",
            "category": "dock",
            "reason_label": "Toggle Test Label",
            "score_boost": 10,
            "priority": 30,
            "active": True
        }
        create_response = admin_session.post(
            f"{BASE_URL}/api/charge-app/admin/offer-rules",
            json=create_payload
        )
        assert create_response.status_code == 200
        rule_id = create_response.json()["rule"]["rule_id"]
        initial_active = create_response.json()["rule"]["active"]

        # Toggle the rule
        response = admin_session.put(
            f"{BASE_URL}/api/charge-app/admin/offer-rules/{rule_id}/toggle"
        )
        assert response.status_code == 200, f"Toggle rule failed: {response.text}"
        data = response.json()
        assert data.get("ok") is True
        rule = data["rule"]
        assert rule["active"] != initial_active, "Rule active state should have toggled"
        print(f"✓ Admin toggled rule: {rule_id} from {initial_active} to {rule['active']}")

        # Toggle back
        response2 = admin_session.put(
            f"{BASE_URL}/api/charge-app/admin/offer-rules/{rule_id}/toggle"
        )
        assert response2.status_code == 200
        rule2 = response2.json()["rule"]
        assert rule2["active"] == initial_active, "Rule should toggle back to original state"
        print(f"✓ Admin toggled rule back: {rule_id} to {rule2['active']}")

    def test_admin_update_nonexistent_rule_returns_404(self, admin_session):
        """PUT /api/charge-app/admin/offer-rules/{rule_id} - 404 for nonexistent rule"""
        response = admin_session.put(
            f"{BASE_URL}/api/charge-app/admin/offer-rules/NONEXISTENT-RULE-ID",
            json={"name": "Test", "score_boost": 10, "priority": 50, "active": True}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Update nonexistent rule returns 404")

    def test_admin_toggle_nonexistent_rule_returns_404(self, admin_session):
        """PUT /api/charge-app/admin/offer-rules/{rule_id}/toggle - 404 for nonexistent rule"""
        response = admin_session.put(
            f"{BASE_URL}/api/charge-app/admin/offer-rules/NONEXISTENT-RULE-ID/toggle"
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Toggle nonexistent rule returns 404")


class TestChargeOfferRulesNonAdminAccess:
    """Test that non-admin users cannot access admin endpoints"""

    def test_nonadmin_cannot_list_rules(self, reviewer_session):
        """Non-admin cannot GET /api/charge-app/admin/offer-rules"""
        response = reviewer_session.get(f"{BASE_URL}/api/charge-app/admin/offer-rules")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Non-admin cannot list rules (403)")

    def test_nonadmin_cannot_create_rule(self, reviewer_session):
        """Non-admin cannot POST /api/charge-app/admin/offer-rules"""
        response = reviewer_session.post(
            f"{BASE_URL}/api/charge-app/admin/offer-rules",
            json={"name": "Unauthorized Rule", "score_boost": 10, "priority": 50, "active": True}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Non-admin cannot create rule (403)")

    def test_nonadmin_cannot_update_rule(self, reviewer_session):
        """Non-admin cannot PUT /api/charge-app/admin/offer-rules/{rule_id}"""
        response = reviewer_session.put(
            f"{BASE_URL}/api/charge-app/admin/offer-rules/ANY-RULE-ID",
            json={"name": "Unauthorized Update", "score_boost": 10, "priority": 50, "active": True}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Non-admin cannot update rule (403)")

    def test_nonadmin_cannot_toggle_rule(self, reviewer_session):
        """Non-admin cannot PUT /api/charge-app/admin/offer-rules/{rule_id}/toggle"""
        response = reviewer_session.put(
            f"{BASE_URL}/api/charge-app/admin/offer-rules/ANY-RULE-ID/toggle"
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Non-admin cannot toggle rule (403)")


class TestChargeDashboardWithAdminRules:
    """Test that dashboard includes admin rules in personalization"""

    def test_reviewer_dashboard_includes_active_rules_total(self, reviewer_session):
        """GET /api/charge-app/dashboard - includes active_rules_total in summary"""
        response = reviewer_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        assert "summary" in data
        assert "active_rules_total" in data["summary"], "Dashboard summary should include active_rules_total"
        print(f"✓ Dashboard includes active_rules_total: {data['summary']['active_rules_total']}")

    def test_reviewer_dashboard_merchants_have_personalization_score(self, reviewer_session):
        """GET /api/charge-app/dashboard - merchants have personalization_score and match_reason"""
        response = reviewer_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        merchants = data.get("merchants", [])
        if merchants:
            merchant = merchants[0]
            assert "personalization_score" in merchant, "Merchant should have personalization_score"
            assert "match_reason" in merchant, "Merchant should have match_reason"
            assert "match_reasons" in merchant, "Merchant should have match_reasons"
            print(f"✓ Merchant has personalization: score={merchant['personalization_score']}, reason={merchant['match_reason']}")
        else:
            print("⚠ No merchants in dashboard to verify personalization")

    def test_reviewer_dashboard_personalized_offers_have_reasons(self, reviewer_session):
        """GET /api/charge-app/dashboard - personalized_offers have score and reasons"""
        response = reviewer_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        offers = data.get("personalized_offers", [])
        if offers:
            offer = offers[0]
            assert "score" in offer, "Personalized offer should have score"
            assert "reason" in offer, "Personalized offer should have reason"
            assert "reasons" in offer, "Personalized offer should have reasons"
            print(f"✓ Personalized offer has: score={offer['score']}, reason={offer['reason']}")
        else:
            print("⚠ No personalized offers in dashboard to verify")

    def test_reviewer_dashboard_includes_personalization_profile(self, reviewer_session):
        """GET /api/charge-app/dashboard - includes personalization profile"""
        response = reviewer_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "personalization" in data, "Dashboard should include personalization"
        personalization = data["personalization"]
        assert "region" in personalization, "Personalization should have region"
        assert "regions" in personalization, "Personalization should have regions"
        assert "top_merchants" in personalization, "Personalization should have top_merchants"
        assert "top_categories" in personalization, "Personalization should have top_categories"
        print(f"✓ Personalization profile: region={personalization['region']}")


class TestChargeExistingFeaturesRegression:
    """Regression tests for existing Charge features after adding admin rules"""

    def test_warranty_registration_still_works(self, reviewer_session):
        """POST /api/charge-app/warranty/register - still works"""
        payload = {
            "product_name": "TEST-REGRESSION-Charger",
            "serial_number": f"TEST-REG-{os.urandom(4).hex().upper()}",
            "purchase_date": "2026-07-30",
            "merchant_name": "Test Händler",
            "invoice_number": "TEST-INV-001"
        }
        response = reviewer_session.post(
            f"{BASE_URL}/api/charge-app/warranty/register",
            json=payload
        )
        assert response.status_code == 200, f"Warranty registration failed: {response.text}"
        data = response.json()
        assert data.get("ok") is True
        assert "warranty" in data
        print(f"✓ Warranty registration works: {data['warranty']['registration_id']}")

    def test_invoice_save_still_works(self, reviewer_session):
        """POST /api/charge-app/invoices/save - still works"""
        payload = {
            "invoice_number": f"TEST-INV-{os.urandom(4).hex().upper()}",
            "merchant_name": "Test Händler",
            "amount": 49.99,
            "purchase_date": "2026-07-30",
            "product_name": "Test Produkt",
            "serial_number": "TEST-SN-001"
        }
        response = reviewer_session.post(
            f"{BASE_URL}/api/charge-app/invoices/save",
            json=payload
        )
        assert response.status_code == 200, f"Invoice save failed: {response.text}"
        data = response.json()
        assert data.get("ok") is True
        assert "invoice" in data
        print(f"✓ Invoice save works: {data['invoice']['invoice_id']}")

    def test_interaction_tracking_still_works(self, reviewer_session):
        """POST /api/charge-app/interactions - still works"""
        payload = {
            "interaction_type": "merchant_click",
            "merchant_slug": "test-merchant",
            "merchant_name": "Test Merchant",
            "city": "Berlin",
            "category": "charger"
        }
        response = reviewer_session.post(
            f"{BASE_URL}/api/charge-app/interactions",
            json=payload
        )
        assert response.status_code == 200, f"Interaction tracking failed: {response.text}"
        data = response.json()
        assert data.get("ok") is True
        assert "interaction" in data
        print(f"✓ Interaction tracking works: {data['interaction']['interaction_id']}")

    def test_dashboard_warranties_list_still_works(self, reviewer_session):
        """GET /api/charge-app/dashboard - warranties list still works"""
        response = reviewer_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "warranties" in data
        assert isinstance(data["warranties"], list)
        print(f"✓ Dashboard warranties list works: {len(data['warranties'])} warranties")

    def test_dashboard_invoices_list_still_works(self, reviewer_session):
        """GET /api/charge-app/dashboard - invoices list still works"""
        response = reviewer_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "invoices" in data
        assert isinstance(data["invoices"], list)
        print(f"✓ Dashboard invoices list works: {len(data['invoices'])} invoices")

    def test_dashboard_offers_list_still_works(self, reviewer_session):
        """GET /api/charge-app/dashboard - generic offers list still works"""
        response = reviewer_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "offers" in data
        assert isinstance(data["offers"], list)
        print(f"✓ Dashboard offers list works: {len(data['offers'])} offers")

    def test_dashboard_merchants_list_still_works(self, reviewer_session):
        """GET /api/charge-app/dashboard - merchants list still works"""
        response = reviewer_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "merchants" in data
        assert isinstance(data["merchants"], list)
        print(f"✓ Dashboard merchants list works: {len(data['merchants'])} merchants")

    def test_dashboard_loyalty_still_works(self, reviewer_session):
        """GET /api/charge-app/dashboard - loyalty data still works"""
        response = reviewer_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "loyalty" in data
        assert "status" in data["loyalty"]
        print(f"✓ Dashboard loyalty works: level={data['loyalty']['status'].get('level_name', 'N/A')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
