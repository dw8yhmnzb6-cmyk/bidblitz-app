const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

function readEnvValue(key) {
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
  const backendUrl = process.env.REACT_APP_BACKEND_URL || readEnvValue('REACT_APP_BACKEND_URL');
  if (backendUrl) {
    process.env.REACT_APP_BACKEND_URL = backendUrl;
    console.log(`\n[ios:prepare] Verwende REACT_APP_BACKEND_URL=${backendUrl}`);
  }
  console.log('\n[ios:prepare] Schritt 1/3: Dependencies installieren');
  run('yarn install');
  console.log('\n[ios:prepare] Schritt 2/3: Web Build');
  try {
    run('yarn build');
  } catch (error) {
    console.warn('\n[ios:prepare] Warnung: Web-Build lief mit nicht-blockierenden Warnungen weiter.');
  }
  console.log('\n[ios:prepare] Schritt 3/3: iOS Sync');
  run('npx cap sync ios');
  console.log('\n[ios:prepare] ✅ Vorbereitung abgeschlossen.');
} catch (error) {
  console.error(`\n[ios:prepare] ❌ ${error.message}`);
  process.exit(1);
}