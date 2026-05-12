/**
 * BidBlitz Staff — Marketing Landing Page (Paywall + Pricing)
 * ============================================================
 * Route: /merchant/staff/upgrade
 * Hero + Vorteile + Crewmeister/Papershift Vergleich + Pricing Cards
 */
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Check, X, Zap, Crown, Rocket, Clock,
  QrCode, MapPin, CalendarDays, FileText, ShieldCheck, Sparkles,
  Building2, UtensilsCrossed, ShoppingBag, Hammer, Loader2
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: "4,99",
    period: "/Monat",
    maxStaff: 5,
    color: "#00C2FF",
    icon: Zap,
    features: [
      "Bis zu 5 Mitarbeiter",
      "Digitale Zeiterfassung",
      "Schichtplanung",
      "Urlaub & Krankheit",
      "Basis-Reports",
    ],
    notIncluded: ["QR/NFC Check-in", "GPS Geofencing", "Payroll-Export"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "9,99",
    period: "/Monat",
    maxStaff: 20,
    popular: true,
    color: "#A855F7",
    icon: Crown,
    features: [
      "Bis zu 20 Mitarbeiter",
      "Alles aus Basic",
      "QR/NFC Check-in",
      "GPS Geofencing",
      "Manager-Approval-Flow",
      "Payroll-Export (CSV/DATEV)",
      "Erweiterte Reports",
    ],
    notIncluded: [],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "auf Anfrage",
    maxStaff: 9999,
    color: "#F59E0B",
    icon: Rocket,
    features: [
      "Unbegrenzte Mitarbeiter",
      "Alles aus Pro",
      "Multi-Standort & Multi-Merchant",
      "Custom Integrationen",
      "Dedicated Support",
      "SLA & Onboarding",
    ],
    notIncluded: [],
  },
];

const ADVANTAGES = [
  { icon: FileText, title: "Keine Papierzettel", desc: "Alle Zeiten digital — DSGVO-konform." },
  { icon: Clock, title: "Digitale Arbeitszeiten", desc: "Sekundengenaue Erfassung in Echtzeit." },
  { icon: QrCode, title: "QR / NFC / GPS Check-in", desc: "Mitarbeiter stempeln per Scan oder Standort." },
  { icon: CalendarDays, title: "Urlaub & Krankheit", desc: "Anträge, Genehmigung, Übersicht in einer App." },
  { icon: FileText, title: "Reports für Lohnabrechnung", desc: "Export als CSV / DATEV / PDF." },
  { icon: ShieldCheck, title: "Pause für Branchen", desc: "Gastronomie, Einzelhandel, Service, Bau." },
];

const INDUSTRIES = [
  { icon: UtensilsCrossed, label: "Gastronomie" },
  { icon: ShoppingBag, label: "Einzelhandel" },
  { icon: Building2, label: "Service" },
  { icon: Hammer, label: "Bau" },
];

const COMPARISON = [
  { feature: "Preis ab", bidblitz: "4,99 €/Monat", crewmeister: "ab 29 €/Monat", papershift: "ab 35 €/Monat" },
  { feature: "Zeiterfassung", bidblitz: "Ja", crewmeister: "Ja", papershift: "Ja" },
  { feature: "QR/NFC Check-in", bidblitz: "Ja (Pro)", crewmeister: "Add-on", papershift: "Add-on" },
  { feature: "GPS Geofencing", bidblitz: "Ja (Pro)", crewmeister: "Nein", papershift: "Add-on" },
  { feature: "Integriert in POS / Kassensystem", bidblitz: "Ja", crewmeister: "Nein", papershift: "Nein" },
  { feature: "30 Tage gratis testen", bidblitz: "Ja", crewmeister: "14 Tage", papershift: "14 Tage" },
];

export default function StaffUpgradeScreen({ onBack, onSuccess }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${API}/api/staff/subscription/status`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartTrial = async () => {
    setActionLoading("trial");
    try {
      const res = await fetch(`${API}/api/staff/subscription/start-trial`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("30 Tage Free Trial gestartet!");
        if (onSuccess) onSuccess();
      } else {
        toast.error(data.detail || "Trial konnte nicht gestartet werden");
      }
    } catch (e) {
      toast.error("Netzwerk-Fehler");
    }
    setActionLoading(null);
  };

  const handleCheckout = async (plan) => {
    if (plan === "enterprise") {
      window.location.href = "mailto:sales@bidblitz.com?subject=Staff%20Enterprise%20Plan";
      return;
    }
    setActionLoading(plan);
    try {
      const res = await fetch(`${API}/api/staff/subscription/create-checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.checkout_url) {
          window.location.href = data.checkout_url;
        } else if (data.placeholder) {
          toast.success(`Plan "${plan}" aktiviert (Dev-Mode)`);
          if (onSuccess) onSuccess();
        }
      } else {
        toast.error(data.detail || "Checkout fehlgeschlagen");
      }
    } catch (e) {
      toast.error("Netzwerk-Fehler");
    }
    setActionLoading(null);
  };

  const trialDaysLeft = status?.trial_days_left;
  const isTrialing = status?.status === "trialing";
  const currentPlan = status?.plan;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-32">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-[#0A0A0A]/90 backdrop-blur-lg border-b border-white/5">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            data-testid="staff-upgrade-back-btn"
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white"
          >
            <ArrowLeft size={18} /> Zurück
          </button>
          <span className="text-xs uppercase tracking-widest text-white/40">BidBlitz Staff</span>
        </div>
      </div>

      {/* HERO */}
      <section className="px-4 pt-10 pb-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(800px circle at 20% 0%, #00C2FF22, transparent), radial-gradient(600px circle at 80% 30%, #A855F722, transparent)",
          }}
        />
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6"
          >
            <Sparkles size={14} className="text-[#00C2FF]" />
            <span className="text-xs uppercase tracking-widest text-white/70">Neu in BidBlitz</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold font-outfit leading-tight mb-5"
          >
            Mitarbeiter, Schichten &<br />
            <span className="bg-gradient-to-r from-[#00C2FF] to-[#A855F7] bg-clip-text text-transparent">
              Zeiterfassung
            </span>{" "}
            direkt in BidBlitz
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-base sm:text-lg text-white/60 max-w-2xl mx-auto mb-8"
          >
            Die professionelle Crewmeister- und Papershift-Alternative —
            integriert in dein BidBlitz Händlerkonto, ohne zusätzliche Software.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10"
          >
            {!status?.has_subscription && status?.trial_available !== false && (
              <button
                onClick={handleStartTrial}
                disabled={actionLoading === "trial"}
                data-testid="staff-start-trial-btn"
                className="group flex items-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-[#00C2FF] to-[#A855F7] text-white font-semibold text-sm shadow-[0_8px_30px_-10px_#00C2FF80] hover:shadow-[0_12px_40px_-10px_#A855F7AA] transition-all"
              >
                {actionLoading === "trial" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Sparkles size={18} />
                )}
                30 Tage kostenlos testen
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
            {isTrialing && (
              <div
                data-testid="staff-trial-badge"
                className="px-4 py-2 rounded-full bg-white/5 border border-[#00C2FF]/40 text-sm flex items-center gap-2"
              >
                <Clock size={14} className="text-[#00C2FF]" />
                Free Trial — noch <strong>{trialDaysLeft}</strong> Tage
              </div>
            )}
            {currentPlan && status?.active && !isTrialing && (
              <div
                data-testid="staff-current-plan-badge"
                className="px-4 py-2 rounded-full bg-white/5 border border-[#A855F7]/40 text-sm flex items-center gap-2"
              >
                <Crown size={14} className="text-[#A855F7]" />
                Aktiv: <strong className="uppercase">{currentPlan}</strong>
              </div>
            )}
          </motion.div>

          {/* Industries */}
          <div className="flex flex-wrap justify-center gap-3">
            {INDUSTRIES.map((ind) => {
              const I = ind.icon;
              return (
                <div
                  key={ind.label}
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/[0.03] border border-white/10"
                >
                  <I size={14} className="text-white/60" />
                  <span className="text-xs text-white/70">{ind.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ADVANTAGES */}
      <section className="px-4 py-10 max-w-5xl mx-auto">
        <h2 className="text-lg sm:text-xl font-bold mb-6 text-white/90">
          Warum <span className="text-[#00C2FF]">BidBlitz Staff</span>?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ADVANTAGES.map((adv, i) => {
            const I = adv.icon;
            return (
              <motion.div
                key={adv.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#00C2FF]/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[#00C2FF]/10 flex items-center justify-center mb-3">
                  <I size={18} className="text-[#00C2FF]" />
                </div>
                <h3 className="text-sm font-semibold mb-1">{adv.title}</h3>
                <p className="text-xs text-white/55 leading-relaxed">{adv.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* COMPARISON */}
      <section className="px-4 py-10 max-w-5xl mx-auto">
        <h2 className="text-lg sm:text-xl font-bold mb-2 text-white/90">
          Im Vergleich zu Crewmeister & Papershift
        </h2>
        <p className="text-xs text-white/50 mb-5">Alle Preise inkl. MwSt., Stand 2026.</p>
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-xs sm:text-sm" data-testid="staff-comparison-table">
            <thead>
              <tr className="text-left border-b border-white/10">
                <th className="py-3 px-3 font-semibold text-white/60">Feature</th>
                <th className="py-3 px-3 font-bold text-[#00C2FF]">BidBlitz Staff</th>
                <th className="py-3 px-3 font-semibold text-white/60">Crewmeister</th>
                <th className="py-3 px-3 font-semibold text-white/60">Papershift</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="py-3 px-3 text-white/80">{row.feature}</td>
                  <td className="py-3 px-3 text-white font-semibold">{row.bidblitz}</td>
                  <td className="py-3 px-3 text-white/55">{row.crewmeister}</td>
                  <td className="py-3 px-3 text-white/55">{row.papershift}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* PRICING */}
      <section className="px-4 py-10 max-w-6xl mx-auto" data-testid="staff-pricing-section">
        <h2 className="text-lg sm:text-xl font-bold mb-2 text-center text-white/90">
          Wähle deinen Plan
        </h2>
        <p className="text-xs text-white/50 mb-8 text-center">
          Jederzeit kündbar. 30 Tage kostenlos testen — keine Kreditkarte nötig.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan, idx) => {
            const Icon = plan.icon;
            const isCurrent = currentPlan === plan.id;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                className={`relative rounded-3xl border-2 p-6 ${
                  plan.popular
                    ? "bg-gradient-to-br from-[#A855F7]/10 to-[#00C2FF]/5 border-[#A855F7]"
                    : "bg-white/[0.03] border-white/10"
                }`}
                data-testid={`staff-plan-card-${plan.id}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#A855F7] text-white text-[10px] font-bold uppercase tracking-widest">
                    Beliebt
                  </div>
                )}

                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${plan.color}1F` }}
                  >
                    <Icon size={22} style={{ color: plan.color }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className="text-xs text-white/55">{plan.maxStaff === 9999 ? "Unbegrenzt" : `bis ${plan.maxStaff} Mitarbeiter`}</p>
                  </div>
                </div>

                <div className="mb-6">
                  {plan.price !== "Custom" ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold" style={{ color: plan.color }}>
                        €{plan.price}
                      </span>
                      <span className="text-xs text-white/40">{plan.period}</span>
                    </div>
                  ) : (
                    <div className="text-2xl font-bold" style={{ color: plan.color }}>
                      {plan.period}
                    </div>
                  )}
                </div>

                <ul className="space-y-2 mb-6 min-h-[180px]">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-white/85">
                      <Check size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                  {plan.notIncluded.map((f, i) => (
                    <li key={`x-${i}`} className="flex items-start gap-2 text-xs text-white/40 line-through">
                      <X size={14} className="text-red-400/60 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={actionLoading === plan.id || isCurrent}
                  data-testid={`staff-plan-cta-${plan.id}`}
                  className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                    isCurrent
                      ? "bg-green-500/20 text-green-400 cursor-default"
                      : plan.popular
                      ? "bg-[#A855F7] hover:bg-[#9333EA] text-white"
                      : "bg-white/5 hover:bg-white/10 border border-white/10"
                  }`}
                >
                  {actionLoading === plan.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : isCurrent ? (
                    "Aktiver Plan"
                  ) : plan.id === "enterprise" ? (
                    "Kontakt aufnehmen"
                  ) : (
                    <>
                      Plan wählen <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        <p className="text-xs text-white/40 text-center mt-6">
          Alle Pläne ohne Mindestlaufzeit · Sichere Zahlung via Stripe · DSGVO-konform
        </p>
      </section>
    </div>
  );
}
