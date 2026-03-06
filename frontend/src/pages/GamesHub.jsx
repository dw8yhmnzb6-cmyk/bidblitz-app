/**
 * BidBlitz Games Hub - With Real Backend Connection
 * Play games and earn coins with Daily Rewards
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Gamepad2, Dices, RotateCcw, Gift, Coins, Trophy,
  Sparkles, Target, Puzzle, Crown, ChevronRight,
  Calendar, Check, Lock, Star
} from 'lucide-react';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Game Card
const GameCard = ({ icon: Icon, name, description, reward, color, to }) => (
  <Link
    to={to}
    className="w-full bg-[#1c213f] rounded-xl p-4 text-left hover:bg-[#252b4d] transition-colors block"
  >
    <div className="flex items-center gap-4">
      <div 
        className="p-3 rounded-xl"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-white">{name}</h3>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <div className="text-right">
        <p className="text-green-400 font-bold text-sm">+{reward}</p>
        <p className="text-xs text-slate-500">Coins</p>
      </div>
    </div>
  </Link>
);

// Daily Reward Day
const DayReward = ({ day, coins, bonus, isCurrent, isClaimed, canClaim }) => (
  <div className={`flex flex-col items-center p-2 rounded-xl ${
    isClaimed ? 'bg-green-500/20' : 
    isCurrent ? 'bg-[#6c63ff]/30 ring-2 ring-[#6c63ff]' : 
    'bg-[#0c0f22]'
  }`}>
    <span className="text-xs text-slate-400 mb-1">Tag {day}</span>
    {isClaimed ? (
      <Check className="w-5 h-5 text-green-400" />
    ) : isCurrent && canClaim ? (
      <Gift className="w-5 h-5 text-amber-400 animate-bounce" />
    ) : (
      <Lock className="w-5 h-5 text-slate-600" />
    )}
    <span className={`text-sm font-bold mt-1 ${isClaimed ? 'text-green-400' : 'text-white'}`}>
      {coins}
    </span>
    {bonus && <Star className="w-3 h-3 text-amber-400 mt-0.5" />}
  </div>
);

export default function GamesHub() {
  const [reward, setReward] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [balance, setBalance] = useState(0);
  const [dailyStatus, setDailyStatus] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [walletRes, dailyRes] = await Promise.all([
        axios.get(`${API}/app/wallet/balance`, { headers }),
        axios.get(`${API}/app/daily-reward/status`, { headers })
      ]);
      
      setBalance(walletRes.data.coins || 0);
      setDailyStatus(dailyRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };
  
  const playQuickGame = async () => {
    setPlaying(true);
    setReward(null);
    setMessage('');
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Simulate game animation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const res = await axios.post(`${API}/app/games/play`, 
        { game_type: 'quick_play' },
        { headers }
      );
      
      setReward(res.data.reward);
      setBalance(res.data.new_balance);
      setMessage(res.data.message);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Fehler beim Spielen');
    } finally {
      setPlaying(false);
    }
  };
  
  const claimDailyReward = async () => {
    setClaiming(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await axios.post(`${API}/app/daily-reward/claim`, {}, { headers });
      
      setBalance(res.data.new_balance);
      setMessage(res.data.message);
      fetchData(); // Refresh daily status
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Fehler beim Abholen');
    } finally {
      setClaiming(false);
    }
  };
  
  const games = [
    { icon: Dices, name: 'Glücksrad', description: 'Drehe und gewinne', reward: '10-200', color: '#f59e0b', to: '/spin-wheel' },
    { icon: Puzzle, name: 'Match-3', description: 'Puzzle-Spiel', reward: '5-500', color: '#8b5cf6', to: '/match3' },
    { icon: Target, name: 'Schatzsuche', description: 'Finde den Schatz', reward: '20-200', color: '#10b981', to: '/games' },
    { icon: Crown, name: 'Slot Machine', description: 'Jackpot gewinnen', reward: '0-500', color: '#ec4899', to: '/games' },
  ];
  
  return (
    <div className="min-h-screen bg-[#0c0f22] text-white pb-24">
      {/* Header with Balance */}
      <div className="p-5 pt-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Games</h1>
          <p className="text-slate-400 text-sm">Spiele und verdiene Coins</p>
        </div>
        <div className="bg-[#1c213f] px-4 py-2 rounded-xl flex items-center gap-2">
          <Coins className="w-5 h-5 text-amber-400" />
          <span className="font-bold">{balance.toLocaleString()}</span>
        </div>
      </div>
      
      {/* Quick Play Card */}
      <div className="px-5 mb-6">
        <div className="bg-gradient-to-r from-[#6c63ff] to-[#8b5cf6] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <Gamepad2 className="w-8 h-8" />
            <div>
              <h2 className="font-bold text-lg">Quick Play</h2>
              <p className="text-sm text-white/70">Schnelles Glücksspiel</p>
            </div>
          </div>
          
          <button
            onClick={playQuickGame}
            disabled={playing}
            className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {playing ? (
              <>
                <RotateCcw className="w-5 h-5 animate-spin" />
                Spielen...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Jetzt spielen
              </>
            )}
          </button>
          
          {reward !== null && (
            <div className="mt-4 p-3 bg-white/10 rounded-xl text-center animate-bounce">
              <Gift className="w-6 h-6 mx-auto mb-1 text-amber-300" />
              <p className="font-bold text-lg">+{reward} Coins!</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Message */}
      {message && (
        <div className="mx-5 mb-4 p-3 rounded-xl bg-[#1c213f] text-center text-sm">
          {message}
        </div>
      )}
      
      {/* Daily Rewards */}
      <div className="px-5 mb-6">
        <div className="bg-[#1c213f] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              Tägliche Belohnung
            </h3>
            {dailyStatus && (
              <span className="text-xs text-slate-400">
                Streak: {dailyStatus.streak} Tage
              </span>
            )}
          </div>
          
          {/* 7-Day Rewards Grid */}
          {dailyStatus && (
            <div className="grid grid-cols-7 gap-2 mb-4">
              {dailyStatus.rewards.map((r, idx) => (
                <DayReward 
                  key={idx}
                  day={r.day}
                  coins={r.coins}
                  bonus={r.bonus}
                  isCurrent={idx === (dailyStatus.streak % 7)}
                  isClaimed={idx < (dailyStatus.streak % 7) || !dailyStatus.can_claim && idx === (dailyStatus.streak % 7)}
                  canClaim={dailyStatus.can_claim && idx === (dailyStatus.streak % 7)}
                />
              ))}
            </div>
          )}
          
          <button
            onClick={claimDailyReward}
            disabled={claiming || !dailyStatus?.can_claim}
            className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              dailyStatus?.can_claim
                ? 'bg-amber-500 text-black hover:bg-amber-400'
                : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
            }`}
          >
            {claiming ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                Abholen...
              </>
            ) : dailyStatus?.can_claim ? (
              <>
                <Gift className="w-4 h-4" />
                Abholen (+{dailyStatus?.next_reward?.coins} Coins)
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Bereits abgeholt
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Games List */}
      <div className="px-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#6c63ff]" />
          Alle Spiele
        </h2>
        
        <div className="space-y-3">
          {games.map((game, idx) => (
            <GameCard key={idx} {...game} onClick={playQuickGame} />
          ))}
        </div>
      </div>
      
      {/* Leaderboard Link */}
      <div className="px-5 mt-6">
        <Link 
          to="/leaderboard" 
          className="block bg-[#1c213f] rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-amber-400" />
              <div>
                <p className="font-semibold">Rangliste</p>
                <p className="text-xs text-slate-400">Top Spieler anzeigen</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </div>
        </Link>
      </div>
      
      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
