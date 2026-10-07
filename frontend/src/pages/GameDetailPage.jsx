import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Gamepad2, Heart, Languages, Loader2, ShieldCheck, Star } from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { useUser } from "../store";
import GameReviewsPanel from "../components/GameReviewsPanel";
import GamesLanguageSelect from "../components/GamesLanguageSelect";
import GamesPersonalRankingCard from "../components/GamesPersonalRankingCard";
import gameLanguages from "../config/gamesLanguages.json";
import { resolveLocale } from "../config/languagePolicy.mjs";
import { loadLocalFavorites, saveLocalFavorites, toggleFavorite } from "../config/gamesFavoritesPolicy.mjs";
import { recordLocalRecent } from "../config/gamesRecentPolicy.mjs";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
const ART = "/game-assets/match-preview/assets";
const RECENT_API = `${BACKEND}/api/games/recent`;
const ANALYTICS_API = `${BACKEND}/api/games/analytics`;

const COPY = {
  de: {
    back: "Zurück zu Games", firstParty: "BIDBLITZ ORIGINAL", community: "COMMUNITY-SPIEL",
    puzzle: "Puzzle", arcade: "Arcade", strategy: "Strategie", sports: "Sport",
    matchDescription: "Kombiniere Symbole, löse Kettenreaktionen und entdecke 30 Level in der ersten BidBlitz-Spielwelt.",
    bubbleDescription: "Räume große Gruppen gleichfarbiger Bubbles, plane Ketten und entdecke 20 schwebende Insel-Level.",
    runnerDescription: "Wechsle zwischen drei Spuren, weiche Hindernissen aus und sammle Lichtpunkte auf 15 Neon-Strecken.", farmDescription: "Baue Felder, Tiere und Gebäude aus, plane Bewässerung und Ernte nach Wetter und Jahreszeiten und entwickle deine Farm Schritt für Schritt.", planned: "In Planung",
    play: "Spielvorschau öffnen", openGame: "Spiel sicher öffnen", favorite: "Merken", unfavorite: "Nicht mehr merken",
    languages: "Spielsprachen", version: "Veröffentlichte Version", rating: "Bewertung", reviews: "Bewertungen",
    loading: "Spiel wird geladen…", missing: "Dieses Spiel ist nicht verfügbar.", retry: "Neu laden",
    catalogError: "Spieldetails konnten nicht geladen werden.", favoriteError: "Merkliste konnte nicht gespeichert werden.",
    safety: "Community-Spiele laufen auf einer getrennten, cookie-freien Games-Origin. BidBlitz-Login und Wallet bleiben isoliert.",
    noMoney: "Diese Seite löst keine Einsätze oder Zahlungen aus.", deviceFavorite: "Auf diesem Gerät gespeichert", accountFavorite: "Im BidBlitz-Konto gespeichert",
  },
  en: {
    back: "Back to Games", firstParty: "BIDBLITZ ORIGINAL", community: "COMMUNITY GAME",
    puzzle: "Puzzle", arcade: "Arcade", strategy: "Strategy", sports: "Sports",
    matchDescription: "Match symbols, trigger chain reactions and explore 30 levels in BidBlitz's first game world.",
    bubbleDescription: "Clear large groups of matching bubbles, plan chains and explore 20 floating-island levels.",
    runnerDescription: "Switch between three lanes, dodge obstacles and collect light shards across 15 neon tracks.", farmDescription: "Grow fields, animals and buildings, plan irrigation and harvests around weather and seasons, and expand your farm step by step.", planned: "Planned",
    play: "Open game preview", openGame: "Open game safely", favorite: "Save", unfavorite: "Remove saved game",
    languages: "Game languages", version: "Published version", rating: "Rating", reviews: "Reviews",
    loading: "Loading game…", missing: "This game is not available.", retry: "Reload",
    catalogError: "Could not load game details.", favoriteError: "Could not save this game.",
    safety: "Community games run on a separate cookie-free Games origin. BidBlitz login and wallet remain isolated.",
    noMoney: "This page does not trigger wagers or payments.", deviceFavorite: "Saved on this device", accountFavorite: "Saved in your BidBlitz account",
  },
  sq: {
    back: "Kthehu te Games", firstParty: "BIDBLITZ ORIGINAL", community: "LOJË E KOMUNITETIT",
    puzzle: "Puzzle", arcade: "Arcade", strategy: "Strategji", sports: "Sport",
    matchDescription: "Kombino simbolet, krijo reaksione zinxhir dhe zbulo 30 nivele në botën e parë të lojërave BidBlitz.",
    bubbleDescription: "Pastro grupe të mëdha flluskash me të njëjtën ngjyrë dhe zbulo 20 nivele me ishuj fluturues.",
    runnerDescription: "Ndërro mes tri korsive, shmang pengesat dhe mblidh dritë në 15 pista neon.", farmDescription: "Zgjero arat, kafshët dhe ndërtesat, planifiko ujitjen dhe korrjen sipas motit dhe stinëve dhe zhvillo fermën hap pas hapi.", planned: "Në planifikim",
    play: "Hap provën e lojës", openGame: "Hap lojën në mënyrë të sigurt", favorite: "Ruaj", unfavorite: "Hiqe nga të ruajturat",
    languages: "Gjuhët e lojës", version: "Versioni i publikuar", rating: "Vlerësimi", reviews: "Vlerësime",
    loading: "Po ngarkohet loja…", missing: "Kjo lojë nuk është e disponueshme.", retry: "Ringarko",
    catalogError: "Detajet e lojës nuk u ngarkuan.", favoriteError: "Loja nuk u ruajt.",
    safety: "Lojërat e komunitetit ekzekutohen në një Games-origin të ndarë pa cookie. Hyrja dhe wallet-i BidBlitz mbeten të izoluar.",
    noMoney: "Kjo faqe nuk nis baste ose pagesa.", deviceFavorite: "Ruajtur në këtë pajisje", accountFavorite: "Ruajtur në llogarinë BidBlitz",
  },
};

const FIRST_PARTY = {
  match: {
    id: "match",
    title: "BidBlitz Match",
    category: "Puzzle",
    languages: ["de"],
    source: "first_party",
    version_number: 1,
  },
  bubble: {
    id: "bubble",
    title: "Bubble Islands",
    category: "Puzzle",
    languages: ["de"],
    source: "first_party",
    version_number: 1,
  },
  runner: {
    id: "runner",
    title: "Blitz Runner",
    category: "Arcade",
    languages: ["de"],
    source: "first_party",
    version_number: 1,
  },
  farm: {
    id: "farm",
    title: "BidBlitz Farm",
    category: "Strategy",
    languages: ["de", "en", "sq"],
    source: "first_party",
    version_number: 0,
    planned: true,
  },
};

function categoryLabel(category, c) {
  if (category === "Puzzle") return c.puzzle;
  if (category === "Arcade") return c.arcade;
  if (category === "Strategy") return c.strategy;
  if (category === "Sports") return c.sports;
  return category || "—";
}

export default function GameDetailPage({ gameId, onBack, onNavigate }) {
  const { lang } = useI18n();
  const user = useUser();
  const locale = resolveLocale(lang, Object.keys(COPY));
  const c = COPY[locale];
  const selectedCode = resolveLocale(lang, gameLanguages.map(({ code }) => code));
  const rtl = gameLanguages.find(({ code }) => code === selectedCode)?.rtl;
  const normalizedId = String(gameId || "").trim().toLowerCase();

  const initialFirstParty = FIRST_PARTY[normalizedId] || null;
  const [game, setGame] = useState(initialFirstParty);
  const [loading, setLoading] = useState(!initialFirstParty);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({ count: 0, average: null });
  const [favorites, setFavorites] = useState([]);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteError, setFavoriteError] = useState("");
  const [favoriteMode, setFavoriteMode] = useState("device");

  const loadGame = useCallback(async () => {
    setError("");
    if (FIRST_PARTY[normalizedId]) {
      setGame(FIRST_PARTY[normalizedId]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND}/api/games/catalog/${encodeURIComponent(normalizedId)}`, {
        credentials: "omit",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.detail || c.catalogError), { status: response.status });
      setGame(body);
    } catch (loadError) {
      setGame(null);
      setError(loadError?.status === 404 ? c.missing : c.catalogError);
    } finally {
      setLoading(false);
    }
  }, [normalizedId, c.catalogError, c.missing]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  useEffect(() => {
    if (!game?.id) return undefined;
    const controller = new AbortController();
    fetch(`${BACKEND}/api/games/reviews/summaries?game_ids=${encodeURIComponent(game.id)}`, {
      credentials: "omit",
      signal: controller.signal,
    })
      .then(async (response) => response.ok ? response.json() : { summaries: {} })
      .then((body) => {
        if (!controller.signal.aborted) {
          setSummary(body?.summaries?.[game.id] || { count: 0, average: null });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setSummary({ count: 0, average: null });
      });
    return () => controller.abort();
  }, [game?.id]);

  useEffect(() => {
    if (!user.sessionReady) return undefined;
    const controller = new AbortController();
    setFavoriteError("");
    if (!user.isAuthenticated) {
      setFavorites(loadLocalFavorites(globalThis.localStorage));
      setFavoriteMode("device");
      return () => controller.abort();
    }
    setFavoriteMode("account");
    fetch(`${BACKEND}/api/games/profile`, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("favorites");
        return response.json();
      })
      .then((body) => {
        if (!controller.signal.aborted) setFavorites(Array.isArray(body.favorites) ? body.favorites : []);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted && loadError.name !== "AbortError") setFavoriteError(c.favoriteError);
      });
    return () => controller.abort();
  }, [user.isAuthenticated, user.sessionReady, c.favoriteError]);

  const languageLabels = useMemo(() => {
    const byCode = new Map(gameLanguages.map((entry) => [entry.code, entry.label]));
    return (game?.languages || []).map((code) => byCode.get(code) || code);
  }, [game?.languages]);

  const changeFavorite = async () => {
    if (!game?.id || favoriteBusy) return;
    const next = toggleFavorite(favorites, game.id);
    const shouldAdd = next.includes(game.id);
    setFavoriteError("");
    if (!user.isAuthenticated) {
      const result = saveLocalFavorites(globalThis.localStorage, next);
      setFavorites(result.favorites);
      if (!result.ok) setFavoriteError(c.favoriteError);
      return;
    }

    setFavoriteBusy(true);
    try {
      const response = await fetch(`${BACKEND}/api/games/profile/favorites/${encodeURIComponent(game.id)}`, {
        method: shouldAdd ? "POST" : "DELETE",
        credentials: "include",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "favorite");
      setFavorites(Array.isArray(body.favorites) ? body.favorites : next);
    } catch {
      setFavoriteError(c.favoriteError);
    } finally {
      setFavoriteBusy(false);
    }
  };

  const recordRecent = () => {
    if (!game?.id) return;
    fetch(`${ANALYTICS_API}/${encodeURIComponent(game.id)}/launch`, {
      method: "POST",
      credentials: "omit",
      keepalive: true,
    }).catch(() => {});

    const now = new Date().toISOString();
    if (!user.isAuthenticated) {
      recordLocalRecent(globalThis.localStorage, game.id, now);
      return;
    }
    fetch(`${RECENT_API}/${encodeURIComponent(game.id)}`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  };

  const isFavorite = Boolean(game?.id && favorites.includes(game.id));
  const isFirstParty = Boolean(game?.id && FIRST_PARTY[game.id]);
  const firstPartyRoute = game?.id === "match" ? "/games/match" : game?.id === "bubble" ? "/games/bubble" : game?.id === "runner" ? "/games/runner" : null;
  const description = game?.id === "match" ? c.matchDescription : game?.id === "bubble" ? c.bubbleDescription : game?.id === "runner" ? c.runnerDescription : game?.id === "farm" ? c.farmDescription : game?.description || "";
  const cover = game?.id === "match" ? `${ART}/match.webp` : game?.id === "bubble" ? `${ART}/bubble.webp` : game?.id === "runner" ? `${ART}/runner.webp` : null;

  return (
    <main lang={locale} dir={rtl ? "rtl" : "ltr"} className="min-h-screen bg-[#061329] pb-24 text-white" data-testid="game-detail-page">
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-7">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm hover:bg-white/10"><ArrowLeft size={18} />{c.back}</button>
          <div className="flex items-center gap-3 font-black tracking-widest"><span className="rounded-xl bg-cyan-300 px-3 py-2 text-[#061329]">B</span><span>BIDBLITZ <span className="text-cyan-300">GAMES</span></span></div>
        </header>
        <GamesLanguageSelect textLocale={locale} />

        {loading ? <div className="mt-16 flex items-center justify-center gap-3 text-white/60"><Loader2 size={20} className="animate-spin" />{c.loading}</div>
          : !game ? <section className="mt-12 rounded-3xl border border-dashed border-white/15 p-8 text-center">
            <Gamepad2 size={44} className="mx-auto text-white/30" />
            <h1 className="mt-4 text-2xl font-bold">{c.missing}</h1>
            <button onClick={loadGame} className="mt-5 rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-[#061329]">{c.retry}</button>
          </section>
            : <>
              <section className="mt-8 overflow-hidden rounded-[32px] border border-cyan-200/15 bg-gradient-to-br from-[#173b66] to-[#0b1e37] shadow-2xl">
                <div className="grid lg:grid-cols-[1.05fr_.95fr]">
                  <div className="relative min-h-[280px] bg-[radial-gradient(circle_at_50%_30%,rgba(65,228,244,.25),transparent_45%),linear-gradient(135deg,#113d73,#202057)]">
                    {cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="flex h-full min-h-[280px] items-center justify-center"><Gamepad2 size={110} strokeWidth={1} className="text-cyan-200/60" /></div>}
                  </div>
                  <div className="p-6 sm:p-8">
                    <span className="inline-flex rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-bold tracking-wider text-cyan-100">{isFirstParty ? c.firstParty : c.community}</span>
                    <p className="mt-5 text-sm text-cyan-200">{categoryLabel(game.category, c)}</p>
                    <h1 className="mt-2 text-3xl font-black sm:text-5xl">{game.title}</h1>
                    <p className="mt-4 text-sm leading-relaxed text-sky-100/75 sm:text-base">{description}</p>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3">
                        <p className="text-[10px] text-white/45">{c.rating}</p>
                        <p className="mt-1 flex items-center gap-1 text-lg font-bold">{summary.average == null ? "—" : Number(summary.average).toFixed(1)} <Star size={15} className="fill-current text-amber-300" /></p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3">
                        <p className="text-[10px] text-white/45">{c.reviews}</p>
                        <p className="mt-1 text-lg font-bold">{Number(summary.count || 0)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3">
                        <p className="text-[10px] text-white/45">{c.version}</p>
                        <p className="mt-1 text-lg font-bold">v{Number(game.version_number || 1)}</p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                      {isFirstParty && firstPartyRoute ? <button onClick={() => { recordRecent(); onNavigate(firstPartyRoute); }} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-[#061329]"><Gamepad2 size={18} />{c.play}</button>
                        : isFirstParty ? <span className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70"><Gamepad2 size={18} />{c.planned}</span>
                          : <a href={game.public_url} target="_blank" rel="noopener noreferrer" onClick={recordRecent} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-[#061329]"><ExternalLink size={18} />{c.openGame}</a>}
                      <button onClick={changeFavorite} disabled={favoriteBusy} aria-pressed={isFavorite} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold disabled:opacity-50 ${isFavorite ? "border-cyan-300 bg-cyan-300/15 text-cyan-100" : "border-white/20 bg-white/5 text-white/80"}`}><Heart size={18} fill={isFavorite ? "currentColor" : "none"} />{isFavorite ? c.unfavorite : c.favorite}</button>
                    </div>
                    <p className="mt-3 text-[11px] text-white/40">{favoriteMode === "account" ? c.accountFavorite : c.deviceFavorite}</p>
                    {favoriteError && <p role="alert" className="mt-2 text-xs text-rose-200">{favoriteError}</p>}
                  </div>
                </div>
              </section>

              <section className="mt-6 rounded-3xl border border-white/10 bg-[#0a1d36] p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold"><Languages size={19} className="text-cyan-300" />{c.languages}</h2>
                <div className="mt-4 flex flex-wrap gap-2">{languageLabels.map((label) => <span key={label} className="rounded-full border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-white/70">{label}</span>)}</div>
              </section>

              {isFirstParty && firstPartyRoute && <GamesPersonalRankingCard gameId={game.id} locale={locale} />}

              {!isFirstParty && <p className="mt-5 flex items-start gap-2 rounded-2xl border border-cyan-200/10 bg-cyan-300/5 p-4 text-xs leading-relaxed text-cyan-50/70"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-cyan-300" />{c.safety}</p>}
              <p className="mt-3 text-xs text-white/40">{c.noMoney}</p>

              {(!isFirstParty || firstPartyRoute) && <GameReviewsPanel gameId={game.id} gameTitle={game.title} locale={locale} />}
            </>}
        {error && !loading && <p role="alert" className="mt-4 text-center text-xs text-rose-200">{error}</p>}
      </div>
    </main>
  );
}
