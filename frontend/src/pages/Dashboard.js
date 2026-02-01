import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { TwoFactorSettings } from '../components/TwoFactorSettings';
import SpinWheel from '../components/SpinWheel';
import { 
  Zap, Trophy, Target, TrendingUp, ArrowRight, User, Mail, 
  Ticket, Bot, Trash2, Power, Clock, Package, CreditCard,
  History, Settings, ChevronRight, Gift, Calendar, Eye,
  Timer, CheckCircle, XCircle, Shield, FileText, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Dashboard() {
  const { user, token, refreshUser, updateBidsBalance } = useAuth();
  const { t, language } = useLanguage();
  const [activeAuctions, setActiveAuctions] = useState([]);
  const [myBidAuctions, setMyBidAuctions] = useState([]);
  const [wonAuctions, setWonAuctions] = useState([]);
  const [autobidders, setAutobidders] = useState([]);
  const [recentBids, setRecentBids] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voucherCode, setVoucherCode] = useState('');
  const [redeemingVoucher, setRedeemingVoucher] = useState(false);
  
  // Daily Reward State
  const [dailyRewardStatus, setDailyRewardStatus] = useState(null);
  const [claimingReward, setClaimingReward] = useState(false);
  const [achievements, setAchievements] = useState(null);
  const [wheelOpen, setWheelOpen] = useState(false);

  // Dashboard translations
  const dashTexts = {
    de: { welcome: 'Willkommen', profile: 'Profil', buyBids: 'Gebote kaufen', balance: 'Guthaben', bids: 'Gebote', won: 'Gewonnen', auctions: 'Auktionen', active: 'Aktiv', watching: 'Beobachtet', voucherCode: 'Gutscheincode', redeem: 'Einlösen', myAuctions: 'Meine Auktionen', recentBids: 'Letzte Gebote', autobidder: 'Autobidder', noBids: 'Noch keine Gebote', startBidding: 'Bieten anfangen', noAutobidder: 'Kein Autobidder', createAutobidder: 'Autobidder erstellen', viewAll: 'Alle anzeigen', dailyReward: 'Tägliche Belohnung', claimNow: 'Jetzt abholen!', alreadyClaimed: 'Heute abgeholt', streak: 'Streak', days: 'Tage', achievements: 'Erfolge', bidsAvailable: 'Gebote verfügbar', redeemVoucher: 'Gutschein einlösen', pay: 'Bezahlen', paid: 'Bezahlt', paymentDeadline: 'Zahlungsfrist', freeAuctionNote: 'Gratis-Auktion - Endpreis zahlen', showAllWon: 'Alle gewonnenen Auktionen anzeigen', myAutobidders: 'Meine Autobidder', noAutobidderMsg: 'Keine aktiven Autobidder. Erstellen Sie einen auf der Auktionsdetailseite!', giftBids: 'Gebote verschenken', giftBidsDesc: 'Schenken Sie Freunden und Familie Gebote mit Ihrer Kundennummer', giftNow: 'Jetzt verschenken' },
    en: { welcome: 'Welcome', profile: 'Profile', buyBids: 'Buy Bids', balance: 'Balance', bids: 'Bids', won: 'Won', auctions: 'Auctions', active: 'Active', watching: 'Watching', voucherCode: 'Voucher Code', redeem: 'Redeem', myAuctions: 'My Auctions', recentBids: 'Recent Bids', autobidder: 'Auto-Bidder', noBids: 'No bids yet', startBidding: 'Start Bidding', noAutobidder: 'No auto-bidder', createAutobidder: 'Create Auto-Bidder', viewAll: 'View All', dailyReward: 'Daily Reward', claimNow: 'Claim Now!', alreadyClaimed: 'Claimed Today', streak: 'Streak', days: 'Days', achievements: 'Achievements', bidsAvailable: 'Bids available', redeemVoucher: 'Redeem voucher', pay: 'Pay', paid: 'Paid', paymentDeadline: 'Payment deadline', freeAuctionNote: 'Free auction - Pay final price', showAllWon: 'Show all won auctions', myAutobidders: 'My Auto-Bidders', noAutobidderMsg: 'No active auto-bidders. Create one on the auction detail page!', giftBids: 'Gift Bids', giftBidsDesc: 'Gift bids to friends and family using their customer number', giftNow: 'Gift Now' },
    sq: { welcome: 'Mirë se vini', profile: 'Profili', buyBids: 'Bli Oferta', balance: 'Bilanci', bids: 'Oferta', won: 'Fituar', auctions: 'Ankande', active: 'Aktive', watching: 'Duke ndjekur', voucherCode: 'Kodi i Kuponit', redeem: 'Aktivizo', myAuctions: 'Ankandet e Mia', recentBids: 'Ofertat e Fundit', autobidder: 'Auto-Ofertuesi', noBids: 'Ende pa oferta', startBidding: 'Fillo të Ofrosh', noAutobidder: 'Pa auto-ofertues', createAutobidder: 'Krijo Auto-Ofertues', viewAll: 'Shiko të Gjitha', dailyReward: 'Shpërblimi Ditor', claimNow: 'Merr Tani!', alreadyClaimed: 'Marrë Sot', streak: 'Streak', days: 'Ditë', achievements: 'Arritjet', bidsAvailable: 'Oferta në dispozicion', redeemVoucher: 'Aktivizo kuponin', pay: 'Paguaj', paid: 'Paguar', paymentDeadline: 'Afati i pagesës', freeAuctionNote: 'Ankand falas - Paguaj çmimin final', showAllWon: 'Shiko të gjitha ankandet e fituara', myAutobidders: 'Auto-Ofertuesit e Mi', noAutobidderMsg: 'Pa auto-ofertues aktiv. Krijoni një në faqen e detajeve të ankandit!', giftBids: 'Dhuro Oferta', giftBidsDesc: 'Dhuroni oferta miqve dhe familjes duke përdorur numrin e klientit', giftNow: 'Dhuro Tani' },
    tr: { welcome: 'Hoş geldiniz', profile: 'Profil', buyBids: 'Teklif Al', balance: 'Bakiye', bids: 'Teklif', won: 'Kazanılan', auctions: 'Açık Artırma', active: 'Aktif', watching: 'İzlenen', voucherCode: 'Kupon Kodu', redeem: 'Kullan', myAuctions: 'Açık Artırmalarım', recentBids: 'Son Teklifler', autobidder: 'Otomatik Teklif', noBids: 'Henüz teklif yok', startBidding: 'Teklif Vermeye Başla', noAutobidder: 'Otomatik teklif yok', createAutobidder: 'Otomatik Teklif Oluştur', viewAll: 'Tümünü Gör', dailyReward: 'Günlük Ödül', claimNow: 'Şimdi Al!', alreadyClaimed: 'Bugün Alındı', streak: 'Streak', days: 'Gün', achievements: 'Başarılar', bidsAvailable: 'Mevcut teklifler', redeemVoucher: 'Kuponu kullan', pay: 'Öde', paid: 'Ödendi', paymentDeadline: 'Ödeme tarihi', freeAuctionNote: 'Ücretsiz açık artırma - Son fiyatı öde', showAllWon: 'Tüm kazanılan açık artırmaları göster', myAutobidders: 'Otomatik Tekliflerim', noAutobidderMsg: 'Aktif otomatik teklif yok. Açık artırma detay sayfasında bir tane oluşturun!', giftBids: 'Teklif Hediye Et', giftBidsDesc: 'Müşteri numarası ile arkadaşlarınıza teklif hediye edin', giftNow: 'Şimdi Hediye Et' },
    fr: { welcome: 'Bienvenue', profile: 'Profil', buyBids: 'Acheter Enchères', balance: 'Solde', bids: 'Enchères', won: 'Gagné', auctions: 'Enchères', active: 'Actif', watching: 'Surveillé', voucherCode: 'Code Promo', redeem: 'Utiliser', myAuctions: 'Mes Enchères', recentBids: 'Enchères Récentes', autobidder: 'Auto-Enchère', noBids: 'Pas encore d\'enchères', startBidding: 'Commencer à Enchérir', noAutobidder: 'Pas d\'auto-enchère', createAutobidder: 'Créer Auto-Enchère', viewAll: 'Voir Tout', dailyReward: 'Récompense Quotidienne', claimNow: 'Réclamer!', alreadyClaimed: 'Réclamé Aujourd\'hui', streak: 'Streak', days: 'Jours', achievements: 'Succès', bidsAvailable: 'Enchères disponibles', redeemVoucher: 'Utiliser un coupon', pay: 'Payer', paid: 'Payé', paymentDeadline: 'Date limite de paiement', freeAuctionNote: 'Enchère gratuite - Payer le prix final', showAllWon: 'Voir toutes les enchères gagnées', myAutobidders: 'Mes Auto-Enchères', noAutobidderMsg: 'Pas d\'auto-enchère active. Créez-en une sur la page de détails!', giftBids: 'Offrir des Enchères', giftBidsDesc: 'Offrez des enchères à vos amis avec leur numéro client', giftNow: 'Offrir Maintenant' }
  };
  const dt = dashTexts[language] || dashTexts.de;

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  // Fetch daily reward status
  const fetchDailyRewardStatus = async () => {
    try {
      const res = await axios.get(`${API}/auth/daily-reward-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDailyRewardStatus(res.data);
    } catch (error) {
      console.error('Error fetching daily reward status:', error);
    }
  };

  // Fetch achievements
  const fetchAchievements = async () => {
    try {
      const res = await axios.get(`${API}/auth/achievements`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAchievements(res.data);
    } catch (error) {
      console.error('Error fetching achievements:', error);
    }
  };

  // Claim daily reward
  const claimDailyReward = async () => {
    setClaimingReward(true);
    try {
      const res = await axios.post(`${API}/auth/claim-daily-reward`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`🎉 +${res.data.bids_received} Gebote erhalten!`, {
        description: res.data.bonus_message || `Streak: ${res.data.current_streak} Tage`
      });
      setDailyRewardStatus({ ...dailyRewardStatus, can_claim: false, current_streak: res.data.current_streak });
      refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Abholen');
    } finally {
      setClaimingReward(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDailyRewardStatus();
      fetchAchievements();
    }
  }, [token]);


  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch all data in parallel
      const [auctionsRes, autobiddersRes, bidHistoryRes, purchasesRes] = await Promise.all([
        axios.get(`${API}/auctions`).catch(() => ({ data: [] })),
        axios.get(`${API}/autobidder/my`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/user/bid-history`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/user/purchases`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      const allAuctions = auctionsRes.data || [];
      
      // Active auctions where user has bid
      const myBids = bidHistoryRes.data || [];
      const myAuctionIds = [...new Set(myBids.map(b => b.auction_id))];
      const myActiveAuctions = allAuctions.filter(a => 
        myAuctionIds.includes(a.id) && a.status === 'active'
      );
      setMyBidAuctions(myActiveAuctions);
      
      // Active auctions (general)
      setActiveAuctions(allAuctions.filter(a => a.status === 'active').slice(0, 4));
      
      // Won auctions
      setWonAuctions(allAuctions.filter(a => a.winner_id === user?.id));
      
      // Autobidders
      setAutobidders(autobiddersRes.data || []);
      
      // Recent bids
      setRecentBids((myBids || []).slice(0, 10));
      
      // Purchases
      setPurchases((purchasesRes.data || []).slice(0, 5));
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemVoucher = async (e) => {
    e.preventDefault();
    if (!voucherCode.trim()) return;
    setRedeemingVoucher(true);
    try {
      const response = await axios.post(
        `${API}/vouchers/redeem`,
        { code: voucherCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message);
      setVoucherCode('');
      await refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Einlösen');
    } finally {
      setRedeemingVoucher(false);
    }
  };

  const handleToggleAutobidder = async (autobidderId, currentStatus) => {
    try {
      await axios.put(`${API}/autobidder/${autobidderId}/toggle`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(currentStatus ? (language === 'en' ? 'Auto-bidder disabled' : 'Autobidder deaktiviert') : (language === 'en' ? 'Auto-bidder enabled' : 'Autobidder aktiviert'));
      fetchData();
    } catch (error) {
      toast.error(language === 'en' ? 'Error changing status' : 'Fehler beim Ändern');
    }
  };

  const handleDeleteAutobidder = async (autobidderId) => {
    try {
      await axios.delete(`${API}/autobidder/${autobidderId}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(language === 'en' ? 'Auto-bidder deleted' : 'Autobidder gelöscht');
      fetchData();
    } catch (error) {
      toast.error(language === 'en' ? 'Error deleting' : 'Fehler beim Löschen');
    }
  };

  const handleQuickBid = async (auctionId) => {
    try {
      const response = await axios.post(
        `${API}/auctions/${auctionId}/bid`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(language === 'en' ? 'Bid placed!' : 'Gebot platziert!');
      updateBidsBalance(response.data.bids_remaining);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || (language === 'en' ? 'Error bidding' : 'Fehler beim Bieten'));
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FFD700] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="dashboard-page">
      <div className="max-w-7xl mx-auto">
        {/* Header with User Info */}
        <div className="glass-card rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FF4D4D] flex items-center justify-center text-2xl font-bold text-black">
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{dt.welcome}, {user.name}!</h1>
                <p className="text-[#94A3B8]">{user.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/stats">
                <Button variant="outline" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
                  <TrendingUp className="w-4 h-4 mr-2" />Statistiken
                </Button>
              </Link>
              <Link to="/profile">
                <Button variant="outline" className="border-white/10 text-white hover:bg-white/10">
                  <Settings className="w-4 h-4 mr-2" />{dt.profile}
                </Button>
              </Link>
              <Link to="/buy-bids">
                <Button className="btn-primary">
                  <Zap className="w-4 h-4 mr-2" />{dt.buyBids}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#FFD700]/20 flex items-center justify-center">
                <Zap className="w-6 h-6 text-[#FFD700]" />
              </div>
              <div>
                <p className="text-[#94A3B8] text-sm">{dt.balance}</p>
                <p className="text-2xl font-bold text-white">{user.bids_balance || 0}</p>
                <p className="text-[#FFD700] text-xs">{dt.bids}</p>
              </div>
            </div>
          </div>
          
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#10B981]/20 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-[#10B981]" />
              </div>
              <div>
                <p className="text-[#94A3B8] text-sm">{dt.won}</p>
                <p className="text-2xl font-bold text-white">{wonAuctions.length}</p>
                <p className="text-[#10B981] text-xs">{dt.auctions}</p>
              </div>
            </div>
          </div>
          
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/20 flex items-center justify-center">
                <Target className="w-6 h-6 text-[#7C3AED]" />
              </div>
              <div>
                <p className="text-[#94A3B8] text-sm">Aktive Gebote</p>
                <p className="text-2xl font-bold text-white">{myBidAuctions.length}</p>
                <p className="text-[#7C3AED] text-xs">Auktionen</p>
              </div>
            </div>
          </div>
          
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#06B6D4]/20 flex items-center justify-center">
                <Bot className="w-6 h-6 text-[#06B6D4]" />
              </div>
              <div>
                <p className="text-[#94A3B8] text-sm">Autobidder</p>
                <p className="text-2xl font-bold text-white">{(autobidders || []).filter(a => a.is_active).length}</p>
                <p className="text-[#06B6D4] text-xs">Aktiv</p>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Reward & Achievements Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Daily Reward Card */}
          <div className="glass-card rounded-xl p-5" data-testid="daily-reward-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#EF4444] flex items-center justify-center">
                  <Gift className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold">{dt.dailyReward}</h3>
                  <p className="text-[#94A3B8] text-sm">
                    🔥 {dt.streak}: {dailyRewardStatus?.current_streak || 0} {dt.days}
                  </p>
                </div>
              </div>
            </div>
            
            {dailyRewardStatus?.can_claim ? (
              <Button
                onClick={claimDailyReward}
                disabled={claimingReward}
                className="w-full bg-gradient-to-r from-[#F59E0B] to-[#EF4444] hover:from-[#D97706] hover:to-[#DC2626] text-white font-bold py-3"
                data-testid="claim-daily-reward-btn"
              >
                {claimingReward ? '...' : (
                  <>
                    <Gift className="w-5 h-5 mr-2" />
                    🎁 {dt.claimNow} (1-5 Gebote)
                  </>
                )}
              </Button>
            ) : (
              <div className="text-center py-3 px-4 rounded-lg bg-[#181824]">
                <CheckCircle className="w-6 h-6 text-[#10B981] mx-auto mb-2" />
                <p className="text-[#10B981] font-medium">{dt.alreadyClaimed}</p>
                <p className="text-[#94A3B8] text-xs mt-1">Komm morgen wieder!</p>
              </div>
            )}
            
            {/* Streak Progress */}
            <div className="mt-4 grid grid-cols-7 gap-1">
              {[1,2,3,4,5,6,7].map((day) => (
                <div 
                  key={day}
                  className={`h-2 rounded-full ${
                    (dailyRewardStatus?.current_streak || 0) % 7 >= day || (dailyRewardStatus?.current_streak || 0) % 7 === 0 && dailyRewardStatus?.current_streak >= 7
                      ? 'bg-[#F59E0B]' 
                      : 'bg-[#181824]'
                  }`}
                  title={`Tag ${day}`}
                />
              ))}
            </div>
            <p className="text-[#94A3B8] text-xs text-center mt-2">7 Tage = +10 Bonus-Gebote!</p>
          </div>

          {/* Achievements Card */}
          <div className="glass-card rounded-xl p-5" data-testid="achievements-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/20 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-[#7C3AED]" />
                </div>
                <div>
                  <h3 className="text-white font-bold">{dt.achievements}</h3>
                  <p className="text-[#94A3B8] text-sm">
                    {achievements?.total_earned || 0} / {achievements?.total_available || 12}
                  </p>
                </div>
              </div>
              <Link to="/achievements" className="text-[#7C3AED] text-sm hover:underline">
                {dt.viewAll}
              </Link>
            </div>
            
            {/* Recent Achievements */}
            <div className="flex flex-wrap gap-2">
              {achievements?.earned?.slice(0, 6).map((ach) => (
                <div 
                  key={ach.id}
                  className="px-3 py-2 rounded-lg bg-[#181824] flex items-center gap-2"
                  title={ach.description}
                >
                  <span className="text-xl">{ach.icon}</span>
                  <span className="text-white text-sm">{ach.name}</span>
                </div>
              ))}
              {(!achievements?.earned || achievements.earned.length === 0) && (
                <p className="text-[#94A3B8] text-sm">Noch keine Achievements - starte jetzt!</p>
              )}
            </div>
          </div>
        </div>

        {/* Gift Bids Card */}
        <div className="glass-card rounded-xl p-5 mb-8 bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                <Gift className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">{dt.giftBids}</h3>
                <p className="text-gray-400 text-sm">
                  {dt.giftBidsDesc}
                </p>
              </div>
            </div>
            <Link to="/gift-bids">
              <Button className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white font-bold">
                <Gift className="w-4 h-4 mr-2" />
                {dt.giftNow}
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Left 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Meine aktiven Auktionen */}
            {myBidAuctions.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-[#FFD700]" />
                    Meine aktiven Auktionen
                  </h2>
                  <Link to="/auctions" className="text-[#FFD700] text-sm hover:underline flex items-center gap-1">
                    Alle anzeigen <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {myBidAuctions.map((auction) => (
                    <div key={auction.id} className="flex items-center gap-4 p-3 rounded-lg bg-[#181824] hover:bg-white/5 transition-colors">
                      <img 
                        src={auction.product?.image_url || 'https://via.placeholder.com/60'} 
                        alt="" 
                        className="w-14 h-14 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{auction.product?.name}</p>
                        <p className="text-[#06B6D4] font-mono font-bold">€{auction.current_price?.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#94A3B8] text-xs">Letzter Bieter</p>
                        <p className={`text-sm font-medium ${auction.last_bidder_id === user.id ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                          {auction.last_bidder_name || '-'}
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => handleQuickBid(auction.id)}
                        className="bg-[#FFD700] hover:bg-[#E6C200] text-black font-bold"
                      >
                        <Zap className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live-Auktionen entdecken */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Timer className="w-5 h-5 text-[#FF4D4D]" />
                  Live-Auktionen entdecken
                </h2>
                <Link to="/auctions" className="text-[#FFD700] text-sm hover:underline flex items-center gap-1">
                  Alle anzeigen <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeAuctions.map((auction) => (
                  <Link 
                    key={auction.id} 
                    to={`/auctions/${auction.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#181824] hover:bg-white/5 transition-colors"
                  >
                    <img 
                      src={auction.product?.image_url || 'https://via.placeholder.com/50'} 
                      alt="" 
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate text-sm">{auction.product?.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#06B6D4] font-mono font-bold text-sm">€{auction.current_price?.toFixed(2)}</span>
                        <span className="text-[#94A3B8] text-xs">• {auction.total_bids} Gebote</span>
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-[#94A3B8]" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Gebots-Historie */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-[#7C3AED]" />
                  Gebots-Historie
                </h2>
                <Link to="/bid-history" className="text-[#FFD700] text-sm hover:underline flex items-center gap-1">
                  Alle anzeigen <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              {recentBids.length === 0 ? (
                <p className="text-[#94A3B8] text-center py-4">Noch keine Gebote abgegeben</p>
              ) : (
                <div className="space-y-2">
                  {recentBids.slice(0, 5).map((bid, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-[#181824]">
                      <div className="flex items-center gap-3">
                        <img 
                          src={bid.product?.image_url || 'https://via.placeholder.com/40'} 
                          alt="" 
                          className="w-10 h-10 rounded object-cover"
                        />
                        <div>
                          <p className="text-white text-sm truncate max-w-[200px]">{bid.product?.name}</p>
                          <p className="text-[#94A3B8] text-xs">€{bid.price?.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {bid.won ? (
                          <span className="flex items-center gap-1 text-[#10B981] text-xs">
                            <CheckCircle className="w-3 h-3" />Gewonnen
                          </span>
                        ) : bid.auction_ended ? (
                          <span className="flex items-center gap-1 text-[#EF4444] text-xs">
                            <XCircle className="w-3 h-3" />Verloren
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[#F59E0B] text-xs">
                            <Clock className="w-3 h-3" />Aktiv
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Right 1/3 */}
          <div className="space-y-6">
            {/* Guthaben & Voucher */}
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#FFD700]" />
                {dt.balance}
              </h2>
              <div className="text-center py-4 mb-4 rounded-xl bg-gradient-to-br from-[#FFD700]/20 to-[#FF4D4D]/20 border border-[#FFD700]/30">
                <p className="text-5xl font-bold text-[#FFD700] font-mono">{user.bids_balance || 0}</p>
                <p className="text-[#94A3B8] text-sm">{dt.bidsAvailable}</p>
              </div>
              <Link to="/buy-bids">
                <Button className="w-full btn-primary mb-4">
                  <CreditCard className="w-4 h-4 mr-2" />{dt.buyBids}
                </Button>
              </Link>
              
              {/* Voucher einlösen */}
              <div className="border-t border-white/10 pt-4">
                <p className="text-white text-sm mb-2 flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-[#FFD700]" />
                  {dt.redeemVoucher}
                </p>
                <form onSubmit={handleRedeemVoucher} className="flex gap-2">
                  <Input
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    placeholder="CODE"
                    className="bg-[#181824] border-white/10 text-white uppercase"
                  />
                  <Button type="submit" disabled={redeemingVoucher} className="bg-[#10B981] hover:bg-[#059669]">
                    <Gift className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </div>

            {/* Gewonnene Auktionen - Mit Zahlungsoption */}
            {wonAuctions.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#10B981]" />
                  {dt.won} ({wonAuctions.length})
                </h2>
                <div className="space-y-3">
                  {wonAuctions.slice(0, 5).map((auction) => {
                    const isPendingPayment = auction.status === 'pending_payment' || !auction.paid;
                    return (
                      <div key={auction.id} className={`p-3 rounded-lg border ${isPendingPayment ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[#10B981]/10 border-[#10B981]/30'}`}>
                        <div className="flex items-center gap-3">
                          <img 
                            src={auction.product?.image_url || auction.product_image || 'https://via.placeholder.com/50'} 
                            alt="" 
                            className="w-12 h-12 rounded object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{auction.product?.name || auction.product_name}</p>
                            <p className="text-[#10B981] font-bold">€ {(auction.current_price || auction.final_price)?.toFixed(2)}</p>
                            {auction.is_free_auction && (
                              <p className="text-[8px] text-amber-400">{dt.freeAuctionNote}</p>
                            )}
                          </div>
                          {isPendingPayment ? (
                            <Link to={`/checkout/won/${auction.auction_id || auction.id}`}>
                              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
                                <CreditCard className="w-4 h-4 mr-1" />
                                {dt.pay}
                              </Button>
                            </Link>
                          ) : (
                            <div className="flex items-center gap-1 text-[#10B981] text-xs">
                              <CheckCircle className="w-4 h-4" />
                              <span>{dt.paid}</span>
                            </div>
                          )}
                        </div>
                        {isPendingPayment && auction.payment_deadline && (
                          <div className="mt-2 pt-2 border-t border-white/10 text-xs text-amber-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {dt.paymentDeadline}: {new Date(auction.payment_deadline).toLocaleDateString(language === 'en' ? 'en-US' : language === 'fr' ? 'fr-FR' : language === 'tr' ? 'tr-TR' : 'de-DE')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {wonAuctions.length > 5 && (
                  <Link to="/purchases" className="text-[#06B6D4] text-sm hover:underline mt-3 block text-center">
                    {dt.showAllWon} ({wonAuctions.length}) →
                  </Link>
                )}
              </div>
            )}

            {/* Autobidder */}
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5 text-[#06B6D4]" />
                {dt.myAutobidders}
              </h2>
              {(autobidders || []).length === 0 ? (
                <p className="text-[#94A3B8] text-sm text-center py-4">
                  {dt.noAutobidderMsg}
                </p>
              ) : (
                <div className="space-y-2">
                  {(autobidders || []).map((ab) => (
                    <div key={ab.id} className="flex items-center justify-between p-3 rounded-lg bg-[#181824]">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{ab.auction_name || 'Auktion'}</p>
                        <p className="text-[#94A3B8] text-xs">Max: €{ab.max_price?.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleToggleAutobidder(ab.id, ab.is_active)}
                          className={ab.is_active ? 'text-[#10B981]' : 'text-[#94A3B8]'}
                        >
                          <Power className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDeleteAutobidder(ab.id)}
                          className="text-[#EF4444]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2FA Sicherheitseinstellungen */}
            <TwoFactorSettings />

            {/* Letzte Käufe */}
            {purchases.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Package className="w-5 h-5 text-[#FFD700]" />
                    Letzte Käufe
                  </h2>
                  <Link to="/purchases" className="text-[#FFD700] text-sm hover:underline">
                    Alle
                  </Link>
                </div>
                <div className="space-y-2">
                  {purchases.map((purchase, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-[#181824]">
                      <div>
                        <p className="text-white text-sm">{purchase.package_name || 'Gebotspaket'}</p>
                        <p className="text-[#94A3B8] text-xs">{purchase.bids} Gebote</p>
                      </div>
                      <p className="text-[#10B981] font-bold">€{purchase.amount?.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Schnellzugriff</h2>
              <div className="space-y-2">
                <Link to="/achievements" className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-[#FFD700]/10 to-[#FF4D4D]/10 border border-[#FFD700]/30 hover:bg-[#FFD700]/20 transition-colors">
                  <span className="flex items-center gap-2 text-[#FFD700]"><Trophy className="w-4 h-4" />Achievements & Belohnungen</span>
                  <ChevronRight className="w-4 h-4 text-[#FFD700]" />
                </Link>
                <Link to="/profile" className="flex items-center justify-between p-3 rounded-lg bg-[#181824] hover:bg-white/5 transition-colors">
                  <span className="flex items-center gap-2 text-white"><User className="w-4 h-4 text-[#94A3B8]" />Profil bearbeiten</span>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                </Link>
                <Link to="/bid-history" className="flex items-center justify-between p-3 rounded-lg bg-[#181824] hover:bg-white/5 transition-colors">
                  <span className="flex items-center gap-2 text-white"><History className="w-4 h-4 text-[#94A3B8]" />Gebots-Historie</span>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                </Link>
                <Link to="/purchases" className="flex items-center justify-between p-3 rounded-lg bg-[#181824] hover:bg-white/5 transition-colors">
                  <span className="flex items-center gap-2 text-white"><Package className="w-4 h-4 text-[#94A3B8]" />Meine Käufe</span>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                </Link>
                <Link to="/invoices" className="flex items-center justify-between p-3 rounded-lg bg-[#181824] hover:bg-white/5 transition-colors">
                  <span className="flex items-center gap-2 text-white"><FileText className="w-4 h-4 text-[#94A3B8]" />Rechnungen</span>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                </Link>
                <Link to="/invite" className="flex items-center justify-between p-3 rounded-lg bg-[#181824] hover:bg-white/5 transition-colors">
                  <span className="flex items-center gap-2 text-white"><Gift className="w-4 h-4 text-[#10B981]" />Freunde einladen</span>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
