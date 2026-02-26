/**
 * AdminBNPL - Admin Dashboard für Ratenzahlungen
 * Übersicht aller BNPL-Pläne, Statistiken und Mahnungen
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { 
  CreditCard, Users, Clock, AlertTriangle, CheckCircle, 
  TrendingUp, Euro, Send, ChevronRight, RefreshCw,
  Calendar, Search, Filter, ArrowUpDown
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminBNPL() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ plans: [], stats: {} });
  const [filter, setFilter] = useState('all'); // all, active, overdue, completed
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingReminder, setSendingReminder] = useState(null);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/bnpl/admin/overview?token=${token}`);
      if (!res.ok) throw new Error('Nicht autorisiert');
      const result = await res.json();
      setData(result);
    } catch (error) {
      toast.error('Fehler beim Laden der Daten');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async (planId) => {
    setSendingReminder(planId);
    try {
      const res = await fetch(`${API}/api/bnpl/admin/send-reminder?plan_id=${planId}&token=${token}`, {
        method: 'POST'
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message);
      } else {
        throw new Error(result.detail);
      }
    } catch (error) {
      toast.error('Fehler beim Senden der Erinnerung');
    } finally {
      setSendingReminder(null);
    }
  };

  const filteredPlans = data.plans.filter(plan => {
    // Status filter
    if (filter === 'active' && plan.status !== 'active') return false;
    if (filter === 'overdue' && !plan.is_overdue) return false;
    if (filter === 'completed' && plan.status !== 'completed') return false;
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        plan.user_email?.toLowerCase().includes(search) ||
        plan.user_name?.toLowerCase().includes(search) ||
        plan.id?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (plan) => {
    if (plan.is_overdue) {
      return <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">Überfällig</span>;
    }
    if (plan.status === 'completed') {
      return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Abgeschlossen</span>;
    }
    if (plan.status === 'active') {
      return <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">Aktiv</span>;
    }
    return <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">{plan.status}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const { stats } = data;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="admin-bnpl-page">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">BNPL Administration</h1>
            <p className="text-gray-500">Ratenzahlungen verwalten und überwachen</p>
          </div>
          <Button onClick={fetchData} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Aktualisieren
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <CreditCard className="w-4 h-4" />
              <span className="text-xs">Gesamt</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{stats.total_plans || 0}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 text-blue-500 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs">Aktiv</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.active_plans || 0}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 text-green-500 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs">Abgeschlossen</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.completed_plans || 0}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 text-red-500 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs">Überfällig</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.overdue_plans || 0}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 text-purple-500 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Gesamtvolumen</span>
            </div>
            <p className="text-xl font-bold text-purple-600">€{(stats.total_volume || 0).toFixed(0)}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <Euro className="w-4 h-4" />
              <span className="text-xs">Ausstehend</span>
            </div>
            <p className="text-xl font-bold text-amber-600">€{(stats.total_outstanding || 0).toFixed(0)}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-500 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs">Eingezogen</span>
            </div>
            <p className="text-xl font-bold text-emerald-600">€{(stats.total_collected || 0).toFixed(0)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Suche nach E-Mail oder Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="all">Alle Status</option>
                <option value="active">Nur Aktive</option>
                <option value="overdue">Nur Überfällige</option>
                <option value="completed">Nur Abgeschlossene</option>
              </select>
            </div>
          </div>
        </div>

        {/* Plans Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Betrag</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ausstehend</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Raten</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Nächste Fälligkeit</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPlans.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                      Keine Ratenzahlungspläne gefunden
                    </td>
                  </tr>
                ) : (
                  filteredPlans.map((plan) => (
                    <tr key={plan.id} className={`hover:bg-gray-50 ${plan.is_overdue ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{plan.user_name}</p>
                          <p className="text-xs text-gray-500">{plan.user_email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">
                          {plan.item_type === 'bid_package' ? 'Gebote-Paket' : 'Auktion'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium text-gray-800">€{plan.total_amount?.toFixed(2)}</span>
                        {plan.interest_rate > 0 && (
                          <span className="text-xs text-gray-500 ml-1">({plan.interest_rate}%)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${plan.remaining_amount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                          €{plan.remaining_amount?.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-600">
                          {plan.installment_count}x €{plan.monthly_payment?.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span className={`text-sm ${plan.is_overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                            {formatDate(plan.next_due_date)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(plan)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {plan.status === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendReminder(plan.id)}
                            disabled={sendingReminder === plan.id}
                            className="gap-1 text-xs"
                          >
                            {sendingReminder === plan.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            Mahnung
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 text-center text-sm text-gray-500">
          {filteredPlans.length} von {data.plans.length} Plänen angezeigt
        </div>
      </div>
    </div>
  );
}
