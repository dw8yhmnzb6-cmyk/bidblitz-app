/**
 * BidBlitz Live Auction
 * Real-time bidding with countdown timer
 */
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function LiveAuction() {
  const [coins, setCoins] = useState(0);
  const [currentBid, setCurrentBid] = useState(10);
  const [timeLeft, setTimeLeft] = useState(20);
  const [isActive, setIsActive] = useState(true);
  const [winner, setWinner] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [username, setUsername] = useState('Du');
  const timerRef = useRef(null);

  // Sample auction items
  const [currentItem, setCurrentItem] = useState({
    id: 1,
    name: 'AirPods Pro',
    image: '🎧',
    startPrice: 10,
    description: 'Apple AirPods Pro 2. Generation'
  });

  const auctionItems = [
    { id: 1, name: 'AirPods Pro', image: '🎧', startPrice: 10, description: 'Apple AirPods Pro 2. Generation' },
    { id: 2, name: 'PlayStation 5', image: '🎮', startPrice: 50, description: 'Sony PlayStation 5 Digital Edition' },
    { id: 3, name: 'iPhone 15', image: '📱', startPrice: 100, description: 'Apple iPhone 15 128GB' },
    { id: 4, name: 'MacBook Air', image: '💻', startPrice: 200, description: 'Apple MacBook Air M2' },
    { id: 5, name: '€500 Gutschein', image: '🎁', startPrice: 25, description: 'Amazon Geschenkgutschein' },
  ];

  useEffect(() => {
    fetchCoins();
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (timeLeft <= 0 && isActive) {
      endAuction();
    }
  }, [timeLeft]);

  const fetchCoins = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/app/wallet/balance`, { headers });
      setCoins(res.data.coins || 0);
      
      const user = localStorage.getItem('user');
      if (user) {
        const userData = JSON.parse(user);
        setUsername(userData.username || userData.name || 'Du');
      }
    } catch (error) {
      console.log('Coins error');
    }
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const placeBid = async () => {
    if (!isActive || coins < 1) return;

    const newBid = currentBid + 1;
    setCurrentBid(newBid);
    setTimeLeft(20); // Reset timer
    
    // Add to bid history
    const newBidEntry = {
      id: Date.now(),
      user: username,
      amount: newBid,
      time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setBidHistory(prev => [newBidEntry, ...prev].slice(0, 10));

    // Deduct 1 coin for bidding
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/app/auction/bid`, {
        item_id: currentItem.id,
        bid_amount: newBid
      }, { headers });
      setCoins(prev => prev - 1);
    } catch (error) {
      setCoins(prev => Math.max(0, prev - 1));
    }
  };

  const endAuction = () => {
    setIsActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Last bidder wins
    const lastBidder = bidHistory[0]?.user || 'Niemand';
    setWinner({
      user: lastBidder,
      amount: currentBid,
      item: currentItem.name
    });
  };

  const startNewAuction = () => {
    // Pick random item
    const randomItem = auctionItems[Math.floor(Math.random() * auctionItems.length)];
    setCurrentItem(randomItem);
    setCurrentBid(randomItem.startPrice);
    setTimeLeft(20);
    setIsActive(true);
    setWinner(null);
    setBidHistory([]);
    startTimer();
  };

  const getTimeColor = () => {
    if (timeLeft <= 5) return 'text-red-500';
    if (timeLeft <= 10) return 'text-amber-500';
    return 'text-green-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0e24] via-[#0f1332] to-[#0b0e24] text-white pb-24">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-60 h-60 bg-red-500/10 rounded-full blur-[80px] animate-pulse"></div>
        <div className="absolute bottom-40 -right-20 w-60 h-60 bg-purple-500/10 rounded-full blur-[80px] animate-pulse"></div>
      </div>

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/games" className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
              <span className="text-lg">←</span>
            </Link>
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                🔥 Live Auction
              </h2>
              <p className="text-xs text-slate-400">Biete und gewinne!</p>
            </div>
          </div>
          <div className="bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/30">
            <span className="text-amber-400 font-bold">{coins.toLocaleString()} 💰</span>
          </div>
        </div>

        {/* Winner Modal */}
        {winner && (
          <div className="mb-6 bg-gradient-to-r from-emerald-500/20 to-green-500/10 p-5 rounded-2xl border border-emerald-500/30 text-center">
            <span className="text-4xl mb-2 block">🎉</span>
            <h3 className="text-xl font-bold text-emerald-400 mb-2">Auktion beendet!</h3>
            <p className="text-lg">
              <span className="font-bold text-white">{winner.user}</span> hat gewonnen!
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {winner.item} für <span className="text-amber-400 font-bold">{winner.amount} Coins</span>
            </p>
            <button
              onClick={startNewAuction}
              className="mt-4 px-6 py-3 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-semibold transition-all"
              data-testid="new-auction-btn"
            >
              🔄 Neue Auktion starten
            </button>
          </div>
        )}

        {/* Current Item Card */}
        <div className="bg-white/5 backdrop-blur-sm p-6 rounded-3xl border border-white/10 mb-6">
          <div className="text-center mb-4">
            <span className="text-6xl mb-3 block">{currentItem.image}</span>
            <h3 className="text-2xl font-bold">{currentItem.name}</h3>
            <p className="text-sm text-slate-400">{currentItem.description}</p>
          </div>

          {/* Current Bid */}
          <div className="bg-black/30 rounded-2xl p-4 mb-4">
            <p className="text-sm text-slate-400 mb-1">Aktuelles Gebot</p>
            <p className="text-4xl font-bold text-amber-400" data-testid="current-bid">
              {currentBid} <span className="text-xl">Coins</span>
            </p>
          </div>

          {/* Timer */}
          <div className="bg-black/30 rounded-2xl p-4 mb-4">
            <p className="text-sm text-slate-400 mb-1">Verbleibende Zeit</p>
            <p className={`text-4xl font-bold ${getTimeColor()} font-mono`} data-testid="timer">
              {timeLeft} <span className="text-xl">Sek</span>
            </p>
            {timeLeft <= 5 && isActive && (
              <p className="text-xs text-red-400 animate-pulse mt-1">⚠️ Schnell bieten!</p>
            )}
          </div>

          {/* Bid Button */}
          {isActive && (
            <button
              onClick={placeBid}
              disabled={coins < 1}
              className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
                coins < 1 
                  ? 'bg-slate-600 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-[#6c63ff] to-[#8b6dff] hover:from-[#8b6dff] hover:to-[#a78bfa] active:scale-[0.98]'
              }`}
              data-testid="bid-btn"
            >
              {coins < 1 ? '💰 Keine Coins' : '🔥 Gebot +1 Coin'}
            </button>
          )}
        </div>

        {/* Bid History */}
        <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <span>📜</span> Gebotsverlauf
            </h3>
            <span className="text-xs text-slate-400">{bidHistory.length} Gebote</span>
          </div>
          
          {bidHistory.length === 0 ? (
            <p className="text-center text-slate-500 py-4">Noch keine Gebote</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {bidHistory.map((bid, index) => (
                <div 
                  key={bid.id}
                  className={`p-3 rounded-xl flex items-center justify-between ${
                    index === 0 ? 'bg-[#6c63ff]/20 border border-[#6c63ff]/30' : 'bg-black/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {index === 0 && <span>👑</span>}
                    <span className={index === 0 ? 'font-bold' : ''}>{bid.user}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-400">{bid.amount} 💰</p>
                    <p className="text-xs text-slate-500">{bid.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Other Auctions */}
        <div className="mt-6 bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
          <h3 className="font-semibold mb-3">Weitere Auktionen</h3>
          <div className="grid grid-cols-3 gap-2">
            {auctionItems.filter(item => item.id !== currentItem.id).slice(0, 3).map(item => (
              <div key={item.id} className="bg-black/20 p-3 rounded-xl text-center">
                <span className="text-2xl">{item.image}</span>
                <p className="text-xs mt-1 truncate">{item.name}</p>
                <p className="text-xs text-amber-400">{item.startPrice}+</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
