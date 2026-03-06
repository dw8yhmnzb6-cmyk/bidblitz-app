/**
 * BidBlitz Leaderboard
 * Top Miners, Players, and Referrals
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Rank Badge
const RankBadge = ({ rank }) => {
  const colors = {
    1: 'bg-amber-500 text-black',
    2: 'bg-slate-400 text-black',
    3: 'bg-amber-700 text-white',
  };
  
  return (
    <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${colors[rank] || 'bg-slate-700 text-white'}`}>
      {rank}
    </span>
  );
};

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState('miners');
  const [miners, setMiners] = useState([]);
  const [players, setPlayers] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    try {
      const [minersRes, playersRes, referralsRes] = await Promise.all([
        axios.get(`${API}/app/leaderboard/miners`),
        axios.get(`${API}/app/leaderboard/players`),
        axios.get(`${API}/app/leaderboard/referrals`)
      ]);
      
      setMiners(minersRes.data.leaderboard || []);
      setPlayers(playersRes.data.leaderboard || []);
      setReferrals(referralsRes.data.leaderboard || []);
    } catch (error) {
      console.log('Leaderboard error');
    } finally {
      setLoading(false);
    }
  };
  
  const tabs = [
    { id: 'miners', label: 'Top Miners' },
    { id: 'players', label: 'Top Players' },
    { id: 'referrals', label: 'Top Referrals' },
  ];
  
  const renderList = () => {
    let data = [];
    let valueKey = '';
    let valueLabel = '';
    
    switch (activeTab) {
      case 'miners':
        data = miners;
        valueKey = 'hashrate';
        valueLabel = 'TH';
        break;
      case 'players':
        data = players;
        valueKey = 'coins';
        valueLabel = 'Coins';
        break;
      case 'referrals':
        data = referrals;
        valueKey = 'friends';
        valueLabel = 'Friends';
        break;
      default:
        data = miners;
    }
    
    if (data.length === 0) {
      return <p className="text-center text-slate-400 py-8">Keine Daten</p>;
    }
    
    return (
      <ul className="divide-y divide-slate-700/50">
        {data.map((item, index) => (
          <li key={index} className="flex items-center justify-between py-3 px-2">
            <div className="flex items-center gap-3">
              <RankBadge rank={index + 1} />
              <span className="font-medium">{item.name}</span>
            </div>
            <span className={`font-bold ${
              index === 0 ? 'text-amber-400' :
              index === 1 ? 'text-slate-300' :
              index === 2 ? 'text-amber-600' :
              'text-slate-400'
            }`}>
              {item[valueKey]?.toLocaleString()} {valueLabel}
            </span>
          </li>
        ))}
      </ul>
    );
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0f22] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#6c63ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#0c0f22] text-white pb-20">
      <div className="p-5">
        <h2 className="text-2xl font-bold mb-5">BidBlitz Leaderboard</h2>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[#6c63ff] text-white'
                  : 'bg-[#1c213f] text-slate-400 hover:bg-[#252b4d]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Leaderboard */}
        <div className="bg-[#1c213f] rounded-xl p-4">
          <h3 className="font-semibold mb-3 text-[#6c63ff]">
            {activeTab === 'miners' && '⛏️ Top Miners'}
            {activeTab === 'players' && '🎮 Top Players'}
            {activeTab === 'referrals' && '👥 Top Referrals'}
          </h3>
          
          {renderList()}
        </div>
        
        {/* Your Stats */}
        <div className="mt-5 bg-gradient-to-r from-[#6c63ff]/20 to-[#8b5cf6]/20 rounded-xl p-4 border border-[#6c63ff]/30">
          <h3 className="font-semibold mb-2">Your Ranking</h3>
          <p className="text-slate-400 text-sm">
            Sammle mehr {activeTab === 'miners' ? 'Hashrate' : activeTab === 'players' ? 'Coins' : 'Freunde'} um in die Top 10 zu kommen!
          </p>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
