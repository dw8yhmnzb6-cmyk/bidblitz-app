import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Users, Gift, Copy, Share2, Trophy, Star, CheckCircle, ArrowRight } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ReferralPage() {
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const { token, user } = useAuth();
  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState({
    total_referrals: 0,
    successful_referrals: 0,
    total_bids_earned: 0
  });
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  const texts = {
    de: {
      title: 'Freunde-Bonus',
      subtitle: 'Lade Freunde ein und verdiene Gratis-Gebote!',
      yourCode: 'Dein Empfehlungscode',
      copyCode: 'Code kopieren',
      shareLink: 'Link teilen',
      howItWorks: 'So funktioniert es',
      step1: 'Teile deinen Code mit Freunden',
      step2: 'Dein Freund registriert sich mit deinem Code',
      step3: 'Ihr beide erhaltet 10 Gratis-Gebote!',
      yourStats: 'Deine Statistiken',
      totalReferrals: 'Einladungen',
      successfulReferrals: 'Erfolgreiche',
      bidsEarned: 'Gebote verdient',
      recentReferrals: 'Letzte Empfehlungen',
      noReferrals: 'Noch keine Empfehlungen. Lade Freunde ein!',
      pending: 'Ausstehend',
      completed: 'Abgeschlossen',
      rewards: 'Belohnungen',
      reward1: '10 Gebote für dich',
      reward2: '10 Gebote für deinen Freund',
      reward3: '+5 Bonus ab 5 Empfehlungen',
      copied: 'Code kopiert!',
      shareText: 'Registriere dich bei BidBlitz und erhalte 10 Gratis-Gebote mit meinem Code:'
    },
    en: {
      title: 'Referral Bonus',
      subtitle: 'Invite friends and earn free bids!',
      yourCode: 'Your referral code',
      copyCode: 'Copy code',
      shareLink: 'Share link',
      howItWorks: 'How it works',
      step1: 'Share your code with friends',
      step2: 'Your friend registers with your code',
      step3: 'You both get 10 free bids!',
      yourStats: 'Your Statistics',
      totalReferrals: 'Invitations',
      successfulReferrals: 'Successful',
      bidsEarned: 'Bids earned',
      recentReferrals: 'Recent Referrals',
      noReferrals: 'No referrals yet. Invite your friends!',
      pending: 'Pending',
      completed: 'Completed',
      rewards: 'Rewards',
      reward1: '10 bids for you',
      reward2: '10 bids for your friend',
      reward3: '+5 bonus after 5 referrals',
      copied: 'Code copied!',
      shareText: 'Sign up at BidBlitz and get 10 free bids with my code:'
    },
    sq: {
      title: 'Bonusi i miqve',
      subtitle: 'Ftoni miq dhe fitoni oferta falas!',
      yourCode: 'Kodi juaj i rekomandimit',
      copyCode: 'Kopjo kodin',
      shareLink: 'Ndaj linkun',
      howItWorks: 'Si funksionon',
      step1: 'Ndani kodin tuaj me miqtë',
      step2: 'Miku juaj regjistrohet me kodin tuaj',
      step3: 'Të dy merrni 10 oferta falas!',
      yourStats: 'Statistikat tuaja',
      totalReferrals: 'Ftesat',
      successfulReferrals: 'Të suksesshme',
      bidsEarned: 'Oferta të fituara',
      recentReferrals: 'Rekomandimet e fundit',
      noReferrals: 'Ende asnjë rekomandim. Ftoni miqtë tuaj!',
      pending: 'Në pritje',
      completed: 'Përfunduar',
      rewards: 'Shpërblimet',
      reward1: '10 oferta për ju',
      reward2: '10 oferta për mikun tuaj',
      reward3: '+5 bonus pas 5 rekomandimeve',
      copied: 'Kodi u kopjua!',
      shareText: 'Regjistrohuni në BidBlitz dhe merrni 10 oferta falas me kodin tim:'
    }
  };

  const t = texts[langKey] || texts.de;

  const fetchReferralData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/referral/my-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setReferralCode(data.referral_code || '');
      setStats({
        total_referrals: data.total_referrals || 0,
        successful_referrals: data.successful_referrals || 0,
        total_bids_earned: data.total_bids_earned || 0
      });
      setReferrals(data.recent_referrals || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (token) {
      fetchReferralData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast.success(t.copied);
  };

  const shareLink = () => {
    const url = `${window.location.origin}/register?ref=${referralCode}`;
    const text = `${t.shareText} ${referralCode}\n${url}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'BidBlitz',
        text: text,
        url: url
      });
    } else {
      navigator.clipboard.writeText(text);
      toast.success(t.copied);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="referral-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] mb-4">
            <Users className="w-10 h-10 text-gray-800" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{t.title}</h1>
          <p className="text-gray-500">{t.subtitle}</p>
        </div>

        {/* Referral Code Card */}
        <Card className="bg-gradient-to-r from-[#10B981]/20 to-[#059669]/20 border-[#10B981]/30 mb-6">
          <CardContent className="p-6">
            <p className="text-gray-500 text-sm mb-2">{t.yourCode}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg px-4 py-3 font-mono text-2xl text-[#10B981] text-center">
                {referralCode || '...'}
              </div>
              <div className="flex gap-2">
                <Button onClick={copyCode} className="bg-[#1A1A2E] hover:bg-[#252540] flex-1 sm:flex-none">
                  <Copy className="w-4 h-4 mr-2" />
                  {t.copyCode}
                </Button>
                <Button onClick={shareLink} className="bg-gradient-to-r from-[#10B981] to-[#059669] flex-1 sm:flex-none">
                  <Share2 className="w-4 h-4 mr-2" />
                  {t.shareLink}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-[#1A1A2E] border-gray-200">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-[#7C3AED] mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-800">{stats.total_referrals}</p>
              <p className="text-gray-500 text-sm">{t.totalReferrals}</p>
            </CardContent>
          </Card>
          <Card className="bg-[#1A1A2E] border-gray-200">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-8 h-8 text-[#10B981] mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-800">{stats.successful_referrals}</p>
              <p className="text-gray-500 text-sm">{t.successfulReferrals}</p>
            </CardContent>
          </Card>
          <Card className="bg-[#1A1A2E] border-gray-200">
            <CardContent className="p-4 text-center">
              <Gift className="w-8 h-8 text-[#F59E0B] mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-800">{stats.total_bids_earned}</p>
              <p className="text-gray-500 text-sm">{t.bidsEarned}</p>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="bg-[#1A1A2E] border-gray-200 mb-6">
          <CardHeader>
            <CardTitle className="text-gray-800 flex items-center">
              <Star className="w-5 h-5 mr-2 text-[#F59E0B]" />
              {t.howItWorks}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {[t.step1, t.step2, t.step3].map((step, i) => (
                <div key={i} className="flex items-start gap-3 bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-4">
                  <div className="w-8 h-8 rounded-full bg-[#7C3AED]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#7C3AED] font-bold">{i + 1}</span>
                  </div>
                  <p className="text-gray-500 text-sm">{step}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Rewards Info */}
        <Card className="bg-[#1A1A2E] border-gray-200 mb-6">
          <CardHeader>
            <CardTitle className="text-gray-800 flex items-center">
              <Gift className="w-5 h-5 mr-2 text-[#10B981]" />
              {t.rewards}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-500">
                <CheckCircle className="w-5 h-5 text-[#10B981]" />
                {t.reward1}
              </div>
              <div className="flex items-center gap-3 text-gray-500">
                <CheckCircle className="w-5 h-5 text-[#10B981]" />
                {t.reward2}
              </div>
              <div className="flex items-center gap-3 text-[#F59E0B]">
                <Trophy className="w-5 h-5" />
                {t.reward3}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Referrals */}
        <Card className="bg-[#1A1A2E] border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-800">{t.recentReferrals}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Laden...</div>
            ) : referrals.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                {t.noReferrals}
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map((ref, i) => (
                  <div key={i} className="flex items-center justify-between bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#7C3AED]/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-[#7C3AED]" />
                      </div>
                      <div>
                        <p className="text-gray-800">{ref.username || 'Benutzer'}</p>
                        <p className="text-gray-500 text-xs">
                          {new Date(ref.registered_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge className={ref.completed ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-yellow-500/20 text-yellow-400'}>
                      {ref.completed ? t.completed : t.pending}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
