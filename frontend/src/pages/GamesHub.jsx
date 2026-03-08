/**
 * BidBlitz Games Hub - Clean Minimal Design
 * 2x3 Grid mit Emoji-Spielen
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Games mit Emojis
const GAMES = [
  { id: 1, name: 'Candy Match', emoji: '🍬', route: '/candy-match' },
  { id: 2, name: 'Reaction Game', emoji: '🎯', route: '/games/reaction.html' },
  { id: 3, name: 'Lucky Wheel', emoji: '🎰', route: '/games/wheel.html' },
  { id: 4, name: 'Coin Tap', emoji: '🪙', route: '/games/clicker.html' },
  { id: 5, name: 'Dice Game', emoji: '🎲', route: '/games/dice.html' },
  { id: 6, name: 'Speed Click', emoji: '⚡', route: '/games/speed.html' },
  { id: 7, name: 'Garden Match', emoji: '🌺', route: '/games/garden.html' },
  { id: 8, name: 'Archer', emoji: '🏹', route: '/games/archer.html' },
];

export default function GamesHub() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(0);

  const userId = localStorage.getItem('userId') || 'guest_' + Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    if (!localStorage.getItem('userId')) localStorage.setItem('userId', userId);
    fetchCoins();
    
    // Hide the main header
    const header = document.querySelector('header');
    if (header) header.style.display = 'none';
    
    return () => {
      const header = document.querySelector('header');
      if (header) header.style.display = '';
    };
  }, []);

  const fetchCoins = async () => {
    try {
      const res = await axios.get(`${API}/bbz/coins/${userId}`);
      setCoins(res.data.coins || 0);
    } catch {
      setCoins(100);
    }
  };

  const handleGameClick = (game) => {
    if (game.route.startsWith('/games/')) {
      window.location.href = game.route;
    } else {
      navigate(game.route);
    }
  };

  return (
    <>
      <style>{`
        .games-hub {
          background: #0f172a;
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          min-height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow-y: auto;
          z-index: 999;
        }
        .games-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 28px;
          padding: 20px;
          font-weight: bold;
        }
        .games-coins {
          background: #7c3aed;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 18px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .games-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          padding: 20px;
        }
        .game-card {
          background: #1f2937;
          border-radius: 15px;
          padding: 30px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .game-card:hover {
          background: #7c3aed;
          transform: translateY(-3px);
        }
        .game-card:active {
          transform: scale(0.95);
        }
        .game-emoji {
          font-size: 48px;
          line-height: 1;
        }
        .game-name {
          font-size: 18px;
          font-weight: 600;
        }
        .back-btn {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
        }
      `}</style>
      
      <div className="games-hub" data-testid="games-hub">
        {/* Header */}
        <div className="games-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="back-btn" onClick={() => navigate('/super-home')}>←</button>
            <span>🎮 BidBlitz Games</span>
          </div>
          <div className="games-coins">
            <span>💰</span>
            <span>{coins}</span>
          </div>
        </div>

        {/* Grid */}
        <div className="games-grid">
          {GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => handleGameClick(game)}
              className="game-card"
              data-testid={`game-${game.id}`}
            >
              <span className="game-emoji">{game.emoji}</span>
              <span className="game-name">{game.name}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
