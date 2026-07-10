#!/usr/bin/env python3
"""
BidBlitz Commerce Center & Marketplace Backend Testing
Testing against: https://swipe-match-chat-8.preview.emergentagent.com

Test Flows:
1. Auth-Login with admin@bidblitz.com / BidBlitz2026!
2. GET /api/commerce-center/merchant-dashboard
3. POST /api/commerce-center/flash-sales with own listing (create listing via /api/marketplace/create if needed) 
   and then DELETE /api/commerce-center/flash-sales/{sale_id}
4. GET /api/marketplace/meta/favorites
5. GET /api/marketplace/catalog/{listing_id}
6. GET /api/mobility-platform/payment-options
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://swipe-match-chat-8.preview.emergentagent.com"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

# Test results storage
test_results = {
    "timestamp": datetime.now().isoformat(),
    "base_url": BASE_URL,
    "tests": []
}

def log_test(test_name, passed, status_code=None, response_data=None, error=None):
    """Log test result"""
    result = {
        "test": test_name,
        "passed": passed,
        "status_code": status_code,
        "timestamp": datetime.now().isoformat()
    }
    if error:
        result["error"] = str(error)
    if response_data:
        result["response_summary"] = response_data
    test_results["tests"].append(result)
    
    status = "✅ PASSED" if passed else "❌ FAILED"
    print(f"\n{status}: {test_name}")
    if status_code:
        print(f"  Status Code: {status_code}")
    if error:
        print(f"  Error: {error}")
    if response_data:
        print(f"  Response: {json.dumps(response_data, indent=2)[:500]}")

def test_auth_login():
    """Test 1: Auth-Login with admin@bidblitz.com / BidBlitz2026!"""
    print("\n" + "="*80)
    print("TEST 1: Auth-Login")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            cookies = response.cookies
            
            # Check if we got auth cookies
            has_access_token = 'access_token' in cookies
            has_user_data = 'email' in data or 'user' in data
            
            if has_access_token and has_user_data:
                log_test(
                    "Auth-Login",
                    True,
                    response.status_code,
                    {
                        "email": data.get("email") or data.get("user", {}).get("email"),
                        "role": data.get("role") or data.get("user", {}).get("role"),
                        "has_access_token": has_access_token
                    }
                )
                return cookies
            else:
                log_test("Auth-Login", False, response.status_code, error="Missing auth cookies or user data")
                return None
        else:
            log_test("Auth-Login", False, response.status_code, error=response.text[:200])
            return None
            
    except Exception as e:
        log_test("Auth-Login", False, error=str(e))
        return None

def test_merchant_dashboard(cookies):
    """Test 2: GET /api/commerce-center/merchant-dashboard"""
    print("\n" + "="*80)
    print("TEST 2: GET /api/commerce-center/merchant-dashboard")
    print("="*80)
    
    if not cookies:
        log_test("Merchant Dashboard", False, error="No auth cookies available")
        return
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/commerce-center/merchant-dashboard",
            cookies=cookies,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for expected fields
            has_stats = 'stats' in data
            has_flash_sales = 'flash_sales' in data
            has_eligible_listings = 'eligible_listings' in data
            
            if has_stats and has_flash_sales and has_eligible_listings:
                log_test(
                    "Merchant Dashboard",
                    True,
                    response.status_code,
                    {
                        "stats": data.get("stats"),
                        "flash_sales_count": len(data.get("flash_sales", [])),
                        "eligible_listings_count": len(data.get("eligible_listings", []))
                    }
                )
                return data
            else:
                log_test("Merchant Dashboard", False, response.status_code, error="Missing expected fields")
                return None
        else:
            log_test("Merchant Dashboard", False, response.status_code, error=response.text[:200])
            return None
            
    except Exception as e:
        log_test("Merchant Dashboard", False, error=str(e))
        return None

def test_create_listing(cookies):
    """Helper: Create a marketplace listing for flash sale testing"""
    print("\n" + "="*80)
    print("HELPER: Creating marketplace listing for flash sale test")
    print("="*80)
    
    if not cookies:
        print("  ⚠️  No auth cookies available")
        return None
    
    try:
        listing_data = {
            "title": "Test Product for Flash Sale",
            "description": "This is a test product created for flash sale testing. High quality item in excellent condition.",
            "price": 99.99,
            "category": "electronics",
            "images": ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e"],
            "location": "Berlin, Germany",
            "negotiable": False,
            "shipping_available": True,
            "shipping_cost": 5.99
        }
        
        response = requests.post(
            f"{BASE_URL}/api/marketplace/create",
            json=listing_data,
            cookies=cookies,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("listing"):
                listing_id = data["listing"]["listing_id"]
                print(f"  ✅ Created listing: {listing_id}")
                return listing_id
            else:
                print(f"  ⚠️  Unexpected response format: {data}")
                return None
        else:
            print(f"  ⚠️  Failed to create listing: {response.status_code} - {response.text[:200]}")
            return None
            
    except Exception as e:
        print(f"  ⚠️  Error creating listing: {e}")
        return None

def test_flash_sale_flow(cookies, dashboard_data):
    """Test 3: POST /api/commerce-center/flash-sales and DELETE /api/commerce-center/flash-sales/{sale_id}"""
    print("\n" + "="*80)
    print("TEST 3: Flash Sale Flow (CREATE + DELETE)")
    print("="*80)
    
    if not cookies:
        log_test("Flash Sale Flow", False, error="No auth cookies available")
        return
    
    # Try to get an eligible listing from dashboard
    listing_id = None
    if dashboard_data and dashboard_data.get("eligible_listings"):
        eligible = dashboard_data["eligible_listings"]
        if eligible:
            listing_id = eligible[0]["listing_id"]
            print(f"  Using existing eligible listing: {listing_id}")
    
    # If no eligible listing, create one
    if not listing_id:
        print("  No eligible listings found, creating new listing...")
        listing_id = test_create_listing(cookies)
    
    if not listing_id:
        log_test("Flash Sale Flow", False, error="Could not get or create listing for flash sale")
        return
    
    # Create flash sale
    try:
        flash_sale_data = {
            "listing_id": listing_id,
            "sale_price": 79.99,
            "duration_minutes": 180
        }
        
        response = requests.post(
            f"{BASE_URL}/api/commerce-center/flash-sales",
            json=flash_sale_data,
            cookies=cookies,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("ok") and data.get("sale"):
                sale_id = data["sale"]["sale_id"]
                log_test(
                    "Flash Sale CREATE",
                    True,
                    response.status_code,
                    {
                        "sale_id": sale_id,
                        "listing_id": listing_id,
                        "sale_price": data["sale"].get("sale_price"),
                        "status": data["sale"].get("status")
                    }
                )
                
                # Now delete the flash sale
                test_delete_flash_sale(cookies, sale_id)
            else:
                log_test("Flash Sale CREATE", False, response.status_code, error="Missing ok or sale in response")
        else:
            log_test("Flash Sale CREATE", False, response.status_code, error=response.text[:200])
            
    except Exception as e:
        log_test("Flash Sale CREATE", False, error=str(e))

def test_delete_flash_sale(cookies, sale_id):
    """Test 3b: DELETE /api/commerce-center/flash-sales/{sale_id}"""
    print("\n" + "-"*80)
    print(f"TEST 3b: DELETE Flash Sale {sale_id}")
    print("-"*80)
    
    try:
        response = requests.delete(
            f"{BASE_URL}/api/commerce-center/flash-sales/{sale_id}",
            cookies=cookies,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("ok"):
                log_test(
                    "Flash Sale DELETE",
                    True,
                    response.status_code,
                    {"sale_id": data.get("sale_id"), "deleted": True}
                )
            else:
                log_test("Flash Sale DELETE", False, response.status_code, error="ok=False in response")
        else:
            log_test("Flash Sale DELETE", False, response.status_code, error=response.text[:200])
            
    except Exception as e:
        log_test("Flash Sale DELETE", False, error=str(e))

def test_marketplace_favorites(cookies):
    """Test 4: GET /api/marketplace/meta/favorites"""
    print("\n" + "="*80)
    print("TEST 4: GET /api/marketplace/meta/favorites")
    print("="*80)
    
    if not cookies:
        log_test("Marketplace Favorites", False, error="No auth cookies available")
        return
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/marketplace/meta/favorites",
            cookies=cookies,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for expected fields
            has_favorites = 'favorites' in data
            
            if has_favorites:
                log_test(
                    "Marketplace Favorites",
                    True,
                    response.status_code,
                    {
                        "favorites_count": len(data.get("favorites", [])),
                        "has_favorites_array": True
                    }
                )
            else:
                log_test("Marketplace Favorites", False, response.status_code, error="Missing favorites field")
        else:
            log_test("Marketplace Favorites", False, response.status_code, error=response.text[:200])
            
    except Exception as e:
        log_test("Marketplace Favorites", False, error=str(e))

def test_marketplace_catalog(cookies):
    """Test 5: GET /api/marketplace/catalog/{listing_id}"""
    print("\n" + "="*80)
    print("TEST 5: GET /api/marketplace/catalog/{listing_id}")
    print("="*80)
    
    # First, get a listing_id from the marketplace list
    try:
        # Get active listings
        response = requests.get(
            f"{BASE_URL}/api/marketplace/list?limit=1",
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            listings = data.get("listings", [])
            
            if listings:
                listing_id = listings[0]["listing_id"]
                print(f"  Using listing_id: {listing_id}")
                
                # Now test the catalog endpoint
                catalog_response = requests.get(
                    f"{BASE_URL}/api/marketplace/catalog/{listing_id}",
                    timeout=30
                )
                
                if catalog_response.status_code == 200:
                    catalog_data = catalog_response.json()
                    
                    # Check for expected fields
                    has_listing_id = 'listing_id' in catalog_data
                    has_title = 'title' in catalog_data
                    has_price = 'price' in catalog_data
                    
                    if has_listing_id and has_title and has_price:
                        log_test(
                            "Marketplace Catalog",
                            True,
                            catalog_response.status_code,
                            {
                                "listing_id": catalog_data.get("listing_id"),
                                "title": catalog_data.get("title"),
                                "price": catalog_data.get("price"),
                                "views": catalog_data.get("views")
                            }
                        )
                    else:
                        log_test("Marketplace Catalog", False, catalog_response.status_code, error="Missing expected fields")
                else:
                    log_test("Marketplace Catalog", False, catalog_response.status_code, error=catalog_response.text[:200])
            else:
                log_test("Marketplace Catalog", False, error="No listings available to test catalog endpoint")
        else:
            log_test("Marketplace Catalog", False, response.status_code, error="Failed to get listings for catalog test")
            
    except Exception as e:
        log_test("Marketplace Catalog", False, error=str(e))

def test_mobility_payment_options(cookies):
    """Test 6: GET /api/mobility-platform/payment-options"""
    print("\n" + "="*80)
    print("TEST 6: GET /api/mobility-platform/payment-options")
    print("="*80)
    
    if not cookies:
        log_test("Mobility Payment Options", False, error="No auth cookies available")
        return
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/mobility-platform/payment-options",
            cookies=cookies,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for expected fields - the endpoint returns 'methods' not 'payment_methods'
            has_methods = 'methods' in data
            has_wallet_balance = 'wallet_balance' in data
            
            if has_methods and has_wallet_balance:
                methods = data.get("methods", [])
                log_test(
                    "Mobility Payment Options",
                    True,
                    response.status_code,
                    {
                        "wallet_balance": data.get("wallet_balance"),
                        "payment_methods_count": len(methods),
                        "payment_methods": [pm.get("id") for pm in methods if isinstance(pm, dict)]
                    }
                )
            else:
                log_test("Mobility Payment Options", False, response.status_code, error=f"Missing expected fields. Has methods: {has_methods}, Has wallet_balance: {has_wallet_balance}")
        else:
            log_test("Mobility Payment Options", False, response.status_code, error=response.text[:200])
            
    except Exception as e:
        log_test("Mobility Payment Options", False, error=str(e))

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BidBlitz Commerce Center & Marketplace Backend Testing")
    print(f"Target: {BASE_URL}")
    print(f"Started: {datetime.now().isoformat()}")
    print("="*80)
    
    # Test 1: Auth-Login
    cookies = test_auth_login()
    
    # Test 2: Merchant Dashboard
    dashboard_data = test_merchant_dashboard(cookies)
    
    # Test 3: Flash Sale Flow (CREATE + DELETE)
    test_flash_sale_flow(cookies, dashboard_data)
    
    # Test 4: Marketplace Favorites
    test_marketplace_favorites(cookies)
    
    # Test 5: Marketplace Catalog
    test_marketplace_catalog(cookies)
    
    # Test 6: Mobility Payment Options
    test_mobility_payment_options(cookies)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for t in test_results["tests"] if t["passed"])
    total = len(test_results["tests"])
    
    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {(passed/total*100):.1f}%")
    
    print("\nDetailed Results:")
    for test in test_results["tests"]:
        status = "✅" if test["passed"] else "❌"
        print(f"  {status} {test['test']} - Status: {test.get('status_code', 'N/A')}")
        if not test["passed"] and test.get("error"):
            print(f"      Error: {test['error']}")
    
    # Save results to file
    with open("/app/backend_commerce_test_results.json", "w") as f:
        json.dump(test_results, f, indent=2)
    
    print(f"\n✅ Test results saved to /app/backend_commerce_test_results.json")
    print("="*80)

if __name__ == "__main__":
    main()
