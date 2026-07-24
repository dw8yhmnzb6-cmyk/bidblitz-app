import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, TrendingUp, TrendingDown, Star, Wallet, ChevronRight, X, ArrowUpRight, ArrowDownRight, BarChart3, PieChart, Clock, Eye } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

export default function StocksPage({ onBack }) {
  const [assets, setAssets] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [watchlist, setWatchlist] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [tab, setTab] = useState("market");
  const [selected, setSelected] = useState(null);
  const [tradeModal, setTradeModal] = useState(null);
  const [shares, setShares] = useState("");
  const [trading, setTrading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [trades, setTrades] = useState([]);

  useEffect(() => { loadMarket(); loadPortfolio(); loadWatchlist(); loadBalance(); }, [typeFilter]);
  useEffect(() => { if (tab === "trades") loadTrades(); }, [tab]);

  const loadMarket = async () => { try { const p = typeFilter ? `?type=${typeFilter}` : ""; const r = await fetch(`${API}/api/stocks/market${p}`); if (r.ok) { const d = await r.json(); setAssets(d.assets || []); } } catch {} setLoading(false); };
  const loadPortfolio = async () => { try { const r = await fetch(`${API}/api/stocks/portfolio`, { credentials: "include" }); if (r.ok) setPortfolio(await r.json()); } catch {} };
  const loadWatchlist = async () => { try { const r = await fetch(`${API}/api/stocks/watchlist`, { credentials: "include" }); if (r.ok) { const d = await r.json(); setWatchlist(new Set((d.watchlist || []).map(w => w.symbol))); } } catch {} };
  const loadBalance = async () => { try { const r = await fetch(`${API}/api/auth/me`, { credentials: "include" }); if (r.ok) { const d = await r.json(); setBalance(d.balance || 0); } } catch {} };
  const loadTrades = async () => { try { const r = await fetch(`${API}/api/stocks/trades`, { credentials: "include" }); if (r.ok) { const d = await r.json(); setTrades(d.trades || []); } } catch {} };

  const toggleWatch = async (sym) => { try { await fetch(`${API}/api/stocks/watchlist/toggle`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: sym }) }); setWatchlist(p => { const n = new Set(p); n.has(sym) ? n.delete(sym) : n.add(sym); return n; }); } catch {} };

  const executeTrade = async () => {
    if (!tradeModal || !shares || parseFloat(shares) <= 0) return;
    setTrading(true);
    try {
      const r = await fetch(`${API}/api/stocks/trade`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: tradeModal.symbol, shares: parseFloat(shares), side: tradeModal.side }) });
      if (r.ok) { const d = await r.json(); setBalance(d.new_balance); setTradeModal(null); setShares(""); loadPortfolio(); loadMarket(); alert(`${d.side === "buy" ? "Gekauft" : "Verkauft"}: ${d.shares}x ${d.symbol} für ${d.total}€`); }
      else { const e = await r.json(); alert(e.detail || "Fehler"); }
    } catch {} setTrading(false);
  };

  const filtered = assets.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.symbol.toLowerCase().includes(search.toLowerCase()));

  // ═══ ASSET DETAIL ═══
  if (selected) { const a = selected; const isPos = a.change_pct >= 0; return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg-primary,#030303)" }}>
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => setSelected(null)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--bg-card,#111)" }} data-testid="stock-back2"><ArrowLeft size={20} style={{ color: "var(--text-primary,#fff)" }} /></button>
        <div className="flex-1"><h1 className="text-base font-bold" style={{ color: "var(--text-primary,#fff)" }}>{a.symbol}</h1><p className="text-xs" style={{ color: "var(--text-secondary,#888)" }}>{a.name}</p></div>
        <button onClick={() => toggleWatch(a.symbol)} data-testid="stock-watch"><Star size={20} className={watchlist.has(a.symbol) ? "text-yellow-400 fill-yellow-400" : "text-gray-600"} /></button>
      </div>
      <div className="px-4 space-y-4">
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold" style={{ color: "var(--text-primary,#fff)" }}>{a.price?.toFixed(2)}€</span>
          <span className={`text-sm font-semibold flex items-center gap-1 ${isPos ? "text-green-400" : "text-red-400"}`}>{isPos ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{isPos ? "+" : ""}{a.change_pct}%</span>
        </div>
        {/* Mini Chart */}
        {a.chart && (<div className="h-32 rounded-xl overflow-hidden" style={{ background: "var(--bg-card,#111)" }}>
          <svg viewBox="0 0 300 100" className="w-full h-full" preserveAspectRatio="none">
            <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={isPos ? "#10B981" : "#EF4444"} stopOpacity="0.3" /><stop offset="100%" stopColor={isPos ? "#10B981" : "#EF4444"} stopOpacity="0" /></linearGradient></defs>
            {(() => { const pts = a.chart; const minP = Math.min(...pts.map(p => p.price)); const maxP = Math.max(...pts.map(p => p.price)); const range = maxP - minP || 1;
              const points = pts.map((p, i) => `${(i / (pts.length - 1)) * 300},${100 - ((p.price - minP) / range) * 90}`).join(" ");
              return (<><polyline fill="none" stroke={isPos ? "#10B981" : "#EF4444"} strokeWidth="2" points={points} /><polygon fill="url(#cg)" points={`0,100 ${points} 300,100`} /></>); })()}
          </svg>
        </div>)}
        <div className="grid grid-cols-2 gap-3">
          {[{ l: "Volumen", v: a.volume ? `${(a.volume / 1e6).toFixed(1)}M` : "—" }, { l: "Market Cap", v: a.market_cap ? `${(a.market_cap / 1e9).toFixed(1)}B€` : "—" }, { l: "KGV", v: a.pe_ratio || "—" }, { l: "Dividende", v: a.dividend_yield ? `${a.dividend_yield}%` : "—" }, { l: "52W Hoch", v: a.high_52w ? `${a.high_52w}€` : "—" }, { l: "52W Tief", v: a.low_52w ? `${a.low_52w}€` : "—" }].map((item, i) => (
            <div key={i} className="p-3 rounded-xl" style={{ background: "var(--bg-card,#111)" }}><div className="text-[10px]" style={{ color: "var(--text-secondary,#888)" }}>{item.l}</div><div className="text-sm font-semibold" style={{ color: "var(--text-primary,#fff)" }}>{item.v}</div></div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTradeModal({ symbol: a.symbol, side: "buy", price: a.price })} className="flex-1 py-3 rounded-xl font-semibold text-sm text-black bg-green-500" data-testid="stock-buy"><ArrowUpRight size={16} className="inline mr-1" />Kaufen</button>
          <button onClick={() => setTradeModal({ symbol: a.symbol, side: "sell", price: a.price })} className="flex-1 py-3 rounded-xl font-semibold text-sm text-white bg-red-500" data-testid="stock-sell"><ArrowDownRight size={16} className="inline mr-1" />Verkaufen</button>
        </div>
      </div>
    </div>
  ); }

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg-primary,#030303)" }}>
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{ background: "var(--bg-primary,#030303)" }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--bg-card,#111)" }} data-testid="stock-back"><ArrowLeft size={20} style={{ color: "var(--text-primary,#fff)" }} /></button>
          <div className="flex-1"><h1 className="text-lg font-bold" style={{ color: "var(--text-primary,#fff)" }}>Aktien & ETFs</h1><p className="text-[10px]" style={{ color: "var(--text-secondary,#888)" }}>Handeln mit BidBlitz Wallet</p></div>
          <div className="text-right"><div className="text-xs font-bold" style={{ color: "#00C2FF" }}>{balance.toFixed(2)}€</div><div className="text-[9px]" style={{ color: "var(--text-secondary,#888)" }}>Guthaben</div></div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl mb-3" style={{ background: "var(--bg-card,#111)" }}>
          {[{ id: "market", label: "Markt", icon: BarChart3 }, { id: "portfolio", label: "Portfolio", icon: PieChart }, { id: "watchlist", label: "Watchlist", icon: Eye }, { id: "trades", label: "Orders", icon: Clock }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-medium transition-all" data-testid={`stock-tab-${t.id}`}
              style={{ background: tab === t.id ? "#00C2FF" : "transparent", color: tab === t.id ? "#000" : "var(--text-secondary,#888)" }}><t.icon size={12} />{t.label}</button>
          ))}
        </div>
        {tab === "market" && (<>
          <div className="relative mb-3"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary,#666)" }} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Aktie oder ETF suchen..." className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm" style={{ background: "var(--bg-card,#111)", color: "var(--text-primary,#fff)", border: "1px solid rgba(255,255,255,0.06)" }} data-testid="stock-search" /></div>
          <div className="flex gap-2">{[{ id: "", label: "Alle" }, { id: "stock", label: "Aktien" }, { id: "etf", label: "ETFs" }].map(t => (<button key={t.id} onClick={() => setTypeFilter(t.id)} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: typeFilter === t.id ? "#00C2FF" : "var(--bg-card,#111)", color: typeFilter === t.id ? "#000" : "var(--text-secondary,#aaa)" }} data-testid={`stock-type-${t.id || "all"}`}>{t.label}</button>))}</div>
        </>)}
      </div>

      <div className="px-4 space-y-2">
        {/* ═══ MARKET ═══ */}
        {tab === "market" && (loading ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#00C2FF", borderTopColor: "transparent" }} /></div> : filtered.map(a => {
          const isPos = a.change_pct >= 0;
          return (
            <motion.div key={a.symbol} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ background: "var(--bg-card,#111)", border: "1px solid rgba(255,255,255,0.04)" }}
              onClick={async () => { try { const r = await fetch(`${API}/api/stocks/asset/${a.symbol}`); if (r.ok) setSelected(await r.json()); } catch { setSelected(a); } }} data-testid={`stock-${a.symbol}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: isPos ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)" }}>
                <span className="text-xs font-bold" style={{ color: isPos ? "#10B981" : "#EF4444" }}>{a.symbol.slice(0, 2)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary,#fff)" }}>{a.symbol}</div>
                <div className="text-[10px] truncate" style={{ color: "var(--text-secondary,#888)" }}>{a.name}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold" style={{ color: "var(--text-primary,#fff)" }}>{a.price?.toFixed(2)}€</div>
                <div className={`text-[10px] font-medium ${isPos ? "text-green-400" : "text-red-400"}`}>{isPos ? "+" : ""}{a.change_pct?.toFixed(2)}%</div>
              </div>
              <button onClick={e => { e.stopPropagation(); toggleWatch(a.symbol); }} className="shrink-0"><Star size={16} className={watchlist.has(a.symbol) ? "text-yellow-400 fill-yellow-400" : "text-gray-700"} /></button>
            </motion.div>
          );
        }))}

        {/* ═══ PORTFOLIO ═══ */}
        {tab === "portfolio" && portfolio && (<div className="space-y-3">
          <div className="rounded-xl p-4" style={{ background: "linear-gradient(135deg, rgba(0,194,255,0.08), rgba(16,185,129,0.05))", border: "1px solid rgba(0,194,255,0.15)" }}>
            <div className="text-xs" style={{ color: "var(--text-secondary,#888)" }}>Portfolio-Wert</div>
            <div className="text-2xl font-bold mt-1" style={{ color: "var(--text-primary,#fff)" }}>{portfolio.total_value.toFixed(2)}€</div>
            <div className={`text-sm font-medium mt-1 ${portfolio.total_pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{portfolio.total_pnl >= 0 ? "+" : ""}{portfolio.total_pnl.toFixed(2)}€</div>
          </div>
          {(portfolio.holdings || []).length === 0 ? (<div className="text-center py-10"><PieChart size={40} className="mx-auto mb-3" style={{ color: "var(--text-secondary,#444)" }} /><p className="text-sm" style={{ color: "var(--text-secondary,#888)" }}>Noch keine Positionen</p><button onClick={() => setTab("market")} className="text-xs mt-2" style={{ color: "#00C2FF" }}>Jetzt investieren</button></div>
          ) : (portfolio.holdings || []).map(h => (
            <div key={h.symbol} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-card,#111)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: h.pnl >= 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)" }}><span className="text-xs font-bold" style={{ color: h.pnl >= 0 ? "#10B981" : "#EF4444" }}>{h.symbol.slice(0, 2)}</span></div>
              <div className="flex-1"><div className="text-sm font-semibold" style={{ color: "var(--text-primary,#fff)" }}>{h.symbol}</div><div className="text-[10px]" style={{ color: "var(--text-secondary,#888)" }}>{h.shares} Anteile · EK {h.avg_price}€</div></div>
              <div className="text-right"><div className="text-sm font-bold" style={{ color: "var(--text-primary,#fff)" }}>{h.value?.toFixed(2)}€</div><div className={`text-[10px] ${h.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{h.pnl >= 0 ? "+" : ""}{h.pnl?.toFixed(2)}€ ({h.pnl_pct?.toFixed(1)}%)</div></div>
            </div>
          ))}
        </div>)}

        {/* ═══ WATCHLIST ═══ */}
        {tab === "watchlist" && (watchlist.size === 0 ? <div className="text-center py-16"><Star size={40} className="mx-auto mb-3" style={{ color: "var(--text-secondary,#444)" }} /><p className="text-sm" style={{ color: "var(--text-secondary,#888)" }}>Watchlist leer</p></div> :
          assets.filter(a => watchlist.has(a.symbol)).map(a => {
            const isPos = a.change_pct >= 0;
            return (<div key={a.symbol} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-card,#111)" }}>
              <div className="flex-1"><div className="text-sm font-semibold" style={{ color: "var(--text-primary,#fff)" }}>{a.symbol} <span className="text-[10px] font-normal" style={{ color: "var(--text-secondary,#888)" }}>{a.name}</span></div></div>
              <div className="text-sm font-bold" style={{ color: "var(--text-primary,#fff)" }}>{a.price?.toFixed(2)}€</div>
              <span className={`text-[10px] ${isPos ? "text-green-400" : "text-red-400"}`}>{isPos ? "+" : ""}{a.change_pct?.toFixed(2)}%</span>
              <button onClick={() => toggleWatch(a.symbol)}><Star size={14} className="text-yellow-400 fill-yellow-400" /></button>
            </div>);
          })
        )}

        {/* ═══ TRADES ═══ */}
        {tab === "trades" && (trades.length === 0 ? <div className="text-center py-16"><Clock size={40} className="mx-auto mb-3" style={{ color: "var(--text-secondary,#444)" }} /><p className="text-sm" style={{ color: "var(--text-secondary,#888)" }}>Noch keine Trades</p></div> :
          trades.map(t => (
            <div key={t.trade_id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-card,#111)" }}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.side === "buy" ? "bg-green-500/15" : "bg-red-500/15"}`}>{t.side === "buy" ? <ArrowUpRight size={14} className="text-green-400" /> : <ArrowDownRight size={14} className="text-red-400" />}</div>
              <div className="flex-1"><div className="text-xs font-semibold" style={{ color: "var(--text-primary,#fff)" }}>{t.side === "buy" ? "Kauf" : "Verkauf"} {t.symbol}</div><div className="text-[10px]" style={{ color: "var(--text-secondary,#888)" }}>{t.shares}x @ {t.price}€ · {new Date(t.created_at).toLocaleDateString("de-DE")}</div></div>
              <div className="text-sm font-bold" style={{ color: t.side === "buy" ? "#EF4444" : "#10B981" }}>{t.side === "buy" ? "-" : "+"}{t.total?.toFixed(2)}€</div>
            </div>
          ))
        )}
      </div>

      {/* ═══ TRADE MODAL ═══ */}
      <AnimatePresence>{tradeModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4" onClick={() => setTradeModal(null)}>
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} onClick={e => e.stopPropagation()} className="w-full max-w-sm bg-[#111118] rounded-2xl border border-white/10 p-5">
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-white">{tradeModal.side === "buy" ? "Kaufen" : "Verkaufen"} {tradeModal.symbol}</h3><button onClick={() => setTradeModal(null)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X size={16} className="text-gray-400" /></button></div>
            <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-white/[0.03]"><span className="text-xs text-gray-500">Kurs</span><span className="text-sm font-bold text-white">{tradeModal.price?.toFixed(2)}€</span></div>
            <p className="text-[10px] text-gray-500 mb-1 uppercase">Anzahl Anteile</p>
            <input type="number" value={shares} onChange={e => setShares(e.target.value)} placeholder="0" autoFocus inputMode="decimal" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xl font-bold text-center outline-none mb-3 text-white" data-testid="stock-shares" />
            <div className="flex gap-2 mb-3">{["1", "5", "10", "25"].map(a => (<button key={a} onClick={() => setShares(a)} className={`flex-1 py-2 rounded-xl text-[11px] font-bold ${shares === a ? "bg-[#00C2FF] text-black" : "bg-white/5 text-white/50"}`}>{a}x</button>))}</div>
            {shares && parseFloat(shares) > 0 && (<div className="flex items-center justify-between mb-3 px-1"><span className="text-[10px] text-gray-500">Gesamt</span><span className="text-sm font-bold text-white">{(parseFloat(shares) * tradeModal.price).toFixed(2)}€</span></div>)}
            <div className="flex items-center justify-between mb-4 p-3 rounded-xl" style={{ background: "rgba(0,194,255,0.06)", border: "1px solid rgba(0,194,255,0.12)" }}><div className="flex items-center gap-2"><Wallet size={14} style={{ color: "#00C2FF" }} /><span className="text-xs text-gray-400">BidBlitz Wallet</span></div><span className="text-sm font-bold" style={{ color: "#00C2FF" }}>{balance.toFixed(2)}€</span></div>
            <button onClick={executeTrade} disabled={!shares || parseFloat(shares) <= 0 || trading} className={`w-full py-3.5 rounded-xl font-bold text-sm disabled:opacity-30 ${tradeModal.side === "buy" ? "bg-green-500 text-black" : "bg-red-500 text-white"}`} data-testid="stock-confirm">{trading ? "..." : tradeModal.side === "buy" ? `${tradeModal.symbol} kaufen` : `${tradeModal.symbol} verkaufen`}</button>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}
