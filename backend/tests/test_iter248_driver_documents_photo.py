"""
Iteration 248: Driver Documents Photo Upload Tests
===================================================
Tests for the new photo upload feature in driver documents:
- POST /api/taxi/driver/documents/upload - Upload document photo
- POST /api/taxi/driver/documents - Create document with file_media_id
- GET /api/taxi/driver/documents - List documents with preview URLs
- GET /api/taxi/driver/documents/file/{media_id} - Stream uploaded image
- DELETE /api/taxi/driver/documents/{did} - Soft-delete linked media
- GET /api/taxi/driver/documents/summary - Documents summary (no regression)
"""
import pytest
import requests
import os
import base64
import io
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def session():
    """Create authenticated session as admin/driver"""
    s = requests.Session()
    # Login as admin (who is also a verified driver per test_credentials.md)
    resp = s.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }, headers={"Content-Type": "application/json"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return s


@pytest.fixture(scope="module")
def test_jpeg_bytes():
    """Generate a valid JPEG image for testing"""
    img = Image.new("RGB", (100, 100), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    buf.seek(0)
    return buf.getvalue()


@pytest.fixture(scope="module")
def test_png_bytes():
    """Generate a valid PNG image for testing"""
    img = Image.new("RGB", (100, 100), color=(0, 255, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()


class TestDriverDocumentsPhotoUpload:
    """Test photo upload for driver documents"""

    def test_upload_jpeg_success(self, session, test_jpeg_bytes):
        """Upload JPEG image should succeed"""
        files = {"file": ("test_doc.jpg", test_jpeg_bytes, "image/jpeg")}
        data = {"type": "license"}
        resp = session.post(
            f"{BASE_URL}/api/taxi/driver/documents/upload",
            files=files,
            data=data
        )
        assert resp.status_code == 200, f"Upload failed: {resp.text}"
        result = resp.json()
        assert result.get("success") is True
        assert "media_id" in result
        assert result["media_id"].startswith("TDDOC-")
        assert "file_url" in result
        assert "/api/taxi/driver/documents/file/" in result["file_url"]
        assert result.get("content_type") == "image/jpeg"
        # Store for later tests
        pytest.shared_media_id = result["media_id"]
        pytest.shared_file_url = result["file_url"]

    def test_upload_png_success(self, session, test_png_bytes):
        """Upload PNG image should succeed"""
        files = {"file": ("test_doc.png", test_png_bytes, "image/png")}
        data = {"type": "tuev"}
        resp = session.post(
            f"{BASE_URL}/api/taxi/driver/documents/upload",
            files=files,
            data=data
        )
        assert resp.status_code == 200, f"Upload failed: {resp.text}"
        result = resp.json()
        assert result.get("success") is True
        assert result.get("content_type") == "image/png"

    def test_upload_invalid_type_rejected(self, session):
        """Upload with invalid document type should fail"""
        files = {"file": ("test.jpg", b"fake image data", "image/jpeg")}
        data = {"type": "invalid_type"}
        resp = session.post(
            f"{BASE_URL}/api/taxi/driver/documents/upload",
            files=files,
            data=data
        )
        assert resp.status_code == 400

    def test_upload_non_image_rejected(self, session):
        """Upload non-image file should fail"""
        files = {"file": ("test.pdf", b"PDF content", "application/pdf")}
        data = {"type": "license"}
        resp = session.post(
            f"{BASE_URL}/api/taxi/driver/documents/upload",
            files=files,
            data=data
        )
        assert resp.status_code == 400

    def test_upload_empty_file_rejected(self, session):
        """Upload empty file should fail"""
        files = {"file": ("empty.jpg", b"", "image/jpeg")}
        data = {"type": "license"}
        resp = session.post(
            f"{BASE_URL}/api/taxi/driver/documents/upload",
            files=files,
            data=data
        )
        assert resp.status_code == 400


class TestDriverDocumentsCreateWithPhoto:
    """Test creating documents with uploaded photo"""

    def test_create_document_with_media_id(self, session, test_jpeg_bytes):
        """Create document with file_media_id should succeed"""
        # First upload a photo
        files = {"file": ("doc_photo.jpg", test_jpeg_bytes, "image/jpeg")}
        data = {"type": "insurance"}
        upload_resp = session.post(
            f"{BASE_URL}/api/taxi/driver/documents/upload",
            files=files,
            data=data
        )
        assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
        upload_result = upload_resp.json()
        media_id = upload_result["media_id"]
        file_url = upload_result["file_url"]

        # Create document with the uploaded photo
        doc_payload = {
            "type": "insurance",
            "expires_on": "2027-06-15",
            "file_url": file_url,
            "file_media_id": media_id,
            "note": "TEST_iter248_insurance_doc"
        }
        create_resp = session.post(
            f"{BASE_URL}/api/taxi/driver/documents",
            json=doc_payload,
            headers={"Content-Type": "application/json"}
        )
        assert create_resp.status_code == 200, f"Create failed: {create_resp.text}"
        result = create_resp.json()
        assert result.get("success") is True
        doc = result.get("document", {})
        assert doc.get("type") == "insurance"
        assert doc.get("file_media_id") == media_id
        assert doc.get("file_url") is not None
        # Store for later tests
        pytest.shared_doc_id = doc.get("id")
        pytest.shared_doc_media_id = media_id

    def test_create_document_without_photo(self, session):
        """Create document without photo should succeed (URL only)"""
        doc_payload = {
            "type": "p_schein",
            "expires_on": "2027-12-31",
            "file_url": "",
            "note": "TEST_iter248_no_photo"
        }
        resp = session.post(
            f"{BASE_URL}/api/taxi/driver/documents",
            json=doc_payload,
            headers={"Content-Type": "application/json"}
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result.get("success") is True
        doc = result.get("document", {})
        assert doc.get("type") == "p_schein"
        pytest.shared_no_photo_doc_id = doc.get("id")


class TestDriverDocumentsList:
    """Test listing documents with preview URLs"""

    def test_list_documents_returns_items(self, session):
        """List documents should return items with file_url"""
        resp = session.get(f"{BASE_URL}/api/taxi/driver/documents")
        assert resp.status_code == 200, f"List failed: {resp.text}"
        result = resp.json()
        assert "items" in result
        items = result["items"]
        assert isinstance(items, list)
        # Check that documents with photos have file_url
        for item in items:
            if item.get("file_media_id"):
                assert item.get("file_url") is not None
                assert "/api/taxi/driver/documents/file/" in item["file_url"]

    def test_list_documents_has_annotations(self, session):
        """List documents should have alert_level and type_label"""
        resp = session.get(f"{BASE_URL}/api/taxi/driver/documents")
        assert resp.status_code == 200
        result = resp.json()
        items = result.get("items", [])
        if items:
            item = items[0]
            assert "alert_level" in item
            assert "type_label" in item
            assert "days_until_expiry" in item


class TestDriverDocumentsStream:
    """Test streaming uploaded document files"""

    def test_stream_uploaded_file(self, session, test_jpeg_bytes):
        """Stream uploaded file should return image content"""
        # First upload a photo
        files = {"file": ("stream_test.jpg", test_jpeg_bytes, "image/jpeg")}
        data = {"type": "concession"}
        upload_resp = session.post(
            f"{BASE_URL}/api/taxi/driver/documents/upload",
            files=files,
            data=data
        )
        assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
        media_id = upload_resp.json()["media_id"]

        # Stream the file
        stream_resp = session.get(f"{BASE_URL}/api/taxi/driver/documents/file/{media_id}")
        assert stream_resp.status_code == 200, f"Stream failed: {stream_resp.text}"
        assert stream_resp.headers.get("Content-Type", "").startswith("image/")
        assert len(stream_resp.content) > 0

    def test_stream_nonexistent_file_404(self, session):
        """Stream non-existent file should return 404"""
        resp = session.get(f"{BASE_URL}/api/taxi/driver/documents/file/TDDOC-NONEXISTENT123")
        assert resp.status_code == 404


class TestDriverDocumentsDelete:
    """Test deleting documents with soft-delete of media"""

    def test_delete_document_with_photo(self, session, test_jpeg_bytes):
        """Delete document should soft-delete linked media"""
        # Upload photo
        files = {"file": ("delete_test.jpg", test_jpeg_bytes, "image/jpeg")}
        data = {"type": "other"}
        upload_resp = session.post(
            f"{BASE_URL}/api/taxi/driver/documents/upload",
            files=files,
            data=data
        )
        assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
        media_id = upload_resp.json()["media_id"]
        file_url = upload_resp.json()["file_url"]

        # Create document
        doc_payload = {
            "type": "other",
            "expires_on": "2027-01-01",
            "file_url": file_url,
            "file_media_id": media_id,
            "note": "TEST_iter248_delete_test"
        }
        create_resp = session.post(
            f"{BASE_URL}/api/taxi/driver/documents",
            json=doc_payload,
            headers={"Content-Type": "application/json"}
        )
        assert create_resp.status_code == 200, f"Create failed: {create_resp.text}"
        doc_id = create_resp.json()["document"]["id"]

        # Delete document
        delete_resp = session.delete(f"{BASE_URL}/api/taxi/driver/documents/{doc_id}")
        assert delete_resp.status_code == 200
        assert delete_resp.json().get("success") is True

        # Verify document is gone from list
        list_resp = session.get(f"{BASE_URL}/api/taxi/driver/documents")
        assert list_resp.status_code == 200
        items = list_resp.json().get("items", [])
        doc_ids = [d.get("id") for d in items]
        assert doc_id not in doc_ids

        # Verify media is soft-deleted (stream should fail)
        stream_resp = session.get(f"{BASE_URL}/api/taxi/driver/documents/file/{media_id}")
        assert stream_resp.status_code == 404


class TestDriverDocumentsSummary:
    """Test documents summary endpoint (no regression)"""

    def test_summary_returns_counts(self, session):
        """Summary should return counts and alerts"""
        resp = session.get(f"{BASE_URL}/api/taxi/driver/documents/summary")
        assert resp.status_code == 200, f"Summary failed: {resp.text}"
        result = resp.json()
        assert "counts" in result
        counts = result["counts"]
        assert "expired" in counts
        assert "urgent" in counts
        assert "warning" in counts
        assert "ok" in counts
        assert "missing_required" in result
        assert "alerts" in result
        assert "has_blocker" in result


class TestDriverDocumentsAuth:
    """Test authentication requirements"""

    def test_upload_requires_auth(self):
        """Upload without auth should fail"""
        resp = requests.post(
            f"{BASE_URL}/api/taxi/driver/documents/upload",
            files={"file": ("test.jpg", b"data", "image/jpeg")},
            data={"type": "license"}
        )
        assert resp.status_code in [401, 403]

    def test_list_requires_auth(self):
        """List without auth should fail"""
        resp = requests.get(f"{BASE_URL}/api/taxi/driver/documents")
        assert resp.status_code in [401, 403]

    def test_stream_requires_auth(self):
        """Stream without auth should fail"""
        resp = requests.get(f"{BASE_URL}/api/taxi/driver/documents/file/TDDOC-TEST")
        assert resp.status_code in [401, 403]


class TestCleanup:
    """Cleanup test data"""

    def test_cleanup_test_documents(self, session):
        """Remove TEST_ prefixed documents"""
        resp = session.get(f"{BASE_URL}/api/taxi/driver/documents")
        if resp.status_code == 200:
            items = resp.json().get("items", [])
            for item in items:
                note = item.get("note") or ""
                if note.startswith("TEST_iter248"):
                    session.delete(f"{BASE_URL}/api/taxi/driver/documents/{item['id']}")
        assert True  # Cleanup is best-effort
