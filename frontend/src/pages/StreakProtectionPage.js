import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Flame, Shield, Gift, Calendar, Check, Lock, Trophy } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function StreakProtectionPage() {
  const { language } = useLanguage();
  const { token, isAuthenticated } = useAuth();
  const [status, setStatus] = useState(null);
  const [claimedRewards, setClaimedRewards] = useState([]);
  const [loading, setLoading] = useState(true);

  const texts = {
    de: {
      title: 'Login-Streak',
      subtitle: 'Tägliche Logins werden belohnt!',
      currentStreak: 'Aktueller Streak',
      days: 'Tage',
      protection: 'Streak-Schutz',
      activate: 'Aktivieren',
      useProtection: 'Schutz verwenden',
      active: 'Aktiv',
      protectionInfo: 'Schützt deinen Streak bei einem verpassten Tag',
      cooldown: 'Cooldown',
      daysRemaining: 'Tage verbleibend',
      milestones: 'Meilensteine',
      claim: 'Abholen',
      claimed: 'Abgeholt',
      locked: 'Gesperrt',
      bids: 'Gebote',
      loginRequired: 'Bitte melde dich an',
      requirement: 'Benötigt 7 Tage Streak',
      streakInDanger: 'Dein Streak ist in Gefahr!',
      protectionAvailable: 'Du hast einen Schutz verfügbar'
    },
    en: {
      title: 'Login Streak',
      subtitle: 'Daily logins are rewarded!',
      currentStreak: 'Current Streak',
      days: 'days',
      protection: 'Streak Protection',
      activate: 'Activate',
      useProtection: 'Use Protection',
      active: 'Active',
      protectionInfo: 'Protects your streak if you miss a day',
      cooldown: 'Cooldown',
      daysRemaining: 'days remaining',
      milestones: 'Milestones',
      claim: 'Claim',
      claimed: 'Claimed',
      locked: 'Locked',
      bids: 'bids',
      loginRequired: 'Please log in',
      requirement: 'Requires 7-day streak',
      streakInDanger: 'Your streak is in danger!',
      protectionAvailable: 'You have protection available'
    }
  };

  const t = texts[language] || texts.de;

  const milestones = [
    { days: 7, bids: 5, name: '1 Woche' },
    { days: 14, bids: 10, name: '2 Wochen' },
    { days: 30, bids: 20, name: '1 Monat' },
    { days: 60, bids: 35, name: '2 Monate' },
    { days: 90, bids: 50, name: '3 Monate' },
    { days: 180, bids: 100, name: '6 Monate' },
    { days: 365, bids: 200, name: '1 Jahr' }
  ];

  useEffect(() => {
    if (token) {
      fetchStatus();
      fetchClaimedRewards();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/streak-protection/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchClaimedRewards = async () => {
    try {
      const res = await fetch(`${API_URL}/api/streak-protection/claimed-rewards`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setClaimedRewards(data.claimed_milestones || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleActivateProtection = async () => {
    try {
      const res = await fetch(`${API_URL}/api/streak-protection/activate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchStatus();
      } else {
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  const handleUseProtection = async () => {
    try {
      const res = await fetch(`${API_URL}/api/streak-protection/use`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchStatus();
      } else {
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  const handleClaimReward = async (days) => {
    try {
      const res = await fetch(`${API_URL}/api/streak-protection/claim-reward/${days}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchClaimedRewards();
      } else {
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 flex items-center justify-center">
        <Card className="bg-[#1A1A2E] border-gray-200 p-8 text-center">
          <Flame className="w-16 h-16 text-[#F59E0B] mx-auto mb-4" />
          <p className="text-gray-800 text-xl">{t.loginRequired}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="streak-protection-page">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#EF4444] mb-4">
            <Flame className="w-10 h-10 text-gray-800" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{t.title}</h1>
          <p className="text-gray-500">{t.subtitle}</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Laden...</div>
        ) : (
          <>
            {/* Current Streak */}
            <Card className="bg-gradient-to-r from-[#F59E0B]/20 to-[#EF4444]/20 border-[#F59E0B]/30 mb-6">
              <CardContent className="p-6 text-center">
                <Flame className="w-12 h-12 text-[#F59E0B] mx-auto mb-2" />
                <p className="text-gray-500">{t.currentStreak}</p>
                <p className="text-5xl font-bold text-gray-800 my-2">
                  {status?.current_streak || 0}
                </p>
                <p className="text-[#F59E0B]">{t.days}</p>
                
                {!status?.streak_active && status?.current_streak > 0 && (
                  <div className="mt-4 p-3 bg-red-500/20 rounded-lg">
                    <p className="text-red-400 font-bold">{t.streakInDanger}</p>
                    {status?.has_protection && (
                      <Button onClick={handleUseProtection} className="mt-2 bg-[#10B981]">
                        <Shield className="w-4 h-4 mr-2" />
                        {t.useProtection}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Streak Protection */}
            <Card className="bg-[#1A1A2E] border-gray-200 mb-6">
              <CardHeader>
                <CardTitle className="text-gray-800 flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-[#10B981]" />
                  {t.protection}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500 mb-4">{t.protectionInfo}</p>
                
                {status?.has_protection ? (
                  <div className="bg-[#10B981]/20 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-6 h-6 text-[#10B981]" />
                      <span className="text-[#10B981] font-bold">{t.active}</span>
                    </div>
                    <Badge className="bg-[#10B981]">{t.protectionAvailable}</Badge>
                  </div>
                ) : status?.protection_on_cooldown ? (
                  <div className="bg-[#94A3B8]/20 rounded-lg p-4 flex items-center justify-between">
                    <span className="text-gray-500">{t.cooldown}</span>
                    <Badge className="bg-[#94A3B8]/20 text-gray-500">
                      {status.cooldown_days_remaining} {t.daysRemaining}
                    </Badge>
                  </div>
                ) : status?.can_earn_protection ? (
                  <Button onClick={handleActivateProtection} className="w-full bg-[#10B981]">
                    <Shield className="w-4 h-4 mr-2" />
                    {t.activate}
                  </Button>
                ) : (
                  <div className="bg-[#94A3B8]/20 rounded-lg p-4 text-center">
                    <Lock className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-500">{t.requirement}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Milestones */}
            <Card className="bg-[#1A1A2E] border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-800 flex items-center">
                  <Trophy className="w-5 h-5 mr-2 text-[#F59E0B]" />
                  {t.milestones}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {milestones.map((milestone) => {
                    const isReached = (status?.current_streak || 0) >= milestone.days;
                    const isClaimed = claimedRewards.includes(milestone.days);
                    
                    return (
                      <div 
                        key={milestone.days}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          isReached ? 'bg-[#F59E0B]/10' : 'bg-gradient-to-b from-cyan-50 to-cyan-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isReached ? 'bg-[#F59E0B]/20' : 'bg-[#1A1A2E]'
                          }`}>
                            {isClaimed ? (
                              <Check className="w-5 h-5 text-[#10B981]" />
                            ) : isReached ? (
                              <Gift className="w-5 h-5 text-[#F59E0B]" />
                            ) : (
                              <Lock className="w-5 h-5 text-gray-500" />
                            )}
                          </div>
                          <div>
                            <p className={`font-medium ${isReached ? 'text-gray-800' : 'text-gray-500'}`}>
                              {milestone.name}
                            </p>
                            <p className="text-gray-500 text-sm">{milestone.days} {t.days}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={isReached ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#94A3B8]/20 text-gray-500'}>
                            +{milestone.bids} {t.bids}
                          </Badge>
                          {isReached && !isClaimed ? (
                            <Button size="sm" onClick={() => handleClaimReward(milestone.days)} className="bg-[#10B981]">
                              {t.claim}
                            </Button>
                          ) : isClaimed ? (
                            <Badge className="bg-[#10B981]/20 text-[#10B981]">{t.claimed}</Badge>
                          ) : (
                            <Badge className="bg-[#94A3B8]/20 text-gray-500">{t.locked}</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
