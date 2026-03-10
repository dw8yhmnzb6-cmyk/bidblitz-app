/**
 * BidBlitz - Complete Super App Design
 * Service Cards + Games + Miner + Auction + Bottom Nav
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const SERVICE_CARDS = [
  { emoji: '🎮', name: 'Games', route: '/game-platform' },
  { emoji: '⛏', name: 'Miner', route: '/mining' },
  { emoji: '🔥', name: 'Auctions', route: '/live-auction' },
  { emoji: '💎', name: 'VIP', route: '/vip-auctions' },
  { emoji: '🚕', name: 'Taxi', route: '/taxi' },
  { emoji: '🛴', name: 'Scooter', route: '/scooter' },
];

// Quick Actions für BidBlitz Pay
const QUICK_ACTIONS = [
  { emoji: '📷', name: 'Scan', route: '/scan' },
  { emoji: '💳', name: 'Pay', route: '/bidblitz-pay' },
  { emoji: '⛏️', name: 'Mining', route: '/mining' },
  { emoji: '🚕', name: 'Ride', route: '/taxi' },
  { emoji: '💸', name: 'Send', route: '/transfer' },
  { emoji: '🛍️', name: 'Shop', route: '/shop' },
];

const GAMES = [
  { name: 'Lucky Wheel', reward: 10, route: '/lucky-wheel' },
  { name: 'Scratch', reward: 20, route: '/scratch-card' },
  { name: 'Reaction', reward: 5, route: '/reaction-game' },
  { name: 'Runner', reward: 15, route: '/runner-game' },
  { name: 'Puzzle', reward: 25, route: '/puzzle-game' },
  { name: 'Treasure', reward: 30, route: '/coin-tap' },
];

export default function SuperAppHome() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(100);
  const [miners, setMiners] = useState(0);
  const [price, setPrice] = useState(0.00);
  const [bids, setBids] = useState(0);
  const [timer, setTimer] = useState(10);
  const [showAlert, setShowAlert] = useState(null);
  
  const userId = localStorage.getItem('userId') || 'guest_' + Math.random().toString(36).substr(2, 9);
  
  useEffect(() => {
    if (!localStorage.getItem('userId')) localStorage.setItem('userId', userId);
    fetchCoins();
    
    // Hide main navbar
    const header = document.querySelector('header');
    if (header) header.style.display = 'none';
    
    // Auction timer countdown
    const timerInterval = setInterval(() => {
      setTimer(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    
    // Miner passive income
    const minerInterval = setInterval(() => {
      setMiners(currentMiners => {
        if (currentMiners > 0) {
          setCoins(prev => {
            const newBalance = prev + currentMiners;
            axios.post(`${API}/bbz/coins/earn`, {
              user_id: userId,
              amount: currentMiners,
              source: 'miner_income'
            }).catch(() => {});
            return newBalance;
          });
        }
        return currentMiners;
      });
    }, 5000);
    
    return () => {
      clearInterval(timerInterval);
      clearInterval(minerInterval);
      const header = document.querySelector('header');
      if (header) header.style.display = '';
    };
  }, [userId]);
  
  const fetchCoins = async () => {
    try {
      const res = await axios.get(`${API}/bbz/coins/${userId}`);
      setCoins(res.data.coins || 100);
    } catch {
      setCoins(100);
    }
  };
  
  const alert = (msg) => {
    setShowAlert(msg);
    setTimeout(() => setShowAlert(null), 2000);
  };
  
  const playGame = async (gameName, reward) => {
    try {
      const res = await axios.post(`${API}/bbz/coins/earn`, {
        user_id: userId,
        amount: reward,
        source: `game_${gameName.toLowerCase()}`
      });
      setCoins(res.data.new_balance);
    } catch {
      setCoins(prev => prev + reward);
    }
    alert(`+${reward} Coins!`);
  };
  
  const buyMiner = async () => {
    if (coins < 50) {
      alert('Not enough coins!');
      return;
    }
    
    try {
      const res = await axios.post(`${API}/bbz/coins/spend`, {
        user_id: userId,
        amount: 50,
        source: 'buy_miner'
      });
      setCoins(res.data.new_balance);
    } catch {
      setCoins(prev => prev - 50);
    }
    
    setMiners(prev => prev + 1);
    alert('Miner purchased!');
  };
  
  const bid = async () => {
    if (coins < 1) {
      alert('Not enough coins!');
      return;
    }
    
    try {
      const res = await axios.post(`${API}/bbz/coins/spend`, {
        user_id: userId,
        amount: 1,
        source: 'auction_bid'
      });
      setCoins(res.data.new_balance);
    } catch {
      setCoins(prev => prev - 1);
    }
    
    setPrice(prev => prev + 0.01);
    setBids(prev => prev + 1);
    setTimer(10);
  };

  return (
    <div style={styles.page} data-testid="super-app-home">
      {/* Header */}
      <header style={styles.header}>⚡ BidBlitz</header>

      {/* Wallet */}
      <div style={styles.wallet} data-testid="wallet-balance">
        Coins: <span style={styles.coinCount}>{coins}</span>
      </div>

      {/* Alert */}
      {showAlert && <div style={styles.alert}>{showAlert}</div>}

      {/* Container */}
      <div style={styles.container}>
        
        {/* Quick Actions */}
        <h2 style={styles.title}>Quick Actions</h2>
        <div style={styles.quickActions}>
          {QUICK_ACTIONS.map((action, index) => (
            <div
              key={index}
              style={styles.actionCard}
              onClick={() => navigate(action.route)}
              data-testid={`quick-${action.name.toLowerCase()}`}
            >
              <div style={styles.actionEmoji}>{action.emoji}</div>
              <div style={styles.actionName}>{action.name}</div>
            </div>
          ))}
        </div>

        {/* Service Cards Grid */}
        <h2 style={styles.title}>Services</h2>
        <div style={styles.grid}>
          {SERVICE_CARDS.map((item, index) => (
            <div
              key={index}
              style={styles.card}
              onClick={() => navigate(item.route)}
              data-testid={`service-${item.name.toLowerCase()}`}
            >
              <div style={styles.cardEmoji}>{item.emoji}</div>
              <div style={styles.cardName}>{item.name}</div>
            </div>
          ))}
        </div>

        {/* Games Section */}
        <h2 style={styles.title}>Games</h2>
        <div style={styles.games}>
          {GAMES.map((game, index) => (
            <div
              key={index}
              style={styles.game}
              onClick={() => navigate(game.route)}
              data-testid={`game-${game.name.toLowerCase()}`}
            >
              {game.name}
            </div>
          ))}
        </div>

        {/* Miner Panel */}
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Miner</h2>
          <button style={styles.button} onClick={buyMiner} data-testid="buy-miner">
            Buy Miner (50 Coins)
          </button>
          <p style={styles.info}>
            {miners > 0 ? `Miners: ${miners} | ` : ''}+1 Coin every 5 sec
          </p>
        </div>

        {/* Live Auction Panel */}
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Live Auction</h2>
          <div style={styles.auctionInfo}>
            <div>Preis: <span style={styles.price}>€{price.toFixed(2)}</span></div>
            <div>Gebote: <span style={styles.bids}>{bids}</span></div>
            <div>Timer: <span style={{...styles.timer, color: timer <= 3 ? '#ef4444' : '#22c55e'}}>{timer}</span></div>
          </div>
          <button style={styles.button} onClick={bid} data-testid="bid-button">
            Bid (1 Coin)
          </button>
        </div>
      </div>

      {/* Bottom Spacer */}
      <div style={{height: '70px'}} />

      {/* Bottom Navigation */}
      <nav style={styles.nav}>
        <div style={styles.navItem} onClick={() => navigate('/super-home')}>🏠</div>
        <div style={styles.navItem} onClick={() => navigate('/games')}>🎮</div>
        <div style={styles.navItem} onClick={() => navigate('/wallet')}>💰</div>
        <div style={styles.navItem} onClick={() => navigate('/live-auction')}>🔥</div>
        <div style={styles.navItem} onClick={() => navigate('/profile')}>👤</div>
      </nav>
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
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflowY: 'auto',
  },
  header: {
    background: '#111827',
    padding: '18px',
    fontSize: '26px',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  wallet: {
    background: '#1e293b',
    padding: '14px',
    textAlign: 'center',
    fontSize: '20px',
  },
  coinCount: {
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  alert: {
    background: '#22c55e',
    padding: '10px',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  container: {
    padding: '20px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '20px',
  },
  card: {
    background: '#1e293b',
    padding: '20px 10px',
    borderRadius: '12px',
    textAlign: 'center',
    cursor: 'pointer',
  },
  cardEmoji: {
    fontSize: '28px',
    marginBottom: '6px',
  },
  cardName: {
    fontSize: '12px',
    fontWeight: '500',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: '18px',
  },
  games: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
  },
  game: {
    background: '#7c3aed',
    padding: '16px 8px',
    borderRadius: '10px',
    textAlign: 'center',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },
  panel: {
    background: '#1e293b',
    padding: '20px',
    borderRadius: '12px',
    marginTop: '20px',
  },
  panelTitle: {
    margin: '0 0 15px 0',
    fontSize: '18px',
  },
  button: {
    background: '#a855f7',
    border: 'none',
    padding: '10px 15px',
    borderRadius: '10px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  info: {
    marginTop: '12px',
    marginBottom: 0,
    color: '#94a3b8',
    fontSize: '14px',
  },
  auctionInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '15px',
    fontSize: '16px',
  },
  price: {
    color: '#22c55e',
    fontWeight: 'bold',
  },
  bids: {
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  timer: {
    fontWeight: 'bold',
  },
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: '#020617',
    display: 'flex',
    justifyContent: 'space-around',
    padding: '15px 10px',
    borderTop: '1px solid #1e293b',
  },
  navItem: {
    fontSize: '24px',
    cursor: 'pointer',
  },
};
