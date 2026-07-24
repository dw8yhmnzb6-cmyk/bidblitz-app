/**
 * BidBlitz V2 - Vendor Booking Detail
 * Full booking lifecycle management: approve, handover, return
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Car, Calendar, Clock, User, Euro, Loader2,
  CheckCircle, XCircle, Truck, RotateCcw, FileText, AlertTriangle,
  MapPin, Fuel, CreditCard, ClipboardCheck
} from "lucide-react";
import {
  getVendorBooking, approveBooking, rejectBooking,
  markReadyForHandover, completeHandover, completeReturn,
  vendorCancelBooking, generateContract, generateInvoice
} from "../api";
import { useI18n } from "../../../store/I18nContext";

const STATUS_CFG = {
  pending: { label: "Ausstehend", color: "#FFB800" },
  confirmed: { label: "Bestätigt", color: "#00C2FF" },
  ready_for_handover: { label: "Bereit zur Übergabe", color: "#00D26A" },
  active: { label: "Aktiv (Vermietet)", color: "#00D26A" },
  completed: { label: "Abgeschlossen", color: "#888" },
  cancelled: { label: "Storniert", color: "#FF4757" },
  rejected: { label: "Abgelehnt", color: "#FF4757" },
};

export default function VendorBookingDetailPage({ bookingId, onBack, onNavigate }) {
  const { t } = useI18n();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showHandover, setShowHandover] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [handoverForm, setHandoverForm] = useState({ mileage: "", fuel_level: 100, notes: "" });
  const [returnForm, setReturnForm] = useState({ mileage: "", fuel_level: 100, notes: "", cleaning_needed: false, new_damages: "" });

  useEffect(() => { load(); }, [bookingId]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getVendorBooking(bookingId);
      setBooking(data.booking);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const doAction = async (action) => {
    setActionLoading(action);
    try {
      if (action === "approve") await approveBooking(bookingId);
      else if (action === "reject") {
        const reason = window.prompt("Ablehnungsgrund:");
        await rejectBooking(bookingId, reason);
      }
      else if (action === "ready") await markReadyForHandover(bookingId);
      else if (action === "cancel") {
        if (!window.confirm("Wirklich stornieren?")) { setActionLoading(null); return; }
        await vendorCancelBooking(bookingId);
      }
      else if (action === "contract") await generateContract(bookingId);
      else if (action === "invoice") await generateInvoice({ booking_id: bookingId });
      load();
    } catch (err) { alert(err.message); }
    setActionLoading(null);
  };

  const doHandover = async () => {
    setActionLoading("handover");
    try {
      await completeHandover(bookingId, {
        mileage: parseInt(handoverForm.mileage),
        fuel_level: parseInt(handoverForm.fuel_level),
        notes: handoverForm.notes,
        photos: [], existing_damages: [], accessories: {},
      });
      setShowHandover(false);
      load();
    } catch (err) { alert(err.message); }
    setActionLoading(null);
  };

  const doReturn = async () => {
    setActionLoading("return");
    try {
      await completeReturn(bookingId, {
        mileage: parseInt(returnForm.mileage),
        fuel_level: parseInt(returnForm.fuel_level),
        notes: returnForm.notes,
        cleaning_needed: returnForm.cleaning_needed,
        new_damages: returnForm.new_damages ? returnForm.new_damages.split(",").map(d => d.trim()) : [],
        photos: [],
      });
      setShowReturn(false);
      load();
    } catch (err) { alert(err.message); }
    setActionLoading(null);
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" />
    </div>
  );

  if (!booking) return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center p-4 text-white">
      <p className="text-white/70 mb-4">Buchung nicht gefunden</p>
      <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
        className="px-6 py-2 rounded-xl bg-[#00C2FF] text-black font-medium">Zurück</motion.button>
    </div>
  );

  const st = STATUS_CFG[booking.status] || STATUS_CFG.pending;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-32">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
          className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="booking-detail-back">
          <ArrowLeft size={20} />
        </motion.button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Buchung #{bookingId?.slice(0, 8)}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: `${st.color}20`, color: st.color }}>{st.label}</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Car Info */}
        <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-[#00C2FF]/10 flex items-center justify-center">
              <Car size={24} className="text-[#00C2FF]" />
            </div>
            <div>
              <h3 className="font-semibold">{booking.car_title || "Fahrzeug"}</h3>
              <p className="text-xs text-[#666]">{booking.car_brand} {booking.car_model}</p>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><User size={16} className="text-[#00C2FF]" /> Kunde</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[#888]">Name</span><span>{booking.customer_name}</span></div>
            <div className="flex justify-between"><span className="text-[#888]">E-Mail</span><span className="text-[#00C2FF]">{booking.customer_email}</span></div>
          </div>
        </div>

        {/* Booking Details */}
        <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar size={16} className="text-[#00C2FF]" /> Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[#888]">Zeitraum</span><span>{fmtDate(booking.start_date)} - {fmtDate(booking.end_date)}</span></div>
            <div className="flex justify-between"><span className="text-[#888]">Tage</span><span>{booking.rental_days}</span></div>
            <div className="flex justify-between"><span className="text-[#888]">Abholung</span><span>{booking.pickup_time || "10:00"}</span></div>
            <div className="flex justify-between"><span className="text-[#888]">Rückgabe</span><span>{booking.return_time || "10:00"}</span></div>
            {booking.notes && <div className="pt-2 border-t border-white/5"><p className="text-[#888]">Notizen: {booking.notes}</p></div>}
          </div>
        </div>

        {/* Payment */}
        <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Euro size={16} className="text-[#00C2FF]" /> Zahlung</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[#888]">Mietpreis</span><span>€{booking.rental_amount?.toFixed(2)}</span></div>
            {booking.extras_amount > 0 && <div className="flex justify-between"><span className="text-[#888]">Extras</span><span>€{booking.extras_amount?.toFixed(2)}</span></div>}
            <div className="flex justify-between"><span className="text-[#888]">MwSt.</span><span>€{booking.tax_amount?.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-[#888]">Kaution</span><span>€{booking.deposit_amount?.toFixed(2)}</span></div>
            <div className="flex justify-between pt-2 border-t border-white/10 text-base font-bold">
              <span>Gesamt</span><span className="text-[#00C2FF]">€{booking.total_amount?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between"><span className="text-[#888]">Provision</span><span>€{booking.commission_amount?.toFixed(2)}</span></div>
          </div>
        </div>

        {/* Handover record if exists */}
        {booking.handover && (
          <div className="bg-green-500/5 rounded-2xl p-4 border border-green-500/20">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><ClipboardCheck size={16} className="text-green-400" /> Übergabe-Protokoll</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-[#888]">KM-Stand</span><span>{booking.handover.mileage} km</span></div>
              <div className="flex justify-between"><span className="text-[#888]">Tankstand</span><span>{booking.handover.fuel_level}%</span></div>
              <div className="flex justify-between"><span className="text-[#888]">Datum</span><span>{fmtDate(booking.handover.recorded_at)}</span></div>
            </div>
          </div>
        )}

        {/* Return record if exists */}
        {booking.return_record && (
          <div className="bg-blue-500/5 rounded-2xl p-4 border border-blue-500/20">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><RotateCcw size={16} className="text-blue-400" /> Rückgabe-Protokoll</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-[#888]">KM-Stand</span><span>{booking.return_record.mileage} km</span></div>
              <div className="flex justify-between"><span className="text-[#888]">Tankstand</span><span>{booking.return_record.fuel_level}%</span></div>
              <div className="flex justify-between"><span className="text-[#888]">Datum</span><span>{fmtDate(booking.return_record.recorded_at)}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0A0A0F]/95 backdrop-blur-xl border-t border-white/5 p-4 space-y-2 z-30">
        {booking.status === "pending" && (
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => doAction("approve")}
              disabled={actionLoading === "approve"}
              className="flex-1 py-3 rounded-xl bg-green-500/20 text-green-400 font-semibold text-sm flex items-center justify-center gap-2"
              data-testid="detail-approve-btn">
              {actionLoading === "approve" ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle size={16} /> Annehmen</>}
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => doAction("reject")}
              className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-400 font-semibold text-sm flex items-center justify-center gap-2"
              data-testid="detail-reject-btn">
              <XCircle size={16} /> Ablehnen
            </motion.button>
          </div>
        )}

        {booking.status === "confirmed" && (
          <div className="space-y-2">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => doAction("contract")}
              disabled={!!actionLoading}
              className="w-full py-3 rounded-xl bg-[#FFB800]/20 text-[#FFB800] font-semibold text-sm flex items-center justify-center gap-2"
              data-testid="generate-contract-btn">
              <FileText size={16} /> Vertrag erstellen
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => doAction("ready")}
              disabled={!!actionLoading}
              className="w-full py-3 rounded-xl bg-[#00C2FF]/20 text-[#00C2FF] font-semibold text-sm flex items-center justify-center gap-2"
              data-testid="mark-ready-btn">
              {actionLoading === "ready" ? <Loader2 size={16} className="animate-spin" /> : <><Truck size={16} /> Bereit zur Übergabe</>}
            </motion.button>
          </div>
        )}

        {booking.status === "ready_for_handover" && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowHandover(true)}
            className="w-full py-3.5 rounded-xl bg-[#00D26A] text-black font-bold text-sm flex items-center justify-center gap-2"
            data-testid="start-handover-btn">
            <Truck size={16} /> Fahrzeug übergeben
          </motion.button>
        )}

        {booking.status === "active" && (
          <div className="space-y-2">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowReturn(true)}
              className="w-full py-3.5 rounded-xl bg-[#00C2FF] text-black font-bold text-sm flex items-center justify-center gap-2"
              data-testid="start-return-btn">
              <RotateCcw size={16} /> Fahrzeug zurücknehmen
            </motion.button>
          </div>
        )}

        {booking.status === "completed" && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => doAction("invoice")}
            disabled={!!actionLoading}
            className="w-full py-3 rounded-xl bg-[#FFB800]/20 text-[#FFB800] font-semibold text-sm flex items-center justify-center gap-2"
            data-testid="generate-invoice-btn">
            <CreditCard size={16} /> Rechnung erstellen
          </motion.button>
        )}
      </div>

      {/* Handover Modal */}
      {showHandover && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowHandover(false)}>
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[#111118] rounded-t-3xl p-6">
            <h3 className="text-lg font-bold mb-4">Fahrzeugübergabe</h3>
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-xs text-[#666] mb-1 block">KM-Stand *</label>
                <input type="number" value={handoverForm.mileage}
                  onChange={e => setHandoverForm(f => ({ ...f, mileage: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none"
                  placeholder="z.B. 45000" data-testid="handover-mileage" />
              </div>
              <div>
                <label className="text-xs text-[#666] mb-1 block">Tankstand (%)</label>
                <input type="number" min="0" max="100" value={handoverForm.fuel_level}
                  onChange={e => setHandoverForm(f => ({ ...f, fuel_level: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none"
                  data-testid="handover-fuel" />
              </div>
              <div>
                <label className="text-xs text-[#666] mb-1 block">Notizen</label>
                <textarea value={handoverForm.notes} rows={2}
                  onChange={e => setHandoverForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none resize-none" />
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={doHandover}
              disabled={!handoverForm.mileage || actionLoading === "handover"}
              className="w-full py-4 rounded-xl bg-[#00D26A] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="confirm-handover-btn">
              {actionLoading === "handover" ? <Loader2 size={20} className="animate-spin" /> : <><CheckCircle size={20} /> Übergabe bestätigen</>}
            </motion.button>
          </motion.div>
        </div>
      )}

      {/* Return Modal */}
      {showReturn && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowReturn(false)}>
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }}
            onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[#111118] rounded-t-3xl p-6">
            <h3 className="text-lg font-bold mb-4">Fahrzeugrückgabe</h3>
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-xs text-[#666] mb-1 block">KM-Stand *</label>
                <input type="number" value={returnForm.mileage}
                  onChange={e => setReturnForm(f => ({ ...f, mileage: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none"
                  placeholder="z.B. 45500" data-testid="return-mileage" />
              </div>
              <div>
                <label className="text-xs text-[#666] mb-1 block">Tankstand (%)</label>
                <input type="number" min="0" max="100" value={returnForm.fuel_level}
                  onChange={e => setReturnForm(f => ({ ...f, fuel_level: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none"
                  data-testid="return-fuel" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={returnForm.cleaning_needed}
                  onChange={e => setReturnForm(f => ({ ...f, cleaning_needed: e.target.checked }))}
                  className="rounded" />
                Reinigung nötig
              </label>
              <div>
                <label className="text-xs text-[#666] mb-1 block">Neue Schäden (kommagetrennt)</label>
                <input type="text" value={returnForm.new_damages}
                  onChange={e => setReturnForm(f => ({ ...f, new_damages: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none"
                  placeholder="z.B. Kratzer linke Tür" data-testid="return-damages" />
              </div>
              <div>
                <label className="text-xs text-[#666] mb-1 block">Notizen</label>
                <textarea value={returnForm.notes} rows={2}
                  onChange={e => setReturnForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none resize-none" />
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={doReturn}
              disabled={!returnForm.mileage || actionLoading === "return"}
              className="w-full py-4 rounded-xl bg-[#00C2FF] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="confirm-return-btn">
              {actionLoading === "return" ? <Loader2 size={20} className="animate-spin" /> : <><RotateCcw size={20} /> Rückgabe bestätigen</>}
            </motion.button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
