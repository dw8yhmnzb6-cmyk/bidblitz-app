/**
 * BidBlitz Live Auctions - Mit VIP Sektion
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LiveAuction() {
  const navigate = useNavigate();
  
  // Auction state
  const [productName, setProductName] = useState('Product');
  const [productValue, setProductValue] = useState(0);
  const [price, setPrice] = useState(0);
  const [timer, setTimer] = useState(10);
  const [bids, setBids] = useState(0);
  const [minRevenue, setMinRevenue] = useState(200);
  const [auctionFinished, setAuctionFinished] = useState(false);
  
  // VIP Auctions list
  const [vipAuctions, setVipAuctions] = useState([]);
  
  // Admin inputs
  const [adminProduct, setAdminProduct] = useState('');
  const [adminValue, setAdminValue] = useState('');
  const [adminMinRevenue, setAdminMinRevenue] = useState('');
  
  const bidCost = 0.50;
  
  useEffect(() => {
    const header = document.querySelector('header');
    if (header) header.style.display = 'none';
    
    return () => {
      const header = document.querySelector('header');
      if (header) header.style.display = '';
    };
  }, []);
  
  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev > 0) {
          return prev - 1;
        }
        return prev;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Check auction end
  useEffect(() => {
    if (timer === 0 && !auctionFinished) {
      const revenue = bids * bidCost;
      
      if (revenue >= minRevenue) {
        setAuctionFinished(true);
        alert('Auktion beendet');
      } else {
        // Extend timer
        setTimer(5);
      }
    }
  }, [timer, bids, minRevenue, auctionFinished]);
  
  const createAuction = () => {
    const name = adminProduct || 'Product';
    const value = parseFloat(adminValue) || 0;
    const minRev = parseFloat(adminMinRevenue) || 200;
    
    setProductName(name);
    setProductValue(value);
    setMinRevenue(minRev);
    
    // If product value >= 1000, add to VIP list
    if (value >= 1000) {
      setVipAuctions(prev => [...prev, { name, value }]);
    }
    
    setPrice(0);
    setBids(0);
    setTimer(10);
    setAuctionFinished(false);
    
    // Clear inputs
    setAdminProduct('');
    setAdminValue('');
    setAdminMinRevenue('');
  };
  
  const bid = () => {
    if (auctionFinished) return;
    
    setBids(prev => prev + 1);
    setPrice(prev => prev + 0.01);
    setTimer(10);
  };
  
  const revenue = bids * bidCost;
  
  return (
    <>
      <style>{`
        .auction-page {
          font-family: Arial, sans-serif;
          background: #0f172a;
          color: white;
          margin: 0;
          min-height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow-y: auto;
          z-index: 999;
        }
        
        .auction-header {
          background: #020617;
          padding: 20px;
          font-size: 24px;
          display: flex;
          align-items: center;
          gap: 15px;
        }
        
        .back-btn {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
        }
        
        .container {
          padding: 20px;
        }
        
        .auction-card {
          background: #1e293b;
          padding: 20px;
          border-radius: 15px;
          margin-bottom: 20px;
        }
        
        .auction-card h2 {
          margin: 0 0 15px 0;
        }
        
        .auction-card p {
          margin: 10px 0;
          font-size: 18px;
        }
        
        .vip-card {
          background: #7c3aed;
          padding: 20px;
          border-radius: 15px;
          margin-bottom: 20px;
        }
        
        .vip-card h2 {
          margin: 0 0 10px 0;
        }
        
        .vip-card p {
          margin: 5px 0;
          opacity: 0.9;
        }
        
        .vip-list {
          margin-top: 15px;
        }
        
        .vip-item {
          background: rgba(255,255,255,0.1);
          padding: 10px 15px;
          border-radius: 8px;
          margin: 5px 0;
        }
        
        .admin-card {
          background: #111827;
          padding: 20px;
          border-radius: 15px;
          margin-top: 20px;
        }
        
        .admin-card h3 {
          margin: 0 0 15px 0;
        }
        
        .bid-btn {
          background: #a855f7;
          border: none;
          padding: 10px 20px;
          color: white;
          border-radius: 10px;
          font-size: 16px;
          cursor: pointer;
          transition: 0.3s;
        }
        
        .bid-btn:hover {
          background: #9333ea;
        }
        
        .bid-btn:disabled {
          background: #4b5563;
          cursor: not-allowed;
        }
        
        .admin-input {
          padding: 10px;
          margin: 5px;
          border-radius: 5px;
          border: none;
          background: #1e293b;
          color: white;
          font-size: 14px;
          width: calc(100% - 30px);
        }
        
        .admin-input::placeholder {
          color: #64748b;
        }
        
        .admin-btn {
          background: #a855f7;
          border: none;
          padding: 10px 20px;
          color: white;
          border-radius: 10px;
          font-size: 16px;
          cursor: pointer;
          margin-top: 10px;
        }
        
        .admin-btn:hover {
          background: #9333ea;
        }
        
        .timer-urgent {
          color: #ef4444;
        }
        
        .revenue-text {
          color: #22c55e;
        }
      `}</style>
      
      <div className="auction-page">
        {/* Header */}
        <header className="auction-header">
          <button className="back-btn" onClick={() => navigate('/super-home')}>←</button>
          <span>⚡ BidBlitz Live Auctions</span>
        </header>
        
        <div className="container">
          {/* Current Auction */}
          <div className="auction-card">
            <h2>{productName}</h2>
            
            <p>Preis: €<strong>{price.toFixed(2)}</strong></p>
            
            <p className={timer <= 3 ? 'timer-urgent' : ''}>
              Timer: <strong>{timer}</strong>s
            </p>
            
            <p>Gebote: <strong>{bids}</strong></p>
            
            <p className="revenue-text">
              Umsatz: €<strong>{revenue.toFixed(2)}</strong>
            </p>
            
            <button 
              className="bid-btn" 
              onClick={bid}
              disabled={auctionFinished}
            >
              Bieten (0,50 €)
            </button>
          </div>
          
          {/* VIP Auctions */}
          <div className="vip-card">
            <h2>👑 VIP Auktionen</h2>
            <p>Produkte über 1000 € erscheinen hier</p>
            
            <div className="vip-list">
              {vipAuctions.length === 0 ? (
                <p style={{ opacity: 0.6, fontStyle: 'italic' }}>Noch keine VIP Auktionen</p>
              ) : (
                vipAuctions.map((auction, index) => (
                  <div key={index} className="vip-item">
                    {auction.name} (€{auction.value.toFixed(2)})
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Admin Panel */}
          <div className="admin-card">
            <h3>⚙️ Admin Panel</h3>
            
            <input 
              className="admin-input"
              placeholder="Produktname"
              value={adminProduct}
              onChange={(e) => setAdminProduct(e.target.value)}
            />
            
            <input 
              className="admin-input"
              placeholder="Produktwert"
              type="number"
              value={adminValue}
              onChange={(e) => setAdminValue(e.target.value)}
            />
            
            <input 
              className="admin-input"
              placeholder="Minimum Umsatz"
              type="number"
              value={adminMinRevenue}
              onChange={(e) => setAdminMinRevenue(e.target.value)}
            />
            
            <button className="admin-btn" onClick={createAuction}>
              Auktion erstellen
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
