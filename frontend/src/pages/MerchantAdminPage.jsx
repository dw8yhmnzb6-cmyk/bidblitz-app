import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useI18n } from "../store/I18nContext";
import {
  ChevronLeft, Store, Search, RotateCcw, Ban, CheckCircle,
  Tag, AlertTriangle, Smartphone, ChevronRight,
  X, Zap, Hash,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const api = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...opts });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || `Error ${res.status}`);
  }
  return res.json();
};

const normalizeMerchantRow = (merchant = {}) => ({
  ...merchant,
  id: merchant.id || merchant.merchant_id || merchant.user_id || "",
  merchant_id: merchant.merchant_id || merchant.id || "",
  name: merchant.name || "",
  email: merchant.email || "",
  business_name: merchant.business_name || merchant.name || merchant.email || "Unbekannter Händler",
  balance: Number(merchant.balance || 0),
  errors_24h: Number(merchant.errors_24h || 0),
  is_online: Boolean(merchant.is_online),
  is_suspended: Boolean(merchant.is_suspended),
});

const toMoney = (value) => Number(value || 0).toFixed(2);

const StatusDot = ({ online, suspended }) => {
  const color = suspended ? "#EF4444" : online ? "#10B981" : "#6B7280";
  return <div className="w-2.5 h-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}60` }} />;
};

const useMerchantAdminTr = () => {
  const { lang } = useI18n();
  const locale = lang === "sq-XK" ? "sq" : lang === "en-US" ? "en" : lang === "ar-AE" ? "ar" : lang;
  return useCallback((values) => values?.[locale] ?? values?.en ?? values?.de ?? "", [locale]);
};

const MerchantAdminPage = ({ onNavigate, onBack }) => {
  const tr = useMerchantAdminTr();
  const [merchants, setMerchants] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  const loadMerchants = useCallback(async () => {
    setLoading(true);
    try {
      const status = filter === "all" ? "" : `&status=${encodeURIComponent(filter)}`;
      const d = await api(`/api/admin/merchants/list?limit=200${status}`);
      setMerchants(Array.isArray(d.merchants) ? d.merchants.map(normalizeMerchantRow) : []);
      setTotal(d.total || 0);
    } catch (e) {
      toast.error(`${tr({ de: "Fehler beim Laden", en: "Error loading", sq: "Gabim gjatë ngarkimit", ar: "خطأ أثناء التحميل" })}: ${e.message}`);
    }
    setLoading(false);
  }, [filter, tr]);

  useEffect(() => { loadMerchants(); }, [loadMerchants]);

  const loadDetail = async (email) => {
    if (!email) {
      toast.error(tr({ de: "Für diesen Händler fehlt die E-Mail-Adresse.", en: "This merchant is missing an email address.", sq: "Për këtë tregtar mungon emaili.", ar: "البريد الإلكتروني لهذا التاجر غير موجود." }));
      return;
    }
    try {
      const d = await api(`/api/admin/merchants/${encodeURIComponent(email)}/detail`);
      setDetail(d);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleRestart = async (email) => {
    if (!email) {
      toast.error(tr({ de: "Neustart nicht möglich: Händler ohne E-Mail.", en: "Restart not possible: merchant without email.", sq: "Rinisja nuk është e mundur: tregtar pa email.", ar: "إعادة التشغيل غير ممكنة: تاجر بدون بريد إلكتروني." }));
      return;
    }
    if (!window.confirm(tr({ de: `Session von ${email} neustarten?`, en: `Restart session for ${email}?`, sq: `Të riniset sesioni për ${email}?`, ar: `إعادة تشغيل جلسة ${email}؟` }))) return;
    try {
      const d = await api(`/api/admin/merchants/${encodeURIComponent(email)}/restart`, { method: "POST" });
      toast.success(d.message);
      loadMerchants();
    } catch (e) { toast.error(e.message); }
  };

  const handleSuspend = async (email) => {
    if (!email) {
      toast.error(tr({ de: "Aktion nicht möglich: Händler ohne E-Mail.", en: "Action not possible: merchant without email.", sq: "Veprimi nuk është i mundur: tregtar pa email.", ar: "الإجراء غير ممكن: تاجر بدون بريد إلكتروني." }));
      return;
    }
    try {
      const d = await api(`/api/admin/merchants/${encodeURIComponent(email)}/suspend`, { method: "POST" });
      toast.success(d.message);
      loadMerchants();
      if (detail) loadDetail(email);
    } catch (e) { toast.error(e.message); }
  };

  const handleAssignId = async (email) => {
    if (!email) {
      toast.error(tr({ de: "ID-Vergabe nicht möglich: Händler ohne E-Mail.", en: "Cannot assign ID: merchant without email.", sq: "Nuk mund të caktohet ID: tregtar pa email.", ar: "لا يمكن تعيين المعرّف: تاجر بدون بريد إلكتروني." }));
      return;
    }
    try {
      const d = await api(`/api/admin/merchants/${encodeURIComponent(email)}/assign-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      toast.success(d.message);
      loadMerchants();
      if (detail) loadDetail(email);
    } catch (e) { toast.error(e.message); }
  };

  const handleBulkAssign = async () => {
    try {
      const d = await api("/api/admin/merchants/bulk-assign-ids", { method: "POST" });
      toast.success(d.message);
      loadMerchants();
    } catch (e) { toast.error(e.message); }
  };

  const filtered = merchants.filter(m =>
    !search ||
    (m.business_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.merchant_id || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.id || "").toLowerCase().includes(search.toLowerCase())
  );

  const timeAgo = (iso) => {
    if (!iso) return "-";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return tr({ de: "Gerade eben", en: "Just now", sq: "Sapo tani", ar: "الآن" });
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
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
              <Store size={14} className="text-[#FFB800]" /> {tr({ de: "Händler-Verwaltung", en: "Merchant admin", sq: "Menaxhimi i tregtarëve", ar: "إدارة التجار" })}
            </h1>
            <p className="text-[10px] text-white/30">{total} {tr({ de: "Händler registriert", en: "merchants registered", sq: "tregtarë të regjistruar", ar: "تاجرًا مسجلاً" })}</p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleBulkAssign}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
          style={{ background: "rgba(255,184,0,0.15)", color: "#FFB800" }}
        >
          <Hash size={10} className="inline mr-1" />{tr({ de: "IDs vergeben", en: "Assign IDs", sq: "Cakto ID", ar: "تعيين المعرّفات" })}
        </motion.button>
      </div>

      <div className="px-4 pt-3 space-y-3">
        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              data-testid="merchant-search"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl text-[12px] text-white placeholder:text-white/20"
              style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
              placeholder={tr({ de: "Name, E-Mail oder ID suchen...", en: "Search name, email or ID...", sq: "Kërko emër, email ose ID...", ar: "ابحث بالاسم أو البريد أو المعرّف..." })}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 rounded-xl text-[11px] text-white"
            style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="all">{tr({ de: "Alle", en: "All", sq: "Të gjitha", ar: "الكل" })}</option>
            <option value="active">{tr({ de: "Aktiv", en: "Active", sq: "Aktiv", ar: "نشط" })}</option>
            <option value="suspended">{tr({ de: "Gesperrt", en: "Suspended", sq: "I bllokuar", ar: "موقوف" })}</option>
          </select>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-xl" style={{ background: "rgba(16,185,129,0.08)" }}>
            <p className="text-[14px] font-bold text-emerald-400">{merchants.filter(m => m.is_online).length}</p>
            <p className="text-[9px] text-white/30">{tr({ de: "Online", en: "Online", sq: "Online", ar: "متصل" })}</p>
          </div>
          <div className="text-center p-2 rounded-xl" style={{ background: "rgba(255,184,0,0.08)" }}>
            <p className="text-[14px] font-bold text-[#FFB800]">{merchants.filter(m => !m.merchant_id).length}</p>
            <p className="text-[9px] text-white/30">{tr({ de: "Ohne ID", en: "Without ID", sq: "Pa ID", ar: "بدون معرّف" })}</p>
          </div>
          <div className="text-center p-2 rounded-xl" style={{ background: "rgba(239,68,68,0.08)" }}>
            <p className="text-[14px] font-bold text-red-400">{merchants.filter(m => m.errors_24h > 0).length}</p>
            <p className="text-[9px] text-white/30">{tr({ de: "Mit Fehlern", en: "With errors", sq: "Me gabime", ar: "مع أخطاء" })}</p>
          </div>
        </div>

        {/* Merchant List */}
        {loading ? (
          <div className="text-center py-8 text-white/30 text-[12px]">{tr({ de: "Laden...", en: "Loading...", sq: "Po ngarkohet...", ar: "جارٍ التحميل..." })}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-[12px]">{tr({ de: "Keine Händler gefunden", en: "No merchants found", sq: "Nuk u gjetën tregtarë", ar: "لم يتم العثور على تجار" })}</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((m, index) => (
              <motion.div
                key={m.email || m.merchant_id || m.user_id || `merchant-${index}`}
                data-testid={`merchant-card-${m.email || m.merchant_id || index}`}
                className="rounded-2xl p-3"
                style={{ background: "#0A0A0A", border: `1px solid ${m.is_suspended ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)"}` }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (!m.email) return;
                  setSelected(m.email);
                  loadDetail(m.email);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,184,0,0.1)" }}>
                    <Store size={18} className="text-[#FFB800]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold text-white truncate">{m.business_name || m.name}</p>
                      <StatusDot online={m.is_online} suspended={m.is_suspended} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {m.merchant_id ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,184,0,0.12)", color: "#FFB800" }}>
                          {m.merchant_id}
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>
                          {tr({ de: "Keine ID", en: "No ID", sq: "Pa ID", ar: "بدون معرّف" })}
                        </span>
                      )}
                      <span className="text-[10px] text-white/30 truncate">{m.email}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    {Number(m.errors_24h || 0) > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold">
                        {m.errors_24h}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-white/20 mt-1" />
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 mt-2.5 pt-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={e => { e.stopPropagation(); handleRestart(m.email); }}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
                    style={{ background: "rgba(0,194,255,0.1)", color: "#00C2FF" }}
                  >
                    <RotateCcw size={10} /> {tr({ de: "Neustart", en: "Restart", sq: "Rinis", ar: "إعادة تشغيل" })}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={e => { e.stopPropagation(); handleSuspend(m.email); }}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
                    style={{ background: m.is_suspended ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: m.is_suspended ? "#10B981" : "#EF4444" }}
                  >
                    {m.is_suspended ? <><CheckCircle size={10} /> {tr({ de: "Aktivieren", en: "Activate", sq: "Aktivizo", ar: "تفعيل" })}</> : <><Ban size={10} /> {tr({ de: "Sperren", en: "Suspend", sq: "Blloko", ar: "إيقاف" })}</>}
                  </motion.button>
                  {!m.merchant_id && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={e => { e.stopPropagation(); handleAssignId(m.email); }}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
                      style={{ background: "rgba(255,184,0,0.1)", color: "#FFB800" }}
                    >
                      <Tag size={10} /> {tr({ de: "ID vergeben", en: "Assign ID", sq: "Cakto ID", ar: "تعيين المعرّف" })}
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && detail && (
          <motion.div
            className="fixed inset-0 z-[10000] flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setSelected(null)} />
            <motion.div
              className="relative w-full max-h-[85vh] overflow-y-auto rounded-t-3xl"
              style={{ background: "#0A0A0A", maxWidth: 500 }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
            >
              <div className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between rounded-t-3xl" style={{ background: "#0A0A0A", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <h2 className="text-[14px] font-bold text-white">{detail.merchant?.business_name || detail.merchant?.name}</h2>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSelected(null)}>
                  <X size={18} className="text-white/40" />
                </motion.button>
              </div>

              <div className="px-4 py-4 space-y-4">
                {/* Merchant Info */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <p className="text-[9px] text-white/30">{tr({ de: "Händler-ID", en: "Merchant ID", sq: "ID e tregtarit", ar: "معرّف التاجر" })}</p>
                    <p className="text-[13px] font-mono font-bold text-[#FFB800]">{detail.merchant?.merchant_id || tr({ de: "Keine", en: "None", sq: "Asnjë", ar: "لا يوجد" })}</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <p className="text-[9px] text-white/30">{tr({ de: "Guthaben", en: "Balance", sq: "Bilanci", ar: "الرصيد" })}</p>
                    <p className="text-[13px] font-bold text-emerald-400">EUR {toMoney(detail.merchant?.balance)}</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <p className="text-[9px] text-white/30">{tr({ de: "Umsatz gesamt", en: "Total revenue", sq: "Të ardhurat totale", ar: "إجمالي الإيرادات" })}</p>
                    <p className="text-[13px] font-bold text-white">EUR {toMoney(detail.revenue_total)}</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <p className="text-[9px] text-white/30">{tr({ de: "Transaktionen", en: "Transactions", sq: "Transaksionet", ar: "المعاملات" })}</p>
                    <p className="text-[13px] font-bold text-white">{detail.transaction_count}</p>
                  </div>
                </div>

                {/* Sessions */}
                {detail.sessions?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-white/60 mb-2 flex items-center gap-1"><Smartphone size={11} /> {tr({ de: "Geräte / Sessions", en: "Devices / sessions", sq: "Pajisje / sesione", ar: "الأجهزة / الجلسات" })}</p>
                    {detail.sessions.map((s, i) => (
                      <div key={i} className="p-2 rounded-lg mb-1" style={{ background: "rgba(255,255,255,0.03)" }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/50">{s.device_info || tr({ de: "Unbekannt", en: "Unknown", sq: "E panjohur", ar: "غير معروف" })}</span>
                          <span className={`text-[9px] font-bold ${s.status === "online" ? "text-emerald-400" : s.status === "force_restart" ? "text-red-400" : "text-white/30"}`}>
                            {s.status}
                          </span>
                        </div>
                        <p className="text-[9px] text-white/25">{tr({ de: "Letzte Aktivität", en: "Last activity", sq: "Aktiviteti i fundit", ar: "آخر نشاط" })}: {timeAgo(s.last_active)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Error Logs */}
                {detail.recent_errors?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-red-400/80 mb-2 flex items-center gap-1"><AlertTriangle size={11} /> {tr({ de: "Fehler-Log", en: "Error log", sq: "Regjistri i gabimeve", ar: "سجل الأخطاء" })}</p>
                    {detail.recent_errors.slice(0, 5).map((e, i) => (
                      <div key={i} className="p-2 rounded-lg mb-1" style={{ background: "rgba(239,68,68,0.05)" }}>
                        <p className="text-[10px] text-white/60">{e.message}</p>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[9px] text-white/25">{e.type}</span>
                          <span className="text-[9px] text-white/25">{timeAgo(e.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent Transactions */}
                {detail.recent_transactions?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-white/60 mb-2 flex items-center gap-1"><Zap size={11} /> {tr({ de: "Letzte Transaktionen", en: "Recent transactions", sq: "Transaksionet e fundit", ar: "آخر المعاملات" })}</p>
                    {detail.recent_transactions.slice(0, 5).map((t, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                        <div>
                          <p className="text-[10px] text-white/60">{t.description || t.type}</p>
                          <p className="text-[9px] text-white/25">{timeAgo(t.created_at)}</p>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-emerald-400">EUR {(t.amount || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MerchantAdminPage;
