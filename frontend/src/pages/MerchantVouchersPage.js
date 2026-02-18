/**
 * MerchantVouchersPage - Händler-Gutscheine Seite
 * Zeigt alle Partner/Händler und deren Gutscheine zum Bieten
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Store, Ticket, Clock, ChevronRight, ChevronLeft, Zap, Gift, 
  MapPin, Phone, Globe, Star, Euro, Users, Gavel, Trophy,
  Search, Filter, Coffee, Utensils, Wine, ShoppingBag, Sparkles,
  Heart, Award, Timer, ArrowRight
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const translations = {
  de: {
    title: 'Händler-Gutscheine',
    subtitle: 'Ersteigere Gutscheine bei lokalen Partnern',
    allMerchants: 'Alle Händler',
    searchPlaceholder: 'Händler suchen...',
    filterAll: 'Alle',
    filterRestaurant: 'Restaurants',
    filterBar: 'Bars',
    filterCafe: 'Cafés',
    filterRetail: 'Einzelhandel',
    filterWellness: 'Wellness',
    filterOther: 'Sonstige',
    noMerchants: 'Keine Händler gefunden',
    vouchers: 'Gutscheine',
    noVouchers: 'Noch keine Gutscheine verfügbar',
    value: 'Wert',
    currentPrice: 'Aktueller Preis',
    bids: 'Gebote',
    endsIn: 'Endet in',
    bidNow: 'Jetzt bieten',
    viewMerchant: 'Händler ansehen',
    back: 'Zurück',
    activeAuctions: 'Aktive Auktionen',
    wonVouchers: 'Gewonnene Gutscheine',
    redeemAt: 'Einlösbar bei',
    savings: 'Ersparnis',
    hot: 'Beliebt',
    new: 'Neu',
    endingSoon: 'Endet bald',
    address: 'Adresse',
    phone: 'Telefon',
    website: 'Website',
    openingHours: 'Öffnungszeiten',
    about: 'Über uns',
    availableVouchers: 'Verfügbare Gutscheine',
    comingSoon: 'Bald verfügbar',
    winnerGets: 'Gewinner erhält',
    redeemInfo: 'Nach dem Gewinn können Sie diesen Gutschein direkt beim Händler einlösen.',
    howItWorks: 'So funktioniert\'s',
    step1: 'Wählen Sie einen Händler',
    step2: 'Bieten Sie auf einen Gutschein',
    step3: 'Gewinnen Sie und lösen Sie beim Händler ein'
  },
  en: {
    title: 'Merchant Vouchers',
    subtitle: 'Bid on vouchers from local partners',
    allMerchants: 'All Merchants',
    searchPlaceholder: 'Search merchants...',
    filterAll: 'All',
    filterRestaurant: 'Restaurants',
    filterBar: 'Bars',
    filterCafe: 'Cafés',
    filterRetail: 'Retail',
    filterWellness: 'Wellness',
    filterOther: 'Other',
    noMerchants: 'No merchants found',
    vouchers: 'Vouchers',
    noVouchers: 'No vouchers available yet',
    value: 'Value',
    currentPrice: 'Current Price',
    bids: 'Bids',
    endsIn: 'Ends in',
    bidNow: 'Bid Now',
    viewMerchant: 'View Merchant',
    back: 'Back',
    activeAuctions: 'Active Auctions',
    wonVouchers: 'Won Vouchers',
    redeemAt: 'Redeem at',
    savings: 'Savings',
    hot: 'Hot',
    new: 'New',
    endingSoon: 'Ending soon',
    address: 'Address',
    phone: 'Phone',
    website: 'Website',
    openingHours: 'Opening Hours',
    about: 'About',
    availableVouchers: 'Available Vouchers',
    comingSoon: 'Coming Soon',
    winnerGets: 'Winner gets',
    redeemInfo: 'After winning, you can redeem this voucher directly at the merchant.',
    howItWorks: 'How it works',
    step1: 'Choose a merchant',
    step2: 'Bid on a voucher',
    step3: 'Win and redeem at the merchant'
  }
};

const categoryIcons = {
  restaurant: <Utensils className="w-5 h-5" />,
  bar: <Wine className="w-5 h-5" />,
  cafe: <Coffee className="w-5 h-5" />,
  retail: <ShoppingBag className="w-5 h-5" />,
  wellness: <Sparkles className="w-5 h-5" />,
  other: <Store className="w-5 h-5" />
};

const categoryColors = {
  restaurant: 'from-orange-500 to-red-500',
  bar: 'from-purple-500 to-pink-500',
  cafe: 'from-amber-500 to-yellow-500',
  retail: 'from-blue-500 to-cyan-500',
  wellness: 'from-green-500 to-emerald-500',
  other: 'from-gray-500 to-slate-500'
};

const MerchantVouchersPage = () => {
  const navigate = useNavigate();
  const { merchantId } = useParams();
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language] || translations.de;

  const [merchants, setMerchants] = useState([]);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // Fetch all merchants with vouchers
  const fetchMerchants = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/merchant-vouchers/merchants`);
      if (res.ok) {
        const data = await res.json();
        setMerchants(data.merchants || []);
      }
    } catch (err) {
      console.error('Error fetching merchants:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch vouchers for a specific merchant
  const fetchMerchantVouchers = useCallback(async (mId) => {
    try {
      setLoading(true);
      const [merchantRes, vouchersRes] = await Promise.all([
        fetch(`${API}/api/merchant-vouchers/merchant/${mId}`),
        fetch(`${API}/api/merchant-vouchers/merchant/${mId}/vouchers`)
      ]);
      
      if (merchantRes.ok) {
        const merchantData = await merchantRes.json();
        setSelectedMerchant(merchantData.merchant);
      }
      
      if (vouchersRes.ok) {
        const vouchersData = await vouchersRes.json();
        setVouchers(vouchersData.vouchers || []);
      }
    } catch (err) {
      console.error('Error fetching merchant vouchers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (merchantId) {
      fetchMerchantVouchers(merchantId);
    } else {
      fetchMerchants();
      setSelectedMerchant(null);
    }
  }, [merchantId, fetchMerchants, fetchMerchantVouchers]);

  const formatTimeLeft = (endTime) => {
    if (!endTime) return '--:--';
    const now = new Date();
    const end = new Date(endTime);
    const diff = Math.max(0, end - now) / 1000;

    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const filteredMerchants = merchants.filter(m => {
    const matchesSearch = m.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         m.city?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' || m.business_type === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const filterButtons = [
    { id: 'all', label: t.filterAll, icon: <Store className="w-4 h-4" /> },
    { id: 'restaurant', label: t.filterRestaurant, icon: <Utensils className="w-4 h-4" /> },
    { id: 'bar', label: t.filterBar, icon: <Wine className="w-4 h-4" /> },
    { id: 'cafe', label: t.filterCafe, icon: <Coffee className="w-4 h-4" /> },
    { id: 'retail', label: t.filterRetail, icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'wellness', label: t.filterWellness, icon: <Sparkles className="w-4 h-4" /> },
  ];

  // Merchant Detail View
  if (selectedMerchant) {
    const category = selectedMerchant.business_type || 'other';
    const colorClass = categoryColors[category] || categoryColors.other;

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 pt-20 pb-12">
        <div className="max-w-6xl mx-auto px-4">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate('/haendler-gutscheine')}
            className="mb-4 text-gray-600 hover:text-gray-800"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t.back}
          </Button>

          {/* Merchant Header */}
          <div className={`bg-gradient-to-r ${colorClass} rounded-2xl p-6 mb-6 text-white`}>
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 bg-white/20 rounded-xl flex items-center justify-center">
                {selectedMerchant.logo_url ? (
                  <img src={selectedMerchant.logo_url} alt={selectedMerchant.business_name} className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  categoryIcons[category] || <Store className="w-10 h-10" />
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{selectedMerchant.business_name}</h1>
                <p className="text-white/80 text-sm flex items-center gap-1 mt-1">
                  <MapPin className="w-4 h-4" />
                  {selectedMerchant.city}, {selectedMerchant.address}
                </p>
                {selectedMerchant.phone && (
                  <p className="text-white/80 text-sm flex items-center gap-1 mt-1">
                    <Phone className="w-4 h-4" />
                    {selectedMerchant.phone}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="bg-white/20 rounded-lg px-3 py-1">
                  <span className="text-sm font-medium">{vouchers.length} {t.vouchers}</span>
                </div>
              </div>
            </div>
            
            {selectedMerchant.description && (
              <p className="mt-4 text-white/90 text-sm">{selectedMerchant.description}</p>
            )}
          </div>

          {/* Vouchers Grid */}
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-amber-500" />
            {t.availableVouchers}
          </h2>

          {vouchers.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
              <Ticket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">{t.noVouchers}</p>
              <p className="text-gray-400 text-sm mt-2">{t.comingSoon}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vouchers.map((voucher) => {
                const savings = voucher.voucher_value 
                  ? Math.round((1 - (voucher.current_price || 0) / voucher.voucher_value) * 100)
                  : 95;
                const timeLeft = formatTimeLeft(voucher.end_time);
                const isEndingSoon = timeLeft.endsWith('s') || (timeLeft.endsWith('m') && parseInt(timeLeft) < 10);

                return (
                  <div
                    key={voucher.id}
                    className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-100 dark:border-gray-700"
                  >
                    {/* Voucher Header */}
                    <div className={`bg-gradient-to-r ${colorClass} p-4 text-white`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white/70 text-xs">{t.winnerGets}</p>
                          <p className="text-2xl font-bold">€{voucher.voucher_value}</p>
                        </div>
                        <div className="bg-white/20 rounded-lg px-2 py-1">
                          <span className="text-sm font-bold">-{savings}%</span>
                        </div>
                      </div>
                      <p className="text-white/90 text-sm mt-2">{voucher.name || 'Gutschein'}</p>
                    </div>

                    {/* Voucher Body */}
                    <div className="p-4">
                      {voucher.description && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{voucher.description}</p>
                      )}

                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <p className="text-xs text-gray-400">{t.currentPrice}</p>
                          <p className="text-xl font-bold text-amber-600">€{(voucher.current_price || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">{t.bids}</p>
                          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">{voucher.total_bids || 0}</p>
                        </div>
                      </div>

                      {/* Timer */}
                      <div className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg mb-3 ${
                        isEndingSoon ? 'bg-red-100 text-red-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">{t.endsIn}: {timeLeft}</span>
                      </div>

                      {/* Info */}
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 mb-3">
                        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <Gift className="w-3 h-3" />
                          {t.redeemInfo}
                        </p>
                      </div>

                      <Button
                        onClick={() => navigate(`/auctions/${voucher.auction_id || voucher.id}`)}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        {t.bidNow}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Merchants List View
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 pt-20 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-full mb-4">
            <Ticket className="w-5 h-5" />
            <span className="font-bold">{t.title}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">{t.subtitle}</h1>
          
          {/* How it works */}
          <div className="flex flex-wrap justify-center gap-4 mt-6 text-sm">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-sm">
              <div className="w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center font-bold text-xs">1</div>
              <span className="text-gray-600 dark:text-gray-400">{t.step1}</span>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-sm">
              <div className="w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center font-bold text-xs">2</div>
              <span className="text-gray-600 dark:text-gray-400">{t.step2}</span>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-sm">
              <div className="w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center font-bold text-xs">3</div>
              <span className="text-gray-600 dark:text-gray-400">{t.step3}</span>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              {filterButtons.map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setActiveFilter(btn.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeFilter === btn.id
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {btn.icon}
                  <span className="hidden sm:inline">{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Merchants Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
          </div>
        ) : filteredMerchants.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
            <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">{t.noMerchants}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMerchants.map((merchant) => {
              const category = merchant.business_type || 'other';
              const colorClass = categoryColors[category] || categoryColors.other;
              const voucherCount = merchant.voucher_count || 0;

              return (
                <div
                  key={merchant.id}
                  onClick={() => navigate(`/haendler-gutscheine/${merchant.id}`)}
                  className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all cursor-pointer border border-gray-100 dark:border-gray-700 group"
                >
                  {/* Merchant Header with gradient */}
                  <div className={`bg-gradient-to-r ${colorClass} p-4 text-white`}>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                        {merchant.logo_url ? (
                          <img src={merchant.logo_url} alt={merchant.business_name} className="w-12 h-12 rounded-lg object-cover" />
                        ) : (
                          categoryIcons[category] || <Store className="w-8 h-8" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg truncate">{merchant.business_name}</h3>
                        <p className="text-white/80 text-sm flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {merchant.city}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Merchant Body */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {voucherCount} {t.vouchers}
                        </span>
                      </div>
                      {voucherCount > 0 && (
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                          {t.activeAuctions}
                        </span>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      className="w-full group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 transition-all"
                    >
                      {t.viewMerchant}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MerchantVouchersPage;
