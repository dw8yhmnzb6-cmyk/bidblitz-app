/**
 * BidBlitz Lucky Wheel - Glücksrad Spiel
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const REWARDS = [5, 10, 20, 50, 100];
const WHEEL_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6'];

export default function LuckyWheel() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastWin, setLastWin] = useState(null);

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

  const saveCoins = async (amount) => {
    try {
      await axios.post(`${API}/bbz/coins/earn`, {
        user_id: userId,
        amount: amount,
        source: 'lucky_wheel'
      });
    } catch (error) {
      console.log('Could not save coins');
    }
  };

  const spin = () => {
    if (spinning) return;
    
    setSpinning(true);
    setLastWin(null);
    
    // Random reward
    const winIndex = Math.floor(Math.random() * REWARDS.length);
    const win = REWARDS[winIndex];
    
    // Calculate rotation (5 full spins + position)
    const segmentAngle = 360 / REWARDS.length;
    const newRotation = rotation + 1800 + (winIndex * segmentAngle) + (segmentAngle / 2);
    
    setRotation(newRotation);
    
    setTimeout(() => {
      setCoins(prev => prev + win);
      setLastWin(win);
      setSpinning(false);
      saveCoins(win);
    }, 3000);
  };

  return (
    <>
      <style>{`
        .wheel-game {
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
          overflow-y: auto;
          z-index: 999;
        }
        .wheel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .wheel-back {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
        }
        .wheel-title {
          font-size: 24px;
          font-weight: bold;
        }
        .wheel-coins {
          background: #7c3aed;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 16px;
        }
        .wheel-container {
          position: relative;
          width: 250px;
          height: 250px;
          margin: 40px auto;
        }
        .wheel {
          width: 250px;
          height: 250px;
          border-radius: 50%;
          border: 12px solid #7c3aed;
          background: conic-gradient(
            #ef4444 0deg 72deg,
            #f59e0b 72deg 144deg,
            #22c55e 144deg 216deg,
            #3b82f6 216deg 288deg,
            #8b5cf6 288deg 360deg
          );
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99);
          box-shadow: 0 0 30px rgba(124, 58, 237, 0.5);
        }
        .wheel-inner {
          width: 80px;
          height: 80px;
          background: #1f2937;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          border: 4px solid #7c3aed;
        }
        .wheel-pointer {
          position: absolute;
          top: -20px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 30px;
          filter: drop-shadow(0 0 5px rgba(0,0,0,0.5));
        }
        .spin-btn {
          padding: 15px 50px;
          font-size: 20px;
          font-weight: bold;
          background: #7c3aed;
          border: none;
          border-radius: 15px;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
          margin: 30px 0;
        }
        .spin-btn:hover:not(:disabled) {
          background: #6d28d9;
          transform: scale(1.05);
        }
        .spin-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .wheel-score {
          font-size: 28px;
          margin: 20px 0;
        }
        .win-popup {
          background: #22c55e;
          padding: 20px 40px;
          border-radius: 15px;
          font-size: 24px;
          font-weight: bold;
          margin: 20px auto;
          display: inline-block;
          animation: pop 0.3s ease;
        }
        @keyframes pop {
          0% { transform: scale(0); }
          100% { transform: scale(1); }
        }
        .rewards-list {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 30px;
          flex-wrap: wrap;
        }
        .reward-item {
          padding: 8px 16px;
          background: #1f2937;
          border-radius: 10px;
          font-size: 14px;
        }
      `}</style>
      
      <div className="wheel-game" data-testid="lucky-wheel">
        {/* Header */}
        <div className="wheel-header">
          <button className="wheel-back" onClick={() => navigate('/games')}>←</button>
          <span className="wheel-title">🎡 Lucky Wheel</span>
          <div className="wheel-coins">💰 {coins}</div>
        </div>

        {/* Wheel */}
        <div className="wheel-container">
          <div className="wheel-pointer">▼</div>
          <div 
            className="wheel"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div className="wheel-inner">🎡</div>
          </div>
        </div>

        {/* Spin Button */}
        <button 
          className="spin-btn" 
          onClick={spin}
          disabled={spinning}
        >
          {spinning ? '⏳ SPINNING...' : '🎰 SPIN'}
        </button>

        {/* Win Popup */}
        {lastWin && (
          <div className="win-popup">
            🎉 +{lastWin} Coins!
          </div>
        )}

        {/* Score */}
        <div className="wheel-score">
          Coins: <strong>{coins}</strong>
        </div>

        {/* Rewards */}
        <div className="rewards-list">
          {REWARDS.map((reward, i) => (
            <div 
              key={i} 
              className="reward-item"
              style={{ borderLeft: `4px solid ${WHEEL_COLORS[i]}` }}
            >
              {reward} 💰
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
