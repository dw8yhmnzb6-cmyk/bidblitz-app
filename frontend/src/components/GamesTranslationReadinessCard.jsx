import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Languages, Loader2, RefreshCw } from "lucide-react";
import languages from "../config/gamesLanguages.json";
import reviewManifest from "../config/gamesTranslationReview.json";
import { buildGamesTranslationReadiness } from "../config/gamesTranslationReadiness.mjs";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
const API = `${BACKEND}/api/admin/game-studio/translation-reviews`;

const COPY = {
  de: {
    title: "Sprach-Readiness",
    subtitle: "Technische Sprachabdeckung und menschliche Prüfung werden getrennt ausgewiesen.",
    registered: "Sprachoptionen",
    core: "Core-Texte vorhanden",
    reviewed: "Menschlich geprüft",
    pending: "Prüfung offen",
    structuralReady: "Technisch vollständig",
    structuralBlocked: "Technische Lücken",
    reviewReady: "Sprachprüfung vollständig",
    reviewBlocked: "Noch nicht launchbereit",
    pendingCodes: "Offene Sprachen",
    reviewedCodes: "Geprüfte Sprachen",
    markReviewed: "Als geprüft markieren",
    revoke: "Freigabe zurücknehmen",
    loadError: "Human-Review-Status konnte nicht geladen werden.",
    retry: "Neu laden",
    saving: "Speichern…",
    auditNote: "Eine Sprache wird nur durch eine ausdrückliche Admin-Prüfung freigegeben. Die Quellsprache Englisch wird nicht als Übersetzung gezählt.",
  },
  en: {
    title: "Language readiness",
    subtitle: "Technical language coverage and human review are reported separately.",
    registered: "Language options",
    core: "Core copy present",
    reviewed: "Human reviewed",
    pending: "Review pending",
    structuralReady: "Technically complete",
    structuralBlocked: "Technical gaps",
    reviewReady: "Language review complete",
    reviewBlocked: "Not launch-ready yet",
    pendingCodes: "Pending languages",
    reviewedCodes: "Reviewed languages",
    markReviewed: "Mark reviewed",
    revoke: "Revoke review",
    loadError: "Human review status could not be loaded.",
    retry: "Reload",
    saving: "Saving…",
    auditNote: "A language is approved only through an explicit admin review. English is the source language and is not counted as a reviewed translation.",
  },
  sq: {
    title: "Gatishmëria e gjuhëve",
    subtitle: "Mbulimi teknik dhe kontrolli njerëzor i gjuhëve shfaqen veçmas.",
    registered: "Opsione gjuhe",
    core: "Tekstet bazë të pranishme",
    reviewed: "Kontrolluar nga njeriu",
    pending: "Në pritje të kontrollit",
    structuralReady: "Teknikisht e plotë",
    structuralBlocked: "Mangësi teknike",
    reviewReady: "Kontrolli i gjuhëve përfundoi",
    reviewBlocked: "Ende jo gati për publikim",
    pendingCodes: "Gjuhët në pritje",
    reviewedCodes: "Gjuhët e kontrolluara",
    markReviewed: "Shëno si të kontrolluar",
    revoke: "Hiq miratimin",
    loadError: "Statusi i kontrollit njerëzor nuk u ngarkua.",
    retry: "Ringarko",
    saving: "Po ruhet…",
    auditNote: "Një gjuhë miratohet vetëm me kontroll të qartë nga administratori. Anglishtja është gjuha burimore dhe nuk numërohet si përkthim i kontrolluar.",
  },
};

export default function GamesTranslationReadinessCard({ locale = "en" }) {
  const c = COPY[locale] || COPY.en;
  const structural = useMemo(
    () => buildGamesTranslationReadiness({ languageOptions: languages, review: reviewManifest }),
    [],
  );
  const labels = useMemo(
    () => new Map(languages.map((entry) => [entry.code, entry.label])),
    [],
  );
  const [reviewState, setReviewState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(API, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || c.loadError);
      setReviewState(body);
    } catch (loadError) {
      setReviewState(null);
      setError(loadError?.message || c.loadError);
    } finally {
      setLoading(false);
    }
  }, [c.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const setReviewed = async (code, reviewed) => {
    if (!code || busy) return;
    setBusy(code);
    setError("");
    try {
      const response = await fetch(`${API}/${encodeURIComponent(code)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed, note: "" }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || c.loadError);
      await load();
    } catch (saveError) {
      setError(saveError?.message || c.loadError);
    } finally {
      setBusy("");
    }
  };

  const reviewedCodes = Array.isArray(reviewState?.human_reviewed_codes)
    ? reviewState.human_reviewed_codes
    : structural.humanReviewedCodes;
  const pendingCodes = Array.isArray(reviewState?.pending_codes)
    ? reviewState.pending_codes
    : structural.pendingHumanReviewCodes;
  const humanReviewedCount = Number.isInteger(reviewState?.human_reviewed_count)
    ? reviewState.human_reviewed_count
    : structural.humanReviewedCount;
  const pendingCount = Number.isInteger(reviewState?.pending_count)
    ? reviewState.pending_count
    : structural.pendingHumanReviewCount;
  const reviewReady = pendingCount === 0;

  const renderLanguageRow = (code, reviewed) => (
    <div key={code} data-testid={`translation-review-${code}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.025] px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-white/85">{labels.get(code) || code}</p>
        <p className="mt-0.5 font-mono text-[10px] text-white/35">{code}</p>
      </div>
      <button
        type="button"
        onClick={() => setReviewed(code, !reviewed)}
        disabled={Boolean(busy)}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold disabled:opacity-50 ${
          reviewed
            ? "border-rose-300/20 bg-rose-300/5 text-rose-100"
            : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
        }`}
      >
        {busy === code ? c.saving : reviewed ? c.revoke : c.markReviewed}
      </button>
    </div>
  );

  return (
    <section
      className="mt-6 rounded-3xl border border-white/10 bg-[#0a1d36] p-5"
      data-testid="games-translation-readiness-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Languages size={18} className="text-cyan-200" aria-hidden="true" />
            <h2 className="text-lg font-bold">{c.title}</h2>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-white/50">{c.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
            structural.structurallyReady
              ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
              : "border-rose-300/25 bg-rose-300/10 text-rose-100"
          }`}>
            {structural.structurallyReady ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {structural.structurallyReady ? c.structuralReady : c.structuralBlocked}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
            reviewReady
              ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
              : "border-amber-300/25 bg-amber-300/10 text-amber-100"
          }`}>
            {reviewReady ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {reviewReady ? c.reviewReady : c.reviewBlocked}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [c.registered, structural.registeredOptionCount],
          [c.core, `${structural.coreCopyPresentCount}/${structural.registeredOptionCount}`],
          [c.reviewed, `${humanReviewedCount}/${structural.localizedOptionCount}`],
          [c.pending, pendingCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <p className="text-[10px] text-white/45">{label}</p>
            <p className="mt-2 text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-white/45">{c.auditNote}</p>

      {loading && <p className="mt-4 flex items-center gap-2 text-xs text-white/50"><Loader2 size={14} className="animate-spin" />{c.saving}</p>}
      {error && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300/25 bg-rose-400/10 p-3">
        <p role="alert" className="text-xs text-rose-100">{error}</p>
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[10px] text-white/75">
          <RefreshCw size={12} />{c.retry}
        </button>
      </div>}

      {!loading && pendingCodes.length > 0 && (
        <details className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/5 p-4">
          <summary className="cursor-pointer text-xs font-semibold text-amber-100">
            {c.pendingCodes} ({pendingCount})
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {pendingCodes.map((code) => renderLanguageRow(code, false))}
          </div>
        </details>
      )}

      {!loading && reviewedCodes.length > 0 && (
        <details className="mt-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/5 p-4">
          <summary className="cursor-pointer text-xs font-semibold text-emerald-100">
            {c.reviewedCodes} ({humanReviewedCount})
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {reviewedCodes.map((code) => renderLanguageRow(code, true))}
          </div>
        </details>
      )}
    </section>
  );
}
