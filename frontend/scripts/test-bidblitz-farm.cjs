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
