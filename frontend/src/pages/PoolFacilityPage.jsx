import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Ticket, ShieldCheck, CreditCard, Lock, QrCode, Loader2, CheckCircle2, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../store/I18nContext";

const API = process.env.REACT_APP_BACKEND_URL;

const copy = {
  de: {
    eyebrow: "Schwimmbad-System",
    title: "Tickets, Spinde, Einlass und Snack-POS in einem Flow",
    subtitle: "Online kaufen, vor Ort einchecken, Armband zuordnen und Zusätze wie Spind oder Sauna direkt verwalten.",
    cta: "Jetzt Online-Ticket kaufen",
    packageTitle: "Tickets & Pässe",
    extrasTitle: "Extras",
    guestTitle: "Gastdaten",
    quantity: "Menge",
    checkout: "Online bezahlen",
    digitalPass: "Dein digitales Ticket",
    awaiting: "Zahlung wird geprüft …",
    occupancy: "Live-Auslastung",
    adminHint: "Kasse, Einlass, Spinde und Snackverkauf laufen später im Admin-Bereich.",
    name: "Name",
    email: "E-Mail",
    lockerReady: "QR / RFID vorbereitet",
    snackReady: "Snack-POS eingebaut",
    gateReady: "Drehkreuz-Logik bereit",
    mockNotice: "Hardware-Bridges für RFID, Spindrelais und Turnstiles sind aktuell MOCKED, die Software-Logik ist live.",
    cancelled: "Checkout abgebrochen",
    ticketReady: "Ticket erfolgreich erstellt",
  },
  en: {
    eyebrow: "Swimming pool system",
    title: "Tickets, lockers, access and snack POS in one flow",
    subtitle: "Buy online, check in on-site, assign wristbands and manage add-ons like lockers or sauna in one place.",
    cta: "Buy online ticket now",
    packageTitle: "Tickets & passes",
    extrasTitle: "Add-ons",
    guestTitle: "Guest details",
    quantity: "Quantity",
    checkout: "Pay online",
    digitalPass: "Your digital ticket",
    awaiting: "Checking payment …",
    occupancy: "Live occupancy",
    adminHint: "Cashier, access, lockers and snack sales run in the admin area.",
    name: "Name",
    email: "Email",
    lockerReady: "QR / RFID ready",
    snackReady: "Snack POS included",
    gateReady: "Turnstile logic ready",
    mockNotice: "Hardware bridges for RFID, locker relays and turnstiles are currently MOCKED, software logic is live.",
    cancelled: "Checkout cancelled",
    ticketReady: "Ticket created successfully",
  },
};

async function poolApi(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || `Error ${res.status}`);
  return data;
}

const localeKey = (lang) => (lang || "de").startsWith("en") ? "en" : "de";

const HeroBadge = ({ icon: Icon, label, testId }) => (
  <div data-testid={testId} className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/70 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur">
    <Icon size={14} className="text-[#0088CC]" />
    <span>{label}</span>
  </div>
);

const PackageCard = ({ pkg, active, onClick, lang, testId }) => (
  <motion.button
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    data-testid={testId}
    className={`rounded-[28px] border p-5 text-left transition-transform ${active ? "border-[#0088CC] bg-[#E8F6FD] shadow-md" : "border-slate-200 bg-white shadow-sm"}`}
  >
    <div className="mb-3 inline-flex rounded-full px-3 py-1 text-[11px] font-bold text-white" style={{ background: pkg.color }}>
      {pkg.max_people > 1 ? `${pkg.max_people} pax` : "1 pax"}
    </div>
    <div className="text-lg font-bold text-slate-900">{lang === "de" ? pkg.label_de : pkg.label_en}</div>
    <p className="mt-2 text-sm text-slate-600">{lang === "de" ? pkg.description_de : pkg.description_en}</p>
    <div className="mt-4 text-2xl font-black text-[#0F172A]">€ {Number(pkg.price || 0).toFixed(2)}</div>
  </motion.button>
);

export default function PoolFacilityPage({ onBack, onNavigate }) {
  const { lang } = useI18n();
  const L = copy[localeKey(lang)];
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState("adult-day");
  const [quantity, setQuantity] = useState(1);
  const [extras, setExtras] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [ticket, setTicket] = useState(null);
  const [checking, setChecking] = useState(false);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await poolApi("/api/pool/public/overview");
      setOverview(data);
      if (!data.packages?.find((pkg) => pkg.package_id === selectedPackage)) {
        setSelectedPackage(data.packages?.[0]?.package_id || "adult-day");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOverview(); }, []);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const sessionId = search.get("session_id");
    const cancelled = search.get("cancelled");
    if (cancelled) toast.error(L.cancelled);
    if (!sessionId) return;
    let active = true;
    const poll = async (attempt = 0) => {
      setChecking(true);
      try {
        const data = await poolApi(`/api/pool/public/tickets/checkout-status/${sessionId}`);
        if (!active) return;
        if (data.ticket) {
          setTicket(data.ticket);
          setChecking(false);
          toast.success(L.ticketReady);
          return;
        }
        if (attempt < 7 && data.payment_status !== "paid") {
          window.setTimeout(() => poll(attempt + 1), 2200);
          return;
        }
      } catch (error) {
        if (active) toast.error(error.message);
      }
      if (active) setChecking(false);
    };
    poll();
    return () => { active = false; };
  }, [L.cancelled, L.ticketReady]);

  const selectedPackageDoc = useMemo(
    () => overview?.packages?.find((pkg) => pkg.package_id === selectedPackage),
    [overview, selectedPackage],
  );

  const total = useMemo(() => {
    const base = Number(selectedPackageDoc?.price || 0) * quantity;
    const extrasTotal = (overview?.extras || [])
      .filter((extra) => extras.includes(extra.extra_id))
      .reduce((sum, extra) => sum + Number(extra.price || 0) * quantity, 0);
    return (base + extrasTotal).toFixed(2);
  }, [selectedPackageDoc, quantity, extras, overview]);

  const toggleExtra = (extraId) => setExtras((prev) => prev.includes(extraId) ? prev.filter((item) => item !== extraId) : [...prev, extraId]);

  const startCheckout = async () => {
    if (!selectedPackage) return toast.error("Ticket fehlt");
    setCheckoutBusy(true);
    try {
      const data = await poolApi("/api/pool/public/tickets/checkout", {
        method: "POST",
        body: JSON.stringify({
          package_id: selectedPackage,
          quantity,
          extras,
          customer_name: customerName,
          customer_email: customerEmail,
          origin_url: window.location.origin,
        }),
      });
      window.location.href = data.checkout_url;
    } catch (error) {
      toast.error(error.message);
      setCheckoutBusy(false);
    }
  };

  if (loading && !overview) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F4F7F9]" data-testid="pool-page-loading"><Loader2 className="animate-spin text-[#0088CC]" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-slate-900" data-testid="pool-page">
      <div className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${overview?.facility?.hero_image})` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/70" />
        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center gap-3">
            <button onClick={onBack} data-testid="pool-back-button" className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#0088CC]">{L.eyebrow}</p>
              <p data-testid="pool-hero-hours" className="text-sm text-slate-600">{overview?.facility?.hours?.[localeKey(lang)]}</p>
            </div>
          </div>
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <h1 data-testid="pool-hero-title" className="max-w-3xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">{L.title}</h1>
              <p data-testid="pool-hero-subtitle" className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">{L.subtitle}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <HeroBadge icon={QrCode} label={L.lockerReady} testId="pool-hero-badge-rfid" />
                <HeroBadge icon={Ticket} label={L.gateReady} testId="pool-hero-badge-gate" />
                <HeroBadge icon={CreditCard} label={L.snackReady} testId="pool-hero-badge-pos" />
              </div>
              <div className="mt-6 rounded-[28px] border border-[#D7EBF7] bg-[#EDF8FE] p-4 text-sm text-slate-700 shadow-sm" data-testid="pool-mock-notice">
                {L.mockNotice}
              </div>
            </div>
            <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-xl shadow-[#0088CC]/10" data-testid="pool-booking-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0088CC]">{L.packageTitle}</p>
                  <p className="mt-1 text-sm text-slate-500">{overview?.facility?.name}</p>
                </div>
                <div className="rounded-full bg-[#F4F7F9] px-4 py-2 text-sm font-semibold text-slate-700" data-testid="pool-total-pill">€ {total}</div>
              </div>
              <div className="mt-4 space-y-3">
                {overview?.packages?.map((pkg) => (
                  <PackageCard
                    key={pkg.package_id}
                    pkg={pkg}
                    lang={localeKey(lang)}
                    active={selectedPackage === pkg.package_id}
                    onClick={() => setSelectedPackage(pkg.package_id)}
                    testId={`pool-package-${pkg.package_id}`}
                  />
                ))}
              </div>
              <div className="mt-5">
                <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-slate-500">{L.quantity}</div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQuantity((value) => Math.max(1, value - 1))} data-testid="pool-quantity-minus" className="h-11 w-11 rounded-full border border-slate-200 bg-slate-50 text-xl font-bold">−</button>
                  <div data-testid="pool-quantity-value" className="min-w-[70px] rounded-full border border-slate-200 bg-white px-4 py-3 text-center text-lg font-bold">{quantity}</div>
                  <button onClick={() => setQuantity((value) => Math.min(10, value + 1))} data-testid="pool-quantity-plus" className="h-11 w-11 rounded-full border border-slate-200 bg-slate-50 text-xl font-bold">+</button>
                </div>
              </div>
              <div className="mt-5">
                <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-slate-500">{L.extrasTitle}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {overview?.extras?.map((extra) => {
                    const active = extras.includes(extra.extra_id);
                    return (
                      <button
                        key={extra.extra_id}
                        onClick={() => toggleExtra(extra.extra_id)}
                        data-testid={`pool-extra-${extra.extra_id}`}
                        className={`rounded-2xl border p-4 text-left ${active ? "border-[#0088CC] bg-[#E8F6FD]" : "border-slate-200 bg-slate-50"}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">{localeKey(lang) === "de" ? extra.label_de : extra.label_en}</div>
                            <div className="mt-1 text-xs text-slate-600">{localeKey(lang) === "de" ? extra.description_de : extra.description_en}</div>
                          </div>
                          {active ? <CheckCircle2 size={18} className="text-[#0088CC]" /> : null}
                        </div>
                        <div className="mt-3 text-sm font-bold text-slate-800">€ {Number(extra.price || 0).toFixed(2)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[12px] font-bold uppercase tracking-[0.16em] text-slate-500">{L.name}</label>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} data-testid="pool-customer-name" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none" placeholder="Max Mustermann" />
                </div>
                <div>
                  <label className="mb-2 block text-[12px] font-bold uppercase tracking-[0.16em] text-slate-500">{L.email}</label>
                  <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} data-testid="pool-customer-email" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none" placeholder="mail@example.com" />
                </div>
              </div>
              <button onClick={startCheckout} disabled={checkoutBusy} data-testid="pool-start-checkout-button" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FF8C00] px-5 py-4 text-sm font-black text-white shadow-lg shadow-[#FF8C00]/30 disabled:opacity-60">
                {checkoutBusy ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                {L.checkout}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm" data-testid="pool-occupancy-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{L.occupancy}</h2>
                <p className="text-sm text-slate-500">{overview?.facility?.address}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#E8F6FD] px-3 py-2 text-sm font-semibold text-[#0088CC]">
                <Users size={14} />
                <span data-testid="pool-inside-now">{overview?.occupancy?.inside_now || 0}</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4" data-testid="pool-locker-available-card">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Lockers free</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{overview?.occupancy?.available_lockers || 0}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4" data-testid="pool-locker-total-card">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Lockers total</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{overview?.occupancy?.total_lockers || 0}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4" data-testid="pool-hours-card">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Open</div>
                <div className="mt-2 flex items-center gap-2 text-base font-bold text-slate-900"><Clock size={15} />{overview?.facility?.hours?.[localeKey(lang)]}</div>
              </div>
            </div>
          </div>

          {ticket ? (
            <div className="rounded-[28px] border border-[#BEE3F8] bg-[#F2FBFF] p-6 shadow-sm" data-testid="pool-digital-ticket-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0088CC]">{L.digitalPass}</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-900">{ticket.ticket_code}</h3>
                  <p className="mt-2 text-sm text-slate-600">{localeKey(lang) === "de" ? ticket.package_label_de : ticket.package_label_en}</p>
                </div>
                <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm" data-testid="pool-ticket-status-pill">{ticket.status}</div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-white p-4" data-testid="pool-ticket-amount"><div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Amount</div><div className="mt-2 text-xl font-black text-slate-900">€ {Number(ticket.total_amount || 0).toFixed(2)}</div></div>
                <div className="rounded-2xl bg-white p-4" data-testid="pool-ticket-wristband"><div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Wristband</div><div className="mt-2 text-base font-bold text-slate-900">{ticket.wristband_id || "Assign on entry"}</div></div>
                <div className="rounded-2xl bg-white p-4" data-testid="pool-ticket-locker"><div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Locker</div><div className="mt-2 text-base font-bold text-slate-900">{ticket.locker_id || "Optional"}</div></div>
                <div className="rounded-2xl bg-white p-4" data-testid="pool-ticket-guest"><div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Guest</div><div className="mt-2 text-base font-bold text-slate-900">{ticket.customer_name || ticket.customer_email || "Guest"}</div></div>
              </div>
            </div>
          ) : null}

          {checking ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm" data-testid="pool-checking-card">
              <div className="flex items-center gap-3 text-slate-700"><Loader2 size={18} className="animate-spin text-[#0088CC]" /> {L.awaiting}</div>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm" data-testid="pool-operator-card">
            <div className="mb-4 flex items-center gap-3">
              <ShieldCheck size={20} className="text-[#0088CC]" />
              <div>
                <div className="text-lg font-bold text-slate-900">Operations ready</div>
                <div className="text-sm text-slate-500">{L.adminHint}</div>
              </div>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4" data-testid="pool-operator-feature-entry">• Turnstile entry / exit with QR or wristband scan</div>
              <div className="rounded-2xl bg-slate-50 p-4" data-testid="pool-operator-feature-locker">• Locker assignment and release per guest ticket</div>
              <div className="rounded-2xl bg-slate-50 p-4" data-testid="pool-operator-feature-snacks">• Snack POS for drinks, fries, burgers and add-ons</div>
            </div>
            <button onClick={() => onNavigate?.("/admin/pool")} data-testid="pool-open-admin-button" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#0088CC] bg-[#E8F6FD] px-5 py-3 text-sm font-black text-[#0088CC]">
              <ShieldCheck size={16} /> Open operator dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}