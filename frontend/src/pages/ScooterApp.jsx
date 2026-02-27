/**
 * BidBlitz Mobility - Complete Scooter App (Lime/Bird/Bolt Style)
 * Features: Map, QR Scanner, Reserve, Ring, Report, Active Ride, Sidebar Menu, History
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  Bike, QrCode, MapPin, Clock, Euro, Battery, X, Play, Square,
  Navigation, History, AlertCircle, CheckCircle, Loader2, Zap,
  ChevronRight, CreditCard, Shield, Star, Menu, Wallet,
  HelpCircle, Settings, Bell, ChevronUp, ChevronDown,
  AlertTriangle, Volume2, User, ArrowLeft, Phone, Search
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// ==================== SIDEBAR MENU ====================
function SidebarMenu({ isOpen, onClose, user, stats, navigate }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[2000]" data-testid="scooter-sidebar">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-0 top-0 bottom-0 w-[300px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-left">
        {/* User Header */}
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
              {user?.name?.charAt(0) || '?'}
            </div>
            <div>
              <h2 className="font-bold text-lg">{user?.name || 'Gast'}</h2>
              <p className="text-emerald-100 text-sm">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-6">
            <div><p className="text-2xl font-bold">{stats.totalKm}</p><p className="text-xs text-emerald-100">Kilometer</p></div>
            <div><p className="text-2xl font-bold">{stats.totalRides}</p><p className="text-xs text-emerald-100">Fahrten</p></div>
          </div>
        </div>

        {/* Wallet Banner */}
        <div className="mx-4 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">Wallet: {'\u20AC'}{((user?.wallet_balance_cents || 0) / 100).toFixed(2)}</p>
              <p className="text-xs text-blue-600">Guthaben aufladen</p>
            </div>
          </div>
          <Link to="/pay" onClick={onClose} className="mt-2 block w-full py-2 bg-blue-500 text-white text-center text-sm font-bold rounded-lg">
            Aufladen
          </Link>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {[
            { icon: Wallet, label: 'Wallet', to: '/pay', color: 'text-slate-700' },
            { icon: History, label: 'Fahrt-Verlauf', action: 'history', color: 'text-slate-700' },
            { icon: Shield, label: 'Sicheres Fahren', to: '/scooter-guide', color: 'text-slate-700' },
            { icon: HelpCircle, label: 'Hilfe & Support', to: '/support-tickets', color: 'text-slate-700' },
            { icon: Bell, label: 'Benachrichtigungen', to: '/notifications', color: 'text-slate-700' },
            { icon: Settings, label: 'Einstellungen', to: '/profile', color: 'text-slate-700' },
          ].map((item, i) => (
            <Link
              key={i}
              to={item.to || '#'}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <span className="text-slate-800 font-medium">{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 text-center">BidBlitz Mobility v1.0</p>
        </div>
      </div>
    </div>
  );
}

// ==================== SCOOTER DETAIL BOTTOM SHEET ====================
function ScooterDetailSheet({ device, onClose, onReserve, onRing, onReport, onUnlock, loading }) {
  if (!device) return null;
  const batteryColor = (device.battery_percent || 0) > 50 ? 'text-emerald-500' : (device.battery_percent || 0) > 20 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1500] animate-in slide-in-from-bottom" data-testid="scooter-detail-sheet">
      <div className="bg-white rounded-t-3xl shadow-2xl max-w-lg mx-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-slate-300 rounded-full" /></div>
        
        {/* Header */}
        <div className="px-5 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-800">Roller {device.serial}</h2>
              <div className="flex items-center gap-4 mt-2">
                <span className={`flex items-center gap-1 text-sm font-medium ${batteryColor}`}>
                  <Battery className="w-4 h-4" /> {device.battery_percent || '?'}%
                </span>
                <span className="flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="w-4 h-4" /> {device.range_km || '?'} km Reichweite
                </span>
              </div>
              <div className="flex items-center gap-1 mt-2 text-sm text-slate-600">
                <Euro className="w-4 h-4" />
                <span>{((device.unlock_fee_cents || 100) / 100).toFixed(2)}{'\u20AC'} zum Starten, {((device.per_minute_cents || 25) / 100).toFixed(2)}{'\u20AC'}/Min</span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Action Buttons Row */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => onRing(device.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-100 rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
              data-testid="scooter-ring-btn"
            >
              <Volume2 className="w-4 h-4" /> Klingeln
            </button>
            <button
              onClick={() => onReport(device.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-100 rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
              data-testid="scooter-report-btn"
            >
              <AlertTriangle className="w-4 h-4" /> Problem melden
            </button>
          </div>

          {/* Reserve Button */}
          <button
            onClick={() => onReserve(device.id)}
            disabled={loading}
            className="w-full mt-3 py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold text-lg rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg"
            data-testid="scooter-reserve-btn"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
              <>Reservieren<span className="text-sm font-normal opacity-80 ml-2">Kostenlos fuer 10 Minuten</span></>
            )}
          </button>

          {/* Unlock / Scan Button */}
          <button
            onClick={() => onUnlock(device.id)}
            disabled={loading}
            className="w-full mt-2 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            data-testid="scooter-unlock-btn"
          >
            <Zap className="w-5 h-5" /> Entsperren & Losfahren
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== ACTIVE RIDE DISPLAY ====================
function ActiveRideDisplay({ session, device, onEnd, loading }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!session?.started_at && !session?.requested_at) return;
    const start = new Date(session.started_at || session.requested_at).getTime();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [session]);

  const pricing = session?.pricing_snapshot || {};
  const unlockCost = pricing.unlock_cents || 100;
  const minuteCost = pricing.per_minute_cents || 25;
  const rideCost = Math.floor(elapsed / 60) * minuteCost;
  const totalCost = unlockCost + rideCost;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1500] bg-gradient-to-t from-emerald-600 to-emerald-500 text-white p-5 rounded-t-3xl shadow-2xl" data-testid="active-ride">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center"><Bike className="w-6 h-6" /></div>
            <div>
              <h3 className="font-bold text-lg">{device?.name || 'Scooter'}</h3>
              <p className="text-emerald-100 text-sm">{device?.serial}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono font-bold">{mins}:{secs.toString().padStart(2, '0')}</div>
            <p className="text-emerald-100 text-sm">Fahrzeit</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <Euro className="w-5 h-5 mx-auto mb-1" />
            <div className="font-bold">{'\u20AC'}{(totalCost / 100).toFixed(2)}</div>
            <p className="text-xs text-emerald-100">Gesamt</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <Zap className="w-5 h-5 mx-auto mb-1" />
            <div className="font-bold">{minuteCost}{'\u00A2'}/Min</div>
            <p className="text-xs text-emerald-100">Tarif</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <Battery className="w-5 h-5 mx-auto mb-1" />
            <div className="font-bold">{device?.battery_percent || '~'}%</div>
            <p className="text-xs text-emerald-100">Akku</p>
          </div>
        </div>
        <button onClick={onEnd} disabled={loading}
          className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-bold text-lg rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
          data-testid="end-ride-btn"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Square className="w-6 h-6" /> Fahrt beenden</>}
        </button>
      </div>
    </div>
  );
}

// ==================== RIDE HISTORY ====================
function RideHistorySheet({ isOpen, onClose, sessions }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[2000] bg-white" data-testid="ride-history">
      <div className="p-4 border-b border-slate-100 flex items-center gap-3">
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="text-lg font-bold text-slate-800">Fahrt-Verlauf</h2>
      </div>
      <div className="overflow-y-auto p-4 space-y-3" style={{maxHeight:'calc(100vh-60px)'}}>
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Noch keine Fahrten</p>
          </div>
        ) : sessions.map(s => (
          <div key={s.id} className="bg-slate-50 rounded-xl p-4">
            <div className="flex justify-between mb-2">
              <span className="font-medium text-slate-800">{s.device_serial || s.device_type}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'ended' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{s.status}</span>
            </div>
            <div className="flex gap-4 text-sm text-slate-500">
              <span>{s.duration_seconds ? `${Math.floor(s.duration_seconds/60)} Min` : '-'}</span>
              <span>{s.cost_cents ? `${'\u20AC'}${(s.cost_cents/100).toFixed(2)}` : '-'}</span>
              <span>{new Date(s.requested_at).toLocaleDateString('de-DE')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== MAIN SCOOTER APP ====================
export default function ScooterApp() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [activeDevice, setActiveDevice] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [userPos, setUserPos] = useState(null);
  const [mapCenter, setMapCenter] = useState([25.1972, 55.2744]); // Dubai default

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // Stats
  const totalRides = sessions.filter(s => s.status === 'ended').length;
  const totalKm = Math.round(sessions.reduce((sum, s) => sum + (s.duration_seconds || 0) / 60 * 0.5, 0));

  // Get user location
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const loc = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(loc);
        setMapCenter(loc);
      },
      () => console.log('Location not available'),
      { enableHighAccuracy: true }
    );
  }, []);

  // Fetch available devices
  const fetchDevices = useCallback(async () => {
    try {
      const params = userPos ? { lat: userPos[0], lng: userPos[1], radius_km: 10 } : {};
      const res = await axios.get(`${API}/devices/available`, { params });
      setDevices(res.data.devices || []);
    } catch (e) { console.error(e); }
  }, [userPos]);

  // Check for active session
  const checkActiveSession = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/devices/my-sessions`, { headers });
      const allSessions = res.data.sessions || [];
      setSessions(allSessions);
      const active = allSessions.find(s => ['requested', 'active'].includes(s.status));
      if (active) {
        setActiveSession(active);
        const dev = devices.find(d => d.id === active.device_id);
        setActiveDevice(dev);
      }
    } catch (e) { console.error(e); }
  }, [token, devices]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);
  useEffect(() => { checkActiveSession(); }, [checkActiveSession]);
  useEffect(() => { const i = setInterval(fetchDevices, 30000); return () => clearInterval(i); }, [fetchDevices]);

  // === ACTIONS ===
  const handleReserve = async (deviceId) => {
    if (!token) { navigate('/login'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/devices/reserve/${deviceId}`, {}, { headers });
      toast.success('Reserviert! 10 Minuten kostenlos.');
      setSelectedDevice(null);
      fetchDevices();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Reservierung fehlgeschlagen');
    } finally { setLoading(false); }
  };

  const handleRing = async (deviceId) => {
    try {
      await axios.post(`${API}/devices/ring/${deviceId}`, {}, { headers });
      toast.success('Scooter klingelt! Folge dem Sound.');
    } catch (e) { toast.error('Klingeln fehlgeschlagen'); }
  };

  const handleReport = async (deviceId) => {
    try {
      await axios.post(`${API}/devices/report/${deviceId}`, {}, { headers });
      toast.success('Problem gemeldet. Danke!');
      setSelectedDevice(null);
    } catch (e) { toast.error('Meldung fehlgeschlagen'); }
  };

  const handleUnlock = async (deviceId) => {
    if (!token) { navigate('/login'); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/devices/unlock/request`, { device_id: deviceId }, { headers });
      toast.success('Scooter entsperrt! Gute Fahrt!');
      setSelectedDevice(null);
      // Auto-confirm for now
      if (res.data.session_id) {
        await axios.post(`${API}/devices/unlock/${res.data.session_id}/confirm`, {}, { headers });
      }
      checkActiveSession();
      fetchDevices();
    } catch (e) {
      const msg = e.response?.data?.detail || 'Entsperrung fehlgeschlagen';
      if (msg.includes('Guthaben')) {
        toast.error(msg + ' Wallet aufladen?', { action: { label: 'Aufladen', onClick: () => navigate('/pay') } });
      } else {
        toast.error(msg);
      }
    } finally { setLoading(false); }
  };

  const handleEndRide = async () => {
    if (!activeSession) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/devices/unlock/${activeSession.id}/end`, {}, { headers });
      toast.success(`Fahrt beendet! ${res.data.duration_formatted} - ${res.data.cost_formatted}`);
      setActiveSession(null);
      setActiveDevice(null);
      fetchDevices();
      checkActiveSession();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Fehler beim Beenden');
    } finally { setLoading(false); }
  };

  const handleQRScan = async (result) => {
    if (!result?.[0]?.rawValue) return;
    const scannedText = result[0].rawValue;
    setShowScanner(false);
    // Find device by serial
    const device = devices.find(d => scannedText.includes(d.serial) || scannedText.includes(d.id));
    if (device) {
      handleUnlock(device.id);
    } else {
      toast.error('Scooter nicht gefunden. Bitte erneut scannen.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-100" data-testid="scooter-app" style={{top: '64px'}}>
      {/* MAP */}
      <div className="absolute inset-0 bg-slate-200">
        {/* Simple map placeholder with device list - real map needs leaflet */}
        <div className="h-full w-full relative overflow-hidden" style={{background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)'}}>
          {/* Map Grid Pattern */}
          <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'linear-gradient(#999 1px, transparent 1px), linear-gradient(90deg, #999 1px, transparent 1px)', backgroundSize: '50px 50px'}} />
          
          {/* Device Markers */}
          {devices.map((d, i) => (
            <button
              key={d.id}
              onClick={() => setSelectedDevice(d)}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
              style={{
                left: `${15 + (i % 5) * 18}%`,
                top: `${15 + Math.floor(i / 5) * 22}%`
              }}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white ${
                d.type === 'bike' ? 'bg-blue-500' : 'bg-emerald-500'
              } ${selectedDevice?.id === d.id ? 'ring-4 ring-emerald-300 scale-125' : ''} transition-transform`}>
                <Bike className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-white px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-700 shadow whitespace-nowrap">
                {d.battery_percent}%
              </div>
            </button>
          ))}

          {/* User Position */}
          {userPos && (
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
              <div className="w-4 h-4 bg-blue-500 rounded-full border-3 border-white shadow-lg" />
              <div className="absolute -inset-3 bg-blue-500/20 rounded-full animate-ping" />
            </div>
          )}

          {/* Center text */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow text-sm font-medium text-slate-700 z-20">
            {devices.length} Scooter in der Naehe
          </div>
        </div>
      </div>

      {/* TOP BUTTONS */}
      <div className="absolute top-4 left-4 z-30">
        <button onClick={() => setShowSidebar(true)} className="w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center" data-testid="scooter-menu-btn">
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
      </div>
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
        <button onClick={() => { if (userPos) setMapCenter(userPos); }} className="w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center">
          <Navigation className="w-5 h-5 text-blue-600" />
        </button>
      </div>

      {/* SCAN BUTTON (bottom center) */}
      {!activeSession && !selectedDevice && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-3 px-8 py-4 bg-white rounded-full shadow-xl hover:shadow-2xl transition-all"
            data-testid="scooter-scan-btn"
          >
            <QrCode className="w-6 h-6 text-slate-700" />
            <span className="text-lg font-bold text-slate-800">Scannen</span>
          </button>
        </div>
      )}

      {/* SCOOTER DETAIL SHEET */}
      {selectedDevice && !activeSession && (
        <ScooterDetailSheet
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          onReserve={handleReserve}
          onRing={handleRing}
          onReport={handleReport}
          onUnlock={handleUnlock}
          loading={loading}
        />
      )}

      {/* ACTIVE RIDE */}
      {activeSession && (
        <ActiveRideDisplay
          session={activeSession}
          device={activeDevice}
          onEnd={handleEndRide}
          loading={loading}
        />
      )}

      {/* QR SCANNER MODAL */}
      {showScanner && (
        <div className="fixed inset-0 z-[3000] bg-black" data-testid="qr-scanner">
          <div className="absolute top-4 left-4 z-10">
            <button onClick={() => setShowScanner(false)} className="w-11 h-11 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
            <p className="text-white font-bold text-lg">QR-Code scannen</p>
          </div>
          <div className="flex items-center justify-center h-full">
            <div className="w-72 h-72 border-4 border-white/50 rounded-2xl relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-emerald-400 animate-pulse" />
              <p className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-white/60 text-sm whitespace-nowrap">Scooter-QR-Code in den Rahmen halten</p>
            </div>
          </div>
          {/* Manual input */}
          <div className="absolute bottom-8 left-4 right-4">
            <p className="text-white/60 text-center text-sm mb-2">Oder Seriennummer eingeben:</p>
            <div className="flex gap-2 max-w-sm mx-auto">
              <input
                type="text"
                placeholder="z.B. SCOOTER-DEMO-001"
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const serial = e.target.value.trim();
                    const device = devices.find(d => d.serial.toLowerCase() === serial.toLowerCase());
                    if (device) { setShowScanner(false); handleUnlock(device.id); }
                    else toast.error('Scooter nicht gefunden');
                  }
                }}
                data-testid="scooter-serial-input"
              />
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <SidebarMenu
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        user={user}
        stats={{ totalKm, totalRides }}
        navigate={navigate}
      />

      {/* RIDE HISTORY */}
      <RideHistorySheet
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        sessions={sessions}
      />
    </div>
  );
}
