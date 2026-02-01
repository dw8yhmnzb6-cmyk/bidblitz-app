import { useState, useEffect } from 'react';
import { Flame, Award, TrendingUp } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const MILESTONES = {
  5: { icon: '🔥', color: 'text-orange-400', reward: 1 },
  10: { icon: '🔥🔥', color: 'text-orange-500', reward: 3 },
  15: { icon: '🔥🔥🔥', color: 'text-red-500', reward: 5 },
  25: { icon: '💎', color: 'text-purple-500', reward: 10 },
  50: { icon: '👑', color: 'text-yellow-400', reward: 25 }
};

const StreakIndicator = ({ auctionId, currentStreak = 0, onStreakUpdate }) => {
  const { language } = useLanguage();
  const { token } = useAuth();
  const [streak, setStreak] = useState(currentStreak);
  const [nextMilestone, setNextMilestone] = useState(null);
  const [showReward, setShowReward] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);

  const texts = {
    de: {
      streak: 'Streak',
      bidsUntil: 'Gebote bis',
      bonus: 'Bonus',
      freeBids: 'Gratis-Gebote'
    },
    en: {
      streak: 'Streak',
      bidsUntil: 'bids until',
      bonus: 'Bonus',
      freeBids: 'Free Bids'
    },
    tr: {
      streak: 'Seri',
      bidsUntil: 'teklife kadar',
      bonus: 'Bonus',
      freeBids: 'Ücretsiz Teklifler'
    }
  };
  const t = texts[language] || texts.de;

  useEffect(() => {
    if (!token || !auctionId) return;

    const fetchStreak = async () => {
      try {
        const res = await axios.get(`${API}/api/gamification/streak/${auctionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStreak(res.data.current_streak);
        setNextMilestone(res.data.next_milestone);
      } catch (err) {
        console.error('Error fetching streak:', err);
      }
    };

    fetchStreak();
  }, [auctionId, token, currentStreak]);

  // Animation when streak reward is earned
  useEffect(() => {
    if (currentStreak > streak && MILESTONES[currentStreak]) {
      setRewardAmount(MILESTONES[currentStreak].reward);
      setShowReward(true);
      setTimeout(() => setShowReward(false), 3000);
    }
    setStreak(currentStreak);
  }, [currentStreak]);

  if (!auctionId || streak === 0) return null;

  const milestoneKeys = Object.keys(MILESTONES).map(Number).sort((a, b) => a - b);
  const currentMilestone = milestoneKeys.filter(m => m <= streak).pop();
  const nextMilestoneValue = milestoneKeys.find(m => m > streak);
  const bidsUntilNext = nextMilestoneValue ? nextMilestoneValue - streak : null;

  const milestoneStyle = currentMilestone ? MILESTONES[currentMilestone] : null;

  return (
    <div className="relative" data-testid="streak-indicator">
      {/* Reward Animation Popup */}
      {showReward && (
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <Award className="w-5 h-5" />
            <span>+{rewardAmount} {t.freeBids}!</span>
          </div>
        </div>
      )}

      {/* Streak Display */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
        streak >= 25 ? 'bg-gradient-to-r from-purple-500/20 to-yellow-500/20 border border-purple-400/50' :
        streak >= 10 ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-400/50' :
        streak >= 5 ? 'bg-orange-500/20 border border-orange-400/50' :
        'bg-gray-700/50 border border-gray-600/50'
      }`}>
        <Flame className={`w-4 h-4 ${
          streak >= 25 ? 'text-purple-400' :
          streak >= 10 ? 'text-red-400' :
          streak >= 5 ? 'text-orange-400' :
          'text-gray-400'
        } ${streak >= 5 ? 'animate-pulse' : ''}`} />
        
        <span className={`font-bold ${milestoneStyle?.color || 'text-gray-300'}`}>
          {streak}x {t.streak}
        </span>
        
        {milestoneStyle && (
          <span className="text-sm">{milestoneStyle.icon}</span>
        )}
      </div>

      {/* Progress to next milestone */}
      {bidsUntilNext && bidsUntilNext <= 10 && (
        <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
          <TrendingUp className="w-3 h-3" />
          <span>{bidsUntilNext} {t.bidsUntil} +{MILESTONES[nextMilestoneValue]?.reward} {t.bonus}</span>
        </div>
      )}
    </div>
  );
};

export default StreakIndicator;
