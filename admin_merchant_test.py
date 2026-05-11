#!/usr/bin/env python3
"""
BidBlitz V2 - Backend API Testing Script
Tests Admin Panel Grid Menu and Merchant Dashboard Pay Keys features
"""

import requests
import json
import sys
from typing import Dict, Optional

# Configuration
BACKEND_URL = "https://ocpp-csms-platform.preview.emergentagent.com"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"
MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PASSWORD = "Haendler2026!"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_test(name: str):
    print(f"\n{Colors.BLUE}🧪 Testing: {name}{Colors.RESET}")

def print_success(msg: str):
    print(f"{Colors.GREEN}✅ {msg}{Colors.RESET}")

def print_error(msg: str):
    print(f"{Colors.RED}❌ {msg}{Colors.RESET}")

def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.RESET}")

def print_info(msg: str):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.RESET}")

def login(email: str, password: str) -> Optional[Dict]:
    """Login and return session cookies"""
    print_test(f"Login as {email}")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/auth/login",
            json={"email": email, "password": password},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Login successful - User: {data.get('user', {}).get('name', 'Unknown')}, Role: {data.get('user', {}).get('role', 'Unknown')}")
            return response.cookies.get_dict()
        else:
            print_error(f"Login failed - Status: {response.status_code}, Response: {response.text[:200]}")
            return None
    except Exception as e:
        print_error(f"Login exception: {str(e)}")
        return None

def test_admin_overview(cookies: Dict) -> bool:
    """Test GET /api/admin/overview"""
    print_test("Admin Overview API")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/api/admin/overview",
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success("Admin Overview API working")
            print_info(f"Total Users: {data.get('total_users', 0)}")
            print_info(f"Total Merchants: {data.get('total_merchants', 0)}")
            print_info(f"Payment Volume: €{data.get('payment_volume', 0):.2f}")
            print_info(f"Platform Fee Revenue: €{data.get('platform_fee_revenue', 0):.2f}")
            
            # Verify required fields
            required_fields = ['total_users', 'total_merchants', 'payment_volume', 'platform_fee_revenue']
            missing_fields = [f for f in required_fields if f not in data]
            
            if missing_fields:
                print_warning(f"Missing fields: {', '.join(missing_fields)}")
                return False
            
            return True
        else:
            print_error(f"Admin Overview failed - Status: {response.status_code}, Response: {response.text[:200]}")
            return False
    except Exception as e:
        print_error(f"Admin Overview exception: {str(e)}")
        return False

def test_pay_keys_list(cookies: Dict) -> bool:
    """Test GET /api/pay/my-keys"""
    print_test("Pay Keys - List Keys")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/api/pay/my-keys",
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            keys = data.get('keys', [])
            print_success(f"Pay Keys List API working - Found {len(keys)} keys")
            
            for key in keys:
                print_info(f"Key: {key.get('label', 'Unknown')} - Public: {key.get('public_key', 'N/A')[:20]}... - Sessions: {key.get('total_sessions', 0)} - Paid: €{key.get('total_paid', 0):.2f} - Revoked: {key.get('revoked', False)}")
            
            return True
        else:
            print_error(f"Pay Keys List failed - Status: {response.status_code}, Response: {response.text[:200]}")
            return False
    except Exception as e:
        print_error(f"Pay Keys List exception: {str(e)}")
        return False

def test_pay_keys_create(cookies: Dict) -> Optional[str]:
    """Test POST /api/pay/my-keys/create - Returns key_id if successful"""
    print_test("Pay Keys - Create Key")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/pay/my-keys/create",
            json={"label": "Test Key Backend"},
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            keys = data.get('keys', {})
            key_id = keys.get('key_id')
            public_key = keys.get('public_key', '')
            secret_key = keys.get('secret_key', '')
            
            print_success("Pay Keys Create API working")
            print_info(f"Key ID: {key_id}")
            print_info(f"Public Key: {public_key[:30]}...")
            print_info(f"Secret Key: {secret_key[:30]}...")
            print_info(f"Label: {keys.get('label', 'Unknown')}")
            
            if not key_id or not public_key or not secret_key:
                print_warning("Missing key_id, public_key, or secret_key in response")
                return None
            
            return key_id
        else:
            print_error(f"Pay Keys Create failed - Status: {response.status_code}, Response: {response.text[:200]}")
            return None
    except Exception as e:
        print_error(f"Pay Keys Create exception: {str(e)}")
        return None

def test_pay_keys_revoke(cookies: Dict, key_id: str) -> bool:
    """Test POST /api/pay/my-keys/{key_id}/revoke"""
    print_test(f"Pay Keys - Revoke Key {key_id}")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/pay/my-keys/{key_id}/revoke",
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Pay Keys Revoke API working - Key {key_id} revoked")
            return True
        else:
            print_error(f"Pay Keys Revoke failed - Status: {response.status_code}, Response: {response.text[:200]}")
            return False
    except Exception as e:
        print_error(f"Pay Keys Revoke exception: {str(e)}")
        return False

def test_pay_sessions(cookies: Dict) -> bool:
    """Test GET /api/pay/my-sessions"""
    print_test("Pay Keys - List Sessions")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/api/pay/my-sessions",
            cookies=cookies,
            params={"limit": 30},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            sessions = data.get('sessions', [])
            summary = data.get('summary', {})
            
            print_success(f"Pay Sessions API working - Found {len(sessions)} sessions")
            print_info(f"Total Sessions: {summary.get('total', 0)}")
            print_info(f"Paid Count: {summary.get('paid_count', 0)}")
            print_info(f"Paid Amount: €{summary.get('paid_amount', 0):.2f}")
            print_info(f"Pending Count: {summary.get('pending_count', 0)}")
            
            return True
        else:
            print_error(f"Pay Sessions failed - Status: {response.status_code}, Response: {response.text[:200]}")
            return False
    except Exception as e:
        print_error(f"Pay Sessions exception: {str(e)}")
        return False

def main():
    print(f"\n{Colors.BLUE}{'='*60}")
    print("BidBlitz V2 - Backend API Testing")
    print("Admin Panel Grid Menu & Merchant Dashboard Pay Keys")
    print(f"{'='*60}{Colors.RESET}\n")
    
    results = {
        "admin_login": False,
        "admin_overview": False,
        "merchant_login": False,
        "pay_keys_list": False,
        "pay_keys_create": False,
        "pay_keys_revoke": False,
        "pay_sessions": False,
    }
    
    # Test 1: Admin Login
    admin_cookies = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if admin_cookies:
        results["admin_login"] = True
        
        # Test 2: Admin Overview
        results["admin_overview"] = test_admin_overview(admin_cookies)
    
    # Test 3: Merchant Login
    merchant_cookies = login(MERCHANT_EMAIL, MERCHANT_PASSWORD)
    if merchant_cookies:
        results["merchant_login"] = True
        
        # Test 4: List Pay Keys
        results["pay_keys_list"] = test_pay_keys_list(merchant_cookies)
        
        # Test 5: Create Pay Key
        key_id = test_pay_keys_create(merchant_cookies)
        if key_id:
            results["pay_keys_create"] = True
            
            # Test 6: Revoke Pay Key
            results["pay_keys_revoke"] = test_pay_keys_revoke(merchant_cookies, key_id)
        
        # Test 7: List Pay Sessions
        results["pay_sessions"] = test_pay_sessions(merchant_cookies)
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}{Colors.RESET}\n")
    
    total_tests = len(results)
    passed_tests = sum(1 for v in results.values() if v)
    
    for test_name, passed in results.items():
        status = f"{Colors.GREEN}✅ PASS{Colors.RESET}" if passed else f"{Colors.RED}❌ FAIL{Colors.RESET}"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    print(f"\n{Colors.BLUE}Total: {passed_tests}/{total_tests} tests passed ({(passed_tests/total_tests)*100:.1f}%){Colors.RESET}\n")
    
    # Exit code
    sys.exit(0 if passed_tests == total_tests else 1)

if __name__ == "__main__":
    main()
