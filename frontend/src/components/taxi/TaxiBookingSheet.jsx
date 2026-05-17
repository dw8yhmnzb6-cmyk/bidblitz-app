/**
 * TaxiBookingSheet — taxi.eu-style bottom-sheet content for booking.
 * Shows: address rows (tappable → opens search sheet), order-options button,
 * vehicle picker, fare summary, prominent "Buchen" CTA, no-taxis warning.
 */
import React from "react";
import { motion } from "framer-motion";
import TaxiVehiclePicker from "./TaxiVehiclePicker";
import TaxiPromoCodeField from "./TaxiPromoCodeField";
import TaxiQuickActions from "./TaxiQuickActions";

const greet = () => {
  const h = new Date().getHours();
  if (h < 5) return "Gute Nacht";
  if (h < 12) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
};

function AddressRow({ variant, value, notes, placeholder, onClick, onClear, onAddNotes, testId }) {
  const dot =
    variant === "pickup"
      ? "bg-cyan-500 ring-cyan-500/20"
      : variant === "dropoff"
        ? "bg-red-500 ring-red-500/20"
        : "bg-amber-400 ring-amber-400/20";
  return (
    <div>
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-3 py-3 bg-[#111] border border-white/10 rounded-xl hover:border-white/20 active:bg-white/5 text-left"
        data-testid={testId}
      >
        <div className={`w-3 h-3 rounded-full ring-4 ${dot} shrink-0`} />
        <span className={`flex-1 text-sm truncate ${value ? "text-white" : "text-gray-500"}`}>
          {value || placeholder}
        </span>
        {value && onAddNotes && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onAddNotes(); }}
            className="w-7 h-7 rounded-full bg-white/5 text-gray-400 flex items-center justify-center"
            data-testid={`${testId}-add-notes`}
            title={notes ? "Hinweis bearbeiten" : "Hinweis hinzufügen"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={notes ? "#00C2FF" : "currentColor"} strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </span>
        )}
        {value && onClear && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="w-5 h-5 rounded-full bg-white/10 text-gray-400 flex items-center justify-center text-xs"
            data-testid={`${testId}-clear`}
          >×</span>
        )}
      </button>
      {notes && (
        <div className="mt-1 ml-6 text-[11px] text-cyan-400/80 italic truncate">
          ↳ {notes}
        </div>
      )}
    </div>
  );
}

function OptionsButton({ summary, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 bg-[#111] border border-white/10 rounded-xl active:bg-white/5"
      data-testid="taxi-options-btn"
    >
      <div className="flex items-center gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C2FF" strokeWidth="2">
          <line x1="4" y1="6" x2="20" y2="6" />
          <circle cx="9" cy="6" r="2.5" fill="#0A0A0F" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <circle cx="15" cy="12" r="2.5" fill="#0A0A0F" />
          <line x1="4" y1="18" x2="20" y2="18" />
          <circle cx="7" cy="18" r="2.5" fill="#0A0A0F" />
        </svg>
        <span className="text-sm font-medium text-white">Bestelloptionen</span>
      </div>
      <span className="text-xs text-gray-400 truncate max-w-[160px]">{summary}</span>
    </button>
  );
}

export default function TaxiBookingSheet({
  taxiType, onChangeType,
  pickup, dropoff,
  onTapPickup, onTapDropoff, onClearDropoff,
  onEditPickupNotes, onEditDropoffNotes,
  // Waypoints
  waypoints, onTapWaypoint, onRemoveWaypoint, onAddWaypoint, onEditWaypointNotes,
  savedPlaces, onPickSavedPlace,
  estimates, selectedVehicle, setSelectedVehicle,
  surge, loading, error,
  optionsSummary, onOpenOptions,
  noDriversAvailable,
  nearbyCount,
  onGetEstimates, onBook,
  scheduledLabel,
  // Personalisation
  userName,
  // Promo code (P2)
  promo, onPromoChange,
  onApplyPromoCode,
  // Quick actions (iter124 Phase B)
  lastRide, onUseLastRide,
  scheduleMode, onScheduleModeChange, onOpenScheduled,
  // Multi-Tarif Zonen & Zeit (P2)
  tariffZone, timeTariff,
}) {
  return (
    <div className="space-y-3 pt-1">
      {/* Selected type pill + change (subtle) */}
      <div className="flex items-center justify-between -mt-1">
        <button
          onClick={onChangeType}
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition ${
            taxiType === "business"
              ? "bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/15"
              : "bg-purple-500/10 text-purple-400 hover:bg-purple-500/15"
          }`}
          data-testid="taxi-change-type-btn"
        >
          {taxiType === "business" ? "Unternehmer-Taxi" : "Privat-Taxi"} · Ändern
        </button>
      </div>

      {/* Greeting + Favorite Routes (only when no destination chosen yet) */}
      {!dropoff?.address && (
        <div>
          <h2 className="text-xl font-bold text-white">
            {greet()}{userName ? `, ${userName}` : ""} <span className="inline-block">👋</span>
          </h2>
          <p className="text-[13px] text-gray-400 mt-0.5">Wohin möchtest du fahren?</p>
        </div>
      )}

      {/* Promo-Banner entfernt für cleaneren Look (iter124 UX). Promo-Code-Field bleibt unten. */}

      {/* Welcome-State: 1 großer „Wohin?"-Search-Button statt 2 schmaler Address-Rows */}
      {!dropoff?.address ? (
        <button
          onClick={onTapDropoff}
          data-testid="taxi-dropoff-cta"
          className="w-full flex items-center gap-3 px-4 py-4 bg-gradient-to-r from-cyan-500/15 to-cyan-500/5 hover:from-cyan-500/25 hover:to-cyan-500/10 border-2 border-cyan-400/40 hover:border-cyan-400/60 rounded-2xl text-left active:scale-[0.98] transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-cyan-300 uppercase tracking-wider font-bold mb-0.5">Ziel</p>
            <p className="text-base font-semibold text-white">Wohin möchtest du?</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" className="shrink-0">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      ) : (
      /* Address rows */
      <div className="space-y-2">
        <AddressRow
          variant="pickup"
          value={pickup?.address}
          notes={pickup?.notes}
          placeholder="Abholadresse"
          onClick={onTapPickup}
          onAddNotes={onEditPickupNotes}
          testId="taxi-pickup-row"
        />

        {/* Waypoints */}
        {waypoints?.map((wp, idx) => (
          <AddressRow
            key={idx}
            variant="stop"
            value={wp.address}
            notes={wp.notes}
            placeholder={`Zwischenstopp ${idx + 1}`}
            onClick={() => onTapWaypoint?.(idx)}
            onClear={() => onRemoveWaypoint?.(idx)}
            onAddNotes={() => onEditWaypointNotes?.(idx)}
            testId={`taxi-waypoint-row-${idx}`}
          />
        ))}

        <AddressRow
          variant="dropoff"
          value={dropoff?.address}
          notes={dropoff?.notes}
          placeholder="Wohin möchtest du?"
          onClick={onTapDropoff}
          onClear={onClearDropoff}
          onAddNotes={onEditDropoffNotes}
          testId="taxi-dropoff-row"
        />

        {/* Add waypoint — erst wenn Ziel gewählt, sonst überfordert */}
        {dropoff?.address && (waypoints?.length || 0) < 3 && (
          <button
            onClick={onAddWaypoint}
            className="w-full flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-dashed border-white/15 rounded-xl text-xs text-gray-400 hover:text-white transition-colors"
            data-testid="taxi-add-waypoint"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Zwischenstopp hinzufügen</span>
          </button>
        )}
      </div>
      )}

      {!dropoff?.address && (
        <TaxiQuickActions
          savedPlaces={savedPlaces}
          lastRide={lastRide}
          onPickPlace={onPickSavedPlace}
          onUseLastRide={onUseLastRide}
          scheduleMode={scheduleMode}
          onScheduleModeChange={onScheduleModeChange}
          onOpenScheduled={onOpenScheduled}
        />
      )}

      {/* Gespeicherte-Orte-Row entfernt (Duplizierung mit Quick-Actions) — iter124 UX */}

      {/* Vehicle picker — auto-shown when estimates available, BEFORE options */}
      {estimates?.length > 0 && (
        <div className="space-y-3" data-testid="taxi-vehicle-section">
          <TaxiVehiclePicker
            estimates={estimates}
            selectedVehicle={selectedVehicle}
            onSelect={setSelectedVehicle}
          />
        </div>
      )}

      {/* Promo code */}
      {onPromoChange && (
        <TaxiPromoCodeField value={promo} onChange={onPromoChange} />
      )}

      {/* Options + Schedule */}
      <OptionsButton summary={optionsSummary} onClick={onOpenOptions} />

      {/* Surge */}
      {surge?.active && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3">
          <span className="text-xl">⚡</span>
          <div>
            <p className="text-sm font-medium text-yellow-400">Hohe Nachfrage</p>
            <p className="text-xs text-gray-400">Preise sind {surge.multiplier}× höher</p>
          </div>
        </div>
      )}

      {/* Multi-Tarif Badges: Zone + Time (P2) */}
      {(tariffZone || (timeTariff && timeTariff.multiplier > 1)) && (
        <div className="flex flex-wrap gap-2" data-testid="taxi-tariff-badges">
          {tariffZone && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30"
              data-testid="taxi-zone-badge"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" strokeWidth="2.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="text-[11px] font-semibold text-cyan-300">Zone {tariffZone.name}</span>
            </div>
          )}
          {timeTariff && timeTariff.multiplier > 1 && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                timeTariff.holiday
                  ? "bg-rose-500/10 border-rose-500/30"
                  : timeTariff.night
                    ? "bg-indigo-500/10 border-indigo-500/30"
                    : "bg-amber-500/10 border-amber-500/30"
              }`}
              data-testid="taxi-time-tariff-badge"
            >
              <span className="text-xs">
                {timeTariff.holiday ? "🎉" : timeTariff.night ? "🌙" : "📅"}
              </span>
              <span className={`text-[11px] font-semibold ${
                timeTariff.holiday ? "text-rose-300" : timeTariff.night ? "text-indigo-300" : "text-amber-300"
              }`}>
                {timeTariff.label} · ×{timeTariff.multiplier.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Live driver availability hint (taxi.eu parity) */}
      {nearbyCount != null && nearbyCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-emerald-400" data-testid="taxi-drivers-available">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>
            {nearbyCount === 1
              ? "1 Taxi in der Nähe verfügbar"
              : `${nearbyCount} Taxis in der Nähe verfügbar`}
          </span>
        </div>
      )}

      {/* No-drivers info banner — softer, info-style (taxi.eu shows similar) */}
      {noDriversAvailable && (
        <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xl flex items-start gap-2.5" data-testid="taxi-no-drivers-banner">
          <div className="w-8 h-8 rounded-lg bg-amber-400/15 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white/90">Gerade kein Taxi frei</p>
            <p className="text-[11px] text-white/55 mt-0.5 leading-snug">Du kannst trotzdem eine Bestellung absenden — wir benachrichtigen dich, sobald ein Fahrer verfügbar ist.</p>
          </div>
        </div>
      )}

      {/* Book CTA */}
      {estimates?.length > 0 ? (
        <>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onBook}
            disabled={loading}
            className="w-full py-4 bg-cyan-500 rounded-2xl font-bold text-black text-base disabled:opacity-50 shadow-[0_4px_24px_rgba(0,194,255,0.35)]"
            data-testid="taxi-book-btn"
          >
            {loading ? "Wird gebucht..." : scheduledLabel ? `Bestellen für ${scheduledLabel}` : "Taxi bestellen"}
          </motion.button>
        </>
      ) : (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onGetEstimates}
          disabled={loading || !dropoff?.address || !pickup?.lat}
          className="w-full py-4 bg-cyan-500 rounded-2xl font-bold text-black text-base disabled:opacity-50 shadow-[0_4px_24px_rgba(0,194,255,0.35)]"
          data-testid="taxi-show-prices-btn"
        >
          {loading ? "Lädt..." : "Preise anzeigen"}
        </motion.button>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm text-center">
          {error}
        </div>
      )}
    </div>
  );
}
