/**
 * BidBlitz V2 - Paketversand
 * Preisvergleich + Buchung + Tracking
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Package, Truck, MapPin, Scale, Loader2, Check,
  Search, ChevronRight, Box
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const ParcelPage = ({ onBack }) => {
  const [view, setView] = useState("quote"); // quote | results | book | tracking | parcels
  const [weight, setWeight] = useState("2");
  const [length, setLength] = useState("30");
  const [width, setWidth] = useState("20");
  const [height, setHeight] = useState("15");
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState(null);
  const [myParcels, setMyParcels] = useState([]);

  // Booking form
  const [sName, setSName] = useState("");
  const [sAddr, setSAddr] = useState("");
  const [sZip, setSZip] = useState("");
  const [sCity, setSCity] = useState("");
  const [rName, setRName] = useState("");
  const [rAddr, setRAddr] = useState("");
  const [rZip, setRZip] = useState("");
  const [rCity, setRCity] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookResult, setBookResult] = useState(null);
  const [error, setError] = useState("");

  // Tracking
  const [trackNum, setTrackNum] = useState("");
  const [trackResult, setTrackResult] = useState(null);
  const [trackError, setTrackError] = useState("");

  useEffect(() => {
    fetch(`${API}/api/parcels/my-parcels`, { credentials: "include" }).then(r => r.json()).then(d => setMyParcels(d.parcels || [])).catch(() => {});
  }, []);

  const getQuotes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/parcels/quote`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight: parseFloat(weight), length: parseFloat(length), width: parseFloat(width), height: parseFloat(height) }),
      });
      if (res.ok) { const d = await res.json(); setQuotes(d.quotes || []); setView("results"); }
    } catch {}
    setLoading(false);
  };

  const bookParcel = async () => {
    if (!selectedCarrier || !rName || !rCity) return;
    setBooking(true); setError("");
    try {
      const res = await fetch(`${API}/api/parcels/book`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrier_id: selectedCarrier.carrier_id, weight: parseFloat(weight), sender_name: sName, sender_address: sAddr, sender_zip: sZip, sender_city: sCity, recipient_name: rName, recipient_address: rAddr, recipient_zip: rZip, recipient_city: rCity }),
      });
      const d = await res.json();
      if (res.ok && d.ok) { setBookResult(d.parcel); setMyParcels(prev => [d.parcel, ...prev]); }
      else setError(d.detail || "Fehler");
    } catch { setError("Netzwerkfehler"); }
    setBooking(false);
  };

  const track = async () => {
    if (!trackNum) return;
    setTrackError("");
    try {
      const res = await fetch(`${API}/api/parcels/track/${trackNum}`);
      const d = await res.json();
      if (res.ok) setTrackResult(d);
      else setTrackError(d.detail || "Nicht gefunden");
    } catch { setTrackError("Fehler"); }
  };

  const CARRIER_COLORS = { dhl: "#FFCC00", hermes: "#00A0E1", dpd: "#DC0032", ups: "#351C15", gls: "#003DA5" };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="parcel-page">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10"><ArrowLeft size={18} /></motion.button>
            <h1 className="text-[15px] font-bold">Paketversand</h1>
          </div>
        </div>
        <div className="flex gap-1.5 mt-3">
          {[
            { id: "quote", label: "Versenden" },
            { id: "tracking", label: "Tracking" },
            { id: "parcels", label: "Meine Pakete" },
          ].map(t => (
            <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => { setView(t.id); setBookResult(null); }}
              className={`flex-1 py-2 rounded-xl text-[10px] font-medium ${["quote","results","book"].includes(view) && t.id === "quote" ? "bg-[#F97316] text-white" : view === t.id ? "bg-[#F97316] text-white" : "bg-white/5 text-gray-500"}`}>
              {t.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Quote Form */}
      {view === "quote" && (
        <div className="p-4 space-y-3">
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4 space-y-3">
            <h3 className="text-sm font-bold">Paketmaße</h3>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[9px] text-gray-500">Gewicht (kg)</label><input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" /></div>
              <div><label className="text-[9px] text-gray-500">Länge (cm)</label><input type="number" value={length} onChange={e => setLength(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" /></div>
              <div><label className="text-[9px] text-gray-500">Breite (cm)</label><input type="number" value={width} onChange={e => setWidth(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" /></div>
              <div><label className="text-[9px] text-gray-500">Höhe (cm)</label><input type="number" value={height} onChange={e => setHeight(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" /></div>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={getQuotes} disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#F97316] text-white font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2" data-testid="parcel-quote-btn">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <><Scale size={16} /> Preise vergleichen</>}
            </motion.button>
          </div>
        </div>
      )}

      {/* Quote Results */}
      {view === "results" && (
        <div className="p-4 space-y-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setView("quote")} className="text-xs text-[#F97316] font-medium flex items-center gap-1"><ArrowLeft size={14} /> Maße ändern</motion.button>
          <p className="text-[10px] text-gray-500">{weight}kg Paket — {quotes.length} Anbieter</p>
          {quotes.map((q, i) => (
            <motion.div key={q.carrier_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => { setSelectedCarrier(q); setView("book"); setBookResult(null); setError(""); }}
              className="bg-[#111118] rounded-2xl border border-white/5 p-4 cursor-pointer hover:border-white/10 flex items-center justify-between"
              data-testid={`carrier-${q.carrier_id}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-black text-black" style={{ background: CARRIER_COLORS[q.carrier_id] || "#666" }}>
                  {q.carrier_name.slice(0, 3)}
                </div>
                <div>
                  <p className="text-[13px] font-bold">{q.carrier_name}</p>
                  <p className="text-[10px] text-gray-500">{q.delivery_days} Werktage</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-[#F97316]">€{q.price.toFixed(2)}</p>
                <ChevronRight size={14} className="text-gray-500 ml-auto" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Book Form */}
      {view === "book" && !bookResult && selectedCarrier && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setView("results")} className="text-xs text-[#F97316] font-medium flex items-center gap-1"><ArrowLeft size={14} /> Zurück</motion.button>
            <span className="text-sm font-bold text-[#F97316]">{selectedCarrier.carrier_name} — €{selectedCarrier.price.toFixed(2)}</span>
          </div>
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4 space-y-2">
            <p className="text-[10px] text-gray-400 font-semibold">Absender</p>
            <input value={sName} onChange={e => setSName(e.target.value)} placeholder="Name" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
            <input value={sAddr} onChange={e => setSAddr(e.target.value)} placeholder="Adresse" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <input value={sZip} onChange={e => setSZip(e.target.value)} placeholder="PLZ" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
              <input value={sCity} onChange={e => setSCity(e.target.value)} placeholder="Stadt" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
            </div>
          </div>
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4 space-y-2">
            <p className="text-[10px] text-gray-400 font-semibold">Empfänger</p>
            <input value={rName} onChange={e => setRName(e.target.value)} placeholder="Name *" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" data-testid="parcel-recipient" />
            <input value={rAddr} onChange={e => setRAddr(e.target.value)} placeholder="Adresse" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <input value={rZip} onChange={e => setRZip(e.target.value)} placeholder="PLZ" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
              <input value={rCity} onChange={e => setRCity(e.target.value)} placeholder="Stadt *" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
            </div>
          </div>
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          <motion.button whileTap={{ scale: 0.97 }} onClick={bookParcel} disabled={!rName || !rCity || booking}
            className="w-full py-3.5 rounded-xl bg-[#F97316] text-white font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2" data-testid="parcel-book-btn">
            {booking ? <Loader2 size={18} className="animate-spin" /> : <><Truck size={16} /> €{selectedCarrier.price.toFixed(2)} versenden</>}
          </motion.button>
        </div>
      )}

      {bookResult && (
        <div className="p-4">
          <div className="bg-[#111118] rounded-2xl border border-[#10B981]/20 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#10B981]/10 border-2 border-[#10B981] flex items-center justify-center mx-auto mb-4"><Check size={32} className="text-[#10B981]" /></div>
            <h3 className="text-lg font-bold mb-1">Paket gebucht!</h3>
            <p className="text-sm text-gray-400">{bookResult.carrier_name} — {bookResult.weight}kg</p>
            <div className="mt-2 p-3 rounded-xl bg-white/[0.03] border border-white/5"><p className="text-xs font-mono text-[#F97316]">{bookResult.tracking_number}</p><p className="text-[9px] text-gray-500">Sendungsnummer</p></div>
            <p className="text-xl font-bold text-[#F97316] mt-2">€{bookResult.price?.toFixed(2)}</p>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setView("parcels"); setBookResult(null); }}
              className="mt-4 w-full py-3 rounded-xl bg-white/5 text-white font-medium text-sm">Meine Pakete</motion.button>
          </div>
        </div>
      )}

      {/* Tracking */}
      {view === "tracking" && (
        <div className="p-4 space-y-3">
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4 space-y-3">
            <h3 className="text-sm font-bold">Sendungsverfolgung</h3>
            <div className="flex gap-2">
              <input value={trackNum} onChange={e => setTrackNum(e.target.value)} placeholder="Sendungsnummer eingeben"
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" data-testid="tracking-input" />
              <motion.button whileTap={{ scale: 0.9 }} onClick={track} className="px-4 py-3 rounded-xl bg-[#F97316] text-white font-bold text-xs"><Search size={16} /></motion.button>
            </div>
            {trackError && <p className="text-xs text-red-400">{trackError}</p>}
          </div>
          {trackResult && (
            <div className="bg-[#111118] rounded-2xl border border-white/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold">{trackResult.carrier_name}</p>
                <span className="text-[9px] px-2 py-0.5 rounded bg-[#F97316]/10 text-[#F97316] font-medium">{trackResult.status?.replace("_", " ")}</span>
              </div>
              <p className="text-[10px] font-mono text-gray-500 mb-3">{trackResult.tracking_number}</p>
              {(trackResult.tracking_events || []).map((e, i) => (
                <div key={i} className="flex gap-3 mb-2">
                  <div className="flex flex-col items-center"><div className="w-2 h-2 rounded-full bg-[#F97316]" />{i < (trackResult.tracking_events.length - 1) && <div className="w-px h-6 bg-white/10" />}</div>
                  <div><p className="text-[11px] text-white">{e.message}</p><p className="text-[9px] text-gray-500">{new Date(e.timestamp).toLocaleString("de-DE")}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Parcels */}
      {view === "parcels" && (
        <div className="p-4 space-y-3">
          {myParcels.length === 0 ? (
            <div className="text-center py-16"><Package size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">Keine Pakete</p></div>
          ) : myParcels.map((p, i) => (
            <motion.div key={p.parcel_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-[#111118] rounded-2xl border border-white/5 p-3.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[12px] font-bold">{p.carrier_name} — {p.weight}kg</p>
                <span className="text-[9px] px-2 py-0.5 rounded bg-[#F97316]/10 text-[#F97316] font-medium">{p.status?.replace("_", " ")}</span>
              </div>
              <p className="text-[10px] text-gray-500">→ {p.recipient_name}, {p.recipient_city}</p>
              <div className="flex items-center justify-between mt-1"><span className="text-[9px] font-mono text-gray-600">{p.tracking_number}</span><span className="text-sm font-bold text-[#F97316]">€{p.price?.toFixed(2)}</span></div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ParcelPage;
