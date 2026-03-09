/**
 * BidBlitz Lucky Wheel - Verbessertes Design
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const SEGMENTS = [
  { value: 0, label: '💀', color: '#374151', textColor: '#fff' },
  { value: 5, label: '5', color: '#ef4444', textColor: '#fff' },
  { value: 10, label: '10', color: '#f59e0b', textColor: '#000' },
  { value: 0, label: '💀', color: '#374151', textColor: '#fff' },
  { value: 20, label: '20', color: '#22c55e', textColor: '#fff' },
  { value: 50, label: '50', color: '#3b82f6', textColor: '#fff' },
  { value: 0, label: '💀', color: '#374151', textColor: '#fff' },
  { value: 100, label: '💎', color: '#a855f7', textColor: '#fff' },
];

const BET_COST = 10;

export default function LuckyWheel() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');
  const canvasRef = useRef(null);

  const userId = localStorage.getItem('userId') || 'guest_' + Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    if (!localStorage.getItem('userId')) localStorage.setItem('userId', userId);
    fetchCoins();
    drawWheel(0);
    
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

  const drawWheel = (rotation) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    
    const segmentAngle = (2 * Math.PI) / SEGMENTS.length;
    
    SEGMENTS.forEach((segment, i) => {
      const startAngle = i * segmentAngle - Math.PI / 2;
      const endAngle = startAngle + segmentAngle;
      
      // Draw segment
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = segment.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw label
      ctx.save();
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = segment.textColor;
      ctx.font = 'bold 24px Arial';
      ctx.fillText(segment.label, radius - 20, 8);
      ctx.restore();
    });
    
    // Center circle
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, 2 * Math.PI);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.restore();
  };

  const spin = async () => {
    if (spinning) return;
    
    if (coins < BET_COST) {
      setMessage(`❌ Du brauchst ${BET_COST} Coins!`);
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Spend coins
    try {
      const res = await axios.post(`${API}/bbz/coins/spend`, {
        user_id: userId,
        amount: BET_COST,
        source: 'lucky_wheel_bet'
      });
      setCoins(res.data.new_balance);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Fehler');
      return;
    }
    
    setSpinning(true);
    setResult(null);
    setMessage(`🎡 Drehen... -${BET_COST} Coins`);
    
    // Determine result with weighted odds
    const rand = Math.random();
    let winIndex;
    
    if (rand < 0.30) winIndex = 0;      // 30% - Loss (💀)
    else if (rand < 0.50) winIndex = 3; // 20% - Loss (💀)
    else if (rand < 0.65) winIndex = 6; // 15% - Loss (💀)
    else if (rand < 0.80) winIndex = 1; // 15% - 5 coins
    else if (rand < 0.90) winIndex = 2; // 10% - 10 coins
    else if (rand < 0.96) winIndex = 4; // 6% - 20 coins
    else if (rand < 0.99) winIndex = 5; // 3% - 50 coins
    else winIndex = 7;                   // 1% - 100 coins JACKPOT
    
    const winAmount = SEGMENTS[winIndex].value;
    
    // Calculate final rotation
    // The pointer is at the top (12 o'clock), so we need to rotate to bring the winning segment to that position
    const segmentAngle = 360 / SEGMENTS.length;
    const targetAngle = 360 - (winIndex * segmentAngle) - (segmentAngle / 2);
    const spins = 5; // Number of full rotations
    const finalRotation = currentRotation + (spins * 360) + targetAngle - (currentRotation % 360);
    
    // Animate
    let startTime = null;
    const duration = 4000;
    const startRotation = currentRotation;
    
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const rotation = startRotation + (finalRotation - startRotation) * easeOut;
      
      setCurrentRotation(rotation);
      drawWheel(rotation);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Spin complete
        setSpinning(false);
        setResult({ index: winIndex, amount: winAmount });
        
        if (winAmount > 0) {
          // Award coins
          axios.post(`${API}/bbz/coins/earn`, {
            user_id: userId,
            amount: winAmount,
            source: 'lucky_wheel_win'
          }).then(res => {
            setCoins(res.data.new_balance);
            setMessage(`🎉 Gewonnen! +${winAmount} Coins!`);
          }).catch(() => {
            setCoins(prev => prev + winAmount);
            setMessage(`🎉 Gewonnen! +${winAmount} Coins!`);
          });
        } else {
          setMessage('💀 Verloren! Versuche es nochmal!');
        }
        
        setTimeout(() => setMessage(''), 3000);
      }
    };
    
    requestAnimationFrame(animate);
  };

  return (
    <>
      <style>{`
        .wheel-page {
          background: linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%);
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
          text-align: center;
          padding: 20px;
        }
        
        .wheel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .back-btn {
          background: none;
          border: none;
          color: white;
          font-size: 28px;
          cursor: pointer;
        }
        
        .coins-badge {
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          padding: 10px 20px;
          border-radius: 20px;
          font-weight: bold;
        }
        
        .wheel-title {
          font-size: 32px;
          margin-bottom: 10px;
        }
        
        .wheel-container {
          position: relative;
          width: 300px;
          height: 300px;
          margin: 30px auto;
        }
        
        .wheel-canvas {
          width: 100%;
          height: 100%;
        }
        
        .wheel-pointer {
          position: absolute;
          top: -15px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 20px solid transparent;
          border-right: 20px solid transparent;
          border-top: 35px solid #fbbf24;
          filter: drop-shadow(0 3px 5px rgba(0,0,0,0.5));
          z-index: 10;
        }
        
        .message-box {
          background: rgba(124, 58, 237, 0.3);
          padding: 15px 30px;
          border-radius: 15px;
          margin: 20px auto;
          max-width: 300px;
          font-size: 18px;
          font-weight: bold;
        }
        
        .spin-btn {
          background: linear-gradient(135deg, #22c55e, #10b981);
          border: none;
          padding: 18px 50px;
          border-radius: 20px;
          color: white;
          font-size: 22px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
          margin-top: 20px;
        }
        
        .spin-btn:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 5px 25px rgba(34, 197, 94, 0.5);
        }
        
        .spin-btn:disabled {
          background: #4b5563;
          cursor: not-allowed;
        }
        
        .cost-info {
          margin-top: 15px;
          color: #94a3b8;
          font-size: 14px;
        }
        
        .prizes-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 30px;
          max-width: 350px;
          margin-left: auto;
          margin-right: auto;
        }
        
        .prize-item {
          background: rgba(255,255,255,0.1);
          padding: 10px;
          border-radius: 10px;
          text-align: center;
        }
        
        .prize-icon {
          font-size: 24px;
        }
        
        .prize-value {
          font-size: 12px;
          color: #fbbf24;
          font-weight: bold;
        }
      `}</style>
      
      <div className="wheel-page">
        {/* Header */}
        <div className="wheel-header">
          <button className="back-btn" onClick={() => navigate('/games')}>←</button>
          <h1 className="wheel-title">🎡 Lucky Wheel</h1>
          <div className="coins-badge">💰 {coins}</div>
        </div>
        
        {/* Message */}
        {message && <div className="message-box">{message}</div>}
        
        {/* Wheel */}
        <div className="wheel-container">
          <div className="wheel-pointer" />
          <canvas 
            ref={canvasRef} 
            className="wheel-canvas"
            width={300}
            height={300}
          />
        </div>
        
        {/* Spin Button */}
        <button 
          className="spin-btn"
          onClick={spin}
          disabled={spinning || coins < BET_COST}
        >
          {spinning ? '🎡 Dreht...' : `🎰 DREHEN`}
        </button>
        
        <p className="cost-info">Kosten: {BET_COST} Coins pro Dreh</p>
        
        {/* Prizes */}
        <div className="prizes-grid">
          {SEGMENTS.filter(s => s.value > 0).map((s, i) => (
            <div key={i} className="prize-item" style={{ borderLeft: `4px solid ${s.color}` }}>
              <div className="prize-icon">{s.label}</div>
              <div className="prize-value">{s.value} Coins</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
