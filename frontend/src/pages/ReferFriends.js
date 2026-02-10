import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { 
  Users, Gift, Copy, Share2, Check, Trophy,
  ChevronRight, UserPlus, Coins, Crown
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const pageTexts = {
  de: {
    loginTitle: 'Freunde werben',
    loginDesc: 'Melden Sie sich an, um Ihre Empfehlungen zu verwalten.',
    login: 'Anmelden',
    title: 'Freunde werben',
    subtitle: 'Verdiene Gratis-Gebote für jede erfolgreiche Empfehlung!',
    bidsForYou: 'Gebote für dich',
    perReferral: 'pro erfolgreiche Empfehlung',
    bidsForFriend: 'Gebote für deinen Freund',
    afterFirstPurchase: 'nach erstem Kauf',
    yourLink: 'Dein Empfehlungslink',
    linkLoading: 'Link wird geladen...',
    share: 'Teilen',
    shareText: 'Melde dich bei BidBlitz an und erhalte 10 Gratis-Gebote:',
    linkCopied: 'Link kopiert!',
    totalReferrals: 'Gesamt',
    successful: 'Erfolgreich',
    earnings: 'Verdient',
    bids: 'Gebote',
    pending: 'Ausstehend',
    invitedUsers: 'Eingeladene Nutzer',
    topReferrers: 'Top Empfehler',
    referrals: 'Empfehlungen',
    howItWorks: 'So funktioniert\'s',
    step1Title: 'Link teilen',
    step1Desc: 'Sende deinen Link an Freunde',
    step2Title: 'Freund registriert sich',
    step2Desc: 'Und tätigt einen Kauf',
    step3Title: 'Beide profitieren',
    step3Desc: 'Du bekommst 20, dein Freund 10 Gebote'
  },
  sq: {
    loginTitle: 'Ftoni miq',
    loginDesc: 'Identifikohuni për të menaxhuar rekomandimet tuaja.',
    login: 'Identifikohu',
    title: 'Ftoni miq',
    subtitle: 'Fitoni oferta falas për çdo rekomandim të suksesshëm!',
    bidsForYou: 'Oferta për ju',
    perReferral: 'për rekomandim të suksesshëm',
    bidsForFriend: 'Oferta për mikun tuaj',
    afterFirstPurchase: 'pas blerjes së parë',
    yourLink: 'Linku juaj i rekomandimit',
    linkLoading: 'Linku po ngarkohet...',
    share: 'Ndaj',
    shareText: 'Regjistrohu në BidBlitz dhe merr 10 oferta falas:',
    linkCopied: 'Linku u kopjua!',
    totalReferrals: 'Totali',
    successful: 'I suksesshëm',
    earnings: 'Fituar',
    bids: 'Oferta',
    pending: 'Në pritje',
    invitedUsers: 'Përdoruesit e ftuar',
    topReferrers: 'Rekomanduesit kryesorë',
    referrals: 'Rekomandimet',
    howItWorks: 'Si funksionon',
    step1Title: 'Ndani linkun',
    step1Desc: 'Dërgoni linkun miqve',
    step2Title: 'Miku regjistrohet',
    step2Desc: 'Dhe bën një blerje',
    step3Title: 'Të dy përfitoni',
    step3Desc: 'Ju merrni 20, miku juaj 10 oferta'
  }
};

export default function ReferFriends() {
  const { isAuthenticated, token } = useAuth();
  const { language } = useLanguage();
  const t = pageTexts[language] || pageTexts.de;
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [statsRes, referralsRes, leaderboardRes] = await Promise.all([
        axios.get(`${API}/api/referrals/stats`, { headers }),
        axios.get(`${API}/api/referrals/my-referrals`, { headers }),
        axios.get(`${API}/api/referrals/leaderboard?limit=5`, { headers })
      ]);
      
      setStats(statsRes.data);
      setReferrals(referralsRes.data.referrals || []);
      setLeaderboard(leaderboardRes.data.leaderboard || []);
    } catch (error) {
      console.error('Failed to fetch referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Safe clipboard function that works on all devices
  const safeCopyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers / iOS Safari
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const result = document.execCommand('copy');
        document.body.removeChild(textArea);
        return result;
      }
    } catch (err) {
      console.error('Copy failed:', err);
      return false;
    }
  };

  const copyLink = async () => {
    if (stats?.link) {
      const success = await safeCopyToClipboard(stats.link);
      if (success) {
        setCopied(true);
        toast.success(t.linkCopied);
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error('Kopieren fehlgeschlagen');
      }
    }
  };

  const shareLink = async () => {
    if (navigator.share && stats?.link) {
      try {
        await navigator.share({
          title: 'BidBlitz - Penny Auktionen',
          text: t.shareText,
          url: stats.link
        });
      } catch (err) {
        copyLink();
      }
    } else {
      copyLink();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center bg-gradient-to-b from-cyan-50 to-cyan-100">
        <div className="bg-white p-8 rounded-xl text-center max-w-md shadow-lg border border-gray-200">
          <Users className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-4">{t.loginTitle}</h2>
          <p className="text-gray-600 mb-6">{t.loginDesc}</p>
          <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => navigate('/login')}>
            {t.login}
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center bg-gradient-to-b from-cyan-50 to-cyan-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 bg-gradient-to-b from-cyan-50 to-cyan-100" data-testid="refer-friends-page">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg mb-4">
            <UserPlus className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">{t.title}</h1>
          <p className="text-gray-500 mt-2">{t.subtitle}</p>
        </div>

        {/* Reward Info */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-6 text-white mb-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="text-center p-4 bg-white/10 rounded-xl">
              <Gift className="w-10 h-10 mx-auto mb-2" />
              <p className="text-3xl font-bold">{stats?.reward_per_referral || 20}</p>
              <p className="text-purple-200">{t.bidsForYou}</p>
              <p className="text-xs text-purple-300 mt-1">{t.perReferral}</p>
            </div>
            <div className="text-center p-4 bg-white/10 rounded-xl">
              <Coins className="w-10 h-10 mx-auto mb-2" />
              <p className="text-3xl font-bold">10</p>
              <p className="text-purple-200">{t.bidsForFriend}</p>
              <p className="text-xs text-purple-300 mt-1">{t.afterFirstPurchase}</p>
            </div>
          </div>
        </div>

        {/* Share Link Card */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 mb-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-cyan-500" />
            {t.yourLink}
          </h3>
          
          <div className="flex gap-3">
            <div className="flex-1 bg-gray-100 rounded-xl p-4 font-mono text-sm text-gray-600 break-all">
              {stats?.link || t.linkLoading}
            </div>
            <Button
              onClick={copyLink}
              className={`px-6 ${copied ? 'bg-green-500' : 'bg-cyan-500 hover:bg-cyan-600'} text-white`}
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </Button>
          </div>
          
          <div className="flex gap-3 mt-4">
            <Button
              onClick={shareLink}
              className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
            >
              <Share2 className="w-4 h-4 mr-2" />
              {t.share}
            </Button>
            <Button
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(t.shareText + ' ' + (stats?.link || ''))}`, '_blank')}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              WhatsApp
            </Button>
          </div>
          
          <p className="text-xs text-gray-400 mt-3 text-center">
            Code: <span className="font-mono font-bold">{stats?.code}</span>
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard 
            icon={<Users className="w-5 h-5" />}
            label={t.totalReferrals}
            value={stats?.total_referrals || 0}
            color="blue"
          />
          <StatCard 
            icon={<Check className="w-5 h-5" />}
            label={t.successful}
            value={stats?.successful_referrals || 0}
            color="green"
          />
          <StatCard 
            icon={<Gift className="w-5 h-5" />}
            label={t.earnings}
            value={`${stats?.total_earned || 0} ${t.bids}`}
            color="amber"
          />
          <StatCard 
            icon={<Trophy className="w-5 h-5" />}
            label={t.pending}
            value={stats?.pending_referrals || 0}
            color="purple"
          />
        </div>

        {/* My Referrals */}
        {referrals.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 mb-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-500" />
              {t.invitedUsers}
            </h3>
            <div className="space-y-3">
              {referrals.map((ref) => (
                <div 
                  key={ref.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      ref.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {ref.status === 'completed' ? <Check className="w-5 h-5" /> : <Gift className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{ref.name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(ref.created_at).toLocaleDateString(language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : language === 'tr' ? 'tr-TR' : 'en-US')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {ref.status === 'completed' ? (
                      <span className="text-green-600 font-bold">+{ref.reward_earned} {t.bids}</span>
                    ) : (
                      <span className="text-amber-600 text-sm">{t.pending}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              {t.topReferrers}
            </h3>
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    index === 0 ? 'bg-amber-400 text-white' :
                    index === 1 ? 'bg-gray-400 text-white' :
                    index === 2 ? 'bg-orange-400 text-white' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{entry.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-600">{entry.total_referrals} {t.referrals}</p>
                    <p className="text-xs text-gray-500">+{entry.total_earned} {t.bids}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="mt-6 bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h3 className="font-bold text-gray-800 mb-4">{t.howItWorks}</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-cyan-600 font-bold">1</span>
              </div>
              <p className="font-medium text-gray-800">{t.step1Title}</p>
              <p className="text-sm text-gray-500">{t.step1Desc}</p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-amber-600 font-bold">2</span>
              </div>
              <p className="font-medium text-gray-800">{t.step2Title}</p>
              <p className="text-sm text-gray-500">{t.step2Desc}</p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 font-bold">3</span>
              </div>
              <p className="font-medium text-gray-800">{t.step3Title}</p>
              <p className="text-sm text-gray-500">{t.step3Desc}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    amber: 'bg-amber-50 border-amber-200 text-amber-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600'
  };
  
  return (
    <div className={`p-4 rounded-xl border-2 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
