/**
 * BidBlitz Super App Home - Clean Minimal Design
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Services (8 items)
const SERVICES = [
  { id: 1, name: 'Games', emoji: '🎮', route: '/games' },
  { id: 2, name: 'Mining', emoji: '⛏', route: '/mining' },
  { id: 3, name: 'Taxi', emoji: '🚕', route: '/taxi' },
  { id: 4, name: 'Scooter', emoji: '🛴', route: '/scooter' },
  { id: 5, name: 'Bike', emoji: '🚲', route: '/bike' },
  { id: 6, name: 'Market', emoji: '🛒', route: '/auctions' },
  { id: 7, name: 'Casino', emoji: '🎰', route: '/slot-machine' },
  { id: 8, name: 'Rank', emoji: '🏆', route: '/game-leaderboard' },
];

// Games (4 items)
const GAMES = [
  { id: 1, name: 'Candy Match', emoji: '🍬', route: '/candy-match' },
  { id: 2, name: 'Lucky Wheel', emoji: '🎡', route: '/lucky-wheel' },
  { id: 3, name: 'Coin Tap', emoji: '🪙', route: '/coin-tap' },
  { id: 4, name: 'Runner', emoji: '🏃', route: '/runner-game' },
];

export default function SuperAppHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const [coins, setCoins] = useState(1200);
  const [activePage, setActivePage] = useState('home');

  const userId = localStorage.getItem('userId') || 'guest_' + Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    if (!localStorage.getItem('userId')) localStorage.setItem('userId', userId);
    fetchCoins();
    
    // Hide global navbar
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

  const showPage = (page) => {
    setActivePage(page);
  };

  return (
    <>
      <style>{`
        .bbz {
          margin: 0;
          background: #0f172a;
          color: white;
          font-family: Arial, sans-serif;
          min-height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow-y: auto;
          z-index: 999;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          font-size: 22px;
          font-weight: bold;
        }
        .wallet {
          background: #7c3aed;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .wallet:hover {
          transform: scale(1.05);
        }
        .page {
          display: none;
          padding: 20px;
          padding-bottom: 100px;
        }
        .page.active {
          display: block;
        }
        .services {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-top: 20px;
        }
        .card {
          background: #1f2937;
          padding: 20px;
          border-radius: 14px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
          border: none;
          color: white;
        }
        .card:hover {
          background: #7c3aed;
          transform: scale(1.05);
        }
        .card-emoji {
          font-size: 28px;
          display: block;
          margin-bottom: 6px;
        }
        .games {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-top: 20px;
        }
        .game {
          background: #1f2937;
          padding: 30px;
          border-radius: 14px;
          text-align: center;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          color: white;
        }
        .game:hover {
          background: #7c3aed;
          transform: scale(1.05);
        }
        .game-emoji {
          font-size: 36px;
          display: block;
          margin-bottom: 8px;
        }
        .nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          width: 100%;
          background: #111827;
          display: flex;
          justify-content: space-around;
          padding: 14px;
          font-size: 22px;
          z-index: 1000;
        }
        .nav-btn {
          background: none;
          border: none;
          font-size: 22px;
          cursor: pointer;
          padding: 8px 16px;
          opacity: 0.5;
          transition: all 0.2s;
        }
        .nav-btn:hover, .nav-btn.active {
          opacity: 1;
          transform: scale(1.15);
        }
        .section-title {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 0;
        }
        .wallet-balance {
          font-size: 48px;
          font-weight: bold;
          text-align: center;
          margin: 40px 0;
        }
        .wallet-actions {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-top: 20px;
        }
        .wallet-btn {
          background: #7c3aed;
          padding: 16px;
          border-radius: 12px;
          text-align: center;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          color: white;
          transition: all 0.2s;
        }
        .wallet-btn:hover {
          background: #9333ea;
          transform: scale(1.02);
        }
        .profile-header {
          text-align: center;
          margin-bottom: 30px;
        }
        .profile-avatar {
          font-size: 64px;
          margin-bottom: 10px;
        }
        .profile-name {
          font-size: 24px;
          font-weight: bold;
        }
        .profile-menu {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .profile-item {
          background: #1f2937;
          padding: 16px 20px;
          border-radius: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          border: none;
          color: white;
          font-size: 16px;
          transition: all 0.2s;
        }
        .profile-item:hover {
          background: #374151;
        }
      `}</style>
      
      <div className="bbz" data-testid="super-app-home">
        {/* Header */}
        <div className="header">
          <div>BidBlitz</div>
          <div className="wallet" onClick={() => showPage('walletPage')} data-testid="header-wallet">
            💰{coins.toLocaleString()}
          </div>
        </div>

        {/* Home Page */}
        <div id="home" className={`page ${activePage === 'home' ? 'active' : ''}`} data-testid="home-page">
          <h2 className="section-title">⚡ Services</h2>
          <div className="services">
            {SERVICES.map((service) => (
              <button
                key={service.id}
                className="card"
                onClick={() => navigate(service.route)}
                data-testid={`service-${service.name.toLowerCase()}`}
              >
                <span className="card-emoji">{service.emoji}</span>
                {service.name}
              </button>
            ))}
          </div>
        </div>

        {/* Games Page */}
        <div id="games" className={`page ${activePage === 'games' ? 'active' : ''}`} data-testid="games-page">
          <h2 className="section-title">🎮 Games</h2>
          <div className="games">
            {GAMES.map((game) => (
              <button
                key={game.id}
                className="game"
                onClick={() => navigate(game.route)}
                data-testid={`game-${game.name.toLowerCase().replace(' ', '-')}`}
              >
                <span className="game-emoji">{game.emoji}</span>
                {game.name}
              </button>
            ))}
          </div>
        </div>

        {/* Wallet Page */}
        <div id="walletPage" className={`page ${activePage === 'walletPage' ? 'active' : ''}`} data-testid="wallet-page">
          <h2 className="section-title">💰 Wallet</h2>
          <div className="wallet-balance">
            {coins.toLocaleString()} Coins
          </div>
          <div className="wallet-actions">
            <button className="wallet-btn" onClick={() => navigate('/buy-bids')} data-testid="buy-coins-btn">
              💳 Buy Coins
            </button>
            <button className="wallet-btn" onClick={() => navigate('/withdraw')} data-testid="withdraw-btn">
              📤 Withdraw
            </button>
            <button className="wallet-btn" onClick={() => navigate('/payment-history')} data-testid="history-btn">
              📋 History
            </button>
            <button className="wallet-btn" onClick={() => navigate('/gift-bids')} data-testid="gift-btn">
              🎁 Gift
            </button>
          </div>
        </div>

        {/* Profile Page */}
        <div id="profile" className={`page ${activePage === 'profile' ? 'active' : ''}`} data-testid="profile-page">
          <div className="profile-header">
            <div className="profile-avatar">👤</div>
            <div className="profile-name">User</div>
          </div>
          <div className="profile-menu">
            <button className="profile-item" onClick={() => navigate('/profile')} data-testid="edit-profile-btn">
              <span>✏️ Edit Profile</span>
              <span>→</span>
            </button>
            <button className="profile-item" onClick={() => navigate('/achievements')} data-testid="achievements-btn">
              <span>🏆 Achievements</span>
              <span>→</span>
            </button>
            <button className="profile-item" onClick={() => navigate('/notifications')} data-testid="notifications-btn">
              <span>🔔 Notifications</span>
              <span>→</span>
            </button>
            <button className="profile-item" onClick={() => navigate('/app-referral')} data-testid="invite-btn">
              <span>👥 Invite Friends</span>
              <span>→</span>
            </button>
            <button className="profile-item" onClick={() => navigate('/login')} data-testid="logout-btn">
              <span>🚪 Logout</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Bottom Navigation */}
        <nav className="nav" data-testid="bottom-nav">
          <button
            onClick={() => showPage('home')}
            className={`nav-btn ${activePage === 'home' ? 'active' : ''}`}
            data-testid="nav-home"
          >
            🏠
          </button>
          <button
            onClick={() => showPage('games')}
            className={`nav-btn ${activePage === 'games' ? 'active' : ''}`}
            data-testid="nav-games"
          >
            🎮
          </button>
          <button
            onClick={() => showPage('walletPage')}
            className={`nav-btn ${activePage === 'walletPage' ? 'active' : ''}`}
            data-testid="nav-wallet"
          >
            💰
          </button>
          <button
            onClick={() => showPage('profile')}
            className={`nav-btn ${activePage === 'profile' ? 'active' : ''}`}
            data-testid="nav-profile"
          >
            👤
          </button>
        </nav>
      </div>
    </>
  );
}
