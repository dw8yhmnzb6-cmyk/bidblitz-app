import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Briefcase, Clock3, Heart, Home, Loader2, MapPin, Navigation, Search, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { TaxiMap } from '../components/RealMap';
import ActiveRideTracker from '../components/taxi/ActiveRideTracker';
import { VehicleIcon } from '../components/taxi/TaxiVehicleIcon';
import { useTaxiGeocoder } from '../components/taxi/useTaxiGeocoder';
import { useUser } from '../store/UserContext';
import * as api from '../services/taxiApi';

const VEHICLES = [
  { id: 'standard', label: 'UberX', subtitle: 'Schnell & günstig', badge: 'Empfohlen' },
  { id: 'premium', label: 'Comfort', subtitle: 'Mehr Komfort & Ruhe' },
  { id: 'van', label: 'XL', subtitle: 'Für Gruppen & Gepäck' },
];

const SPRING = { type: 'spring', stiffness: 300, damping: 30 };

function detectRegion(address = '') {
  const hay = String(address || '').toLowerCase();
  if (hay.includes('prisht') || hay.includes('kosovo') || hay.includes(', xk')) return 'Kosovo';
  if (hay.includes('berlin')) return 'Berlin';
  if (hay.includes('wien') || hay.includes('vienna')) return 'Wien';
  if (hay.includes('zürich') || hay.includes('zurich')) return 'Zürich';
  return 'Deine Region';
}

function formatEta(item) {
  if (!item) return 'Berechne…';
  const minutes = Number(item.eta_minutes || item.duration_minutes || 0);
  if (!minutes) return 'Berechne…';
  return `${minutes} Min`;
}

function formatPrice(item) {
  const price = Number(item?.total || item?.fare || 0);
  if (!price) return '—';
  return `€${price.toFixed(2)}`;
}

function useTaxiSimpleData(user) {
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [recentAddresses, setRecentAddresses] = useState([]);

  useEffect(() => {
    if (!user?.isAuthenticated) {
      setSavedPlaces([]);
      setRecentAddresses([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const [places, recents] = await Promise.all([
        api.fetchSavedPlaces(),
        api.fetchRecentAddresses(6),
      ]);
      if (!cancelled) {
        setSavedPlaces(places || []);
        setRecentAddresses(recents || []);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.isAuthenticated]);

  return { savedPlaces, recentAddresses, setSavedPlaces };
}

function SearchResultRow({ item, index, onSelect }) {
  return (
    <button
      onClick={() => onSelect(item)}
      className="flex w-full items-start gap-3 border-b border-zinc-100 px-1 py-4 text-left last:border-b-0"
      data-testid={`taxi-search-result-${index}`}
    >
      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
        <MapPin size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-[#0A0A0A]">{item.name || item.address}</div>
        <div className="mt-1 truncate text-sm text-zinc-500">{item.address}</div>
      </div>
    </button>
  );
}

function SuggestionSectionTitle({ children }) {
  return <div className="px-1 pb-2 pt-4 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">{children}</div>;
}

function QuickDestinationChip({ icon, label, onClick, testId }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-200"
      data-testid={testId}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function VehicleCard({ vehicle, selected, estimate, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative w-[148px] flex-shrink-0 rounded-2xl p-4 text-left transition-all ${selected ? 'border-2 border-black bg-white shadow-md' : 'border border-zinc-200 bg-zinc-50 opacity-80 hover:opacity-100'}`}
      data-testid={`taxi-vehicle-card-${vehicle.id}`}
    >
      <VehicleIcon type={vehicle.id} active={selected} className="h-12 w-full" />
      <div className="mt-3 flex items-center gap-2">
        <div className="text-sm font-bold text-[#0A0A0A]">{vehicle.label}</div>
        {vehicle.badge ? <span className="rounded-full bg-[#FFD600] px-2 py-0.5 text-[10px] font-black text-black">{vehicle.badge}</span> : null}
      </div>
      <div className="mt-1 text-xs text-zinc-500">{vehicle.subtitle}</div>
      <div className="mt-3 text-base font-black text-[#0A0A0A]">{formatPrice(estimate)}</div>
      <div className="text-xs text-zinc-500">{formatEta(estimate)}</div>
    </button>
  );
}

function BookingStatusSimple({ ride, onCancel, onOpenLiveChat, onCallDriver, onShareTrip }) {
  const eta = Number(ride?.driver?.eta_minutes || ride?.eta_minutes || 3);
  const plate = ride?.driver?.vehicle?.plate || ride?.vehicle_plate || '—';
  const driver = ride?.driver?.name || ride?.driver_name || 'Fahrer';
  const price = Number(ride?.estimated_price || ride?.fare_estimate || ride?.final_fare || 0);
  const pickupAddress = ride?.pickup?.address || ride?.pickup_address || 'Dein Standort';
  const dropoffAddress = ride?.dropoff?.address || ride?.dropoff_address || 'Ziel';

  return (
    <div className="space-y-4" data-testid="booking-status-view">
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 text-center shadow-sm">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Fahrer unterwegs</div>
        <div className="mt-3 text-5xl font-black tracking-tight text-[#0A0A0A]">{eta} min</div>
        <div className="mt-2 text-sm text-zinc-500">{driver} ist auf dem Weg zu dir.</div>
        <div className="mt-5 flex items-center justify-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-xl font-black text-white">{driver.charAt(0)}</div>
          <div className="text-left">
            <div className="text-base font-bold text-[#0A0A0A]">{driver}</div>
            <div className="mt-1 inline-flex rounded-full bg-black px-3 py-1 text-xs font-black text-white">{plate}</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-zinc-50 p-3 text-left">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">Preis</div>
            <div className="mt-1 text-lg font-black text-[#0A0A0A]">{price ? `€${price.toFixed(2)}` : 'Laufend'}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">Status</div>
            <div className="mt-1 text-lg font-black text-[#0A0A0A]">Live</div>
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-3 w-3 rounded-full bg-black" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">Abholung</div>
            <div className="mt-1 text-sm font-bold text-[#0A0A0A]">{pickupAddress}</div>
          </div>
        </div>
        <div className="ml-[5px] mt-2 h-6 w-px bg-zinc-200" />
        <div className="flex items-start gap-3">
          <div className="mt-1 h-3 w-3 rounded-sm bg-black" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">Ziel</div>
            <div className="mt-1 text-sm font-bold text-[#0A0A0A]">{dropoffAddress}</div>
          </div>
        </div>
      </div>
      <ActiveRideTracker
        ride={ride}
        onCancel={onCancel}
        onOpenLiveChat={onOpenLiveChat}
        onCallDriver={onCallDriver}
        onShareTrip={onShareTrip}
        canCall={Boolean(ride?.driver?.phone || ride?.driver_phone)}
      />
    </div>
  );
}

export default function TaxiPage({ onNavigate }) {
  const user = useUser();
  const { search } = useTaxiGeocoder({ debounceMs: 100 });
  const { savedPlaces, recentAddresses } = useTaxiSimpleData(user);

  const [pickup, setPickup] = useState({ lat: 52.52, lng: 13.405, address: '' });
  const [dropoff, setDropoff] = useState({ lat: 0, lng: 0, address: '' });
  const [sheetMode, setSheetMode] = useState('summary');
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [estimating, setEstimating] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('standard');
  const [estimates, setEstimates] = useState([]);
  const [regionalHints, setRegionalHints] = useState([]);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [activeRide, setActiveRide] = useState(null);

  useEffect(() => {
    document.body.classList.add('taxi-fullscreen-mode');
    return () => document.body.classList.remove('taxi-fullscreen-mode');
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setPickup((prev) => ({ ...prev, address: 'Dein Standort' }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude, address: 'Dein Standort' };
        setPickup(next);
        const address = await api.reverseGeocode(next.lat, next.lng);
        if (address) setPickup((prev) => ({ ...prev, address }));
      },
      () => setPickup((prev) => ({ ...prev, address: 'Dein Standort' })),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const loadActiveRide = useCallback(async () => {
    if (!user?.isAuthenticated) {
      setActiveRide(null);
      return;
    }
    const data = await api.fetchActiveRide();
    setActiveRide(data?.rides?.[0] || null);
  }, [user?.isAuthenticated]);

  useEffect(() => {
    loadActiveRide();
  }, [loadActiveRide]);

  useEffect(() => {
    if (!pickup?.lat || activeRide) return;
    let cancelled = false;
    const loadDrivers = async () => {
      const result = await api.fetchNearbyDriversCount({ lat: pickup.lat, lng: pickup.lng, carType: selectedVehicle });
      if (!cancelled) setNearbyDrivers(result.drivers || []);
    };
    loadDrivers();
    return () => {
      cancelled = true;
    };
  }, [pickup?.lat, pickup?.lng, selectedVehicle, activeRide]);

  const runSearch = useCallback((value) => {
    setSearchValue(value);
    search('taxi-simple-dropoff', value, setSearchResults, () => {}, pickup?.lat ? { lat: pickup.lat, lng: pickup.lng } : null);
  }, [pickup?.lat, pickup?.lng, search]);

  useEffect(() => {
    if (!searchValue || searchValue.trim().length < 2) {
      setRegionalHints([]);
      return;
    }
    let cancelled = false;
    const loadHints = async () => {
      const hints = await api.fetchRegionalPlaceHints(searchValue, pickup?.lat ? { lat: pickup.lat, lng: pickup.lng, limit: 4 } : { limit: 4 });
      if (!cancelled) setRegionalHints(hints || []);
    };
    loadHints();
    return () => {
      cancelled = true;
    };
  }, [pickup?.lat, pickup?.lng, searchValue]);

  const estimateRide = useCallback(async (nextDropoff) => {
    if (!pickup?.lat || !nextDropoff?.lat) return;
    setEstimating(true);
    setError('');
    const result = await api.estimateRide({ pickup, dropoff: nextDropoff });
    if (!result.ok) {
      setEstimating(false);
      setEstimates([]);
      setError(result.error || 'Keine Fahrten verfügbar');
      return;
    }
    setEstimates(result.estimates || []);
    const recommended = (result.estimates || []).find((item) => item.vehicle_type === selectedVehicle) || result.estimates?.[0];
    if (recommended?.vehicle_type) setSelectedVehicle(recommended.vehicle_type);
    setEstimating(false);
  }, [pickup, selectedVehicle]);

  const handleSelectDestination = useCallback((item) => {
    const next = {
      address: item.address || item.name,
      lat: Number(item.lat),
      lng: Number(item.lng),
    };
    setDropoff(next);
    setSearchValue(item.address || item.name || '');
    setSheetMode('ride-options');
    estimateRide(next);
  }, [estimateRide]);

  const quickDestinations = useMemo(() => {
    const home = savedPlaces.find((place) => (place.icon || '').toLowerCase() === 'home' || (place.name || '').toLowerCase() === 'home');
    const work = savedPlaces.find((place) => (place.icon || '').toLowerCase() === 'work' || (place.name || '').toLowerCase() === 'work');
    const recents = recentAddresses.slice(0, 4).map((item, index) => ({ ...item, key: `recent-${index}` }));
    return { home, work, recents };
  }, [recentAddresses, savedPlaces]);

  const quickVehicleFacts = useMemo(() => ({
    standard: '2 Min · ideal für Alltag',
    premium: '4 Min · ruhige Fahrt',
    van: '6 Min · mehr Platz',
  }), []);

  const selectedEstimate = useMemo(
    () => estimates.find((item) => item.vehicle_type === selectedVehicle) || estimates[0] || null,
    [estimates, selectedVehicle],
  );

  const mapDrivers = useMemo(
    () => nearbyDrivers.slice(0, 8).map((driver) => ({
      id: driver.driver_id,
      lat: driver.location?.lat || driver.lat,
      lng: driver.location?.lng || driver.lng,
      popup: `${driver.user_name || driver.name || 'Fahrer'} · ${driver.eta_minutes || 4} Min`,
    })).filter((driver) => Number.isFinite(driver.lat) && Number.isFinite(driver.lng)),
    [nearbyDrivers],
  );

  const regionLabel = useMemo(() => detectRegion(pickup.address), [pickup.address]);

  const handleBookRide = useCallback(async () => {
    if (!selectedEstimate) return;
    setBooking(true);
    const result = await api.bookRideApi({
      pickup,
      dropoff,
      vehicleType: selectedEstimate.vehicle_type,
      paymentMethod: 'wallet',
      options: { bookingMode: 'now' },
    });
    setBooking(false);
    if (!result.ok) {
      setError(result.error || 'Buchung fehlgeschlagen');
      return;
    }
    setActiveRide(result.ride);
    setSheetMode('status');
  }, [dropoff, pickup, selectedEstimate]);

  const handleCancelRide = useCallback(async () => {
    if (!activeRide?.ride_id) return;
    const result = await api.cancelRideApi(activeRide.ride_id);
    if (!result.ok) {
      toast.error(result.error || 'Stornierung fehlgeschlagen');
      return;
    }
    setActiveRide(null);
    setSheetMode('summary');
    await loadActiveRide();
  }, [activeRide?.ride_id, loadActiveRide]);

  const handleOpenChat = useCallback(() => {
    toast.info('Live-Chat öffnet im nächsten Schritt.');
  }, []);

  const handleCallDriver = useCallback(() => {
    const phone = activeRide?.driver?.phone || activeRide?.driver_phone;
    if (!phone) {
      toast.error('Telefonnummer noch nicht verfügbar');
      return;
    }
    window.location.href = `tel:${phone}`;
  }, [activeRide?.driver?.phone, activeRide?.driver_phone]);

  const handleShareRide = useCallback(async () => {
    if (!activeRide) return;
    const shareText = `Meine Fahrt: ${activeRide.pickup?.address || pickup.address} → ${activeRide.dropoff?.address || dropoff.address}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'BidBlitz Taxi', text: shareText, url: window.location.href });
        return;
      }
      await navigator.clipboard.writeText(`${shareText} · ${window.location.href}`);
      toast.success('Fahrt-Link kopiert');
    } catch {
      toast.error('Teilen war gerade nicht möglich');
    }
  }, [activeRide, dropoff.address, pickup.address]);

  const sheetHeightClass = sheetMode === 'search' ? 'min-h-[88vh]' : 'min-h-[58vh]';

  return (
    <div className="h-dvh overflow-hidden bg-white text-[#0A0A0A]" data-testid="taxi-simple-page">
      <div className="relative h-dvh w-full overflow-hidden bg-zinc-200">
        <div className="absolute inset-0 z-0" data-testid="taxi-simple-map-view">
          <TaxiMap
            pickup={pickup?.lat ? pickup : null}
            dropoff={dropoff?.lat ? dropoff : null}
            driverLocation={activeRide?.driver_lat && activeRide?.driver_lng ? { lat: activeRide.driver_lat, lng: activeRide.driver_lng } : null}
            nearbyDrivers={mapDrivers}
            height="100%"
          />
        </div>

        <div className="absolute inset-x-0 top-0 z-10 px-4 pb-10 pt-4">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => onNavigate?.('/')}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm"
              data-testid="taxi-back-button"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500 shadow-sm" data-testid="taxi-region-pill">
              {regionLabel}
            </div>
          </div>
        </div>

        <motion.div
          layout
          transition={SPRING}
          className={`absolute bottom-0 z-10 w-full rounded-t-[32px] bg-white px-4 pb-6 pt-4 shadow-[0_-8px_40px_rgba(0,0,0,0.08)] ${sheetHeightClass}`}
          data-testid="bottom-sheet-container"
        >
          <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-zinc-200" />

          {!activeRide && (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Taxi buchen</div>
                  <h1 className="mt-2 text-3xl font-black tracking-tight">Wohin soll&apos;s gehen?</h1>
                </div>
                <div className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700" data-testid="taxi-driver-count-pill">
                  {mapDrivers.length} Fahrer
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-zinc-50 p-4" data-testid="location-timeline-trigger">
                <button
                  onClick={() => setSheetMode('search')}
                  className="flex w-full items-start gap-4 text-left"
                >
                  <div className="flex flex-col items-center pt-1">
                    <div className="h-3 w-3 rounded-full bg-black" />
                    <div className="my-1 h-10 w-px bg-zinc-300" />
                    <div className="h-3 w-3 rounded-sm bg-black" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">Aktueller Standort</div>
                    <div className="mt-1 truncate text-sm font-bold text-[#0A0A0A]">{pickup.address || 'Dein Standort'}</div>
                    <div className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">Ziel</div>
                    <div className="mt-1 flex items-center gap-2 text-lg font-black text-[#0A0A0A]">
                      <Search size={18} />
                      <span className="truncate">{dropoff.address || 'Wohin?'}</span>
                    </div>
                  </div>
                </button>
              </div>

              <div className="mt-4 flex gap-3 overflow-x-auto pb-2" data-testid="quick-destinations-scroll">
                <QuickDestinationChip
                  icon={<Navigation size={16} />}
                  label="Aktuell"
                  onClick={() => setSheetMode('search')}
                  testId="taxi-quick-current-location"
                />
                <QuickDestinationChip
                  icon={<Home size={16} />}
                  label={quickDestinations.home?.address ? 'Home' : 'Home speichern'}
                  onClick={() => quickDestinations.home ? handleSelectDestination({ ...quickDestinations.home, lat: quickDestinations.home.lat || quickDestinations.home.latitude, lng: quickDestinations.home.lng || quickDestinations.home.longitude }) : toast.info('Bitte zuerst einmal Home speichern.')}
                  testId="taxi-quick-home"
                />
                <QuickDestinationChip
                  icon={<Briefcase size={16} />}
                  label={quickDestinations.work?.address ? 'Work' : 'Work speichern'}
                  onClick={() => quickDestinations.work ? handleSelectDestination({ ...quickDestinations.work, lat: quickDestinations.work.lat || quickDestinations.work.latitude, lng: quickDestinations.work.lng || quickDestinations.work.longitude }) : toast.info('Bitte zuerst einmal Work speichern.')}
                  testId="taxi-quick-work"
                />
                {quickDestinations.recents.map((item, index) => (
                  <QuickDestinationChip
                    key={item.key}
                    icon={<Star size={16} />}
                    label={item.address?.split(',')?.[0] || `Zuletzt ${index + 1}`}
                    onClick={() => handleSelectDestination(item)}
                    testId={`taxi-quick-recent-${index}`}
                  />
                ))}
              </div>
            </>
          )}

          <AnimatePresence initial={false}>
            {sheetMode === 'search' && !activeRide ? (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={SPRING}
                className="mt-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">Ziel suchen</div>
                    <div className="mt-1 text-2xl font-black">Adresse auswählen</div>
                  </div>
                  <button
                    onClick={() => setSheetMode(dropoff.address ? 'ride-options' : 'summary')}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
                    data-testid="taxi-close-search-button"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-5 border-b-2 border-zinc-200 pb-3">
                  <input
                    value={searchValue}
                    onChange={(e) => runSearch(e.target.value)}
                    placeholder="Adresse, Hotel, Flughafen oder Ort"
                    className="w-full bg-transparent text-2xl font-black outline-none placeholder:text-zinc-400"
                    data-testid="address-search-input"
                    autoFocus
                  />
                </div>
                <div className="mt-4 max-h-[52vh] overflow-y-auto pr-1">
                  {searchResults.length === 0 && regionalHints.length === 0 ? (
                    <div className="rounded-2xl bg-zinc-50 px-4 py-5 text-sm text-zinc-500" data-testid="taxi-search-empty-state">
                      Tippe mindestens einen Ort ein. Letzte Ziele und Live-Treffer erscheinen hier.
                    </div>
                  ) : null}
                  {regionalHints.length > 0 ? (
                    <div data-testid="regional-hints-section">
                      <SuggestionSectionTitle>Nahe Treffer</SuggestionSectionTitle>
                      {regionalHints.map((item, index) => (
                        <SearchResultRow key={`hint-${item.address}-${index}`} item={item} index={index} onSelect={handleSelectDestination} />
                      ))}
                    </div>
                  ) : null}
                  {searchResults.length > 0 ? (
                    <div data-testid="search-results-section">
                      <SuggestionSectionTitle>Alle Treffer</SuggestionSectionTitle>
                      {searchResults.map((item, index) => (
                        <SearchResultRow key={`${item.address}-${index}`} item={item} index={index} onSelect={handleSelectDestination} />
                      ))}
                    </div>
                  ) : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {sheetMode === 'ride-options' && !activeRide ? (
              <motion.div
                key="options"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={SPRING}
                className="mt-5"
              >
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">Route</div>
                  <div className="mt-2 text-sm font-bold text-[#0A0A0A]">{pickup.address || 'Dein Standort'} → {dropoff.address}</div>
                  <div className="mt-2 text-sm text-zinc-500">Wähle ein Fahrzeug und bestelle direkt.</div>
                </div>
                <div className="mt-5 flex gap-4 overflow-x-auto pb-2" data-testid="vehicle-selector-list">
                  {VEHICLES.map((vehicle) => (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      selected={selectedVehicle === vehicle.id}
                      estimate={estimates.find((item) => item.vehicle_type === vehicle.id)}
                      onClick={() => setSelectedVehicle(vehicle.id)}
                    />
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-zinc-50 p-4" data-testid="vehicle-selection-summary">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">Gewählt</div>
                      <div className="mt-1 text-lg font-black text-[#0A0A0A]">{VEHICLES.find((item) => item.id === selectedVehicle)?.label || 'Fahrt'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">Ankunft</div>
                      <div className="mt-1 text-lg font-black text-[#0A0A0A]">{formatEta(selectedEstimate)}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-zinc-500">{quickVehicleFacts[selectedVehicle]}</div>
                </div>
                {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {activeRide ? (
            <div className="mt-5">
              <BookingStatusSimple
                ride={activeRide}
                onCancel={handleCancelRide}
                onOpenLiveChat={handleOpenChat}
                onCallDriver={handleCallDriver}
                onShareTrip={handleShareRide}
              />
            </div>
          ) : null}

          {!activeRide && sheetMode !== 'search' ? (
            <div className="sticky bottom-0 mt-5 bg-white pb-safe" data-testid="taxi-booking-cta-wrap">
              <button
                onClick={dropoff.address ? handleBookRide : () => setSheetMode('search')}
                disabled={booking || estimating}
                className="mb-safe mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#FFD600] text-lg font-black text-black shadow-lg shadow-[#FFD600]/20 disabled:opacity-50"
                data-testid="book-ride-button"
              >
                {booking || estimating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Clock3 className="h-5 w-5" />}
                {dropoff.address ? (selectedEstimate ? `Jetzt bestellen · ${formatPrice(selectedEstimate)}` : 'Preise laden…') : 'Ziel eingeben'}
              </button>
            </div>
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}