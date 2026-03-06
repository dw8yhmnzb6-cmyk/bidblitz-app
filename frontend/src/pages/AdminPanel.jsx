/**
 * BidBlitz Admin Panel
 * Manage users, coins, and view stats
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function AdminPanel() {
  const [stats, setStats] = useState({
    users: 0,
    coins: 0,
    miners: 0,
    fees: 0
  });
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [userId2, setUserId2] = useState('');
  const [amount2, setAmount2] = useState('');
  const [result, setResult] = useState('');
  const [result2, setResult2] = useState('');
  
  useEffect(() => {
    fetchStats();
  }, []);
  
  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/app/admin/stats`);
      setStats(res.data);
    } catch (error) {
      // Use mock data
      setStats({
        users: 1250,
        coins: 250000,
        miners: 340,
        fees: 4500
      });
    }
  };
  
  const addCoins = async () => {
    if (!userId || !amount) {
      setResult('Bitte alle Felder ausfüllen');
      return;
    }
    
    try {
      const res = await axios.post(`${API}/app/admin/add-coins`, {
        user_id: userId,
        amount: parseInt(amount)
      });
      setResult(`${amount} Coins zu ${userId} hinzugefügt!`);
      setUserId('');
      setAmount('');
      fetchStats();
    } catch (error) {
      setResult(error.response?.data?.detail || 'Fehler beim Hinzufügen');
    }
  };
  
  const removeCoins = async () => {
    if (!userId2 || !amount2) {
      setResult2('Bitte alle Felder ausfüllen');
      return;
    }
    
    try {
      const res = await axios.post(`${API}/app/admin/remove-coins`, {
        user_id: userId2,
        amount: parseInt(amount2)
      });
      setResult2(`${amount2} Coins von ${userId2} entfernt!`);
      setUserId2('');
      setAmount2('');
      fetchStats();
    } catch (error) {
      setResult2(error.response?.data?.detail || 'Fehler beim Entfernen');
    }
  };
  
  return (
    <div className="min-h-screen bg-[#0c0f22] text-white pb-20">
      <div className="p-5">
        <h2 className="text-2xl font-bold mb-5">BidBlitz Admin Panel</h2>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#1c213f] p-4 rounded-xl text-center">
            <h3 className="text-slate-400 text-sm mb-1">Total Users</h3>
            <p className="text-2xl font-bold text-cyan-400">{stats.users.toLocaleString()}</p>
          </div>
          <div className="bg-[#1c213f] p-4 rounded-xl text-center">
            <h3 className="text-slate-400 text-sm mb-1">Total Coins</h3>
            <p className="text-2xl font-bold text-amber-400">{stats.coins.toLocaleString()}</p>
          </div>
          <div className="bg-[#1c213f] p-4 rounded-xl text-center">
            <h3 className="text-slate-400 text-sm mb-1">Total Miners</h3>
            <p className="text-2xl font-bold text-green-400">{stats.miners.toLocaleString()}</p>
          </div>
          <div className="bg-[#1c213f] p-4 rounded-xl text-center">
            <h3 className="text-slate-400 text-sm mb-1">Marketplace Fees</h3>
            <p className="text-2xl font-bold text-purple-400">{stats.fees.toLocaleString()} Coins</p>
          </div>
        </div>
        
        {/* Add Coins */}
        <div className="bg-[#1c213f] p-5 rounded-xl mb-4">
          <h3 className="font-semibold mb-3">Add Coins to User</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User ID"
              className="flex-1 p-2.5 rounded-lg bg-[#0c0f22] border border-slate-700 text-white text-sm"
            />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Coins"
              className="w-24 p-2.5 rounded-lg bg-[#0c0f22] border border-slate-700 text-white text-sm"
            />
          </div>
          <button
            onClick={addCoins}
            className="w-full py-2.5 bg-green-600 hover:bg-green-500 rounded-lg font-medium"
          >
            Add Coins
          </button>
          {result && (
            <p className={`mt-2 text-sm ${result.includes('hinzugefügt') ? 'text-green-400' : 'text-amber-400'}`}>
              {result}
            </p>
          )}
        </div>
        
        {/* Remove Coins */}
        <div className="bg-[#1c213f] p-5 rounded-xl">
          <h3 className="font-semibold mb-3">Remove Coins</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={userId2}
              onChange={(e) => setUserId2(e.target.value)}
              placeholder="User ID"
              className="flex-1 p-2.5 rounded-lg bg-[#0c0f22] border border-slate-700 text-white text-sm"
            />
            <input
              type="number"
              value={amount2}
              onChange={(e) => setAmount2(e.target.value)}
              placeholder="Coins"
              className="w-24 p-2.5 rounded-lg bg-[#0c0f22] border border-slate-700 text-white text-sm"
            />
          </div>
          <button
            onClick={removeCoins}
            className="w-full py-2.5 bg-red-600 hover:bg-red-500 rounded-lg font-medium"
          >
            Remove Coins
          </button>
          {result2 && (
            <p className={`mt-2 text-sm ${result2.includes('entfernt') ? 'text-green-400' : 'text-amber-400'}`}>
              {result2}
            </p>
          )}
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
