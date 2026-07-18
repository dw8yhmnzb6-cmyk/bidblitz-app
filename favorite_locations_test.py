#!/usr/bin/env python3
"""
Backend API Testing Script for Taxi Favorite Locations
Tests all scenarios specified in the review request
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://super-app-staging-2.preview.emergentagent.com"
LOGIN_ENDPOINT = f"{BASE_URL}/api/auth/login"
FAVORITES_ENDPOINT = f"{BASE_URL}/api/taxi/user/favorite-locations"

# Test credentials
TEST_EMAIL = "admin@bidblitz.ae"
TEST_PASSWORD = "BidBlitz2026!"

# Test results storage
test_results = []
session = requests.Session()

def log_test(test_name, passed, status_code, response_data, expected, actual):
    """Log test result"""
    result = {
        "test_name": test_name,
        "passed": passed,
        "status_code": status_code,
        "response": response_data,
        "expected": expected,
        "actual": actual,
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status} - {test_name}")
    print(f"   Status Code: {status_code} (Expected: {expected})")
    if not passed:
        print(f"   Expected: {expected}")
        print(f"   Actual: {actual}")
    print(f"   Response: {json.dumps(response_data, indent=2)}")

def login():
    """Login to get session cookie"""
    print("\n" + "="*80)
    print("PRE-REQUISITE: Login to get session cookie")
    print("="*80)
    
    payload = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    try:
        response = session.post(LOGIN_ENDPOINT, json=payload, timeout=10)
        data = response.json()
        
        # Login uses cookie-based authentication, not token
        if response.status_code == 200 and "email" in data:
            print(f"✅ Login successful")
            print(f"   User: {data.get('email', 'N/A')}")
            print(f"   Role: {data.get('role', 'N/A')}")
            print(f"   Cookies: {list(session.cookies.keys())}")
            return True
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"   Response: {json.dumps(data, indent=2)}")
            return False
            
    except Exception as e:
        print(f"❌ Login exception: {str(e)}")
        return False

def test_1_get_empty_favorites():
    """Test 1: GET Empty Favorites"""
    print("\n" + "="*80)
    print("TEST 1: GET Empty Favorites")
    print("="*80)
    
    try:
        response = session.get(FAVORITES_ENDPOINT, timeout=10)
        data = response.json()
        
        # Check status code
        status_ok = response.status_code == 200
        
        # Check response structure
        has_favorites = "favorites" in data
        has_count = "count" in data
        is_list = isinstance(data.get("favorites"), list)
        
        all_checks = status_ok and has_favorites and has_count and is_list
        
        log_test(
            "Test 1: GET Empty Favorites",
            all_checks,
            response.status_code,
            data,
            "200 with favorites array and count",
            f"Status: {response.status_code}, has_favorites={has_favorites}, has_count={has_count}, is_list={is_list}"
        )
        
        return data.get("count", 0)
        
    except Exception as e:
        log_test(
            "Test 1: GET Empty Favorites",
            False,
            0,
            {"error": str(e)},
            "200 with favorites array and count",
            f"Exception: {str(e)}"
        )
        return 0

def test_2_add_new_favorite():
    """Test 2: POST Add New Favorite"""
    print("\n" + "="*80)
    print("TEST 2: POST Add New Favorite")
    print("="*80)
    
    # Use timestamp to make address unique for each test run
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    
    payload = {
        "name": "Test Zuhause",
        "address": f"Alexanderplatz 1, 10178 Berlin (Test {timestamp})",
        "latitude": 52.5219,
        "longitude": 13.4132,
        "icon": "home"
    }
    
    try:
        response = session.post(FAVORITES_ENDPOINT, json=payload, timeout=10)
        data = response.json()
        
        # Check status code
        status_ok = response.status_code == 200
        
        # Check response structure
        has_ok = "ok" in data and data["ok"] == True
        has_favorite = "favorite" in data
        has_id = False
        favorite_id = None
        
        if has_favorite and isinstance(data["favorite"], dict):
            has_id = "id" in data["favorite"]
            favorite_id = data["favorite"].get("id")
        
        all_checks = status_ok and has_ok and has_favorite and has_id
        
        log_test(
            "Test 2: POST Add New Favorite",
            all_checks,
            response.status_code,
            data,
            "200 with ok=true, favorite object with id",
            f"Status: {response.status_code}, ok={data.get('ok')}, has_favorite={has_favorite}, has_id={has_id}"
        )
        
        return favorite_id
        
    except Exception as e:
        log_test(
            "Test 2: POST Add New Favorite",
            False,
            0,
            {"error": str(e)},
            "200 with ok=true, favorite object with id",
            f"Exception: {str(e)}"
        )
        return None

def test_3_duplicate_address(test_address):
    """Test 3: POST Duplicate Address (should fail)"""
    print("\n" + "="*80)
    print("TEST 3: POST Duplicate Address (should fail)")
    print("="*80)
    
    payload = {
        "name": "Test Zuhause",
        "address": test_address,
        "latitude": 52.5219,
        "longitude": 13.4132,
        "icon": "home"
    }
    
    try:
        response = session.post(FAVORITES_ENDPOINT, json=payload, timeout=10)
        data = response.json()
        
        # Should return 400 with error message
        status_ok = response.status_code == 400
        has_error = "detail" in data and "bereits gespeichert" in data["detail"]
        
        all_checks = status_ok and has_error
        
        log_test(
            "Test 3: Duplicate Address Error",
            all_checks,
            response.status_code,
            data,
            "400 with 'Diese Adresse ist bereits gespeichert'",
            f"Status: {response.status_code}, detail={data.get('detail')}"
        )
        
    except Exception as e:
        log_test(
            "Test 3: Duplicate Address Error",
            False,
            0,
            {"error": str(e)},
            "400 with error message",
            f"Exception: {str(e)}"
        )

def test_4_get_favorites_with_items():
    """Test 4: GET Favorites (should have 1+ items)"""
    print("\n" + "="*80)
    print("TEST 4: GET Favorites (should have 1+ items)")
    print("="*80)
    
    try:
        response = session.get(FAVORITES_ENDPOINT, timeout=10)
        data = response.json()
        
        # Check status code
        status_ok = response.status_code == 200
        
        # Check response structure
        has_favorites = "favorites" in data
        has_count = "count" in data
        count_gte_1 = data.get("count", 0) >= 1
        
        all_checks = status_ok and has_favorites and has_count and count_gte_1
        
        log_test(
            "Test 4: GET Favorites with Items",
            all_checks,
            response.status_code,
            data,
            "200 with count >= 1",
            f"Status: {response.status_code}, count={data.get('count', 0)}"
        )
        
    except Exception as e:
        log_test(
            "Test 4: GET Favorites with Items",
            False,
            0,
            {"error": str(e)},
            "200 with count >= 1",
            f"Exception: {str(e)}"
        )

def test_5_mark_as_used(favorite_id):
    """Test 5: POST Mark as Used"""
    print("\n" + "="*80)
    print("TEST 5: POST Mark as Used")
    print("="*80)
    
    if not favorite_id:
        print("⚠️  Skipping Test 5 - No favorite_id from Test 2")
        return
    
    endpoint = f"{FAVORITES_ENDPOINT}/{favorite_id}/use"
    
    try:
        response = session.post(endpoint, timeout=10)
        data = response.json()
        
        # Check status code
        status_ok = response.status_code == 200
        
        # Check response structure
        has_ok = "ok" in data and data["ok"] == True
        
        all_checks = status_ok and has_ok
        
        log_test(
            "Test 5: POST Mark as Used",
            all_checks,
            response.status_code,
            data,
            "200 with ok=true",
            f"Status: {response.status_code}, ok={data.get('ok')}"
        )
        
    except Exception as e:
        log_test(
            "Test 5: POST Mark as Used",
            False,
            0,
            {"error": str(e)},
            "200 with ok=true",
            f"Exception: {str(e)}"
        )

def test_6_delete_favorite(favorite_id):
    """Test 6: DELETE Favorite"""
    print("\n" + "="*80)
    print("TEST 6: DELETE Favorite")
    print("="*80)
    
    if not favorite_id:
        print("⚠️  Skipping Test 6 - No favorite_id from Test 2")
        return
    
    endpoint = f"{FAVORITES_ENDPOINT}/{favorite_id}"
    
    try:
        response = session.delete(endpoint, timeout=10)
        data = response.json()
        
        # Check status code
        status_ok = response.status_code == 200
        
        # Check response structure
        has_ok = "ok" in data and data["ok"] == True
        
        all_checks = status_ok and has_ok
        
        log_test(
            "Test 6: DELETE Favorite",
            all_checks,
            response.status_code,
            data,
            "200 with ok=true",
            f"Status: {response.status_code}, ok={data.get('ok')}"
        )
        
    except Exception as e:
        log_test(
            "Test 6: DELETE Favorite",
            False,
            0,
            {"error": str(e)},
            "200 with ok=true",
            f"Exception: {str(e)}"
        )

def test_7_delete_non_existent():
    """Test 7: DELETE Non-Existent (should fail)"""
    print("\n" + "="*80)
    print("TEST 7: DELETE Non-Existent (should fail)")
    print("="*80)
    
    fake_id = "fakeid123"
    endpoint = f"{FAVORITES_ENDPOINT}/{fake_id}"
    
    try:
        response = session.delete(endpoint, timeout=10)
        data = response.json()
        
        # Should return 404
        status_ok = response.status_code == 404
        
        log_test(
            "Test 7: DELETE Non-Existent Error",
            status_ok,
            response.status_code,
            data,
            "404 Not Found",
            f"Status: {response.status_code}"
        )
        
    except Exception as e:
        log_test(
            "Test 7: DELETE Non-Existent Error",
            False,
            0,
            {"error": str(e)},
            "404 Not Found",
            f"Exception: {str(e)}"
        )

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total_tests = len(test_results)
    passed_tests = sum(1 for t in test_results if t["passed"])
    failed_tests = total_tests - passed_tests
    
    print(f"\nTotal Tests: {total_tests}")
    print(f"Passed: {passed_tests} ✅")
    print(f"Failed: {failed_tests} ❌")
    print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
    
    if failed_tests > 0:
        print("\n❌ FAILED TESTS:")
        for test in test_results:
            if not test["passed"]:
                print(f"  - {test['test_name']}")
                print(f"    Expected: {test['expected']}")
                print(f"    Actual: {test['actual']}")
    
    print("\n" + "="*80)

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("TAXI FAVORITE LOCATIONS API - BACKEND TESTING")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Endpoint: {FAVORITES_ENDPOINT}")
    print(f"Started: {datetime.now().isoformat()}")
    
    # Login first
    if not login():
        print("\n❌ Login failed - cannot proceed with tests")
        return
    
    # Run tests in sequence
    initial_count = test_1_get_empty_favorites()
    favorite_id = test_2_add_new_favorite()
    
    # Test 3 requires the same address from test 2
    if favorite_id:
        # Get the address from test 2 by fetching favorites
        response = session.get(FAVORITES_ENDPOINT, timeout=10)
        data = response.json()
        test_address = None
        for fav in data.get("favorites", []):
            if fav.get("id") == favorite_id:
                test_address = fav.get("address")
                break
        
        if test_address:
            test_3_duplicate_address(test_address)
        else:
            print("\n⚠️  Skipping Test 3 - Could not find address from Test 2")
    else:
        print("\n⚠️  Skipping Test 3 - No favorite_id from Test 2")
    
    test_4_get_favorites_with_items()
    
    # Tests 5-7 require favorite_id from test 2
    if favorite_id:
        test_5_mark_as_used(favorite_id)
        test_6_delete_favorite(favorite_id)
    else:
        print("\n⚠️  Skipping Tests 5-6 - No favorite_id from Test 2")
    
    test_7_delete_non_existent()
    
    # Print summary
    print_summary()
    
    # Save results to file
    with open("/app/favorite_locations_test_results.json", "w") as f:
        json.dump(test_results, f, indent=2)
    
    print(f"\n✅ Test results saved to: /app/favorite_locations_test_results.json")

if __name__ == "__main__":
    main()
