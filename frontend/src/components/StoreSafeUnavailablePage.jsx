import { ShieldCheck, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function StoreSafeUnavailablePage({ onBack, onNavigate }) {
  return (
    <motion.div
      data-testid="store-safe-unavailable-page"
      className="min-h-screen bg-[#05070B] text-white px-5 pb-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="pt-[max(env(safe-area-inset-top,0px),24px)] flex items-center gap-3">
        <button
          onClick={onBack || (() => onNavigate?.("/more"))}
          className="h-10 w-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center"
          data-testid="store-safe-unavailable-back-button"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-xs uppercase tracking-[0.24em] text-white/45">Store Safe Mode</span>
      </div>

      <div className="max-w-xl mx-auto pt-16">
        <div className="rounded-[32px] border border-[#8FEFFF]/15 bg-[linear-gradient(180deg,rgba(143,239,255,0.12),rgba(255,255,255,0.03))] p-8 text-left">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[#8FEFFF]/20 bg-[#8FEFFF]/10 text-[#8FEFFF]" data-testid="store-safe-unavailable-icon">
            <ShieldCheck size={28} />
          </div>
          <h1 className="mt-6 text-3xl font-black tracking-tight" data-testid="store-safe-unavailable-title">Dieser Bereich ist im Store-Build ausgeblendet</h1>
          <p className="mt-3 text-sm leading-6 text-white/68" data-testid="store-safe-unavailable-description">
            Für Android- und iOS-Store-Releases bleiben Auktions-, Glücksspiel- und demoartige Module deaktiviert. Produktive Wallet-, POS-, Mobility- und Commerce-Funktionen bleiben verfügbar.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => onNavigate?.("/")} className="rounded-full bg-[#8FEFFF] px-5 py-3 text-sm font-black text-[#041018]" data-testid="store-safe-unavailable-home-button">Zur Startseite</button>
            <button onClick={() => onNavigate?.("/more")} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white" data-testid="store-safe-unavailable-more-button">Sichere Bereiche öffnen</button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
