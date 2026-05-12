/**
 * Admin Staff Overview
 * ====================
 * Admin dashboard for Staff Module analytics
 */
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Clock, Calendar, AlertCircle, TrendingUp, Download } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminStaffOverview() {
  const [stats, setStats] = useState(null);
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdminStats();
  }, []);

  const loadAdminStats = async () => {
    try {
      // TODO: Implement admin API endpoint
      const mockStats = {
        total_merchants_with_staff: 45,
        total_staff_members: 287,
        today_checkins: 156,
        pending_leave_requests: 12,
        trial_merchants: 8,
        paid_merchants: 37
      };
      setStats(mockStats);

      const mockMerchants = [
        { id: "1", name: "Restaurant A", plan: "pro", trial_ends: null, staff_count: 15 },
        { id: "2", name: "Café B", plan: "free_trial", trial_ends: "2025-06-01", staff_count: 3 },
      ];
      setMerchants(mockMerchants);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) return null;

  const statCards = [
    { label: "Händler mit Staff", value: stats.total_merchants_with_staff, icon: Users, color: "#00C2FF" },
    { label: "Gesamt Mitarbeiter", value: stats.total_staff_members, icon: Users, color: "#A855F7" },
    { label: "Heute Check-ins", value: stats.today_checkins, icon: Clock, color: "#10B981" },
    { label: "Offene Anträge", value: stats.pending_leave_requests, icon: AlertCircle, color: "#F59E0B" }
  ];

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 rounded-2xl bg-white/[0.02] border border-white/5"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <Icon size={16} style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Merchants List */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
        <h3 className="text-sm font-semibold mb-3">Händler Übersicht</h3>
        <div className="space-y-2">
          {merchants.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div>
                <p className="text-xs font-medium">{m.name}</p>
                <p className="text-[10px] text-white/40">
                  {m.staff_count} Mitarbeiter • {m.plan === "free_trial" ? `Trial bis ${m.trial_ends}` : m.plan}
                </p>
              </div>
              <div className={`px-2 py-1 rounded-lg text-[10px] font-medium ${
                m.plan === "pro" ? "bg-[#A855F7]/10 text-[#A855F7]" :
                m.plan === "free_trial" ? "bg-yellow-500/10 text-yellow-400" :
                "bg-white/5 text-white/60"
              }`}>
                {m.plan === "free_trial" ? "Trial" : m.plan.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
