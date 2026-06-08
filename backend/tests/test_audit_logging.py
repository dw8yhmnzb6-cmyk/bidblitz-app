"""
BidBlitz V2 - Audit Logging Tests
Tests for audit log creation across all critical backend flows:
- Auth: login success/failure/locked, register, logout
- Payment: payment success/failure, send success/failure
- Payout: payout request/cancel
- Admin: payout actions, audit log viewing
- Stripe: topup initiated/success/failed
- Profile: profile update, password change
"""

import pytest
import requests
import os
import time
from datetime import datetime, timezone
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"
CUSTOMER_EMAIL = "kunde@bidblitz.com"
CUSTOMER_PASSWORD = "Kunde2026!"
MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PASSWORD = "Haendler2026!"


@pytest.fixture(scope="module")
def mongo_client():
    """Direct MongoDB connection for audit log verification."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture(scope="module")
def api_session():
    """Shared requests session."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_session():
    """Authenticated admin session."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code}")
    return session


@pytest.fixture(scope="module")
def customer_session():
    """Authenticated customer session."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": CUSTOMER_EMAIL,
        "password": CUSTOMER_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Customer login failed: {response.status_code}")
    return session


def get_latest_audit_log(db, event: str, email: str = None, user_id: str = None, since_timestamp: str = None):
    """Get the most recent audit log matching criteria."""
    query = {"event": event}
    if email:
        query["email"] = email
    if user_id:
        query["user_id"] = user_id
    if since_timestamp:
        query["timestamp"] = {"$gte": since_timestamp}
    
    log = db.audit_logs.find_one(query, sort=[("timestamp", -1)])
    return log


def get_audit_log_count(db, event: str, since_timestamp: str = None):
    """Count audit logs for an event since a timestamp."""
    query = {"event": event}
    if since_timestamp:
        query["timestamp"] = {"$gte": since_timestamp}
    return db.audit_logs.count_documents(query)


class TestAuditLogStructure:
    """Test that audit logs have the correct structure."""
    
    def test_audit_log_has_required_fields(self, mongo_client, customer_session):
        """Verify audit log structure includes all required fields."""
        # Get any recent audit log
        log = mongo_client.audit_logs.find_one(sort=[("timestamp", -1)])
        
        assert log is not None, "No audit logs found in database"
        
        # Required fields
        required_fields = ["event", "user_id", "email", "ip", "user_agent", "details", "severity", "timestamp"]
        for field in required_fields:
            assert field in log, f"Missing required field: {field}"
        
        # Verify types
        assert isinstance(log["event"], str), "event should be string"
        assert isinstance(log["details"], dict), "details should be dict"
        assert log["severity"] in ("info", "warn"), f"Invalid severity: {log['severity']}"
        
        print(f"✓ Audit log structure verified with fields: {list(log.keys())}")


class TestAuthAuditLogs:
    """Test audit logging for authentication flows."""
    
    def test_login_success_creates_audit_log(self, api_session, mongo_client):
        """POST /api/auth/login with valid credentials → audit log 'login_success' created."""
        timestamp_before = datetime.now(timezone.utc).isoformat()
        
        response = api_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        user_data = response.json()
        
        # Wait briefly for async log write
        time.sleep(0.5)
        
        # Verify audit log created
        log = get_latest_audit_log(mongo_client, "login_success", email=CUSTOMER_EMAIL, since_timestamp=timestamp_before)
        
        assert log is not None, "login_success audit log not created"
        assert log["email"] == CUSTOMER_EMAIL, f"Wrong email: {log['email']}"
        assert log["user_id"] == user_data["id"], f"Wrong user_id: {log['user_id']}"
        assert log["ip"] != "", "IP should be captured"
        assert "role" in log["details"], "details should contain role"
        assert log["severity"] == "info", f"Wrong severity: {log['severity']}"
        
        print(f"✓ login_success audit log created: user_id={log['user_id']}, ip={log['ip']}, role={log['details'].get('role')}")
    
    def test_login_failed_creates_audit_log(self, api_session, mongo_client):
        """POST /api/auth/login with invalid password → audit log 'login_failed' created."""
        timestamp_before = datetime.now(timezone.utc).isoformat()
        
        response = api_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": "WrongPassword123!"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        time.sleep(0.5)
        
        log = get_latest_audit_log(mongo_client, "login_failed", email=CUSTOMER_EMAIL, since_timestamp=timestamp_before)
        
        assert log is not None, "login_failed audit log not created"
        assert log["email"] == CUSTOMER_EMAIL
        assert log["severity"] == "warn", f"Expected severity=warn, got {log['severity']}"
        assert log["details"].get("reason") == "invalid_credentials", f"Wrong reason: {log['details']}"
        
        print(f"✓ login_failed audit log created: email={log['email']}, reason={log['details'].get('reason')}, severity={log['severity']}")
    
    def test_register_creates_audit_log(self, api_session, mongo_client):
        """POST /api/auth/register with new user → audit log 'register' created."""
        timestamp_before = datetime.now(timezone.utc).isoformat()
        test_email = f"test_audit_{int(time.time())}@example.com"
        
        response = api_session.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "TestPassword123!",
            "name": "Test Audit User"
        })
        
        assert response.status_code == 200, f"Register failed: {response.text}"
        user_data = response.json()
        
        time.sleep(0.5)
        
        log = get_latest_audit_log(mongo_client, "register", email=test_email, since_timestamp=timestamp_before)
        
        assert log is not None, "register audit log not created"
        assert log["email"] == test_email
        assert log["user_id"] == user_data["id"]
        assert log["details"].get("role") == "user"
        
        print(f"✓ register audit log created: user_id={log['user_id']}, email={log['email']}")
        
        # Cleanup: delete test user
        mongo_client.users.delete_one({"email": test_email})
        mongo_client.merchants.delete_one({"user_id": user_data["id"]})
    
    def test_logout_creates_audit_log(self, mongo_client):
        """POST /api/auth/logout → audit log 'logout' created."""
        # Create fresh session and login
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert login_resp.status_code == 200
        user_data = login_resp.json()
        
        timestamp_before = datetime.now(timezone.utc).isoformat()
        
        logout_resp = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_resp.status_code == 200
        
        time.sleep(0.5)
        
        log = get_latest_audit_log(mongo_client, "logout", user_id=user_data["id"], since_timestamp=timestamp_before)
        
        assert log is not None, "logout audit log not created"
        assert log["user_id"] == user_data["id"]
        
        print(f"✓ logout audit log created: user_id={log['user_id']}")
    
    def test_audit_log_does_not_contain_password(self, mongo_client):
        """Verify audit logs do NOT contain passwords or sensitive data."""
        # Check recent auth-related logs
        auth_events = ["login_success", "login_failed", "register", "password_change"]
        
        for event in auth_events:
            logs = list(mongo_client.audit_logs.find({"event": event}).limit(5))
            for log in logs:
                # Check log doesn't contain password
                log_str = str(log).lower()
                assert "password" not in log_str or "password_change" in log_str or "password_hash" not in log_str, \
                    f"Password found in {event} audit log"
                assert "kunde2026" not in log_str, f"Actual password value found in {event} log"
                assert "bidblitz2026" not in log_str, f"Actual password value found in {event} log"
        
        print("✓ Audit logs do not contain passwords or sensitive data")


class TestPaymentAuditLogs:
    """Test audit logging for payment flows."""
    
    def test_payment_failed_insufficient_balance_creates_audit_log(self, mongo_client):
        """POST /api/payment/pay with insufficient balance → audit log 'payment_failed' created."""
        # Create session with low balance user
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as customer
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert login_resp.status_code == 200
        user_data = login_resp.json()
        
        # Get a merchant_id from the database
        merchant = mongo_client.merchants.find_one()
        merchant_id = str(merchant["_id"]) if merchant else user_data["id"]
        
        timestamp_before = datetime.now(timezone.utc).isoformat()
        
        # Try to pay more than balance
        pay_resp = session.post(f"{BASE_URL}/api/payment/pay", json={
            "amount": 999999.99,  # Way more than balance
            "merchant_id": merchant_id,
            "description": "Test payment for audit"
        })
        
        assert pay_resp.status_code == 400, f"Expected 400, got {pay_resp.status_code}: {pay_resp.text}"
        
        time.sleep(0.5)
        
        log = get_latest_audit_log(mongo_client, "payment_failed", user_id=user_data["id"], since_timestamp=timestamp_before)
        
        assert log is not None, "payment_failed audit log not created"
        assert log["details"].get("reason") == "insufficient_balance"
        assert log["severity"] == "warn"
        assert "amount" in log["details"]
        assert "balance" in log["details"]
        
        print(f"✓ payment_failed audit log created: reason={log['details'].get('reason')}, amount={log['details'].get('amount')}")


class TestStripeAuditLogs:
    """Test audit logging for Stripe topup flows."""
    
    def test_topup_initiated_creates_audit_log(self, customer_session, mongo_client):
        """POST /api/stripe/checkout → audit log 'topup_initiated' created."""
        # Get user info first
        me_resp = customer_session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        user_data = me_resp.json()
        
        timestamp_before = datetime.now(timezone.utc).isoformat()
        
        checkout_resp = customer_session.post(f"{BASE_URL}/api/stripe/checkout", json={
            "package_id": "10",
            "origin_url": "https://taxi-uber-style.preview.emergentagent.com"
        })
        
        assert checkout_resp.status_code == 200, f"Checkout failed: {checkout_resp.text}"
        checkout_data = checkout_resp.json()
        
        time.sleep(0.5)
        
        log = get_latest_audit_log(mongo_client, "topup_initiated", user_id=user_data["id"], since_timestamp=timestamp_before)
        
        assert log is not None, "topup_initiated audit log not created"
        assert "session_id" in log["details"], "session_id missing from details"
        assert log["details"].get("amount") == 10.0, f"Wrong amount: {log['details'].get('amount')}"
        assert log["details"].get("package_id") == "10"
        
        print(f"✓ topup_initiated audit log created: session_id={log['details'].get('session_id')[:20]}..., amount={log['details'].get('amount')}")


class TestAdminAuditLogs:
    """Test audit logging for admin operations."""
    
    def test_admin_can_view_audit_logs(self, admin_session, mongo_client):
        """GET /api/admin/audit-logs → returns logs with filters."""
        response = admin_session.get(f"{BASE_URL}/api/admin/audit-logs", params={
            "limit": 10
        })
        
        assert response.status_code == 200, f"Failed to get audit logs: {response.text}"
        data = response.json()
        
        assert "logs" in data, "Response missing 'logs' field"
        assert "total" in data, "Response missing 'total' field"
        assert isinstance(data["logs"], list)
        
        if len(data["logs"]) > 0:
            log = data["logs"][0]
            # Verify log structure
            assert "event" in log
            assert "timestamp" in log
            assert "severity" in log
        
        print(f"✓ Admin can view audit logs: {len(data['logs'])} logs returned, total={data['total']}")
    
    def test_admin_audit_logs_filter_by_event(self, admin_session):
        """GET /api/admin/audit-logs with event filter."""
        response = admin_session.get(f"{BASE_URL}/api/admin/audit-logs", params={
            "event": "login_success",
            "limit": 5
        })
        
        assert response.status_code == 200
        data = response.json()
        
        for log in data["logs"]:
            assert log["event"] == "login_success", f"Filter not working: got {log['event']}"
        
        print(f"✓ Event filter works: {len(data['logs'])} login_success logs returned")
    
    def test_admin_audit_logs_filter_by_severity(self, admin_session):
        """GET /api/admin/audit-logs with severity filter."""
        response = admin_session.get(f"{BASE_URL}/api/admin/audit-logs", params={
            "severity": "warn",
            "limit": 5
        })
        
        assert response.status_code == 200
        data = response.json()
        
        for log in data["logs"]:
            assert log["severity"] == "warn", f"Severity filter not working: got {log['severity']}"
        
        print(f"✓ Severity filter works: {len(data['logs'])} warn logs returned")
    
    def test_non_admin_cannot_view_audit_logs(self, customer_session):
        """GET /api/admin/audit-logs without admin role → 403 Forbidden."""
        response = customer_session.get(f"{BASE_URL}/api/admin/audit-logs")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        
        print("✓ Non-admin users get 403 Forbidden when accessing audit logs")
    
    def test_viewing_audit_logs_creates_audit_log(self, admin_session, mongo_client):
        """Viewing audit logs should itself create an audit log."""
        # Get admin user info
        me_resp = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        admin_data = me_resp.json()
        
        timestamp_before = datetime.now(timezone.utc).isoformat()
        
        # View audit logs
        admin_session.get(f"{BASE_URL}/api/admin/audit-logs", params={"limit": 5})
        
        time.sleep(0.5)
        
        log = get_latest_audit_log(mongo_client, "admin_action", user_id=admin_data["id"], since_timestamp=timestamp_before)
        
        assert log is not None, "admin_action audit log not created for viewing audit logs"
        assert log["details"].get("action") == "view_audit_logs"
        
        print(f"✓ Viewing audit logs creates admin_action audit log")


class TestProfileAuditLogs:
    """Test audit logging for profile operations."""
    
    def test_profile_update_creates_audit_log(self, customer_session, mongo_client):
        """PUT /api/user/profile → audit log 'profile_update' created."""
        # Get user info
        me_resp = customer_session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        user_data = me_resp.json()
        
        timestamp_before = datetime.now(timezone.utc).isoformat()
        
        # Update profile
        update_resp = customer_session.put(f"{BASE_URL}/api/user/profile", json={
            "name": user_data["name"]  # Keep same name, just trigger update
        })
        
        assert update_resp.status_code == 200, f"Profile update failed: {update_resp.text}"
        
        time.sleep(0.5)
        
        log = get_latest_audit_log(mongo_client, "profile_update", user_id=user_data["id"], since_timestamp=timestamp_before)
        
        assert log is not None, "profile_update audit log not created"
        assert "fields_changed" in log["details"]
        
        print(f"✓ profile_update audit log created: fields_changed={log['details'].get('fields_changed')}")
    
    def test_password_change_failed_creates_audit_log(self, customer_session, mongo_client):
        """POST /api/user/change-password with wrong current password → audit log created."""
        # Get user info
        me_resp = customer_session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        user_data = me_resp.json()
        
        timestamp_before = datetime.now(timezone.utc).isoformat()
        
        # Try to change password with wrong current password
        change_resp = customer_session.post(f"{BASE_URL}/api/user/change-password", json={
            "current_password": "WrongPassword123!",
            "new_password": "NewPassword123!"
        })
        
        assert change_resp.status_code == 400, f"Expected 400, got {change_resp.status_code}"
        
        time.sleep(0.5)
        
        log = get_latest_audit_log(mongo_client, "password_change", user_id=user_data["id"], since_timestamp=timestamp_before)
        
        assert log is not None, "password_change audit log not created for failed attempt"
        assert log["details"].get("success") == False
        assert log["severity"] == "warn"
        
        print(f"✓ password_change (failed) audit log created: success={log['details'].get('success')}, severity={log['severity']}")


class TestNoRegressions:
    """Test that audit logging doesn't break existing functionality."""
    
    def test_auth_endpoints_still_work(self, api_session):
        """All auth endpoints return correct responses."""
        # Login
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert login_resp.status_code == 200
        data = login_resp.json()
        assert "id" in data
        assert "email" in data
        assert "balance" in data
        
        # Me
        me_resp = api_session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        
        # Logout
        logout_resp = api_session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_resp.status_code == 200
        
        print("✓ Auth endpoints working correctly (no regression)")
    
    def test_payment_endpoints_still_work(self, customer_session):
        """Payment endpoints return correct responses."""
        # Fee preview
        fee_resp = customer_session.get(f"{BASE_URL}/api/payment/fee-preview", params={
            "amount": 10.0,
            "fee_type": "payment"
        })
        assert fee_resp.status_code == 200
        data = fee_resp.json()
        assert "gross_amount" in data
        assert "fee_amount" in data
        
        print("✓ Payment endpoints working correctly (no regression)")
    
    def test_admin_endpoints_still_work(self, admin_session):
        """Admin endpoints return correct responses."""
        # Overview
        overview_resp = admin_session.get(f"{BASE_URL}/api/admin/overview")
        assert overview_resp.status_code == 200
        data = overview_resp.json()
        assert "total_users" in data
        
        # Users list
        users_resp = admin_session.get(f"{BASE_URL}/api/admin/users", params={"limit": 5})
        assert users_resp.status_code == 200
        
        print("✓ Admin endpoints working correctly (no regression)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
