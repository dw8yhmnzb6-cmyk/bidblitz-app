/**
 * TaxiBookingForm — Address inputs, map, saved/quick destinations, vehicle picker.
 * Extracted from TaxiPage.jsx. Props are grouped to keep the call site readable.
 */
import React from "react";
import { motion } from "framer-motion";
import { POI_CATEGORIES } from "./TaxiConstants";
import TaxiPoiFilterSheet from "./TaxiPoiFilterSheet";
import TaxiMapStylePicker from "./TaxiMapStylePicker";
import TaxiSavePlaceModal from "./TaxiSavePlaceModal";
import TaxiVehiclePicker from "./TaxiVehiclePicker";
import TaxiAddressInput from "./TaxiAddressInput";

const QUICK_DESTINATIONS = [
  { name: "Flughafen BER", lat: 52.3667, lng: 13.5033 },
  { name: "Hauptbahnhof", lat: 52.5251, lng: 13.3694 },
  { name: "Alexanderplatz", lat: 52.5219, lng: 13.4132 },
  { name: "Brandenburger Tor", lat: 52.5163, lng: 13.3777 },
];

const PRISHTINA_PLACES = [
  { name: "Flughafen Prishtina", lat: 42.5728, lng: 21.0358 },
  { name: "Skanderbeg-Platz", lat: 42.6629, lng: 21.1655 },
  { name: "Newborn Monument", lat: 42.6598, lng: 21.1596 },
  { name: "Germia Park", lat: 42.674, lng: 21.191 },
  { name: "Kathedrale Mutter Teresa", lat: 42.6608, lng: 21.1573 },
  { name: "Grand Hotel Prishtina", lat: 42.6622, lng: 21.1645 },
  { name: "Bulevardi Nënë Tereza", lat: 42.661, lng: 21.162 },
  { name: "Albi Mall", lat: 42.6484, lng: 21.1544 },
];

const DUBAI_PLACES = [
  { name: "Dubai Airport (DXB)", lat: 25.2532, lng: 55.3657 },
  { name: "Burj Khalifa", lat: 25.1972, lng: 55.2744 },
  { name: "Dubai Mall", lat: 25.1985, lng: 55.2796 },
  { name: "Palm Jumeirah", lat: 25.1124, lng: 55.139 },
  { name: "Burj Al Arab", lat: 25.1413, lng: 55.1853 },
  { name: "Dubai Marina", lat: 25.0805, lng: 55.1403 },
  { name: "Dubai Frame", lat: 25.235, lng: 55.3006 },
  { name: "Mall of Emirates", lat: 25.1182, lng: 55.2006 },
];

const SAVED_PLACE_ICONS = { home: "🏠", work: "💼", gym: "🏋️", school: "🎓", star: "⭐" };

const greet = () => {
  const h = new Date().getHours();
  if (h < 5) return "Gute Nacht";
  if (h < 12) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
};

export default function TaxiBookingForm({
  taxiType, setTaxiType,
  pickup, dropoff, setDropoff,
  handlePickupChange, handleDropoffChange, geocodeOnBlur,
  pickupSuggestions, dropoffSuggestions,
  showPickupSugg, setShowPickupSugg,
  showDropoffSugg, setShowDropoffSugg,
  selectPickupSugg, selectDropoffSugg,
  mapContainerRef,
  getCurrentLocation, loadingLocation,
  currentAddress,
  mapStyle, setMapStyle,
  showMapStyles, setShowMapStyles,
  showPoiFilter, setShowPoiFilter,
  activePoiCategory, loadPOIs, poiLoading,
  favoritesCount, onFavoritesClick,
  savedPlaces,
  showSaveModal, setShowSaveModal,
  saveName, setSaveName,
  saveIcon, setSaveIcon,
  onSavePlace,
  estimates, selectedVehicle, setSelectedVehicle,
  surge, error, loading,
  getEstimates, bookRide,
  onOpenGroupRide,
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
          taxiType === "business" ? "bg-cyan-500/10 text-cyan-400" : "bg-purple-500/10 text-purple-400"
        }`}>
          {taxiType === "business" ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
          <span className="text-sm font-medium">
            {taxiType === "business" ? "Unternehmer-Taxi" : "Privat-Taxi"}
          </span>
        </div>
        <button
          onClick={() => setTaxiType("")}
          className="text-xs text-gray-400 hover:text-white underline"
          data-testid="taxi-change-type-btn"
        >Ändern</button>
      </div>

      <div className="relative h-56 bg-[#0A0A0F] rounded-2xl overflow-hidden border border-white/10">
        <div ref={mapContainerRef} className="w-full h-full" data-testid="taxi-map-container" style={{ minHeight: "14rem" }} />

        <button
          onClick={getCurrentLocation}
          disabled={loadingLocation}
          className="absolute bottom-3 right-3 bg-cyan-500 hover:bg-cyan-600 text-white p-3 rounded-full shadow-lg z-20 disabled:opacity-50 transition-colors"
          title="Standort aktualisieren"
          data-testid="taxi-reload-location"
        >
          {loadingLocation ? (
            <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>

        <button
          onClick={() => setShowPoiFilter(true)}
          className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md border border-white/10 text-white px-3 py-2.5 rounded-full shadow-lg z-20 flex items-center gap-2 hover:bg-black/90 transition-colors"
          title="In der Nähe anzeigen"
          data-testid="taxi-poi-filter-btn"
        >
          {activePoiCategory ? (
            <>
              <span className="text-base leading-none">{POI_CATEGORIES[activePoiCategory]?.icon}</span>
              <span className="text-xs font-semibold">{POI_CATEGORIES[activePoiCategory]?.label}</span>
              <span
                role="button"
                aria-label="Filter entfernen"
                onClick={(e) => { e.stopPropagation(); loadPOIs(null); }}
                className="ml-1 w-5 h-5 rounded-full bg-white/15 flex items-center justify-center text-[10px]"
              >×</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span className="text-xs font-semibold">In der Nähe</span>
            </>
          )}
        </button>

        <TaxiPoiFilterSheet
          isOpen={showPoiFilter}
          onClose={() => setShowPoiFilter(false)}
          activeCategory={activePoiCategory}
          onPick={loadPOIs}
          loading={poiLoading}
        />

        <button
          onClick={() => setShowMapStyles(true)}
          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/70 backdrop-blur-md border border-white/10 shadow-lg z-20 flex items-center justify-center hover:bg-black/90 transition-colors"
          title="Kartenmodus wechseln"
          data-testid="taxi-map-style-btn"
        >
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3 3m0 0l-3 3m3-3H9a6 6 0 00-6 6v3m18 0v-3a6 6 0 00-6-6h-3m0 18l-3-3m0 0l3-3m-3 3h6a6 6 0 006-6v-3" opacity="0.3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <TaxiMapStylePicker
          isOpen={showMapStyles}
          onClose={() => setShowMapStyles(false)}
          mapStyle={mapStyle}
          onPick={setMapStyle}
        />

        {currentAddress && (
          <div
            className="absolute top-3 left-3 right-16 bg-black/70 backdrop-blur-md px-3 py-2 rounded-xl z-10 border border-white/10"
            data-testid="taxi-current-address"
          >
            <p className="text-[9px] text-cyan-400 font-semibold uppercase tracking-wider">
              {currentAddress.includes("verweigert") || currentAddress.includes("nicht verfügbar") || currentAddress.includes("Timeout")
                ? "⚠️ Standortfehler"
                : "Dein Standort"}
            </p>
            <p className="text-xs text-white">{currentAddress}</p>
            {(currentAddress.includes("Standortzugriff verweigert") ||
              currentAddress.includes("nicht verfügbar") ||
              currentAddress.includes("Timeout")) && (
              <div className="mt-2 space-y-1">
                <p className="text-[9px] text-yellow-300">💡 Gib deine Adresse manuell im Feld unten ein</p>
                <button
                  onClick={getCurrentLocation}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium underline"
                >🔄 Standort erneut abfragen</button>
              </div>
            )}
          </div>
        )}

        <div className="absolute bottom-20 left-0 right-0 px-3 z-10 pointer-events-none">
          <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 backdrop-blur-md border border-cyan-500/20 rounded-2xl p-4">
            <p className="text-lg font-bold text-white mb-1">{greet()}</p>
            <p className="text-xs text-gray-400">Wohin möchtest du fahren?</p>
          </div>
        </div>

        {dropoff.lat !== 0 && estimates.length > 0 && (
          <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-2 rounded-xl z-10 border border-white/10">
            <p className="text-[10px] text-cyan-400 font-semibold">{estimates[0]?.distance_km} km</p>
            <p className="text-[9px] text-white/50">~{estimates[0]?.duration_minutes} Min</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <TaxiAddressInput
          variant="pickup"
          zIndexClass="z-20"
          testId="taxi-pickup-input"
          placeholder={
            pickup.address || currentAddress.includes("verweigert") || currentAddress.includes("nicht verfügbar")
              ? "📍 Abholadresse eingeben"
              : "Aktueller Standort"
          }
          value={pickup.address}
          onChange={handlePickupChange}
          onBlur={() => geocodeOnBlur("pickup")}
          suggestions={pickupSuggestions}
          showSuggestions={showPickupSugg}
          setShowSuggestions={setShowPickupSugg}
          onSuggestionClick={selectPickupSugg}
          favoritesCount={favoritesCount}
          onFavoritesClick={onFavoritesClick}
        />

        <TaxiAddressInput
          variant="dropoff"
          zIndexClass="z-10"
          testId="taxi-dropoff-input"
          placeholder="Wohin möchtest du?"
          value={dropoff.address}
          onChange={handleDropoffChange}
          onBlur={() => geocodeOnBlur("dropoff")}
          suggestions={dropoffSuggestions}
          showSuggestions={showDropoffSugg}
          setShowSuggestions={setShowDropoffSugg}
          onSuggestionClick={selectDropoffSugg}
        />

        {savedPlaces.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Gespeicherte Orte</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {savedPlaces.map((p) => (
                <button
                  key={p.place_id}
                  onClick={() => setDropoff({ lat: p.lat, lng: p.lng, address: p.address })}
                  className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 rounded-xl text-xs text-cyan-400 hover:bg-cyan-500/20 transition-colors border border-cyan-500/20"
                  data-testid={`taxi-saved-${p.name}`}
                >
                  <span>{SAVED_PLACE_ICONS[p.icon] || "📍"}</span>
                  <span className="font-medium">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Schnellauswahl</span>
            {dropoff.address && dropoff.lat !== 0 && (
              <button
                onClick={() => setShowSaveModal(true)}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                data-testid="taxi-save-place-btn"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Ziel speichern
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap mb-3">
            {QUICK_DESTINATIONS.map((dest) => (
              <button
                key={dest.name}
                onClick={() => setDropoff({ lat: dest.lat, lng: dest.lng, address: dest.name })}
                className="px-3 py-1.5 bg-white/5 rounded-lg text-xs text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors border border-white/5"
                data-testid={`taxi-quick-${dest.name}`}
              >{dest.name}</button>
            ))}
          </div>

          <div className="mb-2">
            <span className="text-[9px] text-gray-600 uppercase tracking-wider">Prishtina</span>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {PRISHTINA_PLACES.map((dest) => (
                <button
                  key={dest.name}
                  onClick={() => setDropoff({ lat: dest.lat, lng: dest.lng, address: dest.name + ", Prishtina" })}
                  className="px-2.5 py-1 bg-emerald-500/8 rounded-lg text-[10px] text-emerald-400/80 hover:bg-emerald-500/15 hover:text-emerald-400 transition-colors border border-emerald-500/10"
                  data-testid={`taxi-pri-${dest.name}`}
                >{dest.name}</button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[9px] text-gray-600 uppercase tracking-wider">Dubai</span>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {DUBAI_PLACES.map((dest) => (
                <button
                  key={dest.name}
                  onClick={() => setDropoff({ lat: dest.lat, lng: dest.lng, address: dest.name + ", Dubai" })}
                  className="px-2.5 py-1 bg-amber-500/8 rounded-lg text-[10px] text-amber-400/80 hover:bg-amber-500/15 hover:text-amber-400 transition-colors border border-amber-500/10"
                  data-testid={`taxi-dub-${dest.name}`}
                >{dest.name}</button>
              ))}
            </div>
          </div>
        </div>

        <TaxiSavePlaceModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          address={dropoff.address}
          saveIcon={saveIcon}
          setSaveIcon={setSaveIcon}
          saveName={saveName}
          setSaveName={setSaveName}
          onSave={onSavePlace}
        />

        <button
          onClick={getEstimates}
          disabled={loading || !dropoff.address}
          className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-semibold text-black disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
          data-testid="taxi-show-prices-btn"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Lädt...
            </span>
          ) : "🚕 Preise anzeigen"}
        </button>
      </div>

      {surge.active && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <p className="font-medium text-yellow-400">Hohe Nachfrage</p>
              <p className="text-sm text-gray-400">Preise sind {surge.multiplier}x höher</p>
            </div>
          </div>
        </div>
      )}

      {estimates.length > 0 && (
        <div className="space-y-3">
          <TaxiVehiclePicker
            estimates={estimates}
            selectedVehicle={selectedVehicle}
            onSelect={setSelectedVehicle}
          />
          <button
            onClick={bookRide}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl font-bold text-black text-lg disabled:opacity-50 shadow-[0_4px_24px_rgba(0,194,255,0.35)] hover:shadow-[0_6px_32px_rgba(0,194,255,0.5)] transition-shadow"
            data-testid="taxi-book-btn"
          >{loading ? "Wird gebucht..." : "Fahrt buchen"}</button>

          <button
            type="button"
            onClick={onOpenGroupRide}
            data-testid="taxi-group-ride-btn"
            className="w-full py-3 bg-[#121218] border border-emerald-500/40 text-emerald-300 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          >👥 Group Ride starten</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-center">
          {error}
        </div>
      )}
    </motion.div>
  );
}
