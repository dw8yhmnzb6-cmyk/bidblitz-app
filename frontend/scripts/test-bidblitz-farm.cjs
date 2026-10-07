const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../public/game-assets/bidblitz-farm/engine.js");

test("initial farm is deterministic and valid", () => {
  const a = F.initial(12345);
  const b = F.initial(12345);
  assert.deepEqual(a, b);
  assert.equal(a.day, 1);
  assert.equal(a.plots.length, 6);
  assert.equal(a.coins, 60);
  assert.equal(F.decode(JSON.stringify(a)).seed, 12345);
});

test("planting spends only virtual farm coins and rejects invalid actions", () => {
  const start = F.initial(7);
  const planted = F.plant(start, 1, "wheat");
  assert.equal(planted.ok, true);
  assert.equal(planted.profile.coins, start.coins - F.CROPS.wheat.seedCost);
  assert.equal(planted.profile.plots[0].crop, "wheat");
  assert.equal(F.plant(planted.profile, 1, "corn").ok, false);

  const poor = { ...start, coins: 0 };
  assert.equal(F.plant(poor, 2, "tomato").reason, "coins");
});

test("watering and weather affect crop growth", () => {
  let farm = F.initial(99);
  farm = F.plant(farm, 1, "wheat").profile;
  const dryStart = JSON.parse(JSON.stringify(farm));
  const wateredStart = F.water(farm, 1).profile;

  const dry = F.advanceDay(dryStart).profile;
  const wet = F.advanceDay(wateredStart).profile;
  assert.ok(wet.plots[0].growth >= dry.plots[0].growth);
  assert.equal(wet.plots[0].watered, false);
});

test("ready crops harvest into virtual coins and xp", () => {
  let farm = F.initial(42);
  farm = F.plant(farm, 1, "carrot").profile;
  for (let i = 0; i < 8 && !farm.plots[0].ready; i++) {
    farm = F.water(farm, 1).profile;
    farm = F.advanceDay(farm).profile;
  }
  assert.equal(farm.plots[0].ready, true);
  const beforeCoins = farm.coins;
  const beforeXp = farm.xp;
  const result = F.harvest(farm, 1);
  assert.equal(result.ok, true);
  assert.ok(result.profile.coins > beforeCoins);
  assert.ok(result.profile.xp > beforeXp);
  assert.equal(result.profile.harvests, 1);
  assert.equal(result.profile.plots[0].crop, null);
});

test("forecast is deterministic and spans season changes", () => {
  const farm = F.initial(555);
  const first = F.forecast(farm, 10);
  const second = F.forecast(farm, 10);
  assert.deepEqual(first, second);
  assert.equal(first.length, 10);
  assert.ok(new Set(first.map(day => day.season)).size >= 2);
});

test("corrupt saves are rejected", () => {
  const base = F.initial(123);
  const invalid = [
    null,
    { ...base, weather: "snow" },
    { ...base, season: 3 },
    { ...base, level: 50 },
    { ...base, plots: base.plots.slice(0, 5) },
    { ...base, coins: -1 },
  ];
  for (const value of invalid) {
    assert.equal(F.decode(JSON.stringify(value)), null);
  }
});
