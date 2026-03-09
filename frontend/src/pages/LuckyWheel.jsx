/**
 * BidBlitz Lucky Wheel
 * Spin the wheel to win coins
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const WHEEL_SEGMENTS = [
  { color: '#ef4444', label: '5', value: 5 },
  { color: '#22c55e', label: '25', value: 25 },
  { color: '#3b82f6', label: '10', value: 10 },
  { color: '#eab308', label: '50', value: 50 },
  { color: '#a855f7', label: '15', value: 15 },
  { color: '#f97316', label: '30', value: 30 },
];

export default function LuckyWheelGame() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(null);
  
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
      setCoins(res.data.coins || 100);
    } catch {
      setCoins(100);
    }
  };

  const spin = async () => {
    if (spinning) return;
    
    // Cost 10 coins to spin
    if (coins < 10) {
      alert('Nicht genug Coins! (10 Coins benötigt)');
      return;
    }

    // Deduct coins
    try {
      const res = await axios.post(`${API}/bbz/coins/spend`, {
        user_id: userId,
        amount: 10,
        source: 'lucky_wheel_spin'
      });
      setCoins(res.data.new_balance);
    } catch {
      setCoins(prev => prev - 10);
    }

    setSpinning(true);
    setLastWin(null);
    
    // Random rotation (3-5 full spins + random position)
    const spins = 3 + Math.random() * 2;
    const randomDeg = Math.floor(Math.random() * 360);
    const newRotation = rotation + (spins * 360) + randomDeg;
    
    setRotation(newRotation);
    
    // Calculate reward based on where wheel stops
    setTimeout(async () => {
      // Determine which segment the pointer landed on
      const normalizedDeg = (360 - (newRotation % 360)) % 360;
      const segmentSize = 360 / WHEEL_SEGMENTS.length;
      const segmentIndex = Math.floor(normalizedDeg / segmentSize);
      const reward = WHEEL_SEGMENTS[segmentIndex].value;
      
      // Add reward
      try {
        const res = await axios.post(`${API}/bbz/coins/earn`, {
          user_id: userId,
          amount: reward,
          source: 'lucky_wheel_win'
        });
        setCoins(res.data.new_balance);
      } catch {
        setCoins(prev => prev + reward);
      }
      
      setLastWin(reward);
      setSpinning(false);
    }, 3000);
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>BidBlitz Lucky Wheel</h1>
      
      <p style={styles.coins}>
        Coins: <span style={styles.coinsValue}>{coins}</span>
      </p>

      {/* Wheel */}
      <div style={styles.wheelContainer}>
        {/* Pointer */}
        <div style={styles.pointer}>▼</div>
        
        <div 
          style={{
            ...styles.wheel,
            transform: `rotate(${rotation}deg)`,
          }}
        >
          {WHEEL_SEGMENTS.map((seg, i) => (
            <div
              key={i}
              style={{
                ...styles.segment,
                background: seg.color,
                transform: `rotate(${i * 60}deg)`,
              }}
            >
              <span style={styles.segmentLabel}>{seg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Win message */}
      {lastWin && (
        <div style={styles.winMessage}>
          🎉 Du hast {lastWin} Coins gewonnen!
        </div>
      )}

      {/* Spin Button */}
      <button 
        style={{
          ...styles.spinButton,
          opacity: spinning ? 0.5 : 1,
          cursor: spinning ? 'not-allowed' : 'pointer',
        }} 
        onClick={spin}
        disabled={spinning}
      >
        {spinning ? 'Dreht...' : 'SPIN (10 Coins)'}
      </button>

      {/* Back button */}
      <button style={styles.backButton} onClick={() => navigate('/super-home')}>
        Zurück
      </button>
    </div>
  );
}

const styles = {
  page: {
    margin: 0,
    background: '#0f172a',
    fontFamily: 'Arial, sans-serif',
    color: 'white',
    textAlign: 'center',
    minHeight: '100vh',
    padding: '20px',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflowY: 'auto',
  },
  title: {
    padding: '10px',
    margin: 0,
    fontSize: '24px',
  },
  coins: {
    fontSize: '18px',
    margin: '10px 0',
  },
  coinsValue: {
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  wheelContainer: {
    position: 'relative',
    width: '250px',
    height: '250px',
    margin: '20px auto',
  },
  pointer: {
    position: 'absolute',
    top: '-20px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '30px',
    color: '#fff',
    zIndex: 10,
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
  },
  wheel: {
    width: '250px',
    height: '250px',
    borderRadius: '50%',
    position: 'relative',
    transition: 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)',
    boxShadow: '0 0 20px rgba(168, 85, 247, 0.5)',
    overflow: 'hidden',
    background: `conic-gradient(
      #ef4444 0deg 60deg,
      #22c55e 60deg 120deg,
      #3b82f6 120deg 180deg,
      #eab308 180deg 240deg,
      #a855f7 240deg 300deg,
      #f97316 300deg 360deg
    )`,
  },
  segment: {
    position: 'absolute',
    width: '50%',
    height: '50%',
    top: '0',
    left: '50%',
    transformOrigin: '0% 100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(30deg)',
    fontWeight: 'bold',
    fontSize: '14px',
    color: 'white',
    textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
  },
  winMessage: {
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    padding: '15px 25px',
    borderRadius: '10px',
    margin: '20px auto',
    maxWidth: '250px',
    fontWeight: 'bold',
    fontSize: '18px',
    animation: 'pulse 0.5s ease-in-out',
  },
  spinButton: {
    marginTop: '20px',
    padding: '15px 40px',
    background: '#a855f7',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  backButton: {
    marginTop: '15px',
    padding: '12px 30px',
    background: '#374151',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'block',
    margin: '15px auto 0',
  },
};
