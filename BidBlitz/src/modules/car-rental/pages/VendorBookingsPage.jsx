/**
 * BidBlitz V2 - Vendor Bookings Management
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Car, Calendar, Loader2, ChevronRight, Check, X,
  Clock, AlertCircle, Eye, CheckCircle, XCircle, Truck
} from "lucide-react";
import {
  getVendorBookings, approveBooking, rejectBooking, vendorCancelBooking,
  markReadyForHandover
} from "../api";
import { useI18n } from "../../../store/I18nContext";

const STATUS_CFG = {
  pending: { label: "Ausstehend", color: "#FFB800", bg: "rgba(255,184,0,0.1)" },
  confirmed: { label: "Bestätigt", color: "#00C2FF", bg: "rgba(0,194,255,0.1)" },
  ready_for_handover: { label: "Bereit", color: "#00D26A", bg: "rgba(0,210,106,0.1)" },
  active: { label: "Aktiv", color: "#00D26A", bg: "rgba(0,210,106,0.15)" },
  completed: { label: "Abgeschlossen", color: "#888", bg: "rgba(136,136,136,0.1)" },
  cancelled: { label: "Storniert", color: "#FF4757", bg: "rgba(255,71,87,0.1)" },
  rejected: { label: "Abgelehnt", color: "#FF4757", bg: "rgba(255,71,87,0.1)" },
};

const TABS = [
  { id: null, label: "Alle" },
  { id: "pending", label: "Neu" },
  { id: "confirmed", label: "Bestätigt" },
  { id: "active", label: "Aktiv" },
  { id: "completed", label: "Fertig" },
];

export default function VendorBookingsPage({ onBack, onNavigate }) {
  const { t } = useI18n();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => { loadBookings(); }, [activeTab]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const data = await getVendorBookings(activeTab);
      setBookings(data.bookings || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleAction = async (bookingId, action) => {
    setActionLoading(bookingId);
    try {
      if (action === "approve") await approveBooking(bookingId);
      else if (action === "reject") {
        const reason = window.prompt("Ablehnungsgrund (optional):");
        await rejectBooking(bookingId, reason);
      }
      else if (action === "ready") await markReadyForHandover(bookingId);
      else if (action === "cancel") {
        if (window.confirm("Buchung wirklich stornieren?")) await vendorCancelBooking(bookingId);
      }
      loadBookings();
    } catch (err) { console.error(err); alert(err.message); }
    setActionLoading(null);
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("de-DE") : "";

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 p-4">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
            className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="vendor-bookings-back">
            <ArrowLeft size={20} />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold">Buchungen</h1>
            <p className="text-xs text-[#666]">{bookings.length} Buchungen</p>
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <motion.button key={tab.id || "all"} whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id ? "bg-[#00C2FF] text-black" : "bg-white/5 text-[#888]"
              }`} data-testid={`booking-tab-${tab.id || "all"}`}>
              {tab.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" /></div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-20">
            <Calendar size={48} className="mx-auto text-[#333] mb-4" />
            <p className="text-white/70">Keine Buchungen</p>
          </div>
        ) : bookings.map((b, idx) => {
          const st = STATUS_CFG[b.status] || STATUS_CFG.pending;
          const isPending = b.status === "pending";
          const isConfirmed = b.status === "confirmed";
          const isActive = b.status === "active";
          const isLoading = actionLoading === b.booking_id;

          return (
            <motion.div key={b.booking_id} initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
              className="bg-[#111118] rounded-2xl border border-white/5"
              data-testid={`vendor-booking-${b.booking_id}`}>
              <div className="p-4 cursor-pointer"
                onClick={() => onNavigate(`/car-rental/vendor/bookings/${b.booking_id}`)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#00C2FF]/10 flex items-center justify-center">
                      <Car size={20} className="text-[#00C2FF]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{b.car_title || "Fahrzeug"}</h3>
                      <p className="text-xs text-[#666]">{b.customer_name || "Kunde"}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium"
                    style={{ background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-[#888] mb-3">
                  <div className="flex items-center gap-1"><Calendar size={12} className="text-[#00C2FF]" />{fmtDate(b.start_date)}</div>
                  <div className="flex items-center gap-1"><Clock size={12} className="text-[#00C2FF]" />{b.rental_days} Tag(e)</div>
                  <div className="text-right font-bold text-[#00C2FF] text-sm">€{b.total_amount?.toFixed(2)}</div>
                </div>
              </div>

              {/* Quick Actions */}
              {(isPending || isConfirmed) && (
                <div className="px-4 pb-4 flex gap-2">
                  {isPending && (
                    <>
                      <motion.button whileTap={{ scale: 0.95 }} disabled={isLoading}
                        onClick={() => handleAction(b.booking_id, "approve")}
                        className="flex-1 py-2 rounded-xl text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20 flex items-center justify-center gap-1.5"
                        data-testid={`approve-booking-${b.booking_id}`}>
                        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle size={14} /> Annehmen</>}
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.95 }} disabled={isLoading}
                        onClick={() => handleAction(b.booking_id, "reject")}
                        className="flex-1 py-2 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center gap-1.5"
                        data-testid={`reject-booking-${b.booking_id}`}>
                        <XCircle size={14} /> Ablehnen
                      </motion.button>
                    </>
                  )}
                  {isConfirmed && (
                    <motion.button whileTap={{ scale: 0.95 }} disabled={isLoading}
                      onClick={() => handleAction(b.booking_id, "ready")}
                      className="flex-1 py-2 rounded-xl text-sm font-medium bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20 flex items-center justify-center gap-1.5"
                      data-testid={`ready-booking-${b.booking_id}`}>
                      {isLoading ? <Loader2 size={14} className="animate-spin" /> : <><Truck size={14} /> Bereit zur Übergabe</>}
                    </motion.button>
                  )}
                </div>
              )}

              <div className="px-4 pb-3 text-xs text-[#555]">
                <span>#{b.booking_id?.slice(0,8)}</span>
                <span className="float-right">{fmtDate(b.created_at)}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
