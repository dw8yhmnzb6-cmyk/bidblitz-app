/**
 * BidBlitz V2 - Customer Booking Detail Page
 * View booking details, sign contract, view invoice
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Car, Calendar, Clock, Euro, Loader2, Check, X,
  FileText, CreditCard, Pen, AlertCircle, MapPin, User,
  Star, Download
} from "lucide-react";
import { getMyBookingDetail, cancelMyBooking, signMyContract, createReview, downloadBookingReceipt } from "../api";

const STATUS_CFG = {
  pending: { label: "Ausstehend", color: "#FFB800" },
  confirmed: { label: "Bestätigt", color: "#00C2FF" },
  ready_for_handover: { label: "Bereit zur Abholung", color: "#00D26A" },
  active: { label: "Aktiv", color: "#00D26A" },
  completed: { label: "Abgeschlossen", color: "#888" },
  cancelled: { label: "Storniert", color: "#FF4757" },
  rejected: { label: "Abgelehnt", color: "#FF4757" },
};

export default function MyBookingDetailPage({ bookingId, onBack, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showSign, setShowSign] = useState(false);
  const [signature, setSignature] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => { load(); }, [bookingId]);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getMyBookingDetail(bookingId);
      setData(result);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleCancel = async () => {
    if (!window.confirm("Möchtest du diese Buchung wirklich stornieren?")) return;
    setActionLoading("cancel");
    try {
      await cancelMyBooking(bookingId);
      load();
    } catch (err) { alert(err.message); }
    setActionLoading(null);
  };

  const handleSign = async () => {
    if (!signature.trim()) return;
    setActionLoading("sign");
    try {
      await signMyContract(bookingId, signature);
      setShowSign(false);
      setSignature("");
      load();
    } catch (err) { alert(err.message); }
    setActionLoading(null);
  };

  const handleReview = async () => {
    setActionLoading("review");
    try {
      await createReview(bookingId, reviewRating, reviewComment);
      setShowReview(false);
      setReviewSubmitted(true);
    } catch (err) { alert(err.message); }
    setActionLoading(null);
  };

  const handleDownloadReceipt = async () => {
    setActionLoading("pdf");
    try {
      await downloadBookingReceipt(bookingId);
    } catch (err) { alert(err.message); }
    setActionLoading(null);
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" />
    </div>
  );

  if (!data?.booking) return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center text-white p-4">
      <p className="text-white/70 mb-4">Buchung nicht gefunden</p>
      <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
        className="px-6 py-2 rounded-xl bg-[#00C2FF] text-black font-medium">Zurück</motion.button>
    </div>
  );

  const b = data.booking;
  const contract = data.contract;
  const invoice = data.invoice;
  const st = STATUS_CFG[b.status] || STATUS_CFG.pending;
  const canCancel = ["pending", "confirmed"].includes(b.status);
  const canSign = contract && !contract.customer_signed;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-32">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
          className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="my-booking-detail-back">
          <ArrowLeft size={20} />
        </motion.button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Buchung #{bookingId?.slice(0, 8)}</h1>
          <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: `${st.color}20`, color: st.color }}>{st.label}</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Car */}
        <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-[#00C2FF]/10 flex items-center justify-center">
              <Car size={28} className="text-[#00C2FF]" />
            </div>
            <div>
              <h3 className="font-bold text-base">{b.car_title}</h3>
              <p className="text-xs text-[#666]">{b.car_brand} {b.car_model}</p>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar size={16} className="text-[#00C2FF]" /> Zeitraum</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-[#666]">Abholung</p>
              <p className="font-medium">{fmtDate(b.start_date)}</p>
              <p className="text-xs text-[#888]">{b.pickup_time || "10:00"} Uhr</p>
            </div>
            <div>
              <p className="text-xs text-[#666]">Rückgabe</p>
              <p className="font-medium">{fmtDate(b.end_date)}</p>
              <p className="text-xs text-[#888]">{b.return_time || "10:00"} Uhr</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/5 text-sm">
            <span className="text-[#888]">Dauer:</span> <span className="font-medium">{b.rental_days} Tag(e)</span>
          </div>
        </div>

        {/* Payment */}
        <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Euro size={16} className="text-[#00C2FF]" /> Zahlung</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[#888]">Mietpreis</span><span>€{b.rental_amount?.toFixed(2)}</span></div>
            {b.extras_amount > 0 && <div className="flex justify-between"><span className="text-[#888]">Extras</span><span>€{b.extras_amount?.toFixed(2)}</span></div>}
            <div className="flex justify-between"><span className="text-[#888]">MwSt.</span><span>€{b.tax_amount?.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-[#888]">Kaution (rückerstattbar)</span><span>€{b.deposit_amount?.toFixed(2)}</span></div>
            <div className="flex justify-between pt-2 border-t border-white/10 text-base font-bold">
              <span>Gesamt</span><span className="text-[#00C2FF]">€{b.total_amount?.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Contract */}
        {contract && (
          <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><FileText size={16} className="text-[#00C2FF]" /> Mietvertrag</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#888]">Vertrag</span><span>{contract.contract_id?.slice(0,8)}</span></div>
              <div className="flex justify-between">
                <span className="text-[#888]">Vermieter</span>
                <span className={contract.vendor_signed ? "text-green-400" : "text-yellow-400"}>
                  {contract.vendor_signed ? "Unterschrieben" : "Ausstehend"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888]">Kunde</span>
                <span className={contract.customer_signed ? "text-green-400" : "text-yellow-400"}>
                  {contract.customer_signed ? "Unterschrieben" : "Ausstehend"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Invoice */}
        {invoice && (
          <div className="bg-[#111118] rounded-2xl p-4 border border-white/5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><CreditCard size={16} className="text-[#00C2FF]" /> Rechnung</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#888]">Rechnungsnr.</span><span>{invoice.invoice_number}</span></div>
              <div className="flex justify-between"><span className="text-[#888]">Betrag</span><span className="font-bold">€{invoice.total?.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-[#888]">Status</span><span className="capitalize">{invoice.status}</span></div>
            </div>
          </div>
        )}

        {/* Handover info */}
        {b.handover && (
          <div className="bg-green-500/5 rounded-2xl p-4 border border-green-500/20">
            <h3 className="text-sm font-semibold mb-2 text-green-400">Fahrzeug übernommen</h3>
            <div className="text-sm text-[#888]">
              <p>KM: {b.handover.mileage} · Tank: {b.handover.fuel_level}%</p>
              <p>Datum: {fmtDate(b.handover.recorded_at)}</p>
            </div>
          </div>
        )}

        {b.return_record && (
          <div className="bg-blue-500/5 rounded-2xl p-4 border border-blue-500/20">
            <h3 className="text-sm font-semibold mb-2 text-blue-400">Fahrzeug zurückgegeben</h3>
            <div className="text-sm text-[#888]">
              <p>KM: {b.return_record.mileage} · Tank: {b.return_record.fuel_level}%</p>
              <p>Datum: {fmtDate(b.return_record.recorded_at)}</p>
            </div>
          </div>
        )}

        {/* Booking ID */}
        <div className="text-xs text-[#555] text-center">
          Buchung: {b.booking_id} · Erstellt: {fmtDate(b.created_at)}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0A0A0F]/95 backdrop-blur-xl border-t border-white/5 p-4 space-y-2 z-30">
        {canSign && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowSign(true)}
            className="w-full py-3.5 rounded-xl bg-[#00C2FF] text-black font-bold text-sm flex items-center justify-center gap-2"
            data-testid="sign-contract-btn">
            <Pen size={16} /> Vertrag unterschreiben
          </motion.button>
        )}
        {b.status === "completed" && !reviewSubmitted && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowReview(true)}
            className="w-full py-3 rounded-xl bg-yellow-500/10 text-yellow-400 font-semibold text-sm flex items-center justify-center gap-2 border border-yellow-500/20"
            data-testid="write-review-btn">
            <Star size={16} /> Bewertung schreiben
          </motion.button>
        )}
        {reviewSubmitted && (
          <div className="text-center text-green-400 text-sm py-2 flex items-center justify-center gap-2">
            <Check size={16} /> Bewertung abgegeben
          </div>
        )}
        <motion.button whileTap={{ scale: 0.95 }} onClick={handleDownloadReceipt}
          disabled={actionLoading === "pdf"}
          className="w-full py-3 rounded-xl bg-white/5 text-white font-semibold text-sm flex items-center justify-center gap-2 border border-white/10"
          data-testid="download-receipt-btn">
          {actionLoading === "pdf" ? <Loader2 size={16} className="animate-spin" /> : <><Download size={16} /> Beleg als PDF</>}
        </motion.button>
        {canCancel && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleCancel}
            disabled={actionLoading === "cancel"}
            className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 font-semibold text-sm flex items-center justify-center gap-2 border border-red-500/20"
            data-testid="cancel-booking-btn">
            {actionLoading === "cancel" ? <Loader2 size={16} className="animate-spin" /> : <><X size={16} /> Buchung stornieren</>}
          </motion.button>
        )}
      </div>

      {/* Sign Contract Modal */}
      {showSign && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowSign(false)}>
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }}
            onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[#111118] rounded-t-3xl p-6">
            <h3 className="text-lg font-bold mb-4">Vertrag unterschreiben</h3>
            <p className="text-sm text-[#888] mb-4">
              Bitte gib deinen vollständigen Namen als digitale Unterschrift ein.
            </p>
            <div className="mb-6">
              <label className="text-xs text-[#666] mb-1 block">Unterschrift (vollständiger Name)</label>
              <input type="text" value={signature} onChange={e => setSignature(e.target.value)}
                placeholder="Max Mustermann"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-lg outline-none"
                data-testid="signature-input" />
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleSign}
              disabled={!signature.trim() || actionLoading === "sign"}
              className="w-full py-4 rounded-xl bg-[#00C2FF] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="confirm-sign-btn">
              {actionLoading === "sign" ? <Loader2 size={20} className="animate-spin" /> : <><Pen size={20} /> Unterschreiben</>}
            </motion.button>
          </motion.div>
        </div>
      )}

      {/* Review Modal */}
      {showReview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowReview(false)}>
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }}
            onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[#111118] rounded-t-3xl p-6">
            <h3 className="text-lg font-bold mb-4">Bewertung schreiben</h3>
            <p className="text-sm text-[#888] mb-4">Wie war dein Mietwagen-Erlebnis?</p>
            
            <div className="flex justify-center gap-2 mb-6">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setReviewRating(s)} className="p-1" data-testid={`review-star-${s}`}>
                  <Star size={32} className={s <= reviewRating ? "text-yellow-400 fill-yellow-400" : "text-[#333]"} />
                </button>
              ))}
            </div>

            <div className="mb-6">
              <label className="text-xs text-[#666] mb-1 block">Kommentar (optional)</label>
              <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                rows={3} placeholder="Dein Feedback..."
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none resize-none"
                data-testid="review-comment" />
            </div>

            <motion.button whileTap={{ scale: 0.97 }} onClick={handleReview}
              disabled={actionLoading === "review"}
              className="w-full py-4 rounded-xl bg-yellow-500 text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="submit-review-btn">
              {actionLoading === "review" ? <Loader2 size={20} className="animate-spin" /> : <><Star size={20} /> Bewertung absenden</>}
            </motion.button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
