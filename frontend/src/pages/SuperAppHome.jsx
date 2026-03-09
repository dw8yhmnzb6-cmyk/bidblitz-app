/**
 * BidBlitz Super App - Full Featured Design
 * Games, Miner (passive income), Auction, Leaderboard, Bottom Nav
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const GAMES = [
  { name: 'Lucky Wheel', reward: 10 },
  { name: 'Scratch', reward: 20 },
  { name: 'Reaction', reward: 5 },
  { name: 'Runner', reward: 15 },
  { name: 'Puzzle', reward: 25 },
  { name: 'Treasure', reward: 30 },
];

export default function SuperAppHome() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(100);
  const [miners, setMiners] = useState(0);
  const [price, setPrice] = useState(0.00);
  const [bids, setBids] = useState(0);
  const [timer, setTimer] = useState(10);
  const [showAlert, setShowAlert] = useState(null);
  const [leaderboard, setLeaderboard] = useState([
    { name: 'User123', score: 5000 },
    { name: 'Player42', score: 3500 },
    { name: 'Gamer99', score: 2100 },
  ]);
  
  const userId = localStorage.getItem('userId') || 'guest_' + Math.random().toString(36).substr(2, 9);
  
  useEffect(() => {
    if (!localStorage.getItem('userId')) localStorage.setItem('userId', userId);
    fetchCoins();
    fetchMiners();
    
    // Hide main navbar
    const header = document.querySelector('header');
    if (header) header.style.display = 'none';
    
    // Auction timer countdown
    const timerInterval = setInterval(() => {
      setTimer(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    
    // Miner passive income: +1 coin per miner every 5 seconds
    const minerInterval = setInterval(() => {
      setMiners(currentMiners => {
        if (currentMiners > 0) {
          setCoins(prev => {
            const newBalance = prev + currentMiners;
            // Also update backend
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
  
  const fetchMiners = async () => {
    try {
      const res = await axios.get(`${API}/bbz/miners?user_id=${userId}`);
      setMiners(res.data.miners?.length || 0);
    } catch {
      setMiners(0);
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
      alert('No coins!');
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
        {miners > 0 && <span style={styles.minerBadge}>⛏ {miners}</span>}
      </div>

      {/* Alert */}
      {showAlert && <div style={styles.alert}>{showAlert}</div>}

      {/* Games Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>🎮 Games</h2>
        <div style={styles.grid}>
          {GAMES.map((game, index) => (
            <div
              key={index}
              style={styles.game}
              onClick={() => playGame(game.name, game.reward)}
              data-testid={`game-${game.name.toLowerCase()}`}
            >
              {game.name}
            </div>
          ))}
        </div>
      </div>

      {/* Miner Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>⛏ Miner</h2>
        <button style={styles.button} onClick={buyMiner} data-testid="buy-miner">
          Buy Miner (50 Coins)
        </button>
        <p style={styles.minerInfo}>
          Miners: {miners} | Income: +{miners} Coin / 5 sec
        </p>
      </div>

      {/* Auction Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>🔥 Auction</h2>
        <div style={styles.auction} data-testid="auction">
          <div style={styles.auctionRow}>
            Preis: <span style={styles.priceValue}>€{price.toFixed(2)}</span>
          </div>
          <div style={styles.auctionRow}>
            Gebote: <span style={styles.bidValue}>{bids}</span>
          </div>
          <div style={styles.auctionRow}>
            Timer: <span style={{...styles.timerValue, color: timer <= 3 ? '#ef4444' : '#22c55e'}}>{timer}</span>
          </div>
          <button style={styles.bidButton} onClick={bid} data-testid="bid-button">
            Bid (1 Coin)
          </button>
        </div>
      </div>

      {/* Leaderboard Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>🏆 Leaderboard</h2>
        <div style={styles.leaderboard}>
          {leaderboard.map((player, index) => (
            <div key={index} style={styles.leaderRow}>
              <span style={styles.rank}>#{index + 1}</span>
              <span style={styles.playerName}>{player.name}</span>
              <span style={styles.playerScore}>{player.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Spacer for Nav */}
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
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '15px',
  },
  coinCount: {
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  minerBadge: {
    background: '#7c3aed',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '14px',
  },
  alert: {
    background: '#22c55e',
    padding: '10px',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  section: {
    padding: '20px',
  },
  sectionTitle: {
    margin: '0 0 15px 0',
    fontSize: '18px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
  },
  game: {
    background: '#7c3aed',
    padding: '15px 10px',
    borderRadius: '10px',
    textAlign: 'center',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },
  button: {
    background: '#a855f7',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '10px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  minerInfo: {
    marginTop: '10px',
    color: '#94a3b8',
    fontSize: '14px',
  },
  auction: {
    background: '#1e293b',
    padding: '20px',
    borderRadius: '12px',
  },
  auctionRow: {
    marginBottom: '8px',
    fontSize: '16px',
  },
  priceValue: {
    color: '#22c55e',
    fontWeight: 'bold',
  },
  bidValue: {
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  timerValue: {
    fontWeight: 'bold',
  },
  bidButton: {
    background: '#a855f7',
    border: 'none',
    padding: '12px 25px',
    borderRadius: '10px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    marginTop: '10px',
  },
  leaderboard: {
    background: '#1e293b',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  leaderRow: {
    display: 'flex',
    padding: '12px 15px',
    borderBottom: '1px solid #334155',
    alignItems: 'center',
  },
  rank: {
    width: '40px',
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  playerName: {
    flex: 1,
  },
  playerScore: {
    color: '#22c55e',
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
