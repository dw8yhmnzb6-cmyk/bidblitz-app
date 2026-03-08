/**
 * BidBlitz Super App Home - 12 Karten Design
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// 12 Quick Actions
const QUICK_ACTIONS = [
  { id: 1, name: 'Games', emoji: '🎮', route: '/games' },
  { id: 2, name: 'Mining', emoji: '⛏', route: '/mining' },
  { id: 3, name: 'Taxi', emoji: '🚕', route: '/ride-pay' },
  { id: 4, name: 'Scooter', emoji: '🛴', route: '/ride-pay' },
  { id: 5, name: 'Bike', emoji: '🚲', route: '/ride-pay' },
  { id: 6, name: 'Market', emoji: '🛒', route: '/auctions' },
  { id: 7, name: 'Lucky', emoji: '🎡', route: '/lucky-wheel' },
  { id: 8, name: 'Rank', emoji: '🏆', route: '/game-leaderboard' },
  { id: 9, name: 'Casino', emoji: '🎰', route: '/slot-machine' },
  { id: 10, name: 'Memory', emoji: '🧠', route: '/candy-match' },
  { id: 11, name: 'Speed', emoji: '⚡', route: '/reaction-game' },
  { id: 12, name: 'Profile', emoji: '👤', route: '/profile' },
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
        .bbz-home {
          margin: 0;
          background: #0f172a;
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          min-height: 100vh;
          padding-bottom: 80px;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow-y: auto;
          z-index: 999;
        }
        .bbz-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px;
          font-size: 24px;
          font-weight: bold;
        }
        .bbz-wallet {
          background: #7c3aed;
          padding: 6px 14px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 18px;
        }
        .bbz-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          padding: 18px;
        }
        .bbz-card {
          background: #1f2937;
          padding: 20px 10px;
          border-radius: 12px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .bbz-card:hover {
          background: #7c3aed;
          transform: translateY(-2px);
        }
        .bbz-card:active {
          transform: scale(0.95);
        }
        .bbz-emoji {
          font-size: 32px;
          line-height: 1;
        }
        .bbz-name {
          font-weight: 600;
          font-size: 13px;
        }
        .bbz-bottom {
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
        .bbz-nav-item {
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px 20px;
          font-size: 22px;
          opacity: 0.6;
          transition: all 0.2s ease;
        }
        .bbz-nav-item:hover {
          opacity: 1;
          transform: scale(1.15);
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

        {/* Grid - 4x3 = 12 Karten */}
        <div className="bbz-grid">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => navigate(action.route)}
              className="bbz-card"
              data-testid={`quick-action-${action.name.toLowerCase()}`}
            >
              <span className="bbz-emoji">{action.emoji}</span>
              <span className="bbz-name">{action.name}</span>
            </button>
          ))}
        </div>

        {/* Bottom Navigation */}
        <nav className="bbz-bottom">
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
