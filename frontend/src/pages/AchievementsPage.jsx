import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const RARITY_COLORS = {
  common: "from-gray-400 to-gray-600",
  rare: "from-blue-400 to-blue-600",
  epic: "from-purple-500 to-pink-600",
  legendary: "from-yellow-400 to-orange-500",
};

export default function AchievementsPage() {
  const [loading, setLoading] = useState(true);
  const [achievements, setAchievements] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedAchievement, setSelectedAchievement] = useState(null);

  const fetchAchievements = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/gamification/achievements`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setAchievements(data.achievements);
        setStats(data.stats);
        setLoading(false);
      }
    } catch (err) {
      toast.error("Fehler beim Laden");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAchievements();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-[#00E0FF] border-t-transparent animate-spin" />
      </div>
    );
  }

  // Get categories
  const categories = ["all", ...new Set(achievements.map((a) => a.category))];

  // Filter achievements
  const filtered =
    selectedCategory === "all"
      ? achievements
      : achievements.filter((a) => a.category === selectedCategory);

  return (
    <div className="min-h-screen bg-[#030303] text-white font-outfit pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-2xl font-black">Achievements</h1>
          <p className="text-sm text-white/60">Schalte Badges frei & verdiene BLZ</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="max-w-md mx-auto px-4 mt-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-[#00E0FF]">
              {stats?.total_unlocked || 0}
            </p>
            <p className="text-xs text-white/60 mt-1">Freigeschaltet</p>
          </div>
          <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-[#FFD166]">
              {stats?.completion_pct || 0}%
            </p>
            <p className="text-xs text-white/60 mt-1">Abgeschlossen</p>
          </div>
          <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-[#10B981]">
              {stats?.total_rewards_earned_blz || 0}
            </p>
            <p className="text-xs text-white/60 mt-1">BLZ verdient</p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="max-w-md mx-auto px-4 mt-6">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? "bg-[#00E0FF] text-black"
                  : "bg-white/5 hover:bg-white/10"
              }`}
            >
              {cat === "all" ? "Alle" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="max-w-md mx-auto px-4 mt-6 grid grid-cols-3 gap-3">
        {filtered.map((achievement) => (
          <motion.button
            key={achievement.id}
            onClick={() => setSelectedAchievement(achievement)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`relative aspect-square rounded-2xl border p-4 flex flex-col items-center justify-center transition ${
              achievement.unlocked
                ? `bg-gradient-to-br ${
                    RARITY_COLORS[achievement.rarity]
                  } border-transparent`
                : "bg-white/5 border-white/10 grayscale"
            }`}
          >
            {/* Badge Icon */}
            <span
              className={`text-3xl mb-2 ${
                !achievement.unlocked && "opacity-30"
              }`}
            >
              {achievement.icon}
            </span>

            {/* Rarity Indicator */}
            {achievement.unlocked && (
              <div className="absolute top-2 right-2">
                {achievement.rarity === "legendary" && "⭐"}
                {achievement.rarity === "epic" && "💎"}
                {achievement.rarity === "rare" && "🔹"}
              </div>
            )}

            {/* Lock Icon */}
            {!achievement.unlocked && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl">
                <span className="text-2xl">🔒</span>
              </div>
            )}
          </motion.button>
        ))}
      </div>

      {/* Achievement Detail Modal */}
      <AnimatePresence>
        {selectedAchievement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedAchievement(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`bg-[#0a0a0a] border rounded-3xl p-6 max-w-sm w-full ${
                selectedAchievement.unlocked
                  ? "border-white/20"
                  : "border-white/10"
              }`}
            >
              {/* Badge Display */}
              <div className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center text-6xl mb-4 ${
                    selectedAchievement.unlocked
                      ? `bg-gradient-to-br ${
                          RARITY_COLORS[selectedAchievement.rarity]
                        }`
                      : "bg-white/5 grayscale"
                  }`}
                >
                  {selectedAchievement.unlocked ? (
                    selectedAchievement.icon
                  ) : (
                    "🔒"
                  )}
                </motion.div>

                <h3 className="text-xl font-black mb-1">
                  {selectedAchievement.title}
                </h3>
                <p className="text-sm text-white/60">
                  {selectedAchievement.description}
                </p>

                {/* Rarity Badge */}
                <div className="mt-3 inline-block">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      selectedAchievement.rarity === "legendary"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : selectedAchievement.rarity === "epic"
                        ? "bg-purple-500/20 text-purple-400"
                        : selectedAchievement.rarity === "rare"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {selectedAchievement.rarity}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-white/60">Belohnung</span>
                  <span className="font-bold text-[#FFD166]">
                    +{selectedAchievement.reward_blz} BLZ
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-white/60">Status</span>
                  <span
                    className={`font-semibold ${
                      selectedAchievement.unlocked
                        ? "text-[#10B981]"
                        : "text-white/40"
                    }`}
                  >
                    {selectedAchievement.unlocked
                      ? "✓ Freigeschaltet"
                      : "🔒 Gesperrt"}
                  </span>
                </div>

                {selectedAchievement.unlocked && selectedAchievement.unlocked_at && (
                  <div className="flex justify-between">
                    <span className="text-sm text-white/60">Freigeschaltet am</span>
                    <span className="text-sm font-mono">
                      {new Date(selectedAchievement.unlocked_at).toLocaleDateString("de-DE")}
                    </span>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedAchievement(null)}
                className="w-full mt-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-semibold transition"
              >
                Schließen
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
