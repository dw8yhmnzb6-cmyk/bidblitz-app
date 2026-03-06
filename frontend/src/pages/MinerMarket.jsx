/**
 * BidBlitz Miner Market - Simple Card Style
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function MinerMarket() {
  const navigate = useNavigate();
  const [miners, setMiners] = useState([]);
  const [balance, setBalance] = useState(0);
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [marketRes, walletRes] = await Promise.all([
        axios.get(`${API}/app/market/miners`),
        axios.get(`${API}/app/wallet/balance`, { headers })
      ]);
      
      setMiners(marketRes.data.miners || []);
      setBalance(walletRes.data.coins || 0);
    } catch (error) {
      console.log('Data error');
    }
  };
  
  const buyMiner = async (minerId) => {
    setBuying(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await axios.post(`${API}/app/miner/buy`, 
        { miner_type_id: minerId },
        { headers }
      );
      
      setMessage(res.data.message);
      setBalance(res.data.new_balance);
      setTimeout(() => navigate('/miner'), 1500);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Purchase failed');
    } finally {
      setBuying(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-[#0c0f22] text-white pb-20">
      <div className="p-5">
        {/* Header */}
        <div className="card bg-[#1c213f] p-5 rounded-2xl mb-4">
          <h2 className="text-xl font-semibold mb-2">Marketplace</h2>
          <p className="text-slate-400">Balance: <span className="text-amber-400 font-bold">{balance.toLocaleString()} Coins</span></p>
        </div>
        
        {/* Message */}
        {message && (
          <div className="mb-4 p-3 bg-[#6c63ff]/20 rounded-xl text-center text-sm">
            {message}
          </div>
        )}
        
        {/* Miners */}
        <div className="card bg-[#1c213f] p-5 rounded-2xl">
          <div className="space-y-4">
            {miners.map((miner) => (
              <div key={miner.id} className="flex justify-between items-center py-3 border-b border-slate-700/50 last:border-0">
                <div>
                  <p className="font-medium">{miner.name}</p>
                  <p className="text-sm text-slate-400">{miner.hashrate} TH/s • +{miner.daily_reward}/day</p>
                </div>
                <div className="text-right">
                  <p className="text-amber-400 font-bold mb-1">{miner.price} Coins</p>
                  <button
                    onClick={() => buyMiner(miner.id)}
                    disabled={buying || balance < miner.price}
                    className={`text-sm px-4 py-1.5 rounded ${
                      balance >= miner.price
                        ? 'bg-[#6c63ff] hover:bg-[#5a52e0]'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    Buy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Back Link */}
        <div className="mt-4 text-center">
          <Link to="/miner" className="text-[#6c63ff] text-sm">
            ← Back to Mining
          </Link>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
