/**
 * BidBlitz Super App Home - Erweitertes Design
 * Mit Hero Banner, Quick Services und Trending Games
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Quick Services
const SERVICES = [
  { id: 1, name: 'Games', emoji: '🎮', route: '/games' },
  { id: 2, name: 'Mining', emoji: '⛏', route: '/mining' },
  { id: 3, name: 'Taxi', emoji: '🚕', route: '/ride-pay' },
  { id: 4, name: 'Scooter', emoji: '🛴', route: '/ride-pay' },
  { id: 5, name: 'Bike', emoji: '🚲', route: '/ride-pay' },
  { id: 6, name: 'Market', emoji: '🛒', route: '/auctions' },
  { id: 7, name: 'Casino', emoji: '🎰', route: '/slot-machine' },
  { id: 8, name: 'Rank', emoji: '🏆', route: '/game-leaderboard' },
];

// Trending Games
const TRENDING_GAMES = [
  { id: 1, name: 'Candy Match', emoji: '🍬', route: '/candy-match' },
  { id: 2, name: 'Lucky Wheel', emoji: '🎡', route: '/lucky-wheel' },
  { id: 3, name: 'Coin Tap', emoji: '🪙', route: '/coin-tap' },
  { id: 4, name: 'Runner', emoji: '🏃', route: '/runner-game' },
];

// Nav Items
const NAV_ITEMS = [
  { emoji: '🏠', route: '/super-home', active: true },
  { emoji: '🎮', route: '/games' },
  { emoji: '💰', route: '/wallet' },
  { emoji: '👤', route: '/profile' },
];

export default function SuperAppHome() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(1200);

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
      setCoins(res.data.coins || 1200);
    } catch {
      setCoins(1200);
    }
  };

  return (
    <>
      <style>{`
        .super-home {
          margin: 0;
          background: #0f172a;
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
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
        .home-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px;
          font-size: 24px;
          font-weight: bold;
        }
        .home-wallet {
          background: #7c3aed;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 18px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .home-hero {
          margin: 20px;
          padding: 40px 20px;
          border-radius: 18px;
          background: linear-gradient(90deg, #9333ea, #7c3aed);
          text-align: center;
          font-size: 22px;
          font-weight: 500;
        }
        .section-title {
          padding: 16px;
          font-size: 20px;
          font-weight: bold;
        }
        .services-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          padding: 0 16px 16px;
        }
        .service-card {
          background: #1f2937;
          border-radius: 14px;
          padding: 18px 8px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .service-card:hover {
          background: #7c3aed;
          transform: scale(1.05);
        }
        .service-card:active {
          transform: scale(0.95);
        }
        .service-icon {
          font-size: 30px;
          line-height: 1;
        }
        .service-name {
          font-size: 12px;
          font-weight: 600;
        }
        .games-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          padding: 0 16px 16px;
        }
        .game-card {
          background: #1f2937;
          padding: 24px 16px;
          border-radius: 14px;
          text-align: center;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .game-card:hover {
          background: #7c3aed;
          transform: scale(1.02);
        }
        .game-card:active {
          transform: scale(0.98);
        }
        .game-emoji {
          font-size: 24px;
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
          padding: 14px;
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
      
      <div className="super-home" data-testid="super-app-home">
        {/* Header */}
        <div className="home-header">
          <div>BidBlitz</div>
          <div className="home-wallet">
            <span>💰</span>
            <span>{coins.toLocaleString()}</span>
          </div>
        </div>

        {/* Hero Banner */}
        <div className="home-hero">
          🚀 Play Games • Ride • Earn Coins
        </div>

        {/* Quick Services */}
        <div className="section-title">⚡ Quick Services</div>
        <div className="services-grid">
          {SERVICES.map((service) => (
            <button
              key={service.id}
              onClick={() => navigate(service.route)}
              className="service-card"
              data-testid={`service-${service.name.toLowerCase()}`}
            >
              <div className="service-icon">{service.emoji}</div>
              <div className="service-name">{service.name}</div>
            </button>
          ))}
        </div>

        {/* Trending Games */}
        <div className="section-title">🔥 Trending Games</div>
        <div className="games-grid">
          {TRENDING_GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => navigate(game.route)}
              className="game-card"
              data-testid={`game-${game.id}`}
            >
              <span className="game-emoji">{game.emoji}</span>
              <span>{game.name}</span>
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
