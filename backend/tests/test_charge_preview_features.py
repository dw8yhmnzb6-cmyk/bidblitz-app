"""
Charge App Document Preview Features - Backend Tests
Tests for: invoice/warranty attachment preview, merchant detail customer_context, protected blob download
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://super-app-staging-2.preview.emergentagent.com"

# Test credentials from test_credentials.md
REVIEWER_EMAIL = "reviewer@bidblitz.ae"
REVIEWER_PASSWORD = "BidBlitzReview2026!"


class TestChargePreviewFeatures:
    """Test Charge App document preview features"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": REVIEWER_EMAIL, "password": REVIEWER_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        yield
        # Logout
        try:
            self.session.post(f"{BASE_URL}/api/auth/logout")
        except Exception:
            pass

    # ─── Dashboard Tests ───
    def test_dashboard_loads_with_preview_metadata(self):
        """Dashboard returns warranties and invoices with attachment preview metadata"""
        response = self.session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "warranties" in data
        assert "invoices" in data
        assert "merchants" in data
        assert "personalized_offers" in data
        assert "summary" in data
        
        # Check summary fields
        summary = data["summary"]
        assert "registered_warranties" in summary
        assert "stored_invoices" in summary
        assert "merchants_total" in summary
        
        # If warranties exist, check attachment metadata
        for warranty in data.get("warranties", []):
            assert "registration_id" in warranty
            assert "attachments" in warranty
            for attachment in warranty.get("attachments", []):
                assert "attachment_id" in attachment
                assert "download_path" in attachment
                assert "preview_mode" in attachment
                assert "preview_supported" in attachment
                assert "content_type" in attachment
                assert "original_filename" in attachment
        
        # If invoices exist, check attachment metadata
        for invoice in data.get("invoices", []):
            assert "invoice_id" in invoice
            assert "attachments" in invoice
            for attachment in invoice.get("attachments", []):
                assert "attachment_id" in attachment
                assert "download_path" in attachment
                assert "preview_mode" in attachment
                assert "preview_supported" in attachment

    # ─── Warranty Registration & Attachment Tests ───
    def test_warranty_registration_returns_attachment_metadata(self):
        """Register warranty and verify attachment metadata structure"""
        import uuid
        serial = f"TEST-PREVIEW-{uuid.uuid4().hex[:8].upper()}"
        
        response = self.session.post(
            f"{BASE_URL}/api/charge-app/warranty/register",
            json={
                "product_name": "Test Preview Charger",
                "serial_number": serial,
                "purchase_date": "2026-07-30",
                "merchant_name": "Test Preview Merchant",
                "invoice_number": f"INV-{serial}"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") is True
        
        warranty = data.get("warranty", {})
        assert "registration_id" in warranty
        assert "attachments" in warranty
        assert "warranty_pass" in warranty
        
        # Warranty pass should have QR payload
        warranty_pass = warranty.get("warranty_pass", {})
        assert "pass_id" in warranty_pass
        assert "qr_payload" in warranty_pass

    def test_warranty_attachment_upload_returns_preview_metadata(self):
        """Upload warranty attachment and verify preview metadata"""
        import uuid
        serial = f"TEST-ATT-{uuid.uuid4().hex[:8].upper()}"
        
        # First register warranty
        reg_response = self.session.post(
            f"{BASE_URL}/api/charge-app/warranty/register",
            json={
                "product_name": "Test Attachment Charger",
                "serial_number": serial,
                "purchase_date": "2026-07-30",
                "merchant_name": "Test Attachment Merchant",
                "invoice_number": f"INV-{serial}"
            }
        )
        assert reg_response.status_code == 200
        registration_id = reg_response.json().get("warranty", {}).get("registration_id")
        assert registration_id
        
        # Upload a test file (simulated PNG) - use fresh session for multipart
        upload_session = requests.Session()
        # Copy cookies from main session
        upload_session.cookies.update(self.session.cookies)
        files = {
            "file": ("test-warranty-proof.png", b"\x89PNG\r\n\x1a\n" + b"test content", "image/png")
        }
        upload_response = upload_session.post(
            f"{BASE_URL}/api/charge-app/warranty/{registration_id}/attachments",
            files=files
        )
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        upload_data = upload_response.json()
        assert upload_data.get("ok") is True
        
        # Verify attachment metadata
        attachment = upload_data.get("attachment", {})
        assert "attachment_id" in attachment
        assert "download_path" in attachment
        assert "preview_mode" in attachment
        assert attachment.get("preview_mode") == "image"
        assert attachment.get("preview_supported") is True
        assert "content_type" in attachment

    def test_warranty_attachment_download_endpoint(self):
        """Test warranty attachment download endpoint returns file"""
        import uuid
        serial = f"TEST-DL-{uuid.uuid4().hex[:8].upper()}"
        
        # Register warranty
        reg_response = self.session.post(
            f"{BASE_URL}/api/charge-app/warranty/register",
            json={
                "product_name": "Test Download Charger",
                "serial_number": serial,
                "purchase_date": "2026-07-30",
                "merchant_name": "Test Download Merchant",
                "invoice_number": f"INV-{serial}"
            }
        )
        assert reg_response.status_code == 200
        registration_id = reg_response.json().get("warranty", {}).get("registration_id")
        
        # Upload attachment - use fresh session for multipart
        upload_session = requests.Session()
        upload_session.cookies.update(self.session.cookies)
        files = {
            "file": ("test-download.pdf", b"%PDF-1.4 test content", "application/pdf")
        }
        upload_response = upload_session.post(
            f"{BASE_URL}/api/charge-app/warranty/{registration_id}/attachments",
            files=files
        )
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        attachment_id = upload_response.json().get("attachment", {}).get("attachment_id")
        
        # Download attachment
        download_response = self.session.get(
            f"{BASE_URL}/api/charge-app/warranty/{registration_id}/attachments/{attachment_id}/download"
        )
        assert download_response.status_code == 200
        assert "Content-Disposition" in download_response.headers
        assert len(download_response.content) > 0

    # ─── Invoice Save & Attachment Tests ───
    def test_invoice_save_returns_correct_structure(self):
        """Save invoice and verify response structure (attachments added via dashboard)"""
        import uuid
        invoice_num = f"TEST-INV-{uuid.uuid4().hex[:8].upper()}"
        
        response = self.session.post(
            f"{BASE_URL}/api/charge-app/invoices/save",
            json={
                "invoice_number": invoice_num,
                "merchant_name": "Test Invoice Merchant",
                "amount": 99.99,
                "purchase_date": "2026-07-30",
                "product_name": "Test Invoice Product",
                "serial_number": f"SN-{invoice_num}"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") is True
        
        invoice = data.get("invoice", {})
        assert "invoice_id" in invoice
        assert "invoice_number" in invoice
        assert "merchant_name" in invoice
        # Note: attachments field is added by _invoice_card() in dashboard, not in save response

    def test_invoice_attachment_upload_returns_preview_metadata(self):
        """Upload invoice attachment and verify preview metadata"""
        import uuid
        invoice_num = f"TEST-ATT-INV-{uuid.uuid4().hex[:8].upper()}"
        
        # First save invoice
        save_response = self.session.post(
            f"{BASE_URL}/api/charge-app/invoices/save",
            json={
                "invoice_number": invoice_num,
                "merchant_name": "Test Attachment Invoice Merchant",
                "amount": 149.99,
                "purchase_date": "2026-07-30",
                "product_name": "Test Attachment Invoice Product"
            }
        )
        assert save_response.status_code == 200
        invoice_id = save_response.json().get("invoice", {}).get("invoice_id")
        assert invoice_id
        
        # Upload a test file (simulated JPEG) - use fresh session for multipart
        upload_session = requests.Session()
        upload_session.cookies.update(self.session.cookies)
        files = {
            "file": ("test-invoice-scan.jpg", b"\xff\xd8\xff\xe0" + b"test jpeg content", "image/jpeg")
        }
        upload_response = upload_session.post(
            f"{BASE_URL}/api/charge-app/invoices/{invoice_id}/attachments",
            files=files
        )
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        upload_data = upload_response.json()
        assert upload_data.get("ok") is True
        
        # Verify attachment metadata
        attachment = upload_data.get("attachment", {})
        assert "attachment_id" in attachment
        assert "download_path" in attachment
        assert "preview_mode" in attachment
        assert attachment.get("preview_mode") == "image"
        assert attachment.get("preview_supported") is True

    def test_invoice_attachment_download_endpoint(self):
        """Test invoice attachment download endpoint returns file"""
        import uuid
        invoice_num = f"TEST-DL-INV-{uuid.uuid4().hex[:8].upper()}"
        
        # Save invoice
        save_response = self.session.post(
            f"{BASE_URL}/api/charge-app/invoices/save",
            json={
                "invoice_number": invoice_num,
                "merchant_name": "Test Download Invoice Merchant",
                "amount": 199.99
            }
        )
        assert save_response.status_code == 200
        invoice_id = save_response.json().get("invoice", {}).get("invoice_id")
        
        # Upload attachment - use fresh session for multipart
        upload_session = requests.Session()
        upload_session.cookies.update(self.session.cookies)
        files = {
            "file": ("test-invoice-download.pdf", b"%PDF-1.4 invoice content", "application/pdf")
        }
        upload_response = upload_session.post(
            f"{BASE_URL}/api/charge-app/invoices/{invoice_id}/attachments",
            files=files
        )
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        attachment_id = upload_response.json().get("attachment", {}).get("attachment_id")
        
        # Download attachment
        download_response = self.session.get(
            f"{BASE_URL}/api/charge-app/invoices/{invoice_id}/attachments/{attachment_id}/download"
        )
        assert download_response.status_code == 200
        assert "Content-Disposition" in download_response.headers
        assert len(download_response.content) > 0

    # ─── Merchant Detail with Customer Context Tests ───
    def test_merchant_detail_returns_customer_context(self):
        """Merchant detail endpoint returns customer_context with warranties and invoices"""
        # First get dashboard to find a merchant slug
        dashboard_response = self.session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert dashboard_response.status_code == 200
        merchants = dashboard_response.json().get("merchants", [])
        
        if not merchants:
            pytest.skip("No merchants available for testing")
        
        # Use first merchant with a slug
        merchant = next((m for m in merchants if m.get("public_slug")), None)
        if not merchant:
            pytest.skip("No merchant with public_slug available")
        
        slug = merchant.get("public_slug")
        
        # Get merchant detail
        detail_response = self.session.get(f"{BASE_URL}/api/charge-app/merchants/{slug}")
        assert detail_response.status_code == 200
        data = detail_response.json()
        
        # Verify structure
        assert "merchant" in data
        assert "customer_context" in data
        assert "products" in data
        assert "promotions" in data
        assert "highlights" in data
        
        # Verify merchant data
        merchant_data = data.get("merchant", {})
        assert "business_name" in merchant_data
        assert "public_slug" in merchant_data
        
        # Verify customer_context structure
        customer_context = data.get("customer_context", {})
        assert "warranty_count" in customer_context
        assert "invoice_count" in customer_context
        assert "warranties" in customer_context
        assert "invoices" in customer_context
        
        # If warranties exist in context, verify attachment metadata
        for warranty in customer_context.get("warranties", []):
            assert "registration_id" in warranty
            assert "attachments" in warranty
            for attachment in warranty.get("attachments", []):
                assert "download_path" in attachment
                assert "preview_mode" in attachment
                assert "preview_supported" in attachment
        
        # If invoices exist in context, verify attachment metadata
        for invoice in customer_context.get("invoices", []):
            assert "invoice_id" in invoice
            assert "attachments" in invoice
            for attachment in invoice.get("attachments", []):
                assert "download_path" in attachment
                assert "preview_mode" in attachment
                assert "preview_supported" in attachment

    def test_merchant_detail_not_found(self):
        """Merchant detail returns 404 for non-existent slug"""
        response = self.session.get(f"{BASE_URL}/api/charge-app/merchants/non-existent-merchant-slug-12345")
        assert response.status_code == 404

    # ─── Warranty Pass Tests ───
    def test_warranty_pass_endpoint(self):
        """Test warranty pass endpoint returns pass data with QR payload"""
        import uuid
        serial = f"TEST-PASS-{uuid.uuid4().hex[:8].upper()}"
        
        # Register warranty
        reg_response = self.session.post(
            f"{BASE_URL}/api/charge-app/warranty/register",
            json={
                "product_name": "Test Pass Charger",
                "serial_number": serial,
                "purchase_date": "2026-07-30",
                "merchant_name": "Test Pass Merchant"
            }
        )
        assert reg_response.status_code == 200
        registration_id = reg_response.json().get("warranty", {}).get("registration_id")
        
        # Get warranty pass
        pass_response = self.session.get(f"{BASE_URL}/api/charge-app/warranty/{registration_id}/pass")
        assert pass_response.status_code == 200
        data = pass_response.json()
        assert data.get("ok") is True
        
        warranty_pass = data.get("pass", {})
        assert "pass_id" in warranty_pass
        assert "registration_id" in warranty_pass
        assert "serial_number" in warranty_pass
        assert "product_name" in warranty_pass
        assert "merchant_name" in warranty_pass
        assert "coverage_label" in warranty_pass
        assert "status_label" in warranty_pass
        assert "valid_until" in warranty_pass
        assert "qr_payload" in warranty_pass

    def test_warranty_pass_download_endpoint(self):
        """Test warranty pass download returns HTML file"""
        import uuid
        serial = f"TEST-PASS-DL-{uuid.uuid4().hex[:8].upper()}"
        
        # Register warranty
        reg_response = self.session.post(
            f"{BASE_URL}/api/charge-app/warranty/register",
            json={
                "product_name": "Test Pass Download Charger",
                "serial_number": serial,
                "purchase_date": "2026-07-30",
                "merchant_name": "Test Pass Download Merchant"
            }
        )
        assert reg_response.status_code == 200
        registration_id = reg_response.json().get("warranty", {}).get("registration_id")
        
        # Download warranty pass
        download_response = self.session.get(f"{BASE_URL}/api/charge-app/warranty/{registration_id}/pass/download")
        assert download_response.status_code == 200
        assert "Content-Disposition" in download_response.headers
        assert "text/html" in download_response.headers.get("Content-Type", "")
        assert b"BidBlitz Charge" in download_response.content

    # ─── Preview Mode Detection Tests ───
    def test_preview_mode_image_types(self):
        """Test that image types return preview_mode=image"""
        import uuid
        serial = f"TEST-IMG-{uuid.uuid4().hex[:8].upper()}"
        
        # Register warranty
        reg_response = self.session.post(
            f"{BASE_URL}/api/charge-app/warranty/register",
            json={
                "product_name": "Test Image Preview",
                "serial_number": serial
            }
        )
        registration_id = reg_response.json().get("warranty", {}).get("registration_id")
        
        # Test PNG - use fresh session for multipart
        upload_session = requests.Session()
        upload_session.cookies.update(self.session.cookies)
        files = {"file": ("test.png", b"\x89PNG\r\n\x1a\n" + b"content", "image/png")}
        response = upload_session.post(
            f"{BASE_URL}/api/charge-app/warranty/{registration_id}/attachments",
            files=files
        )
        assert response.status_code == 200, f"Upload failed: {response.text}"
        assert response.json().get("attachment", {}).get("preview_mode") == "image"
        assert response.json().get("attachment", {}).get("preview_supported") is True

    def test_preview_mode_pdf_type(self):
        """Test that PDF type returns preview_mode=pdf"""
        import uuid
        serial = f"TEST-PDF-{uuid.uuid4().hex[:8].upper()}"
        
        # Register warranty
        reg_response = self.session.post(
            f"{BASE_URL}/api/charge-app/warranty/register",
            json={
                "product_name": "Test PDF Preview",
                "serial_number": serial
            }
        )
        registration_id = reg_response.json().get("warranty", {}).get("registration_id")
        
        # Test PDF - use fresh session for multipart
        upload_session = requests.Session()
        upload_session.cookies.update(self.session.cookies)
        files = {"file": ("test.pdf", b"%PDF-1.4 content", "application/pdf")}
        response = upload_session.post(
            f"{BASE_URL}/api/charge-app/warranty/{registration_id}/attachments",
            files=files
        )
        assert response.status_code == 200, f"Upload failed: {response.text}"
        assert response.json().get("attachment", {}).get("preview_mode") == "pdf"
        assert response.json().get("attachment", {}).get("preview_supported") is True

    # ─── Interaction Tracking Tests ───
    def test_interaction_tracking(self):
        """Test interaction tracking endpoint"""
        response = self.session.post(
            f"{BASE_URL}/api/charge-app/interactions",
            json={
                "interaction_type": "preview_test",
                "merchant_slug": "test-merchant",
                "merchant_name": "Test Merchant",
                "city": "Berlin",
                "category": "charger"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") is True
        assert "interaction" in data
        assert data.get("interaction", {}).get("interaction_type") == "preview_test"

    # ─── Regression: Existing Features Still Work ───
    def test_personalized_offers_still_work(self):
        """Verify personalized offers are still returned in dashboard"""
        response = self.session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "personalized_offers" in data
        assert "personalization" in data
        
        personalization = data.get("personalization", {})
        assert "region" in personalization
        assert "regions" in personalization
        assert "top_categories" in personalization

    def test_loyalty_data_still_works(self):
        """Verify loyalty data is still returned in dashboard"""
        response = self.session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "loyalty" in data
        loyalty = data.get("loyalty", {})
        assert "status" in loyalty
        assert "stats" in loyalty

    def test_merchants_list_still_works(self):
        """Verify merchants list is still returned in dashboard"""
        response = self.session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "merchants" in data
        merchants = data.get("merchants", [])
        
        for merchant in merchants:
            assert "business_name" in merchant
            assert "city" in merchant
            assert "category" in merchant
            # Personalization score should be present
            assert "personalization_score" in merchant
            assert "match_reason" in merchant


class TestChargePreviewUnauthorized:
    """Test unauthorized access to Charge App endpoints"""

    def test_dashboard_requires_auth(self):
        """Dashboard endpoint requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 401

    def test_warranty_register_requires_auth(self):
        """Warranty registration requires authentication"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/charge-app/warranty/register",
            json={"product_name": "Test", "serial_number": "TEST123"}
        )
        assert response.status_code == 401

    def test_invoice_save_requires_auth(self):
        """Invoice save requires authentication"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/charge-app/invoices/save",
            json={"invoice_number": "TEST123", "merchant_name": "Test"}
        )
        assert response.status_code == 401

    def test_merchant_detail_requires_auth(self):
        """Merchant detail requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/charge-app/merchants/test-slug")
        assert response.status_code == 401

    def test_attachment_download_requires_auth(self):
        """Attachment download requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/charge-app/warranty/TEST-REG/attachments/TEST-ATT/download")
        assert response.status_code == 401
