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
    { id: 'wallet', label: 'Wallet', icon: '💎' },
    { id: 'withdraw', label: 'Auszahlen', icon: '💸' },
    { id: 'send', label: 'Senden', icon: '📤' },
    { id: 'history', label: 'Historie', icon: '📋' },
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

        {/* Wallet Tab */}
        {activeTab === 'wallet' && (
          <div className="space-y-4">
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

            {/* Connect Wallet */}
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

            {/* Roadmap */}
            <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
              <h3 className="font-semibold mb-4">🗺️ Roadmap</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-sm">✓</div>
                  <div>
                    <p className="font-medium">Phase 1: In-App Coin</p>
                    <p className="text-xs text-slate-400">Games, Mining, Rewards</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-500/50 rounded-full flex items-center justify-center text-sm animate-pulse">2</div>
                  <div>
                    <p className="font-medium">Phase 2: Blockchain Token</p>
                    <p className="text-xs text-slate-400">BNB Smart Chain Deployment</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-sm">3</div>
                  <div>
                    <p className="font-medium text-slate-400">Phase 3: Exchange Listing</p>
                    <p className="text-xs text-slate-500">DEX & CEX Trading</p>
                  </div>
                </div>
              </div>
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
                    onClick={() => setActiveTab('wallet')}
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
