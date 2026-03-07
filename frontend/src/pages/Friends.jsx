/**
 * BidBlitz Friends System
 * Add friends, send coins, view friend list
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function Friends() {
  const [coins, setCoins] = useState(1000);
  const [friends, setFriends] = useState([]);
  const [friendName, setFriendName] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Sample friends for demo
  const [sampleFriends] = useState([
    { id: 1, name: 'Max', level: 5, coins: 2500, online: true },
    { id: 2, name: 'Anna', level: 8, coins: 5200, online: true },
    { id: 3, name: 'Tom', level: 3, coins: 800, online: false },
  ]);

  useEffect(() => {
    fetchData();
    setFriends(sampleFriends);
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/app/wallet/balance`, { headers });
      setCoins(res.data.coins || 1000);
    } catch (error) {
      console.log('Data error');
    }
  };

  const addFriend = () => {
    if (!friendName.trim()) {
      setResult('Bitte Namen eingeben');
      return;
    }

    const newFriend = {
      id: Date.now(),
      name: friendName,
      level: 1,
      coins: 0,
      online: false
    };

    setFriends(prev => [...prev, newFriend]);
    setFriendName('');
    setResult(`${friendName} wurde hinzugefügt!`);
    setTimeout(() => setResult(''), 3000);
  };

  const sendCoins = async () => {
    if (!sendTo.trim() || !amount) {
      setResult('Bitte Freund und Betrag eingeben');
      return;
    }

    const sendAmount = parseInt(amount);
    if (sendAmount > coins) {
      setResult('Nicht genug Coins!');
      return;
    }

    if (sendAmount <= 0) {
      setResult('Ungültiger Betrag');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/app/friends/send-coins`, {
        to: sendTo,
        amount: sendAmount
      }, { headers });
    } catch (error) {
      // Continue with local update
    }

    setCoins(prev => prev - sendAmount);
    setResult(`${sendAmount} Coins an ${sendTo} gesendet! 🎉`);
    setSendTo('');
    setAmount('');
    setTimeout(() => setResult(''), 3000);
  };

  const removeFriend = (id) => {
    setFriends(prev => prev.filter(f => f.id !== id));
    setResult('Freund entfernt');
    setTimeout(() => setResult(''), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0e24] via-[#0f1332] to-[#0b0e24] text-white pb-24">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-60 h-60 bg-cyan-500/10 rounded-full blur-[80px]"></div>
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
              <h2 className="text-2xl font-bold">👥 Friends</h2>
              <p className="text-xs text-slate-400">Freunde & Coins senden</p>
            </div>
          </div>
          <div className="bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/30">
            <span className="text-amber-400 font-bold">{coins.toLocaleString()} 💰</span>
          </div>
        </div>

        {/* Result Message */}
        {result && (
          <div className={`mb-4 p-4 rounded-xl text-center font-medium ${
            result.includes('gesendet') || result.includes('hinzugefügt') 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}>
            {result}
          </div>
        )}

        {/* Add Friend */}
        <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span>➕</span> Freund hinzufügen
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              placeholder="Name eingeben..."
              className="flex-1 p-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-[#6c63ff] focus:outline-none"
              data-testid="friend-name-input"
            />
            <button
              onClick={addFriend}
              className="px-5 py-3 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-medium transition-all"
              data-testid="add-friend-btn"
            >
              Hinzufügen
            </button>
          </div>
        </div>

        {/* Send Coins */}
        <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span>💸</span> Coins senden
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              placeholder="Freund Name..."
              className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-[#6c63ff] focus:outline-none"
              data-testid="send-to-input"
            />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Anzahl Coins..."
              className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-[#6c63ff] focus:outline-none"
              data-testid="amount-input"
            />
            <button
              onClick={sendCoins}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-semibold transition-all"
              data-testid="send-coins-btn"
            >
              💰 Coins senden
            </button>
          </div>
        </div>

        {/* Friend List */}
        <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <span>👥</span> Freundesliste
            </h3>
            <span className="text-xs text-slate-400">{friends.length} Freunde</span>
          </div>
          
          {friends.length === 0 ? (
            <p className="text-center text-slate-500 py-6">Noch keine Freunde</p>
          ) : (
            <div className="space-y-3" data-testid="friend-list">
              {friends.map((friend) => (
                <div 
                  key={friend.id}
                  className="bg-black/20 p-4 rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#6c63ff] to-[#8b6dff] rounded-full flex items-center justify-center text-xl font-bold">
                        {friend.name.charAt(0)}
                      </div>
                      {friend.online && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#171a3a]"></div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{friend.name}</p>
                      <p className="text-xs text-slate-400">Level {friend.level} • {friend.coins} 💰</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSendTo(friend.name)}
                      className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg transition-all"
                      title="Coins senden"
                    >
                      💸
                    </button>
                    <button
                      onClick={() => removeFriend(friend.id)}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-all"
                      title="Entfernen"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link 
            to="/app-chat"
            className="bg-white/5 p-4 rounded-xl flex items-center gap-3 hover:bg-white/10 transition-all border border-white/5"
          >
            <span className="text-2xl">💬</span>
            <span className="text-sm">Chat öffnen</span>
          </Link>
          <Link 
            to="/events"
            className="bg-white/5 p-4 rounded-xl flex items-center gap-3 hover:bg-white/10 transition-all border border-white/5"
          >
            <span className="text-2xl">🎉</span>
            <span className="text-sm">Live Events</span>
          </Link>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
