/**
 * VoucherAuctionsSection - Händler-Gutscheine Sektion für die Startseite
 * Zeigt aktive Gutschein-Auktionen (Restaurant, Bar, etc.) direkt auf der Startseite
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Ticket, Clock, ChevronRight, Zap, Gift, Store,
  Percent, Euro, Star, Coffee, Utensils, Wine, 
  ShoppingBag, Sparkles
} from 'lucide-react';
import { Button } from './ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

const translations = {
  de: {
    title: 'Händler-Gutscheine',
    subtitle: 'Ersteigere Gutscheine für Restaurants, Bars & mehr!',
    viewAll: 'Alle Gutschein-Auktionen →',
    currentPrice: 'Preis',
    voucherValue: 'Wert',
    savings: 'Ersparnis',
    bidNow: 'Bieten',
    noAuctions: 'Bald neue Gutscheine!',
    bids: 'Gebote',
    endsIn: 'Endet in',
    partner: 'Partner',
    hot: 'Heiß',
    new: 'Neu',
    endingSoon: 'Endet bald',
    restaurant: 'Restaurant',
    bar: 'Bar',
    cafe: 'Café',
    retail: 'Einzelhandel',
    wellness: 'Wellness'
  },
  en: {
    title: 'Merchant Vouchers',
    subtitle: 'Bid on vouchers for restaurants, bars & more!',
    viewAll: 'All Voucher Auctions →',
    currentPrice: 'Price',
    voucherValue: 'Value',
    savings: 'Savings',
    bidNow: 'Bid',
    noAuctions: 'New vouchers coming soon!',
    bids: 'Bids',
    endsIn: 'Ends in',
    partner: 'Partner',
    hot: 'Hot',
    new: 'New',
    endingSoon: 'Ending soon',
    restaurant: 'Restaurant',
    bar: 'Bar',
    cafe: 'Café',
    retail: 'Retail',
    wellness: 'Wellness'
  },
  tr: {
    title: 'Satıcı Kuponları',
    subtitle: 'Restoran, bar ve daha fazlası için kupon alın!',
    viewAll: 'Tüm Kupon Müzayedeleri →',
    currentPrice: 'Fiyat',
    voucherValue: 'Değer',
    savings: 'Tasarruf',
    bidNow: 'Teklif Ver',
    noAuctions: 'Yakında yeni kuponlar!',
    bids: 'Teklifler',
    endsIn: 'Biter',
    partner: 'Ortak',
    hot: 'Sıcak',
    new: 'Yeni',
    endingSoon: 'Yakında bitiyor'
  },
  ar: {
    title: 'قسائم التجار',
    subtitle: 'زايد على قسائم للمطاعم والبارات والمزيد!',
    viewAll: 'جميع مزادات القسائم ←',
    currentPrice: 'السعر',
    voucherValue: 'القيمة',
    savings: 'التوفير',
    bidNow: 'زايد',
    noAuctions: 'قسائم جديدة قريباً!',
    bids: 'عروض',
    endsIn: 'ينتهي في',
    partner: 'شريك',
    hot: 'ساخن',
    new: 'جديد',
    endingSoon: 'ينتهي قريباً'
  }
};

const categoryIcons = {
  restaurant: <Utensils className="w-4 h-4" />,
  bar: <Wine className="w-4 h-4" />,
  cafe: <Coffee className="w-4 h-4" />,
  retail: <ShoppingBag className="w-4 h-4" />,
  wellness: <Sparkles className="w-4 h-4" />,
  default: <Store className="w-4 h-4" />
};

const VoucherAuctionsSection = ({ language = 'de' }) => {
  const navigate = useNavigate();
  const t = translations[language] || translations.de;
  
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchVoucherAuctions = useCallback(async () => {
    try {
      // First try the dedicated voucher auctions endpoint
      const res = await fetch(`${API}/api/voucher-auctions/active`);
      if (res.ok) {
        const data = await res.json();
        if (data.auctions && data.auctions.length > 0) {
          setAuctions(data.auctions.slice(0, 4)); // Show max 4
          setLoading(false);
          return;
        }
      }
      
      // Fallback: Get restaurant voucher auctions
      const restaurantRes = await fetch(`${API}/api/auctions?status=active`);
      if (restaurantRes.ok) {
        const data = await restaurantRes.json();
        const voucherAuctions = (data.auctions || []).filter(a => 
          a.auction_type === 'restaurant_voucher' ||
          a.auction_type === 'voucher' ||
          a.category === 'restaurant_voucher' ||
          a.is_voucher === true ||
          (a.product && a.product.category?.includes('voucher'))
        );
        setAuctions(voucherAuctions.slice(0, 4));
      }
    } catch (err) {
      console.error('Error fetching voucher auctions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVoucherAuctions();
    const interval = setInterval(fetchVoucherAuctions, 30000);
    return () => clearInterval(interval);
  }, [fetchVoucherAuctions]);

  const formatTimeLeft = (endTime) => {
    if (!endTime) return '--:--';
    const now = new Date();
    const end = new Date(endTime);
    const diff = Math.max(0, end - now) / 1000;

    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  // Demo vouchers if no real data
  const demoVouchers = [
    {
      id: 'demo-v1',
      product_name: '🍕 Restaurant €50 Gutschein',
      merchant: 'Bella Italia',
      voucher_value: 50,
      current_price: 2.45,
      total_bids: 127,
      end_time: new Date(Date.now() + 3600000).toISOString(),
      category: 'restaurant',
      image_url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=300'
    },
    {
      id: 'demo-v2',
      product_name: '🍸 Bar €30 Gutschein',
      merchant: 'Skyline Bar',
      voucher_value: 30,
      current_price: 1.80,
      total_bids: 89,
      end_time: new Date(Date.now() + 1800000).toISOString(),
      category: 'bar',
      image_url: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=300'
    },
    {
      id: 'demo-v3',
      product_name: '☕ Café €25 Gutschein',
      merchant: 'Coffee House',
      voucher_value: 25,
      current_price: 1.20,
      total_bids: 45,
      end_time: new Date(Date.now() + 7200000).toISOString(),
      category: 'cafe',
      image_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300'
    },
    {
      id: 'demo-v4',
      product_name: '💆 Wellness €100 Gutschein',
      merchant: 'Spa Paradise',
      voucher_value: 100,
      current_price: 4.85,
      total_bids: 156,
      end_time: new Date(Date.now() + 900000).toISOString(),
      category: 'wellness',
      image_url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=300'
    }
  ];

  const displayAuctions = auctions.length > 0 ? auctions : demoVouchers;

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl p-4">
        <div className="flex items-center justify-center py-8">
          <Ticket className="w-8 h-8 text-amber-500 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-4 border border-amber-200 dark:border-amber-800" data-testid="voucher-auctions-section">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl">
            <Ticket className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">{t.title}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t.subtitle}</p>
          </div>
        </div>
        <Link 
          to="/gutschein-auktionen"
          className="text-amber-600 hover:text-amber-700 text-sm font-medium flex items-center gap-1"
        >
          {t.viewAll}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Auctions Grid */}
      {displayAuctions.length === 0 ? (
        <div className="text-center py-8 bg-white/50 dark:bg-gray-800/50 rounded-xl">
          <Ticket className="w-12 h-12 text-amber-300 mx-auto mb-2" />
          <p className="text-gray-500">{t.noAuctions}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {displayAuctions.map((auction) => {
            const savings = auction.voucher_value 
              ? Math.round((1 - auction.current_price / auction.voucher_value) * 100)
              : 95;
            const timeLeft = formatTimeLeft(auction.end_time);
            const isEndingSoon = timeLeft.endsWith('s') || (timeLeft.endsWith('m') && parseInt(timeLeft) < 10);
            const categoryIcon = categoryIcons[auction.category] || categoryIcons.default;

            return (
              <div
                key={auction.id}
                onClick={() => navigate(`/auctions/${auction.id}`)}
                className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer group border border-amber-100 dark:border-amber-800"
                data-testid={`voucher-card-${auction.id}`}
              >
                {/* Image */}
                <div className="relative h-24 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30">
                  {auction.image_url ? (
                    <img
                      src={auction.image_url}
                      alt={auction.product_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gift className="w-10 h-10 text-amber-400" />
                    </div>
                  )}

                  {/* Category Badge */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur rounded-full text-white text-[10px] font-medium flex items-center gap-1">
                    {categoryIcon}
                    <span className="capitalize">{auction.category || 'Partner'}</span>
                  </div>

                  {/* Savings Badge */}
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-green-500 rounded-full text-white font-bold text-[10px]">
                    -{savings}%
                  </div>

                  {/* Time Badge */}
                  {isEndingSoon && (
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-red-500 rounded-full text-white text-[10px] font-medium flex items-center gap-1 animate-pulse">
                      <Clock className="w-3 h-3" />
                      {timeLeft}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-2">
                  <h3 className="text-xs font-bold text-gray-800 dark:text-white truncate mb-1">
                    {auction.product_name}
                  </h3>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 truncate mb-2">
                    {auction.merchant || t.partner}
                  </p>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-gray-400">{t.voucherValue}</p>
                      <p className="text-xs font-bold text-gray-600 dark:text-gray-300 line-through">€{auction.voucher_value}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">{t.currentPrice}</p>
                      <p className="text-sm font-bold text-amber-600">€{auction.current_price?.toFixed(2)}</p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="w-full mt-2 h-7 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs"
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    {t.bidNow}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VoucherAuctionsSection;
