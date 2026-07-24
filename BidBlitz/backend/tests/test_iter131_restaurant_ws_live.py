"""
Iteration 131 - Restaurant WebSocket Live System + Auth WS Token Tests
Tests:
- /api/auth/ws-token endpoint (JWT token for WebSocket auth)
- /api/tables CRUD
- /api/orders CRUD + status updates
- /api/service-call CRUD + status updates
- /api/table-hardware/diagnostics
- WebSocket handshake on /api/restaurant/ws/{store_id}?token=...
"""

import os
import pytest
import requests
import json
import time
import asyncio
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


class TestAuthWSToken:
    """Test /api/auth/ws-token endpoint for WebSocket authentication"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def test_ws_token_requires_auth(self):
        """WS token endpoint should require authentication"""
        response = self.session.get(f"{BASE_URL}/api/auth/ws-token")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/auth/ws-token requires authentication")

    def test_ws_token_after_login(self):
        """WS token should be returned after successful login"""
        # Login first
        login_res = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        
        # Get WS token
        ws_res = self.session.get(f"{BASE_URL}/api/auth/ws-token")
        assert ws_res.status_code == 200, f"WS token failed: {ws_res.text}"
        
        data = ws_res.json()
        assert "token" in data, "Response should contain 'token' field"
        assert len(data["token"]) > 20, "Token should be a valid JWT"
        print(f"PASS: /api/auth/ws-token returns token (length={len(data['token'])})")


class TestRestaurantTablesAPI:
    """Test Restaurant Tables CRUD endpoints"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        login_res = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"

    def test_list_tables(self):
        """GET /api/tables should return tables list"""
        response = self.session.get(f"{BASE_URL}/api/tables")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "tables" in data, "Response should contain 'tables' field"
        assert isinstance(data["tables"], list), "Tables should be a list"
        print(f"PASS: GET /api/tables returns {len(data['tables'])} tables")

    def test_create_table(self):
        """POST /api/tables should create a new table"""
        table_data = {
            "table_number": "TEST-131",
            "table_name": "Test Tisch 131",
            "area": "Testbereich",
            "button_id": f"BTN-131-{int(time.time())}"
        }
        
        response = self.session.post(f"{BASE_URL}/api/tables", json=table_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True, "Response should have ok=True"
        assert "table" in data, "Response should contain 'table' field"
        assert data["table"]["table_number"] == "TEST-131"
        
        # Store for cleanup
        self.created_table_id = data["table"]["table_id"]
        print(f"PASS: POST /api/tables created table {self.created_table_id}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/tables/{self.created_table_id}")


class TestRestaurantOrdersAPI:
    """Test Restaurant Orders endpoints"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        login_res = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"

    def test_list_orders(self):
        """GET /api/orders should return orders list"""
        response = self.session.get(f"{BASE_URL}/api/orders")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "orders" in data, "Response should contain 'orders' field"
        assert isinstance(data["orders"], list), "Orders should be a list"
        print(f"PASS: GET /api/orders returns {len(data['orders'])} orders")

    def test_update_order_status(self):
        """PUT /api/orders/{order_id}/status should update order status and trigger live event"""
        # First get existing orders
        orders_res = self.session.get(f"{BASE_URL}/api/orders")
        orders = orders_res.json().get("orders", [])
        
        if not orders:
            pytest.skip("No orders available to test status update")
        
        # Find an order that can be updated
        test_order = None
        for order in orders:
            if order.get("status") in ["new", "accepted", "preparing"]:
                test_order = order
                break
        
        if not test_order:
            pytest.skip("No updatable orders found")
        
        order_id = test_order["order_id"]
        current_status = test_order["status"]
        next_status = {"new": "accepted", "accepted": "preparing", "preparing": "ready"}.get(current_status, "served")
        
        response = self.session.put(
            f"{BASE_URL}/api/orders/{order_id}/status",
            json={"status": next_status}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True, "Response should have ok=True"
        assert data.get("status") == next_status, f"Status should be {next_status}"
        print(f"PASS: PUT /api/orders/{order_id}/status updated to {next_status}")


class TestRestaurantServiceCallAPI:
    """Test Restaurant Service Call endpoints"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        login_res = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"

    def test_list_service_calls(self):
        """GET /api/service-call should return service calls list"""
        response = self.session.get(f"{BASE_URL}/api/service-call")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "service_calls" in data, "Response should contain 'service_calls' field"
        assert isinstance(data["service_calls"], list), "Service calls should be a list"
        print(f"PASS: GET /api/service-call returns {len(data['service_calls'])} calls")

    def test_create_service_call(self):
        """POST /api/service-call should create a new service call"""
        # First get a table
        tables_res = self.session.get(f"{BASE_URL}/api/tables")
        tables = tables_res.json().get("tables", [])
        
        if not tables:
            pytest.skip("No tables available to create service call")
        
        table_id = tables[0]["table_id"]
        
        response = self.session.post(
            f"{BASE_URL}/api/service-call",
            json={"table_id": table_id, "type": "service"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True, "Response should have ok=True"
        assert "service_call" in data, "Response should contain 'service_call' field"
        
        call_id = data["service_call"]["service_call_id"]
        print(f"PASS: POST /api/service-call created call {call_id}")
        
        # Mark as done to cleanup
        self.session.put(
            f"{BASE_URL}/api/service-call/{call_id}/status",
            json={"status": "done"}
        )

    def test_update_service_call_status(self):
        """PUT /api/service-call/{id}/status should update status and trigger live event"""
        # Get existing service calls
        calls_res = self.session.get(f"{BASE_URL}/api/service-call")
        calls = calls_res.json().get("service_calls", [])
        
        # Find an open call
        test_call = None
        for call in calls:
            if call.get("status") in ["open", "accepted"]:
                test_call = call
                break
        
        if not test_call:
            # Create one
            tables_res = self.session.get(f"{BASE_URL}/api/tables")
            tables = tables_res.json().get("tables", [])
            if not tables:
                pytest.skip("No tables available")
            
            create_res = self.session.post(
                f"{BASE_URL}/api/service-call",
                json={"table_id": tables[0]["table_id"], "type": "service"}
            )
            if create_res.status_code != 200:
                pytest.skip("Could not create service call")
            test_call = create_res.json()["service_call"]
        
        call_id = test_call["service_call_id"]
        current_status = test_call["status"]
        next_status = "accepted" if current_status == "open" else "done"
        
        response = self.session.put(
            f"{BASE_URL}/api/service-call/{call_id}/status",
            json={"status": next_status}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True, "Response should have ok=True"
        assert data.get("status") == next_status, f"Status should be {next_status}"
        print(f"PASS: PUT /api/service-call/{call_id}/status updated to {next_status}")


class TestPrinterDiagnostics:
    """Test Printer Diagnostics endpoints"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        login_res = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"

    def test_get_diagnostics_history(self):
        """GET /api/table-hardware/diagnostics should return diagnostics logs"""
        response = self.session.get(f"{BASE_URL}/api/table-hardware/diagnostics")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "logs" in data, "Response should contain 'logs' field"
        assert isinstance(data["logs"], list), "Logs should be a list"
        print(f"PASS: GET /api/table-hardware/diagnostics returns {len(data['logs'])} logs")

    def test_run_diagnostics(self):
        """POST /api/table-hardware/diagnostics should run diagnostics"""
        response = self.session.post(
            f"{BASE_URL}/api/table-hardware/diagnostics",
            json={"role": "kitchen"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True, "Response should have ok=True"
        assert "result" in data, "Response should contain 'result' field"
        
        result = data["result"]
        assert "role" in result, "Result should contain 'role'"
        assert "status" in result, "Result should contain 'status'"
        assert "message" in result, "Result should contain 'message'"
        print(f"PASS: POST /api/table-hardware/diagnostics - role={result['role']}, status={result['status']}")


class TestWebSocketHandshake:
    """Test WebSocket handshake on /api/restaurant/ws/{store_id}"""

    def test_websocket_connection(self):
        """WebSocket should connect with valid token"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_res = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        
        # Get WS token
        ws_token_res = session.get(f"{BASE_URL}/api/auth/ws-token")
        assert ws_token_res.status_code == 200, f"WS token failed: {ws_token_res.text}"
        token = ws_token_res.json()["token"]
        
        # Get store_id from tables
        tables_res = session.get(f"{BASE_URL}/api/tables")
        tables_data = tables_res.json()
        store_id = tables_data.get("store", {}).get("store_id") or "default"
        
        # Build WebSocket URL
        ws_base = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
        ws_url = f"{ws_base}/api/restaurant/ws/{store_id}?token={token}"
        
        # Test WebSocket connection
        async def test_ws():
            try:
                async with websockets.connect(ws_url, close_timeout=5) as ws:
                    # Wait for connected message
                    msg = await asyncio.wait_for(ws.recv(), timeout=5)
                    data = json.loads(msg)
                    assert data.get("type") == "connected", f"Expected 'connected', got {data}"
                    print(f"PASS: WebSocket connected - {data}")
                    return True
            except Exception as e:
                print(f"WebSocket error: {e}")
                return False
        
        result = asyncio.get_event_loop().run_until_complete(test_ws())
        assert result, "WebSocket connection should succeed"


class TestHardwareConfig:
    """Test Hardware Configuration endpoints"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        login_res = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"

    def test_get_hardware_config(self):
        """GET /api/table-hardware should return hardware config"""
        response = self.session.get(f"{BASE_URL}/api/table-hardware")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "printers" in data, "Response should contain 'printers' field"
        assert "button_webhook_url" in data, "Response should contain 'button_webhook_url'"
        assert "nfc_base_url" in data, "Response should contain 'nfc_base_url'"
        print(f"PASS: GET /api/table-hardware returns config with {len(data['printers'])} printers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
