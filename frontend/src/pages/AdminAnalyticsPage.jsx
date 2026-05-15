/**
 * Admin Analytics Dashboard
 * Zeigt User-Aktivität, Feature-Nutzung, Revenue, Performance
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft, TrendingUp, Users, DollarSign, Activity,
  Zap, Eye, Clock, Loader2, BarChart3, PieChart,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Fehler");
  return d;
}

export default function AdminAnalyticsPage({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(7); // days

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api(`/api/analytics/overview?days=${period}`);
      setData(res);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <Loader2 size={48} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    {
      label: "Total Users",
      value: data.users.total,
      icon: Users,
      color: "#3B82F6",
      change: `+${data.users.new} new`,
    },
    {
      label: "Active Users",
      value: data.users.active,
      icon: Activity,
      color: "#10B981",
      change: `${period}d period`,
    },
    {
      label: "Revenue (30d)",
      value: `€${data.revenue.total.toFixed(2)}`,
      icon: DollarSign,
      color: "#F59E0B",
      change: data.revenue.currency,
    },
    {
      label: "Push Devices",
      value: data.feature_usage.push_devices,
      icon: Zap,
      color: "#8B5CF6",
      change: "registered",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Analytics Dashboard</h1>
            <p className="text-xs text-gray-600">
              Letzte {period} Tage
            </p>
          </div>
          <TrendingUp size={24} className="text-blue-600" />
        </div>

        {/* Period Selector */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                period === d
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div
                  className="w-10 h-10 rounded-lg mb-3 flex items-center justify-center"
                  style={{ backgroundColor: `${stat.color}20` }}
                >
                  <Icon size={20} style={{ color: stat.color }} />
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.change}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Top Events */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={20} className="text-blue-600" />
            <h2 className="font-bold">Top Events</h2>
          </div>

          {data.top_events.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              Keine Events getrackt
            </p>
          )}

          <div className="space-y-2">
            {data.top_events.map((event) => {
              const maxCount = Math.max(
                ...data.top_events.map((e) => e.count)
              );
              const percentage = (event.count / maxCount) * 100;

              return (
                <div key={event.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{event.name}</span>
                    <span className="text-gray-600">{event.count}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feature Usage */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <PieChart size={20} className="text-purple-600" />
            <h2 className="font-bold">Feature Usage</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {Object.entries(data.feature_usage).map(([key, value]) => (
              <div
                key={key}
                className="bg-gray-50 rounded-lg p-3 border border-gray-200"
              >
                <p className="text-2xl font-bold text-purple-600">{value}</p>
                <p className="text-xs text-gray-600 capitalize">
                  {key.replace(/_/g, " ")}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center hover:bg-gray-50">
            <Eye size={24} className="mx-auto mb-2 text-blue-600" />
            <p className="text-sm font-medium">Events Log</p>
          </button>
          <button className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center hover:bg-gray-50">
            <Clock size={24} className="mx-auto mb-2 text-green-600" />
            <p className="text-sm font-medium">Performance</p>
          </button>
        </div>
      </div>
    </div>
  );
}
