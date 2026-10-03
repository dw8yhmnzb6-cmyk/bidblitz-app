/* Offline component-behaviour checks. React hooks, DOM, time and API are mocked.
 * This is NOT a browser test or proof of real-money settlement.
 * Run: node frontend/scripts/test-barcode-lifecycle.cjs
 * Optional arguments: source-file results-json-file
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const sourcePath = process.argv[2] || path.join(__dirname, '../src/components/BarcodeModal.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  reportDiagnostics: true,
  compilerOptions: {jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS},
});
assert.equal((compiled.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0, 'JSX parse/transpile');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return {promise, resolve, reject};
};

function makeHarness(options = {}) {
  const state = [], refs = [], memo = [], effects = [];
  let cursor = 0, dirty = false, tree = null, props = {isOpen: true, onClose() {}};
  let now = Date.parse('2026-09-25T10:00:00Z'), tid = 1;
  const timers = new Map(), listeners = new Map(), calls = {get: 0, refresh: 0, copy: []};
  const pendingEffects = [];
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((x, i) => !Object.is(x, b[i]));
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], v => {
        const n = typeof v === 'function' ? v(state[i]) : v;
        if (!Object.is(n, state[i])) { state[i] = n; dirty = true; }
      }];
    },
    useRef(initial) { const i = cursor++; return refs[i] || (refs[i] = {current: initial}); },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!memo[i] || changed(memo[i].deps, deps)) memo[i] = {deps, fn};
      return memo[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!effects[i] || changed(effects[i].deps, deps)) pendingEffects.push({i, fn, deps});
    },
  };
  const response = (barcode = 'CODE-A', extra = {}) => ({
    barcode, seconds_remaining: 120, expires_in: 120, rotation_seconds: 120, name: 'Offline QA', ...extra,
  });
  const api = {
    getMyBarcode() { calls.get++; return options.get ? options.get(calls.get) : Promise.resolve(response()); },
    refreshBarcode() { calls.refresh++; return options.refresh ? options.refresh(calls.refresh) : Promise.resolve(response('CODE-B')); },
  };
  const jsx = (type, props) => ({type, props: props || {}});
  const document = {
    addEventListener(k, fn) { if (!listeners.has(k)) listeners.set(k, new Set()); listeners.get(k).add(fn); },
    removeEventListener(k, fn) { listeners.get(k)?.delete(fn); },
  };
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const exports = {};
  const ctx = {
    exports, Date: ClockDate, Number, Math, console, document,
    navigator: {clipboard: {async writeText(s) { calls.copy.push(s); }}},
    setInterval(fn) { const id = tid++; timers.set(id, fn); return id; },
    clearInterval(id) { timers.delete(id); }, setTimeout() { return tid++; }, clearTimeout() {},
    require(id) {
      if (id === 'react') return hooks;
      if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx, Fragment: 'Fragment'};
      if (id === 'framer-motion') return {motion: new Proxy({}, {get: (_, p) => 'motion.' + p}), AnimatePresence: 'AnimatePresence'};
      if (id === 'lucide-react') return new Proxy({}, {get: (_, p) => 'icon.' + p});
      if (id === 'qrcode.react') return {QRCodeSVG: 'QRCodeSVG'};
      if (id === '../services/api') return {api};
      if (id === '../store') return {useI18n: () => ({t: () => ''})};
      throw new Error('Unexpected import ' + id);
    },
  };
  vm.runInNewContext(compiled.outputText, ctx, {filename: 'BarcodeModal.transpiled.cjs'});
  const Component = exports.default;
  function render(next) {
    if (next) props = {...props, ...next};
    cursor = 0; dirty = false; tree = Component(props);
    for (const e of pendingEffects.splice(0)) {
      effects[e.i]?.cleanup?.(); effects[e.i] = {deps: e.deps, cleanup: e.fn()};
    }
    return tree;
  }
  async function flush() {
    for (let i = 0; i < 25; i++) { await Promise.resolve(); if (dirty) render(); }
    return tree;
  }
  function nodes(root = tree) {
    if (root == null || typeof root === 'boolean') return [];
    if (Array.isArray(root)) return root.flatMap(x => nodes(x));
    if (typeof root !== 'object') return [root];
    return [root, ...nodes(root.props?.children ?? null)];
  }
  return {
    calls, response, render, flush, timers, listeners,
    byId(id) { return nodes().find(x => x && typeof x === 'object' && x.props?.['data-testid'] === id); },
    qr() { return nodes().find(x => x?.type === 'QRCodeSVG')?.props?.value; },
    text() { return nodes().filter(x => typeof x === 'string' || typeof x === 'number').join(' '); },
    advance(ms) { now += ms; },
    tick() { for (const fn of [...timers.values()]) fn(); },
    visible() { for (const fn of [...(listeners.get('visibilitychange') || [])]) fn(); },
    async mount() { render(); await flush(); },
    async close() { render({isOpen: false}); await flush(); },
    async open() { render({isOpen: true}); await flush(); },
    unmount() { for (const e of effects) e?.cleanup?.(); },
  };
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
test('initial open loads existing code without rotating', async () => {
  const h = makeHarness(); await h.mount();
  assert.equal(h.calls.get, 1); assert.equal(h.calls.refresh, 0); assert.equal(h.qr(), 'CODE-A');
  assert.match(h.text(), /2:00/); h.unmount();
});
test('manual refresh calls POST rotation, not cached GET', async () => {
  const h = makeHarness(); await h.mount(); h.byId('barcode-refresh-btn').props.onClick(); await h.flush();
  assert.equal(h.calls.refresh, 1); assert.equal(h.calls.get, 1); assert.equal(h.qr(), 'CODE-B'); h.unmount();
});
test('zero lifetime is expired, never five minutes', async () => {
  const h = makeHarness({get: async () => ({barcode: 'EXPIRED', seconds_remaining: 0, expires_in: 0})});
  await h.mount(); assert.equal(h.qr(), undefined); assert.doesNotMatch(h.text(), /5:00/);
  assert.match(h.text(), /expired/i); h.unmount();
});
test('seconds_remaining takes precedence over older expires_in', async () => {
  const h = makeHarness({get: async () => ({barcode: 'CODE-A', seconds_remaining: 5, expires_in: 120, rotation_seconds: 120})});
  await h.mount(); assert.match(h.text(), /0:05/); h.unmount();
});
test('double click creates only one in-flight rotation', async () => {
  const d = deferred(), h = makeHarness({refresh: () => d.promise}); await h.mount();
  const click = h.byId('barcode-refresh-btn').props.onClick; click(); click(); await h.flush();
  assert.equal(h.calls.refresh, 1); d.resolve(h.response('CODE-B')); await h.flush();
  assert.equal(h.qr(), 'CODE-B'); h.unmount();
});
test('old code hidden while rotation awaits server', async () => {
  const d = deferred(), h = makeHarness({refresh: () => d.promise}); await h.mount();
  h.byId('barcode-refresh-btn').props.onClick(); await h.flush(); assert.equal(h.qr(), undefined);
  d.resolve(h.response('CODE-B')); await h.flush(); assert.equal(h.qr(), 'CODE-B'); h.unmount();
});
test('wall-clock expiry catches delayed browser timer', async () => {
  const h = makeHarness(); await h.mount(); h.advance(121000); h.tick(); await h.flush();
  assert.equal(h.calls.refresh, 1); assert.equal(h.qr(), 'CODE-B'); h.unmount();
});
test('visibility return detects expiration', async () => {
  const h = makeHarness(); await h.mount(); h.advance(121000); h.visible(); await h.flush();
  assert.equal(h.calls.refresh, 1); h.unmount();
});
test('failed rotation hides invalid old code and shows error', async () => {
  const h = makeHarness({refresh: async () => { throw Error('Provider unavailable'); }}); await h.mount();
  h.byId('barcode-refresh-btn').props.onClick(); await h.flush(); assert.equal(h.qr(), undefined);
  assert.match(h.text(), /Provider unavailable/); h.unmount();
});
test('late response from closed modal cannot replace reopened code', async () => {
  const old = deferred();
  const h = makeHarness({get: n => n === 1 ? old.promise : Promise.resolve({barcode: 'NEW', seconds_remaining: 120, expires_in: 120})});
  await h.mount(); await h.close(); await h.open(); assert.equal(h.qr(), 'NEW');
  old.resolve(h.response('STALE')); await h.flush(); assert.equal(h.qr(), 'NEW'); h.unmount();
});
test('malformed or missing barcode cannot render a payment code', async () => {
  const h = makeHarness({get: async () => ({seconds_remaining: 120})}); await h.mount();
  assert.equal(h.qr(), undefined); assert.match(h.text(), /unavailable|expired/i); h.unmount();
});
test('absolute expiry supported when server omits TTL fields', async () => {
  const h = makeHarness({get: async () => ({barcode: 'ABS', expires_at: '2026-09-25T10:01:00Z'})});
  await h.mount(); assert.equal(h.qr(), 'ABS'); assert.match(h.text(), /1:00/); h.unmount();
});
test('closing removes countdown and visibility listeners', async () => {
  const h = makeHarness(); await h.mount(); await h.close();
  assert.equal(h.timers.size, 0); assert.equal(h.listeners.get('visibilitychange')?.size || 0, 0); h.unmount();
});
test('copy after expiry triggers renewal instead of copying', async () => {
  const h = makeHarness(); await h.mount(); h.advance(121000);
  await h.byId('copy-barcode-btn').props.onClick(); await h.flush();
  assert.equal(h.calls.copy.length, 0); assert.equal(h.calls.refresh, 1); h.unmount();
});

(async () => {
  let passed = 0;
  const results = [];
  for (const [name, fn] of tests) {
    try { await fn(); passed++; results.push({name, result: 'passed'}); console.log('PASS', name); }
    catch (e) { results.push({name, result: 'failed', reason: e.message}); console.log('FAIL', name, '-', e.message); }
  }
  const summary = {
    source: sourcePath, test_type: 'offline component behaviour with mocked hooks, DOM, time and API',
    passed, failed: tests.length - passed, total: tests.length, tests: results,
  };
  console.log(JSON.stringify({passed, failed: tests.length - passed, total: tests.length}));
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(summary, null, 2));
  process.exitCode = passed === tests.length ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
