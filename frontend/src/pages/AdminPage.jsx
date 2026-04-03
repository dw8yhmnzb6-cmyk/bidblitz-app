import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Users, Store, CreditCard, Shield, BarChart3,
  Download, Search, ChevronRight, Loader2, Check, X,
  Clock, AlertCircle, CircleDollarSign, Activity, Settings
} from "lucide-react";
import { useUser } from "../store";

const API = process.env.REACT_APP_BACKEND_URL;
const slide = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Request failed");
  return d;
}

const Skeleton = ({ className }) => (
  <div className={`relative overflow-hidden rounded-xl ${className}`} style={{ background: "rgba(255,255,255,0.025)" }}>
    <motion.div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)" }}
      animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
  </div>
);

const StatCard = ({ icon: Icon, label, value, sub, color, delay = 0 }) => (
  <motion.div className="rounded-2xl p-3.5 relative overflow-hidden"
    style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.04)" }}
    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, ...slide }}>
    <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full pointer-events-none" style={{ background: color, filter: "blur(30px)", opacity: 0.08 }} />
    <div className="flex items-center gap-1.5 mb-2 relative z-10">
      <Icon size={12} style={{ color }} />
      <span className="text-[8px] text-[#3A3A3A] uppercase tracking-[0.1em] font-semibold">{label}</span>
    </div>
    <p className="text-[15px] font-bold font-outfit text-white/90 relative z-10">{value}</p>
    {sub && <p className="text-[9px] text-[#333] font-medium mt-0.5 relative z-10">{sub}</p>}
  </motion.div>
);

const statusColors = { pending: "#FFB800", approved: "#00C2FF", processed: "#00D26A", failed: "#FF4757", cancelled: "#666", completed: "#00D26A" };

const tabs = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "merchants", label: "Merchants", icon: Store },
  { id: "payouts", label: "Payouts", icon: Download },
  { id: "transactions", label: "Txns", icon: CreditCard },
  { id: "settings", label: "Config", icon: Settings },
];

export const AdminPage = ({ onNavigate }) => {
  const user = useUser();
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [txns, setTxns] = useState([]);
  const [settings, setSettings] = useState(null);
  const [search, setSearch] = useState("");
  const [payoutFilter, setPayoutFilter] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const load = useCallback(async (t) => {
    setLoading(true);
    try {
      if (t === "overview") { const d = await api("/api/admin/overview"); setOverview(d); }
      if (t === "users") { const d = await api(`/api/admin/users?search=${encodeURIComponent(search)}`); setUsers(d.users); }
      if (t === "merchants") { const d = await api(`/api/admin/merchants?search=${encodeURIComponent(search)}`); setMerchants(d.merchants); }
      if (t === "payouts") { const d = await api(`/api/admin/payouts?status=${payoutFilter}`); setPayouts(d.payouts); }
      if (t === "transactions") { const d = await api(`/api/admin/transactions?search=${encodeURIComponent(search)}&limit=30`); setTxns(d.transactions); }
      if (t === "settings") { const d = await api("/api/admin/settings"); setSettings(d); }
    } catch {}
    setLoading(false);
  }, [search, payoutFilter]);

  useEffect(() => { load(tab); }, [tab, load]);

  const handlePayoutAction = async (ref, action) => {
    setActionLoading(ref);
    try {
      await api(`/api/admin/payouts/${ref}/action`, { method: "POST", body: JSON.stringify({ action }) });
      load("payouts");
    } catch {}
    setActionLoading(null);
  };

  if (user.role !== "admin") {
    return (
      <motion.div className="min-h-screen flex items-center justify-center" style={{ background: "#030303" }}>
        <div className="text-center">
          <Shield size={40} className="text-[#FF4757] mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">Access Denied</p>
          <p className="text-sm text-[#666]">Admin privileges required</p>
          <motion.button onClick={() => onNavigate("/")} className="mt-4 px-6 py-2 bg-white/5 text-white rounded-xl text-sm" whileTap={{ scale: 0.95 }}>Go Home</motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div data-testid="admin-page" className="min-h-screen relative" style={{ background: "#030303" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
        <motion.button data-testid="admin-back-btn" className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center" whileTap={{ scale: 0.88 }} onClick={() => onNavigate("/")}>
          <ArrowLeft size={15} strokeWidth={1.5} className="text-white/50" />
        </motion.button>
        <div>
          <h1 className="text-[15px] font-semibold font-outfit text-white tracking-tight">Admin Panel</h1>
          <p className="text-[10px] text-[#333] font-medium">Platform Control Center</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(255,71,87,0.06)", border: "1px solid rgba(255,71,87,0.12)" }}>
          <Shield size={10} className="text-[#FF4757]" />
          <span className="text-[9px] text-[#FF4757] font-bold uppercase tracking-[0.1em]">Admin</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="px-5 mb-4 relative z-10">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <motion.button key={t.id} onClick={() => setTab(t.id)} whileTap={{ scale: 0.95 }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all ${
                tab === t.id ? "bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20" : "bg-white/[0.02] text-[#444] border border-white/[0.04]"
              }`}>
              <t.icon size={12} /> {t.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-8 relative z-10">
        <AnimatePresence mode="wait">

          {/* ── Overview Tab ── */}
          {tab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading || !overview ? (
                <div className="grid grid-cols-2 gap-2.5">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-[80px]" />)}</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2.5 mb-5">
                    <StatCard icon={Users} label="Total Users" value={overview.total_users} sub={`+${overview.today_new_users} today`} color="#00C2FF" delay={0.06} />
                    <StatCard icon={Store} label="Merchants" value={overview.total_merchants} color="#A855F7" delay={0.08} />
                    <StatCard icon={CreditCard} label="Payment Volume" value={`\u20AC${overview.payment_volume.toLocaleString("de-DE",{minimumFractionDigits:2})}`} sub={`${overview.total_transactions} txns`} color="#00D26A" delay={0.10} />
                    <StatCard icon={CircleDollarSign} label="Fee Revenue" value={`\u20AC${overview.platform_fee_revenue.toLocaleString("de-DE",{minimumFractionDigits:2})}`} color="#FFB800" delay={0.12} />
                    <StatCard icon={Clock} label="Pending Payouts" value={overview.pending_payouts_count} sub={`\u20AC${overview.pending_payouts_amount.toFixed(2)}`} color="#FF6B6B" delay={0.14} />
                    <StatCard icon={Check} label="Processed Payouts" value={overview.processed_payouts_count} sub={`\u20AC${overview.processed_payouts_amount.toFixed(2)}`} color="#00D26A" delay={0.16} />
                  </div>
                  <motion.div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.03)" }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <h3 className="text-[11px] font-semibold text-[#444] uppercase tracking-[0.1em] mb-2">Today</h3>
                    <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                      <span className="text-[12px] text-white/60">Transactions</span>
                      <span className="text-[13px] font-semibold font-outfit text-white/80">{overview.today_transactions}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-[12px] text-white/60">New Users</span>
                      <span className="text-[13px] font-semibold font-outfit text-white/80">{overview.today_new_users}</span>
                    </div>
                  </motion.div>
                </>
              )}
            </motion.div>
          )}

          {/* ── Users Tab ── */}
          {tab === "users" && (
            <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <Search size={14} className="text-[#333]" />
                  <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load("users")}
                    placeholder="Search users..." className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-[#2A2A2A]" />
                </div>
                <motion.button onClick={() => load("users")} className="px-3 py-2.5 bg-[#00C2FF]/10 text-[#00C2FF] rounded-xl text-[11px] font-semibold" whileTap={{ scale: 0.95 }}>Search</motion.button>
              </div>
              {loading ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-[60px]" />)}</div> : (
                <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                  {users.map((u, i) => (
                    <div key={u.id} className={`flex items-center gap-3 px-4 py-3 ${i < users.length-1 ? "border-b border-white/[0.03]" : ""}`}>
                      <div className="w-8 h-8 rounded-full bg-[#00C2FF]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-[#00C2FF]">{u.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-medium text-white/90 truncate">{u.name}</p>
                          {u.role === "admin" && <span className="text-[7px] px-1.5 py-0.5 bg-[#FF4757]/10 text-[#FF4757] rounded-full font-bold uppercase">Admin</span>}
                        </div>
                        <p className="text-[10px] text-[#333] truncate">{u.email}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[12px] font-bold font-outfit text-white/80">&euro;{u.balance.toFixed(2)}</p>
                        <p className="text-[9px] text-[#333]">{u.transaction_count} txns</p>
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && <p className="text-center py-8 text-[12px] text-[#333]">No users found</p>}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Merchants Tab ── */}
          {tab === "merchants" && (
            <motion.div key="merchants" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-[70px]" />)}</div> : (
                <div className="space-y-2.5">
                  {merchants.map(m => (
                    <div key={m.id} className="rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                      <div className="flex items-center gap-2.5 mb-2">
                        <Store size={14} className="text-[#00D26A]" />
                        <span className="text-[12px] font-medium text-white/90 truncate flex-1">{m.business_name}</span>
                        <span className="text-[9px] text-[#333]">{m.total_transactions} txns</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div><p className="text-[8px] text-[#444] uppercase">Gross</p><p className="text-[11px] font-bold font-outfit text-white/80">&euro;{m.gross_earnings.toFixed(0)}</p></div>
                        <div><p className="text-[8px] text-[#444] uppercase">Net</p><p className="text-[11px] font-bold font-outfit text-[#00D26A]">&euro;{m.total_earnings.toFixed(0)}</p></div>
                        <div><p className="text-[8px] text-[#444] uppercase">Available</p><p className="text-[11px] font-bold font-outfit text-[#00C2FF]">&euro;{m.available_payout.toFixed(0)}</p></div>
                        <div><p className="text-[8px] text-[#444] uppercase">Pending</p><p className="text-[11px] font-bold font-outfit text-[#FFB800]">&euro;{m.pending_payout.toFixed(0)}</p></div>
                      </div>
                    </div>
                  ))}
                  {merchants.length === 0 && <p className="text-center py-8 text-[12px] text-[#333]">No merchants found</p>}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Payouts Tab ── */}
          {tab === "payouts" && (
            <motion.div key="payouts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar">
                {["", "pending", "approved", "processed", "failed", "cancelled"].map(s => (
                  <motion.button key={s} onClick={() => setPayoutFilter(s)} whileTap={{ scale: 0.95 }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap ${payoutFilter === s ? "bg-[#00C2FF]/10 text-[#00C2FF]" : "bg-white/[0.02] text-[#444]"}`}>
                    {s || "All"}
                  </motion.button>
                ))}
              </div>
              {loading ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-[70px]" />)}</div> : (
                <div className="space-y-2.5">
                  {payouts.map(po => (
                    <div key={po.reference} className="rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Download size={13} style={{ color: statusColors[po.status] }} />
                          <span className="text-[11px] font-medium text-white/90">{po.reference}</span>
                        </div>
                        <span className="text-[8px] uppercase font-bold tracking-[0.06em] px-2 py-0.5 rounded-full"
                          style={{ color: statusColors[po.status], background: `${statusColors[po.status]}10`, border: `1px solid ${statusColors[po.status]}15` }}>
                          {po.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-[#444]">{po.merchant_name}</span>
                        <span className="text-[14px] font-bold font-outfit text-white/90">&euro;{po.net_amount.toFixed(2)}</span>
                      </div>
                      {(po.status === "pending" || po.status === "approved") && (
                        <div className="flex gap-2 mt-2 pt-2 border-t border-white/[0.03]">
                          {po.status === "pending" && (
                            <motion.button onClick={() => handlePayoutAction(po.reference, "approve")} disabled={actionLoading === po.reference}
                              className="flex-1 py-2 bg-[#00C2FF]/10 text-[#00C2FF] rounded-lg text-[10px] font-semibold" whileTap={{ scale: 0.95 }}>
                              {actionLoading === po.reference ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Approve"}
                            </motion.button>
                          )}
                          {po.status === "approved" && (
                            <motion.button onClick={() => handlePayoutAction(po.reference, "process")} disabled={actionLoading === po.reference}
                              className="flex-1 py-2 bg-[#00D26A]/10 text-[#00D26A] rounded-lg text-[10px] font-semibold" whileTap={{ scale: 0.95 }}>
                              {actionLoading === po.reference ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Mark Processed"}
                            </motion.button>
                          )}
                          <motion.button onClick={() => handlePayoutAction(po.reference, po.status === "pending" ? "cancel" : "fail")} disabled={actionLoading === po.reference}
                            className="flex-1 py-2 bg-[#FF4757]/10 text-[#FF4757] rounded-lg text-[10px] font-semibold" whileTap={{ scale: 0.95 }}>
                            {po.status === "pending" ? "Cancel" : "Fail"}
                          </motion.button>
                        </div>
                      )}
                    </div>
                  ))}
                  {payouts.length === 0 && <p className="text-center py-8 text-[12px] text-[#333]">No payouts found</p>}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Transactions Tab ── */}
          {tab === "transactions" && (
            <motion.div key="txns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <Search size={14} className="text-[#333]" />
                  <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load("transactions")}
                    placeholder="Search ref / merchant..." className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-[#2A2A2A]" />
                </div>
                <motion.button onClick={() => load("transactions")} className="px-3 py-2.5 bg-[#00C2FF]/10 text-[#00C2FF] rounded-xl text-[11px] font-semibold" whileTap={{ scale: 0.95 }}>Go</motion.button>
              </div>
              {loading ? <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-[50px]" />)}</div> : (
                <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                  {txns.map((t, i) => (
                    <div key={`${t.id}-${i}`} className={`flex items-center gap-3 px-3.5 py-2.5 ${i < txns.length-1 ? "border-b border-white/[0.03]" : ""}`}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${t.amount > 0 ? "#00D26A" : "#FF4757"}08` }}>
                        <CreditCard size={11} style={{ color: t.amount > 0 ? "#00D26A" : "#FF4757" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-white/80 truncate">{t.reference || "-"}</span>
                          <span className="text-[7px] px-1.5 py-0.5 rounded-full font-bold uppercase"
                            style={{ color: statusColors[t.status] || "#666", background: `${statusColors[t.status] || "#666"}10` }}>{t.status}</span>
                        </div>
                        <p className="text-[9px] text-[#333] truncate">{t.type} · {t.merchant_name || t.description || "-"}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-[11px] font-bold font-outfit ${t.amount > 0 ? "text-[#00D26A]" : "text-white/80"}`}>
                          {t.amount > 0 ? "+" : ""}&euro;{Math.abs(t.amount).toFixed(2)}
                        </p>
                        {t.fee_amount > 0 && <p className="text-[8px] text-[#FFB800]">fee &euro;{t.fee_amount.toFixed(2)}</p>}
                      </div>
                    </div>
                  ))}
                  {txns.length === 0 && <p className="text-center py-8 text-[12px] text-[#333]">No transactions found</p>}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Settings Tab ── */}
          {tab === "settings" && (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading || !settings ? <Skeleton className="h-[200px]" /> : (
                <div className="space-y-4">
                  <motion.div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <h3 className="text-[11px] font-semibold text-[#444] uppercase tracking-[0.1em] mb-3">Fee Configuration</h3>
                    {[
                      { label: "Payment Fee", value: `${(settings.fees.payment * 100).toFixed(1)}%`, color: "#00C2FF" },
                      { label: "Send Fee", value: `${(settings.fees.send * 100).toFixed(1)}%`, color: "#A855F7" },
                      { label: "Top-up Fee", value: `${(settings.fees.topup * 100).toFixed(1)}%`, color: "#00D26A" },
                      { label: "Payout Flat Fee", value: `\u20AC${settings.fees.payout_flat.toFixed(2)}`, color: "#FFB800" },
                      { label: "Min Payout", value: `\u20AC${settings.fees.min_payout.toFixed(2)}`, color: "#FF6B6B" },
                      { label: "Settlement Delay", value: `${settings.fees.settlement_delay_hours}h`, color: "#888" },
                    ].map((row, i, arr) => (
                      <div key={row.label} className={`flex items-center justify-between py-2.5 ${i < arr.length-1 ? "border-b border-white/[0.03]" : ""}`}>
                        <span className="text-[12px] text-white/60">{row.label}</span>
                        <span className="text-[13px] font-bold font-outfit" style={{ color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                  </motion.div>
                  <motion.div className="rounded-2xl p-4" style={{ background: "rgba(255,71,87,0.02)", border: "1px solid rgba(255,71,87,0.08)" }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle size={12} className="text-[#FF6B6B]" />
                      <span className="text-[11px] text-[#FF6B6B] font-semibold">Server Config</span>
                    </div>
                    <p className="text-[10px] text-[#444]">Fee values are set in backend/core/config.py. Changes require a server restart to take effect.</p>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default AdminPage;
