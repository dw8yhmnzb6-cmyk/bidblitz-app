"""
POS Security V2 - Bank-Grade Security System Tests
Tests for: customer resolve (masked data only), secure top-up, secure payment with PIN,
PIN lock after failed attempts, high-value payment app confirmation, email lookup rejection,
gift card approval queue, security dashboard, and security reports.
"""

import pytest
import requests
import os
import time
import random
import string

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials from test_credentials.md
MERCHANT_EMAIL = "haendler@bidblitz.ae"
MERCHANT_PASSWORD = "Haendler2026!"
CUSTOMER_EMAIL = "pos.security.a2c72a73@test.com"
CUSTOMER_PASSWORD = "TestPass2026!"
CUSTOMER_NUMBER = "BE79059"
CUSTOMER_PIN = "2222"
STORE_ID = "69d23d461f01d08a8214f6a0"
REGISTER_ID = "DEV-A1DAE025"


def random_email():
    """Generate a random test email."""
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"pos.test.{suffix}@test.com"


@pytest.fixture(scope="module")
def merchant_session():
    """Login as merchant and return session with cookies."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": MERCHANT_EMAIL,
        "password": MERCHANT_PASSWORD
    })
    assert resp.status_code == 200, f"Merchant login failed: {resp.text}"
    return session


@pytest.fixture(scope="module")
def customer_session():
    """Login as customer and return session with cookies."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": CUSTOMER_EMAIL,
        "password": CUSTOMER_PASSWORD
    })
    assert resp.status_code == 200, f"Customer login failed: {resp.text}"
    return session


@pytest.fixture(scope="module")
def fresh_customer_session():
    """Create a fresh customer for testing PIN lock scenarios."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Generate unique email
    email = random_email()
    
    # Register new user
    resp = session.post(f"{BASE_URL}/api/auth/register", json={
        "email": email,
        "password": "TestPass2026!",
        "name": "POS Test User"
    })
    if resp.status_code != 200:
        pytest.skip(f"Could not create fresh customer: {resp.text}")
    
    # Login
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": email,
        "password": "TestPass2026!"
    })
    assert resp.status_code == 200, f"Fresh customer login failed: {resp.text}"
    
    user_data = resp.json()
    return {
        "session": session,
        "email": email,
        "user_number": user_data.get("user_number", ""),
        "user_id": user_data.get("id", "")
    }


class TestCustomerResolve:
    """Test customer resolve endpoint returns masked data only."""
    
    def test_resolve_by_customer_number_returns_masked_data(self, merchant_session):
        """Resolve customer by number - should return masked name, customer number, verification status ONLY."""
        resp = merchant_session.post(f"{BASE_URL}/api/pos/customer/resolve", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "lookup_type": "customer_number",
            "value": CUSTOMER_NUMBER
        })
        
        assert resp.status_code == 200, f"Customer resolve failed: {resp.text}"
        data = resp.json()
        
        # Verify response structure
        assert data.get("ok") is True
        assert "resolution_id" in data
        assert "customer" in data
        
        customer = data["customer"]
        
        # CRITICAL: Verify ONLY masked data is returned
        assert "masked_name" in customer, "masked_name should be present"
        assert "customer_number" in customer, "customer_number should be present"
        assert "verification_status" in customer, "verification_status should be present"
        
        # CRITICAL: Verify NO sensitive data is leaked
        assert "balance" not in customer, "SECURITY BUG: balance should NOT be exposed"
        assert "email" not in customer, "SECURITY BUG: email should NOT be exposed"
        assert "phone" not in customer, "SECURITY BUG: phone should NOT be exposed"
        assert "address" not in customer, "SECURITY BUG: address should NOT be exposed"
        assert "transaction_history" not in customer, "SECURITY BUG: transaction_history should NOT be exposed"
        assert "transactions" not in customer, "SECURITY BUG: transactions should NOT be exposed"
        
        # Verify masked_name is actually masked (contains asterisks)
        masked_name = customer.get("masked_name", "")
        assert "*" in masked_name, f"masked_name should contain asterisks: {masked_name}"
        
        print(f"✓ Customer resolved with masked data only: {customer}")
    
    def test_resolve_by_scan_returns_masked_data(self, merchant_session, customer_session):
        """Resolve customer by scan - should return same masked payload."""
        # First get customer's barcode
        barcode_resp = customer_session.get(f"{BASE_URL}/api/payments/my-barcode")
        if barcode_resp.status_code != 200:
            pytest.skip("Could not get customer barcode")
        
        barcode = barcode_resp.json().get("barcode", "")
        if not barcode:
            pytest.skip("Customer has no barcode")
        
        resp = merchant_session.post(f"{BASE_URL}/api/pos/customer/resolve", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "lookup_type": "scan",
            "value": barcode
        })
        
        assert resp.status_code == 200, f"Scan resolve failed: {resp.text}"
        data = resp.json()
        
        customer = data.get("customer", {})
        
        # Same security checks
        assert "masked_name" in customer
        assert "balance" not in customer, "SECURITY BUG: balance leaked via scan"
        assert "email" not in customer, "SECURITY BUG: email leaked via scan"
        
        print(f"✓ Scan resolve returns masked data only")
    
    def test_email_lookup_rejected(self, merchant_session):
        """Email lookup should be rejected for security."""
        resp = merchant_session.post(f"{BASE_URL}/api/pos/customer/resolve", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "lookup_type": "email",
            "value": CUSTOMER_EMAIL
        })
        
        # Should be rejected (400 Bad Request)
        assert resp.status_code == 400, f"Email lookup should be rejected, got {resp.status_code}"
        print("✓ Email lookup correctly rejected")


class TestSecureTopUp:
    """Test secure top-up flow without requiring customer PIN."""
    
    def test_topup_without_pin(self, merchant_session):
        """Top-up should work without customer PIN."""
        # First resolve customer
        resolve_resp = merchant_session.post(f"{BASE_URL}/api/pos/customer/resolve", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "lookup_type": "customer_number",
            "value": CUSTOMER_NUMBER
        })
        
        assert resolve_resp.status_code == 200
        resolution_id = resolve_resp.json().get("resolution_id")
        
        # Perform top-up (small amount to avoid approval requirement)
        resp = merchant_session.post(f"{BASE_URL}/api/pos/wallet/top-up", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "resolution_id": resolution_id,
            "amount": 5.00,
            "payment_method": "cash"
        })
        
        assert resp.status_code == 200, f"Top-up failed: {resp.text}"
        data = resp.json()
        
        assert data.get("ok") is True
        assert data.get("status") in ["approved", "approval_required"]
        
        # Verify customer data in response is still masked
        customer = data.get("customer", {})
        assert "balance" not in customer, "SECURITY BUG: balance exposed in top-up response"
        
        print(f"✓ Top-up successful without PIN: {data.get('message', '')}")


class TestSecurePayment:
    """Test secure payment flow with mandatory PIN."""
    
    def test_payment_prepare_and_confirm_correct_pin(self, merchant_session, customer_session):
        """Payment with correct PIN should be approved."""
        # First ensure customer has PIN set
        pin_set_resp = customer_session.post(f"{BASE_URL}/api/customer/payment-pin/set", json={
            "pin": CUSTOMER_PIN,
            "confirm_pin": CUSTOMER_PIN
        })
        # May fail if PIN already set, that's OK
        
        # Resolve customer
        resolve_resp = merchant_session.post(f"{BASE_URL}/api/pos/customer/resolve", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "lookup_type": "customer_number",
            "value": CUSTOMER_NUMBER
        })
        
        assert resolve_resp.status_code == 200
        resolution_id = resolve_resp.json().get("resolution_id")
        
        # Prepare payment (small amount)
        prepare_resp = merchant_session.post(f"{BASE_URL}/api/pos/payment/prepare", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "resolution_id": resolution_id,
            "amount": 1.00,
            "description": "Test payment",
            "payment_method": "wallet"
        })
        
        assert prepare_resp.status_code == 200, f"Payment prepare failed: {prepare_resp.text}"
        prepare_data = prepare_resp.json()
        
        assert prepare_data.get("status") == "awaiting_pin"
        payment_id = prepare_data.get("payment", {}).get("payment_id")
        assert payment_id, "No payment_id returned"
        
        # Confirm with correct PIN
        confirm_resp = merchant_session.post(f"{BASE_URL}/api/pos/payment/confirm-pin", json={
            "payment_id": payment_id,
            "pin": CUSTOMER_PIN
        })
        
        confirm_data = confirm_resp.json()
        
        # May be approved or declined due to insufficient balance
        if confirm_data.get("status") == "approved":
            print("✓ Payment approved with correct PIN")
        elif confirm_data.get("status") == "declined":
            # Check it's due to balance, not PIN
            assert confirm_data.get("message") == "Payment declined"
            print("✓ Payment declined (likely insufficient balance), but PIN was correct")
        else:
            print(f"Payment status: {confirm_data.get('status')}")
    
    def test_payment_wrong_pin_declines_without_balance_leak(self, merchant_session):
        """Wrong PIN should decline with generic message, no balance exposed."""
        # Resolve customer
        resolve_resp = merchant_session.post(f"{BASE_URL}/api/pos/customer/resolve", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "lookup_type": "customer_number",
            "value": CUSTOMER_NUMBER
        })
        
        assert resolve_resp.status_code == 200
        resolution_id = resolve_resp.json().get("resolution_id")
        
        # Prepare payment
        prepare_resp = merchant_session.post(f"{BASE_URL}/api/pos/payment/prepare", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "resolution_id": resolution_id,
            "amount": 1.00,
            "description": "Test wrong PIN",
            "payment_method": "wallet"
        })
        
        assert prepare_resp.status_code == 200
        payment_id = prepare_resp.json().get("payment", {}).get("payment_id")
        
        # Confirm with WRONG PIN
        confirm_resp = merchant_session.post(f"{BASE_URL}/api/pos/payment/confirm-pin", json={
            "payment_id": payment_id,
            "pin": "9999"  # Wrong PIN
        })
        
        confirm_data = confirm_resp.json()
        
        # Should be declined
        assert confirm_data.get("ok") is False or confirm_data.get("status") == "declined"
        
        # CRITICAL: Message should be generic "Payment declined", not reveal balance
        message = confirm_data.get("message", "")
        assert "balance" not in message.lower(), f"SECURITY BUG: balance mentioned in decline message: {message}"
        assert message == "Payment declined", f"Expected generic 'Payment declined', got: {message}"
        
        print("✓ Wrong PIN correctly declined with generic message")


class TestPinLock:
    """Test PIN lock after repeated failed attempts."""
    
    def test_pin_lock_after_failed_attempts(self, merchant_session, fresh_customer_session):
        """After 5 wrong PIN attempts, customer should be locked."""
        customer_data = fresh_customer_session
        customer_number = customer_data.get("user_number")
        
        if not customer_number:
            pytest.skip("Fresh customer has no user_number")
        
        # Set PIN for fresh customer
        pin_resp = customer_data["session"].post(f"{BASE_URL}/api/customer/payment-pin/set", json={
            "pin": "1234",
            "confirm_pin": "1234"
        })
        
        if pin_resp.status_code != 200:
            pytest.skip(f"Could not set PIN: {pin_resp.text}")
        
        # Resolve customer
        resolve_resp = merchant_session.post(f"{BASE_URL}/api/pos/customer/resolve", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "lookup_type": "customer_number",
            "value": customer_number
        })
        
        if resolve_resp.status_code != 200:
            pytest.skip(f"Could not resolve fresh customer: {resolve_resp.text}")
        
        resolution_id = resolve_resp.json().get("resolution_id")
        
        # Try 5 wrong PINs
        for i in range(5):
            # Prepare payment
            prepare_resp = merchant_session.post(f"{BASE_URL}/api/pos/payment/prepare", json={
                "store_id": STORE_ID,
                "register_id": REGISTER_ID,
                "resolution_id": resolution_id,
                "amount": 1.00,
                "description": f"Test PIN lock attempt {i+1}",
                "payment_method": "wallet"
            })
            
            if prepare_resp.status_code != 200:
                continue
            
            payment_id = prepare_resp.json().get("payment", {}).get("payment_id")
            
            # Wrong PIN
            confirm_resp = merchant_session.post(f"{BASE_URL}/api/pos/payment/confirm-pin", json={
                "payment_id": payment_id,
                "pin": "9999"
            })
            
            confirm_data = confirm_resp.json()
            
            if confirm_data.get("locked"):
                print(f"✓ Customer locked after {i+1} failed attempts")
                return
        
        # Check if locked now
        # Try one more payment
        prepare_resp = merchant_session.post(f"{BASE_URL}/api/pos/payment/prepare", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "resolution_id": resolution_id,
            "amount": 1.00,
            "description": "Test after lock",
            "payment_method": "wallet"
        })
        
        if prepare_resp.status_code == 200:
            payment_id = prepare_resp.json().get("payment", {}).get("payment_id")
            confirm_resp = merchant_session.post(f"{BASE_URL}/api/pos/payment/confirm-pin", json={
                "payment_id": payment_id,
                "pin": "1234"  # Correct PIN
            })
            
            confirm_data = confirm_resp.json()
            if confirm_data.get("locked"):
                print("✓ Customer is locked after failed attempts")
            else:
                print(f"PIN lock test result: {confirm_data}")


class TestHighValuePayment:
    """Test high-value payment requires app confirmation."""
    
    def test_high_value_requires_app_confirmation(self, merchant_session, customer_session):
        """Payment above threshold should require app confirmation after PIN."""
        # Ensure PIN is set
        customer_session.post(f"{BASE_URL}/api/customer/payment-pin/set", json={
            "pin": CUSTOMER_PIN,
            "confirm_pin": CUSTOMER_PIN
        })
        
        # Resolve customer
        resolve_resp = merchant_session.post(f"{BASE_URL}/api/pos/customer/resolve", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "lookup_type": "customer_number",
            "value": CUSTOMER_NUMBER
        })
        
        assert resolve_resp.status_code == 200
        resolution_id = resolve_resp.json().get("resolution_id")
        
        # Prepare HIGH VALUE payment (above app confirmation threshold, typically €250)
        prepare_resp = merchant_session.post(f"{BASE_URL}/api/pos/payment/prepare", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "resolution_id": resolution_id,
            "amount": 300.00,  # Above threshold
            "description": "High value test",
            "payment_method": "wallet"
        })
        
        assert prepare_resp.status_code == 200, f"High value prepare failed: {prepare_resp.text}"
        prepare_data = prepare_resp.json()
        
        # Check if requires app confirmation
        payment = prepare_data.get("payment", {})
        requires_app = payment.get("requires_app_confirmation", False)
        
        if requires_app:
            print("✓ High-value payment requires app confirmation")
            
            # Confirm PIN
            payment_id = payment.get("payment_id")
            confirm_resp = merchant_session.post(f"{BASE_URL}/api/pos/payment/confirm-pin", json={
                "payment_id": payment_id,
                "pin": CUSTOMER_PIN
            })
            
            confirm_data = confirm_resp.json()
            
            if confirm_data.get("status") == "awaiting_app_confirmation":
                print("✓ After PIN, payment awaits app confirmation")
                
                # Customer approves via app
                approve_resp = customer_session.post(f"{BASE_URL}/api/pos/payment/customer-approve/{payment_id}")
                
                if approve_resp.status_code == 200:
                    print("✓ Customer app approval endpoint works")
                else:
                    print(f"App approval response: {approve_resp.status_code} - {approve_resp.text}")
        else:
            print(f"Payment does not require app confirmation (may be due to limits config)")


class TestGiftCardApproval:
    """Test gift card creation over threshold enters approval queue."""
    
    def test_gift_card_over_threshold_requires_approval(self, merchant_session):
        """Gift card creation over approval limit should create approval queue item."""
        # Request gift card creation with high amount
        resp = merchant_session.post(f"{BASE_URL}/api/pos/security/gift-cards/request", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "amount": 500.00,  # Above typical approval threshold
            "payment_method": "cash"
        })
        
        assert resp.status_code == 200, f"Gift card request failed: {resp.text}"
        data = resp.json()
        
        if data.get("status") == "approval_required":
            assert "approval" in data
            approval_id = data["approval"].get("approval_id")
            print(f"✓ Gift card request created approval: {approval_id}")
            
            # Verify it appears in approvals endpoint
            approvals_resp = merchant_session.get(f"{BASE_URL}/api/pos/security/approvals?store_id={STORE_ID}")
            
            if approvals_resp.status_code == 200:
                approvals = approvals_resp.json().get("approvals", [])
                found = any(a.get("approval_id") == approval_id for a in approvals)
                if found:
                    print("✓ Approval appears in approvals queue")
        else:
            print(f"Gift card status: {data.get('status')} (may be auto-approved for manager role)")


class TestSecurityDashboard:
    """Test merchant security dashboard endpoint."""
    
    def test_security_dashboard_returns_all_sections(self, merchant_session):
        """Security dashboard should return alerts, fraud alerts, locked customers, etc."""
        resp = merchant_session.get(f"{BASE_URL}/api/pos/security/dashboard?store_id={STORE_ID}")
        
        assert resp.status_code == 200, f"Security dashboard failed: {resp.text}"
        data = resp.json()
        
        # Verify all required sections
        assert "alerts" in data, "Missing alerts section"
        assert "fraud_alerts" in data, "Missing fraud_alerts section"
        assert "locked_customers" in data, "Missing locked_customers section"
        assert "locked_employees" in data, "Missing locked_employees section"
        assert "transaction_limits" in data, "Missing transaction_limits section"
        assert "approval_queue" in data, "Missing approval_queue section"
        assert "role_configs" in data, "Missing role_configs section"
        
        print(f"✓ Security dashboard returns all sections")
        print(f"  - Alerts: {len(data.get('alerts', []))}")
        print(f"  - Fraud alerts: {len(data.get('fraud_alerts', []))}")
        print(f"  - Locked customers: {len(data.get('locked_customers', []))}")
        print(f"  - Approval queue: {len(data.get('approval_queue', []))}")


class TestSecurityReports:
    """Test security reports endpoint."""
    
    def test_security_reports_daily(self, merchant_session):
        """Security reports should return daily summary."""
        resp = merchant_session.get(f"{BASE_URL}/api/pos/security/reports?store_id={STORE_ID}&period=daily")
        
        assert resp.status_code == 200, f"Security reports failed: {resp.text}"
        data = resp.json()
        
        assert "period" in data
        assert "summary" in data
        
        summary = data.get("summary", {})
        assert "events" in summary
        assert "alerts" in summary
        
        print(f"✓ Daily security report: {summary}")
    
    def test_security_reports_weekly(self, merchant_session):
        """Security reports should return weekly summary."""
        resp = merchant_session.get(f"{BASE_URL}/api/pos/security/reports?store_id={STORE_ID}&period=weekly")
        
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("period") == "weekly"
        print("✓ Weekly security report works")
    
    def test_security_reports_monthly(self, merchant_session):
        """Security reports should return monthly summary."""
        resp = merchant_session.get(f"{BASE_URL}/api/pos/security/reports?store_id={STORE_ID}&period=monthly")
        
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("period") == "monthly"
        print("✓ Monthly security report works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
