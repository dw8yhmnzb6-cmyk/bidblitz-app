/**
 * BidBlitz V2 - Currency Converter Page
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpDown, Loader2, RefreshCw, Globe } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const FLAGS = {
  us: "\u{1F1FA}\u{1F1F8}", gb: "\u{1F1EC}\u{1F1E7}", tr: "\u{1F1F9}\u{1F1F7}", ch: "\u{1F1E8}\u{1F1ED}",
  jp: "\u{1F1EF}\u{1F1F5}", ca: "\u{1F1E8}\u{1F1E6}", au: "\u{1F1E6}\u{1F1FA}", se: "\u{1F1F8}\u{1F1EA}",
  no: "\u{1F1F3}\u{1F1F4}", dk: "\u{1F1E9}\u{1F1F0}", pl: "\u{1F1F5}\u{1F1F1}", cz: "\u{1F1E8}\u{1F1FF}",
  hu: "\u{1F1ED}\u{1F1FA}", ro: "\u{1F1F7}\u{1F1F4}", bg: "\u{1F1E7}\u{1F1EC}", rs: "\u{1F1F7}\u{1F1F8}",
  ba: "\u{1F1E7}\u{1F1E6}", mk: "\u{1F1F2}\u{1F1F0}", al: "\u{1F1E6}\u{1F1F1}",
};

const CurrencyConverterPage = ({ onBack }) => {
  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("100");
  const [fromCur, setFromCur] = useState("EUR");
  const [toCur, setToCur] = useState("USD");
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/currency/rates`);
        if (res.ok) { const d = await res.json(); setRates(d.rates || {}); }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const convert = async () => {
    try {
      const res = await fetch(`${API}/api/currency/convert?amount=${amount}&from_currency=${fromCur}&to_currency=${toCur}`);
      if (res.ok) setResult(await res.json());
    } catch {}
  };

  useEffect(() => { if (amount && fromCur && toCur) convert(); }, [amount, fromCur, toCur]);

  const swap = () => { setFromCur(toCur); setToCur(fromCur); };
  const allCurrencies = ["EUR", ...Object.keys(rates)];

  if (loading) return <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center"><Loader2 size={32} className="animate-spin text-[#10B981]" /></div>;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="currency-page">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10"><ArrowLeft size={18} /></motion.button>
          <div><h1 className="text-[15px] font-bold">Währungsrechner</h1><p className="text-[10px] text-gray-500">{Object.keys(rates).length} Währungen</p></div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Converter Card */}
        <div className="bg-[#111118] rounded-2xl p-5 border border-white/5">
          {/* From */}
          <div className="mb-3">
            <p className="text-[10px] text-gray-500 mb-1.5">Von</p>
            <div className="flex gap-2">
              <select value={fromCur} onChange={e => setFromCur(e.target.value)}
                className="px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold outline-none w-24" data-testid="from-currency">
                {allCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xl font-bold text-right outline-none" data-testid="convert-amount" />
            </div>
          </div>

          {/* Swap */}
          <div className="flex justify-center my-2">
            <motion.button whileTap={{ scale: 0.9, rotate: 180 }} onClick={swap}
              className="w-10 h-10 rounded-full bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center" data-testid="swap-btn">
              <ArrowUpDown size={18} className="text-[#10B981]" />
            </motion.button>
          </div>

          {/* To */}
          <div>
            <p className="text-[10px] text-gray-500 mb-1.5">Nach</p>
            <div className="flex gap-2">
              <select value={toCur} onChange={e => setToCur(e.target.value)}
                className="px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold outline-none w-24" data-testid="to-currency">
                {allCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex-1 px-4 py-3 rounded-xl bg-[#10B981]/5 border border-[#10B981]/20 text-xl font-bold text-right text-[#10B981]">
                {result ? result.result.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
              </div>
            </div>
          </div>

          {/* Rate */}
          {result && (
            <p className="text-center text-[10px] text-gray-500 mt-3">
              1 {fromCur} = {result.rate?.toFixed(4)} {toCur}
            </p>
          )}
        </div>

        {/* Popular Rates */}
        <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-3"><Globe size={16} className="text-[#10B981]" /><h3 className="text-sm font-bold">Wechselkurse (1 EUR =)</h3></div>
          <div className="space-y-1.5">
            {Object.entries(rates).map(([code, info]) => (
              <motion.button key={code} whileTap={{ scale: 0.98 }} onClick={() => { setFromCur("EUR"); setToCur(code); }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.03] transition-colors" data-testid={`rate-${code}`}>
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{FLAGS[info.flag] || "🌍"}</span>
                  <div className="text-left">
                    <p className="text-[11px] font-semibold">{code}</p>
                    <p className="text-[9px] text-gray-500">{info.name}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-white/80">{info.symbol} {info.rate.toFixed(2)}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurrencyConverterPage;
