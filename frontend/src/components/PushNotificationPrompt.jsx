/**
 * Push Notification Manager - Auto-subscribes users after permission grant
 * Shows a prompt banner on first visit, handles VAPID subscription
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Bell, X, Check } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function PushNotificationPrompt() {
  const { token, isAuthenticated } = useAuth();
  const [show, setShow] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (Notification.permission === 'granted') {
      // Already granted - auto-subscribe silently
      autoSubscribe();
      return;
    }
    if (Notification.permission === 'denied') return;
    // Check if we already asked (stored in localStorage)
    const asked = localStorage.getItem('push_asked');
    if (!asked) {
      // Show prompt after 3 seconds
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated]);

  const autoSubscribe = async () => {
    try {
      const vapidRes = await axios.get(`${API}/push/vapid-key`);
      const vapidKey = vapidRes.data.public_key;
      if (!vapidKey) return;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
      }

      // Send to backend
      await axios.post(`${API}/push/subscribe`, {
        subscription: subscription.toJSON()
      }, { headers: { Authorization: `Bearer ${token}` } });

      console.log('Push subscription active');
    } catch (e) {
      console.log('Push subscribe error:', e.message);
    }
  };

  const handleAllow = async () => {
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await autoSubscribe();
      }
    } catch (e) {
      console.error('Push error:', e);
    } finally {
      localStorage.setItem('push_asked', 'true');
      setShow(false);
      setSubscribing(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('push_asked', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] max-w-md mx-auto animate-in slide-in-from-bottom" data-testid="push-prompt">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-800 text-sm">Benachrichtigungen aktivieren?</h3>
            <p className="text-xs text-slate-500 mt-0.5">Erhalte Updates zu Auktionen, Fahrten und Angeboten</p>
          </div>
          <button onClick={handleDismiss} className="p-1 hover:bg-slate-100 rounded-full flex-shrink-0">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={handleDismiss} className="flex-1 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-xl">
            Nicht jetzt
          </button>
          <button onClick={handleAllow} disabled={subscribing}
            className="flex-1 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-1 disabled:opacity-50">
            {subscribing ? '...' : <><Check className="w-4 h-4" /> Aktivieren</>}
          </button>
        </div>
      </div>
    </div>
  );
}
