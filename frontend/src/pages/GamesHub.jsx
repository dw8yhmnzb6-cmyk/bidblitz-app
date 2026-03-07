/**
 * BidBlitz Games - Clean Mobile Design
 * Based on user's HTML template
 */
import React, { useState } from 'react';
import BottomNav from '../components/BottomNav';

const GAMES = [
  { id: 1, name: 'BidBlitz Match', icon: '⭐', gradient: 'from-purple-500 to-violet-700', url: '/games/bbz_match3.html' },
  { id: 2, name: 'Lucky Spin', icon: '🎰', gradient: 'from-purple-600 to-violet-600', url: '/games/lucky_spin.html' },
  { id: 3, name: 'Daily Quiz', icon: '❓', gradient: 'from-blue-600 to-blue-900', url: '/games/quiz.html' },
  { id: 4, name: 'Word Daily', icon: '🔤', gradient: 'from-emerald-600 to-emerald-800', url: '/games/word.html' },
  { id: 5, name: 'Scratch Card', icon: '💳', gradient: 'from-amber-600 to-amber-800', url: '/games/scratch.html' },
  { id: 6, name: 'Memory', icon: '🧠', gradient: 'from-fuchsia-600 to-purple-600', url: '/games/memory.html' },
  { id: 7, name: 'Reaction Test', icon: '⚡', gradient: 'from-red-600 to-red-900', url: '/games/reaction.html' },
  { id: 8, name: 'Speed Tap', icon: '👏', gradient: 'from-blue-700 to-blue-900', url: '/games/speed_tap.html' },
  { id: 9, name: 'Treasure Hunt', icon: '🗺', gradient: 'from-amber-500 to-amber-800', url: '/games/bbz_match3.html' },
  { id: 10, name: 'Slots', icon: '🎰', gradient: 'from-orange-600 to-orange-900', url: '/games/slots.html' },
  { id: 11, name: 'Dice Roll', icon: '🎲', gradient: 'from-blue-600 to-blue-800', url: '/games/dice.html' },
  { id: 12, name: 'Coin Drop', icon: '🪙', gradient: 'from-yellow-500 to-yellow-800', url: '/games/coin_drop.html' },
];

export default function GamesHub() {
  const [showGame, setShowGame] = useState(null);
  const [rank] = useState(1);
  const [points] = useState(72);

  const playGame = (game) => {
    setShowGame(game);
  };

  const closeGame = () => {
    setShowGame(null);
  };

  return (
    <div className="min-h-screen text-white pb-24" style={{ background: 'linear-gradient(180deg, #020617, #0f172a)' }}>
      
      {/* Header */}
      <header className="flex justify-between items-center p-4" style={{ background: '#0b1023' }}>
        <div className="text-2xl font-bold text-amber-500">⚡ BidBlitz</div>
        <div className="text-2xl cursor-pointer">☰</div>
      </header>

      {/* Container */}
      <div className="p-5">
        
        {/* Weekly League */}
        <div 
          className="rounded-[20px] p-5 mb-5"
          style={{ background: 'linear-gradient(135deg, #4c1d95, #1e1b4b)' }}
        >
          <h3 className="text-lg font-semibold mb-1">Weekly League</h3>
          <p className="text-white/80">#{rank} Rang • {points} Punkte</p>
        </div>

        {/* Games Pass */}
        <div 
          className="rounded-[15px] p-4 mb-5 text-center"
          style={{ background: 'linear-gradient(135deg, #92400e, #f59e0b)' }}
        >
          <h4 className="text-lg font-semibold">🎮 Games Pass Active</h4>
          <p className="text-white/90">+20% Daily • +10% Liga</p>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-3 gap-4">
          {GAMES.map(game => (
            <div
              key={game.id}
              onClick={() => playGame(game)}
              className={`bg-gradient-to-br ${game.gradient} rounded-[20px] p-6 text-center cursor-pointer transition-transform duration-200 hover:scale-105`}
            >
              <div className="text-3xl mb-2">{game.icon}</div>
              <div className="text-sm font-medium mb-2">{game.name}</div>
              <button 
                className="mt-1 px-3 py-1.5 rounded-[10px] text-sm text-white"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                Play
              </button>
            </div>
          ))}
        </div>

      </div>

      {/* Game Modal */}
      {showGame && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
          <div className="flex justify-between items-center p-4" style={{ background: 'linear-gradient(135deg, #4c1d95, #1e1b4b)' }}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{showGame.icon}</span>
              <h3 className="font-bold text-white text-lg">{showGame.name}</h3>
            </div>
            <button 
              onClick={closeGame}
              className="px-4 py-2 rounded-xl text-white font-bold transition-all"
              style={{ background: 'rgba(255,255,255,0.2)' }}
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

      <BottomNav />
    </div>
  );
}
