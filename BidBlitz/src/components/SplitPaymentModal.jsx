import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, X, Check } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function SplitPaymentModal({ isOpen, onClose, type, itemId, totalAmount }) {
  const [emails, setEmails] = useState(['']);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const addEmailField = () => setEmails([...emails, '']);
  
  const updateEmail = (index, value) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const handleSplit = async () => {
    const validEmails = emails.filter(e => e.includes('@'));
    if (validEmails.length === 0) return;

    setLoading(true);
    try {
      const endpoint = type === 'taxi' ? '/api/split-payment/taxi/create' : '/api/split-payment/food/create';
      const payload = {
        [type === 'taxi' ? 'ride_id' : 'order_id']: itemId,
        split_with: validEmails,
      };

      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setEmails(['']);
        }, 2000);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const amountPerPerson = totalAmount / (emails.filter(e => e.includes('@')).length + 1);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10010] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-[#0B0B0F] rounded-3xl p-6 max-w-md w-full space-y-4"
          >
            {success ? (
              <div className="text-center py-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4"
                >
                  <Check size={40} className="text-green-400" />
                </motion.div>
                <h3 className="text-2xl font-bold text-white mb-2">Split Request Sent!</h3>
                <p className="text-gray-400">Your friends will receive a notification</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#7B2CFF] flex items-center justify-center">
                      <Users size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Split Payment</h3>
                      <p className="text-gray-400 text-sm">Share the cost</p>
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-[#121218] flex items-center justify-center"
                  >
                    <X size={16} className="text-gray-400" />
                  </motion.button>
                </div>

                <div className="bg-[#121218] rounded-2xl p-4 text-center">
                  <p className="text-gray-400 text-sm mb-1">Total Amount</p>
                  <p className="text-3xl font-bold text-white">€{totalAmount.toFixed(2)}</p>
                  {emails.filter(e => e.includes('@')).length > 0 && (
                    <p className="text-[#00C2FF] text-sm mt-2">
                      €{amountPerPerson.toFixed(2)} per person
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-white text-sm font-medium">Split with:</label>
                  {emails.map((email, idx) => (
                    <input
                      key={idx}
                      type="email"
                      placeholder="friend@email.com"
                      value={email}
                      onChange={(e) => updateEmail(idx, e.target.value)}
                      className="w-full bg-[#121218] text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/50"
                    />
                  ))}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={addEmailField}
                    className="text-[#00C2FF] text-sm font-medium"
                  >
                    + Add another person
                  </motion.button>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSplit}
                  disabled={loading || emails.filter(e => e.includes('@')).length === 0}
                  className={`w-full py-4 rounded-full font-bold text-white transition ${
                    loading || emails.filter(e => e.includes('@')).length === 0
                      ? 'bg-gray-700 opacity-50'
                      : 'bg-gradient-to-r from-[#00C2FF] to-[#7B2CFF]'
                  }`}
                >
                  {loading ? 'Sending...' : 'Send Split Request'}
                </motion.button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
