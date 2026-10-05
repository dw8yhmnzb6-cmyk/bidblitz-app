import { AlertTriangle, CheckCircle2, Languages } from "lucide-react";
import languages from "../config/gamesLanguages.json";
import reviewManifest from "../config/gamesTranslationReview.json";
import { buildGamesTranslationReadiness } from "../config/gamesTranslationReadiness.mjs";

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
    pendingCodes: "Offene Sprachcodes",
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
    pendingCodes: "Pending language codes",
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
    pendingCodes: "Kodet e gjuhëve në pritje",
  },
};

export default function GamesTranslationReadinessCard({ locale = "en" }) {
  const c = COPY[locale] || COPY.en;
  const readiness = buildGamesTranslationReadiness({ languageOptions: languages, review: reviewManifest });
  const structurallyReady = readiness.structurallyReady;
  const reviewReady = readiness.humanReviewReady;

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
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-white/50">
            {c.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
            structurallyReady
              ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
              : "border-rose-300/25 bg-rose-300/10 text-rose-100"
          }`}>
            {structurallyReady ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {structurallyReady ? c.structuralReady : c.structuralBlocked}
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
          [c.registered, readiness.registeredOptionCount],
          [c.core, `${readiness.coreCopyPresentCount}/${readiness.registeredOptionCount}`],
          [c.reviewed, `${readiness.humanReviewedCount}/${readiness.localizedOptionCount}`],
          [c.pending, readiness.pendingHumanReviewCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <p className="text-[10px] text-white/45">{label}</p>
            <p className="mt-2 text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      {!reviewReady && readiness.pendingHumanReviewCodes.length > 0 && (
        <details className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/5 p-4">
          <summary className="cursor-pointer text-xs font-semibold text-amber-100">
            {c.pendingCodes} ({readiness.pendingHumanReviewCount})
          </summary>
          <p className="mt-3 break-words font-mono text-[11px] leading-relaxed text-amber-100/70">
            {readiness.pendingHumanReviewCodes.join(", ")}
          </p>
        </details>
      )}
    </section>
  );
}
