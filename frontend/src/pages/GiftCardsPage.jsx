import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Gift, Loader2, ShoppingCart, Send, Copy, Check } from "lucide-react";
import { useI18n } from "../store/I18nContext";

const API = process.env.REACT_APP_BACKEND_URL;

const CARD_TYPES = [
  { id: "amazon", name: "Amazon", color: "#FF9900", amounts: [10, 25, 50, 100] },
  { id: "netflix", name: "Netflix", color: "#E50914", amounts: [15, 25, 50] },
  { id: "spotify", name: "Spotify", color: "#1DB954", amounts: [10, 30, 60] },
  { id: "apple", name: "Apple", color: "#A3AAAE", amounts: [15, 25, 50, 100] },
  { id: "google", name: "Google Play", color: "#34A853", amounts: [15, 25, 50] },
  { id: "steam", name: "Steam", color: "#1B2838", amounts: [20, 50, 100] },
  { id: "psn", name: "PlayStation", color: "#003087", amounts: [20, 50] },
  { id: "xbox", name: "Xbox", color: "#107C10", amounts: [15, 25, 50] },
];

const GiftCardsPage = ({ onBack }) => {
  const { t } = useI18n();
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [myCards, setMyCards] = useState([]);
  const [tab, setTab] = useState("shop"); // shop | my
  const [copied, setCopied] = useState(null);

  useEffect(() => { loadMyCards(); }, []);

  const loadMyCards = async () => {
    try {
      const res = await fetch(`${API}/api/gift-cards/my`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setMyCards(d.cards || []); }
    } catch {}
  };

  const purchase = async () => {
    if (!selected || !amount) return;
    setPurchasing(true);
    try {
      const res = await fetch(`${API}/api/gift-cards/purchase`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selected.id, amount }),
      });
      if (res.ok) {
        loadMyCards();
        setSelected(null);
        setAmount(null);
        setTab("my");
        alert("Geschenkkarte gekauft!");
      } else {
        const d = await res.json();
        alert(d.detail || "Fehler beim Kauf");
      }
    } catch {}
    setPurchasing(false);
  };

  const copyCode = (code) => { navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(null), 2000); };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 p-4">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="giftcards-back">
            <ArrowLeft size={20} />
          </motion.button>
          <h1 className="text-lg font-bold flex-1">Geschenkkarten</h1>
        </div>
        <div className="flex gap-2 px-4 pb-3">
          {[{ id: "shop", label: "Shop" }, { id: "my", label: "Meine Karten" }].map(t => (
            <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === t.id ? "bg-[#FFD166] text-black" : "bg-white/5 text-[#888]"}`}>
              {t.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {tab === "shop" ? (
          <div className="space-y-3">
            {selected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: `${selected.color}15`, border: `1px solid ${selected.color}30` }}>
                  <Gift size={24} style={{ color: selected.color }} />
                  <div>
                    <p className="font-bold">{selected.name}</p>
                    <p className="text-xs text-[#888]">Geschenkkarte</p>
                  </div>
                </div>
                <p className="text-xs text-[#666]">Betrag wählen</p>
                <div className="grid grid-cols-4 gap-2">
                  {selected.amounts.map(a => (
                    <motion.button key={a} whileTap={{ scale: 0.95 }} onClick={() => setAmount(a)}
                      className={`py-3 rounded-xl text-sm font-bold ${amount === a ? "text-black" : "bg-white/5 text-white/60"}`}
                      style={amount === a ? { background: selected.color } : {}}>
                      €{a}
                    </motion.button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.97 }} onClick={purchase} disabled={!amount || purchasing}
                    className="flex-1 py-4 rounded-xl text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: selected.color }}>
                    {purchasing ? <Loader2 size={20} className="animate-spin" /> : <><ShoppingCart size={20} /> Kaufen €{amount}</>}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setSelected(null); setAmount(null); }}
                    className="px-4 py-4 rounded-xl bg-white/5 text-white/50">Zurück</motion.button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {CARD_TYPES.map(c => (
                  <motion.button key={c.id} whileTap={{ scale: 0.95 }} onClick={() => setSelected(c)}
                    className="rounded-2xl p-4 text-left border border-white/5" style={{ background: `${c.color}08` }}>
                    <Gift size={24} style={{ color: c.color }} className="mb-2" />
                    <p className="font-bold text-sm">{c.name}</p>
                    <p className="text-[10px] text-[#888]">ab €{Math.min(...c.amounts)}</p>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {myCards.length === 0 ? (
              <div className="text-center py-16">
                <Gift size={48} className="mx-auto text-[#333] mb-4" />
                <p className="text-white/70">Noch keine Geschenkkarten</p>
              </div>
            ) : myCards.map((c, i) => (
              <div key={c.card_id || i} className="bg-[#111118] rounded-2xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{c.type}</span>
                  <span className="text-[#FFD166] font-bold">€{c.amount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-[#888] font-mono flex-1">{c.code}</code>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => copyCode(c.code)} className="p-1.5 rounded-lg bg-white/5">
                    {copied === c.code ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-white/50" />}
                  </motion.button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GiftCardsPage;
