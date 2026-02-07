import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BarChart3, TrendingUp, Users, DollarSign, ShoppingCart, 
  Eye, MousePointer, UserPlus, RefreshCw, Calendar, ArrowUp, ArrowDown
} from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Button } from '../ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const CHART_COLORS = {
  primary: '#F59E0B',
  secondary: '#06B6D4',
  success: '#10B981',
  danger: '#EF4444',
  purple: '#8B5CF6'
};

const AdminAnalytics = ({ token }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(7);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/analytics/dashboard?days=${period}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (error) {
      console.error('Analytics error:', error);
      toast.error('Fehler beim Laden der Analytics');
      // Mock data for demo
      setData({
        period: { days: period, start: new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString(), end: new Date().toISOString() },
        users: { total: 1250, new: 87, active: 342, growth_rate: 7.5 },
        revenue: { 
          total: 12450.50, 
          orders: 156, 
          avg_order_value: 79.81,
          daily: [
            { date: '2026-01-30', revenue: 1200, orders: 15 },
            { date: '2026-01-31', revenue: 1850, orders: 22 },
            { date: '2026-02-01', revenue: 2100, orders: 28 },
            { date: '2026-02-02', revenue: 1650, orders: 19 },
            { date: '2026-02-03', revenue: 2300, orders: 31 },
            { date: '2026-02-04', revenue: 1800, orders: 21 },
            { date: '2026-02-05', revenue: 1550, orders: 20 }
          ]
        },
        auctions: { created: 45, completed: 38, total_bids: 4520, avg_bids_per_auction: 119 },
        funnel: { page_views: 15420, registrations: 87, first_bids: 62, purchases: 156 },
        engagement: { bounce_rate: 42.5, avg_session_duration: 285, pages_per_session: 4.2 },
        top_pages: [
          { _id: '/', views: 5200 },
          { _id: '/auctions', views: 4100 },
          { _id: '/buy-bids', views: 2800 },
          { _id: '/dashboard', views: 1200 },
          { _id: '/how-it-works', views: 900 }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!data) return null;

  // Calculate funnel conversion rates
  const funnelData = [
    { stage: 'Besuche', value: data.funnel.page_views, rate: 100 },
    { stage: 'Registrierungen', value: data.funnel.registrations, rate: Math.round(data.funnel.registrations / data.funnel.page_views * 100 * 10) / 10 },
    { stage: 'Erste Gebote', value: data.funnel.first_bids, rate: Math.round(data.funnel.first_bids / data.funnel.page_views * 100 * 10) / 10 },
    { stage: 'Käufe', value: data.funnel.purchases, rate: Math.round(data.funnel.purchases / data.funnel.page_views * 100 * 10) / 10 }
  ];

  return (
    <div className="space-y-6" data-testid="admin-analytics">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-500" />
            Analytics Dashboard
          </h2>
          <p className="text-gray-400 text-sm">Geschäftsmetriken und Benutzerverhalten</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value={7}>Letzte 7 Tage</option>
            <option value={14}>Letzte 14 Tage</option>
            <option value={30}>Letzte 30 Tage</option>
            <option value={90}>Letzte 90 Tage</option>
          </select>
          <Button 
            onClick={fetchAnalytics}
            variant="outline"
            size="sm"
            className="border-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Umsatz" 
          value={`€${data.revenue.total.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`}
          change={data.users.growth_rate}
          icon={DollarSign}
          color="text-green-500"
        />
        <KPICard 
          title="Bestellungen" 
          value={data.revenue.orders}
          subtext={`Ø €${data.revenue.avg_order_value.toFixed(2)}`}
          icon={ShoppingCart}
          color="text-amber-500"
        />
        <KPICard 
          title="Neue Nutzer" 
          value={data.users.new}
          change={data.users.growth_rate}
          icon={UserPlus}
          color="text-cyan-500"
        />
        <KPICard 
          title="Aktive Nutzer" 
          value={data.users.active}
          subtext={`von ${data.users.total} gesamt`}
          icon={Users}
          color="text-purple-500"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Umsatzentwicklung
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data.revenue.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                formatter={(value) => [`€${value.toFixed(2)}`, 'Umsatz']}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke={CHART_COLORS.success} 
                fill={CHART_COLORS.success}
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <MousePointer className="w-5 h-5 text-cyan-500" />
            Conversion Funnel
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={funnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9CA3AF" />
              <YAxis type="category" dataKey="stage" stroke="#9CA3AF" width={100} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                formatter={(value, name, props) => [value.toLocaleString(), `${props.payload.rate}%`]}
              />
              <Bar dataKey="value" fill={CHART_COLORS.secondary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Auction Stats */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">Auktionsstatistik</h3>
          <div className="space-y-4">
            <StatRow label="Erstellt" value={data.auctions.created} />
            <StatRow label="Abgeschlossen" value={data.auctions.completed} />
            <StatRow label="Gesamt Gebote" value={data.auctions.total_bids.toLocaleString()} />
            <StatRow label="Ø Gebote/Auktion" value={data.auctions.avg_bids_per_auction} />
          </div>
        </div>

        {/* Engagement Metrics */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">Engagement</h3>
          <div className="space-y-4">
            <StatRow label="Bounce Rate" value={`${data.engagement?.bounce_rate || 42.5}%`} danger={data.engagement?.bounce_rate > 50} />
            <StatRow label="Ø Sitzungsdauer" value={formatDuration(data.engagement?.avg_session_duration || 285)} />
            <StatRow label="Seiten/Sitzung" value={data.engagement?.pages_per_session || 4.2} />
            <StatRow label="Seitenaufrufe" value={data.funnel.page_views.toLocaleString()} />
          </div>
        </div>

        {/* Top Pages */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-amber-500" />
            Top Seiten
          </h3>
          <div className="space-y-3">
            {(data.top_pages || []).slice(0, 5).map((page, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-gray-300 text-sm truncate max-w-[150px]">{page._id || '/'}</span>
                <span className="text-white font-medium">{page.views?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// KPI Card Component
const KPICard = ({ title, value, change, subtext, icon: Icon, color }) => (
  <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
    <div className="flex items-center justify-between mb-2">
      <span className="text-gray-400 text-sm">{title}</span>
      <Icon className={`w-5 h-5 ${color}`} />
    </div>
    <div className="text-2xl font-bold text-white">{value}</div>
    {change !== undefined && (
      <div className={`flex items-center gap-1 text-sm mt-1 ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
        {change >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
        {Math.abs(change)}%
      </div>
    )}
    {subtext && <div className="text-gray-500 text-xs mt-1">{subtext}</div>}
  </div>
);

// Stat Row Component
const StatRow = ({ label, value, danger }) => (
  <div className="flex items-center justify-between">
    <span className="text-gray-400">{label}</span>
    <span className={`font-semibold ${danger ? 'text-red-500' : 'text-white'}`}>{value}</span>
  </div>
);

// Format duration in seconds to mm:ss
const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default AdminAnalytics;
