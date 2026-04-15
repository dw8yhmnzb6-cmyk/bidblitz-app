import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Package, Zap, Users, Trophy, Star, Shield, TrendingUp, FileText } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function BlitzHubPage({ onBack }) {
  const [tab, setTab] = useState("cards");
  const [collection, setCollection] = useState([]);
  const [market, setMarket] = useState([]);
  const [battles, setBattles] = useState([]);
  const [gigs, setGigs] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [kycStatus, setKycStatus] = useState(null);
  const [affiliate, setAffiliate] = useState(null);
  const [taxReport, setTaxReport] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/cards/my-collection`, { credentials: "include" }).then(r => r.json()).then(d => setCollection(d.cards || [])).catch(() => {});
    fetch(`${API}/api/cards/market`, { credentials: "include" }).then(r => r.json()).then(d => setMarket(d.listings || [])).catch(() => {});
    fetch(`${API}/api/blitz/battles`, { credentials: "include" }).then(r => r.json()).then(d => setBattles(d.battles || [])).catch(() => {});
    fetch(`${API}/api/blitz/creator/gigs`, { credentials: "include" }).then(r => r.json()).then(d => setGigs(d.gigs || [])).catch(() => {});
    fetch(`${API}/api/blitz/boxes`, { credentials: "include" }).then(r => r.json()).then(d => setBoxes(d.boxes || [])).catch(() => {});
    fetch(`${API}/api/pro/kyc/status`, { credentials: "include" }).then(r => r.json()).then(d => setKycStatus(d)).catch(() => {});
    fetch(`${API}/api/pro/affiliate/my-link`, { credentials: "include" }).then(r => r.json()).then(d => setAffiliate(d)).catch(() => {});
  }, []);

  const buyPack = async (type, series) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/cards/buy-pack`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pack_type: type, series }) });
      const d = await r.json();
      if (r.ok) { setMsg(`${d.cards?.length} Karten erhalten!`); setCollection(prev => [...(d.cards || []), ...prev]); }
      else setMsg(d.detail || "Fehler");
    } catch { setMsg("Netzwerkfehler"); }
    setLoading(false); setTimeout(() => setMsg(""), 4000);
  };

  const joinBattle = async (id) => {
    try { const r = await fetch(`${API}/api/blitz/battles/join`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ battle_id: id }) });
      const d = await r.json(); setMsg(d.message || d.detail); } catch { setMsg("Fehler"); }
    setTimeout(() => setMsg(""), 3000);
  };

  const buyBox = async (id) => {
    setLoading(true);
    try { const r = await fetch(`${API}/api/blitz/boxes/buy`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ box_id: id }) });
      const d = await r.json(); setMsg(d.message || d.detail); } catch { setMsg("Fehler"); }
    setLoading(false); setTimeout(() => setMsg(""), 4000);
  };

  const submitKYC = async () => {
    try { const r = await fetch(`${API}/api/pro/kyc/submit`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: "Demo User", express: false }) });
      const d = await r.json(); setMsg(d.message); setKycStatus({ is_verified: true }); } catch { setMsg("Fehler"); }
    setTimeout(() => setMsg(""), 3000);
  };

  const getTaxReport = async () => {
    setLoading(true);
    try { const r = await fetch(`${API}/api/pro/tax-report`, { credentials: "include" }); const d = await r.json(); if (r.ok) setTaxReport(d); else setMsg(d.detail); } catch { setMsg("Fehler"); }
    setLoading(false);
  };

  const RARITY_COLORS = { common: "#6B7280", rare: "#3B82F6", epic: "#A855F7", legendary: "#F59E0B" };

  const tabs = [
    { id: "cards", label: "Karten" }, { id: "battles", label: "Battles" }, { id: "creator", label: "Creator" },
    { id: "boxes", label: "Boxen" }, { id: "verify", label: "KYC" }, { id: "tools", label: "Tools" },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="blitzhub-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <h1 className="text-base font-bold">BlitzHub</h1>
        </div>
        <div className="flex gap-1 mt-3 overflow-x-auto scrollbar-hide">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold ${tab === t.id ? "bg-orange-500 text-black" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* CARDS */}
        {tab === "cards" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => buyPack("starter", "football")} disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl font-bold text-black text-sm disabled:opacity-50">Starter €2.99 (5x)</button>
              <button onClick={() => buyPack("booster", "football")} disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl font-bold text-black text-sm disabled:opacity-50">Booster €0.99</button>
            </div>
            <p className="text-xs text-gray-500">{collection.length} Karten gesammelt</p>
            <div className="grid grid-cols-3 gap-2">
              {collection.slice(0, 12).map((c, i) => (
                <motion.div key={c.card_id || i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                  className="p-3 rounded-xl text-center border" style={{ background: `${RARITY_COLORS[c.rarity]}08`, borderColor: `${RARITY_COLORS[c.rarity]}30` }}>
                  <p className="text-2xl mb-1">{c.series === "football" ? "⚽" : c.series === "anime" ? "🎌" : c.series === "gaming" ? "🎮" : "🌟"}</p>
                  <p className="text-[10px] font-bold truncate">{c.name}</p>
                  <p className="text-[8px] font-bold uppercase" style={{ color: RARITY_COLORS[c.rarity] }}>{c.rarity}</p>
                  <p className="text-[9px] text-gray-500">PWR {c.power}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* BATTLES */}
        {tab === "battles" && (
          <div className="space-y-3">
            {battles.map((b, i) => (
              <div key={b.battle_id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold">{b.title}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">Pool: €{b.pool}</span>
                </div>
                <div className="flex items-center gap-3 mb-3 text-[10px] text-gray-500">
                  <span><Users size={10} className="inline" /> {b.participants?.length} Teilnehmer</span>
                  <span>Einsatz: €{b.stake}</span>
                  <span>{b.type}</span>
                </div>
                {b.participants?.map((p, pi) => (
                  <div key={pi} className="flex justify-between text-[11px] mb-1">
                    <span className="text-gray-400">{pi === 0 ? "🥇" : "🥈"} {p.name}</span>
                    <span className="font-bold">{p.score} Punkte</span>
                  </div>
                ))}
                <button onClick={() => joinBattle(b.battle_id)} className="w-full mt-3 py-2 rounded-xl bg-red-500/20 text-red-400 font-bold text-sm border border-red-500/20">Beitreten · €{b.stake}</button>
              </div>
            ))}
          </div>
        )}

        {/* CREATOR */}
        {tab === "creator" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Verdiene Geld als Content Creator</p>
            {gigs.map((g, i) => (
              <div key={g.gig_id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <p className="text-sm font-bold">{g.title}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold">{g.platform}</span>
                  <span>{g.applicants?.length || 0} Bewerber</span>
                </div>
                <p className="text-xl font-black text-green-400 mt-2">€{g.budget}</p>
                <button onClick={() => {
                  fetch(`${API}/api/blitz/creator/apply`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ gig_id: g.gig_id, pitch: "Ich bin interessiert!" }) }).then(r => r.json()).then(d => setMsg(d.message || d.detail));
                  setTimeout(() => setMsg(""), 3000);
                }} className="w-full mt-3 py-2 rounded-xl bg-purple-500/20 text-purple-400 font-bold text-sm border border-purple-500/20">Bewerben</button>
              </div>
            ))}
          </div>
        )}

        {/* BOXES */}
        {tab === "boxes" && (
          <div className="space-y-3">
            {boxes.map((b, i) => (
              <motion.div key={b.box_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="p-4 rounded-2xl border border-white/5" style={{ background: `${b.color}08` }}>
                <div className="flex items-center justify-between mb-2">
                  <div><p className="text-sm font-bold">{b.name}</p><p className="text-[10px] text-gray-500">{b.items} · Wert: {b.value_range}</p></div>
                  <Package size={24} style={{ color: b.color }} />
                </div>
                <button onClick={() => buyBox(b.box_id)} disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-black text-sm disabled:opacity-50" style={{ background: b.color }}>
                  Kaufen · €{b.price}
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* KYC */}
        {tab === "verify" && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl text-center" style={{ background: kycStatus?.is_verified ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${kycStatus?.is_verified ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}` }}>
              <Shield size={32} className={`mx-auto mb-2 ${kycStatus?.is_verified ? "text-green-400" : "text-yellow-400"}`} />
              <p className="text-lg font-bold">{kycStatus?.is_verified ? "Verifiziert" : "Nicht verifiziert"}</p>
              <p className="text-xs text-gray-400 mt-1">{kycStatus?.is_verified ? "Deine Identität wurde bestätigt" : "Verifiziere dich für mehr Vertrauen"}</p>
            </div>
            {!kycStatus?.is_verified && (
              <div className="space-y-3">
                <button onClick={submitKYC} className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-bold text-black">Standard-Verifizierung (72h)</button>
                <button onClick={async () => {
                  try { const r = await fetch(`${API}/api/pro/kyc/submit`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ full_name: "Demo User", express: true }) }); const d = await r.json(); setMsg(d.message); setKycStatus({ is_verified: true }); } catch {}
                  setTimeout(() => setMsg(""), 3000);
                }} className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl font-bold text-black">Express-Verifizierung · €4.99 (24h)</button>
              </div>
            )}
          </div>
        )}

        {/* TOOLS */}
        {tab === "tools" && (
          <div className="space-y-4">
            {/* Affiliate */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
              <p className="text-xs text-gray-500 font-bold mb-2">Dein Affiliate-Link</p>
              {affiliate?.code && (
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center">
                  <p className="text-xl font-mono font-bold text-cyan-400">{affiliate.code}</p>
                  <p className="text-[10px] text-gray-500 mt-1">3% Provision · {affiliate.clicks || 0} Klicks · {affiliate.conversions || 0} Conversions</p>
                  <button onClick={() => navigator.clipboard?.writeText(affiliate.code)} className="mt-2 px-4 py-1.5 bg-white/5 rounded-lg text-xs text-gray-400">Code kopieren</button>
                </div>
              )}
            </div>
            {/* Tax Report */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
              <p className="text-xs text-gray-500 font-bold mb-2">Steuerbericht {new Date().getFullYear()}</p>
              {!taxReport ? (
                <button onClick={getTaxReport} disabled={loading} className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl font-bold text-white disabled:opacity-50">
                  <FileText size={16} className="inline mr-2" />{loading ? "Generiere..." : "Bericht erstellen (€4.99 / Pro gratis)"}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-sm text-gray-400">Reselling</span><span className="font-bold">€{taxReport.income?.reselling?.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-gray-400">BlitzJobs</span><span className="font-bold">€{taxReport.income?.blitzjobs?.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-gray-400">Cashback</span><span className="font-bold">€{taxReport.income?.cashback?.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t border-white/10 pt-2"><span className="text-sm font-bold">Gesamt</span><span className="font-bold text-green-400">€{taxReport.income?.total?.toFixed(2)}</span></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-orange-500/20 border border-orange-500/30 rounded-xl text-orange-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
