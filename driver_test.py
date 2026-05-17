#!/usr/bin/env python3
"""
BidBlitz V2 - Verified Driver Test Account Testing
Tests the new verified driver test account seeded at backend startup.

Test Account: admin@bidblitz.com / BidBlitz2026!
Expected: Active, verified driver with full dashboard access

Test Scope:
1. GET /api/driver-dashboard/eligibility -> is_driver=true, is_verified=true, status=active
2. GET /api/driver-dashboard/profile -> 200 OK with driver profile
3. GET /api/driver-dashboard/status -> 200 OK with driver status
4. GET /api/taxi/driver/documents/summary -> 200 OK with documents summary
"""

import requests
import json
from datetime import datetime
from typing import Dict, Any

# Configuration
BASE_URL = "https://bidblitz-staff.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials - verified driver account
DRIVER_EMAIL = "admin@bidblitz.com"
DRIVER_PASSWORD = "BidBlitz2026!"

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
    print(f"   Expected: {expected}")
    print(f"   Actual: {actual}")
    if notes:
        print(f"   Notes: {notes}")
    if not passed and isinstance(response_data, dict):
        print(f"   Response: {json.dumps(response_data, indent=2)}")


def test_driver_login():
    """Test 1: Login with verified driver account"""
    global session_cookies
    
    print("\n" + "="*80)
    print("TEST 1: Driver Login")
    print("="*80)
    
    url = f"{API_BASE}/auth/login"
    payload = {
        "email": DRIVER_EMAIL,
        "password": DRIVER_PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload)
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        # Store cookies for subsequent requests
        session_cookies = response.cookies
        
        passed = (
            response.status_code == 200 and
            "email" in data and
            data.get("email") == DRIVER_EMAIL
        )
        
        log_test(
            "Driver Login",
            passed,
            response.status_code,
            data,
            "200 OK with user data and session cookies",
            f"{response.status_code} with email={data.get('email')}",
            f"Cookies: {list(session_cookies.keys())}"
        )
        
        return passed
        
    except Exception as e:
        log_test("Driver Login", False, 0, {}, "200 OK", f"Exception: {str(e)}")
        return False


def test_driver_eligibility():
    """Test 2: GET /api/driver-dashboard/eligibility"""
    print("\n" + "="*80)
    print("TEST 2: Driver Eligibility Check")
    print("="*80)
    
    url = f"{API_BASE}/driver-dashboard/eligibility"
    
    try:
        response = requests.get(url, cookies=session_cookies)
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        # Check all required fields
        is_driver = data.get("is_driver")
        is_verified = data.get("is_verified")
        status = data.get("status")
        
        passed = (
            response.status_code == 200 and
            is_driver is True and
            is_verified is True and
            status == "active"
        )
        
        log_test(
            "Driver Eligibility",
            passed,
            response.status_code,
            data,
            "is_driver=true, is_verified=true, status=active",
            f"is_driver={is_driver}, is_verified={is_verified}, status={status}",
            f"Driver ID: {data.get('driver_id', 'N/A')}"
        )
        
        return passed
        
    except Exception as e:
        log_test("Driver Eligibility", False, 0, {}, "200 OK", f"Exception: {str(e)}")
        return False


def test_driver_profile():
    """Test 3: GET /api/driver-dashboard/profile"""
    print("\n" + "="*80)
    print("TEST 3: Driver Profile")
    print("="*80)
    
    url = f"{API_BASE}/driver-dashboard/profile"
    
    try:
        response = requests.get(url, cookies=session_cookies)
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        # Check required fields
        required_fields = ["driver_id", "name", "email", "vehicle", "rating", "is_verified", "status", "stats"]
        missing_fields = [f for f in required_fields if f not in data]
        
        passed = (
            response.status_code == 200 and
            len(missing_fields) == 0 and
            data.get("is_verified") is True and
            data.get("status") == "active"
        )
        
        stats = data.get("stats", {})
        
        log_test(
            "Driver Profile",
            passed,
            response.status_code,
            data,
            "200 OK with complete driver profile (driver_id, name, email, vehicle, rating, stats)",
            f"200 OK with {len(data)} fields, missing: {missing_fields if missing_fields else 'none'}",
            f"Stats: {stats.get('total_rides', 0)} rides, €{stats.get('total_earned', 0)} earned, €{stats.get('wallet_balance', 0)} balance"
        )
        
        return passed
        
    except Exception as e:
        log_test("Driver Profile", False, 0, {}, "200 OK", f"Exception: {str(e)}")
        return False


def test_driver_status():
    """Test 4: GET /api/driver-dashboard/status"""
    print("\n" + "="*80)
    print("TEST 4: Driver Status")
    print("="*80)
    
    url = f"{API_BASE}/driver-dashboard/status"
    
    try:
        response = requests.get(url, cookies=session_cookies)
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        # Check required fields
        required_fields = ["driver_id", "name", "is_online", "is_busy", "vehicle", "rating", "earnings"]
        missing_fields = [f for f in required_fields if f not in data]
        
        earnings = data.get("earnings", {})
        earnings_fields = ["today", "today_rides", "week", "week_rides", "total_rides"]
        missing_earnings = [f for f in earnings_fields if f not in earnings]
        
        passed = (
            response.status_code == 200 and
            len(missing_fields) == 0 and
            len(missing_earnings) == 0
        )
        
        log_test(
            "Driver Status",
            passed,
            response.status_code,
            data,
            "200 OK with driver status (is_online, is_busy, earnings, active_ride, pending_requests)",
            f"200 OK with {len(data)} fields, missing: {missing_fields if missing_fields else 'none'}",
            f"Online: {data.get('is_online')}, Busy: {data.get('is_busy')}, Today: €{earnings.get('today', 0)} ({earnings.get('today_rides', 0)} rides)"
        )
        
        return passed
        
    except Exception as e:
        log_test("Driver Status", False, 0, {}, "200 OK", f"Exception: {str(e)}")
        return False


def test_driver_documents_summary():
    """Test 5: GET /api/taxi/driver/documents/summary"""
    print("\n" + "="*80)
    print("TEST 5: Driver Documents Summary")
    print("="*80)
    
    url = f"{API_BASE}/taxi/driver/documents/summary"
    
    try:
        response = requests.get(url, cookies=session_cookies)
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        # Check required fields
        required_fields = ["counts", "missing_required", "alerts", "has_blocker"]
        missing_fields = [f for f in required_fields if f not in data]
        
        counts = data.get("counts", {})
        
        passed = (
            response.status_code == 200 and
            len(missing_fields) == 0 and
            isinstance(counts, dict)
        )
        
        log_test(
            "Driver Documents Summary",
            passed,
            response.status_code,
            data,
            "200 OK with documents summary (counts, missing_required, alerts, has_blocker)",
            f"200 OK with {len(data)} fields, missing: {missing_fields if missing_fields else 'none'}",
            f"Counts: {counts}, Missing: {len(data.get('missing_required', []))}, Alerts: {len(data.get('alerts', []))}, Blocker: {data.get('has_blocker')}"
        )
        
        return passed
        
    except Exception as e:
        log_test("Driver Documents Summary", False, 0, {}, "200 OK", f"Exception: {str(e)}")
        return False


def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total = len(test_results)
    passed = sum(1 for r in test_results if r["passed"])
    failed = total - passed
    
    print(f"\nTotal Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Success Rate: {(passed/total*100):.1f}%")
    
    if failed > 0:
        print("\n" + "="*80)
        print("FAILED TESTS:")
        print("="*80)
        for result in test_results:
            if not result["passed"]:
                print(f"\n❌ {result['test_name']}")
                print(f"   Status: {result['status_code']}")
                print(f"   Expected: {result['expected']}")
                print(f"   Actual: {result['actual']}")
                if result['notes']:
                    print(f"   Notes: {result['notes']}")
    
    # Save results to file
    with open("/app/driver_test_results.json", "w") as f:
        json.dump(test_results, f, indent=2)
    
    print(f"\n✓ Test results saved to /app/driver_test_results.json")


def main():
    """Run all driver tests"""
    print("\n" + "="*80)
    print("BIDBLITZ V2 - VERIFIED DRIVER TEST ACCOUNT TESTING")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Account: {DRIVER_EMAIL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    # Run tests in sequence
    tests = [
        test_driver_login,
        test_driver_eligibility,
        test_driver_profile,
        test_driver_status,
        test_driver_documents_summary,
    ]
    
    for test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"\n❌ CRITICAL ERROR in {test_func.__name__}: {str(e)}")
    
    # Print summary
    print_summary()


if __name__ == "__main__":
    main()
