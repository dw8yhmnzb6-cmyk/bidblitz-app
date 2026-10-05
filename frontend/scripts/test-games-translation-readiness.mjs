import test from "node:test";
import assert from "node:assert/strict";
import languages from "../src/config/gamesLanguages.json" with { type: "json" };
import reviewManifest from "../src/config/gamesTranslationReview.json" with { type: "json" };
import { buildGamesTranslationReadiness } from "../src/config/gamesTranslationReadiness.mjs";

test("translation readiness separates copy presence from human review", () => {
  const readiness = buildGamesTranslationReadiness({ languageOptions: languages, review: reviewManifest });

  assert.equal(readiness.registeredOptionCount, 51);
  assert.equal(readiness.localizedOptionCount, 50);
  assert.equal(readiness.coreCopyPresentCount, 51);
  assert.deepEqual(readiness.missingCoreTranslationCodes, []);
  assert.deepEqual(readiness.unknownCoreTranslationCodes, []);
  assert.equal(readiness.structurallyReady, true);
  assert.equal(
    readiness.humanReviewedCount + readiness.pendingHumanReviewCount,
    readiness.localizedOptionCount,
  );
  assert.equal(
    readiness.humanReviewReady,
    readiness.pendingHumanReviewCount === 0,
  );
});

test("translation readiness rejects unknown human-review claims", () => {
  assert.throws(
    () =>
      buildGamesTranslationReadiness({
        languageOptions: [
          { code: "en", rtl: false },
          { code: "de", rtl: false },
        ],
        coreTranslationCodes: ["en", "de"],
        review: {
          schemaVersion: 1,
          sourceLanguage: "en",
          humanReviewed: ["xx"],
        },
      }),
    /not registered/,
  );
});

test("translation readiness does not count the source language as a reviewed translation", () => {
  assert.throws(
    () =>
      buildGamesTranslationReadiness({
        languageOptions: [
          { code: "en", rtl: false },
          { code: "de", rtl: false },
        ],
        coreTranslationCodes: ["en", "de"],
        review: {
          schemaVersion: 1,
          sourceLanguage: "en",
          humanReviewed: ["en"],
        },
      }),
    /Source language/,
  );
});

test("translation readiness reports missing core copy without hiding it behind fallback", () => {
  const readiness = buildGamesTranslationReadiness({
    languageOptions: [
      { code: "en", rtl: false },
      { code: "de", rtl: false },
      { code: "sq", rtl: false },
    ],
    coreTranslationCodes: ["en", "de"],
    review: {
      schemaVersion: 1,
      sourceLanguage: "en",
      humanReviewed: [],
    },
  });

  assert.equal(readiness.structurallyReady, false);
  assert.deepEqual(readiness.missingCoreTranslationCodes, ["sq"]);
  assert.equal(readiness.coreCopyPresentCount, 2);
});
