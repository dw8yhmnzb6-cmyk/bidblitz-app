import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, Heart, Tag, Plus, ShoppingBag, Eye, Filter } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const CONDITIONS = { "Neu": "#22C55E", "Wie neu": "#3B82F6", "Gut": "#F59E0B", "Akzeptabel": "#EF4444" };

export default function ResellingPage({ onBack }) {
  const [listings, setListings] = useState([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ title: "", description: "", category: "Sneakers", price: "", condition: "Neu", brand: "", size: "" });
  const [msg, setMsg] = useState("");

  const categories = ["Sneakers", "Streetwear", "Gaming", "Elektronik", "Accessoires", "Sammlerstücke"];
  const catIcons = { Sneakers: "👟", Streetwear: "👕", Gaming: "🎮", Elektronik: "📱", Accessoires: "⌚", "Sammlerstücke": "💎" };

  useEffect(() => { loadListings(); }, [category, search]);

  const loadListings = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search) params.set("search", search);
    try {
      const res = await fetch(`${API}/api/resell/listings?${params}`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setListings(d.listings || []); }
    } catch {}
    setLoading(false);
  };

  const createListing = async () => {
    if (!newItem.title || !newItem.price) return;
    try {
      const res = await fetch(`${API}/api/resell/listings`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newItem, price: parseFloat(newItem.price) }),
      });
      if (res.ok) { setMsg("Listing erstellt!"); setShowCreate(false); setNewItem({ title: "", description: "", category: "Sneakers", price: "", condition: "Neu", brand: "", size: "" }); loadListings(); }
    } catch {}
    setTimeout(() => setMsg(""), 3000);
  };

  const buyItem = async (listing) => {
    if (!window.confirm(`${listing.title} für €${listing.price.toFixed(2)} kaufen?`)) return;
    try {
      const res = await fetch(`${API}/api/resell/buy`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listing.listing_id }),
      });
      const d = await res.json();
      if (res.ok) { setMsg(d.message); setSelected(null); loadListings(); }
      else setMsg(d.detail || "Fehler");
    } catch { setMsg("Netzwerkfehler"); }
    setTimeout(() => setMsg(""), 4000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="reselling-page">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <div className="flex-1">
            <h1 className="text-base font-bold">Marktplatz</h1>
            <p className="text-[10px] text-gray-500">{listings.length} Angebote</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-xs font-bold border border-cyan-500/20" data-testid="resell-create-btn">
            <Plus size={14} className="inline mr-1" />Verkaufen
          </button>
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sneakers, Gaming, Marken..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-cyan-500/30 placeholder-gray-600" />
        </div>

        {/* Categories */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => setCategory("")} className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold ${!category ? "bg-cyan-500 text-black" : "bg-white/5 text-gray-400"}`}>Alle</button>
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c === category ? "" : c)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 ${category === c ? "bg-cyan-500 text-black" : "bg-white/5 text-gray-400"}`}>
              {catIcons[c]} {c}
            </button>
          ))}
        </div>
      </div>

      {/* Listings Grid */}
      <div className="px-4 pt-4 grid grid-cols-2 gap-3">
        {listings.map((l, i) => (
          <motion.div key={l.listing_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            onClick={() => setSelected(l)}
            className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden cursor-pointer hover:border-cyan-500/20 transition-all" data-testid={`resell-item-${l.listing_id}`}>
            <div className="h-28 bg-gradient-to-br from-white/5 to-white/[0.02] flex items-center justify-center text-4xl">
              {catIcons[l.category] || "📦"}
            </div>
            <div className="p-3">
              <p className="text-[11px] font-bold text-white truncate">{l.title}</p>
              <p className="text-[9px] text-gray-500 mt-0.5">{l.brand} · {l.size}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-black text-cyan-400">€{l.price.toFixed(2)}</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${CONDITIONS[l.condition]}20`, color: CONDITIONS[l.condition] }}>{l.condition}</span>
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[9px] text-gray-600">
                <span className="flex items-center gap-0.5"><Eye size={9} />{l.views}</span>
                <span className="flex items-center gap-0.5"><Heart size={9} />{l.likes}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end" onClick={() => setSelected(null)}>
            <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} className="w-full bg-[#111] rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
              <div className="h-40 bg-white/5 rounded-2xl flex items-center justify-center text-6xl mb-4">{catIcons[selected.category] || "📦"}</div>
              <h2 className="text-xl font-black">{selected.title}</h2>
              <p className="text-gray-400 text-sm mt-1">{selected.brand} {selected.size && `· Größe ${selected.size}`}</p>
              <p className="text-3xl font-black text-cyan-400 mt-3">€{selected.price.toFixed(2)}</p>
              <div className="flex gap-2 mt-3">
                <span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: `${CONDITIONS[selected.condition]}20`, color: CONDITIONS[selected.condition] }}>{selected.condition}</span>
                <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-400">{selected.views} Aufrufe</span>
                <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-400">Von {selected.seller_name}</span>
              </div>
              {selected.description && <p className="text-sm text-gray-400 mt-4">{selected.description}</p>}
              <button onClick={() => buyItem(selected)} className="w-full mt-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-bold text-black text-base" data-testid="resell-buy-btn">
                <ShoppingBag size={18} className="inline mr-2" />Jetzt kaufen · €{selected.price.toFixed(2)}
              </button>
              <p className="text-[9px] text-gray-600 text-center mt-2">8% Plattform-Gebühr inkl. · Wallet-Zahlung</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end" onClick={() => setShowCreate(false)}>
            <motion.div initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }} className="w-full bg-[#111] rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-4">Artikel verkaufen</h2>
              <div className="space-y-3">
                <input value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} placeholder="Titel (z.B. Nike Air Max 90)"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-cyan-500/30" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} placeholder="Preis €" type="number"
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-cyan-500/30" />
                  <input value={newItem.brand} onChange={e => setNewItem({...newItem, brand: e.target.value})} placeholder="Marke"
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-cyan-500/30" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none text-white">
                    {categories.map(c => <option key={c} value={c} className="bg-[#111]">{c}</option>)}
                  </select>
                  <select value={newItem.condition} onChange={e => setNewItem({...newItem, condition: e.target.value})}
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none text-white">
                    {Object.keys(CONDITIONS).map(c => <option key={c} value={c} className="bg-[#111]">{c}</option>)}
                  </select>
                </div>
                <input value={newItem.size} onChange={e => setNewItem({...newItem, size: e.target.value})} placeholder="Größe (optional)"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-cyan-500/30" />
                <textarea value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} placeholder="Beschreibung..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-cyan-500/30 h-20 resize-none" />
                <button onClick={createListing} className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-bold text-black" data-testid="resell-submit-btn">
                  <Tag size={18} className="inline mr-2" />Jetzt einstellen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 text-sm text-center font-medium z-50">{msg}</div>}
    </div>
  );
}
