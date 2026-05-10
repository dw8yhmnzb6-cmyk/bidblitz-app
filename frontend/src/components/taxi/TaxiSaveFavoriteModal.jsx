/**
 * TaxiSaveFavoriteModal — center-modal to save a new favorite place with name+icon.
 */
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const ICONS = [
  { icon: "home", emoji: "🏠" },
  { icon: "work", emoji: "💼" },
  { icon: "star", emoji: "⭐" },
  { icon: "heart", emoji: "❤️" },
  { icon: "pin", emoji: "📍" },
];

export default function TaxiSaveFavoriteModal({
  isOpen, onClose, form, setForm, address, onSubmit,
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0A0A0F] border border-white/10 rounded-2xl p-6 max-w-sm w-full"
          >
            <h3 className="text-lg font-bold text-white mb-4">Ort speichern</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-2">Name</label>
                <input
                  type="text"
                  placeholder="z.B. Zuhause, Arbeit..."
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-2">Icon</label>
                <div className="grid grid-cols-5 gap-2">
                  {ICONS.map((item) => (
                    <button
                      key={item.icon}
                      onClick={() => setForm((p) => ({ ...p, icon: item.icon }))}
                      className={`p-3 rounded-xl text-2xl transition-all ${
                        form.icon === item.icon
                          ? "bg-cyan-500/20 border-2 border-cyan-500/50"
                          : "bg-white/5 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {item.emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs text-gray-500 bg-white/5 p-2 rounded-lg">📍 {address}</div>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-white/5 text-gray-400 rounded-xl font-semibold hover:bg-white/10"
                >
                  Abbrechen
                </button>
                <button
                  onClick={onSubmit}
                  disabled={!form.name}
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-black rounded-xl font-semibold disabled:opacity-50"
                >
                  Speichern
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
