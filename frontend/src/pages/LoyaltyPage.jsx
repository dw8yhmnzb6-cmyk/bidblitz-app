/**
 * Loyalty + Referral Page - Treuepunkte + Freunde einladen
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Star, Gift, Users, Euro, Crown, Copy, Share2, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const TIER_COLORS = { Bronze: 'from-amber-600 to-amber-700', Silber: 'from-slate-400 to-slate-500', Gold: 'from-yellow-400 to-amber-500', Platin: 'from-violet-500 to-purple-600' };

export default function LoyaltyPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState('points');
  const [loyalty, setLoyalty] = useState(null);
  const [history, setHistory] = useState([]);
  const [referral, setReferral] = useState(null);
  const [redeemPts, setRedeemPts] = useState('');
  const [refCode, setRefCode] = useState('');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/features/loyalty/my-points`, { headers }).then(r => setLoyalty(r.data.loyalty)).catch(() => {});
    axios.get(`${API}/features/loyalty/history`, { headers }).then(r => setHistory(r.data.history || [])).catch(() => {});
    axios.get(`${API}/features/referral/my-code`, { headers }).then(r => setReferral(r.data.referral)).catch(() => {});
  }, [token]);

  const redeem = async () => {
    const pts = parseInt(redeemPts);
    if (!pts || pts < 100) { toast.error('Mindestens 100 Punkte'); return; }
    try { const r = await axios.post(`${API}/features/loyalty/redeem?points=${pts}`, {}, { headers }); toast.success(r.data.message); setRedeemPts(''); } catch (e) { toast.error(e.response?.data?.detail || 'Fehler'); }
  };

  const applyRef = async () => {
    if (!refCode.trim()) return;
    try { const r = await axios.post(`${API}/features/referral/apply?code=${refCode}`, {}, { headers }); toast.success(r.data.message); setRefCode(''); } catch (e) { toast.error(e.response?.data?.detail || 'Fehler'); }
  };

  const copyCode = () => { navigator.clipboard?.writeText(referral?.code || ''); toast.success('Code kopiert!'); };
  const shareCode = () => { if (navigator.share) navigator.share({ title: 'BidBlitz', text: referral?.share_text || '' }); else copyCode(); };

  const tier = loyalty?.tier || 'Bronze';
  const gradient = TIER_COLORS[tier] || TIER_COLORS.Bronze;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 pb-24" data-testid="loyalty-page">
      {/* Header */}
      <div className={`bg-gradient-to-br ${gradient} px-6 py-10 text-white text-center`}>
        <Crown className="w-12 h-12 mx-auto mb-2 opacity-80" />
        <h1 className="text-2xl font-bold">{tier}</h1>
        <p className="text-3xl font-bold mt-2">{loyalty?.points || 0} Punkte</p>
        <p className="text-white/70 text-sm mt-1">= {((loyalty?.points || 0) / 100).toFixed(2)} EUR</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 px-4">
        {[{ id: 'points', l: 'Punkte' }, { id: 'referral', l: 'Einladen' }, { id: 'history', l: 'Verlauf' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-3 text-sm font-medium text-center ${tab === t.id ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-500'}`}>{t.l}</button>
        ))}
      </div>

      <div className="px-4 max-w-lg mx-auto mt-4">
        {tab === 'points' && (
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-white font-bold mb-3">Punkte einlösen</h3>
              <p className="text-slate-400 text-xs mb-3">100 Punkte = 1 EUR auf Wallet</p>
              <div className="flex gap-2">
                <input type="number" value={redeemPts} onChange={e => setRedeemPts(e.target.value)} placeholder="z.B. 500" min="100" step="100" className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white" />
                <button onClick={redeem} className="px-6 py-3 bg-amber-500 text-white font-bold rounded-xl">Einlösen</button>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-white font-bold mb-3">So sammelst du Punkte</h3>
              <div className="space-y-2 text-sm">
                {[{ p: '+10', d: 'Pro Taxi-Fahrt' }, { p: '+5', d: 'Pro EUR bei Auktionen' }, { p: '+1', d: 'Pro Scooter-Minute' }, { p: '+50', d: 'Freund einladen' }].map((r, i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-white/5"><span className="text-slate-400">{r.d}</span><span className="text-amber-400 font-bold">{r.p}</span></div>
                ))}
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-white font-bold mb-3">Tier-Stufen</h3>
              {[{ t: 'Bronze', p: '0+', c: 'from-amber-600 to-amber-700' }, { t: 'Silber', p: '500+', c: 'from-slate-400 to-slate-500' }, { t: 'Gold', p: '2.000+', c: 'from-yellow-400 to-amber-500' }, { t: 'Platin', p: '5.000+', c: 'from-violet-500 to-purple-600' }].map((s, i) => (
                <div key={i} className={`flex items-center gap-3 py-2 ${tier === s.t ? 'opacity-100' : 'opacity-50'}`}><div className={`w-8 h-8 bg-gradient-to-br ${s.c} rounded-lg`} /><span className="text-white text-sm flex-1">{s.t}</span><span className="text-slate-400 text-xs">{s.p} Punkte</span>{tier === s.t && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}</div>
              ))}
            </div>
          </div>
        )}

        {tab === 'referral' && referral && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white text-center">
              <Gift className="w-10 h-10 mx-auto mb-2 opacity-80" />
              <h2 className="font-bold text-lg">Freunde einladen</h2>
              <p className="text-emerald-100 text-sm mt-1">Beide bekommen 5 EUR Bonus!</p>
              <div className="mt-4 bg-white/20 rounded-xl p-4 flex items-center justify-between">
                <span className="text-2xl font-mono font-bold">{referral.code}</span>
                <div className="flex gap-2"><button onClick={copyCode} className="p-2 bg-white/20 rounded-lg"><Copy className="w-5 h-5" /></button><button onClick={shareCode} className="p-2 bg-white/20 rounded-lg"><Share2 className="w-5 h-5" /></button></div>
              </div>
              <p className="text-xs text-emerald-200 mt-2">{referral.uses} Einladungen | {(referral.earned_cents / 100).toFixed(2)} EUR verdient</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-white font-bold mb-3">Code eingeben</h3>
              <div className="flex gap-2">
                <input value={refCode} onChange={e => setRefCode(e.target.value.toUpperCase())} placeholder="BB-XXXXXX" className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white font-mono" />
                <button onClick={applyRef} className="px-6 py-3 bg-emerald-500 text-white font-bold rounded-xl">Einlösen</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-2">
            {history.length === 0 ? <p className="text-center text-slate-500 py-8">Noch keine Aktivität</p> : history.map(h => (
              <div key={h.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                <div><p className="text-white text-sm">{h.reason}</p><p className="text-xs text-slate-500">{new Date(h.created_at).toLocaleString('de-DE')}</p></div>
                <span className={`font-bold ${h.points > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{h.points > 0 ? '+' : ''}{h.points}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
