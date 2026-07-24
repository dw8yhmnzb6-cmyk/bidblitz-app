/**
 * BidBlitz V2 - Crypto Wallet Page
 * BTC/ETH/USDT portfolio with live prices, buy/sell via EUR wallet
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, TrendingUp, TrendingDown, Loader2, RefreshCw,
  ArrowUpRight, ArrowDownRight, X, Wallet, BarChart3
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const CryptoWalletPage = ({ onBack }) => {
  const [tab, setTab] = useState("portfolio"); // portfolio | prices | history
  const [prices, setPrices] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tradeModal, setTradeModal] = useState(null); // { symbol, side }
  const [tradeAmount, setTradeAmount] = useState("");
  const [trading, setTrading] = useState(false);
  const [balance, setBalance] = useState(0);

  const load = useCallback(async () => {
    try {
      const [p, pf, t, u] = await Promise.all([
        fetch(`${API}/api/crypto/prices`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/api/crypto/portfolio`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/api/crypto/transactions`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/api/auth/me`, { credentials: "include" }).then(r => r.json()),
      ]);
      setPrices(p.prices || []);
      setPortfolio(pf.portfolio || []);
      setTotalValue(pf.total_value_eur || 0);
      setTxns(t.transactions || []);
      setBalance(u.balance || 0);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const executeTrade = async () => {
    if (!tradeModal || !tradeAmount || parseFloat(tradeAmount) <= 0) return;
    setTrading(true);
    try {
      const res = await fetch(`${API}/api/crypto/trade`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: tradeModal.symbol, amount_eur: parseFloat(tradeAmount), side: tradeModal.side }),
      });
      const d = await res.json();
      if (res.ok) {
        setBalance(d.new_balance);
        setTradeModal(null);
        setTradeAmount("");
        load();
      } else {
        alert(d.detail || "Fehler");
      }
    } catch { alert("Fehler"); }
    setTrading(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-[#F7931A]" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="crypto-wallet-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
              className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="crypto-back">
              <ArrowLeft size={18} />
            </motion.button>
            <div>
              <h1 className="text-[15px] font-bold">Krypto Wallet</h1>
              <p className="text-[10px] text-gray-500">Kaufen, Verkaufen, Halten</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#00C2FF]/10 text-[10px] text-[#00C2FF] font-semibold">
              <Wallet size={10} /> €{balance.toFixed(2)}
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={load}
              className="p-2 rounded-xl bg-white/5 border border-white/10">
              <RefreshCw size={14} className="text-white/40" />
            </motion.button>
          </div>
        </div>

        {/* Portfolio value card */}
        <div className="px-4 pb-3">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#F7931A]/10 to-[#627EEA]/5 border border-[#F7931A]/20">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Portfolio Wert</p>
            <p className="text-2xl font-black text-white">€{totalValue.toFixed(2)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pb-3">
          {[{ id: "portfolio", label: "Portfolio" }, { id: "prices", label: "Kurse" }, { id: "history", label: "Verlauf" }].map(t => (
            <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-medium ${tab === t.id ? "bg-[#F7931A] text-black" : "bg-white/5 text-[#888]"}`}
              data-testid={`crypto-tab-${t.id}`}>
              {t.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {tab === "portfolio" && (
          <div className="space-y-3">
            {portfolio.length === 0 ? (
              <div className="text-center py-16">
                <BarChart3 size={48} className="mx-auto text-[#333] mb-4" />
                <p className="text-white/70 font-semibold">Kein Krypto-Bestand</p>
                <p className="text-xs text-gray-500 mt-1">Wechsle zu "Kurse" um deine erste Kryptowährung zu kaufen.</p>
              </div>
            ) : portfolio.map((h, i) => (
              <motion.div key={h.symbol} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-[#111118] rounded-2xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black"
                      style={{ background: `${h.color}20`, color: h.color }}>
                      {h.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{h.name}</p>
                      <p className="text-[10px] text-gray-500">{h.amount.toFixed(6)} {h.symbol}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">€{h.value_eur.toFixed(2)}</p>
                    <p className={`text-[10px] font-medium ${h.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {h.pnl >= 0 ? "+" : ""}€{h.pnl.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => setTradeModal({ symbol: h.symbol, side: "buy" })}
                    className="flex-1 py-2 rounded-xl bg-green-500/10 text-green-400 text-xs font-semibold flex items-center justify-center gap-1">
                    <ArrowDownRight size={12} /> Kaufen
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => setTradeModal({ symbol: h.symbol, side: "sell" })}
                    className="flex-1 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs font-semibold flex items-center justify-center gap-1">
                    <ArrowUpRight size={12} /> Verkaufen
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {tab === "prices" && (
          <div className="space-y-2">
            {prices.map((p, i) => (
              <motion.div key={p.symbol} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-[#111118] rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black"
                    style={{ background: `${p.color}20`, color: p.color }}>
                    {p.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{p.name}</p>
                    <p className="text-[10px] text-gray-500">{p.symbol}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">€{p.price_eur.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</p>
                  <div className={`flex items-center gap-0.5 text-[10px] font-medium ${p.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {p.change_24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {p.change_24h >= 0 ? "+" : ""}{p.change_24h.toFixed(2)}%
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }}
                  onClick={() => setTradeModal({ symbol: p.symbol, side: "buy" })}
                  className="ml-3 px-3 py-2 rounded-xl bg-[#F7931A]/10 text-[#F7931A] text-xs font-semibold"
                  data-testid={`buy-${p.symbol}`}>
                  Kaufen
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-2">
            {txns.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 text-sm">Keine Transaktionen</p>
              </div>
            ) : txns.map((t, i) => (
              <div key={t.id || i} className="bg-[#111118] rounded-xl p-3 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${t.side === "buy" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                    {t.side === "buy" ? <ArrowDownRight size={14} className="text-green-400" /> : <ArrowUpRight size={14} className="text-red-400" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{t.side === "buy" ? "Kauf" : "Verkauf"} {t.symbol}</p>
                    <p className="text-[10px] text-gray-500">{t.created_at?.slice(0, 10)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold">€{t.eur_amount?.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500">{t.crypto_amount?.toFixed(6)} {t.symbol}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trade Modal — Bottom Sheet (above nav) */}
      <AnimatePresence>
        {tradeModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={() => setTradeModal(null)}>
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-[#111118] rounded-2xl border border-white/10 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">{tradeModal.side === "buy" ? "Kaufen" : "Verkaufen"} {tradeModal.symbol}</h3>
                <button onClick={() => setTradeModal(null)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X size={18} className="text-gray-400" /></button>
              </div>

              {/* Current price */}
              <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-xs text-gray-500">Aktueller Preis</span>
                <span className="text-sm font-bold text-white">€{prices.find(p => p.symbol === tradeModal.symbol)?.price_eur?.toLocaleString("de-DE") || "—"}</span>
              </div>

              <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider">Betrag in EUR</p>
              <input type="number" value={tradeAmount} onChange={e => setTradeAmount(e.target.value)}
                placeholder="0.00" autoFocus inputMode="decimal"
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-2xl font-bold text-center outline-none focus:border-[#F7931A]/50 mb-3 text-white"
                data-testid="trade-amount" />

              <div className="flex gap-2 mb-4">
                {["10", "25", "50", "100", "250"].map(a => (
                  <motion.button key={a} whileTap={{ scale: 0.95 }} onClick={() => setTradeAmount(a)}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all ${tradeAmount === a ? "bg-[#F7931A] text-black" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>
                    €{a}
                  </motion.button>
                ))}
              </div>

              {/* Estimated crypto amount */}
              {tradeAmount && parseFloat(tradeAmount) > 0 && (
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[10px] text-gray-500">Du erhältst ca.</span>
                  <span className="text-xs font-mono text-white">{(parseFloat(tradeAmount) / (prices.find(p => p.symbol === tradeModal.symbol)?.price_eur || 1)).toFixed(6)} {tradeModal.symbol}</span>
                </div>
              )}

              <div className="flex items-center justify-between mb-4 p-3 rounded-xl" style={{ background: "rgba(0,194,255,0.06)", border: "1px solid rgba(0,194,255,0.12)" }}>
                <div className="flex items-center gap-2"><Wallet size={14} style={{ color: "#00C2FF" }} /><span className="text-xs text-gray-400">BidBlitz Wallet</span></div>
                <span className="text-sm font-bold" style={{ color: "#00C2FF" }}>€{balance.toFixed(2)}</span>
              </div>

              <div className="text-center text-[9px] text-gray-600 mb-3">Simulierte Preise · Keine echte Börse</div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={executeTrade}
                disabled={!tradeAmount || parseFloat(tradeAmount) <= 0 || trading}
                className={`w-full py-3.5 rounded-xl font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2 ${
                  tradeModal.side === "buy" ? "bg-green-500 text-black" : "bg-red-500 text-white"
                }`} data-testid="confirm-trade">
                {trading ? <Loader2 size={18} className="animate-spin" /> :
                  tradeModal.side === "buy" ? `${tradeModal.symbol} kaufen` : `${tradeModal.symbol} verkaufen`}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CryptoWalletPage;
