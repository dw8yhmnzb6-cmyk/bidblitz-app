const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

function readEnvValue(key) {
  const fs = require('fs');
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return '';
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${key}=`));
  if (!line) return '';
  return line.slice(key.length + 1).trim();
}

try {
  const testMode = process.env.REACT_APP_TEST_MODE || process.env.TEST_MODE || readEnvValue('REACT_APP_TEST_MODE') || readEnvValue('TEST_MODE');
  const disableKyc = process.env.REACT_APP_DISABLE_KYC || readEnvValue('REACT_APP_DISABLE_KYC');
  const showLiveCheckBanner = process.env.REACT_APP_SHOW_LIVE_CHECK_BANNER || readEnvValue('REACT_APP_SHOW_LIVE_CHECK_BANNER');
  if (testMode) {
    process.env.REACT_APP_TEST_MODE = testMode;
    console.log(`\n[ios:xcode-sync] Verwende REACT_APP_TEST_MODE=${testMode}`);
  }
  if (disableKyc) {
    process.env.REACT_APP_DISABLE_KYC = disableKyc;
    console.log(`\n[ios:xcode-sync] Verwende REACT_APP_DISABLE_KYC=${disableKyc}`);
  }
  if (showLiveCheckBanner) {
    process.env.REACT_APP_SHOW_LIVE_CHECK_BANNER = showLiveCheckBanner;
    console.log(`\n[ios:xcode-sync] Verwende REACT_APP_SHOW_LIVE_CHECK_BANNER=${showLiveCheckBanner}`);
  }
  console.log('\n[ios:xcode-sync] Schritt 1/2: Web Build');
  run('npm run build');
  console.log('\n[ios:xcode-sync] Schritt 2/2: Capacitor Copy');
  run('npx cap copy ios');
  console.log('\n[ios:xcode-sync] ✅ Frische Web-Assets nach iOS kopiert.');
} catch (error) {
  console.error(`\n[ios:xcode-sync] ❌ ${error.message}`);
  process.exit(1);
}