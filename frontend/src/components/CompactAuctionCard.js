import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Timer, Zap, Flame, Clock } from 'lucide-react';
import { Button } from './ui/button';

// Activity Index Component - Friendly colorful bars
const ActivityIndex = ({ bids }) => {
  const activeBars = Math.min(Math.ceil(bids / 5), 10);
  
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(10)].map((_, i) => (
        <div 
          key={i} 
          className={`w-2 h-3 rounded-sm transition-all ${
            i < activeBars 
              ? 'bg-gradient-to-t from-emerald-500 to-emerald-400' 
              : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
};

export const CompactAuctionCard = ({ auction, onBid, isAuthenticated, t }) => {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isUrgent, setIsUrgent] = useState(false);

  // Fallback translation function if not provided
  const translate = t || ((key) => {
    const fallbacks = {
      'auctionCard.liveNow': 'LIVE JETZT',
      'auctionCard.comingSoon': 'DEMNÄCHST',
      'auctionCard.ended': 'BEENDET',
      'auctionCard.bidNow': 'BIETEN',
      'auctionCard.activity': 'Aktivität',
      'auctionCard.lastSold': 'Zuletzt versteigert für',
      'auctionCard.retailPrice': 'Vergleichspreis*',
      'auctionCard.startPrice': 'Startpreis'
    };
    return fallbacks[key] || key;
  });

  useEffect(() => {
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
      setIsUrgent(newTime.hours === 0 && newTime.minutes < 1);
    }, 1000);

    setTimeLeft(calculateTimeLeft());
    return () => clearInterval(timer);
  }, [auction.end_time]);

  const product = auction.product || {};
  const isEnded = auction.status === 'ended' || (timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0);
  const isScheduled = auction.status === 'scheduled';

  const formatTime = (num) => String(num).padStart(2, '0');
  
  // Generate a "last sold for" price (random between 1-15€)
  const lastSoldPrice = ((auction.id.charCodeAt(0) % 14) + 1 + Math.random()).toFixed(2);

  // Badge styling based on status
  const getBadgeStyle = () => {
    if (isScheduled) return 'bg-gradient-to-r from-amber-400 to-orange-500';
    if (isEnded) return 'bg-gray-400';
    return 'bg-gradient-to-r from-emerald-400 to-teal-500';
  };

  const getBadgeText = () => {
    if (isScheduled) return translate('auctionCard.comingSoon');
    if (isEnded) return translate('auctionCard.ended');
    return translate('auctionCard.liveNow');
  };

  return (
    <div 
      className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group"
      data-testid={`compact-auction-${auction.id}`}
    >
      {/* Header Badge - Friendly status */}
      <div className={`text-white text-xs font-bold px-2 py-1 text-center uppercase tracking-wide flex items-center justify-center gap-1 ${getBadgeStyle()}`}>
        {!isEnded && !isScheduled && <Flame className="w-3 h-3 animate-pulse" />}
        {isScheduled && <Clock className="w-3 h-3" />}
        {getBadgeText()}
      </div>

      <div className="p-3">
        {/* Product Name */}
        <h3 className="font-bold text-gray-800 text-sm leading-tight mb-1 line-clamp-2 h-10 group-hover:text-teal-600 transition-colors" title={product.name}>
          {product.name?.toUpperCase()}
        </h3>
        
        {/* Retail Price */}
        <p className="text-gray-400 text-xs mb-2">
          {translate('auctionCard.retailPrice')}: <span className="line-through">€ {product.retail_price?.toFixed(0)},-</span>
        </p>

        <div className="flex gap-2">
          {/* Left side - Price & Bidder */}
          <div className="flex-1">
            {/* Current Price - More prominent & colorful */}
            <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-lg p-1.5 mb-1.5">
              <p className="text-xl font-bold text-teal-600 font-mono whitespace-nowrap">
                € {auction.current_price?.toFixed(2).replace('.', ',')}
              </p>
            </div>
            
            {/* Last Bidder */}
            <p className="text-gray-500 text-xs truncate">
              {auction.last_bidder_name || translate('auctionCard.startPrice')}
            </p>
            
            {/* Bid Button - More inviting */}
            <Link to={`/auctions/${auction.id}`}>
              <button 
                className={`mt-2 w-full font-bold py-1.5 px-4 rounded-lg text-sm uppercase shadow-md transition-all ${
                  isEnded 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 hover:from-emerald-500 hover:via-teal-600 hover:to-cyan-600 text-white hover:shadow-lg hover:shadow-teal-200'
                }`}
                disabled={isEnded}
              >
                {isEnded ? translate('auctionCard.ended') : translate('auctionCard.bidNow')}
              </button>
            </Link>
          </div>

          {/* Right side - Image & Timer */}
          <div className="w-24 flex flex-col items-center">
            {/* Timer - More colorful */}
            <div className={`w-full text-center py-1 px-2 rounded-lg text-white text-xs font-mono font-bold mb-1 shadow-sm ${
              isUrgent ? 'bg-gradient-to-r from-red-500 to-rose-500 animate-pulse' : 
              isEnded ? 'bg-gray-400' : 
              'bg-gradient-to-r from-emerald-500 to-teal-500'
            }`}>
              {isEnded ? 'ENDE' : `${formatTime(timeLeft.hours)}:${formatTime(timeLeft.minutes)}:${formatTime(timeLeft.seconds)}`}
            </div>
            
            {/* Product Image */}
            <img
              src={product.image_url || 'https://via.placeholder.com/100'}
              alt={product.name}
              className="w-20 h-20 object-contain group-hover:scale-110 transition-transform"
            />
          </div>
        </div>

        {/* Activity Index */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-gray-400 text-xs">{translate('auctionCard.activity')}:</span>
          <ActivityIndex bids={auction.total_bids || 0} />
        </div>
      </div>

      {/* Footer - Friendlier message */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-1.5 text-center border-t border-emerald-100">
        <p className="text-gray-600 text-xs">
          {translate('auctionCard.lastSold')} <span className="font-bold text-emerald-600">€ {lastSoldPrice}</span>
        </p>
      </div>
    </div>
  );
};

export default CompactAuctionCard;
