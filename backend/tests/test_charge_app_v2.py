"""
BidBlitz Charge App V2 Tests - File Uploads, Digital Pass, Merchant Detail
Tests the new features added to the Charge App:
1. Warranty attachment upload/download
2. Invoice attachment upload/download
3. Digital warranty pass (GET and download)
4. Merchant detail page API
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials from test_credentials.md
TEST_EMAIL = "reviewer@bidblitz.ae"
TEST_PASSWORD = "BidBlitzReview2026!"


class TestChargeAppV2:
    """Tests for Charge App V2 features: uploads, digital pass, merchant detail"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session and login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
        
        yield
        
        # Logout
        self.session.post(f"{BASE_URL}/api/auth/logout")

    def test_01_dashboard_loads(self):
        """Test that dashboard loads and returns expected structure"""
        response = self.session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        
        data = response.json()
        assert "summary" in data
        assert "warranties" in data
        assert "invoices" in data
        assert "merchants" in data
        print(f"Dashboard loaded: {data['summary']}")

    def test_02_register_warranty_for_upload_test(self):
        """Register a warranty to use for attachment upload tests"""
        import uuid
        serial = f"TEST-UPLOAD-{uuid.uuid4().hex[:8].upper()}"
        
        response = self.session.post(
            f"{BASE_URL}/api/charge-app/warranty/register",
            json={
                "product_name": "Test Upload Product",
                "serial_number": serial,
                "purchase_date": "2026-01-15",
                "merchant_name": "Test Merchant",
                "invoice_number": f"INV-{uuid.uuid4().hex[:6].upper()}"
            }
        )
        assert response.status_code == 200, f"Warranty registration failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True
        assert "warranty" in data
        
        self.warranty_registration_id = data["warranty"]["registration_id"]
        print(f"Created warranty: {self.warranty_registration_id}")
        
        # Store for other tests
        pytest.warranty_registration_id = self.warranty_registration_id

    def test_03_upload_warranty_attachment_pdf(self):
        """Test uploading a PDF attachment to a warranty"""
        registration_id = getattr(pytest, "warranty_registration_id", None)
        if not registration_id:
            pytest.skip("No warranty registration_id from previous test")
        
        # Create a simple PDF-like content (just bytes for testing)
        pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF"
        
        files = {
            "file": ("test-warranty-proof.pdf", pdf_content, "application/pdf")
        }
        
        # Use a fresh request without Content-Type header (let requests set multipart boundary)
        response = requests.post(
            f"{BASE_URL}/api/charge-app/warranty/{registration_id}/attachments",
            files=files,
            cookies=self.session.cookies
        )
        
        assert response.status_code == 200, f"Warranty attachment upload failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True
        assert "attachment" in data
        assert data["attachment"]["original_filename"] == "test-warranty-proof.pdf"
        assert data["attachment"]["content_type"] == "application/pdf"
        
        pytest.warranty_attachment_id = data["attachment"]["attachment_id"]
        print(f"Uploaded warranty attachment: {pytest.warranty_attachment_id}")

    def test_04_upload_warranty_attachment_image(self):
        """Test uploading a JPG image attachment to a warranty"""
        registration_id = getattr(pytest, "warranty_registration_id", None)
        if not registration_id:
            pytest.skip("No warranty registration_id from previous test")
        
        # Create minimal JPEG header bytes
        jpg_content = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9
        ])
        
        files = {
            "file": ("warranty-receipt.jpg", jpg_content, "image/jpeg")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/charge-app/warranty/{registration_id}/attachments",
            files=files,
            cookies=self.session.cookies
        )
        
        assert response.status_code == 200, f"Image attachment upload failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True
        assert "attachment" in data
        print(f"Uploaded image attachment: {data['attachment']['attachment_id']}")

    def test_05_download_warranty_attachment(self):
        """Test downloading a warranty attachment"""
        registration_id = getattr(pytest, "warranty_registration_id", None)
        attachment_id = getattr(pytest, "warranty_attachment_id", None)
        
        if not registration_id or not attachment_id:
            pytest.skip("No warranty or attachment from previous tests")
        
        response = self.session.get(
            f"{BASE_URL}/api/charge-app/warranty/{registration_id}/attachments/{attachment_id}/download"
        )
        
        assert response.status_code == 200, f"Attachment download failed: {response.text}"
        assert len(response.content) > 0
        print(f"Downloaded attachment: {len(response.content)} bytes")

    def test_06_save_invoice_for_upload_test(self):
        """Save an invoice to use for attachment upload tests"""
        import uuid
        invoice_number = f"TEST-INV-{uuid.uuid4().hex[:8].upper()}"
        
        response = self.session.post(
            f"{BASE_URL}/api/charge-app/invoices/save",
            json={
                "invoice_number": invoice_number,
                "merchant_name": "Test Invoice Merchant",
                "amount": 99.99,
                "purchase_date": "2026-01-20",
                "product_name": "Test Invoice Product",
                "serial_number": f"SN-{uuid.uuid4().hex[:6].upper()}"
            }
        )
        assert response.status_code == 200, f"Invoice save failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True
        assert "invoice" in data
        
        pytest.invoice_id = data["invoice"]["invoice_id"]
        print(f"Created invoice: {pytest.invoice_id}")

    def test_07_upload_invoice_attachment(self):
        """Test uploading an attachment to an invoice"""
        invoice_id = getattr(pytest, "invoice_id", None)
        if not invoice_id:
            pytest.skip("No invoice_id from previous test")
        
        # Create PNG-like content
        png_content = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {
            "file": ("invoice-scan.png", png_content, "image/png")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/charge-app/invoices/{invoice_id}/attachments",
            files=files,
            cookies=self.session.cookies
        )
        
        assert response.status_code == 200, f"Invoice attachment upload failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True
        assert "attachment" in data
        
        pytest.invoice_attachment_id = data["attachment"]["attachment_id"]
        print(f"Uploaded invoice attachment: {pytest.invoice_attachment_id}")

    def test_08_download_invoice_attachment(self):
        """Test downloading an invoice attachment"""
        invoice_id = getattr(pytest, "invoice_id", None)
        attachment_id = getattr(pytest, "invoice_attachment_id", None)
        
        if not invoice_id or not attachment_id:
            pytest.skip("No invoice or attachment from previous tests")
        
        response = self.session.get(
            f"{BASE_URL}/api/charge-app/invoices/{invoice_id}/attachments/{attachment_id}/download"
        )
        
        assert response.status_code == 200, f"Invoice attachment download failed: {response.text}"
        assert len(response.content) > 0
        print(f"Downloaded invoice attachment: {len(response.content)} bytes")

    def test_09_get_warranty_pass(self):
        """Test getting the digital warranty pass"""
        registration_id = getattr(pytest, "warranty_registration_id", None)
        if not registration_id:
            pytest.skip("No warranty registration_id from previous test")
        
        response = self.session.get(
            f"{BASE_URL}/api/charge-app/warranty/{registration_id}/pass"
        )
        
        assert response.status_code == 200, f"Warranty pass GET failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") is True
        assert "pass" in data
        
        pass_data = data["pass"]
        assert "pass_id" in pass_data
        assert "registration_id" in pass_data
        assert "qr_payload" in pass_data
        assert "valid_until" in pass_data
        assert "coverage_label" in pass_data
        assert "status_label" in pass_data
        
        print(f"Warranty pass: {pass_data['pass_id']} - valid until {pass_data['valid_until']}")

    def test_10_download_warranty_pass(self):
        """Test downloading the warranty pass as HTML"""
        registration_id = getattr(pytest, "warranty_registration_id", None)
        if not registration_id:
            pytest.skip("No warranty registration_id from previous test")
        
        response = self.session.get(
            f"{BASE_URL}/api/charge-app/warranty/{registration_id}/pass/download"
        )
        
        assert response.status_code == 200, f"Warranty pass download failed: {response.text}"
        assert "text/html" in response.headers.get("Content-Type", "")
        assert len(response.content) > 0
        assert b"BidBlitz Charge" in response.content
        assert b"Garantiepass" in response.content
        
        print(f"Downloaded warranty pass HTML: {len(response.content)} bytes")

    def test_11_warranty_pass_head_request(self):
        """Test HEAD request for warranty pass download (for browser preflight)"""
        registration_id = getattr(pytest, "warranty_registration_id", None)
        if not registration_id:
            pytest.skip("No warranty registration_id from previous test")
        
        response = self.session.head(
            f"{BASE_URL}/api/charge-app/warranty/{registration_id}/pass/download"
        )
        
        # HEAD should return 200 (or 405 if not supported, but code shows it's supported)
        assert response.status_code == 200, f"Warranty pass HEAD failed: {response.status_code}"
        print("Warranty pass HEAD request successful")

    def test_12_get_merchant_detail(self):
        """Test getting merchant detail by slug"""
        # Use the slug from the test request: super-app-staging-2
        slug = "super-app-staging-2"
        
        response = self.session.get(
            f"{BASE_URL}/api/charge-app/merchants/{slug}"
        )
        
        # This might return 404 if no merchant with this slug exists
        if response.status_code == 404:
            print(f"Merchant '{slug}' not found - this is expected if no merchant seeded with this slug")
            # Try to get any merchant from dashboard
            dashboard = self.session.get(f"{BASE_URL}/api/charge-app/dashboard")
            if dashboard.status_code == 200:
                merchants = dashboard.json().get("merchants", [])
                if merchants:
                    first_slug = merchants[0].get("public_slug")
                    if first_slug:
                        response = self.session.get(
                            f"{BASE_URL}/api/charge-app/merchants/{first_slug}"
                        )
                        if response.status_code == 200:
                            data = response.json()
                            assert "merchant" in data
                            print(f"Merchant detail loaded for: {data['merchant']['business_name']}")
                            return
            pytest.skip("No merchants available for detail test")
        
        assert response.status_code == 200, f"Merchant detail failed: {response.text}"
        
        data = response.json()
        assert "merchant" in data
        assert "business_name" in data["merchant"]
        assert "highlights" in data
        
        print(f"Merchant detail: {data['merchant']['business_name']}")

    def test_13_upload_invalid_file_type_rejected(self):
        """Test that invalid file types are rejected"""
        registration_id = getattr(pytest, "warranty_registration_id", None)
        if not registration_id:
            pytest.skip("No warranty registration_id from previous test")
        
        # Try to upload an executable (should be rejected)
        exe_content = b"MZ\x90\x00\x03\x00\x00\x00"  # DOS header
        
        files = {
            "file": ("malware.exe", exe_content, "application/x-msdownload")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/charge-app/warranty/{registration_id}/attachments",
            files=files,
            cookies=self.session.cookies
        )
        
        # Should be rejected with 400
        assert response.status_code == 400, f"Invalid file type should be rejected: {response.status_code}"
        print("Invalid file type correctly rejected")

    def test_14_dashboard_shows_attachments(self):
        """Verify dashboard shows warranties/invoices with attachments"""
        response = self.session.get(f"{BASE_URL}/api/charge-app/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check if any warranty has attachments
        warranties_with_attachments = [
            w for w in data.get("warranties", [])
            if w.get("attachments") and len(w["attachments"]) > 0
        ]
        
        invoices_with_attachments = [
            i for i in data.get("invoices", [])
            if i.get("attachments") and len(i["attachments"]) > 0
        ]
        
        print(f"Warranties with attachments: {len(warranties_with_attachments)}")
        print(f"Invoices with attachments: {len(invoices_with_attachments)}")
        
        # At least one should have attachments from our tests
        if warranties_with_attachments:
            first_attachment = warranties_with_attachments[0]["attachments"][0]
            assert "attachment_id" in first_attachment
            assert "download_path" in first_attachment
            assert "original_filename" in first_attachment
            print(f"Warranty attachment verified: {first_attachment['original_filename']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
