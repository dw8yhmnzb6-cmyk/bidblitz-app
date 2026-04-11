/**
 * BidBlitz V2 - My Car Bookings Page
 * Customer's booking history and management
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Car, Calendar, Clock, MapPin, ChevronRight, Loader2,
  Check, X, AlertCircle, FileText, Receipt
} from "lucide-react";
import { getMyBookings, cancelMyBooking } from "../api";

const STATUS_CONFIG = {
  pending: { label: "Ausstehend", color: "#FFB800", bg: "rgba(255,184,0,0.1)" },
  confirmed: { label: "Bestätigt", color: "#00C2FF", bg: "rgba(0,194,255,0.1)" },
  ready_for_handover: { label: "Bereit", color: "#00D26A", bg: "rgba(0,210,106,0.1)" },
  active: { label: "Aktiv", color: "#00D26A", bg: "rgba(0,210,106,0.1)" },
  completed: { label: "Abgeschlossen", color: "#666", bg: "rgba(102,102,102,0.1)" },
  cancelled: { label: "Storniert", color: "#FF4757", bg: "rgba(255,71,87,0.1)" },
  rejected: { label: "Abgelehnt", color: "#FF4757", bg: "rgba(255,71,87,0.1)" },
};

export default function MyCarBookingsPage({ onBack, onNavigate }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const data = await getMyBookings();
      setBookings(data.bookings || []);
    } catch (err) {
      console.error("Error loading bookings:", err);
    }
    setLoading(false);
  };

  const handleCancel = async (bookingId) => {
    if (!window.confirm("Möchtest du diese Buchung wirklich stornieren?")) return;
    
    setCancellingId(bookingId);
    try {
      const result = await cancelMyBooking(bookingId);
      if (result.ok) {
        loadBookings();
      }
    } catch (err) {
      console.error("Error cancelling:", err);
    }
    setCancellingId(null);
  };

  const filteredBookings = bookings.filter(b => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return ["pending", "confirmed", "ready_for_handover", "active"].includes(b.status);
    if (activeTab === "past") return ["completed", "cancelled", "rejected"].includes(b.status);
    return true;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 p-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="p-2 rounded-xl bg-white/5 border border-white/10"
          >
            <ArrowLeft size={20} />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold">Meine Buchungen</h1>
            <p className="text-xs text-[#666]">{bookings.length} Buchungen</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pb-4">
          {[
            { id: "all", label: "Alle" },
            { id: "active", label: "Aktiv" },
            { id: "past", label: "Vergangen" },
          ].map(tab => (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-[#00C2FF] text-black"
                  : "bg-white/5 text-[#888]"
              }`}
            >
              {tab.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" />
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-20">
            <Car size={48} className="mx-auto text-[#333] mb-4" />
            <h3 className="text-lg font-semibold text-white/70">Keine Buchungen</h3>
            <p className="text-sm text-[#666] mt-2">
              {activeTab === "all" 
                ? "Du hast noch keine Buchungen" 
                : activeTab === "active"
                ? "Keine aktiven Buchungen"
                : "Keine vergangenen Buchungen"
              }
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate("/car-rental")}
              className="mt-6 px-6 py-3 rounded-xl bg-[#00C2FF] text-black font-semibold"
            >
              Fahrzeug mieten
            </motion.button>
          </div>
        ) : (
          filteredBookings.map((booking, idx) => {
            const status = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
            const canCancel = ["pending", "confirmed"].includes(booking.status);
            
            return (
              <motion.div
                key={booking.booking_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-[#111118] rounded-2xl overflow-hidden border border-white/5"
              >
                {/* Header */}
                <div 
                  onClick={() => onNavigate(`/car-rental/my-bookings/${booking.booking_id}`)}
                  className="p-4 cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#00C2FF]/10 flex items-center justify-center">
                        <Car size={24} className="text-[#00C2FF]" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{booking.car_title}</h3>
                        <p className="text-xs text-[#666]">{booking.car_brand} {booking.car_model}</p>
                      </div>
                    </div>
                    <span
                      className="px-2.5 py-1 rounded-lg text-xs font-medium"
                      style={{ background: status.bg, color: status.color }}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="flex items-center gap-2 text-sm text-[#888]">
                      <Calendar size={14} className="text-[#00C2FF]" />
                      {formatDate(booking.start_date)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#888]">
                      <Clock size={14} className="text-[#00C2FF]" />
                      {booking.rental_days} Tag(e)
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div>
                      <p className="text-xs text-[#666]">Gesamtpreis</p>
                      <p className="text-lg font-bold text-[#00C2FF]">€{booking.total_amount?.toFixed(2)}</p>
                    </div>
                    <ChevronRight size={20} className="text-[#666]" />
                  </div>
                </div>

                {/* Actions */}
                {canCancel && (
                  <div className="px-4 pb-4 flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleCancel(booking.booking_id)}
                      disabled={cancellingId === booking.booking_id}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 flex items-center justify-center gap-2"
                    >
                      {cancellingId === booking.booking_id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          <X size={14} />
                          Stornieren
                        </>
                      )}
                    </motion.button>
                  </div>
                )}

                {/* Booking ID */}
                <div className="px-4 pb-3 flex items-center justify-between text-xs text-[#555]">
                  <span>Buchung: {booking.booking_id}</span>
                  <span>{formatDate(booking.created_at)}</span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
