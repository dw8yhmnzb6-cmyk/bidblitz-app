import React, { useState, useEffect, memo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Gift, Package, Sparkles, Lock, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const translations = {
  de: {
    title: "Mystery Box",
    subtitle: "Entdecke versteckte Schätze!",
    minValue: "Mindestwert",
    maxValue: "Maximalwert",
    whatInside: "Was ist drin?",
    reveal: "Öffnen",
    bidNow: "Jetzt bieten",
    bronze: "Bronze Box",
    silver: "Silber Box",
    gold: "Gold Box",
    diamond: "Diamant Box",
    currentBid: "Aktuelles Gebot",
    endsIn: "Endet in",
    noBoxes: "Aktuell keine Mystery Boxen",
    valueBetween: "Wert zwischen"
  },
  en: {
    title: "Mystery Box",
    subtitle: "Discover hidden treasures!",
    minValue: "Min value",
    maxValue: "Max value",
    whatInside: "What's inside?",
    reveal: "Open",
    bidNow: "Bid now",
    bronze: "Bronze Box",
    silver: "Silver Box",
    gold: "Gold Box",
    diamond: "Diamond Box",
    currentBid: "Current bid",
    endsIn: "Ends in",
    noBoxes: "No mystery boxes available",
    valueBetween: "Value between"
  },
  sq: {
    title: "Kutia Misterioze",
    subtitle: "Zbulo thesare të fshehura!",
    minValue: "Vlera min",
    maxValue: "Vlera max",
    whatInside: "Çfarë ka brenda?",
    reveal: "Hap",
    bidNow: "Ofro tani",
    bronze: "Kutia Bronze",
    silver: "Kutia Argjend",
    gold: "Kutia Ar",
    diamond: "Kutia Diamant",
    currentBid: "Oferta aktuale",
    endsIn: "Përfundon në",
    noBoxes: "Asnjë kuti misterioze",
    valueBetween: "Vlera midis"
  },
  xk: {
    title: "Kutia Misterioze",
    subtitle: "Zbulo thesare të fshehura!",
    minValue: "Vlera min",
    maxValue: "Vlera max",
    whatInside: "Çfarë ka brenda?",
    reveal: "Hap",
    bidNow: "Ofro tani",
    bronze: "Kutia Bronze",
    silver: "Kutia Argjend",
    gold: "Kutia Ar",
    diamond: "Kutia Diamant",
    currentBid: "Oferta aktuale",
    endsIn: "Përfundon në",
    noBoxes: "Asnjë kuti misterioze",
    valueBetween: "Vlera midis"
  },
  tr: {
    title: "Gizemli Kutu",
    subtitle: "Gizli hazineleri keşfet!",
    minValue: "Min değer",
    maxValue: "Max değer",
    whatInside: "İçinde ne var?",
    reveal: "Aç",
    bidNow: "Şimdi teklif ver",
    bronze: "Bronz Kutu",
    silver: "Gümüş Kutu",
    gold: "Altın Kutu",
    diamond: "Elmas Kutu",
    currentBid: "Mevcut teklif",
    endsIn: "Bitiş",
    noBoxes: "Gizemli kutu yok",
    valueBetween: "Değer aralığı"
  },
  fr: {
    title: "Boîte Mystère",
    subtitle: "Découvrez des trésors cachés!",
    minValue: "Valeur min",
    maxValue: "Valeur max",
    whatInside: "Qu'y a-t-il dedans?",
    reveal: "Ouvrir",
    bidNow: "Enchérir",
    bronze: "Boîte Bronze",
    silver: "Boîte Argent",
    gold: "Boîte Or",
    diamond: "Boîte Diamant",
    currentBid: "Enchère actuelle",
    endsIn: "Se termine dans",
    noBoxes: "Pas de boîte mystère",
    valueBetween: "Valeur entre"
  }
};

const tierColors = {
  bronze: 'from-amber-600 to-amber-700',
  silver: 'from-gray-400 to-gray-500',
  gold: 'from-amber-400 to-yellow-500',
  diamond: 'from-cyan-400 to-blue-500'
};

const tierIcons = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  diamond: '💎'
};

const MysteryBoxCard = memo(({ box, onBid, t }) => {
  const tier = box.tier || 'bronze';
  const colorClass = tierColors[tier] || tierColors.bronze;
  const icon = tierIcons[tier] || '📦';
  
  return (
    <div className={`relative bg-gradient-to-br ${colorClass} rounded-xl p-4 text-white overflow-hidden group`}>
      {/* Sparkle Effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {[...Array(5)].map((_, i) => (
          <Sparkles 
            key={i}
            className="absolute w-4 h-4 text-white/50 animate-pulse"
            style={{
              top: `${20 + Math.random() * 60}%`,
              left: `${20 + Math.random() * 60}%`,
              animationDelay: `${i * 0.2}s`
            }}
          />
        ))}
      </div>
      
      <div className="relative">
        {/* Header */}
        <div className="text-center mb-3">
          <span className="text-4xl">{icon}</span>
          <h3 className="text-lg font-bold mt-1">{t[tier] || box.name}</h3>
        </div>
        
        {/* Mystery Content */}
        <div className="bg-white/20 backdrop-blur rounded-lg p-3 mb-3 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <HelpCircle className="w-5 h-5" />
            <span className="font-semibold">{t.whatInside}</span>
          </div>
          <p className="text-sm opacity-90">
            {t.valueBetween} €{box.min_value} - €{box.max_value}
          </p>
        </div>
        
        {/* Current Bid */}
        {box.current_price !== undefined && (
          <div className="text-center mb-3">
            <p className="text-xs opacity-80">{t.currentBid}</p>
            <p className="text-2xl font-black">€{box.current_price?.toFixed(2)}</p>
          </div>
        )}
        
        {/* Bid Button */}
        <button
          onClick={() => onBid(box)}
          className="w-full py-3 bg-white text-gray-800 font-bold rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
          data-testid={`mystery-box-bid-${box.id}`}
        >
          <Gift className="w-5 h-5" />
          {t.bidNow}
        </button>
      </div>
    </div>
  );
});

const MysteryBoxSection = memo(() => {
  const { language } = useLanguage();
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const t = translations[language] || translations.de;
  
  useEffect(() => {
    const fetchBoxes = async () => {
      try {
        const res = await axios.get(`${API}/mystery-box/active`);
        // API returns {auctions: [], tiers: {...}}
        const auctions = res.data?.auctions || [];
        const tiers = res.data?.tiers || {};
        
        // If no active auctions, create preview from tiers
        if (auctions.length === 0 && Object.keys(tiers).length > 0) {
          const previewBoxes = Object.entries(tiers).map(([tier, data]) => ({
            id: `preview_${tier}`,
            tier,
            min_value: data.min_value,
            max_value: data.max_value,
            name: data.name
          }));
          setBoxes(previewBoxes);
        } else {
          setBoxes(auctions);
        }
      } catch (err) {
        console.error('Error fetching mystery boxes:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBoxes();
  }, []);
  
  const handleBid = (box) => {
    // If it's a preview box (no real auction), show info message
    if (box.id?.startsWith('preview_')) {
      // Import toast at top of file for this to work
      alert('Demnächst verfügbar! / Coming soon!');
      return;
    }
    window.location.href = `/auctions/${box.auction_id || box.id}`;
  };
  
  if (loading) {
    return null;
  }
  
  // Show preview boxes even if no active auctions
  const displayBoxes = boxes.length > 0 ? boxes : [
    { id: 'preview_bronze', tier: 'bronze', min_value: 50, max_value: 150 },
    { id: 'preview_silver', tier: 'silver', min_value: 150, max_value: 400 },
    { id: 'preview_gold', tier: 'gold', min_value: 400, max_value: 1000 }
  ];
  
  return (
    <div className="mb-4" data-testid="mystery-box-section">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">{t.title}</h2>
          <p className="text-xs text-gray-500">{t.subtitle}</p>
        </div>
      </div>
      
      {/* Boxes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {displayBoxes.slice(0, 3).map((box) => (
          <MysteryBoxCard key={box.id} box={box} onBid={handleBid} t={t} />
        ))}
      </div>
    </div>
  );
});

export default MysteryBoxSection;
