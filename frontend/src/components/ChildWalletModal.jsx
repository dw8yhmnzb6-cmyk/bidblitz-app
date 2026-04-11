/**
 * BidBlitz V2 - Child Detail Page
 * Complete child wallet management and detail view for parents
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Wallet, Send, Lock, Unlock, Settings, Clock,
  TrendingDown, TrendingUp, Loader2, AlertCircle, Check,
  ShoppingBag, RefreshCw, AlertTriangle, Edit3, Trash2,
  Gift, CreditCard, X
} from 'lucide-react';
import { api } from '../services/api';
import { useUser } from '../store';

const ChildWalletModal = ({ child, onClose, onUpdate }) => {
  const user = useUser();
  const [view, setView] = useState('detail'); // detail, transfer, limits, history, edit
  const [walletData, setWalletData] = useState(null);
  const [allTransactions, setAllTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Parent balance - loaded from API
  const [parentBalance, setParentBalance] = useState(user?.balance || 0);
  
  // Transfer state
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Limits state - ZEITLIMITS (Bildschirmzeit in Minuten)
  const [dailyLimit, setDailyLimit] = useState(120); // 2 Stunden default
  const [weeklyLimit, setWeeklyLimit] = useState(840); // 14 Stunden default
  
  // Edit state
  const [editName, setEditName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Current child state (for real-time updates)
  const [currentChild, setCurrentChild] = useState(child);

  // Load parent balance from API
  const loadParentBalance = useCallback(async () => {
    try {
      const data = await api.getWalletBalance();
      setParentBalance(data.balance || 0);
    } catch (err) {
      // Fallback to user store
      setParentBalance(user?.balance || 0);
    }
  }, [user?.balance]);

  // Load wallet data
  const loadWalletData = useCallback(async () => {
    try {
      const data = await api.getChildWallet(child.child_id);
      setWalletData(data);
      setCurrentChild(prev => ({ ...prev, ...data.child, is_frozen: data.is_frozen }));
      // Zeitlimits in Minuten (default: 2h/Tag, 14h/Woche)
      setDailyLimit(data.daily_screen_limit || 120);
      setWeeklyLimit(data.weekly_screen_limit || 840);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [child.child_id]);

  // Load full transaction history
  const loadFullHistory = useCallback(async () => {
    setTxLoading(true);
    try {
      const data = await api.getChildActivity(child.child_id, 90);
      setAllTransactions(data.transactions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setTxLoading(false);
    }
  }, [child.child_id]);

  useEffect(() => {
    loadWalletData();
    loadParentBalance();
  }, [loadWalletData, loadParentBalance]);

  // Clear messages after delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Transfer money to child
  const handleTransfer = async () => {
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0) {
      setError('Bitte gültigen Betrag eingeben');
      return;
    }
    if (amount > parentBalance) {
      setError('Nicht genug Guthaben');
      return;
    }
    
    // Show confirmation for amounts > €20
    if (amount > 20 && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    
    setActionLoading(true);
    setError(null);
    setShowConfirm(false);
    try {
      const result = await api.transferToChild(child.child_id, {
        child_id: child.child_id,
        amount,
        note: transferNote || undefined
      });
      setSuccess(result.message || `€${amount.toFixed(2)} gesendet!`);
      setTransferAmount('');
      setTransferNote('');
      await loadWalletData();
      if (onUpdate) onUpdate();
      setTimeout(() => setView('detail'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Save limits - ZEITLIMITS
  const handleSaveLimits = async () => {
    if (dailyLimit < 15 || weeklyLimit < 60) {
      setError('Minimum: 15 Min/Tag, 1 Std/Woche');
      return;
    }
    if (dailyLimit * 7 > weeklyLimit * 1.5) {
      setError('Wochenlimit sollte zum Tageslimit passen');
      return;
    }
    
    setActionLoading(true);
    setError(null);
    try {
      await api.setChildLimits(child.child_id, {
        daily_screen_limit: dailyLimit,
        weekly_screen_limit: weeklyLimit
      });
      setSuccess('Zeitlimits gespeichert');
      await loadWalletData();
      if (onUpdate) onUpdate();
      setTimeout(() => setView('detail'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle freeze/unfreeze
  const handleToggleFreeze = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const result = await api.freezeChild(child.child_id);
      setCurrentChild(prev => ({ ...prev, is_frozen: result.is_frozen }));
      setSuccess(result.message);
      await loadWalletData();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Update child name
  const handleUpdateName = async () => {
    if (!editName.trim()) {
      setError('Name erforderlich');
      return;
    }
    
    setActionLoading(true);
    setError(null);
    try {
      await api.updateChild(child.child_id, { name: editName.trim() });
      setCurrentChild(prev => ({ ...prev, name: editName.trim() }));
      setSuccess('Name aktualisiert');
      if (onUpdate) onUpdate();
      setTimeout(() => setView('detail'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete child
  const handleDeleteChild = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await api.deleteChild(child.child_id);
      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      setError(err.message);
      setActionLoading(false);
    }
  };

  if (!child) return null;

  const isFrozen = currentChild?.is_frozen || walletData?.is_frozen;
  const balance = walletData?.balance || 0;
  const todaySpent = walletData?.today_spent || 0;
  const weekSpent = walletData?.week_spent || 0;
  const currentDailyLimit = walletData?.daily_limit || 20;
  const currentWeeklyLimit = walletData?.weekly_limit || 50;
  const remainingDaily = Math.max(0, currentDailyLimit - todaySpent);
  const transactions = walletData?.transactions || [];

  // Transaction type helper
  const getTxType = (tx) => {
    if (tx.type === 'allowance') return { label: 'Taschengeld', color: 'green', icon: Gift };
    if (tx.type === 'payment') return { label: 'Zahlung', color: 'red', icon: ShoppingBag };
    if (tx.amount > 0) return { label: 'Eingang', color: 'green', icon: TrendingUp };
    return { label: 'Ausgabe', color: 'red', icon: TrendingDown };
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      
      <motion.div
        className="relative w-full max-w-md max-h-[92vh] overflow-hidden bg-[#0A0A0A] rounded-t-3xl sm:rounded-3xl border border-white/10 flex flex-col"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0A0A0A] border-b border-white/5 p-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {view !== 'detail' && (
              <motion.button
                onClick={() => setView('detail')}
                className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
              >
                <ArrowLeft size={18} className="text-white/70" />
              </motion.button>
            )}
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg relative ${isFrozen ? 'opacity-60' : ''}`}
              style={{ background: `${currentChild.color || '#00C2FF'}30`, border: `2px solid ${currentChild.color || '#00C2FF'}60` }}>
              {currentChild.avatar || currentChild.name?.[0]}
              {isFrozen && (
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                  <Lock size={10} className="text-white" />
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white text-[15px]">{currentChild.name}</h3>
              <div className="flex items-center gap-2">
                {isFrozen ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">GESPERRT</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-bold">AKTIV</span>
                )}
                <span className="text-[11px] text-gray-500">
                  {view === 'detail' && 'Details'}
                  {view === 'transfer' && 'Geld senden'}
                  {view === 'limits' && 'Zeitlimits bearbeiten'}
                  {view === 'history' && 'Transaktionen'}
                  {view === 'edit' && 'Bearbeiten'}
                </span>
              </div>
            </div>
          </div>
          <motion.button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <X size={18} className="text-white/70" />
          </motion.button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Success/Error Messages */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2"
              >
                <Check size={16} className="text-green-400 flex-shrink-0" />
                <span className="text-green-400 text-[13px] font-medium">{success}</span>
              </motion.div>
            )}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2"
              >
                <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                <span className="text-red-400 text-[13px] font-medium">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="text-[#00C2FF] animate-spin" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              
              {/* ═══════════════════════════════════════════════════════════ */}
              {/* 1. DETAIL VIEW */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {view === 'detail' && (
                <motion.div
                  key="detail"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {/* Frozen Warning */}
                  {isFrozen && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                      <Lock size={18} className="text-red-400 flex-shrink-0" />
                      <div>
                        <p className="text-red-400 text-[13px] font-semibold">Wallet gesperrt</p>
                        <p className="text-red-400/70 text-[11px]">Keine Zahlungen möglich</p>
                      </div>
                    </div>
                  )}

                  {/* Balance Card */}
                  <div className={`p-5 rounded-2xl relative overflow-hidden ${isFrozen ? 'bg-gray-500/5' : 'bg-gradient-to-br from-[#00C2FF]/10 to-[#A855F7]/10'}`}
                    style={{ border: `1px solid ${isFrozen ? 'rgba(100,100,100,0.2)' : 'rgba(0,194,255,0.2)'}` }}>
                    <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full opacity-30"
                      style={{ background: currentChild.color || '#00C2FF', filter: 'blur(25px)' }} />
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">Guthaben</p>
                    <p className={`text-[36px] font-bold font-outfit ${isFrozen ? 'text-gray-400' : 'text-white'}`}>
                      €{balance.toFixed(2)}
                    </p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Heute ausgegeben</p>
                      <p className="text-[20px] font-bold text-white">€{todaySpent.toFixed(2)}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-gray-500">Limit: €{currentDailyLimit}</span>
                        <span className="text-[10px] text-[#00D26A] font-medium">€{remainingDaily.toFixed(2)} übrig</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <motion.div 
                          className="h-full rounded-full"
                          style={{ background: todaySpent > currentDailyLimit * 0.8 ? '#FF4757' : '#00C2FF' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((todaySpent / currentDailyLimit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Diese Woche</p>
                      <p className="text-[20px] font-bold text-white">€{weekSpent.toFixed(2)}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-gray-500">Limit: €{currentWeeklyLimit}</span>
                        <span className="text-[10px] text-[#A855F7] font-medium">€{Math.max(0, currentWeeklyLimit - weekSpent).toFixed(2)} übrig</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <motion.div 
                          className="h-full rounded-full bg-[#A855F7]"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((weekSpent / currentWeeklyLimit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button
                      onClick={() => setView('transfer')}
                      className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#00C2FF] text-black font-semibold text-[13px]"
                      whileTap={{ scale: 0.97 }}
                    >
                      <Send size={16} /> Geld senden
                    </motion.button>
                    <motion.button
                      onClick={() => setView('limits')}
                      className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#A855F7]/15 text-[#A855F7] font-semibold text-[13px] border border-[#A855F7]/20"
                      whileTap={{ scale: 0.97 }}
                    >
                      <Settings size={16} /> Limits
                    </motion.button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <motion.button
                      onClick={() => { setView('history'); loadFullHistory(); }}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/[0.03] border border-white/5"
                      whileTap={{ scale: 0.97 }}
                    >
                      <Clock size={16} className="text-[#FFB800]" />
                      <span className="text-[10px] text-gray-400 font-medium">Historie</span>
                    </motion.button>
                    <motion.button
                      onClick={() => { setEditName(currentChild.name); setView('edit'); }}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/[0.03] border border-white/5"
                      whileTap={{ scale: 0.97 }}
                    >
                      <Edit3 size={16} className="text-gray-400" />
                      <span className="text-[10px] text-gray-400 font-medium">Bearbeiten</span>
                    </motion.button>
                    <motion.button
                      onClick={handleToggleFreeze}
                      disabled={actionLoading}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border ${
                        isFrozen 
                          ? 'bg-green-500/10 border-green-500/20' 
                          : 'bg-red-500/10 border-red-500/20'
                      }`}
                      whileTap={{ scale: 0.97 }}
                    >
                      {actionLoading ? (
                        <Loader2 size={16} className="animate-spin text-gray-400" />
                      ) : isFrozen ? (
                        <Unlock size={16} className="text-green-400" />
                      ) : (
                        <Lock size={16} className="text-red-400" />
                      )}
                      <span className={`text-[10px] font-medium ${isFrozen ? 'text-green-400' : 'text-red-400'}`}>
                        {isFrozen ? 'Aktivieren' : 'Sperren'}
                      </span>
                    </motion.button>
                  </div>

                  {/* Recent Transactions */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-[12px] font-semibold text-white uppercase tracking-wider">Letzte Aktivitäten</h4>
                      <button onClick={loadWalletData} className="p-1.5 rounded-lg hover:bg-white/5">
                        <RefreshCw size={14} className="text-gray-500" />
                      </button>
                    </div>
                    {transactions.length > 0 ? (
                      <div className="space-y-2">
                        {transactions.slice(0, 5).map((tx, i) => {
                          const txType = getTxType(tx);
                          const TxIcon = txType.icon;
                          return (
                            <div key={tx.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${txType.color === 'green' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                <TxIcon size={16} className={txType.color === 'green' ? 'text-green-400' : 'text-red-400'} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] text-white font-medium truncate">
                                  {tx.merchant_name || tx.description || txType.label}
                                </p>
                                <p className="text-[10px] text-gray-500">
                                  {new Date(tx.created_at).toLocaleDateString('de-DE', { 
                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                                  })}
                                </p>
                              </div>
                              <span className={`text-[14px] font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {tx.amount > 0 ? '+' : ''}€{Math.abs(tx.amount).toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                        {transactions.length > 5 && (
                          <button 
                            onClick={() => { setView('history'); loadFullHistory(); }}
                            className="w-full py-2 text-[12px] text-[#00C2FF] font-medium"
                          >
                            Alle {transactions.length} Transaktionen anzeigen →
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 rounded-xl bg-white/[0.01] border border-dashed border-white/5">
                        <CreditCard size={24} className="text-gray-600 mx-auto mb-2" />
                        <p className="text-[12px] text-gray-500">Noch keine Transaktionen</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* 2. TRANSFER VIEW */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {view === 'transfer' && (
                <motion.div
                  key="transfer"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {/* Parent Balance */}
                  <div className="p-4 rounded-xl bg-[#00C2FF]/5 border border-[#00C2FF]/10">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Dein Guthaben</p>
                    <p className="text-[24px] font-bold text-white">€{parentBalance.toFixed(2)}</p>
                  </div>

                  {/* Recipient */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                      style={{ background: `${currentChild.color}30`, border: `2px solid ${currentChild.color}50` }}>
                      {currentChild.avatar || currentChild.name?.[0]}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-white">An: {currentChild.name}</p>
                      <p className="text-[11px] text-gray-500">Aktuell: €{balance.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <label className="text-[11px] text-gray-400 mb-2 block uppercase tracking-wider">Betrag</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold text-lg">€</span>
                      <input
                        type="number"
                        step="0.50"
                        min="0.50"
                        max={parentBalance}
                        placeholder="0.00"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        className="w-full pl-10 pr-4 py-4 bg-[#141414] border border-white/10 rounded-xl text-white text-xl font-bold placeholder-gray-600 focus:border-[#00C2FF]/50 outline-none transition"
                      />
                    </div>
                    {parseFloat(transferAmount) > parentBalance && (
                      <p className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1">
                        <AlertCircle size={12} /> Nicht genug Guthaben
                      </p>
                    )}
                  </div>

                  {/* Quick Amounts */}
                  <div className="flex gap-2">
                    {[5, 10, 20, 50].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setTransferAmount(amt.toString())}
                        disabled={amt > parentBalance}
                        className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition ${
                          parseFloat(transferAmount) === amt 
                            ? 'bg-[#00C2FF] text-black' 
                            : amt > parentBalance 
                              ? 'bg-white/5 text-white/20 cursor-not-allowed'
                              : 'bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        €{amt}
                      </button>
                    ))}
                  </div>

                  {/* Note */}
                  <div>
                    <label className="text-[11px] text-gray-400 mb-2 block uppercase tracking-wider">Nachricht (optional)</label>
                    <input
                      type="text"
                      placeholder="z.B. Taschengeld"
                      value={transferNote}
                      onChange={(e) => setTransferNote(e.target.value)}
                      maxLength={50}
                      className="w-full px-4 py-3 bg-[#141414] border border-white/10 rounded-xl text-white placeholder-gray-600 focus:border-white/20 outline-none transition"
                    />
                  </div>

                  {/* Confirmation Dialog */}
                  <AnimatePresence>
                    {showConfirm && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle size={18} className="text-yellow-400" />
                          <span className="text-[13px] font-semibold text-yellow-400">Bestätigung</span>
                        </div>
                        <p className="text-[12px] text-gray-400 mb-3">
                          Du sendest <strong className="text-white">€{parseFloat(transferAmount).toFixed(2)}</strong> an {currentChild.name}. Fortfahren?
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 bg-white/5 rounded-xl text-[13px] text-gray-400 font-medium">
                            Abbrechen
                          </button>
                          <button onClick={handleTransfer} className="flex-1 py-2.5 bg-[#00C2FF] rounded-xl text-[13px] font-bold text-black">
                            Bestätigen
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Send Button */}
                  <motion.button
                    onClick={handleTransfer}
                    disabled={actionLoading || !transferAmount || parseFloat(transferAmount) <= 0 || parseFloat(transferAmount) > parentBalance}
                    className="w-full py-4 bg-[#00C2FF] text-black font-bold text-[14px] rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
                    whileTap={{ scale: 0.98 }}
                  >
                    {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    €{parseFloat(transferAmount) || 0} senden
                  </motion.button>
                </motion.div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* 3. LIMITS VIEW */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {view === 'limits' && (
                <motion.div
                  key="limits"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  {/* Daily Screen Time Limit */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <label className="text-[13px] text-white font-medium">Tägliche Bildschirmzeit</label>
                        <p className="text-[10px] text-gray-500">Maximum pro Tag</p>
                      </div>
                      <span className="text-[22px] font-bold text-[#00C2FF]">
                        {Math.floor(dailyLimit / 60)}h {dailyLimit % 60}m
                      </span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={480}
                      step={15}
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(Number(e.target.value))}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, #00C2FF ${(dailyLimit / 480) * 100}%, #222 ${(dailyLimit / 480) * 100}%)` }}
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-2">
                      <span>15 Min</span>
                      <span>8 Std</span>
                    </div>
                  </div>

                  {/* Weekly Screen Time Limit */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <label className="text-[13px] text-white font-medium">Wöchentliche Bildschirmzeit</label>
                        <p className="text-[10px] text-gray-500">Maximum pro Woche</p>
                      </div>
                      <span className="text-[22px] font-bold text-[#A855F7]">
                        {Math.floor(weeklyLimit / 60)}h
                      </span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={2520}
                      step={60}
                      value={weeklyLimit}
                      onChange={(e) => setWeeklyLimit(Number(e.target.value))}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, #A855F7 ${(weeklyLimit / 2520) * 100}%, #222 ${(weeklyLimit / 2520) * 100}%)` }}
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-2">
                      <span>1 Std</span>
                      <span>42 Std</span>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="p-4 rounded-xl bg-[#A855F7]/5 border border-[#A855F7]/10">
                    <p className="text-[12px] text-gray-400">
                      <strong className="text-white">{currentChild.name}</strong> kann maximal <strong className="text-[#00C2FF]">{Math.floor(dailyLimit / 60)}h {dailyLimit % 60}m</strong> pro Tag 
                      und <strong className="text-[#A855F7]">{Math.floor(weeklyLimit / 60)} Stunden</strong> pro Woche am Bildschirm sein.
                    </p>
                  </div>

                  {/* Validation Warning */}
                  {dailyLimit * 7 > weeklyLimit * 1.5 && (
                    <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
                      <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />
                      <span className="text-yellow-400 text-[12px]">Wochenlimit sollte zum Tageslimit passen</span>
                    </div>
                  )}

                  {/* Save Button */}
                  <motion.button
                    onClick={handleSaveLimits}
                    disabled={actionLoading || dailyLimit * 7 > weeklyLimit * 1.5}
                    className="w-full py-4 bg-[#A855F7] text-white font-bold text-[14px] rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
                    whileTap={{ scale: 0.98 }}
                  >
                    {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    Zeitlimits speichern
                  </motion.button>
                </motion.div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* 4. FULL HISTORY VIEW */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {view === 'history' && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-[13px] font-semibold text-white">Alle Transaktionen</h4>
                    <span className="text-[11px] text-gray-500">{allTransactions.length} Einträge</span>
                  </div>

                  {txLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 size={24} className="text-[#00C2FF] animate-spin" />
                    </div>
                  ) : allTransactions.length > 0 ? (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {allTransactions.map((tx, i) => {
                        const txType = getTxType(tx);
                        const TxIcon = txType.icon;
                        return (
                          <div key={tx.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${txType.color === 'green' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                              <TxIcon size={16} className={txType.color === 'green' ? 'text-green-400' : 'text-red-400'} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-white font-medium truncate">
                                {tx.merchant_name || tx.description || txType.label}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500">
                                  {new Date(tx.created_at).toLocaleDateString('de-DE', { 
                                    day: '2-digit', month: '2-digit', year: '2-digit'
                                  })}
                                </span>
                                <span className="text-[10px] text-gray-600">•</span>
                                <span className="text-[10px] text-gray-500">
                                  {new Date(tx.created_at).toLocaleTimeString('de-DE', { 
                                    hour: '2-digit', minute: '2-digit'
                                  })}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${txType.color === 'green' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                  {txType.label}
                                </span>
                              </div>
                            </div>
                            <span className={`text-[14px] font-bold flex-shrink-0 ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {tx.amount > 0 ? '+' : ''}€{Math.abs(tx.amount).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 rounded-xl bg-white/[0.01] border border-dashed border-white/5">
                      <Clock size={28} className="text-gray-600 mx-auto mb-2" />
                      <p className="text-[13px] text-gray-500">Keine Transaktionen in den letzten 90 Tagen</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* 5. EDIT VIEW */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {view === 'edit' && (
                <motion.div
                  key="edit"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  {/* Edit Name */}
                  <div>
                    <label className="text-[11px] text-gray-400 mb-2 block uppercase tracking-wider">Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Name des Kindes"
                      maxLength={50}
                      className="w-full px-4 py-3.5 bg-[#141414] border border-white/10 rounded-xl text-white placeholder-gray-600 focus:border-[#00C2FF]/50 outline-none transition"
                    />
                  </div>

                  <motion.button
                    onClick={handleUpdateName}
                    disabled={actionLoading || !editName.trim() || editName.trim() === currentChild.name}
                    className="w-full py-3.5 bg-[#00C2FF] text-black font-bold text-[14px] rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
                    whileTap={{ scale: 0.98 }}
                  >
                    {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    Speichern
                  </motion.button>

                  {/* Danger Zone */}
                  <div className="pt-4 border-t border-white/5">
                    <p className="text-[11px] text-red-400 uppercase tracking-wider mb-3">Gefahrenzone</p>
                    
                    {!showDeleteConfirm ? (
                      <motion.button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 font-medium text-[13px] flex items-center justify-center gap-2"
                        whileTap={{ scale: 0.98 }}
                      >
                        <Trash2 size={16} /> Kind entfernen
                      </motion.button>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 rounded-xl bg-red-500/10 border border-red-500/20"
                      >
                        <p className="text-[12px] text-red-400 mb-3">
                          <strong>{currentChild.name}</strong> und alle Transaktionen werden gelöscht. Das kann nicht rückgängig gemacht werden!
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 bg-white/5 rounded-xl text-[13px] text-gray-400 font-medium">
                            Abbrechen
                          </button>
                          <button onClick={handleDeleteChild} disabled={actionLoading} className="flex-1 py-2.5 bg-red-500 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-1">
                            {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            Löschen
                          </button>
                        </div>
                      </motion.div>
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
