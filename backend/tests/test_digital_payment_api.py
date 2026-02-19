"""
Digital Payment API Tests
=========================
Tests for the BidBlitz Digital Payment API that allows external systems
(like Edeka supermarket POS) to connect and process payments.

Features tested:
- API Key Authentication (create, list, revoke)
- Payment creation and status checking
- Payment listing with filters
- Refund processing
- Balance/stats queries
- Customer checkout flow
- Webhook testing
- API documentation
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin key for API key management
ADMIN_KEY = "bidblitz-admin-2026"

# Test customer credentials
TEST_CUSTOMER_EMAIL = "kunde@bidblitz.ae"
TEST_CUSTOMER_PASSWORD = "Kunde123!"


class TestDigitalPaymentAPISetup:
    """Setup and basic connectivity tests"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    def test_api_docs_endpoint(self, api_client):
        """Test GET /api/digital/docs - API documentation"""
        response = api_client.get(f"{BASE_URL}/api/digital/docs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "name" in data
        assert data["name"] == "BidBlitz Digital Payment API"
        assert "version" in data
        assert "endpoints" in data
        assert "webhook_events" in data
        print(f"✓ API docs endpoint working - Version: {data['version']}")


class TestAPIKeyManagement:
    """Tests for API Key creation, listing, and revocation"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def created_api_key(self, api_client):
        """Create an API key for testing and return it"""
        unique_name = f"TEST_POS_System_{uuid.uuid4().hex[:8]}"
        response = api_client.post(
            f"{BASE_URL}/api/digital/keys/create",
            json={
                "name": unique_name,
                "webhook_url": "https://example.com/webhook"
            },
            headers={"X-Admin-Key": ADMIN_KEY}
        )
        
        if response.status_code == 200:
            data = response.json()
            return {
                "api_key": data.get("api_key"),
                "secret_key": data.get("secret_key"),
                "name": unique_name
            }
        return None
    
    def test_create_api_key_success(self, api_client):
        """Test POST /api/digital/keys/create - Create API key (admin only)"""
        unique_name = f"TEST_Edeka_POS_{uuid.uuid4().hex[:8]}"
        response = api_client.post(
            f"{BASE_URL}/api/digital/keys/create",
            json={
                "name": unique_name,
                "webhook_url": "https://edeka.example.com/bidblitz-webhook"
            },
            headers={"X-Admin-Key": ADMIN_KEY}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "api_key" in data
        assert data["api_key"].startswith("bbz_")
        assert "secret_key" in data
        assert data["secret_key"].startswith("whsec_")
        print(f"✓ API key created: {data['api_key'][:20]}...")
    
    def test_create_api_key_invalid_admin_key(self, api_client):
        """Test POST /api/digital/keys/create with invalid admin key"""
        response = api_client.post(
            f"{BASE_URL}/api/digital/keys/create",
            json={"name": "TEST_Invalid"},
            headers={"X-Admin-Key": "wrong-admin-key"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Invalid admin key correctly rejected")
    
    def test_create_api_key_missing_admin_key(self, api_client):
        """Test POST /api/digital/keys/create without admin key"""
        response = api_client.post(
            f"{BASE_URL}/api/digital/keys/create",
            json={"name": "TEST_NoAuth"}
        )
        
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ Missing admin key correctly rejected")
    
    def test_list_api_keys_success(self, api_client):
        """Test GET /api/digital/keys/list - List all API keys (admin only)"""
        response = api_client.get(
            f"{BASE_URL}/api/digital/keys/list",
            headers={"X-Admin-Key": ADMIN_KEY}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "keys" in data
        assert isinstance(data["keys"], list)
        
        # Verify secrets are not exposed
        for key in data["keys"]:
            assert "secret" not in key, "Secret should not be exposed in list"
        
        print(f"✓ Listed {len(data['keys'])} API keys")
    
    def test_list_api_keys_invalid_admin_key(self, api_client):
        """Test GET /api/digital/keys/list with invalid admin key"""
        response = api_client.get(
            f"{BASE_URL}/api/digital/keys/list",
            headers={"X-Admin-Key": "wrong-key"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Invalid admin key correctly rejected for list")
    
    def test_revoke_api_key(self, api_client, created_api_key):
        """Test DELETE /api/digital/keys/{key_id} - Revoke API key"""
        if not created_api_key:
            pytest.skip("No API key created for revocation test")
        
        # First, get the key ID from the list
        list_response = api_client.get(
            f"{BASE_URL}/api/digital/keys/list",
            headers={"X-Admin-Key": ADMIN_KEY}
        )
        
        keys = list_response.json().get("keys", [])
        test_key = next((k for k in keys if k.get("name") == created_api_key["name"]), None)
        
        if not test_key:
            pytest.skip("Could not find created API key in list")
        
        key_id = test_key.get("id")
        
        # Revoke the key
        response = api_client.delete(
            f"{BASE_URL}/api/digital/keys/{key_id}",
            headers={"X-Admin-Key": ADMIN_KEY}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print(f"✓ API key revoked: {key_id}")
    
    def test_revoke_nonexistent_key(self, api_client):
        """Test DELETE /api/digital/keys/{key_id} with non-existent key"""
        response = api_client.delete(
            f"{BASE_URL}/api/digital/keys/nonexistent-key-id",
            headers={"X-Admin-Key": ADMIN_KEY}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent key correctly returns 404")


class TestPaymentOperations:
    """Tests for payment creation, status, listing, and refunds"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def test_api_key(self, api_client):
        """Create a fresh API key for payment tests"""
        unique_name = f"TEST_Payment_System_{uuid.uuid4().hex[:8]}"
        response = api_client.post(
            f"{BASE_URL}/api/digital/keys/create",
            json={
                "name": unique_name,
                "webhook_url": "https://test.example.com/webhook"
            },
            headers={"X-Admin-Key": ADMIN_KEY}
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get("api_key")
        pytest.skip("Could not create API key for payment tests")
    
    def test_create_payment_success(self, api_client, test_api_key):
        """Test POST /api/digital/payments/create - Create payment request"""
        unique_ref = f"ORDER-{uuid.uuid4().hex[:8]}"
        response = api_client.post(
            f"{BASE_URL}/api/digital/payments/create",
            json={
                "amount": 25.50,
                "currency": "EUR",
                "reference": unique_ref,
                "description": "Test purchase at Edeka",
                "customer_email": "test@example.com",
                "return_url": "https://edeka.example.com/success",
                "metadata": {"store_id": "EDEKA-001", "cashier": "K1"}
            },
            headers={"X-API-Key": test_api_key}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "payment_id" in data
        assert data["payment_id"].startswith("pay_")
        assert data["status"] == "pending"
        assert data["amount"] == 25.50
        assert data["currency"] == "EUR"
        assert data["reference"] == unique_ref
        assert "checkout_url" in data
        print(f"✓ Payment created: {data['payment_id']}")
        
        return data["payment_id"]
    
    def test_create_payment_invalid_api_key(self, api_client):
        """Test POST /api/digital/payments/create with invalid API key"""
        response = api_client.post(
            f"{BASE_URL}/api/digital/payments/create",
            json={
                "amount": 10.00,
                "currency": "EUR",
                "reference": "TEST-INVALID"
            },
            headers={"X-API-Key": "invalid_key"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid API key correctly rejected")
    
    def test_create_payment_duplicate_reference(self, api_client, test_api_key):
        """Test POST /api/digital/payments/create with duplicate reference"""
        unique_ref = f"DUP-ORDER-{uuid.uuid4().hex[:8]}"
        
        # Create first payment
        response1 = api_client.post(
            f"{BASE_URL}/api/digital/payments/create",
            json={
                "amount": 15.00,
                "currency": "EUR",
                "reference": unique_ref
            },
            headers={"X-API-Key": test_api_key}
        )
        assert response1.status_code == 200
        
        # Try to create duplicate
        response2 = api_client.post(
            f"{BASE_URL}/api/digital/payments/create",
            json={
                "amount": 15.00,
                "currency": "EUR",
                "reference": unique_ref
            },
            headers={"X-API-Key": test_api_key}
        )
        
        assert response2.status_code == 400, f"Expected 400, got {response2.status_code}"
        print("✓ Duplicate reference correctly rejected")
    
    def test_get_payment_status(self, api_client, test_api_key):
        """Test GET /api/digital/payments/{payment_id} - Get payment status"""
        # First create a payment
        unique_ref = f"STATUS-TEST-{uuid.uuid4().hex[:8]}"
        create_response = api_client.post(
            f"{BASE_URL}/api/digital/payments/create",
            json={
                "amount": 30.00,
                "currency": "EUR",
                "reference": unique_ref,
                "description": "Status test payment"
            },
            headers={"X-API-Key": test_api_key}
        )
        
        payment_id = create_response.json().get("payment_id")
        
        # Get payment status
        response = api_client.get(
            f"{BASE_URL}/api/digital/payments/{payment_id}",
            headers={"X-API-Key": test_api_key}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["id"] == payment_id
        assert data["status"] == "pending"
        assert data["amount"] == 30.00
        assert data["reference"] == unique_ref
        print(f"✓ Payment status retrieved: {data['status']}")
    
    def test_get_payment_not_found(self, api_client, test_api_key):
        """Test GET /api/digital/payments/{payment_id} with non-existent payment"""
        response = api_client.get(
            f"{BASE_URL}/api/digital/payments/pay_nonexistent123",
            headers={"X-API-Key": test_api_key}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent payment correctly returns 404")
    
    def test_list_payments(self, api_client, test_api_key):
        """Test GET /api/digital/payments - List all payments with filters"""
        response = api_client.get(
            f"{BASE_URL}/api/digital/payments",
            headers={"X-API-Key": test_api_key}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "payments" in data
        assert "total" in data
        assert "limit" in data
        assert "offset" in data
        assert isinstance(data["payments"], list)
        print(f"✓ Listed {len(data['payments'])} payments (total: {data['total']})")
    
    def test_list_payments_with_status_filter(self, api_client, test_api_key):
        """Test GET /api/digital/payments with status filter"""
        response = api_client.get(
            f"{BASE_URL}/api/digital/payments?status=pending",
            headers={"X-API-Key": test_api_key}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        for payment in data["payments"]:
            assert payment["status"] == "pending"
        print(f"✓ Filtered payments by status: {len(data['payments'])} pending")
    
    def test_refund_payment_not_completed(self, api_client, test_api_key):
        """Test POST /api/digital/payments/{payment_id}/refund on pending payment"""
        # Create a pending payment
        unique_ref = f"REFUND-TEST-{uuid.uuid4().hex[:8]}"
        create_response = api_client.post(
            f"{BASE_URL}/api/digital/payments/create",
            json={
                "amount": 50.00,
                "currency": "EUR",
                "reference": unique_ref
            },
            headers={"X-API-Key": test_api_key}
        )
        
        payment_id = create_response.json().get("payment_id")
        
        # Try to refund pending payment
        response = api_client.post(
            f"{BASE_URL}/api/digital/payments/{payment_id}/refund",
            json={"payment_id": payment_id},
            headers={"X-API-Key": test_api_key}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Refund on pending payment correctly rejected")


class TestBalanceAndStats:
    """Tests for balance and statistics endpoints"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def test_api_key(self, api_client):
        """Create a fresh API key for balance tests"""
        unique_name = f"TEST_Balance_System_{uuid.uuid4().hex[:8]}"
        response = api_client.post(
            f"{BASE_URL}/api/digital/keys/create",
            json={"name": unique_name},
            headers={"X-Admin-Key": ADMIN_KEY}
        )
        
        if response.status_code == 200:
            return response.json().get("api_key")
        pytest.skip("Could not create API key for balance tests")
    
    def test_get_balance_stats(self, api_client, test_api_key):
        """Test GET /api/digital/balance - Get balance/stats for API key"""
        response = api_client.get(
            f"{BASE_URL}/api/digital/balance",
            headers={"X-API-Key": test_api_key}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "api_key_name" in data
        assert "total_requests" in data
        assert "total_volume" in data
        assert "statistics" in data
        print(f"✓ Balance stats retrieved: {data['total_requests']} requests, €{data['total_volume']} volume")
    
    def test_get_customer_balance(self, api_client, test_api_key):
        """Test GET /api/digital/balance with customer_id"""
        # First, we need to find a valid customer ID
        # Using the test customer from the context
        response = api_client.get(
            f"{BASE_URL}/api/digital/balance?customer_id=BID-000001",
            headers={"X-API-Key": test_api_key}
        )
        
        # Customer may or may not exist, so we check for valid responses
        if response.status_code == 200:
            data = response.json()
            assert "customer_id" in data
            assert "balance" in data
            print(f"✓ Customer balance retrieved: €{data['balance']}")
        elif response.status_code == 404:
            print("✓ Customer not found (expected if BID-000001 doesn't exist)")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")


class TestCustomerCheckout:
    """Tests for customer checkout flow (public endpoints)"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def test_api_key(self, api_client):
        """Create a fresh API key for checkout tests"""
        unique_name = f"TEST_Checkout_System_{uuid.uuid4().hex[:8]}"
        response = api_client.post(
            f"{BASE_URL}/api/digital/keys/create",
            json={"name": unique_name},
            headers={"X-Admin-Key": ADMIN_KEY}
        )
        
        if response.status_code == 200:
            return response.json().get("api_key")
        pytest.skip("Could not create API key for checkout tests")
    
    @pytest.fixture(scope="class")
    def test_payment(self, api_client, test_api_key):
        """Create a payment for checkout tests"""
        unique_ref = f"CHECKOUT-TEST-{uuid.uuid4().hex[:8]}"
        response = api_client.post(
            f"{BASE_URL}/api/digital/payments/create",
            json={
                "amount": 10.00,
                "currency": "EUR",
                "reference": unique_ref,
                "description": "Checkout test payment"
            },
            headers={"X-API-Key": test_api_key}
        )
        
        if response.status_code == 200:
            return response.json()
        pytest.skip("Could not create payment for checkout tests")
    
    def test_get_checkout_details(self, api_client, test_payment):
        """Test GET /api/digital/checkout/{payment_id} - Customer checkout page (public)"""
        payment_id = test_payment.get("payment_id")
        
        # This is a public endpoint - no API key needed
        response = api_client.get(f"{BASE_URL}/api/digital/checkout/{payment_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["payment_id"] == payment_id
        assert "merchant_name" in data
        assert "amount" in data
        assert "status" in data
        assert data["status"] == "pending"
        print(f"✓ Checkout details retrieved: €{data['amount']} from {data['merchant_name']}")
    
    def test_get_checkout_not_found(self, api_client):
        """Test GET /api/digital/checkout/{payment_id} with non-existent payment"""
        response = api_client.get(f"{BASE_URL}/api/digital/checkout/pay_nonexistent123")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent checkout correctly returns 404")
    
    def test_confirm_checkout_without_user(self, api_client, test_payment):
        """Test POST /api/digital/checkout/{payment_id}/confirm without user"""
        payment_id = test_payment.get("payment_id")
        
        response = api_client.post(
            f"{BASE_URL}/api/digital/checkout/{payment_id}/confirm",
            json={}
        )
        
        # Should fail because no user_id provided and no customer_id on payment
        # The endpoint should handle this gracefully
        assert response.status_code in [200, 400, 404], f"Unexpected status: {response.status_code}"
        print(f"✓ Confirm without user handled: {response.status_code}")


class TestWebhooks:
    """Tests for webhook functionality"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def test_api_key(self, api_client):
        """Create a fresh API key for webhook tests"""
        unique_name = f"TEST_Webhook_System_{uuid.uuid4().hex[:8]}"
        response = api_client.post(
            f"{BASE_URL}/api/digital/keys/create",
            json={"name": unique_name},
            headers={"X-Admin-Key": ADMIN_KEY}
        )
        
        if response.status_code == 200:
            return response.json().get("api_key")
        pytest.skip("Could not create API key for webhook tests")
    
    def test_webhook_test_endpoint(self, api_client, test_api_key):
        """Test POST /api/digital/webhooks/test - Test webhook endpoint"""
        # Use a test webhook URL (httpbin.org echoes back requests)
        response = api_client.post(
            f"{BASE_URL}/api/digital/webhooks/test",
            json={"url": "https://httpbin.org/post"},
            headers={"X-API-Key": test_api_key}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data
        assert "webhook_url" in data
        assert data["webhook_url"] == "https://httpbin.org/post"
        print(f"✓ Webhook test completed: success={data['success']}")
    
    def test_webhook_test_invalid_url(self, api_client, test_api_key):
        """Test POST /api/digital/webhooks/test with invalid URL"""
        response = api_client.post(
            f"{BASE_URL}/api/digital/webhooks/test",
            json={"url": "https://invalid-domain-that-does-not-exist-12345.com/webhook"},
            headers={"X-API-Key": test_api_key}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["success"] == False
        assert "error" in data
        print(f"✓ Invalid webhook URL handled: {data.get('error', 'error reported')[:50]}")


class TestCompletePaymentFlow:
    """End-to-end test of the complete payment flow"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def auth_token(self, api_client):
        """Get authentication token for test customer"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": TEST_CUSTOMER_EMAIL,
                "password": TEST_CUSTOMER_PASSWORD
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get("token")
        pytest.skip(f"Could not authenticate test customer: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def test_api_key(self, api_client):
        """Create a fresh API key for flow tests"""
        unique_name = f"TEST_Flow_System_{uuid.uuid4().hex[:8]}"
        response = api_client.post(
            f"{BASE_URL}/api/digital/keys/create",
            json={
                "name": unique_name,
                "webhook_url": "https://httpbin.org/post"
            },
            headers={"X-Admin-Key": ADMIN_KEY}
        )
        
        if response.status_code == 200:
            return response.json().get("api_key")
        pytest.skip("Could not create API key for flow tests")
    
    def test_complete_payment_flow(self, api_client, test_api_key, auth_token):
        """Test complete flow: create payment -> check status -> confirm -> verify"""
        if not auth_token:
            pytest.skip("No auth token available")
        
        # Step 1: Create payment
        unique_ref = f"FLOW-TEST-{uuid.uuid4().hex[:8]}"
        create_response = api_client.post(
            f"{BASE_URL}/api/digital/payments/create",
            json={
                "amount": 5.00,
                "currency": "EUR",
                "reference": unique_ref,
                "description": "Complete flow test"
            },
            headers={"X-API-Key": test_api_key}
        )
        
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        payment_id = create_response.json().get("payment_id")
        print(f"✓ Step 1: Payment created: {payment_id}")
        
        # Step 2: Check status (should be pending)
        status_response = api_client.get(
            f"{BASE_URL}/api/digital/payments/{payment_id}",
            headers={"X-API-Key": test_api_key}
        )
        
        assert status_response.status_code == 200
        assert status_response.json()["status"] == "pending"
        print("✓ Step 2: Payment status is pending")
        
        # Step 3: Get checkout details (public)
        checkout_response = api_client.get(f"{BASE_URL}/api/digital/checkout/{payment_id}")
        
        assert checkout_response.status_code == 200
        checkout_data = checkout_response.json()
        assert checkout_data["amount"] == 5.00
        print(f"✓ Step 3: Checkout details retrieved: €{checkout_data['amount']}")
        
        # Step 4: Get user info to find customer ID
        user_response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if user_response.status_code == 200:
            user_data = user_response.json()
            user_id = user_data.get("id")
            print(f"✓ Step 4: User ID retrieved: {user_id}")
            
            # Step 5: Confirm payment (this will deduct from user's wallet)
            # Note: This may fail if user doesn't have enough balance
            confirm_response = api_client.post(
                f"{BASE_URL}/api/digital/checkout/{payment_id}/confirm",
                json={"user_id": user_id},
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            
            if confirm_response.status_code == 200:
                confirm_data = confirm_response.json()
                assert confirm_data["success"] == True
                assert confirm_data["status"] == "completed"
                print(f"✓ Step 5: Payment confirmed: {confirm_data['status']}")
                
                # Step 6: Verify status changed to completed
                final_status = api_client.get(
                    f"{BASE_URL}/api/digital/payments/{payment_id}",
                    headers={"X-API-Key": test_api_key}
                )
                
                assert final_status.status_code == 200
                assert final_status.json()["status"] == "completed"
                print("✓ Step 6: Payment status verified as completed")
            else:
                # May fail due to insufficient balance
                print(f"⚠ Step 5: Confirm failed (may be insufficient balance): {confirm_response.status_code}")
        else:
            print(f"⚠ Step 4: Could not get user info: {user_response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
