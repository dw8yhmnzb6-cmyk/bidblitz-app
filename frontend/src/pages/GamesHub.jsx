/**
 * BidBlitz Games - Clean Mobile Design
 * Based on user's HTML template
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';
import soundManager from '../utils/soundManager';
import { useLanguage } from '../context/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const GAMES = [
  { id: 1, name: 'BidBlitz Match', icon: '⭐', gradient: 'from-purple-500 to-violet-700', url: '/games/bbz_match3.html', key: 'bidblitzMatch' },
  { id: 2, name: 'Lucky Spin', icon: '🎰', gradient: 'from-purple-600 to-violet-600', url: '/games/lucky_spin.html', key: 'luckySpin' },
  { id: 3, name: 'Daily Quiz', icon: '❓', gradient: 'from-blue-600 to-blue-900', url: '/games/quiz.html', key: 'dailyQuiz' },
  { id: 4, name: 'Word Daily', icon: '🔤', gradient: 'from-emerald-600 to-emerald-800', url: '/games/word.html', key: 'wordDaily' },
  { id: 5, name: 'Scratch Card', icon: '💳', gradient: 'from-amber-600 to-amber-800', url: '/games/scratch.html', key: 'scratchCard' },
  { id: 6, name: 'Memory', icon: '🧠', gradient: 'from-fuchsia-600 to-purple-600', url: '/games/memory.html', key: 'memory' },
  { id: 7, name: 'Reaction Test', icon: '⚡', gradient: 'from-red-600 to-red-900', url: '/games/reaction.html', key: 'reactionTest' },
  { id: 8, name: 'Speed Tap', icon: '👏', gradient: 'from-blue-700 to-blue-900', url: '/games/speed_tap.html', key: 'speedTap' },
  { id: 9, name: 'Treasure Hunt', icon: '🗺', gradient: 'from-amber-500 to-amber-800', url: '/games/bbz_match3.html', key: 'treasureHunt' },
  { id: 10, name: 'Slots', icon: '🎰', gradient: 'from-orange-600 to-orange-900', url: '/games/slots.html', key: 'slots' },
  { id: 11, name: 'Dice Roll', icon: '🎲', gradient: 'from-blue-600 to-blue-800', url: '/games/dice.html', key: 'diceRoll' },
  { id: 12, name: 'Coin Drop', icon: '🪙', gradient: 'from-yellow-500 to-yellow-800', url: '/games/coin_drop.html', key: 'coinDrop' },
];

export default function GamesHub() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [showGame, setShowGame] = useState(null);
  const [leagueStatus, setLeagueStatus] = useState({ rank: 1, points: 0, tier: 'bronze' });
  const [hasGamePass, setHasGamePass] = useState(true);

  const userId = localStorage.getItem('userId') || 'guest_' + Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    if (!localStorage.getItem('userId')) {
      localStorage.setItem('userId', userId);
    }
    fetchLeagueStatus();
    soundManager.init();
  }, []);

  const fetchLeagueStatus = async () => {
    try {
      const res = await axios.get(`${API}/league/status?user_id=${userId}`);
      setLeagueStatus(res.data);
    } catch (error) {
      console.log('Using default league status');
    }
  };

  const playGame = async (game) => {
    soundManager.gameStart();
    setShowGame(game);
    
    // Add league points when playing
    try {
      await axios.post(`${API}/league/add-points?user_id=${userId}&points=5&source=game`);
      // Update mission progress
      await axios.post(`${API}/league/missions/progress?user_id=${userId}&mission_id=play_3_games&amount=1`);
    } catch (error) {
      console.log('Could not update league');
    }
  };

  const closeGame = () => {
    soundManager.gameEnd();
    setShowGame(null);
    fetchLeagueStatus(); // Refresh stats
  };

  const getTierEmoji = (tier) => {
    const emojis = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎', diamond: '👑' };
    return emojis[tier] || '🥉';
  };

  return (
    <div className="min-h-screen text-white pb-24" style={{ background: 'linear-gradient(180deg, #020617, #0f172a)' }}>
      
      {/* Header */}
      <header className="flex justify-between items-center p-4" style={{ background: '#0b1023' }}>
        <div className="text-2xl font-bold text-amber-500">⚡ BidBlitz</div>
        <div 
          className="text-2xl cursor-pointer"
          onClick={() => navigate('/missions')}
        >
          🎯
        </div>
      </header>

      {/* Container */}
      <div className="p-5">
        
        {/* Weekly League */}
        <div 
          className="rounded-[20px] p-5 mb-5 cursor-pointer hover:scale-[1.02] transition-transform"
          style={{ background: 'linear-gradient(135deg, #4c1d95, #1e1b4b)' }}
          onClick={() => navigate('/missions')}
        >
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold mb-1">Weekly League {getTierEmoji(leagueStatus.tier)}</h3>
              <p className="text-white/80">#{leagueStatus.rank} Rang • {leagueStatus.points} Punkte</p>
            </div>
            <div className="text-3xl">{getTierEmoji(leagueStatus.tier)}</div>
          </div>
        </div>

        {/* Games Pass */}
        {hasGamePass && (
          <div 
            className="rounded-[15px] p-4 mb-5 text-center"
            style={{ background: 'linear-gradient(135deg, #92400e, #f59e0b)' }}
          >
            <h4 className="text-lg font-semibold">🎮 Games Pass Active</h4>
            <p className="text-white/90">+20% Daily • +10% Liga</p>
          </div>
        )}

        {/* Games Grid */}
        <div className="grid grid-cols-3 gap-4">
          {GAMES.map(game => (
            <div
              key={game.id}
              onClick={() => playGame(game)}
              className={`bg-gradient-to-br ${game.gradient} rounded-[20px] p-6 text-center cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95`}
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
