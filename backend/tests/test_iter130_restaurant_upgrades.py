"""
Iteration 130 - Restaurant Table System Upgrades Backend Tests
Tests: 
- Hardware mapping (printers) via /api/table-hardware and /api/table-hardware/printers
- Floorplan x/y persistence via PUT /api/tables/:id
- Public bill-link endpoint /api/tables/:id/bill-link/public
- Low-stock integration via /api/pos/stock/low
- Hardware health via /api/pos/hardware/health
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://super-app-staging-2.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def auth_session():
    """Create authenticated session for admin user"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login as admin
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return session


@pytest.fixture(scope="module")
def test_table(auth_session):
    """Create a test table for use in other tests"""
    resp = auth_session.post(f"{BASE_URL}/api/tables", json={
        "table_number": "TEST-130",
        "table_name": "Test Tisch 130",
        "area": "Testbereich",
        "button_id": "BTN-TEST-130",
        "x": 50,
        "y": 100
    })
    assert resp.status_code == 200, f"Create table failed: {resp.text}"
    data = resp.json()
    assert data.get("ok") is True
    table = data.get("table", {})
    yield table
    # Cleanup: delete the test table
    auth_session.delete(f"{BASE_URL}/api/tables/{table['table_id']}")


class TestHardwareMapping:
    """Test hardware mapping endpoints for printers"""
    
    def test_get_table_hardware_config(self, auth_session):
        """GET /api/table-hardware - Get hardware config including printers"""
        resp = auth_session.get(f"{BASE_URL}/api/table-hardware")
        assert resp.status_code == 200, f"Get hardware config failed: {resp.text}"
        data = resp.json()
        assert "printers" in data
        assert "button_webhook_url" in data
        assert "nfc_base_url" in data
        assert isinstance(data["printers"], list)
    
    def test_save_printer_mapping_kitchen(self, auth_session):
        """POST /api/table-hardware/printers - Save kitchen printer mapping"""
        resp = auth_session.post(f"{BASE_URL}/api/table-hardware/printers", json={
            "name": "Test Kitchen Printer",
            "role": "kitchen",
            "type": "network",
            "ip": "192.168.1.100",
            "port": 9100,
            "device": ""
        })
        assert resp.status_code == 200, f"Save printer mapping failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert "printer" in data
        printer = data["printer"]
        assert printer["role"] == "kitchen"
        assert printer["name"] == "Test Kitchen Printer"
        assert printer["type"] == "network"
        assert printer["ip"] == "192.168.1.100"
    
    def test_save_printer_mapping_service(self, auth_session):
        """POST /api/table-hardware/printers - Save service printer mapping"""
        resp = auth_session.post(f"{BASE_URL}/api/table-hardware/printers", json={
            "name": "Test Service Printer",
            "role": "service",
            "type": "usb",
            "ip": "",
            "port": 9100,
            "device": "/dev/usb/lp0"
        })
        assert resp.status_code == 200, f"Save service printer failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert data["printer"]["role"] == "service"
        assert data["printer"]["type"] == "usb"
    
    def test_save_printer_mapping_bill(self, auth_session):
        """POST /api/table-hardware/printers - Save bill printer mapping"""
        resp = auth_session.post(f"{BASE_URL}/api/table-hardware/printers", json={
            "name": "Test Bill Printer",
            "role": "bill",
            "type": "file",
            "ip": "",
            "port": 9100,
            "device": ""
        })
        assert resp.status_code == 200, f"Save bill printer failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert data["printer"]["role"] == "bill"
        assert data["printer"]["type"] == "file"
    
    def test_printer_mapping_persists(self, auth_session):
        """Verify printer mappings persist after save"""
        # Save a printer
        auth_session.post(f"{BASE_URL}/api/table-hardware/printers", json={
            "name": "Persistence Test Printer",
            "role": "kitchen",
            "type": "network",
            "ip": "10.0.0.50",
            "port": 9100
        })
        
        # Fetch hardware config and verify
        resp = auth_session.get(f"{BASE_URL}/api/table-hardware")
        assert resp.status_code == 200
        data = resp.json()
        printers = data.get("printers", [])
        kitchen_printers = [p for p in printers if p.get("role") == "kitchen"]
        assert len(kitchen_printers) > 0, "Kitchen printer not found after save"


class TestFloorplanXYPersistence:
    """Test table x/y position persistence for floorplan drag/drop"""
    
    def test_table_created_with_xy(self, test_table):
        """Table should be created with x/y coordinates"""
        assert "x" in test_table
        assert "y" in test_table
        assert test_table["x"] == 50
        assert test_table["y"] == 100
    
    def test_update_table_xy_position(self, auth_session, test_table):
        """PUT /api/tables/:id - Update x/y position"""
        table_id = test_table["table_id"]
        
        # Update position
        resp = auth_session.put(f"{BASE_URL}/api/tables/{table_id}", json={
            "x": 200,
            "y": 300
        })
        assert resp.status_code == 200, f"Update position failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert data["table"]["x"] == 200
        assert data["table"]["y"] == 300
    
    def test_xy_position_persists(self, auth_session, test_table):
        """Verify x/y position persists after update"""
        table_id = test_table["table_id"]
        
        # Update position
        auth_session.put(f"{BASE_URL}/api/tables/{table_id}", json={
            "x": 150,
            "y": 250
        })
        
        # Fetch table and verify
        resp = auth_session.get(f"{BASE_URL}/api/tables/{table_id}")
        assert resp.status_code == 200
        table = resp.json()["table"]
        assert table["x"] == 150
        assert table["y"] == 250


class TestPublicBillLink:
    """Test public bill-link endpoint for direct guest payment"""
    
    def test_public_bill_link_no_orders(self, test_table):
        """POST /api/tables/:id/bill-link/public - Should fail with no open orders"""
        table_id = test_table["table_id"]
        # No auth needed for public endpoint
        resp = requests.post(f"{BASE_URL}/api/tables/{table_id}/bill-link/public")
        # Should return 400 if no open orders exist
        assert resp.status_code in [200, 400], f"Public bill link unexpected status: {resp.text}"
        if resp.status_code == 400:
            assert "Kein Zahlungslink" in resp.json().get("detail", "")
    
    def test_public_bill_link_endpoint_exists(self, test_table):
        """Verify public bill-link endpoint is accessible without auth"""
        table_id = test_table["table_id"]
        # Should not return 401/403 (auth error)
        resp = requests.post(f"{BASE_URL}/api/tables/{table_id}/bill-link/public")
        assert resp.status_code not in [401, 403], f"Public endpoint requires auth: {resp.text}"


class TestLowStockIntegration:
    """Test low-stock endpoint integration with restaurant system"""
    
    def test_low_stock_endpoint(self, auth_session):
        """GET /api/pos/stock/low - Get low stock products"""
        resp = auth_session.get(f"{BASE_URL}/api/pos/stock/low")
        assert resp.status_code == 200, f"Low stock endpoint failed: {resp.text}"
        data = resp.json()
        assert "products" in data
        assert "count" in data
        assert isinstance(data["products"], list)
    
    def test_low_stock_with_store_id(self, auth_session):
        """GET /api/pos/stock/low?store_id=xxx - Filter by store"""
        # First get a store_id from tables
        tables_resp = auth_session.get(f"{BASE_URL}/api/tables")
        if tables_resp.status_code == 200:
            tables = tables_resp.json().get("tables", [])
            if tables:
                store_id = tables[0].get("store_id")
                if store_id:
                    resp = auth_session.get(f"{BASE_URL}/api/pos/stock/low?store_id={store_id}")
                    assert resp.status_code == 200, f"Low stock with store_id failed: {resp.text}"


class TestHardwareHealth:
    """Test hardware health endpoint for staff dashboard"""
    
    def test_hardware_health_endpoint(self, auth_session):
        """GET /api/pos/hardware/health - Get hardware health status"""
        # First get a store_id
        tables_resp = auth_session.get(f"{BASE_URL}/api/tables")
        store_id = None
        if tables_resp.status_code == 200:
            store = tables_resp.json().get("store", {})
            store_id = store.get("store_id")
            if not store_id:
                tables = tables_resp.json().get("tables", [])
                if tables:
                    store_id = tables[0].get("store_id")
        
        if not store_id:
            pytest.skip("No store_id available for hardware health test")
        
        resp = auth_session.get(f"{BASE_URL}/api/pos/hardware/health?store_id={store_id}")
        assert resp.status_code == 200, f"Hardware health failed: {resp.text}"
        data = resp.json()
        assert "printers" in data
        assert "status" in data
    
    def test_hardware_health_requires_store_id(self, auth_session):
        """GET /api/pos/hardware/health - Should require store_id parameter"""
        resp = auth_session.get(f"{BASE_URL}/api/pos/hardware/health")
        # Should return 422 (validation error) without store_id
        assert resp.status_code == 422, f"Expected 422 without store_id: {resp.text}"


class TestOrderCreationWithStock:
    """Test order creation with stock tracking integration"""
    
    def test_order_creation_checks_stock(self, test_table):
        """POST /api/orders - Order creation should check stock availability"""
        # Try to create order with non-existent product
        resp = requests.post(f"{BASE_URL}/api/orders", json={
            "table_id": test_table["table_id"],
            "items": [{"product_id": "nonexistent_product", "quantity": 1}]
        })
        # Should return 400 for no valid items
        assert resp.status_code == 400, f"Expected 400 for invalid product: {resp.text}"


class TestExistingTableFromSelfTest:
    """Test with existing table from self-test (tbl_0cc8f3a347)"""
    
    def test_existing_table_accessible(self, auth_session):
        """Verify existing test table tbl_0cc8f3a347 is accessible"""
        resp = auth_session.get(f"{BASE_URL}/api/tables/tbl_0cc8f3a347")
        # May or may not exist depending on test state
        if resp.status_code == 200:
            table = resp.json().get("table", {})
            assert "table_id" in table
            assert "x" in table
            assert "y" in table
    
    def test_existing_table_menu_public(self):
        """GET /api/tables/tbl_0cc8f3a347/menu - Public menu access"""
        resp = requests.get(f"{BASE_URL}/api/tables/tbl_0cc8f3a347/menu")
        # May return 404 if table doesn't exist
        if resp.status_code == 200:
            data = resp.json()
            assert "table" in data
            assert "products" in data


class TestButtonWebhookWithButtonId:
    """Test button webhook with existing button BTN-001"""
    
    def test_button_webhook_btn001(self):
        """POST /api/button-webhook - Test with BTN-001"""
        resp = requests.post(f"{BASE_URL}/api/button-webhook", json={
            "button_id": "BTN-001",
            "event": "pressed",
            "type": "service"
        })
        # May return 200 if button exists, 404 if not, 500 if printer hardware unavailable
        # 500 is acceptable in preview env when USB printer device doesn't exist
        assert resp.status_code in [200, 404, 500], f"Unexpected status: {resp.text}"
        if resp.status_code == 200:
            data = resp.json()
            assert data.get("ok") is True
        elif resp.status_code == 500:
            # Printer hardware error is acceptable in preview environment
            assert "Druckfehler" in resp.json().get("detail", "")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
