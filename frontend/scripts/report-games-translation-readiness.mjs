import languages from "../src/config/gamesLanguages.json" with { type: "json" };
import reviewManifest from "../src/config/gamesTranslationReview.json" with { type: "json" };
import { buildGamesTranslationReadiness } from "../src/config/gamesTranslationReadiness.mjs";

const readiness = buildGamesTranslationReadiness({ languageOptions: languages, review: reviewManifest });

const strict = process.argv.includes("--require-human-reviewed");

console.log(
  [
    "BidBlitz Games translation readiness",
    `- registered options: ${readiness.registeredOptionCount}`,
    `- localized options: ${readiness.localizedOptionCount}`,
    `- core copy present: ${readiness.coreCopyPresentCount}/${readiness.registeredOptionCount}`,
    `- human reviewed: ${readiness.humanReviewedCount}/${readiness.localizedOptionCount}`,
    `- pending human review: ${readiness.pendingHumanReviewCount}`,
  ].join("\n"),
);

if (readiness.pendingHumanReviewCodes.length > 0) {
  console.log(
    `- pending codes: ${readiness.pendingHumanReviewCodes.join(", ")}`,
  );
}

if (!readiness.structurallyReady) {
  console.error(
    [
      "Games translation registry is structurally inconsistent.",
      `Missing core copy: ${readiness.missingCoreTranslationCodes.join(", ") || "none"}`,
      `Unknown core codes: ${readiness.unknownCoreTranslationCodes.join(", ") || "none"}`,
    ].join("\n"),
  );
  process.exitCode = 1;
} else if (strict && !readiness.humanReviewReady) {
  console.error(
    "Games translations are not launch-ready: human review is still pending.",
  );
  process.exitCode = 1;
}
