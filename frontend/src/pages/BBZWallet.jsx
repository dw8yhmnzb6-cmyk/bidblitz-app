/**
 * BidBlitz Coin (BBZ) Wallet
 * Blockchain wallet integration for BNB Smart Chain
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function BBZWallet() {
  const [walletStatus, setWalletStatus] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState(100);
  const [transferAddress, setTransferAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState(10);
  const [withdrawals, setWithdrawals] = useState([]);
  const [activeTab, setActiveTab] = useState('wallet');
  const [loading, setLoading] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [statusRes, infoRes, withdrawalsRes] = await Promise.all([
        axios.get(`${API}/app/bbz/wallet/status`, { headers }),
        axios.get(`${API}/app/bbz/info`),
        axios.get(`${API}/app/bbz/withdrawals`, { headers })
      ]);

      setWalletStatus(statusRes.data);
      setTokenInfo(infoRes.data);
      setWithdrawals(withdrawalsRes.data.withdrawals || []);
    } catch (error) {
      console.log('Fetch error');
    }
  };

  const connectWallet = async () => {
    if (!walletAddress || !walletAddress.startsWith('0x')) {
      setResult({ type: 'error', message: 'Ungültige Adresse! Muss mit 0x beginnen.' });
      setTimeout(() => setResult(''), 3000);
      return;
    }

    setLoading('connect');
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await axios.post(`${API}/app/bbz/wallet/connect`, 
        { wallet_address: walletAddress }, 
        { headers }
      );

      setResult({ type: 'success', message: res.data.message });
      fetchData();
      setWalletAddress('');
    } catch (error) {
      setResult({ type: 'error', message: error.response?.data?.detail || 'Fehler' });
    } finally {
      setLoading('');
      setTimeout(() => setResult(''), 3000);
    }
  };

  const disconnectWallet = async () => {
    setLoading('disconnect');
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await axios.delete(`${API}/app/bbz/wallet/disconnect`, { headers });
      setResult({ type: 'success', message: 'Wallet getrennt' });
      fetchData();
    } catch (error) {
      setResult({ type: 'error', message: error.response?.data?.detail || 'Fehler' });
    } finally {
      setLoading('');
      setTimeout(() => setResult(''), 3000);
    }
  };

  const withdraw = async () => {
    if (!walletStatus?.blockchain_wallet?.connected) {
      setResult({ type: 'error', message: 'Bitte zuerst Wallet verbinden!' });
      setTimeout(() => setResult(''), 3000);
      return;
    }

    setLoading('withdraw');
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await axios.post(`${API}/app/bbz/withdraw`, 
        { amount: withdrawAmount }, 
        { headers }
      );

      setResult({ type: 'success', message: res.data.message });
      fetchData();
    } catch (error) {
      setResult({ type: 'error', message: error.response?.data?.detail || 'Fehler' });
    } finally {
      setLoading('');
      setTimeout(() => setResult(''), 3000);
    }
  };

  const transfer = async () => {
    setLoading('transfer');
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await axios.post(`${API}/app/bbz/transfer`, 
        { to_address: transferAddress, amount: transferAmount }, 
        { headers }
      );

      setResult({ type: 'success', message: res.data.message });
      fetchData();
      setTransferAddress('');
    } catch (error) {
      setResult({ type: 'error', message: error.response?.data?.detail || 'Fehler' });
    } finally {
      setLoading('');
      setTimeout(() => setResult(''), 3000);
    }
  };

  const tabs = [
    { id: 'balance', label: 'Balance', icon: '💰' },
    { id: 'send', label: 'Senden', icon: '📤' },
    { id: 'receive', label: 'Empfangen', icon: '📥' },
    { id: 'swap', label: 'Swap', icon: '🔄' },
    { id: 'history', label: 'Transaktionen', icon: '📋' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0e24] via-[#0f1332] to-[#0b0e24] text-white pb-24">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-60 h-60 bg-amber-500/10 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-40 -right-20 w-60 h-60 bg-purple-500/10 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/super-app" className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
              <span className="text-lg">←</span>
            </Link>
            <div>
              <h2 className="text-2xl font-bold">💎 BBZ Wallet</h2>
              <p className="text-xs text-slate-400">BidBlitz Coin • BNB Smart Chain</p>
            </div>
          </div>
          <div className="bg-amber-500/20 px-3 py-1.5 rounded-lg border border-amber-500/30">
            <span className="text-xs text-amber-400">Phase 1</span>
          </div>
        </div>

        {/* Result Toast */}
        {result && (
          <div className={`mb-4 p-4 rounded-xl text-center font-medium ${
            result.type === 'success' 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {result.message}
          </div>
        )}

        {/* Balance Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/10 p-4 rounded-2xl border border-amber-500/30">
            <p className="text-xs text-amber-400/80 mb-1">In-App Coins</p>
            <p className="text-2xl font-bold text-amber-400">
              {walletStatus?.app_wallet?.coins?.toLocaleString() || 0}
            </p>
            <p className="text-xs text-slate-400">= {walletStatus?.app_wallet?.coins || 0} BBZ</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/10 p-4 rounded-2xl border border-purple-500/30">
            <p className="text-xs text-purple-400/80 mb-1">Blockchain</p>
            <p className="text-lg font-bold text-purple-400">
              {walletStatus?.blockchain_wallet?.connected ? '🔗 Verbunden' : '❌ Nicht verbunden'}
            </p>
            {walletStatus?.blockchain_wallet?.address && (
              <p className="text-xs text-slate-400 truncate">
                {walletStatus.blockchain_wallet.address.slice(0, 8)}...{walletStatus.blockchain_wallet.address.slice(-6)}
              </p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Balance Tab */}
        {activeTab === 'balance' && (
          <div className="space-y-4">
            {/* Token Balance Card */}
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/10 p-6 rounded-2xl border border-amber-500/30 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                💎
              </div>
              <p className="text-4xl font-bold text-white mb-1">
                {walletStatus?.app_wallet?.coins?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-amber-400">BBZ Token</p>
              <p className="text-xs text-slate-400 mt-2">
                ≈ ${((walletStatus?.app_wallet?.coins || 0) * 0.01).toFixed(2)} USD
              </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-3">
              <button onClick={() => setActiveTab('send')} className="bg-white/5 p-4 rounded-xl text-center hover:bg-white/10 transition-all">
                <span className="text-2xl block mb-1">📤</span>
                <p className="text-xs text-slate-400">Senden</p>
              </button>
              <button onClick={() => setActiveTab('receive')} className="bg-white/5 p-4 rounded-xl text-center hover:bg-white/10 transition-all">
                <span className="text-2xl block mb-1">📥</span>
                <p className="text-xs text-slate-400">Empfangen</p>
              </button>
              <button onClick={() => setActiveTab('swap')} className="bg-white/5 p-4 rounded-xl text-center hover:bg-white/10 transition-all">
                <span className="text-2xl block mb-1">🔄</span>
                <p className="text-xs text-slate-400">Swap</p>
              </button>
              <Link to="/store" className="bg-white/5 p-4 rounded-xl text-center hover:bg-white/10 transition-all">
                <span className="text-2xl block mb-1">🛒</span>
                <p className="text-xs text-slate-400">Kaufen</p>
              </Link>
            </div>

            {/* Token Info */}
            <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-2xl">
                  💎
                </div>
                <div>
                  <p className="font-bold text-lg">BidBlitz Coin</p>
                  <p className="text-sm text-slate-400">BBZ • BNB Smart Chain</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-black/20 p-3 rounded-xl">
                  <p className="text-slate-400">Total Supply</p>
                  <p className="font-bold">1,000,000,000</p>
                </div>
                <div className="bg-black/20 p-3 rounded-xl">
                  <p className="text-slate-400">Exchange Rate</p>
                  <p className="font-bold">1:1</p>
                </div>
              </div>
            </div>

            {/* Wallet Connection */}
            <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🔗</span>
                <h3 className="font-semibold">Blockchain Wallet</h3>
              </div>

              {walletStatus?.blockchain_wallet?.connected ? (
                <div className="space-y-3">
                  <div className="bg-emerald-500/20 p-4 rounded-xl border border-emerald-500/30">
                    <p className="text-xs text-emerald-400 mb-1">Verbundene Adresse</p>
                    <p className="font-mono text-sm break-all">{walletStatus.blockchain_wallet.address}</p>
                  </div>
                  <button
                    onClick={disconnectWallet}
                    disabled={loading === 'disconnect'}
                    className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-medium transition-all border border-red-500/30"
                  >
                    {loading === 'disconnect' ? 'Wird getrennt...' : 'Wallet trennen'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder="0x... (BSC Wallet Adresse)"
                    className="w-full p-3.5 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none transition-all font-mono text-sm"
                  />
                  <button
                    onClick={connectWallet}
                    disabled={loading === 'connect'}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 rounded-xl font-semibold transition-all"
                  >
                    {loading === 'connect' ? 'Verbinden...' : '🔗 Wallet verbinden'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Withdraw Tab */}
        {activeTab === 'withdraw' && (
          <div className="space-y-4">
            <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">💸</span>
                <h3 className="font-semibold">Coins auszahlen</h3>
              </div>

              {!walletStatus?.blockchain_wallet?.connected ? (
                <div className="text-center py-8">
                  <span className="text-4xl mb-4 block">🔗</span>
                  <p className="text-slate-400 mb-4">Bitte zuerst eine Wallet verbinden</p>
                  <button
                    onClick={() => setActiveTab('balance')}
                    className="px-6 py-2 bg-amber-500 hover:bg-amber-600 rounded-xl font-medium transition-all"
                  >
                    Wallet verbinden
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-black/20 p-4 rounded-xl">
                    <p className="text-xs text-slate-400 mb-1">Verfügbar</p>
                    <p className="text-2xl font-bold text-amber-400">
                      {walletStatus?.app_wallet?.coins?.toLocaleString() || 0} Coins
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Betrag</label>
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                      min={100}
                      className="w-full p-3.5 rounded-xl bg-black/30 border border-white/10 text-white focus:border-amber-500 focus:outline-none transition-all"
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      Min. 100 • Gebühr: 2% (min. 10 Coins)
                    </p>
                  </div>

                  <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Auszahlung</span>
                      <span>{withdrawAmount} Coins</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Gebühr (2%)</span>
                      <span>-{Math.max(10, Math.floor(withdrawAmount * 0.02))} Coins</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-white/10 pt-2 mt-2">
                      <span>Du erhältst</span>
                      <span className="text-amber-400">{withdrawAmount} BBZ</span>
                    </div>
                  </div>

                  <button
                    onClick={withdraw}
                    disabled={loading === 'withdraw'}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 rounded-xl font-semibold transition-all disabled:opacity-50"
                  >
                    {loading === 'withdraw' ? 'Wird verarbeitet...' : '💸 Auszahlen'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Send Tab */}
        {activeTab === 'send' && (
          <div className="space-y-4">
            <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">📤</span>
                <h3 className="font-semibold">BBZ senden</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Empfänger-Adresse</label>
                  <input
                    type="text"
                    value={transferAddress}
                    onChange={(e) => setTransferAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full p-3.5 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition-all font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Betrag</label>
                  <input
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(Number(e.target.value))}
                    min={1}
                    className="w-full p-3.5 rounded-xl bg-black/30 border border-white/10 text-white focus:border-purple-500 focus:outline-none transition-all"
                  />
                </div>

                <button
                  onClick={transfer}
                  disabled={loading === 'transfer' || !transferAddress}
                  className="w-full py-3.5 bg-purple-500 hover:bg-purple-600 rounded-xl font-semibold transition-all disabled:opacity-50"
                >
                  {loading === 'transfer' ? 'Wird gesendet...' : '📤 Senden'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Receive Tab */}
        {activeTab === 'receive' && (
          <div className="space-y-4">
            <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">📥</span>
                <h3 className="font-semibold">BBZ empfangen</h3>
              </div>

              {walletStatus?.blockchain_wallet?.connected ? (
                <div className="space-y-4">
                  {/* QR Code Placeholder */}
                  <div className="bg-white p-4 rounded-2xl mx-auto w-fit">
                    <div className="w-48 h-48 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center">
                      <div className="text-center">
                        <span className="text-6xl block mb-2">📱</span>
                        <p className="text-xs text-slate-500">QR Code</p>
                      </div>
                    </div>
                  </div>

                  {/* Wallet Address */}
                  <div className="bg-black/20 p-4 rounded-xl">
                    <p className="text-xs text-slate-400 mb-2">Deine Wallet-Adresse</p>
                    <p className="font-mono text-sm break-all text-amber-400">
                      {walletStatus.blockchain_wallet.address}
                    </p>
                  </div>

                  {/* Copy Button */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(walletStatus.blockchain_wallet.address);
                      setResult({ type: 'success', message: 'Adresse kopiert! 📋' });
                      setTimeout(() => setResult(''), 2000);
                    }}
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-semibold transition-all"
                  >
                    📋 Adresse kopieren
                  </button>

                  <p className="text-xs text-center text-slate-400">
                    Sende nur BBZ oder BNB an diese Adresse!
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <span className="text-4xl mb-4 block">🔗</span>
                  <p className="text-slate-400 mb-4">Bitte zuerst eine Wallet verbinden</p>
                  <button
                    onClick={() => setActiveTab('balance')}
                    className="px-6 py-2 bg-amber-500 hover:bg-amber-600 rounded-xl font-medium transition-all"
                  >
                    Wallet verbinden
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Swap Tab */}
        {activeTab === 'swap' && (
          <div className="space-y-4">
            <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🔄</span>
                <h3 className="font-semibold">Token Swap</h3>
              </div>

              <div className="space-y-4">
                {/* From */}
                <div className="bg-black/20 p-4 rounded-xl">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-slate-400">Von</span>
                    <span className="text-xs text-slate-400">
                      Balance: {walletStatus?.app_wallet?.coins?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      placeholder="0.0"
                      className="flex-1 bg-transparent text-2xl font-bold focus:outline-none"
                    />
                    <div className="bg-amber-500/20 px-3 py-2 rounded-lg flex items-center gap-2">
                      <span>💎</span>
                      <span className="font-medium">BBZ</span>
                    </div>
                  </div>
                </div>

                {/* Swap Arrow */}
                <div className="flex justify-center">
                  <button className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-all">
                    ⬇️
                  </button>
                </div>

                {/* To */}
                <div className="bg-black/20 p-4 rounded-xl">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-slate-400">Zu</span>
                    <span className="text-xs text-slate-400">Balance: 0</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      placeholder="0.0"
                      className="flex-1 bg-transparent text-2xl font-bold focus:outline-none"
                      readOnly
                    />
                    <div className="bg-yellow-500/20 px-3 py-2 rounded-lg flex items-center gap-2">
                      <span>🟡</span>
                      <span className="font-medium">BNB</span>
                    </div>
                  </div>
                </div>

                {/* Swap Rate */}
                <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Rate</span>
                    <span>1 BBZ = 0.00001 BNB</span>
                  </div>
                </div>

                {/* Swap Button */}
                <button className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl font-semibold transition-all">
                  🔄 Swap (Coming Soon)
                </button>

                <p className="text-xs text-center text-slate-400">
                  Powered by PancakeSwap • Phase 2
                </p>
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">📋</span>
                <h3 className="font-semibold">Auszahlungen</h3>
              </div>

              {withdrawals.length === 0 ? (
                <p className="text-center text-slate-400 py-8">Keine Auszahlungen</p>
              ) : (
                <div className="space-y-2">
                  {withdrawals.map((w, idx) => (
                    <div key={idx} className="bg-black/20 p-4 rounded-xl flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        w.status === 'completed' ? 'bg-emerald-500/20' : 
                        w.status === 'pending' ? 'bg-amber-500/20' : 'bg-red-500/20'
                      }`}>
                        {w.status === 'completed' ? '✅' : w.status === 'pending' ? '⏳' : '❌'}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{w.amount} BBZ</p>
                        <p className="text-xs text-slate-400 truncate">{w.wallet_address?.slice(0, 12)}...</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${
                          w.status === 'completed' ? 'text-emerald-400' : 
                          w.status === 'pending' ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {w.status === 'completed' ? 'Abgeschlossen' : 
                           w.status === 'pending' ? 'Ausstehend' : 'Fehlgeschlagen'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
