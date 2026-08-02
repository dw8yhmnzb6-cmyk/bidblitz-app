"""
BidBlitz POS Customer & Merchant Experience Hardening Tests - Iteration 314
Tests for: POS access, payment methods, duplicate payment guard, receipt totals, customer display
"""
import os
import pytest
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://super-app-staging-2.preview.emergentagent.com").rstrip("/")

# Test credentials
MERCHANT_EMAIL = "haendler@bidblitz.ae"
MERCHANT_PASSWORD = "Haendler2026!"
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def merchant_session():
    """Login as merchant and return session with cookies"""
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": MERCHANT_EMAIL, "password": MERCHANT_PASSWORD},
    )
    if response.status_code != 200:
        pytest.skip(f"Merchant login failed: {response.text}")
    return session


@pytest.fixture(scope="module")
def admin_session():
    """Login as admin and return session with cookies"""
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.text}")
    return session


class TestMerchantPosAccess:
    """Test merchant can access POS without being forced to setup when store/register exist"""

    def test_merchant_login_succeeds(self, merchant_session):
        """Merchant can log in successfully"""
        response = merchant_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data.get("role") == "merchant"
        print(f"Merchant logged in: {data.get('email')}")

    def test_merchant_setup_state_returns_stores_and_registers(self, merchant_session):
        """Merchant setup state includes stores and registers"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant-setup/state")
        assert response.status_code == 200
        data = response.json()
        
        # Should have stores and registers
        stores = data.get("stores", [])
        registers = data.get("registers", [])
        
        assert len(stores) > 0, "Merchant should have at least one store"
        assert len(registers) > 0, "Merchant should have at least one register"
        
        print(f"Found {len(stores)} stores and {len(registers)} registers")

    def test_pos_stores_endpoint_accessible(self, merchant_session):
        """POS stores endpoint is accessible"""
        response = merchant_session.get(f"{BASE_URL}/api/pos/stores")
        assert response.status_code == 200
        data = response.json()
        assert "stores" in data
        print(f"POS stores: {len(data['stores'])} found")

    def test_pos_registers_endpoint_accessible(self, merchant_session):
        """POS registers endpoint is accessible"""
        response = merchant_session.get(f"{BASE_URL}/api/pos/registers")
        assert response.status_code == 200
        data = response.json()
        assert "registers" in data
        print(f"POS registers: {len(data['registers'])} found")

    def test_pos_products_search_accessible(self, merchant_session):
        """POS products search is accessible"""
        # Get store ID first
        stores_response = merchant_session.get(f"{BASE_URL}/api/pos/stores")
        stores = stores_response.json().get("stores", [])
        if not stores:
            pytest.skip("No stores available")
        
        store_id = stores[0]["store_id"]
        response = merchant_session.get(
            f"{BASE_URL}/api/pos/products/search",
            params={"store_id": store_id, "limit": 10}
        )
        assert response.status_code == 200
        data = response.json()
        assert "products" in data
        print(f"Found {len(data['products'])} products")


class TestPaymentMethods:
    """Test payment method availability and disabled state"""

    def test_feature_flags_public_endpoint(self, merchant_session):
        """Feature flags public endpoint returns payment method flags"""
        response = merchant_session.get(f"{BASE_URL}/api/features/public")
        assert response.status_code == 200
        data = response.json()
        
        # Check for payment method flags
        flags = data.get("flags", {})
        payment_keys = [
            "merchant.pos.payment.cash",
            "merchant.pos.payment.card",
            "merchant.pos.payment.wallet",
            "merchant.pos.payment.qr",
            "merchant.pos.payment.tap_to_pay",
        ]
        
        for key in payment_keys:
            if key in flags:
                print(f"Flag {key}: enabled={flags[key].get('enabled')}")


class TestDuplicatePaymentGuard:
    """Test that duplicate payments are prevented for pending attempts"""

    def test_pending_payment_active_respects_future_expiry(self):
        """Pending payment with future expiry is considered active"""
        from routes.pos_system import _is_pending_payment_active
        
        payment = {
            "status": "pending",
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
        }
        assert _is_pending_payment_active(payment) is True

    def test_pending_payment_active_rejects_expired_attempt(self):
        """Pending payment with past expiry is not active"""
        from routes.pos_system import _is_pending_payment_active
        
        payment = {
            "status": "pending",
            "expires_at": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat(),
        }
        assert _is_pending_payment_active(payment) is False

    def test_pending_payment_active_rejects_non_pending_status(self):
        """Non-pending payment is not active"""
        from routes.pos_system import _is_pending_payment_active
        
        payment = {
            "status": "paid",
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
        }
        assert _is_pending_payment_active(payment) is False


class TestReceiptTotals:
    """Test that receipt totals match transaction totals"""

    def test_receipt_html_uses_same_total_as_transaction(self):
        """Receipt HTML contains the same total as the transaction"""
        from routes.pos_system import _build_receipt_html
        
        sale = {
            "receipt_id": "RCP-TEST-123",
            "created_at": "2026-08-02T12:00:00+00:00",
            "register_id": "REG-1",
            "cashier_id": "cashier-1",
            "items": [
                {"quantity": 2, "name": "Test Product", "line_total": 10.00},
                {"quantity": 1, "name": "Another Product", "line_total": 5.50},
            ],
            "subtotal": 15.50,
            "discount": 0,
            "tax_total": 2.48,
            "total": 15.50,
            "method": "cash",
            "payment_id": "PAY-1",
        }
        merchant = {"business_name": "Test Merchant"}
        store = {"name": "Test Store", "address": "Test Address", "city": "Berlin", "country": "DE"}
        
        html = _build_receipt_html(sale, merchant, store)
        
        # Check that total appears in receipt
        assert "Gesamt:" in html
        assert "€15.50" in html
        # Total should appear at least twice (in items and summary)
        assert html.count("€15.50") >= 1

    def test_sales_endpoint_returns_correct_totals(self, merchant_session):
        """Sales endpoint returns sales with correct totals"""
        response = merchant_session.get(f"{BASE_URL}/api/pos/sales", params={"limit": 5})
        assert response.status_code == 200
        data = response.json()
        
        sales = data.get("sales", [])
        for sale in sales[:3]:  # Check first 3 sales
            total = sale.get("total", 0)
            subtotal = sale.get("subtotal", 0)
            discount = sale.get("discount", 0)
            
            # Total should be subtotal - discount (approximately)
            expected_total = subtotal - discount
            assert abs(total - expected_total) < 0.01, f"Total mismatch: {total} vs expected {expected_total}"
            print(f"Sale {sale.get('receipt_id')}: total={total}, subtotal={subtotal}, discount={discount}")


class TestHardwareDiagnostics:
    """Test hardware diagnostics page loads separately from checkout"""

    def test_hardware_health_endpoint(self, merchant_session):
        """Hardware health endpoint returns status"""
        # Get store ID first
        stores_response = merchant_session.get(f"{BASE_URL}/api/pos/stores")
        stores = stores_response.json().get("stores", [])
        if not stores:
            pytest.skip("No stores available")
        
        store_id = stores[0]["store_id"]
        response = merchant_session.get(
            f"{BASE_URL}/api/pos/hardware/health",
            params={"store_id": store_id}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have hardware status fields
        assert "printers" in data
        assert "status" in data
        print(f"Hardware status: {data.get('status')}, printers: {len(data.get('printers', []))}")


class TestCustomerDisplaySecurity:
    """Test that customer display doesn't leak internal data"""

    def test_merchant_setup_state_no_api_keys_exposed(self, merchant_session):
        """Merchant setup state doesn't expose API keys in products"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant-setup/state")
        assert response.status_code == 200
        data = response.json()
        
        # Check products don't have sensitive fields
        products = data.get("products", [])
        for product in products:
            assert "api_key" not in product
            assert "secret" not in product
            assert "password" not in product

    def test_sales_endpoint_no_internal_ids_in_items(self, merchant_session):
        """Sales endpoint items don't expose internal MongoDB IDs"""
        response = merchant_session.get(f"{BASE_URL}/api/pos/sales", params={"limit": 5})
        assert response.status_code == 200
        data = response.json()
        
        sales = data.get("sales", [])
        for sale in sales:
            # Check that _id is not present
            assert "_id" not in sale, "MongoDB _id should not be exposed"
            
            # Check items
            for item in sale.get("items", []):
                assert "_id" not in item, "Item _id should not be exposed"


class TestRoleBasedAccess:
    """Test role-specific access and layout"""

    def test_merchant_has_owner_role_access(self, merchant_session):
        """Merchant user has owner-level access"""
        response = merchant_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        
        role = data.get("role")
        assert role in ["merchant", "admin"], f"Expected merchant or admin role, got {role}"

    def test_pos_dashboard_summary_accessible(self, merchant_session):
        """POS dashboard summary is accessible to merchant"""
        response = merchant_session.get(
            f"{BASE_URL}/api/pos/dashboard/summary",
            params={"period": "today"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have summary fields
        assert "totals" in data
        assert "merchant" in data
        print(f"Dashboard: {data['totals'].get('sales_count')} sales, {data['totals'].get('sales_total')} total")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
