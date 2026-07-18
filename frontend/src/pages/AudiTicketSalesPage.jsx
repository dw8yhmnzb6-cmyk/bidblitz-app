import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Ticket, Wallet, QrCode, ShieldCheck, Loader2, CheckCircle2, Calendar, MapPin, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useUser } from "../store";

const pageCopy = {
  heroEyebrow: "Audi-Ticketverkauf",
  heroTitle: "Audi Tickets direkt aus deinem Wallet bezahlen",
  heroSubtitle: "Ohne externen Checkout: Tarif wählen, Wallet belasten, QR-Tickets sofort erhalten.",
  buyNow: "Jetzt mit Wallet zahlen",
  myOrders: "Meine Audi-Tickets",
  soldOut: "Ausverkauft",
  available: "verfügbar",
  quantity: "Anzahl",
  attendeeName: "Name des Gasts",
  attendeeEmail: "E-Mail des Gasts",
  attendeePhone: "Telefon (optional)",
  note: "Notiz (optional)",
  walletOnly: "Zahlung erfolgt ausschließlich über dein BidBlitz Wallet.",
  loginNeeded: "Bitte zuerst anmelden, um Audi-Tickets mit dem Wallet zu kaufen.",
  openLogin: "Anmelden",
  checkinAdmin: "Admin Check-in",
  emptyOrders: "Noch keine Audi-Bestellungen vorhanden.",
  success: "Audi-Tickets erfolgreich gekauft",
};

const fmt = (amount) => `€ ${Number(amount || 0).toFixed(2)}`;

export default function AudiTicketSalesPage({ onBack, onNavigate }) {
  const user = useUser();
  const [overview, setOverview] = useState(null);
  const [orders, setOrders] = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [attendeeName, setAttendeeName] = useState("");
  const [attendeeEmail, setAttendeeEmail] = useState("");
  const [attendeePhone, setAttendeePhone] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [result, setResult] = useState(null);
  const [checkinCode, setCheckinCode] = useState("");
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinResult, setCheckinResult] = useState(null);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const [publicOverview, myOrders] = await Promise.all([
        api.getAudiTicketOverview(),
        user?.isAuthenticated ? api.getMyAudiTicketOrders().catch(() => ({ orders: [] })) : Promise.resolve({ orders: [] }),
      ]);
      setOverview(publicOverview);
      setOrders(myOrders.orders || []);
      setSelectedTypeId((current) => current || publicOverview.ticket_types?.[0]?.ticket_type_id || "");
      setAttendeeName((current) => current || user?.name || user?.full_name || "");
      setAttendeeEmail((current) => current || user?.email || "");
    } catch (error) {
      toast.error(error.message || "Audi-Tickets konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [user?.isAuthenticated]);

  const selectedType = useMemo(
    () => overview?.ticket_types?.find((item) => item.ticket_type_id === selectedTypeId) || null,
    [overview, selectedTypeId],
  );

  useEffect(() => {
    const maxPerOrder = Number(selectedType?.max_per_order || 10);
    if (quantity > maxPerOrder) {
      setQuantity(maxPerOrder);
    }
  }, [selectedType, quantity]);

  const total = useMemo(() => Number(selectedType?.price || 0) * Number(quantity || 1), [selectedType, quantity]);

  const submitPurchase = async () => {
    if (!user?.isAuthenticated) {
      toast.error(pageCopy.loginNeeded);
      return;
    }
    if (!selectedType) {
      toast.error("Bitte zuerst einen Tickettyp wählen.");
      return;
    }
    setBuying(true);
    try {
      const data = await api.purchaseAudiTickets({
        ticket_type_id: selectedType.ticket_type_id,
        quantity,
        attendee_name: attendeeName,
        attendee_email: attendeeEmail,
        attendee_phone: attendeePhone,
        note,
      });
      setResult(data);
      toast.success(pageCopy.success);
      await loadOverview();
    } catch (error) {
      toast.error(error.message || "Audi-Ticketkauf fehlgeschlagen");
    } finally {
      setBuying(false);
    }
  };

  const handleCheckin = async () => {
    if (!checkinCode.trim()) {
      toast.error("Bitte Ticket-Code eingeben.");
      return;
    }
    setCheckinBusy(true);
    try {
      const data = await api.adminAudiTicketCheckin({ ticket_code: checkinCode.trim() });
      setCheckinResult(data.ticket);
      toast.success("Ticket erfolgreich eingecheckt");
      setCheckinCode("");
      await loadOverview();
    } catch (error) {
      toast.error(error.message || "Check-in fehlgeschlagen");
    } finally {
      setCheckinBusy(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F1EF]" data-testid="audi-ticket-page-loading">
        <Loader2 className="animate-spin text-[#B11226]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F1EF] text-[#161616]" data-testid="audi-ticket-page">
      <section className="relative overflow-hidden border-b border-[#E7D9D5] bg-white">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url(${overview?.event?.hero_image})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(177,18,38,0.16),_transparent_40%),linear-gradient(120deg,rgba(255,255,255,0.96),rgba(255,255,255,0.82))]" />
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={onBack} data-testid="audi-ticket-back-button" className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E7D9D5] bg-white shadow-sm">
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#B11226]">{pageCopy.heroEyebrow}</div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[#5F5B5A]">
                <span className="inline-flex items-center gap-1" data-testid="audi-ticket-event-date"><Calendar size={14} />{overview?.event?.event_date} · {overview?.event?.event_time}</span>
                <span className="inline-flex items-center gap-1" data-testid="audi-ticket-event-venue"><MapPin size={14} />{overview?.event?.venue}, {overview?.event?.city}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <h1 data-testid="audi-ticket-hero-title" className="max-w-3xl text-4xl font-black tracking-tight text-[#161616] sm:text-5xl lg:text-6xl">{pageCopy.heroTitle}</h1>
              <p data-testid="audi-ticket-hero-subtitle" className="mt-4 max-w-2xl text-base text-[#5F5B5A] sm:text-lg">{pageCopy.heroSubtitle}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <div data-testid="audi-ticket-hero-badge-wallet" className="inline-flex items-center gap-2 rounded-full border border-[#E7D9D5] bg-white/85 px-4 py-2 text-sm font-bold text-[#161616]"><Wallet size={16} className="text-[#B11226]" /> Wallet-Payment</div>
                <div data-testid="audi-ticket-hero-badge-qr" className="inline-flex items-center gap-2 rounded-full border border-[#E7D9D5] bg-white/85 px-4 py-2 text-sm font-bold text-[#161616]"><QrCode size={16} className="text-[#B11226]" /> Sofort-Ticket</div>
                <div data-testid="audi-ticket-hero-badge-secure" className="inline-flex items-center gap-2 rounded-full border border-[#E7D9D5] bg-white/85 px-4 py-2 text-sm font-bold text-[#161616]"><ShieldCheck size={16} className="text-[#B11226]" /> Ohne externen Checkout</div>
              </div>
              <div className="mt-6 rounded-[28px] border border-[#E7D9D5] bg-white/85 p-5 shadow-sm" data-testid="audi-ticket-highlight-box">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#B11226]">Event Highlights</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {(overview?.event?.highlights || []).map((item, index) => (
                    <div key={item} className="rounded-[22px] bg-[#FAF3F1] px-4 py-4 text-sm font-semibold text-[#342F2E]" data-testid={`audi-ticket-highlight-${index}`}>
                      <Sparkles size={16} className="mb-2 text-[#B11226]" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-[#E7D9D5] bg-white p-5 shadow-xl shadow-[#B11226]/10" data-testid="audi-ticket-booking-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#B11226]">Wallet Checkout</div>
                  <div className="mt-1 text-sm text-[#5F5B5A]">{overview?.event?.title}</div>
                </div>
                <div className="rounded-full bg-[#FAF3F1] px-4 py-2 text-sm font-black text-[#B11226]" data-testid="audi-ticket-total-pill">{fmt(total)}</div>
              </div>

              <div className="mt-5 space-y-3">
                {(overview?.ticket_types || []).map((item) => {
                  const active = selectedTypeId === item.ticket_type_id;
                  const soldOut = Number(item.inventory_available || 0) <= 0;
                  return (
                    <motion.button
                      key={item.ticket_type_id}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => !soldOut && setSelectedTypeId(item.ticket_type_id)}
                      data-testid={`audi-ticket-type-${item.ticket_type_id}`}
                      className={`w-full rounded-[28px] border p-5 text-left transition-transform ${active ? "border-[#B11226] bg-[#FFF5F5] shadow-md" : "border-[#E7D9D5] bg-white shadow-sm"} ${soldOut ? "opacity-60" : ""}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="inline-flex rounded-full px-3 py-1 text-[11px] font-black text-white" style={{ background: item.gradient }}>{item.badge}</div>
                          <div className="mt-3 text-lg font-black text-[#161616]">{item.title}</div>
                          <div className="mt-1 text-sm text-[#5F5B5A]">{item.subtitle}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-black text-[#161616]">{fmt(item.price)}</div>
                          <div className="mt-1 text-xs font-bold text-[#5F5B5A]" data-testid={`audi-ticket-availability-${item.ticket_type_id}`}>
                            {soldOut ? pageCopy.soldOut : `${item.inventory_available} ${pageCopy.available}`}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(item.perks || []).map((perk) => (
                          <span key={perk} className="rounded-full bg-[#FAF3F1] px-3 py-1 text-xs font-bold text-[#5F5B5A]">{perk}</span>
                        ))}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.16em] text-[#756F6D]">{pageCopy.quantity}</label>
                  <div className="flex items-center gap-3 rounded-[24px] border border-[#E7D9D5] bg-[#FAF3F1] p-3">
                    <button onClick={() => setQuantity((value) => Math.max(1, value - 1))} data-testid="audi-ticket-quantity-minus" className="h-10 w-10 rounded-full border border-[#E7D9D5] bg-white text-lg font-black">−</button>
                    <div data-testid="audi-ticket-quantity-value" className="min-w-[70px] rounded-full border border-[#E7D9D5] bg-white px-4 py-2 text-center text-base font-black">{quantity}</div>
                    <button onClick={() => setQuantity((value) => Math.min(Number(selectedType?.max_per_order || 10), value + 1))} data-testid="audi-ticket-quantity-plus" className="h-10 w-10 rounded-full border border-[#E7D9D5] bg-white text-lg font-black">+</button>
                  </div>
                </div>
                <div className="rounded-[24px] border border-[#E7D9D5] bg-[#FAF3F1] p-4" data-testid="audi-ticket-wallet-notice">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#756F6D]">Wallet</div>
                  <div className="mt-3 flex items-start gap-2 text-sm font-semibold text-[#342F2E]"><Wallet size={16} className="mt-0.5 text-[#B11226]" />{pageCopy.walletOnly}</div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <input value={attendeeName} onChange={(e) => setAttendeeName(e.target.value)} data-testid="audi-ticket-attendee-name" placeholder={pageCopy.attendeeName} className="w-full rounded-2xl border border-[#E7D9D5] bg-[#FAF3F1] px-4 py-3 outline-none" />
                <input value={attendeeEmail} onChange={(e) => setAttendeeEmail(e.target.value)} data-testid="audi-ticket-attendee-email" placeholder={pageCopy.attendeeEmail} className="w-full rounded-2xl border border-[#E7D9D5] bg-[#FAF3F1] px-4 py-3 outline-none" />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input value={attendeePhone} onChange={(e) => setAttendeePhone(e.target.value)} data-testid="audi-ticket-attendee-phone" placeholder={pageCopy.attendeePhone} className="w-full rounded-2xl border border-[#E7D9D5] bg-[#FAF3F1] px-4 py-3 outline-none" />
                <input value={note} onChange={(e) => setNote(e.target.value)} data-testid="audi-ticket-note" placeholder={pageCopy.note} className="w-full rounded-2xl border border-[#E7D9D5] bg-[#FAF3F1] px-4 py-3 outline-none" />
              </div>

              {!user?.isAuthenticated ? (
                <div className="mt-5 rounded-[26px] border border-[#E7D9D5] bg-[#FFF5F5] p-4" data-testid="audi-ticket-login-required-box">
                  <div className="text-sm font-bold text-[#342F2E]">{pageCopy.loginNeeded}</div>
                  <button onClick={() => onNavigate?.("/login")} data-testid="audi-ticket-login-button" className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#B11226] px-5 py-3 text-sm font-black text-white">{pageCopy.openLogin}</button>
                </div>
              ) : (
                <button onClick={submitPurchase} disabled={buying || !selectedType || Number(selectedType?.inventory_available || 0) <= 0} data-testid="audi-ticket-buy-button" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#B11226] px-5 py-4 text-sm font-black text-white disabled:opacity-50">
                  {buying ? <Loader2 size={18} className="animate-spin" /> : <><Ticket size={18} /> {pageCopy.buyNow}</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div className="space-y-5">
          {result?.order && (
            <div className="rounded-[32px] border border-[#E7D9D5] bg-white p-6 shadow-sm" data-testid="audi-ticket-success-card">
              <div className="flex items-center gap-3 text-[#B11226]"><CheckCircle2 size={28} /><div className="text-lg font-black">{pageCopy.success}</div></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] bg-[#FAF3F1] p-4" data-testid="audi-ticket-success-order-id"><div className="text-xs font-black uppercase tracking-[0.14em] text-[#756F6D]">Bestellung</div><div className="mt-2 text-sm font-bold text-[#161616]">{result.order.order_id}</div></div>
                <div className="rounded-[24px] bg-[#FAF3F1] p-4" data-testid="audi-ticket-success-wallet-ref"><div className="text-xs font-black uppercase tracking-[0.14em] text-[#756F6D]">Wallet Referenz</div><div className="mt-2 text-sm font-bold text-[#161616]">{result.wallet?.reference}</div></div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(result.tickets || []).map((ticket) => (
                  <div key={ticket.ticket_code} className="rounded-[26px] border border-[#E7D9D5] bg-[#FFF5F5] p-4" data-testid={`audi-ticket-code-${ticket.ticket_code}`}>
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-[#756F6D]">QR Ticket</div>
                    <div className="mt-2 text-sm font-black text-[#161616]">{ticket.ticket_code}</div>
                    <div className="mt-2 text-xs text-[#5F5B5A]">{ticket.ticket_type_title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-[32px] border border-[#E7D9D5] bg-white p-6 shadow-sm" data-testid="audi-ticket-orders-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#B11226]">{pageCopy.myOrders}</div>
                <div className="mt-1 text-sm text-[#5F5B5A]">Digitale Tickets und Wallet-Zahlungen im Überblick</div>
              </div>
              <div className="rounded-full bg-[#FAF3F1] px-4 py-2 text-sm font-black text-[#B11226]" data-testid="audi-ticket-order-count">{orders.length}</div>
            </div>
            <div className="mt-5 space-y-3">
              {orders.length === 0 ? (
                <div className="rounded-[24px] bg-[#FAF3F1] px-4 py-5 text-sm font-semibold text-[#5F5B5A]" data-testid="audi-ticket-orders-empty">{pageCopy.emptyOrders}</div>
              ) : orders.map((order) => (
                <div key={order.order_id} className="rounded-[24px] border border-[#E7D9D5] bg-[#FAF3F1] p-4" data-testid={`audi-ticket-order-${order.order_id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-[#161616]">{order.ticket_type_title}</div>
                      <div className="mt-1 text-xs text-[#5F5B5A]">{order.quantity}x · {fmt(order.total_amount)} · {order.attendee_name || order.buyer_name}</div>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#B11226]">{order.status}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(order.ticket_codes || []).map((code) => (
                      <span key={code} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#342F2E]">{code}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {user?.role === "admin" && (
          <div className="rounded-[32px] border border-[#E7D9D5] bg-white p-6 shadow-sm" data-testid="audi-ticket-admin-card">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#B11226]">{pageCopy.checkinAdmin}</div>
            <div className="mt-2 text-sm text-[#5F5B5A]">Ticket-Code scannen oder eintippen und direkt vor Ort einchecken.</div>
            <div className="mt-5 flex gap-3">
              <input value={checkinCode} onChange={(e) => setCheckinCode(e.target.value)} data-testid="audi-ticket-checkin-input" placeholder="AUDI-TKT-XXXX" className="flex-1 rounded-2xl border border-[#E7D9D5] bg-[#FAF3F1] px-4 py-3 outline-none" />
              <button onClick={handleCheckin} disabled={checkinBusy} data-testid="audi-ticket-checkin-button" className="rounded-full bg-[#161616] px-5 py-3 text-sm font-black text-white disabled:opacity-50">
                {checkinBusy ? <Loader2 size={18} className="animate-spin" /> : "Check-in"}
              </button>
            </div>
            {checkinResult && (
              <div className="mt-5 rounded-[24px] border border-[#E7D9D5] bg-[#FAF3F1] p-4" data-testid="audi-ticket-checkin-result">
                <div className="text-sm font-black text-[#161616]">{checkinResult.ticket_code}</div>
                <div className="mt-1 text-xs text-[#5F5B5A]">{checkinResult.ticket_type_title} · {checkinResult.status}</div>
                <div className="mt-1 text-xs text-[#5F5B5A]">Check-in: {checkinResult.checked_in_at}</div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}