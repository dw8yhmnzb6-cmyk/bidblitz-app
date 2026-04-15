import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Car, Ticket, CreditCard, Gift, Zap, Clock, MapPin, Percent, Tag } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function CityServicesPage({ onBack }) {
  const [tab, setTab] = useState("deals");
  const [deals, setDeals] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [parking, setParking] = useState([]);
  const [giftcards, setGiftcards] = useState([]);
  const [credit, setCredit] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [creditAmount, setCreditAmount] = useState("50");

  useEffect(() => {
    fetch(`${API}/api/city/deals`, { credentials: "include" }).then(r => r.json()).then(d => setDeals(d.deals || [])).catch(() => {});
    fetch(`${API}/api/city/tickets`, { credentials: "include" }).then(r => r.json()).then(d => setTickets(d.tickets || [])).catch(() => {});
    fetch(`${API}/api/city/parking/nearby`, { credentials: "include" }).then(r => r.json()).then(d => setParking(d.spots || [])).catch(() => {});
    fetch(`${API}/api/city/giftcards`, { credentials: "include" }).then(r => r.json()).then(d => setGiftcards(d.cards || [])).catch(() => {});
    fetch(`${API}/api/city/credit/status`, { credentials: "include" }).then(r => r.json()).then(d => setCredit(d.credit)).catch(() => {});
  }, []);

  const claimDeal = async (id) => {
    try { const r = await fetch(`${API}/api/city/deals/claim/${id}`, { method: "POST", credentials: "include" }); const d = await r.json(); setMsg(d.message || d.detail); } catch { setMsg("Fehler"); }
    setTimeout(() => setMsg(""), 3000);
  };

  const buyTicket = async (id) => {
    setLoading(true);
    try { const r = await fetch(`${API}/api/city/tickets/buy`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket_id: id }) });
      const d = await r.json(); setMsg(d.message || d.detail); } catch { setMsg("Fehler"); }
    setLoading(false); setTimeout(() => setMsg(""), 3000);
  };

  const bookParking = async (id) => {
    setLoading(true);
    try { const r = await fetch(`${API}/api/city/parking/book`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spot_id: id, hours: 2 }) });
      const d = await r.json(); setMsg(d.message || d.detail); } catch { setMsg("Fehler"); }
    setLoading(false); setTimeout(() => setMsg(""), 3000);
  };

  const buyGiftcard = async (id) => {
    setLoading(true);
    try { const r = await fetch(`${API}/api/city/giftcards/buy`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ card_id: id }) });
      const d = await r.json(); setMsg(d.message || d.detail); } catch { setMsg("Fehler"); }
    setLoading(false); setTimeout(() => setMsg(""), 3000);
  };

  const applyCredit = async () => {
    setLoading(true);
    try { const r = await fetch(`${API}/api/city/credit/apply`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: parseFloat(creditAmount), installments: 4 }) });
      const d = await r.json(); setMsg(d.message || d.detail); if (r.ok) setCredit(d); } catch { setMsg("Fehler"); }
    setLoading(false); setTimeout(() => setMsg(""), 4000);
  };

  const remaining = (e) => { const d = Math.max(0, new Date(e).getTime() - Date.now()); const h = Math.floor(d/3600000); const m = Math.floor((d%3600000)/60000); return h > 0 ? `${h}h ${m}m` : `${m} Min`; };

  const tabs = [
    { id: "deals", label: "Flash Deals", icon: Zap, color: "#EF4444" },
    { id: "tickets", label: "Tickets", icon: Ticket, color: "#8B5CF6" },
    { id: "parking", label: "Parken", icon: Car, color: "#3B82F6" },
    { id: "giftcards", label: "Gutscheine", icon: Gift, color: "#F59E0B" },
    { id: "bnpl", label: "BNPL", icon: CreditCard, color: "#22C55E" },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="city-services-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <h1 className="text-base font-bold">City Services</h1>
        </div>
        <div className="flex gap-1 mt-3 overflow-x-auto scrollbar-hide">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 ${tab === t.id ? "text-black" : "bg-white/5 text-gray-400"}`}
              style={tab === t.id ? { background: t.color } : {}}>
              <t.icon size={12} />{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* FLASH DEALS */}
        {tab === "deals" && (
          <div className="space-y-3">
            {deals.map((d, i) => (
              <motion.div key={d.deal_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-bold">{d.title}</p>
                    <p className="text-[10px] text-gray-500">{d.merchant_name} · {d.category}</p>
                  </div>
                  {d.discount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500 text-white font-bold">-{d.discount}%</span>}
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {d.original_price > 0 && <span className="text-xs text-gray-500 line-through">€{d.original_price.toFixed(2)}</span>}
                    <span className="text-xl font-black text-red-400">{d.deal_price > 0 ? `€${d.deal_price.toFixed(2)}` : "GRATIS"}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 flex items-center gap-1"><Clock size={10} />{remaining(d.expires_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-gray-600">{d.claims}/{d.max_claims} eingelöst</span>
                  <button onClick={() => claimDeal(d.deal_id)} className="px-4 py-2 bg-red-500 rounded-xl font-bold text-white text-xs">Einlösen</button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* TICKETS */}
        {tab === "tickets" && (
          <div className="space-y-3">
            {tickets.map((t, i) => (
              <motion.div key={t.ticket_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold">{t.event_name}</p>
                    <p className="text-[10px] text-gray-500 flex items-center gap-1"><MapPin size={9} />{t.venue}</p>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-bold">{t.category}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-xl font-black text-purple-400">€{t.price?.toFixed(2)}</p><p className="text-[9px] text-gray-500">{t.event_date} · {t.quantity}x</p></div>
                  <button onClick={() => buyTicket(t.ticket_id)} disabled={loading} className="px-4 py-2 bg-purple-500 rounded-xl font-bold text-white text-xs disabled:opacity-50">Kaufen</button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* PARKING */}
        {tab === "parking" && (
          <div className="space-y-3">
            {parking.map((s, i) => (
              <motion.div key={s.spot_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <div className="flex items-start justify-between mb-2">
                  <div><p className="text-sm font-bold">{s.name}</p><p className="text-[10px] text-gray-500">{s.type === "indoor" ? "Parkhaus" : "Freifläche"} · {s.available_spaces} frei</p></div>
                  <span className="text-lg font-black text-blue-400">€{s.price_per_hour}/h</span>
                </div>
                <button onClick={() => bookParking(s.spot_id)} disabled={loading} className="w-full py-2.5 bg-blue-500/20 border border-blue-500/20 rounded-xl text-blue-400 font-bold text-sm disabled:opacity-50">2h buchen · €{(s.price_per_hour * 2 + 0.50).toFixed(2)}</button>
              </motion.div>
            ))}
          </div>
        )}

        {/* GIFT CARDS */}
        {tab === "giftcards" && (
          <div className="grid grid-cols-2 gap-3">
            {giftcards.map((g, i) => (
              <motion.div key={g.card_id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                <p className="text-lg font-bold">{g.brand}</p>
                <p className="text-xs text-gray-500 line-through">€{g.value?.toFixed(2)}</p>
                <p className="text-xl font-black text-yellow-400">€{g.price?.toFixed(2)}</p>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold">-{g.discount}%</span>
                <button onClick={() => buyGiftcard(g.card_id)} disabled={loading} className="w-full mt-2 py-2 bg-yellow-500/20 border border-yellow-500/20 rounded-xl text-yellow-400 font-bold text-xs disabled:opacity-50">Kaufen</button>
              </motion.div>
            ))}
          </div>
        )}

        {/* BNPL */}
        {tab === "bnpl" && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-green-500/5 border border-green-500/20 text-center">
              <CreditCard size={32} className="text-green-400 mx-auto mb-2" />
              <h2 className="text-lg font-bold">Buy Now, Pay Later</h2>
              <p className="text-xs text-gray-400 mt-1">€10-100 sofort, in 4 Raten zurückzahlen. Gebühr: €1.50</p>
            </div>
            {credit ? (
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <p className="text-sm font-bold mb-2">Aktiver Kredit</p>
                <div className="flex justify-between text-sm mb-1"><span className="text-gray-400">Betrag</span><span>€{credit.amount?.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm mb-1"><span className="text-gray-400">Rate</span><span>€{credit.per_installment?.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-400">Bezahlt</span><span>{credit.paid_installments}/{credit.installments}</span></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {[10, 25, 50, 100].map(a => (
                    <button key={a} onClick={() => setCreditAmount(String(a))}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold ${creditAmount === String(a) ? "bg-green-500 text-black" : "bg-white/5 text-gray-400"}`}>€{a}</button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 text-center">4 Raten à €{((parseFloat(creditAmount) + 1.50) / 4).toFixed(2)} · Gebühr €1.50</p>
                <button onClick={applyCredit} disabled={loading} className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-bold text-black disabled:opacity-50">
                  €{creditAmount} jetzt erhalten
                </button>
                <p className="text-[9px] text-gray-600 text-center">Nur für verifizierte User mit gutem BidBlitz Score</p>
              </div>
            )}
          </div>
        )}
      </div>

      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
