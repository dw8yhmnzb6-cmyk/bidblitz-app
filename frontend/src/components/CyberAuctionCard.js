import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Zap, Users, TrendingUp } from 'lucide-react';

/**
 * Cyber Auction Card - New Design
 * Glassmorphism + Neon Borders + Acid Green Accents
 */

// Live Timer with Cyber styling
const CyberTimer = memo(({ endTime, isUrgent }) => {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });
  
  useEffect(() => {
    if (!endTime) return;
    
    const calc = () => {
      const now = Date.now();
      const end = new Date(endTime).getTime();
      const diff = Math.max(0, end - now);
      
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000)
      });
    };
    
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [endTime]);
  
  const pad = (n) => String(n).padStart(2, '0');
  const urgent = time.d === 0 && time.h === 0 && time.m < 1;
  
  return (
    <div className={`font-mono text-sm font-bold tracking-wider ${
      urgent ? 'text-[#FF3B30] animate-pulse' : 
      time.h > 0 || time.d > 0 ? 'text-acid' : 'text-cyber'
    }`}>
      {time.d > 0 && <span>{time.d}T </span>}
      <span>{pad(time.h)}:{pad(time.m)}:{pad(time.s)}</span>
    </div>
  );
});

const CyberAuctionCard = ({ 
  auction, 
  product, 
  onBid, 
  featured = false,
  showAIScore = false,
  aiScore = null
}) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  
  const currentPrice = auction?.current_price || 0;
  const retailPrice = product?.retail_price || auction?.retail_price || 100;
  const discount = Math.round((1 - currentPrice / retailPrice) * 100);
  const totalBids = auction?.total_bids || 0;
  
  const handleClick = () => {
    navigate(`/auctions/${auction.id}`);
  };
  
  const handleBid = (e) => {
    e.stopPropagation();
    onBid?.(auction.id);
  };
  
  return (
    <div 
      className={`group relative overflow-hidden transition-all duration-300 cursor-pointer
        ${featured ? 'col-span-2 row-span-2' : ''}
        ${isHovered ? 'scale-[1.02] z-10' : 'scale-100'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      data-testid={`cyber-auction-${auction?.id}`}
    >
      {/* Animated Border Gradient */}
      <div className={`absolute inset-0 rounded-xl bg-gradient-to-r from-acid via-cyber to-hot-pink opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm`} />
      
      {/* Card Content */}
      <div className="relative m-[2px] rounded-xl backdrop-blur-xl bg-obsidian-paper/90 border border-white/10 overflow-hidden">
        
        {/* Top Badge Bar */}
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-obsidian-subtle to-transparent">
          {/* Discount Badge */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded bg-acid/20 text-acid text-xs font-black tracking-wider">
              -{discount}%
            </span>
            {showAIScore && aiScore && (
              <span className="px-2 py-1 rounded bg-cyber/20 text-cyber text-xs font-bold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {aiScore}%
              </span>
            )}
          </div>
          
          {/* Timer */}
          <div className="flex items-center gap-2 bg-obsidian/80 rounded-full px-3 py-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <CyberTimer endTime={auction?.end_time} />
          </div>
        </div>
        
        {/* Product Image */}
        <div className={`relative ${featured ? 'h-64' : 'h-40'} bg-gradient-to-b from-white/5 to-transparent flex items-center justify-center p-4`}>
          {product?.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name || ''} 
              className="max-h-full max-w-full object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-acid/20 to-cyber/20 flex items-center justify-center">
              <Zap className="w-10 h-10 text-acid" />
            </div>
          )}
          
          {/* Glow Effect on Hover */}
          <div className="absolute inset-0 bg-gradient-radial from-acid/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
        
        {/* Product Info */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <h3 className={`font-heading font-bold text-white leading-tight line-clamp-2 ${featured ? 'text-xl' : 'text-sm'}`}>
            {product?.name || 'Premium Produkt'}
          </h3>
          
          {/* Price Section */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-gray-500 text-xs line-through">
                UVP €{retailPrice?.toLocaleString('de-DE')}
              </p>
              <p className="text-2xl font-heading font-black text-acid">
                €{currentPrice.toFixed(2).replace('.', ',')}
              </p>
            </div>
            
            {/* Bids Count */}
            <div className="flex items-center gap-1 text-gray-400 text-xs">
              <Users className="w-3 h-3" />
              <span>{totalBids}</span>
            </div>
          </div>
          
          {/* Bid Button */}
          <button 
            onClick={handleBid}
            className="w-full py-3 rounded-md bg-acid text-black font-heading font-black text-sm uppercase tracking-widest
              hover:bg-white hover:shadow-neon-acid transition-all duration-300
              transform hover:-translate-y-0.5 active:translate-y-0"
            data-testid={`bid-btn-${auction?.id}`}
          >
            <span className="flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" />
              JETZT BIETEN
            </span>
          </button>
        </div>
        
        {/* Bottom Glow Line */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-acid to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
    </div>
  );
};

export default CyberAuctionCard;
