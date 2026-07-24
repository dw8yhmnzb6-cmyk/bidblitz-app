#!/usr/bin/env python3
"""
Focused Backend Test for Admin Analytics Fix
Testing endpoints after admin undefined errors were fixed
"""

import requests
import json
import sys
from typing import Dict, Any

# Backend URL from frontend/.env
BACKEND_URL = "https://super-app-staging-2.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_success(msg: str):
    print(f"{Colors.GREEN}✓ {msg}{Colors.RESET}")

def print_error(msg: str):
    print(f"{Colors.RED}✗ {msg}{Colors.RESET}")

def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.RESET}")

def print_info(msg: str):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.RESET}")

def test_admin_login() -> Dict[str, str]:
    """Test admin login and return session cookies"""
    print_info("Testing POST /api/auth/login with admin credentials...")
    
    try:
        response = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if role is at root level or nested under 'user'
            user_role = data.get("role") or data.get("user", {}).get("role")
            user_email = data.get("email") or data.get("user", {}).get("email")
            
            if user_role == "admin":
                print_success(f"Admin login successful - Status: {response.status_code}")
                print_info(f"  User: {user_email}, Role: {user_role}")
                return dict(response.cookies)
            else:
                print_error(f"Login succeeded but role is not admin: {user_role}")
                print_error(f"  Response structure: {list(data.keys())}")
                return {}
        else:
            print_error(f"Login failed - Status: {response.status_code}")
            print_error(f"  Response: {response.text[:200]}")
            return {}
    except Exception as e:
        print_error(f"Login request failed: {str(e)}")
        return {}

def test_analytics_overview(cookies: Dict[str, str]) -> bool:
    """Test GET /api/admin/analytics/overview?days=7"""
    print_info("Testing GET /api/admin/analytics/overview?days=7...")
    
    try:
        response = requests.get(
            f"{API_BASE}/admin/analytics/overview",
            params={"days": 7},
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 500:
            print_error(f"Analytics overview returned 500 error")
            print_error(f"  Response: {response.text[:300]}")
            return False
        
        if response.status_code != 200:
            print_error(f"Analytics overview failed - Status: {response.status_code}")
            print_error(f"  Response: {response.text[:200]}")
            return False
        
        data = response.json()
        
        # Check for required fields
        required_fields = ["total_users", "online_now", "active_24h", "active_7d", 
                          "new_today", "revenue_today", "tx_today"]
        
        missing_fields = []
        for field in required_fields:
            if field not in data:
                missing_fields.append(field)
        
        if missing_fields:
            print_error(f"Analytics overview missing required fields: {missing_fields}")
            print_info(f"  Available fields: {list(data.keys())}")
            return False
        
        print_success(f"Analytics overview successful - Status: {response.status_code}")
        print_info(f"  Fields present: {', '.join(required_fields)}")
        print_info(f"  Sample values: total_users={data.get('total_users')}, online_now={data.get('online_now')}, active_24h={data.get('active_24h')}")
        return True
        
    except Exception as e:
        print_error(f"Analytics overview request failed: {str(e)}")
        return False

def test_analytics_conversions(cookies: Dict[str, str]) -> bool:
    """Test GET /api/analytics/conversions?days=7"""
    print_info("Testing GET /api/analytics/conversions?days=7...")
    
    try:
        response = requests.get(
            f"{API_BASE}/analytics/conversions",
            params={"days": 7},
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 500:
            print_error(f"Analytics conversions returned 500 error")
            print_error(f"  Response: {response.text[:300]}")
            return False
        
        if response.status_code != 200:
            print_error(f"Analytics conversions failed - Status: {response.status_code}")
            print_error(f"  Response: {response.text[:200]}")
            return False
        
        data = response.json()
        
        # Check for required fields
        required_fields = ["totals", "top_features"]
        
        missing_fields = []
        for field in required_fields:
            if field not in data:
                missing_fields.append(field)
        
        if missing_fields:
            print_error(f"Analytics conversions missing required fields: {missing_fields}")
            print_info(f"  Available fields: {list(data.keys())}")
            return False
        
        print_success(f"Analytics conversions successful - Status: {response.status_code}")
        print_info(f"  Fields present: {', '.join(required_fields)}")
        print_info(f"  Totals type: {type(data.get('totals'))}, Top features type: {type(data.get('top_features'))}")
        return True
        
    except Exception as e:
        print_error(f"Analytics conversions request failed: {str(e)}")
        return False

def test_merchants_list(cookies: Dict[str, str]) -> bool:
    """Test GET /api/admin/merchants/list?limit=5"""
    print_info("Testing GET /api/admin/merchants/list?limit=5...")
    
    try:
        response = requests.get(
            f"{API_BASE}/admin/merchants/list",
            params={"limit": 5},
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 500:
            print_error(f"Merchants list returned 500 error")
            print_error(f"  Response: {response.text[:300]}")
            return False
        
        if response.status_code != 200:
            print_error(f"Merchants list failed - Status: {response.status_code}")
            print_error(f"  Response: {response.text[:200]}")
            return False
        
        data = response.json()
        
        # Check for merchants array
        if "merchants" not in data:
            print_error(f"Merchants list missing 'merchants' array")
            print_info(f"  Available fields: {list(data.keys())}")
            return False
        
        merchants = data.get("merchants", [])
        
        if not isinstance(merchants, list):
            print_error(f"Merchants field is not an array: {type(merchants)}")
            return False
        
        # Check merchant fields if any merchants exist
        if len(merchants) > 0:
            required_merchant_fields = ["id", "merchant_id", "email", "business_name"]
            first_merchant = merchants[0]
            
            missing_fields = []
            for field in required_merchant_fields:
                if field not in first_merchant:
                    missing_fields.append(field)
            
            if missing_fields:
                print_warning(f"First merchant missing some fields: {missing_fields}")
                print_info(f"  Available fields: {list(first_merchant.keys())}")
            
            print_success(f"Merchants list successful - Status: {response.status_code}")
            print_info(f"  Merchants count: {len(merchants)}")
            print_info(f"  First merchant fields: {list(first_merchant.keys())[:8]}")
        else:
            print_success(f"Merchants list successful - Status: {response.status_code}")
            print_info(f"  Merchants count: 0 (empty list is valid)")
        
        return True
        
    except Exception as e:
        print_error(f"Merchants list request failed: {str(e)}")
        return False

def main():
    print("\n" + "="*70)
    print("BACKEND TEST: Admin Analytics Fix Verification")
    print("="*70 + "\n")
    
    results = {
        "login": False,
        "analytics_overview": False,
        "analytics_conversions": False,
        "merchants_list": False
    }
    
    # Test 1: Admin Login
    print("\n[1/4] Admin Login Test")
    print("-" * 70)
    cookies = test_admin_login()
    results["login"] = bool(cookies)
    
    if not cookies:
        print_error("\n❌ CRITICAL: Admin login failed. Cannot proceed with other tests.")
        print("\n" + "="*70)
        print("TEST SUMMARY: FAILED")
        print("="*70)
        sys.exit(1)
    
    # Test 2: Analytics Overview
    print("\n[2/4] Analytics Overview Test")
    print("-" * 70)
    results["analytics_overview"] = test_analytics_overview(cookies)
    
    # Test 3: Analytics Conversions
    print("\n[3/4] Analytics Conversions Test")
    print("-" * 70)
    results["analytics_conversions"] = test_analytics_conversions(cookies)
    
    # Test 4: Merchants List
    print("\n[4/4] Merchants List Test")
    print("-" * 70)
    results["merchants_list"] = test_merchants_list(cookies)
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    all_passed = all(results.values())
    
    for test_name, passed in results.items():
        status = f"{Colors.GREEN}✓ PASSED{Colors.RESET}" if passed else f"{Colors.RED}✗ FAILED{Colors.RESET}"
        print(f"  {test_name.replace('_', ' ').title()}: {status}")
    
    print("="*70)
    
    if all_passed:
        print(f"\n{Colors.GREEN}✓ ALL TESTS PASSED{Colors.RESET}")
        print("No 500 errors detected. All endpoints return expected data structures.\n")
        sys.exit(0)
    else:
        print(f"\n{Colors.RED}✗ SOME TESTS FAILED{Colors.RESET}")
        print("Backend regression detected or endpoints not working as expected.\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
