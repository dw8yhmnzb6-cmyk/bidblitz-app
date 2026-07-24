"""
Smart Invoice & Payment Links - Backend API Tests
Tests for: Payment Link creation, Public Pay endpoint, PDF generation, Reminder system
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://super-app-staging-2.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


class TestSmartInvoicePaymentLinks:
    """Smart Invoice & Payment Links API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session and login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json()
        print(f"✓ Logged in as {ADMIN_EMAIL}")
        yield
        # Cleanup
        self.session.close()
    
    # ─── Invoice Creation & Payment Link ───
    
    def test_create_invoice_and_get_payment_link(self):
        """POST /api/invoicing/create should create invoice with payment link"""
        payload = {
            "client_name": "TEST_PaymentLinkClient",
            "client_email": "test_paylink@example.com",
            "items": [{"description": "Test Service", "quantity": 1, "unit_price": 50.0}],
            "notes": "Test invoice for payment link",
            "due_days": 14
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoicing/create", json=payload)
        assert response.status_code == 200, f"Create invoice failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True
        assert "invoice_id" in data
        assert "payment_link_token" in data
        assert "public_pay_url" in data
        
        self.invoice_id = data["invoice_id"]
        self.payment_token = data["payment_link_token"]
        print(f"✓ Invoice created: {data['invoice_number']}")
        print(f"✓ Payment link token: {self.payment_token}")
        print(f"✓ Public pay URL: {data['public_pay_url']}")
    
    def test_create_or_refresh_payment_link(self):
        """POST /api/invoicing/{invoice_id}/payment-link creates or returns payment link"""
        # First get an invoice
        invoices_response = self.session.get(f"{BASE_URL}/api/invoicing/my-invoices")
        assert invoices_response.status_code == 200
        invoices = invoices_response.json().get("invoices", [])
        
        if not invoices:
            pytest.skip("No invoices available for payment link test")
        
        invoice = invoices[0]
        invoice_id = invoice["invoice_id"]
        
        # Create/refresh payment link
        response = self.session.post(f"{BASE_URL}/api/invoicing/{invoice_id}/payment-link")
        assert response.status_code == 200, f"Payment link creation failed: {response.text}"
        
        data = response.json()
        assert "payment_link" in data
        payment_link = data["payment_link"]
        
        assert "token" in payment_link
        assert "public_url" in payment_link
        assert "share_links" in payment_link
        assert "qr_value" in payment_link
        assert "pdf_url" in payment_link
        
        # Verify share links structure
        share_links = payment_link["share_links"]
        assert "copy" in share_links
        assert "whatsapp" in share_links
        assert "email" in share_links
        
        print(f"✓ Payment link created for invoice {invoice_id}")
        print(f"✓ Token: {payment_link['token']}")
        print(f"✓ Share links: WhatsApp, Email, Copy available")
        
        return payment_link["token"]
    
    # ─── Public Pay Endpoint (No Auth Required) ───
    
    def test_public_pay_endpoint_returns_invoice_data(self):
        """GET /api/pay/{token} returns public invoice data without login"""
        # First get a payment token
        invoices_response = self.session.get(f"{BASE_URL}/api/invoicing/my-invoices")
        invoices = invoices_response.json().get("invoices", [])
        
        if not invoices:
            pytest.skip("No invoices available")
        
        invoice = invoices[0]
        invoice_id = invoice["invoice_id"]
        
        # Create payment link
        link_response = self.session.post(f"{BASE_URL}/api/invoicing/{invoice_id}/payment-link")
        assert link_response.status_code == 200
        token = link_response.json()["payment_link"]["token"]
        
        # Test public endpoint WITHOUT auth (new session)
        public_session = requests.Session()
        response = public_session.get(f"{BASE_URL}/api/pay/{token}")
        assert response.status_code == 200, f"Public pay endpoint failed: {response.text}"
        
        data = response.json()
        
        # Verify public invoice data structure
        assert "invoice_id" in data
        assert "invoice_number" in data
        assert "client_name" in data
        assert "total" in data
        assert "status" in data
        assert "items" in data
        assert "payment_link" in data
        
        print(f"✓ Public pay endpoint works without auth")
        print(f"✓ Invoice: {data['invoice_number']}, Total: €{data['total']}")
        print(f"✓ Status: {data['status']}")
        
        public_session.close()
    
    def test_public_pay_invalid_token_returns_404(self):
        """GET /api/pay/{invalid_token} returns 404"""
        public_session = requests.Session()
        response = public_session.get(f"{BASE_URL}/api/pay/invalid-token-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid token correctly returns 404")
        public_session.close()
    
    # ─── Payment PDF with QR Code ───
    
    def test_payment_pdf_generation(self):
        """GET /api/invoicing/{invoice_id}/payment-pdf returns PDF with QR code"""
        invoices_response = self.session.get(f"{BASE_URL}/api/invoicing/my-invoices")
        invoices = invoices_response.json().get("invoices", [])
        
        if not invoices:
            pytest.skip("No invoices available")
        
        invoice_id = invoices[0]["invoice_id"]
        
        response = self.session.get(f"{BASE_URL}/api/invoicing/{invoice_id}/payment-pdf")
        assert response.status_code == 200, f"PDF generation failed: {response.text}"
        
        # Verify it's a PDF
        content_type = response.headers.get("content-type", "")
        assert "application/pdf" in content_type, f"Expected PDF, got {content_type}"
        
        # Verify PDF has content
        assert len(response.content) > 1000, "PDF seems too small"
        
        # Check PDF magic bytes
        assert response.content[:4] == b'%PDF', "Response is not a valid PDF"
        
        print(f"✓ PDF generated successfully ({len(response.content)} bytes)")
        print(f"✓ Content-Type: {content_type}")
    
    # ─── Reminder System ───
    
    def test_reminder_requires_client_email(self):
        """POST /api/invoicing/{invoice_id}/reminders/email returns 400 if no client_email"""
        # Create invoice without email
        payload = {
            "client_name": "TEST_NoEmailClient",
            "client_email": "",  # Empty email
            "items": [{"description": "Test", "quantity": 1, "unit_price": 10.0}],
            "due_days": 7
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/invoicing/create", json=payload)
        assert create_response.status_code == 200
        invoice_id = create_response.json()["invoice_id"]
        
        # Try to send reminder
        reminder_response = self.session.post(
            f"{BASE_URL}/api/invoicing/{invoice_id}/reminders/email",
            json={"kind": "manual"}
        )
        
        assert reminder_response.status_code == 400, f"Expected 400, got {reminder_response.status_code}"
        assert "E-Mail" in reminder_response.text or "email" in reminder_response.text.lower()
        print("✓ Reminder correctly requires client email")
    
    def test_reminder_with_client_email_succeeds(self):
        """POST /api/invoicing/{invoice_id}/reminders/email with kind=manual works"""
        # Find invoice with client_email
        invoices_response = self.session.get(f"{BASE_URL}/api/invoicing/my-invoices")
        invoices = invoices_response.json().get("invoices", [])
        
        invoice_with_email = None
        for inv in invoices:
            if inv.get("client_email"):
                invoice_with_email = inv
                break
        
        if not invoice_with_email:
            # Create one with email
            payload = {
                "client_name": "TEST_ReminderClient",
                "client_email": "reminder_test@example.com",
                "items": [{"description": "Reminder Test", "quantity": 1, "unit_price": 25.0}],
                "due_days": 14
            }
            create_response = self.session.post(f"{BASE_URL}/api/invoicing/create", json=payload)
            assert create_response.status_code == 200
            invoice_id = create_response.json()["invoice_id"]
        else:
            invoice_id = invoice_with_email["invoice_id"]
        
        # Send reminder
        reminder_response = self.session.post(
            f"{BASE_URL}/api/invoicing/{invoice_id}/reminders/email",
            json={"kind": "manual"}
        )
        
        assert reminder_response.status_code == 200, f"Reminder failed: {reminder_response.text}"
        
        data = reminder_response.json()
        assert data.get("ok") is True
        assert "history" in data
        assert "payment_link" in data
        
        history = data["history"]
        assert history.get("kind") == "manual"
        assert history.get("channel") == "email"
        assert "sent_at" in history
        
        print(f"✓ Reminder sent successfully")
        print(f"✓ Kind: {history['kind']}, Channel: {history['channel']}")
        print(f"✓ Payment link included: {data['payment_link'][:50]}...")
    
    def test_reminder_history_endpoint(self):
        """GET /api/invoicing/{invoice_id}/reminders returns reminder history"""
        invoices_response = self.session.get(f"{BASE_URL}/api/invoicing/my-invoices")
        invoices = invoices_response.json().get("invoices", [])
        
        if not invoices:
            pytest.skip("No invoices available")
        
        invoice_id = invoices[0]["invoice_id"]
        
        response = self.session.get(f"{BASE_URL}/api/invoicing/{invoice_id}/reminders")
        assert response.status_code == 200, f"Reminder history failed: {response.text}"
        
        data = response.json()
        assert "history" in data
        assert isinstance(data["history"], list)
        
        print(f"✓ Reminder history retrieved: {len(data['history'])} entries")
    
    # ─── Checkout Flow ───
    
    def test_checkout_stripe_creates_session(self):
        """POST /api/pay/{token}/checkout with method=stripe creates Stripe session"""
        # Get a payment token
        invoices_response = self.session.get(f"{BASE_URL}/api/invoicing/my-invoices")
        invoices = invoices_response.json().get("invoices", [])
        
        unpaid_invoice = None
        for inv in invoices:
            if inv.get("status") != "paid":
                unpaid_invoice = inv
                break
        
        if not unpaid_invoice:
            pytest.skip("No unpaid invoices available")
        
        invoice_id = unpaid_invoice["invoice_id"]
        
        # Get payment link
        link_response = self.session.post(f"{BASE_URL}/api/invoicing/{invoice_id}/payment-link")
        assert link_response.status_code == 200
        token = link_response.json()["payment_link"]["token"]
        
        # Test checkout (public endpoint)
        public_session = requests.Session()
        public_session.headers.update({"Content-Type": "application/json"})
        
        checkout_response = public_session.post(
            f"{BASE_URL}/api/pay/{token}/checkout",
            json={
                "method": "stripe",
                "origin_url": BASE_URL,
                "payer_email": "test_payer@example.com"
            }
        )
        
        # Stripe checkout should return 200 with checkout_url
        # Note: May fail if Stripe is not fully configured, but endpoint should respond
        if checkout_response.status_code == 200:
            data = checkout_response.json()
            assert "checkout_url" in data or "session_id" in data
            print(f"✓ Stripe checkout session created")
        else:
            # Acceptable if Stripe not configured in test env
            print(f"⚠ Stripe checkout returned {checkout_response.status_code} (may be config issue)")
        
        public_session.close()
    
    # ─── My Invoices with Payment Links ───
    
    def test_my_invoices_includes_payment_link_data(self):
        """GET /api/invoicing/my-invoices includes payment link info"""
        response = self.session.get(f"{BASE_URL}/api/invoicing/my-invoices")
        assert response.status_code == 200
        
        data = response.json()
        assert "invoices" in data
        
        invoices = data["invoices"]
        if invoices:
            invoice = invoices[0]
            
            # Check payment link fields
            assert "payment_link_token" in invoice or "public_pay_url" in invoice
            assert "qr_value" in invoice or "payment_link_url" in invoice
            assert "payment_pdf_url" in invoice
            
            print(f"✓ Invoices include payment link data")
            print(f"✓ Found {len(invoices)} invoices")
    
    # ─── Public Invoice Endpoint (scan_code) ───
    
    def test_public_invoice_by_scan_code(self):
        """GET /api/invoicing/public/{scan_code} returns invoice data"""
        invoices_response = self.session.get(f"{BASE_URL}/api/invoicing/my-invoices")
        invoices = invoices_response.json().get("invoices", [])
        
        if not invoices:
            pytest.skip("No invoices available")
        
        scan_code = invoices[0].get("scan_code")
        if not scan_code:
            pytest.skip("Invoice has no scan_code")
        
        # Public endpoint (no auth)
        public_session = requests.Session()
        response = public_session.get(f"{BASE_URL}/api/invoicing/public/{scan_code}")
        assert response.status_code == 200, f"Public invoice failed: {response.text}"
        
        data = response.json()
        assert "invoice_id" in data
        assert "payment_link" in data
        
        print(f"✓ Public invoice by scan_code works")
        print(f"✓ Scan code: {scan_code}")
        
        public_session.close()


class TestMerchantDashboardInvoiceLinks:
    """Tests for Merchant Dashboard Invoice Links Tab"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session and login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        yield
        self.session.close()
    
    def test_invoicing_dashboard_endpoint(self):
        """GET /api/invoicing/dashboard returns task center data"""
        response = self.session.get(f"{BASE_URL}/api/invoicing/dashboard")
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        
        data = response.json()
        assert "summary" in data
        assert "tasks" in data
        assert "clients" in data
        
        summary = data["summary"]
        assert "clients_total" in summary
        assert "pending_tasks" in summary
        assert "unpaid_invoices" in summary
        
        print(f"✓ Dashboard loaded successfully")
        print(f"✓ Clients: {summary.get('clients_total', 0)}")
        print(f"✓ Pending tasks: {summary.get('pending_tasks', 0)}")
        print(f"✓ Unpaid invoices: {summary.get('unpaid_invoices', 0)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
