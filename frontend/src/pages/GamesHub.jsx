/**
 * BidBlitz Games Hub - 4 Kategorien
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const CATEGORIES = {
  top: {
    title: '🔥 Top Games',
    games: [
      { name: 'Candy', icon: '🍬', url: '/games/candy.html', key: 'candy_match' },
      { name: 'Wheel', icon: '🎡', url: '/games/wheel.html', key: 'lucky_wheel' },
      { name: 'Reaction', icon: '⚡', url: '/games/reaction.html', key: 'reaction' },
      { name: 'Scratch', icon: '🎴', url: '/games/scratch.html', key: 'scratch' },
    ]
  },
  newGames: {
    title: '🆕 New Games',
    games: [
      { name: 'Snake', icon: '🐍', url: '/games/snake.html', key: 'snake' },
      { name: 'Puzzle', icon: '🧠', url: '/games/puzzle.html', key: 'puzzle' },
      { name: 'Blocks', icon: '🧱', url: '/games/blocks.html', key: 'blocks' },
      { name: 'Memory', icon: '🧩', url: '/games/memory.html', key: 'memory' },
      { name: 'Arcade', icon: '🎮', url: '/games/arcade.html', key: 'arcade' },
      { name: 'Dice', icon: '🎲', url: '/games/dice.html', key: 'dice' },
      { name: 'Archer', icon: '🏹', url: '/games/archer.html', key: 'archer' },
      { name: 'Space', icon: '🚀', url: '/games/space.html', key: 'space' },
    ]
  },
  racing: {
    title: '🚗 Racing',
    games: [
      { name: 'Racing', icon: '🚗', url: '/games/racing.html', key: 'racing' },
      { name: 'Drift', icon: '🏎', url: '/games/drift.html', key: 'drift' },
      { name: 'Speed', icon: '🏁', url: '/games/speed.html', key: 'speed' },
      { name: 'Runner', icon: '🏃', url: '/games/runner.html', key: 'runner' },
    ]
  },
  arcade: {
    title: '🕹 Arcade',
    games: [
      { name: 'Coin Flip', icon: '🪙', url: '/games/coinflip.html', key: 'coinflip' },
      { name: 'Target', icon: '🎯', url: '/games/target.html', key: 'target' },
      { name: 'Bomber', icon: '🧨', url: '/games/bomber.html', key: 'bomber' },
      { name: 'Climb', icon: '🧗', url: '/games/climb.html', key: 'climb' },
    ]
  }
};

export default function GamesHub() {
  const [showGame, setShowGame] = useState(null);
  const [coins, setCoins] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastReward, setLastReward] = useState(null);
  const [showRewardPopup, setShowRewardPopup] = useState(false);

  const userId = localStorage.getItem('userId') || 'guest_' + Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    if (!localStorage.getItem('userId')) localStorage.setItem('userId', userId);
    fetchCoins();
  }, []);

  const fetchCoins = async () => {
    try {
      const res = await axios.get(`${API}/bbz/coins/${userId}`);
      setCoins(res.data.coins || 0);
    } catch { setCoins(100); }
  };

  const playGame = (game) => setShowGame(game);

  const closeGame = async () => {
    if (showGame) {
      const won = Math.random() > 0.3;
      const score = Math.floor(Math.random() * 500);
      if (won) {
        try {
          const res = await axios.post(`${API}/bbz/games/reward`, {
            user_id: userId, game: showGame.key, won: true, score
          });
          if (res.data.success) {
            setCoins(res.data.new_balance);
            setLastReward({ amount: res.data.reward, game: showGame.name, score });
            setShowRewardPopup(true);
          }
        } catch {
          const reward = Math.floor(Math.random() * 30) + 10;
          setCoins(prev => prev + reward);
          setLastReward({ amount: reward, game: showGame.name, score });
          setShowRewardPopup(true);
        }
      }
    }
    setShowGame(null);
  };

  // Filter games
  const filterGames = (games) => games.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen text-white pb-24" style={{ background: '#0f172a' }}>
      
      {/* Header */}
      <header className="flex justify-between items-center p-5">
        <h1 className="text-2xl font-bold">🎮 BidBlitz Games</h1>
        <span className="font-bold text-yellow-400">💰{coins.toLocaleString()} Coins</span>
      </header>

      {/* Search */}
      <div className="px-5 mb-2">
        <input
          type="text"
          placeholder="Search games"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none"
        />
      </div>

      {/* Categories */}
      {Object.entries(CATEGORIES).map(([key, category]) => {
        const filtered = filterGames(category.games);
        if (searchQuery && filtered.length === 0) return null;
        
        return (
          <div key={key}>
            <h2 className="text-lg font-semibold px-5 mt-4 mb-2">{category.title}</h2>
            <div className="grid grid-cols-4 gap-3 px-5">
              {(searchQuery ? filtered : category.games).map((game, i) => (
                <div
                  key={i}
                  onClick={() => playGame(game)}
                  className="bg-purple-600 hover:bg-purple-500 rounded-xl p-4 text-center cursor-pointer transition-all active:scale-95"
                >
                  <div className="text-xl mb-1">{game.icon}</div>
                  <div className="text-xs font-medium">{game.name}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Game Modal */}
      {showGame && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex justify-between items-center p-4 bg-purple-700">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{showGame.icon}</span>
              <span className="font-bold">{showGame.name}</span>
            </div>
            <button onClick={closeGame} className="px-4 py-2 bg-white/20 rounded-lg font-bold">
              ✕ Schließen
            </button>
          </div>
          <iframe src={showGame.url} className="flex-1 w-full border-none" title={showGame.name} />
        </div>
      )}

      {/* Reward Popup */}
      {showRewardPopup && lastReward && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="max-w-sm w-full p-6 rounded-2xl text-center bg-purple-700">
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="text-xl font-bold mb-2">Gewonnen!</h2>
            <div className="text-3xl font-bold text-yellow-400 mb-2">+{lastReward.amount} 🪙</div>
            <p className="text-white/70 mb-4">{lastReward.game} • Score: {lastReward.score}</p>
            <button
              onClick={() => setShowRewardPopup(false)}
              className="px-6 py-2 bg-white text-purple-700 font-bold rounded-lg"
            >
              Super! 🎉
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
