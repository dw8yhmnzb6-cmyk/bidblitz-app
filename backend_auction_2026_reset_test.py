#!/usr/bin/env python3
"""
Backend Test: 2026 Auction Reset - Final Dedicated Check
Testing against: https://biometric-checkout-7.preview.emergentagent.com

Focus:
1. GET /api/auctions/active returns exactly 30 active auctions
2. All titles contain "2026"
3. All ends_at are at 18:00 UTC and distributed over 3/4/5 days
4. GET /api/auctions, /api/auctions/list, /api/auctions/feed work without old non-2026 products
5. GET /api/commerce-center/overview continues to show 30 Penny auctions
"""

import requests
import json
from datetime import datetime, timezone
from collections import Counter

BASE_URL = "https://biometric-checkout-7.preview.emergentagent.com"

def test_active_auctions():
    """Test 1: GET /api/auctions/active returns exactly 30 active auctions with 2026 products"""
    print("\n" + "="*80)
    print("TEST 1: GET /api/auctions/active - Exactly 30 Active Auctions")
    print("="*80)
    
    response = requests.get(f"{BASE_URL}/api/auctions/active")
    print(f"Status Code: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {response.status_code}")
        print(f"Response: {response.text[:500]}")
        return False
    
    data = response.json()
    auctions = data.get("auctions", [])
    count = data.get("count", 0)
    
    print(f"Auctions Count: {len(auctions)}")
    print(f"Count Field: {count}")
    
    if len(auctions) != 30:
        print(f"❌ FAILED: Expected exactly 30 auctions, got {len(auctions)}")
        return False
    
    if count != 30:
        print(f"❌ FAILED: Count field should be 30, got {count}")
        return False
    
    print("✅ PASSED: Exactly 30 active auctions returned")
    
    # Check first 5 auction titles
    print("\nFirst 5 Auction Titles:")
    for i, auction in enumerate(auctions[:5], 1):
        title = auction.get("title", "")
        print(f"  {i}. {title}")
    
    return True, auctions


def test_all_titles_contain_2026(auctions):
    """Test 2: All auction titles contain '2026'"""
    print("\n" + "="*80)
    print("TEST 2: All Titles Contain '2026'")
    print("="*80)
    
    non_2026_auctions = []
    for auction in auctions:
        title = auction.get("title", "")
        if "2026" not in title:
            non_2026_auctions.append(title)
    
    if non_2026_auctions:
        print(f"❌ FAILED: Found {len(non_2026_auctions)} auctions without '2026' in title:")
        for title in non_2026_auctions[:10]:
            print(f"  - {title}")
        return False
    
    print(f"✅ PASSED: All {len(auctions)} auctions contain '2026' in title")
    return True


def test_ends_at_18_utc_and_distribution(auctions):
    """Test 3: All ends_at are at 18:00 UTC and distributed over 3/4/5 days"""
    print("\n" + "="*80)
    print("TEST 3: All ends_at at 18:00 UTC and Distributed Over 3/4/5 Days")
    print("="*80)
    
    invalid_times = []
    dates = []
    
    for auction in auctions:
        ends_at = auction.get("ends_at", "")
        if not ends_at:
            invalid_times.append(f"{auction.get('title', 'Unknown')}: No ends_at field")
            continue
        
        try:
            dt = datetime.fromisoformat(ends_at.replace("Z", "+00:00"))
            
            # Check if time is 18:00 UTC
            if dt.hour != 18 or dt.minute != 0:
                invalid_times.append(f"{auction.get('title', 'Unknown')}: {dt.strftime('%H:%M UTC')} (expected 18:00 UTC)")
            
            # Collect date for distribution check
            dates.append(dt.date())
            
        except Exception as e:
            invalid_times.append(f"{auction.get('title', 'Unknown')}: Invalid datetime format - {e}")
    
    if invalid_times:
        print(f"❌ FAILED: Found {len(invalid_times)} auctions with invalid times:")
        for error in invalid_times[:10]:
            print(f"  - {error}")
        return False
    
    print(f"✅ PASSED: All {len(auctions)} auctions have ends_at at 18:00 UTC")
    
    # Check date distribution
    unique_dates = sorted(set(dates))
    date_counts = Counter(dates)
    
    print(f"\nDate Distribution:")
    print(f"  Unique Days: {len(unique_dates)}")
    for date in unique_dates:
        count = date_counts[date]
        print(f"  - {date}: {count} auctions")
    
    if len(unique_dates) < 3 or len(unique_dates) > 5:
        print(f"❌ FAILED: Expected 3-5 unique days, got {len(unique_dates)}")
        return False
    
    print(f"✅ PASSED: Auctions distributed over {len(unique_dates)} days (within 3-5 range)")
    return True


def test_no_old_products_in_endpoints():
    """Test 4: GET /api/auctions, /api/auctions/list, /api/auctions/feed work without old non-2026 products"""
    print("\n" + "="*80)
    print("TEST 4: No Old Non-2026 Products in Active Results")
    print("="*80)
    
    endpoints = [
        "/api/auctions",
        "/api/auctions/list",
        "/api/auctions/feed"
    ]
    
    all_passed = True
    
    for endpoint in endpoints:
        print(f"\nTesting {endpoint}...")
        response = requests.get(f"{BASE_URL}{endpoint}")
        
        if response.status_code != 200:
            print(f"  ❌ FAILED: Status {response.status_code}")
            all_passed = False
            continue
        
        data = response.json()
        auctions = data.get("auctions", [])
        
        # Filter only active auctions
        active_auctions = [a for a in auctions if a.get("status") == "active"]
        
        print(f"  Total auctions: {len(auctions)}")
        print(f"  Active auctions: {len(active_auctions)}")
        
        # Check for non-2026 products in active auctions
        non_2026_active = []
        for auction in active_auctions:
            title = auction.get("title", "")
            if "2026" not in title:
                non_2026_active.append(title)
        
        if non_2026_active:
            print(f"  ❌ FAILED: Found {len(non_2026_active)} active auctions without '2026':")
            for title in non_2026_active[:5]:
                print(f"    - {title}")
            all_passed = False
        else:
            print(f"  ✅ PASSED: All {len(active_auctions)} active auctions contain '2026'")
    
    return all_passed


def test_commerce_center_overview():
    """Test 5: GET /api/commerce-center/overview shows 30 Penny auctions"""
    print("\n" + "="*80)
    print("TEST 5: GET /api/commerce-center/overview - 30 Penny Auctions")
    print("="*80)
    
    response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
    print(f"Status Code: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {response.status_code}")
        print(f"Response: {response.text[:500]}")
        return False
    
    data = response.json()
    stats = data.get("stats", {})
    penny_auctions = data.get("penny_auctions", [])
    
    active_penny_count = stats.get("active_penny_auctions", 0)
    
    print(f"Stats - active_penny_auctions: {active_penny_count}")
    print(f"Penny Auctions Array Length: {len(penny_auctions)}")
    
    if active_penny_count != 30:
        print(f"❌ FAILED: Expected active_penny_auctions=30, got {active_penny_count}")
        return False
    
    print(f"✅ PASSED: Commerce Center shows {active_penny_count} Penny auctions")
    
    # Show first 3 penny auction titles
    print("\nFirst 3 Penny Auction Titles:")
    for i, auction in enumerate(penny_auctions[:3], 1):
        title = auction.get("title", "")
        price = auction.get("current_price", 0)
        print(f"  {i}. {title} - €{price:.2f}")
    
    return True


def main():
    print("="*80)
    print("BACKEND TEST: 2026 AUCTION RESET - FINAL DEDICATED CHECK")
    print("="*80)
    print(f"Testing against: {BASE_URL}")
    print(f"Test Time: {datetime.now(timezone.utc).isoformat()}")
    
    results = {}
    
    # Test 1: Active auctions count
    test1_result = test_active_auctions()
    if isinstance(test1_result, tuple):
        results["test1_active_auctions"] = test1_result[0]
        auctions = test1_result[1]
    else:
        results["test1_active_auctions"] = test1_result
        auctions = []
    
    # Test 2: All titles contain 2026
    if auctions:
        results["test2_titles_2026"] = test_all_titles_contain_2026(auctions)
    else:
        print("\n⚠️ SKIPPED TEST 2: No auctions to test")
        results["test2_titles_2026"] = False
    
    # Test 3: ends_at at 18:00 UTC and distribution
    if auctions:
        results["test3_ends_at_18utc"] = test_ends_at_18_utc_and_distribution(auctions)
    else:
        print("\n⚠️ SKIPPED TEST 3: No auctions to test")
        results["test3_ends_at_18utc"] = False
    
    # Test 4: No old products in endpoints
    results["test4_no_old_products"] = test_no_old_products_in_endpoints()
    
    # Test 5: Commerce Center overview
    results["test5_commerce_center"] = test_commerce_center_overview()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({int(passed/total*100)}% success rate)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - 2026 Auction Reset is PRODUCTION-READY")
    else:
        print(f"\n⚠️ {total - passed} test(s) failed - Review required")
    
    # Save results
    with open("/app/auction_2026_reset_test_results.json", "w") as f:
        json.dump({
            "test_time": datetime.now(timezone.utc).isoformat(),
            "base_url": BASE_URL,
            "results": results,
            "passed": passed,
            "total": total,
            "success_rate": f"{int(passed/total*100)}%"
        }, f, indent=2)
    
    print(f"\nTest results saved to /app/auction_2026_reset_test_results.json")
    
    return passed == total


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
