/**
 * BidBlitz Admin Management
 * All-in-one: Kunden-Verwaltung, Transaktionen mit Refund, Module CRUD
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, UserX, UserCheck, Shield, Key, Trash2, RefreshCw,
  Users, CreditCard, Package, X, Check, AlertTriangle, Loader2, ChevronRight,
  Edit3, Plus, Ban
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const TABS = [
  { id: "customers", label: "Kunden", icon: Users },
  { id: "transactions", label: "Zahlungen", icon: CreditCard },
  { id: "modules", label: "Service-Module", icon: Package },
];

export const AdminManagementPage = ({ onBack, initialTab = "customers", initialModule = null }) => {
  const [tab, setTab] = useState(initialTab);

  // Read ?mod= from URL for module pre-selection
  const urlModule = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("mod")
    : null;
  const effectiveModule = initialModule || urlModule;

  // If a module is requested, auto-switch to modules tab
  useEffect(() => {
    if (effectiveModule && tab !== "modules") setTab("modules");
  }, [effectiveModule]);

  return (
    <div data-testid="admin-management-page" className="min-h-screen pb-20 bg-[#F7F8FA]">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <motion.button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
            whileTap={{ scale: 0.92 }}
            data-testid="admin-mgmt-back"
          >
            <ArrowLeft size={16} />
          </motion.button>
          <h1 className="text-[14px] font-bold">Verwaltung</h1>
          <div className="w-9" />
        </div>
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.id}
              data-testid={`admin-mgmt-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all ${
                tab === t.id
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              <t.icon size={12} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3">
        {tab === "customers" && <CustomersTab />}
        {tab === "transactions" && <TransactionsTab />}
        {tab === "modules" && <ModulesTab initialModule={effectiveModule} />}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// CUSTOMERS TAB
// ═══════════════════════════════════════════════════════════
const CustomersTab = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (q) params.set("q", q);
      if (filter === "banned") params.set("status", "banned");
      else if (filter === "admin") params.set("role", "admin");
      else if (filter === "merchant") params.set("role", "merchant");
      const res = await fetch(`${API}/api/admin/customers?${params}`, { credentials: "include" });
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (err) {
      toast.error("Fehler: " + err.message);
    }
    setLoading(false);
  }, [q, filter]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <div>
      <div className="bg-white rounded-2xl p-3 mb-3 shadow-sm">
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
          <Search size={14} className="text-gray-400" />
          <input
            data-testid="customer-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Email, Name oder Username…"
            className="flex-1 bg-transparent text-[13px] outline-none"
          />
        </div>
        <div className="flex gap-1.5 mt-2 overflow-x-auto">
          {[
            { v: "all", l: "Alle" },
            { v: "banned", l: "Gesperrt" },
            { v: "admin", l: "Admins" },
            { v: "merchant", l: "Händler" },
          ].map((f) => (
            <button
              key={f.v}
              data-testid={`customer-filter-${f.v}`}
              onClick={() => setFilter(f.v)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                filter === f.v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" size={20} /></div>
      ) : customers.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">Keine Kunden gefunden</p>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <motion.button
              key={c.user_id}
              data-testid={`customer-${c.user_id}`}
              onClick={() => setSelected(c)}
              className="w-full bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm text-left"
              whileTap={{ scale: 0.98 }}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white font-bold text-[13px]">
                {(c.name || c.email || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-semibold text-gray-900 truncate">{c.name || c.email}</p>
                  {c.banned && <Ban size={11} className="text-red-500" />}
                  {c.role === "admin" && <Shield size={11} className="text-purple-500" />}
                </div>
                <p className="text-[11px] text-gray-500 truncate">{c.email}</p>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400">{c.role || "user"}</span>
                  <span className="text-[10px] text-[#00D26A] font-semibold">
                    €{(c.balance || 0).toFixed(2)} · {(c.balance_blz || 0).toFixed(0)} BLZ
                  </span>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-300" />
            </motion.button>
          ))}
        </div>
      )}

      {selected && (
        <CustomerDetailModal
          customer={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
};

const CustomerDetailModal = ({ customer, onClose, onChanged }) => {
  const [loading, setLoading] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [showPwForm, setShowPwForm] = useState(false);

  const doAction = async (url, body, successMsg, method = "POST") => {
    setLoading(true);
    try {
      const res = await fetch(`${API}${url}`, {
        method,
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fehler");
      toast.success(successMsg);
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const ban = () => doAction(`/api/admin/customers/${customer.user_id}/ban`, { banned: !customer.banned, reason: "Admin action" }, customer.banned ? "Kunde entsperrt" : "Kunde gesperrt");
  const setRole = (role) => doAction(`/api/admin/customers/${customer.user_id}/role`, { role }, `Rolle: ${role}`);
  const resetPw = () => {
    if (newPw.length < 6) { toast.error("Mind. 6 Zeichen"); return; }
    doAction(`/api/admin/customers/${customer.user_id}/reset-password`, { new_password: newPw }, "Passwort zurückgesetzt");
    setShowPwForm(false); setNewPw("");
  };
  const del = () => {
    if (!window.confirm(`Kunde ${customer.email} wirklich dauerhaft löschen?`)) return;
    doAction(`/api/admin/customers/${customer.user_id}`, null, "Kunde gelöscht", "DELETE");
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto"
        initial={{ y: "100%" }} animate={{ y: 0 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold">Kunde verwalten</h2>
          <button onClick={onClose} data-testid="customer-detail-close" className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={14} />
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-3">
          <p className="text-[13px] font-semibold">{customer.name || "Ohne Name"}</p>
          <p className="text-[11px] text-gray-500">{customer.email}</p>
          <div className="flex gap-2 mt-1 text-[10px] text-gray-400">
            <span>ID: {customer.user_id.slice(-8)}</span>
            {customer.role && <span>· {customer.role}</span>}
            {customer.banned && <span className="text-red-500 font-semibold">· GESPERRT</span>}
          </div>
        </div>

        <div className="space-y-2">
          <button
            data-testid="customer-action-ban"
            onClick={ban}
            disabled={loading}
            className={`w-full py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 ${
              customer.banned ? "bg-green-500 text-white" : "bg-red-500 text-white"
            }`}
          >
            {customer.banned ? <><UserCheck size={14} /> Entsperren</> : <><UserX size={14} /> Sperren</>}
          </button>

          <div className="grid grid-cols-3 gap-2">
            {["user", "merchant", "admin"].map((r) => (
              <button
                key={r}
                data-testid={`customer-role-${r}`}
                onClick={() => setRole(r)}
                disabled={loading || customer.role === r}
                className={`py-2 rounded-xl text-[11px] font-semibold ${
                  customer.role === r ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {!showPwForm ? (
            <button
              data-testid="customer-action-pw"
              onClick={() => setShowPwForm(true)}
              className="w-full py-2.5 rounded-xl bg-gray-100 text-[13px] font-semibold flex items-center justify-center gap-2"
            >
              <Key size={14} /> Passwort zurücksetzen
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Neues Passwort"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px]"
                data-testid="customer-new-pw-input"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowPwForm(false)} className="flex-1 py-2 rounded-xl bg-gray-100 text-[12px] font-semibold">Abbrechen</button>
                <button onClick={resetPw} data-testid="customer-pw-save" disabled={loading} className="flex-1 py-2 rounded-xl bg-blue-500 text-white text-[12px] font-semibold">Speichern</button>
              </div>
            </div>
          )}

          <button
            data-testid="customer-action-delete"
            onClick={del}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-red-50 text-red-600 text-[13px] font-semibold flex items-center justify-center gap-2"
          >
            <Trash2 size={14} /> Dauerhaft löschen
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════
// TRANSACTIONS TAB
// ═══════════════════════════════════════════════════════════
const TransactionsTab = () => {
  const [tx, setTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [refundingId, setRefundingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (q) params.set("q", q);
      const res = await fetch(`${API}/api/admin/transactions?${params}`, { credentials: "include" });
      const data = await res.json();
      setTx(data.transactions || []);
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const refund = async (ref) => {
    if (!window.confirm("Transaktion wirklich refunden? Der Betrag wird dem User gutgeschrieben.")) return;
    setRefundingId(ref);
    try {
      const res = await fetch(`${API}/api/admin/transactions/${ref}/refund`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Admin-Refund" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fehler");
      toast.success(`Refund ${data.refund_ref}: +€${data.amount.toFixed(2)}`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
    setRefundingId(null);
  };

  return (
    <div>
      <div className="bg-white rounded-2xl p-3 mb-3 shadow-sm">
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
          <Search size={14} className="text-gray-400" />
          <input
            data-testid="tx-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Referenz, Beschreibung, Merchant…"
            className="flex-1 bg-transparent text-[13px] outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" size={20} /></div>
      ) : tx.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">Keine Transaktionen</p>
      ) : (
        <div className="space-y-2">
          {tx.map((t, i) => {
            const ref = t.reference || t.tx_id || `tx-${i}`;
            const isRefundable = t.status === "completed" && !t.refunded && t.type !== "refund" && t.amount > 0;
            return (
              <div key={ref} className="bg-white rounded-xl p-3 shadow-sm" data-testid={`tx-${ref}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: t.type === "refund" ? "#A855F7" : t.type === "topup" ? "#00D26A" : "#3B82F6" }}>
                        {t.type}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        t.status === "completed" ? "bg-green-50 text-green-600" :
                        t.status === "failed" ? "bg-red-50 text-red-600" : "bg-yellow-50 text-yellow-700"
                      }`}>{t.status}</span>
                      {t.refunded && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-bold">REFUNDED</span>}
                    </div>
                    <p className="text-[12px] font-semibold text-gray-900 truncate">{t.description || t.merchant_name}</p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {t.user_info?.email || t.user_id?.slice(-8)} · {ref}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[14px] font-bold" style={{ color: t.type === "refund" ? "#A855F7" : "#1f2937" }}>
                      {t.currency === "BLZ" ? `${t.amount} BLZ` : `€${t.amount.toFixed(2)}`}
                    </p>
                    {isRefundable && (
                      <button
                        data-testid={`tx-refund-${ref}`}
                        onClick={() => refund(ref)}
                        disabled={refundingId === ref}
                        className="mt-1 text-[10px] font-semibold text-red-500 flex items-center gap-1 ml-auto"
                      >
                        {refundingId === ref ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}
                        Refund
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MODULES TAB (Generic CRUD)
// ═══════════════════════════════════════════════════════════
const MODULE_DEFS = [
  { key: "handwerker", label: "Handwerker", endpoint: "/api/handwerker", fieldKey: "handwerker", fields: ["name", "category", "city", "rating"] },
  { key: "gebrauchtwagen", label: "Gebrauchtwagen", endpoint: "/api/cars", fieldKey: "cars", fields: ["title", "brand", "price", "city"] },
  { key: "reinigung", label: "Reinigung", endpoint: "/api/cleaning", fieldKey: "services", fields: ["name", "price_per_hour", "min_hours"] },
  { key: "umzug", label: "Umzug", endpoint: "/api/moving", fieldKey: "companies", fields: ["name", "city", "base_price", "rating"] },
  { key: "tierbetreuung", label: "Tierbetreuung", endpoint: "/api/petcare", fieldKey: "sitters", fields: ["name", "service", "city", "price_per_day"] },
  { key: "streaming", label: "Streaming", endpoint: "/api/streaming", fieldKey: "catalog", fields: ["title", "type", "genre", "rating"] },
  { key: "telemedizin", label: "Telemedizin", endpoint: "/api/telemedicine/doctors", fieldKey: "doctors", fields: ["name", "specialty", "city", "price_consultation"] },
  { key: "dating", label: "Dating", endpoint: "/api/dating/profiles", fieldKey: "profiles", fields: ["name", "city", "verified"] },
  { key: "fitness", label: "Fitness", endpoint: "/api/fitness/gyms", fieldKey: "gyms", fields: ["name", "type", "city", "monthly_price"] },
  { key: "reisen", label: "Reiseangebote", endpoint: "/api/reiseplaner/trips", fieldKey: "trips", fields: ["title", "destination", "duration_days", "price_per_person"] },
  { key: "ladesaeulen", label: "Ladesäulen", endpoint: "/api/ladesaeulen/stations", fieldKey: "stations", fields: ["name", "operator", "city", "power_kw", "price_per_kwh"] },
  { key: "scooter-abos", label: "Scooter-Abos", endpoint: "/api/scooter/plans", fieldKey: "plans", fields: ["name", "price", "duration_days"] },
];

const ModulesTab = ({ initialModule }) => {
  const [selectedMod, setSelectedMod] = useState(initialModule ? MODULE_DEFS.find(m => m.key === initialModule) : null);

  if (!selectedMod) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {MODULE_DEFS.map((m) => (
          <motion.button
            key={m.key}
            data-testid={`module-${m.key}`}
            onClick={() => setSelectedMod(m)}
            className="bg-white rounded-xl p-3.5 text-left shadow-sm"
            whileTap={{ scale: 0.97 }}
          >
            <p className="text-[13px] font-bold text-gray-900">{m.label}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">CRUD verwalten</p>
          </motion.button>
        ))}
      </div>
    );
  }

  return <ModuleCRUD mod={selectedMod} onBack={() => setSelectedMod(null)} />;
};

const ModuleCRUD = ({ mod, onBack }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}${mod.endpoint}`, { credentials: "include" });
      const data = await res.json();
      setItems(data[mod.fieldKey] || []);
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  }, [mod]);

  useEffect(() => { load(); }, [load]);

  const del = async (id) => {
    if (!window.confirm("Eintrag löschen?")) return;
    try {
      const res = await fetch(`${API}/api/admin/module/${mod.key}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Fehler");
      toast.success("Gelöscht");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={onBack} data-testid="module-crud-back" className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
          <ArrowLeft size={14} />
        </button>
        <h2 className="flex-1 text-[14px] font-bold">{mod.label}</h2>
        <button
          data-testid="module-add-btn"
          onClick={() => { setEditing({}); setShowForm(true); }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-900 text-white text-[11px] font-semibold"
        >
          <Plus size={11} /> Neu
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" size={20} /></div>
      ) : items.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">Noch keine Einträge. Klick "Neu".</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => {
            const id = item.id || item._id || i;
            return (
              <div key={id} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-2" data-testid={`item-${id}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-gray-900 truncate">
                    {item[mod.fields[0]] || item.name || item.title || `#${i + 1}`}
                  </p>
                  <div className="flex flex-wrap gap-x-2 mt-0.5">
                    {mod.fields.slice(1).map((f) => item[f] !== undefined && (
                      <span key={f} className="text-[10px] text-gray-500">
                        <span className="text-gray-400">{f.replace(/_/g, " ")}:</span> {String(item[f])}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  data-testid={`item-edit-${id}`}
                  onClick={() => { setEditing(item); setShowForm(true); }}
                  className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center"
                >
                  <Edit3 size={12} />
                </button>
                <button
                  data-testid={`item-delete-${id}`}
                  onClick={() => del(id)}
                  className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ModuleForm
          mod={mod}
          item={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
};

const ModuleForm = ({ mod, item, onClose, onSaved }) => {
  const [form, setForm] = useState(item || {});
  const [saving, setSaving] = useState(false);
  const isEdit = !!(item && (item.id || item._id));

  const save = async () => {
    setSaving(true);
    try {
      const url = isEdit
        ? `${API}/api/admin/module/${mod.key}/${item.id || item._id}`
        : `${API}/api/admin/module/${mod.key}/create`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Fehler");
      toast.success(isEdit ? "Gespeichert" : "Angelegt");
      onSaved();
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
      onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto"
        initial={{ y: "100%" }} animate={{ y: 0 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold">{isEdit ? "Bearbeiten" : "Neuer Eintrag"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-2">
          {mod.fields.map((f) => {
            const isNumber = f.includes("price") || f.includes("rating") || f.includes("count") || f.includes("kw") || f.includes("per_") || f.includes("duration");
            return (
              <div key={f}>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  {f.replace(/_/g, " ")}
                </label>
                <input
                  data-testid={`form-field-${f}`}
                  type={isNumber ? "number" : "text"}
                  step={isNumber ? "0.01" : undefined}
                  value={form[f] ?? ""}
                  onChange={(e) => setForm({ ...form, [f]: isNumber ? parseFloat(e.target.value) || 0 : e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] mt-0.5"
                />
              </div>
            );
          })}
        </div>

        <button
          data-testid="form-save-btn"
          onClick={save}
          disabled={saving}
          className="w-full mt-4 py-3 rounded-xl bg-gray-900 text-white text-[13px] font-semibold flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {isEdit ? "Speichern" : "Anlegen"}
        </button>
      </motion.div>
    </motion.div>
  );
};

export default AdminManagementPage;
