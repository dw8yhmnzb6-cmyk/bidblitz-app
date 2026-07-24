import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, X } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function SubscriptionPlans({ onClose }) {
  const [plans, setPlans] = useState({});
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
    fetchMySubscriptions();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API}/api/subscriptions/plans`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || {});
      }
    } catch {}
    setLoading(false);
  };

  const fetchMySubscriptions = async () => {
    try {
      const res = await fetch(`${API}/api/subscriptions/my-subscriptions`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMySubscriptions(data.subscriptions || []);
      }
    } catch {}
  };

  const subscribe = async (planId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/subscriptions/subscribe?plan_id=${planId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await fetchMySubscriptions();
      }
    } catch {}
    setLoading(false);
  };

  const hasPlan = (planId) => mySubscriptions.some(s => s.plan_id === planId && s.status === 'active');

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white p-6 space-y-6 overflow-y-auto pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Subscription Plans</h1>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="text-gray-400"
        >
          ✕
        </motion.button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-12 h-12 border-4 border-[#00C2FF] border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(plans).map(([planId, plan]) => {
            const isActive = hasPlan(planId);
            return (
              <motion.div
                key={planId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative overflow-hidden rounded-3xl p-6 ${
                  isActive
                    ? 'bg-gradient-to-br from-[#00C2FF]/20 to-[#7B2CFF]/20 border-2 border-[#00C2FF]'
                    : 'bg-[#121218]'
                }`}
              >
                {isActive && (
                  <div className="absolute top-4 right-4 px-3 py-1 bg-[#00C2FF] rounded-full text-xs font-bold">
                    ACTIVE
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">€{plan.price}</span>
                    <span className="text-gray-400">/ {plan.duration_days} days</span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {plan.benefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#00C2FF]/20 flex items-center justify-center flex-shrink-0">
                        <Check size={16} className="text-[#00C2FF]" />
                      </div>
                      <span className="text-gray-300">{benefit}</span>
                    </div>
                  ))}
                </div>

                {!isActive && (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => subscribe(planId)}
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-[#00C2FF] to-[#7B2CFF] rounded-full font-bold flex items-center justify-center gap-2"
                  >
                    <Zap size={20} />
                    Subscribe Now
                  </motion.button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {mySubscriptions.length > 0 && (
        <div className="bg-[#121218] rounded-2xl p-4">
          <h3 className="text-lg font-bold mb-3">My Active Subscriptions</h3>
          {mySubscriptions.map(sub => (
            <div key={sub.subscription_id} className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
              <div>
                <p className="text-white font-medium">{sub.plan_name}</p>
                <p className="text-gray-400 text-xs">Renews: {new Date(sub.end_date).toLocaleDateString()}</p>
              </div>
              <p className="text-[#00C2FF] font-bold">€{sub.price}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
