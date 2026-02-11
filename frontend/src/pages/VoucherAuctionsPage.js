import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Ticket, Gift, Clock, Tag, ChevronRight, Zap,
  Star, ShoppingBag, Euro, Percent
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const translations = {
  de: {
    title: 'Gutschein-Auktionen',
    subtitle: 'Ersteigere Gutscheine zu Schnäppchenpreisen!',
    activeAuctions: 'Aktive Gutschein-Auktionen',
    endingSoon: 'Endet bald',
    currentPrice: 'Aktueller Preis',
    voucherValue: 'Gutscheinwert',
    savings: 'Ersparnis',
    timeLeft: 'Verbleibend',
    bidNow: 'Jetzt bieten',
    view: 'Ansehen',
    bids: 'Gebote',
    noAuctions: 'Keine Gutschein-Auktionen aktiv',
    checkBack: 'Schau später wieder vorbei!',
    loading: 'Laden...',
    merchant: 'Anbieter',
    validity: 'Gültigkeit',
    months: 'Monate',
    unlimited: 'Unbegrenzt',
    categories: 'Kategorien',
    all: 'Alle',
    shopping: 'Shopping',
    travel: 'Reisen',
    food: 'Essen',
    entertainment: 'Unterhaltung',
    tech: 'Technik',
    howItWorks: 'So funktioniert es',
    step1: 'Wähle einen Gutschein aus',
    step2: 'Biete wie bei normalen Auktionen',
    step3: 'Bei Gewinn erhältst du den Gutscheincode!',
    popular: 'Beliebt',
    newVouchers: 'Neu'
  },
  en: {
    title: 'Voucher Auctions',
    subtitle: 'Bid on vouchers at bargain prices!',
    activeAuctions: 'Active Voucher Auctions',
    endingSoon: 'Ending Soon',
    currentPrice: 'Current Price',
    voucherValue: 'Voucher Value',
    savings: 'Savings',
    timeLeft: 'Time Left',
    bidNow: 'Bid Now',
    view: 'View',
    bids: 'Bids',
    noAuctions: 'No voucher auctions active',
    checkBack: 'Check back later!',
    loading: 'Loading...',
    merchant: 'Merchant',
    validity: 'Validity',
    months: 'Months',
    unlimited: 'Unlimited',
    categories: 'Categories',
    all: 'All',
    shopping: 'Shopping',
    travel: 'Travel',
    food: 'Food',
    entertainment: 'Entertainment',
    tech: 'Tech',
    howItWorks: 'How it works',
    step1: 'Choose a voucher',
    step2: 'Bid like normal auctions',
    step3: 'Win and receive your voucher code!',
    popular: 'Popular',
    newVouchers: 'New'
  },
  sq: {
    title: 'Ankandat e Kuponave',
    subtitle: 'Ofertoni për kupona me çmime të lira!',
    activeAuctions: 'Ankandat Aktive të Kuponave',
    endingSoon: 'Përfundon së shpejti',
    currentPrice: 'Çmimi Aktual',
    voucherValue: 'Vlera e Kuponit',
    savings: 'Kursimi',
    timeLeft: 'Koha e Mbetur',
    bidNow: 'Oferto Tani',
    view: 'Shiko',
    bids: 'Oferta',
    noAuctions: 'Asnjë ankand kuponash aktiv',
    checkBack: 'Kthehuni më vonë!',
    loading: 'Duke ngarkuar...',
    merchant: 'Tregtari',
    validity: 'Vlefshmëria',
    months: 'Muaj',
    unlimited: 'Pa limit',
    categories: 'Kategorit',
    all: 'Të gjitha',
    shopping: 'Blerje',
    travel: 'Udhëtime',
    food: 'Ushqim',
    entertainment: 'Argëtim',
    tech: 'Teknologji',
    howItWorks: 'Si funksionon',
    step1: 'Zgjidhni një kupon',
    step2: 'Ofertoni si në ankandat normale',
    step3: 'Fitoni dhe merrni kodin tuaj!',
    popular: 'Popullore',
    newVouchers: 'Të reja'
  }
};

const VoucherAuctionsPage = () => {
  const { isAuthenticated, token } = useAuth();
  const { language, mappedLanguage } = useLanguage();
  const navigate = useNavigate();
  const langKey = mappedLanguage || language;
  const t = translations[langKey] || translations.de;

  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const fetchVoucherAuctions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/voucher-auctions/active`);
      if (res.ok) {
        const data = await res.json();
        setAuctions(data.auctions || []);
      } else {
        // Fallback to regular auctions with voucher tag
        const fallbackRes = await fetch(`${API}/api/auctions?status=active&category=voucher`);
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          setAuctions(data.auctions || []);
        }
      }
    } catch (err) {
      console.error('Error fetching voucher auctions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVoucherAuctions();
    const interval = setInterval(fetchVoucherAuctions, 15000);
    return () => clearInterval(interval);
  }, [fetchVoucherAuctions]);

  const formatTimeLeft = (endTime) => {
    if (!endTime) return '--:--';
    const now = new Date();
    const end = new Date(endTime);
    const diff = Math.max(0, end - now) / 1000;

    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  };

  const categories = [
    { id: 'all', label: t.all, icon: <Tag className="w-4 h-4" /> },
    { id: 'shopping', label: t.shopping, icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'food', label: t.food, icon: <Gift className="w-4 h-4" /> },
    { id: 'tech', label: t.tech, icon: <Zap className="w-4 h-4" /> },
    { id: 'entertainment', label: t.entertainment, icon: <Star className="w-4 h-4" /> }
  ];

  const filteredAuctions = selectedCategory === 'all'
    ? auctions
    : auctions.filter(a => a.category === selectedCategory);

  // Demo vouchers if no real data
  const demoVouchers = [
    {
      id: 'demo1',
      product_name: 'Amazon €50 Gutschein',
      merchant: 'Amazon',
      voucher_value: 50,
      current_price: 2.45,
      total_bids: 127,
      end_time: new Date(Date.now() + 3600000).toISOString(),
      category: 'shopping',
      image_url: 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=200'
    },
    {
      id: 'demo2',
      product_name: 'MediaMarkt €100 Gutschein',
      merchant: 'MediaMarkt',
      voucher_value: 100,
      current_price: 4.80,
      total_bids: 89,
      end_time: new Date(Date.now() + 1800000).toISOString(),
      category: 'tech',
      image_url: 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=200'
    },
    {
      id: 'demo3',
      product_name: 'Lieferando €25 Gutschein',
      merchant: 'Lieferando',
      voucher_value: 25,
      current_price: 1.20,
      total_bids: 45,
      end_time: new Date(Date.now() + 7200000).toISOString(),
      category: 'food',
      image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200'
    },
    {
      id: 'demo4',
      product_name: 'Netflix 3-Monats Abo',
      merchant: 'Netflix',
      voucher_value: 39,
      current_price: 1.85,
      total_bids: 156,
      end_time: new Date(Date.now() + 900000).toISOString(),
      category: 'entertainment',
      image_url: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=200'
    }
  ];

  const displayAuctions = auctions.length > 0 ? filteredAuctions : demoVouchers.filter(
    v => selectedCategory === 'all' || v.category === selectedCategory
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900 pt-20 pb-24 px-4" data-testid="voucher-auctions-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Ticket className="w-10 h-10 text-purple-500" />
            <h1 className="text-3xl font-black text-white">{t.title}</h1>
          </div>
          <p className="text-gray-400">{t.subtitle}</p>
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </div>

        {/* Auctions Grid */}
        {loading ? (
          <div className="text-center py-12">
            <Ticket className="w-12 h-12 text-purple-500 mx-auto animate-pulse" />
            <p className="text-gray-400 mt-4">{t.loading}</p>
          </div>
        ) : displayAuctions.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 rounded-xl">
            <Ticket className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">{t.noAuctions}</p>
            <p className="text-gray-500 text-sm">{t.checkBack}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayAuctions.map((auction) => {
              const savings = auction.voucher_value 
                ? Math.round((1 - auction.current_price / auction.voucher_value) * 100)
                : 95;

              return (
                <div
                  key={auction.id}
                  className="bg-gray-800/80 backdrop-blur rounded-xl overflow-hidden border border-purple-500/30 hover:border-purple-500/50 transition-all group"
                >
                  {/* Image */}
                  <div className="relative h-40 bg-gradient-to-br from-purple-600/20 to-pink-600/20">
                    {auction.image_url || auction.product_image ? (
                      <img
                        src={auction.image_url || auction.product_image}
                        alt={auction.product_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Ticket className="w-16 h-16 text-purple-500/50" />
                      </div>
                    )}

                    {/* Savings Badge */}
                    <div className="absolute top-3 right-3 px-3 py-1 bg-green-500 rounded-full text-white font-bold text-sm flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      {savings}% {t.savings}
                    </div>

                    {/* Time Badge */}
                    <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/60 backdrop-blur rounded-full text-white text-sm flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimeLeft(auction.end_time)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="text-white font-bold text-lg mb-1 truncate">
                      {auction.product_name}
                    </h3>
                    <p className="text-purple-400 text-sm mb-3">
                      {auction.merchant || 'Premium Partner'}
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-gray-700/50 rounded-lg p-2 text-center">
                        <p className="text-gray-400 text-xs">{t.voucherValue}</p>
                        <p className="text-white font-bold">€{auction.voucher_value || 50}</p>
                      </div>
                      <div className="bg-purple-500/20 rounded-lg p-2 text-center border border-purple-500/30">
                        <p className="text-gray-400 text-xs">{t.currentPrice}</p>
                        <p className="text-purple-400 font-bold">€{auction.current_price?.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-400 text-sm">
                        {auction.total_bids || 0} {t.bids}
                      </span>
                    </div>

                    <Button
                      onClick={() => navigate(`/auctions/${auction.id}`)}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
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

        {/* How It Works */}
        <div className="mt-12 bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-white font-bold text-lg mb-6 text-center flex items-center justify-center gap-2">
            <Gift className="w-5 h-5 text-purple-500" />
            {t.howItWorks}
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 font-bold text-xl mx-auto mb-3">1</div>
              <p className="text-white font-medium mb-1">{t.step1}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 font-bold text-xl mx-auto mb-3">2</div>
              <p className="text-white font-medium mb-1">{t.step2}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 font-bold text-xl mx-auto mb-3">3</div>
              <p className="text-white font-medium mb-1">{t.step3}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoucherAuctionsPage;
