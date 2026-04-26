/**
 * Admin Booking Manager
 * Alle Buchungen & Service-Provider verwalten
 */
import { useState, useEffect } from 'react';
import { Calendar, Users, Euro, TrendingUp, ArrowLeft } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminBookingManagerPage({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await fetch(`${API}/api/reservations/admin/stats`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
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
            <h1 className="text-xl font-bold flex-1">Buchungssystem Administration</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Users} label="Service-Provider" value={stats.total_providers} color="cyan" />
            <StatCard icon={Calendar} label="Gesamt Buchungen" value={stats.total_bookings} color="purple" />
            <StatCard icon={TrendingUp} label="Abschlussrate" value={`${stats.completion_rate}%`} color="green" />
            <StatCard icon={Euro} label="Provisions-Umsatz" value={`€${stats.total_commission_revenue?.toFixed(2)}`} color="yellow" />
          </div>
        ) : (
          <p className="text-center text-gray-400">Keine Daten verfügbar</p>
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
