import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { safeCopyToClipboard } from '../utils/clipboard';
import { Button } from '../components/ui/button';
import { 
  Share2, Gift, Trophy, Twitter, Facebook, 
  MessageCircle, Copy, Check, ChevronRight, 
  Zap, Star, Users, TrendingUp, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

const API = process.env.REACT_APP_BACKEND_URL;

export default function SocialSharingRewards() {
  const { isAuthenticated, token, user } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total_shares: 0, total_rewards: 0, shares_this_week: 0 });
  const [shareHistory, setShareHistory] = useState([]);
  const [availableRewards, setAvailableRewards] = useState([]);
  const [copied, setCopied] = useState(false);

  const t = {
    de: {
      title: 'Social Sharing Rewards',
      subtitle: 'Teile bidblitz.ae und verdiene Gratis-Gebote!',
      totalShares: 'Geteilte Posts',
      totalRewards: 'Verdiente Gebote',
      thisWeek: 'Diese Woche',
      shareNow: 'Jetzt teilen',
      shareOnTwitter: 'Auf Twitter teilen',
      shareOnFacebook: 'Auf Facebook teilen',
      shareOnWhatsApp: 'Per WhatsApp teilen',
      copyLink: 'Link kopieren',
      copied: 'Kopiert!',
      rewards: 'Belohnungen',
      history: 'Verlauf',
      noShares: 'Noch keine geteilten Posts',
      startSharing: 'Teile jetzt und verdiene Gebote!',
      perShare: 'pro Teilen',
      bonus: 'Bonus',
      shareText: 'Ich spare gerade bei bidblitz.ae! 🎉 Penny-Auktionen mit bis zu 90% Rabatt. Jetzt kostenlos anmelden:',
      howItWorks: 'So funktioniert\'s',
      step1: 'Wähle eine Plattform',
      step2: 'Teile deinen Link',
      step3: 'Erhalte Gebote',
      earnMore: 'Mehr verdienen',
      weeklyBonus: 'Wöchentlicher Bonus',
      weeklyBonusDesc: '10+ Shares = Extra 50 Gebote',
      streakBonus: 'Streak Bonus',
      streakBonusDesc: '7 Tage in Folge = 100 Gebote'
    },
    en: {
      title: 'Social Sharing Rewards',
      subtitle: 'Share bidblitz.ae and earn free bids!',
      totalShares: 'Total Shares',
      totalRewards: 'Bids Earned',
      thisWeek: 'This Week',
      shareNow: 'Share Now',
      shareOnTwitter: 'Share on Twitter',
      shareOnFacebook: 'Share on Facebook',
      shareOnWhatsApp: 'Share via WhatsApp',
      copyLink: 'Copy Link',
      copied: 'Copied!',
      rewards: 'Rewards',
      history: 'History',
      noShares: 'No shares yet',
      startSharing: 'Start sharing and earn bids!',
      perShare: 'per share',
      bonus: 'Bonus',
      shareText: 'I\'m saving big at bidblitz.ae! 🎉 Penny auctions with up to 90% off. Join free:',
      howItWorks: 'How it works',
      step1: 'Choose a platform',
      step2: 'Share your link',
      step3: 'Get bids',
      earnMore: 'Earn More',
      weeklyBonus: 'Weekly Bonus',
      weeklyBonusDesc: '10+ shares = Extra 50 bids',
      streakBonus: 'Streak Bonus',
      streakBonusDesc: '7 days in a row = 100 bids'
    }
  }[langKey] || {};

  const referralLink = `${window.location.origin}/register?ref=${user?.referral_code || 'BIDBLITZ'}`;

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, historyRes] = await Promise.all([
        fetch(`${API}/api/social-rewards/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/social-rewards/history`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setShareHistory(data.shares || []);
      }
    } catch (error) {
      console.error('Error fetching social data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (platform) => {
    const shareUrl = encodeURIComponent(referralLink);
    const shareTextEncoded = encodeURIComponent(t.shareText);
    
    let url = '';
    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${shareTextEncoded}&url=${shareUrl}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${shareTextEncoded}`;
        break;
      case 'whatsapp':
        url = `https://wa.me/?text=${shareTextEncoded}%20${shareUrl}`;
        break;
      default:
        return;
    }

    // Open share window
    window.open(url, '_blank', 'width=600,height=400');

    // Track the share
    try {
      const res = await fetch(`${API}/api/social-rewards/track-share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ platform })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`+${data.bids_earned || 3} Gebote verdient! 🎉`);
        fetchData(); // Refresh stats
      }
    } catch (error) {
      console.error('Error tracking share:', error);
    }
  };

  const copyLink = async () => {
    const success = await safeCopyToClipboard(referralLink);
    if (success) {
      setCopied(true);
      toast.success(t.copied);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareOptions = [
    { 
      platform: 'twitter', 
      icon: Twitter, 
      label: t.shareOnTwitter, 
      color: 'bg-[#1DA1F2]',
      bids: 3 
    },
    { 
      platform: 'facebook', 
      icon: Facebook, 
      label: t.shareOnFacebook, 
      color: 'bg-[#4267B2]',
      bids: 3 
    },
    { 
      platform: 'whatsapp', 
      icon: MessageCircle, 
      label: t.shareOnWhatsApp, 
      color: 'bg-[#25D366]',
      bids: 3 
    }
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <Share2 className="w-16 h-16 text-violet-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-slate-800">{t.title}</h1>
          <p className="text-slate-500 mt-2">Bitte melde dich an, um Rewards zu verdienen!</p>
          <Button 
            onClick={() => window.location.href = '/login'} 
            className="mt-6 bg-violet-500 hover:bg-violet-600"
          >
            Jetzt anmelden
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Share2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800">{t.title}</h1>
          <p className="text-slate-500 mt-2">{t.subtitle}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center mx-auto mb-3">
              <Share2 className="w-6 h-6 text-pink-600" />
            </div>
            <p className="text-3xl font-bold text-slate-800">{stats.total_shares}</p>
            <p className="text-sm text-slate-500">{t.totalShares}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
              <Zap className="w-6 h-6 text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-slate-800">{stats.total_rewards}</p>
            <p className="text-sm text-slate-500">{t.totalRewards}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-slate-800">{stats.shares_this_week}</p>
            <p className="text-sm text-slate-500">{t.thisWeek}</p>
          </div>
        </div>

        {/* Share Options */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-pink-500" />
            {t.shareNow}
          </h2>
          
          {/* Referral Link Box */}
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl mb-6">
            <input 
              type="text" 
              value={referralLink} 
              readOnly 
              className="flex-1 bg-transparent text-sm text-slate-600 outline-none truncate"
            />
            <Button 
              onClick={copyLink} 
              size="sm"
              className={copied ? 'bg-emerald-500' : 'bg-slate-700'}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>

          {/* Share Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {shareOptions.map((option) => (
              <button
                key={option.platform}
                onClick={() => handleShare(option.platform)}
                className={`${option.color} text-white rounded-xl p-4 flex items-center justify-between hover:opacity-90 transition-opacity`}
              >
                <div className="flex items-center gap-3">
                  <option.icon className="w-6 h-6" />
                  <span className="font-medium">{option.platform.charAt(0).toUpperCase() + option.platform.slice(1)}</span>
                </div>
                <span className="px-2 py-1 bg-white/20 rounded-lg text-sm font-bold">
                  +{option.bids}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* How it Works */}
        <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-6 mb-8 text-white">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Star className="w-5 h-5" />
            {t.howItWorks}
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold">1</span>
              </div>
              <p className="text-sm font-medium">{t.step1}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold">2</span>
              </div>
              <p className="text-sm font-medium">{t.step2}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold">3</span>
              </div>
              <p className="text-sm font-medium">{t.step3}</p>
            </div>
          </div>
        </div>

        {/* Bonus Rewards */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            {t.earnMore}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-amber-800">{t.weeklyBonus}</p>
                  <p className="text-sm text-amber-600">{t.weeklyBonusDesc}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-2 bg-amber-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${Math.min((stats.shares_this_week / 10) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-amber-700">
                  {stats.shares_this_week}/10
                </span>
              </div>
            </div>
            <div className="p-4 bg-violet-50 rounded-xl border border-violet-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-violet-800">{t.streakBonus}</p>
                  <p className="text-sm text-violet-600">{t.streakBonusDesc}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-1">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <div 
                    key={day}
                    className={`flex-1 h-2 rounded-full ${
                      day <= (stats.current_streak || 0) ? 'bg-violet-500' : 'bg-violet-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Share History */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            {t.history}
          </h2>
          {shareHistory.length === 0 ? (
            <div className="text-center py-12">
              <Share2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t.noShares}</p>
              <p className="text-sm text-slate-400">{t.startSharing}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {shareHistory.map((share, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      share.platform === 'twitter' ? 'bg-[#1DA1F2]' :
                      share.platform === 'facebook' ? 'bg-[#4267B2]' :
                      'bg-[#25D366]'
                    }`}>
                      {share.platform === 'twitter' && <Twitter className="w-5 h-5 text-white" />}
                      {share.platform === 'facebook' && <Facebook className="w-5 h-5 text-white" />}
                      {share.platform === 'whatsapp' && <MessageCircle className="w-5 h-5 text-white" />}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 capitalize">{share.platform}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(share.created_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-bold">
                    +{share.bids_earned} Gebote
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
