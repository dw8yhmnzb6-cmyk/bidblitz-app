/**
 * AdminAuditLogPage — Admin History / Audit Log für alle Feature-Management Aktionen
 *
 * Route: /admin/audit-log
 *
 * Zeigt:
 *   - Alle Admin-Aktionen (toggle, set_price, apply_bundle, bundle.save, bundle.delete, purchase)
 *   - Timestamp, Admin Email, Aktion, Merchant, Details
 *   - Filter: Merchant ID, Action Type
 *   - Pagination
 *
 * Backend:
 *   GET /api/pos/features/admin/audit-log?limit=100&skip=0&merchant_id=X&action_type=Y
 */
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft, FileText, Filter, Search, Calendar,
  User, Activity, Package, DollarSign, ToggleRight,
  Loader2, X, RefreshCw,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  let d = {};
  try {
    d = await r.clone().json();
  } catch (_) {
    /* non-json */
  }
  if (!r.ok) throw new Error(d.detail || d.message || `Error ${r.status}`);
  return d;
}

const ACTION_META = {
  "feature.toggle": { icon: ToggleRight, label: "Feature Toggle", color: "#00C2FF" },
  "feature.set_price": { icon: DollarSign, label: "Preis gesetzt", color: "#10B981" },
  "feature.apply_bundle": { icon: Package, label: "Bundle aktiviert", color: "#F59E0B" },
  "bundle.save": { icon: Package, label: "Bundle erstellt/geändert", color: "#8B5CF6" },
  "bundle.delete": { icon: X, label: "Bundle gelöscht", color: "#EF4444" },
  "feature.purchase": { icon: DollarSign, label: "Feature gekauft", color: "#EC4899" },
};

export default function AdminAuditLogPage({ onBack }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [limit] = useState(100);

  // Filters
  const [merchantFilter, setMerchantFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit, skip });
      if (merchantFilter) params.set("merchant_id", merchantFilter);
      if (actionFilter) params.set("action_type", actionFilter);

      const res = await api(`/api/pos/features/admin/audit-log?${params}`);
      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch (err) {
      toast.error(`Fehler: ${err.message}`);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, merchantFilter, actionFilter]);

  // Client-side search filter
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter((log) => {
      const adminEmail = (log.admin_email || "").toLowerCase();
      const merchantId = (log.ref?.merchant_id || "").toLowerCase();
      const featureKey = (log.ref?.feature_key || "").toLowerCase();
      const bundleKey = (log.ref?.bundle_key || "").toLowerCase();
      const action = (log.action || "").toLowerCase();
      return (
        adminEmail.includes(q) ||
        merchantId.includes(q) ||
        featureKey.includes(q) ||
        bundleKey.includes(q) ||
        action.includes(q)
      );
    });
  }, [logs, searchQuery]);

  const formatTimestamp = (ts) => {
    if (!ts) return "—";
    try {
      const d = new Date(ts);
      return d.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  const renderDetails = (log) => {
    const ref = log.ref || {};
    const action = log.action;

    if (action === "feature.toggle") {
      return (
        <div className="text-sm space-y-1">
          <p>
            <span className="font-medium">Merchant:</span> {ref.merchant_id || "—"}
          </p>
          <p>
            <span className="font-medium">Feature:</span> {ref.feature_key || "—"}
          </p>
          <p>
            <span className="font-medium">Status:</span>{" "}
            <span className={ref.enabled ? "text-green-600" : "text-red-600"}>
              {ref.enabled ? "Aktiviert" : "Deaktiviert"}
            </span>
          </p>
          {ref.monthly_price !== undefined && (
            <p>
              <span className="font-medium">Preis:</span> €{ref.monthly_price.toFixed(2)}/Monat
            </p>
          )}
        </div>
      );
    }

    if (action === "feature.set_price") {
      return (
        <div className="text-sm space-y-1">
          <p>
            <span className="font-medium">Merchant:</span> {ref.merchant_id || "—"}
          </p>
          <p>
            <span className="font-medium">Feature:</span> {ref.feature_key || "—"}
          </p>
          <p>
            <span className="font-medium">Neuer Preis:</span> €{ref.new_price?.toFixed(2) || "—"}/Monat
          </p>
          <p className="text-gray-500">
            Katalog-Preis: €{ref.catalog_price?.toFixed(2) || "—"}
          </p>
        </div>
      );
    }

    if (action === "feature.apply_bundle") {
      return (
        <div className="text-sm space-y-1">
          <p>
            <span className="font-medium">Merchant:</span> {ref.merchant_id || "—"}
          </p>
          <p>
            <span className="font-medium">Bundle:</span> {ref.bundle_name || ref.bundle_key || "—"}
          </p>
          <p>
            <span className="font-medium">Modus:</span> {ref.mode || "—"}
          </p>
          {ref.activated && ref.activated.length > 0 && (
            <p>
              <span className="font-medium">Aktiviert:</span> {ref.activated.join(", ")}
            </p>
          )}
          {ref.deactivated && ref.deactivated.length > 0 && (
            <p>
              <span className="font-medium">Deaktiviert:</span> {ref.deactivated.join(", ")}
            </p>
          )}
        </div>
      );
    }

    if (action === "bundle.save") {
      return (
        <div className="text-sm space-y-1">
          <p>
            <span className="font-medium">Bundle:</span> {ref.name || ref.bundle_key || "—"}
          </p>
          <p>
            <span className="font-medium">Preis:</span> €{ref.monthly_total?.toFixed(2) || "—"}/Monat
          </p>
        </div>
      );
    }

    if (action === "bundle.delete") {
      return (
        <div className="text-sm">
          <p>
            <span className="font-medium">Bundle:</span> {ref.bundle_key || "—"}
          </p>
        </div>
      );
    }

    if (action === "feature.purchase") {
      return (
        <div className="text-sm space-y-1">
          <p>
            <span className="font-medium">Merchant:</span> {ref.merchant_id || "—"}
          </p>
          <p>
            <span className="font-medium">Feature:</span> {ref.feature_key || "—"}
          </p>
          <p>
            <span className="font-medium">Monate:</span> {ref.months || "—"}
          </p>
          <p>
            <span className="font-medium">Betrag:</span> €{ref.amount?.toFixed(2) || "—"}
          </p>
        </div>
      );
    }

    // Fallback: JSON dump
    return <pre className="text-xs text-gray-600 overflow-auto">{JSON.stringify(ref, null, 2)}</pre>;
  };

  const getActionMeta = (action) => {
    return ACTION_META[action] || { icon: Activity, label: action, color: "#64748B" };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition">
            <ChevronLeft size={24} />
          </button>
          <FileText size={24} className="text-blue-600" />
          <div className="flex-1">
            <h1 className="text-lg font-bold">Admin Audit Log</h1>
            <p className="text-sm text-gray-600">
              {total} Einträge · Seite {Math.floor(skip / limit) + 1}
            </p>
          </div>
          <button
            onClick={fetchLogs}
            className="p-2 hover:bg-gray-100 rounded-full transition"
            title="Neu laden"
          >
            <RefreshCw size={20} />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="px-4 pb-3 space-y-2">
          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Suche Admin, Merchant, Feature, Bundle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Alle Aktionen</option>
              <option value="feature.toggle">Feature Toggle</option>
              <option value="feature.set_price">Preis gesetzt</option>
              <option value="feature.apply_bundle">Bundle aktiviert</option>
              <option value="bundle.save">Bundle erstellt/geändert</option>
              <option value="bundle.delete">Bundle gelöscht</option>
              <option value="feature.purchase">Feature gekauft</option>
            </select>

            <input
              type="text"
              placeholder="Merchant ID Filter"
              value={merchantFilter}
              onChange={(e) => setMerchantFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm flex-1 min-w-[200px]"
            />

            {(actionFilter || merchantFilter) && (
              <button
                onClick={() => {
                  setActionFilter("");
                  setMerchantFilter("");
                  setSkip(0);
                }}
                className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition flex items-center gap-1"
              >
                <X size={16} />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-20">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        )}

        {!loading && filteredLogs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <FileText size={48} className="mx-auto mb-2 opacity-50" />
            <p>Keine Einträge gefunden</p>
          </div>
        )}

        {!loading && filteredLogs.length > 0 && (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredLogs.map((log, idx) => {
                const meta = getActionMeta(log.action);
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={log.audit_id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
                  >
                    {/* Header Row */}
                    <div className="flex items-start gap-3 mb-2">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${meta.color}20` }}
                      >
                        <Icon size={20} style={{ color: meta.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm" style={{ color: meta.color }}>
                            {meta.label}
                          </span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(log.ts)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">
                          <User size={12} className="inline mr-1" />
                          Admin: <span className="font-medium">{log.admin_email || "system"}</span>
                        </p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="ml-11 mt-2 p-3 bg-gray-50 rounded-lg">
                      {renderDetails(log)}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {!loading && total > limit && (
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setSkip(Math.max(0, skip - limit))}
              disabled={skip === 0}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
            >
              Vorherige
            </button>
            <p className="text-sm text-gray-600">
              Seite {Math.floor(skip / limit) + 1} von {Math.ceil(total / limit)}
            </p>
            <button
              onClick={() => setSkip(skip + limit)}
              disabled={skip + limit >= total}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
            >
              Nächste
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
