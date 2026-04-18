/**
 * BidBlitz V2 - Admin SMM Dashboard
 * Live JAP Balance, Order History with Profit Calculation, Sync & Service Mapping
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, TrendingUp, DollarSign, Package, Zap,
  CheckCircle2, AlertCircle, Clock, XCircle, ExternalLink, Loader2
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

// USD → EUR approx (JAP rates are in USD)
const USD_TO_EUR = 0.92;

// Estimated provider cost per 1000 units (from live JAP data 2026-04-18)
const JAP_COST_PER_1K_EUR = {
  ig_followers_1k: 0.46, ig_followers_premium: 2.30, ig_followers_real: 7.01,
  ig_likes_1k: 0.14, ig_likes_power: 0.28, ig_views_1k: 0.006,
  ig_story_views: 0.003, ig_comments: 0.78, ig_saves: 0.002, ig_impressions: 0.012,
  tt_followers_1k: 0.67, tt_followers_real: 1.84, tt_likes_1k: 0.014,
  tt_views_1k: 0.012, tt_shares: 0.011, tt_comments: 0.81, tt_live_views: 0.014,
  yt_subs_1k: 2.88, yt_subs_real: 2.88, yt_views_1k: 0.48,
  yt_views_retention: 0.05, yt_likes_1k: 0.59, yt_watch_hours: 4.74,
  yt_comments: 3.58, yt_shorts_views: 0.59,
  tw_followers_1k: 0.04, tw_followers_real: 0.04, tw_likes_1k: 0.10, tw_retweets: 0.12,
};

const calcProfit = (order) => {
  const costPer1k = JAP_COST_PER_1K_EUR[order.service_id] ?? 0;
  const qty = order.total_quantity || order.quantity || 0;
  const cost = (qty / 1000) * costPer1k;
  const revenue = order.total_price || 0;
  return { cost, revenue, profit: revenue - cost };
};

const statusConfig = {
  pending: { color: "#FFB800", icon: Clock, label: "Ausstehend" },
  in_progress: { color: "#00C2FF", icon: Zap, label: "In Bearbeitung" },
  processing: { color: "#00C2FF", icon: Zap, label: "Wird verarbeitet" },
  completed: { color: "#00D26A", icon: CheckCircle2, label: "Abgeschlossen" },
  canceled: { color: "#FF4757", icon: XCircle, label: "Abgebrochen" },
  provider_failed: { color: "#FF4757", icon: AlertCircle, label: "Provider-Fehler" },
  delayed: { color: "#A855F7", icon: Clock, label: "Verzögert" },
};

export const AdminSMMPage = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [providerStatus, setProviderStatus] = useState(null);
  const [balance, setBalance] = useState(null);
  const [orders, setOrders] = useState([]);
  const [syncingId, setSyncingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [statusRes, balRes, ordersRes] = await Promise.all([
        fetch(`${API}/api/smm/admin/provider/status`, { credentials: "include" }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API}/api/smm/admin/provider/balance`, { credentials: "include" }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API}/api/smm/admin/orders?limit=50`, { credentials: "include" }).then(r => r.ok ? r.json() : { orders: [] }).catch(() => ({ orders: [] })),
      ]);
      setProviderStatus(statusRes);
      setBalance(balRes);
      setOrders(ordersRes.orders || []);
    } catch (err) {
      toast.error("Fehler beim Laden: " + err.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const syncOrder = async (orderId) => {
    setSyncingId(orderId);
    try {
      const res = await fetch(`${API}/api/smm/admin/orders/${orderId}/sync`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Sync fehlgeschlagen");
      toast.success(`Status synchronisiert: ${data.provider_status || "?"}`);
      await loadAll();
    } catch (err) {
      toast.error(err.message);
    }
    setSyncingId(null);
  };

  // Aggregate profit stats
  const stats = orders.reduce(
    (acc, o) => {
      const { cost, revenue, profit } = calcProfit(o);
      acc.totalRevenue += revenue;
      acc.totalCost += cost;
      acc.totalProfit += profit;
      if (o.status === "completed") acc.completedCount += 1;
      if (o.status === "pending" || o.status === "in_progress") acc.activeCount += 1;
      return acc;
    },
    { totalRevenue: 0, totalCost: 0, totalProfit: 0, completedCount: 0, activeCount: 0 }
  );

  const balanceUSD = parseFloat(balance?.balance || 0);
  const balanceEUR = balanceUSD * USD_TO_EUR;

  return (
    <div data-testid="admin-smm-page" className="min-h-screen pb-24" style={{ background: "#050505" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#050505]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3">
          <motion.button
            data-testid="admin-smm-back-btn"
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            whileTap={{ scale: 0.92 }}
          >
            <ArrowLeft size={15} className="text-white/70" />
          </motion.button>
          <h1 className="text-[15px] font-bold text-white">SMM Admin</h1>
          <motion.button
            data-testid="admin-smm-refresh-btn"
            onClick={loadAll}
            disabled={refreshing}
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            whileTap={{ scale: 0.92 }}
          >
            <RefreshCw size={14} className={`text-white/70 ${refreshing ? "animate-spin" : ""}`} />
          </motion.button>
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Provider Status */}
        <motion.div
          className="mb-4 p-4 rounded-2xl"
          style={{
            background: providerStatus?.configured
              ? "linear-gradient(135deg, rgba(0,210,106,0.08), rgba(0,194,255,0.05))"
              : "rgba(255,71,87,0.08)",
            border: `1px solid ${providerStatus?.configured ? "rgba(0,210,106,0.2)" : "rgba(255,71,87,0.2)"}`,
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: providerStatus?.configured ? "#00D26A" : "#FF4757",
                boxShadow: providerStatus?.configured ? "0 0 8px #00D26A" : "0 0 8px #FF4757",
              }}
            />
            <span className="text-[13px] font-semibold text-white">
              {providerStatus?.configured ? "JAP Provider verbunden" : "Provider nicht konfiguriert"}
            </span>
          </div>
          <p className="text-[11px] text-white/50 font-mono break-all">
            {providerStatus?.provider_url || "—"}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard
            label="JAP Guthaben"
            value={loading ? "…" : `$${balanceUSD.toFixed(2)}`}
            sub={`≈ €${balanceEUR.toFixed(2)}`}
            color="#FFB800"
            warning={balanceUSD < 5}
            icon={DollarSign}
          />
          <StatCard
            label="Gesamt-Gewinn"
            value={`€${stats.totalProfit.toFixed(2)}`}
            sub={`von €${stats.totalRevenue.toFixed(2)} Umsatz`}
            color="#00D26A"
            icon={TrendingUp}
          />
          <StatCard
            label="Aktive Orders"
            value={String(stats.activeCount)}
            sub={`${stats.completedCount} erledigt`}
            color="#00C2FF"
            icon={Package}
          />
          <StatCard
            label="Ø Marge"
            value={stats.totalCost > 0 ? `${((stats.totalProfit / stats.totalCost) * 100).toFixed(0)}%` : "—"}
            sub={`€${stats.totalCost.toFixed(2)} Kosten`}
            color="#A855F7"
            icon={Zap}
          />
        </div>

        {/* Low balance warning */}
        {providerStatus?.configured && balanceUSD < 5 && (
          <motion.a
            href="https://justanotherpanel.com/addfunds"
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-4 p-3 rounded-xl text-center"
            style={{
              background: "rgba(255,184,0,0.1)",
              border: "1px solid rgba(255,184,0,0.25)",
            }}
            whileTap={{ scale: 0.98 }}
          >
            <p className="text-[13px] font-semibold text-[#FFB800]">
              ⚠ JAP-Guthaben zu niedrig — Jetzt aufladen
            </p>
            <p className="text-[11px] text-[#FFB800]/70 mt-1">
              Öffnet justanotherpanel.com → Add Funds
            </p>
          </motion.a>
        )}

        {/* Orders Table */}
        <h2 className="text-[12px] font-semibold text-white/50 uppercase tracking-wider mt-6 mb-3">
          Letzte Bestellungen
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-white/40" />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center">
            <Package size={32} className="mx-auto text-white/20 mb-3" />
            <p className="text-[13px] text-white/50">Noch keine Bestellungen</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => {
              const { cost, revenue, profit } = calcProfit(o);
              const cfg = statusConfig[o.status] || statusConfig.pending;
              const StatusIcon = cfg.icon;
              return (
                <motion.div
                  key={o.order_id}
                  className="rounded-xl p-3"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <StatusIcon size={11} style={{ color: cfg.color }} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: cfg.color }}>
                          {cfg.label}
                        </span>
                        {o.provider_order_id && (
                          <span className="text-[9px] text-white/30 font-mono">
                            · JAP#{o.provider_order_id}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] font-semibold text-white truncate">{o.service_name}</p>
                      <p className="text-[11px] text-white/50 mt-0.5">
                        {(o.total_quantity || o.quantity).toLocaleString()}× · {o.user_email}
                      </p>
                    </div>
                    {o.provider_order_id && o.status !== "completed" && o.status !== "canceled" && (
                      <motion.button
                        data-testid={`sync-order-${o.order_id}`}
                        onClick={() => syncOrder(o.order_id)}
                        disabled={syncingId === o.order_id}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 flex-shrink-0"
                        style={{
                          background: "rgba(0,194,255,0.08)",
                          border: "1px solid rgba(0,194,255,0.2)",
                          color: "#00C2FF",
                        }}
                        whileTap={{ scale: 0.94 }}
                      >
                        {syncingId === o.order_id ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <>
                            <RefreshCw size={9} /> Sync
                          </>
                        )}
                      </motion.button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.04]">
                    <div>
                      <p className="text-[9px] text-white/40 uppercase tracking-wider font-semibold">Kosten</p>
                      <p className="text-[12px] font-bold text-[#FF4757]">€{cost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/40 uppercase tracking-wider font-semibold">Umsatz</p>
                      <p className="text-[12px] font-bold text-[#00C2FF]">€{revenue.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/40 uppercase tracking-wider font-semibold">Gewinn</p>
                      <p className="text-[12px] font-bold text-[#00D26A]">+€{profit.toFixed(2)}</p>
                    </div>
                  </div>

                  {o.provider_error && (
                    <p className="mt-2 text-[10px] text-[#FF4757] font-mono">
                      ❌ {o.provider_error}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* External links */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <a
            href="https://justanotherpanel.com/orders"
            target="_blank"
            rel="noopener noreferrer"
            className="py-3 rounded-xl text-[12px] font-semibold text-white/70 flex items-center justify-center gap-1.5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            JAP Dashboard <ExternalLink size={11} />
          </a>
          <a
            href="/smm-profit.html"
            target="_blank"
            rel="noopener noreferrer"
            className="py-3 rounded-xl text-[12px] font-semibold text-white/70 flex items-center justify-center gap-1.5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            Preis-Übersicht <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub, color, icon: Icon, warning }) => (
  <motion.div
    className="rounded-2xl p-4"
    style={{
      background: warning ? "rgba(255,71,87,0.05)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${warning ? "rgba(255,71,87,0.2)" : "rgba(255,255,255,0.05)"}`,
    }}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">{label}</span>
      <Icon size={12} style={{ color }} />
    </div>
    <p className="text-[20px] font-bold text-white tabular-nums">{value}</p>
    {sub && <p className="text-[10px] text-white/40 mt-0.5">{sub}</p>}
  </motion.div>
);

export default AdminSMMPage;
