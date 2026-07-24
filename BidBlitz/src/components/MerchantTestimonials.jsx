import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star, Quote, MapPin, TrendingUp } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const IND_COLORS = {
  gastro: "#FF6B6B", retail: "#00E89D", service: "#A855F7",
  fitness: "#FFB800", fuel: "#00C2FF", bakery: "#EC4899",
};

const IND_LABELS = {
  gastro: "Gastronomie", retail: "Einzelhandel", service: "Dienstleistung",
  fitness: "Fitness", fuel: "Tankstelle", bakery: "Bäckerei",
};

export default function MerchantTestimonials() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/testimonials?limit=6`)
      .then(r => r.json())
      .then(d => { if (alive) setItems(d.testimonials || []); })
      .catch(() => { /* noop */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block w-5 h-5 rounded-full border-2 border-white/10 border-t-[#00E89D] animate-spin" />
      </div>
    );
  }
  if (items.length === 0) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="text-center mb-8">
        <p className="text-[9px] text-[#00E89D]/50 uppercase tracking-[0.3em] font-bold mb-2">PILOTKUNDEN</p>
        <h2 className="text-2xl sm:text-3xl font-black text-white/90 mb-3">Das sagen Händler über uns</h2>
        <p className="text-[12px] text-white/40 max-w-xl mx-auto">
          Teilnehmer unseres Pilotprogramms berichten. Sei als nächstes dabei.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4" data-testid="testimonials-grid">
        {items.map((tm, i) => {
          const color = IND_COLORS[tm.industry] || "#00E89D";
          return (
            <motion.div key={tm.testimonial_id}
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="relative rounded-3xl p-5 sm:p-6"
              style={{ background: `linear-gradient(135deg, ${color}08 0%, rgba(8,12,20,0.6) 100%)`, border: `1px solid ${color}20` }}
              data-testid={`testimonial-${tm.industry}-${i}`}>
              <Quote size={28} style={{ color, opacity: 0.15 }} className="absolute top-4 right-4" />

              <div className="flex items-start gap-3 mb-4">
                {tm.photo_url ? (
                  <img src={tm.photo_url} alt={tm.business_name}
                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                    style={{ border: `1px solid ${color}30` }}
                    onError={e => { e.target.style.display = "none"; }} />
                ) : (
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-base shrink-0"
                    style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}>
                    {(tm.business_name || "?").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-white/90 truncate">{tm.business_name}</p>
                  <p className="text-[11px] text-white/45 mt-0.5">
                    {tm.owner_name}{tm.role && ` · ${tm.role}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                      style={{ background: `${color}15`, color }}>
                      {IND_LABELS[tm.industry] || tm.industry}
                    </span>
                    {tm.location && (
                      <span className="flex items-center gap-0.5 text-[9px] text-white/35 truncate max-w-[120px]">
                        <MapPin size={9} className="shrink-0" /> {tm.location}
                      </span>
                    )}
                    {tm.is_pilot && (
                      <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-white/40">
                        Pilot
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-[13px] text-white/75 leading-relaxed mb-4">"{tm.quote}"</p>

              <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star key={idx} size={11}
                      className={idx < (tm.rating || 5) ? "fill-yellow-400 text-yellow-400" : "text-white/10"} />
                  ))}
                </div>
                {tm.stats && Object.keys(tm.stats).length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] font-bold" style={{ color }}>
                    <TrendingUp size={10} />
                    {Object.entries(tm.stats).slice(0, 1).map(([k, v]) =>
                      <span key={k}>{v}{k.includes("pct") || k.includes("reduction") ? "%" : ""} {k.replace(/_/g, " ").replace(/\bpct\b/, "").trim()}</span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
