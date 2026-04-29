import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Crown, X } from 'lucide-react';
import SafetyButton from './SafetyButton';
import VoiceCommands from './VoiceCommands';
import LoyaltyDashboard from './LoyaltyDashboard';
import SubscriptionPlans from './SubscriptionPlans';

/**
 * SuperAppOverlay
 * Globale Floating-Buttons (Uber/Bolt/Lieferando-Stil) für Taxi, Scooter, Food.
 * - SafetyButton (rot, immer auf den 3 Routes)
 * - VoiceCommands (blau, immer)
 * - Loyalty-Quick-Access (gelb)
 * - Subscriptions-Quick-Access (lila)
 * Plus Voice-Commands die direkt navigieren.
 */
export default function SuperAppOverlay({ currentPath, onNavigate, isAuthenticated, activeRideId }) {
  const [showLoyalty, setShowLoyalty] = useState(false);
  const [showPlans, setShowPlans] = useState(false);

  // Nur auf Super-App-Routes anzeigen
  const isOnSuperApp = ['/taxi', '/scooter', '/food'].some(p => currentPath?.startsWith(p));
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

  return (
    <>
      {/* Voice Commands (Mic-Button) */}
      <VoiceCommands onCommand={handleVoiceCommand} />

      {/* Safety Button — nur auf Taxi/Scooter (während aktiver Fahrt am wichtigsten) */}
      {(currentPath?.startsWith('/taxi') || currentPath?.startsWith('/scooter')) && (
        <SafetyButton rideId={activeRideId} type={currentPath.startsWith('/taxi') ? 'taxi' : 'scooter'} />
      )}

      {/* Loyalty Quick-Access (Trophy-Button) */}
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm overflow-y-auto"
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm overflow-y-auto"
            onClick={() => setShowPlans(false)}
            data-testid="superapp-plans-modal"
          >
            <div onClick={e => e.stopPropagation()} className="min-h-screen">
              <SubscriptionPlans onClose={() => setShowPlans(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
