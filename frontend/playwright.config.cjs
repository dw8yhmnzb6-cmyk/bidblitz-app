const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: path.join(__dirname, 'tests/visual-qa'),
  timeout: 120000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(__dirname, 'playwright-report/visual-qa-html'), open: 'never' }],
  ],
  outputDir: path.join(__dirname, 'playwright-report/.artifacts'),
  globalSetup: path.join(__dirname, 'tests/visual-qa/global.setup.cjs'),
  use: {
    baseURL: process.env.QA_BASE_URL || 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});