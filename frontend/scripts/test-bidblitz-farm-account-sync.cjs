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

test("invalid progress values fail safely instead of outranking valid state", () => {
  assert.deepEqual(S.progressTuple(null), [0, 0, 0]);
  assert.deepEqual(S.progressTuple({ day: "9", xp: -1, harvests: null }), [0, 0, 0]);
  assert.equal(S.chooseNewer(state(1, 0, 0), null), "local");
});
