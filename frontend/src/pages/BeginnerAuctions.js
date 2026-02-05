import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  ShieldCheck, Clock, Trophy, Zap, Star, 
  ChevronRight, Lock, Users, Gift
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const BeginnerAuctions = () => {
  const { token, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState([]);
  const [beginnerStatus, setBeginnerStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const texts = {
    de: {
      title: 'Anfänger-Auktionen',
      subtitle: 'Exklusive Auktionen nur für neue Bieter!',
      description: 'Geringere Konkurrenz = Höhere Gewinnchancen',
      eligible: 'Du bist berechtigt!',
      notEligible: 'Du bist kein Anfänger mehr',
      criteria: 'Berechtigung',
      maxWins: 'Weniger als 10 Siege',
      or: 'oder',
      newUser: 'Registriert innerhalb 7 Tagen',
      yourWins: 'Deine Siege',
      daysRegistered: 'Tage seit Registrierung',
      noAuctions: 'Keine Anfänger-Auktionen verfügbar',
      checkBack: 'Schaue später wieder vorbei!',
      currentPrice: 'Aktueller Preis',
      endsIn: 'Endet in',
      bid: 'Bieten',
      loginRequired: 'Bitte einloggen',
      specialBadge: 'NUR FÜR ANFÄNGER',
      protectedAuction: 'Geschützte Auktion',
      lessBidders: 'Weniger Bieter',
      betterChances: 'Bessere Chancen'
    },
    en: {
      title: 'Beginner Auctions',
      subtitle: 'Exclusive auctions for new bidders only!',
      description: 'Less competition = Higher winning chances',
      eligible: 'You are eligible!',
      notEligible: 'You are no longer a beginner',
      criteria: 'Eligibility',
      maxWins: 'Less than 10 wins',
      or: 'or',
      newUser: 'Registered within 7 days',
      yourWins: 'Your wins',
      daysRegistered: 'Days since registration',
      noAuctions: 'No beginner auctions available',
      checkBack: 'Check back later!',
      currentPrice: 'Current Price',
      endsIn: 'Ends in',
      bid: 'Bid',
      loginRequired: 'Please login',
      specialBadge: 'BEGINNERS ONLY',
      protectedAuction: 'Protected Auction',
      lessBidders: 'Less bidders',
      betterChances: 'Better chances'
    },
    tr: {
      title: 'Yeni Başlayan Açık Artırmaları',
      subtitle: 'Sadece yeni teklifçilere özel açık artırmalar!',
      description: 'Daha az rekabet = Daha yüksek kazanma şansı',
      eligible: 'Katılmaya hak kazandınız!',
      notEligible: 'Artık yeni başlayan değilsiniz',
      criteria: 'Uygunluk',
      maxWins: '10\'dan az kazanma',
      or: 'veya',
      newUser: '7 gün içinde kayıt',
      yourWins: 'Kazanmalarınız',
      daysRegistered: 'Kayıttan bu yana gün',
      noAuctions: 'Yeni başlayan açık artırması yok',
      checkBack: 'Daha sonra tekrar kontrol edin!',
      currentPrice: 'Güncel Fiyat',
      endsIn: 'Bitiş',
      bid: 'Teklif Ver',
      loginRequired: 'Lütfen giriş yapın',
      specialBadge: 'SADECE YENİ BAŞLAYANLAR',
      protectedAuction: 'Korumalı Açık Artırma',
      lessBidders: 'Daha az teklifçi',
      betterChances: 'Daha iyi şanslar'
    }
  };
  const t = texts[language] || texts.de;

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const [statusRes, auctionsRes] = await Promise.all([
          axios.get(`${API}/api/gamification/beginner-status`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API}/api/gamification/auctions/beginner`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => ({ data: { auctions: [] } }))
        ]);

        setBeginnerStatus(statusRes.data);
        setAuctions(auctionsRes.data.auctions || []);
      } catch (err) {
        console.error('Error fetching beginner data:', err);
        if (err.response?.status === 403) {
          setBeginnerStatus({ is_beginner: false, wins: 10 });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleBid = async (auctionId) => {
    if (!isAuthenticated) {
      toast.error(t.loginRequired);
      navigate('/login');
      return;
    }

    try {
      const res = await axios.post(
        `${API}/api/auctions/${auctionId}/bid`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Gebot platziert!');
    } catch (err) {
      // Check if it's an authentication error
      if (err.response?.status === 401 || err.response?.status === 403) {
        toast.error('Bitte anmelden um zu bieten');
        navigate('/login');
        return;
      }
      toast.error(err.response?.data?.detail || 'Fehler beim Bieten');
    }
  };

  const formatTime = (endTime) => {
    if (!endTime) return '';
    const end = new Date(endTime);
    const now = new Date();
    const diff = end - now;
    
    if (diff <= 0) return 'Beendet';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-400"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-12 px-4">
        <div className="max-w-lg mx-auto text-center">
          <ShieldCheck className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{t.title}</h1>
          <p className="text-gray-500 mb-6">{t.loginRequired}</p>
          <Button onClick={() => navigate('/login')} className="bg-green-500 hover:bg-green-600">
            Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <ShieldCheck className="w-10 h-10 text-green-400" />
            <h1 className="text-3xl font-bold text-gray-800">{t.title}</h1>
          </div>
          <p className="text-green-400 text-lg">{t.subtitle}</p>
          <p className="text-gray-500 mt-1">{t.description}</p>
        </div>

        {/* Eligibility Status */}
        {beginnerStatus && (
          <div className={`mb-8 p-6 rounded-xl border ${
            beginnerStatus.is_beginner 
              ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30'
              : 'bg-gradient-to-r from-gray-800/50 to-gray-700/50 border-gray-600/30'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Status */}
              <div className="flex items-center gap-3">
                {beginnerStatus.is_beginner ? (
                  <>
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-green-400 font-bold text-lg">{t.eligible}</p>
                      <p className="text-gray-500 text-sm">
                        {t.yourWins}: {beginnerStatus.wins} | {t.daysRegistered}: {beginnerStatus.days_since_registration}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-gray-600/20 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-gray-600 font-bold">{t.notEligible}</p>
                      <p className="text-gray-500 text-sm">
                        {t.yourWins}: {beginnerStatus.wins}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Criteria */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  <span className="text-gray-600">{t.maxWins}</span>
                </div>
                <span className="text-gray-500">{t.or}</span>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5">
                  <Star className="w-4 h-4 text-blue-400" />
                  <span className="text-gray-600">{t.newUser}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Benefits Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="glass-card p-4 rounded-xl text-center">
            <ShieldCheck className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-gray-800 font-bold">{t.protectedAuction}</p>
            <p className="text-gray-500 text-sm">{t.specialBadge}</p>
          </div>
          <div className="glass-card p-4 rounded-xl text-center">
            <Users className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className="text-gray-800 font-bold">{t.lessBidders}</p>
            <p className="text-gray-500 text-sm">&lt; 10 {language === 'de' ? 'Teilnehmer' : 'participants'}</p>
          </div>
          <div className="glass-card p-4 rounded-xl text-center">
            <Gift className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-gray-800 font-bold">{t.betterChances}</p>
            <p className="text-gray-500 text-sm">3x {language === 'de' ? 'höher' : 'higher'}</p>
          </div>
        </div>

        {/* Auctions Grid */}
        {auctions.length === 0 ? (
          <div className="text-center py-12 glass-card rounded-xl">
            <ShieldCheck className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">{t.noAuctions}</p>
            <p className="text-gray-500">{t.checkBack}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {auctions.map(auction => (
              <div 
                key={auction.id}
                className="glass-card rounded-xl overflow-hidden border border-green-500/30 hover:border-green-400/50 transition-all cursor-pointer"
                onClick={() => navigate(`/auctions/${auction.id}`)}
              >
                {/* Badge */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-3 py-1 text-center">
                  <span className="text-gray-800 text-xs font-bold flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {t.specialBadge}
                  </span>
                </div>

                {/* Product Image */}
                <div className="p-4">
                  <div className="aspect-square bg-[#1A1A2E] rounded-lg flex items-center justify-center mb-3">
                    <img 
                      src={auction.product?.image_url || 'https://via.placeholder.com/150'}
                      alt={auction.product?.name}
                      className="max-w-full max-h-full object-contain p-2"
                    />
                  </div>

                  {/* Product Info */}
                  <h3 className="text-gray-800 font-bold text-sm mb-2 line-clamp-2">
                    {auction.product?.name}
                  </h3>

                  {/* Price & Timer */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-gray-500 text-xs">{t.currentPrice}</p>
                      <p className="text-green-400 font-bold text-xl">
                        €{auction.current_price?.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 text-xs">{t.endsIn}</p>
                      <p className="text-gray-800 font-mono">
                        <Clock className="w-4 h-4 inline mr-1" />
                        {formatTime(auction.end_time)}
                      </p>
                    </div>
                  </div>

                  {/* Bid Button */}
                  <Button 
                    onClick={(e) => { e.stopPropagation(); handleBid(auction.id); }}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400"
                    disabled={!beginnerStatus?.is_beginner}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {t.bid}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BeginnerAuctions;
