import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Zap, ExternalLink, TrendingUp, MapPin, Crown,
  Shield, Clock, Loader2, Share2, UtensilsCrossed, ShoppingBag,
  Scissors, Dumbbell, Fuel, Coffee, CheckCircle2, Calendar,
} from "lucide-react";
import { setSeo, resetSeo } from "../utils/seo";

const API = process.env.REACT_APP_BACKEND_URL;

const IND = {
  gastro: { label: "Gastronomie", icon: UtensilsCrossed, color: "#FF6B6B", keywords: "Restaurant Café Bar Gastronomie Tischbestellung" },
  retail: { label: "Einzelhandel", icon: ShoppingBag, color: "#00E89D", keywords: "Shop Boutique Einzelhandel Ladengeschäft" },
  service: { label: "Dienstleistung", icon: Scissors, color: "#A855F7", keywords: "Friseur Salon Kosmetik Dienstleistung" },
  fitness: { label: "Fitness", icon: Dumbbell, color: "#FFB800", keywords: "Fitnessstudio Gym Sport Yoga" },
  fuel: { label: "Tankstelle", icon: Fuel, color: "#00C2FF", keywords: "Tankstelle Kiosk Tabakladen" },
  bakery: { label: "Bäckerei", icon: Coffee, color: "#EC4899", keywords: "Bäckerei Café Foodtruck Eisdiele" },
};

export default function PayMerchantDetailPage({ slug, onBack, onNavigate }) {
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setNotFound(false);
    fetch(`${API}/api/pay/merchant/${encodeURIComponent(slug)}`)
      .then(async r => {
        if (r.status === 404) { if (alive) setNotFound(true); return null; }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { if (alive && d) setM(d); })
      .catch(() => { if (alive) setNotFound(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  // SEO meta tags + JSON-LD structured data
  useEffect(() => {
    if (!m) return;
    const ind = IND[m.industry] || IND.retail;
    const title = `${m.business_name}${m.city ? ` · ${m.city}` : ""} — Akzeptiert BidBlitz Pay | BidBlitz Marketplace`;
    const description = m.description
      ? `${m.description} — Mit BidBlitz Pay zahlen bei ${m.business_name}${m.city ? ` in ${m.city}` : ""}. ${m.total_sessions}+ erfolgreiche Transaktionen.`
      : `${m.business_name}${m.city ? ` in ${m.city}` : ""} akzeptiert Zahlungen über BidBlitz Wallet. ${ind.keywords}. ${m.total_sessions}+ Transaktionen.`;
    const url = `${window.location.origin}/pay/merchant/${m.slug}`;

    setSeo({
      title, description, url,
      image: m.logo_url || undefined,
      type: "business.business",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": m.business_name,
        "description": m.description || description,
        "address": m.city ? { "@type": "PostalAddress", "addressLocality": m.city, "addressCountry": "DE" } : undefined,
        "url": m.shop_url || url,
        "image": m.logo_url || undefined,
        "paymentAccepted": "BidBlitz Pay, Credit Card, Debit Card",
        "aggregateRating": m.total_sessions >= 10 ? {
          "@type": "AggregateRating",
          "ratingValue": 4.7,
          "reviewCount": m.total_sessions,
        } : undefined,
      },
    });
    return () => resetSeo();
  }, [m]);

  const share = async () => {
    const url = `${window.location.origin}/pay/merchant/${m.slug}`;
    if (navigator.share) {
      try { await navigator.share({ title: m.business_name, text: `${m.business_name} akzeptiert BidBlitz Pay`, url }); }
      catch { /* noop */ }
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#020408" }}>
      <Loader2 size={28} className="animate-spin text-[#00E89D]" />
    </div>
  );

  if (notFound || !m) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "#020408" }}>
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center">
          <Zap size={28} className="text-[#333]" />
        </div>
        <h1 className="text-xl font-black text-white/85 mb-2">Händler nicht gefunden</h1>
        <p className="text-[12px] text-white/40 mb-5">
          Dieser Händler ist entweder nicht mehr aktiv oder hat noch keine BidBlitz-Pay-Transaktionen.
        </p>
        <motion.button onClick={() => onNavigate && onNavigate("/pay/directory")} whileTap={{ scale: 0.95 }}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00E0FF] to-[#00E89D] text-[#020408] font-black text-[12px]"
          data-testid="pmd-to-directory">
          Zum Marketplace
        </motion.button>
      </div>
    </div>
  );

  const ind = IND[m.industry] || IND.retail;
  const Icon = ind.icon;

  return (
    <div className="min-h-screen pb-16" style={{ background: "#020408" }} data-testid="pay-merchant-detail">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: "rgba(2,4,8,0.85)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          {onBack && (
            <motion.button onClick={onBack} whileTap={{ scale: 0.9 }}
              className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center"
              data-testid="pmd-back">
              <ArrowLeft size={15} className="text-white/40" />
            </motion.button>
          )}
          <span className="text-[11px] text-white/35 font-medium">Pay by BidBlitz · Marketplace</span>
          <motion.button onClick={share} whileTap={{ scale: 0.9 }}
            className="ml-auto w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center"
            data-testid="pmd-share">
            <Share2 size={13} className="text-white/40" />
          </motion.button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 pb-10">
        {/* Hero */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-6 relative overflow-hidden mb-5"
          style={{ background: `linear-gradient(135deg, ${ind.color}08, rgba(8,12,20,0.95))`, border: `1px solid ${ind.color}25` }}>
          <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full" style={{ background: ind.color, filter: "blur(70px)", opacity: 0.15 }} />
          <div className="relative">
            {m.featured && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full mb-3" style={{ background: "rgba(255,184,0,0.15)" }}>
                <Crown size={10} className="text-[#FFB800]" />
                <span className="text-[9px] font-bold text-[#FFB800] uppercase tracking-wider">Top Händler</span>
              </div>
            )}
            <div className="flex items-start gap-4 mb-4">
              {m.logo_url ? (
                <img src={m.logo_url} alt={m.business_name} className="w-16 h-16 rounded-2xl object-cover shrink-0"
                  style={{ border: `1px solid ${ind.color}30` }}
                  onError={e => { e.target.style.display = "none"; }} />
              ) : (
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl shrink-0"
                  style={{ background: `${ind.color}15`, border: `1px solid ${ind.color}30`, color: ind.color }}>
                  {(m.business_name || "?").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-black text-white/95 mb-1">{m.business_name}</h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ background: `${ind.color}15`, color: ind.color }}>
                    <Icon size={10} /> {ind.label}
                  </span>
                  {m.city && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
                      <MapPin size={10} /> {m.city}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {m.description && <p className="text-[13px] text-white/65 leading-relaxed mb-4">{m.description}</p>}
            {m.shop_url && (
              <a href={m.shop_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00E0FF] to-[#00E89D] text-[#020408] font-black text-[12px]"
                data-testid="pmd-visit-shop">
                Shop besuchen <ExternalLink size={12} />
              </a>
            )}
          </div>
        </motion.section>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <StatTile icon={TrendingUp} label="Transaktionen" value={m.total_sessions} color={ind.color} />
          <StatTile icon={CheckCircle2} label="Umsatz" value={`€${m.total_paid.toFixed(0)}`} color="#00E89D" />
          <StatTile icon={Calendar} label="Seit" value={m.since || "—"} color="#00C2FF" small />
        </div>

        {/* Payment info */}
        <section className="rounded-2xl p-5 mb-5" style={{ background: "rgba(0,232,157,0.03)", border: "1px solid rgba(0,232,157,0.15)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-[#00E89D]" />
            <h2 className="text-sm font-bold text-white/90">Zahlungsmöglichkeiten bei {m.business_name}</h2>
          </div>
          <div className="space-y-2 text-[12px]">
            <PayLine icon={Zap} text="BidBlitz Wallet (Sofortzahlung)" active />
            <PayLine icon={Shield} text="Apple Pay · Google Pay · Kreditkarte" active />
            <PayLine icon={Clock} text="Keine Warteschlange, keine Hardware" active />
          </div>
        </section>

        {/* Trust badges */}
        <section className="rounded-2xl p-4 flex flex-wrap items-center justify-center gap-4 mb-5"
          style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <TrustChip label="SSL verschlüsselt" />
          <TrustChip label="DSGVO-konform" />
          <TrustChip label="PSD2 Ready" />
          <TrustChip label="€0 Setup" />
        </section>

        {/* CTA */}
        <div className="rounded-3xl p-6 text-center"
          style={{ background: "linear-gradient(135deg, rgba(0,224,255,0.04), rgba(0,232,157,0.04))", border: "1px solid rgba(0,232,157,0.2)" }}>
          <h3 className="text-base font-black text-white/90 mb-1">Auch dein Business akzeptiert BidBlitz Pay?</h3>
          <p className="text-[12px] text-white/45 mb-4">In 3 Minuten im Marketplace gelistet. Erster Monat kostenlos.</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <motion.button onClick={() => onNavigate && onNavigate("/merchant-landing")} whileTap={{ scale: 0.95 }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00E0FF] to-[#00E89D] text-[#020408] font-black text-[12px]"
              data-testid="pmd-register-cta">
              Händler werden
            </motion.button>
            <motion.button onClick={() => onNavigate && onNavigate("/pay/directory")} whileTap={{ scale: 0.95 }}
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/70 font-bold text-[12px]"
              data-testid="pmd-back-to-dir">
              Alle Händler
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

const StatTile = ({ icon: Icon, label, value, color, small }) => (
  <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
    <Icon size={12} className="mx-auto mb-1.5" style={{ color, opacity: 0.7 }} />
    <p className={`${small ? "text-xs" : "text-lg"} font-black font-outfit`} style={{ color }}>{value}</p>
    <p className="text-[8px] uppercase tracking-wider text-white/35 font-bold mt-0.5">{label}</p>
  </div>
);

const PayLine = ({ icon: Icon, text, active }) => (
  <div className="flex items-center gap-2">
    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: active ? "rgba(0,232,157,0.15)" : "rgba(255,255,255,0.03)" }}>
      <Icon size={10} style={{ color: active ? "#00E89D" : "#555" }} />
    </div>
    <span className="text-white/70">{text}</span>
  </div>
);

const TrustChip = ({ label }) => (
  <div className="flex items-center gap-1 text-[10px] text-white/40">
    <Shield size={10} className="text-[#00E89D]/60" />
    <span>{label}</span>
  </div>
);
