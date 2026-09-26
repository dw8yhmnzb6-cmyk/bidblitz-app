const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const indexJs = read('frontend/src/index.js');
const serviceWorker = read('frontend/public/service-worker.js');
const frontendNginx = read('frontend/nginx.conf');
const productionNginx = read('deploy/nginx/bidblitz.conf');
const buildInfo = read('scripts/generate_build_info.py');
const liveVerify = read('scripts/live_verify.py');
const liveVerifyWorkflow = read('.github/workflows/live-deployment-verify.yml');

const checks = [];
const requireMatch = (name, condition) => checks.push({ name, condition: Boolean(condition) });

const navigationHandlerMatch = serviceWorker.match(
  /async function handleNavigation\(req\) \{([\s\S]*?)\n\}\n\nasync function handleCacheableApi/
);
const navigationHandler = navigationHandlerMatch?.[1] || '';

// Runtime update behavior
requireMatch('version.json is fetched with cache: no-store', /version\.json[\s\S]*cache:\s*['"]no-store['"]/.test(indexJs));
requireMatch('service worker registration bypasses HTTP cache', /updateViaCache:\s*['"]none['"]/.test(indexJs));
requireMatch('service worker URL is build-versioned', /service-worker\.js\?v=/.test(indexJs));
requireMatch('automatic update retry exists', /AUTO_UPDATE_RETRY_INTERVAL_MS/.test(indexJs));
requireMatch('reload loop guard exists', /RELOAD_LOOP_GUARD_MS/.test(indexJs) && /RELOAD_ATTEMPT_KEY/.test(indexJs));
requireMatch('unsaved forms block auto reload', /hasUnsavedFormChanges/.test(indexJs) && /dirtyForms/.test(indexJs));
requireMatch('active form editing blocks auto reload', /isActivelyEditing/.test(indexJs));
requireMatch('checkout is protected', /['"]\/checkout['"]/.test(indexJs));
requireMatch('payment routes are protected', /['"]\/payment['"]/.test(indexJs) && /['"]\/payments['"]/.test(indexJs));
requireMatch('stripe route is protected', /['"]\/stripe['"]/.test(indexJs));
requireMatch('topup/refund routes are protected', /['"]\/topup['"]/.test(indexJs) && /['"]\/refund['"]/.test(indexJs));
requireMatch('no manual update button dependency remains', !indexJs.includes('Jetzt aktualisieren'));

// Service worker cache safety
requireMatch('service worker contains embedded build marker', /const EMBEDDED_BUILD_ID = ['"][^'"]+['"];\s*\/\/ BUILD_ID_INJECTED/.test(serviceWorker));
requireMatch('service worker prefers embedded build id over query fallback', /EMBEDDED_BUILD_ID !== ['"]bidblitz-build-unset['"][\s\S]*EMBEDDED_BUILD_ID[\s\S]*queryBuildId/.test(serviceWorker));
requireMatch('build generator injects worker build id', /inject_service_worker_build_id/.test(buildInfo) && /BUILD_ID_INJECTED/.test(buildInfo));
requireMatch('build generator refuses an unversioned worker', /refusing to create a production build with an unversioned worker/.test(buildInfo));
requireMatch('service worker uses build-specific static cache', /bidblitz-static-\$\{BUILD_ID\}/.test(serviceWorker));
requireMatch('service worker uses build-specific API cache', /bidblitz-api-\$\{BUILD_ID\}/.test(serviceWorker));
requireMatch('service worker deletes old BidBlitz cache generations', /caches\.delete/.test(serviceWorker) && /oldBidBlitzCaches/.test(serviceWorker));
requireMatch('HTML navigations explicitly use cache no-store', /req\.mode\s*===\s*['"]navigate['"][\s\S]*handleNavigation/.test(serviceWorker) && /new Request\(req, \{ cache: ['"]no-store['"] \}\)/.test(serviceWorker));
requireMatch('navigation handler is detected', Boolean(navigationHandlerMatch));
requireMatch('navigation handler never writes HTML to cache', Boolean(navigationHandlerMatch) && !/cache\.put|caches\.open/.test(navigationHandler));
requireMatch('root is not precached', !/cache\.addAll\([\s\S]*['"]\/['"]/.test(serviceWorker));
requireMatch('index.html is not precached', !/cache\.addAll\([\s\S]*index\.html/.test(serviceWorker));
requireMatch('payment APIs bypass SW cache', /\/api\/payments/.test(serviceWorker) && /\/api\/stripe/.test(serviceWorker) && /\/api\/checkout/.test(serviceWorker));
requireMatch('kids APIs always bypass SW cache', /['"]\/api\/kids['"]/.test(serviceWorker));
requireMatch('kids children endpoint is not cacheable', !/CACHEABLE_API_ROUTES\s*=\s*\[[\s\S]*?\/api\/kids\/children[\s\S]*?\]/.test(serviceWorker));

// HTTP cache policy
for (const [label, nginx] of [
  ['frontend nginx', frontendNginx],
  ['production nginx', productionNginx],
]) {
  requireMatch(`${label}: service-worker.js has exact no-store rule`, /location\s*=\s*\/service-worker\.js[\s\S]*?Cache-Control[\s\S]*?no-store/.test(nginx));
  requireMatch(`${label}: index.html has exact no-store rule`, /location\s*=\s*\/index\.html[\s\S]*?Cache-Control[\s\S]*?no-store/.test(nginx));
  requireMatch(`${label}: version.json has exact no-store rule`, /location\s*=\s*\/version\.json[\s\S]*?Cache-Control[\s\S]*?no-store/.test(nginx));
  requireMatch(`${label}: hashed static assets remain immutable`, /location\s+\/static\/[\s\S]*?immutable/.test(nginx));
}

requireMatch('production nginx serves deployed build path', /root\s+\/var\/www\/bidblitz\/frontend\/build;/.test(productionNginx));
requireMatch('build metadata cache names include build_id', /bidblitz-static-\{build_id\}/.test(buildInfo) && /bidblitz-api-\{build_id\}/.test(buildInfo));

// Post-deployment verification must prove that the LIVE server actually exposes
// the same cache policy and build identity as the repository expects.
const liveVerifyCompile = spawnSync(
  'python3',
  ['-m', 'py_compile', path.join(repoRoot, 'scripts/live_verify.py')],
  { encoding: 'utf8' }
);
requireMatch('live verifier Python syntax compiles', liveVerifyCompile.status === 0);
requireMatch('live verifier has no third-party requests dependency', !/^\s*(?:from\s+requests|import\s+requests)\b/m.test(liveVerify));
requireMatch('live verifier checks all app-shell update files', /APP_SHELL_PATHS[\s\S]*['"]\/['"][\s\S]*['"]\/index\.html['"][\s\S]*['"]\/version\.json['"][\s\S]*['"]\/service-worker\.js['"]/.test(liveVerify));
requireMatch('live verifier requires no-store cache policy', /is no-store/.test(liveVerify) && /['"]no-store['"]\s+in\s+cc/.test(liveVerify));
requireMatch('live verifier validates static immutable cache', /static asset is immutable/.test(liveVerify) && /STATIC_MAX_AGE_MIN\s*=\s*31_536_000/.test(liveVerify));
requireMatch('live verifier compares index/version/service-worker identity', /index\/version\/service-worker build ids match/.test(liveVerify) && /extract_meta_build_id/.test(liveVerify) && /extract_worker_build_id/.test(liveVerify));
requireMatch('live verifier can require the deployed build id', /--expected-build-id/.test(liveVerify) && /live build equals deployed build/.test(liveVerify));
requireMatch('live verifier can require the deployed commit', /--expected-commit/.test(liveVerify) && /live build belongs to expected commit/.test(liveVerify));
requireMatch('live verifier cache-busts app-shell requests', /__bbv/.test(liveVerify) && /bust_cache=True/.test(liveVerify));
requireMatch('post-deploy workflow only verifies successful main deploys', /workflow_run[\s\S]*Deploy to IONOS Production/.test(liveVerifyWorkflow) && /conclusion == 'success'/.test(liveVerifyWorkflow) && /head_branch == 'main'/.test(liveVerifyWorkflow));
requireMatch('post-deploy workflow verifies expected deployed commit', /scripts\/live_verify\.py/.test(liveVerifyWorkflow) && /--expected-commit/.test(liveVerifyWorkflow) && /workflow_run\.head_sha/.test(liveVerifyWorkflow));
requireMatch('post-deploy workflow retries transient live propagation', /for attempt in 1 2 3/.test(liveVerifyWorkflow) && /sleep 10/.test(liveVerifyWorkflow));

const failed = checks.filter((check) => !check.condition);
for (const check of checks) {
  console.log(`${check.condition ? 'PASS' : 'FAIL'}  ${check.name}`);
}

if (failed.length) {
  console.error(`\n${failed.length} update/cache safety check(s) failed.`);
  if (liveVerifyCompile.status !== 0) {
    console.error(liveVerifyCompile.stderr || liveVerifyCompile.stdout || 'python3 -m py_compile failed');
  }
  process.exit(1);
}

console.log(`\nAll ${checks.length} update/cache safety checks passed.`);