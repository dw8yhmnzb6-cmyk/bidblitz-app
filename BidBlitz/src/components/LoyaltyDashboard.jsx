import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star, Award, ChevronRight, Zap } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const LEVEL_COLORS = {
  0: { name: 'Bronze', color: '#CD7F32', bg: 'from-orange-900/20 to-orange-800/20' },
  1: { name: 'Silver', color: '#C0C0C0', bg: 'from-gray-500/20 to-gray-400/20' },
  2: { name: 'Gold', color: '#FFD700', bg: 'from-yellow-600/20 to-yellow-500/20' },
  3: { name: 'Platinum', color: '#E5E4E2', bg: 'from-purple-600/20 to-blue-500/20' },
};

export default function LoyaltyDashboard({ onClose }) {
  const [loyalty, setLoyalty] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLoyalty();
    fetchLeaderboard();
  }, []);

  const fetchLoyalty = async () => {
    try {
      const res = await fetch(`${API}/api/loyalty-superapp/my-points`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLoyalty(data);
      }
    } catch {}
    setLoading(false);
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API}/api/loyalty-superapp/leaderboard`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0F] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-[#00C2FF] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const levelData = LEVEL_COLORS[loyalty?.level || 0];
  const progress = loyalty?.next_level 
    ? ((loyalty.points - loyalty.next_level.points) / (loyalty.next_level.points - LEVEL_COLORS[loyalty.level]?.points || 1)) * 100
    : 100;

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white pb-20 overflow-y-auto">
      {/* Header */}
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Loyalty Rewards</h1>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="text-gray-400"
          >
            ✕
          </motion.button>
        </div>

        {/* Level Card */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br ${levelData.bg}`}
          style={{ border: `2px solid ${levelData.color}` }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${levelData.color}40`, border: `3px solid ${levelData.color}` }}
              >
                <Trophy size={32} style={{ color: levelData.color }} />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Your Level</p>
                <h2 className="text-3xl font-bold" style={{ color: levelData.color }}>
                  {levelData.name}
                </h2>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold">{loyalty?.points || 0}</p>
              <p className="text-gray-400 text-sm">Points</p>
            </div>
          </div>

          {loyalty?.next_level && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Next Level: {loyalty.next_level.name}</span>
                <span className="text-white font-medium">{loyalty.next_level.points - loyalty.points} points away</span>
              </div>
              <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progress, 100)}%` }}
                  className="h-full bg-gradient-to-r from-[#00C2FF] to-[#7B2CFF]"
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* Benefits */}
        <div className="bg-[#121218] rounded-2xl p-4 space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Star size={20} className="text-yellow-400" />
            Your Benefits
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-[#0B0B0F] rounded-xl">
              <span className="text-gray-300">Discount</span>
              <span className="text-[#00C2FF] font-bold">{loyalty?.discount || 0}%</span>
            </div>
            {loyalty?.perks?.map((perk, idx) => (
              <div key={idx} className="flex items-center gap-2 p-3 bg-[#0B0B0F] rounded-xl">
                <Zap size={16} className="text-[#00C2FF]" />
                <span className="text-gray-300 text-sm">{perk}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stamp Cards */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold">Stamp Cards</h3>
          {['taxi', 'scooter', 'food'].map(service => (
            <div key={service} className="bg-[#121218] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-medium capitalize">{service}</p>
                <p className="text-gray-400 text-sm">{loyalty?.stamps?.[service] || 0}/5</p>
              </div>
              <div className="flex gap-2">
                {[...Array(5)].map((_, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 h-12 rounded-xl ${
                      idx < (loyalty?.stamps?.[service] || 0)
                        ? 'bg-gradient-to-br from-[#00C2FF] to-[#7B2CFF]'
                        : 'bg-[#0B0B0F] border border-gray-700'
                    }`}
                  />
                ))}
              </div>
              {loyalty?.stamps?.[service] === 4 && (
                <p className="text-[#00C2FF] text-xs mt-2">One more for €5 reward!</p>
              )}
            </div>
          ))}
        </div>

        {/* Leaderboard */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Award size={20} className="text-[#00C2FF]" />
            Top Users
          </h3>
          {leaderboard.slice(0, 10).map((user, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center justify-between bg-[#121218] p-4 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                  idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                  idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                  'bg-[#0B0B0F] text-gray-500'
                }`}>
                  #{user.rank}
                </div>
                <div>
                  <p className="text-white font-medium">{user.name}</p>
                  <p className="text-gray-400 text-xs">{user.level}</p>
                </div>
              </div>
              <p className="text-[#00C2FF] font-bold">{user.points} pts</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
