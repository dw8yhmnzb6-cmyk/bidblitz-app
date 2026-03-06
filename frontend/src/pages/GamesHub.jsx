/**
 * BidBlitz Game Center
 * Grid with Lucky Wheel, Slot Machine, Daily Reward
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function GamesHub() {
  const [coins, setCoins] = useState(500);
  const [wheelResult, setWheelResult] = useState('');
  const [slotResult, setSlotResult] = useState('');
  const [dailyResult, setDailyResult] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [claiming, setClaiming] = useState(false);
  
  useEffect(() => {
    fetchCoins();
  }, []);
  
  const fetchCoins = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/app/wallet/balance`, { headers });
      setCoins(res.data.coins || 0);
    } catch (error) {
      console.log('Coins error');
    }
  };
  
  const wheel = async () => {
    setSpinning(true);
    setWheelResult('');
    
    try {
      await new Promise(r => setTimeout(r, 1500));
      
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(`${API}/app/games/play`, 
        { game_type: 'lucky_wheel' },
        { headers }
      );
      
      setWheelResult(`You won ${res.data.reward} coins`);
      setCoins(res.data.new_balance);
    } catch (error) {
      const win = Math.floor(Math.random() * 100);
      setWheelResult(`You won ${win} coins`);
      setCoins(prev => prev + win);
    } finally {
      setSpinning(false);
    }
  };
  
  const slot = async () => {
    setPlaying(true);
    setSlotResult('');
    
    try {
      await new Promise(r => setTimeout(r, 1000));
      
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(`${API}/app/games/play`, 
        { game_type: 'slot_machine' },
        { headers }
      );
      
      const win = res.data.reward;
      setSlotResult(`Result ${win > 0 ? '+' : ''}${win} coins`);
      setCoins(res.data.new_balance);
    } catch (error) {
      const win = Math.floor(Math.random() * 200) - 50;
      setSlotResult(`Result ${win > 0 ? '+' : ''}${win} coins`);
      setCoins(prev => Math.max(0, prev + win));
    } finally {
      setPlaying(false);
    }
  };
  
  const daily = async () => {
    setClaiming(true);
    setDailyResult('');
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(`${API}/app/daily-reward/claim`, {}, { headers });
      
      setDailyResult(`You received ${res.data.coins} coins`);
      setCoins(res.data.new_balance);
    } catch (error) {
      setDailyResult(error.response?.data?.detail || 'Already claimed today');
    } finally {
      setClaiming(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-[#0c0f22] text-white pb-20">
      <div className="p-5">
        <h2 className="text-2xl font-bold mb-2">BidBlitz Game Center</h2>
        <h3 className="text-lg mb-6">Coins: <span className="font-bold text-amber-400">{coins.toLocaleString()}</span></h3>
        
        {/* Games Grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Lucky Wheel */}
          <div 
            className="bg-[#1c213f] p-4 rounded-xl text-center"
            style={{ boxShadow: '0 15px 40px rgba(0,0,0,0.6)' }}
          >
            <h3 className="font-semibold mb-3">Lucky Wheel</h3>
            <button
              onClick={wheel}
              disabled={spinning}
              className="px-4 py-2 bg-[#6c63ff] hover:bg-[#5a52e0] rounded-lg font-medium disabled:opacity-50"
            >
              {spinning ? '...' : 'Spin'}
            </button>
            {wheelResult && (
              <p className="mt-2 text-sm text-green-400">{wheelResult}</p>
            )}
          </div>
          
          {/* Slot Machine */}
          <div 
            className="bg-[#1c213f] p-4 rounded-xl text-center"
            style={{ boxShadow: '0 15px 40px rgba(0,0,0,0.6)' }}
          >
            <h3 className="font-semibold mb-3">Slot Machine</h3>
            <button
              onClick={slot}
              disabled={playing}
              className="px-4 py-2 bg-[#6c63ff] hover:bg-[#5a52e0] rounded-lg font-medium disabled:opacity-50"
            >
              {playing ? '...' : 'Play'}
            </button>
            {slotResult && (
              <p className={`mt-2 text-sm ${slotResult.includes('-') ? 'text-red-400' : 'text-green-400'}`}>
                {slotResult}
              </p>
            )}
          </div>
          
          {/* Daily Reward */}
          <div 
            className="bg-[#1c213f] p-4 rounded-xl text-center"
            style={{ boxShadow: '0 15px 40px rgba(0,0,0,0.6)' }}
          >
            <h3 className="font-semibold mb-3">Daily Reward</h3>
            <button
              onClick={daily}
              disabled={claiming}
              className="px-4 py-2 bg-[#6c63ff] hover:bg-[#5a52e0] rounded-lg font-medium disabled:opacity-50"
            >
              {claiming ? '...' : 'Claim'}
            </button>
            {dailyResult && (
              <p className={`mt-2 text-sm ${dailyResult.includes('received') ? 'text-green-400' : 'text-amber-400'}`}>
                {dailyResult}
              </p>
            )}
          </div>
        </div>
        
        {/* More Games */}
        <div className="bg-[#1c213f] p-5 rounded-xl">
          <h3 className="font-semibold mb-3">More Games</h3>
          <div className="space-y-2">
            <Link 
              to="/match3" 
              className="block py-3 px-4 bg-[#0c0f22] rounded-lg hover:bg-[#6c63ff]/20 transition-colors"
            >
              🧩 Match Game
            </Link>
            <Link 
              to="/spin-wheel" 
              className="block py-3 px-4 bg-[#0c0f22] rounded-lg hover:bg-[#6c63ff]/20 transition-colors"
            >
              🎡 Spin Wheel
            </Link>
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
