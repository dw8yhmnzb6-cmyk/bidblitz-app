const { defineConfig, devices } = require('playwright/test');
const path = require('path');

// Robot runner uses a local development server; it cannot target live services.
module.exports = defineConfig({
  testDir: path.join(__dirname, 'tests/robot'),
  timeout: 60000,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'robot-report', open: 'never' }], ['json', { outputFile: 'robot-results.json' }]],
  outputDir: 'robot-artifacts',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:3000',
    cwd: __dirname,
    timeout: 180000,
    reuseExistingServer: false,
    env: { ...process.env, CI: 'false', BROWSER: 'none', HOST: '127.0.0.1', PORT: '3000', REACT_APP_TEST_MODE: 'false', REACT_APP_TEST_MODE_FULL_ACCESS: 'false' },
  },
});
