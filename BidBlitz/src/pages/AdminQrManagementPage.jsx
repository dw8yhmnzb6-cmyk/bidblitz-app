/**
 * AdminQrManagementPage
 * =====================
 * Super-Admin Ansicht: Alle Merchants auflisten → Merchant auswählen → QR-Tisch-System verwalten
 */
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, Store, ChevronRight, Loader2, UtensilsCrossed, AlertCircle
} from "lucide-react";
import MerchantQrTablesPage from "./MerchantQrTablesPage";

const API = process.env.REACT_APP_BACKEND_URL;
const cred = { credentials: "include" };

async function readJson(res) {
  try { return await res.json(); } catch { return null; }
}

export default function AdminQrManagementPage({ onBack }) {
  const [merchants, setMerchants] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState(null);

  const loadMerchants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/merchants?search=${encodeURIComponent(search)}&limit=100`, cred);
      const data = await readJson(res);
      if (res.ok) {
        setMerchants(data?.merchants || []);
      }
    } catch (err) {
      console.error("Fehler beim Laden der Merchants:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadMerchants();
  }, [loadMerchants]);

  // Wenn ein Merchant ausgewählt wurde, zeige die QR-Verwaltung
  if (selectedMerchant) {
    return (
      <MerchantQrTablesPage
        onBack={() => setSelectedMerchant(null)}
        user={{ merchant_id: selectedMerchant.id, role: "admin" }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-base font-bold font-outfit">QR-Tisch-Verwaltung</h1>
            <p className="text-[10px] text-white/40">Merchant auswählen</p>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Merchant suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm
                focus:outline-none focus:border-[#00C2FF]/50 transition-colors placeholder:text-white/30"
            />
          </div>
        </div>
      </div>

      {/* Merchant Liste */}
      <div className="p-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-[#00C2FF]" />
          </div>
        ) : merchants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle size={40} className="text-white/20 mb-3" />
            <p className="text-sm text-white/40">
              {search ? "Keine Merchants gefunden" : "Keine Merchants vorhanden"}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {merchants.map((m, idx) => (
              <motion.button
                key={m.id}
                onClick={() => setSelectedMerchant(m)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5
                  hover:bg-white/[0.04] hover:border-white/10 transition-all text-left group"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                {/* Icon */}
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#00C2FF]/10 flex items-center justify-center">
                  <Store size={20} className="text-[#00C2FF]" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {m.business_name || "Unbekannter Merchant"}
                  </p>
                  <p className="text-[10px] text-white/40 truncate">
                    ID: {m.user_id || m.id}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[9px] text-white/30">
                      €{m.total_earnings?.toFixed(2) || "0.00"} Umsatz
                    </span>
                    <span className="text-[9px] text-white/30">
                      {m.total_transactions || 0} Transaktionen
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight size={18} className="text-white/20 group-hover:text-[#00C2FF] transition-colors" />
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Empty State Icon */}
      {!loading && merchants.length === 0 && !search && (
        <div className="px-4 pb-8">
          <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-8 text-center">
            <UtensilsCrossed size={48} className="mx-auto text-white/10 mb-3" />
            <p className="text-xs text-white/40">
              Erstelle zuerst Merchant-Accounts, um QR-Tisch-Bestellungen zu verwalten.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
