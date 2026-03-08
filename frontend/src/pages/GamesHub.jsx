/**
 * BidBlitz Games - Mit Banner und 3-Spalten Grid
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Top Games
const TOP_GAMES = [
  { id: 1, name: 'Candy Match', emoji: '🍬', route: '/candy-match' },
  { id: 2, name: 'Slot Machine', emoji: '🎰', route: '/slot-machine' },
  { id: 3, name: 'Lucky Wheel', emoji: '🎡', route: '/lucky-wheel' },
];

// Casual Games
const CASUAL_GAMES = [
  { id: 4, name: 'Memory', emoji: '🧠', route: '/candy-match' },
  { id: 5, name: 'Reaction', emoji: '⚡', route: '/reaction-game' },
  { id: 6, name: 'Coin Tap', emoji: '🪙', route: '/coin-tap' },
  { id: 7, name: 'Runner', emoji: '🏃', route: '/runner-game' },
  { id: 8, name: 'Dice', emoji: '🎯', route: '/games/dice.html' },
  { id: 9, name: 'Arcade', emoji: '🎮', route: '/games/garden.html' },
];

// Nav Items
const NAV_ITEMS = [
  { emoji: '🏠', route: '/super-home' },
  { emoji: '🎮', route: '/games', active: true },
  { emoji: '💰', route: '/wallet' },
  { emoji: '👤', route: '/profile' },
];

export default function GamesHub() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(0);

  const userId = localStorage.getItem('userId') || 'guest_' + Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    if (!localStorage.getItem('userId')) localStorage.setItem('userId', userId);
    fetchCoins();
    
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
        .games-page {
          margin: 0;
          background: #0f172a;
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          min-height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow-y: auto;
          z-index: 999;
          padding-bottom: 80px;
        }
        .games-header {
          background: linear-gradient(90deg, #7c3aed, #9333ea);
          padding: 24px;
          font-size: 30px;
          text-align: center;
          font-weight: bold;
        }
        .games-banner {
          margin: 20px;
          padding: 40px 20px;
          border-radius: 20px;
          background: linear-gradient(90deg, #9333ea, #7c3aed);
          font-size: 20px;
          text-align: center;
          font-weight: 500;
        }
        .section-title {
          padding: 20px 20px 10px;
          font-size: 22px;
          font-weight: bold;
        }
        .games-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          padding: 0 20px 20px;
        }
        .game-card {
          background: #1f2937;
          border-radius: 16px;
          padding: 22px 10px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .game-card:hover {
          background: #7c3aed;
          transform: scale(1.05);
        }
        .game-card:active {
          transform: scale(0.95);
        }
        .game-icon {
          font-size: 36px;
          margin-bottom: 8px;
          line-height: 1;
        }
        .game-name {
          font-size: 14px;
          font-weight: 600;
        }
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          width: 100%;
          background: #111827;
          display: flex;
          justify-content: space-around;
          padding: 12px;
          z-index: 1000;
        }
        .nav-btn {
          background: none;
          border: none;
          font-size: 22px;
          cursor: pointer;
          padding: 8px 16px;
          opacity: 0.6;
          transition: all 0.2s;
        }
        .nav-btn:hover, .nav-btn.active {
          opacity: 1;
          transform: scale(1.1);
        }
      `}</style>
      
      <div className="games-page" data-testid="games-hub">
        {/* Header */}
        <div className="games-header">
          🎮 BidBlitz Games
        </div>

        {/* Banner */}
        <div className="games-banner">
          🔥 Play Games • Earn Coins • Win Rewards
        </div>

        {/* Top Games */}
        <div className="section-title">⭐ Top Games</div>
        <div className="games-grid">
          {TOP_GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => handleGameClick(game)}
              className="game-card"
              data-testid={`game-${game.id}`}
            >
              <div className="game-icon">{game.emoji}</div>
              <div className="game-name">{game.name}</div>
            </button>
          ))}
        </div>

        {/* Casual Games */}
        <div className="section-title">🎲 Casual Games</div>
        <div className="games-grid">
          {CASUAL_GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => handleGameClick(game)}
              className="game-card"
              data-testid={`game-${game.id}`}
            >
              <div className="game-icon">{game.emoji}</div>
              <div className="game-name">{game.name}</div>
            </button>
          ))}
        </div>

        {/* Bottom Navigation */}
        <nav className="bottom-nav">
          {NAV_ITEMS.map((item, index) => (
            <button
              key={index}
              onClick={() => navigate(item.route)}
              className={`nav-btn ${item.active ? 'active' : ''}`}
            >
              {item.emoji}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
