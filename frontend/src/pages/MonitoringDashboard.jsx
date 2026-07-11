import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Activity, Server, Database, Clock, AlertTriangle, Users,
  Wifi, WifiOff, RefreshCw,
  TrendingUp, Zap, BarChart3, ChevronLeft, Shield,
  ArrowUp, ArrowDown, Bug, LogIn, Globe, Siren,
} from "lucide-react";
import { useI18n } from "../store/I18nContext";

const API = process.env.REACT_APP_BACKEND_URL;

const fetchApi = async (path, options = {}) => {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...options });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

const StatCard = ({ icon: Icon, label, value, sub, color = "#00C2FF", trend }) => (
  <motion.div
    className="rounded-2xl p-4"
    style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="flex items-start justify-between mb-2">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
        <Icon size={16} style={{ color }} />
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-0.5 text-[10px] font-bold ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {trend >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <p className="text-[20px] font-bold text-white tracking-tight">{value}</p>
    <p className="text-[11px] text-white/40 mt-0.5">{label}</p>
    {sub && <p className="text-[10px] text-white/25 mt-0.5">{sub}</p>}
  </motion.div>
);

const ProgressBar = ({ value, max, color = "#00C2FF", label, detail }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const warn = pct > 80;
  const crit = pct > 90;
  const barColor = crit ? "#EF4444" : warn ? "#F59E0B" : color;
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-[11px] text-white/60">{label}</span>
        <span className="text-[11px] font-mono" style={{ color: barColor }}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      {detail && <p className="text-[10px] text-white/25 mt-0.5">{detail}</p>}
    </div>
  );
};

const MiniChart = ({ data, color = "#00C2FF", height = 48 }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const w = 100 / data.length;
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {data.map((d, i) => (
        <motion.div
          key={i}
          className="rounded-sm flex-1"
          style={{ background: color, opacity: 0.7, minWidth: 4 }}
          initial={{ height: 0 }}
          animate={{ height: `${Math.max((d.count / max) * 100, 4)}%` }}
          transition={{ delay: i * 0.03, duration: 0.4 }}
        />
      ))}
    </div>
  );
};

const MonitoringDashboard = ({ onBack }) => {
  const { t, lang } = useI18n();
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [dbStats, setDbStats] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [errorCenter, setErrorCenter] = useState(null);
  const [runningChecks, setRunningChecks] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [h, m, d, u, ec] = await Promise.all([
        fetchApi("/api/admin/monitoring/health").catch(() => null),
        fetchApi("/api/admin/monitoring/metrics").catch(() => null),
        fetchApi("/api/admin/monitoring/db-stats").catch(() => null),
        fetchApi("/api/admin/monitoring/users-stats").catch(() => null),
        fetchApi("/api/admin/monitoring/error-center").catch(() => null),
      ]);
      if (h) setHealth(h);
      if (m) setMetrics(m);
      if (d) setDbStats(d);
      if (u) setUserStats(u);
      if (ec) setErrorCenter(ec);
      setError(null);
      setLastUpdate(new Date());
    } catch (e) {
      setError(t("monitor.connection_failed"));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(loadData, 15000);
    return () => clearInterval(iv);
  }, [autoRefresh, loadData]);

  const formatUptime = (sec) => {
    if (!sec) return "-";
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const sys = health?.system || {};
  const db_info = health?.database || {};

  const runChecks = async () => {
    setRunningChecks(true);
    try {
      await fetchApi("/api/admin/monitoring/run-probes", { method: "POST" });
      await loadData();
    } catch (e) {
      setError("Checks konnten nicht gestartet werden");
    }
    setRunningChecks(false);
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: "#030303" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between" style={{ background: "rgba(3,3,3,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
            <ChevronLeft size={16} className="text-white/60" />
          </motion.button>
          <div>
            <h1 className="text-[15px] font-bold text-white flex items-center gap-2">
              <Activity size={14} className="text-emerald-400" /> {t("monitor.title")}
            </h1>
            {lastUpdate && <p className="text-[10px] text-white/30">{t("monitor.updated")}: {lastUpdate.toLocaleTimeString(lang === "de" ? "de-DE" : lang === "sq" ? "sq-AL" : lang === "ar" ? "ar-AE" : "en-GB")}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: autoRefresh ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)" }}
          >
            <RefreshCw size={13} className={autoRefresh ? "text-emerald-400 animate-spin" : "text-white/40"} style={autoRefresh ? { animationDuration: "3s" } : {}} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={loadData} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
            <RefreshCw size={13} className="text-white/60" />
          </motion.button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Status Banner */}
        {health && (
          <motion.div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{
              background: health.status === "healthy" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${health.status === "healthy" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {health.status === "healthy" ? (
              <Wifi size={20} className="text-emerald-400" />
            ) : (
              <WifiOff size={20} className="text-red-400" />
            )}
            <div className="flex-1">
              <p className="text-[13px] font-bold" style={{ color: health.status === "healthy" ? "#10B981" : "#EF4444" }}>
                {health.status === "healthy" ? t("monitor.all_systems_operational") : t("monitor.system_degraded")}
              </p>
              <p className="text-[10px] text-white/40">
                {t("monitor.api_uptime")}: {formatUptime(health.api_uptime_seconds)} | {t("monitor.db_latency")}: {db_info.latency_ms}ms
              </p>
            </div>
            <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: health.status === "healthy" ? "#10B981" : "#EF4444" }} />
          </motion.div>
        )}

        {errorCenter && (
          <motion.div
            className="rounded-2xl p-4"
            style={{
              background: "#0A0A0A",
              border: `1px solid ${errorCenter.overall_status === "critical" ? "rgba(239,68,68,0.22)" : errorCenter.overall_status === "warning" ? "rgba(245,158,11,0.22)" : "rgba(16,185,129,0.18)"}`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            data-testid="monitor-error-center-card"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[14px] font-bold text-white flex items-center gap-2">
                  <Siren size={15} className={errorCenter.overall_status === "critical" ? "text-red-400" : errorCenter.overall_status === "warning" ? "text-amber-400" : "text-emerald-400"} />
                  Fehlerzentrale
                </p>
                <p className="text-[10px] text-white/35 mt-1">Zeigt sofort, wenn Webseite, Login, Registrierung oder Kern-APIs Probleme machen.</p>
              </div>
              <button
                onClick={runChecks}
                data-testid="monitor-run-probes-btn"
                className="rounded-xl px-3 py-2 text-[11px] font-bold"
                style={{ background: runningChecks ? "rgba(255,255,255,0.08)" : "#00C2FF", color: runningChecks ? "#fff" : "#041018" }}
              >
                {runningChecks ? "Prüft..." : "Jetzt prüfen"}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
              {[
                ["Warnungen", errorCenter.summary?.open_alerts || 0, "#EF4444"],
                ["Frontend", errorCenter.summary?.frontend_errors_24h || 0, "#F59E0B"],
                ["API", errorCenter.summary?.api_errors_1h || 0, "#8B5CF6"],
                ["Login/Reg", errorCenter.summary?.auth_errors_1h || 0, "#00C2FF"],
                ["Incidents", errorCenter.summary?.incidents_24h || 0, "#10B981"],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)" }} data-testid={`monitor-error-summary-${String(label).toLowerCase()}`}>
                  <p className="text-[9px] uppercase tracking-[0.16em] text-white/35">{label}</p>
                  <p className="text-[18px] font-bold mt-1" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                <p className="text-[12px] font-bold text-white mb-2 flex items-center gap-2"><AlertTriangle size={13} className="text-red-400" /> Aktive Warnungen</p>
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {(errorCenter.alerts || []).length === 0 ? (
                    <p className="text-[11px] text-emerald-400">Keine aktiven Warnungen.</p>
                  ) : errorCenter.alerts.map((alert, idx) => (
                    <div key={`${alert.key}-${idx}`} className="rounded-xl px-3 py-2 border" style={{ borderColor: alert.severity === "critical" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)", background: "rgba(255,255,255,0.02)" }} data-testid={`monitor-alert-${idx}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold text-white">{alert.label}</p>
                        <span className="text-[9px] font-bold uppercase" style={{ color: alert.severity === "critical" ? "#EF4444" : "#F59E0B" }}>{alert.severity}</span>
                      </div>
                      <p className="text-[10px] text-white/45 mt-1">{alert.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                <p className="text-[12px] font-bold text-white mb-2 flex items-center gap-2"><Shield size={13} className="text-[#00C2FF]" /> Kern-Checks</p>
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {(errorCenter.probes || []).map((probe) => (
                    <div key={probe.key} className="rounded-xl px-3 py-2 flex items-start justify-between gap-3 border border-white/6" data-testid={`monitor-probe-${probe.key}`}>
                      <div>
                        <p className="text-[11px] font-bold text-white flex items-center gap-2">
                          {probe.key.includes('auth') ? <LogIn size={12} className="text-[#00C2FF]" /> : probe.key.includes('site') ? <Globe size={12} className="text-emerald-400" /> : <Bug size={12} className="text-amber-400" />} {probe.label}
                        </p>
                        <p className="text-[10px] text-white/35 mt-1">{probe.path} · {probe.latency_ms || 0}ms</p>
                        {probe.error_message ? <p className="text-[10px] text-red-300 mt-1">{probe.error_message}</p> : null}
                      </div>
                      <span className="px-2 py-1 rounded-full text-[9px] font-bold uppercase" style={{ background: probe.status === 'ok' ? 'rgba(16,185,129,0.12)' : probe.status === 'warning' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)', color: probe.status === 'ok' ? '#10B981' : probe.status === 'warning' ? '#F59E0B' : '#EF4444' }}>{probe.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {(errorCenter.top_error_pages || []).length > 0 && (
              <div className="mt-3 rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                <p className="text-[12px] font-bold text-white mb-2">Meist betroffene Seiten</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {errorCenter.top_error_pages.map((row, idx) => (
                    <div key={`${row.page}-${idx}`} className="rounded-xl px-3 py-2 border border-white/6 flex items-center justify-between" data-testid={`monitor-top-page-${idx}`}>
                      <span className="text-[11px] text-white/70 truncate">{row.page}</span>
                      <span className="text-[11px] font-bold text-amber-400">{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Zap} label={t("monitor.requests_per_hour")} value={metrics?.requests_1h || 0} sub={`${metrics?.requests_24h || 0} ${t("monitor.in_24h")}`} color="#00C2FF" />
          <StatCard icon={AlertTriangle} label={t("monitor.errors_per_hour")} value={metrics?.errors_1h || 0} sub={`${t("monitor.rate")}: ${metrics?.error_rate_pct || 0}%`} color={metrics?.errors_1h > 10 ? "#EF4444" : "#F59E0B"} />
          <StatCard icon={Clock} label={t("monitor.avg_response")} value={`${metrics?.avg_response_ms || 0}ms`} sub={`P95: ${metrics?.p95_response_ms || 0}ms`} color="#8B5CF6" />
          <StatCard icon={Users} label={t("monitor.total_users")} value={userStats?.total_users || 0} sub={`+${userStats?.new_today || 0} ${t("monitor.today")}`} color="#10B981" />
        </div>

        {/* RPM Chart */}
        {metrics?.rpm_chart && (
          <motion.div
            className="rounded-2xl p-4"
            style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-bold text-white flex items-center gap-2">
                <BarChart3 size={13} className="text-[#00C2FF]" /> {t("monitor.requests_per_minute")}
              </p>
              <p className="text-[10px] text-white/30">{t("monitor.last_10_min")}</p>
            </div>
            <MiniChart data={metrics.rpm_chart} color="#00C2FF" height={56} />
          </motion.div>
        )}

        {/* System Resources */}
        <motion.div
          className="rounded-2xl p-4"
          style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-[12px] font-bold text-white mb-3 flex items-center gap-2">
            <Server size={13} className="text-[#F59E0B]" /> {t("monitor.system_resources")}
          </p>
          <ProgressBar label={t("monitor.cpu_load_1m")} value={sys.cpu_load_1m || 0} max={4} color="#00C2FF" detail={`1m: ${sys.cpu_load_1m} | 5m: ${sys.cpu_load_5m} | 15m: ${sys.cpu_load_15m}`} />
          <ProgressBar label="RAM" value={sys.memory_used_mb || 0} max={sys.memory_total_mb || 1} color="#8B5CF6" detail={`${sys.memory_used_mb} / ${sys.memory_total_mb} MB`} />
          <ProgressBar label="Disk" value={sys.disk_used_gb || 0} max={sys.disk_total_gb || 1} color="#F59E0B" detail={`${sys.disk_used_gb} / ${sys.disk_total_gb} GB`} />
          <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <span className="text-[10px] text-white/30">{t("monitor.server_uptime")}</span>
            <span className="text-[11px] font-mono text-emerald-400">{formatUptime(sys.uptime_seconds)}</span>
          </div>
        </motion.div>

        {/* Database */}
        <motion.div
          className="rounded-2xl p-4"
          style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-[12px] font-bold text-white mb-3 flex items-center gap-2">
            <Database size={13} className="text-emerald-400" /> {t("monitor.database")}
          </p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className="text-[16px] font-bold text-white">{dbStats?.collections || 0}</p>
              <p className="text-[9px] text-white/30">{t("monitor.collections")}</p>
            </div>
            <div className="text-center p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className="text-[16px] font-bold text-white">{(dbStats?.total_objects || 0).toLocaleString("de-DE")}</p>
              <p className="text-[9px] text-white/30">{t("monitor.documents")}</p>
            </div>
            <div className="text-center p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className="text-[16px] font-bold text-white">{dbStats?.data_size_mb || 0} MB</p>
              <p className="text-[9px] text-white/30">{t("monitor.data_size")}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/30">{t("monitor.latency")}</span>
            <span className="font-mono" style={{ color: db_info.latency_ms < 50 ? "#10B981" : db_info.latency_ms < 200 ? "#F59E0B" : "#EF4444" }}>
              {db_info.latency_ms || 0}ms
            </span>
          </div>
          {/* Top Collections */}
          {dbStats?.top_collections?.slice(0, 8).map((c, i) => (
            <div key={i} className="flex items-center justify-between py-1.5" style={{ borderTop: i === 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <span className="text-[10px] text-white/50 truncate flex-1">{c.name}</span>
              <span className="text-[10px] font-mono text-white/70">{c.documents.toLocaleString("de-DE")}</span>
            </div>
          ))}
        </motion.div>

        {/* User Stats */}
        {userStats && (
          <motion.div
            className="rounded-2xl p-4"
            style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-[12px] font-bold text-white mb-3 flex items-center gap-2">
              <Users size={13} className="text-[#00C2FF]" /> {t("monitor.user_stats")}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                <p className="text-[14px] font-bold text-emerald-400">+{userStats.new_today}</p>
                <p className="text-[9px] text-white/30">{t("monitor.today")}</p>
              </div>
              <div className="p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                <p className="text-[14px] font-bold text-[#00C2FF]">+{userStats.new_this_week}</p>
                <p className="text-[9px] text-white/30">{t("monitor.this_week")}</p>
              </div>
              <div className="p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                <p className="text-[14px] font-bold text-[#8B5CF6]">+{userStats.new_this_month}</p>
                <p className="text-[9px] text-white/30">{t("monitor.this_month")}</p>
              </div>
              <div className="p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                <p className="text-[14px] font-bold text-[#F59E0B]">{userStats.active_7d}</p>
                <p className="text-[9px] text-white/30">{t("monitor.active_7_days")}</p>
              </div>
            </div>
            {/* Role Distribution */}
            {userStats.roles && Object.entries(userStats.roles).map(([role, count]) => (
              <div key={role} className="flex items-center justify-between py-1">
                <span className="text-[10px] text-white/50 capitalize">{role}</span>
                <span className="text-[10px] font-mono text-white/70">{count}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Slow Endpoints */}
        {metrics?.slow_endpoints?.length > 0 && (
          <motion.div
            className="rounded-2xl p-4"
            style={{ background: "#0A0A0A", border: "1px solid rgba(239,68,68,0.15)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-[12px] font-bold text-white mb-3 flex items-center gap-2">
              <AlertTriangle size={13} className="text-red-400" /> {t("monitor.slow_endpoints")} ({">"}500ms)
            </p>
            {metrics.slow_endpoints.slice(0, 8).map((ep, i) => (
              <div key={i} className="flex items-center justify-between py-1.5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.06)", color: ep.method === "GET" ? "#10B981" : "#F59E0B" }}>
                    {ep.method}
                  </span>
                  <span className="text-[10px] text-white/50 truncate">{ep.path}</span>
                </div>
                <span className="text-[10px] font-mono text-red-400 ml-2">{ep.duration_ms}ms</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Top Endpoints */}
        {metrics?.top_endpoints?.length > 0 && (
          <motion.div
            className="rounded-2xl p-4"
            style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-[12px] font-bold text-white mb-3 flex items-center gap-2">
              <TrendingUp size={13} className="text-[#8B5CF6]" /> {t("monitor.top_endpoints_1h")}
            </p>
            {metrics.top_endpoints.slice(0, 10).map((ep, i) => (
              <div key={i} className="flex items-center justify-between py-1.5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                <span className="text-[10px] text-white/50 truncate flex-1">{ep.path}</span>
                <span className="text-[10px] font-mono text-[#8B5CF6]">{ep.count}x</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Error Codes */}
        {metrics?.error_codes && Object.keys(metrics.error_codes).length > 0 && (
          <motion.div
            className="rounded-2xl p-4"
            style={{ background: "#0A0A0A", border: "1px solid rgba(239,68,68,0.1)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-[12px] font-bold text-white mb-3 flex items-center gap-2">
              <Shield size={13} className="text-red-400" /> {t("monitor.error_codes_1h")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(metrics.error_codes).map(([code, count]) => (
                <div key={code} className="text-center p-2 rounded-xl" style={{ background: "rgba(239,68,68,0.06)" }}>
                  <p className="text-[14px] font-bold text-red-400">{count}</p>
                  <p className="text-[9px] text-white/30">HTTP {code}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MonitoringDashboard;
