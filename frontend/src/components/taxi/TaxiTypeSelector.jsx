import React from 'react';
import { motion } from 'framer-motion';

/**
 * TaxiTypeSelector — Wähle Business oder Private Taxi
 */
export default function TaxiTypeSelector({ modeSettings, onSelectType }) {
  const bothEnabled = modeSettings.business.enabled && modeSettings.private.enabled;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-4"
    >
      <h2 className="text-lg font-semibold text-center">Wähle deinen Taxi-Typ</h2>
      <div className={`grid gap-4 ${bothEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* Business/Company Taxi */}
        {modeSettings.business.enabled && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectType('business')}
            className="relative bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-2 border-cyan-500/30 rounded-2xl p-5 text-left hover:border-cyan-400/60 transition-all"
            data-testid="taxi-type-business"
          >
            <div className="w-14 h-14 mb-4 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-cyan-300 mb-1">Unternehmer</h3>
            <p className="text-[11px] text-gray-400 mb-3">
              Geschäftsfahrten mit Rechnung & Umsatzsteuerausweis für Vorsteuerabzug
            </p>
            <div className="flex items-center gap-2 text-[10px] text-cyan-400/60">
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20">§14 UStG</span>
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20">Vorsteuer</span>
            </div>
          </motion.button>
        )}

        {/* Private Taxi */}
        {modeSettings.private.enabled && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectType('private')}
            className="relative bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-2xl p-5 text-left hover:border-purple-400/60 transition-all"
            data-testid="taxi-type-private"
          >
            <div className="w-14 h-14 mb-4 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-purple-300 mb-1">Privat</h3>
            <p className="text-[11px] text-gray-400 mb-3">
              Privatfahrten mit einfachem Beleg (ohne Umsatzsteuer-Details)
            </p>
            <div className="flex items-center gap-2 text-[10px] text-purple-400/60">
              <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20">Quittung</span>
              <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20">Simpel</span>
            </div>
          </motion.button>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-semibold text-white mb-1">Warum diese Unterscheidung?</h4>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              <strong className="text-cyan-300">Unternehmer:</strong> Erhält Rechnung mit USt-ID, Steuernummer & §14 UStG-Ausweis für Vorsteuerabzug (z.B. 19% zurückholen).<br />
              <strong className="text-purple-300">Privat:</strong> Einfacher Beleg ohne Steuer-Details (schneller & unkompliziert).
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
