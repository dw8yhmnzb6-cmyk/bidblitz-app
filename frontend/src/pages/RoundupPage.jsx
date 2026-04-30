import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, PiggyBank, Check, TrendingUp, Target } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function RoundupPage({ onNavigate }) {
  const [config, setConfig] = useState({ enabled: false, round_to: 1, multiplier: 1, total_saved: 0, entries_count: 0, goal_name: '', goal_amount: 0 });
  const [entries, setEntries] = useState([]);
  const [preview, setPreview] = useState(null);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const load = async () => {
    try {
      const r = await fetch(`${API}/api/roundup/config`, { credentials: 'include' });
      if (r.ok) setConfig(await r.json());
      const r2 = await fetch(`${API}/api/roundup/history?limit=10`, { credentials: 'include' });
      if (r2.ok) setEntries((await r2.json()).entries || []);
    } catch {}
    computePreview();
  };

  const computePreview = async (rt = null, m = null) => {
    const round_to = rt ?? config.round_to;
    const mult = m ?? config.multiplier;
    try {
      const r = await fetch(`${API}/api/roundup/preview?amount=12.60&round_to=${round_to}&multiplier=${mult}`, { method: 'POST', credentials: 'include' });
      if (r.ok) setPreview(await r.json());
    } catch {}
  };

  const saveConfig = async (patch) => {
    const next = { ...config, ...patch };
    setConfig(next);
    try {
      await fetch(`${API}/api/roundup/config`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next.enabled, round_to: next.round_to, multiplier: next.multiplier, goal_name: next.goal_name, goal_amount: next.goal_amount }),
      });
      computePreview(next.round_to, next.multiplier);
    } catch {}
  };

  const goalProgress = config.goal_amount ? Math.min(100, (config.total_saved / config.goal_amount) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24" data-testid="roundup-page">
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button data-testid="ru-back-btn" onClick={() => onNavigate && onNavigate('/more')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"><ArrowLeft size={16} /></button>
          <h1 className="text-lg font-bold">Round-up Sparen</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="p-6 rounded-2xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20 text-center">
          <PiggyBank size={40} className="mx-auto mb-3 text-pink-400" />
          <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Gesamt gespart</p>
          <p className="text-4xl font-black text-pink-300 font-mono mt-1">€{config.total_saved.toFixed(2)}</p>
          <p className="text-xs text-white/30 mt-1">aus {config.entries_count} Transaktionen</p>
        </motion.div>

        <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">Round-up aktiviert</p>
            <p className="text-xs text-white/40 mt-0.5">Rundet jeden Kauf auf und legt den Rest zur Seite</p>
          </div>
          <button data-testid="ru-toggle" onClick={() => saveConfig({ enabled: !config.enabled })}
            className={`w-12 h-7 rounded-full relative transition-colors ${config.enabled ? 'bg-pink-500' : 'bg-white/10'}`}>
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <div>
          <p className="text-xs text-white/40 uppercase tracking-widest font-bold mb-2">Aufrunden auf</p>
          <div className="grid grid-cols-3 gap-2">
            {[1, 5, 10].map((v) => (
              <button key={v} data-testid={`ru-round-${v}`} onClick={() => saveConfig({ round_to: v })}
                className={`py-3 rounded-xl font-bold ${config.round_to === v ? 'bg-pink-500 text-black' : 'bg-white/5 text-white/50'}`}>
                €{v}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-white/40 uppercase tracking-widest font-bold mb-2">Multiplikator (Booster)</p>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 5, 10].map((v) => (
              <button key={v} data-testid={`ru-mult-${v}`} onClick={() => saveConfig({ multiplier: v })}
                className={`py-3 rounded-xl font-bold ${config.multiplier === v ? 'bg-pink-500 text-black' : 'bg-white/5 text-white/50'}`}>
                {v}×
              </button>
            ))}
          </div>
        </div>

        {preview && (
          <div className="p-4 rounded-xl bg-pink-500/5 border border-pink-500/10 text-sm flex items-center justify-between">
            <div>
              <p className="text-white/50">Beispiel: €12.60-Kauf</p>
              <p className="text-xs text-white/30">auf €{preview.charged_to_user.toFixed(2)} aufgerundet</p>
            </div>
            <div className="text-right">
              <p className="text-pink-300 font-bold">+€{preview.saved.toFixed(2)}</p>
              <p className="text-[10px] text-white/30">pro Transaktion</p>
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Target size={14} className="text-pink-400" />
            <p className="text-sm font-bold">Sparziel (optional)</p>
          </div>
          <input data-testid="ru-goal-name" placeholder="z.B. Urlaub, neues Handy" value={config.goal_name || ''} onChange={(e) => setConfig({ ...config, goal_name: e.target.value })} onBlur={() => saveConfig({ goal_name: config.goal_name })}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-sm outline-none focus:border-pink-500/30" />
          <input data-testid="ru-goal-amount" type="number" placeholder="Zielbetrag €" value={config.goal_amount || ''} onChange={(e) => setConfig({ ...config, goal_amount: Number(e.target.value) })} onBlur={() => saveConfig({ goal_amount: config.goal_amount })}
            className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-sm outline-none focus:border-pink-500/30" />
          {config.goal_amount > 0 && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all" style={{ width: `${goalProgress}%` }} />
              </div>
              <p className="text-xs text-white/40 mt-1">{goalProgress.toFixed(0)}% · noch €{(config.goal_amount - config.total_saved).toFixed(2)}</p>
            </div>
          )}
        </div>

        {entries.length > 0 && (
          <div>
            <p className="text-xs text-white/40 uppercase tracking-widest font-bold mb-2">Verlauf</p>
            <div className="space-y-2">
              {entries.map((e, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-sm">€{e.source_amount.toFixed(2)} → aufgerundet</p>
                    <p className="text-xs text-white/30">{new Date(e.created_at).toLocaleDateString('de-DE')}</p>
                  </div>
                  <span className="text-pink-400 font-bold">+€{e.amount_saved.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
