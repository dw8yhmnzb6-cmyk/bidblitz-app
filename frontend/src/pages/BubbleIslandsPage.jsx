import { ArrowLeft } from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { resolveLocale } from "../config/languagePolicy.mjs";

const COPY = {
  de: {
    back: "Zurück zu Games",
    title: "Bubble Islands",
    text: "20 lokale Puzzle-Level. Fortschritt wird auf diesem Gerät gespeichert. Keine Einsätze, keine Auszahlung, keine Wallet-Verbindung.",
  },
  en: {
    back: "Back to Games",
    title: "Bubble Islands",
    text: "20 local puzzle levels. Progress is stored on this device. No wagers, payouts or wallet connection.",
  },
  sq: {
    back: "Kthehu te Games",
    title: "Bubble Islands",
    text: "20 nivele puzzle lokale. Progresi ruhet në këtë pajisje. Pa baste, pa pagesa dhe pa lidhje me wallet.",
  },
};

export default function BubbleIslandsPage({ onBack }) {
  const { lang } = useI18n();
  const locale = resolveLocale(lang, Object.keys(COPY));
  const c = COPY[locale];

  return (
    <main lang={locale} className="min-h-screen bg-[#061329] pb-10 text-white" data-testid="bubble-islands-page">
      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm hover:bg-white/10">
            <ArrowLeft size={18} />{c.back}
          </button>
          <div className="text-right">
            <h1 className="text-lg font-black">{c.title}</h1>
            <p className="mt-1 max-w-xl text-xs text-white/50">{c.text}</p>
          </div>
        </div>
        <iframe
          title="Bubble Islands — lokale Spielvorschau"
          src="/game-assets/bubble-islands/bubble.html"
          className="h-[calc(100vh-120px)] min-h-[680px] w-full rounded-3xl border border-cyan-200/20 bg-[#061329]"
        />
      </div>
    </main>
  );
}
