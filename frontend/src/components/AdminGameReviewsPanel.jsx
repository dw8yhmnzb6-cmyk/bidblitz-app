import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, RefreshCw, ShieldCheck, Star } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
const COPY = {
  de: {
    title: "Spielerbewertungen moderieren", subtitle: "Nur Review-Inhalte – keine Kunden- oder Owner-Daten werden angezeigt.",
    visible: "Sichtbar", hidden: "Ausgeblendet", empty: "Keine Bewertungen in diesem Status.", loadError: "Bewertungen konnten nicht geladen werden.",
    reload: "Neu laden", note: "Moderationsnotiz", notePlaceholder: "Optionaler interner Grund…", hide: "Ausblenden", restore: "Wiederherstellen",
    actionError: "Moderation konnte nicht gespeichert werden.", game: "Spiel",
  },
  en: {
    title: "Moderate player reviews", subtitle: "Review content only — no customer or owner data is displayed.",
    visible: "Visible", hidden: "Hidden", empty: "No reviews in this status.", loadError: "Could not load reviews.",
    reload: "Reload", note: "Moderation note", notePlaceholder: "Optional internal reason…", hide: "Hide", restore: "Restore",
    actionError: "Could not save moderation.", game: "Game",
  },
  sq: {
    title: "Modero vlerësimet e lojtarëve", subtitle: "Shfaqet vetëm përmbajtja e vlerësimit – jo të dhëna klientësh apo pronarësh.",
    visible: "Të dukshme", hidden: "Të fshehura", empty: "Nuk ka vlerësime në këtë status.", loadError: "Vlerësimet nuk u ngarkuan.",
    reload: "Ringarko", note: "Shënim moderimi", notePlaceholder: "Arsye e brendshme opsionale…", hide: "Fshih", restore: "Rikthe",
    actionError: "Moderimi nuk u ruajt.", game: "Loja",
  },
};

async function read(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Request failed");
  return body;
}

export default function AdminGameReviewsPanel({ locale = "en" }) {
  const c = COPY[locale] || COPY.en;
  const [status, setStatus] = useState("visible");
  const [reviews, setReviews] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${BACKEND}/api/admin/games/reviews?status=${encodeURIComponent(status)}&limit=100`, {
        credentials: "include",
      });
      const body = await read(response);
      setReviews(Array.isArray(body.reviews) ? body.reviews : []);
    } catch (loadError) {
      setError(loadError?.message || c.loadError);
    } finally {
      setLoading(false);
    }
  }, [status, c.loadError]);

  useEffect(() => { load(); }, [load]);

  const moderate = async (reviewId, action) => {
    setBusy(reviewId);
    setError("");
    try {
      const response = await fetch(`${BACKEND}/api/admin/games/reviews/${encodeURIComponent(reviewId)}/moderate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: notes[reviewId] || "" }),
      });
      await read(response);
      setNotes((current) => ({ ...current, [reviewId]: "" }));
      await load();
    } catch (actionError) {
      setError(actionError?.message || c.actionError);
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-[#0a1d36] p-5" data-testid="admin-games-reviews">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck size={18} className="text-cyan-300" />{c.title}</h2>
          <p className="mt-1 text-xs text-white/50">{c.subtitle}</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs text-white/70 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />{c.reload}
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        {[["visible", c.visible], ["hidden", c.hidden]].map(([value, label]) => <button key={value} type="button" onClick={() => setStatus(value)} aria-pressed={status === value} className={`rounded-full border px-4 py-2 text-xs font-semibold ${status === value ? "border-cyan-300 bg-cyan-300 text-[#061329]" : "border-white/15 bg-white/5 text-white/65"}`}>{label}</button>)}
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-xs text-rose-100">{error}</p>}

      {loading ? <div className="mt-5 flex items-center gap-2 text-xs text-white/50"><Loader2 size={15} className="animate-spin" />{c.reload}…</div>
        : reviews.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-white/45">{c.empty}</p>
          : <div className="mt-5 grid gap-3 lg:grid-cols-2">{reviews.map((review) => <article key={review.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-cyan-200">{c.game}</p>
                <p className="mt-1 text-sm font-semibold text-white">{review.game_id}</p>
              </div>
              <div className="flex gap-0.5" aria-label={`${review.rating} / 5`}>
                {[1, 2, 3, 4, 5].map((value) => <Star key={value} size={13} className={value <= review.rating ? "fill-current text-amber-300" : "text-white/20"} />)}
              </div>
            </div>
            {review.text && <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-white/70">{review.text}</p>}
            {review.moderation_note && <p className="mt-3 rounded-lg border border-amber-200/10 bg-amber-200/5 p-2 text-[11px] text-amber-100/70">{review.moderation_note}</p>}
            <label className="mt-3 block text-[11px] text-white/45">{c.note}
              <input value={notes[review.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [review.id]: event.target.value }))} maxLength={500} placeholder={c.notePlaceholder} className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#061329] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-cyan-300/50" />
            </label>
            <button type="button" onClick={() => moderate(review.id, status === "visible" ? "hide" : "restore")} disabled={Boolean(busy)} className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-50 ${status === "visible" ? "border border-rose-300/20 bg-rose-300/10 text-rose-100" : "bg-emerald-300 text-[#06231c]"}`}>
              {busy === review.id ? <Loader2 size={14} className="animate-spin" /> : status === "visible" ? <EyeOff size={14} /> : <Eye size={14} />}
              {status === "visible" ? c.hide : c.restore}
            </button>
          </article>)}</div>}
    </section>
  );
}
