/**
 * BidBlitz Super App - Clean Design with Live Auction
 * 3-column grid + Penny Auction (0.01€ per bid)
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
  { name: 'Lucky Wheel', reward: 10 },
  { name: 'Scratch Card', reward: 20 },
  { name: 'Reaction', reward: 5 },
  { name: 'Runner', reward: 15 },
  { name: 'Puzzle', reward: 25 },
  { name: 'Treasure', reward: 30 },
];

export default function SuperAppHome() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(100);
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
    
    // Timer countdown
    const interval = setInterval(() => {
      setTimer(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    
    return () => {
      clearInterval(interval);
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
    } catch {
      setCoins(prev => prev + reward);
    }
    setShowAlert(`Gewonnen: ${reward} Coins`);
    setTimeout(() => setShowAlert(null), 2000);
  };
  
  const bid = async () => {
    if (coins < 1) {
      setShowAlert('Keine Coins!');
      setTimeout(() => setShowAlert(null), 2000);
      return;
    }
    
    // Spend 1 coin for bid
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
    
    // Increase price by 0.01€
    setPrice(prev => prev + 0.01);
    setBids(prev => prev + 1);
    setTimer(10);
  };

  return (
    <div style={styles.page} data-testid="super-app-home">
      {/* Header */}
      <header style={styles.header}>
        ⚡ BidBlitz
      </header>

      {/* Wallet */}
      <div style={styles.wallet} data-testid="wallet-balance">
        Coins: <span style={styles.coinCount}>{coins}</span>
      </div>

      {/* Alert */}
      {showAlert && (
        <div style={styles.alert} data-testid="alert">
          {showAlert}
        </div>
      )}

      {/* Service Cards - 3 columns */}
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
      <h2 style={styles.sectionTitle}>Games</h2>
      
      <div style={styles.gamesGrid}>
        {GAMES.map((game, index) => (
          <div
            key={index}
            style={styles.gameCard}
            onClick={() => playGame(game.name, game.reward)}
            data-testid={`game-${game.name.toLowerCase().replace(' ', '-')}`}
          >
            {game.name}
          </div>
        ))}
      </div>

      {/* Live Auction */}
      <div style={styles.auction} data-testid="live-auction">
        <h3 style={styles.auctionTitle}>Live Auction</h3>
        
        <div style={styles.auctionInfo}>
          <div>Preis: <span style={styles.priceValue}>€{price.toFixed(2)}</span></div>
          <div>Gebote: <span style={styles.bidCount}>{bids}</span></div>
          <div>Timer: <span style={{...styles.timerValue, color: timer <= 3 ? '#ef4444' : '#22c55e'}}>{timer}</span></div>
        </div>
        
        <button 
          style={styles.bidButton} 
          onClick={bid}
          data-testid="bid-button"
        >
          Bieten (0.50€ / 1 Coin)
        </button>
      </div>

      {/* Bottom Spacer */}
      <div style={{height: '20px'}} />
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
    background: '#020617',
    padding: '20px',
    textAlign: 'center',
    fontSize: '26px',
    fontWeight: 'bold',
  },
  wallet: {
    background: '#1e293b',
    padding: '15px',
    textAlign: 'center',
    fontSize: '20px',
  },
  coinCount: {
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  alert: {
    background: '#22c55e',
    padding: '12px',
    textAlign: 'center',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    padding: '20px',
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
  sectionTitle: {
    paddingLeft: '20px',
    margin: '5px 0 10px',
    fontSize: '18px',
  },
  gamesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    padding: '0 20px',
  },
  gameCard: {
    background: '#7c3aed',
    padding: '15px 8px',
    borderRadius: '10px',
    textAlign: 'center',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },
  auction: {
    background: '#1e293b',
    padding: '20px',
    margin: '20px',
    borderRadius: '12px',
  },
  auctionTitle: {
    margin: '0 0 15px 0',
    fontSize: '18px',
  },
  auctionInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '15px',
    fontSize: '16px',
  },
  priceValue: {
    color: '#22c55e',
    fontWeight: 'bold',
  },
  bidCount: {
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  timerValue: {
    fontWeight: 'bold',
  },
  bidButton: {
    background: '#a855f7',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '10px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    width: '100%',
  },
};
