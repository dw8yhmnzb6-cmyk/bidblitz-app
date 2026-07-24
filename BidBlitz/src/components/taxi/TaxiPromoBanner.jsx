/**
 * TaxiPromoBanner — Hero-Card mit aktiven Promo-Codes.
 * Horizontal scrollbar, 1-Tap Apply via onApply Callback.
 * Versteckt wenn keine aktiven Promos oder bereits Code aktiv.
 */
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gift, ChevronRight } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function TaxiPromoBanner({ activePromoCode, onApply }) {
  const [promos, setPromos] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API}/api/taxi/promo/active`, { credentials: "include" });
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (!cancelled) setPromos((d.promos || []).slice(0, 6));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  if (!promos.length || activePromoCode) return null;

  return (
    <div
      data-testid="taxi-promo-banner"
      className="-mx-1 px-1 mb-1"
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold flex items-center gap-1.5">
          <Gift size={11} /> Aktionen
        </p>
        <p className="text-[10px] text-gray-500">Tippen zum Anwenden</p>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        {promos.map((p) => {
          const valueLabel =
            p.type === "percent" ? `−${p.value}%` :
            p.type === "fixed"   ? `−€${p.value}` :
            `bis €${p.value} frei`;
          return (
            <motion.button
              key={p.code}
              whileTap={{ scale: 0.96 }}
              onClick={() => onApply?.(p.code)}
              data-testid={`promo-banner-${p.code}`}
              className="shrink-0 min-w-[200px] max-w-[240px] flex items-center gap-3 px-3 py-2.5 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-400/30 rounded-2xl text-left hover:from-amber-500/25 hover:to-amber-500/25 transition"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/25 flex items-center justify-center shrink-0">
                <Gift size={16} className="text-amber-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold tabular-nums text-white bg-amber-500/30 px-1.5 py-0.5 rounded">
                    {p.code}
                  </span>
                  <span className="text-[10px] font-bold text-amber-200">{valueLabel}</span>
                </div>
                <p className="text-[11px] text-white/85 truncate mt-0.5">{p.label}</p>
              </div>
              <ChevronRight size={14} className="text-amber-300/60 shrink-0" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
