/**
 * TaxiNoteModal — Tiny modal to edit driver notes for a specific address
 * (pickup / dropoff / waypoint).
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function TaxiNoteModal({ isOpen, title, initialValue = "", onClose, onSave }) {
  const [text, setText] = useState(initialValue);
  useEffect(() => { if (isOpen) setText(initialValue || ""); }, [isOpen, initialValue]);
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[90] bg-[#0E0E14] rounded-2xl border border-white/10 p-5 max-w-md mx-auto"
            data-testid="taxi-note-modal"
          >
            <h3 className="text-base font-bold text-white mb-1">{title || "Hinweis für Fahrer"}</h3>
            <p className="text-xs text-gray-400 mb-3">
              Zusätzliche Information, die der Fahrer für diese Adresse benötigt.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 280))}
              placeholder="z.B. Beim Hintereingang warten, 3. Stock, Klingelschild ..."
              rows={4}
              className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 resize-none focus:border-cyan-500/50 focus:outline-none"
              data-testid="taxi-note-textarea"
              autoFocus
            />
            <p className="text-[10px] text-gray-500 mt-1 text-right">{text.length}/280</p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-gray-300"
                data-testid="taxi-note-cancel"
              >
                Abbrechen
              </button>
              <button
                onClick={() => { onSave(text.trim()); onClose(); }}
                className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 rounded-xl text-sm font-semibold text-black"
                data-testid="taxi-note-save"
              >
                Speichern
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
