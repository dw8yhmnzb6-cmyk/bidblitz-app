/**
 * POS Guided Tour — 60-Sekunden Produkt-Tour
 * Spielt nach Demo-Seed und führt durch alle Mega-Tools-Sektionen
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, X, Check } from "lucide-react";

const STEPS = [
  {
    section: "demo",
    title: "Willkommen bei Mega-Tools!",
    body: "Du hast gerade einen Lieferanten, 3 Produkte, einen Gutschein, eine Inventur, ein Rezept und eine Reservierung in 1 Sekunde angelegt. Lass mich dir zeigen, was alles damit möglich ist.",
    cta: "Tour starten",
    duration: 0,
  },
  {
    section: "stock",
    title: "📦 Bestand+ — Inventur, Auto-PO, Etiketten",
    body: "Hier siehst du deine offene DEMO-Inventur. Klick „Abschließen" — der Bestand wird automatisch korrigiert. Außerdem: CSV-Import (z. B. von deinem alten System), Etiketten-PDF drucken und Auto-Bestellung für niedrige Artikel.",
    cta: "Weiter",
    duration: 6,
  },
  {
    section: "menu",
    title: "🍔 Rezepte & Cross-Sell",
    body: "Das Burger-Menü hat ein Rezept: 1 Brötchen + 1 Cola. Beim Verkauf werden diese Zutaten automatisch vom Lager abgezogen — perfekt für Restaurants & Kioske. Cross-Sell zeigt dir, was Kunden zusammen kaufen.",
    cta: "Weiter",
    duration: 6,
  },
  {
    section: "ops",
    title: "📅 Schicht & Reservierung",
    body: "Deine DEMO-Reservierung „Familie Müller, 4 Personen, 19:00" ist drin. Die Schicht für heute auch. Schichtplan + Tisch-Reservierungen + Kassierer-Performance — alles an einem Ort.",
    cta: "Weiter",
    duration: 6,
  },
  {
    section: "money",
    title: "💶 DATEV / Lexoffice / P&L",
    body: "Mit einem Klick exportierst du den Monatsabschluss als DATEV- oder Lexoffice-CSV für deinen Steuerberater. Live P&L zeigt dir Umsatz, Wareneinsatz und Marge des heutigen Tages.",
    cta: "Weiter",
    duration: 6,
  },
  {
    section: "ki",
    title: "🤖 KI-Tools — OCR & Voice",
    body: "Lieferschein vom Großhändler bekommen? Foto machen → Gemini Vision liest alle Artikel automatisch ein. Hände voll? Sprich „2 Coca-Cola hinzufügen" — Whisper macht den Rest.",
    cta: "Weiter",
    duration: 6,
  },
  {
    section: "marketing",
    title: "✉️ Marketing & Gutscheine",
    body: "Der DEMO-Gutschein ist aktiv — Code im Demo-Result. Versende E-Mail-Kampagnen an Stammkunden, segmentiert nach Loyalty-Tier. Alterskontrolle für Tabak/Alkohol ist DSGVO-konform protokolliert.",
    cta: "Tour beenden",
    duration: 6,
  },
];

export default function POSGuidedTour({ onClose, onSetSection }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  // Auto-switch section when step changes
  useEffect(() => {
    if (current.section && onSetSection) {
      onSetSection(current.section);
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  const skip = () => onClose();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        data-testid="guided-tour-overlay"
      >
        <motion.div
          key={step}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-md bg-gradient-to-br from-[#0A1626] to-[#060810] border border-[#00C2FF]/30 rounded-2xl p-5 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#00C2FF]/20 flex items-center justify-center">
                <Sparkles size={14} className="text-[#00C2FF]" />
              </div>
              <div>
                <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold">
                  Tour · Schritt {step + 1} / {STEPS.length}
                </p>
              </div>
            </div>
            <button
              onClick={skip}
              data-testid="tour-skip-btn"
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
            >
              <X size={12} className="text-white/60" />
            </button>
          </div>

          <h2 className="text-[16px] font-bold text-white mb-2" data-testid="tour-title">
            {current.title}
          </h2>
          <p className="text-[12px] text-white/70 leading-relaxed mb-4" data-testid="tour-body">
            {current.body}
          </p>

          {/* Progress bar */}
          <div className="flex gap-1 mb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="flex-1 h-1 rounded-full transition-all"
                style={{
                  background: i <= step ? "#00C2FF" : "rgba(255,255,255,0.08)",
                }}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={skip}
              data-testid="tour-close-btn"
              className="px-4 py-2.5 rounded-lg text-[11px] font-bold text-white/60 hover:text-white"
            >
              Überspringen
            </button>
            <button
              onClick={next}
              data-testid="tour-next-btn"
              className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-bold text-white flex items-center justify-center gap-1.5"
              style={{ background: "linear-gradient(135deg,#00C2FF,#0080FF)" }}
            >
              {step === STEPS.length - 1 ? <Check size={12} /> : <ChevronRight size={12} />}
              {current.cta}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
