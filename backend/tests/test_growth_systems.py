"""
BidBlitz V2 - Growth Systems API Tests
Tests: Referral, Notifications, Promotions, Analytics, Export
"""
import pytest
import requests
import os
import random
import string
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bidblitz-staff.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


def random_email():
    """Generate random email for test user registration"""
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"TEST_growth_{suffix}@test.com"


@pytest.fixture(scope="module")
def admin_session():
    """Create authenticated admin session"""
    session = requests.Session()
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    print(f"✓ Admin session created: {ADMIN_EMAIL}")
    return session


@pytest.fixture(scope="module")
def test_user_session():
    """Create authenticated test user session"""
    session = requests.Session()
    test_email = random_email()
    resp = session.post(f"{BASE_URL}/api/auth/register", json={
        "name": "Growth Test User",
        "email": test_email,
        "password": "password123"
    })
    assert resp.status_code == 200, f"Test user registration failed: {resp.text}"
    print(f"✓ Test user session created: {test_email}")
    return session, test_email


# ═══════════════════════════════════════════════════════════════
# REFERRAL SYSTEM TESTS
# ═══════════════════════════════════════════════════════════════

class TestReferralSystem:
    """Referral system endpoint tests"""
    
    def test_get_my_referral_code(self, admin_session):
        """Test GET /api/referral/my-code returns referral code starting with BB-"""
        response = admin_session.get(f"{BASE_URL}/api/referral/my-code")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify referral code structure
        assert "referral_code" in data
        assert data["referral_code"].startswith("BB-"), f"Code should start with BB-: {data['referral_code']}"
        assert len(data["referral_code"]) == 9  # BB- + 6 chars
        
        # Verify other fields
        assert "referral_link" in data
        assert "total_referrals" in data
        assert "rewarded_referrals" in data
        assert "total_earned" in data
        assert "reward_per_referral" in data
        
        print(f"✓ Referral code retrieved: {data['referral_code']}")
        print(f"  - Total referrals: {data['total_referrals']}")
        print(f"  - Rewarded: {data['rewarded_referrals']}")
        print(f"  - Total earned: €{data['total_earned']}")
    
    def test_referral_code_unauthenticated(self):
        """Test referral endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/referral/my-code")
        assert response.status_code == 401
        print("✓ Referral endpoint correctly requires authentication")
    
    def test_apply_referral_code_invalid(self, test_user_session):
        """Test applying invalid referral code returns 404"""
        session, _ = test_user_session
        response = session.post(f"{BASE_URL}/api/referral/apply", json={
            "code": "BB-INVALID"
        })
        assert response.status_code == 404
        data = response.json()
        assert "invalid" in data["detail"].lower() or "not found" in data["detail"].lower()
        print(f"✓ Invalid referral code correctly rejected: {data['detail']}")
    
    def test_apply_referral_code_self(self, admin_session):
        """Test user cannot refer themselves"""
        # Get admin's referral code
        ref_resp = admin_session.get(f"{BASE_URL}/api/referral/my-code")
        admin_code = ref_resp.json()["referral_code"]
        
        # Try to apply own code
        response = admin_session.post(f"{BASE_URL}/api/referral/apply", json={
            "code": admin_code
        })
        assert response.status_code == 400
        data = response.json()
        assert "yourself" in data["detail"].lower() or "own" in data["detail"].lower()
        print(f"✓ Self-referral correctly rejected: {data['detail']}")
    
    def test_referral_leaderboard(self, admin_session):
        """Test GET /api/referral/leaderboard returns leaderboard"""
        response = admin_session.get(f"{BASE_URL}/api/referral/leaderboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)
        print(f"✓ Referral leaderboard retrieved: {len(data['leaderboard'])} entries")


# ═══════════════════════════════════════════════════════════════
# NOTIFICATIONS SYSTEM TESTS
# ═══════════════════════════════════════════════════════════════

class TestNotificationsSystem:
    """Notifications system endpoint tests"""
    
    def test_get_notifications(self, admin_session):
        """Test GET /api/notifications returns notifications list with unread_count"""
        response = admin_session.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "notifications" in data
        assert "unread_count" in data
        assert isinstance(data["notifications"], list)
        assert isinstance(data["unread_count"], int)
        
        print(f"✓ Notifications retrieved: {len(data['notifications'])} items, {data['unread_count']} unread")
    
    def test_get_notifications_unread_only(self, admin_session):
        """Test GET /api/notifications?unread_only=true filters correctly"""
        response = admin_session.get(f"{BASE_URL}/api/notifications?unread_only=true")
        assert response.status_code == 200
        data = response.json()
        
        # All returned notifications should be unread
        for notif in data["notifications"]:
            assert notif.get("read") == False, f"Found read notification in unread_only query"
        
        print(f"✓ Unread-only filter works: {len(data['notifications'])} unread notifications")
    
    def test_notifications_unauthenticated(self):
        """Test notifications endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 401
        print("✓ Notifications endpoint correctly requires authentication")
    
    def test_admin_send_notification(self, admin_session):
        """Test POST /api/notifications/admin/send sends notifications (admin only)"""
        response = admin_session.post(f"{BASE_URL}/api/notifications/admin/send", json={
            "target": "all",
            "title": "Test Notification",
            "message": "This is a test notification from growth systems testing",
            "type": "campaign"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert "sent_count" in data
        assert data["sent_count"] >= 1
        
        print(f"✓ Admin notification sent to {data['sent_count']} users")
    
    def test_admin_send_notification_non_admin(self, test_user_session):
        """Test non-admin cannot send notifications"""
        session, _ = test_user_session
        response = session.post(f"{BASE_URL}/api/notifications/admin/send", json={
            "target": "all",
            "title": "Unauthorized Test",
            "message": "This should fail",
            "type": "campaign"
        })
        assert response.status_code == 403
        print("✓ Non-admin correctly rejected from sending notifications")
    
    def test_mark_all_notifications_read(self, admin_session):
        """Test POST /api/notifications/read-all marks all as read"""
        response = admin_session.post(f"{BASE_URL}/api/notifications/read-all")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert "marked" in data
        
        # Verify unread count is now 0
        notif_resp = admin_session.get(f"{BASE_URL}/api/notifications")
        assert notif_resp.json()["unread_count"] == 0
        
        print(f"✓ Marked {data['marked']} notifications as read")


# ═══════════════════════════════════════════════════════════════
# PROMOTIONS ENGINE TESTS
# ═══════════════════════════════════════════════════════════════

class TestPromotionsEngine:
    """Promotions engine endpoint tests"""
    
    def test_get_active_promotions(self, admin_session):
        """Test GET /api/promotions/active returns active promotions"""
        response = admin_session.get(f"{BASE_URL}/api/promotions/active")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "promotions" in data
        assert isinstance(data["promotions"], list)
        
        print(f"✓ Active promotions retrieved: {len(data['promotions'])} promotions")
    
    def test_promotions_unauthenticated(self):
        """Test promotions endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/promotions/active")
        assert response.status_code == 401
        print("✓ Promotions endpoint correctly requires authentication")
    
    def test_admin_create_promotion(self, admin_session):
        """Test POST /api/promotions/admin/create creates a new promotion (admin only)"""
        now = datetime.utcnow()
        promo_name = f"TEST_PROMO_{random.randint(1000, 9999)}"
        
        response = admin_session.post(f"{BASE_URL}/api/promotions/admin/create", json={
            "name": promo_name,
            "type": "bonus_topup",
            "description": "Test promotion - 10% bonus on top-ups",
            "value": 10.0,
            "min_amount": 50.0,
            "max_uses": 100,
            "starts_at": now.isoformat(),
            "expires_at": (now + timedelta(days=30)).isoformat(),
            "target": "all",
            "active": True
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert "promotion_id" in data
        assert data["name"] == promo_name
        
        print(f"✓ Promotion created: {promo_name} (ID: {data['promotion_id']})")
        return promo_name
    
    def test_admin_create_promotion_non_admin(self, test_user_session):
        """Test non-admin cannot create promotions"""
        session, _ = test_user_session
        now = datetime.utcnow()
        
        response = session.post(f"{BASE_URL}/api/promotions/admin/create", json={
            "name": "UNAUTHORIZED_PROMO",
            "type": "bonus_topup",
            "description": "This should fail",
            "value": 10.0,
            "min_amount": 0,
            "max_uses": 0,
            "starts_at": now.isoformat(),
            "expires_at": (now + timedelta(days=1)).isoformat(),
            "target": "all",
            "active": True
        })
        assert response.status_code == 403
        print("✓ Non-admin correctly rejected from creating promotions")
    
    def test_admin_get_all_promotions(self, admin_session):
        """Test GET /api/promotions/admin/all returns all promotions"""
        response = admin_session.get(f"{BASE_URL}/api/promotions/admin/all")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "promotions" in data
        assert isinstance(data["promotions"], list)
        
        print(f"✓ All promotions retrieved (admin): {len(data['promotions'])} promotions")


# ═══════════════════════════════════════════════════════════════
# GROWTH ANALYTICS TESTS
# ═══════════════════════════════════════════════════════════════

class TestGrowthAnalytics:
    """Growth analytics endpoint tests (admin only)"""
    
    def test_growth_overview(self, admin_session):
        """Test GET /api/analytics/growth/overview returns user/merchant/referral stats"""
        response = admin_session.get(f"{BASE_URL}/api/analytics/growth/overview")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "users" in data
        assert "merchants" in data
        assert "referrals" in data
        assert "promotions" in data
        
        # Verify users stats
        assert "total" in data["users"]
        assert "new_this_week" in data["users"]
        assert "new_this_month" in data["users"]
        
        # Verify merchants stats
        assert "total" in data["merchants"]
        assert "new_this_week" in data["merchants"]
        
        # Verify referrals stats
        assert "total" in data["referrals"]
        assert "rewarded" in data["referrals"]
        assert "conversion_rate" in data["referrals"]
        
        print(f"✓ Growth overview retrieved:")
        print(f"  - Users: {data['users']['total']} total, {data['users']['new_this_week']} this week")
        print(f"  - Merchants: {data['merchants']['total']} total")
        print(f"  - Referrals: {data['referrals']['total']} total, {data['referrals']['conversion_rate']}% conversion")
        print(f"  - Active promotions: {data['promotions']['active']}")
    
    def test_growth_overview_non_admin(self, test_user_session):
        """Test non-admin cannot access growth analytics"""
        session, _ = test_user_session
        response = session.get(f"{BASE_URL}/api/analytics/growth/overview")
        assert response.status_code == 403
        print("✓ Non-admin correctly rejected from growth analytics")
    
    def test_conversion_funnel(self, admin_session):
        """Test GET /api/analytics/growth/funnel returns conversion funnel data"""
        response = admin_session.get(f"{BASE_URL}/api/analytics/growth/funnel")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "funnel" in data
        assert isinstance(data["funnel"], list)
        
        # Verify funnel stages
        stages = [f["stage"] for f in data["funnel"]]
        assert "signup" in stages
        assert "topup" in stages
        assert "payment" in stages
        assert "referral" in stages
        
        print(f"✓ Conversion funnel retrieved: {len(data['funnel'])} stages")
        for stage in data["funnel"]:
            print(f"  - {stage['stage']}: {stage['count']} users ({stage['rate']}%)")
    
    def test_retention_metrics(self, admin_session):
        """Test GET /api/analytics/growth/retention returns retention metrics"""
        response = admin_session.get(f"{BASE_URL}/api/analytics/growth/retention")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "total_users" in data
        assert "active_7d" in data
        assert "active_30d" in data
        assert "retention_7d" in data
        assert "retention_30d" in data
        
        print(f"✓ Retention metrics retrieved:")
        print(f"  - Total users: {data['total_users']}")
        print(f"  - Active 7d: {data['active_7d']} ({data['retention_7d']}%)")
        print(f"  - Active 30d: {data['active_30d']} ({data['retention_30d']}%)")
    
    def test_campaign_performance(self, admin_session):
        """Test GET /api/analytics/growth/campaigns returns campaign performance"""
        response = admin_session.get(f"{BASE_URL}/api/analytics/growth/campaigns")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "campaigns" in data
        assert isinstance(data["campaigns"], list)
        
        print(f"✓ Campaign performance retrieved: {len(data['campaigns'])} campaigns")


# ═══════════════════════════════════════════════════════════════
# EXPORT API TESTS
# ═══════════════════════════════════════════════════════════════

class TestExportAPI:
    """CSV Export endpoint tests"""
    
    def test_export_user_transactions(self, admin_session):
        """Test GET /api/export/user/transactions returns CSV file"""
        response = admin_session.get(f"{BASE_URL}/api/export/user/transactions")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify CSV response
        content_type = response.headers.get("content-type", "")
        assert "text/csv" in content_type, f"Expected CSV, got: {content_type}"
        
        # Verify content-disposition header
        content_disp = response.headers.get("content-disposition", "")
        assert "attachment" in content_disp
        assert ".csv" in content_disp
        
        # Verify CSV content has headers
        content = response.text
        assert "Date" in content or "Reference" in content
        
        print(f"✓ User transactions CSV export successful ({len(content)} bytes)")
    
    def test_export_unauthenticated(self):
        """Test export endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/export/user/transactions")
        assert response.status_code == 401
        print("✓ Export endpoint correctly requires authentication")


# ═══════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════

class TestHealthCheck:
    """Health check endpoint test"""
    
    def test_api_health(self):
        """Test GET /api returns service status"""
        response = requests.get(f"{BASE_URL}/api")
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "online"
        assert "BidBlitz" in data["service"]
        assert "version" in data
        
        print(f"✓ API health check: {data['service']} v{data['version']} - {data['status']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
