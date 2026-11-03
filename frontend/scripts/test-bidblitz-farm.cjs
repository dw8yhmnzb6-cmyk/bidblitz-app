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

test("animal buildings increase virtual product value", () => {
  let farm = F.initial(77);
  farm.coins = 1000;
  assert.equal(F.animalProductBonus(farm, "chicken"), 1);
  farm = F.upgradeBuilding(farm, "coop").profile;
  assert.equal(F.animalProductBonus(farm, "chicken"), 1.05);
  farm = F.upgradeBuilding(farm, "barn").profile;
  assert.equal(F.animalProductBonus(farm, "cow"), 1.05);
  assert.equal(F.animalProductBonus(farm, "sheep"), 1.05);
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

test("season events are deterministic and affect virtual farm economy", () => {
  const spring = F.initial(1234);
  spring.day = 7;
  spring.season = F.seasonForDay(7);
  spring.weather = F.weatherFor(spring.seed, 7, spring.season);
  const event = F.seasonEvent(spring);
  assert.equal(event.id, "spring-fair");
  const before = spring.coins;
  const planted = F.plant(spring, 1, "tomato");
  assert.equal(planted.ok, true);
  assert.ok(before - planted.profile.coins < F.CROPS.tomato.seedCost);

  const autumn = F.initial(1234);
  autumn.day = 21;
  autumn.season = F.seasonForDay(21);
  autumn.weather = F.weatherFor(autumn.seed, 21, autumn.season);
  assert.equal(F.seasonEvent(autumn).id, "autumn-festival");
});

test("daily farm orders are deterministic and consume only virtual inventory", () => {
  let farm = F.initial(909);
  const first = F.orderBoard(farm);
  const second = F.orderBoard(farm);
  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  const order = first[0];

  farm.inventory[order.itemId] = order.quantity;
  const beforeCoins = farm.coins;
  const beforeXp = farm.xp;
  const fulfilled = F.fulfillOrder(farm, order.id);
  assert.equal(fulfilled.ok, true);
  assert.equal(fulfilled.profile.inventory[order.itemId], 0);
  assert.equal(fulfilled.profile.completedOrders, 1);
  assert.ok(fulfilled.profile.coins > beforeCoins);
  assert.ok(fulfilled.profile.xp > beforeXp);
  assert.equal(F.fulfillOrder(fulfilled.profile, order.id).ok, false);
});

test("harvests and animal products create order inventory without wallet fields", () => {
  let farm = F.initial(910);
  farm.coins = 500;
  farm = F.plant(farm, 1, "wheat").profile;
  for (let i = 0; i < 6 && !farm.plots[0].ready; i++) {
    farm = F.water(farm, 1).profile;
    farm = F.advanceDay(farm).profile;
  }
  const harvested = F.harvest(farm, 1);
  assert.equal(harvested.ok, true);
  assert.equal(harvested.profile.inventory.wheat, 1);

  farm = harvested.profile;
  farm = F.buyAnimal(farm, "chicken").profile;
  farm = F.feedAnimals(farm, "chicken").profile;
  farm = F.advanceDay(farm).profile;
  const collected = F.collectAnimalProduct(farm, "chicken");
  assert.equal(collected.ok, true);
  assert.equal(collected.profile.inventory.eggs, 1);
  for (const forbidden of ["wallet", "eur", "payout", "payment"]) {
    assert.equal(forbidden in collected.profile, false);
  }
});

test("order streak completes after all three daily orders and grants only virtual bonuses", () => {
  let farm = F.initial(999);
  const orders = F.orderBoard(farm);
  for (const order of orders) {
    farm.inventory[order.itemId] = (farm.inventory[order.itemId] || 0) + order.quantity;
    const result = F.fulfillOrder(farm, order.id);
    assert.equal(result.ok, true);
    farm = result.profile;
  }
  assert.equal(farm.completedOrders, 3);
  assert.equal(farm.orderStreak, 1);
  assert.equal(farm.lastOrderStreakDay, farm.day);
  assert.equal(F.customerRank(farm).level, 1);
});

test("customer rank increases with completed order count", () => {
  const farm = F.initial(1000);
  farm.completedOrders = 0;
  assert.equal(F.customerRank(farm).id, "new");
  farm.completedOrders = 6;
  assert.equal(F.customerRank(farm).id, "known");
  farm.completedOrders = 15;
  assert.equal(F.customerRank(farm).id, "trusted");
  farm.completedOrders = 30;
  assert.equal(F.customerRank(farm).id, "expert");
  farm.completedOrders = 60;
  assert.equal(F.customerRank(farm).id, "legend");
});

test("level milestone rewards unlock once and stay virtual", () => {
  let farm = F.initial(1200);
  farm.xp = 160;
  farm.level = F.levelFromXp(farm.xp);
  let rewards = F.levelRewardStatus(farm);
  const level5 = rewards.find(item => item.level === 5);
  assert.equal(level5.unlocked, true);
  assert.equal(level5.claimed, false);

  const beforeCoins = farm.coins;
  const claimed = F.claimLevelReward(farm, 5);
  assert.equal(claimed.ok, true);
  assert.ok(claimed.profile.coins > beforeCoins);
  assert.ok(claimed.profile.claimedLevelRewards.includes(5));
  assert.equal(F.claimLevelReward(claimed.profile, 5).ok, false);
});

test("endgame missions track orders land buildings and level", () => {
  const farm = F.initial(1201);
  farm.completedOrders = 10;
  farm.unlockedPlots = 12;
  farm.buildings = { coop: 3, barn: 3, silo: 3 };
  farm.xp = 360;
  farm.level = F.levelFromXp(farm.xp);
  const status = Object.fromEntries(F.missionStatus(farm).map(item => [item.id, item]));
  assert.equal(status["orders-10"].completed, true);
  assert.equal(status["land-12"].completed, true);
  assert.equal(status["buildings-9"].completed, true);
  assert.equal(status["farm-level-10"].completed, true);
});

test("level progress reports next threshold and max-level completion", () => {
  const farm = F.initial(1202);
  farm.xp = 100;
  farm.level = F.levelFromXp(farm.xp);
  const progress = F.nextLevelProgress(farm);
  assert.equal(progress.level, 3);
  assert.ok(progress.percent >= 0 && progress.percent <= 100);

  farm.xp = 5000;
  farm.level = 50;
  const max = F.nextLevelProgress(farm);
  assert.equal(max.percent, 100);
});

test("farm achievements are computed from existing progress without extra saved state", () => {
  const farm = F.initial(1300);
  let list = Object.fromEntries(F.achievements(farm).map(item => [item.id, item]));
  assert.equal(list["first-harvest"].achieved, false);
  assert.equal(list["land-max"].achieved, false);

  farm.harvests = 30;
  farm.completedOrders = 30;
  farm.unlockedPlots = 12;
  farm.animals.chicken.count = 3;
  farm.animals.cow.count = 3;
  farm.animals.sheep.count = 3;
  farm.buildings = { coop: 5, barn: 5, silo: 5 };
  farm.level = 50;
  list = Object.fromEntries(F.achievements(farm).map(item => [item.id, item]));

  assert.equal(list["first-harvest"].achieved, true);
  assert.equal(list["harvest-25"].achieved, true);
  assert.equal(list["orders-25"].achieved, true);
  assert.equal(list["animals-9"].achieved, true);
  assert.equal(list["land-max"].achieved, true);
  assert.equal(list["buildings-max"].achieved, true);
  assert.equal(list["level-50"].achieved, true);
});

test("farm completion score grows with endgame progress", () => {
  const start = F.initial(1400);
  const early = F.completionScore(start);
  assert.ok(early.percent >= 0 && early.percent < 50);

  const end = F.initial(1400);
  end.level = 50;
  end.xp = 5000;
  end.unlockedPlots = 12;
  end.buildings = { coop: 5, barn: 5, silo: 5 };
  end.completedOrders = 60;
  end.harvests = 30;
  end.animals.chicken.count = 3;
  end.animals.cow.count = 3;
  end.animals.sheep.count = 3;
  const completed = F.completionScore(end);
  assert.ok(completed.percent > early.percent);
  assert.ok(completed.percent <= 100);
});

test("farm onboarding steps are derived from existing progress", () => {
  let farm = F.initial(1500);
  let steps = Object.fromEntries(F.onboardingSteps(farm).map(item => [item.id, item.done]));
  assert.equal(steps.plant, false);
  assert.equal(steps.harvest, false);
  assert.equal(steps.animal, false);
  assert.equal(steps.order, false);
  assert.equal(steps.expand, false);

  farm.plots[0].crop = "wheat";
  farm.harvests = 1;
  farm.animals.chicken.count = 1;
  farm.completedOrders = 1;
  farm.unlockedPlots = 9;
  steps = Object.fromEntries(F.onboardingSteps(farm).map(item => [item.id, item.done]));
  assert.equal(Object.values(steps).every(Boolean), true);
});

test("saved Farm orders reject duplicates and future dates", () => {
  const profile = F.initial(456);
  const duplicate = { ...profile, fulfilledOrders: ["order-1-0", "order-1-0"] };
  const future = { ...profile, fulfilledOrders: ["order-2-0"] };
  assert.equal(F.decode(JSON.stringify(duplicate)), null);
  assert.equal(F.decode(JSON.stringify(future)), null);
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
