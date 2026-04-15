import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Radio, ShoppingBag, Eye, Loader2 } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

export default function LiveShoppingPage({ onBack }) {
  const [streams, setStreams] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("live");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/api/live-shopping/streams`).then(r => r.json()).then(d => setStreams(d.streams || [])).catch(() => {});
    fetch(`${API}/api/live-shopping/my-orders`, { credentials: "include" }).then(r => r.json()).then(d => setOrders(d.orders || [])).catch(() => {});
  }, []);

  const buy = async (id) => {
    const r = await fetch(`${API}/api/live-shopping/buy`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stream_id: id, quantity: 1 }) });
    const d = await r.json(); setMsg(d.message || d.detail);
    if (r.ok) fetch(`${API}/api/live-shopping/my-orders`, { credentials: "include" }).then(r => r.json()).then(d => setOrders(d.orders || []));
    setTimeout(() => setMsg(""), 4000);
  };

  const catColors = { Fashion: "#EC4899", Tech: "#3B82F6", Beauty: "#F472B6", Gaming: "#8B5CF6", Collectibles: "#F59E0B", Fitness: "#EF4444" };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="live-shopping-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <div><h1 className="text-base font-bold flex items-center gap-2"><Radio size={18} className="text-rose-400" /> Live Shopping</h1>
            <p className="text-[10px] text-rose-400">Livestream + sofort kaufen</p></div>
        </div>
        <div className="flex gap-2 mt-3">
          {[{ id: "live", label: "Live jetzt" }, { id: "orders", label: "Bestellungen" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 rounded-xl text-xs font-bold ${tab === t.id ? "bg-rose-500 text-white" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="px-4 pt-4 space-y-3">
        {tab === "live" && streams.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5" data-testid={`stream-${s.id}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-bold text-red-400">LIVE</span>
                <span className="text-[10px] text-gray-500 flex items-center gap-1"><Eye size={10} /> {s.viewers}</span>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: (catColors[s.category] || "#666") + "20", color: catColors[s.category] }}>{s.category}</span>
            </div>
            <p className="text-sm font-bold mb-1">{s.title}</p>
            <p className="text-[10px] text-gray-500 mb-3">von {s.host}</p>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02]">
              <div>
                <p className="text-xs font-bold">{s.product}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm font-black text-rose-400">{s.sale_price} EUR</p>
                  <p className="text-[10px] text-gray-500 line-through">{s.price} EUR</p>
                  <span className="text-[9px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-bold">-{s.discount}%</span>
                </div>
              </div>
              <button onClick={() => buy(s.id)} className="px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1"><ShoppingBag size={12} /> Kaufen</button>
            </div>
            <p className="text-[9px] text-gray-600 mt-2 text-right">Noch {s.stock} verfuegbar</p>
          </motion.div>
        ))}
        {tab === "orders" && orders.length === 0 && <p className="text-center text-gray-600 py-12">Keine Bestellungen</p>}
        {tab === "orders" && orders.map((o, i) => (
          <motion.div key={o.order_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between items-center">
            <div><p className="text-sm font-bold">{o.product}</p><p className="text-[10px] text-gray-500">von {o.host} · -{o.discount_pct}%</p></div>
            <p className="text-sm font-bold text-rose-400">{o.total} EUR</p>
          </motion.div>
        ))}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
