import test from "node:test";
import assert from "node:assert/strict";
import {
  GAMES_FAVORITES_STORAGE_KEY,
  loadLocalFavorites,
  normalizeFavoriteIds,
  saveLocalFavorites,
  toggleFavorite,
} from "../src/config/gamesFavoritesPolicy.mjs";

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    dump: () => Object.fromEntries(data),
  };
}

test("favorites are normalized, deduplicated and capped", () => {
  const values = ["Match", "match", "../bad", 42, ...Array.from({ length: 120 }, (_, i) => `game-${i}`)];
  const result = normalizeFavoriteIds(values);
  assert.equal(result[0], "match");
  assert.equal(result.length, 100);
  assert.equal(new Set(result).size, result.length);
});

test("local favorites recover safely from damaged storage", () => {
  const storage = memoryStorage({ [GAMES_FAVORITES_STORAGE_KEY]: "{bad" });
  assert.deepEqual(loadLocalFavorites(storage), []);
});

test("save and toggle preserve valid favorite ids", () => {
  const storage = memoryStorage();
  const saved = saveLocalFavorites(storage, ["match", "runner"]);
  assert.equal(saved.ok, true);
  assert.deepEqual(loadLocalFavorites(storage), ["match", "runner"]);
  assert.deepEqual(toggleFavorite(saved.favorites, "match"), ["runner"]);
  assert.deepEqual(toggleFavorite(["runner"], "bubble"), ["runner", "bubble"]);
});

test("storage failures do not fabricate a successful save", () => {
  const storage = { setItem() { throw new Error("quota"); } };
  const result = saveLocalFavorites(storage, ["match"]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.favorites, ["match"]);
});
