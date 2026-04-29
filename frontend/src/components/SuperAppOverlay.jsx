import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Crown, MessageCircle } from 'lucide-react';
import SafetyButton from './SafetyButton';
import VoiceCommands from './VoiceCommands';
import LoyaltyDashboard from './LoyaltyDashboard';
import SubscriptionPlans from './SubscriptionPlans';
import LiveChat from './LiveChat';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * SuperAppOverlay (Uber/Bolt/Lieferando-Style — kontextabhängig)
 * - SafetyButton nur sichtbar während aktiver Taxi/Scooter-Fahrt
 * - LiveChat Floating-Button mit Unread-Badge (rot) wenn neue Nachrichten
 * - VoiceCommands (immer auf Super-App-Routes)
 * - Loyalty + Subscriptions Quick-Access (immer)
 */
export default function SuperAppOverlay({ currentPath, onNavigate, isAuthenticated }) {
  const [showLoyalty, setShowLoyalty] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [activeRideId, setActiveRideId] = useState(null);
  const [activeRideType, setActiveRideType] = useState(null); // 'taxi' | 'scooter'
  const [unreadChats, setUnreadChats] = useState(0);

  const isOnSuperApp = ['/taxi', '/scooter', '/food'].some(p => currentPath?.startsWith(p));

  // Poll for active ride + unread chat count
  const pollContext = useCallback(async () => {
    if (!isAuthenticated || !isOnSuperApp) return;
    try {
      // Active taxi ride
      const rTaxi = await fetch(`${API}/api/taxi/rides/active`, { credentials: 'include' });
      if (rTaxi.ok) {
        const d = await rTaxi.json();
        if (d.has_active && d.rides?.length) {
          setActiveRideId(d.rides[0].ride_id);
          setActiveRideType('taxi');
        } else {
          // Active scooter rental
          const rSc = await fetch(`${API}/api/scooter/active`, { credentials: 'include' });
          if (rSc.ok) {
            const sd = await rSc.json();
            const rental = sd.rental || sd.active_rental || sd.rides?.[0];
            if (rental && (rental.rental_id || rental.ride_id)) {
              setActiveRideId(rental.rental_id || rental.ride_id);
              setActiveRideType('scooter');
            } else {
              setActiveRideId(null);
              setActiveRideType(null);
            }
          } else {
            setActiveRideId(null);
            setActiveRideType(null);
          }
        }
      }
    } catch {}

    try {
      const r = await fetch(`${API}/api/chat/unread-count`, { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        setUnreadChats(d.unread_count || 0);
      }
    } catch {}
  }, [isAuthenticated, isOnSuperApp]);

  useEffect(() => {
    if (!isAuthenticated || !isOnSuperApp) return;
    pollContext();
    const t = setInterval(pollContext, 15000);
    return () => clearInterval(t);
  }, [isAuthenticated, isOnSuperApp, pollContext]);

  if (!isAuthenticated || !isOnSuperApp) return null;

  const handleVoiceCommand = (cmd) => {
    if (!cmd) return;
    switch (cmd.action) {
      case 'book_taxi': onNavigate('/taxi'); break;
      case 'open_food': onNavigate('/food'); break;
      case 'search_food':
        onNavigate(`/food?q=${encodeURIComponent(cmd.query || '')}`);
        break;
      case 'open_scooter': onNavigate('/scooter'); break;
      case 'open_wallet': onNavigate('/wallet'); break;
      case 'go_back': window.history.back(); break;
      default: break;
    }
  };

  const hasActiveRide = !!activeRideId;

  return (
    <>
      {/* Voice Commands (Mic-Button, immer) */}
      <VoiceCommands onCommand={handleVoiceCommand} />

      {/* Safety Button — NUR während aktiver Taxi/Scooter-Fahrt */}
      {hasActiveRide && activeRideType !== 'food' && (
        <SafetyButton rideId={activeRideId} type={activeRideType} />
      )}

      {/* Live-Chat Floating-Button — sichtbar wenn aktive Fahrt ODER ungelesene Nachrichten */}
      {(hasActiveRide || unreadChats > 0) && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowChat(true)}
          data-testid="superapp-livechat-btn"
          className="fixed bottom-[10.5rem] right-6 z-40 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 shadow-xl flex items-center justify-center"
          title="Chat"
        >
          <MessageCircle size={18} className="text-white" />
          {unreadChats > 0 && (
            <span
              data-testid="superapp-livechat-badge"
              className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
            >
              {unreadChats > 9 ? '9+' : unreadChats}
            </span>
          )}
        </motion.button>
      )}

      {/* Loyalty Quick-Access (Trophy) */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowLoyalty(true)}
        data-testid="superapp-loyalty-btn"
        className="fixed bottom-44 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-2xl flex items-center justify-center"
        title="Loyalty"
      >
        <Trophy size={22} className="text-white" />
      </motion.button>

      {/* Subscriptions Quick-Access (Crown) */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowPlans(true)}
        data-testid="superapp-plans-btn"
        className="fixed bottom-[14.5rem] right-6 z-40 w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 shadow-xl flex items-center justify-center"
        title="Abos"
      >
        <Crown size={18} className="text-white" />
      </motion.button>

      {/* Loyalty Modal */}
      <AnimatePresence>
        {showLoyalty && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10010] bg-black/80 backdrop-blur-sm overflow-y-auto"
            onClick={() => setShowLoyalty(false)}
            data-testid="superapp-loyalty-modal"
          >
            <div onClick={e => e.stopPropagation()} className="min-h-screen">
              <LoyaltyDashboard onClose={() => setShowLoyalty(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subscriptions Modal */}
      <AnimatePresence>
        {showPlans && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10010] bg-black/80 backdrop-blur-sm overflow-y-auto"
            onClick={() => setShowPlans(false)}
            data-testid="superapp-plans-modal"
          >
            <div onClick={e => e.stopPropagation()} className="min-h-screen">
              <SubscriptionPlans onClose={() => setShowPlans(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live-Chat Modal */}
      <AnimatePresence>
        {showChat && activeRideId && (
          <LiveChat
            rideId={activeRideId}
            userRole="passenger"
            onClose={() => { setShowChat(false); setUnreadChats(0); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
