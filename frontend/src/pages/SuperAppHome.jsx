/**
 * BidBlitz Super App - Clean Minimal Design
 * Connected to Backend API for coins
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const SERVICE_CARDS = [
  { emoji: '🎮', name: 'Games', route: '/games' },
  { emoji: '⛏', name: 'Miner', route: '/mining' },
  { emoji: '🔥', name: 'Live Auctions', route: '/live-auction' },
  { emoji: '💎', name: 'VIP Auctions', route: '/vip-auctions' },
  { emoji: '🚕', name: 'Taxi', route: '/taxi' },
  { emoji: '🛴', name: 'Scooter', route: '/scooter' },
];

const GAMES = [
  { name: 'Lucky Wheel', route: '/lucky-wheel', reward: 10 },
  { name: 'Scratch Card', route: '/scratch-card', reward: 20 },
  { name: 'Reaction Game', route: '/reaction-game', reward: 5 },
  { name: 'Runner Game', route: '/runner-game', reward: 15 },
  { name: 'Puzzle Match', route: '/candy-match', reward: 25 },
  { name: 'Treasure Box', route: '/coin-tap', reward: 30 },
];

export default function SuperAppHome() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(100);
  const [showWinAlert, setShowWinAlert] = useState(null);
  
  const userId = localStorage.getItem('userId') || 'guest_' + Math.random().toString(36).substr(2, 9);
  
  useEffect(() => {
    if (!localStorage.getItem('userId')) localStorage.setItem('userId', userId);
    fetchCoins();
    
    // Hide main navbar
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
      setCoins(res.data.coins || 100);
    } catch {
      setCoins(100);
    }
  };
  
  const playGame = async (gameName, reward) => {
    try {
      const res = await axios.post(`${API}/bbz/coins/earn`, {
        user_id: userId,
        amount: reward,
        source: `game_${gameName.toLowerCase().replace(' ', '_')}`
      });
      setCoins(res.data.new_balance);
      setShowWinAlert(reward);
      setTimeout(() => setShowWinAlert(null), 2000);
    } catch {
      setCoins(prev => prev + reward);
      setShowWinAlert(reward);
      setTimeout(() => setShowWinAlert(null), 2000);
    }
  };

  return (
    <div style={styles.page} data-testid="super-app-home">
      {/* Header */}
      <header style={styles.header}>
        <span style={styles.logo}>⚡</span> BidBlitz Super App
      </header>

      {/* Wallet Balance */}
      <div style={styles.wallet} data-testid="wallet-balance">
        Wallet Balance: <span style={styles.coinCount}>{coins}</span> Coins
      </div>

      {/* Win Alert */}
      {showWinAlert && (
        <div style={styles.winAlert} data-testid="win-alert">
          🎉 You won {showWinAlert} Coins!
        </div>
      )}

      {/* Service Cards Grid */}
      <div style={styles.grid}>
        {SERVICE_CARDS.map((item, index) => (
          <div
            key={index}
            style={styles.card}
            onClick={() => navigate(item.route)}
            data-testid={`service-${item.name.toLowerCase().replace(' ', '-')}`}
          >
            <div style={styles.cardEmoji}>{item.emoji}</div>
            <div style={styles.cardName}>{item.name}</div>
          </div>
        ))}
      </div>

      {/* Games Section */}
      <h2 style={styles.sectionTitle}>🎮 Games</h2>
      
      <div style={styles.gamesGrid}>
        {GAMES.map((game, index) => (
          <div
            key={index}
            style={styles.gameCard}
            onClick={() => playGame(game.name, game.reward)}
            data-testid={`game-${game.name.toLowerCase().replace(' ', '-')}`}
          >
            <div style={styles.gameName}>{game.name}</div>
            <div style={styles.gameReward}>+{game.reward} 🪙</div>
          </div>
        ))}
      </div>

      {/* Bottom Navigation */}
      <div style={styles.bottomNav}>
        <div style={styles.navItem} onClick={() => navigate('/')}>
          <span>🏠</span>
          <span style={styles.navLabel}>Home</span>
        </div>
        <div style={styles.navItem} onClick={() => navigate('/games')}>
          <span>🎮</span>
          <span style={styles.navLabel}>Games</span>
        </div>
        <div style={styles.navItem} onClick={() => navigate('/wallet')}>
          <span>💰</span>
          <span style={styles.navLabel}>Wallet</span>
        </div>
        <div style={styles.navItem} onClick={() => navigate('/profile')}>
          <span>👤</span>
          <span style={styles.navLabel}>Profile</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    margin: 0,
    fontFamily: 'Arial, sans-serif',
    background: '#0f172a',
    color: 'white',
    minHeight: '100vh',
    paddingBottom: '80px',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflowY: 'auto',
  },
  header: {
    background: '#020617',
    padding: '20px',
    fontSize: '24px',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  logo: {
    marginRight: '8px',
  },
  wallet: {
    background: '#1e293b',
    padding: '20px',
    textAlign: 'center',
    fontSize: '22px',
  },
  coinCount: {
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  winAlert: {
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    padding: '15px',
    textAlign: 'center',
    fontSize: '18px',
    fontWeight: 'bold',
    animation: 'pulse 0.5s ease-in-out',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '15px',
    padding: '20px',
  },
  card: {
    background: '#1e293b',
    padding: '20px',
    borderRadius: '15px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'transform 0.2s, background 0.2s',
  },
  cardEmoji: {
    fontSize: '32px',
    marginBottom: '8px',
  },
  cardName: {
    fontSize: '16px',
    fontWeight: '500',
  },
  sectionTitle: {
    paddingLeft: '20px',
    margin: '10px 0',
    fontSize: '20px',
  },
  gamesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    padding: '0 20px 20px',
  },
  gameCard: {
    background: '#7c3aed',
    padding: '15px 10px',
    borderRadius: '10px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'transform 0.2s, background 0.2s',
  },
  gameName: {
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '5px',
  },
  gameReward: {
    fontSize: '12px',
    opacity: 0.9,
  },
  bottomNav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: '#020617',
    display: 'flex',
    justifyContent: 'space-around',
    padding: '15px 0',
    borderTop: '1px solid #1e293b',
  },
  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    fontSize: '20px',
  },
  navLabel: {
    fontSize: '12px',
    marginTop: '4px',
    opacity: 0.8,
  },
};
