/**
 * BidBlitz Coin Tap - Klick-Spiel
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function CoinTap() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(0);
  const [taps, setTaps] = useState(0);
  const [scale, setScale] = useState(1);
  const [particles, setParticles] = useState([]);

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
      setCoins(0);
    }
  };

  const saveCoins = async () => {
    try {
      await axios.post(`${API}/bbz/coins/earn`, {
        user_id: userId,
        amount: 1,
        source: 'coin_tap'
      });
    } catch (error) {
      console.log('Could not save coins');
    }
  };

  const handleTap = (e) => {
    // Add coin
    setCoins(prev => prev + 1);
    setTaps(prev => prev + 1);
    saveCoins();
    
    // Animation
    setScale(1.2);
    setTimeout(() => setScale(1), 100);
    
    // Particle effect
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newParticle = {
      id: Date.now(),
      x,
      y,
      emoji: ['✨', '💫', '⭐', '+1'][Math.floor(Math.random() * 4)]
    };
    
    setParticles(prev => [...prev, newParticle]);
    
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== newParticle.id));
    }, 1000);
  };

  return (
    <>
      <style>{`
        .tap-game {
          text-align: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #0f172a;
          color: white;
          min-height: 100vh;
          padding: 20px;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
          z-index: 999;
        }
        .tap-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .tap-back {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
        }
        .tap-title {
          font-size: 24px;
          font-weight: bold;
        }
        .tap-coins-badge {
          background: #7c3aed;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 16px;
        }
        .tap-area {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 300px;
          margin: 40px 0;
        }
        .tap-coin {
          font-size: 120px;
          cursor: pointer;
          user-select: none;
          transition: transform 0.1s ease;
          filter: drop-shadow(0 10px 20px rgba(251, 191, 36, 0.4));
        }
        .tap-coin:active {
          transform: scale(0.9);
        }
        .particle {
          position: absolute;
          font-size: 24px;
          pointer-events: none;
          animation: float-up 1s ease-out forwards;
        }
        @keyframes float-up {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-100px) scale(1.5);
          }
        }
        .tap-score {
          font-size: 32px;
          margin: 20px 0;
        }
        .tap-stats {
          display: flex;
          justify-content: center;
          gap: 30px;
          margin-top: 40px;
        }
        .tap-stat {
          background: #1f2937;
          padding: 20px 30px;
          border-radius: 15px;
          text-align: center;
        }
        .tap-stat-value {
          font-size: 28px;
          font-weight: bold;
          color: #fbbf24;
        }
        .tap-stat-label {
          font-size: 14px;
          color: #9ca3af;
          margin-top: 5px;
        }
        .tap-tip {
          margin-top: 40px;
          padding: 15px;
          background: #1f2937;
          border-radius: 10px;
          font-size: 14px;
          color: #9ca3af;
        }
      `}</style>
      
      <div className="tap-game" data-testid="coin-tap">
        {/* Header */}
        <div className="tap-header">
          <button className="tap-back" onClick={() => navigate('/games')}>←</button>
          <span className="tap-title">🪙 Coin Tap</span>
          <div className="tap-coins-badge">💰 {coins}</div>
        </div>

        {/* Tap Area */}
        <div className="tap-area" onClick={handleTap}>
          <div 
            className="tap-coin"
            style={{ transform: `scale(${scale})` }}
          >
            🪙
          </div>
          
          {/* Particles */}
          {particles.map(p => (
            <span
              key={p.id}
              className="particle"
              style={{ left: p.x, top: p.y }}
            >
              {p.emoji}
            </span>
          ))}
        </div>

        {/* Score */}
        <div className="tap-score">
          Coins: <strong>{coins}</strong>
        </div>

        {/* Stats */}
        <div className="tap-stats">
          <div className="tap-stat">
            <div className="tap-stat-value">{taps}</div>
            <div className="tap-stat-label">Taps diese Session</div>
          </div>
          <div className="tap-stat">
            <div className="tap-stat-value">{coins}</div>
            <div className="tap-stat-label">Gesamt Coins</div>
          </div>
        </div>

        {/* Tip */}
        <div className="tap-tip">
          💡 Tippe so schnell wie möglich auf die Münze!
        </div>
      </div>
    </>
  );
}
