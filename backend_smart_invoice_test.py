#!/usr/bin/env python3
"""
Smart Invoice Backend Extension Testing
Tests the new Smart-Invoice-Backend-Erweiterung against https://biometric-checkout-7.preview.emergentagent.com
Focus: Real APIs and return structures for payment links, public pay URLs, QR values, PDF URLs, reminders, and checkout
"""

import json
import requests
from datetime import datetime

BASE_URL = "https://biometric-checkout-7.preview.emergentagent.com"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

def log_test(test_num, description, passed, details=""):
    """Log test result"""
    status = "✅ PASSED" if passed else "❌ FAILED"
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print(f"Status: {status}")
    if details:
        print(f"Details: {details}")
    print(f"{'='*80}")
    return passed

def admin_login():
    """Login as admin and return session cookies"""
    print(f"\n🔐 Logging in as {ADMIN_EMAIL}...")
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30
    )
    if response.status_code != 200:
        raise Exception(f"Admin login failed: {response.status_code} - {response.text}")
    
    cookies = response.cookies
    user_data = response.json()
    print(f"✅ Login successful - User: {user_data.get('email')}, Role: {user_data.get('role')}")
    return cookies

def test_my_invoices_structure(cookies):
    """
    TEST 1: GET /api/invoicing/my-invoices
    Should return invoices with payment_link_token, public_pay_url, qr_value, payment_pdf_url
    """
    response = requests.get(
        f"{BASE_URL}/api/invoicing/my-invoices",
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(1, "GET /api/invoicing/my-invoices", False, 
                       f"Expected 200, got {response.status_code}: {response.text}")
    
    data = response.json()
    invoices = data.get("invoices", [])
    
    if not invoices:
        return log_test(1, "GET /api/invoicing/my-invoices", False, 
                       "No invoices found - cannot verify structure")
    
    # Check first invoice for required fields
    first_invoice = invoices[0]
    required_fields = ["payment_link_token", "public_pay_url", "qr_value", "payment_pdf_url"]
    missing_fields = [field for field in required_fields if field not in first_invoice or not first_invoice[field]]
    
    if missing_fields:
        return log_test(1, "GET /api/invoicing/my-invoices", False, 
                       f"Missing or empty fields: {missing_fields}. Invoice: {json.dumps(first_invoice, indent=2)}")
    
    details = (
        f"Found {len(invoices)} invoices. First invoice structure verified:\n"
        f"  - payment_link_token: {first_invoice['payment_link_token'][:20]}...\n"
        f"  - public_pay_url: {first_invoice['public_pay_url']}\n"
        f"  - qr_value: {first_invoice['qr_value']}\n"
        f"  - payment_pdf_url: {first_invoice['payment_pdf_url']}\n"
        f"  - invoice_number: {first_invoice.get('invoice_number')}\n"
        f"  - total: €{first_invoice.get('total')}"
    )
    
    return log_test(1, "GET /api/invoicing/my-invoices", True, details), first_invoice

def test_payment_link_creation(cookies, invoice_id):
    """
    TEST 2: POST /api/invoicing/{invoice_id}/payment-link
    Should return token, public_url, share_links, pdf_url
    """
    response = requests.post(
        f"{BASE_URL}/api/invoicing/{invoice_id}/payment-link",
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(2, f"POST /api/invoicing/{invoice_id}/payment-link", False, 
                       f"Expected 200, got {response.status_code}: {response.text}")
    
    data = response.json()
    payment_link = data.get("payment_link", {})
    
    required_fields = ["token", "public_url", "share_links", "pdf_url"]
    missing_fields = [field for field in required_fields if field not in payment_link or not payment_link[field]]
    
    if missing_fields:
        return log_test(2, f"POST /api/invoicing/{invoice_id}/payment-link", False, 
                       f"Missing or empty fields: {missing_fields}. Response: {json.dumps(data, indent=2)}")
    
    # Verify share_links structure
    share_links = payment_link.get("share_links", {})
    required_share_fields = ["copy", "whatsapp", "sms", "email"]
    missing_share_fields = [field for field in required_share_fields if field not in share_links]
    
    if missing_share_fields:
        return log_test(2, f"POST /api/invoicing/{invoice_id}/payment-link", False, 
                       f"Missing share_links fields: {missing_share_fields}")
    
    details = (
        f"Payment link created successfully:\n"
        f"  - token: {payment_link['token'][:20]}...\n"
        f"  - public_url: {payment_link['public_url']}\n"
        f"  - pdf_url: {payment_link['pdf_url']}\n"
        f"  - share_links: copy, whatsapp, sms, email (all present)\n"
        f"  - qr_value: {payment_link.get('qr_value', 'N/A')}"
    )
    
    return log_test(2, f"POST /api/invoicing/{invoice_id}/payment-link", True, details), payment_link

def test_public_pay_endpoint(token):
    """
    TEST 3: GET /api/pay/{token}
    Public endpoint - should work WITHOUT authentication
    """
    response = requests.get(
        f"{BASE_URL}/api/pay/{token}",
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(3, f"GET /api/pay/{token} (public, no auth)", False, 
                       f"Expected 200, got {response.status_code}: {response.text}")
    
    data = response.json()
    
    # Verify essential fields
    required_fields = ["invoice_id", "invoice_number", "total", "status", "payment_link", "available_methods"]
    missing_fields = [field for field in required_fields if field not in data]
    
    if missing_fields:
        return log_test(3, f"GET /api/pay/{token} (public, no auth)", False, 
                       f"Missing fields: {missing_fields}")
    
    details = (
        f"Public payment link accessible without auth:\n"
        f"  - invoice_number: {data.get('invoice_number')}\n"
        f"  - total: €{data.get('total')}\n"
        f"  - status: {data.get('status')}\n"
        f"  - available_methods: {data.get('available_methods')}\n"
        f"  - merchant_name: {data.get('merchant_name', 'N/A')}"
    )
    
    return log_test(3, f"GET /api/pay/{token} (public, no auth)", True, details)

def test_payment_pdf_endpoint(cookies, invoice_id):
    """
    TEST 4: GET /api/invoicing/{invoice_id}/payment-pdf
    Should return PDF file
    """
    response = requests.get(
        f"{BASE_URL}/api/invoicing/{invoice_id}/payment-pdf",
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(4, f"GET /api/invoicing/{invoice_id}/payment-pdf", False, 
                       f"Expected 200, got {response.status_code}: {response.text}")
    
    # Verify content type is PDF
    content_type = response.headers.get("Content-Type", "")
    if "application/pdf" not in content_type:
        return log_test(4, f"GET /api/invoicing/{invoice_id}/payment-pdf", False, 
                       f"Expected Content-Type: application/pdf, got: {content_type}")
    
    # Verify PDF content
    pdf_content = response.content
    if not pdf_content or len(pdf_content) < 100:
        return log_test(4, f"GET /api/invoicing/{invoice_id}/payment-pdf", False, 
                       f"PDF content too small or empty: {len(pdf_content)} bytes")
    
    # Check PDF magic bytes
    if not pdf_content.startswith(b'%PDF'):
        return log_test(4, f"GET /api/invoicing/{invoice_id}/payment-pdf", False, 
                       "Response is not a valid PDF (missing %PDF header)")
    
    details = (
        f"PDF generated successfully:\n"
        f"  - Content-Type: {content_type}\n"
        f"  - Size: {len(pdf_content)} bytes\n"
        f"  - Valid PDF header: ✅\n"
        f"  - Content-Disposition: {response.headers.get('Content-Disposition', 'N/A')}"
    )
    
    return log_test(4, f"GET /api/invoicing/{invoice_id}/payment-pdf", True, details)

def test_reminder_email_validation(cookies, invoice_id, invoice_data):
    """
    TEST 5: POST /api/invoicing/{invoice_id}/reminders/email
    kind=manual should validate client_email and save history
    """
    # First, check if invoice has client_email
    client_email = invoice_data.get("client_email")
    
    if not client_email:
        # Test with invoice without client_email - should return 400
        response = requests.post(
            f"{BASE_URL}/api/invoicing/{invoice_id}/reminders/email",
            json={"kind": "manual"},
            cookies=cookies,
            timeout=30
        )
        
        if response.status_code != 400:
            return log_test(5, f"POST /api/invoicing/{invoice_id}/reminders/email (validation)", False, 
                           f"Expected 400 for missing client_email, got {response.status_code}")
        
        details = "Validation working: Returns 400 when client_email is missing ✅"
        return log_test(5, f"POST /api/invoicing/{invoice_id}/reminders/email (validation)", True, details)
    
    # Test with valid client_email
    response = requests.post(
        f"{BASE_URL}/api/invoicing/{invoice_id}/reminders/email",
        json={"kind": "manual"},
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(5, f"POST /api/invoicing/{invoice_id}/reminders/email (kind=manual)", False, 
                       f"Expected 200, got {response.status_code}: {response.text}")
    
    data = response.json()
    
    # Verify response structure
    required_fields = ["ok", "history", "payment_link"]
    missing_fields = [field for field in required_fields if field not in data]
    
    if missing_fields:
        return log_test(5, f"POST /api/invoicing/{invoice_id}/reminders/email (kind=manual)", False, 
                       f"Missing fields: {missing_fields}")
    
    # Verify history structure
    history = data.get("history", {})
    required_history_fields = ["id", "invoice_id", "client_email", "kind", "channel", "sent_at"]
    missing_history_fields = [field for field in required_history_fields if field not in history]
    
    if missing_history_fields:
        return log_test(5, f"POST /api/invoicing/{invoice_id}/reminders/email (kind=manual)", False, 
                       f"Missing history fields: {missing_history_fields}")
    
    # Verify kind is 'manual'
    if history.get("kind") != "manual":
        return log_test(5, f"POST /api/invoicing/{invoice_id}/reminders/email (kind=manual)", False, 
                       f"Expected kind='manual', got: {history.get('kind')}")
    
    details = (
        f"Reminder email sent and history saved:\n"
        f"  - client_email validated: {history.get('client_email')}\n"
        f"  - kind: {history.get('kind')}\n"
        f"  - channel: {history.get('channel')}\n"
        f"  - sent_at: {history.get('sent_at')}\n"
        f"  - payment_link: {data.get('payment_link', 'N/A')[:50]}...\n"
        f"  - history_id: {history.get('id')}"
    )
    
    return log_test(5, f"POST /api/invoicing/{invoice_id}/reminders/email (kind=manual)", True, details)

def test_checkout_session_creation(token):
    """
    TEST 6: POST /api/pay/{token}/checkout
    method=stripe should create session WITHOUT authentication
    """
    response = requests.post(
        f"{BASE_URL}/api/pay/{token}/checkout",
        json={
            "method": "stripe",
            "origin_url": BASE_URL,
            "payer_email": "test@example.com"
        },
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(6, f"POST /api/pay/{token}/checkout (method=stripe, no auth)", False, 
                       f"Expected 200, got {response.status_code}: {response.text}")
    
    data = response.json()
    
    # Verify response structure
    required_fields = ["ok", "method", "session_id", "checkout_url"]
    missing_fields = [field for field in required_fields if field not in data]
    
    if missing_fields:
        return log_test(6, f"POST /api/pay/{token}/checkout (method=stripe, no auth)", False, 
                       f"Missing fields: {missing_fields}")
    
    # Verify method is stripe
    if data.get("method") != "stripe":
        return log_test(6, f"POST /api/pay/{token}/checkout (method=stripe, no auth)", False, 
                       f"Expected method='stripe', got: {data.get('method')}")
    
    # Verify checkout_url is a valid Stripe URL
    checkout_url = data.get("checkout_url", "")
    if not checkout_url.startswith("https://checkout.stripe.com"):
        return log_test(6, f"POST /api/pay/{token}/checkout (method=stripe, no auth)", False, 
                       f"Invalid Stripe checkout URL: {checkout_url}")
    
    details = (
        f"Stripe checkout session created without auth:\n"
        f"  - method: {data.get('method')}\n"
        f"  - session_id: {data.get('session_id')}\n"
        f"  - checkout_url: {checkout_url[:60]}...\n"
        f"  - ok: {data.get('ok')}"
    )
    
    return log_test(6, f"POST /api/pay/{token}/checkout (method=stripe, no auth)", True, details)

def main():
    """Run all Smart Invoice backend tests"""
    print("\n" + "="*80)
    print("SMART INVOICE BACKEND EXTENSION TESTING")
    print(f"Target: {BASE_URL}")
    print(f"Credentials: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    print(f"Started: {datetime.now().isoformat()}")
    print("="*80)
    
    results = []
    
    try:
        # Login
        cookies = admin_login()
        
        # TEST 1: GET /api/invoicing/my-invoices
        result1, first_invoice = test_my_invoices_structure(cookies)
        results.append(result1)
        
        if not result1:
            print("\n❌ Cannot proceed with further tests - my-invoices endpoint failed")
            return
        
        invoice_id = first_invoice.get("invoice_id")
        
        # TEST 2: POST /api/invoicing/{invoice_id}/payment-link
        result2, payment_link = test_payment_link_creation(cookies, invoice_id)
        results.append(result2)
        
        if not result2:
            print("\n⚠️ Payment link creation failed - using token from my-invoices for remaining tests")
            token = first_invoice.get("payment_link_token")
        else:
            token = payment_link.get("token")
        
        # TEST 3: GET /api/pay/{token} (public, no auth)
        result3 = test_public_pay_endpoint(token)
        results.append(result3)
        
        # TEST 4: GET /api/invoicing/{invoice_id}/payment-pdf
        result4 = test_payment_pdf_endpoint(cookies, invoice_id)
        results.append(result4)
        
        # TEST 5: POST /api/invoicing/{invoice_id}/reminders/email
        result5 = test_reminder_email_validation(cookies, invoice_id, first_invoice)
        results.append(result5)
        
        # TEST 6: POST /api/pay/{token}/checkout (method=stripe, no auth)
        result6 = test_checkout_session_creation(token)
        results.append(result6)
        
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        results.append(False)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"Passed: {passed}/{total} ({(passed/total*100):.1f}%)")
    print(f"Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED - Smart Invoice Backend Extension is working correctly!")
    else:
        print(f"\n⚠️ {total - passed} TEST(S) FAILED - See details above")
    
    print("="*80)
    
    # Save results
    results_data = {
        "timestamp": datetime.now().isoformat(),
        "base_url": BASE_URL,
        "total_tests": total,
        "passed": passed,
        "failed": total - passed,
        "success_rate": f"{(passed/total*100):.1f}%",
        "tests": {
            "test_1_my_invoices": results[0] if len(results) > 0 else False,
            "test_2_payment_link": results[1] if len(results) > 1 else False,
            "test_3_public_pay": results[2] if len(results) > 2 else False,
            "test_4_payment_pdf": results[3] if len(results) > 3 else False,
            "test_5_reminder_email": results[4] if len(results) > 4 else False,
            "test_6_checkout_session": results[5] if len(results) > 5 else False,
        }
    }
    
    with open("/app/smart_invoice_test_results.json", "w") as f:
        json.dump(results_data, f, indent=2)
    
    print(f"\nTest results saved to: /app/smart_invoice_test_results.json")

if __name__ == "__main__":
    main()
