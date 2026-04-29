import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Tag, Check, X } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function PromoCodeInput({ serviceType, onApply }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(null);
  const [error, setError] = useState('');

  const applyCode = async () => {
    if (!code.trim()) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/promo/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: code.toUpperCase(), service_type: serviceType }),
      });

      if (res.ok) {
        const data = await res.json();
        setApplied(data);
        onApply?.(data);
      } else {
        const err = await res.json();
        setError(err.detail || 'Invalid promo code');
      }
    } catch (err) {
      setError('Failed to apply code');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Tag size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Enter promo code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={applied}
            className={`w-full bg-[#121218] text-white pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/50 uppercase ${
              applied ? 'opacity-50' : ''
            }`}
          />
        </div>
        {applied ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setApplied(null);
              setCode('');
              onApply?.(null);
            }}
            className="px-4 py-3 bg-red-500/20 text-red-400 rounded-xl font-medium flex items-center gap-2"
          >
            <X size={20} />
            Remove
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={applyCode}
            disabled={loading || !code.trim()}
            className={`px-6 py-3 rounded-xl font-medium transition ${
              loading || !code.trim()
                ? 'bg-gray-700 text-gray-400'
                : 'bg-gradient-to-r from-[#00C2FF] to-[#7B2CFF] text-white'
            }`}
          >
            {loading ? 'Checking...' : 'Apply'}
          </motion.button>
        )}
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-red-400 text-sm"
        >
          <X size={16} />
          {error}
        </motion.div>
      )}

      {applied && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-between bg-green-500/20 border border-green-500/50 p-3 rounded-xl"
        >
          <div className="flex items-center gap-2">
            <Check size={20} className="text-green-400" />
            <span className="text-white font-medium">Promo Applied!</span>
          </div>
          <span className="text-[#00C2FF] font-bold">{applied.message}</span>
        </motion.div>
      )}
    </div>
  );
}
