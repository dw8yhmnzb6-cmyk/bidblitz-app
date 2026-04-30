import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { toast } from 'sonner';

// Firebase Config (Replace with your actual config)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "demo-api-key",
  authDomain: "bidblitz-demo.firebaseapp.com",
  projectId: "bidblitz-demo",
  storageBucket: "bidblitz-demo.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456",
};

let messaging = null;
let isInitialized = false;

/**
 * Initialize Firebase Cloud Messaging
 */
export const initializeFCM = () => {
  if (isInitialized) return;
  
  try {
    const app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
    isInitialized = true;
    console.log('✅ Firebase FCM initialized');
  } catch (error) {
    console.error('❌ Firebase FCM initialization failed:', error);
  }
};

/**
 * Request notification permission & get FCM token
 */
export const requestNotificationPermission = async () => {
  if (!messaging) {
    initializeFCM();
  }

  if (!messaging) {
    console.error('Messaging not initialized');
    return null;
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('✅ Notification permission granted');
      
      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY || 'DEMO_VAPID_KEY'
      });
      
      console.log('FCM Token:', token);
      
      // Send token to backend
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/push/subscribe`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      
      toast.success('Push-Benachrichtigungen aktiviert!');
      return token;
    } else {
      console.log('❌ Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

/**
 * Listen to foreground messages
 */
export const onForegroundMessage = (callback) => {
  if (!messaging) return;
  
  onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    
    // Show toast notification
    toast(payload.notification?.title || 'BidBlitz', {
      description: payload.notification?.body,
      action: payload.data?.url ? {
        label: 'Öffnen',
        onClick: () => window.location.href = payload.data.url
      } : undefined
    });
    
    // Call custom callback
    if (callback) callback(payload);
  });
};

/**
 * Check if notifications are supported
 */
export const isNotificationSupported = () => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

/**
 * Get current notification permission status
 */
export const getNotificationPermission = () => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};
