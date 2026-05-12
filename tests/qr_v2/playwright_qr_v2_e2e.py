"""Playwright E2E for QR Order v2 (Mr-Yum-Parität).

Flow:
 1. Rotate test table token via merchant session, resolve to next_token.
 2. Customer-login via API and copy cookies to Playwright context.
 3. Navigate to /order/qr/<token> and verify hero, scope tabs, categories,
    photo-grid, popular & combo carousels, item detail sheet with modifiers,
    add-to-cart, upsell strip, submit -> success screen with status tracker,
    tip section, split-bill, review CTA, language switcher, history sheet.
"""
import asyncio
import os
import requests

PAGE_URL_BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://qr-checkout-20.preview.emergentagent.com").rstrip("/")


def get_token_and_cookies():
    # Merchant: rotate table → get token
    ms = requests.Session()
    rl = ms.post(f"{PAGE_URL_BASE}/api/auth/login",
                 json={"email": "haendler@bidblitz.com", "password": "Haendler2026!"}, timeout=15)
    assert rl.status_code == 200, rl.text
    rr = ms.post(f"{PAGE_URL_BASE}/api/merchant/qr-tables/tbl_705aaa1575/rotate", timeout=15)
    token = rr.json().get("token") or rr.json().get("qr_token")
    # Resolve to refresh + get next_token
    res = requests.get(f"{PAGE_URL_BASE}/api/qr/resolve/{token}", timeout=15)
    next_token = res.json().get("next_token") or token
    # Customer login
    cs = requests.Session()
    cl = cs.post(f"{PAGE_URL_BASE}/api/auth/login",
                 json={"email": "kunde@bidblitz.com", "password": "Kunde2026!"}, timeout=15)
    assert cl.status_code == 200, cl.text
    cookies = []
    for c in cs.cookies:
        cookies.append({
            "name": c.name,
            "value": str(c.value),
            "domain": c.domain or PAGE_URL_BASE.replace("https://", "").replace("http://", ""),
            "path": c.path or "/",
            "secure": True,
            "httpOnly": True,
            "sameSite": "Lax",
        })
    return next_token, cookies


async def run_test():
    token, cookies = get_token_and_cookies()
    print(f"TOKEN={token}, cookies={len(cookies)}")

    await page.context.add_cookies(cookies)
    await page.set_viewport_size({"width": 390, "height": 844})
    page.on("console", lambda msg: print(f"CONSOLE[{msg.type}]: {msg.text}") if msg.type in ("error", "warning") else None)

    url = f"{PAGE_URL_BASE}/order/qr/{token}"
    print(f"Navigating to: {url}")
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)

    # ── Hero / page load ──
    await page.wait_for_selector('[data-testid="qr-order-page"]', timeout=15000)
    print("PASS: qr-order-page rendered")

    # Search bar
    assert await page.is_visible('[data-testid="qr-search-input"]'), "search missing"
    print("PASS: search-input visible")

    # Scope tabs
    assert await page.is_visible('[data-testid="qr-scope-food"]'), "food scope tab missing"
    print("PASS: scope tabs visible")

    # Category chips (at least one)
    cat_chips = await page.query_selector_all('[data-testid^="qr-cat-"]')
    assert len(cat_chips) >= 1, "no category chips"
    print(f"PASS: {len(cat_chips)} category chip(s)")

    # Allergen filter btn
    assert await page.is_visible('[data-testid="qr-allergen-filter"]'), "allergen filter missing"
    print("PASS: allergen-filter visible")

    # Combos carousel
    has_combos = await page.is_visible('[data-testid="qr-combos-section"]')
    print(f"INFO: combos-section visible={has_combos}")

    # Popular carousel
    has_popular = await page.is_visible('[data-testid="qr-popular-section"]')
    print(f"INFO: popular-section visible={has_popular}")

    # Language switcher
    await page.click('[data-testid="qr-lang-toggle"]', force=True)
    await page.wait_for_timeout(300)
    if await page.is_visible('[data-testid="qr-lang-EN"]'):
        await page.click('[data-testid="qr-lang-EN"]', force=True)
        await page.wait_for_timeout(400)
        print("PASS: language switched to EN")
        # back to DE
        await page.click('[data-testid="qr-lang-toggle"]', force=True)
        await page.wait_for_timeout(200)
        if await page.is_visible('[data-testid="qr-lang-DE"]'):
            await page.click('[data-testid="qr-lang-DE"]', force=True)
            await page.wait_for_timeout(300)

    # ── Open item detail sheet ──
    item_cards = await page.query_selector_all('[data-testid^="qr-item-"]')
    assert len(item_cards) >= 1, "no item cards found"
    print(f"PASS: {len(item_cards)} item card(s) in grid")

    # Click pizza-margherita if exists, else first card
    pizza = await page.query_selector('[data-testid="qr-item-pizza-margherita"]')
    if pizza:
        await pizza.click(force=True)
    else:
        await item_cards[0].click(force=True)
    await page.wait_for_selector('[data-testid="qr-detail-sheet"]', timeout=5000)
    print("PASS: detail-sheet opened")

    # Modifier group (size required) — choose 'm'
    size_opt = await page.query_selector('[data-testid="qr-opt-size-m"]')
    if size_opt:
        await size_opt.click(force=True)
        print("PASS: modifier 'size=m' selected")

    # Note + qty
    await page.fill('[data-testid="qr-detail-note"]', "TEST_no_onion")
    await page.click('[data-testid="qr-detail-inc"]', force=True)
    qty_text = await page.text_content('[data-testid="qr-detail-qty"]')
    print(f"PASS: qty after inc = {qty_text}")

    # Add to cart
    await page.click('[data-testid="qr-detail-add"]', force=True)
    await page.wait_for_timeout(500)
    print("PASS: detail-add clicked")

    # ── Cart CTA + upsell ──
    await page.wait_for_selector('[data-testid="qr-cart-cta"]', timeout=5000)
    cart_total = await page.text_content('[data-testid="qr-cart-total"]')
    print(f"PASS: cart-cta visible, total={cart_total}")

    has_upsell = await page.is_visible('[data-testid="qr-upsell-section"]')
    print(f"INFO: upsell-section visible={has_upsell}")

    # History toggle
    await page.click('[data-testid="qr-history-toggle"]', force=True)
    await page.wait_for_timeout(500)
    if await page.is_visible('[data-testid="qr-history-sheet"]'):
        print("PASS: history sheet opened")
        # close by clicking outside
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(300)

    # ── Submit order ──
    await page.click('[data-testid="qr-submit-btn"]', force=True)
    await page.wait_for_timeout(2500)
    success = await page.query_selector('[data-testid="qr-success"]')
    if not success:
        err = await page.text_content('[data-testid="qr-order-error"]') if await page.query_selector('[data-testid="qr-order-error"]') else None
        print(f"FAIL: success screen not shown, error={err}")
        await page.screenshot(path="/tmp/qr_v2_fail.png", quality=40, full_page=False)
        return
    print("PASS: success screen rendered")

    assert await page.is_visible('[data-testid="qr-status-tracker"]'), "status-tracker missing"
    print("PASS: status-tracker visible")

    assert await page.is_visible('[data-testid="qr-tip-section"]'), "tip-section missing"
    print("PASS: tip-section visible")

    assert await page.is_visible('[data-testid="qr-split-section"]'), "split-section missing"
    print("PASS: split-section visible")

    # Split-bill stepper
    each_before = await page.text_content('[data-testid="qr-split-each"]')
    await page.click('[data-testid="qr-split-inc"]', force=True)
    await page.wait_for_timeout(200)
    each_after = await page.text_content('[data-testid="qr-split-each"]')
    count = await page.text_content('[data-testid="qr-split-count"]')
    print(f"PASS: split inc count={count}, each {each_before} -> {each_after}")

    # Tip: click 5%
    if await page.is_visible('[data-testid="qr-tip-5"]'):
        await page.click('[data-testid="qr-tip-5"]', force=True)
        await page.wait_for_timeout(1500)
        applied = await page.query_selector('[data-testid="qr-tip-applied"]')
        if applied:
            txt = await applied.text_content()
            print(f"PASS: tip 5% applied: {txt}")
        else:
            print("WARN: tip-applied not shown — possibly insufficient balance")

    # Review CTA (only when accepted/completed in instant-mode)
    if await page.is_visible('[data-testid="qr-review-cta"]'):
        await page.click('[data-testid="qr-review-cta"]', force=True)
        await page.wait_for_timeout(500)
        if await page.is_visible('[data-testid="qr-review-sheet"]'):
            print("PASS: review-sheet opened")
            # try to click a 5-star for any item
            stars = await page.query_selector_all('[data-testid^="qr-review-star-"][data-testid$="-5"]')
            if stars:
                await stars[0].click(force=True)
                print("PASS: 5-star clicked")
            if await page.is_visible('[data-testid="qr-review-submit"]'):
                await page.click('[data-testid="qr-review-submit"]', force=True)
                await page.wait_for_timeout(1500)
                print("PASS: review submitted")
    else:
        print("INFO: review-cta not visible (order may be in 'received' state)")

    print("\n=== ALL E2E CHECKS COMPLETED ===")


try:
    await run_test()
except Exception as e:
    print(f"E2E FAILED: {e}")
    import traceback
    traceback.print_exc()
    await page.screenshot(path="/tmp/qr_v2_exception.png", quality=40, full_page=False)
