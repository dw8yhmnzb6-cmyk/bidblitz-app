/**
 * BidBlitz App Leaderboard
 * Show top miners, players, and referrers
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function AppLeaderboard() {
  const [activeTab, setActiveTab] = useState('miners');
  const [miners, setMiners] = useState([]);
  const [players, setPlayers] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchLeaderboards();
  }, []);
  
  const fetchLeaderboards = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [minersRes, playersRes, referralsRes] = await Promise.all([
        axios.get(`${API}/app/leaderboard/miners`, { headers }),
        axios.get(`${API}/app/leaderboard/players`, { headers }),
        axios.get(`${API}/app/leaderboard/referrals`, { headers })
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
  
  const getMedal = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}.`;
  };
  
  const tabs = [
    { id: 'miners', label: '⛏️ Top Miner', data: miners },
    { id: 'players', label: '🎮 Top Spieler', data: players },
    { id: 'referrals', label: '👥 Top Werber', data: referrals },
  ];
  
  const renderEntry = (entry, index) => {
    const medal = getMedal(index);
    const isTop3 = index < 3;
    
    return (
      <div 
        key={index}
        className={`flex items-center justify-between p-3 rounded-xl ${
          isTop3 ? 'bg-[#252b4d]' : 'bg-[#1c213f]'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`text-xl ${isTop3 ? '' : 'text-slate-500'}`}>{medal}</span>
          <div>
            <p className="font-medium">{entry.name}</p>
            <p className="text-xs text-slate-400">
              {activeTab === 'miners' && `${entry.miners} Miner`}
              {activeTab === 'players' && `${entry.total_earned?.toLocaleString() || 0} verdient`}
              {activeTab === 'referrals' && `${entry.earnings?.toLocaleString() || 0} Coins verdient`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`font-bold ${
            activeTab === 'miners' ? 'text-cyan-400' :
            activeTab === 'players' ? 'text-amber-400' : 'text-green-400'
          }`}>
            {activeTab === 'miners' && `${entry.hashrate} TH`}
            {activeTab === 'players' && `${entry.coins?.toLocaleString() || 0}`}
            {activeTab === 'referrals' && `${entry.friends} Freunde`}
          </p>
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen bg-[#0c0f22] text-white pb-20">
      <div className="p-5">
        <h2 className="text-2xl font-bold mb-4">🏆 Rangliste</h2>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[#6c63ff] text-white'
                  : 'bg-[#1c213f] text-slate-400'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Content */}
        {loading ? (
          <div className="text-center py-8 text-slate-400">
            Lädt...
          </div>
        ) : (
          <div className="space-y-2">
            {tabs.find(t => t.id === activeTab)?.data.map((entry, index) => 
              renderEntry(entry, index)
            )}
            
            {tabs.find(t => t.id === activeTab)?.data.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                Noch keine Einträge
              </div>
            )}
          </div>
        )}
        
        {/* Refresh */}
        <button
          onClick={fetchLeaderboards}
          className="w-full mt-4 py-2.5 bg-[#1c213f] hover:bg-[#252b4d] rounded-xl text-slate-400"
        >
          🔄 Aktualisieren
        </button>
      </div>
      
      <BottomNav />
    </div>
  );
}
