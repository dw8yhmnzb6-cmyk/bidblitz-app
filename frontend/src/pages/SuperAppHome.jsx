/**
 * BidBlitz Super App Home - Clean Minimal Design
 * Exaktes Design wie vom Benutzer gewünscht
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Quick Actions mit Emojis
const QUICK_ACTIONS = [
  { id: 1, name: 'Games', emoji: '🎮', route: '/games' },
  { id: 2, name: 'Mining', emoji: '⛏', route: '/mining' },
  { id: 3, name: 'Taxi', emoji: '🚕', route: '/ride-pay' },
  { id: 4, name: 'Scooter', emoji: '🛴', route: '/ride-pay' },
  { id: 5, name: 'Bike', emoji: '🚲', route: '/ride-pay' },
  { id: 6, name: 'Market', emoji: '🛒', route: '/auctions' },
  { id: 7, name: 'Lottery', emoji: '🎲', route: '/games' },
  { id: 8, name: 'Ranking', emoji: '🏆', route: '/leaderboard' },
];

// Navigation Items
const NAV_ITEMS = [
  { emoji: '🏠', route: '/super-home', active: true },
  { emoji: '🎮', route: '/games', active: false },
  { emoji: '💰', route: '/wallet', active: false },
  { emoji: '👤', route: '/profile', active: false },
];

export default function SuperAppHome() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(1200);

  const userId = localStorage.getItem('userId') || 'guest_' + Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    if (!localStorage.getItem('userId')) localStorage.setItem('userId', userId);
    fetchCoins();
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
        .bbz-home {
          margin: 0;
          background: #0f172a;
          color: white;
          font-family: sans-serif;
          min-height: 100vh;
          padding-bottom: 80px;
        }
        .bbz-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          font-size: 26px;
          font-weight: bold;
        }
        .bbz-wallet {
          background: #7c3aed;
          padding: 8px 14px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 20px;
        }
        .bbz-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          padding: 20px;
        }
        .bbz-item {
          background: #1f2937;
          padding: 25px 10px;
          border-radius: 14px;
          text-align: center;
          font-size: 14px;
          cursor: pointer;
          transition: 0.2s;
          border: none;
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .bbz-item:hover {
          background: #7c3aed;
        }
        .bbz-item:active {
          transform: scale(0.95);
        }
        .bbz-emoji {
          font-size: 32px;
          line-height: 1;
        }
        .bbz-name {
          font-weight: 500;
          font-size: 13px;
        }
        .bbz-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          width: 100%;
          display: flex;
          justify-content: space-around;
          background: #111827;
          padding: 16px 12px;
          font-size: 24px;
          z-index: 100;
        }
        .bbz-nav-item {
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px 20px;
          font-size: 24px;
          opacity: 0.7;
          transition: 0.2s;
        }
        .bbz-nav-item:hover {
          opacity: 1;
          transform: scale(1.1);
        }
        .bbz-nav-item.active {
          opacity: 1;
        }
      `}</style>
      
      <div className="bbz-home" data-testid="super-app-home">
        {/* Header */}
        <div className="bbz-top">
          <div>BidBlitz</div>
          <div className="bbz-wallet">
            <span>💰</span>
            <span>{coins.toLocaleString()}</span>
          </div>
        </div>

        {/* Grid */}
        <div className="bbz-grid">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => navigate(action.route)}
              className="bbz-item"
              data-testid={`quick-action-${action.name.toLowerCase()}`}
            >
              <span className="bbz-emoji">{action.emoji}</span>
              <span className="bbz-name">{action.name}</span>
            </button>
          ))}
        </div>

        {/* Bottom Navigation */}
        <nav className="bbz-nav">
          {NAV_ITEMS.map((item, index) => (
            <button
              key={index}
              onClick={() => navigate(item.route)}
              className={`bbz-nav-item ${item.active ? 'active' : ''}`}
            >
              {item.emoji}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
