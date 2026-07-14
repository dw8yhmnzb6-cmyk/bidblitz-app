/**
 * POS Extended Features Page — Kassensturz, Split-Payment, Offline-Sync
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useI18n } from "../store/I18nContext";
import {
  ChevronLeft, DollarSign, Receipt, Download, Upload,
  Loader2, Clock, Layers,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Fehler");
  return d;
}

export default function POSExtendedPage({ onBack }) {
  const { lang } = useI18n();
  const locale = lang === "sq-XK" ? "sq" : lang === "en-US" ? "en" : lang === "ar-AE" ? "ar" : lang;
  const tr = (values) => values?.[locale] ?? values?.en ?? values?.de ?? "";
  const [tab, setTab] = useState("closing"); // closing | history | offline
  const [cashCounted, setCashCounted] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await api("/api/pos-extended/cash-register/history");
      setHistory(res.history || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const closeDay = async () => {
    const counted = parseFloat(cashCounted);
    if (isNaN(counted) || counted < 0) {
      toast.error(tr({ de: "Bitte gültigen Betrag eingeben", en: "Please enter a valid amount", sq: "Ju lutem vendosni një shumë të vlefshme", ar: "يرجى إدخال مبلغ صالح" }));
      return;
    }

    setLoading(true);
    try {
      const res = await api("/api/pos-extended/cash-register/close-day", {
        method: "POST",
        body: JSON.stringify({ cash_counted: counted }),
      });
      toast.success(tr({ de: "Tagesabschluss erfolgreich", en: "Day closing successful", sq: "Mbyllja ditore u krye me sukses", ar: "تم إغلاق اليوم بنجاح" }));
      setCashCounted("");
      console.log(res.closing);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadOfflineData = async () => {
    try {
      const res = await api("/api/pos-extended/offline/download-data");
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pos-offline-${Date.now()}.json`;
      a.click();
      toast.success(tr({ de: "Offline-Daten heruntergeladen", en: "Offline data downloaded", sq: "Të dhënat offline u shkarkuan", ar: "تم تنزيل بيانات الأوفلاين" }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{tr({ de: "POS Extended", en: "POS Extended", sq: "POS Extended", ar: "POS Extended" })}</h1>
            <p className="text-xs text-gray-600">{tr({ de: "Kassensturz, Offline, Drucker", en: "Cash count, offline, printer", sq: "Arkë, offline, printer", ar: "الجرد النقدي، الأوفلاين، الطابعة" })}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-200">
          <button
            onClick={() => setTab("closing")}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === "closing" ? "text-purple-600 border-b-2 border-purple-600" : "text-gray-600"
            }`}
          >
            <DollarSign size={16} className="inline mr-1" />
            {tr({ de: "Kassensturz", en: "Cash count", sq: "Arkë", ar: "الجرد النقدي" })}
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === "history" ? "text-purple-600 border-b-2 border-purple-600" : "text-gray-600"
            }`}
          >
            <Clock size={16} className="inline mr-1" />
            {tr({ de: "Historie", en: "History", sq: "Historiku", ar: "السجل" })}
          </button>
          <button
            onClick={() => setTab("offline")}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === "offline" ? "text-purple-600 border-b-2 border-purple-600" : "text-gray-600"
            }`}
          >
            <Download size={16} className="inline mr-1" />
            {tr({ de: "Offline", en: "Offline", sq: "Offline", ar: "أوفلاين" })}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Kassensturz */}
        {tab === "closing" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h2 className="text-lg font-bold mb-4">{tr({ de: "Tagesabschluss durchführen", en: "Run day closing", sq: "Kryej mbylljen ditore", ar: "نفّذ إغلاق اليوم" })}</h2>
              <p className="text-sm text-gray-600 mb-4">
                {tr({ de: "Zähle das Bargeld in der Kasse und gib den Betrag ein.", en: "Count the cash in the register and enter the amount.", sq: "Numëro cash-in në arkë dhe vendos shumën.", ar: "احسب النقد في الصندوق وأدخل المبلغ." })}
              </p>
              <input
                type="number"
                step="0.01"
                placeholder={tr({ de: "Bargeld gezählt (€)", en: "Counted cash (€)", sq: "Cash i numëruar (€)", ar: "النقد المعدود (€)" })}
                value={cashCounted}
                onChange={(e) => setCashCounted(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg mb-4"
              />
              <button
                onClick={closeDay}
                disabled={loading}
                className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <DollarSign size={20} />}
                {tr({ de: "Abschluss durchführen", en: "Run closing", sq: "Kryej mbylljen", ar: "نفّذ الإغلاق" })}
              </button>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center hover:bg-gray-50">
                <Receipt size={32} className="mx-auto mb-2 text-blue-600" />
                <p className="text-sm font-medium">{tr({ de: "Bon drucken", en: "Print receipt", sq: "Printo bonin", ar: "اطبع الإيصال" })}</p>
              </button>
              <button className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center hover:bg-gray-50">
                <Layers size={32} className="mx-auto mb-2 text-green-600" />
                <p className="text-sm font-medium">{tr({ de: "Split-Payment", en: "Split payment", sq: "Pagesë e ndarë", ar: "دفع مقسّم" })}</p>
              </button>
            </div>
          </div>
        )}

        {/* Historie */}
        {tab === "history" && (
          <div>
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-purple-600" />
              </div>
            )}

            {!loading && history.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Clock size={48} className="mx-auto mb-2 opacity-50" />
                <p>{tr({ de: "Keine Abschlüsse gefunden", en: "No closings found", sq: "Nuk u gjetën mbyllje", ar: "لم يتم العثور على عمليات إغلاق" })}</p>
              </div>
            )}

            <div className="space-y-3">
              {history.map((closing, idx) => (
                <motion.div
                  key={idx}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold">{closing.date}</p>
                      <p className="text-xs text-gray-500">{closing.closing_id}</p>
                    </div>
                    <p className="text-lg font-bold text-purple-600">
                      €{closing.total_sales.toFixed(2)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-600">{tr({ de: "Transaktionen", en: "Transactions", sq: "Transaksionet", ar: "المعاملات" })}:</p>
                      <p className="font-medium">{closing.total_transactions}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">{tr({ de: "Bargeld", en: "Cash", sq: "Cash", ar: "النقد" })}:</p>
                      <p className="font-medium">€{closing.cash_sales.toFixed(2)}</p>
                    </div>
                  </div>
                  {closing.cash_difference !== 0 && (
                    <p className={`text-xs mt-2 ${closing.cash_difference > 0 ? "text-green-600" : "text-red-600"}`}>
                      {tr({ de: "Differenz", en: "Difference", sq: "Diferenca", ar: "الفرق" })}: €{closing.cash_difference.toFixed(2)}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Offline */}
        {tab === "offline" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 text-center">
              <Download size={48} className="mx-auto mb-3 text-purple-600" />
              <h3 className="font-bold mb-2">{tr({ de: "Offline-Modus", en: "Offline mode", sq: "Modaliteti offline", ar: "وضع الأوفلاين" })}</h3>
              <p className="text-sm text-gray-600 mb-4">
                {tr({ de: "Lade Produktdaten herunter, um offline zu arbeiten.", en: "Download product data to work offline.", sq: "Shkarko të dhënat e produkteve për të punuar offline.", ar: "نزّل بيانات المنتجات للعمل دون اتصال." })}
              </p>
              <button
                onClick={downloadOfflineData}
                className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
              >
                {tr({ de: "Daten herunterladen", en: "Download data", sq: "Shkarko të dhënat", ar: "تنزيل البيانات" })}
              </button>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 text-center">
              <Upload size={48} className="mx-auto mb-3 text-blue-600" />
              <h3 className="font-bold mb-2">{tr({ de: "Transaktionen synchronisieren", en: "Sync transactions", sq: "Sinkronizo transaksionet", ar: "مزامنة المعاملات" })}</h3>
              <p className="text-sm text-gray-600 mb-4">
                {tr({ de: "Synchronisiere Offline-Transaktionen nach Wiederverbindung.", en: "Sync offline transactions after reconnecting.", sq: "Sinkronizo transaksionet offline pas rilidhjes.", ar: "زامن معاملات الأوفلاين بعد إعادة الاتصال." })}
              </p>
              <button className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                {tr({ de: "Sync starten", en: "Start sync", sq: "Nis sinkronizimin", ar: "ابدأ المزامنة" })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
