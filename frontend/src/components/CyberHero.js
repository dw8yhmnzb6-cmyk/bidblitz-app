import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Clock, TrendingUp, ChevronRight } from 'lucide-react';

/**
 * Cyber Hero Section - New Homepage Design
 * Features: Animated background, Auction of the Day, Stats
 */

// Language mapping for regional variants
const langMapping = {
  'us': 'en',  // US English -> English  
  'ae': 'ar', // UAE -> Arabic
  'xk': 'sq', // Kosovo -> Albanian
};
const getMappedLang = (lang) => langMapping[lang] || lang;

const CyberHero = ({ auctionOfDay, stats, onBid, language = 'de' }) => {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  const langKey = getMappedLang(language);
  
  // Translations
  const translations = {
    de: {
      headline: 'BIETE. GEWINNE. SPARE.',
      subheadline: 'Premium-Produkte ab €0,01',
      auctionOfDay: 'AUKTION DES TAGES',
      currentPrice: 'Aktueller Preis',
      retailPrice: 'UVP',
      bidNow: 'JETZT BIETEN',
      viewAll: 'Alle Auktionen',
      activeAuctions: 'Aktive Auktionen',
      totalSaved: 'Gesamt gespart',
      happyWinners: 'Glückliche Gewinner'
    },
    en: {
      headline: 'BID. WIN. SAVE.',
      subheadline: 'Premium products from €0.01',
      auctionOfDay: 'AUCTION OF THE DAY',
      currentPrice: 'Current Price',
      retailPrice: 'RRP',
      bidNow: 'BID NOW',
      viewAll: 'View All',
      activeAuctions: 'Active Auctions',
      totalSaved: 'Total Saved',
      happyWinners: 'Happy Winners'
    },
    sq: {
      headline: 'OFERONI. FITONI. KURSENI.',
      subheadline: 'Produkte premium nga €0,01',
      auctionOfDay: 'ANKANDI I DITËS',
      currentPrice: 'Çmimi Aktual',
      retailPrice: 'MSRP',
      bidNow: 'OFERONI TANI',
      viewAll: 'Shiko të Gjitha',
      activeAuctions: 'Ankande Aktive',
      totalSaved: 'Kursyer Gjithsej',
      happyWinners: 'Fitues të Lumtur'
    },
    tr: {
      headline: 'TEKLİF VER. KAZAN. TASARRUF ET.',
      subheadline: 'Premium ürünler €0,01\'den başlayan fiyatlarla',
      auctionOfDay: 'GÜNÜN AÇIK ARTIRMASI',
      currentPrice: 'Güncel Fiyat',
      retailPrice: 'PİYASA',
      bidNow: 'ŞİMDİ TEKLİF VER',
      viewAll: 'Tümünü Gör',
      activeAuctions: 'Aktif Açık Artırmalar',
      totalSaved: 'Toplam Tasarruf',
      happyWinners: 'Mutlu Kazananlar'
    },
    fr: {
      headline: 'ENCHÉRISSEZ. GAGNEZ. ÉCONOMISEZ.',
      subheadline: 'Produits premium à partir de 0,01 €',
      auctionOfDay: 'ENCHÈRE DU JOUR',
      currentPrice: 'Prix Actuel',
      retailPrice: 'PVC',
      bidNow: 'ENCHÉRIR',
      viewAll: 'Voir Tout',
      activeAuctions: 'Enchères Actives',
      totalSaved: 'Total Économisé',
      happyWinners: 'Gagnants Heureux'
    },
    xk: {
      headline: 'OFERONI. FITONI. KURSENI.',
      subheadline: 'Produkte premium nga €0,01',
      auctionOfDay: 'ANKANDI I DITËS',
      currentPrice: 'Çmimi Aktual',
      retailPrice: 'MSRP',
      bidNow: 'OFERONI TANI',
      viewAll: 'Shiko të Gjitha',
      activeAuctions: 'Ankande Aktive',
      totalSaved: 'Kursyer Gjithsej',
      happyWinners: 'Fitues të Lumtur'
    }
  };
  const t = translations[langKey] || translations.de;
  
  // Timer for auction of day
  useEffect(() => {
    if (!auctionOfDay?.end_time) return;
    
    const calc = () => {
      const now = Date.now();
      const end = new Date(auctionOfDay.end_time).getTime();
      const diff = Math.max(0, end - now);
      
      setTimeLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000)
      });
    };
    
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [auctionOfDay?.end_time]);
  
  const pad = (n) => String(n).padStart(2, '0');
  const product = auctionOfDay?.product || {};
  const currentPrice = auctionOfDay?.current_price || 0;
  const retailPrice = product.retail_price || 999;
  const discount = Math.round((1 - currentPrice / retailPrice) * 100);
  
  return (
    <section className="relative min-h-[80vh] bg-obsidian overflow-hidden" data-testid="cyber-hero">
      {/* Animated Background */}
      <div className="absolute inset-0">
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(212,255,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(212,255,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        
        {/* Glow Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-acid/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyber/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-hot-pink/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
      
      <div className="relative z-10 container mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          {/* Left: Headline & Stats */}
          <div className="space-y-8">
            {/* Main Headline */}
            <div className="space-y-4">
              <h1 className="font-heading font-black text-6xl md:text-7xl lg:text-8xl text-white leading-none tracking-tight">
                <span className="block">{t.headline.split('.')[0]}.</span>
                <span className="block text-acid">{t.headline.split('.')[1]}.</span>
                <span className="block text-cyber">{t.headline.split('.')[2]}</span>
              </h1>
              <p className="text-xl text-gray-400 font-body">
                {t.subheadline}
              </p>
            </div>
            
            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => navigate('/auctions')}
                className="px-8 py-4 bg-acid text-black font-heading font-black text-lg uppercase tracking-wider rounded-md
                  hover:bg-white hover:shadow-neon-acid transition-all duration-300
                  transform hover:-translate-y-1"
                data-testid="hero-cta-auctions"
              >
                <span className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  {t.viewAll}
                </span>
              </button>
              <button 
                onClick={() => navigate('/ai-bids')}
                className="px-8 py-4 border-2 border-cyber text-cyber font-heading font-bold text-lg uppercase tracking-wider rounded-md
                  hover:bg-cyber hover:text-black transition-all duration-300"
                data-testid="hero-cta-ai"
              >
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  KI-Empfehlungen
                </span>
              </button>
            </div>
            
            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/10">
              <div>
                <p className="text-3xl font-heading font-black text-acid">{stats?.activeAuctions || 50}</p>
                <p className="text-sm text-gray-500">{t.activeAuctions}</p>
              </div>
              <div>
                <p className="text-3xl font-heading font-black text-cyber">€{(stats?.totalSaved || 125000).toLocaleString()}</p>
                <p className="text-sm text-gray-500">{t.totalSaved}</p>
              </div>
              <div>
                <p className="text-3xl font-heading font-black text-hot-pink">{stats?.happyWinners || '5.2K'}</p>
                <p className="text-sm text-gray-500">{t.happyWinners}</p>
              </div>
            </div>
          </div>
          
          {/* Right: Auction of the Day Card */}
          <div className="relative">
            {/* Glowing Border Animation */}
            <div className="absolute -inset-1 bg-gradient-to-r from-acid via-cyber to-hot-pink rounded-2xl blur opacity-30 animate-border-flow" 
                 style={{ backgroundSize: '200% 200%' }} />
            
            {/* Card */}
            <div className="relative backdrop-blur-xl bg-obsidian-paper/90 rounded-2xl border border-white/10 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-acid/10 to-transparent border-b border-white/10">
                <span className="px-3 py-1 bg-acid text-black text-xs font-black uppercase tracking-widest rounded">
                  {t.auctionOfDay}
                </span>
                <span className="px-3 py-1 bg-obsidian rounded-full text-acid text-sm font-mono font-bold">
                  -{discount}%
                </span>
              </div>
              
              {/* Product Image */}
              <div className="relative h-72 bg-gradient-to-b from-white/5 to-transparent flex items-center justify-center p-8">
                {product.image_url ? (
                  <img 
                    src={product.image_url} 
                    alt={product.name || ''} 
                    className="max-h-full max-w-full object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-acid/20 to-cyber/20 flex items-center justify-center">
                    <Zap className="w-16 h-16 text-acid" />
                  </div>
                )}
                
                {/* Timer Overlay */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-obsidian/90 backdrop-blur-sm rounded-full px-4 py-2 border border-white/10">
                  <Clock className="w-4 h-4 text-acid" />
                  <span className="font-mono font-bold text-white text-lg">
                    {pad(timeLeft.h)}:{pad(timeLeft.m)}:{pad(timeLeft.s)}
                  </span>
                </div>
              </div>
              
              {/* Product Info */}
              <div className="p-6 space-y-4">
                <h3 className="font-heading font-bold text-2xl text-white leading-tight">
                  {product.name || 'Premium Produkt'}
                </h3>
                
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">{t.currentPrice}</p>
                    <p className="text-4xl font-heading font-black text-acid">
                      €{currentPrice.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500 text-sm">{t.retailPrice}</p>
                    <p className="text-xl font-heading text-gray-400 line-through">
                      €{retailPrice.toLocaleString('de-DE')}
                    </p>
                  </div>
                </div>
                
                {/* Bid Button */}
                <button 
                  onClick={() => onBid?.(auctionOfDay?.id)}
                  className="w-full py-4 bg-gradient-to-r from-acid to-cyber text-black font-heading font-black text-lg uppercase tracking-widest rounded-md
                    hover:from-white hover:to-white hover:shadow-neon-acid transition-all duration-300
                    transform hover:-translate-y-1"
                  data-testid="hero-bid-btn"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Zap className="w-5 h-5" />
                    {t.bidNow}
                    <ChevronRight className="w-5 h-5" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-obsidian to-transparent" />
    </section>
  );
};

export default CyberHero;
