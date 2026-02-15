// Push Notification Utilities for bidblitz.ae

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Check if push notifications are supported
 */
export const isPushSupported = () => {
  return 'serviceWorker' in navigator && 
         'PushManager' in window && 
         'Notification' in window;
};

/**
 * Get current notification permission status
 */
export const getNotificationPermission = () => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission; // 'default', 'granted', 'denied'
};

/**
 * Request notification permission
 */
export const requestNotificationPermission = async () => {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported');
  }
  
  const permission = await Notification.requestPermission();
  return permission;
};

/**
 * Register the service worker
 */
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker not supported');
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    
    console.log('[Push] Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[Push] Service Worker registration failed:', error);
    throw error;
  }
};

/**
 * Get VAPID public key from server
 */
export const getVapidPublicKey = async () => {
  try {
    const response = await fetch(`${API}/notifications/vapid-public-key`);
    if (!response.ok) throw new Error('Failed to get VAPID key');
    const data = await response.json();
    return data.publicKey;
  } catch (error) {
    console.error('[Push] Failed to get VAPID key:', error);
    throw error;
  }
};

/**
 * Convert VAPID key to Uint8Array
 */
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

/**
 * Subscribe to push notifications
 */
export const subscribeToPush = async (token) => {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported');
  }
  
  // Request permission first
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }
  
  // Register service worker
  const registration = await registerServiceWorker();
  
  // Wait for service worker to be ready
  await navigator.serviceWorker.ready;
  
  // Get VAPID public key
  const vapidPublicKey = await getVapidPublicKey();
  const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
  
  // Subscribe to push
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey
  });
  
  console.log('[Push] Subscription:', JSON.stringify(subscription));
  
  // Send subscription to server
  const response = await fetch(`${API}/notifications/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(subscription.toJSON())
  });
  
  if (!response.ok) {
    throw new Error('Failed to save subscription on server');
  }
  
  return subscription;
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribeFromPush = async (token) => {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  
  if (subscription) {
    // Unsubscribe locally
    await subscription.unsubscribe();
    
    // Remove from server
    await fetch(`${API}/notifications/unsubscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }
  
  return true;
};

/**
 * Check if already subscribed
 */
export const isSubscribed = async () => {
  if (!isPushSupported()) return false;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
};

/**
 * Send a test push notification
 */
export const sendTestPush = async (token) => {
  const response = await fetch(`${API}/notifications/test-push`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to send test push');
  }
  
  return await response.json();
};

export default {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribed,
  sendTestPush
};
