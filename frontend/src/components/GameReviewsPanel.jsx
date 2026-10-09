import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, Star, Trash2, X } from "lucide-react";
import { useUser } from "../store";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
const COPY = {
  de: {
    open: "Bewertungen", title: "Spielerbewertungen", close: "Schließen", loading: "Bewertungen werden geladen…",
    empty: "Noch keine Bewertung.", loadError: "Bewertungen konnten nicht geladen werden.",
    average: "Durchschnitt", reviews: "Bewertungen", yourReview: "Deine Bewertung", rating: "Sterne",
    placeholder: "Was gefällt dir an diesem Spiel?", save: "Bewertung speichern", saving: "Wird gespeichert…",
    delete: "Bewertung löschen", saveError: "Bewertung konnte nicht gespeichert werden.", deleteError: "Bewertung konnte nicht gelöscht werden.",
    signIn: "Melde dich an, um selbst zu bewerten.", hidden: "Deine Bewertung ist derzeit ausgeblendet und wird nicht öffentlich angezeigt.",
    visible: "Öffentlich sichtbar", updated: "Gespeichert",
  },
  en: {
    open: "Reviews", title: "Player reviews", close: "Close", loading: "Loading reviews…",
    empty: "No reviews yet.", loadError: "Could not load reviews.",
    average: "Average", reviews: "Reviews", yourReview: "Your review", rating: "Stars",
    placeholder: "What do you like about this game?", save: "Save review", saving: "Saving…",
    delete: "Delete review", saveError: "Could not save review.", deleteError: "Could not delete review.",
    signIn: "Sign in to leave your own review.", hidden: "Your review is currently hidden and is not shown publicly.",
    visible: "Publicly visible", updated: "Saved",
  },
  sq: {
    open: "Vlerësimet", title: "Vlerësimet e lojtarëve", close: "Mbyll", loading: "Po ngarkohen vlerësimet…",
    empty: "Ende nuk ka vlerësime.", loadError: "Vlerësimet nuk u ngarkuan.",
    average: "Mesatarja", reviews: "Vlerësime", yourReview: "Vlerësimi yt", rating: "Yje",
    placeholder: "Çfarë të pëlqen te kjo lojë?", save: "Ruaj vlerësimin", saving: "Po ruhet…",
    delete: "Fshi vlerësimin", saveError: "Vlerësimi nuk u ruajt.", deleteError: "Vlerësimi nuk u fshi.",
    signIn: "Hyr në llogari për të dhënë vlerësim.", hidden: "Vlerësimi yt është i fshehur dhe nuk shfaqet publikisht.",
    visible: "I dukshëm publikisht", updated: "U ruajt",
  },
};

async function read(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Request failed");
  return body;
}

export default function GameReviewsPanel({ gameId, gameTitle, locale = "en" }) {
  const user = useUser();
  const c = COPY[locale] || COPY.en;
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState({ count: 0, average: null });
  const [reviews, setReviews] = useState([]);
  const [mine, setMine] = useState(null);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const publicResponse = await fetch(`${BACKEND}/api/games/reviews/${encodeURIComponent(gameId)}`, {
        credentials: "omit",
      });
      const publicBody = await read(publicResponse);
      setSummary(publicBody.summary || { count: 0, average: null });
      setReviews(Array.isArray(publicBody.reviews) ? publicBody.reviews : []);

      if (user.isAuthenticated) {
        const mineResponse = await fetch(`${BACKEND}/api/games/reviews/${encodeURIComponent(gameId)}/mine`, {
          credentials: "include",
        });
        const mineBody = await read(mineResponse);
        const nextMine = mineBody.review || null;
        setMine(nextMine);
        if (nextMine) {
          setRating(Number(nextMine.rating) || 5);
          setText(nextMine.text || "");
        }
      } else {
        setMine(null);
      }
    } catch (loadError) {
      setError(loadError?.message || c.loadError);
    } finally {
      setLoading(false);
    }
  }, [gameId, user.isAuthenticated, c.loadError]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const save = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${BACKEND}/api/games/reviews/${encodeURIComponent(gameId)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, text }),
      });
      await read(response);
      setNotice(c.updated);
      await load();
    } catch (saveError) {
      setError(saveError?.message || c.saveError);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${BACKEND}/api/games/reviews/${encodeURIComponent(gameId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      await read(response);
      setMine(null);
      setRating(5);
      setText("");
      await load();
    } catch (deleteError) {
      setError(deleteError?.message || c.deleteError);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/10"
      >
        <MessageSquare size={15} />{c.open}
      </button>
    );
  }

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-[#07182d]/95 p-4" data-testid={`game-reviews-${gameId}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-cyan-200">{gameTitle}</p>
          <h3 className="mt-1 text-sm font-bold">{c.title}</h3>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-white/50 hover:bg-white/10" aria-label={c.close}><X size={16} /></button>
      </div>

      {loading ? <div className="mt-4 flex items-center gap-2 text-xs text-white/50"><Loader2 size={15} className="animate-spin" />{c.loading}</div> : <>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[.03] px-4 py-3">
            <p className="text-[10px] text-white/45">{c.average}</p>
            <p className="mt-1 text-lg font-black text-white">{summary.average == null ? "—" : Number(summary.average).toFixed(1)} <Star size={14} className="inline fill-current text-amber-300" /></p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[.03] px-4 py-3">
            <p className="text-[10px] text-white/45">{c.reviews}</p>
            <p className="mt-1 text-lg font-black text-white">{Number(summary.count || 0)}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {reviews.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-white/45">{c.empty}</p>
            : reviews.slice(0, 5).map((review) => <article key={review.id} className="rounded-xl border border-white/10 bg-white/[.025] p-3">
              <div className="flex gap-0.5" aria-label={`${review.rating} / 5`}>
                {[1, 2, 3, 4, 5].map((value) => <Star key={value} size={13} className={value <= review.rating ? "fill-current text-amber-300" : "text-white/20"} />)}
              </div>
              {review.text && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-white/70">{review.text}</p>}
            </article>)}
        </div>

        {user.isAuthenticated ? <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-white/80">{c.yourReview}</p>
            {mine && <span className={`text-[10px] ${mine.status === "hidden" ? "text-amber-200" : "text-emerald-200"}`}>{mine.status === "hidden" ? c.hidden : c.visible}</span>}
          </div>
          <p className="mt-3 text-[11px] text-white/45">{c.rating}</p>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} / 5`} className="rounded-lg p-1.5 hover:bg-white/10">
              <Star size={20} className={value <= rating ? "fill-current text-amber-300" : "text-white/25"} />
            </button>)}
          </div>
          <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={1000} rows={3} placeholder={c.placeholder} className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-[#061329] p-3 text-xs text-white outline-none placeholder:text-white/30 focus:border-cyan-300/50" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-[#061329] disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}{busy ? c.saving : c.save}
            </button>
            {mine && <button type="button" onClick={remove} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/5 px-4 py-2.5 text-xs text-rose-100 disabled:opacity-50"><Trash2 size={14} />{c.delete}</button>}
          </div>
          {notice && <p role="status" className="mt-2 text-xs text-emerald-200">{notice}</p>}
        </div> : <p className="mt-5 border-t border-white/10 pt-4 text-xs text-white/50">{c.signIn}</p>}
      </>}

      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-xs text-rose-100">{error}</p>}
    </section>
  );
}
