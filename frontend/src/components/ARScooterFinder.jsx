import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Zap, Battery, Navigation } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ARScooterFinder({ scooters = [], onSelectScooter }) {
  const [arMode, setArMode] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [deviceOrientation, setDeviceOrientation] = useState({ alpha: 0, beta: 0, gamma: 0 });
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (arMode) {
      startAR();
    } else {
      stopAR();
    }
    return () => stopAR();
  }, [arMode]);

  useEffect(() => {
    if (arMode && 'DeviceOrientationEvent' in window) {
      const handleOrientation = (event) => {
        setDeviceOrientation({
          alpha: event.alpha || 0,
          beta: event.beta || 0,
          gamma: event.gamma || 0,
        });
      };

      // Request permission for iOS 13+
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(permission => {
            if (permission === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation);
            }
          });
      } else {
        window.addEventListener('deviceorientation', handleOrientation);
      }

      return () => window.removeEventListener('deviceorientation', handleOrientation);
    }
  }, [arMode]);

  const startAR = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraPermission(true);
      }

      // Get user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          }
        );
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      setCameraPermission(false);
      setArMode(false);
    }
  };

  const stopAR = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const calculateDistance = (scooter) => {
    if (!userLocation) return null;
    
    const R = 6371e3; // Earth radius in meters
    const φ1 = userLocation.lat * Math.PI / 180;
    const φ2 = scooter.lat * Math.PI / 180;
    const Δφ = (scooter.lat - userLocation.lat) * Math.PI / 180;
    const Δλ = (scooter.lng - userLocation.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return Math.round(R * c); // Distance in meters
  };

  const calculateBearing = (scooter) => {
    if (!userLocation) return 0;
    
    const φ1 = userLocation.lat * Math.PI / 180;
    const φ2 = scooter.lat * Math.PI / 180;
    const Δλ = (scooter.lng - userLocation.lng) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    
    return (θ * 180 / Math.PI + 360) % 360; // Bearing in degrees
  };

  const isScooterInView = (scooter) => {
    const bearing = calculateBearing(scooter);
    const deviceBearing = deviceOrientation.alpha;
    const tolerance = 30; // degrees
    
    return Math.abs(bearing - deviceBearing) < tolerance || 
           Math.abs(bearing - deviceBearing) > (360 - tolerance);
  };

  const getScooterScreenPosition = (scooter) => {
    if (!userLocation) return null;
    
    const bearing = calculateBearing(scooter);
    const deviceBearing = deviceOrientation.alpha;
    const distance = calculateDistance(scooter);
    
    if (distance > 100) return null; // Only show scooters within 100m
    
    // Calculate relative angle
    let relativeAngle = bearing - deviceBearing;
    if (relativeAngle > 180) relativeAngle -= 360;
    if (relativeAngle < -180) relativeAngle += 360;
    
    // Map angle to screen position (-30 to +30 degrees = 0% to 100% screen width)
    const screenX = 50 + (relativeAngle / 60) * 100;
    
    // Map distance to screen Y position (closer = lower on screen)
    const screenY = 40 + (distance / 100) * 40;
    
    if (screenX < 0 || screenX > 100) return null;
    
    return { x: screenX, y: screenY, distance };
  };

  return (
    <>
      {/* AR Toggle Button */}
      {!arMode && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setArMode(true)}
          className="fixed top-20 right-6 z-40 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white font-bold shadow-2xl flex items-center gap-2"
        >
          <Camera size={20} />
          AR Finder
        </motion.button>
      )}

      {/* AR View */}
      <AnimatePresence>
        {arMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black"
          >
            {/* Camera Feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            {/* AR Overlay Canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* AR Markers for Scooters */}
            {cameraPermission && userLocation && scooters.map((scooter) => {
              const pos = getScooterScreenPosition(scooter);
              if (!pos) return null;

              return (
                <motion.div
                  key={scooter.scooter_id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{
                    position: 'absolute',
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onClick={() => {
                    onSelectScooter?.(scooter);
                    setArMode(false);
                  }}
                  className="cursor-pointer"
                >
                  {/* AR Marker */}
                  <div className="relative">
                    {/* Pulsing circle */}
                    <motion.div
                      animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute inset-0 w-20 h-20 rounded-full bg-[#00C2FF]/30"
                      style={{ transform: 'translate(-25%, -25%)' }}
                    />
                    
                    {/* Scooter Icon */}
                    <div className="w-12 h-12 rounded-full bg-[#00C2FF] border-4 border-white shadow-2xl flex items-center justify-center">
                      <Zap size={24} className="text-white" />
                    </div>
                    
                    {/* Info Card */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-14 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm rounded-xl p-3 min-w-[140px] border border-[#00C2FF]/30"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Battery 
                          size={16} 
                          className={`${
                            scooter.battery >= 60 ? 'text-green-400' : 
                            scooter.battery >= 30 ? 'text-yellow-400' : 
                            'text-red-400'
                          }`} 
                        />
                        <span className="text-white text-sm font-bold">{scooter.battery}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Navigation size={14} className="text-gray-400" />
                        <span className="text-gray-300 text-xs">{pos.distance}m away</span>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}

            {/* Controls */}
            <div className="absolute top-6 left-0 right-0 z-10 px-6 flex items-center justify-between">
              <div className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 text-white text-sm">
                📡 {scooters.filter(s => getScooterScreenPosition(s)).length} Scooters nearby
              </div>
              
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setArMode(false)}
                className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center"
              >
                <X size={20} className="text-white" />
              </motion.button>
            </div>

            {/* Instructions */}
            <div className="absolute bottom-6 left-0 right-0 z-10 px-6">
              <div className="bg-black/60 backdrop-blur-sm rounded-2xl p-4 text-center">
                <p className="text-white font-medium mb-1">🔍 Scan your surroundings</p>
                <p className="text-gray-300 text-sm">Point camera to find scooters</p>
              </div>
            </div>

            {/* Permission Denied */}
            {!cameraPermission && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="bg-[#0B0B0F] rounded-3xl p-6 text-center max-w-sm">
                  <Camera size={48} className="text-gray-500 mx-auto mb-4" />
                  <h3 className="text-white text-xl font-bold mb-2">Camera Access Required</h3>
                  <p className="text-gray-400 mb-4">
                    Enable camera access to use AR Scooter Finder
                  </p>
                  <button
                    onClick={() => setArMode(false)}
                    className="px-6 py-3 bg-[#00C2FF] text-white rounded-full font-bold"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
