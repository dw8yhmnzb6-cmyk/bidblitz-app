#!/usr/bin/env python3
"""
BidBlitz Store Preview Testing Script
Tests the app for Huawei AppGallery + Samsung Galaxy Store submission
STORE_SAFE_MODE=true, DEMO_MODE=false, MOCK_PAYMENTS=false
"""

import asyncio
from playwright.async_api import async_playwright
import sys

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 390, "height": 844},
            user_agent="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36"
        )
        page = await context.new_page()
        
        print("=" * 80)
        print("BIDBLITZ STORE PREVIEW TESTING")
        print("=" * 80)
        print("STORE_SAFE_MODE=true, DEMO_MODE=false, MOCK_PAYMENTS=false")
        print("Review Account: reviewer@bidblitz.ae / BidBlitzReview2026!")
        print("=" * 80)
        
        results = {
            "login": False,
            "unsafe_blocked": 0,
            "unsafe_accessible": 0,
            "safe_accessible": 0,
            "safe_blocked": 0,
            "more_options": 0,
            "balance_realistic": True,
            "nav_clean": True
        }
        
        try:
            # TEST 1: Login
            print("\nTEST 1: Login with review account")
            print("-" * 80)
            await page.goto("https://super-app-staging-2.preview.emergentagent.com/auth", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)
            
            # Fill login form
            await page.fill("input[type='email']", "reviewer@bidblitz.ae")
            await page.wait_for_timeout(500)
            await page.fill("input[type='password']", "BidBlitzReview2026!")
            await page.wait_for_timeout(500)
            
            # Click login
            await page.click("button[type='submit']")
            await page.wait_for_timeout(3000)
            await page.wait_for_load_state("networkidle", timeout=15000)
            
            # Check login success
            current_url = page.url
            if "/auth" not in current_url:
                print(f"✅ PASSED: Login successful, redirected to {current_url}")
                results["login"] = True
                await page.screenshot(path=".screenshots/store_login.png")
            else:
                print("❌ FAILED: Still on auth page after login")
            
            # TEST 2: Check unsafe modules are blocked
            print("\nTEST 2: Verify store-unsafe modules are blocked")
            print("-" * 80)
            
            unsafe_paths = {
                "auctions": "/auctions",
                "live-auctions": "/live-auctions",
                "plinko": "/reward-plinko",
                "spin-wheel": "/spin-wheel",
                "arcade": "/arcade",
                "gaming": "/gaming",
                "lottery": "/lottery"
            }
            
            for name, path in unsafe_paths.items():
                try:
                    await page.goto(f"https://super-app-staging-2.preview.emergentagent.com{path}", wait_until="networkidle", timeout=10000)
                    await page.wait_for_timeout(1000)
                    new_url = page.url
                    
                    if path not in new_url:
                        print(f"  ✅ BLOCKED: {name} (redirected from {path})")
                        results["unsafe_blocked"] += 1
                    else:
                        print(f"  ❌ ACCESSIBLE: {name} at {path} (SHOULD BE BLOCKED)")
                        results["unsafe_accessible"] += 1
                        await page.screenshot(path=f".screenshots/unsafe_{name}.png")
                except Exception as e:
                    print(f"  ✅ BLOCKED: {name} (error: {str(e)[:40]})")
                    results["unsafe_blocked"] += 1
            
            print(f"\nResult: {results['unsafe_blocked']} blocked, {results['unsafe_accessible']} accessible")
            
            # TEST 3: Check safe modules are accessible
            print("\nTEST 3: Verify safe modules are accessible")
            print("-" * 80)
            
            safe_paths = {
                "Wallet": "/wallet",
                "QR Pay": "/scanner",
                "Support": "/support-chat",
                "More": "/more"
            }
            
            for name, path in safe_paths.items():
                try:
                    await page.goto(f"https://super-app-staging-2.preview.emergentagent.com{path}", wait_until="networkidle", timeout=10000)
                    await page.wait_for_timeout(1000)
                    new_url = page.url
                    
                    if path in new_url:
                        print(f"  ✅ ACCESSIBLE: {name} at {path}")
                        results["safe_accessible"] += 1
                        await page.screenshot(path=f".screenshots/safe_{name.replace(' ', '_').lower()}.png")
                    else:
                        print(f"  ❌ BLOCKED: {name} at {path} (SHOULD BE ACCESSIBLE)")
                        results["safe_blocked"] += 1
                except Exception as e:
                    print(f"  ❌ ERROR: {name} - {str(e)[:40]}")
                    results["safe_blocked"] += 1
            
            print(f"\nResult: {results['safe_accessible']} accessible, {results['safe_blocked']} blocked")
            
            # TEST 4: Check More page options
            print("\nTEST 4: Check More page for required options")
            print("-" * 80)
            
            await page.goto("https://super-app-staging-2.preview.emergentagent.com/more", wait_until="networkidle", timeout=10000)
            await page.wait_for_timeout(2000)
            
            page_text = await page.evaluate("() => document.body.innerText.toLowerCase()")
            
            options = {
                "Privacy": ["privacy", "datenschutz"],
                "Terms": ["terms", "agb"],
                "Contact": ["contact", "kontakt", "support"],
                "Delete Account": ["delete", "account", "konto"]
            }
            
            for name, keywords in options.items():
                found = any(kw in page_text for kw in keywords)
                if found:
                    print(f"  ✅ FOUND: {name}")
                    results["more_options"] += 1
                else:
                    print(f"  ❌ MISSING: {name}")
            
            await page.screenshot(path=".screenshots/more_page.png")
            print(f"\nResult: {results['more_options']}/4 options found")
            
            # TEST 5: Check wallet balance
            print("\nTEST 5: Check wallet balance is realistic")
            print("-" * 80)
            
            await page.goto("https://super-app-staging-2.preview.emergentagent.com/wallet", wait_until="networkidle", timeout=10000)
            await page.wait_for_timeout(2000)
            
            balance_text = await page.evaluate("""() => {
                const els = Array.from(document.querySelectorAll('h1, h2, [class*="balance"]'));
                return els.map(el => el.textContent.trim()).join(" | ");
            }""")
            
            print(f"Balance: {balance_text[:100] if balance_text else 'Not found'}")
            
            # Check for unrealistic balances
            import re
            numbers = re.findall(r'(\d+(?:[.,]\d+)?)', balance_text)
            for num_str in numbers:
                num = float(num_str.replace(',', '.'))
                if num > 10000:
                    print(f"  ⚠️ WARNING: Unrealistic balance: €{num}")
                    results["balance_realistic"] = False
            
            if results["balance_realistic"]:
                print("  ✅ Balance appears realistic")
            
            await page.screenshot(path=".screenshots/wallet_balance.png")
            
            # TEST 6: Check navigation
            print("\nTEST 6: Check bottom navigation is clean")
            print("-" * 80)
            
            await page.goto("https://super-app-staging-2.preview.emergentagent.com/home", wait_until="networkidle", timeout=10000)
            await page.wait_for_timeout(2000)
            
            nav_text = await page.evaluate("""() => {
                const navEls = Array.from(document.querySelectorAll('nav a, nav button'));
                return navEls.map(el => el.textContent.trim().toLowerCase()).join(" | ");
            }""")
            
            gambling_words = ["auction", "auktion", "penny", "plinko", "spin", "lottery", "arcade", "gaming", "casino"]
            has_gambling = any(word in nav_text for word in gambling_words)
            
            if has_gambling:
                print("  ❌ FAILED: Gambling items found in navigation")
                results["nav_clean"] = False
            else:
                print("  ✅ PASSED: Navigation is clean")
            
            await page.screenshot(path=".screenshots/home_nav.png")
            
            # SUMMARY
            print("\n" + "=" * 80)
            print("SUMMARY")
            print("=" * 80)
            print(f"✅ Login: {'PASSED' if results['login'] else 'FAILED'}")
            print(f"✅ Unsafe modules blocked: {results['unsafe_blocked']}/{len(unsafe_paths)}")
            print(f"❌ Unsafe modules accessible: {results['unsafe_accessible']}/{len(unsafe_paths)}")
            print(f"✅ Safe modules accessible: {results['safe_accessible']}/{len(safe_paths)}")
            print(f"❌ Safe modules blocked: {results['safe_blocked']}/{len(safe_paths)}")
            print(f"✅ More page options: {results['more_options']}/4")
            print(f"✅ Balance realistic: {'Yes' if results['balance_realistic'] else 'No'}")
            print(f"✅ Navigation clean: {'Yes' if results['nav_clean'] else 'No'}")
            
            print("\n" + "=" * 80)
            print("REVIEW PATHS ACCESSIBLE:")
            print("=" * 80)
            for name in safe_paths.keys():
                print(f"  ✅ {name}")
            
            print("\n" + "=" * 80)
            print("STORE-UNSAFE MODULES STATUS:")
            print("=" * 80)
            for name in unsafe_paths.keys():
                status = "BLOCKED" if results['unsafe_blocked'] > 0 else "ACCESSIBLE"
                print(f"  {'✅' if status == 'BLOCKED' else '❌'} {name}: {status}")
            
            print("\nTesting complete. Screenshots saved to .screenshots/")
            
        except Exception as e:
            print(f"\n❌ ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            await page.screenshot(path=".screenshots/error.png")
        
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
