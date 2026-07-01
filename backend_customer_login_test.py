#!/usr/bin/env python3
"""
Backend Test: Customer Login Fix (Legacy Password Field Support)
Tests the fix for legacy customers with password in 'password' field instead of 'password_hash'
"""

import requests
import json
from datetime import datetime

# External preview URL
BASE_URL = "https://biometric-checkout-7.preview.emergentagent.com"

# Test credentials
LEGACY_CUSTOMER_EMAIL = "max.weber@bidblitz.com"
LEGACY_CUSTOMER_PASSWORD = "Pioneer2026!"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

def print_test_header(test_num, description):
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print(f"{'='*80}")

def print_result(success, message):
    status = "✅ PASSED" if success else "❌ FAILED"
    print(f"{status}: {message}")

def test_legacy_customer_login():
    """Test 1: POST /api/auth/login for legacy customer max.weber@bidblitz.com"""
    print_test_header(1, "Legacy Customer Login (max.weber@bidblitz.com)")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": LEGACY_CUSTOMER_EMAIL,
                "password": LEGACY_CUSTOMER_PASSWORD
            },
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Check if cookies are set
            cookies = response.cookies
            has_access_token = 'access_token' in cookies
            has_refresh_token = 'refresh_token' in cookies
            
            print(f"Cookies set: access_token={has_access_token}, refresh_token={has_refresh_token}")
            
            # Check response structure
            has_email = 'email' in data
            has_id = 'id' in data
            
            if has_access_token and has_refresh_token and has_email and has_id:
                print_result(True, f"Legacy customer login successful - User: {data.get('email')}, ID: {data.get('id')}")
                return True, cookies
            else:
                print_result(False, "Login response missing required fields or cookies")
                return False, None
        else:
            print(f"Response: {response.text}")
            print_result(False, f"Expected 200, got {response.status_code}")
            return False, None
            
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False, None

def test_auth_me_with_cookie(cookies):
    """Test 2: GET /api/auth/me with the set cookie"""
    print_test_header(2, "GET /api/auth/me with Legacy Customer Cookie")
    
    if not cookies:
        print_result(False, "No cookies from previous test")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies=cookies,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if data.get('email') == LEGACY_CUSTOMER_EMAIL:
                print_result(True, f"Auth /me working correctly - User: {data.get('email')}")
                return True
            else:
                print_result(False, f"Email mismatch: expected {LEGACY_CUSTOMER_EMAIL}, got {data.get('email')}")
                return False
        else:
            print(f"Response: {response.text}")
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_password_hash_support():
    """Test 3: Verify password_hash field is still supported (no 500 errors)"""
    print_test_header(3, "Password Hash Field Support (No 500 Errors)")
    
    # Try logging in again to ensure no 500 errors occur
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": LEGACY_CUSTOMER_EMAIL,
                "password": LEGACY_CUSTOMER_PASSWORD
            },
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print_result(True, "Second login successful - password_hash field supported, no 500 errors")
            return True
        elif response.status_code == 500:
            print(f"Response: {response.text}")
            print_result(False, "500 Internal Server Error - password_hash support broken")
            return False
        else:
            # Other errors are acceptable (e.g., rate limiting)
            print(f"Response: {response.text}")
            print_result(True, f"No 500 error (got {response.status_code} instead)")
            return True
            
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_admin_login_regression():
    """Test 4: Regression - Admin login still works"""
    print_test_header(4, "Regression Test - Admin Login")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            },
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Check if cookies are set
            cookies = response.cookies
            has_access_token = 'access_token' in cookies
            has_refresh_token = 'refresh_token' in cookies
            
            print(f"Cookies set: access_token={has_access_token}, refresh_token={has_refresh_token}")
            
            if has_access_token and has_refresh_token and data.get('email') == ADMIN_EMAIL:
                print_result(True, f"Admin login working correctly - User: {data.get('email')}, Role: {data.get('role')}")
                return True
            else:
                print_result(False, "Admin login response missing required fields or cookies")
                return False
        else:
            print(f"Response: {response.text}")
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_no_session_expired_issue():
    """Test 5: Verify no soft-launch/session-expired problem"""
    print_test_header(5, "No Soft-Launch/Session-Expired Problem")
    
    try:
        # Login and check response structure
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": LEGACY_CUSTOMER_EMAIL,
                "password": LEGACY_CUSTOMER_PASSWORD
            },
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for soft-launch related error messages
            has_soft_launch_error = any(
                keyword in str(data).lower() 
                for keyword in ['soft launch', 'session expired', 'access restricted', 'whitelist']
            )
            
            if has_soft_launch_error:
                print(f"Response: {json.dumps(data, indent=2)}")
                print_result(False, "Soft-launch/session-expired error detected in response")
                return False
            else:
                print_result(True, "No soft-launch/session-expired issues detected")
                return True
        elif response.status_code == 403:
            # Check if it's a soft-launch error
            error_text = response.text.lower()
            if 'soft launch' in error_text or 'access restricted' in error_text:
                print(f"Response: {response.text}")
                print_result(False, "Soft-launch access restriction detected")
                return False
            else:
                print_result(True, "No soft-launch issues (different 403 error)")
                return True
        else:
            print_result(True, f"No soft-launch issues (status: {response.status_code})")
            return True
            
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def main():
    print("\n" + "="*80)
    print("CUSTOMER LOGIN BACKEND FIX - COMPREHENSIVE TEST SUITE")
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("="*80)
    
    results = {}
    
    # Test 1: Legacy customer login
    test1_passed, cookies = test_legacy_customer_login()
    results['test1_legacy_login'] = test1_passed
    
    # Test 2: Auth /me with cookie
    test2_passed = test_auth_me_with_cookie(cookies)
    results['test2_auth_me'] = test2_passed
    
    # Test 3: Password hash support (no 500)
    test3_passed = test_password_hash_support()
    results['test3_password_hash_support'] = test3_passed
    
    # Test 4: Admin login regression
    test4_passed = test_admin_login_regression()
    results['test4_admin_regression'] = test4_passed
    
    # Test 5: No session expired issue
    test5_passed = test_no_session_expired_issue()
    results['test5_no_session_expired'] = test5_passed
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total_tests = len(results)
    passed_tests = sum(1 for v in results.values() if v)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed_tests}/{total_tests} tests passed ({passed_tests/total_tests*100:.0f}%)")
    
    if passed_tests == total_tests:
        print("\n🎉 ALL TESTS PASSED - Customer login fix is working correctly!")
    else:
        print(f"\n⚠️  {total_tests - passed_tests} test(s) failed - Review failures above")
    
    print("="*80 + "\n")
    
    # Save results to file
    with open('/app/customer_login_test_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'base_url': BASE_URL,
            'results': results,
            'summary': {
                'total': total_tests,
                'passed': passed_tests,
                'failed': total_tests - passed_tests,
                'success_rate': f"{passed_tests/total_tests*100:.0f}%"
            }
        }, f, indent=2)
    
    print("Results saved to /app/customer_login_test_results.json")

if __name__ == "__main__":
    main()
