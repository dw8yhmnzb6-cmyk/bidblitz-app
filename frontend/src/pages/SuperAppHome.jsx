/**
 * BidBlitz Landing Page - Complete Design
 * Hero + Dashboard + Gaming Lobby
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const DASHBOARD_ITEMS = [
  { emoji: '🎮', name: 'Games', route: '/games' },
  { emoji: '🔥', name: 'Live Auctions', route: '/auctions' },
  { emoji: '👑', name: 'VIP Auctions', route: '/vip-auctions' },
  { emoji: '⛏', name: 'Mining', route: '/mining' },
  { emoji: '💰', name: 'Wallet', route: '/wallet' },
  { emoji: '🛍', name: 'Marketplace', route: '/marketplace' },
  { emoji: '🚕', name: 'Taxi', route: '/taxi' },
  { emoji: '🛴', name: 'Scooter', route: '/scooter' },
];

const GAMES = [
  { name: 'Dice Game', route: '/simple' },
  { name: 'Match-3', route: '/candy-match' },
  { name: 'Runner', route: '/runner-game' },
  { name: 'Puzzle', route: '/reaction-game' },
  { name: 'Strategy', route: '/coin-tap' },
  { name: 'Lucky Wheel', route: '/lucky-wheel' },
];

export default function SuperAppHome() {
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
      setCoins(1200);
    }
  };
  
  return (
    <>
      <style>{`
        .bbz-page {
          margin: 0;
          font-family: Arial, sans-serif;
          background: #0f172a;
          color: white;
          min-height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow-y: auto;
          z-index: 999;
        }
        
        .bbz-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          background: #020617;
          font-size: 20px;
        }
        
        .logo {
          font-weight: bold;
          color: #a855f7;
        }
        
        .wallet {
          background: #1e293b;
          padding: 10px 20px;
          border-radius: 20px;
          cursor: pointer;
          transition: 0.3s;
        }
        
        .wallet:hover {
          background: #334155;
        }
        
        .hero {
          text-align: center;
          padding: 40px 20px;
        }
        
        .hero h1 {
          font-size: 40px;
          color: #a855f7;
          margin: 0 0 10px 0;
        }
        
        .hero p {
          color: #94a3b8;
          margin: 0 0 20px 0;
        }
        
        .hero button {
          padding: 15px 30px;
          background: #a855f7;
          border: none;
          border-radius: 10px;
          color: white;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: 0.3s;
        }
        
        .hero button:hover {
          background: #9333ea;
          transform: scale(1.05);
        }
        
        .dashboard {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          padding: 20px;
        }
        
        .card {
          background: #1e293b;
          border-radius: 20px;
          padding: 30px;
          text-align: center;
          font-size: 20px;
          transform-style: preserve-3d;
          transition: 0.3s;
          cursor: pointer;
          border: none;
          color: white;
        }
        
        .card:hover {
          transform: rotateY(10deg) scale(1.05);
          background: #334155;
        }
        
        .card-emoji {
          font-size: 32px;
          display: block;
          margin-bottom: 8px;
        }
        
        .games-section {
          padding: 20px;
        }
        
        .games-section h2 {
          margin: 0 0 20px 0;
        }
        
        .game-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
        }
        
        .game {
          background: #1e293b;
          padding: 20px;
          border-radius: 15px;
          text-align: center;
          transition: 0.3s;
          cursor: pointer;
          border: none;
          color: white;
          font-size: 16px;
        }
        
        .game:hover {
          transform: scale(1.1);
          background: #334155;
        }
        
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          width: 100%;
          background: #020617;
          display: flex;
          justify-content: space-around;
          padding: 15px 0;
        }
        
        .bottom-nav button {
          background: none;
          border: none;
          color: white;
          font-size: 16px;
          cursor: pointer;
          transition: 0.3s;
          padding: 5px 10px;
        }
        
        .bottom-nav button:hover {
          color: #a855f7;
        }
        
        .bottom-nav button.active {
          color: #a855f7;
        }
      `}</style>
      
      <div className="bbz-page">
        {/* Header */}
        <header className="bbz-header">
          <div className="logo">⚡ BidBlitz</div>
          <div className="wallet" onClick={() => navigate('/wallet')}>
            💰 Coins: {coins.toLocaleString()}
          </div>
        </header>
        
        {/* Hero Section */}
        <div className="hero">
          <h1>Play • Bid • Win</h1>
          <p>Gaming • Auctions • Rewards</p>
          <button onClick={() => navigate('/games')}>Start Playing</button>
        </div>
        
        {/* Dashboard Grid */}
        <div className="dashboard">
          {DASHBOARD_ITEMS.map((item, index) => (
            <button
              key={index}
              className="card"
              onClick={() => navigate(item.route)}
            >
              <span className="card-emoji">{item.emoji}</span>
              {item.name}
            </button>
          ))}
        </div>
        
        {/* Gaming Lobby */}
        <div className="games-section">
          <h2>🎮 Gaming Lobby</h2>
          <div className="game-grid">
            {GAMES.map((game, index) => (
              <button
                key={index}
                className="game"
                onClick={() => navigate(game.route)}
              >
                {game.name}
              </button>
            ))}
          </div>
        </div>
        
        {/* Spacer for bottom nav */}
        <div style={{ height: '80px' }} />
        
        {/* Bottom Navigation */}
        <nav className="bottom-nav">
          <button className="active">Home</button>
          <button onClick={() => navigate('/games')}>Games</button>
          <button onClick={() => navigate('/wallet')}>Wallet</button>
          <button onClick={() => navigate('/auctions')}>Auctions</button>
          <button onClick={() => navigate('/profile')}>Profile</button>
        </nav>
      </div>
    </>
  );
}
