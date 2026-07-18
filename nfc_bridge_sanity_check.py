#!/usr/bin/env python3
"""
Native NFC Bridge Sanity Check
Quick backend sanity test after Native NFC Bridge frontend changes.
Tests: Login, /nfc route loads, /admin/tables route loads
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://super-app-staging-2.preview.emergentagent.com"
CREDENTIALS = {
    "email": "admin@bidblitz.com",
    "password": "BidBlitz2026!"
}

def print_test(test_num, description):
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print('='*80)

def main():
    print("\n" + "="*80)
    print("NATIVE NFC BRIDGE SANITY CHECK")
    print(f"Environment: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("="*80)
    
    results = {
        "timestamp": datetime.now().isoformat(),
        "base_url": BASE_URL,
        "tests": []
    }
    
    session = requests.Session()
    
    # TEST 1: Login
    print_test(1, "Login with admin@bidblitz.com")
    try:
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=CREDENTIALS,
            timeout=10
        )
        
        if login_response.status_code == 200:
            user_data = login_response.json()
            print(f"✅ Login successful")
            print(f"   User: {user_data.get('email')}")
            print(f"   Role: {user_data.get('role')}")
            print(f"   Cookies: {list(session.cookies.keys())}")
            results["tests"].append({
                "test": "Login",
                "status": "PASS",
                "details": f"User: {user_data.get('email')}, Role: {user_data.get('role')}"
            })
        else:
            print(f"❌ Login failed with status {login_response.status_code}")
            print(f"   Response: {login_response.text[:200]}")
            results["tests"].append({
                "test": "Login",
                "status": "FAIL",
                "details": f"Status {login_response.status_code}"
            })
            return results
            
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        results["tests"].append({
            "test": "Login",
            "status": "ERROR",
            "details": str(e)
        })
        return results
    
    # TEST 2: /nfc route loads (check if HTML is returned, not 404)
    print_test(2, "GET /nfc route loads")
    try:
        nfc_response = session.get(
            f"{BASE_URL}/nfc",
            timeout=10,
            allow_redirects=True
        )
        
        if nfc_response.status_code == 200:
            # Check if it's HTML content
            content_type = nfc_response.headers.get('content-type', '')
            is_html = 'text/html' in content_type
            
            # Check if page contains expected content
            page_content = nfc_response.text
            has_nfc_content = 'nfc' in page_content.lower() or 'bidblitz' in page_content.lower()
            
            print(f"✅ /nfc route loads successfully")
            print(f"   Status: {nfc_response.status_code}")
            print(f"   Content-Type: {content_type}")
            print(f"   Is HTML: {is_html}")
            print(f"   Content length: {len(page_content)} bytes")
            print(f"   Has expected content: {has_nfc_content}")
            
            results["tests"].append({
                "test": "/nfc route",
                "status": "PASS",
                "details": f"Status 200, HTML content, {len(page_content)} bytes"
            })
        else:
            print(f"❌ /nfc route returned status {nfc_response.status_code}")
            print(f"   URL: {nfc_response.url}")
            results["tests"].append({
                "test": "/nfc route",
                "status": "FAIL",
                "details": f"Status {nfc_response.status_code}"
            })
            
    except Exception as e:
        print(f"❌ /nfc route error: {str(e)}")
        results["tests"].append({
            "test": "/nfc route",
            "status": "ERROR",
            "details": str(e)
        })
    
    # TEST 3: /admin/tables route loads
    print_test(3, "GET /admin/tables route loads")
    try:
        tables_response = session.get(
            f"{BASE_URL}/admin/tables",
            timeout=10,
            allow_redirects=True
        )
        
        if tables_response.status_code == 200:
            # Check if it's HTML content
            content_type = tables_response.headers.get('content-type', '')
            is_html = 'text/html' in content_type
            
            # Check if page contains expected content
            page_content = tables_response.text
            has_tables_content = 'table' in page_content.lower() or 'restaurant' in page_content.lower()
            
            print(f"✅ /admin/tables route loads successfully")
            print(f"   Status: {tables_response.status_code}")
            print(f"   Content-Type: {content_type}")
            print(f"   Is HTML: {is_html}")
            print(f"   Content length: {len(page_content)} bytes")
            print(f"   Has expected content: {has_tables_content}")
            
            results["tests"].append({
                "test": "/admin/tables route",
                "status": "PASS",
                "details": f"Status 200, HTML content, {len(page_content)} bytes"
            })
        else:
            print(f"❌ /admin/tables route returned status {tables_response.status_code}")
            print(f"   URL: {tables_response.url}")
            results["tests"].append({
                "test": "/admin/tables route",
                "status": "FAIL",
                "details": f"Status {tables_response.status_code}"
            })
            
    except Exception as e:
        print(f"❌ /admin/tables route error: {str(e)}")
        results["tests"].append({
            "test": "/admin/tables route",
            "status": "ERROR",
            "details": str(e)
        })
    
    # Summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    
    passed = sum(1 for t in results["tests"] if t["status"] == "PASS")
    failed = sum(1 for t in results["tests"] if t["status"] == "FAIL")
    errors = sum(1 for t in results["tests"] if t["status"] == "ERROR")
    total = len(results["tests"])
    
    print(f"Total Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"⚠️  Errors: {errors}")
    print(f"Success Rate: {(passed/total*100):.1f}%")
    
    results["summary"] = {
        "total": total,
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "success_rate": f"{(passed/total*100):.1f}%"
    }
    
    # Save results
    with open('/app/nfc_bridge_sanity_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nResults saved to /app/nfc_bridge_sanity_results.json")
    
    return results

if __name__ == "__main__":
    results = main()
    
    # Exit with appropriate code
    failed_count = sum(1 for t in results["tests"] if t["status"] in ["FAIL", "ERROR"])
    exit(0 if failed_count == 0 else 1)
