"""
BidBlitz Charge App Backend Tests
Tests for warranty registration, invoice saving, and dashboard endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestChargeAppBackend:
    """Charge App API Tests - Warranty, Invoice, Dashboard"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with reviewer credentials"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login with reviewer credentials
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "reviewer@bidblitz.ae",
            "password": "BidBlitzReview2026!"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user_data = login_response.json()
        print(f"✓ Logged in as reviewer@bidblitz.ae")
    
    def test_01_dashboard_loads(self):
        """Test /api/charge-app/dashboard returns valid data structure"""
        response = self.session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        
        data = response.json()
        
        # Verify summary structure
        assert "summary" in data, "Missing summary in dashboard"
        summary = data["summary"]
        assert "registered_warranties" in summary
        assert "stored_invoices" in summary
        assert "coins_balance" in summary
        assert "merchants_total" in summary
        
        # Verify other sections exist
        assert "warranties" in data, "Missing warranties list"
        assert "invoices" in data, "Missing invoices list"
        assert "loyalty" in data, "Missing loyalty data"
        assert "offers" in data, "Missing offers list"
        assert "merchants" in data, "Missing merchants list"
        
        print(f"✓ Dashboard loaded: {summary['registered_warranties']} warranties, {summary['stored_invoices']} invoices, {summary['merchants_total']} merchants")
    
    def test_02_warranty_registration_success(self):
        """Test warranty registration with valid data"""
        unique_serial = f"TEST-SN-{uuid.uuid4().hex[:8].upper()}"
        
        payload = {
            "product_name": "BidBlitz Charge Pro 65W",
            "serial_number": unique_serial,
            "purchase_date": "2026-07-29",
            "merchant_name": "Test Händler",
            "invoice_number": f"INV-{uuid.uuid4().hex[:6].upper()}"
        }
        
        response = self.session.post(f"{BASE_URL}/api/charge-app/warranty/register", json=payload)
        assert response.status_code == 200, f"Warranty registration failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True, "Warranty registration did not return ok=True"
        assert "warranty" in data, "Missing warranty in response"
        
        warranty = data["warranty"]
        assert warranty["product_name"] == payload["product_name"]
        assert warranty["serial_number"] == unique_serial
        assert warranty["status"] == "active"
        assert "registration_id" in warranty
        assert warranty["registration_id"].startswith("CHG-WAR-")
        
        print(f"✓ Warranty registered: {warranty['registration_id']} for {warranty['product_name']}")
    
    def test_03_warranty_duplicate_detection(self):
        """Test that duplicate serial numbers are detected"""
        unique_serial = f"TEST-DUP-{uuid.uuid4().hex[:8].upper()}"
        
        payload = {
            "product_name": "BidBlitz Charge Pro 65W",
            "serial_number": unique_serial,
            "purchase_date": "2026-07-29",
            "merchant_name": "Test Händler",
            "invoice_number": ""
        }
        
        # First registration
        response1 = self.session.post(f"{BASE_URL}/api/charge-app/warranty/register", json=payload)
        assert response1.status_code == 200
        
        # Second registration with same serial
        response2 = self.session.post(f"{BASE_URL}/api/charge-app/warranty/register", json=payload)
        assert response2.status_code == 200
        
        data2 = response2.json()
        assert data2.get("duplicate") is True, "Duplicate warranty not detected"
        print(f"✓ Duplicate warranty correctly detected for serial {unique_serial}")
    
    def test_04_warranty_validation_missing_fields(self):
        """Test warranty registration fails with missing required fields"""
        # Missing serial number
        payload = {
            "product_name": "BidBlitz Charge Pro 65W",
            "serial_number": "",
            "purchase_date": "",
            "merchant_name": "",
            "invoice_number": ""
        }
        
        response = self.session.post(f"{BASE_URL}/api/charge-app/warranty/register", json=payload)
        assert response.status_code == 400, f"Expected 400 for missing serial, got {response.status_code}"
        print("✓ Validation correctly rejects empty serial number")
    
    def test_05_invoice_save_success(self):
        """Test invoice saving with valid data"""
        unique_invoice = f"TEST-INV-{uuid.uuid4().hex[:8].upper()}"
        
        payload = {
            "invoice_number": unique_invoice,
            "merchant_name": "Test Händler GmbH",
            "amount": 129.99,
            "purchase_date": "2026-07-29",
            "product_name": "BidBlitz Charge Kabel USB-C",
            "serial_number": f"SN-{uuid.uuid4().hex[:6].upper()}"
        }
        
        response = self.session.post(f"{BASE_URL}/api/charge-app/invoices/save", json=payload)
        assert response.status_code == 200, f"Invoice save failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True, "Invoice save did not return ok=True"
        assert "invoice" in data, "Missing invoice in response"
        
        invoice = data["invoice"]
        assert invoice["invoice_number"] == unique_invoice
        assert invoice["merchant_name"] == payload["merchant_name"]
        assert invoice["amount"] == 129.99
        assert "invoice_id" in invoice
        assert invoice["invoice_id"].startswith("CHG-INV-")
        
        print(f"✓ Invoice saved: {invoice['invoice_id']} for €{invoice['amount']}")
    
    def test_06_invoice_duplicate_detection(self):
        """Test that duplicate invoice numbers are detected"""
        unique_invoice = f"TEST-DUP-INV-{uuid.uuid4().hex[:8].upper()}"
        
        payload = {
            "invoice_number": unique_invoice,
            "merchant_name": "Test Händler",
            "amount": 50.00,
            "purchase_date": "",
            "product_name": "",
            "serial_number": ""
        }
        
        # First save
        response1 = self.session.post(f"{BASE_URL}/api/charge-app/invoices/save", json=payload)
        assert response1.status_code == 200
        
        # Second save with same invoice number
        response2 = self.session.post(f"{BASE_URL}/api/charge-app/invoices/save", json=payload)
        assert response2.status_code == 200
        
        data2 = response2.json()
        assert data2.get("duplicate") is True, "Duplicate invoice not detected"
        print(f"✓ Duplicate invoice correctly detected for {unique_invoice}")
    
    def test_07_invoice_validation_missing_fields(self):
        """Test invoice save fails with missing required fields"""
        # Missing merchant name
        payload = {
            "invoice_number": "TEST-123",
            "merchant_name": "",
            "amount": 100,
            "purchase_date": "",
            "product_name": "",
            "serial_number": ""
        }
        
        response = self.session.post(f"{BASE_URL}/api/charge-app/invoices/save", json=payload)
        assert response.status_code == 400, f"Expected 400 for missing merchant, got {response.status_code}"
        print("✓ Validation correctly rejects empty merchant name")
    
    def test_08_dashboard_shows_registered_data(self):
        """Test that dashboard reflects newly registered warranties and invoices"""
        # Register a new warranty
        unique_serial = f"VERIFY-{uuid.uuid4().hex[:8].upper()}"
        warranty_payload = {
            "product_name": "Verification Test Product",
            "serial_number": unique_serial,
            "purchase_date": "2026-07-29",
            "merchant_name": "Verify Händler",
            "invoice_number": ""
        }
        
        reg_response = self.session.post(f"{BASE_URL}/api/charge-app/warranty/register", json=warranty_payload)
        assert reg_response.status_code == 200
        
        # Fetch dashboard
        dash_response = self.session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert dash_response.status_code == 200
        
        data = dash_response.json()
        warranties = data.get("warranties", [])
        
        # Check if our warranty appears in the list
        found = any(w.get("serial_number") == unique_serial for w in warranties)
        assert found, f"Newly registered warranty {unique_serial} not found in dashboard"
        print(f"✓ Dashboard correctly shows newly registered warranty {unique_serial}")
    
    def test_09_loyalty_data_in_dashboard(self):
        """Test that loyalty data is included in dashboard"""
        response = self.session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        loyalty = data.get("loyalty", {})
        
        assert "status" in loyalty, "Missing loyalty status"
        assert "stats" in loyalty, "Missing loyalty stats"
        
        status = loyalty["status"]
        assert "coins_balance" in status or status == {}, "Missing coins_balance in loyalty status"
        
        print(f"✓ Loyalty data present in dashboard")
    
    def test_10_merchants_list_in_dashboard(self):
        """Test that merchants list is returned in dashboard"""
        response = self.session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        merchants = data.get("merchants", [])
        
        # Merchants list should be an array
        assert isinstance(merchants, list), "Merchants should be a list"
        
        if len(merchants) > 0:
            merchant = merchants[0]
            assert "business_name" in merchant, "Missing business_name in merchant"
            assert "city" in merchant, "Missing city in merchant"
            assert "category" in merchant, "Missing category in merchant"
            print(f"✓ Merchants list contains {len(merchants)} entries")
        else:
            print("✓ Merchants list is empty (no merchants in DB)")
    
    def test_11_offers_in_dashboard(self):
        """Test that offers are returned in dashboard"""
        response = self.session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        offers = data.get("offers", [])
        
        assert isinstance(offers, list), "Offers should be a list"
        assert len(offers) > 0, "Should have at least fallback offers"
        
        offer = offers[0]
        assert "title" in offer, "Missing title in offer"
        assert "description" in offer, "Missing description in offer"
        assert "offer_type" in offer, "Missing offer_type in offer"
        
        print(f"✓ Offers list contains {len(offers)} entries")
    
    def test_12_unauthenticated_access_denied(self):
        """Test that unauthenticated requests are rejected"""
        # Create a new session without login
        anon_session = requests.Session()
        anon_session.headers.update({"Content-Type": "application/json"})
        
        response = anon_session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 401, f"Expected 401 for unauthenticated, got {response.status_code}"
        print("✓ Unauthenticated access correctly denied")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
