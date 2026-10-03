import React, { useState, useEffect, useRef } from "react";
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
  const [capabilities, setCapabilities] = useState({
    live_provider_connected: false,
    purchase_available: false,
    production_message: "",
  });
  const purchaseAttemptKeyRef = useRef(null);

  useEffect(() => { loadGiftCardState(); }, []);

  const loadGiftCardState = async () => {
    try {
      const [capRes, cardsRes] = await Promise.all([
        fetch(`${API}/api/gift-cards/capabilities`),
        fetch(`${API}/api/gift-cards/my`, { credentials: "include" }),
      ]);
      if (capRes.ok) setCapabilities(await capRes.json());
      if (cardsRes.ok) {
        const d = await cardsRes.json();
        setMyCards(d.cards || []);
      }
    } catch {}
  };

  const loadMyCards = async () => {
    try {
      const res = await fetch(`${API}/api/gift-cards/my`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setMyCards(d.cards || []);
      }
    } catch {}
  };

  useEffect(() => {
    purchaseAttemptKeyRef.current = null;
  }, [selected?.id, amount]);

  const purchase = async () => {
    if (!selected || !amount) return;
    if (!capabilities.purchase_available) {
      alert(capabilities.production_message || "Geschenkkarten-Provider ist noch nicht live verbunden.");
      return;
    }
    if (!purchaseAttemptKeyRef.current) {
      purchaseAttemptKeyRef.current = typeof crypto?.randomUUID === "function"
        ? `gift-card-${crypto.randomUUID()}`
        : `gift-card-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const idempotencyKey = purchaseAttemptKeyRef.current;
    setPurchasing(true);
    try {
      const res = await fetch(`${API}/api/gift-cards/purchase`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          type: selected.id,
          amount,
          idempotency_key: idempotencyKey,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        purchaseAttemptKeyRef.current = null;
        await loadMyCards();
        setSelected(null);
        setAmount(null);
        setTab("my");
        alert("Test-Geschenkkarte erstellt.");
      } else {
        if (res.status < 500 && res.status !== 409) purchaseAttemptKeyRef.current = null;
        alert(typeof d.detail === "string" ? d.detail : "Fehler beim Kauf");
      }
    } catch {
      alert("Netzwerkfehler");
    }
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
        {!capabilities.live_provider_connected && (
          <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4" data-testid="giftcard-provider-unavailable">
            <p className="text-sm font-bold text-amber-300">Gift-Card-Provider noch nicht live</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
              {capabilities.production_message || "Käufe werden erst aktiviert, wenn ein verifizierter Provider verbunden ist."}
            </p>
          </div>
        )}
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
                  <motion.button whileTap={{ scale: 0.97 }} onClick={purchase} disabled={!amount || purchasing || !capabilities.purchase_available}
                    className="flex-1 py-4 rounded-xl text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: selected.color }}>
                    {purchasing
                      ? <Loader2 size={20} className="animate-spin" />
                      : capabilities.purchase_available
                        ? <><ShoppingCart size={20} /> Kaufen €{amount}</>
                        : <>Noch nicht verfügbar</>}
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
                  <code className="text-xs text-[#888] font-mono flex-1">{c.code || c.code_masked || "Nicht verfügbar"}</code>
                  {c.code ? (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => copyCode(c.code)} className="p-1.5 rounded-lg bg-white/5">
                      {copied === c.code ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-white/50" />}
                    </motion.button>
                  ) : null}
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
