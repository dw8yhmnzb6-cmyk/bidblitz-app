import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { 
  Users, UserPlus, Activity, TrendingUp, TrendingDown, 
  RefreshCw, Trophy, Globe, Clock, Target, Heart,
  ArrowUp, ArrowDown, Minus, Crown, Zap, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function AdminUserAnalytics({ token }) {
  const [overview, setOverview] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [activity, setActivity] = useState(null);
  const [segments, setSegments] = useState(null);
  const [retention, setRetention] = useState(null);
  const [topWinners, setTopWinners] = useState([]);
  const [geographic, setGeographic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const [overviewRes, regRes, actRes, segRes, retRes, winRes, geoRes] = await Promise.all([
        axios.get(`${API}/analytics/users/overview`, { headers }),
        axios.get(`${API}/analytics/users/registrations?period=${period}`, { headers }),
        axios.get(`${API}/analytics/users/activity?period=${period}`, { headers }),
        axios.get(`${API}/analytics/users/segments`, { headers }),
        axios.get(`${API}/analytics/users/retention`, { headers }),
        axios.get(`${API}/analytics/users/top-winners?limit=10`, { headers }),
        axios.get(`${API}/analytics/users/geographic`, { headers })
      ]);
      
      setOverview(overviewRes.data);
      setRegistrations(regRes.data.daily_registrations || []);
      setActivity(actRes.data);
      setSegments(segRes.data);
      setRetention(retRes.data);
      setTopWinners(winRes.data.top_winners || []);
      setGeographic(geoRes.data);
    } catch (err) {
      console.error('Error fetching user analytics:', err);
      toast.error('Fehler beim Laden der Benutzer-Analyse');
    } finally {
      setLoading(false);
    }
  }, [period, token]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const ChangeIndicator = ({ value }) => {
    if (value > 0) return <span className="flex items-center text-green-600 text-sm"><ArrowUp className="w-4 h-4 mr-1" />+{value.toFixed(1)}%</span>;
    if (value < 0) return <span className="flex items-center text-red-600 text-sm"><ArrowDown className="w-4 h-4 mr-1" />{value.toFixed(1)}%</span>;
    return <span className="flex items-center text-gray-500 text-sm"><Minus className="w-4 h-4 mr-1" />0%</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            Benutzer-Analyse
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">Benutzeraktivität, Retention und Segmente</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="flex-1 sm:flex-none px-3 py-2 border rounded-lg text-sm">
            <option value="week">Diese Woche</option>
            <option value="month">Dieser Monat</option>
            <option value="quarter">Quartal</option>
          </select>
          <Button onClick={fetchAnalytics} disabled={loading} variant="outline" className="whitespace-nowrap">
            <RefreshCw className={`w-4 h-4 mr-1 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Aktualisieren</span>
            <span className="sm:hidden">⟳</span>
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 sm:p-5 text-white col-span-2 sm:col-span-1">
            <Users className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
            <div className="text-2xl sm:text-3xl font-bold">{overview.total_users?.toLocaleString()}</div>
            <div className="text-blue-100 text-xs sm:text-sm">Gesamt Benutzer</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 sm:p-5 text-white">
            <div className="flex justify-between items-start">
              <UserPlus className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
              <ChangeIndicator value={overview.day_change_percent} />
            </div>
            <div className="text-2xl sm:text-3xl font-bold mt-2">{overview.new_users_today}</div>
            <div className="text-green-100 text-xs sm:text-sm">Neue heute</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-3 sm:p-5 text-white">
            <Activity className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
            <div className="text-2xl sm:text-3xl font-bold">{overview.active_users_today}</div>
            <div className="text-purple-100 text-xs sm:text-sm">Aktiv heute</div>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-3 sm:p-5 text-white">
            <Zap className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
            <div className="text-2xl sm:text-3xl font-bold">{overview.users_with_bids}</div>
            <div className="text-amber-100 text-xs sm:text-sm">Mit Geboten</div>
          </div>
          <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-3 sm:p-5 text-white">
            <Crown className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
            <div className="text-2xl sm:text-3xl font-bold">{overview.vip_users}</div>
            <div className="text-pink-100 text-xs sm:text-sm">VIP Benutzer</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Übersicht', icon: BarChart3 },
          { id: 'activity', label: 'Aktivität', icon: Activity },
          { id: 'segments', label: 'Segmente', icon: Target },
          { id: 'retention', label: 'Retention', icon: Heart },
          { id: 'winners', label: 'Top Gewinner', icon: Trophy },
          { id: 'geographic', label: 'Sprachen', icon: Globe }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab - Registrations Chart */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-green-500" />
            Registrierungen ({period === 'week' ? 'letzte 7 Tage' : period === 'month' ? 'letzte 30 Tage' : 'letzte 90 Tage'})
          </h3>
          
          {registrations.length > 0 ? (
            <div className="space-y-2">
              {registrations.slice(-14).map((day, idx) => {
                const maxReg = Math.max(...registrations.map(d => d.registrations), 1);
                const width = (day.registrations / maxReg) * 100;
                return (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20">{new Date(day.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all" style={{ width: `${width}%` }} />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{day.registrations}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">Keine Registrierungsdaten</div>
          )}
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && activity && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border p-5 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600">{activity.total_bids?.toLocaleString()}</div>
              <div className="text-gray-500 text-sm">Gebote gesamt</div>
            </div>
            <div className="bg-white rounded-xl border p-5 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-green-600">{activity.unique_active_users}</div>
              <div className="text-gray-500 text-sm">Aktive Benutzer</div>
            </div>
            <div className="bg-white rounded-xl border p-5 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-purple-600">{activity.avg_bids_per_user}</div>
              <div className="text-gray-500 text-sm">Ø Gebote/Benutzer</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900">Top Bieter</h3>
            </div>
            <div className="divide-y">
              {activity.top_bidders?.map((bidder, idx) => (
                <div key={bidder._id} className="px-6 py-3 flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${idx < 3 ? 'bg-blue-500' : 'bg-gray-400'}`}>{idx + 1}</div>
                  <div className="flex-1">
                    <div className="font-medium">{bidder.user_name}</div>
                    <div className="text-xs text-gray-500">{bidder.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600">{bidder.bid_count} Gebote</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Segments Tab */}
      {activeTab === 'segments' && segments && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" />Nach Gebots-Guthaben</h3>
            <div className="space-y-3">
              {Object.entries(segments.by_bid_balance || {}).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-gray-600">{key === 'no_bids' ? 'Keine Gebote' : key === 'low_bids' ? '1-50 Gebote' : key === 'medium_bids' ? '51-200 Gebote' : '200+ Gebote'}</span>
                  <span className="font-bold">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-green-500" />Nach Aktivität</h3>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-gray-600">Aktiv diese Woche</span><span className="font-bold text-green-600">{segments.by_activity?.active_this_week}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Aktiv diesen Monat</span><span className="font-bold text-blue-600">{segments.by_activity?.active_this_month}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Inaktiv</span><span className="font-bold text-gray-500">{segments.by_activity?.inactive}</span></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Crown className="w-5 h-5 text-pink-500" />VIP Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-gray-600">VIP Benutzer</span><span className="font-bold text-pink-600">{segments.by_vip_status?.vip_users}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Reguläre Benutzer</span><span className="font-bold">{segments.by_vip_status?.regular_users}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Retention Tab */}
      {activeTab === 'retention' && retention && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Heart className="w-5 h-5 text-red-500" />Retention-Analyse</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {retention.retention_cohorts?.map((cohort) => (
                <div key={cohort.cohort} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{cohort.cohort}</span>
                    <span>{cohort.still_active} / {cohort.cohort_size} aktiv ({cohort.retention_rate}%)</span>
                  </div>
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full" style={{ width: `${cohort.retention_rate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Winners Tab */}
      {activeTab === 'winners' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" />Top Gewinner</h3>
          </div>
          <div className="divide-y">
            {topWinners.map((winner, idx) => (
              <div key={winner._id} className="px-6 py-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-600' : 'bg-gray-300'}`}>{idx + 1}</div>
                <div className="flex-1">
                  <div className="font-medium">{winner.user_name}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-yellow-600">{winner.wins} Siege</div>
                  <div className="text-xs text-gray-500">€{winner.total_value?.toFixed(2)} Wert</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Geographic Tab */}
      {activeTab === 'geographic' && geographic && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Globe className="w-5 h-5 text-blue-500" />Benutzer nach Sprache</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {geographic.by_language?.slice(0, 10).map((lang, idx) => {
                const maxUsers = geographic.by_language[0]?.users || 1;
                const width = (lang.users / maxUsers) * 100;
                return (
                  <div key={lang.code} className="flex items-center gap-3">
                    <span className="w-24 text-sm font-medium">{lang.name}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-green-500' : idx === 2 ? 'bg-purple-500' : 'bg-gray-400'}`} style={{ width: `${width}%` }} />
                    </div>
                    <span className="text-sm font-bold w-16 text-right">{lang.users}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="text-center text-xs text-gray-400">
        <Clock className="w-3 h-3 inline mr-1" />
        Letzte Aktualisierung: {overview?.timestamp ? new Date(overview.timestamp).toLocaleString('de-DE') : '-'}
      </div>
    </div>
  );
}

export default AdminUserAnalytics;
