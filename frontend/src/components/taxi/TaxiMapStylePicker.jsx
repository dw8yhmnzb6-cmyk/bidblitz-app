/**
 * TaxiMapStylePicker — Apple-Maps-style bottom-sheet for map style switching.
 */
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MAP_STYLES } from "./TaxiConstants";

const PREVIEW_BG = {
  dark: "linear-gradient(135deg, #1A1D2E 0%, #0A0C1A 100%)",
  light: "linear-gradient(135deg, #E8ECF0 0%, #C8D0D8 100%)",
  satellite: "linear-gradient(135deg, #3A5A3C 0%, #2A4A2C 60%, #5A7A5C 100%)",
};

export default function TaxiMapStylePicker({ isOpen, onClose, mapStyle, onPick }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm z-30 flex items-end"
          data-testid="taxi-map-style-modal"
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-[#0A0A0F]/95 backdrop-blur-xl rounded-t-3xl border-t border-white/10 p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-sm">Kartenmodus</h3>
              <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(MAP_STYLES).map(([key, style]) => {
                const isActive = mapStyle === key;
                return (
                  <button
                    key={key}
                    onClick={() => { onPick(key); onClose(); }}
                    className={`flex flex-col items-center gap-1.5 p-1 rounded-xl transition-all ${
                      isActive ? "" : "opacity-70 hover:opacity-100"
                    }`}
                    data-testid={`map-style-${key}`}
                  >
                    <div
                      className={`w-full h-16 rounded-xl border-2 transition-all ${
                        isActive ? "border-cyan-400 shadow-[0_0_16px_rgba(0,194,255,0.4)]" : "border-white/10"
                      }`}
                      style={{ background: PREVIEW_BG[key] }}
                    >
                      <svg viewBox="0 0 80 60" className="w-full h-full" preserveAspectRatio="none">
                        <path d="M0,40 Q20,30 40,35 T80,30" stroke={key === "light" ? "#B8C5D0" : "#4A5568"} strokeWidth="2" fill="none" opacity="0.6" />
                        <path d="M20,0 L35,60" stroke={key === "light" ? "#D0D8E0" : "#3A4258"} strokeWidth="1.5" fill="none" opacity="0.5" />
                        <circle cx="40" cy="35" r="3" fill="#00C2FF" />
                      </svg>
                    </div>
                    <span className={`text-[11px] font-semibold ${isActive ? "text-cyan-400" : "text-white/70"}`}>
                      {style.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
