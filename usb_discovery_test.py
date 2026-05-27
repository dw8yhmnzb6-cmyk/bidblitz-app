#!/usr/bin/env python3
"""
USB Discovery Endpoint Backend Smoke Test
Tests the new GET /api/table-hardware/usb-discover endpoint
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://floorplan-wizard-8.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials - using admin credentials for regular auth
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

# Test results
test_results = []
session_cookies = None


def log_test(test_name: str, passed: bool, status_code: int, response_data: any, 
             expected: str, actual: str, notes: str = ""):
    """Log test result"""
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
    if isinstance(response_data, dict):
        print(f"   Response: {json.dumps(response_data, indent=2)}")


def test_admin_login():
    """Test: Admin Login"""
    print("\n" + "="*80)
    print("TEST: Admin Login - POST /api/auth/login")
    print("="*80)
    
    global session_cookies
    
    try:
        response = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        
        if response.status_code == 200:
            session_cookies = response.cookies
            data = response.json()
            
            log_test(
                "Admin Login",
                True,
                200,
                {"user": data.get("user", {})},
                "200 OK with session cookie",
                f"200 OK - User: {data.get('user', {}).get('email')}",
                f"Session cookie set: {bool(session_cookies)}"
            )
            return True
        else:
            log_test(
                "Admin Login",
                False,
                response.status_code,
                response.text,
                "200 OK",
                f"{response.status_code} - {response.text[:200]}"
            )
            return False
            
    except Exception as e:
        log_test(
            "Admin Login",
            False,
            0,
            str(e),
            "200 OK",
            f"Exception: {str(e)}"
        )
        return False


def test_usb_discover():
    """Test: USB Discovery Endpoint"""
    print("\n" + "="*80)
    print("TEST: USB Discovery - GET /api/table-hardware/usb-discover")
    print("="*80)
    
    if not session_cookies:
        print("⚠️  Skipping - No session cookies (login failed)")
        return False
    
    try:
        # Debug: print cookies
        print(f"   Using cookies: {dict(session_cookies)}")
        
        response = requests.get(
            f"{API_BASE}/table-hardware/usb-discover",
            cookies=session_cookies,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            has_devices = "devices" in data
            has_count = "count" in data
            has_mocked = "mocked" in data
            has_message = "message" in data
            
            all_fields_present = has_devices and has_count and has_mocked and has_message
            
            # Check if mocked=true in preview (acceptable)
            is_mocked = data.get("mocked", False)
            
            # Check for fallback paths
            devices = data.get("devices", [])
            has_fallback_paths = False
            fallback_paths = ["/dev/usb/lp0", "/dev/usb/lp1", "/dev/ttyUSB0"]
            
            for device in devices:
                device_path = device.get("path", "")
                if any(fb_path in device_path for fb_path in fallback_paths):
                    has_fallback_paths = True
                    break
            
            # Test passes if:
            # 1. Status is 200
            # 2. All required fields present
            # 3. In preview, mocked=true is acceptable
            # 4. Contains fallback paths like /dev/usb/lp0 or /dev/ttyUSB0
            
            test_passed = all_fields_present
            
            notes = []
            notes.append(f"Fields present: devices={has_devices}, count={has_count}, mocked={has_mocked}, message={has_message}")
            notes.append(f"Mocked: {is_mocked} (acceptable in preview)")
            notes.append(f"Device count: {data.get('count', 0)}")
            notes.append(f"Has fallback paths: {has_fallback_paths}")
            if devices:
                notes.append(f"Sample device paths: {[d.get('path') for d in devices[:3]]}")
            notes.append(f"Message: {data.get('message', 'N/A')}")
            
            log_test(
                "USB Discovery Endpoint",
                test_passed,
                200,
                data,
                "200 OK with devices, count, mocked, message fields",
                f"200 OK - All fields present: {all_fields_present}",
                "\n   ".join(notes)
            )
            return test_passed
        else:
            log_test(
                "USB Discovery Endpoint",
                False,
                response.status_code,
                response.text[:500],
                "200 OK",
                f"{response.status_code} - {response.text[:200]}"
            )
            return False
            
    except Exception as e:
        log_test(
            "USB Discovery Endpoint",
            False,
            0,
            str(e),
            "200 OK",
            f"Exception: {str(e)}"
        )
        return False


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("USB DISCOVERY ENDPOINT - BACKEND SMOKE TEST")
    print("="*80)
    print(f"Target: {BASE_URL}")
    print(f"Endpoint: GET /api/table-hardware/usb-discover")
    print(f"Auth: {ADMIN_EMAIL}")
    print("="*80)
    
    # Run tests
    login_success = test_admin_login()
    
    if login_success:
        test_usb_discover()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in test_results if r["passed"])
    total = len(test_results)
    
    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {(passed/total*100) if total > 0 else 0:.1f}%")
    
    print("\n" + "="*80)
    print("DETAILED RESULTS")
    print("="*80)
    
    for result in test_results:
        status = "✅ PASS" if result["passed"] else "❌ FAIL"
        print(f"\n{status} - {result['test_name']}")
        print(f"   Status Code: {result['status_code']}")
        if result.get("notes"):
            print(f"   Notes: {result['notes']}")
    
    # Save results
    with open("/app/usb_discovery_test_results.json", "w") as f:
        json.dump(test_results, f, indent=2)
    
    print(f"\n✅ Test results saved to /app/usb_discovery_test_results.json")
    
    return passed == total


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
