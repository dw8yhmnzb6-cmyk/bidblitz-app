/**
 * BidBlitz E-Bike with QR Scanner
 * Scan QR code to unlock e-bike
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';
import { useLanguage } from '../context/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function AppBike() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [wallet, setWallet] = useState(500);
  const [status, setStatus] = useState('');
  const [rideActive, setRideActive] = useState(false);
  const [rideTime, setRideTime] = useState(0);
  const [scannedId, setScannedId] = useState('');
  const [scannerReady, setScannerReady] = useState(false);
  const scannerRef = useRef(null);
  const readerRef = useRef(null);
  
  const UNLOCK_PRICE = 3;
  const PRICE_PER_MINUTE = 1;
  
  useEffect(() => {
    fetchWallet();
    loadQRScanner();
    
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, []);
  
  useEffect(() => {
    let interval;
    if (rideActive) {
      interval = setInterval(() => {
        setRideTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [rideActive]);
  
  const fetchWallet = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/app/wallet/balance`, { headers });
      setWallet(res.data.coins || 0);
    } catch (error) {
      console.log('Wallet error');
    }
  };
  
  const loadQRScanner = () => {
    if (window.Html5QrcodeScanner) {
      initScanner();
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode';
      script.onload = initScanner;
      document.head.appendChild(script);
    }
  };
  
  const initScanner = () => {
    if (!readerRef.current || scannerRef.current) return;
    
    setTimeout(() => {
      try {
        scannerRef.current = new window.Html5QrcodeScanner(
          "qr-reader-bike",
          { fps: 10, qrbox: { width: 250, height: 250 } }
        );
        
        scannerRef.current.render(onScanSuccess, onScanError);
        setScannerReady(true);
      } catch (error) {
        console.log('Scanner init error');
      }
    }, 500);
  };
  
  const onScanSuccess = (decodedText) => {
    setScannedId(decodedText);
    setStatus(`E-Bike ${decodedText} gefunden!`);
    if (scannerRef.current) {
      scannerRef.current.pause();
    }
  };
  
  const onScanError = () => {};
  
  const unlockBike = async () => {
    if (wallet < UNLOCK_PRICE) {
      setStatus('Nicht genug Coins!');
      return;
    }
    
    setWallet(prev => prev - UNLOCK_PRICE);
    setRideActive(true);
    setStatus('E-Bike entsperrt! Gute Fahrt!');
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/app/wallet/spend`, {
        amount: UNLOCK_PRICE,
        description: 'E-Bike Entsperrung'
      }, { headers });
    } catch (error) {
      console.log('Spend error');
    }
  };
  
  const endRide = async () => {
    const cost = Math.ceil(rideTime / 60) * PRICE_PER_MINUTE;
    setWallet(prev => prev - cost);
    setRideActive(false);
    setRideTime(0);
    setScannedId('');
    setStatus(`Fahrt beendet! ${cost} Coins für ${Math.ceil(rideTime / 60)} Min.`);
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/app/wallet/spend`, {
        amount: cost,
        description: `E-Bike Fahrt - ${Math.ceil(rideTime / 60)} Minuten`
      }, { headers });
    } catch (error) {
      console.log('Spend error');
    }
    
    if (scannerRef.current) {
      scannerRef.current.resume();
    }
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0e24] via-[#0f1332] to-[#0b0e24] text-white pb-24">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-20 w-60 h-60 bg-blue-500/10 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-40 -left-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/super-app')}
              className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
            >
              <span className="text-lg">←</span>
            </button>
            <div>
              <h2 className="text-2xl font-bold">🚲 E-Bike</h2>
              <p className="text-xs text-slate-400">{t('rides.bikeDesc') || 'Umweltfreundlich unterwegs'}</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-blue-500/20 to-indigo-500/20 px-4 py-2 rounded-xl border border-blue-500/30">
            <p className="text-xs text-slate-400">{t('rides.payWithCoins') || 'Guthaben'}</p>
            <p className="font-bold text-blue-400">{wallet} Coins</p>
          </div>
        </div>

        {/* Pricing Info */}
        <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10 mb-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <span>💰</span> Preise
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-500/10 p-3 rounded-xl">
              <p className="text-xs text-slate-400">Entsperren</p>
              <p className="text-lg font-bold text-blue-400">{UNLOCK_PRICE} Coins</p>
            </div>
            <div className="bg-indigo-500/10 p-3 rounded-xl">
              <p className="text-xs text-slate-400">Pro Minute</p>
              <p className="text-lg font-bold text-indigo-400">{PRICE_PER_MINUTE} Coin</p>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {status && (
          <div className={`p-4 rounded-xl mb-6 text-center font-medium ${
            status.includes('Nicht genug') 
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}>
            {status}
          </div>
        )}

        {/* Active Ride */}
        {rideActive ? (
          <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 p-6 rounded-2xl border border-blue-500/30 mb-6">
            <div className="text-center">
              <span className="text-6xl mb-4 block animate-bounce">🚲</span>
              <p className="text-slate-400 mb-2">Fahrtzeit</p>
              <p className="text-5xl font-bold text-blue-400 mb-4">{formatTime(rideTime)}</p>
              <p className="text-slate-400 mb-6">
                Aktuelle Kosten: <span className="text-blue-400 font-bold">{Math.ceil(rideTime / 60) * PRICE_PER_MINUTE} Coins</span>
              </p>
              <button
                onClick={endRide}
                className="w-full py-4 bg-red-500 hover:bg-red-600 rounded-xl font-bold text-lg transition-all"
              >
                🛑 Fahrt beenden
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* QR Scanner */}
            <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10 mb-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <span>📷</span> QR-Code scannen
              </h3>
              <div 
                id="qr-reader-bike" 
                ref={readerRef}
                className="rounded-xl overflow-hidden"
              ></div>
              {!scannerReady && (
                <div className="text-center py-8 text-slate-400">
                  <span className="animate-spin text-2xl inline-block mb-2">⏳</span>
                  <p>Scanner wird geladen...</p>
                </div>
              )}
            </div>

            {/* Manual Input */}
            <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10 mb-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <span>✏️</span> Oder Bike-ID eingeben
              </h3>
              <input
                type="text"
                value={scannedId}
                onChange={(e) => setScannedId(e.target.value)}
                placeholder="z.B. BIKE-001"
                className="w-full p-4 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-all mb-4"
              />
              <button
                onClick={unlockBike}
                disabled={!scannedId || wallet < UNLOCK_PRICE}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🔓 E-Bike entsperren ({UNLOCK_PRICE} Coins)
              </button>
            </div>
          </>
        )}

        {/* E-Bike Benefits */}
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-5 rounded-2xl border border-green-500/20">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <span>🌱</span> E-Bike Vorteile
          </h3>
          <div className="space-y-2 text-sm text-slate-300">
            <p>✓ Umweltfreundlich - 0% Emissionen</p>
            <p>✓ Günstigste Option - nur {PRICE_PER_MINUTE} Coin/Min</p>
            <p>✓ Elektrischer Antrieb für müheloses Fahren</p>
            <p>✓ Ideal für kurze bis mittlere Strecken</p>
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
