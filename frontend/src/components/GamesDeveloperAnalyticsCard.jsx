import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
const COPY = {
  de: {
    title: "Dein Games-Portfolio", subtitle: "Nur deine eigenen Entwicklungs- und Veröffentlichungszahlen. Keine Geldwerte.",
    drafts: "Entwürfe", versions: "Versionen", submitted: "In Prüfung", approved: "Preview freigegeben",
    published: "Veröffentlicht", unpublished: "Offline", reviewsVisible: "Öffentliche Reviews", reviewsHidden: "Moderiert",
    loadError: "Portfolio-Zahlen konnten nicht geladen werden.", reload: "Neu laden", billingOff: "Games-Billing bleibt gesperrt.",
    billingOn: "Billing-Konfiguration aktiv – Zahlungen sind separat zu prüfen.",
  },
  en: {
    title: "Your Games portfolio", subtitle: "Your own development and publication metrics only. No monetary values.",
    drafts: "Drafts", versions: "Versions", submitted: "In review", approved: "Preview approved",
    published: "Published", unpublished: "Offline", reviewsVisible: "Public reviews", reviewsHidden: "Moderated",
    loadError: "Could not load portfolio metrics.", reload: "Reload", billingOff: "Games billing remains locked.",
    billingOn: "Billing configuration is enabled — payments require separate verification.",
  },
  sq: {
    title: "Portofoli yt Games", subtitle: "Vetëm statistikat e tua të zhvillimit dhe publikimit. Pa vlera monetare.",
    drafts: "Drafte", versions: "Versione", submitted: "Në kontroll", approved: "Prova e miratuar",
    published: "Publikuar", unpublished: "Offline", reviewsVisible: "Vlerësime publike", reviewsHidden: "Moderuar",
    loadError: "Statistikat e portofolit nuk u ngarkuan.", reload: "Ringarko", billingOff: "Pagesat Games mbeten të bllokuara.",
    billingOn: "Konfigurimi i pagesave është aktiv – pagesat duhen kontrolluar veçmas.",
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${BACKEND}/api/games/developer/analytics`, {
        credentials: "include",
      });
      setData(await read(response));
    } catch (loadError) {
      setData(null);
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
            ].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <p className="text-[10px] text-white/45">{label}</p>
              <p className="mt-2 text-2xl font-black text-white">{Number(value || 0).toLocaleString(locale)}</p>
            </div>)}
          </div>
          <p className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed ${data.billing_ready ? "border-amber-300/20 bg-amber-300/5 text-amber-100" : "border-emerald-300/20 bg-emerald-300/5 text-emerald-100"}`}>
            {data.billing_ready ? <ShieldCheck size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
            {data.billing_ready ? c.billingOn : c.billingOff}
          </p>
        </>}
    </section>
  );
}
