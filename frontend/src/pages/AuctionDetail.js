import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuctionWebSocket } from '../hooks/useAuctionWebSocket';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Timer, Users, Zap, ArrowLeft, Trophy, Tag, Package, Wifi, WifiOff, Eye, History, Clock, User, ChevronDown, ChevronUp, ShoppingBag, CreditCard, Sparkles, Share2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { getProductName, getProductDescription } from '../utils/productTranslation';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AuctionDetail() {
  const { id } = useParams();
  const { isAuthenticated, token, user, updateBidsBalance } = useAuth();
  const { t, language } = useLanguage();
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isUrgent, setIsUrgent] = useState(false);
  
  // Bid history state
  const [bidHistory, setBidHistory] = useState([]);
  const [showBidHistory, setShowBidHistory] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Autobidder state (improved Bid Buddy)
  const [showAutobidder, setShowAutobidder] = useState(false);
  const [maxPrice, setMaxPrice] = useState('');
  const [maxBids, setMaxBids] = useState('10');
  const [bidInLastSeconds, setBidInLastSeconds] = useState('10');
  const [settingAutobidder, setSettingAutobidder] = useState(false);
  const [activeAutobidder, setActiveAutobidder] = useState(null);

  // Buy It Now state
  const [buyNowPrice, setBuyNowPrice] = useState(null);
  const [buyingNow, setBuyingNow] = useState(false);
  const [showBuyNowModal, setShowBuyNowModal] = useState(false);

  // Timer for scheduled auctions
  const [startTimeLeft, setStartTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Social Sharing state
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auction Detail translations
  const detailTexts = {
    de: { pleaseLogin: 'Bitte melden Sie sich an', linkCopied: 'Link kopiert!', copyError: 'Fehler beim Kopieren', checkoutAuction: 'Schau dir diese Auktion an', auctionTitle: 'Auktion', buyNow: 'Sofort kaufen', bidBuddy: 'Bid Buddy', bidBuddyActivated: 'Bid Buddy aktiviert! Er bietet automatisch für Sie.', bidBuddyDesc: 'Ihr Bid Buddy bietet automatisch in den letzten Sekunden für Sie!', scheduledAuction: 'Diese Auktion ist geplant und startet am', noBidsAvailable: 'Keine Gebote mehr verfügbar. Bitte kaufen Sie mehr Gebote.', notEnoughBids: 'Nicht genug Gebote', beingPurchased: 'Wird gekauft...', bidCredit: 'Gebots-Guthaben', yourPrice: 'Ihr Preis', savingsMessage: 'Sie sparen durch Ihre platzierten Gebote!', savingsNote: 'Jedes platzierte Gebot wird auf den Kaufpreis als €0,15 Guthaben angerechnet.' },
    en: { pleaseLogin: 'Please log in', linkCopied: 'Link copied!', copyError: 'Error copying', checkoutAuction: 'Check out this auction', auctionTitle: 'Auction', buyNow: 'Buy Now', bidBuddy: 'Bid Buddy', bidBuddyActivated: 'Bid Buddy activated! It will bid automatically for you.', bidBuddyDesc: 'Your Bid Buddy will automatically bid in the last seconds for you!', scheduledAuction: 'This auction is scheduled and starts on', noBidsAvailable: 'No more bids available. Please buy more bids.', notEnoughBids: 'Not enough bids', beingPurchased: 'Being purchased...', bidCredit: 'Bid Credit', yourPrice: 'Your Price', savingsMessage: 'You save through your placed bids!', savingsNote: 'Each placed bid is credited as €0.15 credit towards the purchase price.' },
    sq: { pleaseLogin: 'Ju lutem hyni', linkCopied: 'Linku u kopjua!', copyError: 'Gabim gjatë kopjimit', checkoutAuction: 'Shiko këtë ankand', auctionTitle: 'Ankandi', buyNow: 'Bli Tani', bidBuddy: 'Bid Buddy', bidBuddyActivated: 'Bid Buddy u aktivizua! Do të ofertojë automatikisht për ju.', bidBuddyDesc: 'Bid Buddy juaj do të ofertojë automatikisht në sekondat e fundit!', scheduledAuction: 'Ky ankand është planifikuar dhe fillon më', noBidsAvailable: 'Nuk ka më oferta. Ju lutem blini më shumë oferta.', notEnoughBids: 'Jo mjaft oferta', beingPurchased: 'Duke u blerë...', bidCredit: 'Kredi Ofertash', yourPrice: 'Çmimi Juaj', savingsMessage: 'Ju kurseni nga ofertat e vendosura!', savingsNote: 'Çdo ofertë e vendosur kreditohet si €0,15 kredi për çmimin e blerjes.' },
    tr: { pleaseLogin: 'Lütfen giriş yapın', linkCopied: 'Link kopyalandı!', copyError: 'Kopyalama hatası', checkoutAuction: 'Bu açık artırmaya göz atın', auctionTitle: 'Açık Artırma', buyNow: 'Şimdi Satın Al', bidBuddy: 'Bid Buddy', bidBuddyActivated: 'Bid Buddy aktif! Sizin için otomatik teklif verecek.', bidBuddyDesc: 'Bid Buddy son saniyelerde sizin için otomatik teklif verecek!', scheduledAuction: 'Bu açık artırma planlandı ve başlıyor', noBidsAvailable: 'Teklif kalmadı. Lütfen daha fazla teklif satın alın.', notEnoughBids: 'Yeterli teklif yok', beingPurchased: 'Satın alınıyor...', bidCredit: 'Teklif Kredisi', yourPrice: 'Fiyatınız', savingsMessage: 'Teklifleriniz sayesinde tasarruf ediyorsunuz!', savingsNote: 'Her teklif satın alma fiyatına €0,15 kredi olarak eklenir.' },
    fr: { pleaseLogin: 'Veuillez vous connecter', linkCopied: 'Lien copié!', copyError: 'Erreur de copie', checkoutAuction: 'Découvrez cette enchère', auctionTitle: 'Enchère', buyNow: 'Acheter Maintenant', bidBuddy: 'Bid Buddy', bidBuddyActivated: 'Bid Buddy activé! Il enchérira automatiquement pour vous.', bidBuddyDesc: 'Votre Bid Buddy enchérira automatiquement dans les dernières secondes!', scheduledAuction: 'Cette enchère est programmée et commence le', noBidsAvailable: 'Plus d\'enchères disponibles. Veuillez acheter plus d\'enchères.', notEnoughBids: 'Pas assez d\'enchères', beingPurchased: 'Achat en cours...', bidCredit: 'Crédit d\'enchère', yourPrice: 'Votre Prix', savingsMessage: 'Vous économisez grâce à vos enchères!', savingsNote: 'Chaque enchère est créditée de €0,15 sur le prix d\'achat.' }
  };
  const dtl = detailTexts[language] || detailTexts.de;

  // Simulated viewer count (minimum 12, based on auction ID for consistency)
  const [simulatedViewers] = useState(() => {
    // Generate consistent number based on auction ID
    const hash = id ? id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0;
    return 12 + (hash % 25); // 12-36 viewers
  });

  // Social Sharing functions
  const getShareUrl = () => {
    return `${window.location.origin}/auctions/${id}`;
  };

  const handleShare = (platform) => {
    const url = encodeURIComponent(getShareUrl());
    const productName = auction?.product?.name || dtl.auctionTitle;
    const text = encodeURIComponent(`🔥 ${dtl.checkoutAuction}: ${productName} - € ${auction?.current_price?.toFixed(2)}!`);
    
    const shareUrls = {
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      telegram: `https://t.me/share/url?url=${url}&text=${text}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      email: `mailto:?subject=${encodeURIComponent(`${dtl.auctionTitle}: ${productName}`)}&body=${text}%20${url}`
    };
    
    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    }
    setShowShareMenu(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      toast.success(dtl.linkCopied);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error(dtl.copyError);
    }
    setShowShareMenu(false);
  };

  // WebSocket connection
  const { 
    isConnected, 
    auctionData, 
    viewerCount, 
    bidNotification 
  } = useAuctionWebSocket(id);

  // Fetch bid history
  const fetchBidHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await axios.get(`${API}/auctions/${id}/bid-history?limit=20`);
      setBidHistory(response.data);
    } catch (error) {
      console.error('Error fetching bid history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch Buy It Now price
  const fetchBuyNowPrice = async () => {
    if (!isAuthenticated || !token) return;
    try {
      const response = await axios.get(`${API}/auctions/${id}/buy-now-price`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBuyNowPrice(response.data);
    } catch (error) {
      console.error('Error fetching buy-now price:', error);
    }
  };

  // Handle Buy It Now
  const handleBuyNow = async () => {
    if (!isAuthenticated) {
      toast.error(dtl.pleaseLogin);
      return;
    }

    setBuyingNow(true);
    try {
      const response = await axios.post(
        `${API}/auctions/${id}/buy-now`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message);
      setShowBuyNowModal(false);
      fetchAuction();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Kauf');
    } finally {
      setBuyingNow(false);
    }
  };

  // Fetch active autobidder for this auction
  const fetchAutobidder = async () => {
    if (!isAuthenticated || !id) return;
    try {
      const response = await axios.get(
        `${API}/autobidder/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActiveAutobidder(response.data);
    } catch (error) {
      // No autobidder found is normal
      setActiveAutobidder(null);
    }
  };

  // Deactivate autobidder
  const handleDeactivateAutobidder = async () => {
    try {
      await axios.delete(
        `${API}/autobidder/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActiveAutobidder(null);
      toast.success(t('autobidder.deactivated') || 'Bid Buddy deaktiviert');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Deaktivieren');
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchBidHistory();
  }, [id]);

  // Fetch autobidder when authenticated
  useEffect(() => {
    if (isAuthenticated && id) {
      fetchAutobidder();
    }
  }, [isAuthenticated, id]);

  // Fetch Buy It Now price when authenticated
  useEffect(() => {
    if (isAuthenticated && id) {
      fetchBuyNowPrice();
    }
  }, [isAuthenticated, id, auction?.current_price]);

  // Refresh bid history when there's a new bid
  useEffect(() => {
    if (bidNotification) {
      fetchBidHistory();
      // Also refresh autobidder status
      if (isAuthenticated) {
        fetchAutobidder();
      }
    }
  }, [bidNotification]);

  // Update auction from WebSocket data
  useEffect(() => {
    if (auctionData && !Array.isArray(auctionData)) {
      setAuction(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          current_price: auctionData.current_price ?? prev.current_price,
          end_time: auctionData.end_time ?? prev.end_time,
          status: auctionData.status ?? prev.status,
          total_bids: auctionData.total_bids ?? prev.total_bids,
          last_bidder_name: auctionData.last_bidder_name ?? prev.last_bidder_name,
          winner_name: auctionData.winner_name ?? prev.winner_name
        };
      });
    }
  }, [auctionData]);

  // Show bid notification toast
  useEffect(() => {
    if (bidNotification) {
      toast.info(bidNotification.message, {
        description: `${t('auctions.newPrice') || 'Neuer Preis'}: €${bidNotification.price?.toFixed(2)}`,
        duration: 2000
      });
    }
  }, [bidNotification]);

  useEffect(() => {
    fetchAuction();
    // Fallback polling only if WebSocket is not connected
    const interval = setInterval(() => {
      if (!isConnected) {
        fetchAuction();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [id, isConnected]);

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

    const calculateStartTimeLeft = () => {
      if (!auction.start_time || auction.status !== 'scheduled') {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }
      const startTime = new Date(auction.start_time);
      const now = new Date();
      const diff = startTime - now;

      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      return { days, hours, minutes, seconds };
    };

    const timer = setInterval(() => {
      const newTime = calculateTimeLeft();
      setTimeLeft(newTime);
      setIsUrgent(newTime.hours === 0 && newTime.minutes === 0 && newTime.seconds <= 10);
      setStartTimeLeft(calculateStartTimeLeft());
    }, 1000);

    setTimeLeft(calculateTimeLeft());
    setStartTimeLeft(calculateStartTimeLeft());

    return () => clearInterval(timer);
  }, [auction]);

  const fetchAuction = async () => {
    try {
      const response = await axios.get(`${API}/auctions/${id}`);
      setAuction(response.data);
    } catch (error) {
      console.error('Error fetching auction:', error);
      // Only show error if not a 404 (auction might have ended)
      if (error.response?.status !== 404) {
        toast.error(language === 'en' ? 'Error loading auction' : language === 'sq' ? 'Gabim gjatë ngarkimit të ankandit' : language === 'tr' ? 'Açık artırma yükleme hatası' : language === 'fr' ? 'Erreur de chargement' : 'Fehler beim Laden der Auktion');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBid = async () => {
    if (!isAuthenticated) {
      toast.error(dtl.pleaseLogin);
      return;
    }

    if (user?.bids_balance < 1) {
      toast.error(dtl.noBidsAvailable);
      return;
    }

    setBidding(true);
    try {
      const response = await axios.post(
        `${API}/auctions/${id}/bid`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t('auctions.bidSuccess') || 'Gebot erfolgreich platziert!');
      updateBidsBalance(response.data.bids_remaining);
      fetchAuction();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('auctions.bidError') || 'Fehler beim Bieten');
    } finally {
      setBidding(false);
    }
  };

  const handleSetAutobidder = async () => {
    const numMaxBids = parseInt(maxBids) || 10;
    const numMaxPrice = parseFloat(maxPrice) || 0;
    const numBidInLastSeconds = parseInt(bidInLastSeconds) || 10;

    if (numMaxBids < 1) {
      toast.error(t('autobidder.minBidsError') || 'Mindestens 1 Gebot erforderlich');
      return;
    }

    if (numMaxBids > user?.bids_balance) {
      toast.error(`${dtl.notEnoughBids}. ${user?.bids_balance}/${numMaxBids}`);
      return;
    }

    if (numMaxPrice > 0 && numMaxPrice <= auction.current_price) {
      toast.error(t('autobidder.maxPriceError') || 'Maximalpreis muss höher sein als der aktuelle Preis');
      return;
    }

    setSettingAutobidder(true);
    try {
      await axios.post(
        `${API}/autobidder`,
        {
          auction_id: id,
          max_bids: numMaxBids,
          max_price: numMaxPrice > 0 ? numMaxPrice : null,
          bid_in_last_seconds: numBidInLastSeconds
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t('autobidder.activated') || 'Bid Buddy aktiviert! Er bietet automatisch für Sie.');
      setShowAutobidder(false);
      setMaxPrice('');
      setMaxBids('10');
      fetchAutobidder(); // Refresh autobidder status
    } catch (error) {
      toast.error(error.response?.data?.detail || t('autobidder.activateError') || 'Fehler beim Aktivieren');
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
  const productName = getProductName(product, language);
  const productDescription = getProductDescription(product, language);
  const isEnded = auction.status === 'ended' || (timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0 && auction.status !== 'scheduled');
  const isScheduled = auction.status === 'scheduled';
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
                alt={productName}
                className="w-full h-full object-cover"
              />
              {isEnded ? (
                <div className="absolute top-4 right-4 px-4 py-2 rounded-full bg-[#EF4444] text-white font-bold">
                  {t('auctions.ended') || 'BEENDET'}
                </div>
              ) : isScheduled ? (
                <div className="absolute top-4 right-4 px-4 py-2 rounded-full bg-[#F59E0B] text-white font-bold">
                  Geplant
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
              <p className="text-[#94A3B8]">{productDescription}</p>
            </div>
          </div>

          {/* Auction Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2" data-testid="auction-title">
                {productName}
              </h1>
              <p className="text-[#94A3B8]">Auktion #{auction.id.slice(0, 8)}</p>
            </div>

            {/* Timer */}
            <div className={`glass-card p-6 rounded-xl ${isUrgent && !isEnded && !isScheduled ? 'glow-urgency' : ''}`}>
              {isEnded ? (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <Trophy className="w-6 h-6 text-[#EF4444]" />
                    <span className="text-[#EF4444] font-medium">{t('auctions.auctionEnded') || 'Auktion beendet'}</span>
                  </div>
                  <p className="text-3xl font-bold text-[#EF4444] font-mono">{t('auctions.ended') || 'BEENDET'}</p>
                  {auction.winner_name && (
                    <p className="text-[#10B981] text-sm mt-2 font-medium">
                      {t('auctions.winner')}: {auction.winner_name}
                    </p>
                  )}
                </div>
              ) : isScheduled ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <Timer className="w-6 h-6 text-[#F59E0B]" />
                    <span className="text-[#94A3B8]">Startet in</span>
                  </div>
                  <div>
                    <div className="flex gap-4 mb-4">
                      {startTimeLeft.days > 0 && (
                        <div className="text-center">
                          <div className="text-4xl font-bold font-mono text-[#F59E0B]">
                            {formatTime(startTimeLeft.days)}
                          </div>
                          <div className="text-[#94A3B8] text-sm">Tage</div>
                        </div>
                      )}
                      {[
                        { value: startTimeLeft.hours, label: 'Std' },
                        { value: startTimeLeft.minutes, label: 'Min' },
                        { value: startTimeLeft.seconds, label: 'Sek' }
                      ].map((item, index) => (
                        <div key={index} className="text-center">
                          <div className="text-4xl font-bold font-mono text-[#F59E0B]">
                            {formatTime(item.value)}
                          </div>
                          <div className="text-[#94A3B8] text-sm">{item.label}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[#94A3B8] text-sm">
                      Startet am: {auction.start_time && new Date(auction.start_time).toLocaleString('de-DE', {dateStyle: 'medium', timeStyle: 'short'})}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <Timer className="w-6 h-6 text-[#06B6D4]" />
                    <span className="text-[#94A3B8]">Verbleibend</span>
                  </div>
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
                </>
              )}
            </div>

            {/* Live Status & Viewers */}
            {!isEnded && !isScheduled && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#181824]">
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <Wifi className="w-4 h-4 text-[#10B981]" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-[#EF4444]" />
                  )}
                  <span className={`text-sm ${isConnected ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {isConnected ? 'Live verbunden' : 'Verbinde...'}
                  </span>
                </div>
                {/* Always show at least 12 viewers */}
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#94A3B8]" />
                  <span className="text-[#94A3B8] text-sm">{Math.max(simulatedViewers, viewerCount + simulatedViewers)} Zuschauer</span>
                </div>
              </div>
            )}

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
                    <p className="text-[#94A3B8] text-sm">{t('auctions.increment') || 'Inkrement'}</p>
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
              {!isEnded && !isScheduled && (
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

                  {/* Buy It Now Button */}
                  {isAuthenticated && product.retail_price && (
                    <Button
                      onClick={() => setShowBuyNowModal(true)}
                      variant="outline"
                      className="w-full border-[#10B981] text-[#10B981] hover:bg-[#10B981]/10 py-3"
                      data-testid="buy-now-btn"
                    >
                      <ShoppingBag className="w-5 h-5 mr-2" />
                      {t('auctions.buyNowFrom') || 'Sofort kaufen ab'} €{buyNowPrice?.final_price?.toFixed(2) || product?.retail_price?.toFixed(2) || '0.00'}
                    </Button>
                  )}

                  {/* Social Share Button */}
                  <div className="relative">
                    <Button
                      onClick={() => setShowShareMenu(!showShareMenu)}
                      variant="outline"
                      className="w-full border-white/20 text-white hover:bg-white/10 py-3"
                      data-testid="share-button"
                    >
                      <Share2 className="w-5 h-5 mr-2" />
                      Teilen
                    </Button>
                    
                    {/* Share Menu Dropdown */}
                    {showShareMenu && (
                      <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#181824] rounded-xl border border-white/10 shadow-xl overflow-hidden z-50">
                        <div className="p-2 space-y-1">
                          <button 
                            onClick={() => handleShare('whatsapp')}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-[#25D366]/20 rounded-lg transition-colors"
                          >
                            <span className="text-xl">📱</span>
                            <span>WhatsApp</span>
                          </button>
                          <button 
                            onClick={() => handleShare('telegram')}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-[#0088cc]/20 rounded-lg transition-colors"
                          >
                            <span className="text-xl">✈️</span>
                            <span>Telegram</span>
                          </button>
                          <button 
                            onClick={() => handleShare('facebook')}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-[#1877F2]/20 rounded-lg transition-colors"
                          >
                            <span className="text-xl">📘</span>
                            <span>Facebook</span>
                          </button>
                          <button 
                            onClick={() => handleShare('twitter')}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-[#1DA1F2]/20 rounded-lg transition-colors"
                          >
                            <span className="text-xl">🐦</span>
                            <span>Twitter / X</span>
                          </button>
                          <button 
                            onClick={() => handleShare('email')}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <span className="text-xl">📧</span>
                            <span>E-Mail</span>
                          </button>
                          <div className="border-t border-white/10 my-1"></div>
                          <button 
                            onClick={handleCopyLink}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-lg transition-colors"
                          >
                            {copied ? (
                              <>
                                <Check className="w-5 h-5 text-green-400" />
                                <span className="text-green-400">Link kopiert!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-5 h-5" />
                                <span>Link kopieren</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Buy It Now Modal */}
                  {showBuyNowModal && buyNowPrice && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" data-testid="buy-now-modal">
                      <div className="bg-[#181824] rounded-2xl max-w-md w-full p-6 space-y-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-[#10B981]/20 flex items-center justify-center">
                            <ShoppingBag className="w-6 h-6 text-[#10B981]" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-white">{t('auctions.buyNow') || 'Sofort kaufen'}</h3>
                            <p className="text-[#94A3B8] text-sm">{product?.name || 'Produkt'}</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="p-4 rounded-lg bg-[#0F0F16] space-y-3">
                            <div className="flex justify-between">
                              <span className="text-[#94A3B8]">{t('auctions.rrp') || 'UVP'}</span>
                              <span className="text-white font-mono">€{buyNowPrice?.retail_price?.toFixed(2) || '0.00'}</span>
                            </div>
                            {buyNowPrice?.bid_credit > 0 && (
                              <div className="flex justify-between text-[#10B981]">
                                <span className="flex items-center gap-2">
                                  <Sparkles className="w-4 h-4" />
                                  {t('auctions.bidCredit') || 'Gebots-Guthaben'} ({buyNowPrice?.bids_used || 0} {t('auctions.bids') || 'Gebote'})
                                </span>
                                <span className="font-mono">-€{buyNowPrice?.bid_credit?.toFixed(2) || '0.00'}</span>
                              </div>
                            )}
                            <div className="border-t border-white/10 pt-3 flex justify-between">
                              <span className="text-white font-bold">{t('auctions.yourPrice') || 'Ihr Preis'}</span>
                              <span className="text-2xl font-bold text-[#10B981] font-mono">€{buyNowPrice?.final_price?.toFixed(2) || '0.00'}</span>
                            </div>
                          </div>

                          {buyNowPrice?.bid_credit > 0 && (
                            <div className="p-3 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30">
                              <p className="text-[#10B981] text-sm text-center">
                                🎉 {t('auctions.savingsMessage') || 'Sie sparen durch Ihre platzierten Gebote!'}
                              </p>
                            </div>
                          )}

                          <p className="text-[#94A3B8] text-xs text-center">
                            {t('auctions.savingsNote') || 'Jedes platzierte Gebot wird auf den Kaufpreis als €0,15 Guthaben angerechnet.'}
                          </p>
                        </div>

                        <div className="flex gap-3">
                          <Button
                            onClick={() => setShowBuyNowModal(false)}
                            variant="outline"
                            className="flex-1 border-white/20 text-white hover:bg-white/10"
                            disabled={buyingNow}
                          >
                            {t('common.cancel') || 'Abbrechen'}
                          </Button>
                          <Button
                            onClick={handleBuyNow}
                            className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white"
                            disabled={buyingNow}
                            data-testid="confirm-buy-now-btn"
                          >
                            {buyingNow ? (
                              'Wird gekauft...'
                            ) : (
                              <>
                                <CreditCard className="w-5 h-5 mr-2" />
                                Jetzt kaufen
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bid Buddy / Autobidder Section */}
                  {isAuthenticated && (
                    <div className="border-t border-white/10 pt-4">
                      {/* Active Bid Buddy Status */}
                      {activeAutobidder && (
                        <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-[#7C3AED]/20 to-[#06B6D4]/20 border border-[#7C3AED]/30" data-testid="active-autobidder">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-[#7C3AED] font-bold">🤖 Bid Buddy aktiv</span>
                            </div>
                            <Button
                              onClick={handleDeactivateAutobidder}
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2"
                            >
                              Stoppen
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-black/20 rounded-lg p-2">
                              <p className="text-[#94A3B8] text-xs">Verbleibende Gebote</p>
                              <p className="text-white font-bold text-lg">
                                {activeAutobidder.max_bids - (activeAutobidder.bids_placed || 0)} / {activeAutobidder.max_bids}
                              </p>
                            </div>
                            <div className="bg-black/20 rounded-lg p-2">
                              <p className="text-[#94A3B8] text-xs">Platzierte Gebote</p>
                              <p className="text-[#10B981] font-bold text-lg">{activeAutobidder.bids_placed || 0}</p>
                            </div>
                            {activeAutobidder.max_price && (
                              <div className="bg-black/20 rounded-lg p-2 col-span-2">
                                <p className="text-[#94A3B8] text-xs">Max. Preis</p>
                                <p className="text-white font-bold">€{activeAutobidder.max_price?.toFixed(2)}</p>
                              </div>
                            )}
                          </div>
                          <p className="text-[#94A3B8] text-xs mt-3 text-center">
                            ⚡ Bietet automatisch in den letzten {activeAutobidder.bid_in_last_seconds || 10} Sekunden
                          </p>
                        </div>
                      )}

                      {/* Setup New Bid Buddy */}
                      {!activeAutobidder && !showAutobidder && (
                        <Button
                          onClick={() => setShowAutobidder(true)}
                          variant="outline"
                          className="w-full border-[#7C3AED]/50 text-[#7C3AED] hover:bg-[#7C3AED]/10"
                          data-testid="show-autobidder-btn"
                        >
                          <Zap className="w-5 h-5 mr-2" />
                          🤖 Bid Buddy aktivieren
                        </Button>
                      )}

                      {/* Bid Buddy Setup Form */}
                      {showAutobidder && !activeAutobidder && (
                        <div className="space-y-4 p-4 rounded-lg bg-[#181824]" data-testid="autobidder-form">
                          <div className="flex items-center gap-2 text-[#7C3AED]">
                            <Zap className="w-5 h-5" />
                            <span className="font-bold">🤖 Bid Buddy einrichten</span>
                          </div>
                          <p className="text-[#94A3B8] text-sm">
                            Ihr Bid Buddy bietet automatisch in den letzten Sekunden für Sie!
                          </p>
                          
                          {/* Max Bids */}
                          <div className="space-y-2">
                            <Label className="text-white">Maximale Anzahl Gebote</Label>
                            <Input
                              type="number"
                              min="1"
                              max={user?.bids_balance || 100}
                              value={maxBids}
                              onChange={(e) => setMaxBids(e.target.value)}
                              placeholder="z.B. 10"
                              className="bg-[#0F0F16] border-white/10 text-white"
                              data-testid="max-bids-input"
                            />
                            <p className="text-[#94A3B8] text-xs">Verfügbar: {user?.bids_balance || 0} Gebote</p>
                          </div>

                          {/* Max Price (optional) */}
                          <div className="space-y-2">
                            <Label className="text-white">Maximaler Preis (€) <span className="text-[#94A3B8]">- optional</span></Label>
                            <Input
                              type="number"
                              step="0.01"
                              min={auction.current_price + 0.01}
                              value={maxPrice}
                              onChange={(e) => setMaxPrice(e.target.value)}
                              placeholder={`z.B. ${(auction.current_price * 2).toFixed(2)}`}
                              className="bg-[#0F0F16] border-white/10 text-white"
                              data-testid="max-price-input"
                            />
                            <p className="text-[#94A3B8] text-xs">Stoppt wenn dieser Preis erreicht ist</p>
                          </div>

                          {/* Bid in Last Seconds */}
                          <div className="space-y-2">
                            <Label className="text-white">Bieten in letzten Sekunden</Label>
                            <select
                              value={bidInLastSeconds}
                              onChange={(e) => setBidInLastSeconds(e.target.value)}
                              className="w-full h-10 px-3 bg-[#0F0F16] border border-white/10 rounded-md text-white"
                              data-testid="bid-seconds-select"
                            >
                              <option value="5">5 Sekunden</option>
                              <option value="10">10 Sekunden</option>
                              <option value="15">15 Sekunden</option>
                              <option value="20">20 Sekunden</option>
                            </select>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={handleSetAutobidder}
                              disabled={settingAutobidder}
                              className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9]"
                              data-testid="activate-autobidder-btn"
                            >
                              {settingAutobidder ? '...' : '🚀 Aktivieren'}
                            </Button>
                            <Button
                              onClick={() => setShowAutobidder(false)}
                              variant="outline"
                              className="border-white/10 text-white hover:bg-white/10"
                            >
                              {t('common.cancel') || 'Abbrechen'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Scheduled auction message */}
              {isScheduled && (
                <div className="p-4 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30">
                  <p className="text-[#F59E0B] text-center font-medium">
                    Diese Auktion ist geplant und startet am{' '}
                    {auction.start_time && new Date(auction.start_time).toLocaleString('de-DE', {dateStyle: 'medium', timeStyle: 'short'})}
                  </p>
                </div>
              )}

              {!isAuthenticated && !isScheduled && !isEnded && (
                <p className="text-center text-[#94A3B8] text-sm">
                  <Link to="/login" className="text-[#7C3AED] hover:underline">{t('nav.login')}</Link> um zu bieten
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bid History Section */}
        <div className="mt-8 glass-card rounded-xl overflow-hidden" data-testid="bid-history-section">
          <button
            onClick={() => setShowBidHistory(!showBidHistory)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-[#7C3AED]" />
              <span className="text-white font-bold">{t('auctions.bidHistory') || 'Gebotsverlauf'}</span>
              <span className="text-[#94A3B8] text-sm">({bidHistory.length} {t('auctions.bids') || 'Gebote'})</span>
            </div>
            {showBidHistory ? (
              <ChevronUp className="w-5 h-5 text-[#94A3B8]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#94A3B8]" />
            )}
          </button>
          
          {showBidHistory && (
            <div className="border-t border-white/10">
              {loadingHistory ? (
                <div className="p-6 text-center">
                  <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : bidHistory.length === 0 ? (
                <div className="p-6 text-center text-[#94A3B8]">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{t('auctions.noBidsYet') || 'Noch keine Gebote abgegeben'}</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-[#0F0F16] sticky top-0">
                      <tr>
                        <th className="text-left text-[#94A3B8] text-xs font-medium p-3">{t('auctions.lastBidder') || 'Bieter'}</th>
                        <th className="text-right text-[#94A3B8] text-xs font-medium p-3">{t('auctions.price') || 'Preis'}</th>
                        <th className="text-right text-[#94A3B8] text-xs font-medium p-3 hidden sm:table-cell">{t('auctions.time') || 'Zeit'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bidHistory.map((bid, index) => (
                        <tr 
                          key={index} 
                          className={`border-t border-white/5 ${index === 0 ? 'bg-[#7C3AED]/10' : ''}`}
                          data-testid={`bid-history-row-${index}`}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center">
                                <User className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                <p className="text-white text-sm font-medium">
                                  {bid.user_name}
                                </p>
                                {index === 0 && (
                                  <p className="text-[#10B981] text-xs">{t('auctions.currentHighBidder') || 'Aktueller Höchstbieter'}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <span className={`font-mono font-bold ${index === 0 ? 'text-[#06B6D4]' : 'text-white'}`}>
                              €{bid.price?.toFixed(2)}
                            </span>
                          </td>
                          <td className="p-3 text-right hidden sm:table-cell">
                            <div className="flex items-center justify-end gap-1 text-[#94A3B8] text-xs">
                              <Clock className="w-3 h-3" />
                              <span>
                                {new Date(bid.timestamp).toLocaleTimeString('de-DE', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Sticky Bid Bar */}
      {!isEnded && !isScheduled && (
        <div className="fixed bottom-16 left-0 right-0 lg:hidden glass border-t border-white/10 p-4 z-40">
          <div className="flex items-center justify-between gap-4 max-w-6xl mx-auto">
            <div className="flex-1">
              <p className="text-[#94A3B8] text-xs">{t('auctions.currentPrice') || 'Aktueller Preis'}</p>
              <p className="text-xl font-bold text-[#06B6D4] font-mono">€{auction.current_price?.toFixed(2)}</p>
            </div>
            <Button
              onClick={handleBid}
              disabled={!isAuthenticated || bidding}
              className="btn-bid px-8 py-3 text-base h-auto"
              data-testid="mobile-bid-btn"
            >
              {bidding ? '...' : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  {t('auctions.bid') || 'Bieten'}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
