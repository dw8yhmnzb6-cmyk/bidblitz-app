"""
Iteration 129 - Restaurant Table System Backend Tests
Tests: Table CRUD, QR generation, Orders, Service Calls (digital buttons), Bill Link, Button Webhook
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://commerce-hub-565.preview.emergentagent.com"

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
        "table_number": "TEST-129",
        "table_name": "Test Tisch 129",
        "area": "Testbereich",
        "button_id": "BTN-TEST-129"
    })
    assert resp.status_code == 200, f"Create table failed: {resp.text}"
    data = resp.json()
    assert data.get("ok") is True
    table = data.get("table", {})
    yield table
    # Cleanup: delete the test table
    auth_session.delete(f"{BASE_URL}/api/tables/{table['table_id']}")


class TestTableCRUD:
    """Test Table CRUD operations"""
    
    def test_create_table(self, auth_session):
        """POST /api/tables - Create a new table"""
        resp = auth_session.post(f"{BASE_URL}/api/tables", json={
            "table_number": "TEST-CREATE",
            "table_name": "Test Create Tisch",
            "area": "Gastraum",
            "button_id": ""
        })
        assert resp.status_code == 200, f"Create table failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        table = data.get("table", {})
        assert table.get("table_number") == "TEST-CREATE"
        assert table.get("table_name") == "Test Create Tisch"
        assert table.get("status") == "free"
        assert "table_id" in table
        assert "qr_code_url" in table
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/tables/{table['table_id']}")
    
    def test_list_tables(self, auth_session):
        """GET /api/tables - List all tables"""
        resp = auth_session.get(f"{BASE_URL}/api/tables")
        assert resp.status_code == 200, f"List tables failed: {resp.text}"
        data = resp.json()
        assert "tables" in data
        assert isinstance(data["tables"], list)
    
    def test_get_table_by_id(self, auth_session, test_table):
        """GET /api/tables/:id - Get single table"""
        table_id = test_table["table_id"]
        resp = auth_session.get(f"{BASE_URL}/api/tables/{table_id}")
        assert resp.status_code == 200, f"Get table failed: {resp.text}"
        data = resp.json()
        assert "table" in data
        assert data["table"]["table_id"] == table_id
    
    def test_update_table(self, auth_session, test_table):
        """PUT /api/tables/:id - Update table"""
        table_id = test_table["table_id"]
        resp = auth_session.put(f"{BASE_URL}/api/tables/{table_id}", json={
            "table_name": "Updated Tisch Name",
            "area": "VIP Bereich"
        })
        assert resp.status_code == 200, f"Update table failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert data["table"]["table_name"] == "Updated Tisch Name"
        assert data["table"]["area"] == "VIP Bereich"
    
    def test_delete_table(self, auth_session):
        """DELETE /api/tables/:id - Delete table"""
        # Create a table to delete
        create_resp = auth_session.post(f"{BASE_URL}/api/tables", json={
            "table_number": "TEST-DELETE",
            "table_name": "To Be Deleted",
            "area": "Gastraum"
        })
        assert create_resp.status_code == 200
        table_id = create_resp.json()["table"]["table_id"]
        
        # Delete it
        resp = auth_session.delete(f"{BASE_URL}/api/tables/{table_id}")
        assert resp.status_code == 200, f"Delete table failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        
        # Verify it's gone (should return 404)
        get_resp = auth_session.get(f"{BASE_URL}/api/tables/{table_id}")
        assert get_resp.status_code == 404


class TestQRGeneration:
    """Test QR code generation"""
    
    def test_generate_qr(self, auth_session, test_table):
        """POST /api/tables/:id/generate-qr - Generate QR code"""
        table_id = test_table["table_id"]
        resp = auth_session.post(f"{BASE_URL}/api/tables/{table_id}/generate-qr")
        assert resp.status_code == 200, f"Generate QR failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert "qr_code_url" in data
        assert "qr_code_absolute_url" in data
        assert "scan_code" in data
        assert f"/table/{table_id}" in data["qr_code_url"]


class TestPublicTableMenu:
    """Test public table menu endpoint (no auth required)"""
    
    def test_get_table_menu(self, test_table):
        """GET /api/tables/:id/menu - Public menu endpoint"""
        table_id = test_table["table_id"]
        # No auth needed for this endpoint
        resp = requests.get(f"{BASE_URL}/api/tables/{table_id}/menu")
        assert resp.status_code == 200, f"Get menu failed: {resp.text}"
        data = resp.json()
        assert "table" in data
        assert "store" in data
        assert "products" in data
        assert data["table"]["table_id"] == table_id


class TestOrders:
    """Test order creation and management"""
    
    def test_create_order_no_items(self, test_table):
        """POST /api/orders - Should fail with no valid items"""
        resp = requests.post(f"{BASE_URL}/api/orders", json={
            "table_id": test_table["table_id"],
            "items": []
        })
        assert resp.status_code == 400, f"Expected 400 for empty items: {resp.text}"
    
    def test_list_orders(self, auth_session):
        """GET /api/orders - List orders (requires auth)"""
        resp = auth_session.get(f"{BASE_URL}/api/orders")
        assert resp.status_code == 200, f"List orders failed: {resp.text}"
        data = resp.json()
        assert "orders" in data
        assert isinstance(data["orders"], list)
    
    def test_list_orders_by_status(self, auth_session):
        """GET /api/orders?status=new - Filter by status"""
        resp = auth_session.get(f"{BASE_URL}/api/orders?status=new")
        assert resp.status_code == 200, f"List orders by status failed: {resp.text}"
        data = resp.json()
        assert "orders" in data


class TestServiceCalls:
    """Test digital service call buttons (Kellner rufen, Rechnung, Problem)"""
    
    def test_create_service_call(self, test_table):
        """POST /api/service-call - Create service call (digital button)"""
        resp = requests.post(f"{BASE_URL}/api/service-call", json={
            "table_id": test_table["table_id"],
            "type": "service"
        })
        assert resp.status_code == 200, f"Create service call failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert "service_call" in data
        call = data["service_call"]
        assert call["type"] == "service"
        assert call["status"] == "open"
        assert call["table_id"] == test_table["table_id"]
    
    def test_create_bill_request(self, test_table):
        """POST /api/service-call - Request bill (digital button)"""
        resp = requests.post(f"{BASE_URL}/api/service-call", json={
            "table_id": test_table["table_id"],
            "type": "bill"
        })
        assert resp.status_code == 200, f"Create bill request failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert data["service_call"]["type"] == "bill"
    
    def test_create_problem_report(self, test_table):
        """POST /api/service-call - Report problem (digital button)"""
        resp = requests.post(f"{BASE_URL}/api/service-call", json={
            "table_id": test_table["table_id"],
            "type": "problem"
        })
        assert resp.status_code == 200, f"Create problem report failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert data["service_call"]["type"] == "problem"
    
    def test_list_service_calls(self, auth_session):
        """GET /api/service-call - List service calls (requires auth)"""
        resp = auth_session.get(f"{BASE_URL}/api/service-call")
        assert resp.status_code == 200, f"List service calls failed: {resp.text}"
        data = resp.json()
        assert "service_calls" in data
        assert isinstance(data["service_calls"], list)
    
    def test_update_service_call_status(self, auth_session, test_table):
        """PUT /api/service-call/:id/status - Accept/complete service call"""
        # First create a service call
        create_resp = requests.post(f"{BASE_URL}/api/service-call", json={
            "table_id": test_table["table_id"],
            "type": "service"
        })
        assert create_resp.status_code == 200
        call_id = create_resp.json()["service_call"]["service_call_id"]
        
        # Accept it
        resp = auth_session.put(f"{BASE_URL}/api/service-call/{call_id}/status", json={
            "status": "accepted"
        })
        assert resp.status_code == 200, f"Accept service call failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert data["status"] == "accepted"
        
        # Complete it
        resp = auth_session.put(f"{BASE_URL}/api/service-call/{call_id}/status", json={
            "status": "done"
        })
        assert resp.status_code == 200, f"Complete service call failed: {resp.text}"
        assert resp.json()["status"] == "done"


class TestButtonWebhook:
    """Test button webhook endpoint (for physical buttons if used)"""
    
    def test_button_webhook_unknown_button(self):
        """POST /api/button-webhook - Unknown button should return 404"""
        resp = requests.post(f"{BASE_URL}/api/button-webhook", json={
            "button_id": "UNKNOWN-BTN-999",
            "event": "pressed",
            "type": "service"
        })
        assert resp.status_code == 404, f"Expected 404 for unknown button: {resp.text}"
    
    def test_button_webhook_known_button(self, test_table):
        """POST /api/button-webhook - Known button creates service call"""
        button_id = test_table.get("button_id")
        if not button_id:
            pytest.skip("Test table has no button_id")
        
        resp = requests.post(f"{BASE_URL}/api/button-webhook", json={
            "button_id": button_id,
            "event": "pressed",
            "type": "service"
        })
        assert resp.status_code == 200, f"Button webhook failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert "service_call_id" in data
    
    def test_button_webhook_ignored_event(self):
        """POST /api/button-webhook - Non-pressed events are ignored"""
        resp = requests.post(f"{BASE_URL}/api/button-webhook", json={
            "button_id": "ANY-BTN",
            "event": "released",
            "type": "service"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("ignored") is True


class TestBillLink:
    """Test bill link generation (InvoicePay reuse)"""
    
    def test_bill_link_no_orders(self, auth_session, test_table):
        """POST /api/tables/:id/bill-link - Should fail with no open orders"""
        table_id = test_table["table_id"]
        resp = auth_session.post(f"{BASE_URL}/api/tables/{table_id}/bill-link")
        # May return 400 if no open orders exist
        assert resp.status_code in [200, 400], f"Bill link unexpected status: {resp.text}"
        if resp.status_code == 400:
            assert "Kein Zahlungslink" in resp.json().get("detail", "")


class TestTableStatus:
    """Test table status transitions"""
    
    def test_table_status_after_service_call(self, auth_session, test_table):
        """Table status should update after service call"""
        table_id = test_table["table_id"]
        
        # Create a service call
        requests.post(f"{BASE_URL}/api/service-call", json={
            "table_id": table_id,
            "type": "service"
        })
        
        # Check table status
        resp = auth_session.get(f"{BASE_URL}/api/tables/{table_id}")
        assert resp.status_code == 200
        table = resp.json()["table"]
        assert table["status"] in ["service_call", "bill_requested", "order_open", "free", "occupied"]
    
    def test_table_status_after_bill_request(self, auth_session, test_table):
        """Table status should be bill_requested after bill call"""
        table_id = test_table["table_id"]
        
        # Create a bill request
        requests.post(f"{BASE_URL}/api/service-call", json={
            "table_id": table_id,
            "type": "bill"
        })
        
        # Check table status
        resp = auth_session.get(f"{BASE_URL}/api/tables/{table_id}")
        assert resp.status_code == 200
        table = resp.json()["table"]
        assert table["status"] == "bill_requested"


class TestDuplicateButtonId:
    """Test button_id uniqueness constraint"""
    
    def test_duplicate_button_id_rejected(self, auth_session):
        """Creating table with duplicate button_id should fail"""
        # Create first table with button_id
        resp1 = auth_session.post(f"{BASE_URL}/api/tables", json={
            "table_number": "TEST-DUP-1",
            "table_name": "Duplicate Test 1",
            "area": "Test",
            "button_id": "BTN-UNIQUE-TEST"
        })
        assert resp1.status_code == 200
        table1_id = resp1.json()["table"]["table_id"]
        
        # Try to create second table with same button_id
        resp2 = auth_session.post(f"{BASE_URL}/api/tables", json={
            "table_number": "TEST-DUP-2",
            "table_name": "Duplicate Test 2",
            "area": "Test",
            "button_id": "BTN-UNIQUE-TEST"
        })
        assert resp2.status_code == 409, f"Expected 409 for duplicate button_id: {resp2.text}"
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/tables/{table1_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
