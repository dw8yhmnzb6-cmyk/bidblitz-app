import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function ChallengesPage() {
  const [loading, setLoading] = useState(true);
  const [challenges, setChallenges] = useState([]);
  const [stats, setStats] = useState(null);

  const fetchChallenges = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/gamification/challenges/today`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setChallenges(data.challenges);
        setStats(data);
        setLoading(false);
      }
    } catch (err) {
      toast.error("Fehler beim Laden");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-[#00E0FF] border-t-transparent animate-spin" />
      </div>
    );
  }

  const completedCount = challenges.filter((c) => c.completed).length;
  const totalRewards = stats?.total_rewards_earned_today || {};

  return (
    <div className="min-h-screen bg-[#030303] text-white font-outfit pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-2xl font-black">Tägliche Challenges</h1>
          <p className="text-sm text-white/60">Verdiene BLZ mit täglichen Aufgaben</p>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="max-w-md mx-auto px-4 mt-6">
        <div className="bg-gradient-to-br from-[#00E0FF]/10 to-[#0088CC]/10 border border-[#00E0FF]/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-white/60">Heute abgeschlossen</p>
              <p className="text-3xl font-black">
                {completedCount}/{challenges.length}
              </p>
            </div>
            <div className="relative w-20 h-20">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="6"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  fill="none"
                  stroke="#00E0FF"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 35}
                  strokeDashoffset={2 * Math.PI * 35 * (1 - completedCount / challenges.length)}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {Math.round((completedCount / challenges.length) * 100)}%
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <span className="text-sm text-white/60">Heute verdient</span>
            <span className="text-xl font-black text-[#FFD166]">
              {totalRewards.blz || 0} BLZ
            </span>
          </div>
        </div>
      </div>

      {/* Challenges List */}
      <div className="max-w-md mx-auto px-4 mt-6 space-y-3">
        {challenges.map((challenge) => (
          <motion.div
            key={challenge.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-[#0a0a0a] border rounded-2xl p-5 ${
              challenge.completed
                ? "border-[#10B981]/40 bg-[#10B981]/5"
                : "border-white/5 hover:border-white/10"
            } transition`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`text-4xl ${
                  challenge.completed ? "grayscale-0" : "grayscale opacity-50"
                }`}
              >
                {challenge.icon}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold">{challenge.title}</h3>
                  {challenge.completed && (
                    <span className="text-xs px-2 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded-full font-semibold">
                      ✓ Erledigt
                    </span>
                  )}
                </div>

                <p className="text-sm text-white/60 mb-3">{challenge.description}</p>

                {/* Progress Bar (for manual challenges) */}
                {challenge.type === "manual" && !challenge.completed && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-white/40 mb-1">
                      <span>Fortschritt</span>
                      <span>
                        {challenge.progress}/{challenge.target}
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(challenge.progress / challenge.target) * 100}%`,
                        }}
                        className="h-full bg-gradient-to-r from-[#00E0FF] to-[#0088CC]"
                      />
                    </div>
                  </div>
                )}

                {/* Reward */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-white/60">Belohnung:</span>
                    <span className="font-bold text-[#FFD166]">
                      +{challenge.reward_blz} BLZ
                    </span>
                  </div>

                  {challenge.completed && (
                    <span className="text-2xl">🎉</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* All Completed */}
      {stats?.all_completed && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md mx-auto px-4 mt-6"
        >
          <div className="bg-gradient-to-r from-[#FFD166] to-[#FF9800] rounded-2xl p-6 text-center">
            <p className="text-4xl mb-2">🏆</p>
            <h3 className="text-xl font-black text-black">Alle Challenges erledigt!</h3>
            <p className="text-sm text-black/70 mt-1">Komm morgen wieder für neue Aufgaben</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
