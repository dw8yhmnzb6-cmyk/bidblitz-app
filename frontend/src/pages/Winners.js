import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Trophy, Star, TrendingDown, Clock, Users, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const WinnerCard = ({ winner }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div 
      className="bg-gradient-to-br from-[#181824] to-[#0F0F16] rounded-xl overflow-hidden border border-white/10 hover:border-[#FFD700]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#FFD700]/5 group"
      data-testid={`winner-card-${winner.auction_id}`}
    >
      {/* Image Section */}
      <div className="relative aspect-square overflow-hidden bg-[#0F0F16]">
        <img
          src={winner.product_image || 'https://via.placeholder.com/300'}
          alt={winner.product_name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        
        {/* Savings Badge */}
        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-[#10B981] text-white font-bold text-sm shadow-lg">
          -{winner.savings_percent}%
        </div>
        
        {/* Winner Badge */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#FFD700] flex items-center justify-center">
              <Trophy className="w-4 h-4 text-black" />
            </div>
            <span className="text-white font-bold truncate">{winner.winner_name}</span>
          </div>
        </div>
      </div>
      
      {/* Content Section */}
      <div className="p-4 space-y-3">
        <h3 className="text-white font-bold text-sm line-clamp-2 min-h-[40px]">
          {winner.product_name}
        </h3>
        
        {/* Price Comparison */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[#94A3B8] text-xs">Gewonnen für</p>
            <p className="text-2xl font-bold text-[#06B6D4]">
              €{winner.final_price?.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[#94A3B8] text-xs">Statt</p>
            <p className="text-lg text-[#94A3B8] line-through">
              €{winner.retail_price?.toFixed(2)}
            </p>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-[#94A3B8] pt-2 border-t border-white/10">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{winner.total_bids} Gebote</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatDate(winner.ended_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Winners() {
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWinners();
  }, []);

  const fetchWinners = async () => {
    try {
      const response = await axios.get(`${API}/winners?limit=30`);
      setWinners(response.data);
    } catch (error) {
      console.error('Error fetching winners:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const totalSavings = winners.reduce((sum, w) => sum + (w.retail_price - w.final_price), 0);
  const avgSavings = winners.length > 0 
    ? Math.round(winners.reduce((sum, w) => sum + w.savings_percent, 0) / winners.length)
    : 0;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="winners-page">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 mb-6">
            <Sparkles className="w-4 h-4 text-[#FFD700]" />
            <span className="text-[#FFD700] text-sm font-medium">Echte Gewinner, echte Ersparnisse</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Unsere <span className="text-gradient">Gewinner</span>
          </h1>
          
          <p className="text-[#94A3B8] text-lg max-w-2xl mx-auto mb-8">
            Diese Nutzer haben bei BidBlitz fantastische Schnäppchen gemacht. 
            Der nächste Gewinner könnten Sie sein!
          </p>
          
          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-6 mb-8">
            <div className="glass-card px-6 py-4 rounded-xl">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-[#FFD700]" />
                <div className="text-left">
                  <p className="text-2xl font-bold text-white">{winners.length}+</p>
                  <p className="text-[#94A3B8] text-sm">Glückliche Gewinner</p>
                </div>
              </div>
            </div>
            
            <div className="glass-card px-6 py-4 rounded-xl">
              <div className="flex items-center gap-3">
                <TrendingDown className="w-8 h-8 text-[#10B981]" />
                <div className="text-left">
                  <p className="text-2xl font-bold text-white">€{totalSavings.toFixed(0)}</p>
                  <p className="text-[#94A3B8] text-sm">Gesamt gespart</p>
                </div>
              </div>
            </div>
            
            <div className="glass-card px-6 py-4 rounded-xl">
              <div className="flex items-center gap-3">
                <Star className="w-8 h-8 text-[#F59E0B]" />
                <div className="text-left">
                  <p className="text-2xl font-bold text-white">{avgSavings}%</p>
                  <p className="text-[#94A3B8] text-sm">Durchschnittliche Ersparnis</p>
                </div>
              </div>
            </div>
          </div>
          
          <Link to="/auctions">
            <Button className="btn-primary">
              Jetzt bieten
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
        
        {/* Winners Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-[#181824] rounded-xl h-96 animate-pulse" />
            ))}
          </div>
        ) : winners.length === 0 ? (
          <div className="text-center py-16 glass-card rounded-2xl">
            <Trophy className="w-16 h-16 text-[#94A3B8] mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-white mb-2">Noch keine Gewinner</h3>
            <p className="text-[#94A3B8] mb-6">
              Seien Sie der Erste, der eine Auktion gewinnt!
            </p>
            <Link to="/auctions">
              <Button className="btn-primary">Auktionen ansehen</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {winners.map((winner) => (
              <WinnerCard key={winner.auction_id} winner={winner} />
            ))}
          </div>
        )}
        
        {/* CTA Section */}
        {winners.length > 0 && (
          <div className="mt-16 text-center">
            <div className="glass-card p-8 rounded-2xl max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-4">
                Werden Sie der nächste Gewinner!
              </h2>
              <p className="text-[#94A3B8] mb-6">
                Registrieren Sie sich jetzt und erhalten Sie 10 kostenlose Gebote zum Start.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link to="/register">
                  <Button className="btn-primary">Kostenlos registrieren</Button>
                </Link>
                <Link to="/auctions">
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                    Auktionen ansehen
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
