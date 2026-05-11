#!/usr/bin/env python3
"""
Backend API Testing Script for Taxi Driver Onboarding
Tests all scenarios specified in the review request
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://ocpp-csms-platform.preview.emergentagent.com"
API_ENDPOINT = f"{BASE_URL}/api/taxi/driver/onboard"

# Test results storage
test_results = []

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

def test_1_successful_business_driver():
    """Test 1: Successful Driver Application (Business Type)"""
    print("\n" + "="*80)
    print("TEST 1: Successful Driver Application (Business Type)")
    print("="*80)
    
    payload = {
        "name": "Max Mustermann",
        "email": "max.business@test.de",
        "phone": "+49 123 456789",
        "license_number": "B1234567890",
        "vehicle_type": "standard",
        "driver_type": "business",
        "city": "Berlin"
    }
    
    try:
        response = requests.post(API_ENDPOINT, json=payload, timeout=10)
        data = response.json()
        
        # Check status code
        status_ok = response.status_code == 200
        
        # Check response structure
        has_ok = "ok" in data and data["ok"] == True
        has_application_id = "application_id" in data and len(data["application_id"]) > 0
        has_status = "status" in data and data["status"] == "pending"
        
        all_checks = status_ok and has_ok and has_application_id and has_status
        
        log_test(
            "Test 1: Successful Business Driver Application",
            all_checks,
            response.status_code,
            data,
            "200 with ok=true, application_id, status=pending",
            f"Status: {response.status_code}, ok={data.get('ok')}, has_id={has_application_id}, status={data.get('status')}"
        )
        
        return data.get("application_id"), data.get("email", payload["email"])
        
    except Exception as e:
        log_test(
            "Test 1: Successful Business Driver Application",
            False,
            0,
            {"error": str(e)},
            "200 with ok=true, application_id, status=pending",
            f"Exception: {str(e)}"
        )
        return None, None

def test_2_successful_private_driver():
    """Test 2: Successful Driver Application (Private Type)"""
    print("\n" + "="*80)
    print("TEST 2: Successful Driver Application (Private Type)")
    print("="*80)
    
    payload = {
        "name": "Anna Schmidt",
        "email": "anna.private@test.de",
        "phone": "+49 987 654321",
        "license_number": "P9876543210",
        "vehicle_type": "premium",
        "driver_type": "private",
        "city": "München"
    }
    
    try:
        response = requests.post(API_ENDPOINT, json=payload, timeout=10)
        data = response.json()
        
        # Check status code
        status_ok = response.status_code == 200
        
        # Check response structure
        has_ok = "ok" in data and data["ok"] == True
        has_application_id = "application_id" in data and len(data["application_id"]) > 0
        
        all_checks = status_ok and has_ok and has_application_id
        
        log_test(
            "Test 2: Successful Private Driver Application",
            all_checks,
            response.status_code,
            data,
            "200 with ok=true, application_id",
            f"Status: {response.status_code}, ok={data.get('ok')}, has_id={has_application_id}"
        )
        
    except Exception as e:
        log_test(
            "Test 2: Successful Private Driver Application",
            False,
            0,
            {"error": str(e)},
            "200 with ok=true, application_id",
            f"Exception: {str(e)}"
        )

def test_3_duplicate_application(email):
    """Test 3: Duplicate Application - Email Already Exists (Pending)"""
    print("\n" + "="*80)
    print("TEST 3: Duplicate Application - Email Already Exists")
    print("="*80)
    
    payload = {
        "name": "Max Mustermann",
        "email": email,
        "phone": "+49 123 456789",
        "license_number": "B1234567890",
        "vehicle_type": "standard",
        "driver_type": "business",
        "city": "Berlin"
    }
    
    try:
        response = requests.post(API_ENDPOINT, json=payload, timeout=10)
        data = response.json()
        
        # Should return 400 with error message
        status_ok = response.status_code == 400
        has_error = "detail" in data and "bereits geprüft" in data["detail"]
        
        all_checks = status_ok and has_error
        
        log_test(
            "Test 3: Duplicate Application Error",
            all_checks,
            response.status_code,
            data,
            "400 with 'Deine Bewerbung wird bereits geprüft'",
            f"Status: {response.status_code}, detail={data.get('detail')}"
        )
        
    except Exception as e:
        log_test(
            "Test 3: Duplicate Application Error",
            False,
            0,
            {"error": str(e)},
            "400 with error message",
            f"Exception: {str(e)}"
        )

def test_4_validation_errors():
    """Test 4: Validation Errors - Missing/Invalid Fields"""
    print("\n" + "="*80)
    print("TEST 4: Validation Errors - Missing/Invalid Fields")
    print("="*80)
    
    # Test 4a: Empty name
    print("\n--- Test 4a: Empty Name ---")
    payload = {
        "name": "",
        "email": "test@test.de",
        "phone": "+49 123 456789",
        "license_number": "B1234567890",
        "vehicle_type": "standard",
        "driver_type": "business"
    }
    
    try:
        response = requests.post(API_ENDPOINT, json=payload, timeout=10)
        data = response.json()
        
        status_ok = response.status_code == 422
        
        log_test(
            "Test 4a: Empty Name Validation",
            status_ok,
            response.status_code,
            data,
            "422 validation error",
            f"Status: {response.status_code}"
        )
    except Exception as e:
        log_test("Test 4a: Empty Name Validation", False, 0, {"error": str(e)}, "422", f"Exception: {str(e)}")
    
    # Test 4b: Invalid email
    print("\n--- Test 4b: Invalid Email ---")
    payload = {
        "name": "Test User",
        "email": "invalid-email",
        "phone": "+49 123 456789",
        "license_number": "B1234567890",
        "vehicle_type": "standard",
        "driver_type": "business"
    }
    
    try:
        response = requests.post(API_ENDPOINT, json=payload, timeout=10)
        data = response.json()
        
        status_ok = response.status_code == 422
        
        log_test(
            "Test 4b: Invalid Email Validation",
            status_ok,
            response.status_code,
            data,
            "422 validation error",
            f"Status: {response.status_code}"
        )
    except Exception as e:
        log_test("Test 4b: Invalid Email Validation", False, 0, {"error": str(e)}, "422", f"Exception: {str(e)}")
    
    # Test 4c: Short phone
    print("\n--- Test 4c: Short Phone ---")
    payload = {
        "name": "Test User",
        "email": "test@test.de",
        "phone": "123",
        "license_number": "B1234567890",
        "vehicle_type": "standard",
        "driver_type": "business"
    }
    
    try:
        response = requests.post(API_ENDPOINT, json=payload, timeout=10)
        data = response.json()
        
        status_ok = response.status_code == 422
        
        log_test(
            "Test 4c: Short Phone Validation",
            status_ok,
            response.status_code,
            data,
            "422 validation error",
            f"Status: {response.status_code}"
        )
    except Exception as e:
        log_test("Test 4c: Short Phone Validation", False, 0, {"error": str(e)}, "422", f"Exception: {str(e)}")
    
    # Test 4d: Short license
    print("\n--- Test 4d: Short License ---")
    payload = {
        "name": "Test User",
        "email": "test@test.de",
        "phone": "+49 123 456789",
        "license_number": "B12",
        "vehicle_type": "standard",
        "driver_type": "business"
    }
    
    try:
        response = requests.post(API_ENDPOINT, json=payload, timeout=10)
        data = response.json()
        
        status_ok = response.status_code == 422
        
        log_test(
            "Test 4d: Short License Validation",
            status_ok,
            response.status_code,
            data,
            "422 validation error",
            f"Status: {response.status_code}"
        )
    except Exception as e:
        log_test("Test 4d: Short License Validation", False, 0, {"error": str(e)}, "422", f"Exception: {str(e)}")

def test_5_invalid_vehicle_type():
    """Test 5: Invalid Vehicle Type"""
    print("\n" + "="*80)
    print("TEST 5: Invalid Vehicle Type")
    print("="*80)
    
    payload = {
        "name": "Test User",
        "email": "test5@test.de",
        "phone": "+49 123 456789",
        "license_number": "B1234567890",
        "vehicle_type": "invalid",
        "driver_type": "business",
        "city": "Berlin"
    }
    
    try:
        response = requests.post(API_ENDPOINT, json=payload, timeout=10)
        data = response.json()
        
        status_ok = response.status_code == 422
        
        log_test(
            "Test 5: Invalid Vehicle Type",
            status_ok,
            response.status_code,
            data,
            "422 validation error",
            f"Status: {response.status_code}"
        )
        
    except Exception as e:
        log_test(
            "Test 5: Invalid Vehicle Type",
            False,
            0,
            {"error": str(e)},
            "422 validation error",
            f"Exception: {str(e)}"
        )

def test_6_invalid_driver_type():
    """Test 6: Invalid Driver Type"""
    print("\n" + "="*80)
    print("TEST 6: Invalid Driver Type")
    print("="*80)
    
    payload = {
        "name": "Test User",
        "email": "test6@test.de",
        "phone": "+49 123 456789",
        "license_number": "B1234567890",
        "vehicle_type": "standard",
        "driver_type": "unknown",
        "city": "Berlin"
    }
    
    try:
        response = requests.post(API_ENDPOINT, json=payload, timeout=10)
        data = response.json()
        
        status_ok = response.status_code == 422
        
        log_test(
            "Test 6: Invalid Driver Type",
            status_ok,
            response.status_code,
            data,
            "422 validation error",
            f"Status: {response.status_code}"
        )
        
    except Exception as e:
        log_test(
            "Test 6: Invalid Driver Type",
            False,
            0,
            {"error": str(e)},
            "422 validation error",
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
    print("TAXI DRIVER ONBOARDING API - BACKEND TESTING")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Endpoint: {API_ENDPOINT}")
    print(f"Started: {datetime.now().isoformat()}")
    
    # Run tests in sequence
    application_id, email = test_1_successful_business_driver()
    test_2_successful_private_driver()
    
    # Test 3 requires email from test 1
    if email:
        test_3_duplicate_application(email)
    else:
        print("\n⚠️  Skipping Test 3 - No email from Test 1")
    
    test_4_validation_errors()
    test_5_invalid_vehicle_type()
    test_6_invalid_driver_type()
    
    # Print summary
    print_summary()
    
    # Save results to file
    with open("/app/taxi_driver_onboard_test_results.json", "w") as f:
        json.dump(test_results, f, indent=2)
    
    print(f"\n✅ Test results saved to: /app/taxi_driver_onboard_test_results.json")

if __name__ == "__main__":
    main()
