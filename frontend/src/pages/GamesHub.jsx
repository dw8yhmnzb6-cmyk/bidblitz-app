/**
 * BidBlitz Games Hub
 * Featured games in 2x2 grid with quick play
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function GamesHub() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(500);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState('');
  
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
  
  const playGame = async (gameType, calculateWin) => {
    setLoading(gameType);
    setResult('');
    
    await new Promise(r => setTimeout(r, 800));
    
    const win = calculateWin();
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(`${API}/app/games/play`, 
        { game_type: gameType },
        { headers }
      );
      setCoins(res.data.new_balance || coins + Math.max(0, win));
    } catch (error) {
      setCoins(prev => Math.max(0, prev + win));
    }
    
    setResult({ game: gameType, amount: win >= 0 ? `+${win}` : `${win}` });
    setLoading('');
    
    setTimeout(() => setResult(''), 3000);
  };
  
  // Featured games
  const featuredGames = [
    { 
      id: 'spin_wheel', 
      icon: '🎡', 
      name: 'Spin Wheel', 
      btn: 'Play',
      color: 'from-purple-500/20 to-pink-500/10',
      border: 'border-purple-500/30',
      action: () => playGame('spin_wheel', () => [5, 10, 20, 50][Math.floor(Math.random() * 4)])
    },
    { 
      id: 'mystery_box', 
      icon: '🎁', 
      name: 'Mystery Box', 
      btn: 'Open',
      color: 'from-amber-500/20 to-orange-500/10',
      border: 'border-amber-500/30',
      action: () => playGame('mystery_box', () => [10, 25, 50, 100][Math.floor(Math.random() * 4)])
    },
    { 
      id: 'coin_hunt', 
      icon: '🗺️', 
      name: 'Coin Hunt', 
      btn: 'Collect',
      color: 'from-emerald-500/20 to-green-500/10',
      border: 'border-emerald-500/30',
      action: () => navigate('/map')
    },
    { 
      id: 'leaderboard', 
      icon: '🏆', 
      name: 'Leaderboard', 
      btn: 'View',
      color: 'from-cyan-500/20 to-blue-500/10',
      border: 'border-cyan-500/30',
      action: () => navigate('/app-leaderboard')
    },
    { 
      id: 'live_auction', 
      icon: '🔥', 
      name: 'Live Auction', 
      btn: 'Bid',
      color: 'from-red-500/20 to-orange-500/10',
      border: 'border-red-500/30',
      action: () => navigate('/live-auction')
    },
  ];

  // More games
  const moreGames = [
    { id: 'slot', icon: '🎰', name: 'Slots', action: () => playGame('slots', () => Math.floor(Math.random() * 200) - 50) },
    { id: 'dice', icon: '🎲', name: 'Würfel', action: () => playGame('dice', () => Math.floor(Math.random() * 60)) },
    { id: 'flip', icon: '🪙', name: 'Flip', action: () => playGame('flip', () => Math.random() > 0.5 ? 30 : -10) },
    { id: 'bomb', icon: '💣', name: 'Bomb', action: () => playGame('bomb', () => Math.random() > 0.7 ? 100 : -50) },
    { id: 'jackpot', icon: '💎', name: 'Jackpot', action: () => playGame('jackpot', () => Math.floor(Math.random() * 500)) },
    { id: 'daily', icon: '📅', name: 'Daily', action: () => playGame('daily', () => 50) },
  ];
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0e24] via-[#0f1332] to-[#0b0e24] text-white pb-24">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-60 h-60 bg-purple-500/10 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-40 -right-20 w-60 h-60 bg-cyan-500/10 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">BidBlitz Games</h2>
            <p className="text-xs text-slate-400">Spiele & gewinne Coins!</p>
          </div>
          <div className="bg-amber-500/20 px-4 py-2 rounded-xl border border-amber-500/30">
            <span className="text-amber-400 font-bold" data-testid="coins-display">
              {coins.toLocaleString()} 💰
            </span>
          </div>
        </div>

        {/* Result Toast */}
        {result && (
          <div className={`mb-4 p-4 rounded-2xl text-center font-bold text-lg animate-bounce ${
            result.amount?.startsWith('+') 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`} data-testid="game-result">
            {result.amount} Coins
          </div>
        )}
        
        {/* Featured Games 2x2 Grid + 1 */}
        <div className="mb-6">
          <h3 className="text-sm text-slate-400 uppercase tracking-wider mb-3">Featured Games</h3>
          <div className="grid grid-cols-2 gap-4" data-testid="games-grid">
            {featuredGames.slice(0, 4).map((game) => (
              <div 
                key={game.id}
                className={`bg-gradient-to-br ${game.color} p-5 rounded-2xl text-center border ${game.border} transition-all hover:scale-[1.02] active:scale-[0.98]`}
                data-testid={`game-${game.id}`}
              >
                <span className="text-5xl block mb-3">{game.icon}</span>
                <h4 className="font-semibold mb-3">{game.name}</h4>
                <button
                  onClick={game.action}
                  disabled={loading === game.id}
                  className="w-full py-2.5 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-medium disabled:opacity-50 transition-all"
                  data-testid={`btn-${game.id}`}
                >
                  {loading === game.id ? '⏳' : game.btn}
                </button>
              </div>
            ))}
          </div>
          
          {/* Live Auction Card - Full Width */}
          <div 
            className={`mt-4 bg-gradient-to-br ${featuredGames[4].color} p-5 rounded-2xl border ${featuredGames[4].border} transition-all hover:scale-[1.01]`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-4xl">{featuredGames[4].icon}</span>
                <div>
                  <h4 className="font-bold text-lg">{featuredGames[4].name}</h4>
                  <p className="text-xs text-slate-400">Biete & gewinne Produkte!</p>
                </div>
              </div>
              <button
                onClick={featuredGames[4].action}
                className="px-6 py-3 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-medium transition-all"
                data-testid="btn-live_auction"
              >
                {featuredGames[4].btn}
              </button>
            </div>
          </div>
        </div>
        
        {/* More Games */}
        <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span>🎮</span> Mehr Spiele
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {moreGames.map((game) => (
              <button
                key={game.id}
                onClick={game.action}
                disabled={loading === game.id}
                className="bg-black/20 p-4 rounded-xl text-center hover:bg-[#6c63ff]/20 transition-all disabled:opacity-50"
                data-testid={`btn-${game.id}`}
              >
                <span className="text-2xl block mb-1">{game.icon}</span>
                <span className="text-xs">{game.name}</span>
                {loading === game.id && <span className="text-xs block">⏳</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link 
            to="/match3"
            className="bg-white/5 p-4 rounded-xl flex items-center gap-3 hover:bg-white/10 transition-all border border-white/5"
          >
            <span className="text-2xl">🧩</span>
            <span className="text-sm">Match Game</span>
          </Link>
          <Link 
            to="/treasure-hunt"
            className="bg-white/5 p-4 rounded-xl flex items-center gap-3 hover:bg-white/10 transition-all border border-white/5"
          >
            <span className="text-2xl">🗺️</span>
            <span className="text-sm">Schatzsuche</span>
          </Link>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
