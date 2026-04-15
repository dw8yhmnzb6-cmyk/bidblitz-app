import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, QrCode, ShoppingBag, Loader2 } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

export default function QRMenuPage({ onBack }) {
  const [restaurants, setRestaurants] = useState([]);
  const [sel, setSel] = useState(null);
  const [cart, setCart] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => { fetch(`${API}/api/qr-menu/restaurants`).then(r => r.json()).then(d => setRestaurants(d.restaurants || [])).catch(() => {}); }, []);

  const addToCart = (item) => setCart([...cart, item]);
  const total = cart.reduce((s, i) => s + i.price, 0);

  const order = async () => {
    if (!sel || !cart.length) return;
    const r = await fetch(`${API}/api/qr-menu/order`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant_id: sel.id, items: cart.map(c => c.name), table_number: 1 }) });
    const d = await r.json(); setMsg(d.message || d.detail); if (r.ok) { setCart([]); setSel(null); }
    setTimeout(() => setMsg(""), 4000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="qr-menu-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={sel ? () => { setSel(null); setCart([]); } : onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <div><h1 className="text-base font-bold flex items-center gap-2"><QrCode size={18} className="text-orange-400" /> {sel ? sel.name : "QR Menuekarte"}</h1>
            <p className="text-[10px] text-orange-400">{sel ? sel.type : "Restaurants & Speisekarten"}</p></div>
        </div>
      </div>
      <div className="px-4 pt-4 space-y-3">
        {!sel && restaurants.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => setSel(r)} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.06]" data-testid={`restaurant-${r.id}`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-lg">{r.type === "Italienisch" ? "🍕" : r.type === "Japanisch" ? "🍣" : "🍔"}</div>
              <div><p className="text-sm font-bold">{r.name}</p><p className="text-[10px] text-gray-500">{r.type} · {r.menu.length} Gerichte</p></div>
            </div>
          </motion.div>
        ))}
        {sel && (
          <>
            {Object.entries(sel.menu.reduce((g, m) => { (g[m.category] = g[m.category] || []).push(m); return g; }, {})).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{cat}</p>
                {items.map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <div><p className="text-sm font-bold">{item.name}</p><p className="text-[10px] text-gray-500">{item.price.toFixed(2)} EUR</p></div>
                    <button onClick={() => addToCart(item)} className="px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400 text-xs font-bold">+</button>
                  </motion.div>
                ))}
              </div>
            ))}
            {cart.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="fixed bottom-20 left-4 right-4 p-4 bg-[#1a1a1f] border border-orange-500/20 rounded-2xl z-40 shadow-2xl">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-bold flex items-center gap-1"><ShoppingBag size={14} /> {cart.length} Artikel</p>
                  <p className="text-lg font-black text-orange-400">{total.toFixed(2)} EUR</p>
                </div>
                <button onClick={order} className="w-full py-3 bg-orange-500 text-black rounded-xl font-bold text-sm">Bestellen</button>
              </motion.div>
            )}
          </>
        )}
      </div>
      {msg && <div className="fixed bottom-28 left-4 right-4 p-3 bg-orange-500/20 border border-orange-500/30 rounded-xl text-orange-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
