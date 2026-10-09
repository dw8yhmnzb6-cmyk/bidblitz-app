/** Resolve exact/script variants before language fallbacks; keep registered legacy options. */
export function resolveLocale(value, codes, fallback = "en") {
  if (typeof value !== "string") return fallback;
  const tag = value.trim().replaceAll("_", "-");
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(tag)) return fallback;
  const lookup = (candidate) => codes.find((code) => code.toLowerCase() === candidate.toLowerCase());
  const exact = lookup(tag);
  if (exact) return exact;
  const parts = tag.split("-");
  for (let end = parts.length - 1; end > 1; end -= 1) {
    const parent = lookup(parts.slice(0, end).join("-"));
    if (parent) return parent;
  }
  if (parts[0].toLowerCase() === "zh") {
    const script = parts.find((part) => /^(hans|hant)$/i.test(part));
    const traditional = script ? script.toLowerCase() === "hant" : parts.some((part) => /^(tw|hk|mo)$/i.test(part));
    const chinese = lookup(traditional ? "zh-Hant" : "zh-Hans");
    if (chinese) return chinese;
  }
  return lookup(parts[0]) || fallback;
}

export function readStoredLocale(storage, key, codes, fallback = "de") {
  try {
    return resolveLocale(storage.getItem(key), codes, fallback);
  } catch {
    return fallback;
  }
}

export function persistLocale(storage, key, code) {
  try {
    storage.setItem(key, code);
    return true;
  } catch {
    return false;
  }
}
