"""
BidBlitz V2 - Dynamic QR Code Tests
Tests for the new dynamic QR code feature with 5-minute rotation.
Covers: GET /api/payment/my-barcode (dynamic format), POST /api/payment/merchant-scan (accepts both formats)
"""

import pytest
import requests
import os
import re
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CUSTOMER_EMAIL = "kunde@bidblitz.com"
CUSTOMER_PASSWORD = "Kunde2026!"

MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PASSWORD = "Haendler2026!"

# Regex patterns for barcode formats
STATIC_BARCODE_RE = re.compile(r"^BLZ-[A-F0-9]{12}$")
DYNAMIC_QR_RE = re.compile(r"^BLZ-[A-F0-9]{12}-[A-F0-9]{8}$")

# Module-level sessions
_customer_session = None
_merchant_session = None


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


class TestDynamicQRCodeGeneration:
    """Tests for GET /api/payment/my-barcode with dynamic QR code"""
    
    def test_my_barcode_returns_dynamic_format(self):
        """GET /api/payment/my-barcode returns dynamic QR code format BLZ-XXXXXXXXXXXX-XXXXXXXX"""
        session = get_customer_session()
        response = session.get(f"{BASE_URL}/api/payment/my-barcode")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify required fields
        assert "barcode" in data, "Missing 'barcode' field"
        assert "user_id" in data, "Missing 'user_id' field"
        assert "name" in data, "Missing 'name' field"
        assert "expires_in" in data, "Missing 'expires_in' field"
        assert "rotation_seconds" in data, "Missing 'rotation_seconds' field"
        
        barcode = data["barcode"]
        
        # Verify dynamic QR code format (BLZ-XXXXXXXXXXXX-XXXXXXXX)
        assert DYNAMIC_QR_RE.match(barcode), f"Barcode format invalid: {barcode}. Expected BLZ-XXXXXXXXXXXX-XXXXXXXX"
        
        print(f"✓ Dynamic QR code: {barcode}")
        print(f"✓ Expires in: {data['expires_in']} seconds")
        print(f"✓ Rotation period: {data['rotation_seconds']} seconds")
    
    def test_my_barcode_has_expires_in_field(self):
        """GET /api/payment/my-barcode returns expires_in field (countdown timer)"""
        session = get_customer_session()
        response = session.get(f"{BASE_URL}/api/payment/my-barcode")
        
        assert response.status_code == 200
        data = response.json()
        
        expires_in = data.get("expires_in")
        assert expires_in is not None, "Missing 'expires_in' field"
        assert isinstance(expires_in, int), f"expires_in should be int, got {type(expires_in)}"
        assert 0 < expires_in <= 300, f"expires_in should be 0-300, got {expires_in}"
        
        print(f"✓ expires_in: {expires_in} seconds")
    
    def test_my_barcode_has_rotation_seconds_field(self):
        """GET /api/payment/my-barcode returns rotation_seconds field (5 minutes = 300)"""
        session = get_customer_session()
        response = session.get(f"{BASE_URL}/api/payment/my-barcode")
        
        assert response.status_code == 200
        data = response.json()
        
        rotation_seconds = data.get("rotation_seconds")
        assert rotation_seconds is not None, "Missing 'rotation_seconds' field"
        assert rotation_seconds == 300, f"rotation_seconds should be 300, got {rotation_seconds}"
        
        print(f"✓ rotation_seconds: {rotation_seconds}")
    
    def test_my_barcode_base_is_consistent(self):
        """GET /api/payment/my-barcode returns same base barcode (first 16 chars) on repeated calls"""
        session = get_customer_session()
        
        response1 = session.get(f"{BASE_URL}/api/payment/my-barcode")
        response2 = session.get(f"{BASE_URL}/api/payment/my-barcode")
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        barcode1 = response1.json()["barcode"]
        barcode2 = response2.json()["barcode"]
        
        # Base barcode (first 16 chars: BLZ-XXXXXXXXXXXX) should be same
        base1 = barcode1[:16]
        base2 = barcode2[:16]
        
        assert base1 == base2, f"Base barcode changed: {base1} vs {base2}"
        
        # Token (last 8 chars) should be same within same time slot
        token1 = barcode1[17:]
        token2 = barcode2[17:]
        assert token1 == token2, f"Token changed within same time slot: {token1} vs {token2}"
        
        print(f"✓ Base barcode consistent: {base1}")
        print(f"✓ Token consistent within time slot: {token1}")


class TestMerchantScanDynamicQR:
    """Tests for POST /api/payment/merchant-scan accepting dynamic QR format"""
    
    def test_merchant_scan_accepts_dynamic_qr(self):
        """POST /api/payment/merchant-scan accepts new dynamic QR format (BLZ-XXXXXXXXXXXX-XXXXXXXX)"""
        customer_session = get_customer_session()
        merchant_session = get_merchant_session()
        
        # Get customer's dynamic QR code
        barcode_response = customer_session.get(f"{BASE_URL}/api/payment/my-barcode")
        assert barcode_response.status_code == 200
        dynamic_qr = barcode_response.json()["barcode"]
        
        print(f"Testing with dynamic QR: {dynamic_qr}")
        
        # Merchant scans the dynamic QR code
        import uuid
        idempotency_key = f"test_dynamic_{uuid.uuid4().hex[:8]}"
        
        response = merchant_session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
            "customer_barcode": dynamic_qr,
            "amount": 1.0,
            "description": "Test dynamic QR payment",
            "idempotency_key": idempotency_key
        })
        
        assert response.status_code == 200, f"Payment failed: {response.text}"
        data = response.json()
        
        assert data["success"] is True
        assert "reference" in data
        assert data["customer_name"] is not None
        
        print(f"✓ Dynamic QR payment successful: ref={data['reference']}, customer={data['customer_name']}")
    
    def test_merchant_scan_accepts_static_barcode(self):
        """POST /api/payment/merchant-scan still accepts old static format (BLZ-XXXXXXXXXXXX)"""
        customer_session = get_customer_session()
        merchant_session = get_merchant_session()
        
        # Get customer's dynamic QR code and extract base barcode
        barcode_response = customer_session.get(f"{BASE_URL}/api/payment/my-barcode")
        assert barcode_response.status_code == 200
        dynamic_qr = barcode_response.json()["barcode"]
        
        # Extract static barcode (first 16 chars)
        static_barcode = dynamic_qr[:16]
        
        print(f"Testing with static barcode: {static_barcode}")
        
        # Merchant scans the static barcode
        import uuid
        idempotency_key = f"test_static_{uuid.uuid4().hex[:8]}"
        
        response = merchant_session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
            "customer_barcode": static_barcode,
            "amount": 1.0,
            "description": "Test static barcode payment",
            "idempotency_key": idempotency_key
        })
        
        assert response.status_code == 200, f"Payment failed: {response.text}"
        data = response.json()
        
        assert data["success"] is True
        assert "reference" in data
        
        print(f"✓ Static barcode payment successful: ref={data['reference']}")
    
    def test_merchant_scan_rejects_expired_token(self):
        """POST /api/payment/merchant-scan rejects dynamic QR with invalid/expired token"""
        customer_session = get_customer_session()
        merchant_session = get_merchant_session()
        
        # Get customer's dynamic QR code
        barcode_response = customer_session.get(f"{BASE_URL}/api/payment/my-barcode")
        assert barcode_response.status_code == 200
        dynamic_qr = barcode_response.json()["barcode"]
        
        # Modify the token to make it invalid
        base_barcode = dynamic_qr[:16]
        invalid_qr = f"{base_barcode}-DEADBEEF"  # Invalid token
        
        print(f"Testing with invalid token QR: {invalid_qr}")
        
        response = merchant_session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
            "customer_barcode": invalid_qr,
            "amount": 1.0,
            "description": "Test invalid token"
        })
        
        # Should return 400 with qr_expired error
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "qr_expired" in str(data.get("detail", "")), f"Expected 'qr_expired' error, got: {data}"
        
        print(f"✓ Invalid token rejected with scan.qr_expired")
    
    def test_merchant_scan_rejects_malformed_dynamic_qr(self):
        """POST /api/payment/merchant-scan rejects malformed dynamic QR format"""
        merchant_session = get_merchant_session()
        
        # Test various malformed formats
        malformed_codes = [
            "BLZ-123456789012-ABC",  # Token too short
            "BLZ-123456789012-ABCDEFGHI",  # Token too long
            "BLZ-12345678901-ABCDEFGH",  # Base too short
            "BLZ-1234567890123-ABCDEFGH",  # Base too long
        ]
        
        for code in malformed_codes:
            response = merchant_session.post(f"{BASE_URL}/api/payment/merchant-scan", json={
                "customer_barcode": code,
                "amount": 1.0,
                "description": "Test malformed"
            })
            
            # Should return 400 for invalid format
            assert response.status_code == 400, f"Expected 400 for {code}, got {response.status_code}"
            print(f"✓ Malformed QR '{code}' rejected")


class TestFeatureFlagsEndpoint:
    """Tests for GET /api/feature-flags (still working)"""
    
    def test_feature_flags_accessible(self):
        """GET /api/feature-flags returns feature flags without auth"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/feature-flags")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, dict), "Feature flags should be a dict"
        print(f"✓ Feature flags accessible: {list(data.keys())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
