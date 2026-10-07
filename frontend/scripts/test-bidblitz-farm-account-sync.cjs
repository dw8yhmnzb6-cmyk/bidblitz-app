const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../public/game-assets/bidblitz-farm/account-sync.js");

function state(day, xp = 0, harvests = 0) {
  return { day, xp, harvests };
}

test("farm sync compares day before xp and harvests", () => {
  assert.equal(S.compareProgress(state(5, 0, 0), state(4, 999, 999)), 1);
  assert.equal(S.compareProgress(state(4, 80, 0), state(4, 40, 99)), 1);
  assert.equal(S.compareProgress(state(4, 80, 5), state(4, 80, 4)), 1);
  assert.equal(S.compareProgress(state(4, 80, 5), state(4, 80, 5)), 0);
});

test("newer remote farm wins, equal progress keeps local device state", () => {
  assert.equal(S.chooseNewer(state(2, 0, 0), state(3, 0, 0)), "remote");
  assert.equal(S.chooseNewer(state(3, 40, 1), state(3, 40, 1)), "local");
  assert.equal(S.chooseNewer(state(4, 0, 0), state(3, 999, 999)), "local");
});

test("farm expansion, buildings and animals break same-day sync ties", () => {
  const base = { day: 4, xp: 80, harvests: 2, unlockedPlots: 6, buildings: { coop: 1, barn: 1, silo: 1 }, animals: { chicken: { count: 0 }, cow: { count: 0 }, sheep: { count: 0 } } };
  const expanded = { ...base, unlockedPlots: 9 };
  assert.equal(S.compareProgress(expanded, base), 1);

  const built = { ...base, buildings: { coop: 2, barn: 1, silo: 1 } };
  assert.equal(S.compareProgress(built, base), 1);

  const stocked = { ...base, animals: { chicken: { count: 2 }, cow: { count: 0 }, sheep: { count: 0 } } };
  assert.equal(S.compareProgress(stocked, base), 1);
});

test("completed orders and inventory break same-day sync ties", () => {
  const base = {
    day: 5, xp: 100, harvests: 3, completedOrders: 0, unlockedPlots: 6,
    buildings: { coop: 1, barn: 1, silo: 1 },
    animals: { chicken: { count: 1 }, cow: { count: 0 }, sheep: { count: 0 } },
    inventory: { wheat: 0, corn: 0, tomato: 0, carrot: 0, eggs: 0, milk: 0, wool: 0 },
  };
  const ordered = { ...base, completedOrders: 1 };
  assert.equal(S.compareProgress(ordered, base), 1);

  const stocked = { ...base, inventory: { ...base.inventory, wheat: 2 } };
  assert.equal(S.compareProgress(stocked, base), 1);
});

test("invalid progress values fail safely instead of outranking valid state", () => {
  assert.deepEqual(S.progressTuple(null), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(S.progressTuple({ day: "9", xp: -1, harvests: null }), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(S.chooseNewer(state(1, 0, 0), null), "local");
});

test("claimed milestone rewards and missions resolve otherwise equal device progress", () => {
  const base = { day: 8, xp: 450, harvests: 10, claimedMissions: [], claimedLevelRewards: [] };
  const withMission = { ...base, claimedMissions: ["first-harvest"] };
  const withReward = { ...withMission, claimedLevelRewards: [5] };
  assert.equal(S.chooseNewer(base, withMission), "remote");
  assert.equal(S.chooseNewer(withMission, withReward), "remote");
  assert.equal(S.chooseNewer(withReward, withReward), "local");
  assert.equal(S.compareProgress({ ...withReward, claimedMissions: ["first-harvest", "first-harvest"] }, withReward), 0);
});

test("malformed sync subtrees never inflate the progress comparison", () => {
  const safe = { day: 2, xp: 10, harvests: 1 };
  const malformed = { day: 2, xp: 10, harvests: 1, buildings: { coop: -8 }, animals: { cow: { count: "999" } }, inventory: { eggs: -5 } };
  assert.equal(S.compareProgress(safe, malformed), 0);
});
