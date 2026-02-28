/**
 * BidBlitz Taxi Pro - Full Rider App
 * Vehicle type selection, wallet check, live tracking, autocomplete, airport meetpoints
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Car, MapPin, Navigation, X, Loader2, Clock, Euro, Star,
  Phone, CheckCircle, ChevronRight, ArrowLeft, Search, Square,
  Wallet, AlertTriangle, Zap, Crown, Users, Plane
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const PRISTINA = [42.6629, 21.1655];

const pickupDot = new L.DivIcon({className:'',html:'<div style="background:#10B981;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(16,185,129,0.5);"></div>',iconSize:[14,14],iconAnchor:[7,7]});
const dropoffDot = new L.DivIcon({className:'',html:'<div style="background:#3B82F6;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(59,130,246,0.5);"></div>',iconSize:[14,14],iconAnchor:[7,7]});
const driverCar = new L.DivIcon({className:'',html:'<div style="background:#F59E0B;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 0 12px rgba(245,158,11,0.5);"><svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg></div>',iconSize:[36,36],iconAnchor:[18,18]});

function FlyTo({pos}){const m=useMap();useEffect(()=>{if(pos)m.flyTo(pos,14,{duration:1});},[pos,m]);return null;}

const VEHICLES = [
  {id:'standard', label:'Standard', icon:Car, desc:'Günstig & schnell', color:'from-blue-500 to-cyan-500'},
  {id:'premium', label:'Premium', icon:Crown, desc:'Komfort & Luxus', color:'from-amber-500 to-orange-500'},
  {id:'van', label:'Van', icon:Users, desc:'Bis 6 Personen', color:'from-violet-500 to-purple-500'},
];

const AIRPORT_POINTS = [
  {code:'PIA_ARRIVALS_A', label:'Arrivals A', lat:42.5728, lng:21.0358},
  {code:'PIA_ARRIVALS_B', label:'Arrivals B', lat:42.5725, lng:21.0362},
  {code:'PIA_PARKING', label:'Parking', lat:42.5732, lng:21.0345},
];

export default function TaxiPage() {
  const {token,user} = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('book'); // book, vehicle, confirm, searching, tracking, complete
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [vehicleType, setVehicleType] = useState('standard');
  const [estimates, setEstimates] = useState({});
  const [activeRide, setActiveRide] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userPos, setUserPos] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [suggestions, setSuggestions] = useState({field:null, items:[]});
  const [history, setHistory] = useState([]);
  const searchTimer = useRef(null);
  const trackTimer = useRef(null);
  const headers = token ? {Authorization:`Bearer ${token}`} : {};

  // GPS
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => { setUserPos([p.coords.latitude, p.coords.longitude]); setPickupCoords([p.coords.latitude, p.coords.longitude]); setPickup('Mein Standort'); },
      () => { setUserPos(PRISTINA); setPickupCoords(PRISTINA); setPickup('Pristina Zentrum'); },
      {enableHighAccuracy:true}
    );
  }, []);

  // Wallet + active ride
  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/bidblitz-pay/main-balance`, {headers}).then(r => setWalletBalance(Math.round((r.data.bidblitz_balance||0)*100))).catch(()=>{});
    axios.get(`${API}/taxi/my-ride`, {headers}).then(r => { if(r.data.ride) { setActiveRide(r.data.ride); setStep(r.data.ride.status==='searching'?'searching':'tracking'); }}).catch(()=>{});
    axios.get(`${API}/taxi/history`, {headers}).then(r => setHistory(r.data.rides||[])).catch(()=>{});
  }, [token]);

  // Live tracking poll
  useEffect(() => {
    if(step !== 'tracking' || !activeRide) return;
    trackTimer.current = setInterval(async () => {
      try {
        const r = await axios.get(`${API}/taxi/my-ride`, {headers});
        if(r.data.ride) { setActiveRide(r.data.ride); if(r.data.ride.status==='completed') setStep('complete'); }
      } catch(e){}
    }, 3000);
    return () => clearInterval(trackTimer.current);
  }, [step, activeRide]);

  // Autocomplete
  const searchAddress = (q, field) => {
    if(searchTimer.current) clearTimeout(searchTimer.current);
    if(q.length<2) { setSuggestions({field:null,items:[]}); return; }
    searchTimer.current = setTimeout(async () => {
      try { const r = await axios.get(`${API}/taxi/geocode/search?q=${encodeURIComponent(q)}`); setSuggestions({field, items:r.data.results||[]}); } catch(e){}
    }, 300);
  };

  // Estimate all vehicle types
  const fetchEstimates = async () => {
    if(!pickupCoords || !dropoffCoords) { toast.error('Bitte Abholort und Ziel eingeben'); return; }
    setLoading(true);
    try {
      const results = {};
      for(const v of ['standard','premium','van']) {
        const r = await axios.get(`${API}/taxi/estimate?pickup_lat=${pickupCoords[0]}&pickup_lng=${pickupCoords[1]}&dropoff_lat=${dropoffCoords[0]}&dropoff_lng=${dropoffCoords[1]}&vehicle_type=${v}`);
        results[v] = r.data;
      }
      setEstimates(results);
      setStep('vehicle');
    } catch(e) { toast.error('Fehler bei Preisberechnung'); }
    finally { setLoading(false); }
  };

  // Book ride
  const handleBook = async () => {
    if(!token) { navigate('/login'); return; }
    const est = estimates[vehicleType];
    if(!est) return;

    // Wallet check
    const fareCents = Math.round(est.total_fare * 100);
    if(walletBalance < fareCents) {
      toast.error(`Wallet-Guthaben zu niedrig! Benötigt: ${est.total_fare} EUR`, {action:{label:'Aufladen', onClick:()=>navigate('/pay')}});
      return;
    }

    setLoading(true);
    try {
      const r = await axios.post(`${API}/taxi/request-ride`, {
        pickup_lat:pickupCoords[0], pickup_lng:pickupCoords[1], pickup_address:pickup,
        dropoff_lat:dropoffCoords[0], dropoff_lng:dropoffCoords[1], dropoff_address:dropoff,
        vehicle_type:vehicleType
      }, {headers});
      setActiveRide(r.data.ride);
      setStep('searching');
      toast.success('Fahrer wird gesucht...');
      // Poll for driver assignment
      const poll = setInterval(async () => {
        const check = await axios.get(`${API}/taxi/my-ride`, {headers});
        if(check.data.ride) {
          setActiveRide(check.data.ride);
          if(['accepted','arrived','started'].includes(check.data.ride.status)) { clearInterval(poll); setStep('tracking'); }
          if(check.data.ride.status==='expired') { clearInterval(poll); setStep('book'); toast.error('Kein Fahrer verfügbar. Bitte erneut versuchen.'); }
        }
      }, 3000);
      setTimeout(() => clearInterval(poll), 120000); // Stop after 2min
    } catch(e) { toast.error(e.response?.data?.detail || 'Fehler'); }
    finally { setLoading(false); }
  };

  const handleCancel = async () => {
    if(!activeRide) return;
    try { await axios.post(`${API}/taxi/cancel/${activeRide.id}`, {}, {headers}); setActiveRide(null); setStep('book'); toast.success('Storniert'); } catch(e) { toast.error(e.response?.data?.detail||'Fehler'); }
  };

  const est = estimates[vehicleType];
  const STATUS = {searching:'Suche Fahrer...', assigned:'Fahrer zugewiesen', accepted:'Fahrer unterwegs', arrived:'Fahrer ist da!', started:'Unterwegs zum Ziel', completed:'Angekommen!'};

  return (
    <div className="fixed inset-0 bg-[#061520]" style={{top:'64px'}} data-testid="taxi-page">
      {/* MAP */}
      <MapContainer center={userPos||PRISTINA} zoom={14} className="h-full w-full z-0" zoomControl={false} attributionControl={false}>
        <TileLayer url={DARK_TILES} />
        {userPos && <FlyTo pos={userPos} />}
        {pickupCoords && <Marker position={pickupCoords} icon={pickupDot} />}
        {dropoffCoords && <Marker position={dropoffCoords} icon={dropoffDot} />}
        {pickupCoords && dropoffCoords && <Polyline positions={[pickupCoords, dropoffCoords]} pathOptions={{color:'#3B82F6',weight:3,dashArray:'8,8'}} />}
        {driverLocation && <Marker position={driverLocation} icon={driverCar} />}
      </MapContainer>

      {/* TOP */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between">
        <a href="/" className="w-11 h-11 bg-[#0a1f2e]/90 backdrop-blur rounded-full flex items-center justify-center border border-white/10"><ArrowLeft className="w-5 h-5 text-white" /></a>
        <div className="bg-[#0a1f2e]/90 backdrop-blur px-4 py-2 rounded-full border border-white/10"><span className="text-sm font-bold text-white">BidBlitz Taxi</span></div>
        <div className="bg-[#0a1f2e]/90 backdrop-blur px-3 py-2 rounded-full border border-white/10 flex items-center gap-1">
          <Wallet className="w-4 h-4 text-emerald-400" /><span className="text-xs font-bold text-white">{(walletBalance/100).toFixed(0)}{'\u20AC'}</span>
        </div>
      </div>

      {/* BOOK STEP */}
      {step === 'book' && (
        <div className="fixed inset-x-0 bottom-0 z-[1500] bg-[#0a1f2e]/95 backdrop-blur-xl rounded-t-3xl border-t border-white/10">
          <div className="max-w-lg mx-auto p-5">
            <div className="flex justify-center pt-1 pb-3"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <h2 className="text-lg font-bold text-white mb-4">Wohin?</h2>
            {/* Pickup */}
            <div className="relative mb-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-emerald-400 rounded-full flex-shrink-0" />
                <input value={pickup} onChange={e=>{setPickup(e.target.value);searchAddress(e.target.value,'pickup');}} placeholder="Abholort" className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-white/40" />
              </div>
              {suggestions.field==='pickup' && suggestions.items.length>0 && (
                <div className="absolute left-6 right-0 mt-1 bg-[#0a1f2e] border border-white/20 rounded-xl overflow-hidden z-50 max-h-32 overflow-y-auto">
                  {suggestions.items.map((s,i)=>(<button key={i} onClick={()=>{setPickup(s.name);setPickupCoords([s.lat,s.lng]);setSuggestions({field:null,items:[]});}} className="w-full px-4 py-2 text-left text-white text-sm hover:bg-white/10 border-b border-white/5 flex items-center gap-2"><MapPin className="w-3 h-3 text-emerald-400 flex-shrink-0" />{s.name}</button>))}
                </div>
              )}
            </div>
            {/* Dropoff */}
            <div className="relative mb-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-400 rounded-full flex-shrink-0" />
                <input value={dropoff} onChange={e=>{setDropoff(e.target.value);searchAddress(e.target.value,'dropoff');}} placeholder="Ziel eingeben" className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-white/40" />
              </div>
              {suggestions.field==='dropoff' && suggestions.items.length>0 && (
                <div className="absolute left-6 right-0 mt-1 bg-[#0a1f2e] border border-white/20 rounded-xl overflow-hidden z-50 max-h-32 overflow-y-auto">
                  {suggestions.items.map((s,i)=>(<button key={i} onClick={()=>{setDropoff(s.name);setDropoffCoords([s.lat,s.lng]);setSuggestions({field:null,items:[]});}} className="w-full px-4 py-2 text-left text-white text-sm hover:bg-white/10 border-b border-white/5 flex items-center gap-2"><MapPin className="w-3 h-3 text-blue-400 flex-shrink-0" />{s.name}</button>))}
                </div>
              )}
            </div>
            {/* Airport shortcuts */}
            <div className="flex gap-2 mb-3">
              <button onClick={()=>{setDropoff('Flughafen Pristina');setDropoffCoords([42.5728,21.0358]);}} className="flex items-center gap-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] text-slate-300 hover:border-cyan-500/30"><Plane className="w-3 h-3" /> Flughafen</button>
              {AIRPORT_POINTS.map(p=>(<button key={p.code} onClick={()=>{setDropoff(p.label);setDropoffCoords([p.lat,p.lng]);}} className="px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] text-slate-400 hover:border-cyan-500/30">{p.label}</button>))}
            </div>
            <button onClick={fetchEstimates} disabled={loading||!dropoffCoords} className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-5 h-5" /> Preis berechnen</>}
            </button>
            {/* Recent */}
            {history.length>0 && (<div className="mt-3">{history.slice(0,2).map(r=>(<button key={r.id} onClick={()=>{if(r.dropoff){setDropoff(r.dropoff.address);setDropoffCoords([r.dropoff.lat,r.dropoff.lng]);}}} className="w-full flex items-center gap-2 py-2 border-b border-white/5 text-left"><Clock className="w-3 h-3 text-slate-600" /><span className="text-white text-xs truncate flex-1">{r.dropoff?.address}</span><span className="text-emerald-400 text-xs">{(r.final_fare||r.estimated_fare)?.toFixed(2)}{'\u20AC'}</span></button>))}</div>)}
          </div>
        </div>
      )}

      {/* VEHICLE SELECT */}
      {step === 'vehicle' && (
        <div className="fixed inset-x-0 bottom-0 z-[1500] bg-[#0a1f2e]/95 backdrop-blur-xl rounded-t-3xl border-t border-white/10">
          <div className="max-w-lg mx-auto p-5">
            <button onClick={()=>setStep('book')} className="text-cyan-400 text-sm mb-3 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Zurück</button>
            <h2 className="text-lg font-bold text-white mb-1">Fahrzeug wählen</h2>
            <p className="text-slate-400 text-xs mb-4">{estimates.standard?.distance_km} km | ~{Math.round(estimates.standard?.duration_min||0)} Min</p>
            <div className="space-y-2 mb-4">
              {VEHICLES.map(v => {
                const e = estimates[v.id];
                if(!e) return null;
                const Icon = v.icon;
                return (
                  <button key={v.id} onClick={()=>setVehicleType(v.id)} className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${vehicleType===v.id ? 'bg-white/10 border-cyan-500/50' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                    <div className={`w-12 h-12 bg-gradient-to-br ${v.color} rounded-xl flex items-center justify-center`}><Icon className="w-6 h-6 text-white" /></div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-bold text-sm">{v.label}</p>
                      <p className="text-slate-400 text-xs">{v.desc}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">{e.total_fare.toFixed(2)}{'\u20AC'}</p>
                      {e.surcharge_active && <p className="text-amber-400 text-[10px]">+Nachtzuschlag</p>}
                    </div>
                    {vehicleType===v.id && <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
            {/* Wallet check */}
            {est && walletBalance < Math.round(est.total_fare*100) && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div><p className="text-red-300 text-xs font-bold">Wallet-Guthaben zu niedrig!</p><p className="text-red-400 text-[10px]">Benötigt: {est.total_fare.toFixed(2)} EUR | Vorhanden: {(walletBalance/100).toFixed(2)} EUR</p></div>
                <button onClick={()=>navigate('/pay')} className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg flex-shrink-0">Aufladen</button>
              </div>
            )}
            <button onClick={handleBook} disabled={loading || (est && walletBalance < Math.round(est.total_fare*100))} className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-lg rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-500/20">
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Car className="w-6 h-6" /> {vehicleType.charAt(0).toUpperCase()+vehicleType.slice(1)} buchen - {est?.total_fare.toFixed(2)}{'\u20AC'}</>}
            </button>
          </div>
        </div>
      )}

      {/* SEARCHING */}
      {step === 'searching' && (
        <div className="fixed inset-x-0 bottom-0 z-[1500] bg-[#0a1f2e]/95 backdrop-blur-xl rounded-t-3xl border-t border-blue-500/30 p-6 text-center">
          <Loader2 className="w-14 h-14 text-blue-400 mx-auto mb-3 animate-spin" />
          <h2 className="text-white font-bold text-lg">Suche Fahrer...</h2>
          <p className="text-slate-400 text-sm mt-1">Bitte warten, wir finden den besten Fahrer für Sie</p>
          <div className="mt-4 flex gap-3 justify-center">
            <button onClick={handleCancel} className="px-6 py-2 bg-white/10 border border-white/20 text-slate-300 rounded-xl text-sm">Stornieren</button>
          </div>
        </div>
      )}

      {/* TRACKING */}
      {step === 'tracking' && activeRide && (
        <div className="fixed inset-x-0 bottom-0 z-[1500] bg-[#0a1f2e]/95 backdrop-blur-xl rounded-t-3xl border-t border-emerald-500/30">
          <div className="max-w-lg mx-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-emerald-400 text-xs font-bold uppercase">{STATUS[activeRide.status]||activeRide.status}</p>
                <h2 className="text-white font-bold text-lg">{activeRide.driver_name||'Wird zugewiesen...'}</h2>
                {activeRide.vehicle_type && <p className="text-slate-400 text-xs capitalize">{activeRide.vehicle_type}</p>}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{(activeRide.estimated_fare||0).toFixed(2)}{'\u20AC'}</p>
                <p className="text-xs text-slate-400">{activeRide.distance_km} km</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-3 space-y-2">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-emerald-400 rounded-full flex-shrink-0" /><span className="text-white text-sm truncate">{activeRide.pickup?.address}</span></div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-blue-400 rounded-full flex-shrink-0" /><span className="text-white text-sm truncate">{activeRide.dropoff?.address}</span></div>
            </div>
            {activeRide.surcharge_active && <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-3"><Zap className="w-4 h-4 text-amber-400" /><span className="text-amber-300 text-xs">Nachtzuschlag aktiv</span></div>}
            {['searching','assigned','accepted'].includes(activeRide.status) && (
              <button onClick={handleCancel} className="w-full py-3 bg-red-500/20 border border-red-500/30 text-red-400 font-bold rounded-xl">Stornieren</button>
            )}
          </div>
        </div>
      )}

      {/* COMPLETE */}
      {step === 'complete' && activeRide && (
        <div className="fixed inset-0 z-[2000] bg-[#061520] flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <CheckCircle className="w-20 h-20 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Angekommen!</h1>
            <p className="text-slate-400 mb-6">{activeRide.distance_km} km | {activeRide.dropoff?.address}</p>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
              <p className="text-3xl font-bold text-emerald-400 mb-1">{(activeRide.final_fare||activeRide.estimated_fare||0).toFixed(2)}{'\u20AC'}</p>
              <p className="text-slate-500 text-xs">Automatisch von Ihrem Wallet abgebucht</p>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>{setActiveRide(null);setStep('book');setEstimates({});setDropoff('');setDropoffCoords(null);}} className="flex-1 py-3 bg-white/10 border border-white/20 text-white font-bold rounded-xl">Fertig</button>
              <button onClick={()=>navigate('/taxi')} className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-xl">Neue Fahrt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
