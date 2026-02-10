import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Users, Copy, Share2, Trophy, Gift, Crown, Medal,
  TrendingUp, Calendar, ChevronRight, Star, Zap, Check
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const RANK_COLORS = {
  'Starter': 'text-gray-500',
  'Bronze-Werber': 'text-amber-600',
  'Silber-Werber': 'text-gray-600',
  'Gold-Werber': 'text-yellow-400',
  'Platin-Werber': 'text-cyan-400',
  'Diamant-Werber': 'text-purple-400',
  'Legende': 'text-yellow-500'
};

const ReferralDashboard = () => {
  const { token, isAuthenticated } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const [referralData, setReferralData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myReferrals, setMyReferrals] = useState([]);
  const [period, setPeriod] = useState('all');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const texts = {
    de: {
      title: 'Kunden werben Kunden',
      subtitle: 'Empfehle BidBlitz und verdiene Gratis-Gebote!',
      yourCode: 'Dein Empfehlungscode',
      yourLink: 'Dein Empfehlungslink',
      copy: 'Kopieren',
      copied: 'Kopiert!',
      share: 'Teilen',
      stats: 'Deine Statistiken',
      totalReferrals: 'Geworbene Kunden',
      successfulReferrals: 'Erfolgreiche Empfehlungen',
      bidsEarned: 'Verdiente Gebote',
      yourRank: 'Dein Rang',
      leaderboard: 'Werber-Rangliste',
      all: 'Gesamt',
      month: 'Diesen Monat',
      week: 'Diese Woche',
      position: 'Platz',
      referrals: 'Empfehlungen',
      myReferrals: 'Meine Empfehlungen',
      noReferrals: 'Noch keine Empfehlungen',
      howItWorks: 'So funktioniert\'s',
      step1: '1. Teile deinen Code mit Freunden',
      step2: '2. Sie melden sich an mit deinem Code',
      step3: '3. Bei ihrem ersten Kauf: Ihr beide bekommt Bonus!',
      step3Detail: 'Du: 10 Gebote • Freund: 5 Gebote',
      vipBonus: '🌟 VIP+ Bonus: 20 Gebote bei Abo-Empfehlungen!',
      prizes: 'Top-Werber gewinnen jeden Monat Preise!',
      nextRank: 'Noch {n} Empfehlungen bis',
      loginRequired: 'Bitte einloggen',
      referralsCount: 'Empfehlungen',
      stillNeeded: 'Noch',
      until: 'bis',
      bids: 'Gebote',
      waitingForPurchase: 'Warte auf Kauf'
    },
    en: {
      title: 'Refer a Friend',
      subtitle: 'Recommend BidBlitz and earn free bids!',
      yourCode: 'Your Referral Code',
      yourLink: 'Your Referral Link',
      copy: 'Copy',
      copied: 'Copied!',
      share: 'Share',
      stats: 'Your Statistics',
      totalReferrals: 'Total Referrals',
      successfulReferrals: 'Successful Referrals',
      bidsEarned: 'Bids Earned',
      yourRank: 'Your Rank',
      leaderboard: 'Referral Leaderboard',
      all: 'All Time',
      month: 'This Month',
      week: 'This Week',
      position: 'Position',
      referrals: 'Referrals',
      myReferrals: 'My Referrals',
      noReferrals: 'No referrals yet',
      howItWorks: 'How it Works',
      step1: '1. Share your code with friends',
      step2: '2. They sign up with your code',
      step3: '3. On their first purchase: You both get bonus!',
      step3Detail: 'You: 10 bids • Friend: 5 bids',
      vipBonus: '🌟 VIP+ Bonus: 20 bids for subscription referrals!',
      prizes: 'Top referrers win prizes every month!',
      nextRank: '{n} more referrals until',
      loginRequired: 'Please login',
      referralsCount: 'Referrals',
      stillNeeded: 'Still',
      until: 'until',
      bids: 'Bids',
      waitingForPurchase: 'Waiting for purchase'
    },
    sq: {
      title: 'Ftoni miq',
      subtitle: 'Rekomandoni BidBlitz dhe fitoni oferta falas!',
      yourCode: 'Kodi juaj i rekomandimit',
      yourLink: 'Linku juaj i rekomandimit',
      copy: 'Kopjo',
      copied: 'U kopjua!',
      share: 'Ndaj',
      stats: 'Statistikat tuaja',
      totalReferrals: 'Klientë të ftuar',
      successfulReferrals: 'Rekomandimet e suksesshme',
      bidsEarned: 'Oferta të fituara',
      yourRank: 'Rangu juaj',
      leaderboard: 'Renditja e rekomanduesve',
      all: 'Totali',
      month: 'Këtë muaj',
      week: 'Këtë javë',
      position: 'Pozicioni',
      referrals: 'Rekomandimet',
      myReferrals: 'Rekomandimet e mia',
      noReferrals: 'Ende asnjë rekomandim',
      howItWorks: 'Si funksionon',
      step1: '1. Ndani kodin tuaj me miqtë',
      step2: '2. Ata regjistrohen me kodin tuaj',
      step3: '3. Në blerjen e parë: Të dy merrni bonus!',
      step3Detail: 'Ju: 10 oferta • Miku: 5 oferta',
      vipBonus: '🌟 VIP+ Bonus: 20 oferta për rekomandimet e abonimit!',
      prizes: 'Rekomanduesit kryesorë fitojnë çmime çdo muaj!',
      nextRank: 'Ende {n} rekomandimet deri',
      loginRequired: 'Ju lutemi identifikohuni',
      referralsCount: 'Rekomandimet',
      stillNeeded: 'Ende',
      until: 'deri',
      bids: 'Oferta',
      waitingForPurchase: 'Duke pritur blerjen'
    }
  };
  const t = texts[langKey] || texts.de;

  useEffect(() => {
    if (token) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [token, period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [codeRes, leaderboardRes, referralsRes] = await Promise.all([
        axios.get(`${API}/api/referral/my-code`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/api/referral/leaderboard?period=${period}`),
        axios.get(`${API}/api/referral/my-referrals`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setReferralData(codeRes.data);
      setLeaderboard(leaderboardRes.data.leaderboard || []);
      setMyReferrals(referralsRes.data.referrals || []);
    } catch (err) {
      console.error('Error fetching referral data:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (navigator.share && referralData?.referral_link) {
      navigator.share({
        title: 'BidBlitz - Penny Auktionen',
        text: 'Melde dich bei BidBlitz an und erhalte 5 Gratis-Gebote!',
        url: referralData.referral_link
      });
    } else {
      copyToClipboard(referralData?.referral_link);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-12 px-4">
        <div className="max-w-lg mx-auto text-center">
          <Users className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{t.title}</h1>
          <p className="text-gray-500 mb-6">{t.loginRequired}</p>
          <Button onClick={() => window.location.href = '/login'} className="bg-purple-500">
            Login
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Users className="w-10 h-10 text-purple-400" />
            <h1 className="text-3xl font-bold text-gray-800">{t.title}</h1>
          </div>
          <p className="text-purple-400 text-lg">{t.subtitle}</p>
        </div>

        {/* Referral Code Card */}
        <div className="glass-card rounded-xl p-6 mb-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Code */}
            <div>
              <label className="text-gray-500 text-sm">{t.yourCode}</label>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-[#1A1A2E] rounded-lg px-4 py-3 font-mono text-2xl text-purple-400 font-bold text-center">
                  {referralData?.referral_code}
                </div>
                <Button 
                  onClick={() => copyToClipboard(referralData?.referral_code)}
                  className="bg-purple-500 hover:bg-purple-600"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </Button>
              </div>
            </div>
            
            {/* Link */}
            <div>
              <label className="text-gray-500 text-sm">{t.yourLink}</label>
              <div className="flex items-center gap-2 mt-1">
                <Input 
                  value={referralData?.referral_link || ''}
                  readOnly
                  className="bg-[#1A1A2E] border-gray-200 text-gray-800 text-sm"
                />
                <Button 
                  onClick={shareLink}
                  className="bg-gradient-to-r from-purple-500 to-pink-500"
                >
                  <Share2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-card rounded-xl p-4 text-center">
            <Users className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{referralData?.stats?.total_referrals || 0}</p>
            <p className="text-gray-500 text-sm">{t.totalReferrals}</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <Check className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{referralData?.stats?.successful_referrals || 0}</p>
            <p className="text-gray-500 text-sm">{t.successfulReferrals}</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{referralData?.stats?.total_bids_earned || 0}</p>
            <p className="text-gray-500 text-sm">{t.bidsEarned}</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <Trophy className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <p className={`text-2xl font-bold ${RANK_COLORS[referralData?.stats?.rank_title] || 'text-gray-800'}`}>
              #{referralData?.stats?.rank || '-'}
            </p>
            <p className="text-gray-500 text-sm">{t.yourRank}</p>
          </div>
        </div>

        {/* Rank Progress */}
        {referralData?.stats?.rank_title && (
          <div className="glass-card rounded-xl p-4 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className={`w-8 h-8 ${RANK_COLORS[referralData?.stats?.rank_title]}`} />
                <div>
                  <p className={`font-bold text-lg ${RANK_COLORS[referralData?.stats?.rank_title]}`}>
                    {referralData?.stats?.rank_title}
                  </p>
                  <p className="text-gray-500 text-sm">
                    {referralData?.stats?.total_referrals || 0} {t.referralsCount}
                  </p>
                </div>
              </div>
              {referralData?.stats?.next_rank && (
                <div className="text-right">
                  <p className="text-gray-500 text-sm">
                    {t.stillNeeded} {referralData.stats.next_rank.referrals_needed} {t.until}
                  </p>
                  <p className={`font-bold ${RANK_COLORS[referralData.stats.next_rank.title]}`}>
                    {referralData.stats.next_rank.icon} {referralData.stats.next_rank.title}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* How it Works */}
        <div className="glass-card rounded-xl p-6 mb-8">
          <h3 className="text-gray-800 font-bold text-lg mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-pink-400" />
            {t.howItWorks}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">1</div>
              <div>
                <p className="text-gray-800 font-medium">{t.step1}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold">2</div>
              <div>
                <p className="text-gray-800 font-medium">{t.step2}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">3</div>
              <div>
                <p className="text-gray-800 font-medium">{t.step3}</p>
                {t.step3Detail && <p className="text-gray-500 text-sm">{t.step3Detail}</p>}
              </div>
            </div>
          </div>
          {/* VIP+ Bonus Info */}
          <div className="p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/30 mt-4">
            <p className="text-center text-yellow-400 font-medium">{t.vipBonus}</p>
          </div>
          <p className="text-center text-pink-400 mt-4 font-medium">
            🏆 {t.prizes}
          </p>
        </div>

        {/* Leaderboard */}
        <div className="glass-card rounded-xl overflow-hidden mb-8">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-gray-800 font-bold text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              {t.leaderboard}
            </h3>
            <div className="flex gap-2">
              {['all', 'month', 'week'].map(p => (
                <Button
                  key={p}
                  size="sm"
                  variant={period === p ? "default" : "outline"}
                  onClick={() => setPeriod(p)}
                  className={period === p ? "bg-purple-500" : ""}
                >
                  {t[p]}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="divide-y divide-white/5">
            {leaderboard.length === 0 ? (
              <p className="text-center text-gray-500 py-8">{t.noReferrals}</p>
            ) : (
              leaderboard.map((entry, idx) => (
                <div 
                  key={entry.user_id}
                  className={`flex items-center justify-between p-4 ${idx < 3 ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      idx === 1 ? 'bg-gray-400/20 text-gray-600' :
                      idx === 2 ? 'bg-amber-600/20 text-amber-500' :
                      'bg-white/10 text-gray-500'
                    }`}>
                      {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `#${entry.position}`}
                    </div>
                    <div>
                      <p className="text-gray-800 font-medium">{entry.name}</p>
                      <p className={`text-sm ${RANK_COLORS[entry.rank_title]}`}>
                        {entry.rank_icon} {entry.rank_title}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-purple-400 font-bold text-lg">{entry.total_referrals}</p>
                    <p className="text-gray-500 text-sm">{t.referrals}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* My Referrals */}
        {myReferrals.length > 0 && (
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-gray-800 font-bold text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                {t.myReferrals} ({myReferrals.length})
              </h3>
            </div>
            <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
              {myReferrals.map(ref => (
                <div key={ref.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-gray-800 font-medium">{ref.referred_name}</p>
                    <p className="text-gray-500 text-sm">
                      {new Date(ref.created_at).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  <div className="text-right">
                    {ref.has_purchased ? (
                      <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-sm flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        +{ref.reward_bids} {t.bids}
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full bg-gray-500/20 text-gray-500 text-sm">
                        {t.waitingForPurchase}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralDashboard;
