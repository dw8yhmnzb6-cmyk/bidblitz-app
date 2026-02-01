import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Star, Timer, Zap, TrendingDown, Trophy, Gift, 
  ArrowRight, Sparkles, Clock
} from 'lucide-react';
import { Button } from './ui/button';
import { useLanguage } from '../context/LanguageContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AuctionOfTheDay = () => {
  const [auction, setAuction] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [loading, setLoading] = useState(true);
  const { t, language } = useLanguage();

  useEffect(() => {
    fetchAuctionOfTheDay();
  }, []);

  useEffect(() => {
    if (!auction) return;
    
    const timer = setInterval(() => {
      const now = new Date();
      const end = new Date(auction.end_time);
      const diff = end - now;
      
      if (diff <= 0) {
        setTimeLeft(t('auctions.ended') || 'Beendet');
        clearInterval(timer);
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [auction, t]);

  const fetchAuctionOfTheDay = async () => {
    try {
      // Try to get featured auction first, fallback to most active
      const response = await axios.get(`${API}/auctions?status=active`);
      const activeAuctions = response.data;
      
      if (activeAuctions.length === 0) {
        setAuction(null);
        setLoading(false);
        return;
      }
      
      // Select auction with highest value product as "Auktion des Tages"
      const sortedByValue = activeAuctions.sort((a, b) => 
        (b.product?.retail_price || 0) - (a.product?.retail_price || 0)
      );
      
      setAuction(sortedByValue[0]);
    } catch (error) {
      console.error('Error fetching auction of the day:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6 animate-pulse">
        <div className="h-48 bg-[#181824] rounded-xl mb-4"></div>
        <div className="h-6 bg-[#181824] rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-[#181824] rounded w-1/2"></div>
      </div>
    );
  }

  if (!auction) {
    return null;
  }

  const product = auction.product || {};
  const savings = product.retail_price 
    ? Math.round((1 - auction.current_price / product.retail_price) * 100) 
    : 0;

  return (
    <div 
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FFD700]/20 via-[#FF4D4D]/10 to-[#7C3AED]/20 border border-[#FFD700]/30"
      data-testid="auction-of-the-day"
    >
      {/* Sparkle Effects */}
      <div className="absolute top-4 right-4 animate-pulse">
        <Sparkles className="w-6 h-6 text-[#FFD700]" />
      </div>
      <div className="absolute bottom-4 left-4 animate-pulse delay-500">
        <Star className="w-5 h-5 text-[#FFD700]" />
      </div>
      
      {/* Badge */}
      <div className="absolute top-0 left-0 bg-gradient-to-r from-[#FFD700] to-[#FF4D4D] text-black font-bold text-sm px-4 py-2 rounded-br-xl flex items-center gap-2">
        <Trophy className="w-4 h-4" />
        AUKTION DES TAGES
      </div>

      <div className="p-6 pt-12">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Product Image */}
          <div className="relative w-full md:w-48 h-48 flex-shrink-0">
            <img
              src={product.image_url || 'https://via.placeholder.com/200'}
              alt={product.name}
              className="w-full h-full object-contain rounded-xl bg-white/5 p-2"
            />
            {savings > 0 && (
              <div className="absolute -top-2 -right-2 bg-[#10B981] text-white text-xs font-bold px-2 py-1 rounded-full">
                -{savings}%
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-[#94A3B8] text-sm mb-1">{product.category}</p>
              <h3 className="text-xl md:text-2xl font-bold text-white">
                {product.name}
              </h3>
            </div>

            {/* Price & Timer */}
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-[#94A3B8] text-xs">Aktueller Preis</p>
                <p className="text-3xl font-bold text-[#FFD700] font-mono">
                  €{auction.current_price?.toFixed(2)}
                </p>
              </div>
              
              <div className="h-12 w-px bg-white/10 hidden sm:block"></div>
              
              <div>
                <p className="text-[#94A3B8] text-xs">UVP</p>
                <p className="text-lg text-white/50 line-through font-mono">
                  €{product.retail_price?.toFixed(2)}
                </p>
              </div>

              <div className="h-12 w-px bg-white/10 hidden sm:block"></div>

              <div>
                <p className="text-[#94A3B8] text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Verbleibend
                </p>
                <p className={`text-lg font-bold font-mono ${
                  timeLeft === 'Beendet' ? 'text-[#FF4D4D]' : 'text-[#10B981]'
                }`}>
                  {timeLeft || '--:--:--'}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-[#94A3B8]">
              <span className="flex items-center gap-1">
                <Zap className="w-4 h-4 text-[#FFD700]" />
                {auction.total_bids || 0} Gebote
              </span>
              {auction.last_bidder_name && (
                <span>
                  Letzter Bieter: <span className="text-white">{auction.last_bidder_name}</span>
                </span>
              )}
            </div>

            {/* CTA */}
            <Link to={`/auctions/${auction.id}`}>
              <Button className="w-full sm:w-auto bg-gradient-to-r from-[#FFD700] to-[#FF4D4D] text-black font-bold hover:scale-105 transition-transform">
                <Zap className="w-5 h-5 mr-2" />
                Jetzt mitbieten
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuctionOfTheDay;
