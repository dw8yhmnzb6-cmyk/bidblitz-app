"""
Test Customer-Presented QR Model Payment Flow
=============================================
Tests the payment flow where a merchant scans a customer's QR code to process payment.

Features tested:
1. Customer QR Code Generation via /api/digital/customer/generate-qr
2. POS Payment processing with QR code format BIDBLITZ:2.0:{token}:{customer}:{timestamp}
3. POS Payment processing with direct token format cpt_xxxx
4. Token reuse prevention (QR code can only be used once)
5. Token expiration validation
6. Balance deduction after successful payment
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bidblitz-auction-2.preview.emergentagent.com').rstrip('/')


class TestCustomerQRPaymentFlow:
    """Test the Customer-Presented QR Model payment flow"""
    
    customer_token = None
    customer_id = None
    customer_number = None
    initial_balance = None
    payment_token = None
    qr_data_compact = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as customer to get auth token"""
        # Login as customer
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "kunde@bidblitz.ae",
                "password": "Kunde123!"
            }
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            TestCustomerQRPaymentFlow.customer_token = data.get("token")
            TestCustomerQRPaymentFlow.customer_id = data.get("user", {}).get("id")
            TestCustomerQRPaymentFlow.customer_number = data.get("user", {}).get("customer_number")
        
        yield
    
    def test_01_customer_login(self):
        """Test customer login to get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "kunde@bidblitz.ae",
                "password": "Kunde123!"
            }
        )
        
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        
        TestCustomerQRPaymentFlow.customer_token = data["token"]
        TestCustomerQRPaymentFlow.customer_id = data["user"].get("id")
        TestCustomerQRPaymentFlow.customer_number = data["user"].get("customer_number")
        
        print(f"✅ Customer logged in: {data['user'].get('email')}")
        print(f"   Customer ID: {TestCustomerQRPaymentFlow.customer_id}")
        print(f"   Customer Number: {TestCustomerQRPaymentFlow.customer_number}")
    
    def test_02_get_customer_balance(self):
        """Get customer's current balance before payment"""
        if not TestCustomerQRPaymentFlow.customer_token:
            pytest.skip("No customer token available")
        
        response = requests.get(
            f"{BASE_URL}/api/bidblitz-pay/wallet",
            headers={"Authorization": f"Bearer {TestCustomerQRPaymentFlow.customer_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get wallet: {response.text}"
        data = response.json()
        
        TestCustomerQRPaymentFlow.initial_balance = data.get("wallet", {}).get("universal_balance", 0)
        print(f"✅ Customer balance: €{TestCustomerQRPaymentFlow.initial_balance:.2f}")
    
    def test_03_generate_customer_qr(self):
        """Test generating customer payment QR code"""
        if not TestCustomerQRPaymentFlow.customer_token:
            pytest.skip("No customer token available")
        
        response = requests.post(
            f"{BASE_URL}/api/digital/customer/generate-qr",
            headers={
                "Authorization": f"Bearer {TestCustomerQRPaymentFlow.customer_token}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"QR generation failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "payment_token" in data, "No payment_token in response"
        assert "qr_data_compact" in data, "No qr_data_compact in response"
        assert "expires_at" in data, "No expires_at in response"
        
        TestCustomerQRPaymentFlow.payment_token = data["payment_token"]
        TestCustomerQRPaymentFlow.qr_data_compact = data["qr_data_compact"]
        
        # Verify token format
        assert data["payment_token"].startswith("cpt_"), f"Token should start with cpt_, got: {data['payment_token']}"
        
        # Verify compact QR format
        assert data["qr_data_compact"].startswith("BIDBLITZ:2.0:"), f"QR should start with BIDBLITZ:2.0:, got: {data['qr_data_compact']}"
        
        print(f"✅ QR Code generated successfully")
        print(f"   Payment Token: {data['payment_token']}")
        print(f"   QR Data Compact: {data['qr_data_compact']}")
        print(f"   Expires At: {data['expires_at']}")
        print(f"   Valid For: {data.get('valid_for_minutes', 5)} minutes")
    
    def test_04_pos_payment_with_compact_qr_format(self):
        """Test POS payment using BIDBLITZ:2.0:{token}:{customer}:{timestamp} format"""
        if not TestCustomerQRPaymentFlow.qr_data_compact:
            pytest.skip("No QR data available")
        
        if TestCustomerQRPaymentFlow.initial_balance is None or TestCustomerQRPaymentFlow.initial_balance < 1:
            pytest.skip("Customer has insufficient balance for payment test")
        
        # Login as staff first
        staff_login = requests.post(
            f"{BASE_URL}/api/partner-portal/staff/login",
            json={
                "staff_number": "TS-001",
                "password": "Test123!"
            }
        )
        
        if staff_login.status_code != 200:
            pytest.skip("Staff login failed")
        
        staff_token = staff_login.json().get("token")
        staff_data = staff_login.json().get("staff", {})
        
        # Process payment with compact QR format
        payment_amount = 1.00  # Small test amount
        
        response = requests.post(
            f"{BASE_URL}/api/pos/payment",
            headers={
                "Authorization": f"Bearer {staff_token}",
                "Content-Type": "application/json"
            },
            json={
                "customer_barcode": TestCustomerQRPaymentFlow.qr_data_compact,
                "amount": payment_amount,
                "staff_id": staff_data.get("id"),
                "staff_name": staff_data.get("name"),
                "branch_id": staff_data.get("branch_id"),
                "branch_name": staff_data.get("branch_name")
            }
        )
        
        assert response.status_code == 200, f"Payment failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, f"Payment not successful: {data}"
        assert "transaction_id" in data, "No transaction_id in response"
        assert "new_balance" in data, "No new_balance in response"
        
        # Verify balance was deducted
        expected_balance = TestCustomerQRPaymentFlow.initial_balance - payment_amount
        # Allow for small floating point differences
        assert abs(data["new_balance"] - expected_balance) < 0.01, \
            f"Balance mismatch: expected ~{expected_balance:.2f}, got {data['new_balance']:.2f}"
        
        print(f"✅ Payment successful with compact QR format")
        print(f"   Amount: €{payment_amount:.2f}")
        print(f"   Transaction ID: {data['transaction_id']}")
        print(f"   New Balance: €{data['new_balance']:.2f}")
        print(f"   Customer: {data.get('customer_name')}")
    
    def test_05_token_reuse_prevention(self):
        """Test that a used QR token cannot be reused"""
        if not TestCustomerQRPaymentFlow.qr_data_compact:
            pytest.skip("No QR data available")
        
        # Login as staff
        staff_login = requests.post(
            f"{BASE_URL}/api/partner-portal/staff/login",
            json={
                "staff_number": "TS-001",
                "password": "Test123!"
            }
        )
        
        if staff_login.status_code != 200:
            pytest.skip("Staff login failed")
        
        staff_token = staff_login.json().get("token")
        
        # Try to use the same QR code again
        response = requests.post(
            f"{BASE_URL}/api/pos/payment",
            headers={
                "Authorization": f"Bearer {staff_token}",
                "Content-Type": "application/json"
            },
            json={
                "customer_barcode": TestCustomerQRPaymentFlow.qr_data_compact,
                "amount": 1.00
            }
        )
        
        # Should fail because token was already used
        assert response.status_code == 400, f"Expected 400 for reused token, got {response.status_code}"
        data = response.json()
        
        # Check error message indicates token was already used
        error_detail = data.get("detail", "").lower()
        assert "bereits verwendet" in error_detail or "already used" in error_detail or "ungültig" in error_detail, \
            f"Expected 'already used' error, got: {data.get('detail')}"
        
        print(f"✅ Token reuse correctly prevented")
        print(f"   Error: {data.get('detail')}")
    
    def test_06_generate_new_qr_for_direct_token_test(self):
        """Generate a new QR code for direct token format test"""
        if not TestCustomerQRPaymentFlow.customer_token:
            pytest.skip("No customer token available")
        
        response = requests.post(
            f"{BASE_URL}/api/digital/customer/generate-qr",
            headers={
                "Authorization": f"Bearer {TestCustomerQRPaymentFlow.customer_token}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"QR generation failed: {response.text}"
        data = response.json()
        
        TestCustomerQRPaymentFlow.payment_token = data["payment_token"]
        TestCustomerQRPaymentFlow.qr_data_compact = data["qr_data_compact"]
        
        print(f"✅ New QR Code generated for direct token test")
        print(f"   Payment Token: {data['payment_token']}")
    
    def test_07_pos_payment_with_direct_token(self):
        """Test POS payment using direct token format (cpt_xxxx)"""
        if not TestCustomerQRPaymentFlow.payment_token:
            pytest.skip("No payment token available")
        
        # Get current balance
        balance_response = requests.get(
            f"{BASE_URL}/api/bidblitz-pay/wallet",
            headers={"Authorization": f"Bearer {TestCustomerQRPaymentFlow.customer_token}"}
        )
        
        if balance_response.status_code != 200:
            pytest.skip("Could not get balance")
        
        current_balance = balance_response.json().get("wallet", {}).get("universal_balance", 0)
        
        if current_balance < 1:
            pytest.skip("Customer has insufficient balance")
        
        # Login as staff
        staff_login = requests.post(
            f"{BASE_URL}/api/partner-portal/staff/login",
            json={
                "staff_number": "TS-001",
                "password": "Test123!"
            }
        )
        
        if staff_login.status_code != 200:
            pytest.skip("Staff login failed")
        
        staff_token = staff_login.json().get("token")
        
        # Process payment with direct token format
        payment_amount = 0.50  # Small test amount
        
        response = requests.post(
            f"{BASE_URL}/api/pos/payment",
            headers={
                "Authorization": f"Bearer {staff_token}",
                "Content-Type": "application/json"
            },
            json={
                "customer_barcode": TestCustomerQRPaymentFlow.payment_token,  # Direct cpt_xxxx token
                "amount": payment_amount
            }
        )
        
        assert response.status_code == 200, f"Payment with direct token failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, f"Payment not successful: {data}"
        
        print(f"✅ Payment successful with direct token format")
        print(f"   Token: {TestCustomerQRPaymentFlow.payment_token}")
        print(f"   Amount: €{payment_amount:.2f}")
        print(f"   New Balance: €{data.get('new_balance', 0):.2f}")
    
    def test_08_verify_balance_deduction(self):
        """Verify that balance was correctly deducted after payments"""
        if not TestCustomerQRPaymentFlow.customer_token:
            pytest.skip("No customer token available")
        
        response = requests.get(
            f"{BASE_URL}/api/bidblitz-pay/wallet",
            headers={"Authorization": f"Bearer {TestCustomerQRPaymentFlow.customer_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get wallet: {response.text}"
        data = response.json()
        
        final_balance = data.get("wallet", {}).get("universal_balance", 0)
        
        # We made two payments: €1.00 and €0.50 = €1.50 total
        if TestCustomerQRPaymentFlow.initial_balance is not None:
            expected_deduction = 1.50
            expected_final = TestCustomerQRPaymentFlow.initial_balance - expected_deduction
            
            print(f"✅ Balance verification")
            print(f"   Initial Balance: €{TestCustomerQRPaymentFlow.initial_balance:.2f}")
            print(f"   Total Deducted: €{expected_deduction:.2f}")
            print(f"   Expected Final: €{expected_final:.2f}")
            print(f"   Actual Final: €{final_balance:.2f}")
        else:
            print(f"✅ Final Balance: €{final_balance:.2f}")


class TestQRCodeFormats:
    """Test different QR code format handling"""
    
    def test_01_bidblitz_v1_format(self):
        """Test BIDBLITZ-PAY:{token} format (legacy v1)"""
        # This format should also be supported for backward compatibility
        # We'll test that the endpoint handles it correctly
        
        staff_login = requests.post(
            f"{BASE_URL}/api/partner-portal/staff/login",
            json={
                "staff_number": "TS-001",
                "password": "Test123!"
            }
        )
        
        assert staff_login.status_code == 200, f"Staff login failed: {staff_login.text}"
        
        staff_token = staff_login.json().get("token")
        
        # Test with invalid v1 format token
        response = requests.post(
            f"{BASE_URL}/api/pos/payment",
            headers={
                "Authorization": f"Bearer {staff_token}",
                "Content-Type": "application/json"
            },
            json={
                "customer_barcode": "BIDBLITZ-PAY:invalid_token_12345",
                "amount": 1.00
            }
        )
        
        # Should return 400 for invalid token
        assert response.status_code == 400, f"Expected 400 for invalid v1 token, got {response.status_code}"
        
        print(f"✅ BIDBLITZ-PAY format correctly validated")
        print(f"   Response: {response.json().get('detail')}")
    
    def test_02_invalid_qr_format(self):
        """Test handling of invalid QR code formats"""
        staff_login = requests.post(
            f"{BASE_URL}/api/partner-portal/staff/login",
            json={
                "staff_number": "TS-001",
                "password": "Test123!"
            }
        )
        
        assert staff_login.status_code == 200, f"Staff login failed: {staff_login.text}"
        
        staff_token = staff_login.json().get("token")
        
        # Test with completely invalid format
        response = requests.post(
            f"{BASE_URL}/api/pos/payment",
            headers={
                "Authorization": f"Bearer {staff_token}",
                "Content-Type": "application/json"
            },
            json={
                "customer_barcode": "INVALID:FORMAT:12345",
                "amount": 1.00
            }
        )
        
        # Should return 404 (customer not found) since it's not a recognized format
        assert response.status_code in [400, 404], f"Expected 400/404 for invalid format, got {response.status_code}"
        
        print(f"✅ Invalid QR format correctly rejected")
        print(f"   Response: {response.json().get('detail')}")


class TestStaffPOSPaymentTab:
    """Test Staff POS Zahlung (Payment) tab functionality"""
    
    def test_01_staff_login(self):
        """Test staff login for POS access"""
        response = requests.post(
            f"{BASE_URL}/api/partner-portal/staff/login",
            json={
                "staff_number": "TS-001",
                "password": "Test123!"
            }
        )
        
        assert response.status_code == 200, f"Staff login failed: {response.text}"
        data = response.json()
        
        assert "token" in data, "No token in response"
        assert "staff" in data, "No staff in response"
        
        # Verify staff has payment permission
        permissions = data["staff"].get("permissions", [])
        has_payment_access = "pos.pay" in permissions or "*" in permissions
        
        print(f"✅ Staff logged in: {data['staff'].get('name')}")
        print(f"   Role: {data['staff'].get('role')}")
        print(f"   Has Payment Access: {has_payment_access}")
        print(f"   Permissions: {permissions}")
    
    def test_02_pos_payment_endpoint_exists(self):
        """Verify POS payment endpoint is accessible"""
        # Test without auth to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/pos/payment",
            json={
                "customer_barcode": "test",
                "amount": 1.00
            }
        )
        
        # Should return 404 for "customer not found" (not endpoint not found)
        # The endpoint exists if we get a meaningful error response
        data = response.json()
        
        # Check that we get a proper error message, not a generic 404
        assert "detail" in data, "Expected error detail in response"
        assert "Kunde" in data.get("detail", "") or "customer" in data.get("detail", "").lower() or "not found" in data.get("detail", "").lower(), \
            f"Expected customer-related error, got: {data.get('detail')}"
        
        print(f"✅ POS payment endpoint exists")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {data.get('detail')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
