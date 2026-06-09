import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Clock3, MapPin, ShieldCheck, XCircle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cancelMobilityBooking, getMobilityBookingDetail } from "../services/mobilityPlatformApi";

const STATUS_LABELS = {
  payment_pending: "Zahlung ausstehend",
  confirmed: "Bestätigt",
  cancelled: "Storniert",
};

function money(value) {
  return `€${Number(value || 0).toFixed(2)}`;
}

export default function MobilityBookingTrackingPage({ bookingId, onBack, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [tracking, setTracking] = useState(null);

  const loadBooking = useCallback(async () => {
    const result = await getMobilityBookingDetail(bookingId);
    if (!result.ok) {
      toast.error(result.error || "Buchung nicht gefunden");
      setLoading(false);
      return;
    }
    setBooking(result.booking);
    setTracking(result.tracking);
    setLoading(false);
  }, [bookingId]);

  useEffect(() => {
    const bootstrap = setTimeout(() => {
      loadBooking();
    }, 0);
    const interval = setInterval(loadBooking, 12000);
    return () => {
      clearTimeout(bootstrap);
      clearInterval(interval);
    };
  }, [loadBooking]);

  const handleCancel = async () => {
    const result = await cancelMobilityBooking(bookingId);
    if (!result.ok) return toast.error(result.error || "Storno fehlgeschlagen");
    toast.success("Buchung storniert");
    await loadBooking();
  };

  if (loading) {
    return <div data-testid="mobility-booking-tracking-loading" className="min-h-screen bg-[#f2eadc] flex items-center justify-center text-[#18202a]">Lädt…</div>;
  }

  return (
    <div data-testid="mobility-booking-tracking-page" className="min-h-screen bg-[#f2eadc] text-[#18202a] pb-24">
      <div className="sticky top-0 z-30 bg-[#f2eadc]/92 backdrop-blur-xl border-b border-[#18202a]/8 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 rounded-full bg-white/70 border border-[#18202a]/10 flex items-center justify-center" data-testid="mobility-booking-back-btn"><ArrowLeft size={18} className="text-[#18202a]/70" /></button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#0F766E]">Mobility Tracking</p>
            <h1 className="text-lg font-bold">Buchung #{bookingId?.slice(-6)}</h1>
          </div>
        </div>
        <div className="px-3 py-2 rounded-2xl bg-[#0F766E]/10 border border-[#0F766E]/20 text-[#0F766E] text-xs font-semibold" data-testid="mobility-booking-status-pill">{STATUS_LABELS[tracking?.status] || booking?.status}</div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="rounded-3xl bg-white border border-[#18202a]/8 p-5" data-testid="mobility-booking-summary-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#18202a]/40">Transport</p>
              <h2 className="text-xl font-bold mt-1">{booking?.transport_label}</h2>
              <p className="text-sm text-[#18202a]/62 mt-2">{booking?.pickup?.address} → {booking?.dropoff?.address}</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{money(booking?.price_eur)}</div>
              <div className="text-[11px] text-[#18202a]/50 mt-1">{booking?.duration_min} Min · {booking?.distance_km} km</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white border border-[#18202a]/8 p-5" data-testid="mobility-booking-eta-card">
            <div className="flex items-center gap-2 text-[#0F766E]"><Clock3 size={16} /><span className="text-sm font-semibold">ETA</span></div>
            <div className="text-2xl font-bold mt-3">{tracking?.eta_minutes || booking?.duration_min || 0} Min</div>
          </div>
          <div className="rounded-3xl bg-white border border-[#18202a]/8 p-5" data-testid="mobility-booking-payment-card">
            <div className="flex items-center gap-2 text-[#0F766E]"><Wallet size={16} /><span className="text-sm font-semibold">Zahlung</span></div>
            <div className="text-base font-bold mt-3">{booking?.payment_method}</div>
            <div className="text-[11px] text-[#18202a]/50 mt-1">{booking?.payment_status}</div>
          </div>
          <div className="rounded-3xl bg-white border border-[#18202a]/8 p-5" data-testid="mobility-booking-resource-card">
            <div className="flex items-center gap-2 text-[#0F766E]"><ShieldCheck size={16} /><span className="text-sm font-semibold">Zuweisung</span></div>
            <div className="text-base font-bold mt-3">{tracking?.assigned_resource?.label || "Dispatch läuft"}</div>
            <div className="text-[11px] text-[#18202a]/50 mt-1">{tracking?.assigned_resource?.subtitle || "Live-Update folgt"}</div>
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-[#18202a]/8 p-5" data-testid="mobility-booking-route-card">
          <div className="flex items-center gap-2 mb-4"><MapPin size={16} className="text-[#F97316]" /><span className="text-sm font-semibold">Route & Tracking</span></div>
          <div className="space-y-3">
            <div className="rounded-2xl bg-[#f8f3e9] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#18202a]/35">Start</div>
              <div className="text-sm font-semibold mt-1">{booking?.pickup?.address}</div>
            </div>
            <div className="rounded-2xl bg-[#f8f3e9] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#18202a]/35">Ziel</div>
              <div className="text-sm font-semibold mt-1">{booking?.dropoff?.address}</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-[#18202a]/8 p-5" data-testid="mobility-booking-ai-card">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#18202a]/40">AI Empfehlung</div>
          <h3 className="text-base font-bold mt-2">{booking?.ai_recommendation?.headline || "AI Insight gespeichert"}</h3>
          <p className="text-sm text-[#18202a]/62 mt-2">{booking?.ai_recommendation?.summary || "Die Empfehlung wurde zusammen mit der Buchung gespeichert."}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => onNavigate?.("/chat")} className="px-4 py-3 rounded-full bg-[#18202a] text-white text-sm font-semibold" data-testid="mobility-booking-support-btn">Support</motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleCancel} disabled={!tracking?.can_cancel} className="px-4 py-3 rounded-full bg-[#F97316] text-white text-sm font-semibold disabled:opacity-40" data-testid="mobility-booking-cancel-btn"><XCircle size={16} className="inline mr-2" />Stornieren</motion.button>
        </div>
      </div>
    </div>
  );
}