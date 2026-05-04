#!/usr/bin/env python3
"""
BidBlitz — App Store / Play Store Screenshot Generator
Rendert die wichtigsten Screens in den 5 Pflicht-Auflösungen via Playwright.

Usage:
    pip install playwright
    playwright install chromium
    python3 scripts/generate-store-screenshots.py
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = "https://bidblitz.ae"
OUT_DIR = Path("/app/store-screenshots")

# 5 Pflicht-Auflösungen (Apple + Google Play)
DEVICES = [
    ("ios-67",        1290, 2796, "iPhone 6.7\""),
    ("ios-65",        1242, 2688, "iPhone 6.5\""),
    ("ipad-129",      2048, 2732, "iPad 12.9\""),
    ("android-phone", 1080, 1920, "Android Phone"),
    ("android-tablet",1920, 1200, "Android Tablet"),
]

# Top-8 Screens für Marketing
SCREENS = [
    ("01-home",          "/"),
    ("02-auctions",      "/auctions"),
    ("03-wallet",        "/wallet"),
    ("04-marketplace",   "/marketplace"),
    ("05-taxi",          "/taxi"),
    ("06-live-shopping", "/livekit-stream"),
    ("07-pos",           "/pos"),
    ("08-rewards",       "/rewards"),
]


async def shoot(page, url: str, out_path: Path):
    print(f"  → {out_path.name}")
    try:
        # Pre-warm: set localStorage BEFORE navigation
        await page.goto(BASE_URL + "/", wait_until="domcontentloaded", timeout=30000)
        await page.evaluate("""
            localStorage.setItem('bidblitz_onboarded','1');
            localStorage.setItem('bidblitz_cookie_consent_v1', JSON.stringify({
                necessary:true,analytics:true,crash:true,marketing:true,timestamp:new Date().toISOString()
            }));
            // Demo mode flag for auth-gated routes
            sessionStorage.setItem('bidblitz_demo_mode', '1');
        """)
        await page.goto(f"{BASE_URL}{url}", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)
        await page.screenshot(path=str(out_path), full_page=False, type="png")
    except Exception as e:
        print(f"    ⚠️  {e}")


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for slug, w, h, label in DEVICES:
            print(f"\n📱 {label} ({w}x{h})")
            ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2)
            page = await ctx.new_page()
            for fname, route in SCREENS:
                out = OUT_DIR / slug / f"{fname}.png"
                out.parent.mkdir(parents=True, exist_ok=True)
                await shoot(page, route, out)
            await ctx.close()
        await browser.close()
    print(f"\n✅ Screenshots in {OUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
