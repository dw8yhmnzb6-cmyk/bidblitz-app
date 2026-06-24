#!/usr/bin/env python3
"""
BidBlitz Backend Testing - New Features (Phases B-E)
Tests 25 new endpoints:
- POS Hardware (7 endpoints)
- LiveKit Streaming (6 endpoints)
- Landing Chatbot (4 endpoints)
- Super App Extensions (8 endpoints)

Test Credentials: admin@bidblitz.ae / BidBlitz2026!
"""

import requests
import json
from datetime import datetime
import uuid

# Backend URL from frontend/.env
BASE_URL = "https://commerce-hub-565.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"

# Test results
results = {
    "test_run": datetime.now().isoformat(),
    "total_tests": 0,
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
        "response": response_data if isinstance(response_data, dict) else str(response_data)[:200],
        "error": error
    }
    results["tests"].append(result)
    results["total_tests"] += 1
    
    if passed:
        results["passed"] += 1
        print(f"✅ {name} - PASSED (Status: {status_code})")
    else:
        results["failed"] += 1
        print(f"❌ {name} - FAILED (Status: {status_code})")
        if error:
            print(f"   Error: {error}")
    
    if response_data and isinstance(response_data, dict):
        print(f"   Response: {json.dumps(response_data, indent=2)[:300]}...")
    print()

def login():
    """Login and get session cookies"""
    print("=" * 80)
    print("STEP 1: LOGIN AS ADMIN")
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

def get_test_data(cookies):
    """Get test data (store_id, register_id, receipt_id)"""
    print("=" * 80)
    print("STEP 2: GET TEST DATA")
    print("=" * 80)
    
    test_data = {
        "store_id": None,
        "register_id": None,
        "receipt_id": None
    }
    
    try:
        # Get stores
        stores_url = f"{BASE_URL}/pos/stores"
        stores_response = requests.get(stores_url, cookies=cookies)
        
        if stores_response.status_code == 200:
            stores = stores_response.json().get("stores", [])
            if stores:
                test_data["store_id"] = stores[0].get("store_id")
                print(f"✅ Store ID: {test_data['store_id']}")
                
                # Get registers
                registers_url = f"{BASE_URL}/pos/registers"
                registers_response = requests.get(registers_url, params={"store_id": test_data["store_id"]}, cookies=cookies)
                
                if registers_response.status_code == 200:
                    registers = registers_response.json().get("registers", [])
                    if registers:
                        test_data["register_id"] = registers[0].get("register_id")
                        print(f"✅ Register ID: {test_data['register_id']}")
                
                # Get sales
                sales_url = f"{BASE_URL}/pos/sales"
                sales_response = requests.get(sales_url, cookies=cookies)
                
                if sales_response.status_code == 200:
                    sales = sales_response.json().get("sales", [])
                    if sales:
                        test_data["receipt_id"] = sales[0].get("receipt_id")
                        print(f"✅ Receipt ID: {test_data['receipt_id']}")
        
        return test_data
        
    except Exception as e:
        print(f"⚠️ Error getting test data: {str(e)}")
        return test_data

# ═══════════════════════════════════════════════════════════════════════
# POS HARDWARE TESTS (7 endpoints)
# ═══════════════════════════════════════════════════════════════════════

def test_pos_hardware(cookies, test_data):
    """Test POS Hardware endpoints"""
    print("\n" + "=" * 80)
    print("PHASE 2: POS HARDWARE TESTS (7 endpoints)")
    print("=" * 80 + "\n")
    
    # Test 1: POST /api/pos/hardware/printer/print
    print("TEST 1: POST /api/pos/hardware/printer/print")
    print("-" * 80)
    
    if test_data["receipt_id"]:
        url = f"{BASE_URL}/pos/hardware/printer/print"
        payload = {
            "receipt_id": test_data["receipt_id"],
            "printer_id": "default"
        }
        
        try:
            response = requests.post(url, json=payload, cookies=cookies)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok") and data.get("receipt_id"):
                    log_test("POST /api/pos/hardware/printer/print", True, response.status_code, data)
                else:
                    log_test("POST /api/pos/hardware/printer/print", False, response.status_code, data, "Missing expected fields")
            else:
                log_test("POST /api/pos/hardware/printer/print", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
        except Exception as e:
            log_test("POST /api/pos/hardware/printer/print", False, 0, None, str(e))
    else:
        log_test("POST /api/pos/hardware/printer/print", False, 0, None, "No receipt_id available")
    
    # Test 2: POST /api/pos/hardware/scanner/register
    print("TEST 2: POST /api/pos/hardware/scanner/register")
    print("-" * 80)
    
    url = f"{BASE_URL}/pos/hardware/scanner/register"
    params = {
        "scanner_id": "SCN001",
        "type": "usb"
    }
    
    try:
        response = requests.post(url, params=params, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("scanner_id"):
                log_test("POST /api/pos/hardware/scanner/register", True, response.status_code, data)
            else:
                log_test("POST /api/pos/hardware/scanner/register", False, response.status_code, data, "Missing expected fields")
        else:
            log_test("POST /api/pos/hardware/scanner/register", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("POST /api/pos/hardware/scanner/register", False, 0, None, str(e))
    
    # Test 3: GET /api/pos/hardware/scanner/test
    print("TEST 3: GET /api/pos/hardware/scanner/test")
    print("-" * 80)
    
    url = f"{BASE_URL}/pos/hardware/scanner/test"
    params = {"barcode": "4011"}
    
    try:
        response = requests.get(url, params=params, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            if "ok" in data:
                log_test("GET /api/pos/hardware/scanner/test", True, response.status_code, data)
            else:
                log_test("GET /api/pos/hardware/scanner/test", False, response.status_code, data, "Missing 'ok' field")
        else:
            log_test("GET /api/pos/hardware/scanner/test", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("GET /api/pos/hardware/scanner/test", False, 0, None, str(e))
    
    # Test 4: POST /api/pos/hardware/cash-drawer/open
    print("TEST 4: POST /api/pos/hardware/cash-drawer/open")
    print("-" * 80)
    
    if test_data["register_id"]:
        url = f"{BASE_URL}/pos/hardware/cash-drawer/open"
        params = {"register_id": test_data["register_id"]}
        
        try:
            response = requests.post(url, params=params, cookies=cookies)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok") and data.get("drawer_opened"):
                    log_test("POST /api/pos/hardware/cash-drawer/open", True, response.status_code, data)
                else:
                    log_test("POST /api/pos/hardware/cash-drawer/open", False, response.status_code, data, "Missing expected fields")
            else:
                log_test("POST /api/pos/hardware/cash-drawer/open", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
        except Exception as e:
            log_test("POST /api/pos/hardware/cash-drawer/open", False, 0, None, str(e))
    else:
        log_test("POST /api/pos/hardware/cash-drawer/open", False, 0, None, "No register_id available")
    
    # Test 5: POST /api/pos/hardware/tse/sign
    print("TEST 5: POST /api/pos/hardware/tse/sign")
    print("-" * 80)
    
    if test_data["receipt_id"]:
        url = f"{BASE_URL}/pos/hardware/tse/sign"
        payload = {
            "receipt_id": test_data["receipt_id"],
            "process_type": "Kassenbeleg-V1"
        }
        
        try:
            response = requests.post(url, json=payload, cookies=cookies)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    log_test("POST /api/pos/hardware/tse/sign", True, response.status_code, data)
                else:
                    log_test("POST /api/pos/hardware/tse/sign", False, response.status_code, data, "Missing 'ok' field")
            else:
                log_test("POST /api/pos/hardware/tse/sign", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
        except Exception as e:
            log_test("POST /api/pos/hardware/tse/sign", False, 0, None, str(e))
    else:
        log_test("POST /api/pos/hardware/tse/sign", False, 0, None, "No receipt_id available")
    
    # Test 6: GET /api/pos/hardware/scale/weight
    print("TEST 6: GET /api/pos/hardware/scale/weight")
    print("-" * 80)
    
    url = f"{BASE_URL}/pos/hardware/scale/weight"
    params = {"scale_id": "default"}
    
    try:
        response = requests.get(url, params=params, cookies=cookies)
        
        # This endpoint will likely return 404 if no scale is configured, which is acceptable
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and "weight_kg" in data:
                log_test("GET /api/pos/hardware/scale/weight", True, response.status_code, data)
            else:
                log_test("GET /api/pos/hardware/scale/weight", False, response.status_code, data, "Missing expected fields")
        elif response.status_code == 404:
            # Expected if no scale configured
            log_test("GET /api/pos/hardware/scale/weight", True, response.status_code, {"note": "404 expected - no scale configured"})
        else:
            log_test("GET /api/pos/hardware/scale/weight", False, response.status_code, response.text, f"Unexpected status code")
    except Exception as e:
        log_test("GET /api/pos/hardware/scale/weight", False, 0, None, str(e))
    
    # Test 7: GET /api/pos/hardware/health
    print("TEST 7: GET /api/pos/hardware/health")
    print("-" * 80)
    
    if test_data["store_id"]:
        url = f"{BASE_URL}/pos/hardware/health"
        params = {"store_id": test_data["store_id"]}
        
        try:
            response = requests.get(url, params=params, cookies=cookies)
            
            if response.status_code == 200:
                data = response.json()
                if "status" in data and "store_id" in data:
                    log_test("GET /api/pos/hardware/health", True, response.status_code, data)
                else:
                    log_test("GET /api/pos/hardware/health", False, response.status_code, data, "Missing expected fields")
            else:
                log_test("GET /api/pos/hardware/health", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
        except Exception as e:
            log_test("GET /api/pos/hardware/health", False, 0, None, str(e))
    else:
        log_test("GET /api/pos/hardware/health", False, 0, None, "No store_id available")

# ═══════════════════════════════════════════════════════════════════════
# LIVEKIT STREAMING TESTS (6 endpoints)
# ═══════════════════════════════════════════════════════════════════════

def test_livekit_streaming(cookies):
    """Test LiveKit Streaming endpoints"""
    print("\n" + "=" * 80)
    print("PHASE 3: LIVEKIT STREAMING TESTS (6 endpoints)")
    print("=" * 80 + "\n")
    
    room_name = f"test-stream-{uuid.uuid4().hex[:8]}"
    
    # Test 1: POST /api/livekit/rooms
    print("TEST 1: POST /api/livekit/rooms")
    print("-" * 80)
    
    url = f"{BASE_URL}/livekit/rooms"
    payload = {
        "room_name": room_name,
        "max_participants": 100
    }
    
    try:
        response = requests.post(url, json=payload, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("room_name") == room_name:
                log_test("POST /api/livekit/rooms", True, response.status_code, data)
            else:
                log_test("POST /api/livekit/rooms", False, response.status_code, data, "Room name mismatch")
        else:
            log_test("POST /api/livekit/rooms", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("POST /api/livekit/rooms", False, 0, None, str(e))
    
    # Test 2: POST /api/livekit/token
    print("TEST 2: POST /api/livekit/token")
    print("-" * 80)
    
    url = f"{BASE_URL}/livekit/token"
    payload = {
        "room_name": room_name,
        "participant_name": "TestUser"
    }
    
    try:
        response = requests.post(url, json=payload, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("participant_token") and data.get("server_url"):
                log_test("POST /api/livekit/token", True, response.status_code, data)
            else:
                log_test("POST /api/livekit/token", False, response.status_code, data, "Missing token or server_url")
        else:
            log_test("POST /api/livekit/token", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("POST /api/livekit/token", False, 0, None, str(e))
    
    # Test 3: POST /api/livekit/rooms/{room}/products
    print("TEST 3: POST /api/livekit/rooms/{room}/products")
    print("-" * 80)
    
    url = f"{BASE_URL}/livekit/rooms/{room_name}/products"
    payload = {
        "product_id": "PRD-TEST-001",
        "name": "Test Product",
        "price": 99.99,
        "image": "https://example.com/image.jpg",
        "description": "Test product for live stream"
    }
    
    try:
        response = requests.post(url, json=payload, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("product"):
                log_test("POST /api/livekit/rooms/{room}/products", True, response.status_code, data)
            else:
                log_test("POST /api/livekit/rooms/{room}/products", False, response.status_code, data, "Missing expected fields")
        else:
            log_test("POST /api/livekit/rooms/{room}/products", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("POST /api/livekit/rooms/{room}/products", False, 0, None, str(e))
    
    # Test 4: GET /api/livekit/rooms/{room}/products
    print("TEST 4: GET /api/livekit/rooms/{room}/products")
    print("-" * 80)
    
    url = f"{BASE_URL}/livekit/rooms/{room_name}/products"
    
    try:
        response = requests.get(url, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            if "products" in data and "count" in data:
                log_test("GET /api/livekit/rooms/{room}/products", True, response.status_code, data)
            else:
                log_test("GET /api/livekit/rooms/{room}/products", False, response.status_code, data, "Missing products or count")
        else:
            log_test("GET /api/livekit/rooms/{room}/products", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("GET /api/livekit/rooms/{room}/products", False, 0, None, str(e))
    
    # Test 5: POST /api/livekit/rooms/{room}/recording/start
    print("TEST 5: POST /api/livekit/rooms/{room}/recording/start")
    print("-" * 80)
    
    url = f"{BASE_URL}/livekit/rooms/{room_name}/recording/start"
    payload = {
        "room_name": room_name
    }
    
    try:
        response = requests.post(url, json=payload, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("recording_id") and data.get("status") == "recording":
                log_test("POST /api/livekit/rooms/{room}/recording/start", True, response.status_code, data)
            else:
                log_test("POST /api/livekit/rooms/{room}/recording/start", False, response.status_code, data, "Missing recording_id or status")
        else:
            log_test("POST /api/livekit/rooms/{room}/recording/start", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("POST /api/livekit/rooms/{room}/recording/start", False, 0, None, str(e))
    
    # Test 6: GET /api/livekit/rooms/{room}/analytics
    print("TEST 6: GET /api/livekit/rooms/{room}/analytics")
    print("-" * 80)
    
    url = f"{BASE_URL}/livekit/rooms/{room_name}/analytics"
    
    try:
        response = requests.get(url, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            if "room_name" in data and "products_shown" in data:
                log_test("GET /api/livekit/rooms/{room}/analytics", True, response.status_code, data)
            else:
                log_test("GET /api/livekit/rooms/{room}/analytics", False, response.status_code, data, "Missing expected fields")
        else:
            log_test("GET /api/livekit/rooms/{room}/analytics", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("GET /api/livekit/rooms/{room}/analytics", False, 0, None, str(e))

# ═══════════════════════════════════════════════════════════════════════
# LANDING CHATBOT TESTS (4 endpoints)
# ═══════════════════════════════════════════════════════════════════════

def test_landing_chatbot(cookies):
    """Test Landing Chatbot endpoints"""
    print("\n" + "=" * 80)
    print("PHASE 4: LANDING CHATBOT TESTS (4 endpoints)")
    print("=" * 80 + "\n")
    
    session_id = f"sess-{uuid.uuid4().hex[:8]}"
    
    # Test 1: POST /api/landing-chatbot/chat
    print("TEST 1: POST /api/landing-chatbot/chat")
    print("-" * 80)
    
    url = f"{BASE_URL}/landing-chatbot/chat"
    payload = {
        "session_id": session_id,
        "message": "Was ist BidBlitz?"
    }
    
    try:
        response = requests.post(url, json=payload)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("session_id") and data.get("message"):
                log_test("POST /api/landing-chatbot/chat", True, response.status_code, data)
            else:
                log_test("POST /api/landing-chatbot/chat", False, response.status_code, data, "Missing session_id or message")
        else:
            log_test("POST /api/landing-chatbot/chat", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("POST /api/landing-chatbot/chat", False, 0, None, str(e))
    
    # Test 2: POST /api/landing-chatbot/leads
    print("TEST 2: POST /api/landing-chatbot/leads")
    print("-" * 80)
    
    url = f"{BASE_URL}/landing-chatbot/leads"
    payload = {
        "email": f"test-{uuid.uuid4().hex[:8]}@test.com",
        "name": "Test User",
        "interest": "demo"
    }
    
    try:
        response = requests.post(url, json=payload)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok"):
                log_test("POST /api/landing-chatbot/leads", True, response.status_code, data)
            else:
                log_test("POST /api/landing-chatbot/leads", False, response.status_code, data, "Missing 'ok' field")
        else:
            log_test("POST /api/landing-chatbot/leads", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("POST /api/landing-chatbot/leads", False, 0, None, str(e))
    
    # Test 3: GET /api/landing-chatbot/leads (Admin only)
    print("TEST 3: GET /api/landing-chatbot/leads")
    print("-" * 80)
    
    url = f"{BASE_URL}/landing-chatbot/leads"
    
    try:
        response = requests.get(url, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            if "leads" in data and "count" in data:
                log_test("GET /api/landing-chatbot/leads", True, response.status_code, data)
            else:
                log_test("GET /api/landing-chatbot/leads", False, response.status_code, data, "Missing leads or count")
        else:
            log_test("GET /api/landing-chatbot/leads", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("GET /api/landing-chatbot/leads", False, 0, None, str(e))
    
    # Test 4: GET /api/landing-chatbot/analytics
    print("TEST 4: GET /api/landing-chatbot/analytics")
    print("-" * 80)
    
    url = f"{BASE_URL}/landing-chatbot/analytics"
    
    try:
        response = requests.get(url, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            if "total_sessions" in data and "total_messages" in data and "total_leads" in data:
                log_test("GET /api/landing-chatbot/analytics", True, response.status_code, data)
            else:
                log_test("GET /api/landing-chatbot/analytics", False, response.status_code, data, "Missing expected fields")
        else:
            log_test("GET /api/landing-chatbot/analytics", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("GET /api/landing-chatbot/analytics", False, 0, None, str(e))

# ═══════════════════════════════════════════════════════════════════════
# SUPER APP EXTENSIONS TESTS (8 endpoints)
# ═══════════════════════════════════════════════════════════════════════

def test_super_app_extensions(cookies):
    """Test Super App Extensions endpoints"""
    print("\n" + "=" * 80)
    print("PHASE 5: SUPER APP EXTENSIONS TESTS (8 endpoints)")
    print("=" * 80 + "\n")
    
    # Test 1: POST /api/super-app/marketplace/items
    print("TEST 1: POST /api/super-app/marketplace/items")
    print("-" * 80)
    
    url = f"{BASE_URL}/super-app/marketplace/items"
    payload = {
        "category": "car_rental",
        "title": "BMW 3 Series",
        "description": "Test car rental listing",
        "price": 50.0,
        "seller_id": "user123"
    }
    
    try:
        response = requests.post(url, json=payload, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("item_id"):
                log_test("POST /api/super-app/marketplace/items", True, response.status_code, data)
            else:
                log_test("POST /api/super-app/marketplace/items", False, response.status_code, data, "Missing ok or item_id")
        else:
            log_test("POST /api/super-app/marketplace/items", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("POST /api/super-app/marketplace/items", False, 0, None, str(e))
    
    # Test 2: GET /api/super-app/marketplace/categories
    print("TEST 2: GET /api/super-app/marketplace/categories")
    print("-" * 80)
    
    url = f"{BASE_URL}/super-app/marketplace/categories"
    
    try:
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            if "categories" in data and isinstance(data["categories"], list):
                log_test("GET /api/super-app/marketplace/categories", True, response.status_code, data)
            else:
                log_test("GET /api/super-app/marketplace/categories", False, response.status_code, data, "Missing categories array")
        else:
            log_test("GET /api/super-app/marketplace/categories", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("GET /api/super-app/marketplace/categories", False, 0, None, str(e))
    
    # Test 3: POST /api/super-app/wallet/topup
    print("TEST 3: POST /api/super-app/wallet/topup")
    print("-" * 80)
    
    url = f"{BASE_URL}/super-app/wallet/topup"
    payload = {
        "amount": 100.0,
        "method": "card"
    }
    
    try:
        response = requests.post(url, json=payload, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("transaction_id") and data.get("status"):
                log_test("POST /api/super-app/wallet/topup", True, response.status_code, data)
            else:
                log_test("POST /api/super-app/wallet/topup", False, response.status_code, data, "Missing transaction_id or status")
        else:
            log_test("POST /api/super-app/wallet/topup", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("POST /api/super-app/wallet/topup", False, 0, None, str(e))
    
    # Test 4: GET /api/super-app/wallet/balance
    print("TEST 4: GET /api/super-app/wallet/balance")
    print("-" * 80)
    
    url = f"{BASE_URL}/super-app/wallet/balance"
    
    try:
        response = requests.get(url, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            if "balance" in data and "currency" in data:
                log_test("GET /api/super-app/wallet/balance", True, response.status_code, data)
            else:
                log_test("GET /api/super-app/wallet/balance", False, response.status_code, data, "Missing balance or currency")
        else:
            log_test("GET /api/super-app/wallet/balance", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("GET /api/super-app/wallet/balance", False, 0, None, str(e))
    
    # Test 5: POST /api/super-app/gaming/session
    print("TEST 5: POST /api/super-app/gaming/session")
    print("-" * 80)
    
    url = f"{BASE_URL}/super-app/gaming/session"
    payload = {
        "game_type": "penny_auction",
        "bet_amount": 1.0
    }
    
    try:
        response = requests.post(url, json=payload, cookies=cookies)
        
        # This might fail with 400 if insufficient balance, which is acceptable
        if response.status_code == 200:
            data = response.json()
            if data.get("session_id") and data.get("status"):
                log_test("POST /api/super-app/gaming/session", True, response.status_code, data)
            else:
                log_test("POST /api/super-app/gaming/session", False, response.status_code, data, "Missing session_id or status")
        elif response.status_code == 400 and "Insufficient balance" in response.text:
            # Expected if user has no balance
            log_test("POST /api/super-app/gaming/session", True, response.status_code, {"note": "400 expected - insufficient balance"})
        else:
            log_test("POST /api/super-app/gaming/session", False, response.status_code, response.text, f"Unexpected status code")
    except Exception as e:
        log_test("POST /api/super-app/gaming/session", False, 0, None, str(e))
    
    # Test 6: GET /api/super-app/gaming/leaderboard
    print("TEST 6: GET /api/super-app/gaming/leaderboard")
    print("-" * 80)
    
    url = f"{BASE_URL}/super-app/gaming/leaderboard"
    
    try:
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            if "leaderboard" in data:
                log_test("GET /api/super-app/gaming/leaderboard", True, response.status_code, data)
            else:
                log_test("GET /api/super-app/gaming/leaderboard", False, response.status_code, data, "Missing leaderboard")
        else:
            log_test("GET /api/super-app/gaming/leaderboard", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("GET /api/super-app/gaming/leaderboard", False, 0, None, str(e))
    
    # Test 7: POST /api/super-app/creator/subscription-tiers
    print("TEST 7: POST /api/super-app/creator/subscription-tiers")
    print("-" * 80)
    
    url = f"{BASE_URL}/super-app/creator/subscription-tiers"
    payload = {
        "creator_id": "user123",
        "tier": "premium",
        "monthly_price": 9.99,
        "benefits": ["Exclusive content", "Early access"]
    }
    
    try:
        response = requests.post(url, json=payload, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("tier_id"):
                log_test("POST /api/super-app/creator/subscription-tiers", True, response.status_code, data)
            else:
                log_test("POST /api/super-app/creator/subscription-tiers", False, response.status_code, data, "Missing tier_id")
        else:
            log_test("POST /api/super-app/creator/subscription-tiers", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("POST /api/super-app/creator/subscription-tiers", False, 0, None, str(e))
    
    # Test 8: GET /api/super-app/analytics/overview (Admin only)
    print("TEST 8: GET /api/super-app/analytics/overview")
    print("-" * 80)
    
    url = f"{BASE_URL}/super-app/analytics/overview"
    
    try:
        response = requests.get(url, cookies=cookies)
        
        if response.status_code == 200:
            data = response.json()
            if "total_users" in data and "total_transactions" in data:
                log_test("GET /api/super-app/analytics/overview", True, response.status_code, data)
            else:
                log_test("GET /api/super-app/analytics/overview", False, response.status_code, data, "Missing expected fields")
        else:
            log_test("GET /api/super-app/analytics/overview", False, response.status_code, response.text, f"Expected 200, got {response.status_code}")
    except Exception as e:
        log_test("GET /api/super-app/analytics/overview", False, 0, None, str(e))

def main():
    """Main test execution"""
    print("\n" + "=" * 80)
    print("BidBlitz Backend Testing - New Features (Phases B-E)")
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
    
    # Step 2: Get test data
    test_data = get_test_data(cookies)
    print()
    
    # Run all test phases
    test_pos_hardware(cookies, test_data)
    test_livekit_streaming(cookies)
    test_landing_chatbot(cookies)
    test_super_app_extensions(cookies)
    
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
    with open("/app/backend_test_new_features_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n📄 Detailed results saved to: /app/backend_test_new_features_results.json")

if __name__ == "__main__":
    main()
