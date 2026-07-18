const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

try {
  console.log('\n[ios:xcode-sync] Schritt 1/2: Web Build');
  run('yarn build');
  console.log('\n[ios:xcode-sync] Schritt 2/2: Capacitor Copy');
  run('npx cap copy ios');
  console.log('\n[ios:xcode-sync] ✅ Frische Web-Assets nach iOS kopiert.');
} catch (error) {
  console.error(`\n[ios:xcode-sync] ❌ ${error.message}`);
  process.exit(1);
}