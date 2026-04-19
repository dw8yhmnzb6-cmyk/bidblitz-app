/**
 * MarketingHubPage — aktiviert gebaute-aber-unsichtbare Revenue-Features:
 * - Listing-Promote (€1.99–6.99)
 * - Instant-Cashout (€0.99 Fee)
 * - Job-Boost (€0.99–4.99)
 * - Werbeanzeigen (€5/Tag, €29/Woche, €99/Monat)
 * - KYC-Express (€4.99)
 * - Challenges
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Loader2, Rocket, Zap, Megaphone, Shield,
  TrendingUp, Target, Clock, Euro, CheckCircle, Sparkles
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options, credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.detail || "Fehler");
  return d;
}

const FEATURES = [
  {
    id: "promote",
    icon: Rocket,
    color: "#FF6B35",
    title: "Anzeige pushen",
    desc: "Deine Kleinanzeige ganz oben in der Suche",
    tiers: [
      { key: "24h", label: "24 Stunden", price: 1.99 },
      { key: "3d",  label: "3 Tage",     price: 3.99 },
      { key: "7d",  label: "7 Tage",     price: 6.99 },
    ],
    hint: "Du brauchst eine bestehende Anzeige. Gib die Anzeigen-ID an.",
    inputs: [{ name: "listing_id", label: "Anzeigen-ID", placeholder: "ad_XXXXXX" }],
    endpoint: "/api/monetize/promote",
    buildBody: (tier, inp) => ({ listing_id: inp.listing_id, duration: tier.key }),
  },
  {
    id: "cashout",
    icon: Zap,
    color: "#FFB800",
    title: "Sofort-Auszahlung",
    desc: "Guthaben direkt aufs Bankkonto (sonst 3–5 Werktage)",
    tiers: [{ key: "instant", label: "Sofort (€0.99 Gebühr)", price: 0.99 }],
    hint: "Schneller auszahlen lassen als normale Payouts.",
    inputs: [{ name: "amount", label: "Betrag €", type: "number", placeholder: "25" }],
    endpoint: "/api/monetize/instant-cashout",
    buildBody: (tier, inp) => ({ amount: parseFloat(inp.amount || 0) }),
  },
  {
    id: "job_boost",
    icon: TrendingUp,
    color: "#00D26A",
    title: "Job-Anzeige boosten",
    desc: "Deine Job-Anzeige bekommt mehr Bewerber",
    tiers: [
      { key: "standard", label: "Standard Boost",    price: 0.99 },
      { key: "premium",  label: "Premium Boost",     price: 2.49 },
      { key: "ultra",    label: "Ultra Boost",       price: 4.99 },
    ],
    hint: "Für Job-Anzeigen — Job-ID eingeben.",
    inputs: [{ name: "job_id", label: "Job-ID", placeholder: "job_XXXXXX" }],
    endpoint: "/api/monetize/boost-job",
    buildBody: (tier, inp) => ({ job_id: inp.job_id, tier: tier.key }),
  },
  {
    id: "ads",
    icon: Megaphone,
    color: "#A855F7",
    title: "Werbung schalten",
    desc: "Deine Werbung auf der HomePage aller User",
    tiers: [
      { key: "daily",   label: "1 Tag",   price: 5.0 },
      { key: "weekly",  label: "7 Tage",  price: 29.0 },
      { key: "monthly", label: "30 Tage", price: 99.0 },
    ],
    hint: "Link + Bild + kurzer Werbetext.",
    inputs: [
      { name: "title", label: "Titel", placeholder: "z.B. 50% auf Pizza" },
      { name: "description", label: "Kurztext", placeholder: "Nur heute bei Pizza Max!" },
      { name: "target_url", label: "Link (URL)", placeholder: "https://..." },
      { name: "image_url", label: "Bild-URL (optional)", placeholder: "https://..." },
    ],
    endpoint: "/api/pro/ads/create",
    buildBody: (tier, inp) => ({
      duration: tier.key,
      title: inp.title,
      description: inp.description,
      target_url: inp.target_url,
      image_url: inp.image_url || null,
    }),
  },
  {
    id: "kyc_express",
    icon: Shield,
    color: "#00C2FF",
    title: "KYC Express",
    desc: "Verifizierung in unter 1 Stunde statt 1–3 Tage",
    tiers: [{ key: "express", label: "Express-Prüfung", price: 4.99 }],
    hint: "Upload der Dokumente wie gewohnt — wird bevorzugt bearbeitet.",
    inputs: [
      { name: "id_document", label: "Ausweis-Bild-URL", placeholder: "https://..." },
      { name: "selfie", label: "Selfie-URL", placeholder: "https://..." },
    ],
    endpoint: "/api/pro/kyc/submit",
    buildBody: (tier, inp) => ({
      id_document: inp.id_document,
      selfie: inp.selfie,
      express: true,
    }),
  },
];

// ═══ Revenue Card ═══

const RevenueCard = () => {
  const [rev, setRev] = useState(null);
  useEffect(() => {
    api("/api/monetize/revenue").then(setRev).catch(() => {});
  }, []);
  if (!rev) return null;
  return (
    <motion.div
      className="rounded-2xl p-4 mb-4"
      style={{ background: "linear-gradient(135deg,rgba(255,184,0,0.15),rgba(255,107,53,0.08))", border: "1px solid rgba(255,184,0,0.3)" }}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      data-testid="revenue-card"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#FFB800]/20 flex items-center justify-center">
          <TrendingUp size={18} className="text-[#FFB800]"/>
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-white/60 uppercase tracking-wider">Dein bisheriger Umsatz</p>
          <p className="text-[22px] font-black text-white tabular-nums font-outfit leading-none mt-0.5">
            €{(rev.total_revenue || 0).toFixed(2)}
          </p>
          <p className="text-[10px] text-white/50 mt-0.5">
            {rev.total_transactions || 0} Boosts · {rev.active_ads || 0} aktive Ads
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// ═══ Feature Card ═══

const FeatureCard = ({ feat, onOpen }) => (
  <motion.button
    data-testid={`feat-${feat.id}`}
    onClick={() => onOpen(feat)}
    whileTap={{ scale: 0.98 }}
    className="w-full rounded-2xl p-4 text-left"
    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
  >
    <div className="flex items-start gap-3">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${feat.color}20`, border: `1px solid ${feat.color}40` }}>
        <feat.icon size={20} style={{ color: feat.color }}/>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-white">{feat.title}</p>
        <p className="text-[11px] text-white/60 mt-0.5">{feat.desc}</p>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {feat.tiers.map(t => (
            <span key={t.key}
              className="px-2 py-0.5 rounded-md text-[10px] font-bold"
              style={{ background: `${feat.color}15`, color: feat.color, border: `1px solid ${feat.color}30` }}>
              €{t.price} · {t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  </motion.button>
);

// ═══ Feature Modal ═══

const FeatureModal = ({ feat, onClose, onSuccess }) => {
  const [tier, setTier] = useState(feat.tiers[0]);
  const [inp, setInp] = useState(Object.fromEntries(feat.inputs.map(i => [i.name, ""])));
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    // Validate required
    for (const i of feat.inputs) {
      if (i.type !== "number" && !inp[i.name] && i.name !== "image_url") {
        return toast.error(`${i.label} fehlt`);
      }
    }
    setBusy(true);
    try {
      const j = await api(feat.endpoint, { method: "POST", body: JSON.stringify(feat.buildBody(tier, inp)) });
      toast.success(j.message || "Erfolgreich gebucht! 🎉");
      onSuccess && onSuccess();
      onClose();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      data-testid="feat-modal"
    >
      <div onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm"/>
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30 }}
        className="relative w-full bg-[#0a0c14] rounded-t-3xl border-t border-white/10 max-h-[85vh] overflow-y-auto"
      >
        <div className="p-5 pb-[max(env(safe-area-inset-bottom,20px),20px)]">
          <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-4"/>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: `${feat.color}20`, border: `1px solid ${feat.color}40` }}>
              <feat.icon size={22} style={{ color: feat.color }}/>
            </div>
            <div>
              <p className="text-[15px] font-bold text-white">{feat.title}</p>
              <p className="text-[11px] text-white/60">{feat.desc}</p>
            </div>
          </div>

          {feat.hint && (
            <p className="text-[11px] text-white/50 mb-3 p-2.5 bg-white/3 rounded-lg border border-white/5">
              💡 {feat.hint}
            </p>
          )}

          {/* Tier selection */}
          {feat.tiers.length > 1 && (
            <div className="mb-3">
              <p className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Paket wählen</p>
              <div className="space-y-1.5">
                {feat.tiers.map(t => (
                  <button key={t.key} onClick={() => setTier(t)} data-testid={`tier-${t.key}`}
                    className="w-full p-3 rounded-xl flex items-center justify-between transition-all"
                    style={{
                      background: tier.key === t.key ? `${feat.color}15` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${tier.key === t.key ? feat.color : "rgba(255,255,255,0.06)"}`,
                    }}>
                    <span className="text-[13px] font-bold text-white">{t.label}</span>
                    <span className="text-[15px] font-black tabular-nums" style={{ color: feat.color }}>€{t.price}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Inputs */}
          {feat.inputs.length > 0 && (
            <div className="space-y-2 mb-4">
              {feat.inputs.map(i => (
                <div key={i.name}>
                  <label className="text-[10px] text-white/50 uppercase tracking-wider">{i.label}</label>
                  <input
                    type={i.type || "text"}
                    placeholder={i.placeholder}
                    value={inp[i.name]}
                    onChange={e => setInp({ ...inp, [i.name]: e.target.value })}
                    data-testid={`inp-${i.name}`}
                    className="w-full mt-1 px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-[13px] text-white placeholder-white/30 focus:outline-none focus:border-[#A855F7]"/>
                </div>
              ))}
            </div>
          )}

          <motion.button
            onClick={submit}
            disabled={busy}
            whileTap={{ scale: 0.97 }}
            className="w-full py-4 rounded-2xl font-black text-[14px] text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: `linear-gradient(135deg, ${feat.color}, ${feat.color}dd)` }}
            data-testid="feat-submit"
          >
            {busy ? <Loader2 size={16} className="animate-spin"/> :
             <><CheckCircle size={15}/>Jetzt für €{tier.price.toFixed(2)} buchen</>}
          </motion.button>

          <button onClick={onClose} className="w-full mt-2 py-3 text-[12px] text-white/50">
            Abbrechen
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ═══ Main ═══

export default function MarketingHubPage({ onBack }) {
  const [active, setActive] = useState(null);

  return (
    <div className="min-h-screen bg-[#060810] pb-24" data-testid="marketing-hub">
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#060810]/90 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3 pt-[max(env(safe-area-inset-top,0px),14px)]">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="marketing-back">
            <ArrowLeft size={16} className="text-white/70"/>
          </button>
          <div>
            <h1 className="text-[14px] font-bold text-white">Marketing & Boost</h1>
            <p className="text-[10px] text-white/40 leading-tight">Mehr Reichweite für deine Anzeigen & Jobs</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <RevenueCard/>

        <div>
          <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Verfügbare Features</p>
          <div className="space-y-2">
            {FEATURES.map(f => <FeatureCard key={f.id} feat={f} onOpen={setActive}/>)}
          </div>
        </div>

        <p className="text-[10px] text-white/30 text-center mt-4">
          Alle Kosten werden direkt vom EUR-Wallet abgezogen
        </p>
      </div>

      <AnimatePresence>
        {active && <FeatureModal feat={active} onClose={() => setActive(null)}/>}
      </AnimatePresence>
    </div>
  );
}
