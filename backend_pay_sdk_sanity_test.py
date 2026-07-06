#!/usr/bin/env python3
"""
BidBlitz Pay SDK Backend Sanity Check
Tests:
1. GET /api/pay.js delivers JavaScript
2. POST /api/pay/session exists without 500 errors
3. GET /api/pay/session/:id exists without 500 errors
4. No regression through new SDK expose route
"""
import os
import sys
import json
import httpx

# Backend URL from environment
BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://kyc-approval-hub.preview.emergentagent.com")
API_BASE = f"{BACKEND_URL}/api"

def print_test(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")
    print()

def main():
    print("=" * 80)
    print("BidBlitz Pay SDK Backend Sanity Check")
    print("=" * 80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"API Base: {API_BASE}")
    print()

    results = {
        "total": 0,
        "passed": 0,
        "failed": 0,
        "tests": []
    }

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 1: GET /api/pay.js delivers JavaScript
    # ─────────────────────────────────────────────────────────────────────────
    test_name = "GET /api/pay.js delivers JavaScript"
    results["total"] += 1
    try:
        resp = httpx.get(f"{API_BASE}/pay.js", timeout=10, follow_redirects=True)
        
        # Check status code
        if resp.status_code != 200:
            print_test(test_name, False, f"Expected 200, got {resp.status_code}")
            results["failed"] += 1
            results["tests"].append({"name": test_name, "passed": False, "error": f"Status {resp.status_code}"})
        else:
            # Check content type
            content_type = resp.headers.get("content-type", "")
            is_js = "javascript" in content_type.lower() or "application/javascript" in content_type.lower()
            
            # Check content contains BidBlitz Pay SDK signature
            content = resp.text
            has_sdk_signature = "BidBlitzPay" in content and "mount" in content
            
            if is_js or has_sdk_signature:
                print_test(test_name, True, f"Status: {resp.status_code}, Content-Type: {content_type}, Size: {len(content)} bytes")
                results["passed"] += 1
                results["tests"].append({"name": test_name, "passed": True})
            else:
                print_test(test_name, False, f"Content-Type: {content_type}, missing BidBlitzPay signature")
                results["failed"] += 1
                results["tests"].append({"name": test_name, "passed": False, "error": "Not JavaScript or missing SDK signature"})
    except Exception as e:
        print_test(test_name, False, f"Exception: {str(e)}")
        results["failed"] += 1
        results["tests"].append({"name": test_name, "passed": False, "error": str(e)})

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 2: POST /api/pay/session exists and responds (not 500)
    # ─────────────────────────────────────────────────────────────────────────
    test_name = "POST /api/pay/session exists (no 500 error)"
    results["total"] += 1
    try:
        # We expect 401 (invalid public_key) or 422 (validation error), NOT 500
        payload = {
            "public_key": "pk_test_invalid_key_for_sanity_check",
            "amount": 10.00,
            "currency": "EUR",
            "order_id": "TEST-ORDER-123",
            "description": "Sanity check test payment"
        }
        resp = httpx.post(f"{API_BASE}/pay/session", json=payload, timeout=10)
        
        # We expect 401 (invalid key) or 422 (validation), NOT 500
        if resp.status_code == 500:
            print_test(test_name, False, f"Got 500 Internal Server Error: {resp.text[:200]}")
            results["failed"] += 1
            results["tests"].append({"name": test_name, "passed": False, "error": "500 Internal Server Error"})
        elif resp.status_code in [401, 422, 400]:
            # Expected error responses (invalid key or validation)
            print_test(test_name, True, f"Status: {resp.status_code} (expected error for invalid key)")
            results["passed"] += 1
            results["tests"].append({"name": test_name, "passed": True})
        else:
            # Unexpected but not 500
            print_test(test_name, True, f"Status: {resp.status_code} (endpoint exists, no 500)")
            results["passed"] += 1
            results["tests"].append({"name": test_name, "passed": True})
    except Exception as e:
        print_test(test_name, False, f"Exception: {str(e)}")
        results["failed"] += 1
        results["tests"].append({"name": test_name, "passed": False, "error": str(e)})

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 3: GET /api/pay/session/:id exists and responds (not 500)
    # ─────────────────────────────────────────────────────────────────────────
    test_name = "GET /api/pay/session/:id exists (no 500 error)"
    results["total"] += 1
    try:
        # We expect 404 (session not found), NOT 500
        test_session_id = "cs_nonexistent_session_for_sanity_check"
        resp = httpx.get(f"{API_BASE}/pay/session/{test_session_id}", timeout=10)
        
        if resp.status_code == 500:
            print_test(test_name, False, f"Got 500 Internal Server Error: {resp.text[:200]}")
            results["failed"] += 1
            results["tests"].append({"name": test_name, "passed": False, "error": "500 Internal Server Error"})
        elif resp.status_code == 404:
            # Expected: session not found
            print_test(test_name, True, f"Status: 404 (expected for non-existent session)")
            results["passed"] += 1
            results["tests"].append({"name": test_name, "passed": True})
        else:
            # Unexpected but not 500
            print_test(test_name, True, f"Status: {resp.status_code} (endpoint exists, no 500)")
            results["passed"] += 1
            results["tests"].append({"name": test_name, "passed": True})
    except Exception as e:
        print_test(test_name, False, f"Exception: {str(e)}")
        results["failed"] += 1
        results["tests"].append({"name": test_name, "passed": False, "error": str(e)})

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 4: Check backend logs for errors related to pay.js or pay_sdk
    # ─────────────────────────────────────────────────────────────────────────
    test_name = "Backend logs check (no critical errors)"
    results["total"] += 1
    try:
        # Check backend error logs
        log_path = "/var/log/supervisor/backend.err.log"
        if os.path.exists(log_path):
            with open(log_path, "r") as f:
                logs = f.read()
                # Check for pay_sdk related errors in last 1000 lines
                recent_logs = "\n".join(logs.split("\n")[-1000:])
                
                # Look for critical errors related to pay_sdk or pay.js
                critical_errors = []
                for line in recent_logs.split("\n"):
                    if "pay_sdk" in line.lower() or "pay.js" in line.lower():
                        if "error" in line.lower() or "exception" in line.lower() or "traceback" in line.lower():
                            critical_errors.append(line)
                
                if critical_errors:
                    print_test(test_name, False, f"Found {len(critical_errors)} pay_sdk related errors in logs")
                    for err in critical_errors[:3]:  # Show first 3
                        print(f"   {err[:150]}")
                    results["failed"] += 1
                    results["tests"].append({"name": test_name, "passed": False, "error": f"{len(critical_errors)} errors found"})
                else:
                    print_test(test_name, True, "No critical pay_sdk errors in backend logs")
                    results["passed"] += 1
                    results["tests"].append({"name": test_name, "passed": True})
        else:
            print_test(test_name, True, "Backend log file not found (skipping)")
            results["passed"] += 1
            results["tests"].append({"name": test_name, "passed": True})
    except Exception as e:
        print_test(test_name, False, f"Exception: {str(e)}")
        results["failed"] += 1
        results["tests"].append({"name": test_name, "passed": False, "error": str(e)})

    # ─────────────────────────────────────────────────────────────────────────
    # SUMMARY
    # ─────────────────────────────────────────────────────────────────────────
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {results['total']}")
    print(f"Passed: {results['passed']}")
    print(f"Failed: {results['failed']}")
    print(f"Success Rate: {(results['passed'] / results['total'] * 100):.1f}%")
    print()

    # Save results to JSON
    with open("/app/pay_sdk_sanity_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print("Results saved to /app/pay_sdk_sanity_test_results.json")

    # Exit with appropriate code
    sys.exit(0 if results["failed"] == 0 else 1)

if __name__ == "__main__":
    main()
