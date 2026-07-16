import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CreditCard, Lock, QrCode, Loader2, Ticket, BarChart3, ShoppingBag, CheckCircle2, ShieldCheck, Cpu, ServerCog, Radio, Cable } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../store/I18nContext";

const API = process.env.REACT_APP_BACKEND_URL;

const tabLabels = {
  de: { overview: "Übersicht", cashier: "Kasse", access: "Einlass", lockers: "Spinde", snacks: "Snack POS", hardware: "Hardware", history: "History" },
  en: { overview: "Overview", cashier: "Cashier", access: "Access", lockers: "Lockers", snacks: "Snack POS", hardware: "Hardware", history: "History" },
};

async function adminApi(path, options = {}) {
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

const KpiCard = ({ title, value, testId }) => (
  <div data-testid={testId} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{title}</div>
    <div className="mt-3 text-3xl font-black text-slate-900">{value}</div>
  </div>
);

const TogglePill = ({ active, onClick, label, testId }) => (
  <button onClick={onClick} data-testid={testId} className={`rounded-full px-4 py-2 text-sm font-bold ${active ? "bg-[#0088CC] text-white" : "bg-white text-slate-600 border border-slate-200"}`}>{label}</button>
);

export default function PoolAdminPage({ onBack }) {
  const { lang } = useI18n();
  const activeLang = localeKey(lang);
  const tabs = tabLabels[activeLang];
  const [tab, setTab] = useState("overview");
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cashPackage, setCashPackage] = useState("adult-day");
  const [cashQuantity, setCashQuantity] = useState(1);
  const [cashExtras, setCashExtras] = useState([]);
  const [cashPaymentMethod, setCashPaymentMethod] = useState("cash");
  const [cashName, setCashName] = useState("");
  const [cashEmail, setCashEmail] = useState("");
  const [issuedTicket, setIssuedTicket] = useState(null);
  const [scanCode, setScanCode] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [lockerTicketCode, setLockerTicketCode] = useState("");
  const [lockerId, setLockerId] = useState("");
  const [lockerResult, setLockerResult] = useState(null);
  const [releaseLockerId, setReleaseLockerId] = useState("");
  const [saleItems, setSaleItems] = useState({});
  const [salePaymentMethod, setSalePaymentMethod] = useState("cash");
  const [saleTicketCode, setSaleTicketCode] = useState("");
  const [saleResult, setSaleResult] = useState(null);
  const [deploymentMode, setDeploymentMode] = useState("cloud_plus_edge");
  const [rfidProviderMode, setRfidProviderMode] = useState("nfc_mifare_and_qr");
  const [rfidAdapterType, setRfidAdapterType] = useState("edge_reader_bridge");
  const [turnstileAdapterType, setTurnstileAdapterType] = useState("edge_turnstile_bridge");
  const [lockerAdapterType, setLockerAdapterType] = useState("edge_locker_bridge");
  const [sharedSecretHint, setSharedSecretHint] = useState("");
  const [hardwareSaveResult, setHardwareSaveResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi("/api/pool/admin/dashboard");
      setDashboard(data);
      setDeploymentMode(data.hardware_config?.selected_mode || "cloud_plus_edge");
      setRfidProviderMode(data.hardware_config?.rfid?.provider_mode || "nfc_mifare_and_qr");
      setRfidAdapterType(data.hardware_config?.rfid?.adapter_type || "edge_reader_bridge");
      setTurnstileAdapterType(data.hardware_config?.turnstile?.adapter_type || "edge_turnstile_bridge");
      setLockerAdapterType(data.hardware_config?.locker?.adapter_type || "edge_locker_bridge");
      setSharedSecretHint(data.hardware_config?.security?.shared_secret_hint || "");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const packages = dashboard?.packages || [];
  const extras = dashboard?.extras || [];
  const snackMenu = dashboard?.snack_menu || [];

  const cashTotal = useMemo(() => {
    const base = Number(packages.find((pkg) => pkg.package_id === cashPackage)?.price || 0) * cashQuantity;
    const extrasTotal = extras.filter((extra) => cashExtras.includes(extra.extra_id)).reduce((sum, extra) => sum + Number(extra.price || 0) * cashQuantity, 0);
    return (base + extrasTotal).toFixed(2);
  }, [cashPackage, cashQuantity, cashExtras, packages, extras]);

  const snackTotal = useMemo(() => snackMenu.reduce((sum, item) => sum + ((saleItems[item.menu_id] || 0) * Number(item.price || 0)), 0).toFixed(2), [saleItems, snackMenu]);

  const toggleCashExtra = (extraId) => setCashExtras((prev) => prev.includes(extraId) ? prev.filter((item) => item !== extraId) : [...prev, extraId]);

  const createCashSale = async () => {
    setBusy(true);
    try {
      const data = await adminApi("/api/pool/admin/tickets/cash-sale", {
        method: "POST",
        body: JSON.stringify({
          package_id: cashPackage,
          quantity: cashQuantity,
          extras: cashExtras,
          customer_name: cashName,
          customer_email: cashEmail,
          payment_method: cashPaymentMethod,
        }),
      });
      setIssuedTicket(data.ticket);
      toast.success("Ticket erstellt");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const scanTurnstile = async (direction) => {
    setBusy(true);
    try {
      const data = await adminApi("/api/pool/admin/turnstile/scan", {
        method: "POST",
        body: JSON.stringify({ scan_code: scanCode, direction, turnstile_id: direction === "entry" ? "ENTRY-01" : "EXIT-01" }),
      });
      setScanResult(data);
      toast.success(data.message);
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const assignLocker = async () => {
    setBusy(true);
    try {
      const data = await adminApi("/api/pool/admin/lockers/assign", {
        method: "POST",
        body: JSON.stringify({ ticket_code: lockerTicketCode, locker_id: lockerId || undefined }),
      });
      setLockerResult(data);
      toast.success("Spind zugeordnet");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const releaseLocker = async () => {
    setBusy(true);
    try {
      await adminApi("/api/pool/admin/lockers/release", {
        method: "POST",
        body: JSON.stringify({ locker_id: releaseLockerId || undefined, ticket_code: releaseLockerId ? undefined : lockerTicketCode || undefined }),
      });
      toast.success("Spind freigegeben");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const createSnackSale = async () => {
    const items = Object.entries(saleItems).filter(([, quantity]) => quantity > 0).map(([menu_id, quantity]) => ({ menu_id, quantity }));
    if (!items.length) return toast.error("Bitte Artikel wählen");
    setBusy(true);
    try {
      const data = await adminApi("/api/pool/admin/pos/sale", {
        method: "POST",
        body: JSON.stringify({ items, payment_method: salePaymentMethod, ticket_code: saleTicketCode || undefined }),
      });
      setSaleResult(data.sale);
      setSaleItems({});
      toast.success("Snackverkauf gespeichert");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const lockers = dashboard?.lockers || [];
  const occupiedLockers = lockers.filter((locker) => locker.status === "occupied");
  const hardwareBlueprint = dashboard?.hardware_blueprint || {};
  const hardwareEvents = dashboard?.hardware_events || [];

  const saveHardwareBlueprint = async () => {
    setBusy(true);
    try {
      const data = await adminApi("/api/pool/admin/hardware/config", {
        method: "POST",
        body: JSON.stringify({
          selected_mode: deploymentMode,
          rfid_provider_mode: rfidProviderMode,
          rfid_adapter_type: rfidAdapterType,
          turnstile_adapter_type: turnstileAdapterType,
          locker_adapter_type: lockerAdapterType,
          shared_secret_hint: sharedSecretHint,
        }),
      });
      setHardwareSaveResult(data.hardware_event);
      toast.success("Hardware-Blueprint gespeichert");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !dashboard) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F4F7F9]" data-testid="pool-admin-loading"><Loader2 className="animate-spin text-[#0088CC]" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-slate-900" data-testid="pool-admin-page">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={onBack} data-testid="pool-admin-back-button" className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm"><ArrowLeft size={18} /></button>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0088CC]">Pool operator dashboard</div>
              <div data-testid="pool-admin-title" className="truncate text-xl font-black text-slate-900">{dashboard?.facility?.name}</div>
            </div>
            <div className="rounded-full bg-[#EDF8FE] px-4 py-2 text-sm font-semibold text-[#0088CC]" data-testid="pool-admin-hardware-pill">RFID / gate / locker bridges = MOCKED</div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(tabs).map(([key, label]) => <TogglePill key={key} active={tab === key} onClick={() => setTab(key)} label={label} testId={`pool-admin-tab-${key}`} />)}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {tab === "overview" ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard title="Ticket revenue" value={`€ ${Number(dashboard?.metrics?.ticket_revenue_today || 0).toFixed(2)}`} testId="pool-admin-kpi-ticket-revenue" />
              <KpiCard title="Snack revenue" value={`€ ${Number(dashboard?.metrics?.snack_revenue_today || 0).toFixed(2)}`} testId="pool-admin-kpi-snack-revenue" />
              <KpiCard title="Active guests" value={dashboard?.metrics?.active_guests || 0} testId="pool-admin-kpi-active-guests" />
              <KpiCard title="Occupied lockers" value={dashboard?.metrics?.lockers_occupied || 0} testId="pool-admin-kpi-lockers" />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" data-testid="pool-admin-recent-tickets">
                <div className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><Ticket size={18} /> Recent tickets</div>
                <div className="space-y-3">
                  {(dashboard?.recent_tickets || []).slice(0, 6).map((ticket) => (
                    <div key={ticket.ticket_code} className="rounded-2xl bg-slate-50 p-4" data-testid={`pool-admin-ticket-${ticket.ticket_code}`}>
                      <div className="flex items-center justify-between gap-3"><div className="font-bold text-slate-900">{ticket.ticket_code}</div><div className="text-sm text-slate-500">€ {Number(ticket.total_amount || 0).toFixed(2)}</div></div>
                      <div className="mt-1 text-sm text-slate-600">{activeLang === "de" ? ticket.package_label_de : ticket.package_label_en}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" data-testid="pool-admin-recent-access">
                <div className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><QrCode size={18} /> Recent access</div>
                <div className="space-y-3">
                  {(dashboard?.recent_access || []).slice(0, 6).map((event) => (
                    <div key={event.event_id} className="rounded-2xl bg-slate-50 p-4" data-testid={`pool-admin-access-${event.event_id}`}>
                      <div className="flex items-center justify-between gap-3"><div className="font-bold text-slate-900">{event.ticket_code}</div><div className="text-sm text-slate-500">{event.direction}</div></div>
                      <div className="mt-1 text-sm text-slate-600">{event.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}

        {tab === "cashier" ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" data-testid="pool-admin-cashier-section">
            <div className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><CreditCard size={18} /> On-site ticket sale</div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-3">
                {packages.map((pkg) => <TogglePill key={pkg.package_id} active={cashPackage === pkg.package_id} onClick={() => setCashPackage(pkg.package_id)} label={`${activeLang === "de" ? pkg.label_de : pkg.label_en} · €${Number(pkg.price || 0).toFixed(2)}`} testId={`pool-admin-cash-package-${pkg.package_id}`} />)}
              </div>
              <div className="space-y-4 rounded-3xl bg-slate-50 p-5">
                <div className="flex items-center gap-3">
                  <button onClick={() => setCashQuantity((value) => Math.max(1, value - 1))} data-testid="pool-admin-cash-qty-minus" className="h-10 w-10 rounded-full border border-slate-200 bg-white">−</button>
                  <div data-testid="pool-admin-cash-qty-value" className="rounded-full border border-slate-200 bg-white px-4 py-2 font-bold">{cashQuantity}</div>
                  <button onClick={() => setCashQuantity((value) => Math.min(10, value + 1))} data-testid="pool-admin-cash-qty-plus" className="h-10 w-10 rounded-full border border-slate-200 bg-white">+</button>
                </div>
                <div className="flex flex-wrap gap-2">{extras.map((extra) => <TogglePill key={extra.extra_id} active={cashExtras.includes(extra.extra_id)} onClick={() => toggleCashExtra(extra.extra_id)} label={`${activeLang === "de" ? extra.label_de : extra.label_en} · €${Number(extra.price || 0).toFixed(2)}`} testId={`pool-admin-extra-${extra.extra_id}`} />)}</div>
                <div className="flex flex-wrap gap-2">
                  <TogglePill active={cashPaymentMethod === "cash"} onClick={() => setCashPaymentMethod("cash")} label="Cash" testId="pool-admin-payment-cash" />
                  <TogglePill active={cashPaymentMethod === "card"} onClick={() => setCashPaymentMethod("card")} label="Card" testId="pool-admin-payment-card" />
                </div>
                <input value={cashName} onChange={(e) => setCashName(e.target.value)} data-testid="pool-admin-cash-name" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3" placeholder="Guest name" />
                <input value={cashEmail} onChange={(e) => setCashEmail(e.target.value)} data-testid="pool-admin-cash-email" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3" placeholder="guest@email.com" />
                <button onClick={createCashSale} disabled={busy} data-testid="pool-admin-create-cash-ticket" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FF8C00] px-5 py-4 text-sm font-black text-white disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />} Create ticket · € {cashTotal}</button>
                {issuedTicket ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" data-testid="pool-admin-issued-ticket">{issuedTicket.ticket_code} · {activeLang === "de" ? issuedTicket.package_label_de : issuedTicket.package_label_en}</div> : null}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "access" ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" data-testid="pool-admin-access-section">
            <div className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><ShieldCheck size={18} /> Gate scanner</div>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
              <input value={scanCode} onChange={(e) => setScanCode(e.target.value)} data-testid="pool-admin-scan-code" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" placeholder="POOL-... or WB-..." />
              <button onClick={() => scanTurnstile("entry")} disabled={busy} data-testid="pool-admin-entry-button" className="rounded-full bg-[#0088CC] px-5 py-3 text-sm font-black text-white disabled:opacity-60">Entry</button>
              <button onClick={() => scanTurnstile("exit")} disabled={busy} data-testid="pool-admin-exit-button" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-black text-white disabled:opacity-60">Exit</button>
            </div>
            {scanResult ? (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4" data-testid="pool-admin-scan-result">
                <div className="font-bold text-slate-900">{scanResult.message}</div>
                <div className="mt-2 text-sm text-slate-600">Ticket: {scanResult.ticket?.ticket_code} · Wristband: {scanResult.ticket?.wristband_id || "—"} · Locker: {scanResult.ticket?.locker_id || "—"}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "lockers" ? (
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]" data-testid="pool-admin-lockers-section">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><Lock size={18} /> Assign locker</div>
              <div className="space-y-3">
                <input value={lockerTicketCode} onChange={(e) => setLockerTicketCode(e.target.value)} data-testid="pool-admin-locker-ticket-code" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" placeholder="POOL-..." />
                <input value={lockerId} onChange={(e) => setLockerId(e.target.value)} data-testid="pool-admin-locker-id" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" placeholder="Optional e.g. L-A01" />
                <button onClick={assignLocker} disabled={busy} data-testid="pool-admin-assign-locker" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0088CC] px-5 py-3 text-sm font-black text-white disabled:opacity-60">Assign locker</button>
                <input value={releaseLockerId} onChange={(e) => setReleaseLockerId(e.target.value)} data-testid="pool-admin-release-locker-id" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" placeholder="Locker to release" />
                <button onClick={releaseLocker} disabled={busy} data-testid="pool-admin-release-locker" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-black text-white disabled:opacity-60">Release locker</button>
              </div>
              {lockerResult ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" data-testid="pool-admin-locker-result">{lockerResult.locker?.locker_id} ↔ {lockerResult.ticket?.ticket_code}</div> : null}
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3"><div className="text-lg font-bold text-slate-900">Locker status</div><div className="text-sm text-slate-500" data-testid="pool-admin-occupied-lockers-count">{occupiedLockers.length} occupied</div></div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {lockers.map((locker) => (
                  <div key={locker.locker_id} className={`rounded-2xl border p-4 ${locker.status === "occupied" ? "border-[#0088CC] bg-[#E8F6FD]" : "border-slate-200 bg-slate-50"}`} data-testid={`pool-admin-locker-card-${locker.locker_id}`}>
                    <div className="font-bold text-slate-900">{locker.locker_id}</div>
                    <div className="mt-1 text-sm text-slate-600">{locker.zone} · {locker.size}</div>
                    <div className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{locker.status}</div>
                    {locker.ticket_code ? <div className="mt-2 text-xs text-slate-600">{locker.ticket_code}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "snacks" ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" data-testid="pool-admin-snacks-section">
            <div className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><ShoppingBag size={18} /> Snack POS</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {snackMenu.map((item) => (
                <div key={item.menu_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4" data-testid={`pool-admin-snack-card-${item.menu_id}`}>
                  <div className="font-bold text-slate-900">{activeLang === "de" ? item.label_de : item.label_en}</div>
                  <div className="mt-1 text-sm text-slate-500">€ {Number(item.price || 0).toFixed(2)}</div>
                  <div className="mt-3 flex items-center gap-2">
                    <button onClick={() => setSaleItems((prev) => ({ ...prev, [item.menu_id]: Math.max(0, (prev[item.menu_id] || 0) - 1) }))} data-testid={`pool-admin-snack-minus-${item.menu_id}`} className="h-9 w-9 rounded-full border border-slate-200 bg-white">−</button>
                    <div className="min-w-[52px] rounded-full border border-slate-200 bg-white px-3 py-2 text-center font-bold" data-testid={`pool-admin-snack-qty-${item.menu_id}`}>{saleItems[item.menu_id] || 0}</div>
                    <button onClick={() => setSaleItems((prev) => ({ ...prev, [item.menu_id]: Math.min(20, (prev[item.menu_id] || 0) + 1) }))} data-testid={`pool-admin-snack-plus-${item.menu_id}`} className="h-9 w-9 rounded-full border border-slate-200 bg-white">+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <TogglePill active={salePaymentMethod === "cash"} onClick={() => setSalePaymentMethod("cash")} label="Cash" testId="pool-admin-snack-payment-cash" />
                  <TogglePill active={salePaymentMethod === "card"} onClick={() => setSalePaymentMethod("card")} label="Card" testId="pool-admin-snack-payment-card" />
                  <TogglePill active={salePaymentMethod === "wristband"} onClick={() => setSalePaymentMethod("wristband")} label="Wristband" testId="pool-admin-snack-payment-wristband" />
                </div>
                <input value={saleTicketCode} onChange={(e) => setSaleTicketCode(e.target.value)} data-testid="pool-admin-snack-ticket-code" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" placeholder="Optional ticket code for wristband tab" />
              </div>
              <button onClick={createSnackSale} disabled={busy} data-testid="pool-admin-create-snack-sale" className="rounded-full bg-[#FF8C00] px-6 py-4 text-sm font-black text-white disabled:opacity-60">Save sale · € {snackTotal}</button>
            </div>
            {saleResult ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" data-testid="pool-admin-snack-sale-result">{saleResult.receipt_code} · € {Number(saleResult.total_amount || 0).toFixed(2)}</div> : null}
          </div>
        ) : null}

        {tab === "hardware" ? (
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]" data-testid="pool-admin-hardware-section">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><Cpu size={18} /> Hardware blueprint</div>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Deployment mode</div>
                  <div className="flex flex-wrap gap-2">
                    {(hardwareBlueprint.architectures || []).map((item) => <TogglePill key={item.id} active={deploymentMode === item.id} onClick={() => setDeploymentMode(item.id)} label={`${item.label_de} · ${item.fit}`} testId={`pool-admin-hardware-mode-${item.id}`} />)}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4" data-testid="pool-admin-hardware-rfid-card">
                  <div className="mb-2 flex items-center gap-2 font-bold text-slate-900"><Radio size={16} /> RFID / Wristband</div>
                  <div className="flex flex-wrap gap-2">
                    <TogglePill active={rfidProviderMode === "nfc_mifare_and_qr"} onClick={() => setRfidProviderMode("nfc_mifare_and_qr")} label="NFC/MIFARE + QR" testId="pool-admin-rfid-mode-combo" />
                    <TogglePill active={rfidProviderMode === "nfc_mifare"} onClick={() => setRfidProviderMode("nfc_mifare")} label="NFC / MIFARE" testId="pool-admin-rfid-mode-nfc" />
                    <TogglePill active={rfidProviderMode === "qr_only"} onClick={() => setRfidProviderMode("qr_only")} label="QR only" testId="pool-admin-rfid-mode-qr" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <TogglePill active={rfidAdapterType === "edge_reader_bridge"} onClick={() => setRfidAdapterType("edge_reader_bridge")} label="Edge reader bridge" testId="pool-admin-rfid-adapter-edge" />
                    <TogglePill active={rfidAdapterType === "serial_reader_bridge"} onClick={() => setRfidAdapterType("serial_reader_bridge")} label="Serial / USB bridge" testId="pool-admin-rfid-adapter-serial" />
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4" data-testid="pool-admin-hardware-turnstile-card">
                  <div className="mb-2 flex items-center gap-2 font-bold text-slate-900"><ServerCog size={16} /> Turnstile bridge</div>
                  <div className="flex flex-wrap gap-2">
                    <TogglePill active={turnstileAdapterType === "edge_turnstile_bridge"} onClick={() => setTurnstileAdapterType("edge_turnstile_bridge")} label="HTTP controller" testId="pool-admin-turnstile-http" />
                    <TogglePill active={turnstileAdapterType === "serial_turnstile_bridge"} onClick={() => setTurnstileAdapterType("serial_turnstile_bridge")} label="TCP / Serial bridge" testId="pool-admin-turnstile-serial" />
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4" data-testid="pool-admin-hardware-locker-card">
                  <div className="mb-2 flex items-center gap-2 font-bold text-slate-900"><Cable size={16} /> Locker relay / API</div>
                  <div className="flex flex-wrap gap-2">
                    <TogglePill active={lockerAdapterType === "edge_locker_bridge"} onClick={() => setLockerAdapterType("edge_locker_bridge")} label="Network locker API" testId="pool-admin-locker-network" />
                    <TogglePill active={lockerAdapterType === "relay_locker_bridge"} onClick={() => setLockerAdapterType("relay_locker_bridge")} label="Relay bridge" testId="pool-admin-locker-relay" />
                  </div>
                </div>
                <input value={sharedSecretHint} onChange={(e) => setSharedSecretHint(e.target.value)} data-testid="pool-admin-hardware-secret-hint" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3" placeholder="Shared secret / gateway note" />
                <button onClick={saveHardwareBlueprint} disabled={busy} data-testid="pool-admin-save-hardware-blueprint" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0088CC] px-5 py-4 text-sm font-black text-white disabled:opacity-60">Save hardware blueprint</button>
                {hardwareSaveResult ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" data-testid="pool-admin-hardware-save-result">{hardwareSaveResult.message}</div> : null}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" data-testid="pool-admin-hardware-architecture-card">
                <div className="mb-4 text-lg font-bold text-slate-900">Empfohlene Integrations-Architektur</div>
                <div className="space-y-3 text-sm text-slate-600">
                  {(hardwareBlueprint.architectures || []).map((item) => (
                    <div key={item.id} className={`rounded-2xl border p-4 ${deploymentMode === item.id ? "border-[#0088CC] bg-[#E8F6FD]" : "border-slate-200 bg-slate-50"}`} data-testid={`pool-admin-architecture-${item.id}`}>
                      <div className="font-bold text-slate-900">{item.label_de}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">Fit: {item.fit}</div>
                      <div className="mt-2">{item.note_de}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" data-testid="pool-admin-hardware-fields-card">
                <div className="mb-4 text-lg font-bold text-slate-900">Adapter-Felder & Kommandos</div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4" data-testid="pool-admin-hardware-rfid-fields">
                    <div className="font-bold text-slate-900">RFID</div>
                    <div className="mt-2 space-y-1 text-xs text-slate-600">{(hardwareBlueprint.rfid?.fields || []).map((field) => <div key={field}>• {field}</div>)}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4" data-testid="pool-admin-hardware-turnstile-fields">
                    <div className="font-bold text-slate-900">Turnstile</div>
                    <div className="mt-2 space-y-1 text-xs text-slate-600">{(hardwareBlueprint.turnstile?.fields || []).map((field) => <div key={field}>• {field}</div>)}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4" data-testid="pool-admin-hardware-locker-fields">
                    <div className="font-bold text-slate-900">Locker</div>
                    <div className="mt-2 space-y-1 text-xs text-slate-600">{(hardwareBlueprint.locker?.fields || []).map((field) => <div key={field}>• {field}</div>)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" data-testid="pool-admin-hardware-events-card">
                <div className="mb-4 text-lg font-bold text-slate-900">Hardware event log</div>
                <div className="space-y-3">
                  {hardwareEvents.length === 0 ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500" data-testid="pool-admin-hardware-events-empty">Noch keine Hardware-Ereignisse gespeichert.</div> : hardwareEvents.map((event) => (
                    <div key={event.event_id} className="rounded-2xl bg-slate-50 p-4" data-testid={`pool-admin-hardware-event-${event.event_id}`}>
                      <div className="flex items-center justify-between gap-3"><div className="font-bold text-slate-900">{event.device_type} · {event.adapter_type}</div><div className="text-sm text-slate-500">{event.status}</div></div>
                      <div className="mt-1 text-sm text-slate-600">{event.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "history" ? (
          <div className="grid gap-6 xl:grid-cols-2" data-testid="pool-admin-history-section">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><BarChart3 size={18} /> Ticket history</div>
              <div className="space-y-3">{(dashboard?.recent_tickets || []).map((ticket) => <div key={ticket.ticket_code} className="rounded-2xl bg-slate-50 p-4" data-testid={`pool-admin-history-ticket-${ticket.ticket_code}`}><div className="font-bold text-slate-900">{ticket.ticket_code}</div><div className="mt-1 text-sm text-slate-600">{activeLang === "de" ? ticket.package_label_de : ticket.package_label_en} · {ticket.status}</div></div>)}</div>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><CheckCircle2 size={18} /> Snack sales</div>
              <div className="space-y-3">{(dashboard?.recent_sales || []).map((sale) => <div key={sale.sale_id} className="rounded-2xl bg-slate-50 p-4" data-testid={`pool-admin-history-sale-${sale.sale_id}`}><div className="font-bold text-slate-900">{sale.receipt_code}</div><div className="mt-1 text-sm text-slate-600">{sale.payment_method} · € {Number(sale.total_amount || 0).toFixed(2)}</div></div>)}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}