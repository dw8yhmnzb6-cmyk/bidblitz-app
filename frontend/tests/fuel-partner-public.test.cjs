"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const page = fs.readFileSync(path.join(root, "public/fuel-partner.html"), "utf8");
const landing = fs.readFileSync(path.join(root, "src/pages/FuelLandingPage.jsx"), "utf8");

test("partner website ships in the existing public build", () => {
  assert.match(page, /<html lang="de">/);
  assert.match(page, /<meta name="viewport"/);
  assert.match(page, /<title>Partner werden \| BidBlitz Fuel<\/title>/);
  assert.match(page, /id="vorteile"/);
  assert.match(page, /id="modell"/);
  assert.match(page, /id="ablauf"/);
  assert.match(page, /id="kontakt"/);
});

test("all primary partner contact actions have a usable destination", () => {
  assert.match(page, /href="tel:\+4920243047726"/);
  assert.match(page, /href="#kontakt"/);
  assert.match(page, /href="https:\/\/bidblitz\.ae"/);
  assert.match(landing, /href="\/fuel-partner\.html"/);
  assert.match(landing, /data-testid="fuel-partner-link"/);
  assert.doesNotMatch(landing, /<button className="rounded-2xl bg-white px-6 py-3 font-black text-slate-950">Partner werden<\/button>/);
});

test("public partner messaging does not misrepresent deployment readiness", () => {
  assert.match(page, /Pilotphase in Vorbereitung/);
  assert.match(page, /keine Live-Daten/);
  assert.match(page, /Echte Zahlungen sind derzeit nicht aktiviert/);
  assert.match(page, /Keine Live-Tankzahlung/);
  assert.match(page, /keine zugesagten Partnerschaften/i);
  assert.doesNotMatch(page, /<form\b/i);
});

test("mobile layout and keyboard accessibility are considered", () => {
  assert.match(page, /@media \(max-width:570px\)/);
  assert.match(page, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(page, /:focus-visible/);
  assert.match(page, /aria-label="Hauptnavigation"/);
});
