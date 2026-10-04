import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Gamepad2, Heart, Layers3, Search, Sparkles } from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { useUser } from "../store";
import GamesLanguageSelect from "../components/GamesLanguageSelect";
import GameReviewsPanel from "../components/GameReviewsPanel";
import gameLanguages from "../config/gamesLanguages.json";
import { resolveLocale } from "../config/languagePolicy.mjs";
import { loadLocalFavorites, saveLocalFavorites, toggleFavorite } from "../config/gamesFavoritesPolicy.mjs";

const ART = "/game-assets/match-preview/assets";
const CATALOG_API = `${process.env.REACT_APP_BACKEND_URL || ""}/api/games/catalog`;
const PROFILE_API = `${process.env.REACT_APP_BACKEND_URL || ""}/api/games/profile`;
const COPY = {
  de: {
    back: "Zurück", title: "Dein nächstes Abenteuer.", subtitle: "Entdecke die ersten Spielwelten von BidBlitz.",
    search: "Spiel suchen", all: "Alle Spiele", puzzle: "Puzzle", arcade: "Arcade", count: "Spiele",
    first: "UNSER ERSTES SPIEL", matchText: "Kombiniere Symbole, löse Kettenreaktionen und entdecke 30 Level.",
    play: "Spielvorschau öffnen", planned: "In Planung", bubbleText: "Eine neue Puzzlewelt voller schwebender Inseln.",
    runnerText: "Ein Laufabenteuer auf leuchtenden Wegen.", empty: "Keine Spiele gefunden.", clear: "Filter zurücksetzen",
    studio: "Dein Spiel auf BidBlitz", studioText: "Bereite dein eigenes Spiel im Entwicklerstudio vor.", openStudio: "Entwicklerstudio öffnen",
    local: "Match ist eine lokale Vorschau auf Deutsch. Fortschritt bleibt auf diesem Gerät. Testmünzen haben keinen Geldwert.",
    plannedText: "Weitere Spiele sind in Vorbereitung. Ein Veröffentlichungstermin steht noch nicht fest.", strategy: "Strategie", sports: "Sport", community: "Von Entwicklern", openPublished: "Spiel öffnen", catalogError: "Veröffentlichte Community-Spiele konnten nicht geladen werden.", favorite: "Merken", unfavorite: "Nicht mehr merken", favoriteAccount: "Merkliste wird in deinem BidBlitz-Konto gespeichert.", favoriteDevice: "Merkliste wird nur auf diesem Gerät gespeichert.", favoriteError: "Merkliste konnte nicht synchronisiert werden.",
  },
  en: {
    back: "Back", title: "Your next adventure.", subtitle: "Discover BidBlitz's first game worlds.",
    search: "Search games", all: "All games", puzzle: "Puzzle", arcade: "Arcade", count: "Games",
    first: "OUR FIRST GAME", matchText: "Match symbols, trigger chain reactions and explore 30 levels.",
    play: "Open game preview", planned: "Planned", bubbleText: "A new puzzle world full of floating islands.",
    runnerText: "A running adventure on glowing paths.", empty: "No games found.", clear: "Reset filters",
    studio: "Your game on BidBlitz", studioText: "Prepare your own game in the developer studio.", openStudio: "Open developer studio",
    local: "Match is a local preview in German. Progress stays on this device. Test coins have no monetary value.",
    plannedText: "More games are being prepared. A release date has not been set.", strategy: "Strategy", sports: "Sports", community: "From developers", openPublished: "Open game", catalogError: "Published community games could not be loaded.", favorite: "Save", unfavorite: "Remove saved game", favoriteAccount: "Saved games are stored in your BidBlitz account.", favoriteDevice: "Saved games are stored only on this device.", favoriteError: "Could not sync saved games.",
  },
  sq: {
    back: "Kthehu", title: "Aventura jote e radhës.", subtitle: "Zbulo botët e para të lojërave BidBlitz.",
    search: "Kërko lojë", all: "Të gjitha", puzzle: "Puzzle", arcade: "Arcade", count: "Lojëra",
    first: "LOJA JONË E PARË", matchText: "Kombino simbolet, krijo reaksione zinxhir dhe zbulo 30 nivele.",
    play: "Hap provën e lojës", planned: "Në planifikim", bubbleText: "Një botë e re puzzle me ishuj fluturues.",
    runnerText: "Një aventurë vrapimi në rrugë të ndriçuara.", empty: "Nuk u gjetën lojëra.", clear: "Hiq filtrat",
    studio: "Loja jote në BidBlitz", studioText: "Përgatit lojën tënde në studion e zhvilluesit.", openStudio: "Hap studion e zhvilluesit",
    local: "Match është një provë lokale në gjermanisht. Progresi ruhet në këtë pajisje. Monedhat e provës nuk kanë vlerë monetare.",
    plannedText: "Lojëra të tjera po përgatiten. Data e publikimit ende nuk është caktuar.", strategy: "Strategji", sports: "Sport", community: "Nga zhvilluesit", openPublished: "Hap lojën", catalogError: "Lojërat e publikuara të komunitetit nuk u ngarkuan.", favorite: "Ruaj", unfavorite: "Hiqe nga të ruajturat", favoriteAccount: "Lojërat e ruajtura ruhen në llogarinë tënde BidBlitz.", favoriteDevice: "Lojërat e ruajtura ruhen vetëm në këtë pajisje.", favoriteError: "Lista e lojërave nuk u sinkronizua.",
  },
};

const FIRST_PARTY_GAMES = [
  { id: "match", title: "BidBlitz Match", category: "Puzzle", text: "matchText", available: true },
  { id: "bubble", title: "Bubble Islands", category: "Puzzle", text: "bubbleText", available: false },
  { id: "runner", title: "Blitz Runner", category: "Arcade", text: "runnerText", available: false },
];

export default function GamesPage({ onBack, onNavigate, preview = false }) {
  const { lang } = useI18n();
  const user = useUser();
  const locale = resolveLocale(lang, Object.keys(COPY));
  const c = COPY[locale];
  const selectedCode = resolveLocale(lang, gameLanguages.map(({ code }) => code));
  const rtl = gameLanguages.find(({ code }) => code === selectedCode)?.rtl;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [publishedGames, setPublishedGames] = useState([]);
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(CATALOG_API, { signal: controller.signal, credentials: "omit" })
      .then(async (response) => {
        if (!response.ok) throw new Error("catalog");
        return response.json();
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        const rows = Array.isArray(body.games) ? body.games : [];
        setPublishedGames(rows
          .filter((game) => game && typeof game.id === "string" && typeof game.title === "string" && typeof game.public_url === "string")
          .map((game) => ({
            id: game.id,
            title: game.title,
            category: game.category || "Arcade",
            description: game.description || "",
            languages: Array.isArray(game.languages) ? game.languages : [],
            publicUrl: game.public_url,
            versionNumber: game.version_number,
            available: true,
            external: true,
          })));
        setCatalogError("");
      })
      .catch((error) => {
        if (!controller.signal.aborted && error.name !== "AbortError") setCatalogError(c.catalogError);
      });
    return () => controller.abort();
  }, [c.catalogError]);
  const [favorites, setFavorites] = useState([]);
  const [favoriteBusy, setFavoriteBusy] = useState("");
  const [favoriteError, setFavoriteError] = useState("");
  const [favoritesMode, setFavoritesMode] = useState("device");

  useEffect(() => {
    if (!user.sessionReady) return undefined;
    const controller = new AbortController();
    setFavoriteError("");
    if (!user.isAuthenticated) {
      setFavorites(loadLocalFavorites(globalThis.localStorage));
      setFavoritesMode("device");
      return () => controller.abort();
    }
    setFavoritesMode("account");
    fetch(PROFILE_API, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Object.assign(new Error("favorites"), { status: response.status });
        return response.json();
      })
      .then((data) => { if (!controller.signal.aborted) setFavorites(Array.isArray(data.favorites) ? data.favorites : []); })
      .catch((error) => {
        if (!controller.signal.aborted && error.name !== "AbortError") setFavoriteError(c.favoriteError);
      });
    return () => controller.abort();
  }, [user.isAuthenticated, user.sessionReady, c.favoriteError]);

  const changeFavorite = async (gameId) => {
    if (favoriteBusy) return;
    const next = toggleFavorite(favorites, gameId);
    const shouldAdd = next.includes(gameId);
    setFavoriteError("");
    if (!user.isAuthenticated) {
      const result = saveLocalFavorites(globalThis.localStorage, next);
      setFavorites(result.favorites);
      if (!result.ok) setFavoriteError(c.favoriteError);
      return;
    }
    setFavoriteBusy(gameId);
    try {
      const response = await fetch(`${PROFILE_API}/favorites/${encodeURIComponent(gameId)}`, {
        method: shouldAdd ? "POST" : "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "favorite");
      setFavorites(Array.isArray(data.favorites) ? data.favorites : next);
    } catch {
      setFavoriteError(c.favoriteError);
    } finally {
      setFavoriteBusy("");
    }
  };

  const allGames = useMemo(() => [...FIRST_PARTY_GAMES, ...publishedGames], [publishedGames]);
  const games = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return allGames.filter((game) => {
      const description = game.text ? c[game.text] : game.description;
      return (category === "all" || game.category === category) &&
        `${game.title} ${description || ""}`.toLocaleLowerCase().includes(search);
    });
  }, [query, category, c, allGames]);

  return (
    <main lang={locale} dir={rtl ? "rtl" : "ltr"} className="min-h-screen bg-[#061329] pb-24 text-white" data-testid="games-platform-page">
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-7">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm hover:bg-white/10"><ArrowLeft size={18} />{c.back}</button>
          <div className="flex items-center gap-3 font-black tracking-widest"><span className="rounded-xl bg-cyan-300 px-3 py-2 text-[#061329]">B</span><span>BIDBLITZ <span className="text-cyan-300">GAMES</span></span></div>
        </header>
        <GamesLanguageSelect textLocale={locale} />

        {preview ? <section className="mt-6" aria-labelledby="match-preview-title">
          <h1 id="match-preview-title" className="text-2xl font-black">BidBlitz Match</h1>
          <p className="mb-4 mt-2 text-sm leading-relaxed text-sky-100/70">{c.local}</p>
          <iframe title="BidBlitz Match — lokale Spielvorschau auf Deutsch" src="/game-assets/match-preview/match.html" className="h-[80vh] min-h-[640px] w-full rounded-3xl border border-cyan-200/20 bg-[#061329]" />
        </section> : <>
          <section className="mt-8" aria-labelledby="games-title">
            <h1 id="games-title" className="text-3xl font-black sm:text-5xl">{c.title}</h1>
            <p className="mt-3 text-base text-sky-100/70">{c.subtitle}</p>
            <article className="relative mt-6 overflow-hidden rounded-[30px] border border-cyan-200/20 bg-[#102744] shadow-2xl">
              <img src={`${ART}/match.webp`} alt="" className="absolute inset-0 h-full w-full object-cover object-right" />
              <div className="relative bg-gradient-to-r from-[#05172b]/95 via-[#05172b]/65 to-transparent px-6 py-9 sm:px-9 sm:py-14">
                <span className="inline-block rounded-full bg-cyan-300 px-3 py-2 text-xs font-bold text-[#061329]">{c.first}</span>
                <h2 className="mt-5 text-3xl font-black sm:text-5xl">BidBlitz Match</h2>
                <p className="mt-3 max-w-sm text-base leading-relaxed text-white/90">{c.matchText}</p>
                <button onClick={() => onNavigate("/games/match")} className="mt-6 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-6 py-3 font-bold text-[#061329] hover:bg-cyan-200"><Gamepad2 size={20} />{c.play}</button>
              </div>
            </article>
          </section>

          <section className="mt-7" aria-label={c.all}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2" role="group" aria-label={c.all}>
                {[["all", c.all], ["Puzzle", c.puzzle], ["Arcade", c.arcade], ["Strategy", c.strategy], ["Sports", c.sports]].map(([value, label]) => <button key={value} onClick={() => setCategory(value)} aria-pressed={category === value} className={`rounded-full border px-5 py-3 text-sm font-semibold ${category === value ? "border-cyan-300 bg-cyan-300 text-[#061329]" : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"}`}>{label}</button>)}
              </div>
              <label className="flex items-center gap-3 rounded-full border border-white/15 bg-[#102744] px-4 py-3"><Search size={18} className="shrink-0 text-sky-100/60" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={c.search} placeholder={c.search} className="min-w-0 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/60" /></label>
            </div>
            <p className="mt-5 text-sm text-white/60" role="status">{games.length} / {allGames.length} {c.count}</p>
            {games.length ? <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{games.map((game) => {
              const description = game.text ? c[game.text] : game.description;
              const categoryLabel = game.category === "Puzzle" ? c.puzzle : game.category === "Arcade" ? c.arcade : game.category === "Strategy" ? c.strategy : game.category === "Sports" ? c.sports : game.category;
              return <article key={game.id} className="overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#17355a] to-[#0b1e37] shadow-xl">
              {game.external ? <div className="flex aspect-[4/3] w-full items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(65,228,244,.28),transparent_38%),linear-gradient(135deg,#113d73,#1d214d)]"><div className="text-center"><Gamepad2 size={64} strokeWidth={1.1} className="mx-auto text-cyan-200/75" /><span className="mt-3 inline-block rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">{c.community}</span></div></div> : <img src={`${ART}/${game.id}.webp`} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />}
              <div className="p-5"><p className="text-sm text-cyan-200">{categoryLabel}</p><h2 className="mt-2 text-2xl font-bold">{game.title}</h2><p className="mt-3 min-h-12 text-sm leading-relaxed text-sky-100/70">{description}</p>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {game.external && game.publicUrl ? <a href={game.publicUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-[#061329] hover:bg-cyan-200">{c.openPublished}</a> : game.available ? <button onClick={() => onNavigate("/games/match")} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-[#061329] hover:bg-cyan-200">{c.play}</button> : <span className="inline-block rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm text-white/70">{c.planned}</span>}
                  <button onClick={() => changeFavorite(game.id)} disabled={favoriteBusy === game.id} aria-pressed={favorites.includes(game.id)} aria-label={favorites.includes(game.id) ? c.unfavorite : c.favorite} className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition disabled:opacity-50 ${favorites.includes(game.id) ? "border-cyan-300 bg-cyan-300 text-[#061329]" : "border-white/20 bg-white/5 text-white/80 hover:bg-white/10"}`}><Heart size={18} fill={favorites.includes(game.id) ? "currentColor" : "none"} /></button>
                </div>
                {game.available && <GameReviewsPanel gameId={game.id} gameTitle={game.title} locale={locale} />}
              </div>
            </article>;})}</div> : <div className="mt-4 rounded-3xl border border-dashed border-white/20 px-5 py-10 text-center"><p className="text-lg">{c.empty}</p><button onClick={() => { setQuery(""); setCategory("all"); }} className="mt-4 rounded-full bg-cyan-300 px-5 py-3 font-semibold text-[#061329]">{c.clear}</button></div>}
          </section>

          <section className="mt-8 flex flex-col gap-5 rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-[#153a61] to-[#101b37] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="flex items-center gap-3 text-xl font-bold"><Layers3 size={22} className="text-cyan-300" />{c.studio}</h2><p className="mt-2 text-base text-sky-100/70">{c.studioText}</p></div>
            <button onClick={() => onNavigate("/game-studio")} className="shrink-0 rounded-full border border-cyan-200/40 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/20">{c.openStudio}</button>
          </section>
          <footer className="mt-7 space-y-2 text-sm leading-relaxed text-sky-100/60">{catalogError && <p role="alert" className="text-amber-100/80">{catalogError}</p>}<p className="flex items-start gap-2"><Sparkles size={18} className="mt-0.5 shrink-0 text-cyan-300" />{c.local}</p><p>{c.plannedText}</p><p>{favoritesMode === "account" ? c.favoriteAccount : c.favoriteDevice}</p>{favoriteError && <p role="alert" className="text-rose-200">{favoriteError}</p>}</footer>
        </>}
      </div>
    </main>
  );
}

