/**
 * BidBlitz V2 - Admin Car Rental Overview Page
 * Admin management for vendors, bookings, payouts
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Car, Users, Calendar, Euro, Loader2, Check, X,
  ChevronRight, AlertCircle, CreditCard, Shield, TrendingUp,
  CheckCircle, XCircle, Clock, AlertTriangle, Settings
} from "lucide-react";
import {
  getAdminOverview, getAdminVendors, adminVendorAction, adminSetVendorCommission,
  getAdminBookings, getAdminPayouts, adminProcessPayout,
  getAdminSettings, updateAdminSettings
} from "../api";
import { useI18n } from "../../../store/I18nContext";

const VENDOR_STATUS = {
  pending: { label: "Ausstehend", color: "#FFB800" },
  approved: { label: "Genehmigt", color: "#00D26A" },
  suspended: { label: "Gesperrt", color: "#FF4757" },
  rejected: { label: "Abgelehnt", color: "#FF4757" },
};

const TABS = [
  { id: "overview", label: "Übersicht" },
  { id: "vendors", label: "Vermieter" },
  { id: "bookings", label: "Buchungen" },
  { id: "payouts", label: "Auszahlungen" },
  { id: "settings", label: "Einstellungen" },
];

export default function AdminCarRentalPage({ onBack, onNavigate }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [settings, setSettings] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => { loadTab(); }, [activeTab]);

  const loadTab = async () => {
    setLoading(true);
    try {
      if (activeTab === "overview") {
        const data = await getAdminOverview();
        setOverview(data);
      } else if (activeTab === "vendors") {
        const data = await getAdminVendors();
        setVendors(data.vendors || []);
      } else if (activeTab === "bookings") {
        const data = await getAdminBookings();
        setBookings(data.bookings || []);
      } else if (activeTab === "payouts") {
        const data = await getAdminPayouts();
        setPayouts(data.payouts || []);
      } else if (activeTab === "settings") {
        const data = await getAdminSettings();
        setSettings(data.settings || {});
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleVendorAction = async (vendorId, action) => {
    setActionLoading(vendorId);
    try {
      const reason = action !== "approve" ? window.prompt("Grund (optional):") : null;
      await adminVendorAction(vendorId, action, reason);
      loadTab();
    } catch (err) { alert(err.message); }
    setActionLoading(null);
  };

  const handleCommission = async (vendorId) => {
    const current = vendors.find(v => v.vendor_id === vendorId)?.commission_percent || 15;
    const val = window.prompt(`Neue Provision (%) für diesen Vermieter?\nAktuell: ${current}%`, current);
    if (!val) return;
    setActionLoading(vendorId);
    try {
      await adminSetVendorCommission(vendorId, parseFloat(val));
      loadTab();
    } catch (err) { alert(err.message); }
    setActionLoading(null);
  };

  const handleProcessPayout = async (payoutId, status) => {
    setActionLoading(payoutId);
    try {
      const ref = status === "completed" ? `TXN-${Date.now()}` : null;
      await adminProcessPayout(payoutId, status, ref);
      loadTab();
    } catch (err) { alert(err.message); }
    setActionLoading(null);
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      await updateAdminSettings(settings);
      alert("Einstellungen gespeichert!");
    } catch (err) { alert(err.message); }
    setSettingsSaving(false);
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("de-DE") : "";

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <span className="text-xs text-[#666]">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 p-4">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
            className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="admin-car-rental-back">
            <ArrowLeft size={20} />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold">Autovermietung Admin</h1>
            <p className="text-xs text-[#666]">Verwaltung</p>
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <motion.button key={tab.id} whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === tab.id ? "bg-[#00C2FF] text-black" : "bg-white/5 text-[#888]"}`}
              data-testid={`admin-tab-${tab.id}`}>
              {tab.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" /></div>
        ) : activeTab === "overview" && overview ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Users} label="Vermieter" value={overview.vendors?.total || 0} color="#00C2FF" />
              <StatCard icon={AlertCircle} label="Ausstehend" value={overview.vendors?.pending || 0} color="#FFB800" />
              <StatCard icon={Car} label="Fahrzeuge" value={overview.cars || 0} color="#00D26A" />
              <StatCard icon={Calendar} label="Buchungen" value={overview.bookings?.total || 0} color="#888" />
            </div>
            <div className="bg-gradient-to-br from-[#00C2FF]/15 to-[#00C2FF]/5 rounded-2xl p-5 border border-[#00C2FF]/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#888]">Plattform-Umsatz</span>
                <TrendingUp size={18} className="text-[#00C2FF]" />
              </div>
              <p className="text-2xl font-bold">€{(overview.revenue?.total || 0).toFixed(2)}</p>
              <p className="text-sm text-[#888] mt-1">Provision: <span className="text-[#00C2FF] font-medium">€{(overview.revenue?.platform_commission || 0).toFixed(2)}</span></p>
            </div>
            <div className="bg-[#111118] rounded-xl p-4 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-[#FFB800]" />
                <span className="text-sm">Offene Auszahlungen</span>
              </div>
              <span className="text-lg font-bold text-[#FFB800]">{overview.pending_payouts || 0}</span>
            </div>

            {/* Quick navigation */}
            <div className="space-y-2">
              <motion.button whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate?.("/car-rental/admin/disputes")}
                className="w-full flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/5"
                data-testid="admin-nav-disputes">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={18} className="text-[#FFB800]" />
                  <span className="text-sm">Streitfälle verwalten</span>
                </div>
                <ChevronRight size={18} className="text-[#666]" />
              </motion.button>
              <motion.button whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab("settings")}
                className="w-full flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/5"
                data-testid="admin-nav-settings">
                <div className="flex items-center gap-3">
                  <Settings size={18} className="text-[#A855F7]" />
                  <span className="text-sm">Plattform-Einstellungen</span>
                </div>
                <ChevronRight size={18} className="text-[#666]" />
              </motion.button>
            </div>
          </div>
        ) : activeTab === "vendors" ? (
          <div className="space-y-3">
            {vendors.length === 0 ? (
              <div className="text-center py-16"><Users size={48} className="mx-auto text-[#333] mb-4" /><p className="text-white/70">Keine Vermieter</p></div>
            ) : vendors.map((v, idx) => {
              const vst = VENDOR_STATUS[v.status] || VENDOR_STATUS.pending;
              const isPending = v.status === "pending";
              return (
                <motion.div key={v.vendor_id} initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                  className="bg-[#111118] rounded-2xl p-4 border border-white/5"
                  data-testid={`admin-vendor-${v.vendor_id}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-sm">{v.company?.company_name || "N/A"}</h3>
                      <p className="text-xs text-[#666]">{v.company?.city} · {v.company?.email}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium"
                      style={{ background: `${vst.color}15`, color: vst.color }}>{vst.label}</span>
                  </div>
                  <div className="text-xs text-[#888] mb-3 flex items-center justify-between">
                    <span>Provision: {v.commission_percent || 15}% · Erstellt: {fmtDate(v.created_at)}</span>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleCommission(v.vendor_id)}
                      className="px-2 py-1 rounded-lg bg-[#00C2FF]/10 text-[#00C2FF] text-[10px] font-medium"
                      data-testid={`commission-vendor-${v.vendor_id}`}>
                      Provision ändern
                    </motion.button>
                  </div>
                  {isPending && (
                    <div className="flex gap-2 pt-3 border-t border-white/5">
                      <motion.button whileTap={{ scale: 0.95 }}
                        disabled={actionLoading === v.vendor_id}
                        onClick={() => handleVendorAction(v.vendor_id, "approve")}
                        className="flex-1 py-2 rounded-xl bg-green-500/10 text-green-400 text-sm font-medium flex items-center justify-center gap-1.5"
                        data-testid={`approve-vendor-${v.vendor_id}`}>
                        {actionLoading === v.vendor_id ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle size={14} /> Genehmigen</>}
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => handleVendorAction(v.vendor_id, "reject")}
                        className="flex-1 py-2 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium flex items-center justify-center gap-1.5"
                        data-testid={`reject-vendor-${v.vendor_id}`}>
                        <XCircle size={14} /> Ablehnen
                      </motion.button>
                    </div>
                  )}
                  {v.status === "approved" && (
                    <div className="flex gap-2 pt-3 border-t border-white/5">
                      <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => handleVendorAction(v.vendor_id, "suspend")}
                        className="flex-1 py-2 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium flex items-center justify-center gap-1.5">
                        <Shield size={14} /> Sperren
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : activeTab === "bookings" ? (
          <div className="space-y-3">
            {bookings.length === 0 ? (
              <div className="text-center py-16"><Calendar size={48} className="mx-auto text-[#333] mb-4" /><p className="text-white/70">Keine Buchungen</p></div>
            ) : bookings.map((b, idx) => (
              <motion.div key={b.booking_id} initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                className="bg-[#111118] rounded-2xl p-4 border border-white/5"
                data-testid={`admin-booking-${b.booking_id}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-sm">{b.car_title || "Fahrzeug"}</h3>
                    <p className="text-xs text-[#666]">{b.customer_name} · {fmtDate(b.start_date)} - {fmtDate(b.end_date)}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs capitalize font-medium"
                    style={{ background: "rgba(0,194,255,0.1)", color: "#00C2FF" }}>
                    {b.status}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-white/5">
                  <span className="text-[#888]">Gesamt</span>
                  <span className="font-bold text-[#00C2FF]">€{b.total_amount?.toFixed(2)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : activeTab === "payouts" ? (
          <div className="space-y-3">
            {payouts.length === 0 ? (
              <div className="text-center py-16"><CreditCard size={48} className="mx-auto text-[#333] mb-4" /><p className="text-white/70">Keine Auszahlungen</p></div>
            ) : payouts.map((p, idx) => (
              <motion.div key={p.payout_id} initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                className="bg-[#111118] rounded-2xl p-4 border border-white/5"
                data-testid={`admin-payout-${p.payout_id}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-sm">{p.vendor_name || "Vermieter"}</h3>
                    <p className="text-xs text-[#666]">{fmtDate(p.created_at)}</p>
                  </div>
                  <span className="text-lg font-bold">€{p.amount?.toFixed(2)}</span>
                </div>
                {p.status === "pending" && (
                  <div className="flex gap-2 pt-3 border-t border-white/5">
                    <motion.button whileTap={{ scale: 0.95 }}
                      disabled={actionLoading === p.payout_id}
                      onClick={() => handleProcessPayout(p.payout_id, "completed")}
                      className="flex-1 py-2 rounded-xl bg-green-500/10 text-green-400 text-sm font-medium flex items-center justify-center gap-1.5"
                      data-testid={`process-payout-${p.payout_id}`}>
                      {actionLoading === p.payout_id ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} /> Auszahlen</>}
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => handleProcessPayout(p.payout_id, "failed")}
                      className="flex-1 py-2 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium flex items-center justify-center gap-1.5">
                      <X size={14} /> Ablehnen
                    </motion.button>
                  </div>
                )}
                {p.status !== "pending" && (
                  <div className="pt-2 border-t border-white/5">
                    <span className={`text-xs font-medium ${p.status === "completed" ? "text-green-400" : "text-red-400"}`}>
                      {p.status === "completed" ? "Ausgezahlt" : p.status === "processing" ? "In Bearbeitung" : "Fehlgeschlagen"}
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : activeTab === "settings" && settings ? (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Plattform-Einstellungen</h2>
            {[
              { key: "default_commission", label: "Standard-Provision (%)", type: "number" },
              { key: "min_payout_amount", label: "Min. Auszahlungsbetrag (€)", type: "number" },
              { key: "max_booking_days", label: "Max. Buchungstage", type: "number" },
              { key: "payout_schedule", label: "Auszahlungs-Rhythmus", type: "select", options: ["weekly", "biweekly", "monthly"] },
            ].map(field => (
              <div key={field.key} className="bg-[#111118] rounded-xl p-4 border border-white/5">
                <label className="text-xs text-[#666] mb-2 block">{field.label}</label>
                {field.type === "select" ? (
                  <select value={settings[field.key] || ""}
                    onChange={e => setSettings(s => ({ ...s, [field.key]: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none"
                    data-testid={`settings-${field.key}`}>
                    {field.options.map(o => <option key={o} value={o}>{o === "weekly" ? "Wöchentlich" : o === "biweekly" ? "Alle 2 Wochen" : "Monatlich"}</option>)}
                  </select>
                ) : (
                  <input type={field.type} value={settings[field.key] ?? ""}
                    onChange={e => setSettings(s => ({ ...s, [field.key]: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none"
                    data-testid={`settings-${field.key}`} />
                )}
              </div>
            ))}
            <div className="bg-[#111118] rounded-xl p-4 border border-white/5 flex items-center justify-between">
              <label className="text-sm">Vermieter-Verifizierung erforderlich</label>
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => setSettings(s => ({ ...s, require_vendor_verification: !s.require_vendor_verification }))}
                className={`w-12 h-6 rounded-full flex items-center transition-colors ${settings.require_vendor_verification ? "bg-[#00C2FF] justify-end" : "bg-white/10 justify-start"}`}
                data-testid="settings-require_vendor_verification">
                <div className="w-5 h-5 rounded-full bg-white mx-0.5" />
              </motion.button>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleSaveSettings}
              disabled={settingsSaving}
              className="w-full py-4 rounded-xl bg-[#00C2FF] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="save-settings-btn">
              {settingsSaving ? <Loader2 size={20} className="animate-spin" /> : <><Check size={20} /> Einstellungen speichern</>}
            </motion.button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
