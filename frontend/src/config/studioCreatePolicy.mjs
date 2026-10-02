export function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (bytes.some(Boolean)) return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function prepareCreateAttempt(previous, payload) {
  if (previous?.payload === payload && previous?.key) return previous;
  return { key: createIdempotencyKey(), payload };
}

export function uncertainCreateError(error) {
  return !error?.status || error.status >= 500 || error.name === "AbortError";
}
