/**
 * TaxiFavoritesModal — full-screen overlay listing saved places.
 */
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const ICON_MAP = {
  home: "🏠", work: "💼", star: "⭐", heart: "❤️", pin: "📍",
};

export default function TaxiFavoritesModal({
  isOpen, onClose, favorites, onSelect, onDelete,
  pickupAddress, onSaveCurrentAddress,
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0A0A0F] w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl max-h-[80vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-[#0A0A0F] border-b border-white/10 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Gespeicherte Orte</h2>
              <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4">
              {favorites.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <p className="text-gray-400 text-sm">Keine gespeicherten Orte</p>
                  <p className="text-gray-500 text-xs mt-1">Tippe auf ⭐ beim Adress-Eingabefeld</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {favorites.map((fav) => (
                    <div
                      key={fav.id}
                      className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{ICON_MAP[fav.icon] || "⭐"}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm">{fav.name}</p>
                          <p className="text-xs text-gray-400 truncate">{fav.address}</p>
                          {fav.use_count > 0 && (
                            <p className="text-[10px] text-gray-500 mt-1">{fav.use_count}x verwendet</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => onSelect(fav)}
                            className="p-2 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-colors"
                            title="Verwenden"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`"${fav.name}" löschen?`)) onDelete(fav.id);
                            }}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Löschen"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {pickupAddress && (
                <button
                  onClick={onSaveCurrentAddress}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 text-yellow-400 rounded-xl font-semibold hover:bg-yellow-500/30 transition-all"
                >
                  ⭐ Aktuelle Adresse speichern
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
