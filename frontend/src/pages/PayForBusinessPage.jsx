import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Zap, Shield, Check, ArrowRight, Code, Smartphone, Globe,
  Loader2, X, Mail, Building2, Link as LinkIcon, FileText, ChevronRight
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const Section = ({ children, className = "" }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <motion.section ref={ref} className={className}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}>
      {children}
    </motion.section>
  );
};

const PayForBusinessPage = ({ onNavigate }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ business_name: "", email: "", website: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.business_name || !form.email) {
      setError("Bitte Business-Name und E-Mail ausfüllen");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/pay/merchant/apply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Anfrage fehlgeschlagen");
      setSuccess(true);
      setForm({ business_name: "", email: "", website: "", description: "" });
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen" style={{ background: "#020408" }}>
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl" style={{ background: "rgba(2,4,8,0.85)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #00E0FF, #00E89D)" }}>
              <Zap size={20} className="text-[#020408]" />
            </div>
            <span className="text-lg font-black text-white/90">BidBlitz Pay</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate("/pay/directory")} className="text-[13px] text-white/50 hover:text-white/90 font-medium">
              Marketplace
            </button>
            <button onClick={() => onNavigate("/")} className="px-4 py-2 rounded-xl text-[13px] font-bold text-white/70 bg-white/[0.04] border border-white/[0.06]">
              Zur App
            </button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <Section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold mb-6"
              style={{ background: "rgba(0,232,157,0.1)", border: "1px solid rgba(0,232,157,0.2)", color: "#00E89D" }}>
              <Zap size={12} /> Für Unternehmen
            </span>
          </motion.div>
          <motion.h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white/95 mb-6 leading-tight"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            Akzeptiere Zahlungen<br />in <span style={{ background: "linear-gradient(135deg, #00E0FF, #00E89D)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>3 Minuten</span>
          </motion.h1>
          <motion.p className="text-lg sm:text-xl text-white/50 mb-10 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            Integriere BidBlitz Pay auf deiner Website. Ein einziges Embed-Script für Wallet, Kreditkarte, Apple Pay & Google Pay.
          </motion.p>
          <motion.div className="flex gap-4 justify-center flex-wrap"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <motion.button onClick={() => setShowForm(true)} whileTap={{ scale: 0.97 }}
              className="px-8 py-4 rounded-2xl font-bold text-base flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, #00E0FF, #00E89D)", color: "#020408" }}>
              Jetzt beantragen <ArrowRight size={18} />
            </motion.button>
            <motion.button onClick={() => document.getElementById('demo').scrollIntoView({ behavior: 'smooth' })} whileTap={{ scale: 0.97 }}
              className="px-8 py-4 rounded-2xl font-bold text-base text-white/80 bg-white/[0.04] border border-white/[0.06]">
              Live Demo ansehen
            </motion.button>
          </motion.div>
        </div>
      </Section>

      {/* Features */}
      <Section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Code, title: "3-Zeilen Integration", desc: "Ein <script> Tag. Keine Dependencies. Läuft überall.", color: "#00E0FF" },
              { icon: Shield, title: "PSD2 & PCI Compliant", desc: "Vollständig reguliert. Keine Haftung auf deiner Seite.", color: "#00E89D" },
              { icon: Globe, title: "Multi-Currency", desc: "EUR, USD, CHF. Automatische Konvertierung.", color: "#FFB800" },
            ].map((f, i) => (
              <motion.div key={i} className="rounded-3xl p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${f.color}15`, border: `1px solid ${f.color}30` }}>
                  <f.icon size={24} style={{ color: f.color }} />
                </div>
                <h3 className="text-xl font-bold text-white/90 mb-2">{f.title}</h3>
                <p className="text-[14px] text-white/50 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* Demo */}
      <Section id="demo" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-black text-white/95 mb-4">So einfach geht's</h2>
            <p className="text-lg text-white/50">Embed-Code kopieren, einfügen, fertig.</p>
          </div>
          <div className="rounded-3xl p-8" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="rounded-2xl p-6 font-mono text-[13px] text-[#00E89D] overflow-x-auto" style={{ background: "#0A0E14", border: "1px solid rgba(0,232,157,0.15)" }}>
              <div className="text-white/30 mb-2">{'<!-- Schritt 1: Embed Script -->'}</div>
              <div className="text-white/80">{'<script src="https://bidblitz.ae/pay.js"></script>'}</div>
              <div className="text-white/30 my-4">{'<!-- Schritt 2: Checkout starten -->'}</div>
              <div className="text-white/80">{'<script>'}</div>
              <div className="text-white/80 ml-4">{'BidBlitzPay.createSession({'}</div>
              <div className="text-white/80 ml-8">{'public_key: "pk_live_xxx",'}</div>
              <div className="text-white/80 ml-8">{'amount: 49.99,'}</div>
              <div className="text-white/80 ml-8">{'currency: "EUR",'}</div>
              <div className="text-white/80 ml-8">{'order_id: "ORDER-123",'}</div>
              <div className="text-white/80 ml-8">{'success_url: "/danke"'}</div>
              <div className="text-white/80 ml-4">{'});'}</div>
              <div className="text-white/80">{'</script>'}</div>
            </div>
          </div>
        </div>
      </Section>

      {/* Pricing */}
      <Section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-black text-white/95 mb-4">Transparente Preise</h2>
          <p className="text-lg text-white/50 mb-12">Keine Setup-Gebühr. Keine monatlichen Fixkosten.</p>
          <div className="rounded-3xl p-10" style={{ background: "linear-gradient(135deg, rgba(0,224,255,0.04), rgba(0,232,157,0.04))", border: "1px solid rgba(0,232,157,0.2)" }}>
            <div className="mb-6">
              <div className="text-6xl font-black mb-2" style={{ background: "linear-gradient(135deg, #00E0FF, #00E89D)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                1,9%
              </div>
              <div className="text-white/50 text-sm">+ €0,25 pro Transaktion</div>
            </div>
            <div className="flex flex-col gap-3 text-left max-w-sm mx-auto">
              {[
                "Keine Setup-Gebühr",
                "Keine monatlichen Kosten",
                "Keine versteckten Gebühren",
                "Auszahlung täglich möglich"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-white/70">
                  <Check size={16} className="text-[#00E89D]" />
                  <span className="text-[14px]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <Section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center rounded-3xl p-12" style={{ background: "linear-gradient(135deg, rgba(0,224,255,0.06), rgba(0,232,157,0.06))", border: "1px solid rgba(0,232,157,0.2)" }}>
          <h2 className="text-4xl font-black text-white/95 mb-4">Bereit loszulegen?</h2>
          <p className="text-lg text-white/50 mb-8">Beantrage deinen Zugang in unter 2 Minuten.</p>
          <motion.button onClick={() => setShowForm(true)} whileTap={{ scale: 0.97 }}
            className="px-8 py-4 rounded-2xl font-bold text-base inline-flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, #00E0FF, #00E89D)", color: "#020408" }}>
            Zugang beantragen <ChevronRight size={18} />
          </motion.button>
        </div>
      </Section>

      {/* Application Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }} onClick={() => setShowForm(false)}>
          <motion.div className="max-w-lg w-full rounded-3xl p-8" style={{ background: "#0A0E14", border: "1px solid rgba(0,232,157,0.2)" }}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white/95">BidBlitz Pay Antrag</h2>
              <button onClick={() => setShowForm(false)} className="w-9 h-9 rounded-full bg-white/[0.04] flex items-center justify-center">
                <X size={16} className="text-white/40" />
              </button>
            </div>
            {success ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(0,232,157,0.15)" }}>
                  <Check size={32} className="text-[#00E89D]" />
                </div>
                <h3 className="text-xl font-bold text-white/90 mb-2">Antrag eingegangen!</h3>
                <p className="text-[14px] text-white/50 mb-6">Wir prüfen deinen Antrag und melden uns innerhalb von 24h bei dir.</p>
                <button onClick={() => { setSuccess(false); setShowForm(false); }} className="px-6 py-3 rounded-xl font-bold text-[14px]" style={{ background: "linear-gradient(135deg, #00E0FF, #00E89D)", color: "#020408" }}>
                  Verstanden
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-[12px] text-white/50 font-medium block mb-1.5">Business-Name *</label>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <Building2 size={16} className="text-white/30" />
                    <input value={form.business_name} onChange={e => setForm(p => ({ ...p, business_name: e.target.value }))}
                      placeholder="Dein Unternehmen" className="flex-1 bg-transparent text-[14px] text-white/90 outline-none placeholder:text-white/20" />
                  </div>
                </div>
                <div>
                  <label className="text-[12px] text-white/50 font-medium block mb-1.5">E-Mail *</label>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <Mail size={16} className="text-white/30" />
                    <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="kontakt@firma.de" className="flex-1 bg-transparent text-[14px] text-white/90 outline-none placeholder:text-white/20" />
                  </div>
                </div>
                <div>
                  <label className="text-[12px] text-white/50 font-medium block mb-1.5">Website (optional)</label>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <LinkIcon size={16} className="text-white/30" />
                    <input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
                      placeholder="https://deine-website.de" className="flex-1 bg-transparent text-[14px] text-white/90 outline-none placeholder:text-white/20" />
                  </div>
                </div>
                <div>
                  <label className="text-[12px] text-white/50 font-medium block mb-1.5">Beschreibung (optional)</label>
                  <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Was verkaufst du? Erwartetes Volumen?"
                      rows={3}
                      className="w-full bg-transparent text-[14px] text-white/90 outline-none placeholder:text-white/20 resize-none" />
                  </div>
                </div>
                {error && (
                  <div className="px-4 py-3 rounded-xl bg-[#FF4757]/10 border border-[#FF4757]/20 text-[13px] text-[#FF4757]">
                    {error}
                  </div>
                )}
                <button onClick={handleSubmit} disabled={loading}
                  className="w-full py-4 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #00E0FF, #00E89D)", color: "#020408" }}>
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <><Check size={18} /> Antrag absenden</>}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PayForBusinessPage;
