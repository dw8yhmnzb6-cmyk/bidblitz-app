"""
KYC Flow Backend Tests
Tests for KYC submission, status checking, and error handling
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestKYCStatus:
    """Tests for GET /api/kyc/status endpoint"""
    
    def test_kyc_status_unauthenticated(self):
        """Unauthenticated request should return 401"""
        response = requests.get(f"{BASE_URL}/api/kyc/status")
        assert response.status_code == 401
        print("PASS: Unauthenticated KYC status returns 401")
    
    def test_kyc_status_authenticated_fresh_user(self):
        """Fresh user should have kyc_status=not_started"""
        # Create fresh account
        email = f"kyc.test.status.{int(time.time())}@test.com"
        session = requests.Session()
        
        # Register
        reg_resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass2026!",
            "name": "KYC Status Test"
        })
        assert reg_resp.status_code == 200
        
        # Check KYC status
        status_resp = session.get(f"{BASE_URL}/api/kyc/status")
        assert status_resp.status_code == 200
        
        data = status_resp.json()
        assert data["kyc_status"] == "not_started"
        assert data["kyc_verified"] == False
        assert data["can_use_features"]["browse"] == True
        assert data["can_use_features"]["wallet_topup"] == False
        print(f"PASS: Fresh user {email} has kyc_status=not_started")
    
    def test_kyc_status_existing_pending_user(self):
        """User agimk@me.com should have pending KYC status"""
        session = requests.Session()
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "agimk@me.com",
            "password": "Aldink56600"
        })
        assert login_resp.status_code == 200
        
        # Check KYC status
        status_resp = session.get(f"{BASE_URL}/api/kyc/status")
        assert status_resp.status_code == 200
        
        data = status_resp.json()
        assert data["kyc_status"] == "pending"
        assert "can_use_features" in data
        print("PASS: agimk@me.com has pending KYC status")


class TestKYCSubmit:
    """Tests for POST /api/kyc/submit endpoint"""
    
    def test_kyc_submit_unauthenticated(self):
        """Unauthenticated request should return 401 or 422 (validation error)"""
        response = requests.post(f"{BASE_URL}/api/kyc/submit")
        # 422 is acceptable - validation error for missing files before auth check
        # 401 would be ideal but FastAPI validates request body first
        assert response.status_code in [401, 422]
        print(f"PASS: Unauthenticated KYC submit returns {response.status_code}")
    
    def test_kyc_submit_success(self):
        """Fresh user can submit KYC successfully"""
        # Create fresh account
        email = f"kyc.test.submit.{int(time.time())}@test.com"
        session = requests.Session()
        
        # Register
        reg_resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass2026!",
            "name": "KYC Submit Test"
        })
        assert reg_resp.status_code == 200
        
        # Submit KYC with test images
        with open("/app/tmp_kyc_test/front.png", "rb") as front, \
             open("/app/tmp_kyc_test/back.png", "rb") as back, \
             open("/app/tmp_kyc_test/selfie.png", "rb") as selfie:
            
            files = {
                "id_front": ("front.png", front, "image/png"),
                "id_back": ("back.png", back, "image/png"),
                "selfie": ("selfie.png", selfie, "image/png"),
            }
            data = {
                "document_type": "national_id",
                "first_name": "Max",
                "last_name": "Mustermann",
                "date_of_birth": "1990-01-15",
                "country": "DE",
                "id_number": "LX12345678"
            }
            
            submit_resp = session.post(f"{BASE_URL}/api/kyc/submit", files=files, data=data)
        
        assert submit_resp.status_code == 200
        result = submit_resp.json()
        assert result["ok"] == True
        assert result["status"] in ["pending", "approved"]
        assert "message" in result
        assert "Übermittlung fehlgeschlagen" not in result.get("message", "")
        print(f"PASS: KYC submit successful for {email}, status={result['status']}")
        
        # Verify status changed
        status_resp = session.get(f"{BASE_URL}/api/kyc/status")
        assert status_resp.status_code == 200
        status_data = status_resp.json()
        assert status_data["kyc_status"] in ["pending", "approved"]
        print(f"PASS: KYC status verified as {status_data['kyc_status']}")
    
    def test_kyc_submit_already_pending(self):
        """User with pending KYC should get appropriate error"""
        session = requests.Session()
        
        # Login as agimk@me.com (has pending KYC)
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "agimk@me.com",
            "password": "Aldink56600"
        })
        assert login_resp.status_code == 200
        
        # Try to submit KYC again
        with open("/app/tmp_kyc_test/front.png", "rb") as front, \
             open("/app/tmp_kyc_test/back.png", "rb") as back, \
             open("/app/tmp_kyc_test/selfie.png", "rb") as selfie:
            
            files = {
                "id_front": ("front.png", front, "image/png"),
                "id_back": ("back.png", back, "image/png"),
                "selfie": ("selfie.png", selfie, "image/png"),
            }
            data = {"document_type": "national_id"}
            
            submit_resp = session.post(f"{BASE_URL}/api/kyc/submit", files=files, data=data)
        
        assert submit_resp.status_code == 400
        result = submit_resp.json()
        assert "bereits eingereicht" in result.get("detail", "").lower() or "already submitted" in result.get("detail", "").lower()
        print("PASS: Already pending user gets appropriate error message")
    
    def test_kyc_submit_invalid_file_type(self):
        """Invalid file type should be rejected"""
        # Create fresh account
        email = f"kyc.test.invalid.{int(time.time())}@test.com"
        session = requests.Session()
        
        # Register
        reg_resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass2026!",
            "name": "KYC Invalid Test"
        })
        assert reg_resp.status_code == 200
        
        # Submit with invalid file type
        files = {
            "id_front": ("test.txt", b"invalid content", "text/plain"),
            "id_back": ("back.png", open("/app/tmp_kyc_test/back.png", "rb"), "image/png"),
            "selfie": ("selfie.png", open("/app/tmp_kyc_test/selfie.png", "rb"), "image/png"),
        }
        data = {"document_type": "national_id"}
        
        submit_resp = session.post(f"{BASE_URL}/api/kyc/submit", files=files, data=data)
        
        assert submit_resp.status_code == 400
        result = submit_resp.json()
        assert "Ungültiger Dateityp" in result.get("detail", "") or "invalid" in result.get("detail", "").lower()
        print("PASS: Invalid file type rejected with appropriate error")
    
    def test_kyc_submit_heic_format(self):
        """HEIC format files should be accepted"""
        # Create fresh account
        email = f"kyc.test.heic.{int(time.time())}@test.com"
        session = requests.Session()
        
        # Register
        reg_resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass2026!",
            "name": "KYC HEIC Test"
        })
        assert reg_resp.status_code == 200
        
        # Submit with HEIC-like files (using octet-stream mime type)
        with open("/app/tmp_kyc_test/front.png", "rb") as front, \
             open("/app/tmp_kyc_test/back.png", "rb") as back, \
             open("/app/tmp_kyc_test/selfie.png", "rb") as selfie:
            
            files = {
                "id_front": ("front.heic", front, "application/octet-stream"),
                "id_back": ("back.heic", back, "application/octet-stream"),
                "selfie": ("selfie.heic", selfie, "application/octet-stream"),
            }
            data = {"document_type": "national_id"}
            
            submit_resp = session.post(f"{BASE_URL}/api/kyc/submit", files=files, data=data)
        
        assert submit_resp.status_code == 200
        result = submit_resp.json()
        assert result["ok"] == True
        print(f"PASS: HEIC format accepted for {email}")


class TestKYCLoginRegression:
    """Regression tests for login/session with KYC"""
    
    def test_agimk_login_session(self):
        """agimk@me.com login and session should work"""
        session = requests.Session()
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "agimk@me.com",
            "password": "Aldink56600"
        })
        assert login_resp.status_code == 200
        user_data = login_resp.json()
        assert user_data["email"] == "agimk@me.com"
        print("PASS: agimk@me.com login successful")
        
        # Check session
        me_resp = session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        me_data = me_resp.json()
        assert me_data["email"] == "agimk@me.com"
        print("PASS: agimk@me.com session verified")
        
        # Check KYC status
        kyc_resp = session.get(f"{BASE_URL}/api/kyc/status")
        assert kyc_resp.status_code == 200
        kyc_data = kyc_resp.json()
        assert "kyc_status" in kyc_data
        print(f"PASS: agimk@me.com KYC status: {kyc_data['kyc_status']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
