import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { 
  Share2, Gift, Twitter, Facebook, MessageCircle, Copy, 
  CheckCircle, Trophy, Zap, Users, Link2, Mail, Star
} from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const API = process.env.REACT_APP_BACKEND_URL;

export default function SocialSharing() {
  const { isAuthenticated, token, user } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_shares: 0,
    shares_today: 0,
    rewards_earned: 0,
    pending_rewards: 0
  });
  const [shareHistory, setShareHistory] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [selectedAuction, setSelectedAuction] = useState(null);

  const SHARE_PLATFORMS = [
    { id: 'twitter', name: 'Twitter / X', icon: Twitter, color: 'bg-black', reward: 2 },
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-600', reward: 2 },
    { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, color: 'bg-green-500', reward: 3 },
    { id: 'telegram', name: 'Telegram', icon: MessageCircle, color: 'bg-sky-500', reward: 2 },
    { id: 'email', name: 'E-Mail', icon: Mail, color: 'bg-slate-600', reward: 1 },
    { id: 'copy', name: 'Link kopieren', icon: Copy, color: 'bg-violet-500', reward: 1 }
  ];

  const t = {
    de: {
      title: 'Teilen & Verdienen',
      subtitle: 'Teile Auktionen und verdiene kostenlose Gebote!',
      todayShares: 'Heute geteilt',
      totalRewards: 'Gebote verdient',
      pendingRewards: 'Ausstehend',
      selectAuction: 'Wähle eine Auktion zum Teilen',
      shareVia: 'Teilen über',
      rewardInfo: 'Gebote',
      shareHistory: 'Deine Shares',
      howItWorks: 'So funktioniert\'s',
      step1: 'Wähle eine Auktion',
      step2: 'Teile auf Social Media',
      step3: 'Verdiene Gratis-Gebote',
      dailyLimit: 'Du kannst bis zu 10 Mal pro Tag teilen',
      copied: 'Link kopiert!',
      shared: 'Geteilt! Belohnung wird gutgeschrieben.',
      noAuctions: 'Keine aktiven Auktionen zum Teilen'
    },
    en: {
      title: 'Share & Earn',
      subtitle: 'Share auctions and earn free bids!',
      todayShares: 'Shared Today',
      totalRewards: 'Bids Earned',
      pendingRewards: 'Pending',
      selectAuction: 'Select an auction to share',
      shareVia: 'Share via',
      rewardInfo: 'bids',
      shareHistory: 'Your Shares',
      howItWorks: 'How it works',
      step1: 'Choose an auction',
      step2: 'Share on social media',
      step3: 'Earn free bids',
      dailyLimit: 'You can share up to 10 times per day',
      copied: 'Link copied!',
      shared: 'Shared! Reward will be credited.',
      noAuctions: 'No active auctions to share'
    }
  }[language] || {};

  useEffect(() => {
    fetchData();
  }, [isAuthenticated]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch auctions
      const auctionsRes = await fetch(`${API}/api/auctions?status=active`);
      if (auctionsRes.ok) {
        const data = await auctionsRes.json();
        setAuctions(data.auctions?.slice(0, 12) || []);
      }

      // Fetch share stats if authenticated
      if (isAuthenticated && token) {
        const statsRes = await fetch(`${API}/api/social-sharing/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (statsRes.ok) {
          setStats(await statsRes.json());
        }

        const historyRes = await fetch(`${API}/api/social-sharing/history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setShareHistory(historyData.shares || []);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (platform) => {
    if (!selectedAuction) {
      toast.error('Bitte wähle zuerst eine Auktion');
      return;
    }

    if (!isAuthenticated) {
      toast.error('Bitte melde dich an, um Belohnungen zu verdienen');
      return;
    }

    const shareUrl = `${window.location.origin}/auction/${selectedAuction.id}?ref=${user?.referral_code || ''}`;
    const shareText = `Schau dir diese Auktion an: ${selectedAuction.product?.name || 'Tolle Auktion'} für nur €${selectedAuction.current_price?.toFixed(2)}! 🔥`;

    // Open share dialog based on platform
    let shareWindow = null;
    switch (platform.id) {
      case 'twitter':
        shareWindow = window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
          '_blank',
          'width=600,height=400'
        );
        break;
      case 'facebook':
        shareWindow = window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
          '_blank',
          'width=600,height=400'
        );
        break;
      case 'whatsapp':
        shareWindow = window.open(
          `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`,
          '_blank'
        );
        break;
      case 'telegram':
        shareWindow = window.open(
          `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
          '_blank'
        );
        break;
      case 'email':
        window.location.href = `mailto:?subject=${encodeURIComponent('Check this auction!')}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(shareUrl);
        toast.success(t.copied);
        break;
    }

    // Record share on backend
    try {
      const res = await fetch(`${API}/api/social-sharing/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          auction_id: selectedAuction.id,
          platform: platform.id,
          reward_bids: platform.reward
        })
      });

      if (res.ok) {
        toast.success(`+${platform.reward} ${t.rewardInfo}! ${t.shared}`);
        fetchData();
      }
    } catch (error) {
      console.error('Error recording share:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Navbar />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Share2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800">{t.title}</h1>
          <p className="text-slate-500 mt-2">{t.subtitle}</p>
        </div>

        {/* Stats */}
        {isAuthenticated && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 text-center">
              <Share2 className="w-6 h-6 text-pink-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-800">{stats.shares_today}/10</p>
              <p className="text-sm text-slate-500">{t.todayShares}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 text-center">
              <Gift className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-800">{stats.rewards_earned}</p>
              <p className="text-sm text-slate-500">{t.totalRewards}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 text-center">
              <Zap className="w-6 h-6 text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-800">{stats.pending_rewards}</p>
              <p className="text-sm text-slate-500">{t.pendingRewards}</p>
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl p-6 mb-8 border border-pink-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-pink-500" />
            {t.howItWorks}
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
              <p className="text-slate-600 text-sm">{t.step1}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
              <p className="text-slate-600 text-sm">{t.step2}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
              <p className="text-slate-600 text-sm">{t.step3}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4">{t.dailyLimit}</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Auction Selection */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4">{t.selectAuction}</h3>
            
            {auctions.length === 0 ? (
              <p className="text-slate-400 text-center py-8">{t.noAuctions}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {auctions.map(auction => (
                  <button
                    key={auction.id}
                    onClick={() => setSelectedAuction(auction)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedAuction?.id === auction.id 
                        ? 'border-pink-500 bg-pink-50 ring-2 ring-pink-200' 
                        : 'border-slate-200 hover:border-pink-300'
                    }`}
                  >
                    <img 
                      src={auction.product?.image_url || '/placeholder.png'} 
                      alt={auction.product?.name}
                      className="w-full h-20 object-cover rounded-lg mb-2"
                    />
                    <p className="font-medium text-slate-800 text-sm truncate">{auction.product?.name}</p>
                    <p className="text-pink-600 font-bold">€{auction.current_price?.toFixed(2)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Share Options */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4">{t.shareVia}</h3>
            
            {selectedAuction ? (
              <>
                <div className="mb-4 p-3 bg-slate-50 rounded-xl flex items-center gap-3">
                  <img 
                    src={selectedAuction.product?.image_url || '/placeholder.png'} 
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <div>
                    <p className="font-medium text-slate-800">{selectedAuction.product?.name}</p>
                    <p className="text-sm text-pink-600">€{selectedAuction.current_price?.toFixed(2)}</p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-emerald-500 ml-auto" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {SHARE_PLATFORMS.map(platform => (
                    <Button
                      key={platform.id}
                      onClick={() => handleShare(platform)}
                      className={`${platform.color} hover:opacity-90 text-white justify-start h-auto py-3`}
                      disabled={stats.shares_today >= 10}
                    >
                      <platform.icon className="w-5 h-5 mr-2" />
                      <div className="text-left">
                        <p className="font-medium">{platform.name}</p>
                        <p className="text-xs opacity-80">+{platform.reward} {t.rewardInfo}</p>
                      </div>
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Link2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">{t.selectAuction}</p>
              </div>
            )}
          </div>
        </div>

        {/* Share History */}
        {isAuthenticated && shareHistory.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4">{t.shareHistory}</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {shareHistory.map((share, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Share2 className="w-4 h-4 text-pink-500" />
                    <span className="text-slate-600 text-sm">{share.platform}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-medium">+{share.reward_bids}</span>
                    <span className="text-slate-400 text-xs">
                      {new Date(share.created_at).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
