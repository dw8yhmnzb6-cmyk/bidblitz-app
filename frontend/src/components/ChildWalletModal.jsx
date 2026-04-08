/**
 * BidBlitz V2 - Child Wallet Component
 * Complete child wallet management for parents
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Wallet, Send, Lock, Unlock, Settings, Clock,
  TrendingDown, TrendingUp, Loader2, AlertCircle, Check,
  QrCode, ShoppingBag, ChevronRight, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

const ChildWalletModal = ({ child, onClose, onUpdate }) => {
  const [view, setView] = useState('wallet'); // wallet, transfer, limits, activity
  const [walletData, setWalletData] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Transfer state
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  
  // Limits state
  const [dailyLimit, setDailyLimit] = useState(20);
  const [weeklyLimit, setWeeklyLimit] = useState(50);

  // Load wallet data
  useEffect(() => {
    loadWalletData();
  }, [child.child_id]);

  const loadWalletData = async () => {
    setLoading(true);
    try {
      const data = await api.getChildWallet(child.child_id);
      setWalletData(data);
      setDailyLimit(data.daily_limit || 20);
      setWeeklyLimit(data.weekly_limit || 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadActivity = async () => {
    try {
      const data = await api.getChildActivity(child.child_id, 30);
      setActivity(data);
    } catch (err) {
      setError(err.message);
    }
  };

  // Transfer money to child
  const handleTransfer = async () => {
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0) return;
    
    setActionLoading(true);
    setError(null);
    try {
      const result = await api.transferToChild(child.child_id, {
        child_id: child.child_id,
        amount,
        note: transferNote || undefined
      });
      setSuccess(result.message);
      setTransferAmount('');
      setTransferNote('');
      loadWalletData();
      if (onUpdate) onUpdate();
      setTimeout(() => { setSuccess(null); setView('wallet'); }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Update limits
  const handleSaveLimits = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await api.setChildLimits(child.child_id, {
        daily_limit: dailyLimit,
        weekly_limit: weeklyLimit
      });
      setSuccess('Limits aktualisiert');
      loadWalletData();
      setTimeout(() => { setSuccess(null); setView('wallet'); }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Freeze/Unfreeze
  const handleToggleFreeze = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const result = await api.freezeChild(child.child_id);
      setSuccess(result.message);
      loadWalletData();
      if (onUpdate) onUpdate();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!child) return null;

  const isFrozen = walletData?.is_frozen;

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#0A0A0A] rounded-t-3xl sm:rounded-3xl border border-white/10"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0A0A0A] border-b border-white/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== 'wallet' && (
              <motion.button
                onClick={() => setView('wallet')}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
              >
                <ArrowLeft size={16} />
              </motion.button>
            )}
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{ background: child.color || '#00C2FF' }}>
              {child.avatar || child.name?.[0]}
            </div>
            <div>
              <h3 className="font-semibold text-white">{child.name}</h3>
              <p className="text-xs text-gray-500">
                {view === 'wallet' && 'Wallet'}
                {view === 'transfer' && 'Geld senden'}
                {view === 'limits' && 'Limits'}
                {view === 'activity' && 'Aktivität'}
              </p>
            </div>
          </div>
          <motion.button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            ✕
          </motion.button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Success/Error Messages */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2"
              >
                <Check size={16} className="text-green-400" />
                <span className="text-green-400 text-sm">{success}</span>
              </motion.div>
            )}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2"
              >
                <AlertCircle size={16} className="text-red-400" />
                <span className="text-red-400 text-sm">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="text-[#00C2FF] animate-spin" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {/* WALLET VIEW */}
              {view === 'wallet' && (
                <motion.div
                  key="wallet"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {/* Frozen Banner */}
                  {isFrozen && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                      <Lock size={16} className="text-red-400" />
                      <span className="text-red-400 text-sm font-medium">Wallet gesperrt</span>
                    </div>
                  )}

                  {/* Balance Card */}
                  <div className={`p-5 rounded-2xl ${isFrozen ? 'bg-gray-500/10' : 'bg-gradient-to-br from-[#00C2FF]/10 to-[#A855F7]/10'} border ${isFrozen ? 'border-gray-500/20' : 'border-[#00C2FF]/20'}`}>
                    <p className="text-xs text-gray-400 mb-1">Guthaben</p>
                    <p className={`text-3xl font-bold ${isFrozen ? 'text-gray-400' : 'text-white'}`}>
                      €{(walletData?.balance || 0).toFixed(2)}
                    </p>
                  </div>

                  {/* Spending Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <p className="text-xs text-gray-500 mb-1">Heute ausgegeben</p>
                      <p className="text-lg font-bold text-white">€{(walletData?.today_spent || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">von €{walletData?.daily_limit || 20}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-[#00C2FF]"
                          style={{ width: `${Math.min((walletData?.today_spent || 0) / (walletData?.daily_limit || 20) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <p className="text-xs text-gray-500 mb-1">Diese Woche</p>
                      <p className="text-lg font-bold text-white">€{(walletData?.week_spent || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">von €{walletData?.weekly_limit || 50}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-[#A855F7]"
                          style={{ width: `${Math.min((walletData?.week_spent || 0) / (walletData?.weekly_limit || 50) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-4 gap-2">
                    <motion.button
                      onClick={() => setView('transfer')}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#00C2FF]/10 border border-[#00C2FF]/20"
                      whileTap={{ scale: 0.95 }}
                    >
                      <Send size={18} className="text-[#00C2FF]" />
                      <span className="text-[10px] text-[#00C2FF] font-medium">Senden</span>
                    </motion.button>
                    <motion.button
                      onClick={() => setView('limits')}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#A855F7]/10 border border-[#A855F7]/20"
                      whileTap={{ scale: 0.95 }}
                    >
                      <Settings size={18} className="text-[#A855F7]" />
                      <span className="text-[10px] text-[#A855F7] font-medium">Limits</span>
                    </motion.button>
                    <motion.button
                      onClick={() => { setView('activity'); loadActivity(); }}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#FFB800]/10 border border-[#FFB800]/20"
                      whileTap={{ scale: 0.95 }}
                    >
                      <Clock size={18} className="text-[#FFB800]" />
                      <span className="text-[10px] text-[#FFB800] font-medium">Aktivität</span>
                    </motion.button>
                    <motion.button
                      onClick={handleToggleFreeze}
                      disabled={actionLoading}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl ${isFrozen ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'} border`}
                      whileTap={{ scale: 0.95 }}
                    >
                      {isFrozen ? <Unlock size={18} className="text-green-400" /> : <Lock size={18} className="text-red-400" />}
                      <span className={`text-[10px] font-medium ${isFrozen ? 'text-green-400' : 'text-red-400'}`}>
                        {isFrozen ? 'Entsperren' : 'Sperren'}
                      </span>
                    </motion.button>
                  </div>

                  {/* Recent Transactions */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-white">Letzte Transaktionen</h4>
                      <button onClick={loadWalletData} className="text-xs text-[#00C2FF]">
                        <RefreshCw size={14} />
                      </button>
                    </div>
                    {walletData?.transactions?.length > 0 ? (
                      <div className="space-y-2">
                        {walletData.transactions.slice(0, 5).map((tx, i) => (
                          <div key={tx.id || i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                {tx.amount > 0 ? <TrendingUp size={14} className="text-green-400" /> : <TrendingDown size={14} className="text-red-400" />}
                              </div>
                              <div>
                                <p className="text-sm text-white">{tx.description || (tx.amount > 0 ? 'Eingang' : 'Zahlung')}</p>
                                <p className="text-xs text-gray-500">{tx.created_at?.slice(0, 10)}</p>
                              </div>
                            </div>
                            <span className={`font-semibold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {tx.amount > 0 ? '+' : ''}€{Math.abs(tx.amount).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        Noch keine Transaktionen
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* TRANSFER VIEW */}
              {view === 'transfer' && (
                <motion.div
                  key="transfer"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="p-4 rounded-xl bg-[#00C2FF]/5 border border-[#00C2FF]/10">
                    <p className="text-xs text-gray-400 mb-1">Dein Wallet</p>
                    <p className="text-xl font-bold text-white">€{(walletData?.child?.balance || 0).toFixed(2)}</p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Betrag</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white font-bold">€</span>
                      <input
                        type="number"
                        step="0.50"
                        min="0.50"
                        max="100"
                        placeholder="0.00"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        className="w-full pl-10 pr-4 py-4 bg-[#141414] border border-white/10 rounded-xl text-white text-lg font-bold placeholder-gray-500"
                      />
                    </div>
                  </div>

                  {/* Quick amounts */}
                  <div className="flex gap-2">
                    {[5, 10, 20, 50].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setTransferAmount(amt.toString())}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium ${parseFloat(transferAmount) === amt ? 'bg-[#00C2FF] text-black' : 'bg-white/5 text-white/60'}`}
                      >
                        €{amt}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Nachricht (optional)</label>
                    <input
                      type="text"
                      placeholder="z.B. Taschengeld"
                      value={transferNote}
                      onChange={(e) => setTransferNote(e.target.value)}
                      maxLength={50}
                      className="w-full px-4 py-3 bg-[#141414] border border-white/10 rounded-xl text-white placeholder-gray-500"
                    />
                  </div>

                  <motion.button
                    onClick={handleTransfer}
                    disabled={actionLoading || !transferAmount || parseFloat(transferAmount) <= 0}
                    className="w-full py-4 bg-[#00C2FF] text-black font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
                    whileTap={{ scale: 0.98 }}
                  >
                    {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    €{parseFloat(transferAmount) || 0} an {child.name} senden
                  </motion.button>
                </motion.div>
              )}

              {/* LIMITS VIEW */}
              {view === 'limits' && (
                <motion.div
                  key="limits"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-gray-400">Tageslimit</label>
                      <span className="text-lg font-bold text-[#00C2FF]">€{dailyLimit}</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(Number(e.target.value))}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#00C2FF]"
                      style={{ background: `linear-gradient(to right, #00C2FF ${dailyLimit}%, #333 ${dailyLimit}%)` }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>€5</span>
                      <span>€100</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-gray-400">Wochenlimit</label>
                      <span className="text-lg font-bold text-[#A855F7]">€{weeklyLimit}</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={200}
                      step={10}
                      value={weeklyLimit}
                      onChange={(e) => setWeeklyLimit(Number(e.target.value))}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#A855F7]"
                      style={{ background: `linear-gradient(to right, #A855F7 ${weeklyLimit / 2}%, #333 ${weeklyLimit / 2}%)` }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>€10</span>
                      <span>€200</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <p className="text-xs text-gray-400 mb-2">Info</p>
                    <p className="text-sm text-gray-300">
                      {child.name} kann maximal <strong>€{dailyLimit}</strong> pro Tag und <strong>€{weeklyLimit}</strong> pro Woche ausgeben.
                    </p>
                  </div>

                  <motion.button
                    onClick={handleSaveLimits}
                    disabled={actionLoading}
                    className="w-full py-4 bg-[#A855F7] text-white font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
                    whileTap={{ scale: 0.98 }}
                  >
                    {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    Limits speichern
                  </motion.button>
                </motion.div>
              )}

              {/* ACTIVITY VIEW */}
              {view === 'activity' && (
                <motion.div
                  key="activity"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {activity?.stats && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <p className="text-xs text-gray-400">Gesamt ausgegeben</p>
                        <p className="text-lg font-bold text-red-400">€{activity.stats.total_spent}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                        <p className="text-xs text-gray-400">Erhalten</p>
                        <p className="text-lg font-bold text-green-400">€{activity.stats.total_received}</p>
                      </div>
                    </div>
                  )}

                  {activity?.top_merchants?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-white mb-2">Top Händler</h4>
                      <div className="space-y-2">
                        {activity.top_merchants.map((m, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                            <div className="flex items-center gap-2">
                              <ShoppingBag size={14} className="text-gray-400" />
                              <span className="text-sm text-white">{m.name}</span>
                            </div>
                            <span className="text-sm text-gray-400">€{m.amount}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Alle Transaktionen</h4>
                    {activity?.transactions?.length > 0 ? (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {activity.transactions.map((tx, i) => (
                          <div key={tx.id || i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                {tx.amount > 0 ? <TrendingUp size={14} className="text-green-400" /> : <ShoppingBag size={14} className="text-red-400" />}
                              </div>
                              <div>
                                <p className="text-sm text-white">{tx.merchant_name || tx.description}</p>
                                <p className="text-xs text-gray-500">{tx.created_at?.slice(0, 16).replace('T', ' ')}</p>
                              </div>
                            </div>
                            <span className={`font-semibold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {tx.amount > 0 ? '+' : ''}€{Math.abs(tx.amount).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        Keine Aktivität in den letzten 30 Tagen
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ChildWalletModal;
