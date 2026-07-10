import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Server, Cpu, MapPin, Clock3, Bitcoin, ChevronRight, PlayCircle, Activity, Gauge, Building2, BarChart3, Waves } from "lucide-react";
import { useI18n } from "../store";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const trustMedia = {
  dubai: "https://static.prod-images.emergentagent.com/jobs/2ac12b59-b16f-458d-9088-1c735ced669e/images/1cf85ab6d62f2971e243a0c551a8310646f1846376968d6a79dabb151cfe5b91.png",
  abuDhabi: "https://static.prod-images.emergentagent.com/jobs/2ac12b59-b16f-458d-9088-1c735ced669e/images/c9404a578ab5a41d4ccca2b8814854cc379934a3031fa3444081ad8ed1500ff0.png",
  asic: "https://static.prod-images.emergentagent.com/jobs/2ac12b59-b16f-458d-9088-1c735ced669e/images/10e9e5dc49593c7ba9274fbaa20065eeab510349d8023d6322df54bac2fc19e5.png",
};

const copy = {
  de: {
    badge: "Mining Infrastruktur",
    title: "Unsere Bitcoin-Mining-Server",
    subtitle: "Transparenz schafft Vertrauen: Wir zeigen unsere Mining-Infrastruktur, unsere ASIC-Systeme und unsere Standorte in Dubai und Abu Dhabi.",
    ctaPrimary: "Zum Mining",
    ctaSecondary: "Kontakt anfragen",
    leadTitle: "Investor / Kunde anfragen",
    leadText: "Wenn du Mining-Infrastruktur, Partnerschaft oder Standort-Proof besprechen willst, hinterlasse deine Anfrage direkt hier.",
    leadName: "Name",
    leadEmail: "E-Mail",
    leadCompany: "Firma",
    leadMessage: "Nachricht",
    leadSubmit: "Anfrage senden",
    leadSuccess: "Anfrage wurde gesendet",
    investorBadge: "Investor & Kunden Proof",
    mapTitle: "Standort-Übersicht",
    mapText: "Dubai und Abu Dhabi bilden die sichtbaren Ankerpunkte für Vertrauen, Infrastruktur und operative Stabilität.",
    timelineTitle: "Proof of Infrastructure",
    timeline: [
      { title: "Standorte aufgebaut", text: "Mining-Infrastruktur in Dubai und Abu Dhabi als sichtbare Vertrauensbasis positioniert." },
      { title: "ASIC-Betrieb aktiv", text: "Professionelle Bitcoin-Mining-Hardware mit Fokus auf Dauerbetrieb und Monitoring." },
      { title: "Video Proof bereit", text: "Die Seite ist vorbereitet, eure echten Standort-Videos direkt einzubinden." },
    ],
    metricsLiveTitle: "Live Mining Kennzahlen",
    metricsLive: [
      { label: "Hashrate Cluster", value: "46.2 PH/s", note: "sichtbarer Infrastruktur-Score" },
      { label: "Uptime Ziel", value: "99.4%", note: "Betriebs- und Monitoringfokus" },
      { label: "Cooling Status", value: "Stabil", note: "aktive Kühlung & Heatflow" },
      { label: "Monitoring", value: "24/7", note: "Operations Team & Alerts" },
    ],
    footerEyebrow: "Bitcoin Mining Transparenz",
    footerTitle: "Zeig Infrastruktur. Gewinne Vertrauen.",
    footerText: "Diese Seite ist dafür gebaut, Kundinnen und Kunden echte Server, echte ASIC-Hardware und eure echten Standort-Videos sichtbar zu machen.",
    footerServices: "Alle Services",
    stats: [
      { label: "Server-Standorte", value: "Dubai · Abu Dhabi" },
      { label: "Betriebsmodell", value: "24/7 Infrastruktur" },
      { label: "Systemtyp", value: "ASIC Bitcoin Server" },
      { label: "Status", value: "Aktive Kühlung & Monitoring" },
    ],
    sections: {
      proof: "Visueller Nachweis unserer Hardware",
      dubai: "Dubai Serverhalle",
      dubaiText: "Skalierbare Reihen aus Bitcoin-Minern mit professioneller Strom- und Kühlungsinfrastruktur.",
      abuDhabi: "Abu Dhabi Infrastruktur",
      abuDhabiText: "Industrielle Rack-Strukturen für laufenden Mining-Betrieb mit Fokus auf Stabilität und Vertrauen.",
      asic: "ASIC Detailaufnahme",
      asicText: "Nahaufnahme echter Mining-Hardware zur Darstellung von Technik, Kühlung und Betriebsqualität.",
      video: "Videos aus Dubai & Abu Dhabi",
      videoText: "Hier platzieren wir eure echten Videos aus Dubai und Abu Dhabi, damit Kunden sehen, dass die Server real laufen.",
      metric: "Vertrauensmetriken",
    },
    metrics: [
      { icon: Server, title: "Enterprise Server", text: "Professionelle Mining-Racks statt unklarer Marketingversprechen." },
      { icon: Shield, title: "Vertrauen & Transparenz", text: "Klare Sicht auf Infrastruktur, Technik und operative Seriosität." },
      { icon: Clock3, title: "24/7 Betrieb", text: "Ausgelegt auf laufenden Betrieb mit Kühlung, Monitoring und Wartungsroutine." },
      { icon: Bitcoin, title: "Bitcoin Fokus", text: "Sichtbar auf Bitcoin-Mining und ASIC-Hardware spezialisiert." },
    ],
    placeholders: [
      { city: "Dubai", label: "Video Slot 01", note: "Echtes Rechenzentrum / Servergang" },
      { city: "Abu Dhabi", label: "Video Slot 02", note: "Container / Rack-Setup / Kühlung" },
    ],
  },
  en: {
    badge: "Mining Infrastructure",
    title: "Our Bitcoin Mining Servers",
    subtitle: "Transparency creates trust: we show our mining infrastructure, ASIC systems, and our locations in Dubai and Abu Dhabi.",
    ctaPrimary: "Open Mining",
    ctaSecondary: "Request Contact",
    leadTitle: "Investor / Client Inquiry",
    leadText: "If you want to discuss mining infrastructure, partnership, or location proof, leave your inquiry directly here.",
    leadName: "Name",
    leadEmail: "Email",
    leadCompany: "Company",
    leadMessage: "Message",
    leadSubmit: "Send Inquiry",
    leadSuccess: "Inquiry sent successfully",
    investorBadge: "Investor & Client Proof",
    mapTitle: "Location Overview",
    mapText: "Dubai and Abu Dhabi act as visible anchor points for trust, infrastructure, and operational stability.",
    timelineTitle: "Proof of Infrastructure",
    timeline: [
      { title: "Locations established", text: "Mining infrastructure in Dubai and Abu Dhabi positioned as visible trust anchors." },
      { title: "ASIC operations active", text: "Professional bitcoin mining hardware focused on continuous operation and monitoring." },
      { title: "Video proof ready", text: "The page is prepared to embed your real location videos directly." },
    ],
    metricsLiveTitle: "Live Mining Metrics",
    metricsLive: [
      { label: "Hashrate Cluster", value: "46.2 PH/s", note: "visible infrastructure score" },
      { label: "Uptime Target", value: "99.4%", note: "operations and monitoring focus" },
      { label: "Cooling Status", value: "Stable", note: "active cooling & heatflow" },
      { label: "Monitoring", value: "24/7", note: "operations team & alerts" },
    ],
    footerEyebrow: "Bitcoin Mining Transparency",
    footerTitle: "Show infrastructure. Build trust.",
    footerText: "This page is designed to show customers real servers, real ASIC hardware, and your real location videos clearly and professionally.",
    footerServices: "All Services",
    stats: [
      { label: "Server Locations", value: "Dubai · Abu Dhabi" },
      { label: "Operating Model", value: "24/7 Infrastructure" },
      { label: "System Type", value: "ASIC Bitcoin Servers" },
      { label: "Status", value: "Active Cooling & Monitoring" },
    ],
    sections: {
      proof: "Visual proof of our hardware",
      dubai: "Dubai Server Hall",
      dubaiText: "Scalable rows of bitcoin miners with professional power and cooling infrastructure.",
      abuDhabi: "Abu Dhabi Infrastructure",
      abuDhabiText: "Industrial rack structures for running mining operations with a focus on stability and trust.",
      asic: "ASIC Close-up",
      asicText: "Close-up mining hardware detail to show technology, cooling, and operational quality.",
      video: "Videos from Dubai & Abu Dhabi",
      videoText: "This is where your real Dubai and Abu Dhabi videos will be placed so customers can see the servers are real.",
      metric: "Trust Metrics",
    },
    metrics: [
      { icon: Server, title: "Enterprise Servers", text: "Professional mining racks instead of vague marketing claims." },
      { icon: Shield, title: "Trust & Transparency", text: "Clear visibility into infrastructure, technology, and operating credibility." },
      { icon: Clock3, title: "24/7 Operation", text: "Designed for continuous operation with cooling, monitoring, and maintenance routines." },
      { icon: Bitcoin, title: "Bitcoin Focus", text: "Clearly specialized in bitcoin mining and ASIC hardware." },
    ],
    placeholders: [
      { city: "Dubai", label: "Video Slot 01", note: "Real data-center / server corridor" },
      { city: "Abu Dhabi", label: "Video Slot 02", note: "Container / rack setup / cooling" },
    ],
  },
};

function resolveCopy(lang) {
  if ((lang || "").startsWith("de")) return copy.de;
  return copy.en;
}

function TrustMetric({ icon: Icon, title, text, testId }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-5" data-testid={testId}>
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
        <Icon size={20} />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/60">{text}</p>
    </div>
  );
}

function MediaCard({ image, title, text, location, testId }) {
  return (
    <div className="rounded-[32px] border border-white/10 bg-white/5 overflow-hidden" data-testid={testId}>
      <div className="aspect-[16/10] w-full overflow-hidden bg-black/30">
        <img src={image} alt={title} className="h-full w-full object-cover object-center" />
      </div>
      <div className="p-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/65">
          <MapPin size={12} /> {location}
        </div>
        <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
        <p className="mt-2 text-sm text-white/60">{text}</p>
      </div>
    </div>
  );
}

function LiveMetricCard({ icon: Icon, label, value, note, testId }) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/5 p-5" data-testid={testId}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{label}</p>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-4 text-2xl font-bold text-white">{value}</p>
      <p className="mt-2 text-xs text-white/55">{note}</p>
    </div>
  );
}

export default function MiningTrustPage({ onBack, onNavigate }) {
  const { lang } = useI18n();
  const c = resolveCopy(lang);
  const [proofData, setProofData] = useState(null);
  const [leadForm, setLeadForm] = useState({ name: "", email: "", company: "", message: "" });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${API}/api/mining/trust/public`);
        if (!response.ok) throw new Error("proof load failed");
        const data = await response.json();
        setProofData(data);
      } catch (error) {
        console.error("Mining trust proof load failed", error);
      }
    };
    load();
  }, []);

  const submitLead = async () => {
    if (!leadForm.name.trim() || !leadForm.email.trim()) {
      toast.error("Bitte Name und E-Mail eingeben");
      return;
    }
    try {
      setSending(true);
      const response = await fetch(`${API}/api/mining/trust/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadForm),
      });
      if (!response.ok) throw new Error("lead submit failed");
      setLeadForm({ name: "", email: "", company: "", message: "" });
      toast.success(c.leadSuccess);
    } catch (error) {
      toast.error("Anfrage konnte nicht gesendet werden");
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      data-testid="mining-trust-page"
      className="min-h-screen bg-[#06070A] pb-24 text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      style={{
        backgroundImage: "radial-gradient(circle at top left, rgba(245, 158, 11, 0.18), transparent 32%), radial-gradient(circle at top right, rgba(59, 130, 246, 0.14), transparent 28%), linear-gradient(180deg, #05070A 0%, #090B10 100%)",
      }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between gap-3">
          <button onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5" data-testid="mining-trust-back-button">
            <ArrowLeft size={18} />
          </button>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-[11px] font-semibold text-amber-200" data-testid="mining-trust-badge">
            <Cpu size={13} /> {c.badge}
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold text-white/70" data-testid="mining-trust-investor-badge">
              <Building2 size={13} /> {c.investorBadge}
            </div>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl" data-testid="mining-trust-title">
              {c.title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm text-white/68 sm:text-base" data-testid="mining-trust-subtitle">
              {c.subtitle}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => onNavigate?.("/mining")} className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-bold text-black" data-testid="mining-trust-open-mining">
                {c.ctaPrimary} <ChevronRight size={16} />
              </button>
              <button onClick={() => onNavigate?.("/contact")} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white" data-testid="mining-trust-contact-button">
                {c.ctaSecondary}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2" data-testid="mining-trust-stats-grid">
            {(proofData ? [
              { label: c.stats[0].label, value: proofData.proof_metrics.locations.map((x) => x.city).join(" · ") },
              { label: c.stats[1].label, value: `${proofData.network.active_miners} aktive Miner` },
              { label: c.stats[2].label, value: `${proofData.network.registered_hashrate_phs} PH/s registriert` },
              { label: c.stats[3].label, value: `${proofData.proof_metrics.monitoring}` },
            ] : c.stats).map((item, index) => (
              <div key={`${item.label}-${index}`} className="rounded-[28px] border border-white/10 bg-white/5 p-5" data-testid={`mining-trust-stat-${index}`}>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{item.label}</p>
                <p className="mt-3 text-base font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <section className="mt-12" data-testid="mining-trust-proof-section">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">{c.sections.proof}</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <MediaCard image={trustMedia.dubai} title={c.sections.dubai} text={c.sections.dubaiText} location="Dubai" testId="mining-trust-dubai-card" />
            <MediaCard image={trustMedia.abuDhabi} title={c.sections.abuDhabi} text={c.sections.abuDhabiText} location="Abu Dhabi" testId="mining-trust-abudhabi-card" />
            <MediaCard image={trustMedia.asic} title={c.sections.asic} text={c.sections.asicText} location="Bitcoin ASIC" testId="mining-trust-asic-card" />
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]" data-testid="mining-trust-live-section">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6" data-testid="mining-trust-live-metrics-section">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">{c.metricsLiveTitle}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[Gauge, Activity, Waves, BarChart3].map((Icon, index) => {
                const fallback = c.metricsLive[index];
                const metrics = proofData?.proof_metrics;
                const item = metrics ? [
                  { label: c.metricsLive[0].label, value: `${metrics.hashrate_cluster_phs} PH/s`, note: fallback.note },
                  { label: c.metricsLive[1].label, value: `${metrics.uptime_percent}%`, note: fallback.note },
                  { label: c.metricsLive[2].label, value: `${metrics.cooling_status}`, note: fallback.note },
                  { label: c.metricsLive[3].label, value: `${metrics.monitoring}`, note: fallback.note },
                ][index] : fallback;
                return <LiveMetricCard key={`${item.label}-${index}`} icon={Icon} label={item.label} value={item.value} note={item.note} testId={`mining-trust-live-metric-${index}`} />;
              })}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6" data-testid="mining-trust-map-section">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">{c.mapTitle}</p>
            <h2 className="mt-3 text-2xl font-bold text-white">Dubai · Abu Dhabi</h2>
            <p className="mt-2 text-sm text-white/60">{c.mapText}</p>
            <div className="mt-5 rounded-[26px] border border-white/10 bg-black/20 p-5" data-testid="mining-trust-location-map-card">
              <div className="relative overflow-hidden rounded-[22px] border border-white/8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 min-h-[260px]">
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
                <div className="absolute left-[20%] top-[52%] flex items-center gap-2" data-testid="mining-trust-map-dubai-pin">
                  <span className="h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.95)]" />
                  <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-100">Dubai</span>
                </div>
                <div className="absolute right-[16%] top-[40%] flex items-center gap-2" data-testid="mining-trust-map-abudhabi-pin">
                  <span className="h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.9)]" />
                  <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold text-sky-100">Abu Dhabi</span>
                </div>
                <div className="absolute left-[24%] top-[53%] h-px w-[50%] bg-gradient-to-r from-amber-300 via-white/50 to-sky-300" />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-[32px] border border-white/10 bg-white/5 p-6" data-testid="mining-trust-lead-section">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Lead Capture</p>
              <h2 className="mt-3 text-2xl font-bold text-white">{c.leadTitle}</h2>
              <p className="mt-2 text-sm text-white/60">{c.leadText}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={leadForm.name} onChange={(e) => setLeadForm((p) => ({ ...p, name: e.target.value }))} placeholder={c.leadName} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" data-testid="mining-trust-lead-name" />
              <input value={leadForm.email} onChange={(e) => setLeadForm((p) => ({ ...p, email: e.target.value }))} placeholder={c.leadEmail} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" data-testid="mining-trust-lead-email" />
              <input value={leadForm.company} onChange={(e) => setLeadForm((p) => ({ ...p, company: e.target.value }))} placeholder={c.leadCompany} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none sm:col-span-2" data-testid="mining-trust-lead-company" />
              <textarea value={leadForm.message} onChange={(e) => setLeadForm((p) => ({ ...p, message: e.target.value }))} placeholder={c.leadMessage} rows={4} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none resize-none sm:col-span-2" data-testid="mining-trust-lead-message" />
              <button onClick={submitLead} className="rounded-full bg-amber-400 px-5 py-3 text-sm font-bold text-black sm:col-span-2" data-testid="mining-trust-lead-submit">{sending ? "..." : c.leadSubmit}</button>
            </div>
          </div>
        </section>

        <section className="mt-12" data-testid="mining-trust-timeline-section">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">{c.timelineTitle}</p>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {c.timeline.map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-[28px] border border-white/10 bg-white/5 p-5" data-testid={`mining-trust-timeline-card-${index}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-white/80">0{index + 1}</div>
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                </div>
                <p className="mt-3 text-sm text-white/60">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6" data-testid="mining-trust-video-section">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">{c.sections.video}</p>
            <h2 className="mt-3 text-2xl font-bold text-white">Dubai & Abu Dhabi</h2>
            <p className="mt-2 text-sm text-white/60">{c.sections.videoText}</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {c.placeholders.map((item, index) => (
                <div key={`${item.city}-${index}`} className="rounded-[26px] border border-dashed border-white/12 bg-black/20 p-4" data-testid={`mining-trust-video-placeholder-${index}`}>
                  <div className="aspect-[16/10] rounded-[22px] bg-gradient-to-br from-white/8 to-white/4 flex items-center justify-center">
                    <PlayCircle size={40} className="text-white/45" />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.city}</p>
                      <p className="text-xs text-white/50">{item.note}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold text-white/60">{item.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">{c.sections.metric}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2" data-testid="mining-trust-metrics-grid">
              {c.metrics.map((item, index) => (
                <TrustMetric key={`${item.title}-${index}`} icon={item.icon} title={item.title} text={item.text} testId={`mining-trust-metric-${index}`} />
              ))}
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-[34px] border border-amber-400/20 bg-gradient-to-r from-amber-500/12 via-orange-500/10 to-transparent p-6" data-testid="mining-trust-footer-cta">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">{c.footerEyebrow}</p>
              <h2 className="mt-2 text-2xl font-bold text-white">{c.footerTitle}</h2>
              <p className="mt-2 text-sm text-white/65">{c.footerText}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => onNavigate?.("/mining")} className="rounded-full bg-white px-5 py-3 text-sm font-bold text-black" data-testid="mining-trust-footer-open-mining">
                {c.ctaPrimary}
              </button>
              <button onClick={() => onNavigate?.("/all-services")} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white" data-testid="mining-trust-footer-all-services">
                {c.footerServices}
              </button>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}