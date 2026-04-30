import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Home, Search, MapPin, Star } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ApartmentsPage({ onNavigate }) {
  const [apartments, setApartments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [cityFilter, setCityFilter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { search(); /* eslint-disable-next-line */ }, []);

  const search = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cityFilter) params.set('city', cityFilter);
      const r = await fetch(`${API}/api/apartments/search?${params}`);
      if (r.ok) setApartments((await r.json()).apartments || []);
    } catch {}
    setLoading(false);
  };

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);
  const [bookMsg, setBookMsg] = useState(null);

  const book = async () => {
    if (!selected || !checkIn || !checkOut) return;
    setBookMsg(null);
    try {
      const r = await fetch(`${API}/api/apartments/book`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apartment_id: selected.apartment_id, check_in: new Date(checkIn).toISOString(), check_out: new Date(checkOut).toISOString(), guests }),
      });
      const d = await r.json();
      if (r.ok) setBookMsg({ ok: true, text: `Gebucht! €${d.total} · ${d.nights} Nächte` });
      else setBookMsg({ ok: false, text: d.detail || 'Fehler' });
    } catch { setBookMsg({ ok: false, text: 'Netzwerkfehler' }); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24" data-testid="apartments-page">
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => selected ? setSelected(null) : (onNavigate && onNavigate('/more'))} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"><ArrowLeft size={16} /></button>
          <h1 className="text-lg font-bold flex-1">{selected ? selected.title : 'Apartments'}</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        {!selected ? (
          <>
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input data-testid="apt-city-search" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
                  placeholder="Stadt suchen..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-rose-500/30 text-sm" />
              </div>
              <button data-testid="apt-search-btn" onClick={search} className="px-4 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-sm">Suchen</button>
            </div>
            {loading && <div className="text-center py-8 text-white/30">Lädt...</div>}
            <div className="space-y-3">
              {apartments.map((a) => (
                <motion.button key={a.apartment_id} data-testid={`apt-card-${a.apartment_id}`} onClick={() => setSelected(a)}
                  whileTap={{ scale: 0.98 }} className="w-full rounded-2xl overflow-hidden bg-[#111] border border-white/10 text-left">
                  <div className="aspect-video bg-gradient-to-br from-rose-900/30 to-orange-900/30 relative">
                    {(a.images || [])[0] ? <img src={a.images[0]} alt={a.title} className="w-full h-full object-cover" /> : <Home size={40} className="absolute inset-0 m-auto text-white/10" />}
                  </div>
                  <div className="p-3">
                    <p className="font-bold">{a.title}</p>
                    <div className="flex items-center gap-1 text-xs text-white/40 mt-1">
                      <MapPin size={10} /> {a.city}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-white/50">{a.property_type} · {a.max_guests} Gäste</span>
                      <span className="text-rose-400 font-bold">€{a.price_per_night}<span className="text-xs text-white/40 ml-0.5">/Nacht</span></span>
                    </div>
                  </div>
                </motion.button>
              ))}
              {!loading && apartments.length === 0 && <div className="py-12 text-center text-white/30"><Home size={32} className="mx-auto mb-3 text-white/10" />Keine Apartments gefunden</div>}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="aspect-video rounded-2xl overflow-hidden bg-[#111]">
              {(selected.images || [])[0] ? <img src={selected.images[0]} alt={selected.title} className="w-full h-full object-cover" /> : <Home size={60} className="m-auto mt-20 text-white/10" />}
            </div>
            <div>
              <h2 className="text-2xl font-black">{selected.title}</h2>
              <p className="text-sm text-white/50 flex items-center gap-1 mt-1"><MapPin size={12} /> {selected.city}, {selected.country}</p>
              <p className="text-rose-400 font-bold mt-2">€{selected.price_per_night}<span className="text-xs text-white/40 ml-1">/ Nacht</span></p>
            </div>
            {selected.description && <p className="text-sm text-white/60">{selected.description}</p>}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-white/40">Anreise</label>
                  <input data-testid="apt-checkin" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-white/40">Abreise</label>
                  <input data-testid="apt-checkout" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40">Gäste</label>
                <input data-testid="apt-guests" type="number" min={1} max={selected.max_guests} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-full mt-1 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />
              </div>
              {bookMsg && <div className={`p-3 rounded-lg text-sm font-semibold ${bookMsg.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{bookMsg.text}</div>}
              <button data-testid="apt-book-btn" onClick={book} disabled={!checkIn || !checkOut} className="w-full py-3 rounded-xl bg-rose-500 font-bold text-white disabled:opacity-30">
                Jetzt buchen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
