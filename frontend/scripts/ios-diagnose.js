const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function verifyIosProject() {
  const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
  const appDelegate = read('ios/App/App/AppDelegate.swift');
  const coreTrace = read('ios/App/App/CoreDataTrace.m');
  const healthPatch = read('patches/@capgo+capacitor-health+7.2.15.patch');
  const healthSwift = read('node_modules/@capgo/capacitor-health/ios/Sources/HealthPlugin/Health.swift');
  const healthPlugin = read('node_modules/@capgo/capacitor-health/ios/Sources/HealthPlugin/HealthPlugin.swift');

  assert(appDelegate.includes('@UIApplicationMain'), 'AppDelegate.swift nutzt nicht den normalen Capacitor-Start');
  assert(!exists('ios/App/App/main.swift'), 'main.swift existiert noch');
  assert(!exists('ios/App/App/PersistenceBootstrap.swift'), 'PersistenceBootstrap.swift existiert noch');
  assert(!pbx.includes('main.swift'), 'main.swift ist noch im Xcode-Projekt referenziert');
  assert(!pbx.includes('PersistenceBootstrap.swift'), 'PersistenceBootstrap.swift ist noch im Xcode-Projekt referenziert');
  assert(pbx.includes('CoreDataTrace.m in Sources'), 'CoreDataTrace.m ist nicht in Build Sources eingebunden');
  assert(coreTrace.includes('#if DEBUG'), 'CoreDataTrace.m ist nicht DEBUG-only geschützt');
  assert(coreTrace.includes('[CoreDataTrace][START]'), 'Formatierte CoreDataTrace-Logs fehlen');
  assert(coreTrace.includes('[CoreDataTrace][CALLER]'), 'Caller-Logs fehlen');
  assert(coreTrace.includes('[CoreDataTrace][FRAMEWORK]'), 'Framework-Logs fehlen');
  assert(coreTrace.includes('[CoreDataTrace][STORE_URL]'), 'Store-URL-Logs fehlen');
  assert(coreTrace.includes('[CoreDataTrace][END]'), 'End-Logs fehlen');
  assert(healthPatch.includes('[HealthDebug] HealthPlugin initialized'), 'Health-Patch enthält HealthPlugin-Log nicht');
  assert(healthPatch.includes('[HealthDebug] HKHealthStore initialized'), 'Health-Patch enthält HKHealthStore-Log nicht');
  assert(healthSwift.includes('private lazy var healthStore: HKHealthStore = {'), 'Health.swift hat keinen Lazy HealthStore');
  assert(healthSwift.includes('[HealthDebug] HKHealthStore initialized'), 'Health.swift enthält HKHealthStore-Debuglog nicht');
  assert(healthPlugin.includes('Health.shared'), 'HealthPlugin.swift nutzt nicht Health.shared');
  assert(healthPlugin.includes('[HealthDebug] HealthPlugin initialized'), 'HealthPlugin.swift enthält HealthPlugin-Debuglog nicht');
}

try {
  console.log('\n[ios:diagnose] Schritt 1/4: Web Build');
  run('yarn build');
  console.log('\n[ios:diagnose] Schritt 2/4: Capacitor Sync');
  run('npx cap sync ios');
  console.log('\n[ios:diagnose] Schritt 3/4: Projektprüfung');
  verifyIosProject();
  console.log('\n[ios:diagnose] Schritt 4/4: Ergebnis');
  console.log('[ios:diagnose] ✅ Projekt ist für den Gerätetest bereit.');
  console.log('[ios:diagnose] Öffne ios/App/App.xcworkspace, wähle dein iPhone und drücke Run.');
  console.log('[ios:diagnose] Danach nur noch den Xcode-Log mit [CoreDataTrace] und [HealthDebug] kopieren.');
} catch (error) {
  console.error(`\n[ios:diagnose] ❌ ${error.message}`);
  process.exit(1);
}