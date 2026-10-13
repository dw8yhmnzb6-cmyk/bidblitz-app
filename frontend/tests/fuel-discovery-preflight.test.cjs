"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");

const babel = require("@babel/core");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const frontend = path.resolve(__dirname, "..");

function local(filename) {
  const full = path.resolve(frontend, filename);
  const output = babel.transformSync(fs.readFileSync(full, "utf8"), {
    filename: full,
    babelrc: false,
    configFile: false,
    presets: [
      [require.resolve("@babel/preset-env"), { targets: { node: "current" }, modules: "commonjs" }],
      [require.resolve("@babel/preset-react"), { runtime: "classic" }],
    ],
  });
  assert.ok(output?.code);
  const compiled = new Module(full, module);
  compiled.filename = full;
  compiled.paths = Module._nodeModulePaths(path.dirname(full));
  require.cache[full] = compiled;
  compiled._compile(output.code, full);
  return compiled.exports;
}

const api = local("src/services/fuelDiscoveryPreflightApi.js");
const view = local("src/components/FuelDiscoveryPreflightPanel.jsx");

test("preflight controls explicitly say DEV read-only without payment", () => {
  const html = renderToStaticMarkup(React.createElement(view.default, { providerName: "pace" }));
  assert.match(html, /Partner-Discovery Sicherheitsprüfung/);
  assert.match(html, /Keine echte Tankstellensuche/);
  assert.match(html, /Deutschland/);
  assert.match(html, /Kosovo/);
  assert.match(html, /DEV · READ ONLY/);
  assert.doesNotMatch(html, /Jetzt bezahlen/);
});

test("preflight helper sends a single authenticated GET", async () => {
  const existing = global.fetch;
  let calls = 0;
  global.fetch = async (url, opts) => {
    calls += 1;
    assert.equal(url, "/api/fuel/admin-config/providers/pace/discovery-preview?country=AT");
    assert.equal(opts.method, "GET");
    assert.equal(opts.credentials, "include");
    return {
      ok: true,
      json: async () => ({
        ok: true,
        preflight: { external_request_executed: false, network_discovery_enabled: false, payments_enabled: false },
      }),
    };
  };
  try {
    const result = await api.previewFuelDiscovery("pace", "AT");
    assert.equal(calls, 1);
    assert.equal(result.ok, true);
    assert.equal(result.preflight.payments_enabled, false);
  } finally {
    global.fetch = existing;
  }
});

test("unsafe provider and country inputs are rejected before fetch", async () => {
  const existing = global.fetch;
  global.fetch = () => { throw new Error("must not fetch"); };
  try {
    assert.equal((await api.previewFuelDiscovery("../../secret", "DE")).ok, false);
    assert.equal((await api.previewFuelDiscovery("pace", "de")).ok, false);
  } finally {
    global.fetch = existing;
  }
});

test("response claiming executed provider access is never trusted", async () => {
  const existing = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ ok: true, preflight: { external_request_executed: true } }),
  });
  try {
    const result = await api.previewFuelDiscovery("pace", "DE");
    assert.equal(result.ok, false);
  } finally {
    global.fetch = existing;
  }
});

test("authorization and network errors are not retried", async () => {
  const existing = global.fetch;
  let count = 0;
  global.fetch = async () => {
    count += 1;
    return { ok: false, json: async () => ({ detail: "Admin access required" }) };
  };
  try {
    const result = await api.previewFuelDiscovery("pace", "DE");
    assert.equal(result.ok, false);
    assert.equal(count, 1);
  } finally {
    global.fetch = existing;
  }
});
