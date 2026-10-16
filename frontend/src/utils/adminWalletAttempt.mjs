// Keep the same financial intent across retries, tab changes and page reloads.
// Credentials are supplied separately for every request and never persisted here.
export function createAdminWalletAttempt(storage, scope, newKey = () => crypto.randomUUID()) {
  const storageKey = `bidblitz.admin_wallet_attempt.v1:${scope}`;
  const fields = ["operation", "user_id", "amount_eur", "amount_blz", "reason"];
  const intentOf = (value) => Object.fromEntries(fields.map((field) => [field, value[field] ?? null]));
  const read = () => {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved.key || !saved.intent || !fields.every((field) => field in saved.intent)) {
      throw new Error("Gespeicherte Buchung konnte nicht gelesen werden. Bitte im Buchungslog prüfen.");
    }
    return saved;
  };
  return {
    read,
    begin(value) {
      const intent = intentOf(value);
      const previous = read();
      if (previous) {
        if (JSON.stringify(previous.intent) !== JSON.stringify(intent)) {
          throw new Error("Eine Buchung ist noch offen. Bitte die offene Buchung laden und erneut bestätigen.");
        }
        return previous.key;
      }
      const key = newKey();
      storage.setItem(storageKey, JSON.stringify({ key, intent }));
      return key;
    },
    complete(key) {
      if (read()?.key === key) storage.removeItem(storageKey);
    },
  };
}
