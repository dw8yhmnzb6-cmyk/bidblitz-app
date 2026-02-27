/**
 * Scooter Abo (Subscription) Page
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Crown, Check, Zap, Clock, Star, Loader2, X, ArrowLeft, Euro, Bike } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const planIcons = { basic: Bike, plus: Zap, unlimited: Crown };
const planColors = {
  basic: 'from-slate-600 to-slate-700',
  plus: 'from-blue-500 to-indigo-600',
  unlimited: 'from-amber-500 to-orange-600'
};
const planFeatures = {
  basic: ['Keine Entsperrgebuehr', 'Nur Minutenpreis zahlen', 'Alle Scooter & E-Bikes'],
  plus: ['Keine Entsperrgebuehr', '30 Min/Tag gratis fahren', 'Alle Scooter & E-Bikes', 'Prioritaets-Reservierung'],
  unlimited: ['Komplett-Flatrate', 'Unbegrenzt fahren', 'Alle Scooter & E-Bikes', 'Prioritaets-Reservierung', 'VIP Support']
};

export default function ScooterAboPage() {
  const { token, user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [mySub, setMySub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/scooter-features/plans`),
      token ? axios.get(`${API}/scooter-features/my-subscription`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { subscription: null } })) : Promise.resolve({ data: { subscription: null } }),
      token ? axios.get(`${API}/wallet-ledger/balance`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { balance_cents: 0 } })) : Promise.resolve({ data: { balance_cents: 0 } })
    ]).then(([plansRes, subRes, walletRes]) => {
      setPlans(plansRes.data.plans || []);
      setMySub(subRes.data.subscription);
      setWalletBalance(walletRes.data.balance_cents || 0);
    }).finally(() => setLoading(false));
  }, [token]);

  const handleSubscribe = async (planId) => {
    if (!token) { toast.error('Bitte anmelden'); return; }
    setSubscribing(true);
    try {
      const res = await axios.post(`${API}/scooter-features/subscribe`, { plan_id: planId }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(res.data.message);
      setMySub(res.data.subscription);
    } catch (e) {
      const msg = e.response?.data?.detail || 'Fehler';
      if (msg.includes('Guthaben')) toast.error(msg, { action: { label: 'Aufladen', onClick: () => window.location.href = '/pay' } });
      else toast.error(msg);
    } finally { setSubscribing(false); }
  };

  const handleCancel = async () => {
    try {
      await axios.post(`${API}/scooter-features/cancel-subscription`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Abo gekuendigt');
      setMySub(prev => prev ? { ...prev, status: 'cancelled', auto_renew: false } : null);
    } catch (e) { toast.error(e.response?.data?.detail || 'Fehler'); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 pb-24" data-testid="scooter-abo-page">
      {/* Hero */}
      <div className="px-6 pt-8 pb-6 text-center text-white">
        <Crown className="w-12 h-12 mx-auto mb-3 text-amber-400" />
        <h1 className="text-2xl font-bold">Scooter-Abo</h1>
        <p className="text-slate-400 text-sm mt-1">Spar dir die Entsperrgebuehr - fahr unbegrenzt</p>
      </div>

      {/* Active Subscription */}
      {mySub && mySub.status === 'active' && (
        <div className="mx-4 mb-6 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg">Dein Abo: {mySub.plan_name}</h3>
            <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-bold">AKTIV</span>
          </div>
          <p className="text-emerald-100 text-sm">Gueltig bis: {new Date(mySub.expires_at).toLocaleDateString('de-DE')}</p>
          <p className="text-emerald-100 text-sm">Auto-Verlaengerung: {mySub.auto_renew ? 'Ja' : 'Nein'}</p>
          {mySub.auto_renew && (
            <button onClick={handleCancel} className="mt-3 px-4 py-2 bg-white/20 text-white text-sm font-medium rounded-lg hover:bg-white/30">
              Abo kuendigen
            </button>
          )}
        </div>
      )}

      {/* Plans */}
      <div className="px-4 space-y-4">
        {plans.map((plan, i) => {
          const Icon = planIcons[plan.id] || Bike;
          const gradient = planColors[plan.id] || 'from-slate-500 to-slate-600';
          const features = planFeatures[plan.id] || [];
          const isActive = mySub?.plan_id === plan.id && mySub?.status === 'active';
          const isPopular = plan.id === 'plus';

          return (
            <div key={plan.id} className={`relative bg-slate-800 rounded-2xl border ${isPopular ? 'border-blue-500' : 'border-slate-700'} overflow-hidden`}>
              {isPopular && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">BELIEBT</div>
              )}
              <div className={`bg-gradient-to-r ${gradient} p-5`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">{plan.name}</h3>
                    <p className="text-white/70 text-sm">{plan.description}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-bold text-white">{plan.price_eur.toFixed(2)}{'\u20AC'}</span>
                  <span className="text-white/60 text-sm ml-1">/Monat</span>
                </div>
              </div>
              <div className="p-5">
                <ul className="space-y-2 mb-4">
                  {features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={subscribing || isActive}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                    isActive ? 'bg-emerald-600 text-white cursor-default' :
                    `bg-gradient-to-r ${gradient} text-white hover:opacity-90 disabled:opacity-50`
                  }`}
                  data-testid={`subscribe-${plan.id}`}
                >
                  {isActive ? 'Aktuelles Abo' : subscribing ? 'Wird gebucht...' : `${plan.name} waehlen`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Wallet Balance */}
      <div className="mx-4 mt-6 p-4 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-xs">Dein Wallet-Guthaben</p>
          <p className="text-white font-bold text-lg">{'\u20AC'}{((user?.wallet_balance_cents || 0) / 100).toFixed(2)}</p>
        </div>
        <Link to="/pay" className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl">Aufladen</Link>
      </div>
    </div>
  );
}
