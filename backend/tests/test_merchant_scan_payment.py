"""
BidBlitz V2 - Merchant Barcode Scan Payment Tests
Tests for POST /api/payment/merchant-scan endpoint and related flows.
Covers: valid payment, idempotency, invalid barcode, insufficient balance, compliance limits, audit logs.
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CUSTOMER_EMAIL = "kunde@bidblitz.com"
CUSTOMER_PASSWORD = "Kunde2026!"
CUSTOMER_BARCODE = "BLZ-2C2BCAA9DB69"

MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PASSWORD = "Haendler2026!"

ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

# Fee rate (2.5%)
FEE_RATE = 0.025


# ── Module-level sessions to avoid rate limiting ──
_customer_session = None
_merchant_session = None
_admin_session = None


def get_customer_session():
    global _customer_session
    if _customer_session is None:
        _customer_session = requests.Session()
        response = _customer_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code != 200:
            raise Exception(f"Customer login failed: {response.text}")
    return _customer_session


def get_merchant_session():
    global _merchant_session
    if _merchant_session is None:
        _merchant_session = requests.Session()
        response = _merchant_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": MERCHANT_EMAIL,
            "password": MERCHANT_PASSWORD
        })
        if response.status_code != 200:
            raise Exception(f"Merchant login failed: {response.text}")
    return _merchant_session


def get_admin_session():
    global _admin_session
    if _admin_session is None:
        _admin_session = requests.Session()
        response = _admin_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            raise Exception(f"Admin login failed: {response.text}")
    return _admin_session


class TestMerchantScanPaymentSetup:
    """Setup and helper tests"""
    
    def test_customer_login(self):
        """Verify customer can login"""
        session = get_customer_session()
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == CUSTOMER_EMAIL
        print(f"✓ Customer logged in: {data['name']}, Balance: EUR {data['balance']}")
    
    def test_merchant_login(self):
        """Verify merchant can login"""
        session = get_merchant_session()
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == MERCHANT_EMAIL
        print(f"✓ Merchant logged in: {data['name']}, Balance: EUR {data['balance']}")


class TestMyBarcodeEndpoint:
    """Tests for GET /api/payment/my-barcode"""
    
    def test_get_my_barcode_returns_valid_format(self):
        """GET /api/payment/my-barcode returns barcode in BLZ-[A-F0-9]{12} format"""
        session = get_customer_session()
        response = session.get(f"{BASE_URL}/api/payment/my-barcode")
        assert response.status_code == 200
        data = response.json()
        
        assert "barcode" in data
        assert "user_id" in data
        assert "name" in data
        
        barcode = data["barcode"]
        import re
        assert re.match(r"^BLZ-[A-F0-9]{12}$", barcode), f"Barcode format invalid: {barcode}"
        print(f"✓ Customer barcode: {barcode}")
    
    def test_get_my_barcode_returns_same_barcode(self):
        """GET /api/payment/my-barcode returns same barcode on repeated calls"""
        session = get_customer_session()
        response1 = session.get(f"{BASE_URL}/api/payment/my-barcode")
        response2 = session.get(f"{BASE_URL}/api/payment/my-barcode")
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        assert response1.json()["barcode"] == response2.json()["barcode"]
        print("✓ Barcode is consistent across calls")
    
    def test_get_my_barcode_unauthenticated(self):
        """GET /api/payment/my-barcode without auth returns 401"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/payment/my-barcode")
        assert response.status_code == 401
        print("✓ Unauthenticated request returns 401")


class TestMerchantScanValidPayment:
    """Tests for valid merchant scan payments"""
    
    def test_valid_payment_10_eur(self):
        """POST /api/payment/merchant-scan with EUR 10 → success, balance reduced, merchant credited"""
        merchant_session = get_merchant_session()
        customer_session = get_customer_session()
        
        # Get initial balances
        customer_before = customer_session.get(f"{BASE_URL}/api/auth/me").json()
        merchant_before = merchant_session.get(f"{BASE_URL}/api/merchant/dashboard").json()
        
        initial_customer_balance = customer_before["balance"]
        initial_merchant_earnings = merchant_before["total_earnings"]
        
        print(f"Before: Customer balance={initial_customer_balance}, Merchant earnings={initial_merchant_earnings}")
        
        # Make payment
        amount = 10.0
        idempotency_key = f"test_valid_{uuid.uuid4().hex[:8]}"
        
        response = merchant_session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
            "customer_barcode": CUSTOMER_BARCODE,
            "amount": amount,
            "description": "Test payment EUR 10",
            "idempotency_key": idempotency_key
        })
        
        assert response.status_code == 200, f"Payment failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data["success"] is True
        assert data["amount"] == amount
        assert "reference" in data
        assert data["reference"].startswith("BLZ-")
        
        # Verify fee calculation (2.5%)
        expected_fee = round(amount * FEE_RATE, 2)
        expected_net = round(amount - expected_fee, 2)
        
        assert data["fee"] == expected_fee, f"Fee mismatch: expected {expected_fee}, got {data['fee']}"
        assert data["net_to_merchant"] == expected_net, f"Net mismatch: expected {expected_net}, got {data['net_to_merchant']}"
        
        print(f"✓ Payment successful: ref={data['reference']}, amount={amount}, fee={data['fee']}, net={data['net_to_merchant']}")
        
        # Verify customer balance reduced
        customer_after = customer_session.get(f"{BASE_URL}/api/auth/me").json()
        expected_customer_balance = round(initial_customer_balance - amount, 2)
        assert customer_after["balance"] == expected_customer_balance, \
            f"Customer balance mismatch: expected {expected_customer_balance}, got {customer_after['balance']}"
        
        print(f"✓ Customer balance reduced: {initial_customer_balance} → {customer_after['balance']}")
        
        # Verify merchant earnings increased
        merchant_after = merchant_session.get(f"{BASE_URL}/api/merchant/dashboard").json()
        expected_merchant_earnings = round(initial_merchant_earnings + expected_net, 2)
        assert abs(merchant_after["total_earnings"] - expected_merchant_earnings) < 0.01, \
            f"Merchant earnings mismatch: expected {expected_merchant_earnings}, got {merchant_after['total_earnings']}"
        
        print(f"✓ Merchant earnings increased: {initial_merchant_earnings} → {merchant_after['total_earnings']}")


class TestMerchantScanIdempotency:
    """Tests for idempotency of merchant scan payments"""
    
    def test_duplicate_idempotency_key_returns_cached(self):
        """POST /api/payment/merchant-scan with same idempotency_key → returns duplicate:true, balance NOT reduced again"""
        merchant_session = get_merchant_session()
        customer_session = get_customer_session()
        
        # Get initial balance
        customer_before = customer_session.get(f"{BASE_URL}/api/auth/me").json()
        initial_balance = customer_before["balance"]
        
        # First payment
        amount = 5.0
        idempotency_key = f"test_idem_{uuid.uuid4().hex[:8]}"
        
        response1 = merchant_session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
            "customer_barcode": CUSTOMER_BARCODE,
            "amount": amount,
            "description": "Idempotency test",
            "idempotency_key": idempotency_key
        })
        
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["success"] is True
        assert data1.get("duplicate") is not True  # First call should not be duplicate
        
        # Check balance after first payment
        customer_after1 = customer_session.get(f"{BASE_URL}/api/auth/me").json()
        balance_after_first = customer_after1["balance"]
        assert balance_after_first == round(initial_balance - amount, 2)
        
        print(f"✓ First payment: balance {initial_balance} → {balance_after_first}")
        
        # Second payment with SAME idempotency key
        response2 = merchant_session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
            "customer_barcode": CUSTOMER_BARCODE,
            "amount": amount,
            "description": "Idempotency test duplicate",
            "idempotency_key": idempotency_key
        })
        
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["success"] is True
        assert data2.get("duplicate") is True, "Second call should return duplicate:true"
        assert data2["reference"] == data1["reference"], "Reference should match original"
        
        # Verify balance NOT reduced again
        customer_after2 = customer_session.get(f"{BASE_URL}/api/auth/me").json()
        assert customer_after2["balance"] == balance_after_first, \
            f"Balance should not change on duplicate: expected {balance_after_first}, got {customer_after2['balance']}"
        
        print(f"✓ Duplicate payment: balance unchanged at {customer_after2['balance']}, duplicate=true returned")


class TestMerchantScanInvalidBarcode:
    """Tests for invalid barcode handling"""
    
    def test_malformed_barcode_returns_400(self):
        """POST /api/payment/merchant-scan with malformed barcode 'INVALID-123' → 400 scan.invalid_barcode_format"""
        merchant_session = get_merchant_session()
        response = merchant_session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
            "customer_barcode": "INVALID-123",
            "amount": 10.0,
            "description": "Test invalid barcode"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "scan.invalid_barcode_format" in str(data.get("detail", "")), \
            f"Expected 'scan.invalid_barcode_format' in detail, got: {data}"
        
        print("✓ Malformed barcode returns 400 with scan.invalid_barcode_format")
    
    def test_unknown_barcode_returns_404(self):
        """POST /api/payment/merchant-scan with unknown barcode 'BLZ-000000000000' → 404 scan.barcode_not_found"""
        merchant_session = get_merchant_session()
        response = merchant_session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
            "customer_barcode": "BLZ-000000000000",
            "amount": 10.0,
            "description": "Test unknown barcode"
        })
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        data = response.json()
        assert "scan.barcode_not_found" in str(data.get("detail", "")), \
            f"Expected 'scan.barcode_not_found' in detail, got: {data}"
        
        print("✓ Unknown barcode returns 404 with scan.barcode_not_found")
    
    def test_lowercase_barcode_normalized(self):
        """POST /api/payment/merchant-scan with lowercase barcode → normalized and processed"""
        merchant_session = get_merchant_session()
        # Use lowercase version of valid barcode
        lowercase_barcode = CUSTOMER_BARCODE.lower()
        
        response = merchant_session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
            "customer_barcode": lowercase_barcode,
            "amount": 1.0,
            "description": "Test lowercase barcode",
            "idempotency_key": f"test_lowercase_{uuid.uuid4().hex[:8]}"
        })
        
        # Should succeed (barcode is normalized to uppercase)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["success"] is True
        
        print("✓ Lowercase barcode normalized and processed successfully")


class TestMerchantScanInsufficientBalance:
    """Tests for insufficient balance handling"""
    
    def test_insufficient_balance_returns_400(self):
        """POST /api/payment/merchant-scan with amount > balance → 400 scan.insufficient"""
        merchant_session = get_merchant_session()
        customer_session = get_customer_session()
        
        # Get current customer balance
        customer_data = customer_session.get(f"{BASE_URL}/api/auth/me").json()
        current_balance = customer_data["balance"]
        
        # Use an amount that's more than balance but less than compliance limit (2500)
        test_amount = min(current_balance + 100, 2400)  # Ensure under compliance limit
        
        response = merchant_session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
            "customer_barcode": CUSTOMER_BARCODE,
            "amount": test_amount,
            "description": "Test insufficient balance"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "scan.insufficient" in str(data.get("detail", "")), \
            f"Expected 'scan.insufficient' in detail, got: {data}"
        
        print(f"✓ Insufficient balance returns 400 with scan.insufficient (tried {test_amount} with balance {current_balance})")


class TestMerchantScanComplianceLimits:
    """Tests for compliance limit enforcement"""
    
    def test_amount_over_2500_blocked(self):
        """POST /api/payment/merchant-scan with amount > 2500 → 403 compliance blocked"""
        merchant_session = get_merchant_session()
        response = merchant_session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
            "customer_barcode": CUSTOMER_BARCODE,
            "amount": 2501.0,
            "description": "Test compliance limit"
        })
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        # Should contain compliance message
        detail = str(data.get("detail", ""))
        assert "compliance" in detail.lower() or "single_max" in detail.lower(), \
            f"Expected compliance-related error, got: {data}"
        
        print("✓ Amount > 2500 returns 403 compliance blocked")


class TestMerchantScanTransactionRecords:
    """Tests for transaction record creation"""
    
    def test_customer_transaction_created(self):
        """After valid payment, customer transactions show payment debit with correct reference, amount, fee"""
        merchant_session = get_merchant_session()
        customer_session = get_customer_session()
        
        # Make a payment
        amount = 7.5
        idempotency_key = f"test_txn_{uuid.uuid4().hex[:8]}"
        
        response = merchant_session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
            "customer_barcode": CUSTOMER_BARCODE,
            "amount": amount,
            "description": "Transaction record test",
            "idempotency_key": idempotency_key
        })
        
        assert response.status_code == 200, f"Payment failed: {response.text}"
        payment_data = response.json()
        reference = payment_data["reference"]
        
        # Get customer transactions
        txn_response = customer_session.get(f"{BASE_URL}/api/transactions")
        assert txn_response.status_code == 200, f"Get transactions failed: {txn_response.text}"
        txn_data = txn_response.json()
        
        # Handle both array and object response formats
        transactions = txn_data.get("transactions", txn_data) if isinstance(txn_data, dict) else txn_data
        
        # Find the transaction by reference
        matching_txn = None
        for txn in transactions:
            if txn.get("reference") == reference:
                matching_txn = txn
                break
        
        assert matching_txn is not None, f"Transaction with reference {reference} not found"
        
        # Verify transaction fields
        assert matching_txn["type"] == "payment"
        assert matching_txn["amount"] == -amount  # Debit is negative
        assert matching_txn["status"] == "completed"
        assert matching_txn["payment_method"] == "barcode_scan"
        
        print(f"✓ Customer transaction created: ref={reference}, amount={matching_txn['amount']}, type={matching_txn['type']}")


class TestMerchantScanAuditLog:
    """Tests for audit log creation"""
    
    def test_audit_log_created_on_payment(self):
        """After valid payment, audit log exists with payment_success event"""
        merchant_session = get_merchant_session()
        admin_session = get_admin_session()
        
        # Make a payment
        amount = 3.0
        idempotency_key = f"test_audit_{uuid.uuid4().hex[:8]}"
        
        response = merchant_session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
            "customer_barcode": CUSTOMER_BARCODE,
            "amount": amount,
            "description": "Audit log test",
            "idempotency_key": idempotency_key
        })
        
        assert response.status_code == 200, f"Payment failed: {response.text}"
        payment_data = response.json()
        reference = payment_data["reference"]
        
        # Check audit logs (admin only)
        audit_response = admin_session.get(f"{BASE_URL}/api/admin/audit-logs?event=payment_success&limit=10")
        assert audit_response.status_code == 200, f"Get audit logs failed: {audit_response.text}"
        audit_data = audit_response.json()
        
        # Find audit log with our reference
        logs = audit_data.get("logs", [])
        matching_log = None
        for log in logs:
            details = log.get("details", {})
            if details.get("reference") == reference:
                matching_log = log
                break
        
        assert matching_log is not None, f"Audit log with reference {reference} not found"
        assert matching_log["event"] == "payment_success"
        assert "initiated_by" in matching_log.get("details", {})
        
        print(f"✓ Audit log created: event={matching_log['event']}, ref={reference}")


class TestMerchantScanEdgeCases:
    """Edge case tests"""
    
    def test_unauthenticated_request_returns_401(self):
        """POST /api/payment/merchant-scan without auth → 401"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
            "customer_barcode": CUSTOMER_BARCODE,
            "amount": 10.0
        })
        
        assert response.status_code == 401
        print("✓ Unauthenticated request returns 401")
    
    def test_zero_amount_rejected(self):
        """POST /api/payment/merchant-scan with amount=0 → 422 validation error"""
        merchant_session = get_merchant_session()
        response = merchant_session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
            "customer_barcode": CUSTOMER_BARCODE,
            "amount": 0
        })
        
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ Zero amount rejected with 422")
    
    def test_negative_amount_rejected(self):
        """POST /api/payment/merchant-scan with negative amount → 422 validation error"""
        merchant_session = get_merchant_session()
        response = merchant_session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
            "customer_barcode": CUSTOMER_BARCODE,
            "amount": -10.0
        })
        
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ Negative amount rejected with 422")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
