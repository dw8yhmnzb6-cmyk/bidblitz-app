// Device Tracking Hook - tracks user device info for analytics
import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

function detectDevice() {
  const ua = navigator.userAgent;
  const width = window.innerWidth;
  
  // Detect device type
  let deviceType = 'desktop';
  if (/Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    deviceType = width > 768 ? 'tablet' : 'mobile';
  } else if (/iPad|Tablet/i.test(ua) || (width >= 768 && width <= 1024)) {
    deviceType = 'tablet';
  }
  
  // Detect OS
  let os = 'Unknown';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iOS|iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  
  // Detect Browser
  let browser = 'Unknown';
  if (/Chrome/i.test(ua) && !/Edge|Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Edge|Edg/i.test(ua)) browser = 'Edge';
  else if (/Opera|OPR/i.test(ua)) browser = 'Opera';
  else if (/MSIE|Trident/i.test(ua)) browser = 'IE';
  
  return {
    device_type: deviceType,
    os,
    browser,
    screen_width: window.innerWidth,
    screen_height: window.innerHeight,
    is_touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    user_agent: ua.substring(0, 200) // Truncate to avoid too long strings
  };
}

export function useDeviceTracking() {
  const { token, isAuthenticated } = useAuth();
  const hasTracked = useRef(false);
  
  useEffect(() => {
    // Only track once per session
    if (hasTracked.current) return;
    
    const trackDevice = async () => {
      try {
        const deviceInfo = detectDevice();
        
        const headers = {
          'Content-Type': 'application/json'
        };
        
        // Add auth header if available
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        await fetch(`${API}/api/analytics/track-device`, {
          method: 'POST',
          headers,
          body: JSON.stringify(deviceInfo)
        });
        
        hasTracked.current = true;
      } catch (error) {
        console.error('Device tracking error:', error);
      }
    };
    
    // Small delay to ensure app is loaded
    const timeout = setTimeout(trackDevice, 2000);
    
    return () => clearTimeout(timeout);
  }, [token, isAuthenticated]);
}

export default useDeviceTracking;
