/**
 * BidBlitz V2 - Child Mode Page
 * Complete child app experience for kids to access their wallet
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, QrCode, Clock, ShoppingBag, ArrowUpRight, ArrowDownLeft,
  Loader2, AlertCircle, Lock, LogOut, CreditCard, Scan, ChevronRight,
  Gift, Zap, Star
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// API calls with child token
const childApi = {
  login: async (childId, pin) => {
    const res = await fetch(`${API_URL}/api/kids/child-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ child_id: childId, pin })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Login fehlgeschlagen');
    return data;
  },
  getMe: async (token) => {
    const res = await fetch(`${API_URL}/api/kids/child-mode/me`, {
      headers: { 'X-Child-Token': token }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Fehler beim Laden');
    return data;
  },
  getPaymentCode: async (token) => {
    const res = await fetch(`${API_URL}/api/kids/child-mode/payment-code`, {
      headers: { 'X-Child-Token': token }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Fehler');
    return data;
  },
  pay: async (token, amount, merchantName, description) => {
    const res = await fetch(`${API_URL}/api/kids/child-mode/pay`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Child-Token': token 
      },
      body: JSON.stringify({ amount, merchant_name: merchantName, description })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Zahlung fehlgeschlagen');
    return data;
  },
  logout: async (token) => {
    await fetch(`${API_URL}/api/kids/child-mode/logout`, {
      method: 'POST',
      headers: { 'X-Child-Token': token }
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CHILD LOGIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const ChildLoginPage = ({ onLogin }) => {
  const [childId, setChildId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!childId.trim() || pin.length < 4) {
      setError('Bitte Kind-ID und PIN eingeben');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const result = await childApi.login(childId.trim(), pin);
      localStorage.setItem('child_token', result.child_token);
      localStorage.setItem('child_id', result.child_id);
      localStorage.setItem('child_name', result.child_name);
      onLogin(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (digit) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
    }
  };

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" 
      style={{ background: 'linear-gradient(180deg, #0A0A1A 0%, #1A1A3A 100%)' }}>
      
      {/* Logo */}
      <motion.div 
        className="mb-8 text-center"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#00C2FF] to-[#A855F7] flex items-center justify-center mb-4">
          <span className="text-3xl">👶</span>
        </div>
        <h1 className="text-2xl font-bold text-white">BidBlitz Kids</h1>
        <p className="text-sm text-gray-400 mt-1">Dein eigenes Wallet</p>
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-xs mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2"
          >
            <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
            <span className="text-red-400 text-sm">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Child ID Input */}
      <motion.div 
        className="w-full max-w-xs mb-4"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wider">Deine Kind-ID</label>
        <input
          type="text"
          value={childId}
          onChange={(e) => setChildId(e.target.value)}
          placeholder="z.B. child_abc123"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 outline-none focus:border-[#00C2FF]/50"
        />
      </motion.div>

      {/* PIN Display */}
      <motion.div 
        className="w-full max-w-xs mb-6"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wider">Dein PIN</label>
        <div className="flex justify-center gap-3 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <div 
              key={i}
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold ${
                pin[i] ? 'bg-[#00C2FF]/20 border-[#00C2FF]/50' : 'bg-white/5 border-white/10'
              } border`}
            >
              {pin[i] ? '●' : ''}
            </div>
          ))}
        </div>

        {/* PIN Pad */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((digit, i) => (
            <motion.button
              key={i}
              onClick={() => {
                if (digit === 'del') handlePinDelete();
                else if (digit !== null) handlePinInput(digit.toString());
              }}
              disabled={digit === null}
              className={`h-14 rounded-xl text-xl font-bold ${
                digit === null 
                  ? 'opacity-0 cursor-default' 
                  : digit === 'del'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-white/5 text-white hover:bg-white/10'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              {digit === 'del' ? '⌫' : digit}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Login Button */}
      <motion.button
        onClick={handleLogin}
        disabled={loading || !childId.trim() || pin.length < 4}
        className="w-full max-w-xs py-4 bg-gradient-to-r from-[#00C2FF] to-[#A855F7] text-white font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
        whileTap={{ scale: 0.98 }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {loading ? <Loader2 size={20} className="animate-spin" /> : <Lock size={20} />}
        Einloggen
      </motion.button>

      <p className="text-xs text-gray-500 mt-4 text-center">
        Frage deine Eltern nach deiner Kind-ID und PIN
      </p>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CHILD HOME PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const ChildHomePage = ({ token, childData, onLogout, onRefresh }) => {
  const [view, setView] = useState('home'); // home, pay, qr, activity
  const [paymentCode, setPaymentCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMerchant, setPayMerchant] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [paySuccess, setPaySuccess] = useState(null);
  const [payError, setPayError] = useState('');

  const loadPaymentCode = async () => {
    try {
      const data = await childApi.getPaymentCode(token);
      setPaymentCode(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadPaymentCode();
  }, [token]);

  const handlePay = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      setPayError('Bitte gültigen Betrag eingeben');
      return;
    }
    if (amount > childData.balance) {
      setPayError('Nicht genug Guthaben!');
      return;
    }
    if (amount > childData.remaining_today) {
      setPayError(`Tageslimit erreicht! Nur noch €${childData.remaining_today.toFixed(2)} heute.`);
      return;
    }

    setPayLoading(true);
    setPayError('');

    try {
      const result = await childApi.pay(token, amount, payMerchant || 'Shop', 'Zahlung');
      setPaySuccess(result);
      setPayAmount('');
      setPayMerchant('');
      onRefresh();
      setTimeout(() => {
        setPaySuccess(null);
        setView('home');
      }, 3000);
    } catch (err) {
      setPayError(err.message);
    } finally {
      setPayLoading(false);
    }
  };

  const handleLogout = async () => {
    await childApi.logout(token);
    localStorage.removeItem('child_token');
    localStorage.removeItem('child_id');
    localStorage.removeItem('child_name');
    onLogout();
  };

  const balance = childData?.balance || 0;
  const todaySpent = childData?.today_spent || 0;
  const remainingToday = childData?.remaining_today || 0;
  const dailyLimit = childData?.daily_limit || 20;
  const transactions = childData?.recent_transactions || [];

  return (
    <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(180deg, #0A0A1A 0%, #1A1A3A 100%)' }}>
      
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#A855F7] flex items-center justify-center text-lg">
            {childData?.avatar || '👶'}
          </div>
          <div>
            <p className="text-xs text-gray-400">Hallo</p>
            <p className="text-lg font-bold text-white">{childData?.name || 'Kind'}</p>
          </div>
        </div>
        <motion.button
          onClick={handleLogout}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"
          whileTap={{ scale: 0.9 }}
        >
          <LogOut size={18} className="text-gray-400" />
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* HOME VIEW */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {view === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-5"
          >
            {/* Balance Card */}
            <motion.div 
              className="rounded-3xl p-6 mb-6 relative overflow-hidden"
              style={{ 
                background: 'linear-gradient(135deg, rgba(0,194,255,0.15), rgba(168,85,247,0.15))',
                border: '1px solid rgba(0,194,255,0.2)'
              }}
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[#00C2FF]/20 blur-3xl" />
              <div className="relative z-10">
                <p className="text-sm text-gray-400 mb-1">Dein Guthaben</p>
                <p className="text-4xl font-bold text-white mb-4">€{balance.toFixed(2)}</p>
                
                {/* Today's limit */}
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-400">Heute noch verfügbar</span>
                  <span className="text-[#00C2FF] font-semibold">€{remainingToday.toFixed(2)}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div 
                    className="h-full rounded-full bg-gradient-to-r from-[#00C2FF] to-[#A855F7]"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((todaySpent / dailyLimit) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">€{todaySpent.toFixed(2)} / €{dailyLimit} heute</p>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <motion.button
                onClick={() => setView('pay')}
                className="p-4 rounded-2xl bg-[#00C2FF]/10 border border-[#00C2FF]/20 flex flex-col items-center gap-2"
                whileTap={{ scale: 0.95 }}
              >
                <div className="w-12 h-12 rounded-full bg-[#00C2FF]/20 flex items-center justify-center">
                  <CreditCard size={24} className="text-[#00C2FF]" />
                </div>
                <span className="text-sm font-semibold text-[#00C2FF]">Bezahlen</span>
              </motion.button>
              
              <motion.button
                onClick={() => setView('qr')}
                className="p-4 rounded-2xl bg-[#A855F7]/10 border border-[#A855F7]/20 flex flex-col items-center gap-2"
                whileTap={{ scale: 0.95 }}
              >
                <div className="w-12 h-12 rounded-full bg-[#A855F7]/20 flex items-center justify-center">
                  <QrCode size={24} className="text-[#A855F7]" />
                </div>
                <span className="text-sm font-semibold text-[#A855F7]">Mein Code</span>
              </motion.button>
            </div>

            {/* Recent Activity */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Letzte Aktivitäten</h3>
                <button onClick={() => setView('activity')} className="text-xs text-[#00C2FF]">
                  Alle anzeigen
                </button>
              </div>
              
              {transactions.length > 0 ? (
                <div className="space-y-2">
                  {transactions.slice(0, 5).map((tx, i) => (
                    <motion.div 
                      key={tx.id || i}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.amount > 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                      }`}>
                        {tx.amount > 0 ? (
                          <ArrowDownLeft size={18} className="text-green-400" />
                        ) : (
                          <ArrowUpRight size={18} className="text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">
                          {tx.merchant_name || tx.description || (tx.amount > 0 ? 'Taschengeld' : 'Zahlung')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(tx.created_at).toLocaleDateString('de-DE', { 
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                          })}
                        </p>
                      </div>
                      <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.amount > 0 ? '+' : ''}€{Math.abs(tx.amount).toFixed(2)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 rounded-xl bg-white/5">
                  <Gift size={32} className="text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Noch keine Aktivitäten</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* PAYMENT VIEW */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {view === 'pay' && (
          <motion.div
            key="pay"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-5"
          >
            <button onClick={() => setView('home')} className="text-sm text-[#00C2FF] mb-4 flex items-center gap-1">
              ← Zurück
            </button>

            <h2 className="text-xl font-bold text-white mb-6">Bezahlen</h2>

            {/* Success Message */}
            <AnimatePresence>
              {paySuccess && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="text-center py-12"
                >
                  <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                    <Zap size={40} className="text-green-400" />
                  </div>
                  <p className="text-2xl font-bold text-green-400 mb-2">Bezahlt!</p>
                  <p className="text-gray-400">€{paySuccess.transaction?.amount ? Math.abs(paySuccess.transaction.amount).toFixed(2) : '0.00'}</p>
                  <p className="text-sm text-gray-500 mt-2">Neues Guthaben: €{paySuccess.new_balance?.toFixed(2)}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {!paySuccess && (
              <>
                {/* Balance Info */}
                <div className="p-4 rounded-xl bg-white/5 mb-4">
                  <p className="text-xs text-gray-400">Verfügbar</p>
                  <p className="text-2xl font-bold text-white">€{Math.min(balance, remainingToday).toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Tageslimit: €{remainingToday.toFixed(2)} übrig</p>
                </div>

                {/* Error */}
                {payError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4 flex items-center gap-2">
                    <AlertCircle size={16} className="text-red-400" />
                    <span className="text-red-400 text-sm">{payError}</span>
                  </div>
                )}

                {/* Amount Input */}
                <div className="mb-4">
                  <label className="text-xs text-gray-400 mb-2 block">Betrag</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-xl">€</span>
                    <input
                      type="number"
                      step="0.50"
                      min="0.50"
                      max={Math.min(balance, remainingToday)}
                      placeholder="0.00"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white text-2xl font-bold placeholder-gray-600 outline-none focus:border-[#00C2FF]/50"
                    />
                  </div>
                </div>

                {/* Quick Amounts */}
                <div className="flex gap-2 mb-4">
                  {[1, 2, 5, 10].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setPayAmount(amt.toString())}
                      disabled={amt > Math.min(balance, remainingToday)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${
                        parseFloat(payAmount) === amt 
                          ? 'bg-[#00C2FF] text-black' 
                          : amt > Math.min(balance, remainingToday)
                            ? 'bg-white/5 text-white/20'
                            : 'bg-white/5 text-white/60'
                      }`}
                    >
                      €{amt}
                    </button>
                  ))}
                </div>

                {/* Merchant Name (optional) */}
                <div className="mb-6">
                  <label className="text-xs text-gray-400 mb-2 block">Wo? (optional)</label>
                  <input
                    type="text"
                    placeholder="z.B. Kiosk, Bäcker..."
                    value={payMerchant}
                    onChange={(e) => setPayMerchant(e.target.value)}
                    maxLength={50}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 outline-none focus:border-white/20"
                  />
                </div>

                {/* Pay Button */}
                <motion.button
                  onClick={handlePay}
                  disabled={payLoading || !payAmount || parseFloat(payAmount) <= 0}
                  className="w-full py-4 bg-gradient-to-r from-[#00C2FF] to-[#A855F7] text-white font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
                  whileTap={{ scale: 0.98 }}
                >
                  {payLoading ? <Loader2 size={20} className="animate-spin" /> : <CreditCard size={20} />}
                  €{parseFloat(payAmount) || 0} bezahlen
                </motion.button>
              </>
            )}
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* QR CODE VIEW */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {view === 'qr' && (
          <motion.div
            key="qr"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-5 text-center"
          >
            <button onClick={() => setView('home')} className="text-sm text-[#00C2FF] mb-4 flex items-center gap-1">
              ← Zurück
            </button>

            <h2 className="text-xl font-bold text-white mb-2">Dein Zahlungscode</h2>
            <p className="text-sm text-gray-400 mb-6">Zeige diesen Code zum Bezahlen</p>

            {/* QR Code Placeholder */}
            <div className="mx-auto w-64 h-64 rounded-2xl bg-white flex items-center justify-center mb-4 p-4">
              <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#00C2FF]/10 to-[#A855F7]/10 flex flex-col items-center justify-center">
                <QrCode size={80} className="text-[#00C2FF] mb-2" />
                <p className="text-xs text-gray-600 font-mono">{paymentCode?.payment_code || '...'}</p>
              </div>
            </div>

            {/* Barcode */}
            <div className="mx-auto w-64 p-4 rounded-xl bg-white mb-4">
              <div className="h-12 flex items-center justify-center gap-0.5">
                {(paymentCode?.payment_code || 'BLZKIDXXXXXXXX').split('').map((c, i) => (
                  <div key={i} className="h-full bg-black" style={{ width: (i % 3 === 0 ? 3 : 2) + 'px' }} />
                ))}
              </div>
              <p className="text-xs text-gray-600 font-mono mt-2 tracking-wider">
                {paymentCode?.payment_code || '...'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#00C2FF]/10 border border-[#00C2FF]/20">
              <p className="text-sm text-[#00C2FF] font-semibold">Guthaben: €{paymentCode?.balance?.toFixed(2) || balance.toFixed(2)}</p>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* ACTIVITY VIEW */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {view === 'activity' && (
          <motion.div
            key="activity"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-5"
          >
            <button onClick={() => setView('home')} className="text-sm text-[#00C2FF] mb-4 flex items-center gap-1">
              ← Zurück
            </button>

            <h2 className="text-xl font-bold text-white mb-4">Alle Aktivitäten</h2>

            {transactions.length > 0 ? (
              <div className="space-y-2">
                {transactions.map((tx, i) => (
                  <motion.div 
                    key={tx.id || i}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.amount > 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}>
                      {tx.amount > 0 ? (
                        <ArrowDownLeft size={18} className="text-green-400" />
                      ) : (
                        <ArrowUpRight size={18} className="text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        {tx.merchant_name || tx.description || (tx.amount > 0 ? 'Taschengeld' : 'Zahlung')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(tx.created_at).toLocaleDateString('de-DE', { 
                          day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' 
                        })}
                      </p>
                    </div>
                    <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount > 0 ? '+' : ''}€{Math.abs(tx.amount).toFixed(2)}
                    </span>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 rounded-xl bg-white/5">
                <Clock size={32} className="text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Noch keine Aktivitäten</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CHILD MODE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const ChildModePage = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [childData, setChildData] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session
  useEffect(() => {
    const savedToken = localStorage.getItem('child_token');
    if (savedToken) {
      setToken(savedToken);
      loadChildData(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const loadChildData = async (t) => {
    try {
      const data = await childApi.getMe(t);
      setChildData(data);
      setIsLoggedIn(true);
    } catch (err) {
      // Session expired or invalid
      localStorage.removeItem('child_token');
      localStorage.removeItem('child_id');
      localStorage.removeItem('child_name');
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (result) => {
    setToken(result.child_token);
    setIsLoggedIn(true);
    loadChildData(result.child_token);
  };

  const handleLogout = () => {
    setToken(null);
    setChildData(null);
    setIsLoggedIn(false);
  };

  const handleRefresh = () => {
    if (token) {
      loadChildData(token);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0A0A1A 0%, #1A1A3A 100%)' }}>
        <Loader2 size={32} className="text-[#00C2FF] animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <ChildLoginPage onLogin={handleLogin} />;
  }

  return (
    <ChildHomePage 
      token={token} 
      childData={childData} 
      onLogout={handleLogout}
      onRefresh={handleRefresh}
    />
  );
};

export default ChildModePage;
