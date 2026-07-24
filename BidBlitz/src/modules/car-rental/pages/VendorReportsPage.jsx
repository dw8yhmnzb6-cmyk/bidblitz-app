/**
 * BidBlitz V2 - Vendor Reports Page
 */
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, TrendingUp, Loader2, Car, Calendar, Euro, Users, BarChart3
} from "lucide-react";
import { getVendorReportSummary, getVendorDashboard } from "../api";
import { useI18n } from "../../../store/I18nContext";

const PERIODS = [
  { days: 7, label: "7 Tage" },
  { days: 30, label: "30 Tage" },
  { days: 90, label: "90 Tage" },
  { days: 365, label: "1 Jahr" },
];

export default function VendorReportsPage({ onBack }) {
  const { t } = useI18n();
  const [report, setReport] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => { load(); }, [period]);

  const load = async () => {
    setLoading(true);
    try {
      const [r, d] = await Promise.all([
        getVendorReportSummary(period),
        getVendorDashboard(),
      ]);
      setReport(r);
      setDashboard(d);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const StatCard = ({ icon: Icon, label, value, sub, color }) => (
    <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <span className="text-xs text-[#666]">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-[#555] mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 p-4">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
            className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="vendor-reports-back">
            <ArrowLeft size={20} />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold">Berichte & Analysen</h1>
            <p className="text-xs text-[#666]">Zeitraum: {PERIODS.find(p => p.days === period)?.label}</p>
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {PERIODS.map(p => (
            <motion.button key={p.days} whileTap={{ scale: 0.95 }}
              onClick={() => setPeriod(p.days)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${period === p.days ? "bg-[#00C2FF] text-black" : "bg-white/5 text-[#888]"}`}
              data-testid={`report-period-${p.days}`}>
              {p.label}
            </motion.button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" /></div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Revenue Card */}
          <div className="bg-gradient-to-br from-[#00C2FF]/15 to-[#00C2FF]/5 rounded-2xl p-5 border border-[#00C2FF]/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[#888]">Gesamtumsatz ({PERIODS.find(p => p.days === period)?.label})</span>
              <TrendingUp size={18} className="text-[#00C2FF]" />
            </div>
            <p className="text-3xl font-bold text-[#00C2FF]">€{(report?.stats?.total_revenue || dashboard?.total_revenue || 0).toFixed(2)}</p>
            <p className="text-sm text-[#888] mt-1">
              Provision: <span className="text-yellow-400 font-medium">€{(report?.stats?.total_commission || 0).toFixed(2)}</span>
              {" "}· Netto: <span className="text-[#00D26A] font-medium">€{((report?.stats?.total_revenue || 0) - (report?.stats?.total_commission || 0)).toFixed(2)}</span>
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Calendar} label="Buchungen" value={report?.stats?.total_bookings || 0} sub={`${report?.stats?.completed_bookings || 0} abgeschlossen`} color="#00C2FF" />
            <StatCard icon={Euro} label="Durchschn. Buchung" value={`€${(report?.stats?.avg_booking_value || 0).toFixed(0)}`} color="#00D26A" />
            <StatCard icon={Car} label="Fahrzeuge" value={dashboard?.stats?.total || 0} sub={`${dashboard?.stats?.available || 0} verfügbar`} color="#FFB800" />
            <StatCard icon={Users} label="Kunden" value={report?.stats?.unique_customers || 0} color="#A855F7" />
          </div>

          {/* Booking Status Breakdown */}
          <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 size={16} className="text-[#00C2FF]" /> Buchungsstatus</h3>
            <div className="space-y-2">
              {[
                { label: "Abgeschlossen", value: report?.stats?.completed_bookings || 0, color: "#00D26A" },
                { label: "Aktiv", value: report?.stats?.active_bookings || dashboard?.active_bookings_count || 0, color: "#00C2FF" },
                { label: "Storniert", value: report?.stats?.cancelled_bookings || 0, color: "#FF4757" },
                { label: "Ausstehend", value: report?.stats?.pending_bookings || dashboard?.pending_payout_count || 0, color: "#FFB800" },
              ].map(s => {
                const total = Math.max(report?.stats?.total_bookings || 1, 1);
                const pct = Math.round((s.value / total) * 100);
                return (
                  <div key={s.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#888]">{s.label}</span>
                      <span className="font-medium">{s.value} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: s.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Cars */}
          {report?.top_cars?.length > 0 && (
            <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Car size={16} className="text-[#00C2FF]" /> Top Fahrzeuge</h3>
              <div className="space-y-2">
                {report.top_cars.map((car, i) => (
                  <div key={car.car_id || i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-[#00C2FF]/10 flex items-center justify-center text-xs font-bold text-[#00C2FF]">{i + 1}</span>
                      <span className="text-sm">{car.title || car.car_id}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#00C2FF]">€{(car.revenue || 0).toFixed(0)}</p>
                      <p className="text-[10px] text-[#666]">{car.bookings || 0} Buchungen</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fleet Status */}
          {dashboard?.fleet_status && (
            <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
              <h3 className="text-sm font-semibold mb-3">Flottenstatus</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Verfügbar", val: dashboard.fleet_status.available, color: "#00D26A" },
                  { label: "Vermietet", val: dashboard.fleet_status.rented, color: "#00C2FF" },
                  { label: "Wartung", val: dashboard.fleet_status.maintenance, color: "#FFB800" },
                ].map(f => (
                  <div key={f.label} className="text-center p-3 rounded-xl" style={{ background: `${f.color}08`, border: `1px solid ${f.color}20` }}>
                    <p className="text-xl font-bold" style={{ color: f.color }}>{f.val}</p>
                    <p className="text-[10px] text-[#888]">{f.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
