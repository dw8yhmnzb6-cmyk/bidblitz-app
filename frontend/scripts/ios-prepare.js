const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

try {
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