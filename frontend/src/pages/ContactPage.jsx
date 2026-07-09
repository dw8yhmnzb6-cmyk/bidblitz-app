import { ArrowLeft, Mail, ShieldCheck, Headphones, Building2 } from "lucide-react";

const CONTACT_CHANNELS = [
  {
    id: "support",
    icon: Headphones,
    title: "Support",
    description: "Allgemeine Hilfe, Produktfragen und Support-Anliegen",
    value: "support@bidblitz.ae",
    href: "mailto:support@bidblitz.ae",
  },
  {
    id: "privacy",
    icon: ShieldCheck,
    title: "Datenschutz",
    description: "Datenschutzanfragen, Auskunft, Löschung und Datenexport",
    value: "privacy@bidblitz.ae",
    href: "mailto:privacy@bidblitz.ae",
  },
  {
    id: "security",
    icon: Mail,
    title: "Sicherheit",
    description: "Sicherheitsmeldungen, Missbrauch und Fraud-Reports",
    value: "security@bidblitz.ae",
    href: "mailto:security@bidblitz.ae",
  },
];

export default function ContactPage({ onBack }) {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="contact-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="contact-back">
            <ArrowLeft size={18} />
          </button>
        )}
        <h1 className="text-base font-bold">Kontakt</h1>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5" data-testid="contact-hero-card">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00C2FF]/12 border border-[#00C2FF]/20 text-[#00C2FF] mb-4">
            <Building2 size={22} />
          </div>
          <h2 className="text-xl font-black">BidBlitz Kontakt & Rechtliches</h2>
          <p className="mt-2 text-sm text-white/70 leading-6">
            Für Apple App Store, Google Play, Datenschutz- und Support-Anliegen erreichst du uns über die offiziellen Produktionskanäle unten.
          </p>
          <div className="mt-4 text-sm text-white/75" data-testid="contact-company-block">
            <p className="font-semibold text-white">BidBlitz LLC</p>
            <p>Dubai Internet City, Dubai, Vereinigte Arabische Emirate</p>
            <p>Antwortzeit für Standardanfragen: innerhalb von 24 Stunden</p>
          </div>
        </div>

        <div className="grid gap-3">
          {CONTACT_CHANNELS.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href={item.href}
                className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 flex items-start gap-3 hover:border-[#00C2FF]/30 transition-colors"
                data-testid={`contact-channel-${item.id}`}
              >
                <div className="h-11 w-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#00C2FF] flex-shrink-0">
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{item.title}</p>
                  <p className="text-xs text-white/60 mt-1 leading-5">{item.description}</p>
                  <p className="text-sm text-[#8FEFFF] mt-2 break-all">{item.value}</p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
