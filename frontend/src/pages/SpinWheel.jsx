/**
 * BidBlitz Spin Wheel (Glücksrad)
 * Animated wheel with prizes
 */
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Coins, Gift, Star, Sparkles } from 'lucide-react';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const PRIZES = [
  { label: '10', value: 10, color: '#ef4444' },
  { label: '25', value: 25, color: '#f59e0b' },
  { label: '50', value: 50, color: '#10b981' },
  { label: '0', value: 0, color: '#6b7280' },
  { label: '100', value: 100, color: '#6c63ff' },
  { label: '15', value: 15, color: '#ec4899' },
  { label: '200', value: 200, color: '#8b5cf6' },
  { label: '5', value: 5, color: '#14b8a6' },
];

export default function SpinWheel() {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [prize, setPrize] = useState(null);
  const [balance, setBalance] = useState(0);
  const [canSpin, setCanSpin] = useState(true);
  const [message, setMessage] = useState('');
  const canvasRef = useRef(null);
  
  useEffect(() => {
    fetchData();
    drawWheel(0);
  }, []);
  
  useEffect(() => {
    drawWheel(rotation);
  }, [rotation]);
  
  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [walletRes, spinRes] = await Promise.all([
        axios.get(`${API}/app/wallet/balance`, { headers }),
        axios.get(`${API}/app/spin/status`, { headers }).catch(() => ({ data: { can_spin: true } }))
      ]);
      
      setBalance(walletRes.data.coins || 0);
      setCanSpin(spinRes.data?.can_spin !== false);
    } catch (error) {
      console.log('Data fetch error');
    }
  };
  
  const drawWheel = (rot) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 10;
    
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.translate(-center, -center);
    
    const segmentAngle = (2 * Math.PI) / PRIZES.length;
    
    PRIZES.forEach((prize, i) => {
      const startAngle = i * segmentAngle - Math.PI / 2;
      const endAngle = startAngle + segmentAngle;
      
      // Draw segment
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = prize.color;
      ctx.fill();
      ctx.strokeStyle = '#0c0f22';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw text
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'white';
      ctx.font = 'bold 18px Arial';
      ctx.fillText(prize.label, radius - 20, 6);
      ctx.restore();
    });
    
    ctx.restore();
    
    // Draw center circle
    ctx.beginPath();
    ctx.arc(center, center, 30, 0, 2 * Math.PI);
    ctx.fillStyle = '#1c213f';
    ctx.fill();
    ctx.strokeStyle = '#6c63ff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw pointer
    ctx.beginPath();
    ctx.moveTo(center, 10);
    ctx.lineTo(center - 15, 40);
    ctx.lineTo(center + 15, 40);
    ctx.closePath();
    ctx.fillStyle = '#6c63ff';
    ctx.fill();
  };
  
  const spin = async () => {
    if (spinning || !canSpin) return;
    
    setSpinning(true);
    setPrize(null);
    setMessage('');
    
    // Random prize index
    const prizeIndex = Math.floor(Math.random() * PRIZES.length);
    const selectedPrize = PRIZES[prizeIndex];
    
    // Calculate final rotation
    const segmentAngle = 360 / PRIZES.length;
    const targetAngle = 360 - (prizeIndex * segmentAngle + segmentAngle / 2);
    const spins = 5; // Number of full rotations
    const finalRotation = rotation + (spins * 360) + targetAngle;
    
    // Animate
    const duration = 4000;
    const start = Date.now();
    const startRotation = rotation;
    
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease out)
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentRotation = startRotation + (finalRotation - startRotation) * eased;
      
      setRotation(currentRotation % 360);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        setPrize(selectedPrize);
        
        // Save to backend
        savePrize(selectedPrize.value);
      }
    };
    
    requestAnimationFrame(animate);
  };
  
  const savePrize = async (coins) => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await axios.post(`${API}/app/spin/claim`, 
        { coins },
        { headers }
      );
      
      setBalance(res.data.new_balance);
      setMessage(res.data.message);
      setCanSpin(false);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Fehler beim Speichern');
    }
  };
  
  return (
    <div className="min-h-screen bg-[#0c0f22] text-white pb-24">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <Link to="/games" className="p-2 bg-[#1c213f] rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">Glücksrad</h1>
        <div className="flex items-center gap-2 bg-[#1c213f] px-3 py-1.5 rounded-xl">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="font-bold">{balance}</span>
        </div>
      </div>
      
      {/* Wheel */}
      <div className="px-4 flex flex-col items-center">
        <div className="relative mb-6">
          <canvas
            ref={canvasRef}
            width={300}
            height={300}
            className="drop-shadow-2xl"
          />
          
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-full bg-[#6c63ff]/20 blur-xl -z-10" />
        </div>
        
        {/* Spin Button */}
        <button
          onClick={spin}
          disabled={spinning || !canSpin}
          className={`w-full max-w-xs py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
            spinning
              ? 'bg-slate-700 cursor-not-allowed'
              : canSpin
              ? 'bg-gradient-to-r from-[#6c63ff] to-[#8b5cf6] hover:from-[#5a52e0] hover:to-[#7c3aed] shadow-lg shadow-[#6c63ff]/30'
              : 'bg-slate-700 cursor-not-allowed'
          }`}
        >
          {spinning ? (
            <>
              <Sparkles className="w-6 h-6 animate-spin" />
              Dreht...
            </>
          ) : canSpin ? (
            <>
              <Star className="w-6 h-6" />
              Drehen!
            </>
          ) : (
            <>
              Morgen wieder!
            </>
          )}
        </button>
      </div>
      
      {/* Prize Result */}
      {prize && (
        <div className="mx-4 mt-6">
          <div className={`p-6 rounded-2xl text-center ${
            prize.value > 0 
              ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30'
              : 'bg-slate-700/50'
          }`}>
            <Gift className={`w-12 h-12 mx-auto mb-3 ${prize.value > 0 ? 'text-green-400' : 'text-slate-400'}`} />
            {prize.value > 0 ? (
              <>
                <h2 className="text-2xl font-bold text-green-400 mb-1">Gewonnen!</h2>
                <p className="text-4xl font-bold text-white">+{prize.value} Coins</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-slate-400">Leider nichts</h2>
                <p className="text-slate-500">Versuche es morgen wieder!</p>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Message */}
      {message && (
        <div className="mx-4 mt-4 p-3 bg-[#1c213f] rounded-xl text-center">
          {message}
        </div>
      )}
      
      {/* Prize Info */}
      <div className="px-4 mt-6">
        <div className="bg-[#1c213f] rounded-xl p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Gift className="w-5 h-5 text-[#6c63ff]" />
            Mögliche Gewinne
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {PRIZES.map((p, i) => (
              <div 
                key={i} 
                className="text-center p-2 rounded-lg"
                style={{ backgroundColor: `${p.color}20` }}
              >
                <span className="font-bold" style={{ color: p.color }}>
                  {p.value > 0 ? p.value : 'X'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
