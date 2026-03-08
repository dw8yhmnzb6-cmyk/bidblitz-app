/**
 * BidBlitz Super App Home - Neues Design mit Wallet
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// 8 Services
const SERVICES = [
  { id: 1, name: 'Games', emoji: '🎮', route: '/games' },
  { id: 2, name: 'Mining', emoji: '⛏', route: '/mining' },
  { id: 3, name: 'Taxi', emoji: '🚕', route: '/ride-pay' },
  { id: 4, name: 'Scooter', emoji: '🛴', route: '/ride-pay' },
  { id: 5, name: 'Bike', emoji: '🚲', route: '/ride-pay' },
  { id: 6, name: 'Marketplace', emoji: '🛒', route: '/auctions' },
  { id: 7, name: 'Casino', emoji: '🎰', route: '/slot-machine' },
  { id: 8, name: 'Leaderboard', emoji: '🏆', route: '/game-leaderboard' },
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
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: white;
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
          background: linear-gradient(90deg, #7c3aed, #9333ea);
          padding: 20px;
          font-size: 28px;
          text-align: center;
          font-weight: bold;
        }
        .home-wallet {
          text-align: center;
          font-size: 22px;
          padding: 15px 10px;
        }
        .services-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          padding: 20px;
        }
        .service-card {
          background: #1f2937;
          border-radius: 16px;
          padding: 20px 10px;
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
        .service-card:hover {
          background: #7c3aed;
          transform: scale(1.05);
        }
        .service-card:active {
          transform: scale(0.95);
        }
        .service-icon {
          font-size: 34px;
          line-height: 1;
        }
        .service-name {
          font-size: 12px;
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
      
      <div className="super-home" data-testid="super-app-home">
        {/* Header */}
        <div className="home-header">
          🚀 BidBlitz
        </div>

        {/* Wallet */}
        <div className="home-wallet">
          💰 Wallet: {coins.toLocaleString()} Coins
        </div>

        {/* Services Grid */}
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
