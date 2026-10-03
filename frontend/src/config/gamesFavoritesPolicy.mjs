const GAME_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const GAMES_FAVORITES_STORAGE_KEY = "bidblitz_games_favorites_v1";

export function normalizeFavoriteIds(values) {
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== "string") continue;
    const id = value.trim().toLowerCase();
    if (!GAME_ID.test(id) || out.includes(id)) continue;
    out.push(id);
    if (out.length === 100) break;
  }
  return out;
}

export function loadLocalFavorites(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(GAMES_FAVORITES_STORAGE_KEY) || "[]");
    return normalizeFavoriteIds(parsed);
  } catch {
    return [];
  }
}

export function saveLocalFavorites(storage, values) {
  const normalized = normalizeFavoriteIds(values);
  try {
    storage?.setItem(GAMES_FAVORITES_STORAGE_KEY, JSON.stringify(normalized));
    return { ok: true, favorites: normalized };
  } catch {
    return { ok: false, favorites: normalized };
  }
}

export function toggleFavorite(values, gameId) {
  const favorites = normalizeFavoriteIds(values);
  const id = String(gameId || "").trim().toLowerCase();
  if (!GAME_ID.test(id)) return favorites;
  return favorites.includes(id)
    ? favorites.filter((item) => item !== id)
    : normalizeFavoriteIds([...favorites, id]);
}
