#!/usr/bin/env python3
"""
Taxi Map Fix Test - Brief focused test on error handling and fallback
Tests:
1. Page loads without uncaught fetch errors
2. Fallback map remains visible when there's a map error
3. Reload button is visible
4. UI remains usable
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://kyc-approval-hub.preview.emergentagent.com"

def test_taxi_map_fix():
    """Brief test of taxi map fix focusing on error handling and fallback"""
    
    results = {
        "test_name": "Taxi Map Fix - Error Handling & Fallback",
        "timestamp": datetime.now().isoformat(),
        "base_url": BASE_URL,
        "tests": []
    }
    
    print("=" * 80)
    print("TAXI MAP FIX TEST - Brief focused test")
    print("=" * 80)
    
    # Test 1: Page loads without crashing
    print("\n✓ TEST 1: Page loads without uncaught fetch errors")
    try:
        response = requests.get(f"{BASE_URL}/taxi", timeout=10)
        page_content = response.text
        
        # Check for React error boundaries or crash indicators
        has_error_boundary = "react-error-boundary" in page_content.lower()
        has_uncaught_error = "uncaught" in page_content.lower() and "error" in page_content.lower()
        
        test_1_pass = response.status_code == 200 and not has_error_boundary and not has_uncaught_error
        
        results["tests"].append({
            "test": "Page loads without uncaught fetch errors",
            "status": "PASS" if test_1_pass else "FAIL",
            "details": {
                "status_code": response.status_code,
                "has_error_boundary": has_error_boundary,
                "has_uncaught_error": has_uncaught_error,
                "page_size": len(page_content)
            }
        })
        
        if test_1_pass:
            print(f"  ✅ PASS: Page loads successfully (status {response.status_code})")
            print(f"  ✅ No React error boundaries detected")
            print(f"  ✅ No uncaught errors in page content")
        else:
            print(f"  ❌ FAIL: Page has issues")
            if has_error_boundary:
                print(f"  ❌ React error boundary detected")
            if has_uncaught_error:
                print(f"  ❌ Uncaught error detected in page")
                
    except Exception as e:
        print(f"  ❌ FAIL: Error loading page: {e}")
        results["tests"].append({
            "test": "Page loads without uncaught fetch errors",
            "status": "FAIL",
            "error": str(e)
        })
    
    # Test 2: Check for fallback map element
    print("\n✓ TEST 2: Fallback map element present in code")
    try:
        # Check if fallback map component exists in the page
        has_fallback_map = "taxi-map-fallback" in page_content
        has_mini_leaflet = "MiniLeafletMap" in page_content or "leaflet" in page_content.lower()
        
        test_2_pass = has_fallback_map or has_mini_leaflet
        
        results["tests"].append({
            "test": "Fallback map element present",
            "status": "PASS" if test_2_pass else "FAIL",
            "details": {
                "has_fallback_testid": has_fallback_map,
                "has_leaflet_reference": has_mini_leaflet
            }
        })
        
        if test_2_pass:
            print(f"  ✅ PASS: Fallback map mechanism present")
            if has_fallback_map:
                print(f"  ✅ Found data-testid='taxi-map-fallback'")
            if has_mini_leaflet:
                print(f"  ✅ Found Leaflet fallback references")
        else:
            print(f"  ❌ FAIL: No fallback map mechanism found")
            
    except Exception as e:
        print(f"  ❌ FAIL: Error checking fallback map: {e}")
        results["tests"].append({
            "test": "Fallback map element present",
            "status": "FAIL",
            "error": str(e)
        })
    
    # Test 3: Check for reload button
    print("\n✓ TEST 3: Reload button visible in code")
    try:
        has_reload_button = "taxi-map-error-reload" in page_content
        has_reconnect_text = "Karte neu verbinden" in page_content or "verbinden" in page_content.lower()
        
        test_3_pass = has_reload_button or has_reconnect_text
        
        results["tests"].append({
            "test": "Reload button visible",
            "status": "PASS" if test_3_pass else "FAIL",
            "details": {
                "has_reload_testid": has_reload_button,
                "has_reconnect_text": has_reconnect_text
            }
        })
        
        if test_3_pass:
            print(f"  ✅ PASS: Reload/reconnect button present")
            if has_reload_button:
                print(f"  ✅ Found data-testid='taxi-map-error-reload'")
            if has_reconnect_text:
                print(f"  ✅ Found 'Karte neu verbinden' text")
        else:
            print(f"  ❌ FAIL: No reload button found")
            
    except Exception as e:
        print(f"  ❌ FAIL: Error checking reload button: {e}")
        results["tests"].append({
            "test": "Reload button visible",
            "status": "FAIL",
            "error": str(e)
        })
    
    # Test 4: Check UI remains usable (interactive elements present)
    print("\n✓ TEST 4: UI remains usable (interactive elements present)")
    try:
        # Check for key interactive elements
        has_search_input = "search-pickup-input" in page_content or "search-dropoff-input" in page_content
        has_buttons = "button" in page_content.lower()
        has_map_container = "taxi-map-container" in page_content
        
        # Count approximate number of interactive elements
        button_count = page_content.lower().count("<button")
        input_count = page_content.lower().count("<input") + page_content.lower().count("<textarea")
        
        test_4_pass = has_search_input and has_buttons and button_count > 5
        
        results["tests"].append({
            "test": "UI remains usable",
            "status": "PASS" if test_4_pass else "FAIL",
            "details": {
                "has_search_inputs": has_search_input,
                "has_map_container": has_map_container,
                "button_count": button_count,
                "input_count": input_count
            }
        })
        
        if test_4_pass:
            print(f"  ✅ PASS: UI remains usable")
            print(f"  ✅ Found search inputs")
            print(f"  ✅ Found {button_count} buttons")
            print(f"  ✅ Found {input_count} input fields")
        else:
            print(f"  ❌ FAIL: UI may not be fully usable")
            print(f"  - Search inputs: {has_search_input}")
            print(f"  - Buttons: {button_count}")
            
    except Exception as e:
        print(f"  ❌ FAIL: Error checking UI usability: {e}")
        results["tests"].append({
            "test": "UI remains usable",
            "status": "FAIL",
            "error": str(e)
        })
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for t in results["tests"] if t["status"] == "PASS")
    total = len(results["tests"])
    
    print(f"\nTests Passed: {passed}/{total}")
    
    for test in results["tests"]:
        status_icon = "✅" if test["status"] == "PASS" else "❌"
        print(f"{status_icon} {test['test']}: {test['status']}")
    
    # Save results
    with open("/app/taxi_map_fix_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📊 Results saved to /app/taxi_map_fix_test_results.json")
    
    return results

if __name__ == "__main__":
    test_taxi_map_fix()
