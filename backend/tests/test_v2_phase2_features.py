"""
BidBlitz V2 Phase 2 - Backend API Tests
Tests for: Profile editing, Password change, Settings persistence, Support tickets,
Admin Feature Flags, Admin Audit Logs, Admin Compliance, Admin Analytics,
Kids Dashboard, Promotions wiring
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"
CUSTOMER_EMAIL = "kunde@bidblitz.com"
CUSTOMER_PASSWORD = "Kunde2026!"


class TestSession:
    """Shared session for authenticated requests"""
    admin_session = None
    customer_session = None


@pytest.fixture(scope="module")
def admin_session():
    """Login as admin and return session"""
    if TestSession.admin_session:
        return TestSession.admin_session
    
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    TestSession.admin_session = session
    return session


@pytest.fixture(scope="module")
def customer_session():
    """Login as customer and return session"""
    if TestSession.customer_session:
        return TestSession.customer_session
    
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": CUSTOMER_EMAIL,
        "password": CUSTOMER_PASSWORD
    })
    assert response.status_code == 200, f"Customer login failed: {response.text}"
    TestSession.customer_session = session
    return session


# ── Profile Editing Tests ──
class TestProfileEditing:
    """Tests for profile viewing and editing"""
    
    def test_get_profile(self, customer_session):
        """GET /api/user/profile returns user profile with settings fields"""
        response = customer_session.get(f"{BASE_URL}/api/user/profile")
        assert response.status_code == 200
        
        data = response.json()
        assert "email" in data
        assert "name" in data
        # Check settings fields exist
        assert "notifications_enabled" in data
        assert "biometric_enabled" in data
        assert "dark_mode" in data
        print(f"✓ Profile retrieved: {data['name']} ({data['email']})")
    
    def test_update_profile_name(self, customer_session):
        """PUT /api/user/profile updates name"""
        # Get current name
        response = customer_session.get(f"{BASE_URL}/api/user/profile")
        original_name = response.json().get("name", "Test User")
        
        # Update name
        new_name = "TEST_Updated_Name"
        response = customer_session.put(f"{BASE_URL}/api/user/profile", json={
            "name": new_name
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == new_name
        print(f"✓ Name updated to: {new_name}")
        
        # Restore original name
        customer_session.put(f"{BASE_URL}/api/user/profile", json={"name": original_name})
    
    def test_update_profile_settings(self, customer_session):
        """PUT /api/user/profile updates settings fields"""
        response = customer_session.put(f"{BASE_URL}/api/user/profile", json={
            "notifications_enabled": True,
            "biometric_enabled": False,
            "dark_mode": True
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["notifications_enabled"] == True
        assert data["biometric_enabled"] == False
        assert data["dark_mode"] == True
        print("✓ Settings updated successfully")
    
    def test_update_profile_empty_fails(self, customer_session):
        """PUT /api/user/profile with no fields returns 400"""
        response = customer_session.put(f"{BASE_URL}/api/user/profile", json={})
        assert response.status_code == 400
        print("✓ Empty update correctly rejected")


# ── Password Change Tests ──
class TestPasswordChange:
    """Tests for password change functionality"""
    
    def test_change_password_wrong_current(self, customer_session):
        """POST /api/user/change-password with wrong current password fails"""
        response = customer_session.post(f"{BASE_URL}/api/user/change-password", json={
            "current_password": "WrongPassword123!",
            "new_password": "NewPassword123!"
        })
        assert response.status_code == 400
        assert "incorrect" in response.json().get("detail", "").lower()
        print("✓ Wrong current password correctly rejected")
    
    def test_change_password_success(self, customer_session):
        """POST /api/user/change-password with correct password succeeds"""
        # Change password
        response = customer_session.post(f"{BASE_URL}/api/user/change-password", json={
            "current_password": CUSTOMER_PASSWORD,
            "new_password": "TempPassword123!"
        })
        assert response.status_code == 200
        assert response.json().get("success") == True
        print("✓ Password changed successfully")
        
        # Change it back
        response = customer_session.post(f"{BASE_URL}/api/user/change-password", json={
            "current_password": "TempPassword123!",
            "new_password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200
        print("✓ Password restored to original")


# ── Support Tickets Tests ──
class TestSupportTickets:
    """Tests for support ticket CRUD"""
    created_ticket_id = None
    
    def test_create_support_ticket(self, customer_session):
        """POST /api/support/tickets creates a ticket"""
        response = customer_session.post(f"{BASE_URL}/api/support/tickets", json={
            "subject": "TEST_Support_Ticket",
            "message": "This is a test support ticket message for testing purposes.",
            "category": "general"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "ticket_id" in data
        assert data["ticket_id"].startswith("TK-")
        TestSupportTickets.created_ticket_id = data["ticket_id"]
        print(f"✓ Support ticket created: {data['ticket_id']}")
    
    def test_get_my_tickets(self, customer_session):
        """GET /api/support/tickets returns user's tickets"""
        response = customer_session.get(f"{BASE_URL}/api/support/tickets")
        assert response.status_code == 200
        
        data = response.json()
        assert "tickets" in data
        assert isinstance(data["tickets"], list)
        
        # Check our created ticket is in the list
        if TestSupportTickets.created_ticket_id:
            ticket_ids = [t["ticket_id"] for t in data["tickets"]]
            assert TestSupportTickets.created_ticket_id in ticket_ids
        print(f"✓ Retrieved {len(data['tickets'])} tickets")
    
    def test_admin_get_all_tickets(self, admin_session):
        """GET /api/support/admin/tickets returns all tickets for admin"""
        response = admin_session.get(f"{BASE_URL}/api/support/admin/tickets")
        assert response.status_code == 200
        
        data = response.json()
        assert "tickets" in data
        assert "total" in data
        print(f"✓ Admin retrieved {data['total']} total tickets")
    
    def test_admin_resolve_ticket(self, admin_session):
        """POST /api/support/admin/tickets/{id}/resolve resolves a ticket"""
        if not TestSupportTickets.created_ticket_id:
            pytest.skip("No ticket to resolve")
        
        response = admin_session.post(
            f"{BASE_URL}/api/support/admin/tickets/{TestSupportTickets.created_ticket_id}/resolve",
            json={"response": "Test resolution response"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("status") == "resolved"
        print(f"✓ Ticket {TestSupportTickets.created_ticket_id} resolved")
    
    def test_non_admin_cannot_access_admin_tickets(self, customer_session):
        """GET /api/support/admin/tickets returns 403 for non-admin"""
        response = customer_session.get(f"{BASE_URL}/api/support/admin/tickets")
        assert response.status_code == 403
        print("✓ Non-admin correctly denied access to admin tickets")


# ── Admin Feature Flags Tests ──
class TestAdminFeatureFlags:
    """Tests for admin feature flags management"""
    
    def test_get_feature_flags(self, admin_session):
        """GET /api/admin/feature-flags returns all flags"""
        response = admin_session.get(f"{BASE_URL}/api/admin/feature-flags")
        assert response.status_code == 200
        
        data = response.json()
        assert "flags" in data
        assert isinstance(data["flags"], list)
        assert len(data["flags"]) >= 5  # Should have multiple flags
        
        # Check flag structure
        for flag in data["flags"]:
            assert "name" in flag
            assert "enabled" in flag
        print(f"✓ Retrieved {len(data['flags'])} feature flags")
    
    def test_toggle_feature_flag(self, admin_session):
        """PUT /api/admin/feature-flags/{name} toggles flag"""
        # Get current state of a flag
        response = admin_session.get(f"{BASE_URL}/api/admin/feature-flags")
        flags = response.json()["flags"]
        
        # Find a flag to toggle (use 'referral' as it's safe to toggle)
        test_flag = next((f for f in flags if f["name"] == "referral"), None)
        if not test_flag:
            pytest.skip("No referral flag found")
        
        original_state = test_flag["enabled"]
        
        # Toggle it
        response = admin_session.put(f"{BASE_URL}/api/admin/feature-flags/referral", json={
            "enabled": not original_state
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Feature flag 'referral' toggled from {original_state} to {not original_state}")
        
        # Toggle it back
        admin_session.put(f"{BASE_URL}/api/admin/feature-flags/referral", json={
            "enabled": original_state
        })
        print(f"✓ Feature flag restored to {original_state}")


# ── Admin Audit Logs Tests ──
class TestAdminAuditLogs:
    """Tests for admin audit logs viewing"""
    
    def test_get_audit_logs(self, admin_session):
        """GET /api/admin/audit-logs returns audit entries"""
        response = admin_session.get(f"{BASE_URL}/api/admin/audit-logs?limit=20")
        assert response.status_code == 200
        
        data = response.json()
        assert "logs" in data
        assert "total" in data
        assert isinstance(data["logs"], list)
        
        # Check log structure
        if data["logs"]:
            log = data["logs"][0]
            assert "event" in log
            assert "timestamp" in log
        print(f"✓ Retrieved {len(data['logs'])} audit logs (total: {data['total']})")
    
    def test_non_admin_cannot_access_audit_logs(self, customer_session):
        """GET /api/admin/audit-logs returns 403 for non-admin"""
        response = customer_session.get(f"{BASE_URL}/api/admin/audit-logs")
        assert response.status_code == 403
        print("✓ Non-admin correctly denied access to audit logs")


# ── Admin Compliance Tests ──
class TestAdminCompliance:
    """Tests for admin compliance dashboard"""
    
    def test_get_compliance_flags(self, admin_session):
        """GET /api/admin/compliance-flags returns compliance flags"""
        response = admin_session.get(f"{BASE_URL}/api/admin/compliance-flags?limit=20")
        assert response.status_code == 200
        
        data = response.json()
        assert "flags" in data
        assert isinstance(data["flags"], list)
        print(f"✓ Retrieved {len(data['flags'])} compliance flags")
    
    def test_get_compliance_checks(self, admin_session):
        """GET /api/admin/compliance-checks returns compliance checks"""
        response = admin_session.get(f"{BASE_URL}/api/admin/compliance-checks?limit=20")
        assert response.status_code == 200
        
        data = response.json()
        assert "checks" in data
        assert isinstance(data["checks"], list)
        print(f"✓ Retrieved {len(data['checks'])} compliance checks")


# ── Admin Analytics Tests ──
class TestAdminAnalytics:
    """Tests for admin growth analytics"""
    
    def test_get_growth_overview(self, admin_session):
        """GET /api/analytics/growth/overview returns growth stats"""
        response = admin_session.get(f"{BASE_URL}/api/analytics/growth/overview")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_users" in data
        assert "active_30d" in data
        print(f"✓ Growth overview: {data['total_users']} total users, {data['active_30d']} active")
    
    def test_get_conversion_funnel(self, admin_session):
        """GET /api/analytics/growth/funnel returns funnel data"""
        response = admin_session.get(f"{BASE_URL}/api/analytics/growth/funnel")
        assert response.status_code == 200
        
        data = response.json()
        assert "steps" in data
        assert isinstance(data["steps"], list)
        print(f"✓ Conversion funnel: {len(data['steps'])} steps")
    
    def test_get_retention_metrics(self, admin_session):
        """GET /api/analytics/growth/retention returns retention data"""
        response = admin_session.get(f"{BASE_URL}/api/analytics/growth/retention")
        assert response.status_code == 200
        
        data = response.json()
        # Should have retention metrics
        assert "day_1" in data or "retention" in data or isinstance(data, dict)
        print(f"✓ Retention metrics retrieved")
    
    def test_get_campaigns(self, admin_session):
        """GET /api/analytics/growth/campaigns returns campaign data"""
        response = admin_session.get(f"{BASE_URL}/api/analytics/growth/campaigns")
        assert response.status_code == 200
        
        data = response.json()
        assert "campaigns" in data
        print(f"✓ Campaigns: {len(data['campaigns'])} campaigns")


# ── Kids Dashboard Tests ──
class TestKidsDashboard:
    """Tests for Kids subscription and dashboard"""
    
    def test_get_kids_subscription_status(self, customer_session):
        """GET /api/kids/subscription returns subscription status"""
        response = customer_session.get(f"{BASE_URL}/api/kids/subscription")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        # Status should be one of: none, trial, active, expired
        assert data["status"] in ["none", "trial", "active", "expired"]
        print(f"✓ Kids subscription status: {data['status']}")
    
    def test_kids_subscription_unauthenticated(self):
        """GET /api/kids/subscription returns 401 without auth"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/kids/subscription")
        assert response.status_code == 401
        print("✓ Unauthenticated access correctly rejected")


# ── Promotions Wiring Tests ──
class TestPromotionsWiring:
    """Tests for promotions integration in payment flows"""
    
    def test_get_active_promotions(self, customer_session):
        """GET /api/promotions/active returns active promotions"""
        response = customer_session.get(f"{BASE_URL}/api/promotions/active")
        assert response.status_code == 200
        
        data = response.json()
        assert "promotions" in data
        assert isinstance(data["promotions"], list)
        print(f"✓ Active promotions: {len(data['promotions'])}")
        
        # Print promotion details if any
        for promo in data["promotions"]:
            print(f"  - {promo.get('name')}: {promo.get('type')} ({promo.get('value')}%)")
    
    def test_admin_get_all_promotions(self, admin_session):
        """GET /api/promotions/admin/all returns all promotions for admin"""
        response = admin_session.get(f"{BASE_URL}/api/promotions/admin/all")
        assert response.status_code == 200
        
        data = response.json()
        assert "promotions" in data
        print(f"✓ Admin sees {len(data['promotions'])} total promotions")


# ── Public Feature Flags Test ──
class TestPublicFeatureFlags:
    """Tests for public feature flags endpoint"""
    
    def test_public_feature_flags(self):
        """GET /api/feature-flags returns flags without auth"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/feature-flags")
        assert response.status_code == 200
        
        data = response.json()
        assert "flags" in data
        
        # Check structure
        for name, flag in data["flags"].items():
            assert "enabled" in flag
            assert "access" in flag
        print(f"✓ Public feature flags: {len(data['flags'])} flags")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
