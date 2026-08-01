import { ArrowLeft, Building2 } from "lucide-react";
import { motion } from "framer-motion";

export const InvestorAuthShell = ({ title, subtitle, onBack, children, footer }) => (
  <div className="min-h-screen bg-[#030507] px-4 py-6 sm:px-5 lg:px-8" data-testid="investor-auth-shell">
    <div className="mx-auto max-w-5xl">
      <button
        onClick={onBack}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
        data-testid="investor-auth-back-button"
      >
        <ArrowLeft size={18} />
      </button>
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[30px] border border-[#06B6D4]/16 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.12),transparent_34%),linear-gradient(145deg,rgba(3,10,15,0.98),rgba(5,11,18,0.98))] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.22)]"
          data-testid="investor-auth-hero"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#06B6D4]/20 bg-[#06B6D4]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#9BE8FF]">
            <Building2 size={12} />
            Investor Portal
          </div>
          <h1 className="mt-4 text-4xl font-black leading-[0.98] tracking-[-0.04em] text-white sm:text-5xl" data-testid="investor-auth-title">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/72 sm:text-base" data-testid="investor-auth-subtitle">
            {subtitle}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              "Getrennte Investorenzugänge",
              "Dokumente, Updates und Meetings an einem Ort",
              "Keine Wallet- oder Karteninvestments im Portal",
              "Sichere Cookie-Session mit Auditierbarkeit",
            ].map((item, index) => (
              <div key={item} className="rounded-[22px] border border-white/8 bg-white/5 p-4 text-sm font-semibold text-white/80" data-testid={`investor-auth-feature-${index + 1}`}>
                {item}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 shadow-[0_18px_42px_rgba(0,0,0,0.22)]"
          data-testid="investor-auth-card"
        >
          {children}
          {footer}
        </motion.div>
      </div>
    </div>
  </div>
);