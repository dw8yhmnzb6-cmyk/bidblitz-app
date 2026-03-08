/**
 * BidBlitz Profile - Benutzer Einstellungen
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Menu Items
const MENU_ITEMS = [
  { id: 1, name: 'Meine Auktionen', emoji: '🛒', route: '/my-auctions' },
  { id: 2, name: 'Gewonnene Preise', emoji: '🏆', route: '/won-auctions' },
  { id: 3, name: 'Spiel-Statistiken', emoji: '📊', route: '/game-leaderboard' },
  { id: 4, name: 'Einstellungen', emoji: '⚙️', route: '/settings' },
  { id: 5, name: 'Hilfe & Support', emoji: '❓', route: '/support' },
  { id: 6, name: 'Abmelden', emoji: '🚪', route: '/logout' },
];

// Nav Items
const NAV_ITEMS = [
  { emoji: '🏠', route: '/super-home' },
  { emoji: '🎮', route: '/games' },
  { emoji: '💰', route: '/wallet' },
  { emoji: '👤', route: '/profile', active: true },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [coins, setCoins] = useState(0);

  const userId = localStorage.getItem('userId') || 'guest';

  useEffect(() => {
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
      setCoins(1200);
    }
  };

  const handleMenuClick = (item) => {
    if (item.route === '/logout') {
      logout();
      navigate('/');
    } else {
      navigate(item.route);
    }
  };

  return (
    <>
      <style>{`
        .profile-page {
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
          padding: 30px 20px 100px;
          text-align: center;
        }
        .profile-title {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 30px;
        }
        .profile-avatar {
          width: 100px;
          height: 100px;
          background: linear-gradient(90deg, #7c3aed, #9333ea);
          border-radius: 50%;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 50px;
        }
        .profile-name {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .profile-email {
          font-size: 14px;
          color: #9ca3af;
          margin-bottom: 20px;
        }
        .profile-stats {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-box {
          background: #1f2937;
          padding: 15px 25px;
          border-radius: 12px;
          text-align: center;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #7c3aed;
        }
        .stat-label {
          font-size: 12px;
          color: #9ca3af;
        }
        .profile-menu {
          text-align: left;
        }
        .menu-item {
          background: #1f2937;
          padding: 18px 20px;
          border-radius: 12px;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 15px;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          color: white;
          width: 100%;
          font-size: 16px;
        }
        .menu-item:hover {
          background: #374151;
        }
        .menu-emoji {
          font-size: 22px;
        }
        .menu-name {
          font-weight: 500;
        }
        .menu-arrow {
          margin-left: auto;
          color: #6b7280;
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
      
      <div className="profile-page" data-testid="profile-page">
        {/* Title */}
        <div className="profile-title">👤 Profile</div>

        {/* Avatar */}
        <div className="profile-avatar">
          {user?.first_name?.charAt(0) || '👤'}
        </div>

        {/* Name & Email */}
        <div className="profile-name">
          {user?.first_name || 'Gast'} {user?.last_name || 'Benutzer'}
        </div>
        <div className="profile-email">
          {user?.email || 'gast@bidblitz.de'}
        </div>

        {/* Stats */}
        <div className="profile-stats">
          <div className="stat-box">
            <div className="stat-value">{coins.toLocaleString()}</div>
            <div className="stat-label">Coins</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">12</div>
            <div className="stat-label">Level</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">5</div>
            <div className="stat-label">Gewinne</div>
          </div>
        </div>

        {/* Menu */}
        <div className="profile-menu">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              className="menu-item"
              onClick={() => handleMenuClick(item)}
            >
              <span className="menu-emoji">{item.emoji}</span>
              <span className="menu-name">{item.name}</span>
              <span className="menu-arrow">→</span>
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
