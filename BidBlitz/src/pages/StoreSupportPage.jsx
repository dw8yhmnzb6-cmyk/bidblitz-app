import { ArrowLeft, Headphones, ShieldCheck, FileText, Mail } from "lucide-react";

const LINKS = [
  { id: "privacy", label: "Privacy Policy", href: "/privacy", icon: ShieldCheck },
  { id: "terms", label: "Terms and Conditions", href: "/terms", icon: FileText },
  { id: "contact", label: "Contact", href: "/contact", icon: Mail },
  { id: "delete", label: "Delete Account / Data Deletion", href: "/delete-account", icon: ShieldCheck },
];

export default function StoreSupportPage({ onBack, onNavigate }) {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="store-support-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="store-support-back">
            <ArrowLeft size={18} />
          </button>
        )}
        <h1 className="text-base font-bold">Support</h1>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5" data-testid="store-support-hero-card">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00C2FF]/12 border border-[#00C2FF]/20 text-[#00C2FF] mb-4">
            <Headphones size={22} />
          </div>
          <h2 className="text-xl font-black">BidBlitz Hilfe & Support</h2>
          <p className="mt-2 text-sm text-white/70 leading-6">
            Hilfe zu Wallet, QR Pay, Rechnungen, POS, Merchant-Tools und Mobility. Für App-Store-Prüfung stehen die offiziellen Support-, Datenschutz- und Kontaktseiten öffentlich bereit.
          </p>
          <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4" data-testid="store-support-contact-box">
            <p className="text-sm text-white/80">Support E-Mail: <a href="mailto:support@bidblitz.ae" className="text-[#8FEFFF]">support@bidblitz.ae</a></p>
            <p className="text-sm text-white/80 mt-2">Antwortzeit: innerhalb von 24 Stunden</p>
          </div>
        </div>

        <div className="grid gap-3">
          {LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate?.(item.href)}
                className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 flex items-center gap-3 text-left hover:border-[#00C2FF]/30 transition-colors"
                data-testid={`store-support-link-${item.id}`}
              >
                <div className="h-11 w-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#00C2FF] flex-shrink-0">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{item.label}</p>
                  <p className="text-xs text-white/55 mt-1">Öffentliche Produktionsseite für Review und Nutzer-Support</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}