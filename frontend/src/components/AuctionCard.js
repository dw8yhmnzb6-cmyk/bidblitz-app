import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Timer, Users, Zap } from 'lucide-react';
import { Button } from './ui/button';

export const AuctionCard = ({ auction, onBid, isAuthenticated }) => {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isUrgent, setIsUrgent] = useState(false);

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
      setIsUrgent(newTime.hours === 0 && newTime.minutes === 0 && newTime.seconds <= 10);
    }, 1000);

    setTimeLeft(calculateTimeLeft());

    return () => clearInterval(timer);
  }, [auction.end_time]);

  const product = auction.product || {};
  const isEnded = auction.status === 'ended' || (timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0);

  const formatTime = (num) => String(num).padStart(2, '0');

  return (
    <div 
      className={`auction-card group relative ${isUrgent && !isEnded ? 'glow-urgency' : ''}`}
      data-testid={`auction-card-${auction.id}`}
    >
      {/* Product Image */}
      <div className="relative aspect-square overflow-hidden bg-[#181824]">
        <img
          src={product.image_url || 'https://via.placeholder.com/400'}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F16] via-transparent to-transparent" />
        
        {/* Status badge */}
        {isEnded ? (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-[#EF4444]/90 text-white text-xs font-bold uppercase">
            Beendet
          </div>
        ) : (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-[#10B981]/90 text-white text-xs font-bold uppercase">
            Live
          </div>
        )}

        {/* Retail price */}
        <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[#94A3B8] text-xs">
          UVP: €{product.retail_price?.toFixed(2)}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Title */}
        <h3 className="font-bold text-lg text-white truncate" title={product.name}>
          {product.name}
        </h3>

        {/* Timer */}
        <div className={`flex items-center justify-center gap-2 py-3 rounded-lg bg-[#181824] ${isUrgent && !isEnded ? 'timer-urgent' : ''}`}>
          <Timer className="w-5 h-5" />
          {isEnded ? (
            <span className="font-mono text-xl font-bold text-[#EF4444]">BEENDET</span>
          ) : (
            <span className="font-mono text-xl font-bold tracking-wider">
              {formatTime(timeLeft.hours)}:{formatTime(timeLeft.minutes)}:{formatTime(timeLeft.seconds)}
            </span>
          )}
        </div>

        {/* Current Price */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#94A3B8] text-xs uppercase tracking-wider">Aktueller Preis</p>
            <p className="text-2xl font-bold text-[#06B6D4] font-mono">
              €{auction.current_price?.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[#94A3B8] text-xs uppercase tracking-wider">Gebote</p>
            <p className="text-lg font-bold text-white flex items-center gap-1">
              <Users className="w-4 h-4" />
              {auction.total_bids}
            </p>
          </div>
        </div>

        {/* Last bidder */}
        {auction.last_bidder_name && (
          <p className="text-sm text-[#94A3B8] text-center">
            Letzter Bieter: <span className="text-[#A78BFA] font-medium">{auction.last_bidder_name}</span>
          </p>
        )}

        {/* Winner info */}
        {isEnded && auction.winner_name && (
          <div className="text-center py-2 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30">
            <p className="text-[#10B981] font-bold">
              Gewinner: {auction.winner_name}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Link to={`/auctions/${auction.id}`} className="flex-1">
            <Button 
              variant="outline" 
              className="w-full border-white/10 text-white hover:bg-white/10"
              data-testid={`view-auction-${auction.id}`}
            >
              Details
            </Button>
          </Link>
          {!isEnded && (
            <Button 
              onClick={() => onBid && onBid(auction.id)}
              disabled={!isAuthenticated}
              className="flex-1 btn-bid py-2"
              data-testid={`bid-btn-${auction.id}`}
            >
              <Zap className="w-4 h-4 mr-1" />
              Bieten
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
