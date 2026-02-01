import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { 
  Plus, Bot, BarChart3, Users, DollarSign, Zap, 
  RefreshCw, Play, Pause, Gift, Megaphone, Settings,
  Loader2, CheckCircle, X
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminQuickActions({ onRefresh, stats }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState({});
  const [showCreateAuction, setShowCreateAuction] = useState(false);
  const [auctionCount, setAuctionCount] = useState(10);

  const executeAction = async (action, params = {}) => {
    setLoading(prev => ({ ...prev, [action]: true }));
    try {
      let response;
      switch (action) {
        case 'create_auctions':
          response = await axios.post(`${API}/voice-command/confirm-execute`, {
            action: 'create_auctions',
            parameters: { count: params.count || 10 }
          }, { headers: { Authorization: `Bearer ${token}` } });
          toast.success(`${params.count || 10} Auktionen erstellt!`);
          break;
          
        case 'start_bots':
          response = await axios.post(`${API}/voice-command/confirm-execute`, {
            action: 'start_bots',
            parameters: {}
          }, { headers: { Authorization: `Bearer ${token}` } });
          toast.success('Alle Bots gestartet!');
          break;
          
        case 'stop_bots':
          response = await axios.post(`${API}/voice-command/confirm-execute`, {
            action: 'stop_bots',
            parameters: {}
          }, { headers: { Authorization: `Bearer ${token}` } });
          toast.success('Alle Bots gestoppt!');
          break;
          
        case 'refresh_stats':
          if (onRefresh) await onRefresh();
          toast.success('Statistiken aktualisiert!');
          break;
          
        case 'set_aotd':
          response = await axios.post(`${API}/voice-command/confirm-execute`, {
            action: 'set_auction_of_day',
            parameters: {}
          }, { headers: { Authorization: `Bearer ${token}` } });
          toast.success('Auktion des Tages gesetzt!');
          break;
          
        default:
          break;
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Aktion fehlgeschlagen');
    } finally {
      setLoading(prev => ({ ...prev, [action]: false }));
    }
  };

  const quickActions = [
    {
      id: 'create_auctions',
      label: 'Auktionen',
      icon: Plus,
      color: 'from-green-500 to-emerald-600',
      onClick: () => setShowCreateAuction(true)
    },
    {
      id: 'start_bots',
      label: 'Bots Start',
      icon: Play,
      color: 'from-blue-500 to-cyan-600',
      onClick: () => executeAction('start_bots')
    },
    {
      id: 'stop_bots',
      label: 'Bots Stop',
      icon: Pause,
      color: 'from-red-500 to-pink-600',
      onClick: () => executeAction('stop_bots')
    },
    {
      id: 'set_aotd',
      label: 'AOTD',
      icon: Gift,
      color: 'from-yellow-500 to-orange-600',
      onClick: () => executeAction('set_aotd')
    },
    {
      id: 'refresh_stats',
      label: 'Refresh',
      icon: RefreshCw,
      color: 'from-purple-500 to-violet-600',
      onClick: () => executeAction('refresh_stats')
    }
  ];

  return (
    <>
      {/* Quick Actions Bar */}
      <div className="glass-card rounded-xl p-3 md:p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm md:text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            Schnell-Aktionen
          </h3>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Button
              key={action.id}
              onClick={action.onClick}
              disabled={loading[action.id]}
              className={`bg-gradient-to-r ${action.color} text-white text-xs md:text-sm px-3 py-2 h-auto`}
              size="sm"
            >
              {loading[action.id] ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <action.icon className="w-4 h-4 mr-1" />
              )}
              <span className="hidden sm:inline">{action.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Create Auctions Modal */}
      {showCreateAuction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Auktionen erstellen</h3>
              <button onClick={() => setShowCreateAuction(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-2">Anzahl</label>
                <div className="flex gap-2">
                  {[5, 10, 20, 50].map((num) => (
                    <button
                      key={num}
                      onClick={() => setAuctionCount(num)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        auctionCount === num 
                          ? 'bg-green-500 text-white' 
                          : 'bg-[#181824] text-gray-400 hover:bg-[#252532]'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
              
              <Button
                onClick={() => {
                  executeAction('create_auctions', { count: auctionCount });
                  setShowCreateAuction(false);
                }}
                disabled={loading.create_auctions}
                className="w-full bg-green-500 hover:bg-green-600"
              >
                {loading.create_auctions ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                {auctionCount} Auktionen erstellen
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
