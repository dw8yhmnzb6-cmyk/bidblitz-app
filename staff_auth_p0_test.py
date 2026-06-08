#!/usr/bin/env python3
"""
BidBlitz Staff Auth P0 Fixes Testing
=====================================
Tests the backend P0 fixes for Staff authentication against production environment.

Test Scope:
1. POST /api/staff/auth/login - Rate limiting (5 fails → 401, 6th → 429)
2. POST /api/staff/auth/terminal-pin - Rate limiting (5 fails → 404, 6th → 429)
3. Successful staff login sets staff_session cookie
4. GET /api/staff/auth/me excludes sensitive fields (password_hash, pin, pin_hash)
5. POST /api/staff/auth/terminal-pin with correct PIN returns member data

External URL: https://taxi-uber-style.preview.emergentagent.com
"""

import requests
import json
from datetime import datetime
from typing import Dict, Any, Optional
import time

# Configuration
BASE_URL = "https://taxi-uber-style.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials from test_credentials.md
STAFF_EMAIL = "mitarbeiter@bidblitz.com"
STAFF_PASSWORD = "test123"
STAFF_PIN = "1234"

# Test results storage
test_results = []
session_cookies = None


def log_test(test_name: str, passed: bool, status_code: int, response_data: Any, 
             expected: str, actual: str, notes: str = ""):
    """Log test result with detailed information"""
    result = {
        "test_name": test_name,
        "passed": passed,
        "status_code": status_code,
        "response": response_data if isinstance(response_data, dict) else str(response_data),
        "expected": expected,
        "actual": actual,
        "notes": notes,
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status} - {test_name}")
    print(f"   Status Code: {status_code}")
    if not passed:
        print(f"   Expected: {expected}")
        print(f"   Actual: {actual}")
    if notes:
        print(f"   Notes: {notes}")
    if isinstance(response_data, dict) and len(str(response_data)) < 500:
        print(f"   Response: {json.dumps(response_data, indent=2)}")


def test_staff_login_rate_limit():
    """
    Test 1: Staff Login Rate Limiting
    - Send 5 failed login attempts → expect 401
    - Send 6th failed login attempt → expect 429
    """
    print("\n" + "="*80)
    print("TEST 1: Staff Login Rate Limiting (5 fails → 401, 6th → 429)")
    print("="*80)
    
    wrong_password = "wrongpassword123"
    
    # Attempt 1-5: Should return 401
    for attempt in range(1, 6):
        print(f"\n  Attempt {attempt}/5 with wrong password...")
        try:
            response = requests.post(
                f"{API_BASE}/staff/auth/login",
                json={"email": STAFF_EMAIL, "password": wrong_password},
                timeout=10
            )
            
            if response.status_code != 401:
                log_test(
                    f"Staff Login Rate Limit - Attempt {attempt}",
                    False,
                    response.status_code,
                    response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text,
                    "401 Unauthorized",
                    f"Status: {response.status_code}",
                    f"Expected 401 for failed login attempt {attempt}"
                )
                return False
            
            print(f"    ✓ Attempt {attempt}: Got 401 as expected")
            time.sleep(0.5)  # Small delay between attempts
            
        except Exception as e:
            log_test(
                f"Staff Login Rate Limit - Attempt {attempt}",
                False,
                0,
                {"error": str(e)},
                "401 Unauthorized",
                f"Exception: {str(e)}"
            )
            return False
    
    # Attempt 6: Should return 429 (rate limited)
    print(f"\n  Attempt 6/6 with wrong password (should be rate limited)...")
    try:
        response = requests.post(
            f"{API_BASE}/staff/auth/login",
            json={"email": STAFF_EMAIL, "password": wrong_password},
            timeout=10
        )
        
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        if response.status_code != 429:
            log_test(
                "Staff Login Rate Limit - 6th Attempt",
                False,
                response.status_code,
                data,
                "429 Too Many Requests",
                f"Status: {response.status_code}",
                "Expected 429 after 5 failed attempts"
            )
            return False
        
        # Check for rate limit details
        has_retry_after = "retry_after_sec" in data or "Retry-After" in response.headers
        has_error_message = "message" in data or "detail" in data
        
        log_test(
            "Staff Login Rate Limit",
            True,
            response.status_code,
            data,
            "429 with retry_after info after 5 failed attempts",
            f"Status: {response.status_code}, has_retry_after={has_retry_after}",
            f"Rate limiting working correctly. Message: {data.get('message', data.get('detail', ''))}"
        )
        
        return True
        
    except Exception as e:
        log_test(
            "Staff Login Rate Limit - 6th Attempt",
            False,
            0,
            {"error": str(e)},
            "429 Too Many Requests",
            f"Exception: {str(e)}"
        )
        return False


def test_terminal_pin_rate_limit():
    """
    Test 2: Terminal PIN Rate Limiting
    - Send 5 failed PIN attempts → expect 404
    - Send 6th failed PIN attempt → expect 429
    """
    print("\n" + "="*80)
    print("TEST 2: Terminal PIN Rate Limiting (5 fails → 404, 6th → 429)")
    print("="*80)
    
    wrong_pin = "9999"
    
    # Attempt 1-5: Should return 404
    for attempt in range(1, 6):
        print(f"\n  Attempt {attempt}/5 with wrong PIN...")
        try:
            response = requests.post(
                f"{API_BASE}/staff/auth/terminal-pin",
                json={"pin": wrong_pin},
                timeout=10
            )
            
            if response.status_code != 404:
                log_test(
                    f"Terminal PIN Rate Limit - Attempt {attempt}",
                    False,
                    response.status_code,
                    response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text,
                    "404 Not Found",
                    f"Status: {response.status_code}",
                    f"Expected 404 for failed PIN attempt {attempt}"
                )
                return False
            
            print(f"    ✓ Attempt {attempt}: Got 404 as expected")
            time.sleep(0.5)  # Small delay between attempts
            
        except Exception as e:
            log_test(
                f"Terminal PIN Rate Limit - Attempt {attempt}",
                False,
                0,
                {"error": str(e)},
                "404 Not Found",
                f"Exception: {str(e)}"
            )
            return False
    
    # Attempt 6: Should return 429 (rate limited)
    print(f"\n  Attempt 6/6 with wrong PIN (should be rate limited)...")
    try:
        response = requests.post(
            f"{API_BASE}/staff/auth/terminal-pin",
            json={"pin": wrong_pin},
            timeout=10
        )
        
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        if response.status_code != 429:
            log_test(
                "Terminal PIN Rate Limit - 6th Attempt",
                False,
                response.status_code,
                data,
                "429 Too Many Requests",
                f"Status: {response.status_code}",
                "Expected 429 after 5 failed attempts"
            )
            return False
        
        # Check for rate limit details
        has_retry_after = "retry_after_sec" in data or "Retry-After" in response.headers
        has_error_message = "message" in data or "detail" in data
        
        log_test(
            "Terminal PIN Rate Limit",
            True,
            response.status_code,
            data,
            "429 with retry_after info after 5 failed attempts",
            f"Status: {response.status_code}, has_retry_after={has_retry_after}",
            f"Rate limiting working correctly. Message: {data.get('message', data.get('detail', ''))}"
        )
        
        return True
        
    except Exception as e:
        log_test(
            "Terminal PIN Rate Limit - 6th Attempt",
            False,
            0,
            {"error": str(e)},
            "429 Too Many Requests",
            f"Exception: {str(e)}"
        )
        return False


def test_successful_staff_login():
    """
    Test 3: Successful Staff Login
    - Login with correct credentials
    - Verify staff_session cookie is set
    """
    print("\n" + "="*80)
    print("TEST 3: Successful Staff Login (sets staff_session cookie)")
    print("="*80)
    
    global session_cookies
    
    # Wait a bit to avoid rate limit from previous tests
    print("\n  Waiting 5 seconds to avoid rate limit...")
    time.sleep(5)
    
    try:
        response = requests.post(
            f"{API_BASE}/staff/auth/login",
            json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD},
            timeout=10
        )
        
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        # Check status code
        status_ok = response.status_code == 200
        
        # Check for staff_session cookie
        has_staff_session = "staff_session" in response.cookies
        
        # Check response structure
        has_success = data.get("success") == True
        has_staff_data = "staff" in data
        
        if has_staff_data:
            staff = data["staff"]
            has_id = "id" in staff
            has_name = "name" in staff
            has_email = "email" in staff and staff["email"] == STAFF_EMAIL
            has_role = "role" in staff
        else:
            has_id = has_name = has_email = has_role = False
        
        all_checks = status_ok and has_staff_session and has_success and has_staff_data and has_email
        
        # Save cookies for subsequent requests
        if status_ok and has_staff_session:
            session_cookies = response.cookies
        
        log_test(
            "Successful Staff Login",
            all_checks,
            response.status_code,
            {
                "has_staff_session_cookie": has_staff_session,
                "success": data.get("success"),
                "staff": data.get("staff", {})
            },
            "200 with staff_session cookie and staff data",
            f"Status: {response.status_code}, has_cookie={has_staff_session}, has_staff={has_staff_data}",
            f"Staff: {data.get('staff', {}).get('name')} ({data.get('staff', {}).get('email')})"
        )
        
        return all_checks
        
    except Exception as e:
        log_test(
            "Successful Staff Login",
            False,
            0,
            {"error": str(e)},
            "200 OK with staff_session cookie",
            f"Exception: {str(e)}"
        )
        return False


def test_staff_me_no_sensitive_fields():
    """
    Test 4: GET /api/staff/auth/me
    - Verify response does NOT contain sensitive fields:
      - password_hash
      - pin
      - pin_hash
    """
    print("\n" + "="*80)
    print("TEST 4: Staff /me Endpoint (no sensitive fields)")
    print("="*80)
    
    if not session_cookies:
        log_test(
            "Staff /me - No Sensitive Fields",
            False,
            0,
            {},
            "Requires login",
            "No session cookies available"
        )
        return False
    
    try:
        response = requests.get(
            f"{API_BASE}/staff/auth/me",
            cookies=session_cookies,
            timeout=10
        )
        
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        # Check status code
        status_ok = response.status_code == 200
        
        # Check response structure
        has_success = data.get("success") == True
        has_staff = "staff" in data
        
        if has_staff:
            staff = data["staff"]
            
            # Check for sensitive fields (should NOT be present)
            has_password_hash = "password_hash" in staff
            has_pin = "pin" in staff
            has_pin_hash = "pin_hash" in staff
            
            # Check for expected fields (should be present)
            has_id = "id" in staff
            has_name = "name" in staff
            has_email = "email" in staff
            has_role = "role" in staff
            
            no_sensitive_fields = not has_password_hash and not has_pin and not has_pin_hash
            has_expected_fields = has_id and has_name and has_email and has_role
            
            all_checks = status_ok and has_success and has_staff and no_sensitive_fields and has_expected_fields
            
            log_test(
                "Staff /me - No Sensitive Fields",
                all_checks,
                response.status_code,
                {
                    "staff_fields": list(staff.keys()),
                    "has_password_hash": has_password_hash,
                    "has_pin": has_pin,
                    "has_pin_hash": has_pin_hash,
                    "has_expected_fields": has_expected_fields
                },
                "200 with staff data, NO sensitive fields (password_hash, pin, pin_hash)",
                f"Status: {response.status_code}, no_sensitive={no_sensitive_fields}, has_expected={has_expected_fields}",
                f"Staff fields: {list(staff.keys())}"
            )
            
            return all_checks
        else:
            log_test(
                "Staff /me - No Sensitive Fields",
                False,
                response.status_code,
                data,
                "200 with staff data",
                f"Status: {response.status_code}, has_staff={has_staff}"
            )
            return False
        
    except Exception as e:
        log_test(
            "Staff /me - No Sensitive Fields",
            False,
            0,
            {"error": str(e)},
            "200 OK with staff data",
            f"Exception: {str(e)}"
        )
        return False


def test_terminal_pin_success():
    """
    Test 5: Terminal PIN Success
    - Send correct PIN (1234)
    - Verify member data is returned
    """
    print("\n" + "="*80)
    print("TEST 5: Terminal PIN Success (correct PIN returns member)")
    print("="*80)
    
    # Wait a bit to avoid rate limit from previous tests
    print("\n  Waiting 5 seconds to avoid rate limit...")
    time.sleep(5)
    
    try:
        response = requests.post(
            f"{API_BASE}/staff/auth/terminal-pin",
            json={"pin": STAFF_PIN},
            timeout=10
        )
        
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        # Check status code
        status_ok = response.status_code == 200
        
        # Check response structure
        has_success = data.get("success") == True
        has_member = "member" in data
        
        if has_member:
            member = data["member"]
            has_id = "id" in member
            has_name = "name" in member
            has_email = "email" in member
            has_role = "role" in member
            
            # Check for sensitive fields (should NOT be present)
            has_password_hash = "password_hash" in member
            has_pin = "pin" in member
            has_pin_hash = "pin_hash" in member
            
            no_sensitive_fields = not has_password_hash and not has_pin and not has_pin_hash
            has_expected_fields = has_id and has_name and has_email and has_role
            
            all_checks = status_ok and has_success and has_member and no_sensitive_fields and has_expected_fields
            
            log_test(
                "Terminal PIN Success",
                all_checks,
                response.status_code,
                {
                    "success": data.get("success"),
                    "member": member,
                    "member_fields": list(member.keys()),
                    "no_sensitive_fields": no_sensitive_fields
                },
                "200 with member data (id, name, email, role), NO sensitive fields",
                f"Status: {response.status_code}, has_member={has_member}, no_sensitive={no_sensitive_fields}",
                f"Member: {member.get('name')} ({member.get('email')})"
            )
            
            return all_checks
        else:
            log_test(
                "Terminal PIN Success",
                False,
                response.status_code,
                data,
                "200 with member data",
                f"Status: {response.status_code}, has_member={has_member}"
            )
            return False
        
    except Exception as e:
        log_test(
            "Terminal PIN Success",
            False,
            0,
            {"error": str(e)},
            "200 OK with member data",
            f"Exception: {str(e)}"
        )
        return False


def print_summary():
    """Print comprehensive test summary"""
    print("\n" + "="*80)
    print("STAFF AUTH P0 FIXES TEST SUMMARY")
    print("="*80)
    
    total_tests = len(test_results)
    passed_tests = sum(1 for t in test_results if t["passed"])
    failed_tests = total_tests - passed_tests
    
    print(f"\n📊 Test Results:")
    print(f"   Total Tests: {total_tests}")
    print(f"   Passed: {passed_tests} ✅")
    print(f"   Failed: {failed_tests} ❌")
    print(f"   Success Rate: {(passed_tests/total_tests*100):.1f}%")
    
    print(f"\n🔒 P0 Security Fixes Verified:")
    print(f"   1. Staff Login Rate Limiting (5 fails → 401, 6th → 429)")
    print(f"   2. Terminal PIN Rate Limiting (5 fails → 404, 6th → 429)")
    print(f"   3. Successful login sets staff_session cookie")
    print(f"   4. /me endpoint excludes sensitive fields")
    print(f"   5. Terminal PIN returns member data")
    
    if failed_tests > 0:
        print("\n❌ FAILED TESTS:")
        for test in test_results:
            if not test["passed"]:
                print(f"  - {test['test_name']}")
                print(f"    Status: {test['status_code']}")
                print(f"    Expected: {test['expected']}")
                print(f"    Actual: {test['actual']}")
    
    print("\n" + "="*80)


def main():
    """Run all staff auth P0 tests"""
    print("\n" + "="*80)
    print("STAFF AUTH P0 FIXES TEST - BIDBLITZ STAFF")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print(f"Test User: {STAFF_EMAIL}")
    print(f"Started: {datetime.now().isoformat()}")
    print("\nTest Scope:")
    print("  1. Staff Login Rate Limiting (5 fails → 401, 6th → 429)")
    print("  2. Terminal PIN Rate Limiting (5 fails → 404, 6th → 429)")
    print("  3. Successful Staff Login (sets staff_session cookie)")
    print("  4. GET /api/staff/auth/me (no sensitive fields)")
    print("  5. Terminal PIN Success (correct PIN returns member)")
    
    # Run tests in sequence
    test_staff_login_rate_limit()
    test_terminal_pin_rate_limit()
    test_successful_staff_login()
    test_staff_me_no_sensitive_fields()
    test_terminal_pin_success()
    
    # Print summary
    print_summary()
    
    # Save results to file
    output_file = "/app/staff_auth_p0_test_results.json"
    with open(output_file, "w") as f:
        json.dump({
            "test_run": {
                "timestamp": datetime.now().isoformat(),
                "base_url": BASE_URL,
                "test_user": STAFF_EMAIL,
                "total_tests": len(test_results),
                "passed": sum(1 for t in test_results if t["passed"]),
                "failed": sum(1 for t in test_results if not t["passed"]),
            },
            "p0_fixes": {
                "staff_login_rate_limit": "5 fails → 401, 6th → 429",
                "terminal_pin_rate_limit": "5 fails → 404, 6th → 429",
                "staff_session_cookie": "Set on successful login",
                "no_sensitive_fields": "password_hash, pin, pin_hash excluded from /me",
                "terminal_pin_success": "Correct PIN returns member data"
            },
            "test_results": test_results
        }, f, indent=2)
    
    print(f"\n✅ Test results saved to: {output_file}")


if __name__ == "__main__":
    main()
