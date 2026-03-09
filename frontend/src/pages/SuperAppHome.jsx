/**
 * BidBlitz Dashboard - 8 Service Cards
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const SERVICES = [
  { emoji: '🎮', name: 'Games', route: '/games' },
  { emoji: '💰', name: 'Wallet', route: '/wallet' },
  { emoji: '🔥', name: 'Live Auctions', route: '/auctions' },
  { emoji: '👑', name: 'VIP Auctions', route: '/vip-auctions' },
  { emoji: '⛏', name: 'Mining', route: '/mining' },
  { emoji: '🛍', name: 'Marketplace', route: '/marketplace' },
  { emoji: '🚕', name: 'Taxi', route: '/taxi' },
  { emoji: '🛴', name: 'Scooter', route: '/scooter' },
];

export default function SuperAppHome() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(0);
  
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
      setCoins(100);
    }
  };
  
  return (
    <div style={{
      background: '#0f172a',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      minHeight: '100vh',
      padding: '20px',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflowY: 'auto',
      zIndex: 999
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '25px'
      }}>
        <h2 style={{ margin: 0, fontSize: '24px' }}>⚡ BidBlitz</h2>
        <div 
          onClick={() => navigate('/wallet')}
          style={{
            background: '#7c3aed',
            padding: '8px 16px',
            borderRadius: '10px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          💰 {coins.toLocaleString()}
        </div>
      </div>
      
      {/* Dashboard Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '15px',
        paddingBottom: '100px'
      }}>
        {SERVICES.map((service, index) => (
          <div
            key={index}
            onClick={() => navigate(service.route)}
            style={{
              background: '#1e293b',
              padding: '30px 20px',
              borderRadius: '15px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#7c3aed';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1e293b';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>
              {service.emoji}
            </div>
            <div style={{ fontSize: '16px', fontWeight: '500' }}>
              {service.name}
            </div>
          </div>
        ))}
      </div>
      
      {/* Bottom Navigation */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#111827',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '15px',
        borderTop: '1px solid #1f2937'
      }}>
        <button 
          style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: '24px', cursor: 'pointer' }}
        >
          🏠
        </button>
        <button 
          onClick={() => navigate('/games')}
          style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}
        >
          🎮
        </button>
        <button 
          onClick={() => navigate('/mining')}
          style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}
        >
          ⛏
        </button>
        <button 
          onClick={() => navigate('/wallet')}
          style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}
        >
          💰
        </button>
      </div>
    </div>
  );
}
