import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UtensilsCrossed, ShoppingBag, Scissors, Dumbbell, Fuel, Coffee,
  QrCode, Gift, Check, ArrowRight, Sparkles, TrendingUp, Users,
  Scan, CreditCard, Receipt, Percent, Euro, Zap,
} from "lucide-react";

// ─── INDUSTRIES ──────────────────────────────────────────────────────────────
const INDUSTRIES = [
  {
    id: "gastro",
    icon: UtensilsCrossed,
    color: "#FF6B6B",
    title: "Gastronomie",
    subtitle: "Restaurant · Café · Bar · Imbiss",
    features: [
      "Tisch-QR: Gast scannt, bestellt, zahlt — in einem Flow",
      "Split-Bill & Trinkgeld automatisch an Kellner",
      "Reservierungen + Wartelisten integriert",
      "Digitale Speisekarte mit Live-Updates",
      "Kitchen-Display-System inkl.",
    ],
    saving: { from: 380, to: 47, label: "Restaurant mit 50 Tischen" },
    cta: "Gastro-Demo starten",
  },
  {
    id: "retail",
    icon: ShoppingBag,
    color: "#00E89D",
    title: "Einzelhandel",
    subtitle: "Boutique · Bäckerei · Kiosk · Shop",
    features: [
      "NFC-Zahlung in 2 Sekunden — keine Kartenschlitze",
      "Eigene Gutscheine & Rabattaktionen live",
      "Loyalty-Punkte automatisch bei jedem Kauf",
      "Lager-Management + Barcode-Scan inkl.",
      "Keine Terminal-Hardware nötig (nur Smartphone)",
    ],
    saving: { from: 210, to: 29, label: "Shop mit 1000 Tx/Monat" },
    cta: "Retail-Preis berechnen",
  },
  {
    id: "service",
    icon: Scissors,
    color: "#A855F7",
    title: "Dienstleistung",
    subtitle: "Friseur · Kosmetik · Werkstatt · Praxis",
    features: [
      "Online-Terminbuchung mit Anzahlung",
      "Automatische Erinnerungs-Benachrichtigungen",
      "Mitarbeiter-Provisionen auto-berechnet",
      "Rechnung + Beleg per E-Mail in 1 Klick",
      "No-Show-Gebühr automatisch eingezogen",
    ],
    saving: { from: 165, to: 35, label: "Friseur mit 3 Stylisten" },
    cta: "Service-Demo testen",
  },
  {
    id: "fitness",
    icon: Dumbbell,
    color: "#FFB800",
    title: "Fitness & Abo",
    subtitle: "Gym · Yoga · Sauna · Coaching",
    features: [
      "Monats-Abos mit SEPA-Lastschrift",
      "QR-Studio-Zugang ohne Keyfob",
      "Trainer-Termine + Gruppen-Klassen",
      "Automatisches Abrechnen & Mahnwesen",
      "Mitglieder-Check-in per App",
    ],
    saving: { from: 89, to: 19, label: "Studio mit 200 Mitgliedern" },
    cta: "Fitness-Paket ansehen",
  },
  {
    id: "fuel",
    icon: Fuel,
    color: "#00C2FF",
    title: "Tankstelle & Kiosk",
    subtitle: "Tankstellen · Waschanlagen · Tabakladen",
    features: [
      "Zapfsäulen-QR: Kunde scannt, zahlt, fährt weg",
      "Alters-Verifikation bei Tabak/Alkohol",
      "Fleet-Management für Firmenkunden",
      "Loyalty-Rabatte automatisch",
      "24/7 unbemannter Self-Service-Betrieb",
    ],
    saving: { from: 420, to: 65, label: "Tankstelle mit 8 Zapfsäulen" },
    cta: "Tankstellen-Setup",
  },
  {
    id: "bakery",
    icon: Coffee,
    color: "#EC4899",
    title: "Bäckerei & Imbiss",
    subtitle: "Bäcker · Foodtruck · Eisdiele",
    features: [
      "Vorbestellung: Kunde zahlt, holt ab",
      "Tagesangebote als Push-Nachricht",
      "Brot-Abos für Stammkunden",
      "Stempelkarte digital (10. Kaffee frei)",
      "Peak-Hour-Rabatte automatisch",
    ],
    saving: { from: 145, to: 25, label: "Bäckerei mit 2 Filialen" },
    cta: "Bäckerei starten",
  },
];

// ─── TABLE-QR DEMO FLOW ─────────────────────────────────────────────────────
const QR_STEPS = [
  { icon: Scan, title: "Gast scannt QR am Tisch", desc: "Kein Download nötig — läuft im Browser", color: "#00E0FF" },
  { icon: UtensilsCrossed, title: "Menü öffnet sich", desc: "Gast sieht Live-Preise + Allergene + Fotos", color: "#FF6B6B" },
  { icon: Receipt, title: "Bestellung an Küche", desc: "Ticket im Kitchen-Display sofort sichtbar", color: "#FFB800" },
  { icon: CreditCard, title: "Zahlung in App", desc: "Apple Pay / Google Pay / Wallet — 3 Sek", color: "#00E89D" },
  { icon: Users, title: "Trinkgeld-Split", desc: "20% geht automatisch an Kellner-Konto", color: "#A855F7" },
];

// ─── VOUCHER BUILDER MINI-DEMO ──────────────────────────────────────────────
const VoucherBuilder = () => {
  const [vType, setVType] = useState("percent");
  const [vValue, setVValue] = useState(15);
  const [vMin, setVMin] = useState(50);
  const [vName, setVName] = useState("Sommer-Aktion 2026");

  const display = vType === "percent"
    ? `${vValue}% Rabatt`
    : vType === "amount"
    ? `${vValue}€ geschenkt`
    : `${vValue}x Punkte`;

  return (
    <div className="rounded-3xl p-5 sm:p-7" style={{ background: "rgba(0,232,157,0.03)", border: "1px solid rgba(0,232,157,0.12)" }}>
      <div className="flex items-center gap-2 mb-5">
        <Sparkles size={18} className="text-[#00E89D]" />
        <h3 className="text-base font-bold text-white/90">Gutschein-Baukasten</h3>
        <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-[#00E89D]/15 text-[#00E89D] font-bold">LIVE</span>
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Form */}
        <div className="space-y-3">
          <div>
            <label className="text-[9px] text-white/30 uppercase tracking-wider font-bold block mb-1.5">Kampagne</label>
            <input value={vName} onChange={e => setVName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/5 text-[13px] text-white/85 outline-none focus:border-[#00E89D]/30"
              data-testid="vb-name" />
          </div>
          <div>
            <label className="text-[9px] text-white/30 uppercase tracking-wider font-bold block mb-1.5">Typ</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "percent", label: "% Rabatt", icon: Percent },
                { id: "amount", label: "€ Bonus", icon: Euro },
                { id: "points", label: "x Punkte", icon: Zap },
              ].map(t => (
                <motion.button key={t.id} whileTap={{ scale: 0.96 }} onClick={() => setVType(t.id)}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl"
                  style={{
                    background: vType === t.id ? "rgba(0,232,157,0.12)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${vType === t.id ? "rgba(0,232,157,0.3)" : "rgba(255,255,255,0.04)"}`,
                  }}
                  data-testid={`vb-type-${t.id}`}>
                  <t.icon size={13} style={{ color: vType === t.id ? "#00E89D" : "#555" }} />
                  <span className="text-[9px] font-bold" style={{ color: vType === t.id ? "#00E89D" : "#555" }}>{t.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[9px] text-white/30 uppercase tracking-wider font-bold block mb-1.5">Wert</label>
              <input type="number" value={vValue} onChange={e => setVValue(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/5 text-[13px] text-white/85 outline-none focus:border-[#00E89D]/30"
                data-testid="vb-value" />
            </div>
            <div>
              <label className="text-[9px] text-white/30 uppercase tracking-wider font-bold block mb-1.5">Min. Einkauf (€)</label>
              <input type="number" value={vMin} onChange={e => setVMin(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/5 text-[13px] text-white/85 outline-none focus:border-[#00E89D]/30"
                data-testid="vb-min" />
            </div>
          </div>
        </div>

        {/* Preview Card */}
        <motion.div layout className="relative rounded-2xl p-5 overflow-hidden"
          style={{ background: "linear-gradient(135deg, #020408 0%, #0a1a1a 100%)", border: "1px solid rgba(0,232,157,0.2)" }}>
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full" style={{ background: "#00E89D", filter: "blur(50px)", opacity: 0.15 }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Gift size={14} className="text-[#00E89D]" />
              <span className="text-[10px] font-bold text-[#00E89D] uppercase tracking-wider">Gutschein</span>
            </div>
            <p className="text-xs text-white/50 mb-1">{vName || "Kampagnenname"}</p>
            <p className="text-3xl sm:text-4xl font-black text-white/95 mb-1">{display}</p>
            <p className="text-[11px] text-white/40 mb-4">ab {vMin}€ Einkauf · gültig 30 Tage</p>
            <div className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: "rgba(0,232,157,0.05)", border: "1px dashed rgba(0,232,157,0.2)" }}>
              <QrCode size={32} className="text-[#00E89D]/60" />
              <div>
                <p className="text-[9px] text-white/30 uppercase tracking-wider font-bold">QR-Code</p>
                <p className="text-[11px] font-mono text-white/70">BB-{(vType || "X").slice(0, 3).toUpperCase()}-{(vValue || 0).toString().padStart(2, "0")}-{vMin || 0}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      <p className="text-[10px] text-white/25 mt-4 text-center">In der echten App: Kampagne live, per Push an Stammkunden, QR an Kasse scanbar.</p>
    </div>
  );
};

// ─── TABLE QR FLOW ─────────────────────────────────────────────────────────
const TableQRFlow = () => (
  <div className="rounded-3xl p-5 sm:p-7" style={{ background: "rgba(255,107,107,0.03)", border: "1px solid rgba(255,107,107,0.12)" }}>
    <div className="flex items-center gap-2 mb-5">
      <QrCode size={18} className="text-[#FF6B6B]" />
      <h3 className="text-base font-bold text-white/90">Gastro: Tisch-QR in 5 Schritten</h3>
      <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-[#FF6B6B]/15 text-[#FF6B6B] font-bold">~45 SEK</span>
    </div>
    <div className="space-y-2">
      {QR_STEPS.map((step, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          className="flex items-center gap-3 p-3 rounded-xl"
          style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}
          data-testid={`qr-step-${i}`}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${step.color}15`, border: `1px solid ${step.color}30` }}>
            <span className="text-[11px] font-black" style={{ color: step.color }}>{i + 1}</span>
          </div>
          <step.icon size={18} style={{ color: step.color }} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-white/85">{step.title}</p>
            <p className="text-[10px] text-white/35 mt-0.5">{step.desc}</p>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

// ─── TESTIMONIAL STATS STRIP ────────────────────────────────────────────────
const StatsStrip = () => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    {[
      { value: "142+", label: "Aktive Händler", icon: Users, color: "#00E0FF" },
      { value: "8.2K", label: "Tx pro Tag", icon: TrendingUp, color: "#00E89D" },
      { value: "0.29%", label: "Niedrigste Gebühr", icon: Percent, color: "#FFB800" },
      { value: "3 Min", label: "Ø Onboarding", icon: Zap, color: "#FF6B6B" },
    ].map((s, i) => (
      <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
        className="rounded-2xl p-4 text-center" style={{ background: "rgba(8,12,20,0.6)", border: "1px solid rgba(255,255,255,0.04)" }}
        data-testid={`stat-${i}`}>
        <s.icon size={14} className="mx-auto mb-2" style={{ color: s.color, opacity: 0.7 }} />
        <p className="text-xl font-black font-outfit" style={{ color: s.color }}>{s.value}</p>
        <p className="text-[9px] text-white/30 uppercase tracking-wider font-bold mt-1">{s.label}</p>
      </motion.div>
    ))}
  </div>
);

// ─── INDUSTRY CARDS GRID ───────────────────────────────────────────────────
const IndustryCards = ({ onRegister }) => {
  const [active, setActive] = useState("gastro");
  const ind = INDUSTRIES.find(i => i.id === active) || INDUSTRIES[0];
  return (
    <>
      <div className="flex flex-wrap gap-2 justify-center mb-6">
        {INDUSTRIES.map(i => (
          <motion.button key={i.id} whileTap={{ scale: 0.96 }} onClick={() => setActive(i.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold"
            style={{
              background: active === i.id ? `${i.color}15` : "rgba(255,255,255,0.02)",
              border: `1px solid ${active === i.id ? `${i.color}35` : "rgba(255,255,255,0.04)"}`,
              color: active === i.id ? i.color : "rgba(255,255,255,0.35)",
            }}
            data-testid={`industry-tab-${i.id}`}>
            <i.icon size={13} />
            {i.title}
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={ind.id}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="rounded-3xl p-6 sm:p-8"
          style={{ background: `linear-gradient(135deg, ${ind.color}08 0%, rgba(8,12,20,0.4) 100%)`, border: `1px solid ${ind.color}20` }}
          data-testid={`industry-${ind.id}`}>
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: `${ind.color}15`, border: `1px solid ${ind.color}30` }}>
                <ind.icon size={22} style={{ color: ind.color }} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white/90">{ind.title}</h3>
                <p className="text-[11px] text-white/35 mt-0.5">{ind.subtitle}</p>
              </div>
            </div>
          </div>

          <ul className="space-y-2.5 mb-5">
            {ind.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check size={14} style={{ color: ind.color }} className="mt-0.5 shrink-0" />
                <span className="text-[13px] text-white/70">{f}</span>
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-[1fr,auto] gap-4 items-center rounded-2xl p-4"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.03)" }}>
            <div>
              <p className="text-[9px] uppercase tracking-wider font-bold" style={{ color: ind.color, opacity: 0.7 }}>Kostenrechnung</p>
              <p className="text-[11px] text-white/40 mt-0.5">{ind.saving.label}</p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-[12px] text-red-400/60 line-through">{ind.saving.from}€/Mo</span>
                <span className="text-2xl font-black" style={{ color: ind.color }}>{ind.saving.to}€</span>
                <span className="text-[10px] text-white/30">/Monat</span>
              </div>
              <p className="text-[10px] mt-1" style={{ color: ind.color }}>Spart {Math.round((1 - ind.saving.to / ind.saving.from) * 100)}% gegenüber klassischem Kassensystem</p>
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={onRegister}
              className="px-4 py-3 rounded-xl text-[11px] font-black flex items-center gap-1.5 shrink-0"
              style={{ background: `${ind.color}20`, border: `1px solid ${ind.color}40`, color: ind.color }}
              data-testid={`industry-cta-${ind.id}`}>
              {ind.cta} <ArrowRight size={12} />
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

// ─── MAIN EXPORTED SECTION ─────────────────────────────────────────────────
export default function MerchantIndustriesSection({ onRegister }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
      {/* Intro + Stats */}
      <div>
        <div className="text-center mb-8">
          <p className="text-[9px] text-[#00E89D]/50 uppercase tracking-[0.3em] font-bold mb-2">FÜR JEDE BRANCHE</p>
          <h2 className="text-2xl sm:text-3xl font-black text-white/90 mb-3">Dein Business. Unser System.</h2>
          <p className="text-[13px] text-white/40 max-w-xl mx-auto">Ein Konto, alle Werkzeuge: Kasse, Gutscheine, Termine, Online-Bestellung — je nach Branche angepasst.</p>
        </div>
        <StatsStrip />
      </div>

      {/* Industry Tabs */}
      <IndustryCards onRegister={onRegister} />

      {/* Feature Demos */}
      <div className="grid lg:grid-cols-2 gap-5">
        <TableQRFlow />
        <VoucherBuilder />
      </div>
    </div>
  );
}
