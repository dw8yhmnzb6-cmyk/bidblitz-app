import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { requestNotificationPermission, getNotificationPermission, onForegroundMessage } from '../services/fcm';

/**
 * PushNotificationPrompt — Ask user for push permission
 * Shows after login or on first app load
 */
export default function PushNotificationPrompt() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if we should show prompt
    const permission = getNotificationPermission();
    const hasAsked = localStorage.getItem('push_permission_asked');
    
    if (permission === 'default' && !hasAsked) {
      // Show after 3 seconds
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
    
    // If already granted, setup listener
    if (permission === 'granted') {
      onForegroundMessage((payload) => {
        console.log('Push received:', payload);
      });
    }
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    
    try {
      await requestNotificationPermission();
      localStorage.setItem('push_permission_asked', 'true');
      setShow(false);
    } catch (error) {
      console.error('Push permission error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('push_permission_asked', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-24 left-4 right-4 z-[80] max-w-sm mx-auto"
      >
        <div className="bg-gradient-to-br from-cyan-500/20 to-purple-500/20 backdrop-blur-xl border-2 border-cyan-500/30 rounded-2xl p-5 shadow-2xl">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X size={14} className="text-white/60" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-cyan-500/30 flex items-center justify-center flex-shrink-0">
              <Bell size={20} className="text-cyan-300" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-base mb-1">
                Benachrichtigungen aktivieren?
              </h3>
              <p className="text-white/70 text-xs mb-4 leading-relaxed">
                Erhalte Updates zu deinen Bestellungen, Fahrer-Status und Auktions-Gewinnen
              </p>

              <div className="flex gap-2">
                <button
                  onClick={handleEnable}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl text-white font-bold text-sm disabled:opacity-50 hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                >
                  {loading ? 'Lädt...' : 'Aktivieren'}
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2.5 bg-white/10 rounded-xl text-white/60 text-sm font-medium hover:bg-white/20 transition-colors"
                >
                  Später
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
