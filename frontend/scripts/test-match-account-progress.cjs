const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../public/games/match-preview/account-progress.js");

function profile(completed = 0, scoreBase = 1000) {
  const best = Array(30).fill(0);
  const stars = Array(30).fill(0);
  for (let i = 0; i < completed; i++) {
    best[i] = scoreBase + i;
    stars[i] = 2;
  }
  return {
    version: 1,
    revision: 3,
    coins: 150,
    unlocked: completed ? Math.min(30, completed + 1) : 1,
    best,
    stars,
    active: { level: 1 },
    purchases: [],
    receipts: [],
    energy: { count: 5, anchor: 1000 },
  };
}

test("summary contains no device-local money or active-game state", () => {
  const p = profile(3);
  const summary = S.summary(p);
  assert.deepEqual(Object.keys(summary).sort(), ["best", "stars", "unlocked", "version"]);
  for (const forbidden of ["coins", "energy", "active", "purchases", "receipts"]) {
    assert.equal(forbidden in summary, false);
  }
});

test("remote progress only improves local level, scores and stars", () => {
  const local = profile(3, 1500);
  const remote = S.summary(profile(6, 900));
  const merged = S.merge(local, remote);
  assert.equal(merged.changed, true);
  assert.equal(merged.profile.unlocked, 7);
  assert.equal(merged.profile.best[0], 1500);
  assert.equal(merged.profile.best[4], 904);
  assert.equal(merged.profile.coins, 150);
  assert.deepEqual(merged.profile.energy, local.energy);
});

test("lower remote snapshot cannot reduce local progress", () => {
  const local = profile(6, 2000);
  const remote = S.summary(profile(2, 500));
  const merged = S.merge(local, remote);
  assert.equal(merged.changed, false);
  assert.deepEqual(merged.profile, local);
});

test("invalid, gapped or inconsistent summaries are ignored", () => {
  const local = profile(2);
  const bad = [
    null,
    { ...S.summary(profile(2)), unlocked: 30 },
    { ...S.summary(profile(2)), best: Array(29).fill(0) },
    { ...S.summary(profile(2)), stars: [0, 2, ...Array(28).fill(0)] },
    { ...S.summary(profile(2)), best: [1000, 0, 1200, ...Array(27).fill(0)], stars: [2, 0, 2, ...Array(27).fill(0)], unlocked: 4 },
  ];
  for (const remote of bad) assert.equal(S.merge(local, remote).changed, false);
});
