/**
 * TaxiPromoCodeField — Collapsible promo-code input with live validation.
 *
 * UX:
 *   - Collapsed: "Gutschein-Code hinzufügen" link
 *   - Expanded: input + apply button + status pill
 *   - When valid: green pill with label, fare-cards show original/discount in TaxiPage
 */
import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, CheckCircle2, X, Loader2, AlertCircle } from "lucide-react";
import { validatePromoCode } from "../../services/taxiApi";

const REASONS = {
  empty: "Code eingeben",
  invalid_format: "Code hat ein ungültiges Format",
  not_found: "Code nicht gefunden",
  expired: "Code ist abgelaufen",
  already_used: "Code bereits verwendet",
};

export default function TaxiPromoCodeField({ value, onChange, autoExpand = false }) {
  const [expanded, setExpanded] = useState(!!value || autoExpand);
  const [input, setInput] = useState(value?.code || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const apply = useCallback(async () => {
    const code = input.trim().toUpperCase();
    if (!code) { setErr("Code eingeben"); return; }
    setBusy(true); setErr(null);
    try {
      const res = await validatePromoCode(code);
      if (res?.valid) {
        onChange?.({ code: res.code, label: res.label, discount: res.discount });
      } else {
        setErr(REASONS[res?.reason] || "Code ungültig");
        onChange?.(null);
      }
    } catch (e) {
      setErr(e?.message || "Fehler bei der Prüfung");
    } finally {
      setBusy(false);
    }
  }, [input, onChange]);

  const clear = () => { setInput(""); onChange?.(null); setErr(null); };

  if (!expanded && !value) {
    return (
      <button
        onClick={() => setExpanded(true)}
        data-testid="taxi-promo-toggle"
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-dashed border-white/15 rounded-xl text-xs text-gray-300 transition-colors"
      >
        <Tag size={14} className="text-cyan-400" />
        <span>Gutschein-Code hinzufügen</span>
      </button>
    );
  }

  if (value?.code) {
    // Applied state — premium green pill
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        data-testid="taxi-promo-applied"
        className="flex items-center justify-between gap-2 px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 size={14} className="text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-emerald-300 truncate">{value.code}</p>
            <p className="text-[10px] text-emerald-200/80 truncate">{value.label}</p>
          </div>
        </div>
        <button
          onClick={clear}
          data-testid="taxi-promo-clear"
          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
        >
          <X size={12} className="text-gray-400" />
        </button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence initial={false}>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        data-testid="taxi-promo-field"
        className="space-y-1.5"
      >
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Tag size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={input}
              onChange={(e) => { setInput(e.target.value.toUpperCase()); setErr(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
              placeholder="z.B. NEUKUNDE10"
              data-testid="taxi-promo-input"
              maxLength={32}
              className="w-full pl-8 pr-3 py-2.5 bg-white/[0.04] border border-white/10 focus:border-cyan-400/60 focus:bg-white/[0.07] rounded-xl text-sm text-white placeholder:text-gray-600 transition outline-none uppercase tracking-wider font-semibold"
            />
          </div>
          <button
            onClick={apply}
            disabled={busy || !input.trim()}
            data-testid="taxi-promo-apply"
            className="px-4 rounded-xl bg-cyan-500 text-black text-xs font-bold disabled:opacity-40 hover:bg-cyan-400 transition flex items-center gap-1.5"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : "Anwenden"}
          </button>
        </div>
        {err && (
          <p data-testid="taxi-promo-error" className="text-[10px] text-red-400 flex items-center gap-1 px-1">
            <AlertCircle size={10} /> {err}
          </p>
        )}
        {!err && !value && (
          <button
            onClick={() => setExpanded(false)}
            className="text-[10px] text-gray-500 hover:text-gray-300 px-1 transition"
          >
            Schließen
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
