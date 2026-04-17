import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft, Search, Zap, Star, Clock, Shield, TrendingUp,
  ChevronRight, Package, CheckCircle, Loader2, ExternalLink,
  Hash, BarChart3, ListOrdered, RefreshCw,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const api = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...opts });
  const d = await res.json();
  if (!res.ok) throw new Error(d.detail || `Error ${res.status}`);
  return d;
};

const PLATFORM_STYLES = {
  instagram: { color: "#E1306C", bg: "rgba(225,48,108,0.1)", label: "Instagram" },
  tiktok: { color: "#00F2EA", bg: "rgba(0,242,234,0.1)", label: "TikTok" },
  youtube: { color: "#FF0000", bg: "rgba(255,0,0,0.1)", label: "YouTube" },
  twitter: { color: "#1DA1F2", bg: "rgba(29,161,242,0.1)", label: "Twitter/X" },
  telegram: { color: "#0088CC", bg: "rgba(0,136,204,0.1)", label: "Telegram" },
  spotify: { color: "#1DB954", bg: "rgba(29,185,84,0.1)", label: "Spotify" },
  facebook: { color: "#1877F2", bg: "rgba(24,119,242,0.1)", label: "Facebook" },
  linkedin: { color: "#0A66C2", bg: "rgba(10,102,194,0.1)", label: "LinkedIn" },
  threads: { color: "#999999", bg: "rgba(153,153,153,0.1)", label: "Threads" },
};

const BlitzBoostPage = ({ onNavigate, onBack }) => {
  const [tab, setTab] = useState("services");
  const [services, setServices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [platform, setPlatform] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [dripFeed, setDripFeed] = useState(false);
  const [dripRuns, setDripRuns] = useState(5);
  const [ordering, setOrdering] = useState(false);
  const [result, setResult] = useState(null);

  const loadServices = useCallback(async () => {
    try {
      const p = platform ? `?platform=${platform}` : "";
      const d = await api(`/api/smm/services${p}`);
      setServices(d.services || []);
    } catch {}
  }, [platform]);

  const loadOrders = useCallback(async () => {
    try {
      const d = await api("/api/smm/orders");
      setOrders(d.orders || []);
    } catch {}
  }, []);

  useEffect(() => { loadServices(); }, [loadServices]);
  useEffect(() => { if (tab === "orders") loadOrders(); }, [tab, loadOrders]);

  const calcPrice = () => {
    if (!selected || !quantity) return 0;
    return Math.round((parseInt(quantity) || 0) / 1000 * selected.price_per_1k * (dripFeed ? dripRuns : 1) * 100) / 100;
  };

  const handleOrder = async () => {
    if (!selected || !quantity || !targetUrl) { toast.error("Bitte alle Felder ausfuellen"); return; }
    const qty = parseInt(quantity);
    if (qty < selected.min_qty) { toast.error(`Mindestmenge: ${selected.min_qty}`); return; }
    if (qty > selected.max_qty) { toast.error(`Maximalmenge: ${selected.max_qty.toLocaleString("de-DE")}`); return; }

    setOrdering(true);
    try {
      const d = await api("/api/smm/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: selected.id,
          target_url: targetUrl,
          quantity: qty,
          drip_feed: dripFeed,
          drip_feed_runs: dripFeed ? dripRuns : 1,
          drip_feed_interval_min: 60,
        }),
      });
      setResult(d);
      toast.success(d.message);
    } catch (e) {
      toast.error(e.message);
    }
    setOrdering(false);
  };

  const filtered = services.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.type.toLowerCase().includes(search.toLowerCase())
  );

  const platforms = Object.entries(PLATFORM_STYLES);

  const statusColor = { pending: "#F59E0B", processing: "#00C2FF", completed: "#10B981", partial: "#8B5CF6", cancelled: "#EF4444" };

  return (
    <div className="min-h-screen pb-24" style={{ background: "#030303" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3" style={{ background: "rgba(3,3,3,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack || (() => onNavigate("/"))} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
          <ChevronLeft size={16} className="text-white/60" />
        </motion.button>
        <div className="flex-1">
          <h1 className="text-[15px] font-bold text-white flex items-center gap-2">
            <TrendingUp size={14} className="text-[#E1306C]" /> BlitzBoost
          </h1>
          <p className="text-[10px] text-white/30">Social Media Booster — Follower, Likes, Views</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 flex gap-2">
        {[
          { id: "services", label: "Services", icon: Zap },
          { id: "orders", label: "Bestellungen", icon: ListOrdered },
        ].map(t => (
          <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => { setTab(t.id); setResult(null); setSelected(null); }}
            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5"
            style={{ background: tab === t.id ? "rgba(225,48,108,0.12)" : "rgba(255,255,255,0.04)", color: tab === t.id ? "#E1306C" : "rgba(255,255,255,0.4)", border: `1px solid ${tab === t.id ? "rgba(225,48,108,0.2)" : "rgba(255,255,255,0.06)"}` }}
          >
            <t.icon size={12} /> {t.label}
          </motion.button>
        ))}
      </div>

      <div className="px-4 pt-3">
        {/* Services Tab */}
        {tab === "services" && !selected && !result && (
          <div className="space-y-3">
            {/* Platform Filter */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setPlatform("")}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap shrink-0"
                style={{ background: !platform ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)", color: !platform ? "#fff" : "rgba(255,255,255,0.3)" }}
              >Alle</motion.button>
              {platforms.map(([key, p]) => (
                <motion.button key={key} whileTap={{ scale: 0.9 }} onClick={() => setPlatform(key)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap shrink-0"
                  style={{ background: platform === key ? p.bg : "rgba(255,255,255,0.04)", color: platform === key ? p.color : "rgba(255,255,255,0.3)", border: `1px solid ${platform === key ? `${p.color}30` : "transparent"}` }}
                >{p.label}</motion.button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
              <input className="w-full pl-9 pr-3 py-2.5 rounded-xl text-[12px] text-white placeholder:text-white/20"
                style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
                placeholder="Service suchen..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* Service List */}
            {filtered.map((s, i) => {
              const ps = PLATFORM_STYLES[s.platform] || {};
              return (
                <motion.button key={s.id} className="w-full text-left rounded-2xl p-3" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
                  whileTap={{ scale: 0.98 }} onClick={() => { setSelected(s); setQuantity(String(s.min_qty)); }}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  data-testid={`service-${s.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: ps.bg }}>
                      <TrendingUp size={18} style={{ color: ps.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-white">{s.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: ps.bg, color: ps.color }}>{ps.label}</span>
                        <span className="text-[9px] text-white/25">{s.quality}</span>
                        <span className="text-[9px] text-white/25 flex items-center gap-0.5"><Clock size={8} /> {s.delivery_time}</span>
                        {s.refill && <span className="text-[9px] text-emerald-400 flex items-center gap-0.5"><Shield size={8} /> Refill</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-bold" style={{ color: ps.color }}>EUR {s.price_per_1k}</p>
                      <p className="text-[8px] text-white/20">pro 1.000</p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Order Form */}
        {tab === "services" && selected && !result && (
          <motion.div className="space-y-4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSelected(null)} className="text-[11px] text-white/40 flex items-center gap-1">
              <ChevronLeft size={12} /> Zurueck zu Services
            </motion.button>

            {/* Service Header */}
            <div className="rounded-2xl p-4" style={{ background: PLATFORM_STYLES[selected.platform]?.bg, border: `1px solid ${PLATFORM_STYLES[selected.platform]?.color}20` }}>
              <p className="text-[15px] font-bold text-white">{selected.name}</p>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-white/40">
                <span>{selected.quality} Qualitaet</span>
                <span><Clock size={10} className="inline" /> {selected.delivery_time}</span>
                {selected.refill && <span className="text-emerald-400"><Shield size={10} className="inline" /> Refill-Garantie</span>}
              </div>
              <p className="text-[18px] font-bold mt-2" style={{ color: PLATFORM_STYLES[selected.platform]?.color }}>EUR {selected.price_per_1k} <span className="text-[11px] text-white/30">/ 1.000</span></p>
            </div>

            {/* Target URL */}
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">Link / URL</label>
              <input className="w-full px-4 py-3 rounded-xl text-[12px] text-white placeholder:text-white/20"
                style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
                placeholder="https://instagram.com/dein_profil" value={targetUrl} onChange={e => setTargetUrl(e.target.value)}
                data-testid="smm-target-url" />
            </div>

            {/* Quantity */}
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">Menge ({selected.min_qty.toLocaleString()} - {selected.max_qty.toLocaleString()})</label>
              <input className="w-full px-4 py-3 rounded-xl text-[12px] text-white placeholder:text-white/20"
                style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
                type="number" min={selected.min_qty} max={selected.max_qty}
                placeholder={`z.B. ${selected.quantity}`} value={quantity} onChange={e => setQuantity(e.target.value)}
                data-testid="smm-quantity" />
              {/* Quick quantity buttons */}
              <div className="flex gap-1.5 mt-2">
                {[selected.min_qty, 500, 1000, 5000, 10000].filter(q => q >= selected.min_qty && q <= selected.max_qty).map(q => (
                  <motion.button key={q} whileTap={{ scale: 0.9 }} onClick={() => setQuantity(String(q))}
                    className="px-2.5 py-1 rounded-lg text-[9px] font-bold"
                    style={{ background: parseInt(quantity) === q ? "rgba(225,48,108,0.15)" : "rgba(255,255,255,0.04)", color: parseInt(quantity) === q ? "#E1306C" : "rgba(255,255,255,0.3)" }}
                  >{q >= 1000 ? `${q/1000}K` : q}</motion.button>
                ))}
              </div>
            </div>

            {/* Drip Feed */}
            <div className="rounded-xl p-3" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-white">Drip-Feed</p>
                  <p className="text-[9px] text-white/30">Schrittweise Lieferung fuer natuerliches Wachstum</p>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setDripFeed(!dripFeed)}
                  className="w-10 h-6 rounded-full flex items-center px-0.5"
                  style={{ background: dripFeed ? "#E1306C" : "rgba(255,255,255,0.1)" }}
                >
                  <motion.div className="w-5 h-5 rounded-full bg-white" animate={{ x: dripFeed ? 16 : 0 }} transition={{ type: "spring", stiffness: 500 }} />
                </motion.button>
              </div>
              {dripFeed && (
                <div className="mt-2 pt-2 flex items-center gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  <span className="text-[10px] text-white/40">Durchlaeufe:</span>
                  {[3, 5, 10, 20].map(r => (
                    <motion.button key={r} whileTap={{ scale: 0.9 }} onClick={() => setDripRuns(r)}
                      className="px-2 py-1 rounded text-[10px] font-bold"
                      style={{ background: dripRuns === r ? "rgba(225,48,108,0.15)" : "rgba(255,255,255,0.04)", color: dripRuns === r ? "#E1306C" : "rgba(255,255,255,0.3)" }}
                    >{r}x</motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Price Summary */}
            <div className="rounded-xl p-4" style={{ background: "rgba(225,48,108,0.05)", border: "1px solid rgba(225,48,108,0.15)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/50">Gesamt</span>
                <span className="text-[20px] font-bold text-[#E1306C]">EUR {calcPrice().toFixed(2)}</span>
              </div>
              <p className="text-[9px] text-white/25 mt-1">
                {parseInt(quantity || 0).toLocaleString("de-DE")}x {selected.name} {dripFeed ? `(${dripRuns}x Drip-Feed = ${(parseInt(quantity || 0) * dripRuns).toLocaleString("de-DE")} gesamt)` : ""}
              </p>
            </div>

            {/* Order Button */}
            <motion.button data-testid="smm-order-btn" className="w-full py-4 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 text-white"
              style={{ background: "linear-gradient(135deg, #E1306C, #C13584)", boxShadow: "0 4px 24px rgba(225,48,108,0.3)" }}
              whileTap={{ scale: 0.97 }} onClick={handleOrder} disabled={ordering}
            >
              {ordering ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              Jetzt bestellen — EUR {calcPrice().toFixed(2)}
            </motion.button>
          </motion.div>
        )}

        {/* Order Success */}
        {result && (
          <motion.div className="text-center py-8 space-y-4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <motion.div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
              <CheckCircle size={28} className="text-emerald-400" />
            </motion.div>
            <h2 className="text-[18px] font-bold text-white">Bestellung aufgegeben!</h2>
            <p className="text-[12px] text-white/40">{result.message}</p>
            <div className="rounded-xl p-3 text-left" style={{ background: "#0A0A0A" }}>
              <div className="flex justify-between py-1"><span className="text-[10px] text-white/30">Order ID</span><span className="text-[10px] font-mono text-[#E1306C]">{result.order_id}</span></div>
              <div className="flex justify-between py-1"><span className="text-[10px] text-white/30">Service</span><span className="text-[10px] text-white/60">{result.service}</span></div>
              <div className="flex justify-between py-1"><span className="text-[10px] text-white/30">Menge</span><span className="text-[10px] text-white/60">{result.quantity?.toLocaleString("de-DE")}</span></div>
              <div className="flex justify-between py-1"><span className="text-[10px] text-white/30">Lieferung</span><span className="text-[10px] text-white/60">{result.delivery_time}</span></div>
              <div className="flex justify-between py-1"><span className="text-[10px] text-white/30">Neues Guthaben</span><span className="text-[10px] text-emerald-400">EUR {result.new_balance?.toFixed(2)}</span></div>
            </div>
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setResult(null); setSelected(null); setTargetUrl(""); }}
                className="flex-1 py-3 rounded-xl text-[12px] font-bold" style={{ background: "rgba(225,48,108,0.1)", color: "#E1306C" }}>
                Neue Bestellung
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setResult(null); setSelected(null); setTab("orders"); }}
                className="flex-1 py-3 rounded-xl text-[12px] font-bold" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)" }}>
                Bestellungen
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Orders Tab */}
        {tab === "orders" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-white/40">{orders.length} Bestellungen</p>
              <motion.button whileTap={{ scale: 0.9 }} onClick={loadOrders}><RefreshCw size={14} className="text-white/30" /></motion.button>
            </div>
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <Package size={32} className="mx-auto mb-3 text-white/10" />
                <p className="text-[13px] text-white/30">Noch keine Bestellungen</p>
              </div>
            ) : orders.map((o, i) => {
              const ps = PLATFORM_STYLES[o.platform] || {};
              return (
                <motion.div key={o.order_id} className="rounded-2xl p-3" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-white">{o.service_name}</p>
                      <p className="text-[9px] text-white/25 truncate mt-0.5">{o.target_url}</p>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${statusColor[o.status] || "#666"}15`, color: statusColor[o.status] || "#666" }}>
                      {o.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[9px] text-white/30">
                    <span className="font-mono">{o.order_id}</span>
                    <span>{o.total_quantity?.toLocaleString("de-DE")}x</span>
                    <span className="font-bold" style={{ color: ps.color }}>EUR {o.total_price?.toFixed(2)}</span>
                    <span>{new Date(o.created_at).toLocaleDateString("de-DE")}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlitzBoostPage;
