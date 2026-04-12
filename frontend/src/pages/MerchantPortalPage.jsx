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
  Building2, Image as ImageIcon
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const MerchantPortalPage = ({ onBack, onNavigate }) => {
  const [tab, setTab] = useState("dashboard");
  const [dash, setDash] = useState(null);
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
    } catch {}
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
      try { const res = await fetch(`${API}${ep.url}`, { credentials: "include" }); if (res.ok) ep.setter(await res.json()); } catch {}
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
    } catch {}
    setSaving(false);
  };

  const TABS = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
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
                {t.message && <p className="text-[9px] text-gray-500 mt-0.5">"{t.message}"</p>}
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

export default MerchantPortalPage;
