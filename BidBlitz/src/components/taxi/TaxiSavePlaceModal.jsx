/**
 * TaxiSavePlaceModal — inline modal to quickly save a destination.
 * Mounted INSIDE the input/CTA card (not full-screen).
 */
import React from "react";
import { motion } from "framer-motion";

const ICONS = [
  { id: "home", label: "🏠 Zuhause" },
  { id: "work", label: "💼 Arbeit" },
  { id: "gym", label: "🏋️ Gym" },
  { id: "school", label: "🎓 Schule" },
  { id: "star", label: "⭐ Andere" },
];

const ICON_DEFAULT_NAME = {
  home: "Zuhause", work: "Arbeit", gym: "Gym", school: "Schule", star: "Andere",
};

export default function TaxiSavePlaceModal({
  isOpen, onClose, address, saveIcon, setSaveIcon, saveName, setSaveName, onSave,
}) {
  if (!isOpen) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-[#1a1a1f] border border-cyan-500/20 rounded-xl space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Ort speichern</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="text-[10px] text-gray-500 truncate">{address}</div>
      <div className="flex gap-2">
        {ICONS.map((ic) => (
          <button
            key={ic.id}
            onClick={() => {
              setSaveIcon(ic.id);
              if (!saveName || Object.values(ICON_DEFAULT_NAME).includes(saveName)) {
                setSaveName(ICON_DEFAULT_NAME[ic.id] || "Andere");
              }
            }}
            className={`flex-1 py-2 rounded-lg text-[10px] font-medium transition-all ${
              saveIcon === ic.id
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "bg-white/5 text-gray-400 border border-white/5"
            }`}
            data-testid={`taxi-save-icon-${ic.id}`}
          >{ic.label}</button>
        ))}
      </div>
      <input
        value={saveName}
        onChange={(e) => setSaveName(e.target.value)}
        placeholder="Name (z.B. Zuhause)"
        className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-cyan-500/50 outline-none"
        data-testid="taxi-save-name"
      />
      <button
        onClick={onSave}
        disabled={!saveName}
        className="w-full py-2.5 bg-cyan-500 text-black rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-cyan-400 transition-all"
        data-testid="taxi-save-confirm"
      >Speichern</button>
    </motion.div>
  );
}
