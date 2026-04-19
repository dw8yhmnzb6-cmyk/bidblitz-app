/**
 * AdminRevenueDashboardPage — Umsatz-Cockpit für Admin
 * + Merchant-Outreach: Ein-Klick-WhatsApp/Email-Pitch für neue Werbekunden
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Loader2, TrendingUp, Users, Crown, Copy, MessageCircle,
  Mail, Download, DollarSign, Target
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const SOURCE_LABELS = {
  premium:          { label: "Premium Abos",      icon: Crown,       color: "#FFD700" },
  classified_boost: { label: "Anzeigen Boost",    icon: TrendingUp,  color: "#FFB800" },
  gift_code:        { label: "Geschenk-Codes",    icon: DollarSign,  color: "#A855F7" },
  exchange:         { label: "BLZ Exchange",      icon: DollarSign,  color: "#00C2FF" },
  ad_banner:        { label: "HomePage Werbung",  icon: Target,      color: "#FF6B9D" },
  promote:          { label: "Listing Promote",   icon: TrendingUp,  color: "#FF6B35" },
  instant_cashout:  { label: "Sofort-Cashout Fee",icon: DollarSign,  color: "#00D26A" },
  job_boost:        { label: "Job Boost",         icon: TrendingUp,  color: "#3B82F6" },
  kyc_express:      { label: "KYC Express",       icon: Users,       color: "#00C2FF" },
  spin_wheel:       { label: "💸 Glücksrad Ausg.",icon: DollarSign,  color: "#EF4444" },
  streak_milestone: { label: "💸 Streak Ausg.",   icon: DollarSign,  color: "#EF4444" },
  birthday:         { label: "💸 Geburtstag Ausg.",icon: DollarSign, color: "#EF4444" },
};

export default function AdminRevenueDashboardPage({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOutreach, setShowOutreach] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/revenue-dashboard`, { credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Fehler");
      setData(j);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  if (loading && !data) return <div className="min-h-screen bg-[#060810] flex items-center justify-center"><Loader2 className="animate-spin text-white/40"/></div>;
  if (!data) return null;

  const exportCsv = () => {
    const rows = [["Quelle", "Heute €", "Woche €", "Monat €", "Gesamt €", "Anzahl"]];
    Object.entries(data.sources).forEach(([k, v]) => {
      rows.push([SOURCE_LABELS[k]?.label || k, v.today, v.week, v.month, v.all_time, v.count_total]);
    });
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `bidblitz-umsatz-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  return (
    <div className="min-h-screen bg-[#060810] pb-24" data-testid="admin-revenue">
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#060810]/90 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3 pt-[max(env(safe-area-inset-top,0px),14px)]">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="revenue-back">
            <ArrowLeft size={16} className="text-white/70"/>
          </button>
          <h1 className="text-[14px] font-bold text-white flex-1">Umsatz-Dashboard</h1>
          <button onClick={exportCsv} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="revenue-export">
            <Download size={14} className="text-white/70"/>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Hero Totals */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl p-4"
            style={{ background: "linear-gradient(135deg,rgba(0,210,106,0.2),rgba(0,194,255,0.08))", border: "1px solid rgba(0,210,106,0.3)" }}
            data-testid="total-today">
            <p className="text-[10px] text-white/60 uppercase tracking-wider">Heute</p>
            <p className="text-[26px] font-black text-[#00D26A] tabular-nums font-outfit leading-none mt-1">
              €{data.totals.today.toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl p-4"
            style={{ background: "linear-gradient(135deg,rgba(0,194,255,0.18),rgba(168,85,247,0.08))", border: "1px solid rgba(0,194,255,0.3)" }}
            data-testid="total-month">
            <p className="text-[10px] text-white/60 uppercase tracking-wider">Monat</p>
            <p className="text-[26px] font-black text-[#00C2FF] tabular-nums font-outfit leading-none mt-1">
              €{data.totals.month.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[9px] text-white/50 uppercase tracking-wider">Woche</p>
            <p className="text-[17px] font-black text-white tabular-nums">€{data.totals.week.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[9px] text-white/50 uppercase tracking-wider">Gesamt</p>
            <p className="text-[17px] font-black text-white tabular-nums">€{data.totals.all_time.toFixed(2)}</p>
          </div>
        </div>

        {/* MRR Card */}
        <div className="rounded-2xl p-4"
          style={{ background: "linear-gradient(135deg,rgba(255,215,0,0.15),rgba(255,107,53,0.05))", border: "1px solid rgba(255,215,0,0.3)" }}
          data-testid="mrr-card">
          <div className="flex items-center gap-3">
            <Crown size={22} className="text-[#FFD700]"/>
            <div>
              <p className="text-[10px] text-white/60 uppercase tracking-wider">Monatliche Recurring Revenue (MRR)</p>
              <p className="text-[24px] font-black text-white tabular-nums font-outfit">€{data.mrr.mrr_eur}</p>
              <p className="text-[10px] text-white/50">{data.mrr.active_premium} aktive Premium-Abos</p>
            </div>
          </div>
        </div>

        {/* User Stats */}
        <div className="rounded-2xl p-3 flex items-center gap-3" style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)" }}>
          <Users size={18} className="text-[#A855F7]"/>
          <div className="flex-1 grid grid-cols-3 gap-2">
            <div>
              <p className="text-[9px] text-white/50 uppercase">Gesamt</p>
              <p className="text-[15px] font-black text-white tabular-nums">{data.users.total}</p>
            </div>
            <div>
              <p className="text-[9px] text-white/50 uppercase">Heute</p>
              <p className="text-[15px] font-black text-[#00D26A] tabular-nums">+{data.users.today}</p>
            </div>
            <div>
              <p className="text-[9px] text-white/50 uppercase">Woche</p>
              <p className="text-[15px] font-black text-[#00C2FF] tabular-nums">+{data.users.week}</p>
            </div>
          </div>
        </div>

        {/* Outreach CTA */}
        <motion.button
          onClick={() => setShowOutreach(!showOutreach)}
          whileTap={{ scale: 0.98 }}
          className="w-full rounded-2xl p-4 text-left"
          style={{ background: "linear-gradient(135deg,rgba(0,210,106,0.15),rgba(0,194,255,0.08))", border: "1px solid rgba(0,210,106,0.3)" }}
          data-testid="outreach-toggle">
          <div className="flex items-center gap-3">
            <MessageCircle size={20} className="text-[#00D26A]"/>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-white">📢 Händler als Werbekunden akquirieren</p>
              <p className="text-[11px] text-white/60 mt-0.5">Pitch-Vorlage + WhatsApp Ein-Klick-Link</p>
            </div>
            <motion.div animate={{ rotate: showOutreach ? 90 : 0 }}>
              <ArrowLeft size={14} className="text-white/60 rotate-180"/>
            </motion.div>
          </div>
        </motion.button>

        {showOutreach && <OutreachSection/>}

        {/* Revenue Sources */}
        <div>
          <h3 className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Umsatzquellen</h3>
          <div className="space-y-1.5">
            {Object.entries(data.sources)
              .sort((a, b) => b[1].all_time - a[1].all_time)
              .map(([k, v]) => {
                const cfg = SOURCE_LABELS[k] || { label: k, icon: DollarSign, color: "#888" };
                return (
                  <div key={k} className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                    data-testid={`src-${k}`}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${cfg.color}20`, border: `1px solid ${cfg.color}40` }}>
                      <cfg.icon size={14} style={{ color: cfg.color }}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-white truncate">{cfg.label}</p>
                      <p className="text-[9px] text-white/40">
                        Heute €{v.today.toFixed(2)} · Woche €{v.week.toFixed(2)} · {v.count_total} Transaktionen
                      </p>
                    </div>
                    <p className="text-[13px] font-black tabular-nums" style={{ color: cfg.color }}>
                      €{v.all_time.toFixed(2)}
                    </p>
                  </div>
                );
              })
            }
          </div>
        </div>

        {/* Top Spenders */}
        {data.top_spenders?.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Top 5 Zahler</h3>
            <div className="space-y-1.5">
              {data.top_spenders.map((u, i) => (
                <div key={i} className="rounded-xl p-3 flex items-center gap-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black"
                    style={{ background: i === 0 ? "linear-gradient(135deg,#FFD700,#FFA500)" : "rgba(255,255,255,0.05)", color: i === 0 ? "black" : "white" }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-white truncate">{u.name}</p>
                    <p className="text-[10px] text-white/40 truncate">{u.email} · {u.tx_count} Zahlungen</p>
                  </div>
                  <p className="text-[13px] font-black text-[#00D26A] tabular-nums">€{u.spent}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ Outreach Section ═══

const OutreachSection = () => {
  const [tmpl, setTmpl] = useState("wa_de");
  const [merchantName, setMerchantName] = useState("Pizza Max");
  const [city, setCity] = useState("Berlin");

  const TEMPLATES = {
    wa_de: {
      label: "WhatsApp DE",
      icon: MessageCircle,
      color: "#25D366",
      build: () => `Hallo ${merchantName},

ich hoffe es geht dir gut! 👋

Ich betreibe BidBlitz — eine lokale Super-App für ${city} mit über 500+ aktiven Nutzern. Unsere User sind kaufkräftig und lokal.

Ich hätte einen kostengünstigen Vorschlag: Für nur €99/Monat bekommst du einen Werbebanner direkt auf unserer HomePage — sichtbar für alle Nutzer in ${city}.

📊 Zum Vergleich:
• Google Ads: ab €300/Monat
• Facebook Ads: ab €150/Monat
• BidBlitz: nur €99/Monat — mit lokaler Zielgruppe!

Interesse? Antworte einfach hier und ich richte das in 5 Min für dich ein.

Viele Grüße
BidBlitz Team`,
      shareUrl: (msg) => `https://wa.me/?text=${encodeURIComponent(msg)}`,
    },
    email_de: {
      label: "E-Mail DE",
      icon: Mail,
      color: "#00C2FF",
      build: () => `Betreff: Günstige lokale Werbung für ${merchantName} (€99/Monat)

Hallo ${merchantName}-Team,

mein Name ist [DEIN NAME] und ich betreibe die lokale Super-App BidBlitz in ${city}.

Unser Nutzerwachstum:
• 500+ aktive User in ${city}
• Täglich 3–5× App-Nutzung
• Vollständig DSGVO-konform

Angebot für ${merchantName}:
➤ Werbebanner auf BidBlitz HomePage
➤ €99/Monat — sofort kündbar
➤ Unbegrenzte Impressionen + Klick-Tracking

Testmonat mit 50% Rabatt = nur €49 für den ersten Monat.

Interesse? Antworten Sie einfach auf diese E-Mail.

Beste Grüße,
[DEIN NAME]
BidBlitz`,
      shareUrl: (msg) => `mailto:?body=${encodeURIComponent(msg)}`,
    },
    wa_short: {
      label: "WhatsApp Kurz",
      icon: MessageCircle,
      color: "#25D366",
      build: () => `Hi ${merchantName}! 👋 Ich habe BidBlitz, die Super-App für ${city}. Möchtest du Werbung bei uns schalten? €99/Monat, lokal zielgenau. Details: https://bidblitz.ae`,
      shareUrl: (msg) => `https://wa.me/?text=${encodeURIComponent(msg)}`,
    },
  };

  const t = TEMPLATES[tmpl];
  const msg = t.build();

  const copy = async () => {
    try { await navigator.clipboard.writeText(msg); toast.success("Kopiert!"); } catch {}
  };

  const share = () => {
    window.open(t.shareUrl(msg), "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
      className="rounded-2xl p-4 space-y-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      data-testid="outreach-section"
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-white/50 uppercase tracking-wider">Händler-Name</label>
          <input value={merchantName} onChange={e => setMerchantName(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-[13px] text-white"
            data-testid="out-merchant"/>
        </div>
        <div>
          <label className="text-[10px] text-white/50 uppercase tracking-wider">Stadt</label>
          <input value={city} onChange={e => setCity(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-[13px] text-white"
            data-testid="out-city"/>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto">
        {Object.entries(TEMPLATES).map(([k, v]) => (
          <button key={k} onClick={() => setTmpl(k)}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap flex items-center gap-1"
            style={{
              background: tmpl === k ? `${v.color}20` : "rgba(255,255,255,0.03)",
              color: tmpl === k ? v.color : "rgba(255,255,255,0.6)",
              border: `1px solid ${tmpl === k ? `${v.color}40` : "rgba(255,255,255,0.06)"}`,
            }}
            data-testid={`out-tmpl-${k}`}>
            <v.icon size={11}/> {v.label}
          </button>
        ))}
      </div>

      <textarea value={msg} readOnly rows={10}
        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-[11px] text-white/90 font-mono resize-none focus:outline-none"/>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={copy}
          className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-[12px] font-bold flex items-center justify-center gap-1.5"
          data-testid="out-copy">
          <Copy size={12}/> Kopieren
        </button>
        <button onClick={share}
          className="py-2.5 rounded-xl text-black text-[12px] font-black flex items-center justify-center gap-1.5"
          style={{ background: t.color }}
          data-testid="out-share">
          <t.icon size={13}/> Jetzt versenden
        </button>
      </div>
    </motion.div>
  );
};
