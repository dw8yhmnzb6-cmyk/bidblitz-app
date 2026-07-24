const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const runFrontend = (cmd) => execSync(cmd, { cwd: frontendRoot, stdio: 'inherit', env: process.env });
const runRepo = (cmd) => execSync(cmd, { cwd: repoRoot, stdio: 'inherit', env: process.env });

function readEnvValue(key) {
  const envPath = path.join(frontendRoot, '.env');
  if (!fs.existsSync(envPath)) return '';
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${key}=`));
  if (!line) return '';
  return line.slice(key.length + 1).trim();
}

try {
  const backendUrl = process.env.REACT_APP_BACKEND_URL || readEnvValue('REACT_APP_BACKEND_URL');
  const testMode = process.env.REACT_APP_TEST_MODE || process.env.TEST_MODE || readEnvValue('REACT_APP_TEST_MODE') || readEnvValue('TEST_MODE');
  const testModeFullAccess = process.env.REACT_APP_TEST_MODE_FULL_ACCESS || readEnvValue('REACT_APP_TEST_MODE_FULL_ACCESS');
  const disableKyc = process.env.REACT_APP_DISABLE_KYC || readEnvValue('REACT_APP_DISABLE_KYC');
  const kycEnabled = process.env.REACT_APP_KYC_ENABLED || readEnvValue('REACT_APP_KYC_ENABLED');
  const kycRequired = process.env.REACT_APP_KYC_REQUIRED || readEnvValue('REACT_APP_KYC_REQUIRED');
  const showKycGate = process.env.REACT_APP_SHOW_KYC_GATE || readEnvValue('REACT_APP_SHOW_KYC_GATE');
  const showLiveCheckBanner = process.env.REACT_APP_SHOW_LIVE_CHECK_BANNER || readEnvValue('REACT_APP_SHOW_LIVE_CHECK_BANNER');
  if (backendUrl) {
    process.env.REACT_APP_BACKEND_URL = backendUrl;
    console.log(`\n[ios:prepare] Verwende REACT_APP_BACKEND_URL=${backendUrl}`);
  }
  if (testMode) {
    process.env.REACT_APP_TEST_MODE = testMode;
    console.log(`\n[ios:prepare] Verwende REACT_APP_TEST_MODE=${testMode}`);
  }
  if (testModeFullAccess) {
    process.env.REACT_APP_TEST_MODE_FULL_ACCESS = testModeFullAccess;
    console.log(`\n[ios:prepare] Verwende REACT_APP_TEST_MODE_FULL_ACCESS=${testModeFullAccess}`);
  }
  if (disableKyc) {
    process.env.REACT_APP_DISABLE_KYC = disableKyc;
    console.log(`\n[ios:prepare] Verwende REACT_APP_DISABLE_KYC=${disableKyc}`);
  }
  if (kycEnabled) {
    process.env.REACT_APP_KYC_ENABLED = kycEnabled;
    console.log(`\n[ios:prepare] Verwende REACT_APP_KYC_ENABLED=${kycEnabled}`);
  }
  if (kycRequired) {
    process.env.REACT_APP_KYC_REQUIRED = kycRequired;
    console.log(`\n[ios:prepare] Verwende REACT_APP_KYC_REQUIRED=${kycRequired}`);
  }
  if (showKycGate) {
    process.env.REACT_APP_SHOW_KYC_GATE = showKycGate;
    console.log(`\n[ios:prepare] Verwende REACT_APP_SHOW_KYC_GATE=${showKycGate}`);
  }
  if (showLiveCheckBanner) {
    process.env.REACT_APP_SHOW_LIVE_CHECK_BANNER = showLiveCheckBanner;
    console.log(`\n[ios:prepare] Verwende REACT_APP_SHOW_LIVE_CHECK_BANNER=${showLiveCheckBanner}`);
  }
  console.log('\n[ios:prepare] Schritt 1/3: Dependencies installieren');
  runRepo('npm install');
  console.log('\n[ios:prepare] Schritt 2/3: Web Build');
  try {
    runRepo('npm run build');
  } catch (error) {
    console.warn('\n[ios:prepare] Warnung: Web-Build lief mit nicht-blockierenden Warnungen weiter.');
  }
  console.log('\n[ios:prepare] Schritt 3/3: iOS Sync');
  runRepo('npx cap sync ios');
  console.log('\n[ios:prepare] ✅ Vorbereitung abgeschlossen.');
} catch (error) {
  console.error(`\n[ios:prepare] ❌ ${error.message}`);
  process.exit(1);
}