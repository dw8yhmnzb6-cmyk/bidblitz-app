#!/usr/bin/env python3
"""
BidBlitz Payout & KYC Stability Test
Testing backend endpoints after UI adjustments in preview environment
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://biometric-checkout-7.preview.emergentagent.com"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

# Test results storage
results = {
    "test_date": datetime.now().isoformat(),
    "base_url": BASE_URL,
    "tests": []
}

def log_test(test_name, passed, details):
    """Log test result"""
    result = {
        "test": test_name,
        "passed": passed,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }
    results["tests"].append(result)
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {test_name}")
    print(f"Details: {details}")
    return passed

def test_admin_login():
    """Test 1: Admin Login"""
    print("\n" + "="*80)
    print("TEST 1: Admin Login (POST /api/auth/login)")
    print("="*80)
    
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
            cookies = response.cookies
            
            # Check for access_token cookie
            has_access_token = 'access_token' in cookies
            
            details = {
                "status_code": response.status_code,
                "has_access_token": has_access_token,
                "cookies": list(cookies.keys()),
                "response_keys": list(data.keys()) if isinstance(data, dict) else []
            }
            
            if has_access_token:
                return log_test("Admin Login", True, details), cookies
            else:
                return log_test("Admin Login", False, "No access_token cookie in response"), None
        else:
            return log_test("Admin Login", False, {
                "status_code": response.status_code,
                "response": response.text[:500]
            }), None
            
    except Exception as e:
        return log_test("Admin Login", False, f"Exception: {str(e)}"), None

def test_payout_balance(cookies):
    """Test 2: GET /api/payout/balance - Should return available merchant balance > 0"""
    print("\n" + "="*80)
    print("TEST 2: Payout Balance (GET /api/payout/balance)")
    print("="*80)
    
    if not cookies:
        return log_test("Payout Balance", False, "No authentication cookies available")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/payout/balance",
            cookies=cookies,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if balance field exists
            if 'balance' in data or 'available_balance' in data or 'amount' in data or 'available' in data:
                balance = data.get('balance') or data.get('available_balance') or data.get('amount') or data.get('available', 0)
                
                details = {
                    "status_code": response.status_code,
                    "balance": balance,
                    "balance_greater_than_zero": balance > 0,
                    "full_response": data
                }
                
                if balance > 0:
                    return log_test("Payout Balance", True, details)
                else:
                    return log_test("Payout Balance", False, f"Balance is {balance}, expected > 0")
            else:
                return log_test("Payout Balance", False, {
                    "status_code": response.status_code,
                    "error": "No balance field in response",
                    "response_keys": list(data.keys()) if isinstance(data, dict) else [],
                    "full_response": data
                })
        else:
            return log_test("Payout Balance", False, {
                "status_code": response.status_code,
                "response": response.text[:500]
            })
            
    except Exception as e:
        return log_test("Payout Balance", False, f"Exception: {str(e)}")

def test_kyc_status(cookies):
    """Test 3: GET /api/kyc/status - Should stably return pending status"""
    print("\n" + "="*80)
    print("TEST 3: KYC Status (GET /api/kyc/status)")
    print("="*80)
    
    if not cookies:
        return log_test("KYC Status", False, "No authentication cookies available")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/kyc/status",
            cookies=cookies,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if status field exists
            if 'status' in data or 'kyc_status' in data:
                status = data.get('status') or data.get('kyc_status', '')
                
                details = {
                    "status_code": response.status_code,
                    "kyc_status": status,
                    "is_pending": status.lower() == 'pending',
                    "full_response": data
                }
                
                if status.lower() == 'pending':
                    return log_test("KYC Status", True, details)
                else:
                    return log_test("KYC Status", False, f"Status is '{status}', expected 'pending'")
            else:
                return log_test("KYC Status", False, {
                    "status_code": response.status_code,
                    "error": "No status field in response",
                    "response_keys": list(data.keys()) if isinstance(data, dict) else [],
                    "full_response": data
                })
        else:
            return log_test("KYC Status", False, {
                "status_code": response.status_code,
                "response": response.text[:500]
            })
            
    except Exception as e:
        return log_test("KYC Status", False, f"Exception: {str(e)}")

def main():
    """Run all stability tests"""
    print("\n" + "="*80)
    print("BIDBLITZ PAYOUT & KYC STABILITY TEST")
    print("Testing backend endpoints after UI adjustments")
    print(f"Preview URL: {BASE_URL}")
    print("="*80)
    
    # Test 1: Admin Login
    login_passed, cookies = test_admin_login()
    
    # Test 2: Payout Balance
    payout_passed = test_payout_balance(cookies)
    
    # Test 3: KYC Status
    kyc_passed = test_kyc_status(cookies)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total_tests = len(results["tests"])
    passed_tests = sum(1 for t in results["tests"] if t["passed"])
    
    print(f"\nTotal Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    print("\n" + "-"*80)
    for test in results["tests"]:
        status = "✅ PASS" if test["passed"] else "❌ FAIL"
        print(f"{status}: {test['test']}")
    print("-"*80)
    
    # Save results to file
    with open('/app/payout_kyc_stability_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nDetailed results saved to: /app/payout_kyc_stability_test_results.json")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
