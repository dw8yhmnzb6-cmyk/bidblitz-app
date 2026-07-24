import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Crown, MessageCircle, Plus, X, Mic } from 'lucide-react';
import SafetyButton from './SafetyButton';
import VoiceCommands from './VoiceCommands';
import LoyaltyDashboard from './LoyaltyDashboard';
import SubscriptionPlans from './SubscriptionPlans';
import LiveChat from './LiveChat';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * SuperAppOverlay — Konsolidierter FAB-Hub (1 expandierbarer Button).
 * Reduziert die UI-Verwirrung: vorher 6+ stacked FABs, jetzt 1 Hub.
 */
export default function SuperAppOverlay({ currentPath, onNavigate, isAuthenticated }) {
  const [showLoyalty, setShowLoyalty] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [activeRideId, setActiveRideId] = useState(null);
  const [activeRideType, setActiveRideType] = useState(null);
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
      {/* SafetyButton bleibt direkt sichtbar während Fahrt (Notfall-relevant) */}
      {hasActiveRide && activeRideType !== 'food' && (
        <SafetyButton rideId={activeRideId} type={activeRideType} />
      )}

      {/* Hub-FAB — bündelt Voice, Trophy, Crown, Chat in 1 Button */}
      <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-3" data-testid="superapp-hub">
        <AnimatePresence>
          {hubOpen && (
            <>
              <motion.button
                key="voice"
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                transition={{ delay: 0 }}
                onClick={() => { setHubOpen(false); document.dispatchEvent(new CustomEvent('superapp:open-voice')); }}
                className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 shadow-xl flex items-center justify-center"
                title="Sprache"
                data-testid="hub-voice-btn"
              >
                <Mic size={18} className="text-white" />
              </motion.button>

              {(hasActiveRide || unreadChats > 0) && (
                <motion.button
                  key="chat"
                  initial={{ opacity: 0, scale: 0.5, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5, y: 20 }}
                  transition={{ delay: 0.05 }}
                  onClick={() => { setHubOpen(false); setShowChat(true); }}
                  className="relative w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 shadow-xl flex items-center justify-center"
                  title="Chat"
                  data-testid="hub-chat-btn"
                >
                  <MessageCircle size={18} className="text-white" />
                  {unreadChats > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadChats > 9 ? '9+' : unreadChats}
                    </span>
                  )}
                </motion.button>
              )}

              <motion.button
                key="loyalty"
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                transition={{ delay: 0.1 }}
                onClick={() => { setHubOpen(false); setShowLoyalty(true); }}
                className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-xl flex items-center justify-center"
                title="Loyalty"
                data-testid="hub-loyalty-btn"
              >
                <Trophy size={18} className="text-white" />
              </motion.button>

              <motion.button
                key="plans"
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                transition={{ delay: 0.15 }}
                onClick={() => { setHubOpen(false); setShowPlans(true); }}
                className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 shadow-xl flex items-center justify-center"
                title="Abos"
                data-testid="hub-plans-btn"
              >
                <Crown size={18} className="text-white" />
              </motion.button>
            </>
          )}
        </AnimatePresence>

        {/* Main Hub-Toggle */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          animate={{ rotate: hubOpen ? 45 : 0 }}
          onClick={() => setHubOpen(!hubOpen)}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#0080FF] shadow-2xl flex items-center justify-center"
          title={hubOpen ? 'Schließen' : 'Aktionen'}
          data-testid="hub-toggle-btn"
        >
          {hubOpen ? <X size={22} className="text-white" /> : <Plus size={22} className="text-white" />}
        </motion.button>
      </div>

      {/* Voice — versteckt, wird durch Custom-Event 'superapp:open-voice' aktiviert */}
      <VoiceCommands onCommand={handleVoiceCommand} hidden />

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
