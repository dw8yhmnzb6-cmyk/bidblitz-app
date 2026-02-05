import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getFeatureTranslation } from '../i18n/featureTranslations';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Share2, Gift, Facebook, Twitter, MessageCircle, Send,
  CheckCircle, Trophy, Coins, ExternalLink
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const SocialSharePage = () => {
  const { token, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [wins, setWins] = useState([]);
  const [shareHistory, setShareHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(null);

  // Use centralized translations
  const t = getFeatureTranslation('socialShare', language);

  const platforms = [
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: '#1877F2' },
    { id: 'twitter', name: 'Twitter/X', icon: Twitter, color: '#1DA1F2' },
    { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, color: '#25D366' },
    { id: 'telegram', name: 'Telegram', icon: Send, color: '#0088CC' }
  ];

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      const [winsRes, historyRes] = await Promise.all([
        axios.get(`${API}/api/social/shareable-wins`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/api/social/my-shares`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setWins(winsRes.data.wins || []);
      setShareHistory(historyRes.data.shares || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (auctionId, platform) => {
    setSharing({ auctionId, platform });
    
    try {
      // Get share links
      const linksRes = await axios.get(`${API}/api/social/share-links/${auctionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const links = linksRes.data.links;
      const shareUrl = links[platform];
      
      // Open share window
      window.open(shareUrl, '_blank', 'width=600,height=400');
      
      // Record share
      const res = await axios.post(`${API}/api/social/share/${auctionId}?platform=${platform}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      if (err.response?.status === 400) {
        toast.info(err.response.data.detail);
      } else {
        toast.error('Fehler beim Teilen');
      }
    } finally {
      setSharing(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <Share2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl text-gray-800 mb-2">Bitte anmelden</h2>
          <p className="text-gray-500">Du musst angemeldet sein um deine Gewinne zu teilen.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-white rounded w-1/3 mx-auto"></div>
            <div className="h-32 bg-white rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  const totalEarned = shareHistory.reduce((sum, s) => sum + (s.bonus_awarded || 0), 0);
  const shareableWins = wins.filter(w => w.can_share);

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="social-share-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-500/30 mb-4">
            <Share2 className="w-5 h-5 text-blue-400" />
            <span className="text-blue-400 font-bold">Social Bonus</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-3">{t.title}</h1>
          <p className="text-gray-500 text-lg">{t.subtitle}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="glass-card rounded-xl p-6 text-center bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
            <Coins className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-3xl font-bold text-green-400">{totalEarned}</p>
            <p className="text-sm text-gray-500">{t.totalEarned}</p>
          </div>
          <div className="glass-card rounded-xl p-6 text-center bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30">
            <Share2 className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className="text-3xl font-bold text-blue-400">{shareHistory.length}</p>
            <p className="text-sm text-gray-500">{t.totalShares}</p>
          </div>
        </div>

        {/* Bonus Info */}
        <div className="glass-card rounded-xl p-4 mb-8 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
          <div className="flex items-center justify-center gap-3">
            <Gift className="w-6 h-6 text-yellow-400" />
            <span className="text-gray-800">{t.bonusPerShare}:</span>
            <span className="text-2xl font-bold text-yellow-400">3 {t.bids}</span>
          </div>
        </div>

        {/* Shareable Wins */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            {t.shareableWins} ({shareableWins.length})
          </h2>
          
          {wins.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl text-gray-800 mb-2">{t.noWins}</h3>
              <p className="text-gray-500">{t.noWinsDesc}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {wins.map(win => (
                <div 
                  key={win.auction_id}
                  className={`glass-card rounded-xl p-4 ${win.can_share ? 'border-green-500/30' : 'border-gray-700'}`}
                  data-testid={`win-${win.auction_id}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Product Info */}
                    <div className="flex items-center gap-4">
                      {win.product?.image_url ? (
                        <img 
                          src={win.product.image_url} 
                          alt={win.product_name}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-white flex items-center justify-center">
                          <Trophy className="w-8 h-8 text-yellow-400" />
                        </div>
                      )}
                      <div>
                        <h4 className="text-gray-800 font-bold">{win.product_name || 'Produkt'}</h4>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-green-400">
                            {t.wonFor}: €{win.final_price?.toFixed(2)}
                          </span>
                          {win.retail_price && (
                            <span className="text-gray-500">
                              {t.savings}: €{(win.retail_price - win.final_price).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Share Buttons */}
                    <div className="flex items-center gap-2">
                      {win.can_share ? (
                        <>
                          <span className="text-xs text-green-400 mr-2">+{win.bonus_bids} {t.bids}</span>
                          {platforms.map(platform => (
                            <Button
                              key={platform.id}
                              size="sm"
                              onClick={() => handleShare(win.auction_id, platform.id)}
                              disabled={sharing?.auctionId === win.auction_id}
                              style={{ backgroundColor: platform.color }}
                              className="text-gray-800"
                            >
                              <platform.icon className="w-4 h-4" />
                            </Button>
                          ))}
                        </>
                      ) : (
                        <span className="flex items-center gap-2 text-gray-500 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          {t.alreadyShared}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Share History */}
        {shareHistory.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">{t.shareHistory}</h2>
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm text-gray-500">{t.platform}</th>
                    <th className="px-4 py-3 text-left text-sm text-gray-500">Datum</th>
                    <th className="px-4 py-3 text-right text-sm text-gray-500">{t.earnedBids}</th>
                  </tr>
                </thead>
                <tbody>
                  {shareHistory.slice(0, 10).map((share, idx) => {
                    const platform = platforms.find(p => p.id === share.platform);
                    return (
                      <tr key={idx} className="border-t border-white/5">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {platform && <platform.icon className="w-4 h-4" style={{ color: platform.color }} />}
                            <span className="text-gray-800">{platform?.name || share.platform}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-sm">
                          {new Date(share.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-green-400 font-bold">+{share.bonus_awarded}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialSharePage;
