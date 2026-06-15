#!/usr/bin/env python3
"""
BidBlitz Backend Testing - iter125 Retest
Tests specific endpoints after recent fixes:
1. GET /api/kids/controls/:childId/settings
2. GET /api/kids/controls/:childId/dashboard
3. GET /api/kids/controls/:childId/activity
4. GET /api/driver-dashboard/eligibility
5. GET /api/taxi/driver/documents/summary
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://game-center-hub-1.preview.emergentagent.com"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

# Test results
results = {
    "timestamp": datetime.now().isoformat(),
    "base_url": BASE_URL,
    "tests": []
}

def log_test(name, passed, status_code, details="", response_data=None):
    """Log test result."""
    result = {
        "test": name,
        "passed": passed,
        "status_code": status_code,
        "details": details,
        "response_sample": response_data
    }
    results["tests"].append(result)
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} | {name} | Status: {status_code} | {details}")
    return passed

def admin_login():
    """Login as admin and return session with cookies."""
    print("\n" + "="*80)
    print("ADMIN LOGIN")
    print("="*80)
    
    session = requests.Session()
    
    try:
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Admin login successful: {data.get('user', {}).get('email')}")
            print(f"   Cookies: {list(session.cookies.keys())}")
            return session
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return None
            
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def get_child_id(session):
    """Get a child_id from the kids system."""
    print("\n" + "="*80)
    print("GET CHILD ID")
    print("="*80)
    
    try:
        response = session.get(
            f"{BASE_URL}/api/kids/children",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            children = data.get("children", [])
            if children:
                child_id = children[0].get("child_id")
                child_name = children[0].get("name", "Unknown")
                print(f"✅ Found child: {child_name} (ID: {child_id})")
                return child_id
            else:
                print("⚠️  No children found in system")
                return None
        else:
            print(f"❌ Failed to get children: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Error getting children: {e}")
        return None

def test_kids_controls_settings(session, child_id):
    """Test GET /api/kids/controls/:childId/settings"""
    print("\n" + "="*80)
    print("TEST 1: GET /api/kids/controls/:childId/settings")
    print("="*80)
    
    try:
        response = session.get(
            f"{BASE_URL}/api/kids/controls/{child_id}/settings",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            settings = data.get("settings", {})
            child = data.get("child", {})
            
            # Verify response structure
            has_modules = "modules" in settings
            has_bedtime = "bedtime_enabled" in settings
            has_child = "name" in child
            
            if has_modules and has_bedtime and has_child:
                log_test(
                    "Kids Controls Settings",
                    True,
                    200,
                    f"Settings loaded for child: {child.get('name')}",
                    {
                        "modules_count": len(settings.get("modules", {})),
                        "bedtime_enabled": settings.get("bedtime_enabled"),
                        "lock_all": settings.get("lock_all"),
                        "child_name": child.get("name")
                    }
                )
                return True
            else:
                log_test(
                    "Kids Controls Settings",
                    False,
                    200,
                    "Response missing required fields",
                    data
                )
                return False
        else:
            log_test(
                "Kids Controls Settings",
                False,
                response.status_code,
                f"Expected 200, got {response.status_code}",
                response.text[:200]
            )
            return False
            
    except Exception as e:
        log_test("Kids Controls Settings", False, 0, f"Exception: {e}")
        return False

def test_kids_controls_dashboard(session, child_id):
    """Test GET /api/kids/controls/:childId/dashboard"""
    print("\n" + "="*80)
    print("TEST 2: GET /api/kids/controls/:childId/dashboard")
    print("="*80)
    
    try:
        response = session.get(
            f"{BASE_URL}/api/kids/controls/{child_id}/dashboard",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            summary = data.get("summary", {})
            child = data.get("child", {})
            
            # Verify response structure
            has_summary = "active_modules" in summary
            has_usage = "today_minutes" in summary
            has_child = "name" in child
            
            if has_summary and has_usage and has_child:
                log_test(
                    "Kids Controls Dashboard",
                    True,
                    200,
                    f"Dashboard loaded for child: {child.get('name')}",
                    {
                        "active_modules": summary.get("active_modules"),
                        "today_minutes": summary.get("today_minutes"),
                        "week_minutes": summary.get("week_minutes"),
                        "balance_eur": summary.get("balance_eur"),
                        "alerts_count": len(data.get("alerts", []))
                    }
                )
                return True
            else:
                log_test(
                    "Kids Controls Dashboard",
                    False,
                    200,
                    "Response missing required fields",
                    data
                )
                return False
        else:
            log_test(
                "Kids Controls Dashboard",
                False,
                response.status_code,
                f"Expected 200, got {response.status_code}",
                response.text[:200]
            )
            return False
            
    except Exception as e:
        log_test("Kids Controls Dashboard", False, 0, f"Exception: {e}")
        return False

def test_kids_controls_activity(session, child_id):
    """Test GET /api/kids/controls/:childId/activity"""
    print("\n" + "="*80)
    print("TEST 3: GET /api/kids/controls/:childId/activity")
    print("="*80)
    
    try:
        response = session.get(
            f"{BASE_URL}/api/kids/controls/{child_id}/activity?days=7",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            has_child_id = "child_id" in data
            has_days = "days" in data
            has_total = "total_minutes" in data
            has_per_day = "per_day" in data
            has_per_module = "per_module" in data
            
            if has_child_id and has_days and has_total and has_per_day and has_per_module:
                log_test(
                    "Kids Controls Activity",
                    True,
                    200,
                    f"Activity report loaded for {data.get('days')} days",
                    {
                        "child_id": data.get("child_id"),
                        "days": data.get("days"),
                        "total_minutes": data.get("total_minutes"),
                        "per_day_count": len(data.get("per_day", {})),
                        "per_module_count": len(data.get("per_module", {}))
                    }
                )
                return True
            else:
                log_test(
                    "Kids Controls Activity",
                    False,
                    200,
                    "Response missing required fields",
                    data
                )
                return False
        else:
            log_test(
                "Kids Controls Activity",
                False,
                response.status_code,
                f"Expected 200, got {response.status_code}",
                response.text[:200]
            )
            return False
            
    except Exception as e:
        log_test("Kids Controls Activity", False, 0, f"Exception: {e}")
        return False

def test_driver_dashboard_eligibility(session):
    """Test GET /api/driver-dashboard/eligibility"""
    print("\n" + "="*80)
    print("TEST 4: GET /api/driver-dashboard/eligibility")
    print("="*80)
    
    try:
        response = session.get(
            f"{BASE_URL}/api/driver-dashboard/eligibility",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            has_is_driver = "is_driver" in data
            has_is_verified = "is_verified" in data
            has_status = "status" in data
            
            if has_is_driver and has_is_verified and has_status:
                log_test(
                    "Driver Dashboard Eligibility",
                    True,
                    200,
                    f"Eligibility check successful",
                    {
                        "is_driver": data.get("is_driver"),
                        "is_verified": data.get("is_verified"),
                        "status": data.get("status"),
                        "driver_id": data.get("driver_id")
                    }
                )
                return True
            else:
                log_test(
                    "Driver Dashboard Eligibility",
                    False,
                    200,
                    "Response missing required fields",
                    data
                )
                return False
        else:
            log_test(
                "Driver Dashboard Eligibility",
                False,
                response.status_code,
                f"Expected 200, got {response.status_code}",
                response.text[:200]
            )
            return False
            
    except Exception as e:
        log_test("Driver Dashboard Eligibility", False, 0, f"Exception: {e}")
        return False

def test_taxi_driver_documents_summary(session):
    """Test GET /api/taxi/driver/documents/summary"""
    print("\n" + "="*80)
    print("TEST 5: GET /api/taxi/driver/documents/summary")
    print("="*80)
    
    try:
        response = session.get(
            f"{BASE_URL}/api/taxi/driver/documents/summary",
            timeout=10
        )
        
        # This endpoint requires driver role, so 403 is acceptable
        # We're testing that it doesn't return 404
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            has_counts = "counts" in data
            has_missing = "missing_required" in data
            has_blocker = "has_blocker" in data
            
            if has_counts and has_missing and has_blocker:
                log_test(
                    "Taxi Driver Documents Summary",
                    True,
                    200,
                    f"Documents summary loaded",
                    {
                        "counts": data.get("counts"),
                        "missing_required_count": len(data.get("missing_required", [])),
                        "has_blocker": data.get("has_blocker"),
                        "alerts_count": len(data.get("alerts", []))
                    }
                )
                return True
            else:
                log_test(
                    "Taxi Driver Documents Summary",
                    False,
                    200,
                    "Response missing required fields",
                    data
                )
                return False
        elif response.status_code == 403:
            # 403 is acceptable - means endpoint exists but user doesn't have driver role
            log_test(
                "Taxi Driver Documents Summary",
                True,
                403,
                "Endpoint exists (403 Forbidden - user not a driver, expected)",
                {"message": "Endpoint accessible, requires driver role"}
            )
            return True
        elif response.status_code == 404:
            log_test(
                "Taxi Driver Documents Summary",
                False,
                404,
                "Endpoint not found (404) - this is the bug we're testing for",
                response.text[:200]
            )
            return False
        else:
            log_test(
                "Taxi Driver Documents Summary",
                False,
                response.status_code,
                f"Unexpected status code: {response.status_code}",
                response.text[:200]
            )
            return False
            
    except Exception as e:
        log_test("Taxi Driver Documents Summary", False, 0, f"Exception: {e}")
        return False

def main():
    """Run all tests."""
    print("\n" + "="*80)
    print("BIDBLITZ BACKEND TESTING - ITER125 RETEST")
    print("Testing specific endpoints after recent fixes")
    print("="*80)
    
    # Login
    session = admin_login()
    if not session:
        print("\n❌ CRITICAL: Admin login failed. Cannot proceed with tests.")
        return
    
    # Get child ID for kids tests
    child_id = get_child_id(session)
    if not child_id:
        print("\n⚠️  WARNING: No child found. Skipping kids/controls tests.")
        kids_tests_passed = 0
    else:
        # Run kids/controls tests
        test1 = test_kids_controls_settings(session, child_id)
        test2 = test_kids_controls_dashboard(session, child_id)
        test3 = test_kids_controls_activity(session, child_id)
        kids_tests_passed = sum([test1, test2, test3])
    
    # Run driver tests
    test4 = test_driver_dashboard_eligibility(session)
    test5 = test_taxi_driver_documents_summary(session)
    driver_tests_passed = sum([test4, test5])
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total_tests = len(results["tests"])
    passed_tests = sum(1 for t in results["tests"] if t["passed"])
    failed_tests = total_tests - passed_tests
    
    print(f"\nTotal Tests: {total_tests}")
    print(f"✅ Passed: {passed_tests}")
    print(f"❌ Failed: {failed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
    
    print("\n" + "-"*80)
    print("DETAILED RESULTS:")
    print("-"*80)
    
    for test in results["tests"]:
        status = "✅ PASS" if test["passed"] else "❌ FAIL"
        print(f"{status} | {test['test']}")
        print(f"       Status: {test['status_code']} | {test['details']}")
    
    # Save results
    with open("/app/backend_test_iter125_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Full results saved to: /app/backend_test_iter125_results.json")
    
    # Exit code
    if failed_tests > 0:
        print(f"\n❌ {failed_tests} test(s) failed")
        exit(1)
    else:
        print(f"\n✅ All {passed_tests} tests passed!")
        exit(0)

if __name__ == "__main__":
    main()
