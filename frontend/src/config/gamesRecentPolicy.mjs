const STORAGE_KEY = "bidblitz_games_recent";
const MAX_RECENT = 20;
const GAME_ID = /^[a-z0-9][a-z0-9_-]{0,79}$/;

function validId(value) {
  const id = String(value || "").trim().toLowerCase();
  return GAME_ID.test(id) ? id : "";
}

export function loadLocalRecent(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    return parsed
      .map((row) => ({
        game_id: validId(row?.game_id),
        last_played_at: typeof row?.last_played_at === "string" ? row.last_played_at : "",
      }))
      .filter((row) => row.game_id && !seen.has(row.game_id) && seen.add(row.game_id))
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function recordLocalRecent(storage, gameId, now = new Date().toISOString()) {
  const id = validId(gameId);
  if (!id) return { ok: false, games: loadLocalRecent(storage) };
  const current = loadLocalRecent(storage).filter((row) => row.game_id !== id);
  const games = [{ game_id: id, last_played_at: now }, ...current].slice(0, MAX_RECENT);
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(games));
    return { ok: true, games };
  } catch {
    return { ok: false, games: current };
  }
}

export function clearLocalRecent(storage) {
  try {
    storage?.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export { MAX_RECENT };
