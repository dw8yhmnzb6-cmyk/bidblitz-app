/**
 * TaxiPoiFilterSheet — bottom-sheet for POI category selection (taxi.eu Parität).
 */
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { POI_CATEGORIES } from "./TaxiConstants";

export default function TaxiPoiFilterSheet({ isOpen, onClose, activeCategory, onPick, loading }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm z-30 flex items-end"
          data-testid="taxi-poi-filter-sheet"
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-[#0A0A0F]/95 backdrop-blur-xl rounded-t-3xl border-t border-white/10 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-sm">Was suchst du in der Nähe?</h3>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"
                data-testid="taxi-poi-close"
              >
                <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(POI_CATEGORIES).map(([key, cat]) => {
                const isActive = activeCategory === key;
                return (
                  <button
                    key={key}
                    data-testid={`taxi-poi-cat-${key}`}
                    onClick={() => { onPick(isActive ? null : key); onClose(); }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                      isActive
                        ? "border-cyan-400 bg-cyan-500/10 shadow-[0_0_12px_rgba(0,194,255,0.3)]"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                    style={{ minHeight: 76 }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-base"
                      style={{ background: `${cat.color}20`, color: cat.color }}
                    >{cat.icon}</div>
                    <span className="text-[11px] font-semibold text-white text-center leading-tight">{cat.label}</span>
                  </button>
                );
              })}
            </div>
            {loading && <p className="text-center text-[11px] text-cyan-400 mt-3">Lade in der Nähe…</p>}
            <p className="text-center text-[10px] text-gray-500 mt-3">Marker antippen → "Als Ziel setzen"</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
