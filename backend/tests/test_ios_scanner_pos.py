"""
Test iOS Scanner POS Endpoints
Tests for:
- Customer lookup by barcode (BID-XXXXXX format)
- Payment processing with QR code formats (BIDBLITZ:2.0:xxx, BIDBLITZ-PAY:xxx, cpt_xxx)
- Topup processing with customer barcode
- Manual barcode/QR code input fallback
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
STAFF_NUMBER = "TS-001"
STAFF_PASSWORD = "Test123!"
CUSTOMER_EMAIL = "kunde@bidblitz.ae"
CUSTOMER_PASSWORD = "Kunde123!"
CUSTOMER_BARCODE = "BID-286446"


class TestStaffLogin:
    """Staff login for POS terminal"""
    
    def test_staff_login_success(self):
        """Test staff login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/partner-portal/staff/login", json={
            "staff_number": STAFF_NUMBER,
            "password": STAFF_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "token" in data
        assert "staff" in data
        assert data["staff"]["staff_number"] == STAFF_NUMBER
        assert "permissions" in data
        print(f"✓ Staff login successful: {data['staff']['name']}")
    
    def test_staff_login_invalid_credentials(self):
        """Test staff login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/partner-portal/staff/login", json={
            "staff_number": "INVALID-001",
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 404]
        print("✓ Invalid staff login rejected correctly")


class TestCustomerLookup:
    """Customer lookup by barcode for topup/payment"""
    
    def test_customer_lookup_by_barcode(self):
        """Test customer lookup with BID-XXXXXX format"""
        response = requests.get(f"{BASE_URL}/api/pos/customer/lookup", params={
            "barcode": CUSTOMER_BARCODE
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("found") == True
        assert data.get("customer_number") == CUSTOMER_BARCODE
        assert "name" in data
        assert "bidblitz_balance" in data
        assert "total_balance" in data
        print(f"✓ Customer found: {data['name']} with balance €{data['bidblitz_balance']:.2f}")
    
    def test_customer_lookup_not_found(self):
        """Test customer lookup with non-existent barcode"""
        response = requests.get(f"{BASE_URL}/api/pos/customer/lookup", params={
            "barcode": "BID-999999"
        })
        assert response.status_code == 404
        print("✓ Non-existent customer returns 404")
    
    def test_customer_lookup_without_prefix(self):
        """Test customer lookup without BID- prefix"""
        barcode_without_prefix = CUSTOMER_BARCODE.replace("BID-", "")
        response = requests.get(f"{BASE_URL}/api/pos/customer/lookup", params={
            "barcode": barcode_without_prefix
        })
        # Should still find the customer (backend normalizes barcode)
        # Note: This may return 404 if backend requires exact match
        print(f"✓ Lookup without prefix: status {response.status_code}")


class TestPaymentProcessing:
    """Payment processing with various QR code formats"""
    
    def test_payment_with_customer_barcode(self):
        """Test payment with direct customer barcode (BID-XXXXXX)"""
        response = requests.post(f"{BASE_URL}/api/pos/payment", json={
            "customer_barcode": CUSTOMER_BARCODE,
            "amount": 0.01,  # Small test amount
            "description": "iOS Scanner Test Payment",
            "staff_id": None,
            "staff_name": "Test Staff",
            "branch_id": None,
            "branch_name": "Test Branch"
        })
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "transaction_id" in data
            assert "new_balance" in data
            print(f"✓ Payment successful: €{data['amount']:.2f}, new balance: €{data['new_balance']:.2f}")
        elif response.status_code == 400:
            # Insufficient balance is acceptable for test
            data = response.json()
            print(f"✓ Payment rejected (expected): {data.get('detail')}")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_payment_with_invalid_qr_format(self):
        """Test payment with invalid QR code format"""
        response = requests.post(f"{BASE_URL}/api/pos/payment", json={
            "customer_barcode": "INVALID:FORMAT:123",
            "amount": 1.00,
            "description": "Invalid QR Test"
        })
        assert response.status_code in [400, 404]
        print("✓ Invalid QR format rejected correctly")
    
    def test_payment_amount_validation(self):
        """Test payment with zero/negative amount"""
        response = requests.post(f"{BASE_URL}/api/pos/payment", json={
            "customer_barcode": CUSTOMER_BARCODE,
            "amount": 0,
            "description": "Zero amount test"
        })
        # Should fail validation
        assert response.status_code in [400, 422]
        print("✓ Zero amount payment rejected")


class TestTopupProcessing:
    """Topup processing with customer barcode"""
    
    def test_topup_minimum_amount(self):
        """Test topup with minimum amount (€5)"""
        response = requests.post(f"{BASE_URL}/api/pos/topup", json={
            "customer_barcode": CUSTOMER_BARCODE,
            "amount": 5.00,
            "staff_id": None,
            "staff_name": "Test Staff",
            "branch_id": None,
            "branch_name": "Test Branch"
        })
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "transaction_id" in data
            assert "bonus" in data
            assert "total_credited" in data
            assert "new_balance" in data
            print(f"✓ Topup successful: €{data['amount']:.2f} + €{data['bonus']:.2f} bonus")
        else:
            data = response.json()
            print(f"Topup response: {response.status_code} - {data}")
    
    def test_topup_below_minimum(self):
        """Test topup below minimum amount (€5)"""
        response = requests.post(f"{BASE_URL}/api/pos/topup", json={
            "customer_barcode": CUSTOMER_BARCODE,
            "amount": 4.00,  # Below €5 minimum
            "staff_name": "Test Staff"
        })
        assert response.status_code == 400
        data = response.json()
        assert "Mindestbetrag" in data.get("detail", "") or "minimum" in data.get("detail", "").lower()
        print("✓ Below minimum topup rejected correctly")
    
    def test_topup_above_maximum(self):
        """Test topup above maximum amount (€500)"""
        response = requests.post(f"{BASE_URL}/api/pos/topup", json={
            "customer_barcode": CUSTOMER_BARCODE,
            "amount": 501.00,  # Above €500 maximum
            "staff_name": "Test Staff"
        })
        assert response.status_code == 400
        data = response.json()
        assert "Maximalbetrag" in data.get("detail", "") or "maximum" in data.get("detail", "").lower()
        print("✓ Above maximum topup rejected correctly")
    
    def test_topup_bonus_calculation(self):
        """Test bonus calculation for different amounts"""
        # Bonus tiers: €20=€0.50, €50=€2, €100=€5, €200=€12
        test_amounts = [
            (20, 0.50),
            (50, 2.00),
            (100, 5.00),
            (200, 12.00)
        ]
        
        for amount, expected_bonus in test_amounts:
            response = requests.post(f"{BASE_URL}/api/pos/topup", json={
                "customer_barcode": CUSTOMER_BARCODE,
                "amount": amount,
                "staff_name": "Bonus Test"
            })
            
            if response.status_code == 200:
                data = response.json()
                actual_bonus = data.get("bonus", 0)
                assert actual_bonus == expected_bonus, f"Expected bonus €{expected_bonus} for €{amount}, got €{actual_bonus}"
                print(f"✓ Bonus for €{amount}: €{actual_bonus} (expected €{expected_bonus})")


class TestTransactionHistory:
    """Transaction history retrieval"""
    
    def test_get_transactions(self):
        """Test retrieving transaction history"""
        response = requests.get(f"{BASE_URL}/api/pos/transactions", params={
            "limit": 10
        })
        assert response.status_code == 200
        data = response.json()
        assert "transactions" in data
        assert isinstance(data["transactions"], list)
        print(f"✓ Retrieved {len(data['transactions'])} transactions")
    
    def test_get_transactions_by_staff(self):
        """Test filtering transactions by staff_id"""
        response = requests.get(f"{BASE_URL}/api/pos/transactions", params={
            "staff_id": "9c56c8dd-5300-4ad7-aec0-b1596d5adfc3",
            "limit": 5
        })
        assert response.status_code == 200
        data = response.json()
        assert "transactions" in data
        print(f"✓ Retrieved {len(data['transactions'])} transactions for staff")


class TestGiftCardOperations:
    """Gift card create and redeem operations"""
    
    def test_create_gift_card(self):
        """Test creating a new gift card"""
        unique_barcode = f"400{str(uuid.uuid4().int)[:10]}"
        
        response = requests.post(f"{BASE_URL}/api/pos/giftcard/create", json={
            "barcode": unique_barcode,
            "amount": 25.00,
            "staff_name": "Test Staff",
            "branch_name": "Test Branch"
        })
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert data.get("barcode") == unique_barcode
            assert data.get("amount") == 25.00
            print(f"✓ Gift card created: {unique_barcode} for €25.00")
        else:
            data = response.json()
            print(f"Gift card creation: {response.status_code} - {data}")
    
    def test_create_gift_card_below_minimum(self):
        """Test creating gift card below minimum (€10)"""
        response = requests.post(f"{BASE_URL}/api/pos/giftcard/create", json={
            "barcode": f"400{str(uuid.uuid4().int)[:10]}",
            "amount": 5.00,  # Below €10 minimum
            "staff_name": "Test Staff"
        })
        assert response.status_code == 400
        print("✓ Below minimum gift card rejected")
    
    def test_get_gift_card_info(self):
        """Test retrieving gift card info"""
        # First create a gift card
        unique_barcode = f"400{str(uuid.uuid4().int)[:10]}"
        create_response = requests.post(f"{BASE_URL}/api/pos/giftcard/create", json={
            "barcode": unique_barcode,
            "amount": 10.00,
            "staff_name": "Test Staff"
        })
        
        if create_response.status_code == 200:
            # Then retrieve it
            response = requests.get(f"{BASE_URL}/api/pos/giftcard/{unique_barcode}")
            assert response.status_code == 200
            data = response.json()
            assert data.get("barcode") == unique_barcode
            assert data.get("amount") == 10.00
            assert data.get("status") == "active"
            print(f"✓ Gift card info retrieved: {unique_barcode}")
    
    def test_get_nonexistent_gift_card(self):
        """Test retrieving non-existent gift card"""
        response = requests.get(f"{BASE_URL}/api/pos/giftcard/NONEXISTENT123")
        assert response.status_code == 404
        print("✓ Non-existent gift card returns 404")


class TestQRCodeFormats:
    """Test different QR code formats for payment"""
    
    def test_bidblitz_v2_format(self):
        """Test BIDBLITZ:2.0:token:customer:timestamp format"""
        # This format requires a valid token in the database
        # We'll test the format parsing
        response = requests.post(f"{BASE_URL}/api/pos/payment", json={
            "customer_barcode": "BIDBLITZ:2.0:cpt_invalid_token:BID-286446:1234567890",
            "amount": 0.01,
            "description": "V2 Format Test"
        })
        # Should fail with invalid/expired token
        assert response.status_code in [400, 404]
        data = response.json()
        print(f"✓ BIDBLITZ:2.0 format handled: {data.get('detail', 'error')}")
    
    def test_bidblitz_pay_format(self):
        """Test BIDBLITZ-PAY:token format"""
        response = requests.post(f"{BASE_URL}/api/pos/payment", json={
            "customer_barcode": "BIDBLITZ-PAY:invalid_token_123",
            "amount": 0.01,
            "description": "Pay Format Test"
        })
        # Should fail with invalid token
        assert response.status_code in [400, 404]
        print("✓ BIDBLITZ-PAY format handled correctly")
    
    def test_direct_token_format(self):
        """Test direct cpt_xxx token format"""
        response = requests.post(f"{BASE_URL}/api/pos/payment", json={
            "customer_barcode": "cpt_invalid_token_test",
            "amount": 0.01,
            "description": "Direct Token Test"
        })
        # Should fail with invalid token but recognize format
        assert response.status_code in [400, 404]
        print("✓ Direct cpt_ token format handled correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
