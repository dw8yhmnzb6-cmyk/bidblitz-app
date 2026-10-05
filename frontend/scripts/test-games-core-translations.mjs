import test from "node:test";
import assert from "node:assert/strict";
import languages from "../src/config/gamesLanguages.json" with { type: "json" };
import {
  GAMES_CORE_TRANSLATION_CODES,
  getGamesCoreCopy,
  hasGamesCoreTranslation,
} from "../src/config/gamesCoreTranslations.mjs";

test("all registered Games language options have core translated copy", () => {
  const codes = languages.map(({ code }) => code);
  assert.equal(codes.length, 51);
  assert.deepEqual(new Set(GAMES_CORE_TRANSLATION_CODES), new Set(codes));
  for (const code of codes) {
    assert.equal(hasGamesCoreTranslation(code), true, code);
    const copy = getGamesCoreCopy(code);
    for (const key of ["back", "title", "subtitle", "search", "all", "play", "planned", "details", "continueGame", "community", "openPublished", "language"]) {
      assert.equal(typeof copy[key], "string", `${code}.${key}`);
      assert.ok(copy[key].trim().length >= 2, `${code}.${key}`);
    }
  }
});

test("script-specific Chinese and RTL languages resolve to distinct translated copy", () => {
  assert.notEqual(getGamesCoreCopy("zh-Hans").search, getGamesCoreCopy("zh-Hant").search);
  assert.equal(getGamesCoreCopy("ar").language, "اللغة");
  assert.equal(getGamesCoreCopy("he").language, "שפה");
  assert.equal(getGamesCoreCopy("fa").language, "زبان");
  assert.equal(getGamesCoreCopy("ur").language, "زبان");
});

test("unknown code fails safely to English core copy", () => {
  assert.deepEqual(getGamesCoreCopy("xx"), getGamesCoreCopy("en"));
});
