import { GAMES_CORE_TRANSLATION_CODES } from "./gamesCoreTranslations.mjs";

function unique(values) {
  return [...new Set(values)];
}

function assertUnique(label, values) {
  if (unique(values).length !== values.length) {
    throw new Error(`${label} contains duplicate language codes`);
  }
}

export function buildGamesTranslationReadiness({
  languageOptions,
  coreTranslationCodes = GAMES_CORE_TRANSLATION_CODES,
  review,
} = {}) {
  if (!Array.isArray(languageOptions)) {
    throw new Error("Games language registry is required");
  }
  if (!review || typeof review !== "object") {
    throw new Error("Games translation review manifest is required");
  }
  const registeredCodes = languageOptions.map(({ code }) => code);
  assertUnique("Games language registry", registeredCodes);

  const registered = new Set(registeredCodes);
  const sourceLanguage = review?.sourceLanguage || "en";
  if (!registered.has(sourceLanguage)) {
    throw new Error(`Games source language is not registered: ${sourceLanguage}`);
  }

  const reviewedCodes = Array.isArray(review?.humanReviewed)
    ? review.humanReviewed
    : [];
  assertUnique("Games human-review manifest", reviewedCodes);

  for (const code of reviewedCodes) {
    if (!registered.has(code)) {
      throw new Error(`Human-reviewed language is not registered: ${code}`);
    }
    if (code === sourceLanguage) {
      throw new Error(
        `Source language must not be counted as a reviewed translation: ${code}`,
      );
    }
  }

  const coreCodes = unique(coreTranslationCodes);
  const core = new Set(coreCodes);
  const missingCoreTranslationCodes = registeredCodes.filter(
    (code) => !core.has(code),
  );
  const unknownCoreTranslationCodes = coreCodes.filter(
    (code) => !registered.has(code),
  );

  const localizedCodes = registeredCodes.filter(
    (code) => code !== sourceLanguage,
  );
  const reviewed = new Set(reviewedCodes);
  const pendingHumanReviewCodes = localizedCodes.filter(
    (code) => !reviewed.has(code),
  );

  return {
    schemaVersion: Number(review?.schemaVersion || 1),
    sourceLanguage,
    registeredOptionCount: registeredCodes.length,
    localizedOptionCount: localizedCodes.length,
    coreCopyPresentCount:
      registeredCodes.length - missingCoreTranslationCodes.length,
    humanReviewedCount: reviewedCodes.length,
    pendingHumanReviewCount: pendingHumanReviewCodes.length,
    missingCoreTranslationCodes,
    unknownCoreTranslationCodes,
    humanReviewedCodes: [...reviewedCodes],
    pendingHumanReviewCodes,
    structurallyReady:
      missingCoreTranslationCodes.length === 0 &&
      unknownCoreTranslationCodes.length === 0,
    humanReviewReady: pendingHumanReviewCodes.length === 0,
  };
}

