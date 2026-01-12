import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Zap, Trophy, Target, TrendingUp, ArrowRight, User, Mail } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Dashboard() {
  const { user, token } = useAuth();
  const [wonAuctions, setWonAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWonAuctions();
  }, [user]);

  const fetchWonAuctions = async () => {
    if (!user?.won_auctions?.length) {
      setLoading(false);
      return;
    }

    try {
      const auctions = await Promise.all(
        user.won_auctions.slice(0, 5).map(async (auctionId) => {
          try {
            const response = await axios.get(`${API}/auctions/${auctionId}`);
            return response.data;
          } catch {
            return null;
          }
        })
      );
      setWonAuctions(auctions.filter(Boolean));
    } catch (error) {
      console.error('Error fetching won auctions:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    {
      icon: <Zap className="w-6 h-6" />,
      label: 'Verfügbare Gebote',
      value: user?.bids_balance || 0,
      color: 'text-[#06B6D4]',
      bgColor: 'bg-[#06B6D4]/20'
    },
    {
      icon: <Trophy className="w-6 h-6" />,
      label: 'Gewonnene Auktionen',
      value: user?.won_auctions?.length || 0,
      color: 'text-[#10B981]',
      bgColor: 'bg-[#10B981]/20'
    },
    {
      icon: <Target className="w-6 h-6" />,
      label: 'Platzierte Gebote',
      value: user?.total_bids_placed || 0,
      color: 'text-[#7C3AED]',
      bgColor: 'bg-[#7C3AED]/20'
    }
  ];

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="dashboard-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Willkommen, {user?.name}!
          </h1>
          <p className="text-[#94A3B8]">Verwalten Sie Ihr Konto und sehen Sie Ihre Aktivitäten</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl ${stat.bgColor} flex items-center justify-center ${stat.color}`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-[#94A3B8] text-sm">{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.color} font-mono`}>{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <Link to="/buy-bids" className="block">
            <div className="glass-card rounded-xl p-6 hover:border-[#7C3AED]/50 transition-colors group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Gebote kaufen</h3>
                    <p className="text-[#94A3B8] text-sm">Mehr Gebote für mehr Chancen</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-[#94A3B8] group-hover:text-[#7C3AED] transition-colors" />
              </div>
            </div>
          </Link>
          
          <Link to="/auctions" className="block">
            <div className="glass-card rounded-xl p-6 hover:border-[#06B6D4]/50 transition-colors group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#06B6D4] to-[#10B981] flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Live Auktionen</h3>
                    <p className="text-[#94A3B8] text-sm">Jetzt bieten und gewinnen</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-[#94A3B8] group-hover:text-[#06B6D4] transition-colors" />
              </div>
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profile Info */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Profil</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-[#181824]">
                <User className="w-5 h-5 text-[#7C3AED]" />
                <div>
                  <p className="text-[#94A3B8] text-sm">Name</p>
                  <p className="text-white font-medium">{user?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-[#181824]">
                <Mail className="w-5 h-5 text-[#06B6D4]" />
                <div>
                  <p className="text-[#94A3B8] text-sm">E-Mail</p>
                  <p className="text-white font-medium">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Won Auctions */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Gewonnene Auktionen</h2>
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-[#181824] rounded-lg animate-pulse" />
                ))}
              </div>
            ) : wonAuctions.length > 0 ? (
              <div className="space-y-4">
                {wonAuctions.map((auction) => (
                  <div key={auction.id} className="flex items-center gap-4 p-3 rounded-lg bg-[#181824]">
                    <img
                      src={auction.product?.image_url}
                      alt={auction.product?.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{auction.product?.name}</p>
                      <p className="text-[#10B981] text-sm font-mono">€{auction.current_price?.toFixed(2)}</p>
                    </div>
                    <Trophy className="w-5 h-5 text-[#F59E0B] flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 text-[#475569] mx-auto mb-3" />
                <p className="text-[#94A3B8]">Noch keine gewonnenen Auktionen</p>
                <Link to="/auctions">
                  <Button variant="link" className="text-[#7C3AED] mt-2">
                    Jetzt bieten
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
