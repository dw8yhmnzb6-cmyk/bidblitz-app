/**
 * BidBlitz V2 - Merchant Portal / Händler-Dashboard
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, BarChart3, DollarSign, ShoppingBag, Users, Star,
  Calendar, Hotel, Briefcase, Ticket, UtensilsCrossed, Heart,
  TrendingUp, Wallet, Clock, MapPin, Phone, Mail, Globe,
  Settings, Loader2, Check, Save, Scissors, ChevronRight,
  Building2, Image as ImageIcon, Gift, Megaphone, Store, LineChart, Link2,
  BrainCircuit, Boxes, ReceiptText, AlertTriangle, Sparkles, Activity, ShieldAlert, PackageCheck,
  Bot, Settings2, ClipboardList, Truck, Zap, PlayCircle, FileText, Wrench, Landmark, Plus, ShieldCheck, Package, RefreshCcw, BadgeEuro
} from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { api } from "../services/api";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const MerchantPortalPage = ({ onBack, onNavigate }) => {
  const { lang } = useI18n();
  const locale = (lang || "de").startsWith("sq") ? "sq" : (lang || "de").startsWith("en") ? "en" : "de";
  const [tab, setTab] = useState("dashboard");
  const [dash, setDash] = useState(null);
  const [enterprise, setEnterprise] = useState(null);
  const [merchantProgram, setMerchantProgram] = useState(null);
  const [growth, setGrowth] = useState(null);
  const [franchiseApplications, setFranchiseApplications] = useState([]);
  const [v5, setV5] = useState(null);
  const [executiveAi, setExecutiveAi] = useState(null);
  const [executiveAiHistory, setExecutiveAiHistory] = useState([]);
  const [executiveAiText, setExecutiveAiText] = useState("");
  const [executiveAiFocus, setExecutiveAiFocus] = useState("full executive briefing");
  const [executiveAiStreaming, setExecutiveAiStreaming] = useState(false);
  const [businessAutomation, setBusinessAutomation] = useState(null);
  const [automationSettings, setAutomationSettings] = useState(null);
  const [automationRunning, setAutomationRunning] = useState("");
  const [opsSuite, setOpsSuite] = useState(null);
  const [dealerInventory, setDealerInventory] = useState(null);
  const [dealerReorders, setDealerReorders] = useState(null);
  const [dealerInvoices, setDealerInvoices] = useState(null);
  const [dealerMarketing, setDealerMarketing] = useState(null);
  const [dealerWarranty, setDealerWarranty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [txns, setTxns] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [hotelBookings, setHotelBookings] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [tips, setTips] = useState({ tips: [], total: 0 });

  // Profile edit
  const [profile, setProfile] = useState({
    business_name: "", logo_url: "", description: "", phone: "",
    email: "", website: "", address: "", city: "", opening_hours: "", category: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [opsBusy, setOpsBusy] = useState("");
  const [companyForm, setCompanyForm] = useState({ name: "", legal_name: "", country: "Kosovo", status: "active", manager_email: "", tax_id: "", wallet_budget: 0, branch_count: 1 });
  const [documentForm, setDocumentForm] = useState({ title: "", category: "compliance", status: "draft", linked_company_id: "", expiry_date: "", external_url: "", notes: "" });
  const [maintenanceForm, setMaintenanceForm] = useState({ asset_name: "", asset_type: "terminal", priority: "medium", status: "open", linked_company_id: "", vendor_name: "", next_check_at: "", notes: "" });
  const [dealerBusy, setDealerBusy] = useState("");
  const [reorderForm, setReorderForm] = useState({ supplier_id: "", store_id: "", note: "" });
  const [warrantyForm, setWarrantyForm] = useState({ product_id: "", serial_number: "", issue_type: "defekt", customer_name: "", customer_email: "", purchase_date: "", issue_summary: "", requested_resolution: "repair" });

  const loadDash = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/merchant-portal/dashboard`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setDash(d);
        if (d.profile) setProfile(prev => ({ ...prev, ...d.profile }));
      }
      const [entRes, v5Res, aiRes, automationRes, opsRes, progRes, growthRes, fraRes] = await Promise.all([
        fetch(`${API}/api/merchant-portal/enterprise-overview`, { credentials: "include" }),
        fetch(`${API}/api/merchant-portal/v5/dashboard`, { credentials: "include" }),
        fetch(`${API}/api/merchant-portal/v5/executive-ai/latest`, { credentials: "include" }),
        fetch(`${API}/api/merchant-portal/v5/business-automation`, { credentials: "include" }),
        fetch(`${API}/api/merchant-portal/v5/ops-suite`, { credentials: "include" }),
        fetch(`${API}/api/referral/merchant-program`, { credentials: "include" }),
        fetch(`${API}/api/referral/growth-dashboard`, { credentials: "include" }),
        fetch(`${API}/api/referral/franchise/applications`, { credentials: "include" }),
      ]);
      if (entRes.ok) setEnterprise(await entRes.json());
      if (v5Res.ok) setV5(await v5Res.json());
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        setExecutiveAi(aiData.report || null);
        setExecutiveAiHistory(aiData.history || []);
        setExecutiveAiText(aiData.report?.report_text || "");
      }
      if (automationRes.ok) {
        const automationData = await automationRes.json();
        setBusinessAutomation(automationData);
        setAutomationSettings(automationData.settings || null);
      }
      if (opsRes.ok) {
        const opsData = await opsRes.json();
        setOpsSuite(opsData);
        const firstCompany = (opsData.companies || [])[0];
        if (firstCompany) {
          setDocumentForm((prev) => ({ ...prev, linked_company_id: prev.linked_company_id || firstCompany.company_id }));
          setMaintenanceForm((prev) => ({ ...prev, linked_company_id: prev.linked_company_id || firstCompany.company_id }));
        }
      }
      if (progRes.ok) setMerchantProgram(await progRes.json());
      if (growthRes.ok) setGrowth(await growthRes.json());
      if (fraRes.ok) {
        const data = await fraRes.json();
        setFranchiseApplications(data.applications || []);
      }
    } catch (error) {
      void error;
    }
    setLoading(false);
  }, []);

  const loadTab = useCallback(async (t) => {
    const endpoints = {
      transactions: { url: "/api/merchant-portal/transactions", setter: (d) => setTxns(d.transactions || []) },
      reservations: { url: "/api/merchant-portal/reservations", setter: (d) => setReservations(d.reservations || []) },
      hotels: { url: "/api/merchant-portal/hotel-bookings", setter: (d) => setHotelBookings(d.bookings || []) },
      appointments: { url: "/api/merchant-portal/appointments", setter: (d) => setAppointments(d.appointments || []) },
      tips: { url: "/api/merchant-portal/tips", setter: (d) => setTips(d) },
    };
    const ep = endpoints[t];
    if (ep) {
      try { const res = await fetch(`${API}${ep.url}`, { credentials: "include" }); if (res.ok) ep.setter(await res.json()); } catch (error) { void error; }
    }
  }, []);

  const loadDealerInventory = useCallback(async () => {
    try {
      const data = await api.getMerchantDealerInventory();
      setDealerInventory(data);
    } catch (error) {
      toast.error(error.message || "Lagerbestand konnte nicht geladen werden");
    }
  }, []);

  const loadDealerReorders = useCallback(async () => {
    try {
      const data = await api.getMerchantDealerReorders();
      setDealerReorders(data);
      const firstSupplier = (data.suppliers || [])[0]?.supplier_id || "";
      const firstStore = (data.stores || [])[0]?.store_id || "";
      setReorderForm((prev) => ({
        ...prev,
        supplier_id: prev.supplier_id || firstSupplier,
        store_id: prev.store_id || firstStore,
      }));
    } catch (error) {
      toast.error(error.message || "Nachbestellungen konnten nicht geladen werden");
    }
  }, []);

  const loadDealerInvoices = useCallback(async () => {
    try {
      const data = await api.getMerchantDealerInvoices();
      setDealerInvoices(data);
    } catch (error) {
      toast.error(error.message || "Rechnungen konnten nicht geladen werden");
    }
  }, []);

  const loadDealerMarketing = useCallback(async () => {
    try {
      const data = await api.getMerchantDealerMarketing();
      setDealerMarketing(data);
    } catch (error) {
      toast.error(error.message || "Werbematerial konnte nicht geladen werden");
    }
  }, []);

  const loadDealerWarranty = useCallback(async () => {
    try {
      const data = await api.getMerchantDealerWarranty();
      setDealerWarranty(data);
      const firstProduct = (dealerInventory?.top_products || [])[0]?.product_id || "";
      setWarrantyForm((prev) => ({ ...prev, product_id: prev.product_id || firstProduct }));
    } catch (error) {
      toast.error(error.message || "Garantieabwicklung konnte nicht geladen werden");
    }
  }, [dealerInventory?.top_products]);

  useEffect(() => { loadDash(); }, [loadDash]);
  useEffect(() => { if (["transactions", "reservations", "hotels", "appointments", "tips"].includes(tab)) loadTab(tab); }, [tab, loadTab]);
  useEffect(() => {
    if (tab === "inventory") loadDealerInventory();
    if (tab === "reorders") loadDealerReorders();
    if (tab === "invoices") loadDealerInvoices();
    if (tab === "marketing") loadDealerMarketing();
    if (tab === "warranty") loadDealerWarranty();
  }, [tab, loadDealerInventory, loadDealerReorders, loadDealerInvoices, loadDealerMarketing, loadDealerWarranty]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/merchant-portal/profile`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } catch (error) {
      void error;
    }
    setSaving(false);
  };

  const loadExecutiveAiHistory = useCallback(async () => {
    try {
      const data = await api.getMerchantExecutiveAiLatest();
      setExecutiveAi(data.report || null);
      setExecutiveAiHistory(data.history || []);
      if (!executiveAiStreaming) {
        setExecutiveAiText(data.report?.report_text || "");
      }
    } catch (error) {
      void error;
    }
  }, [executiveAiStreaming]);

  const runExecutiveAi = useCallback(async () => {
    setExecutiveAiStreaming(true);
    setExecutiveAiText("");
    try {
      const response = await fetch(`${API}/api/merchant-portal/v5/executive-ai/stream`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus: executiveAiFocus || "full executive briefing" }),
      });
      if (!response.ok || !response.body) {
        throw new Error("Executive AI konnte nicht gestartet werden.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      while (!finished) {
        const result = await reader.read();
        finished = result.done;
        buffer += decoder.decode(result.value || new Uint8Array(), { stream: !finished });
        const packets = buffer.split("\n\n");
        buffer = packets.pop() || "";
        packets.forEach((packet) => {
          const line = packet.split("\n").find((entry) => entry.startsWith("data: "));
          if (!line) return;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.type === "chunk") {
              setExecutiveAiText((prev) => `${prev}${payload.content}`);
            }
          } catch (error) {
            void error;
          }
        });
      }
      await loadExecutiveAiHistory();
    } catch (error) {
      setExecutiveAiText((prev) => prev || `Executive AI Fehler: ${error.message}`);
    } finally {
      setExecutiveAiStreaming(false);
    }
  }, [executiveAiFocus, loadExecutiveAiHistory]);

  const loadBusinessAutomation = useCallback(async () => {
    try {
      const data = await api.getMerchantBusinessAutomation();
      setBusinessAutomation(data);
      setAutomationSettings(data.settings || null);
    } catch (error) {
      void error;
    }
  }, []);

  const loadOpsSuite = useCallback(async () => {
    try {
      const data = await api.getMerchantOpsSuite();
      setOpsSuite(data);
      const firstCompany = (data.companies || [0]) ? data.companies?.[0] : null;
      if (firstCompany) {
        setDocumentForm((prev) => ({ ...prev, linked_company_id: prev.linked_company_id || firstCompany.company_id }));
        setMaintenanceForm((prev) => ({ ...prev, linked_company_id: prev.linked_company_id || firstCompany.company_id }));
      }
    } catch (error) {
      void error;
    }
  }, []);

  const saveOpsCompany = useCallback(async () => {
    setOpsBusy("company");
    try {
      await api.upsertMerchantOpsCompany(companyForm);
      setCompanyForm({ name: "", legal_name: "", country: "Kosovo", status: "active", manager_email: "", tax_id: "", wallet_budget: 0, branch_count: 1 });
      await loadOpsSuite();
    } catch (error) {
      void error;
    } finally {
      setOpsBusy("");
    }
  }, [companyForm, loadOpsSuite]);

  const saveOpsDocument = useCallback(async () => {
    setOpsBusy("document");
    try {
      await api.upsertMerchantOpsDocument(documentForm);
      setDocumentForm((prev) => ({ ...prev, title: "", expiry_date: "", external_url: "", notes: "" }));
      await loadOpsSuite();
    } catch (error) {
      void error;
    } finally {
      setOpsBusy("");
    }
  }, [documentForm, loadOpsSuite]);

  const saveOpsMaintenance = useCallback(async () => {
    setOpsBusy("maintenance");
    try {
      await api.upsertMerchantOpsMaintenance(maintenanceForm);
      setMaintenanceForm((prev) => ({ ...prev, asset_name: "", vendor_name: "", next_check_at: "", notes: "" }));
      await loadOpsSuite();
    } catch (error) {
      void error;
    } finally {
      setOpsBusy("");
    }
  }, [maintenanceForm, loadOpsSuite]);

  const saveAutomationSettings = useCallback(async (updates) => {
    const previous = automationSettings || {};
    const next = { ...previous, ...updates };
    setAutomationSettings(next);
    try {
      const data = await api.updateMerchantBusinessAutomationSettings(updates);
      setAutomationSettings(data.settings || next);
      await loadBusinessAutomation();
    } catch (error) {
      setAutomationSettings(previous);
    }
  }, [automationSettings, loadBusinessAutomation]);

  const runBusinessAutomation = useCallback(async (kind) => {
    setAutomationRunning(kind);
    try {
      if (kind === "full") await api.runMerchantBusinessAutomationFull();
      if (kind === "procurement") await api.runMerchantBusinessAutomationProcurement({ max_purchase_orders: 4 });
      if (kind === "operations") await api.runMerchantBusinessAutomationOperations({ assign_late_staff_tasks: true, convert_alerts_to_tasks: true });
      if (kind === "revenue") await api.runMerchantBusinessAutomationRevenue({ limit: 3 });
      await loadDash();
    } catch (error) {
      void error;
    } finally {
      setAutomationRunning("");
    }
  }, [loadBusinessAutomation, loadDash]);

  const reorderRecommendations = useMemo(() => (dealerReorders?.recommendations || []).slice(0, 4), [dealerReorders]);

  const createQuickReorder = useCallback(async () => {
    const candidates = (dealerReorders?.recommendations || []).slice(0, 3).filter((item) => item?.product_id && Number(item?.suggested_qty || 0) > 0);
    if (candidates.length === 0) {
      toast.error("Keine Nachbestell-Empfehlungen verfügbar");
      return;
    }
    const supplierId = reorderForm.supplier_id || candidates[0]?.supplier_id;
    const storeId = reorderForm.store_id || candidates[0]?.store_id;
    if (!supplierId || !storeId) {
      toast.error("Bitte zuerst Lieferant und Store auswählen");
      return;
    }
    setDealerBusy("reorder");
    try {
      await api.createMerchantDealerReorder({
        supplier_id: supplierId,
        store_id: storeId,
        note: reorderForm.note || "Auto-Reorder aus Händlerportal",
        items: candidates.map((item) => ({
          product_id: item.product_id,
          quantity: item.suggested_qty,
          purchase_price: item.purchase_price || 0,
        })),
      });
      toast.success("Nachbestellung wurde als Entwurf angelegt");
      await loadDealerReorders();
    } catch (error) {
      toast.error(error.message || "Nachbestellung konnte nicht erstellt werden");
    } finally {
      setDealerBusy("");
    }
  }, [dealerReorders, reorderForm, loadDealerReorders]);

  const submitWarrantyClaim = useCallback(async () => {
    if (!warrantyForm.issue_summary.trim()) {
      toast.error("Bitte den Garantiefall kurz beschreiben");
      return;
    }
    setDealerBusy("warranty");
    try {
      await api.createMerchantDealerWarranty(warrantyForm);
      toast.success("Garantiefall wurde erfasst");
      setWarrantyForm({ product_id: "", serial_number: "", issue_type: "defekt", customer_name: "", customer_email: "", purchase_date: "", issue_summary: "", requested_resolution: "repair" });
      await loadDealerWarranty();
    } catch (error) {
      toast.error(error.message || "Garantiefall konnte nicht gespeichert werden");
    } finally {
      setDealerBusy("");
    }
  }, [warrantyForm, loadDealerWarranty]);

  const TABS = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "inventory", label: "Lagerbestand", icon: Boxes },
    { id: "reorders", label: "Nachbestellung", icon: RefreshCcw },
    { id: "invoices", label: "Rechnungen", icon: ReceiptText },
    { id: "marketing", label: "Werbematerial", icon: Megaphone },
    { id: "warranty", label: "Garantie", icon: ShieldCheck },
    { id: "enterprise-v5", label: "Enterprise V5", icon: Building2 },
    { id: "executive-ai", label: "Executive AI", icon: BrainCircuit },
    { id: "business-automation", label: "Business Automation", icon: Bot },
    { id: "ops-suite", label: "Ops Suite", icon: Landmark },
    { id: "ecosystem", label: locale === "sq" ? "Ekosistemi" : locale === "en" ? "Ecosystem" : "Ökosystem", icon: Store },
    { id: "growth", label: locale === "sq" ? "Rritja" : locale === "en" ? "Growth" : "Wachstum", icon: LineChart },
    { id: "transactions", label: "Finanzen", icon: DollarSign },
    { id: "reservations", label: "Reservierungen", icon: UtensilsCrossed },
    { id: "hotels", label: "Buchungen", icon: Hotel },
    { id: "appointments", label: "Termine", icon: Calendar },
    { id: "tips", label: "Trinkgeld", icon: Heart },
    { id: "profile", label: "Profil", icon: Settings },
  ];

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center"><Loader2 size={32} className="animate-spin text-[#10B981]" /></div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="merchant-portal">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10">
              <ArrowLeft size={18} />
            </motion.button>
            <div className="flex items-center gap-2.5">
              {profile.logo_url ? (
                <img src={profile.logo_url} alt="" className="w-9 h-9 rounded-xl object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                  <Building2 size={18} className="text-[#10B981]" />
                </div>
              )}
              <div>
                <h1 className="text-[14px] font-bold">{profile.business_name || "Händler-Portal"}</h1>
                <p className="text-[9px] text-gray-500">Merchant Dashboard</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-[#10B981]">€{dash?.wallet_balance?.toFixed(2) || "0.00"}</p>
            <p className="text-[8px] text-gray-500">Wallet</p>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map(t => (
            <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-medium whitespace-nowrap ${
                tab === t.id ? "bg-[#10B981] text-white" : "bg-white/5 text-gray-500"
              }`} data-testid={`merchant-tab-${t.id}`}>
              <t.icon size={10} /> {t.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ═══ DASHBOARD ═══ */}
      {tab === "dashboard" && dash && (
        <div className="p-4 space-y-4">
          <div data-testid="merchant-dealer-hero" className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(0,194,255,0.18),_transparent_35%),linear-gradient(145deg,_rgba(5,5,5,1),_rgba(17,17,17,1))] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/80">BidBlitz Charge Dealer Network</p>
                <h2 className="mt-2 text-2xl font-black text-white">Premium Händlerportal für Charge, Service und Bestand</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">Ein hochwertiger Leitstand für Lagerbestand, Nachbestellung, Rechnungen, Werbematerial und digitale Garantieabwicklung.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricPill label="Wallet" value={`€${(dash?.wallet_balance || 0).toFixed(0)}`} testid="merchant-dealer-wallet-kpi" />
                <MetricPill label="Low Stock" value={enterprise?.kpis?.low_stock ?? 0} testid="merchant-dealer-lowstock-kpi" />
                <MetricPill label="PO offen" value={enterprise?.kpis?.purchase_orders_open ?? 0} testid="merchant-dealer-po-kpi" />
                <MetricPill label="Brand Assets" value={3} testid="merchant-dealer-brand-kpi" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {[
              { id: "inventory", title: "Lagerbestand", helper: `${enterprise?.kpis?.products ?? 0} aktive Produkte`, icon: Boxes, accent: "#00C2FF" },
              { id: "reorders", title: "Nachbestellung", helper: `${enterprise?.kpis?.purchase_orders_open ?? 0} offene Bestellungen`, icon: RefreshCcw, accent: "#FFD700" },
              { id: "invoices", title: "Rechnungen", helper: "Offen, bezahlt, überfällig", icon: ReceiptText, accent: "#00D26A" },
              { id: "marketing", title: "Werbematerial", helper: "Displays, Branding, Creatives", icon: Megaphone, accent: "#FF8E53" },
              { id: "warranty", title: "Garantieabwicklung", helper: "Digitale Fälle & Status", icon: ShieldCheck, accent: "#A855F7" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className="rounded-[22px] border border-white/8 bg-[#101010] p-4 text-left transition hover:-translate-y-0.5 hover:border-white/15"
                data-testid={`merchant-dealer-jump-${item.id}`}
              >
                <item.icon size={18} style={{ color: item.accent }} />
                <p className="mt-3 text-sm font-bold text-white">{item.title}</p>
                <p className="mt-1 text-[11px] text-slate-400">{item.helper}</p>
              </button>
            ))}
          </div>

          {/* Revenue Cards */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Heute", value: `€${dash.revenue.today.toFixed(0)}`, color: "#10B981", sub: `${dash.orders.today} Bestellungen` },
              { label: "Diese Woche", value: `€${dash.revenue.week.toFixed(0)}`, color: "#3B82F6", sub: "" },
              { label: "Diesen Monat", value: `€${dash.revenue.month.toFixed(0)}`, color: "#A855F7", sub: `${dash.orders.month} Bestellungen` },
              { label: "Gesamt", value: `€${dash.revenue.total.toFixed(0)}`, color: "#F59E0B", sub: "" },
            ].map((c, i) => (
              <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-[#111118] rounded-2xl border border-white/5 p-3.5">
                <p className="text-[9px] text-gray-500">{c.label}</p>
                <p className="text-xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
                {c.sub && <p className="text-[8px] text-gray-600 mt-0.5">{c.sub}</p>}
              </motion.div>
            ))}
          </div>

          {/* Services Overview */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Reservierungen", value: dash.reservations, icon: UtensilsCrossed, color: "#F59E0B" },
              { label: "Hotel-Buchungen", value: dash.hotel_bookings, icon: Hotel, color: "#6366F1" },
              { label: "Termine", value: dash.appointments, icon: Calendar, color: "#3B82F6" },
              { label: "Aktive Jobs", value: dash.active_jobs, icon: Briefcase, color: "#6366F1" },
              { label: "Bewerbungen", value: dash.job_applications, icon: Users, color: "#EC4899" },
              { label: "Events", value: dash.active_events, icon: Ticket, color: "#A855F7" },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.04 }}
                className="bg-[#111118] rounded-xl border border-white/5 p-3 text-center">
                <s.icon size={16} className="mx-auto mb-1" style={{ color: s.color }} />
                <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[8px] text-gray-500">{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Tips */}
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
                <Heart size={18} className="text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-xs font-bold">Trinkgeld erhalten</p>
                <p className="text-[9px] text-gray-500">Gesamtbetrag</p>
              </div>
            </div>
            <p className="text-xl font-bold text-[#F59E0B]">€{dash.tips_total.toFixed(2)}</p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: locale === "sq" ? "Refero tregtarë" : locale === "en" ? "Refer merchants" : "Merchants werben", route: "/referral", icon: Gift, color: "#10B981" },
              { label: locale === "sq" ? "Faqja publike" : locale === "en" ? "Public page" : "Öffentliche Seite", route: dash?.public_slug ? `/business/${dash.public_slug}` : "/merchant-portal", icon: Link2, color: "#3B82F6" },
              { label: "Restaurant erstellen", route: "/restaurants", icon: UtensilsCrossed, color: "#F59E0B" },
              { label: "Hotel einstellen", route: "/hotels", icon: Hotel, color: "#6366F1" },
              { label: "Job posten", route: "/jobs", icon: Briefcase, color: "#6366F1" },
              { label: "Event erstellen", route: "/events", icon: Ticket, color: "#A855F7" },
            ].map(a => (
              <motion.button key={a.label} whileTap={{ scale: 0.95 }} onClick={() => onNavigate?.(a.route)}
                className="bg-[#111118] rounded-xl border border-white/5 p-3 flex items-center gap-2.5 hover:border-white/10 transition-colors">
                <a.icon size={16} style={{ color: a.color }} />
                <span className="text-[10px] font-medium text-gray-400">{a.label}</span>
                <ChevronRight size={12} className="text-gray-600 ml-auto" />
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {tab === "inventory" && (
        <div className="p-4 space-y-4" data-testid="merchant-dealer-inventory-tab">
          <DealerSectionHero
            overline="Lagerbestand"
            title="Hochwertiger Bestandsleitstand"
            description="Volle Sicht auf kritische Artikel, Nachkaufdruck und wertvollen Bestand für das BidBlitz Charge Händlernetz."
            metrics={[
              ["SKUs", dealerInventory?.summary?.active_skus ?? 0],
              ["Low Stock", dealerInventory?.summary?.low_stock_count ?? 0],
              ["Auto Reorder", dealerInventory?.summary?.auto_reorder_count ?? 0],
              ["EK-Wert", `€${Number(dealerInventory?.summary?.inventory_value_cost || 0).toFixed(0)}`],
            ]}
            testid="merchant-dealer-inventory-hero"
          />

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <DealerListCard title="Kritische Bestände" icon={AlertTriangle} testid="merchant-dealer-low-stock-card">
              {(dealerInventory?.low_stock || []).length === 0 ? <EmptyDealerState label="Keine kritischen Lagerartikel" /> : (dealerInventory?.low_stock || []).map((item, index) => (
                <DealerRow
                  key={`${item.product_id || item.name}-${index}`}
                  title={item.name}
                  subtitle={`${item.store_id || 'Store'} · Mindestbestand ${Number(item.minimum_stock || 0).toFixed(0)}`}
                  badges={[`Bestand ${Number(item.stock || 0).toFixed(0)}`, item.risk_level === 'critical' ? 'kritisch' : 'Warnung']}
                  value={`€${Number(item.price || 0).toFixed(2)}`}
                  testid={`merchant-dealer-low-stock-item-${index}`}
                />
              ))}
            </DealerListCard>

            <DealerListCard title="Top Produkte" icon={PackageCheck} testid="merchant-dealer-top-products-card">
              {(dealerInventory?.top_products || []).length === 0 ? <EmptyDealerState label="Noch keine Produktperformance vorhanden" /> : (dealerInventory?.top_products || []).map((item, index) => (
                <DealerRow
                  key={`${item.product_id || item.name}-${index}`}
                  title={item.name}
                  subtitle={`${Number(item.qty || 0).toFixed(0)} Einheiten · Profit €${Number(item.profit || 0).toFixed(0)}`}
                  badges={[`Umsatz €${Number(item.revenue || 0).toFixed(0)}`]}
                  value={`#${index + 1}`}
                  testid={`merchant-dealer-top-product-${index}`}
                />
              ))}
            </DealerListCard>
          </div>
        </div>
      )}

      {tab === "reorders" && (
        <div className="p-4 space-y-4" data-testid="merchant-dealer-reorders-tab">
          <DealerSectionHero
            overline="Nachbestellung"
            title="Schnelle Beschaffung ohne Excel-Chaos"
            description="Automatische Einkaufsempfehlungen, offene Bestellungen und Lieferantenübersicht an einem Ort."
            metrics={[
              ["Lieferanten", dealerReorders?.summary?.suppliers_total ?? 0],
              ["Empfehlungen", dealerReorders?.summary?.recommendations_total ?? 0],
              ["Offene POs", dealerReorders?.summary?.open_orders_total ?? 0],
              ["Submitted", dealerReorders?.summary?.submitted_total ?? 0],
            ]}
            testid="merchant-dealer-reorders-hero"
          />

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-dealer-reorder-form-card">
              <div className="mb-4 flex items-center gap-2"><RefreshCcw size={16} className="text-cyan-300" /><h3 className="text-sm font-bold text-white">Nachbestellung anlegen</h3></div>
              <div className="space-y-3">
                <OpsSelect value={reorderForm.supplier_id} onChange={(value) => setReorderForm((prev) => ({ ...prev, supplier_id: value }))} options={(dealerReorders?.suppliers || []).map((item) => item.supplier_id)} labels={Object.fromEntries((dealerReorders?.suppliers || []).map((item) => [item.supplier_id, item.name]))} testid="merchant-dealer-reorder-supplier" />
                <OpsSelect value={reorderForm.store_id} onChange={(value) => setReorderForm((prev) => ({ ...prev, store_id: value }))} options={(dealerReorders?.stores || []).map((item) => item.store_id)} labels={Object.fromEntries((dealerReorders?.stores || []).map((item) => [item.store_id, item.name]))} testid="merchant-dealer-reorder-store" />
                <OpsTextarea value={reorderForm.note} onChange={(value) => setReorderForm((prev) => ({ ...prev, note: value }))} placeholder="Interne Einkaufsnotiz" testid="merchant-dealer-reorder-note" />
                <button onClick={createQuickReorder} disabled={dealerBusy === "reorder"} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 text-slate-950 text-xs font-black disabled:opacity-50" data-testid="merchant-dealer-reorder-submit">
                  {dealerBusy === "reorder" ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />} Entwurf aus Empfehlungen erstellen
                </button>
              </div>
            </div>

            <DealerListCard title="Empfohlene Nachkäufe" icon={Truck} testid="merchant-dealer-recommendations-card">
              {reorderRecommendations.length === 0 ? <EmptyDealerState label="Keine Nachkauf-Empfehlungen vorhanden" /> : reorderRecommendations.map((item, index) => (
                <DealerRow
                  key={`${item.product_id}-${index}`}
                  title={item.name}
                  subtitle={`${item.supplier_name || 'Lieferant offen'} · ${item.store_name || item.store_id || 'Store'}`}
                  badges={[`+${Number(item.suggested_qty || 0).toFixed(0)} Stück`, `Cover ${item.days_of_cover ?? 'n/a'}`]}
                  value={`Bestand ${Number(item.stock || 0).toFixed(0)}`}
                  testid={`merchant-dealer-recommendation-${index}`}
                />
              ))}
            </DealerListCard>
          </div>

          <DealerListCard title="Offene Bestellungen" icon={Package} testid="merchant-dealer-open-orders-card">
            {(dealerReorders?.purchase_orders || []).length === 0 ? <EmptyDealerState label="Noch keine Bestellungen vorhanden" /> : (dealerReorders?.purchase_orders || []).map((item, index) => (
              <DealerRow
                key={item.po_id}
                title={`${item.supplier_name || 'Lieferant'} · ${item.po_id}`}
                subtitle={`${item.status} · ${item.items_count || 0} Positionen`}
                badges={[item.store_id || 'Store']}
                value={`€${Number(item.total_cost || 0).toFixed(2)}`}
                testid={`merchant-dealer-open-order-${index}`}
              />
            ))}
          </DealerListCard>
        </div>
      )}

      {tab === "invoices" && (
        <div className="p-4 space-y-4" data-testid="merchant-dealer-invoices-tab">
          <DealerSectionHero
            overline="Rechnungen"
            title="Klarer Überblick über offene und bezahlte Rechnungen"
            description="Alles, was Händler für Nachverfolgung, Liquidität und Außenstände brauchen — kompakt und professionell." 
            metrics={[
              ["Gesamt", dealerInvoices?.summary?.invoices_total ?? 0],
              ["Offen", dealerInvoices?.summary?.open_count ?? 0],
              ["Überfällig", dealerInvoices?.summary?.overdue_count ?? 0],
              ["Offen €", `€${Number(dealerInvoices?.summary?.open_total || 0).toFixed(0)}`],
            ]}
            testid="merchant-dealer-invoices-hero"
          />
          <DealerListCard title="Letzte Rechnungen" icon={ReceiptText} testid="merchant-dealer-invoice-list-card">
            {(dealerInvoices?.invoices || []).length === 0 ? <EmptyDealerState label="Noch keine Rechnungen vorhanden" /> : (dealerInvoices?.invoices || []).map((item, index) => (
              <DealerRow
                key={item.invoice_id}
                title={`${item.invoice_number} · ${item.client_name}`}
                subtitle={`${item.status}${item.is_overdue ? ' · überfällig' : ''} · Reminder ${item.reminder_count || 0}`}
                badges={[item.client_email || 'Kein E-Mail-Empfänger']}
                value={`€${Number(item.total || 0).toFixed(2)}`}
                testid={`merchant-dealer-invoice-${index}`}
              />
            ))}
          </DealerListCard>
        </div>
      )}

      {tab === "marketing" && (
        <div className="p-4 space-y-4" data-testid="merchant-dealer-marketing-tab">
          <DealerSectionHero
            overline="Werbematerial"
            title="BidBlitz Charge als hochwertige Marke präsentieren"
            description="Einheitliche Premium-Materialien, digitale Händlerassets und saubere Verkaufsdisplays für Vertrauen vom ersten Eindruck an."
            metrics={[
              ["Assets", dealerMarketing?.summary?.assets_total ?? 0],
              ["Requests", dealerMarketing?.summary?.requests_total ?? 0],
              ["Touchpoints", dealerMarketing?.summary?.campaign_touchpoints ?? 0],
              ["Brand Ready", dealerMarketing?.summary?.branding_ready ? 'Ja' : 'Nein'],
            ]}
            testid="merchant-dealer-marketing-hero"
          />
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <DealerListCard title="Brand Assets" icon={Megaphone} testid="merchant-dealer-assets-card">
              {(dealerMarketing?.assets || []).map((item, index) => (
                <DealerRow
                  key={item.asset_id}
                  title={item.title}
                  subtitle={item.description}
                  badges={[item.format, item.status]}
                  value={item.cta_label}
                  testid={`merchant-dealer-asset-${index}`}
                />
              ))}
            </DealerListCard>
            <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-dealer-brand-profile-card">
              <div className="mb-4 flex items-center gap-2"><Sparkles size={16} className="text-amber-300" /><h3 className="text-sm font-bold text-white">Brand Profil</h3></div>
              <div className="space-y-3 text-sm text-slate-300">
                <div><span className="text-slate-500">Firma:</span> <span className="text-white">{dealerMarketing?.brand_profile?.business_name || 'BidBlitz Charge Partner'}</span></div>
                <div><span className="text-slate-500">Kategorie:</span> <span className="text-white">{dealerMarketing?.brand_profile?.category || 'Charge / Retail'}</span></div>
                <div><span className="text-slate-500">Website:</span> <span className="text-white">{dealerMarketing?.brand_profile?.website || '—'}</span></div>
                <p className="rounded-2xl border border-white/8 bg-white/5 p-3 text-[13px] leading-6 text-slate-300">Positionierung: klare technische Formsprache, hochwertige Verpackung, digitale Garantie und ein professionelles Händlernetz – damit BidBlitz Charge sofort vertrauenswürdig wirkt.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "warranty" && (
        <div className="p-4 space-y-4" data-testid="merchant-dealer-warranty-tab">
          <DealerSectionHero
            overline="Garantieabwicklung"
            title="Digitale Garantie statt E-Mail-Pingpong"
            description="Jeder Händler kann Defekte, Seriennummern und gewünschte Lösung direkt dokumentieren – sauber für Support und Skalierung." 
            metrics={[
              ["Fälle", dealerWarranty?.summary?.claims_total ?? 0],
              ["Offen", dealerWarranty?.summary?.open_total ?? 0],
              ["Gelöst", dealerWarranty?.summary?.resolved_total ?? 0],
              ["Austausch", dealerWarranty?.summary?.replacement_total ?? 0],
            ]}
            testid="merchant-dealer-warranty-hero"
          />
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-dealer-warranty-form-card">
              <div className="mb-4 flex items-center gap-2"><ShieldCheck size={16} className="text-fuchsia-300" /><h3 className="text-sm font-bold text-white">Garantiefall anlegen</h3></div>
              <div className="space-y-3">
                <OpsInput value={warrantyForm.product_id} onChange={(value) => setWarrantyForm((prev) => ({ ...prev, product_id: value }))} placeholder="Produkt-ID" testid="merchant-dealer-warranty-product" />
                <OpsInput value={warrantyForm.serial_number} onChange={(value) => setWarrantyForm((prev) => ({ ...prev, serial_number: value }))} placeholder="Seriennummer" testid="merchant-dealer-warranty-serial" />
                <div className="grid grid-cols-2 gap-2">
                  <OpsSelect value={warrantyForm.issue_type} onChange={(value) => setWarrantyForm((prev) => ({ ...prev, issue_type: value }))} options={dealerWarranty?.issue_types || ["defekt"]} testid="merchant-dealer-warranty-issue-type" />
                  <OpsSelect value={warrantyForm.requested_resolution} onChange={(value) => setWarrantyForm((prev) => ({ ...prev, requested_resolution: value }))} options={dealerWarranty?.resolution_types || ["repair"]} testid="merchant-dealer-warranty-resolution" />
                </div>
                <OpsInput value={warrantyForm.customer_name} onChange={(value) => setWarrantyForm((prev) => ({ ...prev, customer_name: value }))} placeholder="Kundenname" testid="merchant-dealer-warranty-customer-name" />
                <OpsInput value={warrantyForm.customer_email} onChange={(value) => setWarrantyForm((prev) => ({ ...prev, customer_email: value }))} placeholder="kunde@email.de" testid="merchant-dealer-warranty-customer-email" />
                <OpsInput value={warrantyForm.purchase_date} onChange={(value) => setWarrantyForm((prev) => ({ ...prev, purchase_date: value }))} placeholder="2026-07-28" testid="merchant-dealer-warranty-purchase-date" />
                <OpsTextarea value={warrantyForm.issue_summary} onChange={(value) => setWarrantyForm((prev) => ({ ...prev, issue_summary: value }))} placeholder="Fehlerbild, Display, Ladeproblem, Zubehör..." testid="merchant-dealer-warranty-summary" />
                <button onClick={submitWarrantyClaim} disabled={dealerBusy === "warranty"} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-fuchsia-400 text-slate-950 text-xs font-black disabled:opacity-50" data-testid="merchant-dealer-warranty-submit">
                  {dealerBusy === "warranty" ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Garantiefall speichern
                </button>
              </div>
            </div>

            <DealerListCard title="Aktuelle Garantiefälle" icon={ShieldCheck} testid="merchant-dealer-warranty-list-card">
              {(dealerWarranty?.claims || []).length === 0 ? <EmptyDealerState label="Noch keine Garantiefälle vorhanden" /> : (dealerWarranty?.claims || []).map((item, index) => (
                <DealerRow
                  key={item.claim_id}
                  title={`${item.product_name || 'Produkt'} · ${item.claim_id}`}
                  subtitle={`${item.issue_type} · ${item.requested_resolution} · ${item.customer_name || 'Kunde offen'}`}
                  badges={[item.status, item.serial_number || 'ohne SN']}
                  value={item.created_at ? new Date(item.created_at).toLocaleDateString('de-DE') : '—'}
                  testid={`merchant-dealer-warranty-claim-${index}`}
                />
              ))}
            </DealerListCard>
          </div>
        </div>
      )}

      {tab === "enterprise-v5" && v5 && (
        <div className="p-4 space-y-4" data-testid="merchant-v5-dashboard">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_35%),linear-gradient(145deg,_rgba(11,18,32,0.98),_rgba(5,10,20,0.98))] p-5"
            data-testid="merchant-v5-hero"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-300/75">Merchant Platform V5</p>
                <h2 className="mt-2 text-2xl font-black leading-tight text-white">Enterprise Dashboard</h2>
                <p className="mt-2 max-w-xl text-sm text-slate-300">
                  Ein gemeinsamer Steuerstand für Revenue, Profit, Filialen, Inventory, POS, Staff, Wallet und Executive KPIs.
                </p>
              </div>
              <button
                onClick={() => setTab("executive-ai")}
                className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-400/20"
                data-testid="merchant-v5-open-executive-ai"
              >
                Executive AI öffnen
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "Revenue 30T", value: `€${(v5.executive_overview?.revenue_30d || 0).toFixed(0)}`, icon: TrendingUp, color: "#34d399", testid: "merchant-v5-revenue-30d" },
                { label: "Profit 30T", value: `€${(v5.executive_overview?.profit_30d || 0).toFixed(0)}`, icon: ReceiptText, color: "#60a5fa", testid: "merchant-v5-profit-30d" },
                { label: "Branches", value: v5.executive_overview?.branches ?? 0, icon: Building2, color: "#f59e0b", testid: "merchant-v5-branches" },
                { label: "Wallet", value: `€${(v5.executive_overview?.wallet_balance || 0).toFixed(0)}`, icon: Wallet, color: "#f472b6", testid: "merchant-v5-wallet" },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl border border-white/8 bg-white/5 p-4" data-testid={card.testid}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">{card.label}</span>
                    <card.icon size={16} style={{ color: card.color }} />
                  </div>
                  <div className="mt-3 text-2xl font-black" style={{ color: card.color }}>{card.value}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Profit Margin", value: `${(v5.financials?.margin_pct || 0).toFixed(1)}%`, icon: Sparkles, testid: "merchant-v5-margin" },
              { label: "Inventory", value: v5.executive_overview?.inventory_items ?? 0, icon: Boxes, testid: "merchant-v5-inventory-items" },
              { label: "POS Register", value: v5.executive_overview?.pos_registers ?? 0, icon: ShoppingBag, testid: "merchant-v5-pos-registers" },
              { label: "Staff", value: v5.executive_overview?.staff_active ?? 0, icon: Users, testid: "merchant-v5-staff-active" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/8 bg-[#101826] p-4" data-testid={item.testid}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">{item.label}</span>
                  <item.icon size={15} className="text-cyan-300" />
                </div>
                <p className="mt-3 text-2xl font-black text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-financial-health">
              <div className="mb-4 flex items-center gap-2">
                <Activity size={16} className="text-cyan-300" />
                <h3 className="text-sm font-bold text-white">Executive Overview</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <MetricPill
                  label="Revenue Growth"
                  value={`${(v5.financials?.revenue_growth_pct || 0).toFixed(1)}%`}
                  helper={v5.financials?.revenue_30d <= 0 ? (v5.financials?.revenue_previous_30d > 0 ? "Keine Umsätze in den letzten 30 Tagen" : "Noch keine Vergleichsbasis") : null}
                  testid="merchant-v5-revenue-growth"
                />
                <MetricPill
                  label="Profit Growth"
                  value={`${(v5.financials?.profit_growth_pct || 0).toFixed(1)}%`}
                  helper={v5.financials?.profit_30d <= 0 ? (v5.financials?.profit_previous_30d > 0 ? "Kein Profit in den letzten 30 Tagen" : "Noch keine Vergleichsbasis") : null}
                  testid="merchant-v5-profit-growth"
                />
                <MetricPill label="Avg Ticket" value={`€${(v5.financials?.avg_ticket || 0).toFixed(2)}`} testid="merchant-v5-avg-ticket" />
                <MetricPill label="Refunds Pending" value={v5.financials?.refunds_pending ?? 0} testid="merchant-v5-refunds-pending" />
                <MetricPill label="Wallet Inflow" value={`€${(v5.financials?.wallet_inflow_30d || 0).toFixed(0)}`} testid="merchant-v5-wallet-inflow" />
                <MetricPill label="Wallet Outflow" value={`€${(v5.financials?.wallet_outflow_30d || 0).toFixed(0)}`} testid="merchant-v5-wallet-outflow" />
              </div>
              <div className="mt-4 rounded-2xl border border-white/5 bg-white/5 p-4" data-testid="merchant-v5-summary-card">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Executive Summary</p>
                <div className="mt-3 space-y-2 text-sm text-slate-200">
                  {(v5.insights?.executive_summary || []).map((item, index) => (
                    <div key={`${item}-${index}`} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-emerald-300" />
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-merchant-kpis">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={16} className="text-amber-300" />
                <h3 className="text-sm font-bold text-white">Merchant KPIs</h3>
              </div>
              <div className="space-y-3">
                <KpiRow label="Revenue pro Branch" value={`€${(v5.merchant_kpis?.revenue_per_branch || 0).toFixed(0)}`} testid="merchant-v5-kpi-revenue-branch" />
                <KpiRow label="Profit pro Branch" value={`€${(v5.merchant_kpis?.profit_per_branch || 0).toFixed(0)}`} testid="merchant-v5-kpi-profit-branch" />
                <KpiRow label="Revenue pro Staff" value={`€${(v5.merchant_kpis?.revenue_per_staff || 0).toFixed(0)}`} testid="merchant-v5-kpi-revenue-staff" />
                <KpiRow label="Stock Turnover" value={`${(v5.merchant_kpis?.stock_turnover_estimate || 0).toFixed(2)}x`} testid="merchant-v5-kpi-stock-turnover" />
                <KpiRow label="Wallet Runway" value={v5.merchant_kpis?.wallet_runway_days ? `${v5.merchant_kpis.wallet_runway_days} Tage` : "n/a"} testid="merchant-v5-kpi-wallet-runway" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-branches-card">
              <div className="mb-4 flex items-center gap-2">
                <Building2 size={16} className="text-emerald-300" />
                <h3 className="text-sm font-bold text-white">Branches</h3>
              </div>
              <div className="space-y-3">
                {(v5.branches || []).slice(0, 5).map((branch) => (
                  <div key={branch.store_id} className="rounded-2xl border border-white/5 bg-white/5 p-4" data-testid={`merchant-v5-branch-${branch.store_id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">{branch.name}</p>
                        <p className="text-[11px] text-slate-400">{branch.city || "—"} · {branch.registers} Register · {branch.products} Produkte</p>
                      </div>
                      <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                        €{(branch.revenue_30d || 0).toFixed(0)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                      <span className="rounded-full bg-white/5 px-2.5 py-1">Profit €{(branch.profit_30d || 0).toFixed(0)}</span>
                      <span className="rounded-full bg-white/5 px-2.5 py-1">Marge {(branch.margin_pct || 0).toFixed(1)}%</span>
                      <span className="rounded-full bg-white/5 px-2.5 py-1">Low Stock {branch.low_stock}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-inventory-card">
              <div className="mb-4 flex items-center gap-2">
                <Boxes size={16} className="text-fuchsia-300" />
                <h3 className="text-sm font-bold text-white">Inventory & POS</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <MetricPill label="Low Stock" value={v5.insights?.inventory?.low_stock_count ?? 0} testid="merchant-v5-low-stock-count" />
                <MetricPill label="Auto Reorder" value={v5.insights?.inventory?.auto_reorder_count ?? 0} testid="merchant-v5-auto-reorder-count" />
                <MetricPill label="Expiring" value={v5.insights?.inventory?.expiring_batches_count ?? 0} testid="merchant-v5-expiring-count" />
                <MetricPill label="Dead Stock" value={v5.insights?.inventory?.dead_stock_count ?? 0} testid="merchant-v5-dead-stock-count" />
              </div>
              <div className="mt-4 rounded-2xl border border-white/5 bg-white/5 p-4" data-testid="merchant-v5-top-products">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                  <PackageCheck size={15} className="text-cyan-300" />
                  Top Products
                </div>
                <div className="space-y-2">
                  {(v5.pos?.top_products || []).slice(0, 4).map((product) => (
                    <div key={product.product_id || product.name} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2" data-testid={`merchant-v5-top-product-${String(product.product_id || product.name).replace(/[^a-zA-Z0-9_-]/g, '-')}`}>
                      <div>
                        <p className="text-sm text-white">{product.name}</p>
                        <p className="text-[11px] text-slate-400">{product.qty} Einheiten</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-300">€{(product.revenue || 0).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-staff-card">
              <div className="mb-4 flex items-center gap-2">
                <Users size={16} className="text-amber-300" />
                <h3 className="text-sm font-bold text-white">Staff & Attendance</h3>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <MetricPill label="Active" value={v5.insights?.staff?.active_staff ?? 0} testid="merchant-v5-staff-total" />
                <MetricPill label="Clocked In" value={v5.insights?.staff?.clocked_in ?? 0} testid="merchant-v5-staff-clocked-in" />
                <MetricPill label="Late" value={v5.insights?.staff?.late_staff_count ?? 0} testid="merchant-v5-staff-late" />
              </div>
              <div className="mt-4 space-y-2">
                {(v5.staff?.late_staff || []).slice(0, 4).map((member, index) => (
                  <div key={`${member.staff_id}-${index}`} className="rounded-xl border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-sm text-amber-100" data-testid={`merchant-v5-late-staff-${index}`}>
                    <div className="font-semibold">{member.name}</div>
                    <div className="text-[11px] text-amber-200/80">{member.title || "Shift"} · {member.location || "Standort offen"}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-alerts-card">
              <div className="mb-4 flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-300" />
                <h3 className="text-sm font-bold text-white">Business Alerts</h3>
              </div>
              <div className="space-y-2">
                {(v5.insights?.business_alerts || []).slice(0, 5).map((alert, index) => (
                  <div key={`${alert.title}-${index}`} className="rounded-2xl border border-white/6 bg-white/5 p-3" data-testid={`merchant-v5-alert-${index}`}>
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={15} className={alert.severity === "high" ? "text-rose-300" : alert.severity === "medium" ? "text-amber-300" : "text-cyan-300"} />
                      <p className="text-sm font-bold text-white">{alert.title}</p>
                    </div>
                    <p className="mt-2 text-[12px] leading-5 text-slate-300">{alert.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "executive-ai" && (
        <div className="p-4 space-y-4" data-testid="merchant-v5-executive-ai">
          <div className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_right,_rgba(6,182,212,0.22),_transparent_30%),linear-gradient(145deg,_rgba(9,14,28,1),_rgba(17,24,39,1))] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/80">Executive AI</p>
                <h2 className="mt-2 text-2xl font-black text-white">Board-ready Insights aus bestehenden BidBlitz Modulen</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">
                  Nutzt Merchant-, POS-, Wallet-, Inventory-, Staff- und Analytics-Daten für Revenue Insights, Forecasts, Purchase Recommendations und Alerts.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  value={executiveAiFocus}
                  onChange={(e) => setExecutiveAiFocus(e.target.value)}
                  placeholder="z. B. weekly board review"
                  className="h-11 min-w-[240px] rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-slate-500"
                  data-testid="merchant-v5-executive-ai-focus-input"
                />
                <button
                  onClick={runExecutiveAi}
                  disabled={executiveAiStreaming}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                  data-testid="merchant-v5-executive-ai-run"
                >
                  {executiveAiStreaming ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
                  {executiveAiStreaming ? "Analysiert..." : "Executive Briefing erzeugen"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-executive-ai-report-card">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">Executive Summary</p>
                  <p className="text-[11px] text-slate-400">Streaming Briefing, basierend auf Live-Unternehmensdaten</p>
                </div>
                <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold text-cyan-200" data-testid="merchant-v5-executive-ai-provider">
                  {executiveAi?.provider || "bereit"}
                </span>
              </div>
              <div className="min-h-[420px] rounded-2xl border border-white/6 bg-black/20 p-4">
                {executiveAiText ? (
                  <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-100" data-testid="merchant-v5-executive-ai-output">
                    {executiveAiText}
                  </pre>
                ) : (
                  <div className="flex h-full min-h-[360px] items-center justify-center text-center text-sm text-slate-500" data-testid="merchant-v5-executive-ai-empty">
                    Starte ein Executive Briefing, um Revenue Insights, Inventory Insights, Staff Insights, Forecasts und Alerts zu erzeugen.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-forecast-card">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-300" />
                  <h3 className="text-sm font-bold text-white">Sales Forecast</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MetricPill label="Nächste 7 Tage" value={`€${(v5?.insights?.sales_forecast?.next_7_days_revenue || 0).toFixed(0)}`} testid="merchant-v5-forecast-7d" />
                  <MetricPill label="Nächste 30 Tage" value={`€${(v5?.insights?.sales_forecast?.next_30_days_revenue || 0).toFixed(0)}`} testid="merchant-v5-forecast-30d" />
                  <MetricPill label="Profit 30 Tage" value={`€${(v5?.insights?.sales_forecast?.next_30_days_profit || 0).toFixed(0)}`} testid="merchant-v5-forecast-profit" />
                  <MetricPill label="Confidence" value={v5?.insights?.sales_forecast?.confidence || "n/a"} testid="merchant-v5-forecast-confidence" />
                </div>
              </div>

              <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-purchase-recommendations-card">
                <div className="mb-3 flex items-center gap-2">
                  <Boxes size={16} className="text-fuchsia-300" />
                  <h3 className="text-sm font-bold text-white">Purchase Recommendations</h3>
                </div>
                <div className="space-y-2">
                  {(v5?.insights?.purchase_recommendations || []).slice(0, 5).map((item, index) => (
                    <div key={`${item.product_id}-${index}`} className="rounded-2xl border border-white/6 bg-white/5 p-3" data-testid={`merchant-v5-purchase-recommendation-${index}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{item.name}</p>
                          <p className="text-[11px] text-slate-400">{item.reason} · Supplier {item.supplier_name || item.supplier_id || "offen"}</p>
                        </div>
                        <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">+{item.suggested_qty}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-300">
                        <span className="rounded-full bg-black/20 px-2.5 py-1">Stock {item.stock}</span>
                        <span className="rounded-full bg-black/20 px-2.5 py-1">Sold 30T {item.qty_sold_30d}</span>
                        <span className="rounded-full bg-black/20 px-2.5 py-1">Cover {item.days_of_cover ?? "n/a"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-executive-ai-history-card">
                <div className="mb-3 flex items-center gap-2">
                  <Clock size={16} className="text-amber-300" />
                  <h3 className="text-sm font-bold text-white">Letzte Briefings</h3>
                </div>
                <div className="space-y-2">
                  {executiveAiHistory.length === 0 ? (
                    <p className="text-sm text-slate-500">Noch kein Executive Briefing erzeugt.</p>
                  ) : executiveAiHistory.map((item, index) => (
                    <button
                      key={item.report_id || index}
                      onClick={() => {
                        setExecutiveAi(item);
                        setExecutiveAiText(item.report_text || "");
                      }}
                      className="w-full rounded-2xl border border-white/6 bg-white/5 p-3 text-left transition hover:bg-white/10"
                      data-testid={`merchant-v5-executive-ai-history-${index}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{item.focus || "Executive Briefing"}</p>
                          <p className="text-[11px] text-slate-400">{item.created_at ? new Date(item.created_at).toLocaleString("de-DE") : "—"}</p>
                        </div>
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-slate-300">{item.provider || item.status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "business-automation" && businessAutomation && automationSettings && (
        <div className="p-4 space-y-4" data-testid="merchant-v5-business-automation">
          <div className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_32%),linear-gradient(145deg,_rgba(15,23,42,1),_rgba(17,24,39,1))] p-5" data-testid="merchant-v5-business-automation-hero">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-amber-200/80">Merchant Platform V5</p>
                <h2 className="mt-2 text-2xl font-black text-white">Business Automation</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">
                  V1 bündelt Einkauf, Operations und Revenue-Automation in einem gemeinsamen Leitstand — ohne neue Insel-Systeme.
                </p>
              </div>
              <button
                onClick={() => runBusinessAutomation("full")}
                disabled={automationRunning === "full"}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 text-sm font-black text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="merchant-v5-business-automation-run-full"
              >
                {automationRunning === "full" ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
                {automationRunning === "full" ? "Läuft..." : "Full Automation Run"}
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricPill label="Procurement" value={businessAutomation.overview?.procurement_actions ?? 0} testid="merchant-v5-automation-procurement-count" />
              <MetricPill label="Operations" value={businessAutomation.overview?.operations_actions ?? 0} testid="merchant-v5-automation-operations-count" />
              <MetricPill label="Revenue" value={businessAutomation.overview?.revenue_actions ?? 0} testid="merchant-v5-automation-revenue-count" />
              <MetricPill label="Open Tasks" value={businessAutomation.overview?.open_automation_tasks ?? 0} testid="merchant-v5-automation-open-tasks" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-automation-settings-card">
                <div className="mb-4 flex items-center gap-2">
                  <Settings2 size={16} className="text-amber-300" />
                  <h3 className="text-sm font-bold text-white">Automation Controls</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    ["procurement_enabled", "Procurement", "merchant-v5-automation-toggle-procurement"],
                    ["operations_enabled", "Operations", "merchant-v5-automation-toggle-operations"],
                    ["revenue_enabled", "Revenue", "merchant-v5-automation-toggle-revenue"],
                  ].map(([key, label, testid]) => (
                    <button
                      key={key}
                      onClick={() => saveAutomationSettings({ [key]: !automationSettings[key] })}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${automationSettings[key] ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/8 bg-white/5 text-slate-300"}`}
                      data-testid={testid}
                    >
                      <div className="text-[11px] uppercase tracking-[0.2em]">{label}</div>
                      <div className="mt-2 text-sm font-black">{automationSettings[key] ? "Aktiv" : "Pausiert"}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <SettingStepper label="Days of cover" value={automationSettings.reorder_days_cover_threshold || 14} min={3} max={45} step={1} onChange={(value) => saveAutomationSettings({ reorder_days_cover_threshold: value })} testid="merchant-v5-automation-setting-cover" />
                  <SettingStepper label="Flash Discount" value={automationSettings.flash_sale_discount_pct || 18} min={5} max={40} step={1} suffix="%" onChange={(value) => saveAutomationSettings({ flash_sale_discount_pct: value })} testid="merchant-v5-automation-setting-discount" />
                  <SettingStepper label="Flash Minutes" value={automationSettings.flash_sale_duration_minutes || 180} min={15} max={1440} step={15} onChange={(value) => saveAutomationSettings({ flash_sale_duration_minutes: value })} testid="merchant-v5-automation-setting-duration" />
                  <SettingStepper label="Late Grace" value={automationSettings.late_shift_grace_minutes || 15} min={0} max={120} step={5} suffix="m" onChange={(value) => saveAutomationSettings({ late_shift_grace_minutes: value })} testid="merchant-v5-automation-setting-grace" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <AutomationActionCard
                  title="Procurement"
                  subtitle="Auto-Reorder · POs · Eskalationen"
                  icon={Truck}
                  accent="text-emerald-300"
                  buttonLabel="Procurement Run"
                  running={automationRunning === "procurement"}
                  onRun={() => runBusinessAutomation("procurement")}
                  testid="merchant-v5-automation-card-procurement"
                  buttonTestid="merchant-v5-automation-run-procurement"
                />
                <AutomationActionCard
                  title="Operations"
                  subtitle="Alerts → Tasks · Staff Exceptions"
                  icon={ClipboardList}
                  accent="text-cyan-300"
                  buttonLabel="Operations Run"
                  running={automationRunning === "operations"}
                  onRun={() => runBusinessAutomation("operations")}
                  testid="merchant-v5-automation-card-operations"
                  buttonTestid="merchant-v5-automation-run-operations"
                />
                <AutomationActionCard
                  title="Revenue"
                  subtitle="Flash Sales · Low-Conversion Aktionen"
                  icon={Zap}
                  accent="text-fuchsia-300"
                  buttonLabel="Revenue Run"
                  running={automationRunning === "revenue"}
                  onRun={() => runBusinessAutomation("revenue")}
                  testid="merchant-v5-automation-card-revenue"
                  buttonTestid="merchant-v5-automation-run-revenue"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-automation-procurement-queue">
                  <div className="mb-3 flex items-center gap-2">
                    <Truck size={16} className="text-emerald-300" />
                    <h3 className="text-sm font-bold text-white">Procurement Queue</h3>
                  </div>
                  <div className="space-y-2">
                    {(businessAutomation.procurement?.queue || []).slice(0, 4).map((item, index) => (
                      <div key={`${item.product_id}-${index}`} className="rounded-2xl border border-white/6 bg-white/5 p-3" data-testid={`merchant-v5-automation-procurement-item-${index}`}>
                        <p className="text-sm font-semibold text-white">{item.name}</p>
                        <p className="text-[11px] text-slate-400">Supplier {item.supplier_name || item.supplier_id || "offen"}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-300">
                          <span className="rounded-full bg-black/20 px-2.5 py-1">+{item.suggested_qty}</span>
                          <span className="rounded-full bg-black/20 px-2.5 py-1">Stock {item.stock}</span>
                          <span className="rounded-full bg-black/20 px-2.5 py-1">Cover {item.days_of_cover ?? "n/a"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-automation-operations-queue">
                  <div className="mb-3 flex items-center gap-2">
                    <ClipboardList size={16} className="text-cyan-300" />
                    <h3 className="text-sm font-bold text-white">Operations Queue</h3>
                  </div>
                  <div className="space-y-2">
                    {(businessAutomation.operations?.automation_tasks || []).slice(0, 4).map((task, index) => (
                      <div key={task.id} className="rounded-2xl border border-white/6 bg-white/5 p-3" data-testid={`merchant-v5-automation-task-${index}`}>
                        <p className="text-sm font-semibold text-white">{task.title}</p>
                        <p className="mt-1 text-[11px] text-slate-400">Staff {task.staff_id} · Priorität {task.priority}</p>
                      </div>
                    ))}
                    {(businessAutomation.operations?.late_staff || []).slice(0, 2).map((member, index) => (
                      <div key={`${member.staff_id}-${index}`} className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-3" data-testid={`merchant-v5-automation-late-staff-${index}`}>
                        <p className="text-sm font-semibold text-amber-100">{member.name}</p>
                        <p className="mt-1 text-[11px] text-amber-200/80">{member.title || "Shift"}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-automation-revenue-queue">
                  <div className="mb-3 flex items-center gap-2">
                    <Zap size={16} className="text-fuchsia-300" />
                    <h3 className="text-sm font-bold text-white">Revenue Opportunities</h3>
                  </div>
                  <div className="space-y-2">
                    {(businessAutomation.revenue?.opportunities || []).slice(0, 4).map((item, index) => (
                      <div key={item.listing_id} className="rounded-2xl border border-white/6 bg-white/5 p-3" data-testid={`merchant-v5-automation-revenue-item-${index}`}>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{item.reason} · {item.age_days} Tage live</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-300">
                          <span className="rounded-full bg-black/20 px-2.5 py-1">€{item.price}</span>
                          <span className="rounded-full bg-black/20 px-2.5 py-1">→ €{item.sale_price}</span>
                          <span className="rounded-full bg-black/20 px-2.5 py-1">{item.discount_pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-automation-escalations-card">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-rose-300" />
                  <h3 className="text-sm font-bold text-white">Supplier Escalations</h3>
                </div>
                <div className="space-y-2">
                  {(businessAutomation.procurement?.escalations || []).slice(0, 5).map((item, index) => (
                    <div key={item.po_id} className="rounded-2xl border border-white/6 bg-white/5 p-3" data-testid={`merchant-v5-automation-escalation-${index}`}>
                      <p className="text-sm font-semibold text-white">{item.supplier_name}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{item.po_id} · {item.status} · {item.age_days} Tage</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-automation-open-pos-card">
                <div className="mb-3 flex items-center gap-2">
                  <Truck size={16} className="text-emerald-300" />
                  <h3 className="text-sm font-bold text-white">Open Purchase Orders</h3>
                </div>
                <div className="space-y-2">
                  {(businessAutomation.procurement?.open_purchase_orders || []).slice(0, 5).map((po, index) => (
                    <div key={po.po_id} className="rounded-2xl border border-white/6 bg-white/5 p-3" data-testid={`merchant-v5-automation-open-po-${index}`}>
                      <p className="text-sm font-semibold text-white">{po.supplier_name}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{po.po_id} · {po.status}</p>
                      <p className="mt-2 text-[11px] text-emerald-200">€{(po.total_cost || 0).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid="merchant-v5-automation-history-card">
                <div className="mb-3 flex items-center gap-2">
                  <Clock size={16} className="text-amber-300" />
                  <h3 className="text-sm font-bold text-white">Automation History</h3>
                </div>
                <div className="space-y-2">
                  {(businessAutomation.history || []).slice(0, 6).map((run, index) => (
                    <div key={run.run_id} className="rounded-2xl border border-white/6 bg-white/5 p-3" data-testid={`merchant-v5-automation-history-${index}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{run.run_type}</p>
                          <p className="text-[11px] text-slate-400">{run.created_at ? new Date(run.created_at).toLocaleString("de-DE") : "—"}</p>
                        </div>
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-slate-300">{run.status}</span>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-300">{run.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "ops-suite" && opsSuite && (
        <div className="p-4 space-y-4" data-testid="merchant-v5-ops-suite">
          <div className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.22),_transparent_32%),linear-gradient(145deg,_rgba(10,15,28,1),_rgba(18,24,38,1))] p-5" data-testid="merchant-v5-ops-suite-hero">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-fuchsia-200/80">Merchant Platform V5</p>
                <h2 className="mt-2 text-2xl font-black text-white">Multi-Company · Document Center · Maintenance</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">Der P2-Leitstand bündelt Gesellschaften, Compliance-Dokumente und Wartungs-Tickets in einer Oberfläche.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricPill label="Companies" value={opsSuite.summary?.companies_total ?? 0} testid="merchant-v5-ops-companies-total" />
                <MetricPill label="Documents" value={opsSuite.summary?.documents_total ?? 0} testid="merchant-v5-ops-documents-total" />
                <MetricPill label="Expiring" value={opsSuite.summary?.documents_expiring_soon ?? 0} testid="merchant-v5-ops-documents-expiring" />
                <MetricPill label="Maintenance" value={opsSuite.summary?.maintenance_open ?? 0} testid="merchant-v5-ops-maintenance-open" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <OpsFormCard title="Neue Company" icon={Building2} testid="merchant-v5-ops-company-form">
              <OpsInput value={companyForm.name} onChange={(value) => setCompanyForm((prev) => ({ ...prev, name: value }))} placeholder="BidBlitz Retail GmbH" testid="merchant-v5-ops-company-name" />
              <OpsInput value={companyForm.legal_name} onChange={(value) => setCompanyForm((prev) => ({ ...prev, legal_name: value }))} placeholder="Rechtlicher Name" testid="merchant-v5-ops-company-legal-name" />
              <OpsInput value={companyForm.manager_email} onChange={(value) => setCompanyForm((prev) => ({ ...prev, manager_email: value }))} placeholder="manager@firma.com" testid="merchant-v5-ops-company-manager-email" />
              <OpsInput value={companyForm.tax_id} onChange={(value) => setCompanyForm((prev) => ({ ...prev, tax_id: value }))} placeholder="VAT / Tax ID" testid="merchant-v5-ops-company-tax-id" />
              <div className="grid grid-cols-2 gap-2">
                <OpsSelect value={companyForm.status} onChange={(value) => setCompanyForm((prev) => ({ ...prev, status: value }))} options={["active", "paused", "onboarding", "archived"]} testid="merchant-v5-ops-company-status" />
                <OpsInput value={String(companyForm.branch_count)} onChange={(value) => setCompanyForm((prev) => ({ ...prev, branch_count: Number(value) || 1 }))} placeholder="Branches" testid="merchant-v5-ops-company-branches" />
              </div>
              <OpsInput value={String(companyForm.wallet_budget)} onChange={(value) => setCompanyForm((prev) => ({ ...prev, wallet_budget: Number(value) || 0 }))} placeholder="Wallet Budget" testid="merchant-v5-ops-company-wallet-budget" />
              <button onClick={saveOpsCompany} disabled={opsBusy === "company" || !companyForm.name.trim()} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-fuchsia-400 text-slate-950 text-xs font-black disabled:opacity-50" data-testid="merchant-v5-ops-company-save">{opsBusy === "company" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Company speichern</button>
            </OpsFormCard>

            <OpsFormCard title="Document Center" icon={FileText} testid="merchant-v5-ops-document-form">
              <OpsInput value={documentForm.title} onChange={(value) => setDocumentForm((prev) => ({ ...prev, title: value }))} placeholder="Lieferantenvertrag 2026" testid="merchant-v5-ops-document-title" />
              <div className="grid grid-cols-2 gap-2">
                <OpsSelect value={documentForm.category} onChange={(value) => setDocumentForm((prev) => ({ ...prev, category: value }))} options={["compliance", "finance", "operations", "contract", "general"]} testid="merchant-v5-ops-document-category" />
                <OpsSelect value={documentForm.status} onChange={(value) => setDocumentForm((prev) => ({ ...prev, status: value }))} options={["draft", "active", "expiring", "archived"]} testid="merchant-v5-ops-document-status" />
              </div>
              <OpsSelect value={documentForm.linked_company_id} onChange={(value) => setDocumentForm((prev) => ({ ...prev, linked_company_id: value }))} options={(opsSuite.companies || []).map((item) => item.company_id)} labels={Object.fromEntries((opsSuite.companies || []).map((item) => [item.company_id, item.name]))} testid="merchant-v5-ops-document-company" />
              <OpsInput value={documentForm.expiry_date} onChange={(value) => setDocumentForm((prev) => ({ ...prev, expiry_date: value }))} placeholder="2026-12-31T12:00:00+00:00" testid="merchant-v5-ops-document-expiry" />
              <OpsInput value={documentForm.external_url} onChange={(value) => setDocumentForm((prev) => ({ ...prev, external_url: value }))} placeholder="https://..." testid="merchant-v5-ops-document-url" />
              <OpsTextarea value={documentForm.notes} onChange={(value) => setDocumentForm((prev) => ({ ...prev, notes: value }))} placeholder="Notizen, Eigentümer, Audit-Hinweise" testid="merchant-v5-ops-document-notes" />
              <button onClick={saveOpsDocument} disabled={opsBusy === "document" || !documentForm.title.trim()} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 text-slate-950 text-xs font-black disabled:opacity-50" data-testid="merchant-v5-ops-document-save">{opsBusy === "document" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Dokument speichern</button>
            </OpsFormCard>

            <OpsFormCard title="Maintenance Tracker" icon={Wrench} testid="merchant-v5-ops-maintenance-form">
              <OpsInput value={maintenanceForm.asset_name} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, asset_name: value }))} placeholder="BIO-D8992DFCA1" testid="merchant-v5-ops-maintenance-asset-name" />
              <div className="grid grid-cols-2 gap-2">
                <OpsSelect value={maintenanceForm.asset_type} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, asset_type: value }))} options={["terminal", "printer", "display", "store", "vehicle", "other"]} testid="merchant-v5-ops-maintenance-asset-type" />
                <OpsSelect value={maintenanceForm.priority} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, priority: value }))} options={["low", "medium", "high"]} testid="merchant-v5-ops-maintenance-priority" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <OpsSelect value={maintenanceForm.status} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, status: value }))} options={["open", "scheduled", "in_progress", "done", "archived"]} testid="merchant-v5-ops-maintenance-status" />
                <OpsSelect value={maintenanceForm.linked_company_id} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, linked_company_id: value }))} options={(opsSuite.companies || []).map((item) => item.company_id)} labels={Object.fromEntries((opsSuite.companies || []).map((item) => [item.company_id, item.name]))} testid="merchant-v5-ops-maintenance-company" />
              </div>
              <OpsInput value={maintenanceForm.vendor_name} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, vendor_name: value }))} placeholder="Vendor / Service Partner" testid="merchant-v5-ops-maintenance-vendor" />
              <OpsInput value={maintenanceForm.next_check_at} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, next_check_at: value }))} placeholder="2026-08-01T09:00:00+00:00" testid="merchant-v5-ops-maintenance-next-check" />
              <OpsTextarea value={maintenanceForm.notes} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, notes: value }))} placeholder="Ersatzteil, SLA, Techniker-Hinweise" testid="merchant-v5-ops-maintenance-notes" />
              <button onClick={saveOpsMaintenance} disabled={opsBusy === "maintenance" || !maintenanceForm.asset_name.trim()} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 text-slate-950 text-xs font-black disabled:opacity-50" data-testid="merchant-v5-ops-maintenance-save">{opsBusy === "maintenance" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ticket speichern</button>
            </OpsFormCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <OpsListCard title="Companies" icon={Building2} testid="merchant-v5-ops-company-list">
              {(opsSuite.companies || []).map((item, index) => (
                <OpsListRow key={item.company_id} title={item.name} subtitle={`${item.status} · ${item.branch_count} Branches · ${item.manager_email || 'kein Manager'}`} value={`€${Number(item.wallet_budget || 0).toFixed(0)}`} testid={`merchant-v5-ops-company-item-${index}`} />
              ))}
            </OpsListCard>
            <OpsListCard title="Document Center" icon={FileText} testid="merchant-v5-ops-document-list">
              {(opsSuite.documents || []).slice(0, 8).map((item, index) => (
                <OpsListRow key={item.document_id} title={item.title} subtitle={`${item.category} · ${item.linked_company_name} · ${item.days_until_deadline ?? 'n/a'} Tage`} value={item.status} testid={`merchant-v5-ops-document-item-${index}`} />
              ))}
            </OpsListCard>
            <OpsListCard title="Maintenance Tracker" icon={Wrench} testid="merchant-v5-ops-maintenance-list">
              {(opsSuite.maintenance || []).slice(0, 8).map((item, index) => (
                <OpsListRow key={item.ticket_id} title={item.asset_name} subtitle={`${item.asset_type} · ${item.vendor_name || 'Vendor offen'} · ${item.linked_company_name}`} value={item.priority} testid={`merchant-v5-ops-maintenance-item-${index}`} />
              ))}
            </OpsListCard>
          </div>
        </div>
      )}

      {tab === "ecosystem" && (
        <div className="p-4 space-y-4" data-testid="merchant-ecosystem-tab">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#111118] rounded-2xl border border-white/5 p-4" data-testid="merchant-ecosystem-branches">
              <p className="text-[9px] text-gray-500">Branches</p>
              <p className="text-2xl font-bold text-[#10B981] mt-1">{enterprise?.kpis?.branches ?? 0}</p>
            </div>
            <div className="bg-[#111118] rounded-2xl border border-white/5 p-4" data-testid="merchant-ecosystem-low-stock">
              <p className="text-[9px] text-gray-500">Low Stock</p>
              <p className="text-2xl font-bold text-[#F59E0B] mt-1">{enterprise?.kpis?.low_stock ?? 0}</p>
            </div>
            <div className="bg-[#111118] rounded-2xl border border-white/5 p-4" data-testid="merchant-ecosystem-referrals">
              <p className="text-[9px] text-gray-500">Merchant Referrals</p>
              <p className="text-2xl font-bold text-[#00C2FF] mt-1">{merchantProgram?.stats?.completed ?? 0}</p>
            </div>
            <div className="bg-[#111118] rounded-2xl border border-white/5 p-4" data-testid="merchant-ecosystem-franchise">
              <p className="text-[9px] text-gray-500">Franchise Applications</p>
              <p className="text-2xl font-bold text-[#A855F7] mt-1">{franchiseApplications.length}</p>
            </div>
          </div>

          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4" data-testid="merchant-ecosystem-referral-card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold">Merchant Referral Program</p>
                <p className="text-[10px] text-gray-500">Code: {merchantProgram?.code || "—"}</p>
              </div>
              <Gift size={16} className="text-[#10B981]" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-[9px] text-gray-500">Free Month</p>
                <p className="text-lg font-bold text-white">{merchantProgram?.stats?.free_months ?? 0}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-[9px] text-gray-500">Cashback</p>
                <p className="text-lg font-bold text-[#00C2FF]">€{(merchantProgram?.stats?.cashback || 0).toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-[9px] text-gray-500">Revenue Share</p>
                <p className="text-lg font-bold text-[#F59E0B]">€{(merchantProgram?.stats?.revenue_share || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4" data-testid="merchant-ecosystem-public-page-card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold">Public Merchant Page</p>
                <p className="text-[10px] text-gray-500">bidblitz.ae/business/{dash?.public_slug || "merchant"}</p>
              </div>
              <Link2 size={16} className="text-[#3B82F6]" />
            </div>
            <button onClick={() => onNavigate?.(dash?.public_slug ? `/business/${dash.public_slug}` : "/merchant-portal")} className="w-full py-2 rounded-xl bg-[#3B82F6]/15 text-[#60A5FA] text-xs font-bold" data-testid="merchant-open-public-page">
              Öffnen
            </button>
          </div>
        </div>
      )}

      {tab === "growth" && (
        <div className="p-4 space-y-4" data-testid="merchant-growth-tab">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "User Growth", value: growth?.monthly?.user_growth ?? 0, color: "#10B981" },
              { label: "Merchant Growth", value: growth?.monthly?.merchant_growth ?? 0, color: "#3B82F6" },
              { label: "Referral Growth", value: growth?.monthly?.referral_growth ?? 0, color: "#A855F7" },
              { label: "Revenue Growth", value: `€${(growth?.monthly?.revenue_growth || 0).toFixed(0)}`, color: "#F59E0B" },
            ].map((item) => (
              <div key={item.label} className="bg-[#111118] rounded-2xl border border-white/5 p-4">
                <p className="text-[9px] text-gray-500">{item.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4" data-testid="merchant-growth-analytics-card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold">Growth Dashboard</p>
                <p className="text-[10px] text-gray-500">Daily · Weekly · Monthly · Yearly</p>
              </div>
              <Megaphone size={16} className="text-[#F59E0B]" />
            </div>
            <div className="space-y-2 text-[11px]">
              {[
                ["Daily", growth?.daily],
                ["Weekly", growth?.weekly],
                ["Monthly", growth?.monthly],
                ["Yearly", growth?.yearly],
              ].map(([label, item]) => (
                <div key={label} className="rounded-xl bg-white/5 p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-gray-500">Users {item?.user_growth ?? 0} · Merchants {item?.merchant_growth ?? 0} · Referrals {item?.referral_growth ?? 0}</p>
                  </div>
                  <span className="font-bold text-[#10B981]">€{(item?.revenue_growth || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TRANSACTIONS ═══ */}
      {tab === "transactions" && (
        <div className="p-4 space-y-2">
          <h2 className="text-sm font-bold mb-2">Letzte Transaktionen</h2>
          {txns.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">Keine Transaktionen</div>
          ) : txns.map((t, i) => (
            <motion.div key={t.id || i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="bg-[#111118] rounded-xl border border-white/5 p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-white">{t.description?.slice(0, 50)}</p>
                <p className="text-[9px] text-gray-500">{t.type} — {t.created_at ? new Date(t.created_at).toLocaleDateString("de-DE") : ""}</p>
              </div>
              <span className={`text-sm font-bold ${t.amount > 0 ? "text-[#10B981]" : "text-red-400"}`}>
                {t.amount > 0 ? "+" : ""}€{Math.abs(t.amount).toFixed(2)}
              </span>
            </motion.div>
          ))}
        </div>
      )}

      {/* ═══ RESERVATIONS ═══ */}
      {tab === "reservations" && (
        <div className="p-4 space-y-2">
          <h2 className="text-sm font-bold mb-2">Restaurant-Reservierungen</h2>
          {reservations.length === 0 ? (
            <div className="text-center py-12"><UtensilsCrossed size={32} className="mx-auto text-[#333] mb-2" /><p className="text-sm text-gray-500">Keine Reservierungen</p><p className="text-[10px] text-gray-600 mt-1">Erstelle ein Restaurant um Reservierungen zu erhalten</p></div>
          ) : reservations.map((r, i) => (
            <motion.div key={r.reservation_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-[#111118] rounded-xl border border-white/5 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-bold">{r.guest_name}</p>
                <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${r.status === "confirmed" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                  {r.status === "confirmed" ? "Bestätigt" : "Storniert"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[9px] text-gray-500">
                <span>{r.date} {r.time}</span><span>{r.guests} Pers.</span><span>{r.restaurant_name}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ═══ HOTEL BOOKINGS ═══ */}
      {tab === "hotels" && (
        <div className="p-4 space-y-2">
          <h2 className="text-sm font-bold mb-2">Hotel-Buchungen</h2>
          {hotelBookings.length === 0 ? (
            <div className="text-center py-12"><Hotel size={32} className="mx-auto text-[#333] mb-2" /><p className="text-sm text-gray-500">Keine Buchungen</p></div>
          ) : hotelBookings.map((b, i) => (
            <motion.div key={b.booking_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-[#111118] rounded-xl border border-white/5 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-bold">{b.guest_name}</p>
                <span className="text-sm font-bold text-[#6366F1]">€{b.total?.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-gray-400">{b.property_title}</p>
              <div className="flex items-center gap-3 text-[9px] text-gray-500 mt-1">
                <span>{b.check_in} → {b.check_out}</span><span>{b.nights} Nächte</span><span>{b.guests} Gäste</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ═══ APPOINTMENTS ═══ */}
      {tab === "appointments" && (
        <div className="p-4 space-y-2">
          <h2 className="text-sm font-bold mb-2">Termine</h2>
          {appointments.length === 0 ? (
            <div className="text-center py-12"><Calendar size={32} className="mx-auto text-[#333] mb-2" /><p className="text-sm text-gray-500">Keine Termine</p></div>
          ) : appointments.map((a, i) => (
            <motion.div key={a.appointment_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-[#111118] rounded-xl border border-white/5 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-bold">{a.user_name}</p>
                <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${a.status === "confirmed" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                  {a.status === "confirmed" ? "Bestätigt" : a.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[9px] text-gray-500">
                <span>{a.date} {a.time}</span>{a.service && <span>{a.service}</span>}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ═══ TIPS ═══ */}
      {tab === "tips" && (
        <div className="p-4 space-y-2">
          <div className="bg-[#111118] rounded-2xl border border-[#F59E0B]/20 p-4 text-center mb-3">
            <p className="text-2xl font-bold text-[#F59E0B]">€{tips.total?.toFixed(2) || "0.00"}</p>
            <p className="text-[10px] text-gray-500">Trinkgeld gesamt</p>
          </div>
          {(tips.tips || []).length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">Noch kein Trinkgeld erhalten</div>
          ) : (tips.tips || []).map((t, i) => (
            <motion.div key={t.tip_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-[#111118] rounded-xl border border-white/5 p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium">{t.sender_name || t.sender_email}</p>
                {t.message && <p className="text-[9px] text-gray-500 mt-0.5">&quot;{t.message}&quot;</p>}
              </div>
              <span className="text-sm font-bold text-[#F59E0B]">+€{t.amount?.toFixed(2)}</span>
            </motion.div>
          ))}
        </div>
      )}

      {/* ═══ PROFILE ═══ */}
      {tab === "profile" && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold">Firmenprofil bearbeiten</h2>
            <motion.button whileTap={{ scale: 0.9 }} onClick={saveProfile} disabled={saving}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#10B981] text-white text-xs font-bold" data-testid="merchant-save-profile">
              {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : <Save size={12} />}
              {saved ? "Gespeichert" : "Speichern"}
            </motion.button>
          </div>

          {profile.logo_url && (
            <div className="flex justify-center mb-2">
              <img src={profile.logo_url} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-[#10B981]" />
            </div>
          )}

          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4 space-y-2.5">
            <p className="text-[9px] text-gray-500 font-semibold">Grunddaten</p>
            {[
              { key: "business_name", label: "Firmenname", icon: Building2, placeholder: "Mein Geschäft" },
              { key: "logo_url", label: "Logo-URL", icon: ImageIcon, placeholder: "https://..." },
              { key: "category", label: "Branche", icon: Star, placeholder: "Restaurant, Hotel, Friseur..." },
            ].map(f => (
              <div key={f.key} className="flex items-center gap-2">
                <f.icon size={14} className="text-gray-500 flex-shrink-0" />
                <input value={profile[f.key] || ""} onChange={e => setProfile(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none text-white placeholder-gray-600" />
              </div>
            ))}
            <textarea value={profile.description || ""} onChange={e => setProfile(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Beschreibung deines Geschäfts..." rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none resize-none text-white placeholder-gray-600" />
          </div>

          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4 space-y-2.5">
            <p className="text-[9px] text-gray-500 font-semibold">Kontakt & Standort</p>
            {[
              { key: "phone", label: "Telefon", icon: Phone, placeholder: "+49 30 ..." },
              { key: "email", label: "E-Mail", icon: Mail, placeholder: "info@mein-geschaeft.de" },
              { key: "website", label: "Website", icon: Globe, placeholder: "www.mein-geschaeft.de" },
              { key: "address", label: "Adresse", icon: MapPin, placeholder: "Musterstraße 1" },
              { key: "city", label: "Stadt", icon: MapPin, placeholder: "Berlin" },
              { key: "opening_hours", label: "Öffnungszeiten", icon: Clock, placeholder: "Mo-Fr 9-18 Uhr" },
            ].map(f => (
              <div key={f.key} className="flex items-center gap-2">
                <f.icon size={14} className="text-gray-500 flex-shrink-0" />
                <input value={profile[f.key] || ""} onChange={e => setProfile(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none text-white placeholder-gray-600" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function MetricPill({ label, value, helper, testid }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/5 p-3" data-testid={testid}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
      {helper ? <p className="mt-1 text-[10px] text-slate-500">{helper}</p> : null}
    </div>
  );
}

function KpiRow({ label, value, testid }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/5 px-4 py-3" data-testid={testid}>
      <span className="text-sm text-slate-300">{label}</span>
      <span className="text-sm font-black text-white">{value}</span>
    </div>
  );
}

function AutomationActionCard({ title, subtitle, icon: Icon, accent, buttonLabel, running, onRun, testid, buttonTestid }) {
  return (
    <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid={testid}>
      <div className="flex items-center gap-2">
        <Icon size={16} className={accent} />
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">{subtitle}</p>
      <button
        onClick={onRun}
        disabled={running}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-xs font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        data-testid={buttonTestid}
      >
        {running ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
        {running ? "Läuft..." : buttonLabel}
      </button>
    </div>
  );
}

function SettingStepper({ label, value, min, max, step, suffix = "", onChange, testid }) {
  const canDecrease = value > min;
  const canIncrease = value < max;
  return (
    <div className="rounded-2xl border border-white/6 bg-white/5 p-3" data-testid={testid}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          onClick={() => canDecrease && onChange(Math.max(min, value - step))}
          disabled={!canDecrease}
          className="h-8 w-8 rounded-full border border-white/10 bg-black/20 text-sm font-bold text-white disabled:opacity-40"
          data-testid={`${testid}-decrease`}
        >
          -
        </button>
        <span className="text-sm font-black text-white" data-testid={`${testid}-value`}>{value}{suffix}</span>
        <button
          onClick={() => canIncrease && onChange(Math.min(max, value + step))}
          disabled={!canIncrease}
          className="h-8 w-8 rounded-full border border-white/10 bg-black/20 text-sm font-bold text-white disabled:opacity-40"
          data-testid={`${testid}-increase`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function OpsFormCard({ title, icon: Icon, children, testid }) {
  return (
    <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid={testid}>
      <div className="mb-4 flex items-center gap-2"><Icon size={16} className="text-fuchsia-300" /><h3 className="text-sm font-bold text-white">{title}</h3></div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function OpsInput({ value, onChange, placeholder, testid }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-xs text-white outline-none placeholder:text-slate-500" data-testid={testid} />;
}

function OpsTextarea({ value, onChange, placeholder, testid }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 resize-none" data-testid={testid} />;
}

function OpsSelect({ value, onChange, options, labels = {}, testid }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-2xl border border-white/10 bg-[#131c2a] px-3 text-xs text-white outline-none" data-testid={testid}>
      <option value="">Bitte wählen</option>
      {options.map((item) => <option key={item} value={item}>{labels[item] || item}</option>)}
    </select>
  );
}

function OpsListCard({ title, icon: Icon, children, testid }) {
  return (
    <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid={testid}>
      <div className="mb-4 flex items-center gap-2"><Icon size={16} className="text-cyan-300" /><h3 className="text-sm font-bold text-white">{title}</h3></div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function OpsListRow({ title, subtitle, value, testid }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/5 p-3" data-testid={testid}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-[11px] text-slate-400">{subtitle}</p>
        </div>
        <span className="rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-white">{value}</span>
      </div>
    </div>
  );
}

function DealerSectionHero({ overline, title, description, metrics, testid }) {
  return (
    <div className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(0,194,255,0.14),_transparent_32%),linear-gradient(145deg,_rgba(9,14,28,1),_rgba(17,24,39,1))] p-5" data-testid={testid}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/80">{overline}</p>
          <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">{description}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {metrics.map(([label, value], index) => (
            <MetricPill key={`${label}-${index}`} label={label} value={value} testid={`${testid}-metric-${index}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DealerListCard({ title, icon: Icon, children, testid }) {
  return (
    <div className="rounded-[26px] border border-white/8 bg-[#0f1725] p-4" data-testid={testid}>
      <div className="mb-4 flex items-center gap-2"><Icon size={16} className="text-cyan-300" /><h3 className="text-sm font-bold text-white">{title}</h3></div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DealerRow({ title, subtitle, badges = [], value, testid }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/5 p-3" data-testid={testid}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">{subtitle}</p>
          {badges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {badges.map((badge, index) => (
                <span key={`${badge}-${index}`} className="rounded-full bg-black/20 px-2.5 py-1 text-[11px] text-slate-300">{badge}</span>
              ))}
            </div>
          )}
        </div>
        <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">{value}</span>
      </div>
    </div>
  );
}

function EmptyDealerState({ label }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-center text-sm text-slate-500">{label}</div>;
}

export default MerchantPortalPage;
