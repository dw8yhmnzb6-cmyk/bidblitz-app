import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, ShieldCheck, ReceiptText, Coins, Tag, MapPin, Loader2,
  Save, Building2, Search, Sparkles, ChevronRight, Gift, Star, Download, FileUp, WandSparkles
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { QRCodeSVG } from "qrcode.react";

const API = process.env.REACT_APP_BACKEND_URL;


export default function ChargeAppPage({ onBack, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [merchantQuery, setMerchantQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [warrantyFile, setWarrantyFile] = useState(null);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [warrantyPassPreview, setWarrantyPassPreview] = useState(null);
  const [warrantyForm, setWarrantyForm] = useState({
    product_name: "BidBlitz Charge Pro 65W",
    serial_number: "",
    purchase_date: "",
    merchant_name: "",
    invoice_number: "",
  });
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_number: "",
    merchant_name: "",
    amount: "",
    purchase_date: "",
    product_name: "",
    serial_number: "",
  });

  const loadDashboard = useCallback(async () => {
    try {
      const data = await api.getChargeAppDashboard();
      setDashboard(data);
    } catch (error) {
      toast.error(error.message || "Charge App konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const submitWarranty = useCallback(async () => {
    if (!warrantyForm.product_name.trim() || !warrantyForm.serial_number.trim()) {
      toast.error("Bitte Produktname und Seriennummer ausfüllen");
      return;
    }
    setBusy("warranty");
    try {
      const response = await api.registerChargeWarranty(warrantyForm);
      const registrationId = response?.warranty?.registration_id;
      if (warrantyFile && registrationId) {
        await api.uploadChargeWarrantyAttachment(registrationId, warrantyFile);
      }
      toast.success("Garantie erfolgreich registriert");
      setWarrantyForm((prev) => ({ ...prev, serial_number: "", invoice_number: "" }));
      setWarrantyFile(null);
      await loadDashboard();
    } catch (error) {
      toast.error(error.message || "Garantie konnte nicht registriert werden");
    } finally {
      setBusy("");
    }
  }, [warrantyForm, warrantyFile, loadDashboard]);

  const saveInvoice = useCallback(async () => {
    if (!invoiceForm.invoice_number.trim() || !invoiceForm.merchant_name.trim()) {
      toast.error("Bitte Rechnungsnummer und Händlername ausfüllen");
      return;
    }
    setBusy("invoice");
    try {
      const response = await api.saveChargeInvoice({
        ...invoiceForm,
        amount: Number(invoiceForm.amount) || 0,
      });
      const invoiceId = response?.invoice?.invoice_id;
      if (invoiceFile && invoiceId) {
        await api.uploadChargeInvoiceAttachment(invoiceId, invoiceFile);
      }
      toast.success("Rechnung gespeichert");
      setInvoiceForm({ invoice_number: "", merchant_name: "", amount: "", purchase_date: "", product_name: "", serial_number: "" });
      setInvoiceFile(null);
      await loadDashboard();
    } catch (error) {
      toast.error(error.message || "Rechnung konnte nicht gespeichert werden");
    } finally {
      setBusy("");
    }
  }, [invoiceForm, invoiceFile, loadDashboard]);

  const previewWarrantyPass = useCallback(async (registrationId) => {
    setBusy(`pass-${registrationId}`);
    try {
      const response = await api.getChargeWarrantyPass(registrationId);
      setWarrantyPassPreview(response?.pass || null);
      toast.success("Digitalpass geladen");
    } catch (error) {
      toast.error(error.message || "Digitalpass konnte nicht geladen werden");
    } finally {
      setBusy("");
    }
  }, []);

  const openMerchantDetail = useCallback(async (item, source = "merchant_list") => {
    try {
      await api.trackChargeInteraction({
        interaction_type: source,
        merchant_slug: item.public_slug || item.merchant_slug || "",
        merchant_name: item.business_name || item.merchant_name || "",
        city: item.city || item.region || "",
        category: item.category || "",
        offer_title: item.title || "",
      });
    } catch (error) {
      void error;
    }
    const route = item.route || (item.public_slug || item.merchant_slug ? `/charge-app/merchant?slug=${encodeURIComponent(item.public_slug || item.merchant_slug)}` : "/merchant");
    onNavigate?.(route);
  }, [onNavigate]);

  const merchants = useMemo(() => {
    const rows = dashboard?.merchants || [];
    if (!merchantQuery.trim()) return rows;
    const q = merchantQuery.toLowerCase();
    return rows.filter((item) =>
      [item.business_name, item.city, item.category, item.address].join(" ").toLowerCase().includes(q)
    );
  }, [dashboard?.merchants, merchantQuery]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#071018]" data-testid="charge-app-loading">
        <Loader2 size={26} className="animate-spin text-[#6EE7F9]" />
      </div>
    );
  }

  const loyalty = dashboard?.loyalty?.status || {};
  const overview = dashboard?.summary || {};
  const personalization = dashboard?.personalization || {};

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#06101B_0%,#0A1626_42%,#F4F0E8_42%,#F4F0E8_100%)] pb-24" data-testid="charge-app-page">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#08131dcc] px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5" data-testid="charge-app-back-button">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#6EE7F9]">BidBlitz Charge</p>
            <h1 className="text-xl font-black text-white">Deine Garantie-, Punkte- und Händler-App</h1>
          </div>
          <button onClick={() => onNavigate?.("/all-services")} className="rounded-full border border-[#6EE7F9]/25 bg-[#6EE7F9]/10 px-4 py-2 text-xs font-black text-[#D8FCFF]" data-testid="charge-app-all-services-button">
            Mehr Services
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(110,231,249,0.22),transparent_30%),linear-gradient(135deg,rgba(8,19,29,1),rgba(14,26,43,0.96))] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]" data-testid="charge-app-hero">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="inline-flex rounded-full border border-[#6EE7F9]/20 bg-[#6EE7F9]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#D8FCFF]">Premium Zubehör. Digitale Betreuung.</p>
              <h2 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">Alles für deine Charge-Produkte in einer App.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">Garantie registrieren, Rechnungen sicher ablegen, Punkte sammeln, Angebote entdecken und passende Händler finden – in einem sauberen BidBlitz Charge Erlebnis.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard label="Garantien" value={overview.registered_warranties || 0} icon={ShieldCheck} testid="charge-app-summary-warranties" />
              <SummaryCard label="Rechnungen" value={overview.stored_invoices || 0} icon={ReceiptText} testid="charge-app-summary-invoices" />
              <SummaryCard label="Punkte" value={overview.coins_balance || 0} icon={Coins} testid="charge-app-summary-coins" />
              <SummaryCard label="Händler" value={overview.merchants_total || 0} icon={MapPin} testid="charge-app-summary-merchants" />
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <SurfaceCard title="Garantie registrieren" icon={ShieldCheck} testid="charge-app-warranty-card">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field value={warrantyForm.product_name} onChange={(value) => setWarrantyForm((prev) => ({ ...prev, product_name: value }))} placeholder="Produktname" testid="charge-app-warranty-product-input" />
              <Field value={warrantyForm.serial_number} onChange={(value) => setWarrantyForm((prev) => ({ ...prev, serial_number: value }))} placeholder="Seriennummer" testid="charge-app-warranty-serial-input" />
              <Field value={warrantyForm.purchase_date} onChange={(value) => setWarrantyForm((prev) => ({ ...prev, purchase_date: value }))} placeholder="Kaufdatum 2026-07-29" testid="charge-app-warranty-purchase-date-input" />
              <Field value={warrantyForm.invoice_number} onChange={(value) => setWarrantyForm((prev) => ({ ...prev, invoice_number: value }))} placeholder="Rechnungsnummer" testid="charge-app-warranty-invoice-input" />
            </div>
            <Field value={warrantyForm.merchant_name} onChange={(value) => setWarrantyForm((prev) => ({ ...prev, merchant_name: value }))} placeholder="Händlername" testid="charge-app-warranty-merchant-input" />
            <UploadField label="Garantiebeleg hochladen (PDF/JPG/PNG/WebP)" file={warrantyFile} onChange={setWarrantyFile} testid="charge-app-warranty-file-input" />
            <ActionButton onClick={submitWarranty} busy={busy === "warranty"} icon={ShieldCheck} testid="charge-app-warranty-submit">Garantie aktivieren</ActionButton>
          </SurfaceCard>

          <SurfaceCard title="Rechnung speichern" icon={ReceiptText} testid="charge-app-invoice-card">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field value={invoiceForm.invoice_number} onChange={(value) => setInvoiceForm((prev) => ({ ...prev, invoice_number: value }))} placeholder="Rechnungsnummer" testid="charge-app-invoice-number-input" />
              <Field value={invoiceForm.merchant_name} onChange={(value) => setInvoiceForm((prev) => ({ ...prev, merchant_name: value }))} placeholder="Händlername" testid="charge-app-invoice-merchant-input" />
              <Field value={invoiceForm.amount} onChange={(value) => setInvoiceForm((prev) => ({ ...prev, amount: value }))} placeholder="Betrag in EUR" testid="charge-app-invoice-amount-input" />
              <Field value={invoiceForm.purchase_date} onChange={(value) => setInvoiceForm((prev) => ({ ...prev, purchase_date: value }))} placeholder="Kaufdatum" testid="charge-app-invoice-date-input" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field value={invoiceForm.product_name} onChange={(value) => setInvoiceForm((prev) => ({ ...prev, product_name: value }))} placeholder="Produkt" testid="charge-app-invoice-product-input" />
              <Field value={invoiceForm.serial_number} onChange={(value) => setInvoiceForm((prev) => ({ ...prev, serial_number: value }))} placeholder="Seriennummer" testid="charge-app-invoice-serial-input" />
            </div>
            <UploadField label="Rechnung / Beleg hochladen (PDF/JPG/PNG/WebP)" file={invoiceFile} onChange={setInvoiceFile} testid="charge-app-invoice-file-input" />
            <ActionButton onClick={saveInvoice} busy={busy === "invoice"} icon={Save} testid="charge-app-invoice-submit">Rechnung sichern</ActionButton>
          </SurfaceCard>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <SurfaceCard title="Für dich personalisiert" icon={WandSparkles} testid="charge-app-personalized-offers-card">
            <div className="rounded-[26px] border border-[#D9CFC0] bg-[linear-gradient(145deg,#FFF7E9,#FFFFFF)] p-4" data-testid="charge-app-personalization-profile-card">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-[#0A1626] px-3 py-1 font-black text-[#6EE7F9]" data-testid="charge-app-personalization-region">Region: {personalization.region || "Deutschland"}</span>
                {(personalization.top_categories || []).slice(0, 2).map((item, index) => <span key={item} className="rounded-full border border-[#D9CFC0] px-3 py-1 font-semibold" data-testid={`charge-app-personalization-category-${index}`}>{item}</span>)}
                {(personalization.top_merchants || []).slice(0, 1).map((item) => <span key={item} className="rounded-full border border-[#D9CFC0] px-3 py-1 font-semibold" data-testid="charge-app-personalization-merchant">Händlerfokus: {item}</span>)}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">Wir priorisieren Angebote für deine Region, deine bisherigen Charge-Händler und passende Zubehörkategorien.</p>
            </div>
            <div className="grid gap-3">
              {(dashboard?.personalized_offers || []).map((item, index) => (
                <div key={item.offer_id || `${item.title}-${index}`} className="rounded-[26px] border border-[#D9CFC0] bg-[linear-gradient(145deg,#FFF7E9,#FFFFFF)] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]" data-testid={`charge-app-personalized-offer-${index}`}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#0A1626] px-3 py-1 text-[11px] font-black text-[#6EE7F9]" data-testid={`charge-app-personalized-offer-score-${index}`}>{item.score || 0} Match</span>
                        <span className="rounded-full border border-[#D9CFC0] px-3 py-1 text-[11px] font-semibold text-slate-600">{item.region || "Deutschland"}</span>
                        <span className="rounded-full border border-[#D9CFC0] px-3 py-1 text-[11px] font-semibold text-slate-600">{item.category || "Charge / Retail"}</span>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-slate-900">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(item.reasons || [item.reason]).slice(0, 3).map((reason, reasonIndex) => (
                          <span key={`${reason}-${reasonIndex}`} className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700" data-testid={`charge-app-personalized-offer-reason-${index}-${reasonIndex}`}>{reason}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex min-w-[160px] flex-col items-start gap-3 lg:items-end">
                      <span className="rounded-full bg-[#0A1626] px-3 py-1 text-xs font-black text-[#6EE7F9]">{item.value}{typeof item.value === "number" ? "%" : ""}</span>
                      <button onClick={() => openMerchantDetail(item, "personalized_offer_click")} className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#0A1626] px-4 text-xs font-black text-[#D8FCFF]" data-testid={`charge-app-personalized-offer-cta-${index}`}>{item.cta_label || "Zum Händler"}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard title="Punkte sammeln" icon={Coins} testid="charge-app-loyalty-card">
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoPill label="Coins" value={loyalty.coins_balance || 0} testid="charge-app-loyalty-coins" />
              <InfoPill label="Level" value={loyalty.level_name || "Bronze"} testid="charge-app-loyalty-level" />
              <InfoPill label="Cashback" value={`€${Number(loyalty.total_cashback_earned || 0).toFixed(2)}`} testid="charge-app-loyalty-cashback" />
            </div>
            <div className="mt-4 rounded-3xl border border-[#D9CFC0] bg-[#FFF9F2] p-4" data-testid="charge-app-loyalty-progress-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">Nächstes Level: {loyalty.progress?.next_level || "VIP"}</p>
                  <p className="text-xs text-slate-500">Mehr Käufe, mehr Punkte und mehr Vorteile im Charge-Netzwerk.</p>
                </div>
                <span className="rounded-full bg-[#0A1626] px-3 py-1 text-xs font-black text-[#6EE7F9]" data-testid="charge-app-loyalty-progress-value">{Number(loyalty.progress?.progress || 0).toFixed(0)}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E6DED1]">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#F5B942,#6EE7F9)]" style={{ width: `${Math.min(100, Number(loyalty.progress?.progress || 0))}%` }} />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {Object.entries(dashboard?.loyalty?.stats?.by_module || {}).slice(0, 4).map(([key, row], index) => (
                <div key={key} className="flex items-center justify-between rounded-2xl border border-[#E1D7C7] bg-white px-4 py-3" data-testid={`charge-app-loyalty-module-${index}`}>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{key.replace(/_/g, " ")}</p>
                    <p className="text-xs text-slate-500">{row.transactions} Transaktionen · €{Number(row.spent || 0).toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-[#D89A00]">+{row.coins || 0}</p>
                    <p className="text-xs text-emerald-600">€{Number(row.cashback || 0).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard title="Angebote erhalten" icon={Gift} testid="charge-app-offers-card">
            <div className="grid gap-3 md:grid-cols-2">
              {(dashboard?.offers || []).map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-[26px] border border-[#D9CFC0] bg-[linear-gradient(145deg,#FFF7E9,#FFFFFF)] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]" data-testid={`charge-app-offer-${index}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-amber-600">{item.offer_type}</p>
                      <h3 className="mt-1 text-base font-black text-slate-900">{item.title}</h3>
                    </div>
                    <span className="rounded-full bg-[#0A1626] px-3 py-1 text-xs font-black text-[#6EE7F9]">{item.value}{typeof item.value === "number" ? "%" : ""}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span>{item.target || "all"}</span>
                    <span>{item.expires_at ? new Date(item.expires_at).toLocaleDateString("de-DE") : "laufend"}</span>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <SurfaceCard title="Gespeicherte Garantien" icon={ShieldCheck} testid="charge-app-warranty-list-card">
            {warrantyPassPreview ? (
              <div className="mb-4 rounded-[28px] border border-[#B9E7EF] bg-[linear-gradient(145deg,#0A1626,#102236)] p-4 text-white" data-testid="charge-app-warranty-pass-preview-card">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[#A9F3FF]">Digitaler Garantiepass</p>
                    <h3 className="mt-2 text-xl font-black">{warrantyPassPreview.coverage_label}</h3>
                    <p className="mt-1 text-sm text-slate-300">Pass ID {warrantyPassPreview.pass_id} · gültig bis {warrantyPassPreview.valid_until}</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <PassPill label="Status" value={warrantyPassPreview.status_label} testid="charge-app-pass-status" />
                      <PassPill label="Produkt" value={warrantyPassPreview.product_name} testid="charge-app-pass-product" />
                      <PassPill label="Seriennummer" value={warrantyPassPreview.serial_number} testid="charge-app-pass-serial" />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3 rounded-[26px] border border-white/10 bg-white/5 p-4" data-testid="charge-app-pass-qr-card">
                    <QRCodeSVG value={warrantyPassPreview.qr_payload} size={132} includeMargin bgColor="#ffffff" fgColor="#0A1626" />
                    <a href={`${API}/api/charge-app/warranty/${encodeURIComponent(warrantyPassPreview.registration_id)}/pass/download`} className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#6EE7F9] px-4 text-xs font-black text-slate-950" data-testid="charge-app-pass-download-button"><Download size={14} className="mr-2" />Pass laden</a>
                  </div>
                </div>
              </div>
            ) : null}
            {(dashboard?.warranties || []).length === 0 ? <EmptyState label="Noch keine Garantie registriert" testid="charge-app-empty-warranties" /> : (dashboard?.warranties || []).map((item, index) => (
              <div key={item.registration_id} className="rounded-2xl border border-[#E1D7C7] bg-white px-4 py-3" data-testid={`charge-app-warranty-item-${index}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">{item.product_name}</p>
                    <p className="mt-1 text-xs text-slate-500">SN {item.serial_number} · {item.merchant_name}</p>
                    <p className="mt-2 text-xs text-slate-600">{item.coverage_label} · gültig bis {item.valid_until}</p>
                    {item.attachments?.length ? <AttachmentRow attachments={item.attachments} testid={`charge-app-warranty-attachments-${index}`} /> : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{item.status}</span>
                    <button onClick={() => previewWarrantyPass(item.registration_id)} disabled={busy === `pass-${item.registration_id}`} className="rounded-full border border-[#0A1626]/10 bg-[#0A1626] px-3 py-1 text-[11px] font-black text-[#D8FCFF] disabled:opacity-50" data-testid={`charge-app-warranty-pass-preview-${index}`}>{busy === `pass-${item.registration_id}` ? "Lädt..." : "Pass ansehen"}</button>
                  </div>
                </div>
              </div>
            ))}
          </SurfaceCard>

          <SurfaceCard title="Händler finden" icon={MapPin} testid="charge-app-merchants-card">
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={merchantQuery} onChange={(e) => setMerchantQuery(e.target.value)} placeholder="Stadt, Händler oder Kategorie suchen" className="h-11 w-full rounded-2xl border border-[#D9CFC0] bg-white pl-10 pr-4 text-sm text-slate-900 outline-none" data-testid="charge-app-merchant-search-input" />
            </div>
            <div className="space-y-3">
              {merchants.length === 0 ? <EmptyState label="Keine Händler gefunden" testid="charge-app-empty-merchants" /> : merchants.map((item, index) => (
                <button key={`${item.business_name}-${index}`} onClick={() => openMerchantDetail(item, "merchant_click") } className="flex w-full items-center gap-3 rounded-2xl border border-[#E1D7C7] bg-white px-4 py-3 text-left transition hover:-translate-y-0.5" data-testid={`charge-app-merchant-item-${index}`}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0A1626] text-[#6EE7F9]">
                    {item.logo_url ? <img src={item.logo_url} alt="" className="h-11 w-11 rounded-2xl object-cover" /> : <Building2 size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">{item.business_name}</p>
                    <p className="truncate text-xs text-slate-500">{item.city} · {item.category}</p>
                    <p className="truncate text-xs text-slate-400">{item.address || item.website || "BidBlitz Charge Netzwerk"}</p>
                    {item.match_reason ? <p className="mt-2 text-[11px] font-semibold text-amber-700" data-testid={`charge-app-merchant-match-reason-${index}`}>{item.match_reason}</p> : null}
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </button>
              ))}
            </div>
          </SurfaceCard>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <SurfaceCard title="Gespeicherte Rechnungen" icon={ReceiptText} testid="charge-app-invoices-list-card">
            {(dashboard?.invoices || []).length === 0 ? <EmptyState label="Noch keine Rechnungen gespeichert" testid="charge-app-empty-invoices" /> : (dashboard?.invoices || []).map((item, index) => (
              <div key={item.invoice_id} className="rounded-2xl border border-[#E1D7C7] bg-white px-4 py-3" data-testid={`charge-app-invoice-item-${index}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">{item.invoice_number}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.merchant_name} · {item.product_name}</p>
                    <p className="mt-2 text-xs text-slate-600">Kaufdatum {item.purchase_date || "—"} · SN {item.serial_number || "—"}</p>
                    {item.attachments?.length ? <AttachmentRow attachments={item.attachments} testid={`charge-app-invoice-attachments-${index}`} /> : null}
                  </div>
                  <span className="rounded-full bg-[#0A1626] px-3 py-1 text-xs font-black text-[#6EE7F9]">€{Number(item.amount || 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </SurfaceCard>

          <SurfaceCard title="Warum BidBlitz Charge?" icon={Sparkles} testid="charge-app-value-card">
            <div className="space-y-3 text-sm text-slate-600">
              {[
                "Digitale Garantie ohne Papierchaos",
                "Gesicherte Rechnungsübersicht für spätere Fälle",
                "Punkte- und Cashback-Vorteile im Charge-Netzwerk",
                "Schneller Zugang zu Angeboten und passenden Händlern",
              ].map((item, index) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-[#E1D7C7] bg-white px-4 py-3" data-testid={`charge-app-value-item-${index}`}>
                  <Star size={16} className="mt-0.5 text-amber-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}


function SummaryCard({ label, value, icon: Icon, testid }) {
  return (
    <div className="rounded-[26px] border border-white/8 bg-white/5 p-4" data-testid={testid}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300">{label}</span>
        <Icon size={16} className="text-[#6EE7F9]" />
      </div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </div>
  );
}


function SurfaceCard({ title, icon: Icon, children, testid }) {
  return (
    <div className="rounded-[30px] border border-[#D9CFC0] bg-[#F8F3EA] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]" data-testid={testid}>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0A1626] text-[#6EE7F9]">
          <Icon size={16} />
        </div>
        <h3 className="text-lg font-black text-slate-900">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}


function Field({ value, onChange, placeholder, testid }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-2xl border border-[#D9CFC0] bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400" data-testid={testid} />;
}


function UploadField({ label, file, onChange, testid }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-[#D9CFC0] bg-white px-4 py-3" data-testid={`${testid}-wrapper`}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{file?.name || "Noch keine Datei gewählt"}</p>
      </div>
      <div className="inline-flex items-center gap-2 rounded-full bg-[#0A1626] px-3 py-2 text-xs font-black text-[#D8FCFF]"><FileUp size={14} />Datei wählen</div>
      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onChange(e.target.files?.[0] || null)} data-testid={testid} />
    </label>
  );
}


function ActionButton({ onClick, busy, icon: Icon, children, testid }) {
  return (
    <button onClick={onClick} disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#0A1626] text-sm font-black text-[#D8FCFF] disabled:opacity-50" data-testid={testid}>
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
      {children}
    </button>
  );
}


function InfoPill({ label, value, testid }) {
  return (
    <div className="rounded-2xl border border-[#E1D7C7] bg-white px-4 py-3" data-testid={testid}>
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}


function PassPill({ label, value, testid }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3" data-testid={testid}><p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{label}</p><p className="mt-2 text-sm font-black text-white">{value}</p></div>;
}


function AttachmentRow({ attachments, testid }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2" data-testid={testid}>
      {attachments.map((item, index) => (
        <a key={item.attachment_id} href={`${API}${item.download_path}`} className="inline-flex items-center gap-2 rounded-full border border-[#0A1626]/10 bg-[#F4F8FB] px-3 py-1 text-[11px] font-semibold text-slate-700" data-testid={`${testid}-item-${index}`}>
          <Download size={12} />{item.original_filename}
        </a>
      ))}
    </div>
  );
}


function EmptyState({ label, testid }) {
  return <div className="rounded-2xl border border-dashed border-[#D9CFC0] bg-white/60 px-4 py-8 text-center text-sm text-slate-500" data-testid={testid}>{label}</div>;
}