import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Check, Loader2, ArrowLeft, Sparkles, Wifi } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function CardPage({ onNavigate }) {
  const [view, setView] = useState('home');
  const [tiers, setTiers] = useState([]);
  const [status, setStatus] = useState({ applications: [], has_virtual: false, total_waitlist: 0 });
  const [selectedTier, setSelectedTier] = useState(null);
  const [shipping, setShipping] = useState({ name: '', street: '', city: '', zip: '', country: 'DE' });
  const [consent, setConsent] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState(null);

  useEffect(() => { loadTiers(); loadStatus(); /* eslint-disable-next-line */ }, []);

  const loadTiers = async () => {
    try { const r = await fetch(`${API}/api/card/tiers`); if (r.ok) setTiers((await r.json()).tiers || []); } catch {}
  };
  const loadStatus = async () => {
    try { const r = await fetch(`${API}/api/card/status`, { credentials: 'include' }); if (r.ok) setStatus(await r.json()); } catch {}
  };

  const apply = async () => {
    if (!selectedTier || !consent) return;
    setApplying(true); setApplyMsg(null);
    try {
      const body = { tier: selectedTier.id, consent_terms: true };
      if (selectedTier.id !== 'virtual_free') {
        Object.assign(body, {
          shipping_name: shipping.name,
          shipping_street: shipping.street,
          shipping_city: shipping.city,
          shipping_zip: shipping.zip,
          shipping_country: shipping.country,
        });
      }
      const r = await fetch(`${API}/api/card/apply`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (r.ok) {
        setApplyMsg({ ok: true, text: d.status === 'issued' ? 'Virtuelle Karte ausgegeben!' : `Auf Warteliste (Position #${d.waitlist_position})` });
        await loadStatus();
        setTimeout(() => { setView('home'); setSelectedTier(null); setApplyMsg(null); }, 2200);
      } else setApplyMsg({ ok: false, text: d.detail || 'Fehler' });
    } catch { setApplyMsg({ ok: false, text: 'Netzwerkfehler' }); }
    setApplying(false);
  };

  const activeCard = status.applications.find((a) => a.status === 'issued' || a.status === 'active');

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24" data-testid="card-page">
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button data-testid="card-back-btn" onClick={() => onNavigate && onNavigate('/more')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-lg font-bold">BidBlitz Card</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
              {activeCard && (
                <div data-testid="card-active" className={`relative p-6 rounded-2xl bg-gradient-to-br ${tiers.find((t) => t.id === activeCard.tier)?.gradient || 'from-cyan-500 to-blue-500'} text-white shadow-2xl overflow-hidden`}>
                  <div className="flex items-start justify-between mb-8">
                    <span className="text-xs font-bold tracking-widest uppercase opacity-80">BidBlitz {activeCard.tier_name}</span>
                    <Wifi size={18} className="rotate-90 opacity-70" />
                  </div>
                  <p className="text-xl font-mono font-bold tracking-wider mb-2">{activeCard.masked_pan || '•••• •••• •••• ••••'}</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[9px] uppercase opacity-60">Karteninhaber</p>
                      <p className="text-sm font-semibold">{(shipping.name || 'BidBlitz User').toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase opacity-60">Gültig bis</p>
                      <p className="text-sm font-mono">12/28</p>
                    </div>
                  </div>
                  <p className="absolute top-3 right-3 text-[8px] font-bold opacity-40">DEMO</p>
                </div>
              )}

              {status.applications.filter((a) => a.status === 'waitlist').map((a) => (
                <div key={a.application_id} className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3">
                  <Loader2 size={16} className="text-yellow-400 animate-spin-slow" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-yellow-300">{a.tier_name} — Warteliste</p>
                    <p className="text-xs text-yellow-200/50">Position #{a.waitlist_position} · Wird versendet sobald Karten-Partner live</p>
                  </div>
                </div>
              ))}

              <div>
                <h2 className="text-lg font-bold mb-3">Wähle deine Karte</h2>
                <div className="space-y-3">
                  {tiers.map((t) => {
                    const already = status.applications.some((a) => a.tier === t.id && ['issued', 'active', 'waitlist', 'pending'].includes(a.status));
                    return (
                      <button key={t.id} data-testid={`card-tier-${t.id}`}
                        disabled={already}
                        onClick={() => { setSelectedTier(t); setView('apply'); }}
                        className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/30 transition-all text-left disabled:opacity-40">
                        <div className="flex items-start gap-3">
                          <div className={`w-14 h-10 rounded-md bg-gradient-to-br ${t.gradient} flex-shrink-0`} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-base">BidBlitz {t.name}</span>
                              <span className="text-sm font-bold" style={{ color: t.color_hex }}>{t.price_label}</span>
                            </div>
                            <ul className="mt-2 space-y-0.5">
                              {t.features.slice(0, 3).map((f, i) => (
                                <li key={i} className="text-xs text-white/50 flex items-center gap-1">
                                  <Check size={10} className="text-green-400 flex-shrink-0" />{f}
                                </li>
                              ))}
                            </ul>
                            {already && <p className="mt-2 text-[10px] text-yellow-400 font-bold">BEREITS BEANTRAGT</p>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <p className="text-[10px] text-white/30 leading-relaxed">
                  💡 Diese Karten sind derzeit <span className="text-yellow-400 font-bold">DEMO</span>.
                  Physische Karten werden verschickt sobald der BaFin-lizensierte Karten-Partner (Weavr/Railsr) in Betrieb ist.
                  {status.total_waitlist > 0 && ` ${status.total_waitlist} Nutzer bereits auf Warteliste.`}
                </p>
              </div>
            </motion.div>
          )}

          {view === 'apply' && selectedTier && (
            <motion.div key="apply" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
              <button onClick={() => { setView('home'); setSelectedTier(null); }} className="text-sm text-white/50 flex items-center gap-1">
                <ArrowLeft size={14} /> Zurück
              </button>

              <div className={`p-5 rounded-2xl bg-gradient-to-br ${selectedTier.gradient} text-white`}>
                <CreditCard size={24} className="mb-3" />
                <p className="text-xs uppercase tracking-widest opacity-80">BidBlitz</p>
                <h2 className="text-2xl font-black">{selectedTier.name}</h2>
                <p className="mt-1 text-sm opacity-80">{selectedTier.price_label}</p>
              </div>

              <div>
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Inkludiert</h3>
                <ul className="space-y-2">
                  {selectedTier.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                      <Sparkles size={12} className="text-cyan-400 mt-1 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </div>

              {selectedTier.id !== 'virtual_free' && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">Lieferadresse</h3>
                  <input data-testid="card-shipping-name" placeholder="Vor- und Nachname" value={shipping.name} onChange={(e) => setShipping({ ...shipping, name: e.target.value })}
                    className="w-full px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500/30" />
                  <input data-testid="card-shipping-street" placeholder="Straße & Nr." value={shipping.street} onChange={(e) => setShipping({ ...shipping, street: e.target.value })}
                    className="w-full px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500/30" />
                  <div className="grid grid-cols-2 gap-2">
                    <input data-testid="card-shipping-zip" placeholder="PLZ" value={shipping.zip} onChange={(e) => setShipping({ ...shipping, zip: e.target.value })}
                      className="px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500/30" />
                    <input data-testid="card-shipping-city" placeholder="Stadt" value={shipping.city} onChange={(e) => setShipping({ ...shipping, city: e.target.value })}
                      className="px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500/30" />
                  </div>
                </div>
              )}

              <label className="flex items-start gap-2 text-xs text-white/60 cursor-pointer">
                <input data-testid="card-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                <span>Ich akzeptiere die AGB + Datenschutzbestimmungen und bestätige dass BidBlitz Card Issuer Partner meine Daten an Weavr/Railsr weitergeben darf.</span>
              </label>

              {applyMsg && (
                <div className={`p-3 rounded-xl border ${applyMsg.ok ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'} text-sm font-semibold`}>
                  {applyMsg.text}
                </div>
              )}

              <button data-testid="card-apply-btn" onClick={apply} disabled={!consent || applying}
                className="w-full py-4 rounded-xl text-black font-bold text-lg disabled:opacity-30 flex items-center justify-center gap-2"
                style={{ background: selectedTier.color_hex }}>
                {applying ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                {selectedTier.id === 'virtual_free' ? 'Virtuelle Karte ausgeben' : 'Auf Warteliste eintragen'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
