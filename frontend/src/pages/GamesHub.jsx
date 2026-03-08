/**
 * BidBlitz Games Hub - Clean Design mit Suche
 * Top Games + All Games Layout
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const TOP_GAMES = [
  { id: 1, name: 'Candy', icon: '🍬', url: '/games/candy.html', key: 'candy_match' },
  { id: 2, name: 'Wheel', icon: '🎡', url: '/games/wheel.html', key: 'lucky_wheel' },
  { id: 3, name: 'Reaction', icon: '⚡', url: '/games/reaction.html', key: 'reaction' },
  { id: 4, name: 'Scratch', icon: '🎴', url: '/games/scratch.html', key: 'scratch' },
];

const ALL_GAMES = [
  { id: 5, name: 'Snake', icon: '🐍', url: '/games/snake.html', key: 'snake' },
  { id: 6, name: 'Racing', icon: '🚗', url: '/games/racing.html', key: 'racing' },
  { id: 7, name: 'Runner', icon: '🏃', url: '/games/runner.html', key: 'runner' },
  { id: 8, name: 'Puzzle', icon: '🧠', url: '/games/puzzle.html', key: 'puzzle' },
  { id: 9, name: 'Blocks', icon: '🧱', url: '/games/blocks.html', key: 'blocks' },
  { id: 10, name: 'Target', icon: '🎯', url: '/games/target.html', key: 'target' },
  { id: 11, name: 'Coin Flip', icon: '🪙', url: '/games/coinflip.html', key: 'coinflip' },
  { id: 12, name: 'Space', icon: '🚀', url: '/games/space.html', key: 'space' },
  { id: 13, name: 'Memory', icon: '🧩', url: '/games/memory.html', key: 'memory' },
  { id: 14, name: 'Arcade', icon: '🎮', url: '/games/arcade.html', key: 'arcade' },
  { id: 15, name: 'Classic', icon: '🕹', url: '/games/classic.html', key: 'classic' },
  { id: 16, name: 'Dice', icon: '🎲', url: '/games/dice.html', key: 'dice' },
  { id: 17, name: 'Drift', icon: '🏎', url: '/games/drift.html', key: 'drift' },
  { id: 18, name: 'Bomber', icon: '🧨', url: '/games/bomber.html', key: 'bomber' },
  { id: 19, name: 'Climb', icon: '🧗', url: '/games/climb.html', key: 'climb' },
  { id: 20, name: 'Archer', icon: '🏹', url: '/games/archer.html', key: 'archer' },
];

export default function GamesHub() {
  const navigate = useNavigate();
  const [showGame, setShowGame] = useState(null);
  const [coins, setCoins] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastReward, setLastReward] = useState(null);
  const [showRewardPopup, setShowRewardPopup] = useState(false);

  const userId = localStorage.getItem('userId') || 'guest_' + Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    if (!localStorage.getItem('userId')) {
      localStorage.setItem('userId', userId);
    }
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const coinsRes = await axios.get(`${API}/bbz/coins/${userId}`);
      setCoins(coinsRes.data.coins || 0);
    } catch (error) {
      setCoins(100);
    }
  };

  const playGame = (game) => {
    setShowGame(game);
  };

  const closeGame = async () => {
    if (showGame) {
      const won = Math.random() > 0.3;
      const score = Math.floor(Math.random() * 500);
      
      if (won) {
        try {
          const res = await axios.post(`${API}/bbz/games/reward`, {
            user_id: userId,
            game: showGame.key,
            won: true,
            score: score
          });
          
          if (res.data.success) {
            setCoins(res.data.new_balance);
            setLastReward({ amount: res.data.reward, game: showGame.name, score });
            setShowRewardPopup(true);
          }
        } catch (error) {
          // Simulate reward
          const reward = Math.floor(Math.random() * 30) + 10;
          setCoins(prev => prev + reward);
          setLastReward({ amount: reward, game: showGame.name, score });
          setShowRewardPopup(true);
        }
      }
    }
    
    setShowGame(null);
  };

  // Filter games based on search
  const filteredAllGames = ALL_GAMES.filter(game => 
    game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    game.icon.includes(searchQuery)
  );

  const filteredTopGames = TOP_GAMES.filter(game => 
    game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    game.icon.includes(searchQuery)
  );

  return (
    <div className="min-h-screen text-white pb-24" style={{ background: '#0f172a' }}>
      
      {/* Header */}
      <header className="flex justify-between items-center p-5">
        <h1 className="text-2xl font-bold">🎮 BidBlitz Games</h1>
        <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-full">
          <span>💰</span>
          <span className="font-bold text-yellow-400">{coins.toLocaleString()} Coins</span>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-5 mb-4">
        <input
          type="text"
          placeholder="Search games..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-500 transition-all"
        />
      </div>

      {/* Top Games */}
      {filteredTopGames.length > 0 && (
        <>
          <h2 className="text-lg font-semibold px-5 mb-3">🔥 Top Games</h2>
          <div className="grid grid-cols-4 gap-3 px-5 mb-6">
            {filteredTopGames.map(game => (
              <div
                key={game.id}
                onClick={() => playGame(game)}
                className="bg-purple-600 hover:bg-purple-500 rounded-xl p-4 text-center cursor-pointer transition-all duration-200 active:scale-95"
              >
                <div className="text-2xl mb-1">{game.icon}</div>
                <div className="text-sm font-medium">{game.name}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* All Games */}
      <h2 className="text-lg font-semibold px-5 mb-3">🎲 All Games</h2>
      <div className="grid grid-cols-4 gap-3 px-5">
        {filteredAllGames.map(game => (
          <div
            key={game.id}
            onClick={() => playGame(game)}
            className="bg-purple-600 hover:bg-purple-500 rounded-xl p-4 text-center cursor-pointer transition-all duration-200 active:scale-95"
          >
            <div className="text-2xl mb-1">{game.icon}</div>
            <div className="text-sm font-medium">{game.name}</div>
          </div>
        ))}
      </div>

      {/* No results */}
      {searchQuery && filteredTopGames.length === 0 && filteredAllGames.length === 0 && (
        <div className="text-center py-10 text-white/50">
          <div className="text-4xl mb-3">🔍</div>
          <p>Keine Spiele gefunden für "{searchQuery}"</p>
        </div>
      )}

      {/* Game Modal */}
      {showGame && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
          <div className="flex justify-between items-center p-4 bg-purple-700">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{showGame.icon}</span>
              <h3 className="font-bold text-white text-lg">{showGame.name}</h3>
            </div>
            <button 
              onClick={closeGame}
              className="px-4 py-2 rounded-xl text-white font-bold bg-white/20 hover:bg-white/30 transition-all"
            >
              ✕ Schließen
            </button>
          </div>
          <iframe 
            src={showGame.url} 
            className="flex-1 w-full border-none"
            title={showGame.name}
          />
        </div>
      )}

      {/* Reward Popup */}
      {showRewardPopup && lastReward && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div 
            className="max-w-sm w-full p-6 rounded-3xl text-center bg-gradient-to-br from-purple-600 to-violet-700"
            style={{ animation: 'bounceIn 0.4s ease-out' }}
          >
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-2xl font-bold mb-2">Gewonnen!</h2>
            <div className="text-4xl font-bold text-yellow-400 mb-2">
              +{lastReward.amount} 🪙
            </div>
            <p className="text-white/70 mb-4">
              {lastReward.game} • Score: {lastReward.score}
            </p>
            <p className="text-white/70 mb-4">
              Neues Guthaben: <span className="text-yellow-400 font-bold">{coins}</span> Coins
            </p>
            <button
              onClick={() => setShowRewardPopup(false)}
              className="px-8 py-3 bg-white text-purple-700 font-bold rounded-xl hover:bg-white/90 transition-all"
            >
              Super! 🎉
            </button>
          </div>
        </div>
      )}

      <BottomNav />

      <style>{`
        @keyframes bounceIn {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
