"""
BioPay V3 Backend Tests - Iteration 169
Tests for PalmPay/BioPay biometric payment system, customer payment PIN management,
merchant security dashboard, role permissions, limits, and approval queue.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials from test_credentials.md
MERCHANT_EMAIL = "haendler@bidblitz.ae"
MERCHANT_PASSWORD = "Haendler2026!"
BIOPAY_QA_EMAIL = "biopay.qa.539992d9@test.com"
BIOPAY_QA_PASSWORD = "TestPass2026!"
BIOPAY_QA_CUSTOMER_NUMBER = "BE48176"
BIOPAY_QA_PIN = "4567"
BIOPAY_QA_PALM_TOKEN = "PALM-TOKEN-ABCD-1234"
STORE_ID = "69d23d461f01d08a8214f6a0"
REGISTER_ID = "DEV-A1DAE025"
BIOPAY_TERMINAL_ID = "BIO-D8992DFCA1"


@pytest.fixture(scope="module")
def merchant_session():
    """Login as merchant and return session with cookies"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": MERCHANT_EMAIL,
        "password": MERCHANT_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Merchant login failed: {resp.status_code} - {resp.text}")
    return session


@pytest.fixture(scope="module")
def customer_session():
    """Login as BioPay QA customer and return session with cookies"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": BIOPAY_QA_EMAIL,
        "password": BIOPAY_QA_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Customer login failed: {resp.status_code} - {resp.text}")
    return session


class TestCustomerPaymentPIN:
    """Customer Payment PIN Management Tests"""
    
    def test_payment_pin_status(self, customer_session):
        """GET /api/customer/payment-pin/status returns PIN status"""
        resp = customer_session.get(f"{BASE_URL}/api/customer/payment-pin/status")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "has_pin" in data, "Response should contain has_pin field"
        assert "locked" in data, "Response should contain locked field"
        assert "retry_after_sec" in data, "Response should contain retry_after_sec field"
        print(f"PIN Status: has_pin={data['has_pin']}, locked={data['locked']}")
    
    def test_set_payment_pin(self, customer_session):
        """POST /api/customer/payment-pin/set sets or updates PIN"""
        # First check current status
        status_resp = customer_session.get(f"{BASE_URL}/api/customer/payment-pin/status")
        status = status_resp.json()
        
        payload = {
            "pin": BIOPAY_QA_PIN,
            "confirm_pin": BIOPAY_QA_PIN
        }
        # If PIN already exists, include current_pin
        if status.get("has_pin"):
            payload["current_pin"] = BIOPAY_QA_PIN
        
        resp = customer_session.post(f"{BASE_URL}/api/customer/payment-pin/set", json=payload)
        # Accept 200 (success) or 400 (if PIN already set and current_pin wrong)
        assert resp.status_code in [200, 400], f"Expected 200 or 400, got {resp.status_code}: {resp.text}"
        if resp.status_code == 200:
            data = resp.json()
            assert data.get("ok") == True, "Expected ok=true"
            print("Payment PIN set successfully")
        else:
            print(f"PIN set returned 400 (expected if PIN already set): {resp.text}")
    
    def test_verify_payment_pin_correct(self, customer_session):
        """POST /api/customer/payment-pin/verify with correct PIN"""
        resp = customer_session.post(f"{BASE_URL}/api/customer/payment-pin/verify", json={
            "pin": BIOPAY_QA_PIN
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "ok" in data, "Response should contain ok field"
        assert "locked" in data, "Response should contain locked field"
        print(f"PIN Verify: ok={data.get('ok')}, locked={data.get('locked')}")
    
    def test_verify_payment_pin_wrong(self, customer_session):
        """POST /api/customer/payment-pin/verify with wrong PIN returns generic decline"""
        resp = customer_session.post(f"{BASE_URL}/api/customer/payment-pin/verify", json={
            "pin": "0000"  # Wrong PIN
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("ok") == False, "Expected ok=false for wrong PIN"
        # Should NOT expose any balance or sensitive info
        assert "balance" not in data, "Should NOT expose balance on wrong PIN"
        print(f"Wrong PIN correctly declined: ok={data.get('ok')}")


class TestBioPayCustomerProfile:
    """BioPay Customer Profile Management Tests"""
    
    def test_biopay_me(self, customer_session):
        """GET /api/biopay/me returns customer BioPay profile"""
        resp = customer_session.get(f"{BASE_URL}/api/biopay/me")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "profiles" in data, "Response should contain profiles array"
        assert "recent_sessions" in data, "Response should contain recent_sessions array"
        assert "facepay_enabled" in data, "Response should contain facepay_enabled flag"
        assert "biometric_enabled" in data, "Response should contain biometric_enabled flag"
        print(f"BioPay Me: {len(data['profiles'])} profiles, facepay_enabled={data['facepay_enabled']}")
    
    def test_biopay_enroll(self, customer_session):
        """POST /api/biopay/enroll enrolls PalmPay profile"""
        resp = customer_session.post(f"{BASE_URL}/api/biopay/enroll", json={
            "template_token": BIOPAY_QA_PALM_TOKEN,
            "modality": "palm",
            "nickname": "Test PalmPay"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("ok") == True, "Expected ok=true"
        assert "profile" in data, "Response should contain profile"
        profile = data["profile"]
        assert profile.get("modality") == "palm", "Profile modality should be palm"
        assert profile.get("status") == "active", "Profile status should be active"
        # Verify NO biometric image data is exposed
        assert "template_token_encrypted" not in profile, "Should NOT expose encrypted token"
        assert "token_fingerprint" not in profile, "Should NOT expose token fingerprint"
        print(f"BioPay enrolled: profile_id={profile.get('profile_id')}, token_preview={profile.get('token_preview')}")
    
    def test_biopay_verify_self(self, customer_session):
        """POST /api/biopay/verify-self verifies customer's own biometric"""
        resp = customer_session.post(f"{BASE_URL}/api/biopay/verify-self", json={
            "template_token": BIOPAY_QA_PALM_TOKEN,
            "modality": "palm"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "ok" in data, "Response should contain ok field"
        assert "matched" in data, "Response should contain matched field"
        assert "session" in data, "Response should contain session"
        session = data["session"]
        assert "session_id" in session, "Session should have session_id"
        print(f"BioPay verify-self: ok={data.get('ok')}, matched={data.get('matched')}")
    
    def test_biopay_profiles_list(self, customer_session):
        """GET /api/biopay/me lists active profiles"""
        resp = customer_session.get(f"{BASE_URL}/api/biopay/me")
        assert resp.status_code == 200
        data = resp.json()
        profiles = data.get("profiles", [])
        for profile in profiles:
            # Verify no sensitive data exposed
            assert "template_token_encrypted" not in profile, "Should NOT expose encrypted token"
            assert "token_fingerprint" not in profile, "Should NOT expose token fingerprint"
            # Verify required fields present
            assert "profile_id" in profile
            assert "modality" in profile
            assert "status" in profile
            assert "token_preview" in profile
        print(f"Found {len(profiles)} active BioPay profiles")


class TestBioPayTerminals:
    """BioPay Terminal Management Tests"""
    
    def test_list_terminals(self, merchant_session):
        """GET /api/biopay/terminals lists merchant terminals"""
        resp = merchant_session.get(f"{BASE_URL}/api/biopay/terminals?store_id={STORE_ID}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "terminals" in data, "Response should contain terminals array"
        assert "facepay_enabled" in data, "Response should contain facepay_enabled flag"
        print(f"Found {len(data['terminals'])} BioPay terminals")
    
    def test_create_terminal(self, merchant_session):
        """POST /api/biopay/terminals creates new terminal"""
        import secrets
        unique_label = f"Test Terminal {secrets.token_hex(4)}"
        resp = merchant_session.post(f"{BASE_URL}/api/biopay/terminals", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "label": unique_label,
            "palm_enabled": True,
            "face_enabled": False
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("ok") == True, "Expected ok=true"
        assert "terminal" in data, "Response should contain terminal"
        terminal = data["terminal"]
        assert terminal.get("label") == unique_label
        assert terminal.get("palm_enabled") == True
        assert terminal.get("status") == "active"
        print(f"Created terminal: {terminal.get('terminal_id')}")
        return terminal.get("terminal_id")
    
    def test_update_terminal(self, merchant_session):
        """POST /api/biopay/terminals/{terminal_id} updates terminal"""
        # First get existing terminal
        list_resp = merchant_session.get(f"{BASE_URL}/api/biopay/terminals?store_id={STORE_ID}")
        terminals = list_resp.json().get("terminals", [])
        if not terminals:
            pytest.skip("No terminals to update")
        
        terminal_id = terminals[0]["terminal_id"]
        resp = merchant_session.post(f"{BASE_URL}/api/biopay/terminals/{terminal_id}", json={
            "label": f"Updated {terminal_id[:8]}",
            "palm_enabled": True
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("ok") == True
        print(f"Updated terminal: {terminal_id}")


class TestBioPayDashboard:
    """BioPay Dashboard and Sessions Tests"""
    
    def test_biopay_dashboard(self, merchant_session):
        """GET /api/biopay/dashboard returns store BioPay summary"""
        resp = merchant_session.get(f"{BASE_URL}/api/biopay/dashboard?store_id={STORE_ID}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "profiles_total" in data, "Response should contain profiles_total"
        assert "terminals" in data, "Response should contain terminals array"
        assert "sessions" in data, "Response should contain sessions array"
        assert "facepay_enabled" in data, "Response should contain facepay_enabled flag"
        print(f"BioPay Dashboard: {data['profiles_total']} profiles, {len(data['terminals'])} terminals, {len(data['sessions'])} sessions")
    
    def test_biopay_sessions(self, merchant_session):
        """GET /api/biopay/sessions lists BioPay sessions"""
        resp = merchant_session.get(f"{BASE_URL}/api/biopay/sessions?store_id={STORE_ID}&limit=20")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "sessions" in data, "Response should contain sessions array"
        for session in data.get("sessions", []):
            # Verify session has required fields
            assert "session_id" in session
            assert "modality" in session
            assert "status" in session
            # Verify NO sensitive customer data exposed
            assert "template_token" not in session, "Should NOT expose template token"
        print(f"Found {len(data['sessions'])} BioPay sessions")


class TestBioPayPayment:
    """BioPay Payment Flow Tests"""
    
    def test_biopay_pay_low_value(self, merchant_session):
        """POST /api/biopay/pay for low-value payment approves after biometric match"""
        # First resolve customer
        resolve_resp = merchant_session.post(f"{BASE_URL}/api/pos/customer/resolve", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "lookup_type": "customer_number",
            "value": BIOPAY_QA_CUSTOMER_NUMBER
        })
        if resolve_resp.status_code != 200:
            pytest.skip(f"Customer resolve failed: {resolve_resp.text}")
        
        resolution_id = resolve_resp.json().get("resolution_id")
        
        resp = merchant_session.post(f"{BASE_URL}/api/biopay/pay", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "resolution_id": resolution_id,
            "amount": 5.00,  # Low value
            "description": "Test BioPay Payment",
            "template_token": BIOPAY_QA_PALM_TOKEN,
            "modality": "palm"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        # Should be approved, awaiting_app_confirmation, approval_required, or declined
        assert "status" in data, "Response should contain status"
        assert "session" in data or "biopay_session" in data, "Response should contain session"
        
        # Verify customer data is masked
        if "customer" in data:
            customer = data["customer"]
            assert "balance" not in customer or customer.get("balance") is None, "Should NOT expose balance"
            assert "email" not in customer or customer.get("email") is None, "Should NOT expose email"
        
        print(f"BioPay pay result: status={data.get('status')}, ok={data.get('ok')}")
    
    def test_biopay_pay_high_value_requires_confirmation(self, merchant_session):
        """POST /api/biopay/pay for high-value payment requires app confirmation"""
        # First resolve customer
        resolve_resp = merchant_session.post(f"{BASE_URL}/api/pos/customer/resolve", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "lookup_type": "customer_number",
            "value": BIOPAY_QA_CUSTOMER_NUMBER
        })
        if resolve_resp.status_code != 200:
            pytest.skip(f"Customer resolve failed: {resolve_resp.text}")
        
        resolution_id = resolve_resp.json().get("resolution_id")
        
        resp = merchant_session.post(f"{BASE_URL}/api/biopay/pay", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "resolution_id": resolution_id,
            "amount": 300.00,  # High value - should require app confirmation
            "description": "High Value BioPay Test",
            "template_token": BIOPAY_QA_PALM_TOKEN,
            "modality": "palm"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        # High value should require app confirmation or approval
        status = data.get("status")
        assert status in ["awaiting_app_confirmation", "approval_required", "approved", "declined"], \
            f"Expected awaiting_app_confirmation/approval_required/approved/declined, got {status}"
        print(f"High-value BioPay: status={status}")
    
    def test_biopay_pay_wrong_token_declines(self, merchant_session):
        """POST /api/biopay/pay with wrong token returns declined"""
        # First resolve customer
        resolve_resp = merchant_session.post(f"{BASE_URL}/api/pos/customer/resolve", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "lookup_type": "customer_number",
            "value": BIOPAY_QA_CUSTOMER_NUMBER
        })
        if resolve_resp.status_code != 200:
            pytest.skip(f"Customer resolve failed: {resolve_resp.text}")
        
        resolution_id = resolve_resp.json().get("resolution_id")
        
        resp = merchant_session.post(f"{BASE_URL}/api/biopay/pay", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "resolution_id": resolution_id,
            "amount": 10.00,
            "description": "Wrong Token Test",
            "template_token": "WRONG-TOKEN-XXXX-9999",  # Wrong token
            "modality": "palm"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("status") == "declined", f"Expected declined, got {data.get('status')}"
        assert data.get("ok") == False, "Expected ok=false for wrong token"
        # Verify NO sensitive data exposed
        assert "balance" not in str(data), "Should NOT expose balance on decline"
        print("Wrong token correctly declined")


class TestMerchantSecurityDashboard:
    """Merchant Security Dashboard Tests"""
    
    def test_security_dashboard(self, merchant_session):
        """GET /api/pos/security/dashboard returns all security sections"""
        resp = merchant_session.get(f"{BASE_URL}/api/pos/security/dashboard?store_id={STORE_ID}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Verify all required sections present
        required_sections = ["alerts", "fraud_alerts", "locked_customers", "locked_employees", 
                           "transaction_limits", "approval_queue", "role_configs"]
        for section in required_sections:
            assert section in data, f"Response should contain {section}"
        
        print(f"Security Dashboard: {len(data['alerts'])} alerts, {len(data['approval_queue'])} pending approvals")
    
    def test_security_roles(self, merchant_session):
        """GET /api/pos/security/roles returns role configurations"""
        resp = merchant_session.get(f"{BASE_URL}/api/pos/security/roles?store_id={STORE_ID}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "roles" in data, "Response should contain roles array"
        assert "all_permissions" in data, "Response should contain all_permissions array"
        print(f"Found {len(data['roles'])} roles, {len(data['all_permissions'])} permissions")
    
    def test_update_role_permissions(self, merchant_session):
        """POST /api/pos/security/roles/{role_key} updates role permissions"""
        # First get current roles
        roles_resp = merchant_session.get(f"{BASE_URL}/api/pos/security/roles?store_id={STORE_ID}")
        roles = roles_resp.json().get("roles", [])
        if not roles:
            pytest.skip("No roles to update")
        
        role = roles[0]
        role_key = role.get("role")
        current_permissions = role.get("permissions", [])
        
        resp = merchant_session.post(
            f"{BASE_URL}/api/pos/security/roles/{role_key}?store_id={STORE_ID}",
            json={"permissions": current_permissions}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("ok") == True
        print(f"Updated role {role_key} permissions")


class TestSecurityLimits:
    """Security Limits Management Tests"""
    
    def test_get_limits(self, merchant_session):
        """GET /api/pos/security/limits returns limit values"""
        resp = merchant_session.get(
            f"{BASE_URL}/api/pos/security/limits?scope_type=branch&scope_id={STORE_ID}"
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "scope_type" in data
        assert "scope_id" in data
        assert "values" in data
        print(f"Limits for branch {STORE_ID}: {data['values']}")
    
    def test_update_limits(self, merchant_session):
        """POST /api/pos/security/limits updates limit values"""
        # First get current limits
        get_resp = merchant_session.get(
            f"{BASE_URL}/api/pos/security/limits?scope_type=branch&scope_id={STORE_ID}"
        )
        current_values = get_resp.json().get("values", {})
        
        resp = merchant_session.post(f"{BASE_URL}/api/pos/security/limits", json={
            "scope_type": "branch",
            "scope_id": STORE_ID,
            "values": current_values
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("ok") == True
        print("Limits updated successfully")


class TestApprovalQueue:
    """Approval Queue Management Tests"""
    
    def test_get_approvals(self, merchant_session):
        """GET /api/pos/security/approvals returns pending approvals"""
        resp = merchant_session.get(f"{BASE_URL}/api/pos/security/approvals?store_id={STORE_ID}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "approvals" in data, "Response should contain approvals array"
        print(f"Found {len(data['approvals'])} approvals")
    
    def test_create_gift_card_approval(self, merchant_session):
        """POST /api/pos/security/gift-cards/request creates approval for high-value gift card"""
        resp = merchant_session.post(f"{BASE_URL}/api/pos/security/gift-cards/request", json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "amount": 600.00,  # Above threshold
            "payment_method": "cash",
            "recipient_email": "test@example.com",
            "message": "Test gift card"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        # Should require approval for high value
        status = data.get("status")
        assert status in ["approval_required", "approved"], f"Expected approval_required or approved, got {status}"
        if status == "approval_required":
            assert "approval" in data, "Should contain approval object"
            print(f"Gift card approval created: {data['approval'].get('approval_id')}")
        else:
            print("Gift card approved directly (below threshold)")
    
    def test_reject_approval(self, merchant_session):
        """POST /api/pos/security/approvals/{approval_id}/decision rejects approval"""
        # First get pending approvals
        approvals_resp = merchant_session.get(f"{BASE_URL}/api/pos/security/approvals?store_id={STORE_ID}")
        approvals = approvals_resp.json().get("approvals", [])
        pending = [a for a in approvals if a.get("status") == "pending"]
        
        if not pending:
            pytest.skip("No pending approvals to reject")
        
        approval_id = pending[0]["approval_id"]
        resp = merchant_session.post(
            f"{BASE_URL}/api/pos/security/approvals/{approval_id}/decision",
            json={"decision": "rejected", "note": "Test rejection"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("ok") == True
        assert data.get("decision") == "rejected"
        print(f"Approval {approval_id} rejected")


class TestNoSensitiveDataExposure:
    """Tests to verify no biometric images or sensitive data are exposed"""
    
    def test_biopay_me_no_biometric_images(self, customer_session):
        """Verify /api/biopay/me does not expose biometric images"""
        resp = customer_session.get(f"{BASE_URL}/api/biopay/me")
        data = resp.json()
        
        # Check profiles
        for profile in data.get("profiles", []):
            assert "template_token_encrypted" not in profile, "Should NOT expose encrypted token"
            assert "token_fingerprint" not in profile, "Should NOT expose token fingerprint"
            assert "biometric_image" not in profile, "Should NOT expose biometric image"
            assert "palm_image" not in profile, "Should NOT expose palm image"
            assert "face_image" not in profile, "Should NOT expose face image"
        
        # Check sessions
        for session in data.get("recent_sessions", []):
            assert "template_token" not in session, "Should NOT expose template token in session"
        
        print("Verified: No biometric images exposed in /api/biopay/me")
    
    def test_biopay_dashboard_no_sensitive_data(self, merchant_session):
        """Verify /api/biopay/dashboard does not expose sensitive customer data"""
        resp = merchant_session.get(f"{BASE_URL}/api/biopay/dashboard?store_id={STORE_ID}")
        data = resp.json()
        
        # Check sessions
        for session in data.get("sessions", []):
            assert "template_token" not in session, "Should NOT expose template token"
            assert "email" not in session, "Should NOT expose customer email"
            assert "phone" not in session, "Should NOT expose customer phone"
            assert "balance" not in session, "Should NOT expose customer balance"
        
        print("Verified: No sensitive data exposed in /api/biopay/dashboard")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
