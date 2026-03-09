/**
 * BidBlitz Runner Game
 * Catch falling coins with arrow keys
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function RunnerGame() {
  const navigate = useNavigate();
  const gameRef = useRef(null);
  const [score, setScore] = useState(0);
  const [playerX, setPlayerX] = useState(130);
  const [coins, setCoins] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [userCoins, setUserCoins] = useState(0);
  const coinIdRef = useRef(0);
  
  const userId = localStorage.getItem('userId') || 'guest';

  useEffect(() => {
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
      setUserCoins(res.data.coins || 0);
    } catch {
      setUserCoins(0);
    }
  };

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        setPlayerX(prev => Math.max(0, prev - 30));
      }
      if (e.key === 'ArrowRight') {
        setPlayerX(prev => Math.min(260, prev + 30));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Touch controls for mobile
  const moveLeft = () => setPlayerX(prev => Math.max(0, prev - 40));
  const moveRight = () => setPlayerX(prev => Math.min(260, prev + 40));

  // Create coins
  useEffect(() => {
    if (gameOver) return;
    
    const interval = setInterval(() => {
      const newCoin = {
        id: coinIdRef.current++,
        x: Math.random() * 260,
        y: -20
      };
      setCoins(prev => [...prev, newCoin]);
    }, 1000);

    return () => clearInterval(interval);
  }, [gameOver]);

  // Move coins down
  useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      setCoins(prev => {
        return prev.map(coin => ({
          ...coin,
          y: coin.y + 4
        })).filter(coin => {
          // Check collision with player
          if (coin.y > 340 && coin.y < 390 && 
              coin.x < playerX + 40 && coin.x + 20 > playerX) {
            setScore(s => s + 10);
            return false;
          }
          // Remove if off screen
          if (coin.y > 400) return false;
          return true;
        });
      });
    }, 30);

    return () => clearInterval(interval);
  }, [playerX, gameOver]);

  const claimReward = async () => {
    if (score < 10) return;
    
    const reward = Math.floor(score / 10);
    try {
      const res = await axios.post(`${API}/bbz/coins/earn`, {
        user_id: userId,
        amount: reward,
        source: 'runner_game'
      });
      setUserCoins(res.data.new_balance);
    } catch {
      setUserCoins(prev => prev + reward);
    }
    
    alert(`+${reward} Coins erhalten!`);
    setScore(0);
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>BidBlitz Runner</h1>
      
      <p style={styles.stats}>
        Coins gesammelt: <span style={styles.scoreValue}>{score}</span>
        {' | '}
        Wallet: <span style={styles.walletValue}>{userCoins}</span>
      </p>

      {/* Game Area */}
      <div style={styles.game} ref={gameRef}>
        {/* Player */}
        <div style={{...styles.player, left: playerX}} />
        
        {/* Coins */}
        {coins.map(coin => (
          <div
            key={coin.id}
            style={{
              ...styles.coin,
              left: coin.x,
              top: coin.y
            }}
          />
        ))}
      </div>

      {/* Mobile Controls */}
      <div style={styles.controls}>
        <button style={styles.controlBtn} onTouchStart={moveLeft} onClick={moveLeft}>
          ◀ Links
        </button>
        <button style={styles.controlBtn} onTouchStart={moveRight} onClick={moveRight}>
          Rechts ▶
        </button>
      </div>

      {/* Buttons */}
      <div style={styles.buttons}>
        <button style={styles.button} onClick={claimReward}>
          Belohnung ({Math.floor(score / 10)} Coins)
        </button>
        <button style={styles.buttonSecondary} onClick={() => navigate('/super-home')}>
          Zurück
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    margin: 0,
    background: '#0f172a',
    color: 'white',
    fontFamily: 'Arial, sans-serif',
    textAlign: 'center',
    minHeight: '100vh',
    padding: '10px',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflowY: 'auto',
  },
  title: {
    padding: '15px',
    margin: 0,
    fontSize: '24px',
  },
  stats: {
    margin: '10px 0',
    fontSize: '16px',
  },
  scoreValue: {
    color: '#22c55e',
    fontWeight: 'bold',
  },
  walletValue: {
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  game: {
    width: '300px',
    height: '400px',
    background: '#1e293b',
    margin: '0 auto',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '10px',
  },
  player: {
    width: '40px',
    height: '40px',
    background: '#a855f7',
    position: 'absolute',
    bottom: '10px',
    borderRadius: '6px',
  },
  coin: {
    width: '20px',
    height: '20px',
    background: 'gold',
    position: 'absolute',
    borderRadius: '50%',
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    marginTop: '15px',
  },
  controlBtn: {
    padding: '15px 30px',
    background: '#374151',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '16px',
    cursor: 'pointer',
  },
  buttons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxWidth: '300px',
    margin: '20px auto',
  },
  button: {
    background: '#a855f7',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '10px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  buttonSecondary: {
    background: '#374151',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '10px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '16px',
  },
};
