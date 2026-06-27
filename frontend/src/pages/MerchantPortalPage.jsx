/**
 * BidBlitz V2 - Merchant Portal / Händler-Dashboard
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, BarChart3, DollarSign, ShoppingBag, Users, Star,
  Calendar, Hotel, Briefcase, Ticket, UtensilsCrossed, Heart,
  TrendingUp, Wallet, Clock, MapPin, Phone, Mail, Globe,
  Settings, Loader2, Check, Save, Scissors, ChevronRight,
  Building2, Image as ImageIcon, Gift, Megaphone, Store, LineChart, Link2,
  BrainCircuit, Boxes, ReceiptText, AlertTriangle, Sparkles, Activity, ShieldAlert, PackageCheck
} from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { api } from "../services/api";

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

  const loadDash = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/merchant-portal/dashboard`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setDash(d);
        if (d.profile) setProfile(prev => ({ ...prev, ...d.profile }));
      }
      const [entRes, v5Res, aiRes, progRes, growthRes, fraRes] = await Promise.all([
        fetch(`${API}/api/merchant-portal/enterprise-overview`, { credentials: "include" }),
        fetch(`${API}/api/merchant-portal/v5/dashboard`, { credentials: "include" }),
        fetch(`${API}/api/merchant-portal/v5/executive-ai/latest`, { credentials: "include" }),
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

  useEffect(() => { loadDash(); }, [loadDash]);
  useEffect(() => { if (tab !== "dashboard" && tab !== "profile") loadTab(tab); }, [tab, loadTab]);

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

  const TABS = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "enterprise-v5", label: "Enterprise V5", icon: Building2 },
    { id: "executive-ai", label: "Executive AI", icon: BrainCircuit },
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
                <MetricPill label="Revenue Growth" value={`${(v5.financials?.revenue_growth_pct || 0).toFixed(1)}%`} testid="merchant-v5-revenue-growth" />
                <MetricPill label="Profit Growth" value={`${(v5.financials?.profit_growth_pct || 0).toFixed(1)}%`} testid="merchant-v5-profit-growth" />
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

function MetricPill({ label, value, testid }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/5 p-3" data-testid={testid}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
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

export default MerchantPortalPage;
