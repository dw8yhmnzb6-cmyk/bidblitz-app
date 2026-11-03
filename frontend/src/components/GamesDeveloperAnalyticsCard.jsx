import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Gamepad2, Loader2, RefreshCw, ShieldCheck, Star } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
const COPY = {
  de: {
    title: "Dein Games-Portfolio", subtitle: "Nur deine eigenen Entwicklungs- und Veröffentlichungszahlen. Keine Geldwerte.",
    drafts: "Entwürfe", versions: "Versionen", submitted: "In Prüfung", approved: "Preview freigegeben",
    published: "Veröffentlicht", unpublished: "Offline", reviewsVisible: "Öffentliche Reviews", reviewsHidden: "Moderiert", launches: "Starts (ca.)",
    loadError: "Portfolio-Zahlen konnten nicht geladen werden.", reload: "Neu laden", billingOff: "Games-Billing bleibt gesperrt.",
    billingOn: "Billing-Konfiguration aktiv – Zahlungen sind separat zu prüfen.", perGame: "Deine Spiele", rating: "Bewertung", noGames: "Noch keine veröffentlichten oder früher veröffentlichten Spiele.",
  },
  en: {
    title: "Your Games portfolio", subtitle: "Your own development and publication metrics only. No monetary values.",
    drafts: "Drafts", versions: "Versions", submitted: "In review", approved: "Preview approved",
    published: "Published", unpublished: "Offline", reviewsVisible: "Public reviews", reviewsHidden: "Moderated", launches: "Launches (approx.)",
    loadError: "Could not load portfolio metrics.", reload: "Reload", billingOff: "Games billing remains locked.",
    billingOn: "Billing configuration is enabled — payments require separate verification.", perGame: "Your games", rating: "Rating", noGames: "No published or previously published games yet.",
  },
  sq: {
    title: "Portofoli yt Games", subtitle: "Vetëm statistikat e tua të zhvillimit dhe publikimit. Pa vlera monetare.",
    drafts: "Drafte", versions: "Versione", submitted: "Në kontroll", approved: "Prova e miratuar",
    published: "Publikuar", unpublished: "Offline", reviewsVisible: "Vlerësime publike", reviewsHidden: "Moderuar", launches: "Hapje (afërsisht)",
    loadError: "Statistikat e portofolit nuk u ngarkuan.", reload: "Ringarko", billingOff: "Pagesat Games mbeten të bllokuara.",
    billingOn: "Konfigurimi i pagesave është aktiv – pagesat duhen kontrolluar veçmas.", perGame: "Lojërat e tua", rating: "Vlerësimi", noGames: "Ende nuk ka lojëra të publikuara ose të publikuara më parë.",
  },
};

async function read(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Request failed");
  return body;
}

export default function GamesDeveloperAnalyticsCard({ locale = "en" }) {
  const c = COPY[locale] || COPY.en;
  const [data, setData] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryResponse, gamesResponse] = await Promise.all([
        fetch(`${BACKEND}/api/games/developer/analytics`, { credentials: "include" }),
        fetch(`${BACKEND}/api/games/developer/analytics/games`, { credentials: "include" }),
      ]);
      const [summaryBody, gamesBody] = await Promise.all([
        read(summaryResponse),
        read(gamesResponse),
      ]);
      setData(summaryBody);
      setGames(Array.isArray(gamesBody.games) ? gamesBody.games : []);
    } catch (loadError) {
      setData(null);
      setGames([]);
      setError(loadError?.message || c.loadError);
    } finally {
      setLoading(false);
    }
  }, [c.loadError]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="mt-5 rounded-3xl border border-cyan-200/15 bg-[#0b203b]/90 p-5" data-testid="games-developer-analytics">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><BarChart3 size={19} className="text-cyan-300" />{c.title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/50">{c.subtitle}</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs text-white/70 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />{c.reload}
        </button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-xs text-rose-100">{error}</p>}
      {loading ? <div className="mt-5 flex items-center gap-2 text-xs text-white/50"><Loader2 size={15} className="animate-spin" />{c.reload}…</div>
        : data && <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [c.drafts, data.drafts],
              [c.versions, data.versions],
              [c.submitted, data.submitted],
              [c.approved, data.preview_approved],
              [c.published, data.published],
              [c.unpublished, data.unpublished],
              [c.reviewsVisible, data.reviews_visible],
              [c.reviewsHidden, data.reviews_hidden],
              [c.launches, data.approximate_launches],
            ].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <p className="text-[10px] text-white/45">{label}</p>
              <p className="mt-2 text-2xl font-black text-white">{Number(value || 0).toLocaleString(locale)}</p>
            </div>)}
          </div>
          <div className="mt-5 border-t border-white/10 pt-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white/85"><Gamepad2 size={16} className="text-cyan-300" />{c.perGame}</h3>
            {games.length > 0 ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {games.map((game) => <article key={game.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-4" data-testid={`developer-game-analytics-${game.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{game.title || game.id}</p>
                    <p className="mt-1 text-[10px] text-white/40">v{Number(game.version_number || 0)} · {game.status || "—"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${game.status === "published" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/5 text-white/55"}`}>{game.status === "published" ? c.published : c.unpublished}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-black/10 p-2"><p className="text-[9px] text-white/40">{c.launches}</p><p className="mt-1 text-sm font-bold">{Number(game.approximate_launches || 0).toLocaleString(locale)}</p></div>
                  <div className="rounded-xl bg-black/10 p-2"><p className="text-[9px] text-white/40">{c.reviewsVisible}</p><p className="mt-1 text-sm font-bold">{Number(game.reviews_visible || 0).toLocaleString(locale)}</p></div>
                  <div className="rounded-xl bg-black/10 p-2"><p className="text-[9px] text-white/40">{c.rating}</p><p className="mt-1 inline-flex items-center gap-1 text-sm font-bold">{game.rating_average == null ? "—" : Number(game.rating_average).toFixed(1)}<Star size={11} className="fill-current text-amber-300" /></p></div>
                </div>
              </article>)}
            </div> : <p className="mt-3 rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-white/45">{c.noGames}</p>}
          </div>

          <p className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed ${data.billing_ready ? "border-amber-300/20 bg-amber-300/5 text-amber-100" : "border-emerald-300/20 bg-emerald-300/5 text-emerald-100"}`}>
            {data.billing_ready ? <ShieldCheck size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
            {data.billing_ready ? c.billingOn : c.billingOff}
          </p>
        </>}
    </section>
  );
}
