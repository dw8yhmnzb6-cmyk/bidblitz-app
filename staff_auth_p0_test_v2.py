#!/usr/bin/env python3
"""
BidBlitz Staff Auth P0 Fixes Testing - Version 2
=================================================
Tests each P0 fix independently to avoid rate limit interference.

Test Scope:
1. POST /api/staff/auth/login - Rate limiting (5 fails → 401, 6th → 429)
2. POST /api/staff/auth/terminal-pin - Rate limiting (5 fails → 404, 6th → 429)
3. Successful staff login sets staff_session cookie
4. GET /api/staff/auth/me excludes sensitive fields (password_hash, pin, pin_hash)
5. POST /api/staff/auth/terminal-pin with correct PIN returns member data

External URL: https://game-center-hub-1.preview.emergentagent.com
"""

import requests
import json
from datetime import datetime
import time
import sys

# Configuration
BASE_URL = "https://game-center-hub-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials from test_credentials.md
STAFF_EMAIL = "mitarbeiter@bidblitz.com"
STAFF_PASSWORD = "test123"
STAFF_PIN = "1234"

# Test results storage
test_results = []


def log_result(test_name: str, passed: bool, details: str):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = {
        "test": test_name,
        "passed": passed,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    print(f"{status} - {test_name}")
    print(f"   {details}")
    return passed


def test_1_staff_login_rate_limit():
    """Test 1: Staff Login Rate Limiting"""
    print("\n" + "="*80)
    print("TEST 1: Staff Login Rate Limiting")
    print("="*80)
    
    wrong_password = "wrongpassword123"
    test_email = f"test_{int(time.time())}@example.com"  # Use unique email to avoid existing rate limits
    
    # Attempts 1-5: Should return 401
    for i in range(1, 6):
        try:
            resp = requests.post(
                f"{API_BASE}/staff/auth/login",
                json={"email": test_email, "password": wrong_password},
                timeout=10
            )
            if resp.status_code != 401:
                return log_result(
                    "Staff Login Rate Limit",
                    False,
                    f"Attempt {i}: Expected 401, got {resp.status_code}"
                )
            print(f"   Attempt {i}/5: 401 ✓")
            time.sleep(0.3)
        except Exception as e:
            return log_result("Staff Login Rate Limit", False, f"Exception: {e}")
    
    # Attempt 6: Should return 429
    try:
        resp = requests.post(
            f"{API_BASE}/staff/auth/login",
            json={"email": test_email, "password": wrong_password},
            timeout=10
        )
        if resp.status_code == 429:
            data = resp.json()
            return log_result(
                "Staff Login Rate Limit",
                True,
                f"Attempt 6: Got 429 as expected. Message: {data.get('detail', {}).get('message', '')}"
            )
        else:
            return log_result(
                "Staff Login Rate Limit",
                False,
                f"Attempt 6: Expected 429, got {resp.status_code}"
            )
    except Exception as e:
        return log_result("Staff Login Rate Limit", False, f"Exception: {e}")


def test_2_terminal_pin_rate_limit():
    """Test 2: Terminal PIN Rate Limiting"""
    print("\n" + "="*80)
    print("TEST 2: Terminal PIN Rate Limiting")
    print("="*80)
    
    wrong_pin = "9999"
    
    # Wait to avoid interference from previous test
    print("   Waiting 2 seconds...")
    time.sleep(2)
    
    # Attempts 1-5: Should return 404
    for i in range(1, 6):
        try:
            resp = requests.post(
                f"{API_BASE}/staff/auth/terminal-pin",
                json={"pin": wrong_pin},
                timeout=10
            )
            if resp.status_code != 404:
                return log_result(
                    "Terminal PIN Rate Limit",
                    False,
                    f"Attempt {i}: Expected 404, got {resp.status_code}"
                )
            print(f"   Attempt {i}/5: 404 ✓")
            time.sleep(0.3)
        except Exception as e:
            return log_result("Terminal PIN Rate Limit", False, f"Exception: {e}")
    
    # Attempt 6: Should return 429
    try:
        resp = requests.post(
            f"{API_BASE}/staff/auth/terminal-pin",
            json={"pin": wrong_pin},
            timeout=10
        )
        if resp.status_code == 429:
            data = resp.json()
            return log_result(
                "Terminal PIN Rate Limit",
                True,
                f"Attempt 6: Got 429 as expected. Message: {data.get('detail', {}).get('message', '')}"
            )
        else:
            return log_result(
                "Terminal PIN Rate Limit",
                False,
                f"Attempt 6: Expected 429, got {resp.status_code}"
            )
    except Exception as e:
        return log_result("Terminal PIN Rate Limit", False, f"Exception: {e}")


def test_3_successful_staff_login():
    """Test 3: Successful Staff Login"""
    print("\n" + "="*80)
    print("TEST 3: Successful Staff Login (staff_session cookie)")
    print("="*80)
    
    # Wait to avoid rate limit
    print("   Waiting 2 seconds...")
    time.sleep(2)
    
    try:
        resp = requests.post(
            f"{API_BASE}/staff/auth/login",
            json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD},
            timeout=10
        )
        
        if resp.status_code != 200:
            return log_result(
                "Successful Staff Login",
                False,
                f"Expected 200, got {resp.status_code}. Response: {resp.text[:200]}"
            ), None
        
        data = resp.json()
        has_cookie = "staff_session" in resp.cookies
        has_staff = "staff" in data
        
        if has_cookie and has_staff:
            staff = data["staff"]
            return log_result(
                "Successful Staff Login",
                True,
                f"Login successful. Cookie set. Staff: {staff.get('name')} ({staff.get('email')})"
            ), resp.cookies
        else:
            return log_result(
                "Successful Staff Login",
                False,
                f"Missing cookie or staff data. has_cookie={has_cookie}, has_staff={has_staff}"
            ), None
            
    except Exception as e:
        return log_result("Successful Staff Login", False, f"Exception: {e}"), None


def test_4_staff_me_no_sensitive_fields(cookies):
    """Test 4: GET /api/staff/auth/me - No Sensitive Fields"""
    print("\n" + "="*80)
    print("TEST 4: Staff /me Endpoint (no sensitive fields)")
    print("="*80)
    
    if not cookies:
        return log_result(
            "Staff /me - No Sensitive Fields",
            False,
            "No session cookies available (login failed)"
        )
    
    try:
        resp = requests.get(
            f"{API_BASE}/staff/auth/me",
            cookies=cookies,
            timeout=10
        )
        
        if resp.status_code != 200:
            return log_result(
                "Staff /me - No Sensitive Fields",
                False,
                f"Expected 200, got {resp.status_code}"
            )
        
        data = resp.json()
        staff = data.get("staff", {})
        
        # Check for sensitive fields (should NOT be present)
        sensitive_fields = ["password_hash", "pin", "pin_hash"]
        found_sensitive = [f for f in sensitive_fields if f in staff]
        
        # Check for expected fields (should be present)
        expected_fields = ["id", "name", "email", "role"]
        found_expected = [f for f in expected_fields if f in staff]
        
        if found_sensitive:
            return log_result(
                "Staff /me - No Sensitive Fields",
                False,
                f"Found sensitive fields: {found_sensitive}. Staff fields: {list(staff.keys())}"
            )
        elif len(found_expected) != len(expected_fields):
            return log_result(
                "Staff /me - No Sensitive Fields",
                False,
                f"Missing expected fields. Found: {found_expected}, Expected: {expected_fields}"
            )
        else:
            return log_result(
                "Staff /me - No Sensitive Fields",
                True,
                f"No sensitive fields found. Staff fields: {list(staff.keys())}"
            )
            
    except Exception as e:
        return log_result("Staff /me - No Sensitive Fields", False, f"Exception: {e}")


def test_5_terminal_pin_success():
    """Test 5: Terminal PIN Success"""
    print("\n" + "="*80)
    print("TEST 5: Terminal PIN Success (correct PIN)")
    print("="*80)
    
    # Wait to avoid rate limit
    print("   Waiting 2 seconds...")
    time.sleep(2)
    
    try:
        resp = requests.post(
            f"{API_BASE}/staff/auth/terminal-pin",
            json={"pin": STAFF_PIN},
            timeout=10
        )
        
        if resp.status_code != 200:
            return log_result(
                "Terminal PIN Success",
                False,
                f"Expected 200, got {resp.status_code}. Response: {resp.text[:200]}"
            )
        
        data = resp.json()
        member = data.get("member", {})
        
        # Check for sensitive fields (should NOT be present)
        sensitive_fields = ["password_hash", "pin", "pin_hash"]
        found_sensitive = [f for f in sensitive_fields if f in member]
        
        # Check for expected fields (should be present)
        expected_fields = ["id", "name", "email", "role"]
        found_expected = [f for f in expected_fields if f in member]
        
        if found_sensitive:
            return log_result(
                "Terminal PIN Success",
                False,
                f"Found sensitive fields: {found_sensitive}"
            )
        elif len(found_expected) != len(expected_fields):
            return log_result(
                "Terminal PIN Success",
                False,
                f"Missing expected fields. Found: {found_expected}"
            )
        else:
            return log_result(
                "Terminal PIN Success",
                True,
                f"PIN lookup successful. Member: {member.get('name')} ({member.get('email')})"
            )
            
    except Exception as e:
        return log_result("Terminal PIN Success", False, f"Exception: {e}")


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("STAFF AUTH P0 FIXES TEST - BIDBLITZ STAFF (v2)")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Started: {datetime.now().isoformat()}")
    
    # Run tests
    test_1_staff_login_rate_limit()
    test_2_terminal_pin_rate_limit()
    passed_3, cookies = test_3_successful_staff_login()
    test_4_staff_me_no_sensitive_fields(cookies)
    test_5_terminal_pin_success()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total = len(test_results)
    passed = sum(1 for r in test_results if r["passed"])
    failed = total - passed
    
    print(f"\nTotal: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Success Rate: {(passed/total*100):.1f}%")
    
    if failed > 0:
        print("\n❌ Failed Tests:")
        for r in test_results:
            if not r["passed"]:
                print(f"  - {r['test']}")
                print(f"    {r['details']}")
    
    # Save results
    output_file = "/app/staff_auth_p0_test_results_v2.json"
    with open(output_file, "w") as f:
        json.dump({
            "test_run": {
                "timestamp": datetime.now().isoformat(),
                "base_url": BASE_URL,
                "total": total,
                "passed": passed,
                "failed": failed
            },
            "results": test_results
        }, f, indent=2)
    
    print(f"\n✅ Results saved to: {output_file}")
    print("="*80)


if __name__ == "__main__":
    main()
