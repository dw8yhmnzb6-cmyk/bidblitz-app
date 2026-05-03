#!/usr/bin/env python3
"""
BidBlitz POS P2 Features - Retest Script
Tests 3 previously failed endpoints after bug fixes:
1. GET /api/pos/retail/pick/tasks/pending
2. GET /api/pos/retail/video-replay/{receipt_id}
3. GET /api/pos/retail/public/product-info/{product_id}
"""

import requests
import json
from datetime import datetime

# Backend URL from frontend/.env
BASE_URL = "https://bidblitz-release.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"

# Test results
results = {
    "test_run": datetime.now().isoformat(),
    "total_tests": 3,
    "passed": 0,
    "failed": 0,
    "tests": []
}

def log_test(name, passed, status_code, response_data, error=None):
    """Log test result"""
    result = {
        "name": name,
        "passed": passed,
        "status_code": status_code,
        "response": response_data,
        "error": error
    }
    results["tests"].append(result)
    if passed:
        results["passed"] += 1
        print(f"✅ {name} - PASSED (Status: {status_code})")
    else:
        results["failed"] += 1
        print(f"❌ {name} - FAILED (Status: {status_code})")
        if error:
            print(f"   Error: {error}")
    if response_data:
        print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
    print()

def login():
    """Login and get session cookies"""
    print("=" * 80)
    print("STEP 1: LOGIN")
    print("=" * 80)
    
    url = f"{BASE_URL}/auth/login"
    payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Login Status: {response.status_code}")
        
        if response.status_code == 200:
            cookies = response.cookies
            data = response.json()
            print(f"✅ Login successful as: {data.get('user', {}).get('email')}")
            print(f"   Role: {data.get('user', {}).get('role')}")
            print(f"   Cookies: {list(cookies.keys())}")
            return cookies
        else:
            print(f"❌ Login failed: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return None

def create_test_product(cookies, store_id):
    """Create a test product for product-info endpoint"""
    print("=" * 80)
    print("STEP 2: CREATE TEST PRODUCT")
    print("=" * 80)
    
    if not store_id:
        print("⚠️ No store_id available, cannot create product")
        return None
    
    url = f"{BASE_URL}/pos/products/create"
    payload = {
        "store_id": store_id,
        "name": "Test Product for QR Scan",
        "sku": f"TEST-QR-{datetime.now().strftime('%H%M%S')}",
        "price": 9.99,
        "purchase_price": 5.00,
        "category": "Test",
        "stock": 100,
        "track_stock": True,
        "allow_negative_stock": False
    }
    
    try:
        response = requests.post(url, json=payload, cookies=cookies)
        print(f"Create Product Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            product = data.get("product", {})
            product_id = product.get("product_id")
            print(f"✅ Product created: {product_id}")
            print(f"   Name: {product.get('name')}")
            print(f"   SKU: {product.get('sku')}")
            return product_id
        else:
            print(f"⚠️ Product creation failed: {response.text}")
            return None
    except Exception as e:
        print(f"⚠️ Product creation error: {str(e)}")
        return None

def get_store_and_register(cookies):
    """Get existing store and register for testing"""
    print("=" * 80)
    print("STEP 2A: GET STORE AND REGISTER")
    print("=" * 80)
    
    try:
        # Get existing stores
        stores_url = f"{BASE_URL}/pos/stores"
        stores_response = requests.get(stores_url, cookies=cookies)
        print(f"Get Stores Status: {stores_response.status_code}")
        
        if stores_response.status_code == 200:
            stores = stores_response.json().get("stores", [])
            if stores:
                store_id = stores[0].get("store_id")
                print(f"✅ Using existing store: {store_id}")
                
                # Get registers for this store
                registers_url = f"{BASE_URL}/pos/registers"
                registers_response = requests.get(registers_url, params={"store_id": store_id}, cookies=cookies)
                print(f"Get Registers Status: {registers_response.status_code}")
                
                if registers_response.status_code == 200:
                    registers = registers_response.json().get("registers", [])
                    if registers:
                        register_id = registers[0].get("register_id")
                        print(f"✅ Using existing register: {register_id}")
                        return store_id, register_id
                    else:
                        print(f"⚠️ No registers found for store")
                        return store_id, None
                else:
                    print(f"⚠️ Failed to get registers: {registers_response.text}")
                    return store_id, None
            else:
                print(f"❌ No stores available")
                return None, None
        else:
            print(f"❌ Failed to get stores: {stores_response.text}")
            return None, None
            
    except Exception as e:
        print(f"❌ Error getting store/register: {str(e)}")
        return None, None

def get_existing_sale(cookies):
    """Try to get an existing sale for video-replay testing"""
    print("=" * 80)
    print("STEP 3A: GET EXISTING SALE")
    print("=" * 80)
    
    try:
        # Try to get sales from the system
        sales_url = f"{BASE_URL}/pos/sales"
        sales_response = requests.get(sales_url, cookies=cookies)
        print(f"Get Sales Status: {sales_response.status_code}")
        
        if sales_response.status_code == 200:
            data = sales_response.json()
            sales = data.get("sales", [])
            if sales:
                receipt_id = sales[0].get("receipt_id")
                print(f"✅ Using existing sale: {receipt_id}")
                return receipt_id
            else:
                print(f"⚠️ No existing sales found")
                return None
        else:
            print(f"⚠️ Failed to get sales: {sales_response.text}")
            return None
            
    except Exception as e:
        print(f"⚠️ Error getting sales: {str(e)}")
        return None

def open_shift_and_create_sale(cookies, store_id, register_id, product_id):
    """Open a shift and create a test sale for video-replay endpoint"""
    print("=" * 80)
    print("STEP 3B: OPEN SHIFT AND CREATE SALE")
    print("=" * 80)
    
    if not store_id or not register_id:
        print("⚠️ Missing store_id or register_id, cannot create sale")
        return None
    
    try:
        # Open a shift first
        shift_url = f"{BASE_URL}/pos/shift/open"
        shift_payload = {
            "register_id": register_id,
            "starting_cash": 100.00
        }
        
        shift_response = requests.post(shift_url, json=shift_payload, cookies=cookies)
        print(f"Open Shift Status: {shift_response.status_code}")
        
        if shift_response.status_code == 200:
            shift_data = shift_response.json()
            shift_id = shift_data.get("shift", {}).get("shift_id")
            print(f"✅ Shift opened: {shift_id}")
        elif shift_response.status_code == 400 and "bereits offen" in shift_response.text:
            print(f"✅ Shift already open")
        else:
            print(f"⚠️ Failed to open shift: {shift_response.text}")
            # Continue anyway, maybe shift is already open
        
        # Now try to create a sale via checkout
        checkout_url = f"{BASE_URL}/pos/checkout"
        checkout_payload = {
            "register_id": register_id,
            "items": [
                {
                    "product_id": product_id if product_id else "PRD-TEST-001",
                    "name": "Test Item for Video Replay",
                    "quantity": 1,
                    "price": 10.00
                }
            ],
            "method": "cash",
            "cash_received": 20.00,
            "discount_pct": 0
        }
        
        checkout_response = requests.post(checkout_url, json=checkout_payload, cookies=cookies)
        print(f"Checkout Status: {checkout_response.status_code}")
        
        if checkout_response.status_code == 200:
            data = checkout_response.json()
            sale = data.get("sale", {})
            receipt_id = sale.get("receipt_id")
            print(f"✅ Sale created: {receipt_id}")
            print(f"   Store ID: {store_id}")
            return receipt_id
        else:
            print(f"⚠️ Checkout failed: {checkout_response.text}")
            return None
            
    except Exception as e:
        print(f"⚠️ Sale creation error: {str(e)}")
        return None

def test_pick_tasks_pending(cookies, store_id):
    """Test GET /api/pos/retail/pick/tasks/pending"""
    print("=" * 80)
    print("TEST 1: GET /api/pos/retail/pick/tasks/pending")
    print("=" * 80)
    
    if not store_id:
        print("⚠️ No store_id available, using placeholder")
        store_id = "STR-TEST-001"
    
    url = f"{BASE_URL}/pos/retail/pick/tasks/pending"
    params = {"store_id": store_id}
    
    try:
        response = requests.get(url, params=params, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            # Check if response has expected structure
            if "tasks" in data and isinstance(data["tasks"], list):
                log_test(
                    "GET /api/pos/retail/pick/tasks/pending",
                    True,
                    response.status_code,
                    data
                )
            else:
                log_test(
                    "GET /api/pos/retail/pick/tasks/pending",
                    False,
                    response.status_code,
                    data,
                    "Response missing 'tasks' array"
                )
        else:
            log_test(
                "GET /api/pos/retail/pick/tasks/pending",
                False,
                response.status_code,
                response.text,
                f"Expected 200, got {response.status_code}"
            )
    except Exception as e:
        log_test(
            "GET /api/pos/retail/pick/tasks/pending",
            False,
            0,
            None,
            str(e)
        )

def test_video_replay(cookies, receipt_id):
    """Test GET /api/pos/retail/video-replay/{receipt_id}"""
    print("=" * 80)
    print("TEST 2: GET /api/pos/retail/video-replay/{receipt_id}")
    print("=" * 80)
    
    if not receipt_id:
        print("⚠️ No receipt_id available, skipping test")
        log_test(
            "GET /api/pos/retail/video-replay/{receipt_id}",
            False,
            0,
            None,
            "No receipt_id available from setup"
        )
        return
    
    url = f"{BASE_URL}/pos/retail/video-replay/{receipt_id}"
    
    try:
        response = requests.get(url, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            # Check if response has expected structure
            expected_fields = ["receipt_id", "video_available", "placeholder_url"]
            has_all_fields = all(field in data for field in expected_fields)
            
            if has_all_fields:
                log_test(
                    "GET /api/pos/retail/video-replay/{receipt_id}",
                    True,
                    response.status_code,
                    data
                )
            else:
                log_test(
                    "GET /api/pos/retail/video-replay/{receipt_id}",
                    False,
                    response.status_code,
                    data,
                    f"Response missing expected fields: {expected_fields}"
                )
        else:
            log_test(
                "GET /api/pos/retail/video-replay/{receipt_id}",
                False,
                response.status_code,
                response.text,
                f"Expected 200, got {response.status_code}"
            )
    except Exception as e:
        log_test(
            "GET /api/pos/retail/video-replay/{receipt_id}",
            False,
            0,
            None,
            str(e)
        )

def test_public_product_info(cookies, product_id):
    """Test GET /api/pos/retail/public/product-info/{product_id}"""
    print("=" * 80)
    print("TEST 3: GET /api/pos/retail/public/product-info/{product_id}")
    print("=" * 80)
    
    if not product_id:
        print("⚠️ No product_id available, skipping test")
        log_test(
            "GET /api/pos/retail/public/product-info/{product_id}",
            False,
            0,
            None,
            "No product_id available from setup"
        )
        return
    
    url = f"{BASE_URL}/pos/retail/public/product-info/{product_id}"
    
    try:
        # This is a PUBLIC endpoint, so we don't need cookies
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            # Check if response has expected structure
            if "product" in data and "qr_url" in data:
                log_test(
                    "GET /api/pos/retail/public/product-info/{product_id}",
                    True,
                    response.status_code,
                    data
                )
            else:
                log_test(
                    "GET /api/pos/retail/public/product-info/{product_id}",
                    False,
                    response.status_code,
                    data,
                    "Response missing 'product' or 'qr_url' fields"
                )
        else:
            log_test(
                "GET /api/pos/retail/public/product-info/{product_id}",
                False,
                response.status_code,
                response.text,
                f"Expected 200, got {response.status_code}"
            )
    except Exception as e:
        log_test(
            "GET /api/pos/retail/public/product-info/{product_id}",
            False,
            0,
            None,
            str(e)
        )

def main():
    """Main test execution"""
    print("\n" + "=" * 80)
    print("BidBlitz POS P2 Features - Retest After Bug Fixes")
    print("=" * 80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test User: {ADMIN_EMAIL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()
    
    # Step 1: Login
    cookies = login()
    if not cookies:
        print("\n❌ CRITICAL: Login failed. Cannot proceed with tests.")
        return
    
    print()
    
    # Step 2A: Get store and register
    store_id, register_id = get_store_and_register(cookies)
    print()
    
    # Step 2B: Create test product
    product_id = create_test_product(cookies, store_id)
    print()
    
    # Step 3A: Try to get existing sale first
    receipt_id = get_existing_sale(cookies)
    
    # Step 3B: If no existing sale, open shift and create one
    if not receipt_id:
        receipt_id = open_shift_and_create_sale(cookies, store_id, register_id, product_id)
    print()
    
    # Run tests
    test_pick_tasks_pending(cookies, store_id)
    test_video_replay(cookies, receipt_id)
    test_public_product_info(cookies, product_id)
    
    # Print summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {results['total_tests']}")
    print(f"✅ Passed: {results['passed']}")
    print(f"❌ Failed: {results['failed']}")
    print(f"Success Rate: {(results['passed'] / results['total_tests'] * 100):.1f}%")
    print("=" * 80)
    
    # Save results to file
    with open("/app/pos_p2_retest_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n📄 Detailed results saved to: /app/pos_p2_retest_results.json")

if __name__ == "__main__":
    main()
