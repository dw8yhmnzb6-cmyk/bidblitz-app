/**
 * BidBlitz Live Map with Coin Hunt
 * Shows nearby taxis, scooters, AND collectible coins on Leaflet map
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function AppMap() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const navigate = useNavigate();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [filter, setFilter] = useState('all'); // all, taxi, scooter, coins
  const [collectedCoins, setCollectedCoins] = useState(0);
  const [totalCoinsFound, setTotalCoinsFound] = useState(0);
  const [coinMarkers, setCoinMarkers] = useState([]);
  
  // Vehicle data
  const vehicles = [
    { id: 1, type: 'taxi', name: 'Taxi Driver', lat: 42.6629, lng: 21.1655, driver: 'Max M.', price: 50, eta: '3 min' },
    { id: 2, type: 'taxi', name: 'Taxi Nearby', lat: 42.6650, lng: 21.1700, driver: 'Anna K.', price: 50, eta: '5 min' },
    { id: 3, type: 'taxi', name: 'Premium Taxi', lat: 42.6610, lng: 21.1620, driver: 'Tom B.', price: 80, eta: '4 min' },
    { id: 4, type: 'scooter', name: 'Scooter SC001', lat: 42.6600, lng: 21.1600, battery: 85, price: 5 },
    { id: 5, type: 'scooter', name: 'Scooter SC002', lat: 42.6580, lng: 21.1680, battery: 62, price: 5 },
    { id: 6, type: 'scooter', name: 'Scooter SC003', lat: 42.6640, lng: 21.1750, battery: 91, price: 5 },
  ];

  // Coin locations for Coin Hunt
  const [coins, setCoins] = useState([
    { id: 'c1', lat: 42.6635, lng: 21.1648, value: 10, collected: false },
    { id: 'c2', lat: 42.6618, lng: 21.1670, value: 20, collected: false },
    { id: 'c3', lat: 42.6642, lng: 21.1662, value: 50, collected: false },
    { id: 'c4', lat: 42.6590, lng: 21.1630, value: 15, collected: false },
    { id: 'c5', lat: 42.6660, lng: 21.1720, value: 30, collected: false },
    { id: 'c6', lat: 42.6605, lng: 21.1590, value: 25, collected: false },
    { id: 'c7', lat: 42.6670, lng: 21.1680, value: 100, collected: false },
  ]);
  
  useEffect(() => {
    loadLeaflet();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
    };
  }, []);
  
  useEffect(() => {
    if (mapInstanceRef.current && window.L) {
      updateMarkers();
    }
  }, [filter, coins]);
  
  const loadLeaflet = () => {
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet/dist/leaflet.css';
      document.head.appendChild(link);
    }
    
    if (window.L) {
      initMap();
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet/dist/leaflet.js';
      script.onload = initMap;
      document.head.appendChild(script);
    }
  };
  
  const initMap = () => {
    if (!mapRef.current || mapInstanceRef.current) return;
    
    const L = window.L;
    
    mapInstanceRef.current = L.map(mapRef.current).setView([42.6629, 21.1655], 14);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(mapInstanceRef.current);
    
    updateMarkers();
  };
  
  const updateMarkers = () => {
    if (!mapInstanceRef.current || !window.L) return;
    
    const L = window.L;
    const map = mapInstanceRef.current;
    
    // Clear existing markers
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current = [];
    
    // Add vehicle markers if not filtering only coins
    if (filter !== 'coins') {
      const filteredVehicles = filter === 'all' 
        ? vehicles 
        : vehicles.filter(v => v.type === filter);
      
      filteredVehicles.forEach((vehicle) => {
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            background: ${vehicle.type === 'taxi' ? '#fbbf24' : '#22d3ee'};
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            border: 3px solid white;
          ">${vehicle.type === 'taxi' ? '🚕' : '🛴'}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });
        
        const marker = L.marker([vehicle.lat, vehicle.lng], { icon }).addTo(map);
        marker.on('click', () => setSelectedVehicle(vehicle));
        markersRef.current.push(marker);
      });
    }
    
    // Add coin markers if showing all or coins filter
    if (filter === 'all' || filter === 'coins') {
      coins.filter(c => !c.collected).forEach((coin) => {
        const coinIcon = L.divIcon({
          className: 'coin-marker',
          html: `<div style="
            background: linear-gradient(135deg, #fbbf24, #f59e0b);
            width: ${coin.value >= 50 ? '44px' : '36px'};
            height: ${coin.value >= 50 ? '44px' : '36px'};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${coin.value >= 50 ? '20px' : '16px'};
            box-shadow: 0 4px 15px rgba(251, 191, 36, 0.5);
            border: 3px solid #fef3c7;
            animation: pulse 2s infinite;
            cursor: pointer;
          ">💰</div>
          <div style="
            position: absolute;
            bottom: -20px;
            left: 50%;
            transform: translateX(-50%);
            background: #1c213f;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            color: #fbbf24;
            font-weight: bold;
            white-space: nowrap;
          ">+${coin.value}</div>`,
          iconSize: [44, 60],
          iconAnchor: [22, 22]
        });
        
        const marker = L.marker([coin.lat, coin.lng], { icon: coinIcon }).addTo(map);
        marker.on('click', () => collectCoin(coin));
        markersRef.current.push(marker);
      });
    }
  };

  const collectCoin = async (coin) => {
    if (coin.collected) return;
    
    // Update local state
    setCoins(prev => prev.map(c => 
      c.id === coin.id ? { ...c, collected: true } : c
    ));
    setCollectedCoins(prev => prev + coin.value);
    setTotalCoinsFound(prev => prev + 1);
    
    // Try to update backend
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/app/coins/collect`, { 
        coin_id: coin.id, 
        value: coin.value 
      }, { headers });
    } catch (error) {
      console.log('Coin collect API error - local only');
    }
    
    // Show success animation/toast
    setSelectedVehicle(null);
  };
  
  const bookVehicle = () => {
    if (selectedVehicle?.type === 'taxi') {
      navigate('/taxi');
    } else {
      navigate('/scooter');
    }
  };

  const availableCoins = coins.filter(c => !c.collected);
  const totalAvailableValue = availableCoins.reduce((sum, c) => sum + c.value, 0);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0e24] via-[#0f1332] to-[#0b0e24] text-white pb-24">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Live Map</h2>
          <p className="text-xs text-slate-400">Transport & Coin Hunt</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/30">
            <span className="text-amber-400 font-bold">{collectedCoins} 💰</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div 
        ref={mapRef} 
        className="w-full relative"
        style={{ height: '350px' }}
        data-testid="map-container"
      />
      
      {/* Collected Coins Toast */}
      {collectedCoins > 0 && (
        <div className="mx-4 -mt-4 relative z-10">
          <div className="bg-gradient-to-r from-amber-500/30 to-yellow-500/20 p-3 rounded-xl border border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎉</span>
              <div>
                <p className="text-sm font-medium">Coins gesammelt!</p>
                <p className="text-xs text-slate-400">{totalCoinsFound} Coins gefunden</p>
              </div>
            </div>
            <p className="text-xl font-bold text-amber-400">+{collectedCoins}</p>
          </div>
        </div>
      )}
      
      {/* Filter Buttons */}
      <div className="p-4 flex gap-2 overflow-x-auto">
        {[
          { id: 'all', label: 'Alle', icon: '🗺️', color: 'bg-[#6c63ff]' },
          { id: 'coins', label: 'Coins', icon: '💰', color: 'bg-amber-500' },
          { id: 'taxi', label: 'Taxis', icon: '🚕', color: 'bg-yellow-500' },
          { id: 'scooter', label: 'Scooter', icon: '🛴', color: 'bg-cyan-500' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id); setSelectedVehicle(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
              filter === f.id ? f.color + ' text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
            data-testid={`filter-${f.id}`}
          >
            <span>{f.icon}</span>
            {f.label}
          </button>
        ))}
      </div>

      {/* Coin Hunt Info */}
      {(filter === 'all' || filter === 'coins') && (
        <div className="px-4 mb-4">
          <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/5 p-4 rounded-2xl border border-amber-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                <h3 className="font-semibold">Coin Hunt</h3>
              </div>
              <span className="text-xs text-slate-400">
                {availableCoins.length} Coins verfügbar
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-black/20 p-2 rounded-xl">
                <p className="text-lg font-bold text-amber-400">{availableCoins.length}</p>
                <p className="text-[10px] text-slate-500">Verfügbar</p>
              </div>
              <div className="bg-black/20 p-2 rounded-xl">
                <p className="text-lg font-bold text-green-400">{totalCoinsFound}</p>
                <p className="text-[10px] text-slate-500">Gefunden</p>
              </div>
              <div className="bg-black/20 p-2 rounded-xl">
                <p className="text-lg font-bold text-yellow-400">{totalAvailableValue}</p>
                <p className="text-[10px] text-slate-500">Wert</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 text-center">
              Tippe auf 💰 Marker um Coins zu sammeln!
            </p>
          </div>
        </div>
      )}
      
      {/* Vehicle Info */}
      <div className="px-4">
        {selectedVehicle ? (
          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {selectedVehicle.type === 'taxi' ? '🚕' : '🛴'}
                </span>
                <div>
                  <p className="font-semibold">{selectedVehicle.name}</p>
                  {selectedVehicle.type === 'taxi' ? (
                    <p className="text-sm text-slate-400">Fahrer: {selectedVehicle.driver}</p>
                  ) : (
                    <p className="text-sm text-slate-400">Batterie: {selectedVehicle.battery}%</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-amber-400 font-bold">{selectedVehicle.price} 💰</p>
                {selectedVehicle.eta && (
                  <p className="text-xs text-green-400">{selectedVehicle.eta}</p>
                )}
              </div>
            </div>
            
            <button
              onClick={bookVehicle}
              className="w-full py-3 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-semibold transition-all"
              data-testid="book-vehicle-btn"
            >
              {selectedVehicle.type === 'taxi' ? '🚕 Taxi buchen' : '🛴 Scooter mieten'}
            </button>
          </div>
        ) : filter !== 'coins' && (
          <div className="bg-white/5 p-4 rounded-2xl text-center text-slate-400 border border-white/5">
            <p>Wähle ein Fahrzeug auf der Karte</p>
          </div>
        )}
        
        {/* Quick Stats */}
        {filter !== 'coins' && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Link to="/taxi" className="bg-white/5 p-3 rounded-xl text-center border border-white/5 hover:bg-white/10 transition-all">
              <p className="text-2xl">🚕</p>
              <p className="text-sm text-slate-400">Taxis</p>
              <p className="text-xl font-bold text-amber-400">
                {vehicles.filter(v => v.type === 'taxi').length}
              </p>
            </Link>
            <Link to="/scooter" className="bg-white/5 p-3 rounded-xl text-center border border-white/5 hover:bg-white/10 transition-all">
              <p className="text-2xl">🛴</p>
              <p className="text-sm text-slate-400">Scooter</p>
              <p className="text-xl font-bold text-cyan-400">
                {vehicles.filter(v => v.type === 'scooter').length}
              </p>
            </Link>
          </div>
        )}
      </div>
      
      <BottomNav />

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
