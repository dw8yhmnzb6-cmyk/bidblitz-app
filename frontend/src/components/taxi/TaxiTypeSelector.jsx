/**
 * TaxiTypeSelector — Hero image, two service-type cards (Business / Private), info box.
 * Shown when no taxiType is selected yet.
 */
import React from "react";
import { motion } from "framer-motion";

function TypeCard({ variant, label, description, drivers, onPick, testId }) {
  const isBiz = variant === "business";
  const palette = isBiz
    ? {
        wrap: "from-cyan-500/10 to-blue-500/10 border-cyan-500/30 hover:border-cyan-400/60",
        iconBg: "bg-cyan-500/20",
        iconText: "text-cyan-400",
        availText: "text-cyan-400",
      }
    : {
        wrap: "from-purple-500/10 to-pink-500/10 border-purple-500/30 hover:border-purple-400/60",
        iconBg: "bg-purple-500/20",
        iconText: "text-purple-400",
        availText: "text-purple-400",
      };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onPick}
      className={`relative bg-gradient-to-br ${palette.wrap} border-2 rounded-2xl p-5 text-left transition-all`}
      data-testid={testId}
    >
      <div className={`w-14 h-14 mb-4 rounded-xl ${palette.iconBg} flex items-center justify-center`}>
        <svg className={`w-8 h-8 ${palette.iconText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isBiz ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          )}
        </svg>
      </div>
      <h3 className="text-base font-bold text-white mb-1">{label}</h3>
      <p className="text-xs text-gray-400 mb-3">{description}</p>
      <div className="flex items-center gap-2">
        <span className={`text-xs ${palette.availText} font-medium`}>
          {drivers > 0 ? `${drivers} verfügbar` : "Buchung anfragen"}
        </span>
      </div>
      {drivers > 0 && (
        <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-green-500 animate-pulse" />
      )}
    </motion.button>
  );
}

export default function TaxiTypeSelector({
  modeSettings,
  businessDrivers,
  privateDrivers,
  onPick,
}) {
  const bizOn = modeSettings.business.enabled;
  const privOn = modeSettings.private.enabled;
  const bothOn = bizOn && privOn;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-4"
    >
      <div className="relative w-full h-48 rounded-2xl overflow-hidden -mt-2">
        <img
          src="https://images.unsplash.com/photo-1758179128122-6079c9cb3e4e?w=800&q=80"
          alt="BidBlitz Taxi"
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <h2 className="text-2xl font-bold text-white mb-1">BidBlitz Taxi</h2>
          <p className="text-sm text-gray-300">Professionelle Fahrten in deiner Stadt</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-center">Wähle deinen Taxi-Typ</h2>

      <div className={`grid gap-4 ${bothOn ? "grid-cols-2" : "grid-cols-1"}`}>
        {bizOn && (
          <TypeCard
            variant="business"
            label={modeSettings.business.label || "Unternehmer"}
            description={modeSettings.business.description || "Professionelle Taxiunternehmen mit Lizenz"}
            drivers={businessDrivers}
            onPick={() => onPick("business")}
            testId="taxi-type-business"
          />
        )}
        {privOn && (
          <TypeCard
            variant="private"
            label={modeSettings.private.label || "Privat"}
            description={modeSettings.private.description || "Private Fahrer in deiner Nähe"}
            drivers={privateDrivers}
            onPick={() => onPick("private")}
            testId="taxi-type-private"
          />
        )}
      </div>

      {!bizOn && !privOn && (
        <div className="text-center p-6 bg-white/5 rounded-xl border border-white/10">
          <p className="text-sm text-gray-400">
            Taxi-Buchung ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.
          </p>
        </div>
      )}

      <div className="bg-[#111] rounded-xl p-4 border border-white/5">
        <h4 className="text-sm font-semibold mb-2">Was ist der Unterschied?</h4>
        <div className="space-y-2 text-xs text-gray-400">
          <div className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>
              <strong className="text-white">Unternehmer:</strong> Lizenzierte Taxiunternehmen, feste Preise,
              Quittung möglich
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-purple-400">•</span>
            <span>
              <strong className="text-white">Privat:</strong> Flexible Preise, schneller verfügbar,
              Community-Fahrer
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
