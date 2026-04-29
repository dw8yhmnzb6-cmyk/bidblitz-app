import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Users, AlertCircle, Phone, X } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function SafetyButton({ rideId, type = 'taxi' }) {
  const [showMenu, setShowMenu] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [emergencyModal, setEmergencyModal] = useState(false);

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowMenu(true)}
        className="fixed bottom-24 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-2xl flex items-center justify-center"
      >
        <Shield size={24} className="text-white" />
      </motion.button>

      {/* Safety Menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center p-4"
            onClick={() => setShowMenu(false)}
          >
            <motion.div
              initial={{ y: 400 }}
              animate={{ y: 0 }}
              exit={{ y: 400 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#0B0B0F] rounded-t-3xl p-6 w-full max-w-md space-y-3"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield size={24} className="text-[#00C2FF]" />
                  Safety Center
                </h3>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowMenu(false)}
                  className="w-8 h-8 rounded-full bg-[#121218] flex items-center justify-center"
                >
                  <X size={16} className="text-gray-400" />
                </motion.button>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setShareModal(true);
                  setShowMenu(false);
                }}
                className="w-full p-4 bg-[#121218] rounded-2xl flex items-center gap-4 text-left"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Users size={24} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Share Trip</p>
                  <p className="text-gray-400 text-sm">Let friends track your ride</p>
                </div>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setEmergencyModal(true);
                  setShowMenu(false);
                }}
                className="w-full p-4 bg-red-500/20 rounded-2xl flex items-center gap-4 text-left border-2 border-red-500/50"
              >
                <div className="w-12 h-12 rounded-full bg-red-500/30 flex items-center justify-center">
                  <AlertCircle size={24} className="text-red-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Emergency</p>
                  <p className="text-gray-400 text-sm">Contact emergency services</p>
                </div>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.98 }}
                className="w-full p-4 bg-[#121218] rounded-2xl flex items-center gap-4 text-left"
              >
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Phone size={24} className="text-green-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Call Support</p>
                  <p className="text-gray-400 text-sm">24/7 customer support</p>
                </div>
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Trip Modal */}
      <ShareTripModal
        isOpen={shareModal}
        onClose={() => setShareModal(false)}
        rideId={rideId}
      />

      {/* Emergency Modal */}
      <EmergencyModal
        isOpen={emergencyModal}
        onClose={() => setEmergencyModal(false)}
        rideId={rideId}
      />
    </>
  );
}

function ShareTripModal({ isOpen, onClose, rideId }) {
  const [contacts, setContacts] = useState(['']);
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const shareTrip = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/safety/share-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ride_id: rideId, contacts: contacts.filter(c => c) }),
      });
      if (res.ok) {
        const data = await res.json();
        setShareUrl(data.track_url);
      }
    } catch {}
    setLoading(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            onClick={e => e.stopPropagation()}
            className="bg-[#0B0B0F] rounded-3xl p-6 max-w-md w-full space-y-4"
          >
            <h3 className="text-xl font-bold text-white">Share Your Trip</h3>
            
            {shareUrl ? (
              <div className="space-y-4">
                <div className="bg-[#121218] p-4 rounded-xl">
                  <p className="text-gray-400 text-sm mb-2">Share this link:</p>
                  <p className="text-[#00C2FF] text-sm break-all">{shareUrl}</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigator.clipboard.writeText(shareUrl)}
                  className="w-full py-3 bg-[#00C2FF] text-white rounded-full font-bold"
                >
                  Copy Link
                </motion.button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {contacts.map((contact, idx) => (
                    <input
                      key={idx}
                      type="text"
                      placeholder="Phone or email"
                      value={contact}
                      onChange={(e) => {
                        const newContacts = [...contacts];
                        newContacts[idx] = e.target.value;
                        setContacts(newContacts);
                      }}
                      className="w-full bg-[#121218] text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/50"
                    />
                  ))}
                  <button
                    onClick={() => setContacts([...contacts, ''])}
                    className="text-[#00C2FF] text-sm"
                  >
                    + Add another contact
                  </button>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={shareTrip}
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-[#00C2FF] to-[#7B2CFF] text-white rounded-full font-bold"
                >
                  {loading ? 'Sharing...' : 'Share Trip'}
                </motion.button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EmergencyModal({ isOpen, onClose, rideId }) {
  const [countdown, setCountdown] = useState(5);
  const [triggered, setTriggered] = useState(false);

  const triggerEmergency = async () => {
    setTriggered(true);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Actual emergency call
          fetch(`${API}/api/safety/emergency`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ride_id: rideId, location: {} }),
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            onClick={e => e.stopPropagation()}
            className="bg-[#0B0B0F] rounded-3xl p-6 max-w-md w-full space-y-6 text-center"
          >
            {triggered ? (
              <>
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="w-24 h-24 mx-auto rounded-full bg-red-500/20 flex items-center justify-center"
                >
                  <AlertCircle size={48} className="text-red-500" />
                </motion.div>
                <h3 className="text-4xl font-bold text-white">{countdown}</h3>
                <p className="text-gray-300">Contacting emergency services...</p>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setTriggered(false);
                    setCountdown(5);
                    onClose();
                  }}
                  className="w-full py-4 bg-gray-700 text-white rounded-full font-bold"
                >
                  Cancel
                </motion.button>
              </>
            ) : (
              <>
                <AlertCircle size={64} className="text-red-500 mx-auto" />
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Emergency Alert</h3>
                  <p className="text-gray-400">This will contact emergency services and notify your emergency contacts.</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={triggerEmergency}
                  className="w-full py-4 bg-red-500 text-white rounded-full font-bold"
                >
                  Trigger Emergency
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="w-full py-4 bg-[#121218] text-white rounded-full font-bold"
                >
                  Cancel
                </motion.button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
