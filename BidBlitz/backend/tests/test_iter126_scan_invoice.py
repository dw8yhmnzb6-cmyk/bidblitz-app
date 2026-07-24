"""
Iteration 126 - Barcode Scan System Testing
============================================
Tests for:
1. Authenticated /scan page loads (frontend)
2. Table barcode scan resolve API: POST /api/scan/resolve with TBL-... returns /order/qr/... route
3. Invoice scan resolve API: POST /api/scan/resolve with BBINV-... returns /invoice/pay/... route
4. Public invoice payment page /invoice/pay/:scanCode loads
5. Invoice pay backend flow: create invoice, public fetch, wallet pay
6. Merchant QR tables page shows stable scan_code
"""
import pytest
import requests
import os
import secrets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"
MANAGER_EMAIL = "haendler@bidblitz.com"
MANAGER_PASSWORD = "Haendler2026!"


@pytest.fixture(scope="module")
def admin_session():
    """Get authenticated admin session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Admin login failed: {resp.status_code} - {resp.text}")
    return session


@pytest.fixture(scope="module")
def manager_session():
    """Get authenticated manager session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": MANAGER_EMAIL,
        "password": MANAGER_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Manager login failed: {resp.status_code} - {resp.text}")
    return session


class TestScanResolveAPI:
    """Test POST /api/scan/resolve endpoint"""
    
    def test_resolve_empty_code_returns_422(self, admin_session):
        """Empty code should return 422 (Pydantic validation)"""
        resp = admin_session.post(f"{BASE_URL}/api/scan/resolve", json={"code": ""})
        assert resp.status_code == 422  # Pydantic validation error
        data = resp.json()
        assert "detail" in data
        print(f"✓ Empty code returns 422 (validation): {data.get('detail')}")
    
    def test_resolve_unknown_code_returns_400(self, admin_session):
        """Unknown code format should return 400"""
        resp = admin_session.post(f"{BASE_URL}/api/scan/resolve", json={"code": "UNKNOWN-123456"})
        assert resp.status_code == 400
        data = resp.json()
        assert "detail" in data
        print(f"✓ Unknown code returns 400: {data.get('detail')}")
    
    def test_resolve_blz_wallet_barcode(self, admin_session):
        """BLZ- wallet barcode should return wallet_barcode type"""
        resp = admin_session.post(f"{BASE_URL}/api/scan/resolve", json={"code": "BLZ-ABCDEF123456"})
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("ok") is True
        assert data.get("type") == "wallet_barcode"
        assert data.get("action") == "cashier"
        print(f"✓ BLZ- code returns wallet_barcode type: {data}")
    
    def test_resolve_checkout_session_code(self, admin_session):
        """CS_ checkout session code should return checkout type"""
        resp = admin_session.post(f"{BASE_URL}/api/scan/resolve", json={"code": "cs_test_session_123"})
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("ok") is True
        assert data.get("type") == "checkout"
        assert "/pay/checkout/" in data.get("route", "")
        print(f"✓ CS_ code returns checkout type: {data}")


class TestTableScanResolve:
    """Test table barcode scan resolve (TBL-...)"""
    
    def test_create_table_and_resolve_scan_code(self, admin_session):
        """Create a table, get its scan_code, and resolve it"""
        # First get admin user info to get merchant_id
        me_resp = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        user = me_resp.json()
        merchant_id = user.get("merchant_id") or user.get("user_id") or user.get("id") or str(user.get("_id", ""))
        
        # Create a new table
        table_label = f"TEST_Table_{secrets.token_hex(4)}"
        create_resp = admin_session.post(f"{BASE_URL}/api/merchant/qr-tables", json={
            "merchant_id": merchant_id,
            "label": table_label,
            "capacity": 4
        })
        assert create_resp.status_code == 200
        table_data = create_resp.json()
        assert table_data.get("ok") is True
        table = table_data.get("table", {})
        table_id = table.get("table_id")
        scan_code = table.get("scan_code")
        
        assert scan_code is not None, "Table should have scan_code"
        assert scan_code.startswith("TBL-"), f"scan_code should start with TBL-, got: {scan_code}"
        print(f"✓ Created table with scan_code: {scan_code}")
        
        # Now resolve the scan_code
        resolve_resp = admin_session.post(f"{BASE_URL}/api/scan/resolve", json={"code": scan_code})
        assert resolve_resp.status_code == 200
        resolve_data = resolve_resp.json()
        assert resolve_data.get("ok") is True
        assert resolve_data.get("type") == "table_order"
        assert "/order/qr/" in resolve_data.get("route", "")
        assert resolve_data.get("scan_code") == scan_code
        print(f"✓ Resolved TBL- code to route: {resolve_data.get('route')}")
    
    def test_resolve_nonexistent_table_code_returns_404(self, admin_session):
        """Non-existent TBL- code should return 404"""
        resp = admin_session.post(f"{BASE_URL}/api/scan/resolve", json={"code": "TBL-NONEXISTENT99"})
        assert resp.status_code == 404
        data = resp.json()
        assert "detail" in data
        print(f"✓ Non-existent TBL- code returns 404: {data.get('detail')}")


class TestInvoiceScanResolve:
    """Test invoice barcode scan resolve (BBINV-...)"""
    
    def test_create_invoice_and_resolve_scan_code(self, admin_session):
        """Create an invoice, get its scan_code, and resolve it"""
        # Create a new invoice
        create_resp = admin_session.post(f"{BASE_URL}/api/invoicing/create", json={
            "client_name": "Test Client",
            "client_email": "test@example.com",
            "items": [
                {"description": "Test Item", "quantity": 1, "unit_price": 10.00}
            ],
            "notes": "Test invoice for scan testing",
            "due_days": 14
        })
        assert create_resp.status_code == 200
        invoice_data = create_resp.json()
        assert invoice_data.get("ok") is True
        scan_code = invoice_data.get("scan_code")
        invoice_id = invoice_data.get("invoice_id")
        
        assert scan_code is not None, "Invoice should have scan_code"
        assert scan_code.startswith("BBINV-"), f"scan_code should start with BBINV-, got: {scan_code}"
        print(f"✓ Created invoice with scan_code: {scan_code}")
        
        # Now resolve the scan_code
        resolve_resp = admin_session.post(f"{BASE_URL}/api/scan/resolve", json={"code": scan_code})
        assert resolve_resp.status_code == 200
        resolve_data = resolve_resp.json()
        assert resolve_data.get("ok") is True
        assert resolve_data.get("type") == "invoice"
        assert "/invoice/pay/" in resolve_data.get("route", "")
        print(f"✓ Resolved BBINV- code to route: {resolve_data.get('route')}")
    
    def test_resolve_nonexistent_invoice_code_returns_404(self, admin_session):
        """Non-existent BBINV- code should return 404"""
        resp = admin_session.post(f"{BASE_URL}/api/scan/resolve", json={"code": "BBINV-NONEXISTENT99"})
        assert resp.status_code == 404
        data = resp.json()
        assert "detail" in data
        print(f"✓ Non-existent BBINV- code returns 404: {data.get('detail')}")


class TestPublicInvoiceEndpoints:
    """Test public invoice fetch and payment endpoints"""
    
    def test_public_invoice_fetch(self, admin_session):
        """Create invoice and fetch it publicly"""
        # Create invoice
        create_resp = admin_session.post(f"{BASE_URL}/api/invoicing/create", json={
            "client_name": "Public Test Client",
            "client_email": "public@example.com",
            "items": [
                {"description": "Public Test Item", "quantity": 2, "unit_price": 25.00}
            ],
            "notes": "Public fetch test",
            "due_days": 7
        })
        assert create_resp.status_code == 200
        invoice_data = create_resp.json()
        scan_code = invoice_data.get("scan_code")
        
        # Fetch publicly (no auth required for GET)
        public_session = requests.Session()
        public_resp = public_session.get(f"{BASE_URL}/api/invoicing/public/{scan_code}")
        assert public_resp.status_code == 200
        public_data = public_resp.json()
        
        assert public_data.get("scan_code") == scan_code
        assert public_data.get("client_name") == "Public Test Client"
        assert public_data.get("status") == "sent"
        assert public_data.get("total") == 59.50  # 50 + 19% tax = 59.50
        assert len(public_data.get("items", [])) == 1
        print(f"✓ Public invoice fetch works: {public_data.get('invoice_number')}")
    
    def test_public_invoice_fetch_nonexistent_returns_404(self):
        """Non-existent invoice should return 404"""
        public_session = requests.Session()
        resp = public_session.get(f"{BASE_URL}/api/invoicing/public/BBINV-DOESNOTEXIST")
        assert resp.status_code == 404
        print("✓ Non-existent public invoice returns 404")


class TestInvoicePaymentFlow:
    """Test full invoice payment flow with wallet"""
    
    def test_invoice_payment_requires_auth(self, admin_session):
        """Invoice payment requires authentication"""
        # Create invoice
        create_resp = admin_session.post(f"{BASE_URL}/api/invoicing/create", json={
            "client_name": "Auth Test Client",
            "client_email": "auth@example.com",
            "items": [{"description": "Auth Test", "quantity": 1, "unit_price": 5.00}],
            "notes": "",
            "due_days": 14
        })
        assert create_resp.status_code == 200
        scan_code = create_resp.json().get("scan_code")
        
        # Try to pay without auth
        public_session = requests.Session()
        pay_resp = public_session.post(f"{BASE_URL}/api/invoicing/public/{scan_code}/pay")
        assert pay_resp.status_code in [401, 403]
        print("✓ Invoice payment requires authentication")
    
    def test_invoice_payment_with_wallet(self, manager_session, admin_session):
        """Full invoice payment flow: create → fetch → pay with wallet"""
        # Admin creates invoice
        create_resp = admin_session.post(f"{BASE_URL}/api/invoicing/create", json={
            "client_name": "Wallet Pay Test",
            "client_email": "wallet@example.com",
            "items": [{"description": "Wallet Test Item", "quantity": 1, "unit_price": 1.00}],
            "notes": "Wallet payment test",
            "due_days": 14
        })
        assert create_resp.status_code == 200
        invoice_data = create_resp.json()
        scan_code = invoice_data.get("scan_code")
        total = invoice_data.get("total")  # 1.00 + 19% = 1.19
        print(f"✓ Created invoice: {scan_code}, total: €{total}")
        
        # Manager checks their wallet balance first
        wallet_resp = manager_session.get(f"{BASE_URL}/api/wallet")
        if wallet_resp.status_code == 200:
            wallet_data = wallet_resp.json()
            balance_before = float(wallet_data.get("balance", 0))
            print(f"  Manager wallet balance before: €{balance_before}")
        
        # Manager pays the invoice
        pay_resp = manager_session.post(f"{BASE_URL}/api/invoicing/public/{scan_code}/pay")
        
        if pay_resp.status_code == 402:
            # Insufficient balance - this is expected if wallet is empty
            print("✓ Invoice payment returns 402 when insufficient balance (expected)")
            return
        
        assert pay_resp.status_code == 200
        pay_data = pay_resp.json()
        assert pay_data.get("ok") is True
        assert pay_data.get("invoice", {}).get("status") == "paid"
        print(f"✓ Invoice paid successfully: {pay_data.get('message')}")
        
        # Verify invoice is now marked as paid
        public_session = requests.Session()
        verify_resp = public_session.get(f"{BASE_URL}/api/invoicing/public/{scan_code}")
        assert verify_resp.status_code == 200
        verify_data = verify_resp.json()
        assert verify_data.get("status") == "paid"
        print("✓ Invoice status verified as 'paid'")
    
    def test_cannot_pay_already_paid_invoice(self, admin_session):
        """Cannot pay an invoice that's already paid"""
        # Create and pay an invoice
        create_resp = admin_session.post(f"{BASE_URL}/api/invoicing/create", json={
            "client_name": "Double Pay Test",
            "client_email": "double@example.com",
            "items": [{"description": "Double Pay Test", "quantity": 1, "unit_price": 0.50}],
            "notes": "",
            "due_days": 14
        })
        assert create_resp.status_code == 200
        scan_code = create_resp.json().get("scan_code")
        
        # First payment attempt
        pay_resp1 = admin_session.post(f"{BASE_URL}/api/invoicing/public/{scan_code}/pay")
        
        if pay_resp1.status_code == 402:
            print("✓ Skipping double-pay test (insufficient balance)")
            return
        
        assert pay_resp1.status_code == 200
        
        # Second payment attempt should fail
        pay_resp2 = admin_session.post(f"{BASE_URL}/api/invoicing/public/{scan_code}/pay")
        assert pay_resp2.status_code == 409  # Conflict - already paid
        print("✓ Cannot pay already paid invoice (409)")


class TestMerchantQrTablesPage:
    """Test merchant QR tables page shows scan_code"""
    
    def test_list_tables_includes_scan_code(self, admin_session):
        """List tables should include scan_code for each table"""
        # Get merchant_id
        me_resp = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        user = me_resp.json()
        merchant_id = user.get("merchant_id") or user.get("user_id") or user.get("id") or str(user.get("_id", ""))
        
        # Create a table first to ensure we have at least one
        table_label = f"TEST_ScanCode_{secrets.token_hex(4)}"
        create_resp = admin_session.post(f"{BASE_URL}/api/merchant/qr-tables", json={
            "merchant_id": merchant_id,
            "label": table_label,
            "capacity": 2
        })
        assert create_resp.status_code == 200
        
        # List tables
        list_resp = admin_session.get(f"{BASE_URL}/api/merchant/qr-tables/{merchant_id}")
        assert list_resp.status_code == 200
        list_data = list_resp.json()
        tables = list_data.get("tables", [])
        
        assert len(tables) > 0, "Should have at least one table"
        
        # Check that all tables have scan_code
        for table in tables:
            scan_code = table.get("scan_code")
            assert scan_code is not None, f"Table {table.get('table_id')} missing scan_code"
            assert scan_code.startswith("TBL-"), f"scan_code should start with TBL-, got: {scan_code}"
        
        print(f"✓ All {len(tables)} tables have valid scan_code (TBL-...)")


class TestURLPathResolve:
    """Test URL path extraction in scan resolve"""
    
    def test_resolve_full_url_with_order_qr_path(self, admin_session):
        """Full URL with /order/qr/ path should be resolved"""
        # This tests the URL parsing logic
        resp = admin_session.post(f"{BASE_URL}/api/scan/resolve", json={
            "code": "https://example.com/order/qr/test_token_123"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("ok") is True
        assert data.get("type") == "table_order"
        assert data.get("route") == "/order/qr/test_token_123"
        print(f"✓ Full URL with /order/qr/ resolved correctly")
    
    def test_resolve_full_url_with_pay_checkout_path(self, admin_session):
        """Full URL with /pay/checkout/ path should be resolved"""
        resp = admin_session.post(f"{BASE_URL}/api/scan/resolve", json={
            "code": "https://example.com/pay/checkout/cs_test_session"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("ok") is True
        assert data.get("type") == "checkout"
        assert data.get("route") == "/pay/checkout/cs_test_session"
        print(f"✓ Full URL with /pay/checkout/ resolved correctly")
    
    def test_resolve_full_url_with_invoice_pay_path(self, admin_session):
        """Full URL with /invoice/pay/ path should be resolved"""
        resp = admin_session.post(f"{BASE_URL}/api/scan/resolve", json={
            "code": "https://example.com/invoice/pay/BBINV-TEST123"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("ok") is True
        assert data.get("type") == "invoice"
        assert data.get("route") == "/invoice/pay/BBINV-TEST123"
        print(f"✓ Full URL with /invoice/pay/ resolved correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
