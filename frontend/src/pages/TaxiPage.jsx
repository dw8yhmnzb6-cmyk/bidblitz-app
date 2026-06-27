import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Car, Clock3, Loader2, MapPin, Navigation, Search, Star, Plane, Train, Home, Briefcase, Sparkles, LocateFixed } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '../store/UserContext';
import { TaxiMap } from '../components/RealMap';
import ActiveRideTracker from '../components/taxi/ActiveRideTracker';
import { useTaxiGeocoder } from '../components/taxi/useTaxiGeocoder';
import * as api from '../services/taxiApi';

const VEHICLES = [
  { id: 'standard', label: 'UberX', subtitle: 'Schnell & günstig' },
  { id: 'premium', label: 'Comfort', subtitle: 'Mehr Komfort & Ruhe' },
  { id: 'van', label: 'XL', subtitle: 'Für Gruppen & Gepäck' },
];

const REGION_PRESETS = [
  {
    key: 'kosovo',
    matches: ['kosovo', 'prishtin', 'pristina', ', xk', ' republic of kosovo'],
    airportQuery: 'Pristina International Airport',
    stationQuery: 'Prishtina Bus Station',
    airportLabel: 'Flughafen Kosovo',
    stationLabel: 'Busbahnhof Prishtina',
    regionLabel: 'Kosovo',
  },
  {
    key: 'berlin',
    matches: ['berlin', ', de'],
    airportQuery: 'Flughafen Berlin Brandenburg BER',
    stationQuery: 'Berlin Hauptbahnhof',
    airportLabel: 'BER Flughafen',
    stationLabel: 'Berlin Hbf',
    regionLabel: 'Berlin',
  },
  {
    key: 'vienna',
    matches: ['wien', 'vienna', ', at'],
    airportQuery: 'Vienna International Airport',
    stationQuery: 'Wien Hauptbahnhof',
    airportLabel: 'Flughafen Wien',
    stationLabel: 'Wien Hbf',
    regionLabel: 'Wien',
  },
  {
    key: 'zurich',
    matches: ['zürich', 'zurich', ', ch'],
    airportQuery: 'Zurich Airport',
    stationQuery: 'Zürich Hauptbahnhof',
    airportLabel: 'Flughafen Zürich',
    stationLabel: 'Zürich HB',
    regionLabel: 'Zürich',
  },
];

const DEFAULT_REGION = {
  key: 'default',
  airportQuery: 'Airport',
  stationQuery: 'Central Station',
  airportLabel: 'Nächster Flughafen',
  stationLabel: 'Nächster Bahnhof',
  regionLabel: 'Deine Region',
};

function formatSeconds(value) {
  const total = Math.max(0, Number(value || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} Min`;
}

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

function RideChatPanel({ messages, loading, draft, onDraftChange, onSend }) {
  return (
    <div className="mt-4 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm" data-testid="taxi-customer-chat-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Live Chat</p>
          <h3 className="mt-1 text-lg font-black">Nachricht an Fahrer senden</h3>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600" data-testid="taxi-customer-chat-count">{messages.length} Nachrichten</div>
      </div>
      <div className="mt-4 space-y-2" data-testid="taxi-customer-chat-message-list">
        {loading ? <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Lade Chat…</div> : null}
        {!loading && messages.length === 0 ? <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Noch keine Nachrichten. Schreib dem Fahrer kurz, wo du genau stehst.</div> : null}
        {messages.map((message) => {
          const ownMessage = message.sender_role === 'customer' || message.sender_role === 'admin';
          return (
            <div key={message.message_id} className={`rounded-2xl px-4 py-3 ${ownMessage ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`} data-testid={`taxi-customer-chat-message-${message.message_id}`}>
              <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.14em]">
                <span>{ownMessage ? 'Du' : message.sender_name || 'Fahrer'}</span>
                <span className={ownMessage ? 'text-white/60' : 'text-slate-500'}>{message.sent_at ? new Date(message.sent_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
              <p className={`mt-2 text-sm ${ownMessage ? 'text-white' : 'text-slate-700'}`}>{message.text}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="z. B. Ich stehe am Haupteingang"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none placeholder:text-slate-400"
          data-testid="taxi-customer-chat-input"
        />
        <button onClick={onSend} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white" data-testid="taxi-customer-chat-send-button">Senden</button>
      </div>
    </div>
  );
}

function detectRegion(address = '') {
  const hay = String(address || '').toLowerCase();
  return REGION_PRESETS.find((region) => region.matches.some((token) => hay.includes(token))) || DEFAULT_REGION;
}

function resolveHomeWork(savedPlaces) {
  const home = savedPlaces.find((place) => (place.icon || '').toLowerCase() === 'home' || (place.name || '').toLowerCase() === 'home');
  const work = savedPlaces.find((place) => (place.icon || '').toLowerCase() === 'work' || (place.name || '').toLowerCase() === 'work');
  return { home, work };
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
  const [favorites, setFavorites] = useState([]);
  const [recentAddresses, setRecentAddresses] = useState([]);
  const [favoriteRoutes, setFavoriteRoutes] = useState([]);
  const [bookingMode, setBookingMode] = useState('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [forOther, setForOther] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [rideMessages, setRideMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [regionalQuickPlaces, setRegionalQuickPlaces] = useState([]);

  useEffect(() => {
    document.body.classList.add('taxi-fullscreen-mode');
    return () => document.body.classList.remove('taxi-fullscreen-mode');
  }, []);

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

  const loadRideMessages = useCallback(async (rideId) => {
    if (!rideId) return;
    setChatLoading(true);
    const result = await api.fetchRideMessages(rideId);
    if (!result.ok) {
      setChatLoading(false);
      toast.error(result.error || 'Chat konnte nicht geladen werden');
      return;
    }
    setRideMessages(result.messages || []);
    setChatLoading(false);
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
    if (!chatOpen || !activeRide?.ride_id) return undefined;
    loadRideMessages(activeRide.ride_id);
    const timer = window.setInterval(() => loadRideMessages(activeRide.ride_id), 5000);
    return () => window.clearInterval(timer);
  }, [chatOpen, activeRide?.ride_id, loadRideMessages]);

  useEffect(() => {
    if (!activeRide?.ride_id) {
      setChatOpen(false);
      setRideMessages([]);
      setMessageDraft('');
    }
  }, [activeRide?.ride_id]);

  useEffect(() => {
    if (!pickup?.lat || !pickup?.lng) return undefined;
    let cancelled = false;
    const region = detectRegion(pickup.address);
    const loadRegional = async () => {
      const [airport, station] = await Promise.all([
        api.fetchRegionalPlaceHints(region.airportQuery, { lat: pickup.lat, lng: pickup.lng, limit: 1 }),
        api.fetchRegionalPlaceHints(region.stationQuery, { lat: pickup.lat, lng: pickup.lng, limit: 1 }),
      ]);
      if (!cancelled) {
        setRegionalQuickPlaces([
          airport[0] ? { ...airport[0], id: 'airport', icon: Plane, label: region.airportLabel, caption: region.regionLabel } : null,
          station[0] ? { ...station[0], id: 'station', icon: Train, label: region.stationLabel, caption: region.regionLabel } : null,
        ].filter(Boolean));
      }
    };
    loadRegional();
    return () => {
      cancelled = true;
    };
  }, [pickup?.lat, pickup?.lng, pickup?.address]);

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
    setEstimating(false);
  }, [bookingMode, pickup, dropoff, selectedVehicle]);

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

  const { home, work } = useMemo(() => resolveHomeWork(savedPlaces), [savedPlaces]);
  const region = useMemo(() => detectRegion(pickup.address), [pickup.address]);

  const activeRideTrackerData = useMemo(() => {
    if (!activeRide) return null;
    return {
      ...activeRide,
      driver_name: activeRide.driver?.name || activeRide.driver_name || 'Fahrer wird gesucht',
      driver_phone: activeRide.driver?.phone || activeRide.driver_phone || '',
      driver_rating: activeRide.driver?.rating || activeRide.driver_rating || 5,
      vehicle_model: activeRide.driver?.vehicle?.model || activeRide.vehicle_model || activeRide.driver_car?.model || 'Taxi',
      vehicle_plate: activeRide.driver?.vehicle?.plate || activeRide.vehicle_plate || activeRide.driver_car?.license_plate || '—',
      pickup_address: activeRide.pickup?.address || activeRide.pickup_address || 'Aktueller Standort',
      dropoff_address: activeRide.dropoff?.address || activeRide.dropoff_address || '—',
      estimated_price: Number(activeRide.final_fare || activeRide.fare_estimate || activeRide.estimated_fare || 0),
      eta_minutes: activeRide.driver?.eta_minutes || activeRide.eta_minutes || 0,
    };
  }, [activeRide]);

  const liveMovementLabel = useMemo(() => {
    if (!activeRide) return '';
    if (activeRide.status === 'arriving') return 'Dein Fahrer bewegt sich live auf der Karte zu deiner Abholung.';
    if (activeRide.status === 'started') return 'Dein Fahrzeug bewegt sich live auf der Karte Richtung Ziel.';
    if (activeRide.status === 'accepted') return 'Fahrer bestätigt — Live-Position aktualisiert sich automatisch.';
    return '';
  }, [activeRide]);

  const suggestionCards = useMemo(() => {
    const cards = [];
    favoriteRoutes.slice(0, 2).forEach((route, index) => {
      if (route?.dropoff?.address) cards.push({ id: `route-${index}`, kind: 'route', title: route.dropoff.address, subtitle: route.pickup?.address || 'Häufig gefahren', lat: route.dropoff.lat, lng: route.dropoff.lng });
    });
    recentAddresses.slice(0, 2).forEach((address, index) => {
      if (address?.address) cards.push({ id: `recent-${index}`, kind: 'recent', title: address.address, subtitle: `Zuletzt genutzt · ${address.use_count || 1}×`, lat: address.lat, lng: address.lng });
    });
    favorites.slice(0, 2).forEach((favorite, index) => {
      if (favorite?.address) cards.push({ id: `favorite-${index}`, kind: 'favorite', title: favorite.name, subtitle: favorite.address, lat: favorite.latitude, lng: favorite.longitude, favoriteId: favorite.id });
    });
    return cards.slice(0, 4);
  }, [favoriteRoutes, recentAddresses, favorites]);

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
    setError('');
  };

  const handleSaveSuggestionAsFavorite = async (item) => {
    const labelBase = item.name || item.address || 'Favorit';
    const result = await api.saveFavoriteFromSearch({ name: labelBase, address: item.address || item.name, lat: item.lat, lng: item.lng, icon: 'star' });
    if (!result.ok) {
      setError(result.error || 'Favorit konnte nicht gespeichert werden');
      return;
    }
    setFavorites(await api.fetchFavorites());
    toast.success('Favorit gespeichert');
  };

  const handleSaveHomeWork = async (kind) => {
    const source = dropoff?.lat ? dropoff : pickup;
    if (!source?.lat || !source?.address) {
      setError('Bitte zuerst einen Ort auswählen.');
      return;
    }
    const ok = await api.savePlaceApi({ name: kind === 'home' ? 'Home' : 'Work', icon: kind, address: source.address, lat: source.lat, lng: source.lng });
    if (!ok) {
      setError(`${kind === 'home' ? 'Home' : 'Work'} konnte nicht gespeichert werden.`);
      return;
    }
    setError('');
    await refreshTaxiCollections();
  };

  const handleQuickDestination = (item) => {
    if (!item?.lat || !item?.lng) return;
    setDropoff({ address: item.address || item.title || item.label, lat: item.lat, lng: item.lng });
    setSearchMode('dropoff');
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

  const handleOpenRideChat = async () => {
    if (!activeRide?.ride_id) return;
    const nextOpen = !chatOpen;
    setChatOpen(nextOpen);
    if (nextOpen) await loadRideMessages(activeRide.ride_id);
  };

  const handleSendRideMessage = async () => {
    if (!activeRide?.ride_id) return;
    const text = messageDraft.trim();
    if (!text) return;
    const result = await api.sendRideMessage(activeRide.ride_id, text);
    if (!result.ok) {
      toast.error(result.error || 'Nachricht konnte nicht gesendet werden');
      return;
    }
    setMessageDraft('');
    setRideMessages((prev) => [...prev, result.message].slice(-50));
  };

  const handleCallDriver = () => {
    const phone = activeRide?.driver?.phone || activeRide?.driver_phone;
    if (!phone) {
      toast.error('Telefonnummer ist noch nicht verfügbar');
      return;
    }
    window.location.href = `tel:${phone}`;
  };

  const handleShareTrip = async () => {
    if (!activeRide) return;
    const shareText = `Meine BidBlitz Fahrt: ${activeRide.pickup?.address || 'Abholung'} → ${activeRide.dropoff?.address || 'Ziel'} · ${activeRide.driver?.name || 'Fahrer'} · ETA ${activeRide.driver?.eta_minutes || activeRide.eta_minutes || 4} Min`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'BidBlitz Taxi', text: shareText, url: window.location.href });
        return;
      }
      await navigator.clipboard.writeText(`${shareText} · ${window.location.href}`);
      toast.success('Fahrt-Link in die Zwischenablage kopiert');
    } catch (error) {
      void error;
      toast.error('Teilen war gerade nicht möglich');
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-black" data-testid="taxi-customer-page">
      <div className="relative min-h-screen overflow-hidden">
        <section className="relative h-[46vh] min-h-[340px] w-full bg-[#eef2f7]" data-testid="taxi-customer-map-zone">
          <TaxiMap
            pickup={pickup?.lat ? pickup : null}
            dropoff={dropoff?.lat ? dropoff : null}
            driverLocation={activeRide?.driver_lat && activeRide?.driver_lng ? { lat: activeRide.driver_lat, lng: activeRide.driver_lng } : null}
            driverBearing={activeRide?.driver_bearing || 0}
            driverTarget={activeRide?.status === 'started' ? activeRide?.dropoff : activeRide?.pickup}
            driverPath={(activeRide?.driver_path || []).map((point) => [point.lat, point.lng]).filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]))}
            height="100%"
            nearbyDrivers={mapDrivers}
          />

          <div className="absolute inset-x-0 top-0 z-[500] bg-gradient-to-b from-white via-white/90 to-transparent px-4 pb-10 pt-4">
            <div className="mx-auto flex max-w-3xl items-start justify-between gap-3" data-testid="taxi-customer-topbar">
              <div className="flex items-center gap-3">
                <button onClick={() => onNavigate?.('/')} className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-black" data-testid="taxi-customer-back-button">
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">Taxi</p>
                  <h1 className="text-2xl font-black" data-testid="taxi-customer-hero-title">Wohin willst du fahren?</h1>
                </div>
              </div>
              <div className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-black/70" data-testid="taxi-customer-region-pill">
                {region.regionLabel}
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-5 left-4 right-4 z-[500]">
            <div className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-[22px] border border-white/80 bg-white/92 px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.08)]" data-testid="taxi-customer-map-summary-card">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-black/35">Live Karte</p>
                <p className="mt-1 text-sm font-semibold text-black">{pickup.address || 'Abholung'} → {dropoff.address || 'Ziel auswählen'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-full bg-black px-3 py-2 text-xs font-bold text-white" data-testid="taxi-customer-map-driver-count">{mapDrivers.length} Fahrer</div>
                {selectedEstimate ? <div className="rounded-full bg-[#FFD500] px-3 py-2 text-xs font-bold text-black" data-testid="taxi-customer-map-price">€{Number(selectedEstimate.total || selectedEstimate.fare || 0).toFixed(2)}</div> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-[600] -mt-8 rounded-t-[34px] border-t border-black/8 bg-white px-4 pb-10 pt-5 shadow-[0_-12px_40px_rgba(0,0,0,0.08)]" data-testid="taxi-customer-bottom-sheet">
          <div className="mx-auto max-w-3xl">
            <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-black/10" />

            <div className="rounded-[28px] border border-black/8 bg-[#f8fafc] p-4 sm:p-5" data-testid="taxi-customer-search-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">3 Tap Booking</p>
                  <h2 className="mt-1 text-xl font-black text-black">Suchen, wählen, bestellen</h2>
                </div>
                <div className="rounded-full bg-black px-3 py-2 text-[11px] font-semibold text-white" data-testid="taxi-customer-live-driver-badge">
                  {mapDrivers.length} Fahrer in der Nähe
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {[
                  { id: 'pickup', label: 'Abholung', value: pickup.address, placeholder: 'Dein Standort', active: searchMode === 'pickup', suggestions: pickupSuggestions, show: showPickupSuggestions },
                  { id: 'dropoff', label: 'Wohin?', value: dropoff.address, placeholder: 'Adresse, Hotel, Flughafen oder Ort', active: searchMode === 'dropoff', suggestions: dropoffSuggestions, show: showDropoffSuggestions },
                ].map((field) => (
                  <div key={field.id} className="relative" data-testid={`taxi-customer-field-${field.id}`}>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">{field.label}</label>
                    <div className={`flex items-center gap-3 rounded-[22px] border bg-white px-4 py-4 transition ${field.active ? 'border-black shadow-[0_0_0_4px_rgba(0,0,0,0.06)]' : 'border-black/10'}`}>
                      {field.id === 'pickup' ? <LocateFixed className="h-5 w-5 text-[#0F766E]" /> : <Search className="h-5 w-5 text-black/45" />}
                      <input
                        value={field.value}
                        onFocus={() => setSearchMode(field.id)}
                        onChange={(e) => handleAddressChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-transparent text-[15px] font-semibold outline-none placeholder:text-black/35"
                        data-testid={`taxi-customer-input-${field.id}`}
                      />
                    </div>
                    {field.show && field.suggestions.length > 0 ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-[22px] border border-black/10 bg-white shadow-xl" data-testid={`taxi-customer-suggestions-${field.id}`}>
                        {field.suggestions.slice(0, 6).map((item, index) => (
                          <div key={`${field.id}-${index}`} className="flex items-start gap-3 border-b border-black/5 px-4 py-3 last:border-b-0 hover:bg-slate-50" data-testid={`taxi-customer-suggestion-${field.id}-${index}`}>
                            <button onMouseDown={() => handleSuggestionSelect(field.id, item)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                              <div className="mt-0.5 rounded-xl bg-black/5 p-2 text-black/60"><MapPin size={14} /></div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-black">{item.name || item.address}</div>
                                <div className="truncate text-xs text-black/45">{item.cityZip || item.address}</div>
                              </div>
                            </button>
                            {field.id === 'dropoff' ? <button onMouseDown={() => handleSaveSuggestionAsFavorite(item)} className="rounded-full border border-black/10 px-2 py-1 text-[10px] font-semibold text-black/65" data-testid={`taxi-customer-save-suggestion-${index}`}>Speichern</button> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[24px] bg-black px-4 py-4 text-white" data-testid="taxi-customer-route-preview-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Route</p>
                    <p className="mt-1 text-sm font-semibold">{pickup.address || 'Abholung wählen'} → {dropoff.address || 'Ziel wählen'}</p>
                  </div>
                  {estimating ? <Loader2 className="h-5 w-5 animate-spin text-white/60" /> : <Sparkles className="h-5 w-5 text-[#FFD500]" />}
                </div>
                <p className="mt-2 text-xs text-white/65" data-testid="taxi-customer-search-helper">Die Suche ist jetzt regional: Flughafen und Bahnhof passen sich an deinen Standort an.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[28px] border border-black/8 bg-white p-4" data-testid="taxi-customer-quick-destinations-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-black/40">Schnellziele</p>
                    <h3 className="mt-1 text-lg font-black">Passend zu deinem Standort</h3>
                  </div>
                  <div className="rounded-full bg-[#FFD500] px-3 py-2 text-[11px] font-bold text-black" data-testid="taxi-customer-region-summary-pill">{region.regionLabel}</div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button onClick={() => (home ? handleQuickDestination({ ...home, lat: home.lat || home.latitude, lng: home.lng || home.longitude, address: home.address }) : handleSaveHomeWork('home'))} className="rounded-[22px] border border-black/8 bg-[#f8fafc] p-4 text-left" data-testid="taxi-customer-quick-place-home">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-white"><Home size={18} /></div>
                      <div>
                        <div className="text-sm font-bold text-black">Home</div>
                        <div className="mt-1 text-[11px] text-black/45">{home?.address || 'Zuhause speichern'}</div>
                      </div>
                    </div>
                  </button>

                  <button onClick={() => (work ? handleQuickDestination({ ...work, lat: work.lat || work.latitude, lng: work.lng || work.longitude, address: work.address }) : handleSaveHomeWork('work'))} className="rounded-[22px] border border-black/8 bg-[#f8fafc] p-4 text-left" data-testid="taxi-customer-quick-place-work">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FFD500] text-black"><Briefcase size={18} /></div>
                      <div>
                        <div className="text-sm font-bold text-black">Work</div>
                        <div className="mt-1 text-[11px] text-black/45">{work?.address || 'Arbeitsort speichern'}</div>
                      </div>
                    </div>
                  </button>

                  {regionalQuickPlaces.map((place) => {
                    const Icon = place.icon;
                    return (
                      <button key={place.id} onClick={() => handleQuickDestination(place)} className="rounded-[22px] border border-black/8 bg-[#f8fafc] p-4 text-left" data-testid={`taxi-customer-quick-place-${place.id}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black border border-black/10"><Icon size={18} /></div>
                          <div>
                            <div className="text-sm font-bold text-black">{place.label}</div>
                            <div className="mt-1 text-[11px] text-black/45">{place.address}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[28px] border border-black/8 bg-white p-4" data-testid="taxi-customer-booking-modes-card">
                <p className="text-[11px] uppercase tracking-[0.18em] text-black/40">Buchung</p>
                <h3 className="mt-1 text-lg font-black">Flexibel buchen</h3>

                <div className="mt-4 grid gap-2" data-testid="taxi-customer-booking-mode-tabs">
                  {[
                    { id: 'now', label: 'Jetzt bestellen' },
                    { id: 'later', label: 'Später bestellen' },
                    { id: 'other', label: 'Für jemand anderen' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => { setBookingMode(mode.id === 'other' ? 'now' : mode.id); setForOther(mode.id === 'other'); }}
                      className={`rounded-[18px] border px-4 py-3 text-left text-sm font-semibold ${((mode.id === 'other' && forOther) || (mode.id !== 'other' && bookingMode === mode.id && !forOther)) ? 'border-black bg-black text-white' : 'border-black/10 bg-[#f8fafc] text-black/70'}`}
                      data-testid={`taxi-customer-booking-mode-${mode.id}`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {bookingMode === 'later' ? (
                  <div className="mt-3 rounded-[18px] border border-black/10 bg-[#f8fafc] p-3" data-testid="taxi-customer-schedule-box">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">Abholzeit</label>
                    <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="mt-2 w-full rounded-xl border border-black/10 px-3 py-3 text-sm" data-testid="taxi-customer-scheduled-at-input" />
                  </div>
                ) : null}

                {forOther ? (
                  <div className="mt-3 rounded-[18px] border border-black/10 bg-[#f8fafc] p-3" data-testid="taxi-customer-recipient-box">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">Name der Person</label>
                    <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="mt-2 w-full rounded-xl border border-black/10 px-3 py-3 text-sm" placeholder="Max Mustermann" data-testid="taxi-customer-recipient-name-input" />
                    <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">Telefon</label>
                    <input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} className="mt-2 w-full rounded-xl border border-black/10 px-3 py-3 text-sm" placeholder="+49 …" data-testid="taxi-customer-recipient-phone-input" />
                  </div>
                ) : null}
              </div>
            </div>

            <AnimatePresence>
              {error ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="taxi-customer-error-card">
                  {error}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {!activeRide ? (
              <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[28px] border border-black/8 bg-white p-4" data-testid="taxi-customer-suggestions-card">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-black/40">Für dich</p>
                      <h3 className="mt-1 text-lg font-black">Persönliche Schnellwahl</h3>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {suggestionCards.map((place) => (
                      <button key={place.id} onClick={() => handleQuickDestination(place)} className="rounded-[20px] border border-black/8 bg-[#f8fafc] px-4 py-4 text-left" data-testid={`taxi-customer-suggested-place-${place.id}`}>
                        <div className="text-sm font-semibold text-black">{place.title}</div>
                        <div className="mt-1 text-[11px] text-black/45">{place.subtitle}</div>
                      </button>
                    ))}
                    {suggestionCards.length === 0 ? <div className="rounded-[20px] border border-dashed border-black/10 bg-[#f8fafc] px-4 py-4 text-sm text-black/45" data-testid="taxi-customer-suggested-empty">Deine letzten Ziele und Favoriten erscheinen hier automatisch.</div> : null}
                  </div>
                </div>

                <div className="rounded-[28px] border border-black/8 bg-white p-4" data-testid="taxi-customer-vehicles-card">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-black/40">Fahrten</p>
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
                          className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${selected ? 'border-black bg-black text-white' : 'border-black/8 bg-[#f8fafc] text-black'}`}
                          data-testid={`taxi-customer-vehicle-${vehicle.id}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`rounded-2xl p-3 ${selected ? 'bg-white/10' : 'bg-white border border-black/8'}`}><Car size={18} /></div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold">{vehicle.label}</span>
                                  {vehicle.id === 'standard' ? <span className="rounded-full bg-[#FFD500] px-2 py-0.5 text-[10px] font-bold text-black">Empfohlen</span> : null}
                                </div>
                                <p className={`mt-1 text-xs ${selected ? 'text-white/60' : 'text-black/45'}`}>{vehicle.subtitle}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-base font-black">{estimate ? `€${Number(estimate.total || estimate.fare || 0).toFixed(2)}` : '—'}</p>
                              <p className={`text-xs ${selected ? 'text-white/60' : 'text-black/45'}`}>{estimate ? `${estimate.eta_minutes || estimate.duration_minutes || 5} Min` : 'Berechne…'}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleBookRide}
                    disabled={!selectedEstimate || booking || !dropoff?.lat}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-[22px] bg-black px-4 py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    data-testid="taxi-customer-book-button"
                  >
                    {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
                    {booking ? 'Bucht…' : selectedEstimate ? `Bestellen · €${Number(selectedEstimate.total || selectedEstimate.fare || 0).toFixed(2)}` : 'Ziel eingeben'}
                  </button>
                  <p className="mt-3 text-center text-xs text-black/45" data-testid="taxi-customer-wallet-hint">Wallet-Guthaben: €{Number(user?.balance || 0).toFixed(2)}</p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[28px] border border-black/8 bg-white p-4 shadow-sm" data-testid="taxi-customer-active-ride-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-black/40">Aktive Fahrt</p>
                    <h3 className="mt-1 text-lg font-black">{activeRide.driver?.name || 'Fahrer wird gesucht'}</h3>
                  </div>
                  <RideStatusBadge ride={activeRide} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-[#f8fafc] p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-black/40">Abholung</p>
                    <p className="mt-1 text-sm font-semibold">{activeRide.pickup?.address}</p>
                  </div>
                  <div className="rounded-2xl bg-[#f8fafc] p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-black/40">Ziel</p>
                    <p className="mt-1 text-sm font-semibold">{activeRide.dropoff?.address}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="rounded-full bg-[#f3f4f6] px-3 py-2 text-xs font-semibold text-black/70" data-testid="taxi-customer-active-ride-price">€{Number(activeRide.final_fare || activeRide.estimated_fare || 0).toFixed(2)}</div>
                  <div className="rounded-full bg-[#f3f4f6] px-3 py-2 text-xs font-semibold text-black/70" data-testid="taxi-customer-active-ride-eta">{activeRide.driver?.eta_minutes || activeRide.eta_minutes || 4} Min</div>
                </div>
                <ActiveRideTracker
                  ride={activeRideTrackerData}
                  onCancel={handleCancelRide}
                  onOpenLiveChat={handleOpenRideChat}
                  onCallDriver={handleCallDriver}
                  onShareTrip={handleShareTrip}
                  canCall={Boolean(activeRide.driver?.phone || activeRide.driver_phone)}
                  liveMovementLabel={liveMovementLabel}
                />
                {chatOpen ? (
                  <RideChatPanel messages={rideMessages} loading={chatLoading} draft={messageDraft} onDraftChange={setMessageDraft} onSend={handleSendRideMessage} />
                ) : null}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}