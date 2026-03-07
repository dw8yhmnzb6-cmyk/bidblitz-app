/**
 * BidBlitz Ride Tracking
 * Live tracking of taxi/scooter ride on map
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNav from '../components/BottomNav';

export default function AppRideTracking() {
  const navigate = useNavigate();
  const location = useLocation();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  
  const [rideInfo, setRideInfo] = useState(null);
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState(5);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [rideComplete, setRideComplete] = useState(false);
  
  // Route coordinates (simulated)
  const routeCoords = [
    [42.6629, 21.1655],
    [42.6640, 21.1680],
    [42.6650, 21.1700],
    [42.6660, 21.1720],
    [42.6670, 21.1740],
  ];
  
  useEffect(() => {
    // Get ride info from navigation state or use default
    const info = location.state?.rideInfo || {
      type: 'taxi',
      driver: 'Max M.',
      vehicle: 'BMW 3er',
      plate: 'B-TX 123',
      pickup: 'Alexanderplatz',
      destination: 'Hauptbahnhof',
      price: 50
    };
    setRideInfo(info);
    
    loadLeaflet();
    
    // Simulate ride progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setShowRating(true);
          setRideComplete(true);
          return 100;
        }
        setEta(Math.max(0, Math.ceil((100 - prev) / 20)));
        return prev + 2;
      });
    }, 1000);
    
    return () => {
      clearInterval(interval);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
    };
  }, []);
  
  useEffect(() => {
    if (mapInstanceRef.current && window.L && markerRef.current) {
      // Update marker position based on progress
      const index = Math.min(
        Math.floor((progress / 100) * (routeCoords.length - 1)),
        routeCoords.length - 1
      );
      markerRef.current.setLatLng(routeCoords[index]);
      mapInstanceRef.current.panTo(routeCoords[index]);
    }
  }, [progress]);
  
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
    
    mapInstanceRef.current = L.map(mapRef.current).setView(routeCoords[0], 15);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(mapInstanceRef.current);
    
    // Draw route line
    L.polyline(routeCoords, {
      color: '#6c63ff',
      weight: 4,
      opacity: 0.8
    }).addTo(mapInstanceRef.current);
    
    // Start marker
    L.marker(routeCoords[0], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div style="background:#22c55e;width:16px;height:16px;border-radius:50%;border:3px solid white;"></div>',
        iconSize: [16, 16]
      })
    }).addTo(mapInstanceRef.current);
    
    // End marker
    L.marker(routeCoords[routeCoords.length - 1], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div style="background:#ef4444;width:16px;height:16px;border-radius:50%;border:3px solid white;"></div>',
        iconSize: [16, 16]
      })
    }).addTo(mapInstanceRef.current);
    
    // Moving vehicle marker
    markerRef.current = L.marker(routeCoords[0], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div style="background:#fbbf24;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.4);">🚕</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      })
    }).addTo(mapInstanceRef.current);
  };
  
  const submitRating = async () => {
    // Save rating
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/app/rating/submit`, {
        driver: rideInfo?.driver,
        rating: rating
      }, { headers });
    } catch (error) {
      console.log('Rating error');
    }
    
    navigate('/super-app');
  };
  
  return (
    <div className="min-h-screen bg-[#0b0e24] text-white pb-20">
      {/* Map */}
      <div 
        ref={mapRef}
        className="w-full"
        style={{ height: '300px' }}
      />
      
      <div className="p-5">
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-400">Fahrt</span>
            <span className="text-amber-400">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-amber-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        {/* Driver Info */}
        {rideInfo && (
          <div className="bg-[#171a3a] p-4 rounded-2xl mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-2xl">
                👤
              </div>
              <div className="flex-1">
                <p className="font-semibold">{rideInfo.driver}</p>
                <p className="text-sm text-slate-400">{rideInfo.vehicle} • {rideInfo.plate}</p>
              </div>
              <div className="text-right">
                {!rideComplete ? (
                  <>
                    <p className="text-green-400 font-bold">{eta} min</p>
                    <p className="text-xs text-slate-400">ETA</p>
                  </>
                ) : (
                  <p className="text-green-400 font-bold">✓ Arrived</p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Route Info */}
        <div className="bg-[#171a3a] p-4 rounded-2xl mb-4">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              <div className="w-0.5 h-8 bg-slate-600"></div>
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
            </div>
            <div className="flex-1">
              <p className="text-sm">{rideInfo?.pickup || 'Pickup'}</p>
              <div className="h-8"></div>
              <p className="text-sm">{rideInfo?.destination || 'Destination'}</p>
            </div>
            <div className="text-right">
              <p className="text-amber-400 font-bold">{rideInfo?.price || 50} 💰</p>
            </div>
          </div>
        </div>
        
        {/* Rating Modal */}
        {showRating && (
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-900/20 border border-purple-500/30 p-5 rounded-2xl">
            <h3 className="text-center font-semibold mb-4">⭐ Bewerte deine Fahrt</h3>
            
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`text-3xl transition-transform hover:scale-110 ${
                    rating >= star ? 'text-amber-400' : 'text-slate-600'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            
            <p className="text-center text-sm text-slate-400 mb-4">
              {rating === 0 && 'Tippe auf die Sterne'}
              {rating === 1 && 'Sehr schlecht'}
              {rating === 2 && 'Schlecht'}
              {rating === 3 && 'Okay'}
              {rating === 4 && 'Gut'}
              {rating === 5 && 'Ausgezeichnet!'}
            </p>
            
            <button
              onClick={submitRating}
              disabled={rating === 0}
              className="w-full py-3 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-semibold disabled:opacity-50"
            >
              {rating > 0 ? 'Bewertung abgeben' : 'Überspringen'}
            </button>
          </div>
        )}
        
        {/* Cancel Button (only if not complete) */}
        {!rideComplete && (
          <button
            onClick={() => navigate('/taxi')}
            className="w-full mt-4 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-xl"
          >
            Fahrt abbrechen
          </button>
        )}
      </div>
      
      <BottomNav />
    </div>
  );
}

// Import axios at the top level
const axios = require('axios').default || { post: () => Promise.resolve() };
const API = process.env.REACT_APP_BACKEND_URL + '/api';
