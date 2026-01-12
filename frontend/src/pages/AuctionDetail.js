import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Timer, Users, Zap, ArrowLeft, Trophy, Tag, Package, Bot } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AuctionDetail() {
  const { id } = useParams();
  const { isAuthenticated, token, user, updateBidsBalance } = useAuth();
  const { t } = useLanguage();
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isUrgent, setIsUrgent] = useState(false);
  
  // Autobidder state
  const [showAutobidder, setShowAutobidder] = useState(false);
  const [maxPrice, setMaxPrice] = useState('');
  const [settingAutobidder, setSettingAutobidder] = useState(false);

  useEffect(() => {
    fetchAuction();
    const interval = setInterval(fetchAuction, 3000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (!auction) return;

    const calculateTimeLeft = () => {
      const endTime = new Date(auction.end_time);
      const now = new Date();
      const diff = endTime - now;

      if (diff <= 0) {
        return { hours: 0, minutes: 0, seconds: 0 };
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      return { hours, minutes, seconds };
    };

    const timer = setInterval(() => {
      const newTime = calculateTimeLeft();
      setTimeLeft(newTime);
      setIsUrgent(newTime.hours === 0 && newTime.minutes === 0 && newTime.seconds <= 10);
    }, 1000);

    setTimeLeft(calculateTimeLeft());

    return () => clearInterval(timer);
  }, [auction]);

  const fetchAuction = async () => {
    try {
      const response = await axios.get(`${API}/auctions/${id}`);
      setAuction(response.data);
    } catch (error) {
      console.error('Error fetching auction:', error);
      toast.error('Auktion nicht gefunden');
    } finally {
      setLoading(false);
    }
  };

  const handleBid = async () => {
    if (!isAuthenticated) {
      toast.error('Bitte melden Sie sich an, um zu bieten');
      return;
    }

    if (user?.bids_balance < 1) {
      toast.error('Keine Gebote mehr verfügbar. Bitte kaufen Sie mehr Gebote.');
      return;
    }

    setBidding(true);
    try {
      const response = await axios.post(
        `${API}/auctions/${id}/bid`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Gebot erfolgreich platziert!');
      updateBidsBalance(response.data.bids_remaining);
      fetchAuction();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Bieten');
    } finally {
      setBidding(false);
    }
  };

  const handleSetAutobidder = async () => {
    if (!maxPrice || parseFloat(maxPrice) <= 0) {
      toast.error('Bitte geben Sie einen gültigen Maximalpreis ein');
      return;
    }

    if (parseFloat(maxPrice) <= auction.current_price) {
      toast.error('Maximalpreis muss höher sein als der aktuelle Preis');
      return;
    }

    setSettingAutobidder(true);
    try {
      await axios.post(
        `${API}/autobidder/create`,
        {
          auction_id: id,
          max_price: parseFloat(maxPrice)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Autobidder aktiviert! Er wird automatisch für Sie bieten.');
      setShowAutobidder(false);
      setMaxPrice('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Aktivieren');
    } finally {
      setSettingAutobidder(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-8">
            <div className="h-8 w-48 bg-[#181824] rounded" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="aspect-square bg-[#181824] rounded-2xl" />
              <div className="space-y-6">
                <div className="h-10 bg-[#181824] rounded" />
                <div className="h-20 bg-[#181824] rounded" />
                <div className="h-16 bg-[#181824] rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Auktion nicht gefunden</h2>
          <Link to="/auctions">
            <Button className="btn-primary">Zurück zu Auktionen</Button>
          </Link>
        </div>
      </div>
    );
  }

  const product = auction.product || {};
  const isEnded = auction.status === 'ended' || (timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0);
  const formatTime = (num) => String(num).padStart(2, '0');
  const savings = product.retail_price ? ((product.retail_price - auction.current_price) / product.retail_price * 100).toFixed(0) : 0;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="auction-detail-page">
      <div className="max-w-6xl mx-auto">
        {/* Back button */}
        <Link to="/auctions" className="inline-flex items-center gap-2 text-[#94A3B8] hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')} zu Auktionen
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Image */}
          <div className="space-y-4">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#181824]">
              <img
                src={product.image_url || 'https://via.placeholder.com/600'}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {isEnded ? (
                <div className="absolute top-4 right-4 px-4 py-2 rounded-full bg-[#EF4444] text-white font-bold">
                  {t('auctions.ended')}
                </div>
              ) : (
                <div className="absolute top-4 right-4 px-4 py-2 rounded-full bg-[#10B981] text-white font-bold animate-pulse">
                  ● {t('auctions.live')}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="glass-card p-6 rounded-xl space-y-4">
              <h3 className="text-lg font-bold text-white">Produktdetails</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Tag className="w-5 h-5 text-[#7C3AED]" />
                  <div>
                    <p className="text-[#94A3B8] text-sm">{t('admin.category')}</p>
                    <p className="text-white font-medium">{product.category || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-[#06B6D4]" />
                  <div>
                    <p className="text-[#94A3B8] text-sm">{t('auctions.rrp')}</p>
                    <p className="text-white font-medium">€{product.retail_price?.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <p className="text-[#94A3B8]">{product.description}</p>
            </div>
          </div>

          {/* Auction Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2" data-testid="auction-title">
                {product.name}
              </h1>
              <p className="text-[#94A3B8]">Auktion #{auction.id.slice(0, 8)}</p>
            </div>

            {/* Timer */}
            <div className={`glass-card p-6 rounded-xl ${isUrgent && !isEnded ? 'glow-urgency' : ''}`}>
              <div className="flex items-center gap-3 mb-4">
                <Timer className={`w-6 h-6 ${isUrgent && !isEnded ? 'text-[#EF4444]' : 'text-[#06B6D4]'}`} />
                <span className="text-[#94A3B8]">Verbleibende Zeit</span>
              </div>
              {isEnded ? (
                <p className="text-3xl font-bold text-[#EF4444] font-mono">AUKTION {t('auctions.ended').toUpperCase()}</p>
              ) : (
                <div className="flex gap-4">
                  {[
                    { value: timeLeft.hours, label: 'Std' },
                    { value: timeLeft.minutes, label: 'Min' },
                    { value: timeLeft.seconds, label: 'Sek' }
                  ].map((item, index) => (
                    <div key={index} className="text-center">
                      <div className={`text-4xl font-bold font-mono ${isUrgent ? 'text-[#EF4444] timer-urgent' : 'text-white'}`}>
                        {formatTime(item.value)}
                      </div>
                      <div className="text-[#94A3B8] text-sm">{item.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Price & Stats */}
            <div className="glass-card p-6 rounded-xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#94A3B8] text-sm uppercase tracking-wider mb-1">{t('auctions.currentPrice')}</p>
                  <p className="text-4xl font-bold text-[#06B6D4] font-mono" data-testid="current-price">
                    €{auction.current_price?.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[#94A3B8] text-sm uppercase tracking-wider mb-1">Ersparnis</p>
                  <p className="text-2xl font-bold text-[#10B981]">{savings}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#7C3AED]" />
                  <div>
                    <p className="text-[#94A3B8] text-sm">{t('auctions.bids')}</p>
                    <p className="text-white font-bold" data-testid="total-bids">{auction.total_bids}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#F59E0B]" />
                  <div>
                    <p className="text-[#94A3B8] text-sm">Inkrement</p>
                    <p className="text-white font-bold">+€{auction.bid_increment?.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Last Bidder */}
              {auction.last_bidder_name && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#181824]">
                  <span className="text-[#94A3B8]">{t('auctions.lastBidder')}:</span>
                  <span className="text-[#A78BFA] font-bold">{auction.last_bidder_name}</span>
                </div>
              )}

              {/* Winner */}
              {isEnded && auction.winner_name && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30">
                  <Trophy className="w-8 h-8 text-[#10B981]" />
                  <div>
                    <p className="text-[#94A3B8] text-sm">{t('auctions.winner')}</p>
                    <p className="text-[#10B981] font-bold text-lg">{auction.winner_name}</p>
                  </div>
                </div>
              )}

              {/* Bid Buttons */}
              {!isEnded && (
                <div className="space-y-4">
                  <Button
                    onClick={handleBid}
                    disabled={!isAuthenticated || bidding}
                    className="w-full btn-bid py-4 text-lg h-auto"
                    data-testid="place-bid-btn"
                  >
                    {bidding ? (
                      'Biete...'
                    ) : (
                      <>
                        <Zap className="w-5 h-5 mr-2" />
                        Jetzt bieten
                      </>
                    )}
                  </Button>

                  {/* Autobidder Section */}
                  {isAuthenticated && (
                    <div className="border-t border-white/10 pt-4">
                      {!showAutobidder ? (
                        <Button
                          onClick={() => setShowAutobidder(true)}
                          variant="outline"
                          className="w-full border-[#7C3AED]/50 text-[#7C3AED] hover:bg-[#7C3AED]/10"
                          data-testid="show-autobidder-btn"
                        >
                          <Bot className="w-5 h-5 mr-2" />
                          {t('autobidder.title') || 'Autobidder'} aktivieren
                        </Button>
                      ) : (
                        <div className="space-y-4 p-4 rounded-lg bg-[#181824]">
                          <div className="flex items-center gap-2 text-[#7C3AED]">
                            <Bot className="w-5 h-5" />
                            <span className="font-bold">{t('autobidder.title') || 'Autobidder'}</span>
                          </div>
                          <p className="text-[#94A3B8] text-sm">
                            {t('autobidder.description') || 'Lassen Sie automatisch bieten bis zu Ihrem Limit'}
                          </p>
                          <div className="space-y-2">
                            <Label className="text-white">{t('autobidder.maxPrice') || 'Maximaler Preis (€)'}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min={auction.current_price + 0.01}
                              value={maxPrice}
                              onChange={(e) => setMaxPrice(e.target.value)}
                              placeholder={`Min. €${(auction.current_price + 0.01).toFixed(2)}`}
                              className="bg-[#0F0F16] border-white/10 text-white"
                              data-testid="max-price-input"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={handleSetAutobidder}
                              disabled={settingAutobidder}
                              className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9]"
                              data-testid="activate-autobidder-btn"
                            >
                              {settingAutobidder ? '...' : (t('autobidder.activate') || 'Aktivieren')}
                            </Button>
                            <Button
                              onClick={() => setShowAutobidder(false)}
                              variant="outline"
                              className="border-white/10 text-white hover:bg-white/10"
                            >
                              {t('common.cancel')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!isAuthenticated && (
                <p className="text-center text-[#94A3B8] text-sm">
                  <Link to="/login" className="text-[#7C3AED] hover:underline">{t('nav.login')}</Link> um zu bieten
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
