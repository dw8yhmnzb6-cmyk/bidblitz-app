#!/usr/bin/env python3
"""
BidBlitz Login Alias Backend Test (.ae / .com)
===============================================
Tests the .ae alias logic for login endpoints:
1. POST /api/auth/login with admin@bidblitz.ae
2. POST /api/auth/login with haendler@bidblitz.ae
3. POST /api/staff/auth/login with mitarbeiter@bidblitz.ae
4. Regression: .com logins still work
5. No 500 errors or session/serialization problems

Test Credentials:
- Admin: admin@bidblitz.ae / BidBlitz2026! (alias for admin@bidblitz.com)
- Manager: haendler@bidblitz.ae / Haendler2026! (alias for haendler@bidblitz.com)
- Staff: mitarbeiter@bidblitz.ae / test123 (alias for mitarbeiter@bidblitz.com)
"""

import requests
import json
import sys
from datetime import datetime

# External API URL
BASE_URL = "https://super-app-staging-2.preview.emergentagent.com"

# Test credentials from /app/memory/test_credentials.md
ADMIN_AE = {"email": "admin@bidblitz.ae", "password": "BidBlitz2026!"}
ADMIN_COM = {"email": "admin@bidblitz.com", "password": "BidBlitz2026!"}
MANAGER_AE = {"email": "haendler@bidblitz.ae", "password": "Haendler2026!"}
MANAGER_COM = {"email": "haendler@bidblitz.com", "password": "Haendler2026!"}
STAFF_AE = {"email": "mitarbeiter@bidblitz.ae", "password": "test123"}
STAFF_COM = {"email": "mitarbeiter@bidblitz.com", "password": "test123"}

def log_test(test_name, status, details=""):
    """Log test result"""
    icon = "✅" if status == "PASS" else "❌"
    print(f"{icon} {test_name}: {status}")
    if details:
        print(f"   {details}")

def test_customer_login_ae_alias(email, password, expected_role, label):
    """Test POST /api/auth/login with .ae alias"""
    print(f"\n{'='*80}")
    print(f"TEST: Customer Login with {label} (.ae alias)")
    print(f"{'='*80}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Check response structure
            if "email" in data and "role" in data:
                actual_role = data.get("role")
                actual_email = data.get("email")
                
                # Check cookies
                cookies = response.cookies
                has_access_token = "access_token" in cookies
                has_refresh_token = "refresh_token" in cookies
                
                print(f"Email: {actual_email}")
                print(f"Role: {actual_role}")
                print(f"Access Token Cookie: {has_access_token}")
                print(f"Refresh Token Cookie: {has_refresh_token}")
                
                # Verify role matches expected
                if actual_role == expected_role and has_access_token and has_refresh_token:
                    log_test(f"{label} Login (.ae)", "PASS", 
                            f"Login successful with role={actual_role}, cookies set correctly")
                    return True, cookies
                else:
                    log_test(f"{label} Login (.ae)", "FAIL", 
                            f"Role mismatch or missing cookies: expected={expected_role}, actual={actual_role}, access_token={has_access_token}, refresh_token={has_refresh_token}")
                    return False, None
            else:
                log_test(f"{label} Login (.ae)", "FAIL", 
                        f"Missing required fields in response: {data}")
                return False, None
        else:
            error_detail = response.text
            log_test(f"{label} Login (.ae)", "FAIL", 
                    f"HTTP {response.status_code}: {error_detail}")
            return False, None
            
    except Exception as e:
        log_test(f"{label} Login (.ae)", "FAIL", f"Exception: {str(e)}")
        return False, None

def test_customer_login_com_regression(email, password, expected_role, label):
    """Test POST /api/auth/login with .com (regression check)"""
    print(f"\n{'='*80}")
    print(f"TEST: Customer Login with {label} (.com regression)")
    print(f"{'='*80}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Check response structure
            if "email" in data and "role" in data:
                actual_role = data.get("role")
                actual_email = data.get("email")
                
                # Check cookies
                cookies = response.cookies
                has_access_token = "access_token" in cookies
                has_refresh_token = "refresh_token" in cookies
                
                print(f"Email: {actual_email}")
                print(f"Role: {actual_role}")
                print(f"Access Token Cookie: {has_access_token}")
                print(f"Refresh Token Cookie: {has_refresh_token}")
                
                # Verify role matches expected
                if actual_role == expected_role and has_access_token and has_refresh_token:
                    log_test(f"{label} Login (.com)", "PASS", 
                            f"Login successful with role={actual_role}, cookies set correctly")
                    return True, cookies
                else:
                    log_test(f"{label} Login (.com)", "FAIL", 
                            f"Role mismatch or missing cookies: expected={expected_role}, actual={actual_role}, access_token={has_access_token}, refresh_token={has_refresh_token}")
                    return False, None
            else:
                log_test(f"{label} Login (.com)", "FAIL", 
                        f"Missing required fields in response: {data}")
                return False, None
        else:
            error_detail = response.text
            log_test(f"{label} Login (.com)", "FAIL", 
                    f"HTTP {response.status_code}: {error_detail}")
            return False, None
            
    except Exception as e:
        log_test(f"{label} Login (.com)", "FAIL", f"Exception: {str(e)}")
        return False, None

def test_staff_login_ae_alias(email, password):
    """Test POST /api/staff/auth/login with .ae alias"""
    print(f"\n{'='*80}")
    print(f"TEST: Staff Login with {email} (.ae alias)")
    print(f"{'='*80}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/staff/auth/login",
            json={"email": email, "password": password},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Check response structure
            if "success" in data and data.get("success") and "staff" in data:
                staff = data.get("staff", {})
                staff_email = staff.get("email")
                staff_name = staff.get("name")
                staff_role = staff.get("role")
                
                # Check cookies
                cookies = response.cookies
                has_staff_session = "staff_session" in cookies
                
                print(f"Staff Email: {staff_email}")
                print(f"Staff Name: {staff_name}")
                print(f"Staff Role: {staff_role}")
                print(f"Staff Session Cookie: {has_staff_session}")
                
                if has_staff_session:
                    log_test("Staff Login (.ae)", "PASS", 
                            f"Login successful with email={staff_email}, name={staff_name}, role={staff_role}, staff_session cookie set")
                    return True, cookies
                else:
                    log_test("Staff Login (.ae)", "FAIL", 
                            f"Missing staff_session cookie")
                    return False, None
            else:
                log_test("Staff Login (.ae)", "FAIL", 
                        f"Invalid response structure: {data}")
                return False, None
        else:
            error_detail = response.text
            log_test("Staff Login (.ae)", "FAIL", 
                    f"HTTP {response.status_code}: {error_detail}")
            return False, None
            
    except Exception as e:
        log_test("Staff Login (.ae)", "FAIL", f"Exception: {str(e)}")
        return False, None

def test_staff_login_com_regression(email, password):
    """Test POST /api/staff/auth/login with .com (regression check)"""
    print(f"\n{'='*80}")
    print(f"TEST: Staff Login with {email} (.com regression)")
    print(f"{'='*80}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/staff/auth/login",
            json={"email": email, "password": password},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Check response structure
            if "success" in data and data.get("success") and "staff" in data:
                staff = data.get("staff", {})
                staff_email = staff.get("email")
                staff_name = staff.get("name")
                staff_role = staff.get("role")
                
                # Check cookies
                cookies = response.cookies
                has_staff_session = "staff_session" in cookies
                
                print(f"Staff Email: {staff_email}")
                print(f"Staff Name: {staff_name}")
                print(f"Staff Role: {staff_role}")
                print(f"Staff Session Cookie: {has_staff_session}")
                
                if has_staff_session:
                    log_test("Staff Login (.com)", "PASS", 
                            f"Login successful with email={staff_email}, name={staff_name}, role={staff_role}, staff_session cookie set")
                    return True, cookies
                else:
                    log_test("Staff Login (.com)", "FAIL", 
                            f"Missing staff_session cookie")
                    return False, None
            else:
                log_test("Staff Login (.com)", "FAIL", 
                        f"Invalid response structure: {data}")
                return False, None
        else:
            error_detail = response.text
            log_test("Staff Login (.com)", "FAIL", 
                    f"HTTP {response.status_code}: {error_detail}")
            return False, None
            
    except Exception as e:
        log_test("Staff Login (.com)", "FAIL", f"Exception: {str(e)}")
        return False, None

def main():
    print("="*80)
    print("BidBlitz Login Alias Backend Test (.ae / .com)")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().isoformat()}")
    print("="*80)
    
    results = {
        "total": 0,
        "passed": 0,
        "failed": 0,
        "tests": []
    }
    
    # Test 1: Admin Login with .ae alias
    success, _ = test_customer_login_ae_alias(
        ADMIN_AE["email"], 
        ADMIN_AE["password"], 
        "admin", 
        "Admin"
    )
    results["total"] += 1
    if success:
        results["passed"] += 1
        results["tests"].append({"name": "Admin Login (.ae)", "status": "PASS"})
    else:
        results["failed"] += 1
        results["tests"].append({"name": "Admin Login (.ae)", "status": "FAIL"})
    
    # Test 2: Manager Login with .ae alias
    success, _ = test_customer_login_ae_alias(
        MANAGER_AE["email"], 
        MANAGER_AE["password"], 
        "merchant", 
        "Manager"
    )
    results["total"] += 1
    if success:
        results["passed"] += 1
        results["tests"].append({"name": "Manager Login (.ae)", "status": "PASS"})
    else:
        results["failed"] += 1
        results["tests"].append({"name": "Manager Login (.ae)", "status": "FAIL"})
    
    # Test 3: Staff Login with .ae alias
    success, _ = test_staff_login_ae_alias(
        STAFF_AE["email"], 
        STAFF_AE["password"]
    )
    results["total"] += 1
    if success:
        results["passed"] += 1
        results["tests"].append({"name": "Staff Login (.ae)", "status": "PASS"})
    else:
        results["failed"] += 1
        results["tests"].append({"name": "Staff Login (.ae)", "status": "FAIL"})
    
    # Test 4: Admin Login with .com (regression)
    success, _ = test_customer_login_com_regression(
        ADMIN_COM["email"], 
        ADMIN_COM["password"], 
        "admin", 
        "Admin"
    )
    results["total"] += 1
    if success:
        results["passed"] += 1
        results["tests"].append({"name": "Admin Login (.com) Regression", "status": "PASS"})
    else:
        results["failed"] += 1
        results["tests"].append({"name": "Admin Login (.com) Regression", "status": "FAIL"})
    
    # Test 5: Manager Login with .com (regression)
    success, _ = test_customer_login_com_regression(
        MANAGER_COM["email"], 
        MANAGER_COM["password"], 
        "merchant", 
        "Manager"
    )
    results["total"] += 1
    if success:
        results["passed"] += 1
        results["tests"].append({"name": "Manager Login (.com) Regression", "status": "PASS"})
    else:
        results["failed"] += 1
        results["tests"].append({"name": "Manager Login (.com) Regression", "status": "FAIL"})
    
    # Test 6: Staff Login with .com (regression)
    success, _ = test_staff_login_com_regression(
        STAFF_COM["email"], 
        STAFF_COM["password"]
    )
    results["total"] += 1
    if success:
        results["passed"] += 1
        results["tests"].append({"name": "Staff Login (.com) Regression", "status": "PASS"})
    else:
        results["failed"] += 1
        results["tests"].append({"name": "Staff Login (.com) Regression", "status": "FAIL"})
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total Tests: {results['total']}")
    print(f"Passed: {results['passed']}")
    print(f"Failed: {results['failed']}")
    print(f"Success Rate: {(results['passed']/results['total']*100):.1f}%")
    print("="*80)
    
    # Detailed results
    print("\nDETAILED RESULTS:")
    for test in results["tests"]:
        icon = "✅" if test["status"] == "PASS" else "❌"
        print(f"{icon} {test['name']}: {test['status']}")
    
    # Save results to file
    output_file = "/app/login_alias_test_results.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to: {output_file}")
    
    # Exit with appropriate code
    if results["failed"] > 0:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)
    else:
        print("\n✅ ALL TESTS PASSED")
        sys.exit(0)

if __name__ == "__main__":
    main()
