import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Briefcase, CalendarClock, Check, Clock3, Heart, Home, Loader2, MapPin, Navigation, Search, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { TaxiMapbox } from '../components/RealMap';
import { VehicleIcon } from '../components/taxi/TaxiVehicleIcon';
import { useTaxiGeocoder } from '../components/taxi/useTaxiGeocoder';
import { dedupeTaxiPlaces, getTaxiPresetPlaceHints } from '../components/taxi/taxiSearchPresets';
import { MoneyAmount } from '../components/design/MoneyAmount';
import { PrimaryButton, SecondaryButton } from '../components/design/BidBlitzButtons';
import { formatBidBlitzCurrency } from '../design/tokens';
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
  return `${minutes} Min.`;
}

function formatPrice(item) {
  const price = Number(item?.total || item?.fare || 0);
  if (!price) return '—';
  return formatBidBlitzCurrency(price, { locale: 'de' });
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

function SearchResultRow({ item, index, onSelect, section = 'default' }) {
  return (
    <button
      onClick={() => onSelect(item)}
      className="flex w-full items-start gap-3 border-b border-white/8 px-1 py-4 text-left last:border-b-0"
      data-testid={`taxi-search-result-${section}-${index}`}
    >
      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-[var(--bb-accent-cyan)]">
        <MapPin size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-white">{item.name || item.address}</div>
        <div className="mt-1 truncate text-sm text-[var(--bb-text-secondary)]">{item.address}</div>
      </div>
    </button>
  );
}

function SuggestionSectionTitle({ children }) {
  return <div className="px-1 pb-2 pt-4 text-xs font-black uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">{children}</div>;
}

function FavoriteSaveRow({ item, saving, onSave }) {
  return (
    <button
      onClick={() => onSave(item)}
      disabled={saving}
      className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left disabled:opacity-60"
      data-testid="taxi-save-favorite-row"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-[var(--bb-accent-danger)]">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Heart size={16} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-white">Ort speichern</div>
        <div className="mt-1 truncate text-sm text-[var(--bb-text-secondary)]">Für Home, Work oder schnellen Wiederaufruf</div>
      </div>
    </button>
  );
}

function QuickDestinationChip({ icon, label, onClick, testId }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[48px] items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
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
      className={`relative w-[min(13.75rem,72vw)] flex-shrink-0 rounded-[24px] p-4 text-left transition-all ${selected ? 'border border-[var(--bb-accent-cyan)] bg-[var(--bb-bg-card)] shadow-[var(--bb-shadow-glow)]' : 'border border-white/10 bg-white/5 hover:bg-white/8'}`}
      data-testid={`taxi-vehicle-card-${vehicle.id}`}
    >
      <VehicleIcon type={vehicle.id} active={selected} className="h-12 w-full" />
      <div className="mt-3 flex items-center gap-2">
        <div className="text-sm font-bold text-white">{vehicle.label}</div>
        {vehicle.badge ? <span className="rounded-full bg-[var(--bb-accent-warning)] px-2.5 py-1 text-xs font-black text-[#08111D]">{vehicle.badge}</span> : null}
      </div>
      <div className="mt-1 text-sm text-[var(--bb-text-secondary)]">{vehicle.subtitle}</div>
      <div className="mt-3 text-base font-black text-white">{formatPrice(estimate)}</div>
      <div className="text-sm text-[var(--bb-text-secondary)]">{formatEta(estimate)}</div>
    </button>
  );
}

function PricingOverviewCard({ selectedEstimate, bookingMode, regionFallback = 'Deine Region' }) {
  if (!selectedEstimate) return null;
  const regionLabel = selectedEstimate.region_label || selectedEstimate.region || 'Standard-Tarif';
  const tariffZone = selectedEstimate.tariff_zone;
  const timeTariff = selectedEstimate.time_tariff;
  const fixedFare = selectedEstimate.fixed_fare || selectedEstimate.fixed_fares?.[selectedEstimate.vehicle_type];
  return (
    <div className="mt-4 rounded-[24px] border border-white/10 bg-white/6 p-4" data-testid="pricing-overview-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Preislogik</div>
          <div className="mt-1 text-base font-black text-white">{regionLabel}</div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/6 px-3 py-2 text-sm font-bold text-[var(--bb-text-secondary)]">
          {bookingMode === 'later' ? 'Später' : 'Jetzt'}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-2xl bg-[var(--bb-bg-card)] px-3 py-3">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--bb-text-muted)]">Grundpreis</div>
          <MoneyAmount value={selectedEstimate.base_fare || 0} locale="de" className="mt-1 block text-base font-black text-white" testId="taxi-base-fare" />
        </div>
        <div className="rounded-2xl bg-[var(--bb-bg-card)] px-3 py-3">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--bb-text-muted)]">Region</div>
          <div className="mt-1 font-black text-white">{selectedEstimate.region || regionFallback}</div>
        </div>
        <div className="rounded-2xl bg-[var(--bb-bg-card)] px-3 py-3">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--bb-text-muted)]">Zone</div>
          <div className="mt-1 font-black text-white">{tariffZone?.label || 'Standard'}</div>
        </div>
      </div>
      {fixedFare ? (
        <div className="mt-3 rounded-2xl bg-[rgba(24,214,140,0.12)] px-4 py-3 text-sm font-semibold text-[var(--bb-accent-success)]">
          Festpreis aktiv: <MoneyAmount value={fixedFare} locale="de" className="font-bold text-[var(--bb-accent-success)]" testId="taxi-fixed-fare" />
        </div>
      ) : null}
      {timeTariff?.label ? (
        <div className="mt-3 rounded-2xl bg-[rgba(255,204,51,0.12)] px-4 py-3 text-sm font-semibold text-[var(--bb-accent-warning)]">
          Zeitprofil aktiv: {timeTariff.label}
        </div>
      ) : null}
    </div>
  );
}

function BookingStatusSimple({ ride, onCancel, onOpenLiveChat, onCallDriver, onShareTrip, liveMovementLabel }) {
  const eta = Number(ride?.driver?.eta_minutes || ride?.eta_minutes || 3);
  const plate = ride?.driver?.vehicle?.plate || ride?.vehicle_plate || '—';
  const driver = ride?.driver?.name || ride?.driver_name || 'Fahrer';
  const price = Number(ride?.estimated_price || ride?.fare_estimate || ride?.final_fare || 0);
  const pickupAddress = ride?.pickup?.address || ride?.pickup_address || 'Dein Standort';
  const dropoffAddress = ride?.dropoff?.address || ride?.dropoff_address || 'Ziel';
  const status = ride?.status || 'requested';
  const statusLabel = status === 'accepted'
    ? 'Fahrer gefunden'
    : status === 'arriving'
      ? 'Fahrer kommt'
      : status === 'started'
        ? 'Fahrt läuft'
        : status === 'completed'
          ? 'Abgeschlossen'
          : 'Suche Fahrer…';
  const canCancel = ['requested', 'accepted', 'arriving'].includes(status);

  return (
    <div className="space-y-4" data-testid="booking-status-view">
      <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 text-center shadow-sm">
        <div className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--bb-text-muted)]">Fahrer unterwegs</div>
        <div className="mt-3 text-5xl font-black tracking-tight text-white">{eta} Min.</div>
        <div className="mt-2 text-sm text-[var(--bb-text-secondary)]">{driver} ist auf dem Weg zu dir.</div>
        <div className="mt-5 flex items-center justify-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bb-bg-card)] text-xl font-black text-white">{driver.charAt(0)}</div>
          <div className="text-left">
            <div className="text-base font-bold text-white">{driver}</div>
            <div className="mt-1 inline-flex rounded-full bg-[var(--bb-bg-card)] px-3.5 py-1.5 text-sm font-black text-white">{plate}</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-[var(--bb-bg-card)] p-3 text-left">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Preis</div>
            <div className="mt-1 text-lg font-black text-white">{price ? formatBidBlitzCurrency(price, { locale: 'de' }) : 'Laufend'}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Status</div>
            <div className="mt-1 text-lg font-black text-white">Live</div>
          </div>
        </div>
        {liveMovementLabel ? (
          <div className="mt-4 rounded-2xl border border-[rgba(0,200,255,0.28)] bg-[rgba(0,200,255,0.12)] px-4 py-3 text-sm font-semibold text-[var(--bb-accent-cyan)]" data-testid="booking-live-movement-banner">
            {liveMovementLabel}
          </div>
        ) : null}
      </div>
      <div className="rounded-[28px] border border-white/10 bg-white/6 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-3 w-3 rounded-full bg-[var(--bb-accent-cyan)]" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Abholung</div>
            <div className="mt-1 text-sm font-bold text-white">{pickupAddress}</div>
          </div>
        </div>
        <div className="ml-[5px] mt-2 h-6 w-px bg-white/12" />
        <div className="flex items-start gap-3">
          <div className="mt-1 h-3 w-3 rounded-sm bg-[var(--bb-accent-warning)]" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Ziel</div>
            <div className="mt-1 text-sm font-bold text-white">{dropoffAddress}</div>
          </div>
        </div>
      </div>
      <div className="rounded-[28px] border border-white/10 bg-white/6 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Status</div>
            <div className="mt-1 text-lg font-black text-white">{statusLabel}</div>
          </div>
          <div className="rounded-full border border-white/10 bg-[var(--bb-bg-card)] px-3.5 py-1.5 text-sm font-black text-[var(--bb-text-secondary)]" data-testid="booking-status-pill">
            {status.toUpperCase()}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <SecondaryButton
            onClick={onOpenLiveChat}
            className="rounded-2xl text-sm"
            data-testid="booking-chat-button"
          >
            Chat
          </SecondaryButton>
          <SecondaryButton
            onClick={onCallDriver}
            className="rounded-2xl text-sm"
            data-testid="booking-call-button"
          >
            Anrufen
          </SecondaryButton>
          <SecondaryButton
            onClick={onShareTrip}
            className="rounded-2xl text-sm"
            data-testid="booking-share-button"
          >
            Teilen
          </SecondaryButton>
        </div>
        {canCancel ? (
          <button
            onClick={onCancel}
            className="mt-4 w-full rounded-2xl border border-[rgba(255,77,94,0.28)] bg-[rgba(255,77,94,0.12)] px-4 py-3 text-sm font-black text-[var(--bb-accent-danger)]"
            data-testid="booking-cancel-button"
          >
            Fahrt stornieren
          </button>
        ) : null}
      </div>
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
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [pickupMoveMode, setPickupMoveMode] = useState(false);
  const [bookingMode, setBookingMode] = useState('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [pricingConfig, setPricingConfig] = useState(null);

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
    let cancelled = false;
    const loadPricing = async () => {
      const pricing = await api.fetchPricing();
      if (!cancelled) setPricingConfig(pricing);
    };
    loadPricing();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeRide?.ride_id) return undefined;
    const interval = setInterval(async () => {
      const data = await api.fetchRide(activeRide.ride_id);
      const nextRide = data?.ride || data;
      if (nextRide?.ride_id) setActiveRide(nextRide);
    }, 10000);
    return () => clearInterval(interval);
  }, [activeRide?.ride_id]);

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
    const proximity = pickup?.lat ? { lat: pickup.lat, lng: pickup.lng } : null;
    const presetHits = getTaxiPresetPlaceHints(value, proximity, 6);
    search(
      'taxi-simple-dropoff',
      value,
      (results) => setSearchResults(dedupeTaxiPlaces([...presetHits, ...(results || [])])),
      () => {},
      pickup?.lat ? { lat: pickup.lat, lng: pickup.lng } : null,
    );
  }, [pickup?.lat, pickup?.lng, search]);

  useEffect(() => {
    if (!searchValue || searchValue.trim().length < 2) {
      setRegionalHints([]);
      return;
    }
    let cancelled = false;
    const loadHints = async () => {
      const proximity = pickup?.lat ? { lat: pickup.lat, lng: pickup.lng } : null;
      const presetHints = getTaxiPresetPlaceHints(searchValue, proximity, 4);
      const hints = await api.fetchRegionalPlaceHints(searchValue, pickup?.lat ? { lat: pickup.lat, lng: pickup.lng, limit: 4 } : { limit: 4 });
      if (!cancelled) setRegionalHints(dedupeTaxiPlaces([...(presetHints || []), ...(hints || [])]));
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

  const handlePickupMapChange = useCallback(async ({ lat, lng }) => {
    const address = await api.reverseGeocode(lat, lng);
    setPickup((prev) => ({
      ...prev,
      lat,
      lng,
      address: address || prev.address || 'Gewählter Abholpunkt',
    }));
    setPickupMoveMode(false);
    if (dropoff?.lat) {
      estimateRide({ ...dropoff });
    }
  }, [dropoff, estimateRide]);

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

  const handleSaveFavorite = useCallback(async (item) => {
    if (!user?.isAuthenticated) {
      toast.info('Bitte zuerst anmelden, um Orte zu speichern.');
      return;
    }
    setSavingFavorite(true);
    const result = await api.saveFavoriteFromSearch({
      name: item.name || item.address?.split(',')?.[0] || 'Gespeicherter Ort',
      address: item.address,
      lat: item.lat,
      lng: item.lng,
      icon: 'star',
    });
    setSavingFavorite(false);
    if (!result?.ok) {
      toast.error(result?.error || 'Ort konnte nicht gespeichert werden');
      return;
    }
    toast.success('Ort gespeichert');
  }, [user?.isAuthenticated]);

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

  const liveMovementLabel = useMemo(() => {
    if (!activeRide) return '';
    const minutes = Number(activeRide?.driver?.eta_minutes || activeRide?.eta_minutes || 0);
    if (minutes > 0) return `${minutes} Min bis zur Abholung`;
    if (activeRide?.status === 'arriving') return 'Dein Fahrer ist gleich da';
    if (activeRide?.status === 'started') return 'Fahrt läuft';
    return '';
  }, [activeRide]);

  const driverGpsLabel = useMemo(() => {
    if (!activeRide?.driver_lat || !activeRide?.driver_lng) return 'GPS wird synchronisiert';
    return `Live bei ${Number(activeRide.driver_lat).toFixed(4)}, ${Number(activeRide.driver_lng).toFixed(4)}`;
  }, [activeRide?.driver_lat, activeRide?.driver_lng]);

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
    const normalizedScheduledAt = bookingMode === 'later' && scheduledAt ? new Date(scheduledAt).toISOString() : null;
    if (bookingMode === 'later' && !normalizedScheduledAt) {
      toast.error('Bitte Zeit für spätere Buchung auswählen.');
      return;
    }
    setBooking(true);
    const result = await api.bookRideApi({
      pickup,
      dropoff,
      vehicleType: selectedEstimate.vehicle_type,
      paymentMethod: 'wallet',
      options: { bookingMode, scheduledAt: normalizedScheduledAt },
    });
    setBooking(false);
    if (!result.ok) {
      setError(result.error || 'Buchung fehlgeschlagen');
      return;
    }
    setActiveRide(result.ride);
    setSheetMode('status');
  }, [bookingMode, dropoff, pickup, scheduledAt, selectedEstimate]);

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
    <div className="h-dvh overflow-hidden bg-[var(--bb-bg-app)] text-white" data-testid="taxi-simple-page">
      <div className="relative h-dvh w-full overflow-hidden bg-[#02050B]">
        <div className="absolute inset-0 z-0" data-testid="taxi-simple-map-view">
          <TaxiMapbox
            pickup={pickup?.lat ? pickup : null}
            dropoff={dropoff?.lat ? dropoff : null}
            driverLocation={activeRide?.driver_lat && activeRide?.driver_lng ? { lat: activeRide.driver_lat, lng: activeRide.driver_lng } : null}
            nearbyDrivers={mapDrivers}
            height="100%"
            pickupMoveMode={pickupMoveMode}
            onPickupChange={handlePickupMapChange}
          />
        </div>

        <div className="absolute inset-x-0 top-0 z-10 px-4 pb-10 pt-[max(env(safe-area-inset-top,0px),16px)]">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => onNavigate?.('/')}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[rgba(7,16,29,0.92)] text-white shadow-sm"
              data-testid="taxi-back-button"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="rounded-full border border-white/10 bg-[rgba(7,16,29,0.92)] px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] text-[var(--bb-text-secondary)] shadow-sm" data-testid="taxi-region-pill">
              {regionLabel}
            </div>
          </div>
        </div>

        <motion.div
          layout
          transition={SPRING}
          className={`absolute bottom-0 z-10 w-full rounded-t-[32px] border-t border-white/10 bg-[rgba(2,5,11,0.96)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-4 shadow-[0_-18px_48px_rgba(0,0,0,0.38)] ${sheetHeightClass}`}
          data-testid="bottom-sheet-container"
        >
          <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-white/12" />

          {!activeRide && (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Taxi buchen</div>
                  <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-white">Wohin soll&apos;s gehen?</h1>
                </div>
                <div className="rounded-full border border-white/10 bg-white/6 px-3.5 py-2.5 text-sm font-bold text-[var(--bb-text-secondary)]" data-testid="taxi-driver-count-pill">
                  {mapDrivers.length} Fahrer
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-white/10 bg-white/6 p-4" data-testid="location-timeline-trigger">
                <button
                  onClick={() => setSheetMode('search')}
                  className="flex w-full items-start gap-4 text-left"
                >
                  <div className="flex flex-col items-center pt-1">
                    <div className="h-3 w-3 rounded-full bg-[var(--bb-accent-cyan)]" />
                    <div className="my-1 h-10 w-px bg-white/12" />
                    <div className="h-3 w-3 rounded-sm bg-[var(--bb-accent-warning)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Aktueller Standort</div>
                    <div className="mt-1 truncate text-sm font-bold text-white">{pickup.address || 'Dein Standort'}</div>
                    <div className="mt-4 text-sm font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Ziel</div>
                    <div className="mt-1 flex items-center gap-2 text-lg font-black text-white">
                      <Search size={18} />
                      <span className="truncate">{dropoff.address || 'Wohin?'}</span>
                    </div>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setPickupMoveMode((prev) => !prev)}
                className={`mt-3 flex min-h-[52px] w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${pickupMoveMode ? 'border-[var(--bb-accent-blue)] bg-[rgba(8,124,255,0.12)] text-[var(--bb-accent-blue)]' : 'border-white/10 bg-white/6 text-white'}`}
                data-testid="taxi-move-pickup-button"
              >
                <div>
                  <div className="text-sm font-black">Abholpunkt verschieben</div>
                  <div className="mt-1 text-sm text-[var(--bb-text-secondary)]">Tippe auf die Karte, wenn du nicht an deinem aktuellen Standort einsteigen willst.</div>
                </div>
                {pickupMoveMode ? <Check size={18} /> : <MapPin size={18} />}
              </button>

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
                    <div className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Ziel suchen</div>
                    <div className="mt-1 text-2xl font-black text-white">Adresse auswählen</div>
                  </div>
                  <button
                    onClick={() => setSheetMode(dropoff.address ? 'ride-options' : 'summary')}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/6 text-white"
                    data-testid="taxi-close-search-button"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-5 border-b border-white/10 pb-3">
                  <input
                    value={searchValue}
                    onChange={(e) => runSearch(e.target.value)}
                    placeholder="Adresse, Hotel, Flughafen oder Ort"
                    className="w-full bg-transparent text-2xl font-black text-white outline-none placeholder:text-[var(--bb-text-muted)]"
                    data-testid="address-search-input"
                    autoFocus
                  />
                </div>
                <div className="mt-4 max-h-[52vh] overflow-y-auto pr-1">
                  {searchResults.length === 0 && regionalHints.length === 0 ? (
                    <div className="rounded-2xl bg-white/6 px-4 py-5 text-sm text-[var(--bb-text-secondary)]" data-testid="taxi-search-empty-state">
                      Tippe mindestens einen Ort ein. Letzte Ziele und Live-Treffer erscheinen hier.
                    </div>
                  ) : null}
                  {regionalHints.length > 0 ? (
                    <div data-testid="regional-hints-section">
                      <SuggestionSectionTitle>Nahe Treffer</SuggestionSectionTitle>
                      {regionalHints.map((item, index) => (
                        <SearchResultRow key={`hint-${item.address}-${index}`} item={item} index={index} section="regional" onSelect={handleSelectDestination} />
                      ))}
                    </div>
                  ) : null}
                  {(searchResults[0] || regionalHints[0]) ? (
                    <FavoriteSaveRow item={searchResults[0] || regionalHints[0]} saving={savingFavorite} onSave={handleSaveFavorite} />
                  ) : null}
                  {searchResults.length > 0 ? (
                    <div data-testid="search-results-section">
                      <SuggestionSectionTitle>Alle Treffer</SuggestionSectionTitle>
                      {searchResults.map((item, index) => (
                        <SearchResultRow key={`${item.address}-${index}`} item={item} index={index} section="all" onSelect={handleSelectDestination} />
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
                <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                  <div className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Route</div>
                  <div className="mt-2 text-sm font-bold leading-snug text-white break-words">{pickup.address || 'Dein Standort'} → {dropoff.address}</div>
                  <div className="mt-2 text-sm text-[var(--bb-text-secondary)]">Wähle ein Fahrzeug und bestelle direkt.</div>
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
                <div className="mt-4 rounded-[24px] border border-white/10 bg-white/6 p-4" data-testid="vehicle-selection-summary">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Gewählt</div>
                      <div className="mt-1 text-lg font-black text-white">{VEHICLES.find((item) => item.id === selectedVehicle)?.label || 'Fahrt'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Ankunft</div>
                      <div className="mt-1 text-lg font-black text-white">{formatEta(selectedEstimate)}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-[var(--bb-text-secondary)]">{quickVehicleFacts[selectedVehicle]}</div>
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-[var(--bb-bg-card)] px-4 py-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Preis</div>
                      <MoneyAmount value={selectedEstimate?.total || selectedEstimate?.fare || 0} locale="de" className="mt-1 block text-lg font-black text-white" testId="taxi-selected-price" />
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Verfügbarkeit</div>
                      <div className="mt-1 text-sm font-black text-white">{Math.max(mapDrivers.length, 1)} Fahrer nahebei</div>
                    </div>
                  </div>
                  <PricingOverviewCard selectedEstimate={selectedEstimate} bookingMode={bookingMode} regionFallback={regionLabel} />
                  <div className="mt-4 rounded-2xl bg-[var(--bb-bg-card)] p-3" data-testid="booking-mode-card">
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Bestellung</div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setBookingMode('now')}
                        className={`min-h-[48px] rounded-2xl px-4 py-3 text-sm font-black ${bookingMode === 'now' ? 'bg-[var(--bb-accent-cyan)] text-[#08111D]' : 'bg-white/8 text-white'}`}
                        data-testid="booking-mode-now"
                      >
                        Jetzt
                      </button>
                      <button
                        onClick={() => setBookingMode('later')}
                        className={`min-h-[48px] rounded-2xl px-4 py-3 text-sm font-black ${bookingMode === 'later' ? 'bg-[var(--bb-accent-cyan)] text-[#08111D]' : 'bg-white/8 text-white'}`}
                        data-testid="booking-mode-later"
                      >
                        Später
                      </button>
                    </div>
                    {bookingMode === 'later' ? (
                      <div className="mt-3">
                        <label className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--bb-text-secondary)]">
                          <CalendarClock size={16} /> Abholzeit wählen
                        </label>
                        <input
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          min={new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 16)}
                          className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-white outline-none"
                          data-testid="booking-mode-later-input"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
                {error ? <div className="mt-4 rounded-2xl border border-[rgba(255,77,94,0.28)] bg-[rgba(255,77,94,0.12)] px-4 py-3 text-sm text-[var(--bb-accent-danger)]">{error}</div> : null}
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
                liveMovementLabel={liveMovementLabel}
              />
              <div className="mt-4 rounded-[24px] border border-white/10 bg-white/6 p-4" data-testid="live-gps-card">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Live GPS</div>
                <div className="mt-2 text-sm font-semibold text-[var(--bb-text-secondary)]">
                  Fahrerposition wird live aus dem Fahrer-Standort aktualisiert.
                </div>
                <div className="mt-3 rounded-2xl bg-[rgba(0,200,255,0.12)] px-4 py-3 text-sm font-semibold text-[var(--bb-accent-cyan)]" data-testid="live-gps-banner">
                  {driverGpsLabel}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-[var(--bb-bg-card)] px-3 py-3">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--bb-text-muted)]">Driver Lat</div>
                    <div className="mt-1 font-black text-white">{Number(activeRide?.driver_lat || 0).toFixed(4)}</div>
                  </div>
                  <div className="rounded-2xl bg-[var(--bb-bg-card)] px-3 py-3">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--bb-text-muted)]">Driver Lng</div>
                    <div className="mt-1 font-black text-white">{Number(activeRide?.driver_lng || 0).toFixed(4)}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!activeRide && sheetMode !== 'search' ? (
            <div className="sticky bottom-0 mt-5 bg-transparent" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }} data-testid="taxi-booking-cta-wrap">
              <PrimaryButton
                onClick={dropoff.address ? handleBookRide : () => setSheetMode('search')}
                disabled={booking || estimating}
                className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full text-lg font-black"
                data-testid="book-ride-button"
              >
                {booking || estimating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Clock3 className="h-5 w-5" />}
                {dropoff.address ? (selectedEstimate ? `Jetzt bestellen · ${formatPrice(selectedEstimate)}` : 'Preise laden…') : 'Ziel eingeben'}
              </PrimaryButton>
            </div>
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}