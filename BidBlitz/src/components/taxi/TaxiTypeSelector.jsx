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
        wrap: "from-cyan-500/15 to-blue-500/5 border-cyan-500/30 hover:border-cyan-400/70",
        iconBg: "bg-cyan-500/20",
        iconText: "text-cyan-300",
        availText: "text-cyan-300",
        glow: "shadow-cyan-500/20",
      }
    : {
        wrap: "from-purple-500/15 to-pink-500/5 border-purple-500/30 hover:border-purple-400/70",
        iconBg: "bg-purple-500/20",
        iconText: "text-purple-300",
        availText: "text-purple-300",
        glow: "shadow-purple-500/20",
      };

  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onPick}
      className={`group relative bg-gradient-to-br ${palette.wrap} border rounded-3xl p-5 text-left transition-all duration-300 hover:shadow-2xl ${palette.glow} overflow-hidden`}
      data-testid={testId}
    >
      {/* Decorative subtle glow */}
      <div className={`absolute -top-12 -right-12 w-28 h-28 rounded-full ${palette.iconBg} blur-2xl opacity-40 group-hover:opacity-70 transition-opacity`} />

      <div className={`relative w-12 h-12 mb-4 rounded-2xl ${palette.iconBg} flex items-center justify-center`}>
        <svg className={`w-7 h-7 ${palette.iconText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isBiz ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          )}
        </svg>
      </div>
      <h3 className="relative text-base font-extrabold text-white mb-1 tracking-tight">{label}</h3>
      <p className="relative text-[11px] text-white/55 mb-3 leading-relaxed line-clamp-2">{description}</p>
      <div className="relative flex items-center gap-2">
        <span className={`text-xs ${palette.availText} font-bold`}>
          {drivers > 0 ? `${drivers} verfügbar` : "Auf Anfrage"}
        </span>
        <svg className={`w-3.5 h-3.5 ${palette.iconText} ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      {drivers > 0 && (
        <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-500/50" />
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
      {/* HERO — Uber/Bolt style: big visual + sticky-feel headline + live availability badge */}
      <div className="relative w-full h-56 rounded-3xl overflow-hidden -mt-2 shadow-2xl shadow-cyan-500/10">
        <img
          src="https://images.unsplash.com/photo-1758179128122-6079c9cb3e4e?w=800&q=80"
          alt="BidBlitz Taxi"
          className="w-full h-full object-cover scale-105"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

        {/* Live availability pill — top right */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-emerald-400/40">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Live</span>
        </div>

        <div className="absolute bottom-4 left-5 right-5">
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-1 leading-tight">In 3 Min. unterwegs.</h2>
          <p className="text-sm text-white/80">Festpreis. Lizenziert. Bargeldlos.</p>
        </div>
      </div>

      {/* Trust-Row — wie Uber/Bolt direkt unter dem Hero */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { num: "10k+", label: "Fahrten", color: "text-cyan-300" },
          { num: "4.9★", label: "Bewertung", color: "text-amber-300" },
          { num: "24/7", label: "Service", color: "text-emerald-300" },
        ].map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="rounded-2xl bg-white/[0.04] border border-white/[0.06] px-2 py-2.5 text-center"
            data-testid={`taxi-trust-${t.label.toLowerCase()}`}
          >
            <p className={`text-base font-extrabold ${t.color} leading-none`}>{t.num}</p>
            <p className="text-[10px] text-white/55 mt-1 font-medium tracking-wide uppercase">{t.label}</p>
          </motion.div>
        ))}
      </div>

      <h2 className="text-base font-semibold text-white/90 px-1 pt-1">Womit fährst du heute?</h2>

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

      <div className="bg-gradient-to-br from-white/[0.04] to-transparent rounded-2xl p-4 border border-white/[0.06]">
        <h4 className="text-xs font-bold mb-3 text-white/80 uppercase tracking-wider flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Unterschied auf einen Blick
        </h4>
        <div className="space-y-2.5 text-[11px] text-white/65 leading-relaxed">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
            <span>
              <strong className="text-white font-semibold">Unternehmer:</strong> Lizenziert, Festpreise, Quittung
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
            <span>
              <strong className="text-white font-semibold">Privat:</strong> Schneller, flexibel, Community
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
