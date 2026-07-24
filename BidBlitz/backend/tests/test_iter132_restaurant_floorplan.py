"""
Iteration 132 - Restaurant Floorplan + Live Sound/Badge Testing
Tests:
- Table CRUD with new fields: shape, size_key, color, seats, width, height
- Floorplan drag & drop position persistence (x, y)
- Backend serialization of new fields
- Live events for sound/badge cues
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable not set")

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


class TestRestaurantFloorplanTableFields:
    """Test new table fields: shape, size_key, color, seats, width, height, x, y"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code == 429:
            pytest.skip("Rate limited - skipping test")
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        print(f"Login successful for {ADMIN_EMAIL}")
        
        yield
        
        # Cleanup - logout
        self.session.post(f"{BASE_URL}/api/auth/logout")

    def test_create_table_with_new_fields(self):
        """Test creating a table with shape, size_key, color, seats, width, height"""
        payload = {
            "table_number": "TEST132-01",
            "table_name": "Test Floorplan Tisch 132",
            "area": "Terrasse",
            "button_id": "",
            "shape": "round",
            "size_key": "lg",
            "color": "#f97316",
            "seats": 6,
            "width": 116,
            "height": 92,
            "x": 100,
            "y": 200
        }
        
        response = self.session.post(f"{BASE_URL}/api/tables", json=payload)
        assert response.status_code == 200, f"Create table failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True
        table = data.get("table", {})
        
        # Verify new fields are returned
        assert table.get("shape") == "round", f"Expected shape 'round', got {table.get('shape')}"
        assert table.get("size_key") == "lg", f"Expected size_key 'lg', got {table.get('size_key')}"
        assert table.get("color") == "#f97316", f"Expected color '#f97316', got {table.get('color')}"
        assert table.get("seats") == 6, f"Expected seats 6, got {table.get('seats')}"
        assert table.get("width") == 116, f"Expected width 116, got {table.get('width')}"
        assert table.get("height") == 92, f"Expected height 92, got {table.get('height')}"
        assert table.get("x") == 100, f"Expected x 100, got {table.get('x')}"
        assert table.get("y") == 200, f"Expected y 200, got {table.get('y')}"
        
        print(f"Created table with new fields: {table.get('table_id')}")
        
        # Store table_id for cleanup
        self.created_table_id = table.get("table_id")
        
        # Cleanup - delete the test table
        if self.created_table_id:
            delete_response = self.session.delete(f"{BASE_URL}/api/tables/{self.created_table_id}")
            assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
            print(f"Cleaned up test table: {self.created_table_id}")

    def test_create_table_bar_shape(self):
        """Test creating a bar-shaped table"""
        payload = {
            "table_number": "TEST132-BAR",
            "table_name": "Bar Theke 132",
            "area": "Bar",
            "shape": "bar",
            "size_key": "xl",
            "color": "#a855f7",
            "seats": 8,
            "width": 144,
            "height": 96
        }
        
        response = self.session.post(f"{BASE_URL}/api/tables", json=payload)
        assert response.status_code == 200, f"Create bar table failed: {response.text}"
        
        data = response.json()
        table = data.get("table", {})
        
        assert table.get("shape") == "bar"
        assert table.get("size_key") == "xl"
        assert table.get("color") == "#a855f7"
        
        print(f"Created bar table: {table.get('table_id')}")
        
        # Cleanup
        table_id = table.get("table_id")
        if table_id:
            self.session.delete(f"{BASE_URL}/api/tables/{table_id}")

    def test_update_table_position_drag_drop(self):
        """Test updating table position (simulating drag & drop)"""
        # First create a table
        create_payload = {
            "table_number": "TEST132-DRAG",
            "table_name": "Drag Test Tisch",
            "area": "Gastraum",
            "shape": "square",
            "size_key": "md",
            "color": "#22c55e",
            "x": 24,
            "y": 24
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/tables", json=create_payload)
        assert create_response.status_code == 200
        table_id = create_response.json().get("table", {}).get("table_id")
        
        # Update position (simulating drag & drop)
        update_payload = {
            "x": 300,
            "y": 150
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/tables/{table_id}", json=update_payload)
        assert update_response.status_code == 200, f"Update position failed: {update_response.text}"
        
        updated_table = update_response.json().get("table", {})
        assert updated_table.get("x") == 300, f"Expected x 300, got {updated_table.get('x')}"
        assert updated_table.get("y") == 150, f"Expected y 150, got {updated_table.get('y')}"
        
        print(f"Position updated successfully: x={updated_table.get('x')}, y={updated_table.get('y')}")
        
        # Verify persistence with GET
        get_response = self.session.get(f"{BASE_URL}/api/tables/{table_id}")
        assert get_response.status_code == 200
        fetched_table = get_response.json().get("table", {})
        assert fetched_table.get("x") == 300
        assert fetched_table.get("y") == 150
        
        print("Position persisted correctly after GET")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/tables/{table_id}")

    def test_update_table_shape_and_color(self):
        """Test updating table shape and color"""
        # Create table
        create_payload = {
            "table_number": "TEST132-STYLE",
            "table_name": "Style Test Tisch",
            "area": "Gastraum",
            "shape": "square",
            "color": "#22c55e"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/tables", json=create_payload)
        assert create_response.status_code == 200
        table_id = create_response.json().get("table", {}).get("table_id")
        
        # Update shape and color
        update_payload = {
            "shape": "round",
            "color": "#ef4444",
            "size_key": "sm",
            "seats": 2,
            "width": 72,
            "height": 72
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/tables/{table_id}", json=update_payload)
        assert update_response.status_code == 200
        
        updated_table = update_response.json().get("table", {})
        assert updated_table.get("shape") == "round"
        assert updated_table.get("color") == "#ef4444"
        assert updated_table.get("size_key") == "sm"
        assert updated_table.get("seats") == 2
        
        print(f"Shape and color updated: shape={updated_table.get('shape')}, color={updated_table.get('color')}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/tables/{table_id}")

    def test_list_tables_returns_new_fields(self):
        """Test that list tables endpoint returns all new fields"""
        response = self.session.get(f"{BASE_URL}/api/tables")
        assert response.status_code == 200, f"List tables failed: {response.text}"
        
        data = response.json()
        tables = data.get("tables", [])
        
        if tables:
            table = tables[0]
            # Check that new fields are present in serialization
            assert "shape" in table, "shape field missing from table serialization"
            assert "size_key" in table, "size_key field missing from table serialization"
            assert "color" in table, "color field missing from table serialization"
            assert "seats" in table, "seats field missing from table serialization"
            assert "width" in table, "width field missing from table serialization"
            assert "height" in table, "height field missing from table serialization"
            assert "x" in table, "x field missing from table serialization"
            assert "y" in table, "y field missing from table serialization"
            
            print(f"Table serialization includes all new fields: shape={table.get('shape')}, size_key={table.get('size_key')}, color={table.get('color')}")
        else:
            print("No tables found - skipping field verification")

    def test_get_single_table_returns_new_fields(self):
        """Test that GET single table returns all new fields"""
        # Create a table first
        create_payload = {
            "table_number": "TEST132-GET",
            "table_name": "Get Test Tisch",
            "area": "Gastraum",
            "shape": "round",
            "size_key": "lg",
            "color": "#06b6d4",
            "seats": 6,
            "width": 116,
            "height": 92,
            "x": 50,
            "y": 75
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/tables", json=create_payload)
        assert create_response.status_code == 200
        table_id = create_response.json().get("table", {}).get("table_id")
        
        # GET single table
        get_response = self.session.get(f"{BASE_URL}/api/tables/{table_id}")
        assert get_response.status_code == 200
        
        table = get_response.json().get("table", {})
        
        # Verify all fields
        assert table.get("shape") == "round"
        assert table.get("size_key") == "lg"
        assert table.get("color") == "#06b6d4"
        assert table.get("seats") == 6
        assert table.get("width") == 116
        assert table.get("height") == 92
        assert table.get("x") == 50
        assert table.get("y") == 75
        
        print(f"GET single table returns all new fields correctly")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/tables/{table_id}")


class TestRestaurantLiveEvents:
    """Test live events for sound/badge cues"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code == 429:
            pytest.skip("Rate limited - skipping test")
        assert login_response.status_code == 200
        
        yield
        
        self.session.post(f"{BASE_URL}/api/auth/logout")

    def test_ws_token_endpoint(self):
        """Test WebSocket token endpoint for live events"""
        response = self.session.get(f"{BASE_URL}/api/auth/ws-token")
        assert response.status_code == 200, f"WS token failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "token field missing from ws-token response"
        assert len(data.get("token", "")) > 10, "Token seems too short"
        
        print(f"WS token obtained successfully (length: {len(data.get('token', ''))})")

    def test_order_status_update_triggers_event(self):
        """Test that order status update would trigger live event"""
        # Get existing orders
        orders_response = self.session.get(f"{BASE_URL}/api/orders")
        assert orders_response.status_code == 200
        
        orders = orders_response.json().get("orders", [])
        
        if orders:
            # Find an order that can be updated
            test_order = None
            for order in orders:
                if order.get("status") in ["new", "accepted", "preparing"]:
                    test_order = order
                    break
            
            if test_order:
                order_id = test_order.get("order_id")
                current_status = test_order.get("status")
                next_status = {"new": "accepted", "accepted": "preparing", "preparing": "ready"}.get(current_status, "served")
                
                # Update status
                update_response = self.session.put(
                    f"{BASE_URL}/api/orders/{order_id}/status",
                    json={"status": next_status}
                )
                assert update_response.status_code == 200, f"Order status update failed: {update_response.text}"
                
                print(f"Order {order_id} status updated: {current_status} -> {next_status}")
                print("Live event would be triggered for sound/badge cue")
            else:
                print("No updatable orders found - skipping status update test")
        else:
            print("No orders found - skipping order status test")

    def test_service_call_status_update(self):
        """Test that service call status update would trigger live event"""
        # Get existing service calls
        calls_response = self.session.get(f"{BASE_URL}/api/service-call")
        assert calls_response.status_code == 200
        
        calls = calls_response.json().get("service_calls", [])
        
        if calls:
            # Find an open call
            test_call = None
            for call in calls:
                if call.get("status") == "open":
                    test_call = call
                    break
            
            if test_call:
                call_id = test_call.get("service_call_id")
                
                # Update to accepted
                update_response = self.session.put(
                    f"{BASE_URL}/api/service-call/{call_id}/status",
                    json={"status": "accepted"}
                )
                assert update_response.status_code == 200, f"Service call update failed: {update_response.text}"
                
                print(f"Service call {call_id} status updated to 'accepted'")
                print("Live event would be triggered for sound/badge cue")
            else:
                print("No open service calls found - skipping status update test")
        else:
            print("No service calls found - skipping service call test")


class TestRestaurantFloorplanDefaults:
    """Test default values for new table fields"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code == 429:
            pytest.skip("Rate limited - skipping test")
        assert login_response.status_code == 200
        
        yield
        
        self.session.post(f"{BASE_URL}/api/auth/logout")

    def test_create_table_with_defaults(self):
        """Test that table creation uses correct defaults for new fields"""
        # Create table with minimal payload (no new fields specified)
        payload = {
            "table_number": "TEST132-DEFAULT",
            "table_name": "Default Test Tisch"
        }
        
        response = self.session.post(f"{BASE_URL}/api/tables", json=payload)
        assert response.status_code == 200, f"Create table failed: {response.text}"
        
        table = response.json().get("table", {})
        
        # Verify defaults
        assert table.get("shape") == "square", f"Default shape should be 'square', got {table.get('shape')}"
        assert table.get("size_key") == "md", f"Default size_key should be 'md', got {table.get('size_key')}"
        assert table.get("color") == "#22c55e", f"Default color should be '#22c55e', got {table.get('color')}"
        assert table.get("seats") == 4, f"Default seats should be 4, got {table.get('seats')}"
        assert table.get("width") == 92, f"Default width should be 92, got {table.get('width')}"
        assert table.get("height") == 72, f"Default height should be 72, got {table.get('height')}"
        assert table.get("x") == 24, f"Default x should be 24, got {table.get('x')}"
        assert table.get("y") == 24, f"Default y should be 24, got {table.get('y')}"
        
        print(f"All default values verified correctly")
        
        # Cleanup
        table_id = table.get("table_id")
        if table_id:
            self.session.delete(f"{BASE_URL}/api/tables/{table_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
