#!/usr/bin/env python3
"""
Backend Smoke Test for iteration_136
Tests the 5 critical flows requested:
1. POST /api/hotels/sabre/search with valid data -> 200 and hotel data
2. POST /api/hotels/sabre/search with check_out <= check_in -> sensible 400 error
3. GET /api/taxi/geocode?q=Alexanderplatz&country=de&proximity_lng=13.405&proximity_lat=52.52 -> 200
4. POST /api/taxi/estimate with Berlin coordinates -> 200 with estimates
5. Auth-Login for admin@bidblitz.com / BidBlitz2026! still works
"""

import requests
import json
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://super-app-staging-2.preview.emergentagent.com"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

# Test results storage
results = {
    "total_tests": 5,
    "passed": 0,
    "failed": 0,
    "tests": []
}

def log_test(test_name, passed, details):
    """Log test result"""
    status = "✅ PASSED" if passed else "❌ FAILED"
    print(f"\n{status}: {test_name}")
    print(f"Details: {details}")
    
    results["tests"].append({
        "name": test_name,
        "passed": passed,
        "details": details
    })
    
    if passed:
        results["passed"] += 1
    else:
        results["failed"] += 1

def test_auth_login():
    """Test 5: Auth-Login for admin@bidblitz.com / BidBlitz2026! still works"""
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            cookies = response.cookies
            
            # Check if we got access_token cookie
            has_access_token = "access_token" in cookies
            has_user_data = "user" in data or "email" in data
            
            if has_access_token or has_user_data:
                log_test(
                    "Test 5: Auth Login",
                    True,
                    f"Login successful. Status: {response.status_code}, Has cookies: {has_access_token}, Has user data: {has_user_data}"
                )
                return cookies
            else:
                log_test(
                    "Test 5: Auth Login",
                    False,
                    f"Login returned 200 but missing expected data. Response: {data}"
                )
                return None
        else:
            log_test(
                "Test 5: Auth Login",
                False,
                f"Login failed with status {response.status_code}. Response: {response.text[:200]}"
            )
            return None
            
    except Exception as e:
        log_test("Test 5: Auth Login", False, f"Exception: {str(e)}")
        return None

def test_hotel_search_valid():
    """Test 1: POST /api/hotels/sabre/search with valid data -> 200 and hotel data"""
    try:
        # Valid search: check_in tomorrow, check_out in 3 days
        check_in = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        check_out = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        
        payload = {
            "city": "Berlin",
            "check_in": check_in,
            "check_out": check_out,
            "guests": 2,
            "min_stars": 3
        }
        
        response = requests.post(
            f"{BASE_URL}/api/hotels/sabre/search",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if we got hotels data
            has_hotels = "hotels" in data
            has_count = "count" in data
            hotels_list = data.get("hotels", [])
            
            if has_hotels and has_count and isinstance(hotels_list, list):
                log_test(
                    "Test 1: Hotel Search (Valid)",
                    True,
                    f"Search successful. Status: 200, Hotels count: {data.get('count')}, Hotels returned: {len(hotels_list)}"
                )
            else:
                log_test(
                    "Test 1: Hotel Search (Valid)",
                    False,
                    f"Response structure incorrect. Data: {data}"
                )
        else:
            log_test(
                "Test 1: Hotel Search (Valid)",
                False,
                f"Search failed with status {response.status_code}. Response: {response.text[:200]}"
            )
            
    except Exception as e:
        log_test("Test 1: Hotel Search (Valid)", False, f"Exception: {str(e)}")

def test_hotel_search_invalid():
    """Test 2: POST /api/hotels/sabre/search with check_out <= check_in -> sensible 400 error"""
    try:
        # Invalid search: check_out same as check_in
        check_in = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        check_out = check_in  # Same date - should fail
        
        payload = {
            "city": "Berlin",
            "check_in": check_in,
            "check_out": check_out,
            "guests": 2
        }
        
        response = requests.post(
            f"{BASE_URL}/api/hotels/sabre/search",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 400:
            data = response.json()
            error_message = data.get("detail", "")
            
            # Check if error message is sensible
            if "check" in error_message.lower() or "nach" in error_message.lower():
                log_test(
                    "Test 2: Hotel Search (Invalid Dates)",
                    True,
                    f"Validation working correctly. Status: 400, Error: {error_message}"
                )
            else:
                log_test(
                    "Test 2: Hotel Search (Invalid Dates)",
                    False,
                    f"Got 400 but error message unclear: {error_message}"
                )
        else:
            log_test(
                "Test 2: Hotel Search (Invalid Dates)",
                False,
                f"Expected 400 but got {response.status_code}. Response: {response.text[:200]}"
            )
            
    except Exception as e:
        log_test("Test 2: Hotel Search (Invalid Dates)", False, f"Exception: {str(e)}")

def test_taxi_geocode():
    """Test 3: GET /api/taxi/geocode?q=Alexanderplatz&country=de&proximity_lng=13.405&proximity_lat=52.52 -> 200"""
    try:
        params = {
            "q": "Alexanderplatz",
            "country": "de",
            "proximity_lng": 13.405,
            "proximity_lat": 52.52
        }
        
        response = requests.get(
            f"{BASE_URL}/api/taxi/geocode",
            params=params,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if we got features
            has_features = "features" in data
            features_list = data.get("features", [])
            
            if has_features and isinstance(features_list, list):
                log_test(
                    "Test 3: Taxi Geocode",
                    True,
                    f"Geocode successful. Status: 200, Features count: {len(features_list)}"
                )
            else:
                log_test(
                    "Test 3: Taxi Geocode",
                    False,
                    f"Response structure incorrect. Data: {data}"
                )
        else:
            log_test(
                "Test 3: Taxi Geocode",
                False,
                f"Geocode failed with status {response.status_code}. Response: {response.text[:200]}"
            )
            
    except Exception as e:
        log_test("Test 3: Taxi Geocode", False, f"Exception: {str(e)}")

def test_taxi_estimate():
    """Test 4: POST /api/taxi/estimate with Berlin coordinates -> 200 with estimates"""
    try:
        # Berlin coordinates: Alexanderplatz to Brandenburg Gate
        payload = {
            "pickup_lat": 52.5219,
            "pickup_lng": 13.4132,
            "dropoff_lat": 52.5163,
            "dropoff_lng": 13.3777
        }
        
        response = requests.post(
            f"{BASE_URL}/api/taxi/estimate",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if we got estimates
            has_estimates = "estimates" in data
            estimates_list = data.get("estimates", [])
            module_enabled = data.get("module_enabled", False)
            
            if has_estimates and isinstance(estimates_list, list) and len(estimates_list) > 0:
                log_test(
                    "Test 4: Taxi Estimate",
                    True,
                    f"Estimate successful. Status: 200, Module enabled: {module_enabled}, Estimates count: {len(estimates_list)}, Vehicle types: {[e.get('vehicle_type') for e in estimates_list]}"
                )
            else:
                log_test(
                    "Test 4: Taxi Estimate",
                    False,
                    f"Response structure incorrect or no estimates. Data: {data}"
                )
        else:
            log_test(
                "Test 4: Taxi Estimate",
                False,
                f"Estimate failed with status {response.status_code}. Response: {response.text[:200]}"
            )
            
    except Exception as e:
        log_test("Test 4: Taxi Estimate", False, f"Exception: {str(e)}")

def main():
    """Run all smoke tests"""
    print("=" * 80)
    print("BACKEND SMOKE TEST - iteration_136")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Testing 5 critical flows...")
    print("=" * 80)
    
    # Run tests in order
    test_auth_login()
    test_hotel_search_valid()
    test_hotel_search_invalid()
    test_taxi_geocode()
    test_taxi_estimate()
    
    # Print summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {results['total_tests']}")
    print(f"Passed: {results['passed']} ✅")
    print(f"Failed: {results['failed']} ❌")
    print(f"Success Rate: {(results['passed'] / results['total_tests'] * 100):.1f}%")
    print("=" * 80)
    
    # Save results to file
    with open("/app/backend_smoke_test_iter136_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\nResults saved to: /app/backend_smoke_test_iter136_results.json")
    
    # Exit with appropriate code
    if results['failed'] > 0:
        print("\n⚠️  SOME TESTS FAILED - Review details above")
        exit(1)
    else:
        print("\n✅ ALL TESTS PASSED")
        exit(0)

if __name__ == "__main__":
    main()
