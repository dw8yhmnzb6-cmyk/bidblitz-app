import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Car, CheckCircle2, Clock3, Loader2, MapPin, Navigation, Search, Star } from 'lucide-react';
import { useUser } from '../store/UserContext';
import { TaxiMap } from '../components/RealMap';
import { useTaxiGeocoder } from '../components/taxi/useTaxiGeocoder';
import * as api from '../services/taxiApi';

const VEHICLES = [
  { id: 'standard', label: 'UberX', subtitle: 'Schnell & günstig', accent: '#111827' },
  { id: 'premium', label: 'Comfort', subtitle: 'Mehr Platz & Komfort', accent: '#0F766E' },
  { id: 'van', label: 'XL', subtitle: 'Für Gruppen & Gepäck', accent: '#7C3AED' },
];

const QUICK_PLACES = [
  { id: 'home', label: 'Home', subtitle: 'Zuhause speichern oder wählen', icon: '🏠' },
  { id: 'work', label: 'Work', subtitle: 'Arbeitsadresse', icon: '💼' },
  { id: 'airport', label: 'Flughafen', subtitle: 'BER Terminal 1-2', icon: '✈️', preset: { address: 'Flughafen Berlin Brandenburg (BER)', lat: 52.3667, lng: 13.5033 } },
  { id: 'station', label: 'Bahnhof', subtitle: 'Berlin Hauptbahnhof', icon: '🚉', preset: { address: 'Berlin Hauptbahnhof', lat: 52.5251, lng: 13.3694 } },
];

function RideStatusBadge({ ride }) {
  const statusMap = {
    requested: { label: 'Fahrer wird gesucht', tone: 'bg-amber-500/15 text-amber-300' },
    accepted: { label: 'Fahrer bestätigt', tone: 'bg-cyan-500/15 text-cyan-300' },
    arriving: { label: 'Fahrer kommt', tone: 'bg-cyan-500/15 text-cyan-300' },
    started: { label: 'Fahrt läuft', tone: 'bg-emerald-500/15 text-emerald-300' },
    completed: { label: 'Abgeschlossen', tone: 'bg-emerald-500/15 text-emerald-300' },
    cancelled: { label: 'Storniert', tone: 'bg-red-500/15 text-red-300' },
  };
  const item = statusMap[ride?.status] || statusMap.requested;
  return <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${item.tone}`} data-testid="taxi-customer-ride-status-badge">{item.label}</span>;
}

export default function TaxiPage({ onNavigate }) {
  const { user } = useUser();
  const { search } = useTaxiGeocoder({ debounceMs: 180 });

  const [pickup, setPickup] = useState({ lat: 52.52, lng: 13.405, address: '' });
  const [dropoff, setDropoff] = useState({ lat: 0, lng: 0, address: '' });
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('standard');
  const [estimates, setEstimates] = useState([]);
  const [surge, setSurge] = useState(null);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [searchMode, setSearchMode] = useState('dropoff');
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [recentAddresses, setRecentAddresses] = useState([]);
  const [favoriteRoutes, setFavoriteRoutes] = useState([]);
  const [bookingMode, setBookingMode] = useState('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [forOther, setForOther] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  useEffect(() => {
    if (!navigator.geolocation) {
      setPickup((prev) => ({ ...prev, address: 'Berlin Mitte' }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude, address: 'Dein Standort' };
        setPickup(next);
        const address = await api.reverseGeocode(next.lat, next.lng);
        if (address) setPickup((prev) => ({ ...prev, address }));
      },
      () => setPickup((prev) => ({ ...prev, address: 'Berlin Mitte' })),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const loadActiveRide = useCallback(async () => {
    const data = await api.fetchActiveRide();
    const ride = data?.rides?.[0] || null;
    setActiveRide(ride);
  }, []);

  useEffect(() => {
    loadActiveRide();
  }, [loadActiveRide]);

  useEffect(() => {
    let cancelled = false;
    const loadSaved = async () => {
      const [places, favs, recents, routes] = await Promise.all([
        api.fetchSavedPlaces(),
        api.fetchFavorites(),
        api.fetchRecentAddresses(6),
        api.fetchFavoriteRoutes(4),
      ]);
      if (!cancelled) {
        setSavedPlaces(places || []);
        setFavorites(favs || []);
        setRecentAddresses(recents || []);
        setFavoriteRoutes(routes || []);
      }
    };
    loadSaved();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshTaxiCollections = useCallback(async () => {
    const [places, favs, recents, routes] = await Promise.all([
      api.fetchSavedPlaces(),
      api.fetchFavorites(),
      api.fetchRecentAddresses(6),
      api.fetchFavoriteRoutes(4),
    ]);
    setSavedPlaces(places || []);
    setFavorites(favs || []);
    setRecentAddresses(recents || []);
    setFavoriteRoutes(routes || []);
  }, []);

  useEffect(() => {
    if (!activeRide) return undefined;
    if (!['requested', 'accepted', 'arriving', 'started'].includes(activeRide.status)) return undefined;
    const timer = window.setInterval(loadActiveRide, 4000);
    return () => window.clearInterval(timer);
  }, [activeRide, loadActiveRide]);

  useEffect(() => {
    if (!pickup?.lat) return;
    let cancelled = false;
    const loadNearby = async () => {
      const data = await api.fetchNearbyDriversCount({ lat: pickup.lat, lng: pickup.lng, carType: selectedVehicle });
      if (!cancelled) setNearbyDrivers(data.drivers || []);
    };
    loadNearby();
    return () => {
      cancelled = true;
    };
  }, [pickup?.lat, pickup?.lng, selectedVehicle]);

  const estimateRide = useCallback(async () => {
    if (!pickup?.lat || !dropoff?.lat) return;
    setEstimating(true);
    setError('');
    const result = await api.estimateRide({ pickup, dropoff });
    if (!result.ok) {
      setEstimates([]);
      setError(result.error || 'Keine Fahrten verfügbar');
      if (bookingMode === 'now') setBookingMode('later');
      setEstimating(false);
      return;
    }
    setEstimates(result.estimates || []);
    setSurge(result.surge || null);
    const recommended = (result.estimates || []).find((item) => item.vehicle_type === selectedVehicle) || result.estimates?.[0];
    if (recommended?.vehicle_type) setSelectedVehicle(recommended.vehicle_type);
    setBottomSheetOpen(true);
    setEstimating(false);
  }, [pickup, dropoff, selectedVehicle]);

  useEffect(() => {
    if (dropoff?.lat) estimateRide();
  }, [dropoff?.lat, dropoff?.lng, estimateRide]);

  const selectedEstimate = useMemo(
    () => estimates.find((item) => item.vehicle_type === selectedVehicle) || estimates[0] || null,
    [estimates, selectedVehicle],
  );

  const mapDrivers = useMemo(
    () => nearbyDrivers.slice(0, 10).map((driver) => ({
      id: driver.driver_id,
      lat: driver.location?.lat || driver.lat,
      lng: driver.location?.lng || driver.lng,
      popup: `${driver.user_name || driver.name || 'Fahrer'} · ${driver.eta_minutes || 4} Min`,
    })).filter((driver) => Number.isFinite(driver.lat) && Number.isFinite(driver.lng)),
    [nearbyDrivers],
  );

  const handleAddressChange = (type, value) => {
    if (type === 'pickup') {
      setPickup((prev) => ({ ...prev, address: value }));
      search('pickup-customer', value, setPickupSuggestions, setShowPickupSuggestions, pickup?.lat ? { lat: pickup.lat, lng: pickup.lng } : null);
    } else {
      setDropoff((prev) => ({ ...prev, address: value }));
      search('dropoff-customer', value, setDropoffSuggestions, setShowDropoffSuggestions, pickup?.lat ? { lat: pickup.lat, lng: pickup.lng } : null);
    }
  };

  const handleSuggestionSelect = (type, item) => {
    const payload = { address: item.address || item.name, lat: item.lat, lng: item.lng };
    if (type === 'pickup') {
      setPickup(payload);
      setShowPickupSuggestions(false);
      setSearchMode('dropoff');
    } else {
      setDropoff(payload);
      setShowDropoffSuggestions(false);
    }
  };

  const handleSaveSuggestionAsFavorite = async (item) => {
    const labelBase = item.name || item.address || 'Favorit';
    const result = await api.saveFavoriteFromSearch({
      name: labelBase,
      address: item.address || item.name,
      lat: item.lat,
      lng: item.lng,
      icon: 'star',
    });
    if (!result.ok) {
      setError(result.error || 'Favorit konnte nicht gespeichert werden');
      return;
    }
    setFavorites(await api.fetchFavorites());
  };

  const resolveQuickPlace = (place) => {
    if (place.preset) return place.preset;
    const saved = savedPlaces.find((entry) => (entry.icon || '').toLowerCase() === place.id || (entry.name || '').toLowerCase() === place.id);
    if (saved) {
      return { address: saved.address, lat: saved.lat || saved.latitude, lng: saved.lng || saved.longitude };
    }
    return null;
  };

  const handleQuickPlace = (place) => {
    const resolved = resolveQuickPlace(place);
    if (!resolved) {
      setError(`${place.label} ist noch nicht gespeichert.`);
      return;
    }
    setDropoff(resolved);
    setSearchMode('dropoff');
    setError('');
  };

  const handleSaveHomeWork = async (kind) => {
    const source = dropoff?.lat ? dropoff : pickup;
    if (!source?.lat || !source?.address) {
      setError('Bitte zuerst einen Ort auswählen.');
      return;
    }
    const ok = await api.savePlaceApi({
      name: kind === 'home' ? 'Home' : 'Work',
      icon: kind,
      address: source.address,
      lat: source.lat,
      lng: source.lng,
    });
    if (!ok) {
      setError(`${kind === 'home' ? 'Home' : 'Work'} konnte nicht gespeichert werden.`);
      return;
    }
    setError('');
    await refreshTaxiCollections();
  };

  const handleFavoriteRouteSelect = (route) => {
    if (route?.pickup) setPickup(route.pickup);
    if (route?.dropoff) setDropoff(route.dropoff);
    setError('');
  };

  const handleBookRide = async () => {
    if (!selectedEstimate) return;
    setBooking(true);
    setError('');
    const bookOptions = {
      bookingMode,
      scheduledAt: bookingMode === 'later' ? scheduledAt : null,
      recipientName: forOther ? recipientName : null,
      recipientPhone: forOther ? recipientPhone : null,
    };
    const result = await api.bookRideApi({ pickup, dropoff, vehicleType: selectedEstimate.vehicle_type, paymentMethod: 'wallet', options: bookOptions });
    setBooking(false);
    if (!result.ok) {
      setError(result.error || 'Buchung fehlgeschlagen');
      return;
    }
    setActiveRide(result.ride);
  };

  const handleCancelRide = async () => {
    if (!activeRide?.ride_id) return;
    const result = await api.cancelRideApi(activeRide.ride_id);
    if (!result.ok) {
      setError(result.error || 'Stornierung fehlgeschlagen');
      return;
    }
    setActiveRide(null);
    await loadActiveRide();
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#111827]" data-testid="taxi-customer-page">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col lg:flex-row">
        <section className="w-full lg:w-[460px] xl:w-[520px] border-r border-slate-200 bg-white">
          <div className="flex items-center gap-3 px-5 pt-5">
            <button onClick={() => onNavigate?.('/')} className="rounded-full border border-slate-200 p-2 text-slate-600" data-testid="taxi-customer-back-button">
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Taxi</p>
              <h1 className="text-2xl font-black">Fahrt buchen</h1>
            </div>
          </div>

          <div className="px-5 pb-8 pt-5">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-sm" data-testid="taxi-customer-search-card">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Wie bei Uber</p>
                  <h2 className="mt-1 text-lg font-black">Einfach Adresse eingeben und sofort Preis sehen</h2>
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700" data-testid="taxi-customer-live-driver-badge">
                  {mapDrivers.length} Fahrer in der Nähe
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'pickup', label: 'Abholung', value: pickup.address, placeholder: 'Dein Standort', active: searchMode === 'pickup', suggestions: pickupSuggestions, show: showPickupSuggestions },
                  { id: 'dropoff', label: 'Wohin?', value: dropoff.address, placeholder: 'Adresse, Hotel, Flughafen, Bahnhof…', active: searchMode === 'dropoff', suggestions: dropoffSuggestions, show: showDropoffSuggestions },
                ].map((field) => (
                  <div key={field.id} className="relative" data-testid={`taxi-customer-field-${field.id}`}>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{field.label}</label>
                    <div className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 transition ${field.active ? 'border-[#00C2FF] shadow-[0_0_0_4px_rgba(0,194,255,0.12)]' : 'border-slate-200'}`}>
                      {field.id === 'pickup' ? <Navigation className="h-4 w-4 text-[#00C2FF]" /> : <Search className="h-4 w-4 text-slate-400" />}
                      <input
                        value={field.value}
                        onFocus={() => setSearchMode(field.id)}
                        onChange={(e) => handleAddressChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-transparent text-[15px] font-medium outline-none placeholder:text-slate-400"
                        data-testid={`taxi-customer-input-${field.id}`}
                      />
                    </div>
                    {field.show && field.suggestions.length > 0 ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl" data-testid={`taxi-customer-suggestions-${field.id}`}>
                        {field.suggestions.slice(0, 6).map((item, index) => (
                          <div key={`${field.id}-${index}`} className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50" data-testid={`taxi-customer-suggestion-${field.id}-${index}`}>
                            <button onMouseDown={() => handleSuggestionSelect(field.id, item)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                              <div className="mt-0.5 rounded-xl bg-slate-100 p-2 text-slate-500"><MapPin size={14} /></div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-slate-900">{item.name || item.address}</div>
                                <div className="truncate text-xs text-slate-500">{item.cityZip || item.address}</div>
                              </div>
                            </button>
                            {field.id === 'dropoff' ? <button onMouseDown={() => handleSaveSuggestionAsFavorite(item)} className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600" data-testid={`taxi-customer-save-suggestion-${index}`}>Speichern</button> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-white" data-testid="taxi-customer-route-preview-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Route</p>
                    <p className="mt-1 text-sm font-semibold">{pickup.address || 'Abholung wählen'} → {dropoff.address || 'Ziel wählen'}</p>
                  </div>
                  {estimating ? <Loader2 className="h-5 w-5 animate-spin text-white/60" /> : null}
                </div>
                <p className="mt-2 text-xs text-white/65" data-testid="taxi-customer-search-helper">Suche reagiert schon ab wenigen Buchstaben und zoomt direkt auf Pickup + Ziel.</p>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3" data-testid="taxi-customer-booking-mode-tabs">
                {[
                  { id: 'now', label: 'Jetzt bestellen' },
                  { id: 'later', label: 'Später bestellen' },
                  { id: 'other', label: 'Für jemand anderen' },
                ].map((mode) => (
                  <button key={mode.id} onClick={() => { setBookingMode(mode.id === 'other' ? 'now' : mode.id); setForOther(mode.id === 'other'); }} className={`rounded-2xl border px-3 py-3 text-left text-sm font-semibold ${((mode.id === 'other' && forOther) || (mode.id !== 'other' && bookingMode === mode.id && !forOther)) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`} data-testid={`taxi-customer-booking-mode-${mode.id}`}>
                    {mode.label}
                  </button>
                ))}
              </div>

              {bookingMode === 'later' ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3" data-testid="taxi-customer-schedule-box">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Abholzeit</label>
                  <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" data-testid="taxi-customer-scheduled-at-input" />
                </div>
              ) : null}

              {forOther ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3" data-testid="taxi-customer-recipient-box">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Name der Person</label>
                  <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Max Mustermann" data-testid="taxi-customer-recipient-name-input" />
                  <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Telefon</label>
                  <input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="+49 …" data-testid="taxi-customer-recipient-phone-input" />
                </div>
              ) : null}
            </div>

            <AnimatePresence>
              {error ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="taxi-customer-error-card">
                  {error}
                  {bookingMode === 'later' ? <button onClick={() => setBottomSheetOpen(true)} className="mt-3 block rounded-full border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700" data-testid="taxi-customer-error-open-later-button">Später planen öffnen</button> : null}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="mt-4 grid grid-cols-2 gap-2" data-testid="taxi-customer-quick-places">
              {QUICK_PLACES.map((place) => (
                <button key={place.id} onClick={() => handleQuickPlace(place)} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left" data-testid={`taxi-customer-quick-place-${place.id}`}>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><span>{place.icon}</span>{place.label}</div>
                  <p className="mt-1 text-[11px] text-slate-500">{place.subtitle}</p>
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2" data-testid="taxi-customer-home-work-management">
              <button onClick={() => handleSaveHomeWork('home')} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left" data-testid="taxi-customer-save-home-button">
                <div className="text-sm font-bold text-slate-900">Home speichern</div>
                <p className="mt-1 text-[11px] text-slate-500">Aktuellen Ort als Zuhause merken</p>
              </button>
              <button onClick={() => handleSaveHomeWork('work')} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left" data-testid="taxi-customer-save-work-button">
                <div className="text-sm font-bold text-slate-900">Work speichern</div>
                <p className="mt-1 text-[11px] text-slate-500">Aktuellen Ort als Arbeit merken</p>
              </button>
            </div>

            <div className="mt-3 grid gap-2" data-testid="taxi-customer-saved-home-work-list">
              {savedPlaces.filter((place) => ['home', 'work'].includes((place.icon || '').toLowerCase()) || ['home', 'work'].includes((place.name || '').toLowerCase())).slice(0, 2).map((place) => (
                <button key={place.place_id || place.name} onClick={() => setDropoff({ address: place.address, lat: place.lat, lng: place.lng })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left" data-testid={`taxi-customer-saved-place-${(place.icon || place.name || '').toLowerCase()}`}>
                  <div className="text-sm font-semibold text-slate-900">{place.name}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{place.address}</div>
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm" data-testid="taxi-customer-smart-suggestions-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Intelligente Suche</p>
                  <h3 className="mt-1 text-lg font-black">Letzte Ziele und häufige Orte</h3>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {favoriteRoutes.slice(0, 2).map((route, index) => (
                  <button key={`fav-route-${index}`} onClick={() => handleFavoriteRouteSelect(route)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left" data-testid={`taxi-customer-favorite-route-${index}`}>
                    <div className="text-sm font-semibold text-slate-900">{route.pickup?.address} → {route.dropoff?.address}</div>
                    <div className="mt-1 text-[11px] text-slate-500">Häufig gefahren · Ø €{Number(route.avg_fare || 0).toFixed(2)}</div>
                  </button>
                ))}
                {recentAddresses.slice(0, 3).map((address, index) => (
                  <button key={`recent-address-${index}`} onClick={() => setDropoff({ address: address.address, lat: address.lat, lng: address.lng })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left" data-testid={`taxi-customer-recent-address-${index}`}>
                    <div className="text-sm font-semibold text-slate-900">{address.address}</div>
                    <div className="mt-1 text-[11px] text-slate-500">Zuletzt genutzt · {address.use_count || 1}×</div>
                  </button>
                ))}
                {favorites.slice(0, 3).map((favorite, index) => (
                  <button key={`favorite-address-${index}`} onClick={() => setDropoff({ address: favorite.address, lat: favorite.latitude, lng: favorite.longitude })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left" data-testid={`taxi-customer-favorite-address-${index}`}>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Star size={14} className="text-amber-500" /> {favorite.name}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{favorite.address}</div>
                  </button>
                ))}
              </div>
            </div>

            {activeRide ? (
              <div className="mt-4 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm" data-testid="taxi-customer-active-ride-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Aktive Fahrt</p>
                    <h3 className="mt-1 text-lg font-black">{activeRide.driver?.name || 'Fahrer wird gesucht'}</h3>
                  </div>
                  <RideStatusBadge ride={activeRide} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Abholung</p>
                    <p className="mt-1 text-sm font-semibold">{activeRide.pickup?.address}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Ziel</p>
                    <p className="mt-1 text-sm font-semibold">{activeRide.dropoff?.address}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700" data-testid="taxi-customer-active-ride-price">€{Number(activeRide.final_fare || activeRide.estimated_fare || 0).toFixed(2)}</div>
                  <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700" data-testid="taxi-customer-active-ride-eta">{activeRide.driver?.eta_minutes || activeRide.eta_minutes || 4} Min</div>
                </div>
                <div className="mt-4 space-y-2" data-testid="taxi-customer-live-tracking-steps">
                  {[
                    { id: 'requested', label: 'Anfrage gesendet', done: ['requested', 'accepted', 'arriving', 'started', 'completed'].includes(activeRide.status) },
                    { id: 'accepted', label: 'Fahrer bestätigt', done: ['accepted', 'arriving', 'started', 'completed'].includes(activeRide.status) },
                    { id: 'arriving', label: 'Fahrer kommt zu dir', done: ['arriving', 'started', 'completed'].includes(activeRide.status) },
                    { id: 'started', label: 'Du bist unterwegs', done: ['started', 'completed'].includes(activeRide.status) },
                  ].map((step) => (
                    <div key={step.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3" data-testid={`taxi-customer-live-step-${step.id}`}>
                      <div className={`rounded-full p-1.5 ${step.done ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}><CheckCircle2 size={14} /></div>
                      <div className="text-sm font-medium text-slate-700">{step.label}</div>
                    </div>
                  ))}
                </div>
                <button onClick={handleCancelRide} className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700" data-testid="taxi-customer-cancel-ride-button">Fahrt stornieren</button>
              </div>
            ) : (
              <div className="mt-4 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm" data-testid="taxi-customer-vehicles-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Fahrten</p>
                    <h3 className="mt-1 text-lg font-black">Wähle dein Fahrzeug</h3>
                  </div>
                  {surge?.active ? <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700" data-testid="taxi-customer-surge-badge">Surge x{Number(surge.multiplier || 1).toFixed(1)}</span> : null}
                </div>

                <div className="mt-4 space-y-3">
                  {VEHICLES.map((vehicle) => {
                    const estimate = estimates.find((item) => item.vehicle_type === vehicle.id);
                    const selected = selectedVehicle === vehicle.id;
                    return (
                      <button
                        key={vehicle.id}
                        onClick={() => setSelectedVehicle(vehicle.id)}
                        className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
                        data-testid={`taxi-customer-vehicle-${vehicle.id}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`rounded-2xl p-3 ${selected ? 'bg-white/10' : 'bg-slate-100'}`}><Car size={18} /></div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold">{vehicle.label}</span>
                                {vehicle.id === 'standard' ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Empfohlen</span> : null}
                              </div>
                              <p className={`mt-1 text-xs ${selected ? 'text-white/60' : 'text-slate-500'}`}>{vehicle.subtitle}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-black">{estimate ? `€${Number(estimate.total || estimate.fare || 0).toFixed(2)}` : '—'}</p>
                            <p className={`text-xs ${selected ? 'text-white/60' : 'text-slate-500'}`}>{estimate ? `${estimate.eta_minutes || estimate.duration_minutes || 5} Min` : 'Berechne…'}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleBookRide}
                  disabled={!selectedEstimate || booking || !dropoff?.lat}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  data-testid="taxi-customer-book-button"
                >
                  {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
                  {booking ? 'Bucht…' : selectedEstimate ? `Bestellen · €${Number(selectedEstimate.total || selectedEstimate.fare || 0).toFixed(2)}` : 'Ziel eingeben'}
                </button>
                <p className="mt-3 text-center text-xs text-slate-500" data-testid="taxi-customer-wallet-hint">Bezahlung aktuell direkt per Wallet. Guthaben: €{Number(user?.balance || 0).toFixed(2)}</p>
              </div>
            )}
          </div>
        </section>

        <section className="relative flex-1 bg-slate-100">
          <div className="absolute inset-0">
            <TaxiMap
              pickup={pickup?.lat ? pickup : null}
              dropoff={dropoff?.lat ? dropoff : null}
              driverLocation={activeRide?.driver_lat && activeRide?.driver_lng ? { lat: activeRide.driver_lat, lng: activeRide.driver_lng } : null}
              height="100%"
              nearbyDrivers={mapDrivers}
            />
          </div>
          <div className="pointer-events-none absolute left-6 right-6 top-6 z-[500] flex justify-center">
            <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm" data-testid="taxi-customer-map-helper">
              <Navigation size={14} className="text-[#00C2FF]" /> Karte zoomt automatisch auf Abholung und Ziel
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-6 left-6 right-6 z-[500]">
            <div className="pointer-events-auto mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/70 bg-white/92 px-4 py-3 shadow-lg" data-testid="taxi-customer-map-summary-card">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Live Vorschau</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{pickup.address || 'Abholung'} → {dropoff.address || 'Ziel auswählen'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700" data-testid="taxi-customer-map-driver-count">{mapDrivers.length} Fahrer</div>
                {selectedEstimate ? <div className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white" data-testid="taxi-customer-map-price">€{Number(selectedEstimate.total || selectedEstimate.fare || 0).toFixed(2)}</div> : null}
                {selectedEstimate ? <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700" data-testid="taxi-customer-map-eta">{selectedEstimate.eta_minutes || selectedEstimate.duration_minutes || 5} Min</div> : null}
              </div>
            </div>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {!activeRide && bottomSheetOpen && selectedEstimate ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[700] bg-black/30" onClick={() => setBottomSheetOpen(false)}>
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 24 }} className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-2xl rounded-t-[32px] bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="taxi-customer-vehicle-bottom-sheet">
              <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-slate-200" />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Fahrzeuge</p>
                  <h3 className="mt-1 text-lg font-black">Wähle deine Fahrt</h3>
                </div>
                <button onClick={() => setBottomSheetOpen(false)} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" data-testid="taxi-customer-bottom-sheet-close">Schließen</button>
              </div>
              <div className="mt-4 space-y-3">
                {VEHICLES.map((vehicle) => {
                  const estimate = estimates.find((item) => item.vehicle_type === vehicle.id);
                  const selected = selectedVehicle === vehicle.id;
                  return (
                    <button key={`sheet-${vehicle.id}`} onClick={() => setSelectedVehicle(vehicle.id)} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left ${selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'}`} data-testid={`taxi-customer-bottom-sheet-vehicle-${vehicle.id}`}>
                      <div>
                        <div className="text-sm font-bold">{vehicle.label}</div>
                        <div className={`mt-1 text-xs ${selected ? 'text-white/65' : 'text-slate-500'}`}>{vehicle.subtitle}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black">{estimate ? `€${Number(estimate.total || estimate.fare || 0).toFixed(2)}` : '—'}</div>
                        <div className={`mt-1 text-xs ${selected ? 'text-white/65' : 'text-slate-500'}`}>{estimate ? `${estimate.eta_minutes || estimate.duration_minutes || 5} Min` : '—'}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <button onClick={handleBookRide} disabled={!selectedEstimate || booking} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 text-sm font-semibold text-white disabled:opacity-50" data-testid="taxi-customer-bottom-sheet-book-button">
                {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
                {booking ? 'Bucht…' : `Bestellen · €${Number(selectedEstimate.total || selectedEstimate.fare || 0).toFixed(2)}`}
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}