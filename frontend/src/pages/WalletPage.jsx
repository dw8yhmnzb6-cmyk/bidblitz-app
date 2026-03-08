/**
 * BidBlitz Wallet - Coin Übersicht
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Transaction History (Mock)
const MOCK_TRANSACTIONS = [
  { id: 1, type: 'earn', amount: 50, source: 'Slot Machine', time: '2 Min' },
  { id: 2, type: 'earn', amount: 10, source: 'Lucky Wheel', time: '15 Min' },
  { id: 3, type: 'earn', amount: 5, source: 'Coin Tap', time: '1 Std' },
  { id: 4, type: 'spend', amount: -20, source: 'Taxi Ride', time: '2 Std' },
  { id: 5, type: 'earn', amount: 100, source: 'Daily Bonus', time: '1 Tag' },
];

// Nav Items
const NAV_ITEMS = [
  { emoji: '🏠', route: '/super-home' },
  { emoji: '🎮', route: '/games' },
  { emoji: '💰', route: '/wallet', active: true },
  { emoji: '👤', route: '/profile' },
];

export default function WalletPage() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(0);
  const [transactions, setTransactions] = useState(MOCK_TRANSACTIONS);

  const userId = localStorage.getItem('userId') || 'guest';

  useEffect(() => {
    fetchCoins();
    fetchTransactions();
    
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
      setCoins(1200);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await axios.get(`${API}/bbz/transactions/${userId}`);
      if (res.data.transactions?.length > 0) {
        setTransactions(res.data.transactions);
      }
    } catch {
      // Use mock data
    }
  };

  return (
    <>
      <style>{`
        .wallet-page {
          margin: 0;
          background: #0f172a;
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          min-height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow-y: auto;
          z-index: 999;
          padding: 30px 20px 100px;
          text-align: center;
        }
        .wallet-title {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 30px;
        }
        .wallet-balance {
          background: linear-gradient(90deg, #7c3aed, #9333ea);
          padding: 40px 30px;
          border-radius: 20px;
          margin-bottom: 30px;
        }
        .balance-label {
          font-size: 16px;
          opacity: 0.8;
          margin-bottom: 10px;
        }
        .balance-value {
          font-size: 48px;
          font-weight: bold;
        }
        .wallet-actions {
          display: flex;
          gap: 15px;
          justify-content: center;
          margin-bottom: 30px;
        }
        .wallet-btn {
          background: #1f2937;
          border: none;
          color: white;
          padding: 15px 30px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .wallet-btn:hover {
          background: #7c3aed;
        }
        .transactions-title {
          text-align: left;
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 15px;
        }
        .transaction-list {
          text-align: left;
        }
        .transaction-item {
          background: #1f2937;
          padding: 15px;
          border-radius: 12px;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .transaction-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .transaction-icon {
          width: 40px;
          height: 40px;
          background: #374151;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }
        .transaction-source {
          font-weight: 500;
        }
        .transaction-time {
          font-size: 12px;
          color: #9ca3af;
        }
        .transaction-amount {
          font-weight: bold;
          font-size: 18px;
        }
        .transaction-amount.positive {
          color: #22c55e;
        }
        .transaction-amount.negative {
          color: #ef4444;
        }
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          width: 100%;
          background: #111827;
          display: flex;
          justify-content: space-around;
          padding: 14px;
          z-index: 1000;
        }
        .nav-btn {
          background: none;
          border: none;
          font-size: 22px;
          cursor: pointer;
          padding: 8px 16px;
          opacity: 0.6;
          transition: all 0.2s;
        }
        .nav-btn:hover, .nav-btn.active {
          opacity: 1;
          transform: scale(1.1);
        }
      `}</style>
      
      <div className="wallet-page" data-testid="wallet-page">
        {/* Title */}
        <div className="wallet-title">💰 Wallet</div>

        {/* Balance Card */}
        <div className="wallet-balance">
          <div className="balance-label">Dein Guthaben</div>
          <div className="balance-value">{coins.toLocaleString()} 🪙</div>
        </div>

        {/* Actions */}
        <div className="wallet-actions">
          <button className="wallet-btn" onClick={() => navigate('/games')}>
            🎮 Verdienen
          </button>
          <button className="wallet-btn" onClick={() => navigate('/auctions')}>
            🛒 Ausgeben
          </button>
        </div>

        {/* Transactions */}
        <div className="transactions-title">📋 Letzte Aktivitäten</div>
        <div className="transaction-list">
          {transactions.map((tx) => (
            <div key={tx.id} className="transaction-item">
              <div className="transaction-info">
                <div className="transaction-icon">
                  {tx.type === 'earn' ? '➕' : '➖'}
                </div>
                <div>
                  <div className="transaction-source">{tx.source}</div>
                  <div className="transaction-time">{tx.time}</div>
                </div>
              </div>
              <div className={`transaction-amount ${tx.amount > 0 ? 'positive' : 'negative'}`}>
                {tx.amount > 0 ? '+' : ''}{tx.amount}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Navigation */}
        <nav className="bottom-nav">
          {NAV_ITEMS.map((item, index) => (
            <button
              key={index}
              onClick={() => navigate(item.route)}
              className={`nav-btn ${item.active ? 'active' : ''}`}
            >
              {item.emoji}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
