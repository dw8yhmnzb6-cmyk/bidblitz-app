import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { AuctionCard } from '../components/AuctionCard';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Zap, Filter, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Auctions() {
  const { isAuthenticated, token, updateBidsBalance } = useAuth();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 5000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchAuctions = async () => {
    try {
      const statusParam = filter !== 'all' ? `?status=${filter}` : '';
      const response = await axios.get(`${API}/auctions${statusParam}`);
      setAuctions(response.data);
    } catch (error) {
      console.error('Error fetching auctions:', error);
      toast.error('Fehler beim Laden der Auktionen');
    } finally {
      setLoading(false);
    }
  };

  const handleBid = async (auctionId) => {
    if (!isAuthenticated) {
      toast.error('Bitte melden Sie sich an, um zu bieten');
      return;
    }

    try {
      const response = await axios.post(
        `${API}/auctions/${auctionId}/bid`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Gebot erfolgreich platziert!');
      updateBidsBalance(response.data.bids_remaining);
      fetchAuctions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Bieten');
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="auctions-page">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              Alle Auktionen
            </h1>
            <p className="text-[#94A3B8]">
              {auctions.length} Auktion{auctions.length !== 1 ? 'en' : ''} verfügbar
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#94A3B8]" />
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[150px] bg-[#181824] border-white/10 text-white" data-testid="filter-select">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent className="bg-[#181824] border-white/10">
                  <SelectItem value="all" className="text-white hover:bg-white/10">Alle</SelectItem>
                  <SelectItem value="active" className="text-white hover:bg-white/10">Aktiv</SelectItem>
                  <SelectItem value="ended" className="text-white hover:bg-white/10">Beendet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              variant="outline" 
              size="icon"
              onClick={fetchAuctions}
              className="border-white/10 text-white hover:bg-white/10"
              data-testid="refresh-btn"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Auctions Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="auction-card animate-pulse">
                <div className="aspect-square bg-[#181824]" />
                <div className="p-4 space-y-4">
                  <div className="h-6 bg-[#181824] rounded" />
                  <div className="h-12 bg-[#181824] rounded" />
                  <div className="h-8 bg-[#181824] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : auctions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {auctions.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                onBid={handleBid}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 glass-card rounded-2xl">
            <Zap className="w-16 h-16 text-[#475569] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Keine Auktionen gefunden</h3>
            <p className="text-[#94A3B8]">
              {filter !== 'all' ? 'Versuchen Sie einen anderen Filter' : 'Schauen Sie bald wieder vorbei!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
