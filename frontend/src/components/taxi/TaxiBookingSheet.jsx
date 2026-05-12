/**
 * TaxiBookingSheet — taxi.eu-style bottom-sheet content for booking.
 * Shows: address rows (tappable → opens search sheet), order-options button,
 * vehicle picker, fare summary, prominent "Buchen" CTA, no-taxis warning.
 */
import React from "react";
import { motion } from "framer-motion";
import TaxiVehiclePicker from "./TaxiVehiclePicker";
import TaxiSavedPlacesRow from "./TaxiSavedPlacesRow";

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
  onGetEstimates, onBook,
  scheduledLabel,
  // City defaults
  pickupCity, citySaved, onSaveCityDefault,
}) {
  return (
    <div className="space-y-4 pt-1">
      {/* Selected type pill + change */}
      <div className="flex items-center justify-between">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            taxiType === "business" ? "bg-cyan-500/10 text-cyan-400" : "bg-purple-500/10 text-purple-400"
          }`}
        >
          <span className="text-xs font-semibold">
            {taxiType === "business" ? "Unternehmer-Taxi" : "Privat-Taxi"}
          </span>
        </div>
        <button
          onClick={onChangeType}
          className="text-xs text-gray-400 hover:text-white underline"
          data-testid="taxi-change-type-btn"
        >
          Ändern
        </button>
      </div>

      {/* Greeting (only when sheet expanded and nothing entered) */}
      {!dropoff?.address && (
        <div>
          <h2 className="text-xl font-bold text-white">{greet()}</h2>
          <p className="text-xs text-gray-400 mt-0.5">Wohin möchtest du fahren?</p>
        </div>
      )}

      {/* Address rows */}
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

        {/* Add waypoint */}
        {(waypoints?.length || 0) < 3 && (
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

      <TaxiSavedPlacesRow
        savedPlaces={savedPlaces}
        onPick={(p) => onPickSavedPlace(p)}
      />

      {/* Options + Schedule */}
      <OptionsButton summary={optionsSummary} onClick={onOpenOptions} />

      {/* Save current options as default for this pickup city */}
      {pickupCity && !citySaved && onSaveCityDefault && (
        <button
          onClick={onSaveCityDefault}
          className="w-full px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-gray-300 flex items-center justify-center gap-2"
          data-testid="taxi-save-city-default"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00C2FF" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          Als Standard für {pickupCity} speichern
        </button>
      )}
      {pickupCity && citySaved && (
        <p className="text-[10px] text-emerald-400/80 text-center" data-testid="taxi-city-saved-hint">
          ✓ Standard-Optionen für {pickupCity} aktiv
        </p>
      )}

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

      {/* No-drivers banner (taxi.eu parity) */}
      {noDriversAvailable && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-sm font-medium text-red-300">Leider ist kein freies Taxi in Ihrer Nähe.</p>
          <p className="text-xs text-gray-400 mt-1">Probieren Sie es bitte zu einem späteren Zeitpunkt noch einmal.</p>
        </div>
      )}

      {/* Estimates / Book CTA */}
      {estimates?.length > 0 ? (
        <div className="space-y-3">
          <TaxiVehiclePicker
            estimates={estimates}
            selectedVehicle={selectedVehicle}
            onSelect={setSelectedVehicle}
          />
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onBook}
            disabled={loading}
            className="w-full py-4 bg-cyan-500 rounded-2xl font-bold text-black text-base disabled:opacity-50 shadow-[0_4px_24px_rgba(0,194,255,0.35)]"
            data-testid="taxi-book-btn"
          >
            {loading ? "Wird gebucht..." : scheduledLabel ? `Bestellen für ${scheduledLabel}` : "Taxi bestellen"}
          </motion.button>
        </div>
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
