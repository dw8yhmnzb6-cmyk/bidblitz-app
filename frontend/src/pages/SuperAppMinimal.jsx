/**
 * BidBlitz Super App - Minimalistic Dark Theme
 * Mobile-first design with clean cards
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  Cpu, Gamepad2, Car, Bike, Gavel, Gift, 
  ShoppingBag, Ticket, Crown, Zap, Trophy,
  MapPin, Coffee, CreditCard, Users, Clock,
  ChevronRight, Coins, TrendingUp
} from 'lucide-react';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Quick Access Card
const QuickCard = ({ icon: Icon, label, to, color = '#6c63ff' }) => (
  <Link
    to={to}
    className="flex flex-col items-center justify-center p-4 bg-[#1c213f] rounded-xl hover:bg-[#252b4d] transition-colors"
  >
    <Icon className="w-6 h-6 mb-2" style={{ color }} />
    <span className="text-xs text-slate-300 text-center">{label}</span>
  </Link>
);

// Stats Card
const StatCard = ({ label, value, icon: Icon, color = '#6c63ff' }) => (
  <div className="bg-[#1c213f] rounded-xl p-4 flex items-center gap-3">
    <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
      <Icon className="w-5 h-5" style={{ color }} />
    </div>
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  </div>
);

export default function SuperAppMinimal() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ coins: 0, hashrate: 0, daily: 0 });
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API}/app/mining/stats`, { headers });
        setStats({
          coins: res.data.coins || 0,
          hashrate: res.data.total_hashrate || 0,
          daily: res.data.daily_reward || 0
        });
      } catch (err) {
        console.log('Stats not available');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);
  
  const quickAccess = [
    { icon: Car, label: 'Taxi', to: '/taxi', color: '#f59e0b' },
    { icon: Bike, label: 'Scooter', to: '/scooter', color: '#10b981' },
    { icon: Gavel, label: 'Auktionen', to: '/auctions', color: '#06b6d4' },
    { icon: Gamepad2, label: 'Games', to: '/games', color: '#8b5cf6' },
    { icon: Cpu, label: 'Mining', to: '/miner', color: '#6c63ff' },
    { icon: ShoppingBag, label: 'Deals', to: '/deal-radar', color: '#ec4899' },
    { icon: Gift, label: 'Gutscheine', to: '/gift-cards', color: '#f43f5e' },
    { icon: CreditCard, label: 'Pay', to: '/bidblitz-pay-info', color: '#14b8a6' },
  ];
  
  return (
    <div className="min-h-screen bg-[#0c0f22] text-white pb-24">
      {/* Header */}
      <div className="p-5 pt-6">
        <h1 className="text-2xl font-bold mb-1">BidBlitz</h1>
        <p className="text-slate-400 text-sm">Willkommen zur Super App</p>
      </div>
      
      {/* Stats Overview */}
      <div className="px-5 mb-6">
        <div className="bg-[#1c213f] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Dein Status</h2>
            <Link to="/miner" className="text-[#6c63ff] text-sm flex items-center gap-1">
              Details <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <Coins className="w-5 h-5 mx-auto mb-1 text-amber-400" />
              <p className="text-lg font-bold">{stats.coins.toLocaleString()}</p>
              <p className="text-xs text-slate-400">Coins</p>
            </div>
            <div className="text-center">
              <Cpu className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
              <p className="text-lg font-bold">{stats.hashrate}</p>
              <p className="text-xs text-slate-400">TH/s</p>
            </div>
            <div className="text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-400" />
              <p className="text-lg font-bold">+{stats.daily}</p>
              <p className="text-xs text-slate-400">/Tag</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Quick Access */}
      <div className="px-5 mb-6">
        <h2 className="font-semibold mb-3">Schnellzugriff</h2>
        <div className="grid grid-cols-4 gap-3">
          {quickAccess.map((item, idx) => (
            <QuickCard key={idx} {...item} />
          ))}
        </div>
      </div>
      
      {/* Featured Actions */}
      <div className="px-5 mb-6">
        <h2 className="font-semibold mb-3">Entdecken</h2>
        
        <Link to="/miner" className="block bg-gradient-to-r from-[#6c63ff] to-[#8b5cf6] rounded-2xl p-5 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg mb-1">Mining starten</h3>
              <p className="text-sm text-white/70">Verdiene täglich Coins</p>
            </div>
            <Cpu className="w-10 h-10 text-white/80" />
          </div>
        </Link>
        
        <Link to="/auctions" className="block bg-gradient-to-r from-[#06b6d4] to-[#0891b2] rounded-2xl p-5 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg mb-1">Live Auktionen</h3>
              <p className="text-sm text-white/70">Biete und gewinne</p>
            </div>
            <Gavel className="w-10 h-10 text-white/80" />
          </div>
        </Link>
        
        <Link to="/games" className="block bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg mb-1">Spiele spielen</h3>
              <p className="text-sm text-white/70">Gewinne Bonus-Coins</p>
            </div>
            <Gamepad2 className="w-10 h-10 text-white/80" />
          </div>
        </Link>
      </div>
      
      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
