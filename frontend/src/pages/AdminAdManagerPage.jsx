/**
 * Admin Advertising Manager
 * Alle Werbekampagnen verwalten & Statistiken
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Eye, MousePointer, Euro, BarChart3, ArrowLeft } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminAdManagerPage({ onNavigate }) {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [campaignsRes, statsRes] = await Promise.all([
        fetch(`${API}/api/ads/admin/campaigns`, { credentials: 'include' }),
        fetch(`${API}/api/ads/admin/stats`, { credentials: 'include' })
      ]);
      
      if (campaignsRes.ok) {
        const data = await campaignsRes.json();
        setCampaigns(data.campaigns || []);
      }
      
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate('/admin')} className="p-2 hover:bg-white/5 rounded-xl">
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Werbeplattform Administration</h1>
              <p className="text-xs text-gray-400">{campaigns.length} Kampagnen</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <StatCard icon={TrendingUp} label="Gesamt Kampagnen" value={stats.total_campaigns} color="cyan" />
                <StatCard icon={Euro} label="Gesamt Umsatz" value={`€${stats.total_revenue?.toFixed(2)}`} color="green" />
                <StatCard icon={Eye} label="Gesamt Impressions" value={stats.total_impressions?.toLocaleString()} color="purple" />
                <StatCard icon={MousePointer} label="Durchschn. CTR" value={`${stats.avg_ctr}%`} color="yellow" />
              </div>
            )}

            {/* Campaigns List */}
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <div key={campaign.campaign_id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold">{campaign.campaign_name}</h3>
                      <p className="text-sm text-gray-400">{campaign.user_email}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-xs ${
                      campaign.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {campaign.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Impressions</p>
                      <p className="font-bold">{campaign.impressions}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Clicks</p>
                      <p className="font-bold">{campaign.clicks}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">CTR</p>
                      <p className="font-bold text-cyan-400">{campaign.ctr}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Budget</p>
                      <p className="font-bold text-green-400">€{campaign.budget_total?.toFixed(0)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    cyan: 'from-cyan-500/10 border-cyan-500/20 text-cyan-400',
    green: 'from-green-500/10 border-green-500/20 text-green-400',
    purple: 'from-purple-500/10 border-purple-500/20 text-purple-400',
    yellow: 'from-yellow-500/10 border-yellow-500/20 text-yellow-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-xl p-4 border`}>
      <Icon size={20} className="mb-2" />
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
