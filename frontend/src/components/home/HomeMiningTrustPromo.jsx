import { motion } from "framer-motion";
import { ChevronRight, Shield } from "lucide-react";

export const HomeMiningTrustPromo = ({ copy, compact = false, onNavigate }) => {
  if (compact) {
    return (
      <motion.button
        onClick={() => onNavigate("/mining-trust")}
        className="mt-6 w-full rounded-[20px] border px-3.5 py-3 text-left"
        style={{
          background: "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(59,130,246,0.06) 55%, rgba(255,255,255,0.02))",
          borderColor: "rgba(245,158,11,0.16)",
        }}
        whileTap={{ scale: 0.985 }}
        data-testid="home-mining-trust-compact"
      >
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] border border-amber-400/15 bg-amber-500/10">
            <Shield size={16} className="text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-200/90">{copy.badge}</div>
            <div className="mt-1 text-[14px] font-bold leading-tight text-white">{copy.title}</div>
            <div className="mt-1 text-[10px] leading-relaxed text-white/65 line-clamp-2">{copy.subtitle}</div>
            <div className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-200">
              {copy.open} <ChevronRight size={13} />
            </div>
          </div>
        </div>
      </motion.button>
    );
  }

  return (
    <motion.section
      className="mt-7 rounded-[28px] p-5 relative overflow-hidden cursor-pointer lg:mt-8"
      style={{
        background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(59,130,246,0.08) 55%, rgba(255,255,255,0.02))",
        border: "1px solid rgba(245,158,11,0.18)",
        boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, duration: 0.36 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => onNavigate("/mining-trust")}
      data-testid="home-mining-trust-hero"
    >
      <div className="absolute -top-10 -right-10 h-36 w-36 rounded-full bg-amber-400/12 blur-3xl pointer-events-none" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between relative z-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200" data-testid="home-mining-trust-badge">
            <Shield size={12} /> {copy.badge}
          </div>
          <h2 className="mt-3 text-[24px] sm:text-[30px] font-bold text-white tracking-tight" data-testid="home-mining-trust-title">{copy.title}</h2>
          <p className="mt-2 max-w-xl text-[13px] sm:text-[14px] text-white/68" data-testid="home-mining-trust-subtitle">{copy.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-full bg-white px-5 py-3 text-[12px] font-bold text-black" data-testid="home-mining-trust-open-button">{copy.open}</button>
          <button className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-[12px] font-semibold text-white" data-testid="home-mining-trust-open-mining-button" onClick={(e) => { e.stopPropagation(); onNavigate('/mining'); }}>{copy.openMining}</button>
        </div>
      </div>
    </motion.section>
  );
};
