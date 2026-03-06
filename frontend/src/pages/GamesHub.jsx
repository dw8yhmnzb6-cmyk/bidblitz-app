/**
 * BidBlitz Game Center
 * 10 Games in 2-column Grid
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function GamesHub() {
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
    
    // Short delay for animation feel
    await new Promise(r => setTimeout(r, 500));
    
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
    
    setResult(win >= 0 ? `+${win}` : `${win}`);
    setLoading('');
  };
  
  // Game functions
  const wheel = () => playGame('lucky_wheel', () => Math.floor(Math.random() * 100));
  const slot = () => playGame('slot_machine', () => Math.floor(Math.random() * 200) - 50);
  const reaction = () => playGame('reaction', () => Math.floor(Math.random() * 20));
  const daily = () => playGame('daily_bonus', () => 50);
  const dice = () => playGame('dice', () => Math.floor(Math.random() * 60));
  const flip = () => playGame('coin_flip', () => Math.random() > 0.5 ? 30 : -10);
  const bomb = () => playGame('bomb_game', () => Math.random() > 0.7 ? 100 : -50);
  const jackpot = () => playGame('jackpot', () => Math.floor(Math.random() * 500));
  const puzzle = () => playGame('puzzle', () => 20);
  const boost = () => playGame('boost_game', () => Math.floor(Math.random() * 150));
  
  const games = [
    { id: 'lucky_wheel', emoji: '🎡', name: 'Lucky Wheel', action: wheel, btn: 'Play' },
    { id: 'slot_machine', emoji: '🎰', name: 'Slot Machine', action: slot, btn: 'Play' },
    { id: 'reaction', emoji: '⚡', name: 'Reaction', action: reaction, btn: 'Play' },
    { id: 'daily_bonus', emoji: '🎁', name: 'Daily Bonus', action: daily, btn: 'Claim' },
    { id: 'dice', emoji: '🎲', name: 'Dice', action: dice, btn: 'Roll' },
    { id: 'coin_flip', emoji: '🪙', name: 'Coin Flip', action: flip, btn: 'Flip' },
    { id: 'bomb_game', emoji: '💣', name: 'Bomb Game', action: bomb, btn: 'Try' },
    { id: 'jackpot', emoji: '🏆', name: 'Jackpot', action: jackpot, btn: 'Play' },
    { id: 'puzzle', emoji: '🧠', name: 'Puzzle', action: puzzle, btn: 'Solve' },
    { id: 'boost_game', emoji: '🚀', name: 'Boost Game', action: boost, btn: 'Boost' },
  ];
  
  return (
    <div className="min-h-screen bg-[#0b0e24] text-white pb-20">
      <div className="p-5">
        <h2 className="text-2xl font-bold mb-2">BidBlitz Game Center</h2>
        <h3 className="text-lg mb-4">
          Coins: <span className="font-bold text-amber-400" data-testid="coins-display">{coins.toLocaleString()}</span>
        </h3>
        
        {/* 10 Games Grid (2 columns) */}
        <div className="grid grid-cols-2 gap-5 mb-4" data-testid="games-grid">
          {games.map((game) => (
            <div 
              key={game.id}
              className="bg-[#171a3a] p-5 rounded-2xl text-center"
              data-testid={`game-${game.id}`}
            >
              <h4 className="font-semibold mb-3">
                {game.emoji} {game.name}
              </h4>
              <button
                onClick={game.action}
                disabled={loading === game.id}
                className="px-5 py-2.5 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-medium 
                           disabled:opacity-50 transition-colors min-w-[80px]"
                data-testid={`btn-${game.id}`}
              >
                {loading === game.id ? '...' : game.btn}
              </button>
            </div>
          ))}
        </div>
        
        {/* Result Display */}
        {result && (
          <p 
            className={`text-center text-lg font-bold mb-4 p-3 rounded-xl ${
              result.startsWith('+') ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
            }`}
            data-testid="game-result"
          >
            {result} Coins
          </p>
        )}
        
        {/* More Games Links */}
        <div className="bg-[#171a3a] p-5 rounded-2xl">
          <h3 className="font-semibold mb-3">More Games</h3>
          <div className="space-y-2">
            <Link 
              to="/match3" 
              className="block py-3 px-4 bg-[#0b0e24] rounded-xl hover:bg-[#6c63ff]/20 transition-colors"
            >
              🧩 Match Game
            </Link>
            <Link 
              to="/treasure-hunt" 
              className="block py-3 px-4 bg-[#0b0e24] rounded-xl hover:bg-[#6c63ff]/20 transition-colors"
            >
              🗺️ Schatzsuche
            </Link>
            <Link 
              to="/app-leaderboard"
              className="block py-3 px-4 bg-[#0b0e24] rounded-xl hover:bg-[#6c63ff]/20 transition-colors"
            >
              🏆 Rangliste
            </Link>
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
