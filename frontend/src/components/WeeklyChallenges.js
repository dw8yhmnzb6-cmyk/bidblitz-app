import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Target, Trophy, Zap, Gift, Calendar, Users, 
  Flame, Clock, Check, ChevronRight, Star
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const WeeklyChallenges = () => {
  const { token, isAuthenticated } = useAuth();
  const { language, mappedLanguage } = useLanguage();
  const [challenges, setChallenges] = useState([]);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [loading, setLoading] = useState(true);

  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;

  const texts = {
    de: {
      title: 'Wochen-Challenges',
      subtitle: 'Schließe Challenges ab und verdiene Gratis-Gebote!',
      daysLeft: 'Tage übrig',
      progress: 'Fortschritt',
      reward: 'Belohnung',
      claim: 'Abholen',
      claimed: 'Abgeholt',
      completed: 'Abgeschlossen',
      inProgress: 'In Arbeit',
      loginRequired: 'Bitte einloggen',
      difficulty: {
        easy: 'Einfach',
        medium: 'Mittel',
        hard: 'Schwer'
      }
    },
    en: {
      title: 'Weekly Challenges',
      subtitle: 'Complete challenges and earn free bids!',
      daysLeft: 'days left',
      progress: 'Progress',
      reward: 'Reward',
      claim: 'Claim',
      claimed: 'Claimed',
      completed: 'Completed',
      inProgress: 'In Progress',
      loginRequired: 'Please login',
      difficulty: {
        easy: 'Easy',
        medium: 'Medium',
        hard: 'Hard'
      }
    },
    sq: {
      title: 'Sfidat Javore',
      subtitle: 'Përfundo sfidat dhe fito oferta falas!',
      daysLeft: 'ditë të mbetura',
      progress: 'Progresi',
      reward: 'Shpërblimi',
      claim: 'Merr',
      claimed: 'Marrë',
      completed: 'Përfunduar',
      inProgress: 'Në Progres',
      loginRequired: 'Ju lutem kyçuni',
      difficulty: {
        easy: 'E Lehtë',
        medium: 'Mesatare',
        hard: 'E Vështirë'
      }
    },
    xk: {
      title: 'Sfidat Javore',
      subtitle: 'Përfundo sfidat dhe fito oferta falas!',
      daysLeft: 'ditë të mbetura',
      progress: 'Progresi',
      reward: 'Shpërblimi',
      claim: 'Merr',
      claimed: 'Marrë',
      completed: 'Përfunduar',
      inProgress: 'Në Progres',
      loginRequired: 'Ju lutem kyçuni',
      difficulty: {
        easy: 'E Lehtë',
        medium: 'Mesatare',
        hard: 'E Vështirë'
      }
    },
    tr: {
      title: 'Haftalık Görevler',
      subtitle: 'Görevleri tamamla ve ücretsiz teklifler kazan!',
      daysLeft: 'gün kaldı',
      progress: 'İlerleme',
      reward: 'Ödül',
      claim: 'Al',
      claimed: 'Alındı',
      completed: 'Tamamlandı',
      inProgress: 'Devam Ediyor',
      loginRequired: 'Lütfen giriş yapın',
      difficulty: {
        easy: 'Kolay',
        medium: 'Orta',
        hard: 'Zor'
      }
    },
    fr: {
      title: 'Défis Hebdomadaires',
      subtitle: 'Complétez des défis et gagnez des offres gratuites!',
      daysLeft: 'jours restants',
      progress: 'Progrès',
      reward: 'Récompense',
      claim: 'Réclamer',
      claimed: 'Réclamé',
      completed: 'Terminé',
      inProgress: 'En Cours',
      loginRequired: 'Veuillez vous connecter',
      difficulty: {
        easy: 'Facile',
        medium: 'Moyen',
        hard: 'Difficile'
      }
    }
  };
  const t = texts[language] || texts.de;

  useEffect(() => {
    if (token) {
      fetchChallenges();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchChallenges = async () => {
    try {
      const res = await axios.get(`${API}/api/challenges/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChallenges(res.data.challenges || []);
      setDaysRemaining(res.data.days_remaining || 0);
    } catch (err) {
      console.error('Error fetching challenges:', err);
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async (challengeId) => {
    try {
      const res = await axios.post(
        `${API}/api/challenges/claim/${challengeId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message);
      fetchChallenges();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/20 text-green-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'hard': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getProgressPercent = (progress, goal) => {
    return Math.min(100, Math.round((progress / goal) * 100));
  };

  if (!isAuthenticated) {
    return (
      <div className="glass-card rounded-xl p-6 text-center">
        <Target className="w-12 h-12 text-purple-400 mx-auto mb-3" />
        <p className="text-gray-400">{t.loginRequired}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6" data-testid="weekly-challenges">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">{t.title}</h3>
            <p className="text-gray-400 text-sm">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/20">
          <Clock className="w-4 h-4 text-purple-400" />
          <span className="text-purple-400 font-bold">{daysRemaining} {t.daysLeft}</span>
        </div>
      </div>

      {/* Challenges List */}
      <div className="space-y-4">
        {challenges.map((challenge) => {
          const progressPercent = getProgressPercent(challenge.progress, challenge.goal);
          const isCompleted = challenge.completed;
          const isClaimed = challenge.claimed;

          return (
            <div 
              key={challenge.challenge_id}
              className={`p-4 rounded-xl border transition-all ${
                isClaimed 
                  ? 'bg-green-500/5 border-green-500/20' 
                  : isCompleted 
                    ? 'bg-yellow-500/5 border-yellow-500/30 animate-pulse' 
                    : 'bg-white/5 border-white/10 hover:border-purple-500/30'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`text-3xl ${isCompleted ? 'animate-bounce' : ''}`}>
                  {challenge.icon}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-white font-bold">{challenge.name}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(challenge.difficulty)}`}>
                      {t.difficulty[challenge.difficulty]}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">{challenge.description}</p>

                  {/* Progress Bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-400">{t.progress}</span>
                      <span className={`font-mono font-bold ${isCompleted ? 'text-green-400' : 'text-white'}`}>
                        {challenge.progress} / {challenge.goal}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          isCompleted ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Reward */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 font-bold">+{challenge.reward_bids} Gebote</span>
                    </div>

                    {/* Claim Button */}
                    {isCompleted && !isClaimed && (
                      <Button 
                        onClick={() => claimReward(challenge.challenge_id)}
                        className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold hover:from-yellow-300 hover:to-orange-400"
                        size="sm"
                      >
                        <Gift className="w-4 h-4 mr-1" />
                        {t.claim}
                      </Button>
                    )}
                    {isClaimed && (
                      <span className="flex items-center gap-1 text-green-400 text-sm font-medium">
                        <Check className="w-4 h-4" />
                        {t.claimed}
                      </span>
                    )}
                    {!isCompleted && (
                      <span className="text-gray-500 text-sm">{t.inProgress}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyChallenges;
