/**
 * BidBlitz Mobility - Complete Scooter App with Leaflet Map + Abo Integration
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Bike, QrCode, MapPin, Clock, Euro, Battery, X, Square,
  Navigation, History, Loader2, Zap, Menu, Wallet,
  HelpCircle, Settings, Bell, AlertTriangle, Volume2, 
  Users, Star, Crown, CreditCard, Shield, ChevronRight,
  ArrowLeft, Copy, Share2
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const scooterIcon = (battery) => new L.DivIcon({
  className: '',
  html: `<div style="background:${battery > 50 ? '#10B981' : battery > 20 ? '#F59E0B' : '#EF4444'};width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M19 7c0-1.1-.9-2-2-2h-3v2h3v2.65L13.52 14H10V9H6c-2.21 0-4 1.79-4 4v3h2c0 1.66 1.34 3 3 3s3-1.34 3-3h4.48L19 10.35V7zM7 17c-.55 0-1-.45-1-1h2c0 .55-.45 1-1 1z"/><path d="M5 6h5v2H5zm14 7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
  </div>`,
  iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -17]
});

const userIcon = new L.DivIcon({
  className: '',
  html: '<div style="background:#3B82F6;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.3);"></div>',
  iconSize: [14, 14], iconAnchor: [7, 7]
});

function FlyToLocation({ position }) {
  const map = useMap();
  useEffect(() => { if (position) map.flyTo(position, 15, { duration: 1 }); }, [position, map]);
  return null;
}

// ==================== SIDEBAR ====================
function Sidebar({ isOpen, onClose, user, stats, subscription, navigate }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[2000]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-0 top-0 bottom-0 w-[300px] bg-white shadow-2xl flex flex-col">
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">{user?.name?.charAt(0) || '?'}</div>
            <div><h2 className="font-bold text-lg">{user?.name || 'Gast'}</h2><p className="text-emerald-100 text-sm">{user?.email}</p></div>
          </div>
          <div className="flex gap-6">
            <div><p className="text-2xl font-bold">{stats.km}</p><p className="text-xs text-emerald-100">Kilometer</p></div>
            <div><p className="text-2xl font-bold">{stats.rides}</p><p className="text-xs text-emerald-100">Fahrten</p></div>
          </div>
        </div>
        {subscription && (
          <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            <div><p className="text-sm font-bold text-amber-800">{subscription.plan_name} Abo</p><p className="text-[10px] text-amber-600">bis {new Date(subscription.expires_at).toLocaleDateString('de-DE')}</p></div>
          </div>
        )}
        <div className="mx-4 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm font-medium text-blue-900">Wallet: {'\u20AC'}{((user?.wallet_balance_cents || 0) / 100).toFixed(2)}</p>
          <Link to="/pay" onClick={onClose} className="mt-2 block w-full py-2 bg-blue-500 text-white text-center text-sm font-bold rounded-lg">Aufladen</Link>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {[
            { icon: Wallet, label: 'Wallet', to: '/pay' },
            { icon: Crown, label: 'Scooter-Abo', to: '/scooter-abo' },
            { icon: Users, label: 'Gruppen-Fahrt', to: '/gruppen-fahrt' },
            { icon: History, label: 'Fahrt-Verlauf', to: '#', action: 'history' },
            { icon: Star, label: 'Bewertungen', to: '/scooter-bewertungen' },
            { icon: Shield, label: 'Sicheres Fahren', to: '/scooter-guide' },
            { icon: HelpCircle, label: 'Hilfe & Support', to: '/support-tickets' },
            { icon: Settings, label: 'Einstellungen', to: '/profile' },
          ].map((item, i) => (
            <Link key={i} to={item.to} onClick={onClose} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-100 transition-colors">
              <item.icon className="w-5 h-5 text-slate-600" /><span className="text-slate-800 font-medium text-sm">{item.label}</span>
            </Link>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100"><p className="text-xs text-slate-400 text-center">BidBlitz Mobility v1.0</p></div>
      </div>
    </div>
  );
}

// ==================== SCOOTER DETAIL SHEET ====================
function ScooterSheet({ device, onClose, onReserve, onRing, onReport, onUnlock, loading, hasAbo }) {
  if (!device) return null;
  const bColor = (device.battery_percent || 0) > 50 ? 'text-emerald-500' : (device.battery_percent || 0) > 20 ? 'text-yellow-500' : 'text-red-500';
  const unlockFee = hasAbo ? 0 : (device.unlock_fee_cents || 100);

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1500]" data-testid="scooter-detail-sheet">
      <div className="bg-white rounded-t-3xl shadow-2xl max-w-lg mx-auto">
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-slate-300 rounded-full" /></div>
        <div className="px-5 pb-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Roller {device.serial}</h2>
              <div className="flex items-center gap-3 mt-1 text-sm">
                <span className={`flex items-center gap-1 font-medium ${bColor}`}><Battery className="w-4 h-4" />{device.battery_percent || '?'}%</span>
                <span className="text-slate-500">{device.range_km || '?'} km</span>
                {device.avg_rating > 0 && <span className="flex items-center gap-0.5 text-amber-500"><Star className="w-3.5 h-3.5 fill-amber-400" />{device.avg_rating}</span>}
              </div>
              <div className="flex items-center gap-1 mt-1 text-sm text-slate-600">
                <Euro className="w-3.5 h-3.5" />
                {hasAbo ? (
                  <span><span className="line-through text-slate-400">{(unlockFee/100).toFixed(2)}{'\u20AC'}</span> <span className="text-emerald-600 font-bold">GRATIS</span> + {((device.per_minute_cents||25)/100).toFixed(2)}{'\u20AC'}/Min</span>
                ) : (
                  <span>{(unlockFee/100).toFixed(2)}{'\u20AC'} + {((device.per_minute_cents||25)/100).toFixed(2)}{'\u20AC'}/Min</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
          </div>

          {hasAbo && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg mb-3 text-xs">
              <Crown className="w-4 h-4 text-amber-500" /><span className="text-amber-800 font-medium">Abo aktiv - Entsperrung kostenlos!</span>
            </div>
          )}

          <div className="flex gap-2 mb-3">
            <button onClick={() => onRing(device.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 rounded-xl text-slate-700 text-sm font-medium" data-testid="ring-btn">
              <Volume2 className="w-4 h-4" /> Klingeln
            </button>
            <button onClick={() => onReport(device.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 rounded-xl text-slate-700 text-sm font-medium" data-testid="report-btn">
              <AlertTriangle className="w-4 h-4" /> Problem
            </button>
          </div>

          <button onClick={() => onReserve(device.id)} disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg mb-2"
            data-testid="reserve-btn">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Reservieren <span className="text-sm font-normal opacity-80">10 Min kostenlos</span></>}
          </button>
          <button onClick={() => onUnlock(device.id)} disabled={loading}
            className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="unlock-btn">
            <Zap className="w-5 h-5" /> Entsperren & Losfahren
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== ACTIVE RIDE ====================
function ActiveRide({ session, device, onEnd, loading }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!session) return;
    const start = new Date(session.started_at || session.requested_at).getTime();
    const i = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(i);
  }, [session]);

  const p = session?.pricing_snapshot || {};
  const total = (p.unlock_cents || 0) + Math.floor(elapsed / 60) * (p.per_minute_cents || 25);
  const m = Math.floor(elapsed / 60), s = elapsed % 60;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1500] bg-gradient-to-t from-emerald-600 to-emerald-500 text-white p-5 rounded-t-3xl shadow-2xl" data-testid="active-ride">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center"><Bike className="w-6 h-6" /></div>
            <div><h3 className="font-bold">{device?.name || 'Scooter'}</h3><p className="text-emerald-100 text-xs">{device?.serial}</p></div>
          </div>
          <div className="text-right"><div className="text-3xl font-mono font-bold">{m}:{s.toString().padStart(2, '0')}</div><p className="text-emerald-100 text-xs">Fahrzeit</p></div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white/10 rounded-xl p-2.5 text-center"><Euro className="w-4 h-4 mx-auto mb-0.5" /><div className="font-bold text-sm">{'\u20AC'}{(total/100).toFixed(2)}</div><p className="text-[10px] text-emerald-100">Gesamt</p></div>
          <div className="bg-white/10 rounded-xl p-2.5 text-center"><Zap className="w-4 h-4 mx-auto mb-0.5" /><div className="font-bold text-sm">{p.per_minute_cents||25}{'\u00A2'}/Min</div><p className="text-[10px] text-emerald-100">Tarif</p></div>
          <div className="bg-white/10 rounded-xl p-2.5 text-center"><Battery className="w-4 h-4 mx-auto mb-0.5" /><div className="font-bold text-sm">{device?.battery_percent||'~'}%</div><p className="text-[10px] text-emerald-100">Akku</p></div>
        </div>
        <button onClick={onEnd} disabled={loading} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-bold text-lg rounded-xl flex items-center justify-center gap-2 disabled:opacity-50" data-testid="end-ride-btn">
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Square className="w-6 h-6" /> Fahrt beenden</>}
        </button>
      </div>
    </div>
  );
}

// ==================== MAIN APP ====================
export default function ScooterApp() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [activeDevice, setActiveDevice] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [userPos, setUserPos] = useState(null);
  const [mapCenter, setMapCenter] = useState([42.6629, 21.1655]); // Pristina default
  const [flyTo, setFlyTo] = useState(null);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const totalRides = sessions.filter(s => s.status === 'ended').length;
  const totalKm = Math.round(sessions.reduce((sum, s) => sum + (s.duration_seconds || 0) / 60 * 0.5, 0));

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => { const loc = [p.coords.latitude, p.coords.longitude]; setUserPos(loc); setMapCenter(loc); setFlyTo(loc); },
      () => {}, { enableHighAccuracy: true }
    );
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const params = userPos ? { lat: userPos[0], lng: userPos[1], radius_km: 50 } : {};
      const res = await axios.get(`${API}/devices/available`, { params });
      setDevices(res.data.devices || []);
    } catch (e) { console.error(e); }
  }, [userPos]);

  const checkSession = useCallback(async () => {
    if (!token) return;
    try {
      const [sessRes, subRes] = await Promise.all([
        axios.get(`${API}/devices/my-sessions`, { headers }),
        axios.get(`${API}/scooter-features/my-subscription`, { headers }).catch(() => ({ data: { subscription: null } }))
      ]);
      const all = sessRes.data.sessions || [];
      setSessions(all);
      const active = all.find(s => ['requested', 'active'].includes(s.status));
      if (active) { setActiveSession(active); setActiveDevice(devices.find(d => d.id === active.device_id)); }
      setSubscription(subRes.data.subscription);
    } catch (e) { console.error(e); }
  }, [token, devices]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);
  useEffect(() => { checkSession(); }, [checkSession]);
  useEffect(() => { const i = setInterval(fetchDevices, 30000); return () => clearInterval(i); }, [fetchDevices]);

  const hasAbo = subscription?.status === 'active';

  const handleReserve = async (id) => {
    if (!token) { navigate('/login'); return; }
    setLoading(true);
    try { await axios.post(`${API}/devices/reserve/${id}`, {}, { headers }); toast.success('Reserviert! 10 Min kostenlos.'); setSelectedDevice(null); fetchDevices(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Fehler'); }
    finally { setLoading(false); }
  };

  const handleRing = async (id) => {
    try { await axios.post(`${API}/devices/ring/${id}`, {}, { headers }); toast.success('Scooter klingelt!'); }
    catch (e) { toast.error('Fehler'); }
  };

  const handleReport = async (id) => {
    try { await axios.post(`${API}/devices/report/${id}`, {}, { headers }); toast.success('Problem gemeldet!'); setSelectedDevice(null); }
    catch (e) { toast.error('Fehler'); }
  };

  const handleUnlock = async (id) => {
    if (!token) { navigate('/login'); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/devices/unlock/request`, { device_id: id }, { headers });
      toast.success('Scooter entsperrt!');
      setSelectedDevice(null);
      if (res.data.session_id) await axios.post(`${API}/devices/unlock/${res.data.session_id}/confirm`, {}, { headers });
      checkSession(); fetchDevices();
    } catch (e) {
      const msg = e.response?.data?.detail || 'Fehler';
      if (msg.includes('Guthaben')) toast.error(msg, { action: { label: 'Aufladen', onClick: () => navigate('/pay') } });
      else toast.error(msg);
    } finally { setLoading(false); }
  };

  const handleEndRide = async () => {
    if (!activeSession) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/devices/unlock/${activeSession.id}/end`, {}, { headers });
      toast.success(`Fahrt beendet! ${res.data.duration_formatted} - ${res.data.cost_formatted}`);
      setActiveSession(null); setActiveDevice(null); fetchDevices(); checkSession();
    } catch (e) { toast.error(e.response?.data?.detail || 'Fehler'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-100" data-testid="scooter-app" style={{ top: '64px' }}>
      {/* LEAFLET MAP */}
      <MapContainer center={mapCenter} zoom={14} className="h-full w-full z-0" zoomControl={false} attributionControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {flyTo && <FlyToLocation position={flyTo} />}
        {userPos && <Marker position={userPos} icon={userIcon} />}
        {devices.map(d => d.lat && d.lng && (
          <Marker key={d.id} position={[d.lat, d.lng]} icon={scooterIcon(d.battery_percent || 50)}
            eventHandlers={{ click: () => setSelectedDevice(d) }}>
            <Popup>
              <div className="text-center min-w-[120px]">
                <p className="font-bold text-sm">{d.name || d.serial}</p>
                <p className="text-xs text-slate-500">{d.battery_percent}% | {d.range_km}km</p>
                <button onClick={() => setSelectedDevice(d)} className="mt-1 px-3 py-1 bg-emerald-500 text-white text-xs rounded-lg font-bold w-full">Details</button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Device count */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur px-4 py-2 rounded-full shadow-lg text-sm font-medium text-slate-700">
        {devices.length} Scooter verfuegbar
      </div>

      {/* Menu Button */}
      <div className="absolute top-3 left-3 z-[1000]">
        <button onClick={() => setShowSidebar(true)} className="w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center" data-testid="menu-btn">
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
      </div>

      {/* Location + Abo Badge */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <button onClick={() => { if (userPos) setFlyTo([...userPos]); }} className="w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center">
          <Navigation className="w-5 h-5 text-blue-600" />
        </button>
        {hasAbo && (
          <Link to="/scooter-abo" className="w-11 h-11 bg-amber-400 rounded-full shadow-lg flex items-center justify-center">
            <Crown className="w-5 h-5 text-amber-800" />
          </Link>
        )}
      </div>

      {/* SCAN BUTTON */}
      {!activeSession && !selectedDevice && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000]">
          <button onClick={() => setShowScanner(true)} className="flex items-center gap-3 px-8 py-4 bg-white rounded-full shadow-xl" data-testid="scan-btn">
            <QrCode className="w-6 h-6 text-slate-700" /><span className="text-lg font-bold text-slate-800">Scannen</span>
          </button>
        </div>
      )}

      {/* SCOOTER DETAIL */}
      {selectedDevice && !activeSession && (
        <ScooterSheet device={selectedDevice} onClose={() => setSelectedDevice(null)}
          onReserve={handleReserve} onRing={handleRing} onReport={handleReport} onUnlock={handleUnlock}
          loading={loading} hasAbo={hasAbo} />
      )}

      {/* ACTIVE RIDE */}
      {activeSession && <ActiveRide session={activeSession} device={activeDevice} onEnd={handleEndRide} loading={loading} />}

      {/* QR SCANNER */}
      {showScanner && (
        <div className="fixed inset-0 z-[3000] bg-black flex flex-col" data-testid="qr-scanner">
          <div className="p-4 flex items-center justify-between">
            <button onClick={() => setShowScanner(false)} className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center"><X className="w-6 h-6 text-white" /></button>
            <p className="text-white font-bold">QR-Code scannen</p>
            <div className="w-11" />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-64 h-64 border-4 border-white/30 rounded-2xl relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-emerald-400 animate-pulse" />
            </div>
          </div>
          <div className="p-6">
            <p className="text-white/60 text-center text-sm mb-3">Oder Seriennummer eingeben:</p>
            <input type="text" placeholder="z.B. SCOOTER-DEMO-001" className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm text-center"
              onKeyPress={(e) => { if (e.key === 'Enter') { const d = devices.find(x => x.serial.toLowerCase() === e.target.value.trim().toLowerCase()); if (d) { setShowScanner(false); handleUnlock(d.id); } else toast.error('Nicht gefunden'); }}}
              data-testid="serial-input" />
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <Sidebar isOpen={showSidebar} onClose={() => setShowSidebar(false)} user={user}
        stats={{ km: totalKm, rides: totalRides }} subscription={subscription} navigate={navigate} />
    </div>
  );
}
