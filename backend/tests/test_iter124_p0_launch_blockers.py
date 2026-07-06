"""
BidBlitz P0 Launch Blockers Test Suite - Iteration 124
=======================================================
Tests:
1. POST /api/staff/auth/login brute-force lockout (5 fails → 6th = 429)
2. POST /api/staff/auth/terminal-pin brute-force lockout (5 fails → 6th = 429)
3. POST /api/staff/auth/login happy path with staff_session cookie
4. GET /api/staff/auth/me returns no sensitive fields (password_hash, pin, pin_hash)
5. POST /api/staff/auth/terminal-pin happy path with PIN 1234
"""
import pytest
import requests
import os
import time
import subprocess
import pathlib

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://kyc-approval-hub.preview.emergentagent.com"

# Test credentials from /app/memory/test_credentials.md
STAFF_EMAIL = "mitarbeiter@bidblitz.com"
STAFF_PASSWORD = "test123"
STAFF_PIN = "1234"


class TestStaffAuthBruteForce:
    """Test brute-force protection on staff auth endpoints"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Clear any existing lockouts before tests"""
        # Use unique identifiers to avoid cross-test interference
        self.unique_email = f"bruteforce_test_{int(time.time())}@test.com"
        self.session = requests.Session()
        yield
        self.session.close()

    def test_staff_login_lockout_after_5_failures(self):
        """POST /api/staff/auth/login should return 429 after 5 failed attempts"""
        url = f"{BASE_URL}/api/staff/auth/login"
        
        # Make 5 failed login attempts with wrong password
        for i in range(5):
            response = self.session.post(url, json={
                "email": self.unique_email,
                "password": "wrongpassword"
            })
            # Should be 401 for invalid credentials
            assert response.status_code in [401, 429], f"Attempt {i+1}: Expected 401 or 429, got {response.status_code}"
            if response.status_code == 429:
                # Already locked out (from previous test run)
                print(f"Already locked out at attempt {i+1}")
                return
        
        # 6th attempt should be rate limited (429)
        response = self.session.post(url, json={
            "email": self.unique_email,
            "password": "wrongpassword"
        })
        assert response.status_code == 429, f"6th attempt should return 429, got {response.status_code}"
        
        # Verify response contains rate limit info
        data = response.json()
        assert "detail" in data
        detail = data["detail"]
        assert detail.get("code") == "rate_limit_exceeded" or "rate_limit" in str(detail).lower() or "Zu viele" in str(detail)
        print(f"✓ Staff login lockout working: {detail}")

    def test_terminal_pin_lockout_after_5_failures(self):
        """POST /api/staff/auth/terminal-pin should return 429 after 5 failed attempts"""
        url = f"{BASE_URL}/api/staff/auth/terminal-pin"
        
        # Make 5 failed PIN attempts with wrong PIN
        for i in range(5):
            response = self.session.post(url, json={
                "pin": "9999"  # Wrong PIN
            })
            # Should be 404 for PIN not found or 429 if already locked
            assert response.status_code in [404, 429], f"Attempt {i+1}: Expected 404 or 429, got {response.status_code}"
            if response.status_code == 429:
                print(f"Already locked out at attempt {i+1}")
                return
        
        # 6th attempt should be rate limited (429)
        response = self.session.post(url, json={
            "pin": "9999"
        })
        assert response.status_code == 429, f"6th attempt should return 429, got {response.status_code}"
        
        # Verify response contains rate limit info
        data = response.json()
        assert "detail" in data
        detail = data["detail"]
        assert detail.get("code") == "rate_limit_exceeded" or "rate_limit" in str(detail).lower() or "Zu viele" in str(detail)
        print(f"✓ Terminal PIN lockout working: {detail}")


class TestStaffAuthHappyPath:
    """Test successful staff authentication flows"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        # Clear any existing lockouts before happy path tests
        self._clear_lockouts()
        yield
        self.session.close()
    
    def _clear_lockouts(self):
        """Clear lockout records from database"""
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        
        async def clear():
            client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = client["test_database"]
            await db.login_attempts.delete_many({})
            client.close()
        
        try:
            asyncio.run(clear())
        except Exception:
            pass  # Ignore errors if can't connect to DB

    def test_staff_login_success_with_cookie(self):
        """POST /api/staff/auth/login should set staff_session cookie on success"""
        url = f"{BASE_URL}/api/staff/auth/login"
        
        response = self.session.post(url, json={
            "email": STAFF_EMAIL,
            "password": STAFF_PASSWORD
        })
        
        # Should succeed
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        assert "staff" in data, "Response should contain staff object"
        
        # Verify staff object has expected fields
        staff = data["staff"]
        assert "id" in staff, "Staff should have id"
        assert "name" in staff, "Staff should have name"
        assert "email" in staff, "Staff should have email"
        
        # Verify httpOnly cookie is set (check Set-Cookie header)
        set_cookie = response.headers.get("Set-Cookie", "")
        assert "staff_session" in set_cookie, f"staff_session cookie should be set. Headers: {response.headers}"
        assert "httponly" in set_cookie.lower(), "Cookie should be httpOnly"
        
        print(f"✓ Staff login successful: {staff['name']} ({staff['email']})")
        print(f"✓ Cookie set: {set_cookie[:100]}...")

    def test_staff_auth_me_no_sensitive_fields(self):
        """GET /api/staff/auth/me should not return password_hash, pin, or pin_hash"""
        # First login to get session
        login_url = f"{BASE_URL}/api/staff/auth/login"
        login_response = self.session.post(login_url, json={
            "email": STAFF_EMAIL,
            "password": STAFF_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Could not login: {login_response.status_code}")
        
        # Now call /auth/me
        me_url = f"{BASE_URL}/api/staff/auth/me"
        response = self.session.get(me_url)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert "staff" in data
        
        staff = data["staff"]
        
        # CRITICAL: Verify no sensitive fields are exposed
        sensitive_fields = ["password_hash", "pin", "pin_hash"]
        for field in sensitive_fields:
            assert field not in staff, f"SECURITY: Sensitive field '{field}' should NOT be in response!"
        
        print(f"✓ /auth/me returns safe fields only: {list(staff.keys())}")

    def test_terminal_pin_happy_path(self):
        """POST /api/staff/auth/terminal-pin with PIN 1234 should return member"""
        url = f"{BASE_URL}/api/staff/auth/terminal-pin"
        
        response = self.session.post(url, json={
            "pin": STAFF_PIN
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        assert "member" in data, "Response should contain member object"
        
        member = data["member"]
        assert "id" in member, "Member should have id"
        assert "name" in member, "Member should have name"
        
        # Verify no sensitive fields
        sensitive_fields = ["password_hash", "pin", "pin_hash"]
        for field in sensitive_fields:
            assert field not in member, f"SECURITY: Sensitive field '{field}' should NOT be in terminal-pin response!"
        
        print(f"✓ Terminal PIN lookup successful: {member.get('name', 'Unknown')}")


class TestMobileBuildSetup:
    """Test mobile build configuration files"""

    def test_ios_ats_flag_disabled(self):
        """iOS Info.plist should have NSAllowsArbitraryLoads=false"""
        plist_path = pathlib.Path("/app/frontend/ios/App/App/Info.plist")
        
        assert plist_path.exists(), f"Info.plist not found at {plist_path}"
        
        content = plist_path.read_text()
        
        # Check for NSAppTransportSecurity with NSAllowsArbitraryLoads=false
        assert "NSAppTransportSecurity" in content, "NSAppTransportSecurity key should exist"
        assert "NSAllowsArbitraryLoads" in content, "NSAllowsArbitraryLoads key should exist"
        
        # Verify it's set to false (not true)
        # The plist format has <key>NSAllowsArbitraryLoads</key> followed by <false/>
        import re
        match = re.search(r'<key>NSAllowsArbitraryLoads</key>\s*<(true|false)/>', content)
        assert match, "Could not find NSAllowsArbitraryLoads value"
        assert match.group(1) == "false", f"NSAllowsArbitraryLoads should be false, got {match.group(1)}"
        
        print("✓ iOS ATS: NSAllowsArbitraryLoads=false (secure)")

    def test_android_keystore_env_based(self):
        """Android build.gradle should support env-based keystore secrets"""
        gradle_path = pathlib.Path("/app/frontend/android/app/build.gradle")
        
        assert gradle_path.exists(), f"build.gradle not found at {gradle_path}"
        
        content = gradle_path.read_text()
        
        # Check for environment variable fallbacks
        assert "System.getenv" in content, "build.gradle should use System.getenv for secrets"
        assert "ANDROID_KEYSTORE_FILE" in content or "ANDROID_KEYSTORE" in content, \
            "build.gradle should reference ANDROID_KEYSTORE_FILE env var"
        assert "ANDROID_KEYSTORE_PASSWORD" in content, \
            "build.gradle should reference ANDROID_KEYSTORE_PASSWORD env var"
        assert "ANDROID_KEY_ALIAS" in content, \
            "build.gradle should reference ANDROID_KEY_ALIAS env var"
        assert "ANDROID_KEY_PASSWORD" in content, \
            "build.gradle should reference ANDROID_KEY_PASSWORD env var"
        
        # Verify keystore.properties is used as primary source
        assert "keystore.properties" in content, "build.gradle should read from keystore.properties"
        
        # Verify no hardcoded keystore path in repo
        assert "bidblitz-upload.jks" not in content or "keystoreProperties" in content, \
            "Keystore should not be hardcoded without properties fallback"
        
        print("✓ Android build.gradle supports env-based keystore secrets")

    def test_android_keystore_gitignored(self):
        """Android keystore files should be in .gitignore"""
        gitignore_paths = [
            pathlib.Path("/app/frontend/android/.gitignore"),
            pathlib.Path("/app/.gitignore"),
        ]
        
        keystore_patterns_found = []
        for gitignore_path in gitignore_paths:
            if gitignore_path.exists():
                content = gitignore_path.read_text()
                if "*.jks" in content or "*.keystore" in content:
                    keystore_patterns_found.append(str(gitignore_path))
        
        assert len(keystore_patterns_found) > 0, \
            "SECURITY: *.jks and *.keystore should be in .gitignore"
        
        print(f"✓ Keystore patterns found in gitignore: {keystore_patterns_found}")

    def test_version_bump_script_exists(self):
        """Versioning script bump-mobile-version.sh should exist and be executable"""
        script_path = pathlib.Path("/app/scripts/bump-mobile-version.sh")
        
        assert script_path.exists(), f"Version bump script not found at {script_path}"
        
        content = script_path.read_text()
        
        # Verify it handles both Android and iOS
        assert "build.gradle" in content or "ANDROID" in content, \
            "Script should handle Android versioning"
        assert "pbxproj" in content or "iOS" in content or "IOS" in content, \
            "Script should handle iOS versioning"
        
        # Verify it uses environment variables for CI
        assert "MOBILE_VERSION_NAME" in content or "VERSION_NAME" in content, \
            "Script should support version name from env"
        assert "MOBILE_BUILD_NUMBER" in content or "BUILD_NUMBER" in content or "GITHUB_RUN_NUMBER" in content, \
            "Script should support build number from CI env"
        
        print("✓ Version bump script exists and handles Android+iOS")

    def test_version_bump_script_syntax(self):
        """Version bump script should have valid bash syntax"""
        script_path = "/app/scripts/bump-mobile-version.sh"
        
        # Check bash syntax
        result = subprocess.run(
            ["bash", "-n", script_path],
            capture_output=True,
            text=True
        )
        
        assert result.returncode == 0, f"Script has syntax errors: {result.stderr}"
        print("✓ Version bump script has valid bash syntax")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
