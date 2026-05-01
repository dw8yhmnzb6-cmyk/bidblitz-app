import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Zap, ExternalLink, TrendingUp, Store, UtensilsCrossed,
  Scissors, Dumbbell, Fuel, Coffee, ShoppingBag, Search, Crown, Sparkles,
  MapPin, Loader2,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const IND = {
  gastro: { label: "Gastronomie", icon: UtensilsCrossed, color: "#FF6B6B" },
  retail: { label: "Einzelhandel", icon: ShoppingBag, color: "#00E89D" },
  service: { label: "Dienstleistung", icon: Scissors, color: "#A855F7" },
  fitness: { label: "Fitness", icon: Dumbbell, color: "#FFB800" },
  fuel: { label: "Tankstelle", icon: Fuel, color: "#00C2FF" },
  bakery: { label: "Bäckerei", icon: Coffee, color: "#EC4899" },
};

export default function PayDirectoryPage({ onBack, onNavigate }) {
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`${API}/api/pay/directory`)
      .then(r => r.json())
      .then(d => { if (alive) setMerchants(d.merchants || []); })
      .catch(() => { /* noop */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    let list = merchants;
    if (filter !== "all") list = list.filter(m => m.industry === filter);
    if (q.trim()) {
      const qq = q.toLowerCase();
      list = list.filter(m =>
        (m.business_name || "").toLowerCase().includes(qq) ||
        (m.city || "").toLowerCase().includes(qq) ||
        (m.description || "").toLowerCase().includes(qq)
      );
    }
    return list;
  }, [merchants, filter, q]);

  const featured = filtered.filter(m => m.featured);
  const regular = filtered.filter(m => !m.featured);
  const totalPaid = merchants.reduce((s, m) => s + (m.total_paid || 0), 0);
  const totalSessions = merchants.reduce((s, m) => s + (m.total_sessions || 0), 0);

  return (
    <div className="min-h-screen pb-24" style={{ background: "#020408" }} data-testid="pay-directory">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: "rgba(2,4,8,0.85)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            {onBack && (
              <motion.button onClick={onBack} whileTap={{ scale: 0.9 }}
                className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center"
                data-testid="dir-back">
                <ArrowLeft size={15} className="text-white/40" />
              </motion.button>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00E0FF] to-[#00E89D] flex items-center justify-center shrink-0">
                  <Zap size={12} className="text-[#020408]" />
                </div>
                <h1 className="text-[16px] font-black text-white/95 truncate">Pay by BidBlitz — Marketplace</h1>
              </div>
              <p className="text-[10px] text-white/35 mt-0.5">
                {merchants.length} Händler akzeptieren BidBlitz Pay · €{totalPaid.toFixed(2)} verarbeitet · {totalSessions} Zahlungen
              </p>
            </div>
          </div>

          {/* Search + Filter */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Händler, Stadt, Beschreibung..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[12px] text-white/85 placeholder-white/25 outline-none"
                data-testid="dir-search" />
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={`Alle (${merchants.length})`} testId="dir-filter-all" />
            {Object.entries(IND).map(([id, cfg]) => {
              const count = merchants.filter(m => m.industry === id).length;
              if (!count) return null;
              return (
                <FilterChip key={id} active={filter === id} onClick={() => setFilter(id)}
                  label={`${cfg.label} (${count})`} color={cfg.color} icon={cfg.icon}
                  testId={`dir-filter-${id}`} />
              );
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-[#00E89D]" />
          </div>
        ) : merchants.length === 0 ? (
          <EmptyState onRegister={onNavigate ? () => onNavigate("/merchant-landing") : null} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Search size={36} className="mx-auto text-[#333] mb-3" />
            <p className="text-sm text-white/40">Keine Treffer für deine Suche</p>
          </div>
        ) : (
          <>
            {featured.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Crown size={14} className="text-[#FFB800]" />
                  <h2 className="text-[11px] uppercase tracking-[0.15em] font-bold text-[#FFB800]">Top Händler</h2>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {featured.map((m, i) => <MerchantCard key={m.email} m={m} idx={i} featured />)}
                </div>
              </section>
            )}
            <section>
              {featured.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <Store size={14} className="text-white/40" />
                  <h2 className="text-[11px] uppercase tracking-[0.15em] font-bold text-white/50">Alle Händler</h2>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                {regular.map((m, i) => <MerchantCard key={m.email} m={m} idx={i} />)}
              </div>
            </section>

            {/* CTA footer */}
            <div className="mt-12 rounded-3xl p-6 text-center"
              style={{ background: "linear-gradient(135deg, rgba(0,232,157,0.04), rgba(0,194,255,0.04))", border: "1px solid rgba(0,232,157,0.15)" }}>
              <Sparkles size={22} className="mx-auto mb-2 text-[#00E89D]" />
              <h3 className="text-lg font-black text-white/90 mb-1">Du willst auch hier erscheinen?</h3>
              <p className="text-[12px] text-white/45 mb-4">Integriere BidBlitz Pay in deine Website — 3 Zeilen Code.</p>
              {onNavigate && (
                <motion.button onClick={() => onNavigate("/merchant-landing")} whileTap={{ scale: 0.97 }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00E0FF] to-[#00E89D] text-[#020408] font-black text-[12px] inline-flex items-center gap-1.5"
                  data-testid="dir-register-cta">
                  Händler werden <ArrowLeft size={12} className="rotate-180" />
                </motion.button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const FilterChip = ({ active, onClick, label, color = "#00C2FF", icon: Icon, testId }) => (
  <motion.button onClick={onClick} whileTap={{ scale: 0.96 }} data-testid={testId}
    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap shrink-0"
    style={{
      background: active ? `${color}15` : "rgba(255,255,255,0.02)",
      border: `1px solid ${active ? `${color}35` : "rgba(255,255,255,0.04)"}`,
      color: active ? color : "rgba(255,255,255,0.4)",
    }}>
    {Icon && <Icon size={10} />} {label}
  </motion.button>
);

const MerchantCard = ({ m, idx, featured }) => {
  const ind = IND[m.industry] || IND.retail;
  const Icon = ind.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ delay: idx * 0.03, duration: 0.3 }}
      className="rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: featured
          ? `linear-gradient(135deg, ${ind.color}06, rgba(8,12,20,0.95))`
          : "rgba(255,255,255,0.018)",
        border: `1px solid ${featured ? `${ind.color}30` : "rgba(255,255,255,0.04)"}`,
      }}
      data-testid={`dir-merchant-${m.email.split('@')[0]}`}>
      {featured && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,184,0,0.15)" }}>
          <Crown size={8} className="text-[#FFB800]" />
          <span className="text-[8px] font-bold text-[#FFB800] uppercase tracking-wider">Top</span>
        </div>
      )}
      <div className="flex items-start gap-3 mb-3">
        {m.logo_url ? (
          <img src={m.logo_url} alt={m.business_name} className="w-11 h-11 rounded-xl object-cover shrink-0"
            style={{ border: `1px solid ${ind.color}30` }} onError={e => { e.target.style.display = "none"; }} />
        ) : (
          <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
            style={{ background: `${ind.color}15`, border: `1px solid ${ind.color}25`, color: ind.color }}>
            {(m.business_name || "?").slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-white/90 truncate">{m.business_name}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: `${ind.color}15`, color: ind.color }}>
              <Icon size={8} /> {ind.label}
            </span>
            {m.city && (
              <span className="inline-flex items-center gap-0.5 text-[9px] text-white/35">
                <MapPin size={8} /> {m.city}
              </span>
            )}
          </div>
        </div>
      </div>
      {m.description && <p className="text-[11px] text-white/55 mb-3 line-clamp-2">{m.description}</p>}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-3 text-[9px] text-white/35">
          <span className="flex items-center gap-0.5"><TrendingUp size={8} style={{ color: ind.color }} /> {m.total_sessions} Tx</span>
          <span style={{ color: ind.color, fontWeight: 700 }}>€{m.total_paid.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</span>
        </div>
        {m.shop_url ? (
          <a href={m.shop_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold"
            style={{ background: `${ind.color}15`, color: ind.color, border: `1px solid ${ind.color}30` }}
            data-testid={`dir-visit-${m.email.split('@')[0]}`}>
            Shop <ExternalLink size={9} />
          </a>
        ) : (
          <span className="text-[9px] text-white/25">Seit {m.since}</span>
        )}
      </div>
    </motion.div>
  );
};

const EmptyState = ({ onRegister }) => (
  <div className="text-center py-24">
    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#00E0FF]/10 to-[#00E89D]/10 flex items-center justify-center">
      <Zap size={32} className="text-[#00E89D]/60" />
    </div>
    <h3 className="text-lg font-black text-white/80 mb-2">Noch keine Händler</h3>
    <p className="text-[12px] text-white/40 max-w-md mx-auto mb-5">
      Der Marketplace füllt sich, sobald die ersten Händler BidBlitz Pay integriert haben und Transaktionen laufen.
    </p>
    {onRegister && (
      <motion.button onClick={onRegister} whileTap={{ scale: 0.97 }}
        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00E0FF] to-[#00E89D] text-[#020408] font-black text-[12px] inline-flex items-center gap-1.5"
        data-testid="empty-register-cta">
        Erster Händler werden
      </motion.button>
    )}
  </div>
);
