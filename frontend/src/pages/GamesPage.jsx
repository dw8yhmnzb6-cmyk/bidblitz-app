import { useMemo, useState } from "react";
import { ArrowLeft, Gamepad2, Layers3, Search, Sparkles } from "lucide-react";
import { useI18n } from "../store/I18nContext";

const ART = "/games/match-preview/assets";
const COPY = {
  de: {
    back: "Zurück", title: "Dein nächstes Abenteuer.", subtitle: "Entdecke die ersten Spielwelten von BidBlitz.",
    search: "Spiel suchen", all: "Alle Spiele", puzzle: "Puzzle", arcade: "Arcade", count: "Spiele",
    first: "UNSER ERSTES SPIEL", matchText: "Kombiniere Symbole, löse Kettenreaktionen und entdecke 30 Level.",
    play: "Spielvorschau öffnen", planned: "In Planung", bubbleText: "Eine neue Puzzlewelt voller schwebender Inseln.",
    runnerText: "Ein Laufabenteuer auf leuchtenden Wegen.", empty: "Keine Spiele gefunden.", clear: "Filter zurücksetzen",
    studio: "Dein Spiel auf BidBlitz", studioText: "Bereite dein eigenes Spiel im Entwicklerstudio vor.", openStudio: "Entwicklerstudio öffnen",
    local: "Match ist eine lokale Vorschau auf Deutsch. Fortschritt bleibt auf diesem Gerät. Testmünzen haben keinen Geldwert.",
    plannedText: "Weitere Spiele sind in Vorbereitung. Ein Veröffentlichungstermin steht noch nicht fest.",
  },
  en: {
    back: "Back", title: "Your next adventure.", subtitle: "Discover BidBlitz's first game worlds.",
    search: "Search games", all: "All games", puzzle: "Puzzle", arcade: "Arcade", count: "Games",
    first: "OUR FIRST GAME", matchText: "Match symbols, trigger chain reactions and explore 30 levels.",
    play: "Open game preview", planned: "Planned", bubbleText: "A new puzzle world full of floating islands.",
    runnerText: "A running adventure on glowing paths.", empty: "No games found.", clear: "Reset filters",
    studio: "Your game on BidBlitz", studioText: "Prepare your own game in the developer studio.", openStudio: "Open developer studio",
    local: "Match is a local preview in German. Progress stays on this device. Test coins have no monetary value.",
    plannedText: "More games are being prepared. A release date has not been set.",
  },
  sq: {
    back: "Kthehu", title: "Aventura jote e radhës.", subtitle: "Zbulo botët e para të lojërave BidBlitz.",
    search: "Kërko lojë", all: "Të gjitha", puzzle: "Puzzle", arcade: "Arcade", count: "Lojëra",
    first: "LOJA JONË E PARË", matchText: "Kombino simbolet, krijo reaksione zinxhir dhe zbulo 30 nivele.",
    play: "Hap provën e lojës", planned: "Në planifikim", bubbleText: "Një botë e re puzzle me ishuj fluturues.",
    runnerText: "Një aventurë vrapimi në rrugë të ndriçuara.", empty: "Nuk u gjetën lojëra.", clear: "Hiq filtrat",
    studio: "Loja jote në BidBlitz", studioText: "Përgatit lojën tënde në studion e zhvilluesit.", openStudio: "Hap studion e zhvilluesit",
    local: "Match është një provë lokale në gjermanisht. Progresi ruhet në këtë pajisje. Monedhat e provës nuk kanë vlerë monetare.",
    plannedText: "Lojëra të tjera po përgatiten. Data e publikimit ende nuk është caktuar.",
  },
};

const GAMES = [
  { id: "match", title: "BidBlitz Match", category: "Puzzle", text: "matchText", available: true },
  { id: "bubble", title: "Bubble Islands", category: "Puzzle", text: "bubbleText", available: false },
  { id: "runner", title: "Blitz Runner", category: "Arcade", text: "runnerText", available: false },
];

export default function GamesPage({ onBack, onNavigate, preview = false }) {
  const { lang } = useI18n();
  const locale = lang?.split("-")[0];
  const c = COPY[locale] || COPY.en;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const games = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return GAMES.filter((game) => (category === "all" || game.category === category) &&
      `${game.title} ${c[game.text]}`.toLocaleLowerCase().includes(search));
  }, [query, category, c]);

  return (
    <main lang={COPY[locale] ? locale : "en"} className="min-h-screen bg-[#061329] pb-24 text-white" data-testid="games-platform-page">
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-7">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm hover:bg-white/10"><ArrowLeft size={18} />{c.back}</button>
          <div className="flex items-center gap-3 font-black tracking-widest"><span className="rounded-xl bg-cyan-300 px-3 py-2 text-[#061329]">B</span><span>BIDBLITZ <span className="text-cyan-300">GAMES</span></span></div>
        </header>

        {preview ? <section className="mt-6" aria-labelledby="match-preview-title">
          <h1 id="match-preview-title" className="text-2xl font-black">BidBlitz Match</h1>
          <p className="mb-4 mt-2 text-sm leading-relaxed text-sky-100/70">{c.local}</p>
          <iframe title="BidBlitz Match — lokale Spielvorschau auf Deutsch" src="/games/match-preview/match.html" className="h-[80vh] min-h-[640px] w-full rounded-3xl border border-cyan-200/20 bg-[#061329]" />
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
                {[["all", c.all], ["Puzzle", c.puzzle], ["Arcade", c.arcade]].map(([value, label]) => <button key={value} onClick={() => setCategory(value)} aria-pressed={category === value} className={`rounded-full border px-5 py-3 text-sm font-semibold ${category === value ? "border-cyan-300 bg-cyan-300 text-[#061329]" : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"}`}>{label}</button>)}
              </div>
              <label className="flex items-center gap-3 rounded-full border border-white/15 bg-[#102744] px-4 py-3"><Search size={18} className="shrink-0 text-sky-100/60" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={c.search} placeholder={c.search} className="min-w-0 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/60" /></label>
            </div>
            <p className="mt-5 text-sm text-white/60" role="status">{games.length} / {GAMES.length} {c.count}</p>
            {games.length ? <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{games.map((game) => <article key={game.id} className="overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#17355a] to-[#0b1e37] shadow-xl">
              <img src={`${ART}/${game.id}.webp`} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <div className="p-5"><p className="text-sm text-cyan-200">{game.category}</p><h2 className="mt-2 text-2xl font-bold">{game.title}</h2><p className="mt-3 min-h-12 text-sm leading-relaxed text-sky-100/70">{c[game.text]}</p>
                {game.available ? <button onClick={() => onNavigate("/games/match")} className="mt-5 rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-[#061329] hover:bg-cyan-200">{c.play}</button> : <span className="mt-5 inline-block rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm text-white/70">{c.planned}</span>}
              </div>
            </article>)}</div> : <div className="mt-4 rounded-3xl border border-dashed border-white/20 px-5 py-10 text-center"><p className="text-lg">{c.empty}</p><button onClick={() => { setQuery(""); setCategory("all"); }} className="mt-4 rounded-full bg-cyan-300 px-5 py-3 font-semibold text-[#061329]">{c.clear}</button></div>}
          </section>

          <section className="mt-8 flex flex-col gap-5 rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-[#153a61] to-[#101b37] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="flex items-center gap-3 text-xl font-bold"><Layers3 size={22} className="text-cyan-300" />{c.studio}</h2><p className="mt-2 text-base text-sky-100/70">{c.studioText}</p></div>
            <button onClick={() => onNavigate("/game-studio")} className="shrink-0 rounded-full border border-cyan-200/40 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/20">{c.openStudio}</button>
          </section>
          <footer className="mt-7 space-y-2 text-sm leading-relaxed text-sky-100/60"><p className="flex items-start gap-2"><Sparkles size={18} className="mt-0.5 shrink-0 text-cyan-300" />{c.local}</p><p>{c.plannedText}</p></footer>
        </>}
      </div>
    </main>
  );
}
