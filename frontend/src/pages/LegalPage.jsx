/**
 * LegalPage — Generic renderer for AGB, Datenschutz, Impressum, Sicherheit.
 * Backend: /api/legal/{slug}
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, FileText, Shield, Building2, Lock, Loader2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const SLUG_META = {
  agb:          { label: "AGB",           icon: FileText,  color: "#00C2FF" },
  datenschutz:  { label: "Datenschutz",   icon: Shield,    color: "#00E89D" },
  impressum:    { label: "Impressum",     icon: Building2, color: "#A855F7" },
  sicherheit:   { label: "Sicherheit",    icon: Lock,      color: "#FFD700" },
};

const LegalPage = ({ slug = "agb", onBack, onNavigate }) => {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const meta = SLUG_META[slug] || SLUG_META.agb;
  const Icon = meta.icon;
  const isImpressum = slug === "impressum";

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/legal/${slug}`)
      .then((r) => r.json())
      .then((d) => setDoc(d))
      .catch(() => setDoc({ title: meta.label, content: [{ heading: "Fehler", text: "Inhalte konnten nicht geladen werden." }] }))
      .finally(() => setLoading(false));
  }, [slug, meta.label]);

  return (
    <motion.div
      data-testid={`legal-page-${slug}`}
      className="min-h-[100dvh] pb-16"
      style={{ background: "#050505", color: "white" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 sticky top-0 z-20 backdrop-blur-xl"
        style={{ background: "rgba(5,5,5,0.85)" }}
      >
        <motion.button
          data-testid="legal-back"
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
        >
          <ChevronLeft size={18} />
        </motion.button>
        <div className="flex-1">
          <p className="text-[11px] text-white/50 uppercase tracking-[0.2em] font-bold">Legal</p>
          <p className="text-[16px] font-bold">{doc?.title || meta.label}</p>
        </div>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}
        >
          <Icon size={16} style={{ color: meta.color }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 mt-2 mb-4 flex gap-2 overflow-x-auto">
        {Object.entries(SLUG_META).map(([s, m]) => (
          <motion.button
            key={s}
            data-testid={`legal-tab-${s}`}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate?.(`/legal/${s}`)}
            className="rounded-full px-4 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 flex-shrink-0"
            style={{
              background: slug === s ? `${m.color}15` : "rgba(255,255,255,0.03)",
              border: `1px solid ${slug === s ? m.color : "rgba(255,255,255,0.05)"}`,
              color: slug === s ? m.color : "rgba(255,255,255,0.55)",
            }}
          >
            <m.icon size={12} /> {m.label}
          </motion.button>
        ))}
      </div>

      <div className="px-5">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={22} className="animate-spin text-white/40" />
          </div>
        )}
        {!loading && doc?.content?.map((section, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="rounded-2xl p-4 mb-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <p className="text-[13px] font-bold mb-2" style={{ color: meta.color }}>
              {section.heading}
            </p>
            <p className="text-[12px] text-white/75 leading-relaxed whitespace-pre-line">
              {section.text}
            </p>
          </motion.div>
        ))}
        {!loading && doc?.last_updated && (
          <p className="text-center text-[10px] text-white/40 mt-4">
            Stand: {doc.last_updated}
          </p>
        )}
        {!loading && isImpressum && (
          <motion.div
            data-testid="legal-impressum-footer-card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="rounded-2xl p-4 mt-4"
            style={{
              background: "linear-gradient(180deg, rgba(168,85,247,0.10) 0%, rgba(255,255,255,0.03) 100%)",
              border: "1px solid rgba(168,85,247,0.22)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div data-testid="legal-impressum-footer-operator">
                <p className="text-[10px] text-white/45 uppercase tracking-[0.18em] font-bold mb-1">Betreiber</p>
                <p className="text-[13px] font-bold text-white">Afrim Krasniqi</p>
                <p className="text-[11px] text-white/65 mt-1">BidBlitz LLC · Dubai · UAE</p>
              </div>
              <div data-testid="legal-impressum-footer-response" className="text-right">
                <p className="text-[10px] text-white/45 uppercase tracking-[0.18em] font-bold mb-1">Antwortzeit</p>
                <p className="text-[13px] font-bold" style={{ color: meta.color }}>innerhalb 24h</p>
                <p className="text-[11px] text-white/60 mt-1">Support & Rechtliches</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
              {[
                { id: "support", label: "Support", value: "support@bidblitz.ae" },
                { id: "privacy", label: "Datenschutz", value: "datenschutz@bidblitz.ae" },
                { id: "security", label: "Sicherheit", value: "security@bidblitz.ae" },
              ].map((item) => (
                <div
                  key={item.id}
                  data-testid={`legal-impressum-footer-${item.id}`}
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <p className="text-[10px] text-white/45 uppercase tracking-[0.14em] font-bold">{item.label}</p>
                  <p className="text-[11px] text-white/82 mt-1 break-all">{item.value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default LegalPage;
