"use strict";

/*
 * Isolated Fuel Admin smoke coverage.
 * Uses the existing React and Babel dependency installation. No browser,
 * provider credentials, network requests or payment execution required.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");

const babel = require("@babel/core");
const react = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const frontend = path.resolve(__dirname, "..");

function loadLocalModule(filename) {
  const full = path.resolve(frontend, filename);
  const src = fs.readFileSync(full, "utf8");
  const result = babel.transformSync(src, {
    filename: full,
    babelrc: false,
    configFile: false,
    presets: [
      [require.resolve("@babel/preset-env"), { targets: { node: "current" }, modules: "commonjs" }],
      [require.resolve("@babel/preset-react"), { runtime: "classic" }],
    ],
  });
  assert.ok(result && result.code, `Babel did not transform ${filename}`);
  const compiled = new Module(full, module);
  compiled.filename = full;
  compiled.paths = Module._nodeModulePaths(path.dirname(full));
  require.cache[full] = compiled;
  compiled._compile(result.code, full);
  compiled.loaded = true;
  return compiled.exports;
}

const api = loadLocalModule("src/services/fuelCommercialPreviewApi.js");
const panel = loadLocalModule("src/components/FuelCommercialPreviewPanel.jsx");

test("Fuel quote panel renders readable inputs and a DEV-only warning", () => {
  const output = renderToStaticMarkup(react.createElement(panel.default));
  assert.match(output, /Tankstellen-Provisionsrechner/);
  assert.match(output, /Monatlicher Brutto-Tankumsatz/);
  assert.match(output, /Anzahl gleich großer Tankstellen/);
  assert.match(output, /Provision auf Umsatz/);
  assert.match(output, /Provision je Liter/);
  assert.match(output, /Kartengebühren/);
  assert.match(output, /NUR ANGEBOT/);
  assert.match(output, /Provisionsmodelle vergleichen/);
  assert.doesNotMatch(output, /Jetzt bezahlen|Zahlung ausführen/);
});

test("Fuel quote API uses authenticated DEV preview only", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async (url, opts) => {
    calls += 1;
    assert.equal(url, "/api/fuel/admin-config/commercial-preview");
    assert.equal(opts.method, "POST");
    assert.equal(opts.credentials, "include");
    assert.equal(opts.headers["Content-Type"], "application/json");
    const payload = JSON.parse(opts.body);
    assert.equal(payload.monthly_turnover, "100000");
    assert.equal(payload.station_count, "100");
    return {
      ok: true,
      json: async () => ({ ok: true, payments_enabled: false, percentage_model: { commission_before_cost: "200.00" } }),
    };
  };
  try {
    const response = await api.previewFuelCommercialOffer({ monthly_turnover: "100000", station_count: "100" });
    assert.equal(calls, 1);
    assert.equal(response.payments_enabled, false);
    assert.equal(response.percentage_model.commission_before_cost, "200.00");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Fuel quote API reports authorization failures without retry", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return { ok: false, json: async () => ({ detail: "Admin access required" }) };
  };
  try {
    const response = await api.previewFuelCommercialOffer({});
    assert.equal(response.ok, false);
    assert.equal(response.error, "Admin access required");
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Fuel quote API handles network errors without fallback payment actions", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    throw new Error("Network unavailable");
  };
  try {
    const response = await api.previewFuelCommercialOffer({});
    assert.equal(response.ok, false);
    assert.match(response.error, /Keine Verbindung/);
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});
