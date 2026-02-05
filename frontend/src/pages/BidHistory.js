import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, Zap, Calendar, Package, TrendingUp, 
  Clock, CheckCircle, XCircle, Loader2 
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BidHistory() {
  const { token } = useAuth();
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, won, lost

  useEffect(() => {
    fetchBidHistory();
  }, []);

  const fetchBidHistory = async () => {
    try {
      const response = await axios.get(`${API}/user/bid-history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBids(response.data);
    } catch (error) {
      console.error('Error fetching bid history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBids = bids.filter(bid => {
    if (filter === 'won') return bid.won;
    if (filter === 'lost') return !bid.won && bid.auction_ended;
    return true;
  });

  // Stats
  const totalBids = bids.length;
  const wonBids = bids.filter(b => b.won).length;
  const totalSpent = bids.length; // Each bid costs 1

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="bid-history-page">
      <div className="max-w-6xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Zurück zum Dashboard
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Gebots-Historie</h1>
            <p className="text-gray-500">Übersicht aller Ihrer abgegebenen Gebote</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#FFD700]/20 flex items-center justify-center">
                <Zap className="w-6 h-6 text-[#FFD700]" />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Gebote gesamt</p>
                <p className="text-2xl font-bold text-gray-800">{totalBids}</p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#10B981]/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#10B981]" />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Gewonnen</p>
                <p className="text-2xl font-bold text-gray-800">{wonBids}</p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[#7C3AED]" />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Erfolgsquote</p>
                <p className="text-2xl font-bold text-gray-800">
                  {totalBids > 0 ? ((wonBids / totalBids) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'all', label: 'Alle' },
            { id: 'won', label: 'Gewonnen' },
            { id: 'lost', label: 'Verloren' }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === f.id
                  ? 'bg-[#FFD700] text-black'
                  : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Bid List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFD700]" />
          </div>
        ) : filteredBids.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Zap className="w-16 h-16 text-gray-500 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Keine Gebote gefunden</h3>
            <p className="text-gray-500 mb-6">
              {filter === 'all' 
                ? 'Sie haben noch keine Gebote abgegeben.' 
                : filter === 'won'
                ? 'Sie haben noch keine Auktionen gewonnen.'
                : 'Sie haben noch keine Auktionen verloren.'}
            </p>
            <Link to="/auctions" className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-lg">
              <Zap className="w-5 h-5" />
              Jetzt bieten
            </Link>
          </div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-4 text-left text-gray-500 font-medium">Produkt</th>
                    <th className="px-6 py-4 text-left text-gray-500 font-medium">Gebotspreis</th>
                    <th className="px-6 py-4 text-left text-gray-500 font-medium">Zeitpunkt</th>
                    <th className="px-6 py-4 text-left text-gray-500 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredBids.map((bid, index) => (
                    <tr key={index} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={bid.product?.image_url || 'https://via.placeholder.com/50'} 
                            alt="" 
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                          <div>
                            <p className="text-gray-800 font-medium">{bid.product?.name || 'Produkt'}</p>
                            <p className="text-gray-500 text-sm">Auktion #{bid.auction_id?.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[#06B6D4] font-mono font-bold">
                          €{bid.price?.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-500">
                          <Clock className="w-4 h-4" />
                          {new Date(bid.timestamp).toLocaleString('de-DE', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {bid.won ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#10B981]/20 text-[#10B981] text-sm font-medium">
                            <CheckCircle className="w-4 h-4" />
                            Gewonnen
                          </span>
                        ) : bid.auction_ended ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#EF4444]/20 text-[#EF4444] text-sm font-medium">
                            <XCircle className="w-4 h-4" />
                            Verloren
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#F59E0B]/20 text-[#F59E0B] text-sm font-medium">
                            <Clock className="w-4 h-4" />
                            Aktiv
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
