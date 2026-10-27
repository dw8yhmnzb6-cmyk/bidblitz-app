// Known translation namespaces used by the audited app screens.
// Numeric thousands/decimal separators and ordinary web domains are not keys.
const KEY_PATTERN = /\b(?:auction|auth|common|nav|taxi|wallet|home|more|loyalty|kyc|error|errors)\.[a-z_][a-z0-9_.-]*\b/i;

function findVisibleTranslationKey(text) {
  return String(text || "").match(KEY_PATTERN)?.[0] || null;
}

module.exports = { findVisibleTranslationKey };
