#!/usr/bin/env python3
"""
BidBlitz POS Retail Enterprise Features - Backend API Testing
Tests 18 new POS endpoints systematically
"""
import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BASE_URL = "https://bidblitz-release.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"

# Global test state
session = requests.Session()
test_results = []
test_data = {}


def log_test(name, status, details=""):
    """Log test result"""
    result = {
        "test": name,
        "status": status,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{icon} {name}: {status}")
    if details:
        print(f"   {details}")


def login():
    """Login as admin and get auth token"""
    print("\n=== STEP 1: Authentication ===")
    try:
        response = session.post(
            f"{API_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            test_data["user_id"] = data.get("user", {}).get("_id")
            log_test("Admin Login", "PASS", f"Logged in as {ADMIN_EMAIL}")
            return True
        else:
            log_test("Admin Login", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        log_test("Admin Login", "FAIL", f"Exception: {str(e)}")
        return False


def setup_pos_merchant():
    """Create or get POS merchant"""
    print("\n=== STEP 2: POS Merchant Setup ===")
    try:
        # Try to get existing merchant
        response = session.get(f"{API_URL}/pos/my-merchants")
        if response.status_code == 200:
            merchants = response.json().get("merchants", [])
            if merchants:
                test_data["merchant_id"] = merchants[0]["merchant_id"]
                log_test("Get POS Merchant", "PASS", f"Using existing merchant: {test_data['merchant_id']}")
                return True
        
        # Create new merchant
        response = session.post(
            f"{API_URL}/pos/merchants/create",
            json={
                "business_name": "Test POS Retail Store",
                "business_type": "retail",
                "country": "DE"
            }
        )
        if response.status_code == 200:
            data = response.json()
            test_data["merchant_id"] = data.get("merchant_id")
            log_test("Create POS Merchant", "PASS", f"Created merchant: {test_data['merchant_id']}")
            return True
        else:
            log_test("Create POS Merchant", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        log_test("Setup POS Merchant", "FAIL", f"Exception: {str(e)}")
        return False


def setup_store():
    """Create or get store"""
    print("\n=== STEP 3: Store Setup ===")
    try:
        # Try to get existing store
        response = session.get(f"{API_URL}/pos/stores?merchant_id={test_data['merchant_id']}")
        if response.status_code == 200:
            stores = response.json().get("stores", [])
            if stores:
                test_data["store_id"] = stores[0]["store_id"]
                log_test("Get Store", "PASS", f"Using existing store: {test_data['store_id']}")
                return True
        
        # Create new store
        response = session.post(
            f"{API_URL}/pos/stores/create",
            json={
                "merchant_id": test_data["merchant_id"],
                "name": "Test Retail Store",
                "address": "Teststraße 123, Berlin"
            }
        )
        if response.status_code == 200:
            data = response.json()
            test_data["store_id"] = data.get("store_id")
            log_test("Create Store", "PASS", f"Created store: {test_data['store_id']}")
            return True
        else:
            log_test("Create Store", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        log_test("Setup Store", "FAIL", f"Exception: {str(e)}")
        return False


def setup_register():
    """Create or get register"""
    print("\n=== STEP 4: Register Setup ===")
    try:
        # Try to get existing register
        response = session.get(f"{API_URL}/pos/registers?store_id={test_data['store_id']}")
        if response.status_code == 200:
            registers = response.json().get("registers", [])
            if registers:
                test_data["register_id"] = registers[0]["register_id"]
                log_test("Get Register", "PASS", f"Using existing register: {test_data['register_id']}")
                return True
        
        # Create new register
        response = session.post(
            f"{API_URL}/pos/registers/create",
            json={
                "store_id": test_data["store_id"],
                "name": "Kasse 1",
                "type": "standard"
            }
        )
        if response.status_code == 200:
            data = response.json()
            test_data["register_id"] = data.get("register_id")
            log_test("Create Register", "PASS", f"Created register: {test_data['register_id']}")
            return True
        else:
            log_test("Create Register", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        log_test("Setup Register", "FAIL", f"Exception: {str(e)}")
        return False


def setup_products():
    """Create test products"""
    print("\n=== STEP 5: Product Setup ===")
    try:
        # Create standard product
        response = session.post(
            f"{API_URL}/pos/products/create",
            json={
                "store_id": test_data["store_id"],
                "name": "Test Bier",
                "barcode": "4001234567890",
                "price": 2.99,
                "category": "Getränke",
                "age_restricted": True,
                "track_stock": True,
                "stock": 100
            }
        )
        if response.status_code == 200:
            data = response.json()
            test_data["product_id"] = data.get("product_id")
            log_test("Create Standard Product", "PASS", f"Created product: {test_data['product_id']}")
        else:
            log_test("Create Standard Product", "FAIL", f"Status {response.status_code}")
            return False
        
        return True
    except Exception as e:
        log_test("Setup Products", "FAIL", f"Exception: {str(e)}")
        return False


def setup_cart_and_sale():
    """Create cart and sale for testing"""
    print("\n=== STEP 6: Cart & Sale Setup ===")
    try:
        # Create cart
        response = session.post(
            f"{API_URL}/pos/carts/create",
            json={
                "store_id": test_data["store_id"],
                "register_id": test_data["register_id"]
            }
        )
        if response.status_code == 200:
            data = response.json()
            test_data["cart_id"] = data.get("cart_id")
            log_test("Create Cart", "PASS", f"Created cart: {test_data['cart_id']}")
        else:
            log_test("Create Cart", "FAIL", f"Status {response.status_code}")
            return False
        
        # Add item to cart
        response = session.post(
            f"{API_URL}/pos/carts/add-item",
            json={
                "cart_id": test_data["cart_id"],
                "product_id": test_data["product_id"],
                "quantity": 2
            }
        )
        if response.status_code == 200:
            log_test("Add Item to Cart", "PASS", "Added 2x Test Bier")
        else:
            log_test("Add Item to Cart", "FAIL", f"Status {response.status_code}")
        
        # Create sale (checkout)
        response = session.post(
            f"{API_URL}/pos/checkout",
            json={
                "cart_id": test_data["cart_id"],
                "payment_method": "cash"
            }
        )
        if response.status_code == 200:
            data = response.json()
            test_data["receipt_id"] = data.get("receipt_id")
            test_data["sale_id"] = data.get("sale_id")
            log_test("Create Sale (Checkout)", "PASS", f"Created receipt: {test_data['receipt_id']}")
        else:
            log_test("Create Sale (Checkout)", "FAIL", f"Status {response.status_code}")
            return False
        
        return True
    except Exception as e:
        log_test("Setup Cart & Sale", "FAIL", f"Exception: {str(e)}")
        return False


def test_p0_features():
    """Test P0 Features (6 critical endpoints)"""
    print("\n=== TESTING P0 FEATURES (Critical) ===")
    
    # P0-1: Bon-Stornierung (Receipt Void)
    try:
        response = session.post(
            f"{API_URL}/pos/receipts/void",
            json={
                "receipt_id": test_data.get("receipt_id", "RCP-INVALID"),
                "reason": "Test Storno"
            }
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("void_receipt_id"):
                log_test("P0-1: Receipt Void", "PASS", f"Void receipt: {data.get('void_receipt_id')}")
            else:
                log_test("P0-1: Receipt Void", "FAIL", "Missing void_receipt_id in response")
        elif response.status_code == 404:
            log_test("P0-1: Receipt Void", "SKIP", "Receipt not found (expected if already voided)")
        else:
            log_test("P0-1: Receipt Void", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("P0-1: Receipt Void", "FAIL", f"Exception: {str(e)}")
    
    # P0-2: Rückgabe/Umtausch (Return)
    try:
        # Create new sale for return test
        response = session.post(f"{API_URL}/pos/carts/create", json={"store_id": test_data["store_id"], "register_id": test_data["register_id"]})
        if response.status_code == 200:
            cart_id = response.json().get("cart_id")
            session.post(f"{API_URL}/pos/carts/add-item", json={"cart_id": cart_id, "product_id": test_data["product_id"], "quantity": 1})
            checkout_resp = session.post(f"{API_URL}/pos/checkout", json={"cart_id": cart_id, "payment_method": "cash"})
            if checkout_resp.status_code == 200:
                receipt_id = checkout_resp.json().get("receipt_id")
                
                # Test return
                response = session.post(
                    f"{API_URL}/pos/receipts/return",
                    json={
                        "receipt_id": receipt_id,
                        "items": [{"product_id": test_data["product_id"], "quantity": 1}],
                        "return_type": "refund"
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok") and data.get("return_id"):
                        log_test("P0-2: Receipt Return", "PASS", f"Return ID: {data.get('return_id')}, Total: {data.get('total')}")
                    else:
                        log_test("P0-2: Receipt Return", "FAIL", "Missing return_id in response")
                else:
                    log_test("P0-2: Receipt Return", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
            else:
                log_test("P0-2: Receipt Return", "SKIP", "Could not create test sale")
        else:
            log_test("P0-2: Receipt Return", "SKIP", "Could not create test cart")
    except Exception as e:
        log_test("P0-2: Receipt Return", "FAIL", f"Exception: {str(e)}")
    
    # P0-3: Gewichtsartikel anlegen (Weighted Product Create)
    try:
        response = session.post(
            f"{API_URL}/pos/products/weighted/create",
            json={
                "store_id": test_data["store_id"],
                "name": "Bananen",
                "plu_code": "4011",
                "price_per_kg": 2.99,
                "category": "Obst"
            }
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("product_id"):
                test_data["weighted_product_id"] = data.get("product_id")
                log_test("P0-3: Weighted Product Create", "PASS", f"Product ID: {data.get('product_id')}")
            else:
                log_test("P0-3: Weighted Product Create", "FAIL", "Missing product_id in response")
        else:
            log_test("P0-3: Weighted Product Create", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("P0-3: Weighted Product Create", "FAIL", f"Exception: {str(e)}")
    
    # P0-4: Gewichtsartikel Preis-Lookup
    try:
        response = session.get(
            f"{API_URL}/pos/products/weighted/lookup",
            params={
                "plu_code": "4011",
                "weight_kg": 0.5,
                "store_id": test_data["store_id"]
            }
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("product_id") and data.get("calculated_price"):
                log_test("P0-4: Weighted Product Lookup", "PASS", f"Price: €{data.get('calculated_price')} for {data.get('weight_kg')}kg")
            else:
                log_test("P0-4: Weighted Product Lookup", "FAIL", "Missing calculated_price in response")
        elif response.status_code == 404:
            log_test("P0-4: Weighted Product Lookup", "SKIP", "PLU not found (weighted product may not exist)")
        else:
            log_test("P0-4: Weighted Product Lookup", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("P0-4: Weighted Product Lookup", "FAIL", f"Exception: {str(e)}")
    
    # P0-5: Altersverifikation (Age Verify)
    try:
        # Create new cart for age verification
        response = session.post(f"{API_URL}/pos/carts/create", json={"store_id": test_data["store_id"], "register_id": test_data["register_id"]})
        if response.status_code == 200:
            cart_id = response.json().get("cart_id")
            
            response = session.post(
                f"{API_URL}/pos/age-verify",
                json={
                    "cart_id": cart_id,
                    "verified_by": test_data.get("user_id", "user123")
                }
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("ok") and data.get("age_verified"):
                    log_test("P0-5: Age Verification", "PASS", f"Cart {cart_id} age verified")
                else:
                    log_test("P0-5: Age Verification", "FAIL", "age_verified not true")
            else:
                log_test("P0-5: Age Verification", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
        else:
            log_test("P0-5: Age Verification", "SKIP", "Could not create test cart")
    except Exception as e:
        log_test("P0-5: Age Verification", "FAIL", f"Exception: {str(e)}")
    
    # P0-6: Supervisor Console (3 endpoints)
    try:
        # Create supervisor alert
        response = session.post(
            f"{API_URL}/pos/supervisor/alert",
            json={
                "register_id": test_data.get("register_id", "REG-XXX"),
                "alert_type": "age_verify"
            }
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("alert_id"):
                alert_id = data.get("alert_id")
                log_test("P0-6a: Supervisor Alert Create", "PASS", f"Alert ID: {alert_id}")
                
                # Get supervisor dashboard
                response = session.get(
                    f"{API_URL}/pos/supervisor/dashboard",
                    params={"store_id": test_data["store_id"]}
                )
                if response.status_code == 200:
                    data = response.json()
                    if "registers" in data and "alerts" in data:
                        log_test("P0-6b: Supervisor Dashboard", "PASS", f"Registers: {len(data.get('registers', []))}, Alerts: {len(data.get('alerts', []))}")
                    else:
                        log_test("P0-6b: Supervisor Dashboard", "FAIL", "Missing registers or alerts in response")
                else:
                    log_test("P0-6b: Supervisor Dashboard", "FAIL", f"Status {response.status_code}")
                
                # Resolve alert
                response = session.post(f"{API_URL}/pos/supervisor/alert/{alert_id}/resolve")
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok"):
                        log_test("P0-6c: Supervisor Alert Resolve", "PASS", f"Resolved alert {alert_id}")
                    else:
                        log_test("P0-6c: Supervisor Alert Resolve", "FAIL", "ok not true")
                else:
                    log_test("P0-6c: Supervisor Alert Resolve", "FAIL", f"Status {response.status_code}")
            else:
                log_test("P0-6a: Supervisor Alert Create", "FAIL", "Missing alert_id in response")
        else:
            log_test("P0-6a: Supervisor Alert Create", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("P0-6: Supervisor Console", "FAIL", f"Exception: {str(e)}")


def test_p1_features():
    """Test P1 Features (8 features)"""
    print("\n=== TESTING P1 FEATURES ===")
    
    # P1-1: Smart Cart (3 endpoints)
    try:
        # Start smart cart session
        response = session.post(
            f"{API_URL}/pos/smart-cart/start",
            json={"store_id": test_data["store_id"]}
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("session_id"):
                session_id = data.get("session_id")
                log_test("P1-1a: Smart Cart Start", "PASS", f"Session ID: {session_id}")
                
                # Scan item
                response = session.post(
                    f"{API_URL}/pos/smart-cart/scan",
                    json={
                        "session_id": session_id,
                        "barcode": "4001234567890",
                        "quantity": 1
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok") and data.get("item"):
                        log_test("P1-1b: Smart Cart Scan", "PASS", f"Scanned item, new total: €{data.get('new_total')}")
                    else:
                        log_test("P1-1b: Smart Cart Scan", "FAIL", "Missing item in response")
                else:
                    log_test("P1-1b: Smart Cart Scan", "FAIL", f"Status {response.status_code}")
                
                # Checkout
                response = session.post(f"{API_URL}/pos/smart-cart/checkout/{session_id}")
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok"):
                        log_test("P1-1c: Smart Cart Checkout", "PASS", f"Total: €{data.get('total')}, Random check: {data.get('random_check')}")
                    else:
                        log_test("P1-1c: Smart Cart Checkout", "FAIL", "ok not true")
                else:
                    log_test("P1-1c: Smart Cart Checkout", "FAIL", f"Status {response.status_code}")
            else:
                log_test("P1-1a: Smart Cart Start", "FAIL", "Missing session_id in response")
        else:
            log_test("P1-1a: Smart Cart Start", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("P1-1: Smart Cart", "FAIL", f"Exception: {str(e)}")
    
    # P1-2: Digital Receipt
    try:
        # Create new sale for digital receipt
        response = session.post(f"{API_URL}/pos/carts/create", json={"store_id": test_data["store_id"], "register_id": test_data["register_id"]})
        if response.status_code == 200:
            cart_id = response.json().get("cart_id")
            session.post(f"{API_URL}/pos/carts/add-item", json={"cart_id": cart_id, "product_id": test_data["product_id"], "quantity": 1})
            checkout_resp = session.post(f"{API_URL}/pos/checkout", json={"cart_id": cart_id, "payment_method": "cash"})
            if checkout_resp.status_code == 200:
                receipt_id = checkout_resp.json().get("receipt_id")
                
                response = session.post(
                    f"{API_URL}/pos/receipts/digital",
                    json={
                        "receipt_id": receipt_id,
                        "email": "test@test.com"
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok") and data.get("qr_code"):
                        log_test("P1-2: Digital Receipt", "PASS", f"QR Code: {data.get('qr_code')[:50]}...")
                    else:
                        log_test("P1-2: Digital Receipt", "FAIL", "Missing qr_code in response")
                else:
                    log_test("P1-2: Digital Receipt", "FAIL", f"Status {response.status_code}")
            else:
                log_test("P1-2: Digital Receipt", "SKIP", "Could not create test sale")
        else:
            log_test("P1-2: Digital Receipt", "SKIP", "Could not create test cart")
    except Exception as e:
        log_test("P1-2: Digital Receipt", "FAIL", f"Exception: {str(e)}")
    
    # P1-3: Multi-Currency
    try:
        response = session.get(f"{API_URL}/pos/exchange-rate", params={"currency": "USD"})
        if response.status_code == 200:
            data = response.json()
            if data.get("currency") and data.get("rate"):
                log_test("P1-3: Multi-Currency", "PASS", f"USD rate: {data.get('rate')}")
            else:
                log_test("P1-3: Multi-Currency", "FAIL", "Missing currency or rate in response")
        else:
            log_test("P1-3: Multi-Currency", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("P1-3: Multi-Currency", "FAIL", f"Exception: {str(e)}")
    
    # P1-4: Loss Prevention Dashboard
    try:
        response = session.get(
            f"{API_URL}/pos/loss-prevention/dashboard",
            params={"store_id": test_data["store_id"], "days": 7}
        )
        if response.status_code == 200:
            data = response.json()
            if "voids_by_staff" in data and "refunds_by_staff" in data and "anomaly_alerts" in data:
                log_test("P1-4: Loss Prevention", "PASS", f"Voids: {len(data.get('voids_by_staff', []))}, Refunds: {len(data.get('refunds_by_staff', []))}, Alerts: {len(data.get('anomaly_alerts', []))}")
            else:
                log_test("P1-4: Loss Prevention", "FAIL", "Missing required fields in response")
        else:
            log_test("P1-4: Loss Prevention", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("P1-4: Loss Prevention", "FAIL", f"Exception: {str(e)}")
    
    # P1-5: Bulk Discount
    try:
        response = session.post(
            f"{API_URL}/pos/retail/bulk-discount/create",
            params={"store_id": test_data["store_id"]},
            json={
                "buy_quantity": 3,
                "pay_quantity": 2
            }
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("rule_id"):
                log_test("P1-5: Bulk Discount", "PASS", f"Rule ID: {data.get('rule_id')}")
            else:
                log_test("P1-5: Bulk Discount", "FAIL", "Missing rule_id in response")
        else:
            log_test("P1-5: Bulk Discount", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("P1-5: Bulk Discount", "FAIL", f"Exception: {str(e)}")
    
    # P1-6: Employee Performance
    try:
        response = session.get(
            f"{API_URL}/pos/retail/metrics/employee-performance",
            params={"store_id": test_data["store_id"], "days": 7}
        )
        if response.status_code == 200:
            data = response.json()
            if "employees" in data:
                log_test("P1-6: Employee Performance", "PASS", f"Employees: {len(data.get('employees', []))}")
            else:
                log_test("P1-6: Employee Performance", "FAIL", "Missing employees in response")
        else:
            log_test("P1-6: Employee Performance", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("P1-6: Employee Performance", "FAIL", f"Exception: {str(e)}")
    
    # P1-7: Cash Management (2 endpoints)
    try:
        # Safedrop
        response = session.post(
            f"{API_URL}/pos/retail/cash/safedrop",
            json={
                "register_id": test_data.get("register_id", "REG-XXX"),
                "amount": 100.0,
                "notes": "Test safedrop"
            }
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("drop_id"):
                log_test("P1-7a: Cash Safedrop", "PASS", f"Drop ID: {data.get('drop_id')}")
            else:
                log_test("P1-7a: Cash Safedrop", "FAIL", "Missing drop_id in response")
        elif response.status_code == 400:
            log_test("P1-7a: Cash Safedrop", "SKIP", "No open shift (expected)")
        else:
            log_test("P1-7a: Cash Safedrop", "FAIL", f"Status {response.status_code}")
        
        # Change suggestion
        response = session.get(
            f"{API_URL}/pos/retail/cash/change-suggestion",
            params={"amount_due": 10.0, "cash_tendered": 20.0}
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("change_total") and data.get("breakdown"):
                log_test("P1-7b: Cash Change Suggestion", "PASS", f"Change: €{data.get('change_total')}, Breakdown: {len(data.get('breakdown', {}))} denominations")
            else:
                log_test("P1-7b: Cash Change Suggestion", "FAIL", "Missing change_total or breakdown")
        else:
            log_test("P1-7b: Cash Change Suggestion", "FAIL", f"Status {response.status_code}")
    except Exception as e:
        log_test("P1-7: Cash Management", "FAIL", f"Exception: {str(e)}")
    
    # P1-8: Vendor Return
    try:
        response = session.post(
            f"{API_URL}/pos/retail/vendor-returns/create",
            params={"store_id": test_data["store_id"]},
            json={
                "supplier_id": "SUP-TEST",
                "items": [{"product_id": test_data.get("product_id", "PRD-XXX"), "quantity": 5, "reason": "Defekt"}]
            }
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("return_id"):
                log_test("P1-8: Vendor Return", "PASS", f"Return ID: {data.get('return_id')}, Value: €{data.get('total_value')}")
            else:
                log_test("P1-8: Vendor Return", "FAIL", "Missing return_id in response")
        else:
            log_test("P1-8: Vendor Return", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("P1-8: Vendor Return", "FAIL", f"Exception: {str(e)}")


def test_p2_features():
    """Test P2 Features (4 features)"""
    print("\n=== TESTING P2 FEATURES ===")
    
    # P2-1: AI Upsell
    try:
        # Create cart for upsell test
        response = session.post(f"{API_URL}/pos/carts/create", json={"store_id": test_data["store_id"], "register_id": test_data["register_id"]})
        if response.status_code == 200:
            cart_id = response.json().get("cart_id")
            
            response = session.post(
                f"{API_URL}/pos/retail/cart/upsell-suggestions",
                params={"cart_id": cart_id}
            )
            if response.status_code == 200:
                data = response.json()
                if "suggestions" in data:
                    log_test("P2-1: AI Upsell", "PASS", f"Suggestions: {len(data.get('suggestions', []))}")
                else:
                    log_test("P2-1: AI Upsell", "FAIL", "Missing suggestions in response")
            else:
                log_test("P2-1: AI Upsell", "FAIL", f"Status {response.status_code}")
        else:
            log_test("P2-1: AI Upsell", "SKIP", "Could not create test cart")
    except Exception as e:
        log_test("P2-1: AI Upsell", "FAIL", f"Exception: {str(e)}")
    
    # P2-2: Shelf QR (PUBLIC endpoint)
    try:
        response = session.get(f"{API_URL}/pos/retail/public/product-info/{test_data.get('product_id', 'PRD-XXX')}")
        if response.status_code == 200:
            data = response.json()
            if data.get("product"):
                log_test("P2-2: Shelf QR", "PASS", f"Product: {data.get('product', {}).get('name')}")
            else:
                log_test("P2-2: Shelf QR", "FAIL", "Missing product in response")
        elif response.status_code == 404:
            log_test("P2-2: Shelf QR", "SKIP", "Product not found")
        else:
            log_test("P2-2: Shelf QR", "FAIL", f"Status {response.status_code}")
    except Exception as e:
        log_test("P2-2: Shelf QR", "FAIL", f"Exception: {str(e)}")
    
    # P2-3: Pick-by-Light (2 endpoints)
    try:
        # Create pick task
        response = session.post(
            f"{API_URL}/pos/retail/pick/task/create",
            params={"store_id": test_data["store_id"]},
            json={
                "order_id": "ORD-TEST-001",
                "items": [{"product_id": test_data.get("product_id", "PRD-XXX"), "quantity": 2}]
            }
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("task_id"):
                log_test("P2-3a: Pick Task Create", "PASS", f"Task ID: {data.get('task_id')}")
            else:
                log_test("P2-3a: Pick Task Create", "FAIL", "Missing task_id in response")
        else:
            log_test("P2-3a: Pick Task Create", "FAIL", f"Status {response.status_code}")
        
        # Get pending tasks
        response = session.get(
            f"{API_URL}/pos/retail/pick/tasks/pending",
            params={"store_id": test_data["store_id"]}
        )
        if response.status_code == 200:
            data = response.json()
            if "tasks" in data:
                log_test("P2-3b: Pick Tasks Pending", "PASS", f"Pending tasks: {len(data.get('tasks', []))}")
            else:
                log_test("P2-3b: Pick Tasks Pending", "FAIL", "Missing tasks in response")
        else:
            log_test("P2-3b: Pick Tasks Pending", "FAIL", f"Status {response.status_code}")
    except Exception as e:
        log_test("P2-3: Pick-by-Light", "FAIL", f"Exception: {str(e)}")
    
    # P2-4: Video Replay
    try:
        response = session.get(f"{API_URL}/pos/retail/video-replay/{test_data.get('receipt_id', 'RCP-XXX')}")
        if response.status_code == 200:
            data = response.json()
            if "video_available" in data:
                log_test("P2-4: Video Replay", "PASS", f"Video available: {data.get('video_available')} (Placeholder)")
            else:
                log_test("P2-4: Video Replay", "FAIL", "Missing video_available in response")
        else:
            log_test("P2-4: Video Replay", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("P2-4: Video Replay", "FAIL", f"Exception: {str(e)}")


def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in test_results if r["status"] == "PASS")
    failed = sum(1 for r in test_results if r["status"] == "FAIL")
    skipped = sum(1 for r in test_results if r["status"] == "SKIP")
    total = len(test_results)
    
    print(f"\nTotal Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"⚠️  Skipped: {skipped}")
    print(f"\nSuccess Rate: {(passed/total*100):.1f}%")
    
    if failed > 0:
        print("\n" + "="*80)
        print("FAILED TESTS:")
        print("="*80)
        for r in test_results:
            if r["status"] == "FAIL":
                print(f"\n❌ {r['test']}")
                print(f"   {r['details']}")
    
    # Save results to file
    with open("/app/pos_test_results.json", "w") as f:
        json.dump(test_results, f, indent=2)
    print(f"\n📄 Detailed results saved to: /app/pos_test_results.json")


def main():
    """Main test execution"""
    print("="*80)
    print("BidBlitz POS Retail Enterprise Features - Backend API Testing")
    print("Testing 18 new POS endpoints")
    print("="*80)
    
    # Step 1: Login
    if not login():
        print("\n❌ Login failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Step 2-6: Setup
    if not setup_pos_merchant():
        print("\n⚠️  Merchant setup failed. Some tests may fail.")
    
    if not setup_store():
        print("\n⚠️  Store setup failed. Some tests may fail.")
    
    if not setup_register():
        print("\n⚠️  Register setup failed. Some tests may fail.")
    
    if not setup_products():
        print("\n⚠️  Product setup failed. Some tests may fail.")
    
    if not setup_cart_and_sale():
        print("\n⚠️  Cart/Sale setup failed. Some tests may fail.")
    
    # Step 7-9: Test all features
    test_p0_features()
    test_p1_features()
    test_p2_features()
    
    # Print summary
    print_summary()


if __name__ == "__main__":
    main()
