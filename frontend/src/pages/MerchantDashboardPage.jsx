import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Store, MapPin, Plus, Users, Monitor, Key, Loader2,
  Check, X, ChevronRight, Activity, RefreshCw, Trash2, Shield,
  BarChart3, Copy, Eye, EyeOff, Zap
} from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { api } from "../services/api";

const glass = "backdrop-blur-xl";
const panelBg = "rgba(8,12,20,0.7)";
const panelBorder = "1px solid rgba(255,255,255,0.04)";

const MerchantDashboardPage = ({ onBack }) => {
  const { t } = useI18n();
  const [tab, setTab] = useState("overview");
  const [branches, setBranches] = useState([]);
  const [registers, setRegisters] = useState([]);
  const [staff, setStaff] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState("");
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState({});
  const refreshRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [br, reg, st, rev] = await Promise.all([
        api.getMerchantBranches(),
        api.getMerchantRegisters(selectedBranch || ""),
        api.getMerchantStaff(selectedBranch || ""),
        api.getMerchantRevenue(selectedBranch || ""),
      ]);
      setBranches(br.branches || []);
      setRegisters(reg.registers || []);
      setStaff(st.staff || []);
      setRevenue(rev);
    } catch {}
    setLoading(false);
  }, [selectedBranch]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh revenue every 10s when on overview/revenue tab
  useEffect(() => {
    if (tab === "overview" || tab === "revenue") {
      refreshRef.current = setInterval(async () => {
        try {
          const rev = await api.getMerchantRevenue(selectedBranch || "");
          setRevenue(rev);
        } catch {}
      }, 10000);
    }
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [tab, selectedBranch]);

  const createBranch = async () => {
    setSaving(true);
    try {
      await api.createBranch({ name: form.name, address: form.address, city: form.city, country: form.country, contact_person: form.contact });
      setShowAdd("");
      setForm({});
      await load();
    } catch {}
    setSaving(false);
  };

  const createRegister = async (branchId) => {
    setSaving(true);
    try {
      await api.createRegister({ branch_id: branchId, label: form.regLabel || "" });
      setShowAdd("");
      setForm({});
      await load();
    } catch {}
    setSaving(false);
  };

  const addStaff = async (branchId) => {
    setSaving(true);
    try {
      await api.addStaff({ branch_id: branchId, user_email: form.staffEmail, staff_role: form.staffRole || "staff" });
      setShowAdd("");
      setForm({});
      await load();
    } catch {}
    setSaving(false);
  };

  const toggleReg = async (deviceId) => {
    await api.toggleRegister(deviceId);
    await load();
  };

  const regenKey = async (deviceId) => {
    const res = await api.regenerateApiKey(deviceId);
    setShowKey(p => ({ ...p, [deviceId]: res.api_key }));
    await load();
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key).catch(() => {});
  };

  const tabs = [
    { id: "overview", label: t("merch.overview") || "Overview", icon: BarChart3 },
    { id: "branches", label: t("merch.branches") || "Branches", icon: Store },
    { id: "registers", label: t("merch.registers") || "Registers", icon: Monitor },
    { id: "staff", label: t("merch.staff") || "Staff", icon: Users },
    { id: "revenue", label: t("merch.revenue") || "Revenue", icon: Activity },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#040610" }}>
        <Loader2 size={24} className="text-white/20 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div data-testid="merchant-dashboard-page" className="min-h-screen pb-24" style={{ background: "#040610" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: "rgba(4,6,16,0.85)", borderBottom: panelBorder }}>
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <motion.button data-testid="merch-back" onClick={onBack} whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
            <ArrowLeft size={15} className="text-white/40" />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-[15px] font-bold text-white/90 font-outfit">{t("merch.title") || "Merchant Dashboard"}</h1>
            <p className="text-[9px] text-white/25">{branches.length} {t("merch.branches") || "Branches"} · {registers.length} {t("merch.registers") || "Registers"}</p>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-3xl mx-auto flex gap-1 px-4 pb-2 overflow-x-auto">
          {tabs.map(tb => (
            <motion.button key={tb.id} onClick={() => setTab(tb.id)} whileTap={{ scale: 0.95 }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap ${tab === tb.id ? "bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20" : "text-[#444] bg-white/[0.01] border border-white/[0.03]"}`}>
              <tb.icon size={11} />
              {tb.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">

        {/* ── OVERVIEW ── */}
        {tab === "overview" && revenue && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: t("merch.total_rev") || "Revenue", val: `${revenue.total_revenue.toFixed(2)}`, color: "#00E89D" },
                { label: t("merch.total_fees") || "Fees", val: `${revenue.total_fees.toFixed(2)}`, color: "#FFB800" },
                { label: t("merch.total_net") || "Net", val: `${revenue.total_net.toFixed(2)}`, color: "#00E0FF" },
              ].map((m, i) => (
                <motion.div key={i} className={`rounded-2xl p-3 text-center ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <p className="text-[18px] font-black font-mono" style={{ color: m.color }}>{m.val}</p>
                  <p className="text-[8px] text-white/20 mt-0.5">{m.label}</p>
                </motion.div>
              ))}
            </div>
            <motion.div className={`rounded-2xl p-3 ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-2">{t("merch.register_status") || "Register Status"}</p>
              <div className="space-y-1.5">
                {(revenue.registers || []).map((r, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5">
                    <div className={`w-2 h-2 rounded-full ${r.status === "active" ? "bg-[#00E89D]" : "bg-[#FF4757]"}`} />
                    <span className="text-[10px] text-white/50 flex-1">{r.label || r.device_id}</span>
                    <span className="text-[9px] text-white/20 font-mono">{r.transaction_count || 0} txn</span>
                    <span className="text-[10px] text-[#00E0FF] font-bold font-mono">{(r.total_revenue || 0).toFixed(2)}</span>
                  </div>
                ))}
                {(revenue.registers || []).length === 0 && <p className="text-[10px] text-white/15 text-center py-2">{t("merch.no_registers") || "No registers yet"}</p>}
              </div>
            </motion.div>
            {/* Recent Transactions */}
            <motion.div className={`rounded-2xl p-3 ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
              <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-2">{t("merch.recent_txns") || "Recent Transactions"}</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {(revenue.transactions || []).slice(0, 15).map((tx, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <Zap size={10} className="text-[#00E89D]" />
                    <span className="text-[9px] text-white/30 flex-1">{tx.description}</span>
                    <span className="text-[9px] text-white/15 font-mono">{tx.device_id}</span>
                    <span className="text-[10px] text-[#00E0FF] font-bold font-mono">{tx.amount.toFixed(2)}</span>
                    <span className="text-[8px] text-[#FFB800]/60 font-mono">-{tx.fee.toFixed(2)}</span>
                  </div>
                ))}
                {(revenue.transactions || []).length === 0 && <p className="text-[10px] text-white/15 text-center py-2">{t("merch.no_txns") || "No transactions yet"}</p>}
              </div>
            </motion.div>
          </>
        )}

        {/* ── BRANCHES ── */}
        {tab === "branches" && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">{t("merch.your_branches") || "Your Branches"}</p>
              <motion.button data-testid="add-branch-btn" onClick={() => setShowAdd("branch")} whileTap={{ scale: 0.9 }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold" style={{ background: "rgba(0,224,255,0.06)", border: "1px solid rgba(0,224,255,0.12)", color: "#00E0FF" }}>
                <Plus size={10} /> {t("merch.add_branch") || "Add Branch"}
              </motion.button>
            </div>
            {showAdd === "branch" && (
              <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: "1px solid rgba(0,224,255,0.08)" }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="space-y-2">
                  {[
                    { key: "name", placeholder: t("merch.branch_name") || "Branch Name" },
                    { key: "address", placeholder: t("merch.address") || "Address" },
                    { key: "city", placeholder: t("merch.city") || "City" },
                    { key: "country", placeholder: t("merch.country") || "Country" },
                    { key: "contact", placeholder: t("merch.contact") || "Contact Person" },
                  ].map(f => (
                    <input key={f.key} data-testid={`branch-${f.key}-input`} value={form[f.key] || ""} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 placeholder:text-white/15 outline-none" />
                  ))}
                  <div className="flex gap-2">
                    <motion.button data-testid="save-branch-btn" onClick={createBranch} disabled={saving || !form.name} whileTap={{ scale: 0.95 }}
                      className="flex-1 py-2 rounded-lg text-[10px] font-bold" style={{ background: "rgba(0,232,157,0.08)", border: "1px solid rgba(0,232,157,0.15)", color: "#00E89D" }}>
                      {saving ? <Loader2 size={12} className="animate-spin mx-auto" /> : (t("common.save") || "Save")}
                    </motion.button>
                    <motion.button onClick={() => { setShowAdd(""); setForm({}); }} whileTap={{ scale: 0.95 }}
                      className="px-4 py-2 rounded-lg text-[10px] font-bold text-white/20 bg-white/[0.02] border border-white/[0.04]">{t("common.cancel") || "Cancel"}</motion.button>
                  </div>
                </div>
              </motion.div>
            )}
            <div className="space-y-2">
              {branches.map((b, i) => (
                <motion.div key={b.branch_id} data-testid={`branch-${b.branch_id}`} className={`rounded-2xl p-3 ${glass} cursor-pointer`}
                  style={{ background: selectedBranch === b.branch_id ? "rgba(0,224,255,0.03)" : panelBg, border: selectedBranch === b.branch_id ? "1px solid rgba(0,224,255,0.1)" : panelBorder }}
                  onClick={() => setSelectedBranch(selectedBranch === b.branch_id ? null : b.branch_id)}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <div className="flex items-center gap-2">
                    <Store size={14} className="text-[#00E0FF]" />
                    <div className="flex-1">
                      <p className="text-[12px] font-bold text-white/80">{b.name}</p>
                      <p className="text-[9px] text-white/25">{b.address}, {b.city}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-[#00E89D] font-mono">{(b.total_revenue || 0).toFixed(2)}</p>
                      <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-bold ${b.status === "active" ? "bg-[#00E89D]/10 text-[#00E89D]" : "bg-[#FF4757]/10 text-[#FF4757]"}`}>{b.status}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
              {branches.length === 0 && <p className="text-[11px] text-white/15 text-center py-6">{t("merch.no_branches") || "No branches yet"}</p>}
            </div>
          </>
        )}

        {/* ── REGISTERS ── */}
        {tab === "registers" && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">{t("merch.pos_registers") || "POS Registers"}</p>
              {branches.length > 0 && (
                <motion.button data-testid="add-register-btn" onClick={() => setShowAdd("register")} whileTap={{ scale: 0.9 }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold" style={{ background: "rgba(0,224,255,0.06)", border: "1px solid rgba(0,224,255,0.12)", color: "#00E0FF" }}>
                  <Plus size={10} /> {t("merch.add_register") || "Add Register"}
                </motion.button>
              )}
            </div>
            {showAdd === "register" && (
              <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: "1px solid rgba(0,224,255,0.08)" }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <select data-testid="register-branch-select" value={form.regBranch || ""} onChange={e => setForm(p => ({ ...p, regBranch: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 mb-2 outline-none">
                  <option value="" style={{ background: "#111" }}>{t("merch.select_branch") || "Select Branch"}</option>
                  {branches.map(b => <option key={b.branch_id} value={b.branch_id} style={{ background: "#111" }}>{b.name}</option>)}
                </select>
                <input data-testid="register-label-input" value={form.regLabel || ""} onChange={e => setForm(p => ({ ...p, regLabel: e.target.value }))} placeholder={t("merch.register_label") || "Register Label (optional)"}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 placeholder:text-white/15 outline-none mb-2" />
                <div className="flex gap-2">
                  <motion.button data-testid="save-register-btn" onClick={() => createRegister(form.regBranch)} disabled={saving || !form.regBranch} whileTap={{ scale: 0.95 }}
                    className="flex-1 py-2 rounded-lg text-[10px] font-bold" style={{ background: "rgba(0,232,157,0.08)", border: "1px solid rgba(0,232,157,0.15)", color: "#00E89D" }}>
                    {saving ? <Loader2 size={12} className="animate-spin mx-auto" /> : (t("common.create") || "Create")}
                  </motion.button>
                  <motion.button onClick={() => { setShowAdd(""); setForm({}); }} whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 rounded-lg text-[10px] font-bold text-white/20 bg-white/[0.02] border border-white/[0.04]">{t("common.cancel") || "Cancel"}</motion.button>
                </div>
              </motion.div>
            )}
            <div className="space-y-2">
              {registers.map((r, i) => (
                <motion.div key={r.device_id} data-testid={`register-${r.device_id}`} className={`rounded-2xl p-3 ${glass}`} style={{ background: panelBg, border: panelBorder }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Monitor size={14} className={r.status === "active" ? "text-[#00E89D]" : "text-[#FF4757]"} />
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-white/80">{r.label || r.device_id}</p>
                      <p className="text-[8px] text-white/20 font-mono">{r.device_id}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <motion.button onClick={() => toggleReg(r.device_id)} whileTap={{ scale: 0.9 }}
                        className={`px-2 py-1 rounded-lg text-[8px] font-bold ${r.status === "active" ? "bg-[#00E89D]/10 text-[#00E89D]" : "bg-[#FF4757]/10 text-[#FF4757]"}`}>
                        {r.status}
                      </motion.button>
                    </div>
                  </div>
                  {/* API Key */}
                  <div className="flex items-center gap-1.5 bg-white/[0.01] rounded-lg px-2 py-1.5">
                    <Key size={10} className="text-white/15" />
                    <span className="text-[8px] text-white/20 font-mono flex-1 truncate">{showKey[r.device_id] || r.api_key?.slice(0, 20) + "..."}</span>
                    <motion.button onClick={() => setShowKey(p => ({ ...p, [r.device_id]: p[r.device_id] ? null : r.api_key }))} whileTap={{ scale: 0.9 }} className="p-1">
                      {showKey[r.device_id] ? <EyeOff size={10} className="text-white/20" /> : <Eye size={10} className="text-white/20" />}
                    </motion.button>
                    <motion.button onClick={() => copyKey(r.api_key)} whileTap={{ scale: 0.9 }} className="p-1">
                      <Copy size={10} className="text-white/20" />
                    </motion.button>
                    <motion.button onClick={() => regenKey(r.device_id)} whileTap={{ scale: 0.9 }} className="p-1">
                      <RefreshCw size={10} className="text-[#FFB800]" />
                    </motion.button>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[8px] text-white/15">{r.transaction_count || 0} txn</span>
                    <span className="text-[9px] text-[#00E0FF] font-bold font-mono">{(r.total_revenue || 0).toFixed(2)}</span>
                  </div>
                </motion.div>
              ))}
              {registers.length === 0 && <p className="text-[11px] text-white/15 text-center py-6">{t("merch.no_registers") || "No registers"}</p>}
            </div>
          </>
        )}

        {/* ── STAFF ── */}
        {tab === "staff" && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">{t("merch.staff_members") || "Staff Members"}</p>
              {branches.length > 0 && (
                <motion.button data-testid="add-staff-btn" onClick={() => setShowAdd("staff")} whileTap={{ scale: 0.9 }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold" style={{ background: "rgba(0,224,255,0.06)", border: "1px solid rgba(0,224,255,0.12)", color: "#00E0FF" }}>
                  <Plus size={10} /> {t("merch.add_staff") || "Add Staff"}
                </motion.button>
              )}
            </div>
            {showAdd === "staff" && (
              <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: "1px solid rgba(0,224,255,0.08)" }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <select value={form.staffBranch || ""} onChange={e => setForm(p => ({ ...p, staffBranch: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 mb-2 outline-none">
                  <option value="" style={{ background: "#111" }}>{t("merch.select_branch") || "Select Branch"}</option>
                  {branches.map(b => <option key={b.branch_id} value={b.branch_id} style={{ background: "#111" }}>{b.name}</option>)}
                </select>
                <input data-testid="staff-email-input" value={form.staffEmail || ""} onChange={e => setForm(p => ({ ...p, staffEmail: e.target.value }))} placeholder={t("merch.staff_email") || "Staff Email"}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 placeholder:text-white/15 outline-none mb-2" />
                <select data-testid="staff-role-select" value={form.staffRole || "staff"} onChange={e => setForm(p => ({ ...p, staffRole: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 mb-2 outline-none">
                  <option value="branch_admin" style={{ background: "#111" }}>Branch Admin</option>
                  <option value="cashier" style={{ background: "#111" }}>Cashier</option>
                  <option value="staff" style={{ background: "#111" }}>Staff</option>
                </select>
                <div className="flex gap-2">
                  <motion.button data-testid="save-staff-btn" onClick={() => addStaff(form.staffBranch)} disabled={saving || !form.staffEmail || !form.staffBranch} whileTap={{ scale: 0.95 }}
                    className="flex-1 py-2 rounded-lg text-[10px] font-bold" style={{ background: "rgba(0,232,157,0.08)", border: "1px solid rgba(0,232,157,0.15)", color: "#00E89D" }}>
                    {saving ? <Loader2 size={12} className="animate-spin mx-auto" /> : (t("common.add") || "Add")}
                  </motion.button>
                  <motion.button onClick={() => { setShowAdd(""); setForm({}); }} whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 rounded-lg text-[10px] font-bold text-white/20 bg-white/[0.02] border border-white/[0.04]">{t("common.cancel") || "Cancel"}</motion.button>
                </div>
              </motion.div>
            )}
            <div className="space-y-2">
              {staff.map((s, i) => (
                <motion.div key={i} className={`rounded-2xl p-3 ${glass}`} style={{ background: panelBg, border: panelBorder }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-[#A855F7]" />
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-white/80">{s.user_name || s.user_email}</p>
                      <p className="text-[8px] text-white/20">{s.user_email}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-[#A855F7]/10 text-[#A855F7]">{s.staff_role}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-bold ${s.status === "active" ? "bg-[#00E89D]/10 text-[#00E89D]" : "bg-[#FF4757]/10 text-[#FF4757]"}`}>{s.status}</span>
                  </div>
                </motion.div>
              ))}
              {staff.length === 0 && <p className="text-[11px] text-white/15 text-center py-6">{t("merch.no_staff") || "No staff members"}</p>}
            </div>
          </>
        )}

        {/* ── REVENUE (Live) ── */}
        {tab === "revenue" && revenue && (
          <>
            {/* Branch filter */}
            {branches.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <motion.button onClick={() => setSelectedBranch(null)} whileTap={{ scale: 0.95 }}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-semibold whitespace-nowrap ${!selectedBranch ? "bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20" : "text-[#444] bg-white/[0.01] border border-white/[0.03]"}`}>
                  {t("merch.all") || "All"}
                </motion.button>
                {branches.map(b => (
                  <motion.button key={b.branch_id} onClick={() => setSelectedBranch(b.branch_id)} whileTap={{ scale: 0.95 }}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-semibold whitespace-nowrap ${selectedBranch === b.branch_id ? "bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20" : "text-[#444] bg-white/[0.01] border border-white/[0.03]"}`}>
                    {b.name}
                  </motion.button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <motion.div className={`rounded-2xl p-3 text-center ${glass}`} style={{ background: panelBg, border: panelBorder }}>
                <p className="text-[20px] font-black text-[#00E89D] font-mono">{revenue.total_revenue.toFixed(2)}</p>
                <p className="text-[8px] text-white/20">{t("merch.total_rev") || "Revenue"}</p>
              </motion.div>
              <motion.div className={`rounded-2xl p-3 text-center ${glass}`} style={{ background: panelBg, border: panelBorder }}>
                <p className="text-[20px] font-black text-white/60 font-mono">{revenue.total_transactions}</p>
                <p className="text-[8px] text-white/20">{t("merch.payments") || "Payments"}</p>
              </motion.div>
            </div>
            {/* Live Register Status */}
            <motion.div className={`rounded-2xl p-3 ${glass}`} style={{ background: panelBg, border: panelBorder }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">{t("merch.live_registers") || "Live Registers"}</p>
                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#00E89D] animate-pulse" /><span className="text-[8px] text-white/15">LIVE</span></div>
              </div>
              {(revenue.registers || []).map((r, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 border-t border-white/[0.02]">
                  <div className={`w-2 h-2 rounded-full ${r.status === "active" ? "bg-[#00E89D]" : "bg-[#FF4757]"}`} />
                  <span className="text-[10px] text-white/50 flex-1">{r.label || r.device_id}</span>
                  <span className="text-[8px] text-white/15 font-mono">{r.last_active?.slice(11, 16) || "—"}</span>
                  <span className="text-[9px] text-[#FFB800]/60 font-mono">{r.transaction_count} txn</span>
                  <span className="text-[10px] text-[#00E0FF] font-bold font-mono">{(r.total_revenue || 0).toFixed(2)}</span>
                </div>
              ))}
            </motion.div>
            {/* Latest Transactions */}
            <motion.div className={`rounded-2xl p-3 ${glass}`} style={{ background: panelBg, border: panelBorder }}>
              <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-2">{t("merch.latest_txns") || "Latest Transactions"}</p>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {(revenue.transactions || []).slice(0, 20).map((tx, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <Zap size={9} className="text-[#00E89D]" />
                    <span className="text-[9px] text-white/30 flex-1 truncate">{tx.description}</span>
                    <span className="text-[10px] text-white/70 font-bold font-mono">{tx.amount.toFixed(2)}</span>
                    <span className="text-[8px] text-white/15">{tx.created_at?.slice(11, 19)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}

      </div>
    </motion.div>
  );
};

export default MerchantDashboardPage;
