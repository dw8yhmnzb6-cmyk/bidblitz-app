import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Store, Plus, Users, Monitor, Key, Loader2,
  Check, X, Activity, RefreshCw, BarChart3, Copy, Eye, EyeOff,
  Zap, CircleDollarSign, Clock, Filter, ExternalLink, Wallet, FileText, Mail, QrCode
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
  const [branchSummary, setBranchSummary] = useState([]);
  const [commData, setCommData] = useState(null);
  const [apiKeys, setApiKeys] = useState([]);
  const [regTxns, setRegTxns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState("");
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [txnPeriod, setTxnPeriod] = useState("today");
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState({});
  const [dailyReport, setDailyReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [refundForm, setRefundForm] = useState(null);
  const [payKeys, setPayKeys] = useState([]);
  const [paySessions, setPaySessions] = useState([]);
  const [payRevenue, setPayRevenue] = useState(null);
  const [createdKey, setCreatedKey] = useState(null);
  const [invoiceLinks, setInvoiceLinks] = useState([]);
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
    } catch {
      // noop
    }
    setLoading(false);
  }, [selectedBranch]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (active) {
        await load();
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [load]);

  // Load tab-specific data
  useEffect(() => {
    if (tab === "branch-summary") {
      api.getBranchSummary().then(d => setBranchSummary(d.branches || [])).catch(() => undefined);
    }
    if (tab === "commission") {
      api.getCommissionSummary().then(d => setCommData(d)).catch(() => undefined);
    }
    if (tab === "api-keys") {
      api.getApiKeys(selectedBranch || "").then(d => setApiKeys(d.api_keys || [])).catch(() => undefined);
    }
    if (tab === "reports") {
      api.getDailyReport().then(d => setDailyReport(d)).catch(() => undefined);
      const now = new Date();
      api.getMonthlyReport(now.getFullYear(), now.getMonth() + 1).then(d => setMonthlyReport(d)).catch(() => undefined);
    }
    if (tab === "shifts") {
      api.getShifts().then(d => setShifts(d.shifts || [])).catch(() => undefined);
      api.getActiveShift().then(d => setActiveShift(d.active_shift)).catch(() => undefined);
    }
    if (tab === "refunds") {
      api.getRefunds().then(d => setRefunds(d.refunds || [])).catch(() => undefined);
    }
    if (tab === "pay-keys") {
      api.getMyPayKeys().then(d => {
        setPayKeys(d.keys || []);
        const paid = (d.keys || []).reduce((sum, k) => sum + (k.total_paid || 0), 0);
        const total = (d.keys || []).reduce((sum, k) => sum + (k.total_sessions || 0), 0);
        setPayRevenue({ total_paid: paid, total_sessions: total });
      }).catch(() => undefined);
      api.getMySessions(30).then(d => setPaySessions(d.sessions || [])).catch(() => undefined);
    }
    if (tab === "invoice-links") {
      api.getMyInvoices?.().then(d => setInvoiceLinks((d.invoices || []).slice(0, 20))).catch(() => undefined);
    }
  }, [tab, selectedBranch]);

  // Load register transactions
  useEffect(() => {
    if (tab === "transactions") {
      api.getRegisterTransactions(selectedDevice, selectedBranch || "", txnPeriod).then(d => setRegTxns(d)).catch(() => undefined);
    }
  }, [tab, selectedDevice, selectedBranch, txnPeriod]);

  // Auto-refresh revenue on overview/revenue tab
  useEffect(() => {
    if (tab === "overview" || tab === "revenue") {
      refreshRef.current = setInterval(async () => {
        try {
          const rev = await api.getMerchantRevenue(selectedBranch || "");
          setRevenue(rev);
        } catch {
          // noop
        }
      }, 10000);
    }
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [tab, selectedBranch]);

  const createBranch = async () => {
    setSaving(true);
    try {
      await api.createBranch({ name: form.name, address: form.address, city: form.city, country: form.country, contact_person: form.contact });
      setShowAdd(""); setForm({}); await load();
    } catch {
      // noop
    }
    setSaving(false);
  };
  const createRegister = async (branchId) => {
    setSaving(true);
    try {
      await api.createRegister({ branch_id: branchId, label: form.regLabel || "" });
      setShowAdd(""); setForm({}); await load();
    } catch {
      // noop
    }
    setSaving(false);
  };
  const addStaff = async (branchId) => {
    setSaving(true);
    try {
      await api.addStaff({ branch_id: branchId, user_email: form.staffEmail, staff_role: form.staffRole || "staff" });
      setShowAdd(""); setForm({}); await load();
    } catch {
      // noop
    }
    setSaving(false);
  };
  const toggleReg = async (deviceId) => { await api.toggleRegister(deviceId); await load(); };
  const regenKey = async (deviceId) => {
    const res = await api.regenerateApiKey(deviceId);
    setShowKey(p => ({ ...p, [deviceId]: res.api_key }));
    if (tab === "api-keys") api.getApiKeys(selectedBranch || "").then(d => setApiKeys(d.api_keys || [])).catch(() => undefined);
    await load();
  };
  const copyKey = (key) => { navigator.clipboard.writeText(key).catch(() => undefined); };

  const tabs = [
    { id: "overview", label: t("merch.overview") || "Overview", icon: BarChart3 },
    { id: "branches", label: t("merch.branches") || "Branches", icon: Store },
    { id: "branch-summary", label: t("merch.summary") || "Summary", icon: BarChart3 },
    { id: "registers", label: t("merch.registers") || "Registers", icon: Monitor },
    { id: "transactions", label: t("merch.txns") || "Txn", icon: Activity },
    { id: "commission", label: t("merch.commission") || "Commission", icon: CircleDollarSign },
    { id: "api-keys", label: t("merch.api_keys") || "API Keys", icon: Key },
    { id: "staff", label: t("merch.staff") || "Staff", icon: Users },
    { id: "revenue", label: t("merch.revenue") || "Revenue", icon: Activity },
    { id: "reports", label: t("merch.reports") || "Reports", icon: BarChart3 },
    { id: "shifts", label: t("merch.shifts") || "Shifts", icon: Clock },
    { id: "refunds", label: t("merch.refunds") || "Refunds", icon: RefreshCw },
    { id: "pay-keys", label: "Pay Keys", icon: Wallet },
    { id: "invoice-links", label: "Invoice Links", icon: FileText },
  ];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "#040610" }}><Loader2 size={24} className="text-white/20 animate-spin" /></div>;
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
        <div className="max-w-3xl mx-auto flex gap-1 px-4 pb-2 overflow-x-auto">
          {tabs.map(tb => (
            <motion.button key={tb.id} onClick={() => setTab(tb.id)} whileTap={{ scale: 0.95 }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-semibold whitespace-nowrap ${tab === tb.id ? "bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20" : "text-[#444] bg-white/[0.01] border border-white/[0.03]"}`}>
              <tb.icon size={10} /> {tb.label}
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
                { label: t("merch.total_rev") || "Revenue", val: revenue.total_revenue.toFixed(2), color: "#00E89D" },
                { label: t("merch.total_fees") || "Fees", val: revenue.total_fees.toFixed(2), color: "#FFB800" },
                { label: t("merch.total_net") || "Net", val: revenue.total_net.toFixed(2), color: "#00E0FF" },
              ].map((m, i) => (
                <motion.div key={i} className={`rounded-2xl p-3 text-center ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <p className="text-[18px] font-black font-mono" style={{ color: m.color }}>{m.val}</p>
                  <p className="text-[8px] text-white/20 mt-0.5">{m.label}</p>
                </motion.div>
              ))}
            </div>
            <Panel title={t("merch.register_status") || "Register Status"}>
              {(revenue.registers || []).map((r, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5">
                  <div className={`w-2 h-2 rounded-full ${r.status === "active" ? "bg-[#00E89D]" : "bg-[#FF4757]"}`} />
                  <span className="text-[10px] text-white/50 flex-1">{r.label || r.device_id}</span>
                  <span className="text-[9px] text-white/20 font-mono">{r.transaction_count || 0} txn</span>
                  <span className="text-[10px] text-[#00E0FF] font-bold font-mono">{(r.total_revenue || 0).toFixed(2)}</span>
                </div>
              ))}
              {(revenue.registers || []).length === 0 && <Empty />}
            </Panel>
            <Panel title={t("merch.recent_txns") || "Recent Transactions"}>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {(revenue.transactions || []).slice(0, 15).map((tx, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <Zap size={10} className="text-[#00E89D]" />
                    <span className="text-[9px] text-white/30 flex-1">{tx.description}</span>
                    <span className="text-[9px] text-white/15 font-mono">{tx.device_id}</span>
                    <span className="text-[10px] text-[#00E0FF] font-bold font-mono">{tx.amount.toFixed(2)}</span>
                    <span className="text-[8px] text-[#FFB800]/60 font-mono">-{tx.fee.toFixed(2)}</span>
                  </div>
                ))}
                {(revenue.transactions || []).length === 0 && <Empty />}
              </div>
            </Panel>
          </>
        )}

        {/* ── BRANCHES ── */}
        {tab === "branches" && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">{t("merch.your_branches") || "Your Branches"}</p>
              <AddBtn data-testid="add-branch-btn" onClick={() => setShowAdd("branch")} label={t("merch.add_branch") || "Add Branch"} />
            </div>
            {showAdd === "branch" && (
              <FormPanel>
                {["name", "address", "city", "country", "contact"].map(k => (
                  <input key={k} data-testid={`branch-${k}-input`} value={form[k] || ""} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder={t(`merch.${k === "contact" ? "contact" : k === "name" ? "branch_name" : k}`) || k}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 placeholder:text-white/15 outline-none" />
                ))}
                <div className="flex gap-2">
                  <SaveBtn data-testid="save-branch-btn" onClick={createBranch} disabled={saving || !form.name} saving={saving} />
                  <CancelBtn onClick={() => { setShowAdd(""); setForm({}); }} />
                </div>
              </FormPanel>
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
                      <StatusBadge status={b.status} />
                    </div>
                  </div>
                </motion.div>
              ))}
              {branches.length === 0 && <Empty text={t("merch.no_branches") || "No branches yet"} />}
            </div>
          </>
        )}

        {/* ── BRANCH SUMMARY ── */}
        {tab === "branch-summary" && (
          <>
            <Panel title={t("merch.branch_comparison") || "Branch Comparison"}>
              {branchSummary.length === 0 ? <Empty text={t("merch.no_branches") || "No branches"} /> : (
                <div className="space-y-2">
                  {branchSummary.map((b, i) => {
                    const maxRev = Math.max(...branchSummary.map(x => x.total_revenue || 1), 1);
                    const pct = ((b.total_revenue || 0) / maxRev) * 100;
                    return (
                      <motion.div key={b.branch_id} data-testid={`summary-${b.branch_id}`} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.03)" }}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Store size={12} className="text-[#00E0FF]" />
                            <span className="text-[11px] font-bold text-white/80">{b.name}</span>
                            <span className="text-[8px] text-white/20">{b.city}</span>
                          </div>
                          <StatusBadge status={b.status} />
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.02] mb-2 overflow-hidden">
                          <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #00E89D, #00E0FF)" }}
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: i * 0.05 }} />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center">
                            <p className="text-[13px] font-black text-[#00E89D] font-mono">{(b.total_revenue || 0).toFixed(2)}</p>
                            <p className="text-[7px] text-white/15">{t("merch.total_rev") || "Revenue"}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[13px] font-black text-white/60 font-mono">{b.payment_count}</p>
                            <p className="text-[7px] text-white/15">{t("merch.payments") || "Payments"}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[13px] font-black text-[#00E0FF] font-mono">{b.active_registers}</p>
                            <p className="text-[7px] text-white/15">{t("merch.active_reg") || "Active Reg."}</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </>
        )}

        {/* ── REGISTERS ── */}
        {tab === "registers" && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">{t("merch.pos_registers") || "POS Registers"}</p>
              {branches.length > 0 && <AddBtn data-testid="add-register-btn" onClick={() => setShowAdd("register")} label={t("merch.add_register") || "Add Register"} />}
            </div>
            {showAdd === "register" && (
              <FormPanel>
                <select data-testid="register-branch-select" value={form.regBranch || ""} onChange={e => setForm(p => ({ ...p, regBranch: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 outline-none">
                  <option value="" style={{ background: "#111" }}>{t("merch.select_branch") || "Select Branch"}</option>
                  {branches.map(b => <option key={b.branch_id} value={b.branch_id} style={{ background: "#111" }}>{b.name}</option>)}
                </select>
                <input data-testid="register-label-input" value={form.regLabel || ""} onChange={e => setForm(p => ({ ...p, regLabel: e.target.value }))} placeholder={t("merch.register_label") || "Label"}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 placeholder:text-white/15 outline-none" />
                <div className="flex gap-2">
                  <SaveBtn data-testid="save-register-btn" onClick={() => createRegister(form.regBranch)} disabled={saving || !form.regBranch} saving={saving} label={t("common.create") || "Create"} />
                  <CancelBtn onClick={() => { setShowAdd(""); setForm({}); }} />
                </div>
              </FormPanel>
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
                    <motion.button onClick={() => toggleReg(r.device_id)} whileTap={{ scale: 0.9 }}
                      className={`px-2 py-1 rounded-lg text-[8px] font-bold ${r.status === "active" ? "bg-[#00E89D]/10 text-[#00E89D]" : "bg-[#FF4757]/10 text-[#FF4757]"}`}>
                      {r.status}
                    </motion.button>
                  </div>
                  <ApiKeyRow apiKey={r.api_key} deviceId={r.device_id} showKey={showKey} setShowKey={setShowKey} copyKey={copyKey} regenKey={regenKey} />
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[8px] text-white/15">{r.transaction_count || 0} txn</span>
                    <span className="text-[8px] text-white/15">{r.last_active?.slice(0, 16) || "—"}</span>
                    <span className="text-[9px] text-[#00E0FF] font-bold font-mono">{(r.total_revenue || 0).toFixed(2)}</span>
                  </div>
                </motion.div>
              ))}
              {registers.length === 0 && <Empty text={t("merch.no_registers") || "No registers"} />}
            </div>
          </>
        )}

        {/* ── REGISTER TRANSACTIONS ── */}
        {tab === "transactions" && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Filter size={12} className="text-white/20" />
              <div className="flex gap-1">
                {["today", "week", "month", "all"].map(p => (
                  <motion.button key={p} onClick={() => setTxnPeriod(p)} whileTap={{ scale: 0.95 }}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-semibold ${txnPeriod === p ? "bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20" : "text-[#444] bg-white/[0.01] border border-white/[0.03]"}`}>
                    {t(`merch.period_${p}`) || p}
                  </motion.button>
                ))}
              </div>
              {registers.length > 0 && (
                <select value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)}
                  className="px-2 py-1 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[9px] text-white/60 outline-none">
                  <option value="" style={{ background: "#111" }}>{t("merch.all_registers") || "All"}</option>
                  {registers.map(r => <option key={r.device_id} value={r.device_id} style={{ background: "#111" }}>{r.label || r.device_id}</option>)}
                </select>
              )}
            </div>
            {regTxns && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard val={regTxns.total_amount.toFixed(2)} label={t("merch.amount") || "Amount"} color="#00E89D" />
                  <StatCard val={regTxns.count} label={t("merch.txn_count") || "Count"} color="rgba(255,255,255,0.5)" />
                  <StatCard val={regTxns.total_fees.toFixed(2)} label={t("merch.total_fees") || "Fees"} color="#FFB800" />
                </div>
                <Panel title={`${regTxns.count} ${t("merch.txns") || "Transactions"}`}>
                  <div className="max-h-72 overflow-y-auto space-y-1">
                    {(regTxns.transactions || []).map((tx, i) => (
                      <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/[0.02]">
                        <Zap size={9} className="text-[#00E89D]" />
                        <span className="text-[9px] text-white/30 flex-1 truncate">{tx.description}</span>
                        <span className="text-[8px] text-white/15 font-mono">{tx.device_id}</span>
                        <span className="text-[10px] text-[#00E0FF] font-bold font-mono">{tx.amount.toFixed(2)}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${tx.status === "completed" ? "bg-[#00E89D]/10 text-[#00E89D]" : "bg-[#FFB800]/10 text-[#FFB800]"}`}>{tx.status}</span>
                        <span className="text-[7px] text-white/10">{tx.created_at?.slice(11, 19)}</span>
                      </div>
                    ))}
                    {(regTxns.transactions || []).length === 0 && <Empty text={t("merch.no_txns") || "No transactions"} />}
                  </div>
                </Panel>
              </>
            )}
          </>
        )}

        {/* ── COMMISSION ── */}
        {tab === "commission" && commData && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <StatCard val={`${commData.commission_rate || 0}%`} label={t("merch.rate") || "Rate"} color="#FFB800" />
              <StatCard val={(commData.total_commission || 0).toFixed(2)} label={t("merch.total_commission") || "Total Commission"} color="#FF6B6B" />
            </div>
            <Panel title={t("merch.commission_by_branch") || "Commission by Branch"}>
              {Object.keys(commData.branch_commissions || {}).length === 0 ? <Empty /> : (
                <div className="space-y-1.5">
                  {Object.entries(commData.branch_commissions || {}).map(([bid, fee]) => {
                    const br = branches.find(b => b.branch_id === bid);
                    return (
                      <div key={bid} className="flex items-center gap-2 py-1">
                        <Store size={10} className="text-[#00E0FF]" />
                        <span className="text-[10px] text-white/50 flex-1">{br?.name || bid.slice(0, 8)}</span>
                        <span className="text-[10px] text-[#FFB800] font-bold font-mono">{fee.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
            <Panel title={t("merch.commission_by_register") || "Commission by Register"}>
              {Object.keys(commData.register_commissions || {}).length === 0 ? <Empty /> : (
                <div className="space-y-1.5">
                  {Object.entries(commData.register_commissions || {}).map(([did, fee]) => {
                    const reg = registers.find(r => r.device_id === did);
                    return (
                      <div key={did} className="flex items-center gap-2 py-1">
                        <Monitor size={10} className="text-[#A855F7]" />
                        <span className="text-[10px] text-white/50 flex-1">{reg?.label || did}</span>
                        <span className="text-[10px] text-[#FFB800] font-bold font-mono">{fee.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </>
        )}

        {/* ── API KEYS ── */}
        {tab === "api-keys" && (
          <>
            <Panel title={t("merch.api_key_mgmt") || "API Key Management"}>
              {apiKeys.length === 0 ? <Empty text={t("merch.no_keys") || "No API keys"} /> : (
                <div className="space-y-2.5">
                  {apiKeys.map((k, i) => (
                    <motion.div key={k.device_id} data-testid={`apikey-${k.device_id}`} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.03)" }}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Key size={12} className={k.status === "active" ? "text-[#00E89D]" : "text-[#FF4757]"} />
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-white/70">{k.label || k.device_id}</p>
                          <p className="text-[8px] text-white/20">{k.branch_name} · {k.device_id}</p>
                        </div>
                        <motion.button onClick={() => toggleReg(k.device_id)} whileTap={{ scale: 0.9 }}
                          className={`px-2 py-0.5 rounded text-[7px] font-bold ${k.status === "active" ? "bg-[#00E89D]/10 text-[#00E89D]" : "bg-[#FF4757]/10 text-[#FF4757]"}`}>
                          {k.status}
                        </motion.button>
                      </div>
                      <ApiKeyRow apiKey={k.api_key} deviceId={k.device_id} showKey={showKey} setShowKey={setShowKey} copyKey={copyKey} regenKey={regenKey} />
                      <div className="flex items-center justify-between mt-1.5 text-[8px] text-white/15">
                        <span>{t("merch.last_active") || "Last"}: {k.last_active?.slice(0, 16) || "—"}</span>
                        <span>{k.transaction_count} txn · {(k.total_revenue || 0).toFixed(2)}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </Panel>
          </>
        )}

        {/* ── STAFF ── */}
        {tab === "staff" && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">{t("merch.staff_members") || "Staff"}</p>
              {branches.length > 0 && <AddBtn data-testid="add-staff-btn" onClick={() => setShowAdd("staff")} label={t("merch.add_staff") || "Add Staff"} />}
            </div>
            {showAdd === "staff" && (
              <FormPanel>
                <select value={form.staffBranch || ""} onChange={e => setForm(p => ({ ...p, staffBranch: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 outline-none">
                  <option value="" style={{ background: "#111" }}>{t("merch.select_branch") || "Select Branch"}</option>
                  {branches.map(b => <option key={b.branch_id} value={b.branch_id} style={{ background: "#111" }}>{b.name}</option>)}
                </select>
                <input data-testid="staff-email-input" value={form.staffEmail || ""} onChange={e => setForm(p => ({ ...p, staffEmail: e.target.value }))} placeholder={t("merch.staff_email") || "Email"}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 placeholder:text-white/15 outline-none" />
                <select data-testid="staff-role-select" value={form.staffRole || "staff"} onChange={e => setForm(p => ({ ...p, staffRole: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 outline-none">
                  <option value="branch_admin" style={{ background: "#111" }}>Branch Admin</option>
                  <option value="cashier" style={{ background: "#111" }}>Cashier</option>
                  <option value="staff" style={{ background: "#111" }}>Staff</option>
                </select>
                <div className="flex gap-2">
                  <SaveBtn data-testid="save-staff-btn" onClick={() => addStaff(form.staffBranch)} disabled={saving || !form.staffEmail || !form.staffBranch} saving={saving} label={t("common.add") || "Add"} />
                  <CancelBtn onClick={() => { setShowAdd(""); setForm({}); }} />
                </div>
              </FormPanel>
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
                    <StatusBadge status={s.status} />
                  </div>
                </motion.div>
              ))}
              {staff.length === 0 && <Empty text={t("merch.no_staff") || "No staff"} />}
            </div>
          </>
        )}

        {/* ── REVENUE (Live) ── */}
        {tab === "revenue" && revenue && (
          <>
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
              <StatCard val={revenue.total_revenue.toFixed(2)} label={t("merch.total_rev") || "Revenue"} color="#00E89D" />
              <StatCard val={revenue.total_transactions} label={t("merch.payments") || "Payments"} color="rgba(255,255,255,0.5)" />
            </div>
            <Panel title={t("merch.live_registers") || "Live Registers"}>
              <div className="flex items-center justify-between mb-1.5">
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
            </Panel>
            <Panel title={t("merch.latest_txns") || "Latest Transactions"}>
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
            </Panel>
          </>
        )}

        {/* ── REPORTS ── */}
        {tab === "reports" && (
          <>
            {/* Daily Report */}
            <Panel title={t("merch.daily_report") || "Daily Report"}>
              {dailyReport ? (
                <div className="space-y-2">
                  <p className="text-[8px] text-white/15">{dailyReport.date}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <StatCard val={dailyReport.total_amount?.toFixed(2) || "0"} label={t("merch.total_rev") || "Revenue"} color="#00E89D" />
                    <StatCard val={dailyReport.total_fees?.toFixed(2) || "0"} label={t("merch.total_fees") || "Fees"} color="#FFB800" />
                    <StatCard val={dailyReport.total_net?.toFixed(2) || "0"} label={t("merch.total_net") || "Net"} color="#00E0FF" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="text-center p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.01)" }}>
                      <p className="text-[14px] font-bold text-white/60 font-mono">{dailyReport.total_transactions}</p>
                      <p className="text-[7px] text-white/15">{t("merch.txns") || "Transactions"}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.01)" }}>
                      <p className="text-[14px] font-bold text-white/60 font-mono">{dailyReport.avg_transaction?.toFixed(2) || "0"}</p>
                      <p className="text-[7px] text-white/15">{t("merch.avg_txn") || "Avg Transaction"}</p>
                    </div>
                  </div>
                  {dailyReport.method_breakdown && Object.keys(dailyReport.method_breakdown).length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[8px] text-white/15 uppercase">{t("merch.by_method") || "By Payment Method"}</p>
                      {Object.entries(dailyReport.method_breakdown).map(([m, d]) => (
                        <div key={m} className="flex items-center justify-between py-1 px-2 rounded-lg" style={{ background: "rgba(255,255,255,0.01)" }}>
                          <span className="text-[9px] text-white/30">{m.replace("_", " ")}</span>
                          <span className="text-[9px] text-[#00E0FF] font-mono">{d.count}x · {d.amount.toFixed(2)} EUR</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : <Empty text={t("merch.no_data") || "No data"} />}
            </Panel>

            {/* Monthly Report */}
            <Panel title={t("merch.monthly_report") || "Monthly Report"}>
              {monthlyReport ? (
                <div className="space-y-2">
                  <p className="text-[8px] text-white/15">{monthlyReport.year}-{String(monthlyReport.month).padStart(2, "0")}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <StatCard val={monthlyReport.total_amount?.toFixed(2) || "0"} label={t("merch.total_rev") || "Revenue"} color="#00E89D" />
                    <StatCard val={monthlyReport.total_fees?.toFixed(2) || "0"} label={t("merch.total_fees") || "Fees"} color="#FFB800" />
                    <StatCard val={monthlyReport.total_net?.toFixed(2) || "0"} label={t("merch.total_net") || "Net"} color="#00E0FF" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="text-center p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.01)" }}>
                      <p className="text-[14px] font-bold text-white/60 font-mono">{monthlyReport.total_transactions}</p>
                      <p className="text-[7px] text-white/15">{t("merch.txns") || "Transactions"}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.01)" }}>
                      <p className="text-[14px] font-bold text-white/60 font-mono">{monthlyReport.avg_transaction?.toFixed(2) || "0"}</p>
                      <p className="text-[7px] text-white/15">{t("merch.avg_txn") || "Avg Transaction"}</p>
                    </div>
                  </div>
                  {monthlyReport.best_day && (
                    <p className="text-[8px] text-[#00E0FF]/40 mt-1">{t("merch.best_day") || "Best day"}: {monthlyReport.best_day}</p>
                  )}
                </div>
              ) : <Empty text={t("merch.no_data") || "No data"} />}
            </Panel>
          </>
        )}

        {/* ── SHIFTS ── */}
        {tab === "shifts" && (
          <>
            {/* Active Shift */}
            <Panel title={t("merch.current_shift") || "Current Shift"}>
              {activeShift ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#00E89D] animate-pulse" />
                    <span className="text-[10px] text-[#00E89D] font-bold">{t("merch.shift_open") || "Shift Open"}</span>
                    <span className="text-[8px] text-white/20 ml-auto">{activeShift.opened_at?.slice(11, 19)}</span>
                  </div>
                  <motion.button
                    data-testid="close-shift-btn"
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await api.closeShift({ notes: "Closed from dashboard" });
                        api.getShifts().then(d => setShifts(d.shifts || []));
                        setActiveShift(null);
                      } catch {
      // noop
    }
                      setSaving(false);
                    }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full py-2 rounded-lg text-[10px] font-bold"
                    style={{ background: "rgba(255,71,87,0.06)", border: "1px solid rgba(255,71,87,0.12)", color: "#FF4757" }}
                  >
                    {saving ? <Loader2 size={12} className="animate-spin mx-auto" /> : (t("merch.close_shift") || "Close Shift")}
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] text-white/20">{t("merch.no_active_shift") || "No active shift"}</p>
                  <motion.button
                    data-testid="open-shift-btn"
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const res = await api.openShift({ opening_balance: 0, notes: "Dashboard shift" });
                        setActiveShift(res.shift);
                        api.getShifts().then(d => setShifts(d.shifts || []));
                      } catch {
      // noop
    }
                      setSaving(false);
                    }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full py-2 rounded-lg text-[10px] font-bold"
                    style={{ background: "rgba(0,232,157,0.06)", border: "1px solid rgba(0,232,157,0.12)", color: "#00E89D" }}
                  >
                    {saving ? <Loader2 size={12} className="animate-spin mx-auto" /> : (t("merch.open_shift") || "Open Shift")}
                  </motion.button>
                </div>
              )}
            </Panel>

            {/* Shift History */}
            <Panel title={t("merch.shift_history") || "Shift History"}>
              {shifts.length > 0 ? shifts.map((s, i) => (
                <div key={i} className="py-2 border-b border-white/[0.02] last:border-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-bold ${s.status === "open" ? "bg-[#00E89D]/10 text-[#00E89D]" : "bg-white/5 text-white/20"}`}>{s.status}</span>
                      <span className="text-[8px] text-white/20 ml-2">{s.user_name}</span>
                    </div>
                    <span className="text-[10px] text-[#00E0FF] font-mono font-bold">{(s.total_sales || 0).toFixed(2)} EUR</span>
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[7px] text-white/10">{t("merch.opened") || "Opened"}: {s.opened_at?.slice(11, 16)}</span>
                    {s.closed_at && <span className="text-[7px] text-white/10">{t("merch.closed") || "Closed"}: {s.closed_at?.slice(11, 16)}</span>}
                    <span className="text-[7px] text-white/10">{s.transaction_count || 0} txns</span>
                  </div>
                </div>
              )) : <Empty text={t("merch.no_shifts") || "No shifts yet"} />}
            </Panel>
          </>
        )}

        {/* ── REFUNDS ── */}
        {tab === "refunds" && (
          <>
            <Panel title={t("merch.refunds") || "Refunds"}>
              {refunds.length > 0 ? refunds.map((r, i) => (
                <div key={i} className="py-2 border-b border-white/[0.02] last:border-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#FF4757] font-bold">-{(r.refund_amount || r.amount || 0).toFixed(2)} EUR</span>
                      <span className="text-[8px] text-white/15 ml-2">{r.customer_name || "?"}</span>
                    </div>
                    <span className="text-[7px] text-white/15">{r.refunded_at?.slice(0, 10)}</span>
                  </div>
                  <p className="text-[8px] text-white/10 mt-0.5">{t("merch.reason") || "Reason"}: {r.refund_reason || "—"}</p>
                </div>
              )) : <Empty text={t("merch.no_refunds") || "No refunds yet"} />}
            </Panel>
          </>
        )}

        {/* ── PAY KEYS (BidBlitz Pay SDK) ── */}
        {tab === "pay-keys" && (
          <>
            {payRevenue && (
              <div className="grid grid-cols-2 gap-2">
                <StatCard val={payRevenue.total_paid.toFixed(2)} label="Pay SDK Umsatz" color="#00E89D" />
                <StatCard val={payRevenue.total_sessions} label="Pay Sessions" color="rgba(255,255,255,0.5)" />
              </div>
            )}
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">BidBlitz Pay Keys</p>
              <AddBtn data-testid="create-pay-key-btn" onClick={() => setShowAdd("pay-key")} label="Key erstellen" />
            </div>
            {showAdd === "pay-key" && (
              <FormPanel>
                <input data-testid="pay-key-label-input" value={form.payKeyLabel || ""} onChange={e => setForm(p => ({ ...p, payKeyLabel: e.target.value }))} placeholder="Key Label (z.B. Website Checkout)"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 placeholder:text-white/15 outline-none" />
                <div className="flex gap-2">
                  <SaveBtn data-testid="save-pay-key-btn" onClick={async () => {
                    setSaving(true);
                    try {
                      const res = await api.createPayKey(form.payKeyLabel || "Default");
                      setCreatedKey(res.keys);
                      setShowAdd("");
                      setForm({});
                      api.getMyPayKeys().then(d => {
                        setPayKeys(d.keys || []);
                        const paid = (d.keys || []).reduce((sum, k) => sum + (k.total_paid || 0), 0);
                        const total = (d.keys || []).reduce((sum, k) => sum + (k.total_sessions || 0), 0);
                        setPayRevenue({ total_paid: paid, total_sessions: total });
                      });
                    } catch {
      // noop
    } setSaving(false);
                  }} disabled={saving} saving={saving} />
                  <CancelBtn onClick={() => { setShowAdd(""); setForm({}); }} />
                </div>
              </FormPanel>
            )}
            {createdKey && (
              <motion.div data-testid="pay-key-success" className="rounded-2xl p-4 mb-3" style={{ background: "rgba(0,232,157,0.05)", border: "1px solid rgba(0,232,157,0.15)" }}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="flex items-center gap-2 mb-3">
                  <Check size={14} className="text-[#00E89D]" />
                  <span className="text-[12px] font-bold text-[#00E89D]">Key erstellt! Speichere Secret sofort ab.</span>
                  <motion.button onClick={() => setCreatedKey(null)} whileTap={{ scale: 0.9 }} className="ml-auto"><X size={14} className="text-white/20" /></motion.button>
                </div>
                <div className="space-y-2 text-[10px]">
                  <div>
                    <p className="text-white/30 mb-1">Public Key (embed in frontend)</p>
                    <div className="flex items-center gap-2 bg-black/20 rounded-lg px-2 py-1.5">
                      <code className="text-[#00E0FF] flex-1 font-mono text-[9px] break-all">{createdKey.public_key}</code>
                      <motion.button onClick={() => copyKey(createdKey.public_key)} whileTap={{ scale: 0.9 }} className="p-1"><Copy size={11} className="text-[#00E0FF]" /></motion.button>
                    </div>
                  </div>
                  <div>
                    <p className="text-white/30 mb-1">Secret Key (backend only, einmalig sichtbar)</p>
                    <div className="flex items-center gap-2 bg-black/20 rounded-lg px-2 py-1.5">
                      <code className="text-[#FFB800] flex-1 font-mono text-[9px] break-all">{createdKey.secret_key}</code>
                      <motion.button onClick={() => copyKey(createdKey.secret_key)} whileTap={{ scale: 0.9 }} className="p-1"><Copy size={11} className="text-[#FFB800]" /></motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            <Panel title={`Keys (${payKeys.length}/5)`}>
              {payKeys.length > 0 ? payKeys.map((k, i) => (
                <motion.div key={k.key_id} data-testid={`pay-key-${k.key_id}`} className="py-2.5 border-b border-white/[0.02] last:border-0" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Wallet size={12} className={k.revoked ? "text-[#FF4757]" : "text-[#00E89D]"} />
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-white/80">{k.label}</p>
                      <code className="text-[8px] text-white/20 font-mono">{k.public_key}</code>
                    </div>
                    {!k.revoked ? (
                      <motion.button onClick={async () => {
                        if (!window.confirm(`Key "${k.label}" widerrufen?`)) return;
                        try {
                          await api.revokePayKey(k.key_id);
                          api.getMyPayKeys().then(d => {
                            setPayKeys(d.keys || []);
                            const paid = (d.keys || []).reduce((sum, k) => sum + (k.total_paid || 0), 0);
                            const total = (d.keys || []).reduce((sum, k) => sum + (k.total_sessions || 0), 0);
                            setPayRevenue({ total_paid: paid, total_sessions: total });
                          });
                        } catch {
      // noop
    }
                      }} whileTap={{ scale: 0.9 }} className="px-2 py-0.5 rounded text-[7px] font-bold bg-[#FF4757]/10 text-[#FF4757] border border-[#FF4757]/20">
                        Widerrufen
                      </motion.button>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[7px] font-bold bg-[#FF4757]/10 text-[#FF4757]">Revoked</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[8px] text-white/15">
                    <span>{k.total_sessions} sessions</span>
                    <span className="text-[#00E0FF] font-mono font-bold">{(k.total_paid || 0).toFixed(2)} EUR</span>
                  </div>
                </motion.div>
              )) : <Empty text="Noch keine Keys erstellt" />}
            </Panel>
            <Panel title={`Letzte Sessions (${paySessions.length})`}>
              {paySessions.length > 0 ? (
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {paySessions.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/[0.02]">
                      <div className={`w-2 h-2 rounded-full ${s.status === "paid" ? "bg-[#00E89D]" : s.status === "pending" ? "bg-[#FFB800]" : "bg-[#FF4757]"}`} />
                      <span className="text-[9px] text-white/30 flex-1 truncate">{s.description || s.order_id || s.session_id.slice(0, 16)}</span>
                      <span className="text-[10px] text-white/70 font-mono font-bold">{s.amount.toFixed(2)}</span>
                      <span className="text-[7px] text-white/10">{s.created_at?.slice(0, 16)}</span>
                    </div>
                  ))}
                </div>
              ) : <Empty text="Noch keine Transaktionen" />}
            </Panel>
          </>
        )}

        {tab === "invoice-links" && (
          <>
            <Panel title="Smart Invoice & Payment Links">
              {invoiceLinks.length > 0 ? invoiceLinks.map((inv, i) => (
                <motion.div key={inv.invoice_id} data-testid={`merchant-invoice-link-${inv.invoice_id}`} className="py-3 border-b border-white/[0.02] last:border-0" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-cyan-400/10 border border-cyan-400/20"><QrCode size={16} className="text-cyan-200" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-white/85">{inv.invoice_number}</p>
                      <p className="text-[9px] text-white/35">{inv.client_name} · €{Number(inv.total || 0).toFixed(2)}</p>
                      <p className="text-[8px] text-white/20 break-all mt-1">{inv.public_pay_url}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <motion.button onClick={() => navigator.clipboard.writeText(inv.public_pay_url || "").catch(() => undefined)} whileTap={{ scale: 0.95 }} className="px-2 py-1 rounded-lg text-[8px] font-bold bg-white/[0.04] border border-white/[0.06] text-white/75" data-testid={`merchant-invoice-copy-${inv.invoice_id}`}>
                          <Copy size={10} className="inline mr-1" /> Copy Link
                        </motion.button>
                        <motion.button onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/invoicing/${inv.invoice_id}/payment-pdf`, "_blank", "noopener,noreferrer")} whileTap={{ scale: 0.95 }} className="px-2 py-1 rounded-lg text-[8px] font-bold bg-orange-400/10 border border-orange-400/20 text-orange-100" data-testid={`merchant-invoice-pdf-${inv.invoice_id}`}>
                          <ExternalLink size={10} className="inline mr-1" /> PDF / QR
                        </motion.button>
                        <motion.button onClick={() => window.open(`mailto:?subject=${encodeURIComponent(`Zahlungslink ${inv.invoice_number}`)}&body=${encodeURIComponent(inv.public_pay_url || "")}`)} whileTap={{ scale: 0.95 }} className="px-2 py-1 rounded-lg text-[8px] font-bold bg-cyan-400/10 border border-cyan-400/20 text-cyan-100" data-testid={`merchant-invoice-email-${inv.invoice_id}`}>
                          <Mail size={10} className="inline mr-1" /> Send Link
                        </motion.button>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[7px] font-bold ${inv.status === "paid" ? "bg-[#00E89D]/10 text-[#00E89D]" : "bg-[#FFB800]/10 text-[#FFB800]"}`}>{inv.status}</span>
                  </div>
                </motion.div>
              )) : <Empty text="Noch keine Invoice Links verfügbar" />}
            </Panel>
          </>
        )}

      </div>
    </motion.div>
  );
};

// ── Shared micro-components ──
const Panel = ({ title, children }) => (
  <motion.div className={`rounded-2xl p-3 backdrop-blur-xl`} style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.04)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
    {title && <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-2">{title}</p>}
    {children}
  </motion.div>
);
const StatCard = ({ val, label, color }) => (
  <motion.div className="rounded-2xl p-3 text-center backdrop-blur-xl" style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.04)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
    <p className="text-[16px] font-black font-mono" style={{ color }}>{val}</p>
    <p className="text-[8px] text-white/20 mt-0.5">{label}</p>
  </motion.div>
);
const Empty = ({ text }) => <p className="text-[10px] text-white/15 text-center py-4">{text || "—"}</p>;
const StatusBadge = ({ status }) => (
  <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-bold ${status === "active" ? "bg-[#00E89D]/10 text-[#00E89D]" : "bg-[#FF4757]/10 text-[#FF4757]"}`}>{status}</span>
);
const AddBtn = ({ onClick, label, ...rest }) => (
  <motion.button {...rest} onClick={onClick} whileTap={{ scale: 0.9 }}
    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold" style={{ background: "rgba(0,224,255,0.06)", border: "1px solid rgba(0,224,255,0.12)", color: "#00E0FF" }}>
    <Plus size={10} /> {label}
  </motion.button>
);
const FormPanel = ({ children }) => (
  <motion.div className="rounded-2xl p-4 backdrop-blur-xl space-y-2" style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(0,224,255,0.08)" }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
    {children}
  </motion.div>
);
const SaveBtn = ({ onClick, disabled, saving, label, ...rest }) => (
  <motion.button {...rest} onClick={onClick} disabled={disabled} whileTap={{ scale: 0.95 }}
    className="flex-1 py-2 rounded-lg text-[10px] font-bold" style={{ background: "rgba(0,232,157,0.08)", border: "1px solid rgba(0,232,157,0.15)", color: "#00E89D" }}>
    {saving ? <Loader2 size={12} className="animate-spin mx-auto" /> : (label || "Save")}
  </motion.button>
);
const CancelBtn = ({ onClick }) => (
  <motion.button onClick={onClick} whileTap={{ scale: 0.95 }}
    className="px-4 py-2 rounded-lg text-[10px] font-bold text-white/20 bg-white/[0.02] border border-white/[0.04]">Cancel</motion.button>
);
const ApiKeyRow = ({ apiKey, deviceId, showKey, setShowKey, copyKey, regenKey }) => (
  <div className="flex items-center gap-1.5 bg-white/[0.01] rounded-lg px-2 py-1.5">
    <Key size={10} className="text-white/15" />
    <span className="text-[8px] text-white/20 font-mono flex-1 truncate">{showKey[deviceId] || apiKey?.slice(0, 20) + "..."}</span>
    <motion.button onClick={() => setShowKey(p => ({ ...p, [deviceId]: p[deviceId] ? null : apiKey }))} whileTap={{ scale: 0.9 }} className="p-1">
      {showKey[deviceId] ? <EyeOff size={10} className="text-white/20" /> : <Eye size={10} className="text-white/20" />}
    </motion.button>
    <motion.button onClick={() => copyKey(apiKey)} whileTap={{ scale: 0.9 }} className="p-1"><Copy size={10} className="text-white/20" /></motion.button>
    <motion.button onClick={() => regenKey(deviceId)} whileTap={{ scale: 0.9 }} className="p-1"><RefreshCw size={10} className="text-[#FFB800]" /></motion.button>
  </div>
);

export default MerchantDashboardPage;
