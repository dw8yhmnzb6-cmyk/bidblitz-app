import assert from "node:assert/strict";
import test from "node:test";

import { clearLocalRecent, loadLocalRecent, MAX_RECENT, recordLocalRecent } from "../src/config/gamesRecentPolicy.mjs";

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

test("recent history records newest game first without duplicates", () => {
  const store = storage();
  recordLocalRecent(store, "match", "2026-10-04T20:00:00Z");
  recordLocalRecent(store, "community-one", "2026-10-04T21:00:00Z");
  recordLocalRecent(store, "match", "2026-10-04T22:00:00Z");
  assert.deepEqual(loadLocalRecent(store), [
    { game_id: "match", last_played_at: "2026-10-04T22:00:00Z" },
    { game_id: "community-one", last_played_at: "2026-10-04T21:00:00Z" },
  ]);
});

test("recent history validates IDs and caps entries", () => {
  const store = storage();
  assert.equal(recordLocalRecent(store, "../bad").ok, false);
  for (let index = 0; index < MAX_RECENT + 5; index += 1) {
    recordLocalRecent(store, `game-${index}`, `2026-10-04T20:${String(index).padStart(2, "0")}:00Z`);
  }
  const rows = loadLocalRecent(store);
  assert.equal(rows.length, MAX_RECENT);
  assert.equal(rows[0].game_id, `game-${MAX_RECENT + 4}`);
});

test("corrupt storage is treated as empty and clear removes history", () => {
  const store = storage({ bidblitz_games_recent: "{bad" });
  assert.deepEqual(loadLocalRecent(store), []);
  recordLocalRecent(store, "match");
  assert.equal(clearLocalRecent(store), true);
  assert.deepEqual(loadLocalRecent(store), []);
});
