/**
 * Taxi Profile - Fahrtenbuch, Favoriten, Profil (like taxi.eu)
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Car, Clock, Euro, MapPin, Home, Briefcase, Star, ChevronRight,
  User, CreditCard, Heart, Settings, Phone, FileText, ArrowLeft,
  Plus, X, Loader2, Trash2
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function TaxiProfile() {
  const { token, user } = useAuth();
  const [tab, setTab] = useState('home'); // home, history, places, addPlace
  const [history, setHistory] = useState([]);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPlace, setNewPlace] = useState({ label: '', address: '', lat: 42.663, lng: 21.165 });
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    Promise.all([
      axios.get(`${API}/taxi/history`, { headers }).then(r => setHistory(r.data.rides || [])),
      axios.get(`${API}/taxi/places/my`, { headers }).then(r => setPlaces(r.data.places || []))
    ]).finally(() => setLoading(false));
  }, [token]);

  const savePlace = async () => {
    if (!newPlace.label || !newPlace.address) { toast.error('Bitte Name und Adresse eingeben'); return; }
    try {
      await axios.post(`${API}/taxi/places/save`, newPlace, { headers });
      toast.success(`'${newPlace.label}' gespeichert`);
      setNewPlace({ label: '', address: '', lat: 42.663, lng: 21.165 });
      setTab('places');
      const r = await axios.get(`${API}/taxi/places/my`, { headers });
      setPlaces(r.data.places || []);
    } catch (e) { toast.error(e.response?.data?.detail || 'Fehler'); }
  };

  const deletePlace = async (label) => {
    try {
      await axios.delete(`${API}/taxi/places/${encodeURIComponent(label)}`, { headers });
      setPlaces(places.filter(p => p.label !== label));
      toast.success('Gelöscht');
    } catch (e) { toast.error('Fehler'); }
  };

  const ICON_MAP = { home: Home, work: Briefcase, star: Star };

  if (loading) return <div className="min-h-screen bg-[#061520] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>;

  return (
    <div className="min-h-screen bg-[#061520] pb-24" data-testid="taxi-profile">
      {/* Header */}
      <div className="bg-gradient-to-b from-slate-800 to-[#061520] px-4 pt-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <Link to="/taxi" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"><ArrowLeft className="w-5 h-5 text-white" /></Link>
          <h1 className="text-white font-bold">Mein Taxi</h1>
          <Link to="/profile" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"><User className="w-5 h-5 text-white" /></Link>
        </div>
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 text-2xl font-bold text-white">{user?.name?.charAt(0) || '?'}</div>
          <h2 className="text-white font-bold text-lg">{user?.name}</h2>
          <p className="text-slate-400 text-sm">{user?.email}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 px-4 -mt-2 mb-4">
        <Link to="/taxi" className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-center gap-2 text-white text-sm font-medium">
          <Car className="w-4 h-4 text-cyan-400" /> Taxi buchen
        </Link>
        <button onClick={() => setTab('history')} className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-center gap-2 text-white text-sm font-medium">
          <Clock className="w-4 h-4 text-amber-400" /> Fahrtenbuch
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 px-4 mb-4">
        {[{ id: 'home', l: 'Übersicht' }, { id: 'history', l: 'Fahrten' }, { id: 'places', l: 'Orte' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-3 text-sm font-medium text-center ${tab === t.id ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-500'}`}>{t.l}</button>
        ))}
      </div>

      <div className="px-4 max-w-lg mx-auto">
        {/* HOME */}
        {tab === 'home' && (
          <div className="space-y-3">
            {/* Saved Places Quick Access */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-white font-bold text-sm mb-3">Gespeicherte Orte</h3>
              {places.length === 0 ? (
                <p className="text-slate-500 text-sm">Noch keine Orte gespeichert</p>
              ) : places.slice(0, 3).map(p => {
                const Icon = ICON_MAP[p.icon] || Star;
                return (
                  <Link key={p.label} to={`/taxi?dest=${encodeURIComponent(p.address)}&lat=${p.lat}&lng=${p.lng}`}
                    className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <Icon className="w-5 h-5 text-cyan-400" />
                    <div className="flex-1"><p className="text-white text-sm font-medium">{p.label}</p><p className="text-slate-500 text-xs truncate">{p.address}</p></div>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </Link>
                );
              })}
              <button onClick={() => setTab('addPlace')} className="mt-2 flex items-center gap-2 text-cyan-400 text-sm font-medium"><Plus className="w-4 h-4" /> Ort hinzufügen</button>
            </div>

            {/* Menu */}
            <div className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
              {[
                { icon: User, label: 'Mein Profil', to: '/profile' },
                { icon: CreditCard, label: 'Zahlungsmittel', to: '/pay' },
                { icon: Heart, label: 'Favoriten', action: () => setTab('places') },
                { icon: Settings, label: 'Einstellungen', to: '/profile' },
              ].map((item, i) => (
                <Link key={i} to={item.to || '#'} onClick={item.action} className="flex items-center gap-3 px-4 py-3.5">
                  <item.icon className="w-5 h-5 text-slate-400" />
                  <span className="flex-1 text-white text-sm">{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </Link>
              ))}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
              <a href="tel:+38344123456" className="flex items-center gap-3 px-4 py-3.5">
                <Phone className="w-5 h-5 text-slate-400" /><span className="flex-1 text-white text-sm">Zentrale anrufen</span><ChevronRight className="w-4 h-4 text-slate-600" />
              </a>
              <Link to="/support-tickets" className="flex items-center gap-3 px-4 py-3.5">
                <FileText className="w-5 h-5 text-slate-400" /><span className="flex-1 text-white text-sm">Support</span><ChevronRight className="w-4 h-4 text-slate-600" />
              </Link>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="text-center py-12"><Clock className="w-12 h-12 text-slate-700 mx-auto mb-3" /><p className="text-slate-500">Noch keine Fahrten</p></div>
            ) : history.map(r => (
              <div key={r.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex justify-between mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : r.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>{r.status}</span>
                  <span className="text-slate-500 text-xs">{new Date(r.requested_at).toLocaleDateString('de-DE')}</span>
                </div>
                <div className="space-y-1 mb-2">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-400 rounded-full" /><span className="text-white text-sm truncate">{r.pickup?.address}</span></div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 bg-blue-400 rounded-full" /><span className="text-white text-sm truncate">{r.dropoff?.address}</span></div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <div className="flex gap-3 text-xs text-slate-400">
                    <span>{r.distance_km} km</span>
                    <span className="capitalize">{r.vehicle_type}</span>
                    {r.driver_name && <span>{r.driver_name}</span>}
                  </div>
                  <span className="font-bold text-emerald-400">{(r.final_fare || r.estimated_fare || 0).toFixed(2)} EUR</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PLACES */}
        {tab === 'places' && (
          <div className="space-y-2">
            <button onClick={() => setTab('addPlace')} className="w-full bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 flex items-center gap-3 text-cyan-400 font-medium">
              <Plus className="w-5 h-5" /> Neuen Ort speichern
            </button>
            {places.map(p => {
              const Icon = ICON_MAP[p.icon] || Star;
              return (
                <div key={p.label} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                  <Icon className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0"><p className="text-white font-medium text-sm">{p.label}</p><p className="text-slate-500 text-xs truncate">{p.address}</p></div>
                  <button onClick={() => deletePlace(p.label)} className="p-2 hover:bg-white/10 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                </div>
              );
            })}
            {places.length === 0 && <p className="text-center text-slate-500 py-8">Keine gespeicherten Orte</p>}
          </div>
        )}

        {/* ADD PLACE */}
        {tab === 'addPlace' && (
          <div className="space-y-4">
            <button onClick={() => setTab('places')} className="text-cyan-400 text-sm flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Zurück</button>
            <h3 className="text-white font-bold">Ort speichern</h3>
            <div className="flex gap-2 mb-3">
              {[{ l: 'Zuhause', i: 'home' }, { l: 'Arbeit', i: 'work' }].map(q => (
                <button key={q.l} onClick={() => setNewPlace({ ...newPlace, label: q.l, icon: q.i })} className={`px-4 py-2 rounded-xl text-sm font-medium border ${newPlace.label === q.l ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>{q.l}</button>
              ))}
            </div>
            <div>
              <label className="text-xs text-slate-400">Name</label>
              <input value={newPlace.label} onChange={e => setNewPlace({ ...newPlace, label: e.target.value })} placeholder="z.B. Zuhause, Arbeit, Gym" className="w-full mt-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Adresse</label>
              <input value={newPlace.address} onChange={e => setNewPlace({ ...newPlace, address: e.target.value })} placeholder="Straße, Stadt" className="w-full mt-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30" />
            </div>
            <button onClick={savePlace} className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl">Speichern</button>
          </div>
        )}
      </div>
    </div>
  );
}
