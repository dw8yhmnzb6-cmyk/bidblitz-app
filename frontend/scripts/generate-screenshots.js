/**
 * App Store Screenshot Generator
 * 
 * Generates required screenshots for iOS App Store and Google Play Store
 * 
 * Requirements:
 * - iOS: Minimum 3 screenshots at 1290x2796 (iPhone Pro Max)
 * - Android: Minimum 2 screenshots at 1080x1920
 * 
 * Screens captured:
 * 1. Home/Dashboard - All features overview
 * 2. Taxi Booking - Map with booking interface
 * 3. Wallet - Balance and transactions
 * 4. Marketplace/Auctions - Live bidding
 * 5. Profile - User settings
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Configuration
const APP_URL = process.env.REACT_APP_BACKEND_URL?.replace('/api', '') || 'https://swipe-match-chat-8.preview.emergentagent.com';
const OUTPUT_DIR = path.join(__dirname, '../public/screenshots');
const TEST_USER = {
  email: 'admin@bidblitz.ae',
  password: 'BidBlitz2026!'
};

// Device configurations
const DEVICES = {
  iOS: {
    name: 'iPhone Pro Max',
    viewport: { width: 1290, height: 2796 },
    deviceScaleFactor: 3
  },
  Android: {
    name: 'Android Phone',
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 2
  }
};

// Screenshots to capture
const SCREENSHOTS = [
  {
    name: '01-home',
    title: 'Home - All Features',
    path: '/dashboard',
    description: 'Main dashboard showing all available services'
  },
  {
    name: '02-taxi',
    title: 'Taxi Booking',
    path: '/taxi',
    description: 'Book a taxi with real-time map',
    action: async (page) => {
      // Wait for map to load
      await page.waitForTimeout(3000);
      // Select Privat-Taxi if visible
      const privateTaxi = page.locator('text="Privat-Taxi"').first();
      if (await privateTaxi.isVisible({ timeout: 2000 }).catch(() => false)) {
        await privateTaxi.click();
        await page.waitForTimeout(2000);
      }
    }
  },
  {
    name: '03-wallet',
    title: 'Digital Wallet',
    path: '/wallet',
    description: 'Manage your balance and transactions'
  },
  {
    name: '04-auctions',
    title: 'Live Auctions',
    path: '/auctions',
    description: 'Bid on items in real-time',
    action: async (page) => {
      await page.waitForTimeout(2000);
      // Try to click on first auction if visible
      const firstAuction = page.locator('[data-testid="auction-card"]').first();
      if (await firstAuction.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstAuction.click();
        await page.waitForTimeout(1500);
      }
    }
  },
  {
    name: '05-profile',
    title: 'User Profile',
    path: '/profile',
    description: 'Manage your account settings'
  }
];

async function login(page) {
  console.log('🔐 Logging in...');
  
  // Skip onboarding if present
  const skipBtn = page.locator('text="Überspringen"').first();
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(1000);
  }
  
  // Click Anmelden
  const anmeldenBtn = page.locator('button:has-text("Anmelden")').first();
  if (await anmeldenBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await anmeldenBtn.click();
    await page.waitForTimeout(2000);
    
    // Fill login form
    await page.locator('input[type="email"]').fill(TEST_USER.email);
    await page.locator('input[type="password"]').fill(TEST_USER.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(4000);
    
    console.log('✅ Logged in successfully');
    return true;
  }
  
  return false;
}

async function captureScreenshot(page, screenshot, device, outputDir) {
  console.log(`📸 Capturing: ${screenshot.title} (${device.name})`);
  
  try {
    // Navigate to page
    await page.goto(`${APP_URL}${screenshot.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Execute custom action if defined
    if (screenshot.action) {
      await screenshot.action(page);
    }
    
    // Additional wait for animations
    await page.waitForTimeout(1500);
    
    // Hide scrollbars for cleaner screenshot
    await page.addStyleTag({
      content: `
        * { scrollbar-width: none; }
        *::-webkit-scrollbar { display: none; }
        body { overflow: hidden; }
      `
    });
    
    // Capture screenshot
    const filename = `${screenshot.name}-${device.name.toLowerCase().replace(/\s+/g, '-')}.png`;
    const filepath = path.join(outputDir, filename);
    
    await page.screenshot({
      path: filepath,
      fullPage: false,
      type: 'png',
      animations: 'disabled'
    });
    
    console.log(`✅ Saved: ${filename}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to capture ${screenshot.name}:`, error.message);
    return false;
  }
}

async function generateScreenshots(deviceName) {
  const device = DEVICES[deviceName];
  if (!device) {
    throw new Error(`Unknown device: ${deviceName}`);
  }
  
  console.log(`\n🎬 Starting screenshot generation for ${device.name}`);
  console.log(`📐 Viewport: ${device.viewport.width}x${device.viewport.height}`);
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
  });
  
  const context = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: device.deviceScaleFactor,
    hasTouch: true,
    isMobile: true,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    permissions: ['geolocation'],
    geolocation: { latitude: 52.52, longitude: 13.405 } // Berlin
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to app
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Login
    const loggedIn = await login(page);
    if (!loggedIn) {
      console.warn('⚠️ Could not log in, continuing with public pages only');
    }
    
    // Capture all screenshots
    let successCount = 0;
    for (const screenshot of SCREENSHOTS) {
      const success = await captureScreenshot(page, screenshot, device, OUTPUT_DIR);
      if (success) successCount++;
      
      // Small delay between screenshots
      await page.waitForTimeout(1000);
    }
    
    console.log(`\n✅ Captured ${successCount}/${SCREENSHOTS.length} screenshots for ${device.name}`);
    
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('🚀 BidBlitz App Store Screenshot Generator\n');
  console.log(`📱 App URL: ${APP_URL}`);
  console.log(`📂 Output: ${OUTPUT_DIR}\n`);
  
  try {
    // Generate iOS screenshots
    await generateScreenshots('iOS');
    
    // Generate Android screenshots
    await generateScreenshots('Android');
    
    console.log('\n🎉 Screenshot generation complete!');
    console.log(`\n📁 Screenshots saved to: ${OUTPUT_DIR}`);
    console.log('\n📋 Next steps:');
    console.log('1. Review screenshots in /public/screenshots/');
    console.log('2. Upload to App Store Connect (iOS)');
    console.log('3. Upload to Google Play Console (Android)');
    
  } catch (error) {
    console.error('\n❌ Screenshot generation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generateScreenshots, SCREENSHOTS, DEVICES };
