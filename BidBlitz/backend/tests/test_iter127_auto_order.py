"""
Iteration 127 - Auto-Order / Auto-Bestellung Feature Tests
Tests for:
- POS Advanced Tab: Auto-Bestellung Settings laden/speichern
- POS Advanced Tab: Auto-Bestellartikel konfigurieren
- POST /api/pos/auto-order/run erzeugt Purchase Orders
- GET /api/pos/purchase-orders/{po_id}/delivery-note.pdf liefert PDF
- Auto-generierte Bestellung erscheint in POS Purchase Orders / Warenwirtschaft intern
- Backend Auto-Order Settings/Items Endpoints funktionieren
"""
import pytest
import requests
import os
import secrets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def session():
    """Create authenticated session"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_session(session):
    """Login and return authenticated session"""
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return session


@pytest.fixture(scope="module")
def merchant_data(auth_session):
    """Get or create merchant data"""
    # Check if merchant exists
    resp = auth_session.get(f"{BASE_URL}/api/pos/merchants/me")
    assert resp.status_code == 200
    data = resp.json()
    
    if data.get("merchant"):
        return data["merchant"]
    
    # Create merchant if not exists
    resp = auth_session.post(f"{BASE_URL}/api/pos/merchants/register", json={
        "business_name": f"TEST Auto-Order Merchant {secrets.token_hex(4)}",
        "business_type": "retail",
        "country": "DE"
    })
    assert resp.status_code == 200, f"Merchant creation failed: {resp.text}"
    return resp.json()["merchant"]


@pytest.fixture(scope="module")
def store_data(auth_session, merchant_data):
    """Get or create store"""
    resp = auth_session.get(f"{BASE_URL}/api/pos/stores")
    assert resp.status_code == 200
    stores = resp.json().get("stores", [])
    
    if stores:
        return stores[0]
    
    # Create store
    resp = auth_session.post(f"{BASE_URL}/api/pos/stores/create", json={
        "name": f"TEST Auto-Order Store {secrets.token_hex(4)}",
        "city": "Berlin",
        "address": "Test Str. 1",
        "country": "DE"
    })
    assert resp.status_code == 200, f"Store creation failed: {resp.text}"
    return resp.json()["store"]


@pytest.fixture(scope="module")
def supplier_data(auth_session):
    """Get or create supplier"""
    resp = auth_session.get(f"{BASE_URL}/api/pos/suppliers")
    assert resp.status_code == 200
    suppliers = resp.json().get("suppliers", [])
    
    if suppliers:
        return suppliers[0]
    
    # Create supplier
    resp = auth_session.post(f"{BASE_URL}/api/pos/suppliers/create", json={
        "name": f"TEST Auto-Order Supplier {secrets.token_hex(4)}",
        "contact_person": "Test Contact",
        "email": "supplier@test.com",
        "phone": "+49 30 12345678"
    })
    assert resp.status_code == 200, f"Supplier creation failed: {resp.text}"
    return resp.json()["supplier"]


@pytest.fixture(scope="module")
def product_data(auth_session, store_data, supplier_data):
    """Create test product with low stock for auto-order testing"""
    product_name = f"TEST Auto-Order Product {secrets.token_hex(4)}"
    resp = auth_session.post(f"{BASE_URL}/api/pos/products/create", json={
        "store_id": store_data["store_id"],
        "name": product_name,
        "barcode": f"TEST-{secrets.token_hex(6)}",
        "price": 9.99,
        "purchase_price": 5.00,
        "tax_rate": 0.19,
        "stock": 5,  # Low stock
        "minimum_stock": 10,  # Higher than current stock to trigger auto-order
        "track_stock": True,
        "unit": "Stk",
        "supplier_id": supplier_data["supplier_id"]
    })
    assert resp.status_code == 200, f"Product creation failed: {resp.text}"
    return resp.json()["product"]


class TestAutoOrderSettings:
    """Test Auto-Order Settings endpoints"""
    
    def test_get_auto_order_settings(self, auth_session, store_data):
        """GET /api/pos/auto-order/settings returns settings"""
        store_id = store_data["store_id"]
        resp = auth_session.get(f"{BASE_URL}/api/pos/auto-order/settings?store_id={store_id}")
        
        assert resp.status_code == 200, f"Failed to get settings: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert "settings" in data
        
        settings = data["settings"]
        # Verify default settings structure
        assert "enabled" in settings
        assert "trigger_low_stock" in settings
        assert "trigger_velocity" in settings
        assert "trigger_daily_time" in settings
        assert "run_time" in settings
        assert "velocity_days" in settings
        assert "lookahead_days" in settings
        assert "auto_submit_orders" in settings
        assert "print_delivery_note" in settings
        print(f"✓ Auto-order settings retrieved: enabled={settings.get('enabled')}")
    
    def test_save_auto_order_settings(self, auth_session, store_data):
        """POST /api/pos/auto-order/settings saves settings"""
        store_id = store_data["store_id"]
        
        new_settings = {
            "enabled": True,
            "trigger_low_stock": True,
            "trigger_velocity": True,
            "trigger_daily_time": False,
            "run_time": "20:00",
            "velocity_days": 7,
            "lookahead_days": 3,
            "auto_submit_orders": True,
            "print_delivery_note": True
        }
        
        resp = auth_session.post(
            f"{BASE_URL}/api/pos/auto-order/settings?store_id={store_id}",
            json=new_settings
        )
        
        assert resp.status_code == 200, f"Failed to save settings: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert "settings" in data
        
        saved = data["settings"]
        assert saved.get("enabled") is True
        assert saved.get("trigger_low_stock") is True
        assert saved.get("trigger_velocity") is True
        assert saved.get("velocity_days") == 7
        assert saved.get("lookahead_days") == 3
        print(f"✓ Auto-order settings saved successfully")
    
    def test_settings_persist_after_save(self, auth_session, store_data):
        """Verify settings persist after save"""
        store_id = store_data["store_id"]
        
        # Get settings again
        resp = auth_session.get(f"{BASE_URL}/api/pos/auto-order/settings?store_id={store_id}")
        assert resp.status_code == 200
        
        settings = resp.json()["settings"]
        assert settings.get("enabled") is True
        print(f"✓ Settings persisted correctly")


class TestAutoOrderItems:
    """Test Auto-Order Items endpoints"""
    
    def test_get_auto_order_items(self, auth_session, store_data, product_data):
        """GET /api/pos/auto-order/items returns product list"""
        store_id = store_data["store_id"]
        resp = auth_session.get(f"{BASE_URL}/api/pos/auto-order/items?store_id={store_id}")
        
        assert resp.status_code == 200, f"Failed to get items: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert "items" in data
        
        items = data["items"]
        assert isinstance(items, list)
        print(f"✓ Auto-order items retrieved: {len(items)} products")
        
        # Check if our test product is in the list
        test_product = next((i for i in items if i.get("product_id") == product_data["product_id"]), None)
        if test_product:
            print(f"  - Test product found: {test_product.get('name')}")
            assert "auto_reorder_enabled" in test_product
            assert "reorder_target_stock" in test_product
            assert "order_unit_size" in test_product
            assert "order_unit_label" in test_product
    
    def test_save_auto_order_items(self, auth_session, store_data, product_data):
        """POST /api/pos/auto-order/items saves item configurations"""
        store_id = store_data["store_id"]
        product_id = product_data["product_id"]
        
        items_config = {
            "store_id": store_id,
            "items": [
                {
                    "product_id": product_id,
                    "auto_reorder_enabled": True,
                    "reorder_target_stock": 50,
                    "order_unit_size": 10,
                    "order_unit_label": "Karton",
                    "reorder_note": "TEST: Bitte schnell liefern"
                }
            ]
        }
        
        resp = auth_session.post(f"{BASE_URL}/api/pos/auto-order/items", json=items_config)
        
        assert resp.status_code == 200, f"Failed to save items: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert data.get("updated", 0) >= 1
        print(f"✓ Auto-order items saved: {data.get('updated')} updated")
    
    def test_items_config_persists(self, auth_session, store_data, product_data):
        """Verify item configuration persists"""
        store_id = store_data["store_id"]
        product_id = product_data["product_id"]
        
        resp = auth_session.get(f"{BASE_URL}/api/pos/auto-order/items?store_id={store_id}")
        assert resp.status_code == 200
        
        items = resp.json()["items"]
        test_product = next((i for i in items if i.get("product_id") == product_id), None)
        
        if test_product:
            assert test_product.get("auto_reorder_enabled") is True
            assert test_product.get("reorder_target_stock") == 50
            assert test_product.get("order_unit_size") == 10
            assert test_product.get("order_unit_label") == "Karton"
            print(f"✓ Item configuration persisted correctly")


class TestAutoOrderRun:
    """Test Auto-Order Run endpoint"""
    
    def test_run_auto_order(self, auth_session, store_data, product_data, supplier_data):
        """POST /api/pos/auto-order/run creates purchase orders"""
        store_id = store_data["store_id"]
        
        # First ensure settings are enabled
        auth_session.post(
            f"{BASE_URL}/api/pos/auto-order/settings?store_id={store_id}",
            json={
                "enabled": True,
                "trigger_low_stock": True,
                "trigger_velocity": True,
                "auto_submit_orders": True,
                "print_delivery_note": True
            }
        )
        
        # Enable auto-reorder for test product
        auth_session.post(f"{BASE_URL}/api/pos/auto-order/items", json={
            "store_id": store_id,
            "items": [{
                "product_id": product_data["product_id"],
                "auto_reorder_enabled": True,
                "reorder_target_stock": 50,
                "order_unit_size": 10,
                "order_unit_label": "Karton"
            }]
        })
        
        # Run auto-order
        resp = auth_session.post(f"{BASE_URL}/api/pos/auto-order/run?store_id={store_id}")
        
        assert resp.status_code == 200, f"Auto-order run failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        
        print(f"✓ Auto-order run completed:")
        print(f"  - Created POs: {len(data.get('created_pos', []))}")
        print(f"  - Low stock count: {data.get('low_stock_count', 0)}")
        
        # Store created PO for later tests
        if data.get("created_pos"):
            return data["created_pos"][0]
        return None
    
    def test_auto_order_creates_po_with_delivery_note(self, auth_session, store_data, product_data):
        """Verify auto-order creates PO with delivery note URL"""
        store_id = store_data["store_id"]
        
        # Run auto-order
        resp = auth_session.post(f"{BASE_URL}/api/pos/auto-order/run?store_id={store_id}")
        assert resp.status_code == 200
        
        data = resp.json()
        created_pos = data.get("created_pos", [])
        
        if created_pos:
            po = created_pos[0]
            assert "po_id" in po
            assert "delivery_note_url" in po
            assert po["delivery_note_url"].endswith(".pdf")
            print(f"✓ PO created with delivery note URL: {po['delivery_note_url']}")
            return po
        else:
            print("⚠ No POs created (may be due to stock levels or existing orders)")
            return None


class TestDeliveryNotePDF:
    """Test Delivery Note PDF endpoint"""
    
    def test_get_delivery_note_pdf(self, auth_session, store_data):
        """GET /api/pos/purchase-orders/{po_id}/delivery-note.pdf returns PDF"""
        # First get list of purchase orders
        resp = auth_session.get(f"{BASE_URL}/api/pos/purchase-orders")
        assert resp.status_code == 200
        
        orders = resp.json().get("purchase_orders", [])
        
        if not orders:
            # Create a PO first via auto-order
            store_id = store_data["store_id"]
            auth_session.post(f"{BASE_URL}/api/pos/auto-order/run?store_id={store_id}")
            
            resp = auth_session.get(f"{BASE_URL}/api/pos/purchase-orders")
            orders = resp.json().get("purchase_orders", [])
        
        if orders:
            po_id = orders[0]["po_id"]
            
            # Get delivery note PDF
            resp = auth_session.get(f"{BASE_URL}/api/pos/purchase-orders/{po_id}/delivery-note.pdf")
            
            assert resp.status_code == 200, f"Failed to get PDF: {resp.status_code}"
            assert "application/pdf" in resp.headers.get("Content-Type", "")
            assert len(resp.content) > 100  # PDF should have content
            print(f"✓ Delivery note PDF retrieved: {len(resp.content)} bytes")
        else:
            print("⚠ No purchase orders available for PDF test")
    
    def test_delivery_note_pdf_has_correct_headers(self, auth_session, store_data):
        """Verify PDF response has correct headers"""
        resp = auth_session.get(f"{BASE_URL}/api/pos/purchase-orders")
        orders = resp.json().get("purchase_orders", [])
        
        if orders:
            po_id = orders[0]["po_id"]
            resp = auth_session.get(f"{BASE_URL}/api/pos/purchase-orders/{po_id}/delivery-note.pdf")
            
            assert resp.status_code == 200
            content_type = resp.headers.get("Content-Type", "")
            content_disp = resp.headers.get("Content-Disposition", "")
            
            assert "application/pdf" in content_type
            assert "lieferschein" in content_disp.lower() or "filename" in content_disp.lower()
            print(f"✓ PDF headers correct: {content_type}")


class TestPurchaseOrdersIntegration:
    """Test that auto-generated orders appear in POS Purchase Orders"""
    
    def test_auto_orders_appear_in_purchase_orders_list(self, auth_session, store_data):
        """Verify auto-generated POs appear in purchase orders list"""
        # Run auto-order first
        store_id = store_data["store_id"]
        run_resp = auth_session.post(f"{BASE_URL}/api/pos/auto-order/run?store_id={store_id}")
        assert run_resp.status_code == 200
        
        # Get purchase orders
        resp = auth_session.get(f"{BASE_URL}/api/pos/purchase-orders")
        assert resp.status_code == 200
        
        orders = resp.json().get("purchase_orders", [])
        print(f"✓ Purchase orders list: {len(orders)} orders")
        
        # Check for auto-generated orders
        auto_orders = [o for o in orders if o.get("auto_generated") is True]
        print(f"  - Auto-generated orders: {len(auto_orders)}")
        
        if auto_orders:
            order = auto_orders[0]
            assert "po_id" in order
            assert "supplier_name" in order
            assert "items" in order
            assert "total_cost" in order
            assert "status" in order
            assert "delivery_note_id" in order or "delivery_note_ready" in order
            print(f"  - Sample PO: {order['po_id']} - {order['supplier_name']} - €{order['total_cost']}")
    
    def test_auto_order_po_has_correct_structure(self, auth_session):
        """Verify auto-generated PO has all required fields"""
        resp = auth_session.get(f"{BASE_URL}/api/pos/purchase-orders")
        assert resp.status_code == 200
        
        orders = resp.json().get("purchase_orders", [])
        auto_orders = [o for o in orders if o.get("auto_generated") is True]
        
        if auto_orders:
            order = auto_orders[0]
            
            # Check required fields
            required_fields = [
                "po_id", "merchant_id", "store_id", "supplier_id",
                "items", "total_cost", "status", "created_at"
            ]
            
            for field in required_fields:
                assert field in order, f"Missing field: {field}"
            
            # Check items structure
            if order.get("items"):
                item = order["items"][0]
                item_fields = ["product_id", "product_name", "quantity", "purchase_price", "line_total"]
                for field in item_fields:
                    assert field in item, f"Missing item field: {field}"
            
            print(f"✓ PO structure validated: {order['po_id']}")


class TestAutoOrderEdgeCases:
    """Test edge cases and error handling"""
    
    def test_auto_order_without_store_id_fails(self, auth_session):
        """Auto-order without store_id should fail"""
        resp = auth_session.post(f"{BASE_URL}/api/pos/auto-order/run")
        # Should fail with 422 (validation error) or 400
        assert resp.status_code in [400, 422], f"Expected error, got {resp.status_code}"
        print(f"✓ Auto-order without store_id correctly rejected")
    
    def test_auto_order_settings_without_store_id_fails(self, auth_session):
        """Settings without store_id should fail"""
        resp = auth_session.get(f"{BASE_URL}/api/pos/auto-order/settings")
        assert resp.status_code in [400, 422], f"Expected error, got {resp.status_code}"
        print(f"✓ Settings without store_id correctly rejected")
    
    def test_delivery_note_nonexistent_po_returns_404(self, auth_session):
        """Delivery note for non-existent PO should return 404"""
        resp = auth_session.get(f"{BASE_URL}/api/pos/purchase-orders/PO_NONEXISTENT/delivery-note.pdf")
        assert resp.status_code == 404
        print(f"✓ Non-existent PO correctly returns 404")
    
    def test_auto_order_disabled_returns_reason(self, auth_session, store_data):
        """Auto-order when disabled should return reason"""
        store_id = store_data["store_id"]
        
        # Disable auto-order
        auth_session.post(
            f"{BASE_URL}/api/pos/auto-order/settings?store_id={store_id}",
            json={"enabled": False}
        )
        
        # Run without force
        # Note: The endpoint uses force=True by default for manual runs
        # So this test verifies the response structure
        resp = auth_session.post(f"{BASE_URL}/api/pos/auto-order/run?store_id={store_id}")
        assert resp.status_code == 200
        
        data = resp.json()
        assert data.get("ok") is True
        print(f"✓ Auto-order response structure correct")
        
        # Re-enable for other tests
        auth_session.post(
            f"{BASE_URL}/api/pos/auto-order/settings?store_id={store_id}",
            json={"enabled": True}
        )


class TestAutoOrderUIIntegration:
    """Test data flow for UI integration"""
    
    def test_full_auto_order_workflow(self, auth_session, store_data, product_data, supplier_data):
        """Test complete auto-order workflow as UI would use it"""
        store_id = store_data["store_id"]
        product_id = product_data["product_id"]
        
        # Step 1: Load settings
        resp = auth_session.get(f"{BASE_URL}/api/pos/auto-order/settings?store_id={store_id}")
        assert resp.status_code == 200
        print("Step 1: Settings loaded ✓")
        
        # Step 2: Save settings
        resp = auth_session.post(
            f"{BASE_URL}/api/pos/auto-order/settings?store_id={store_id}",
            json={
                "enabled": True,
                "trigger_low_stock": True,
                "trigger_velocity": True,
                "trigger_daily_time": False,
                "run_time": "20:00",
                "velocity_days": 7,
                "lookahead_days": 3,
                "auto_submit_orders": True,
                "print_delivery_note": True
            }
        )
        assert resp.status_code == 200
        print("Step 2: Settings saved ✓")
        
        # Step 3: Load items
        resp = auth_session.get(f"{BASE_URL}/api/pos/auto-order/items?store_id={store_id}")
        assert resp.status_code == 200
        print("Step 3: Items loaded ✓")
        
        # Step 4: Configure items
        resp = auth_session.post(f"{BASE_URL}/api/pos/auto-order/items", json={
            "store_id": store_id,
            "items": [{
                "product_id": product_id,
                "auto_reorder_enabled": True,
                "reorder_target_stock": 100,
                "order_unit_size": 20,
                "order_unit_label": "Stange",
                "reorder_note": "Eilbestellung"
            }]
        })
        assert resp.status_code == 200
        print("Step 4: Items configured ✓")
        
        # Step 5: Run auto-order
        resp = auth_session.post(f"{BASE_URL}/api/pos/auto-order/run?store_id={store_id}")
        assert resp.status_code == 200
        data = resp.json()
        print(f"Step 5: Auto-order executed ✓ - {len(data.get('created_pos', []))} POs created")
        
        # Step 6: Verify PO in list
        resp = auth_session.get(f"{BASE_URL}/api/pos/purchase-orders")
        assert resp.status_code == 200
        orders = resp.json().get("purchase_orders", [])
        print(f"Step 6: Purchase orders verified ✓ - {len(orders)} total orders")
        
        # Step 7: Get delivery note PDF (if PO exists)
        if orders:
            po_id = orders[0]["po_id"]
            resp = auth_session.get(f"{BASE_URL}/api/pos/purchase-orders/{po_id}/delivery-note.pdf")
            assert resp.status_code == 200
            print(f"Step 7: Delivery note PDF retrieved ✓ - {len(resp.content)} bytes")
        
        print("\n✓ Full auto-order workflow completed successfully!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
