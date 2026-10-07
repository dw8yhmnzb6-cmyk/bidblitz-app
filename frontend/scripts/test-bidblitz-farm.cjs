const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../public/game-assets/bidblitz-farm/engine.js");

test("initial farm is deterministic and valid", () => {
  const a = F.initial(12345);
  const b = F.initial(12345);
  assert.deepEqual(a, b);
  assert.equal(a.day, 1);
  assert.equal(a.plots.length, 12);
  assert.equal(a.unlockedPlots, 6);
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

test("daily tasks and weather events are deterministic", () => {
  const farm = F.initial(888);
  assert.deepEqual(F.dailyTask(farm), F.dailyTask(farm));
  assert.deepEqual(F.weatherEvent(farm), F.weatherEvent(farm));
  const task = F.dailyTask(farm);
  assert.ok(task.target > 0);
  assert.ok(task.value >= 0);
  const event = F.weatherEvent(farm);
  assert.equal(typeof event.title, "string");
  assert.equal(typeof event.text, "string");
});

test("animals respect building capacity and produce virtual farm goods", () => {
  let farm = F.initial(21);
  farm.coins = 200;
  for (let i = 0; i < 3; i++) farm = F.buyAnimal(farm, "chicken").profile;
  assert.equal(farm.animals.chicken.count, 3);
  assert.equal(F.buyAnimal(farm, "chicken").reason, "capacity");

  const fed = F.feedAnimals(farm, "chicken");
  assert.equal(fed.ok, true);
  farm = F.advanceDay(fed.profile).profile;
  assert.equal(farm.animals.chicken.ready, 3);

  const before = farm.coins;
  const collected = F.collectAnimalProduct(farm, "chicken");
  assert.equal(collected.ok, true);
  assert.equal(collected.quantity, 3);
  assert.ok(collected.profile.coins > before);
  assert.equal(collected.profile.animals.chicken.ready, 0);
});

test("building upgrades increase capacity and silo harvest value", () => {
  let farm = F.initial(22);
  farm.coins = 1000;
  const coopCost = F.buildingUpgradeCost(farm, "coop");
  const upgraded = F.upgradeBuilding(farm, "coop");
  assert.equal(upgraded.ok, true);
  assert.equal(upgraded.cost, coopCost);
  assert.equal(upgraded.profile.buildings.coop, 2);
  assert.equal(F.animalCapacity(upgraded.profile, "chicken"), 6);

  const base = F.initial(42);
  let improved = F.initial(42);
  improved.coins = 1000;
  improved = F.upgradeBuilding(improved, "silo").profile;
  let a = F.plant(base, 1, "carrot").profile;
  let b = F.plant(improved, 1, "carrot").profile;
  for (let i = 0; i < 8 && !a.plots[0].ready; i++) {
    a = F.water(a, 1).profile; a = F.advanceDay(a).profile;
    b = F.water(b, 1).profile; b = F.advanceDay(b).profile;
  }
  const harvestA = F.harvest(a, 1);
  const harvestB = F.harvest(b, 1);
  assert.ok(harvestB.revenue >= harvestA.revenue);
});

test("missions unlock once and grant only virtual rewards", () => {
  let farm = F.initial(33);
  farm.harvests = 5;
  let mission = F.missionStatus(farm).find(item => item.id === "harvest-5");
  assert.equal(mission.completed, true);
  assert.equal(mission.claimed, false);

  const claimed = F.claimMission(farm, "harvest-5");
  assert.equal(claimed.ok, true);
  assert.ok(claimed.profile.coins > farm.coins);
  assert.ok(claimed.profile.xp > farm.xp);
  mission = F.missionStatus(claimed.profile).find(item => item.id === "harvest-5");
  assert.equal(mission.claimed, true);
  assert.equal(F.claimMission(claimed.profile, "harvest-5").ok, false);
});

test("farm market prices are deterministic per day and affect virtual revenue", () => {
  const farm = F.initial(101);
  const a = F.marketSnapshot(farm);
  const b = F.marketSnapshot(farm);
  assert.deepEqual(a, b);
  assert.equal(a.day, 1);
  assert.equal(typeof a.crops.wheat, "number");
  assert.ok(a.crops.wheat >= 0.85 && a.crops.wheat <= 1.30);
});

test("farm land expands from 6 to 9 to 12 plots with virtual coins only", () => {
  let farm = F.initial(202);
  farm.coins = 1000;
  assert.equal(farm.unlockedPlots, 6);
  assert.equal(F.landExpansionCost(farm), 180);

  let expanded = F.expandLand(farm);
  assert.equal(expanded.ok, true);
  farm = expanded.profile;
  assert.equal(farm.unlockedPlots, 9);
  assert.equal(F.landExpansionCost(farm), 360);

  expanded = F.expandLand(farm);
  assert.equal(expanded.ok, true);
  farm = expanded.profile;
  assert.equal(farm.unlockedPlots, 12);
  assert.equal(F.landExpansionCost(farm), null);
  assert.equal(F.expandLand(farm).ok, false);
});

test("locked farm plots cannot be planted before expansion", () => {
  const farm = F.initial(303);
  assert.equal(F.plant(farm, 7, "wheat").ok, false);
  const rich = { ...farm, coins: 1000 };
  const expanded = F.expandLand(rich).profile;
  assert.equal(F.plant(expanded, 7, "wheat").ok, true);
});

test("legacy six-plot saves migrate to twelve slots without unlocking land", () => {
  const legacy = F.initial(404);
  legacy.plots = legacy.plots.slice(0, 6);
  delete legacy.unlockedPlots;
  const decoded = F.decode(JSON.stringify(legacy));
  assert.ok(decoded);
  assert.equal(decoded.plots.length, 12);
  assert.equal(decoded.unlockedPlots, 6);
  assert.equal(decoded.plots[11].id, 12);
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
