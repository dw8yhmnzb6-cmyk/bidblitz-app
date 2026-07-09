import { ArrowLeft, ShieldAlert, Trash2, CheckCircle2 } from "lucide-react";

const STEPS = [
  "Öffne in der App: Mehr → Einstellungen → Datenschutz.",
  "Wähle „Konto löschen“ oder sende eine Anfrage an privacy@bidblitz.ae.",
  "Wir bestätigen den Eingang und prüfen offene regulatorische Pflichten (z. B. Transaktions- oder KYC-Aufbewahrung).",
  "Sobald keine gesetzlichen Sperrfristen entgegenstehen, wird dein Konto deaktiviert und personenbezogene Daten werden gemäß Datenschutzrichtlinie gelöscht oder anonymisiert.",
];

export default function DeleteAccountPage({ onBack }) {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="delete-account-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="delete-account-back">
            <ArrowLeft size={18} />
          </button>
        )}
        <h1 className="text-base font-bold">Konto löschen & Datenlöschung</h1>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-4">
        <div className="rounded-3xl border border-[#FF6B6B]/15 bg-[linear-gradient(180deg,rgba(255,107,107,0.10),rgba(255,255,255,0.03))] p-5" data-testid="delete-account-hero-card">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF6B6B]/10 border border-[#FF6B6B]/20 text-[#FF6B6B] mb-4">
            <ShieldAlert size={22} />
          </div>
          <h2 className="text-xl font-black">Dein Recht auf Löschung</h2>
          <p className="mt-2 text-sm text-white/70 leading-6">
            Du kannst jederzeit die Schließung deines BidBlitz-Kontos und die Löschung deiner personenbezogenen Daten beantragen. Gesetzliche Aufbewahrungspflichten für Zahlungen, Rechnungen oder KYC-Dokumente bleiben davon unberührt.
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4" data-testid="delete-account-steps-card">
          <div className="flex items-center gap-2 mb-3 text-white">
            <Trash2 size={16} className="text-[#FF6B6B]" />
            <p className="text-sm font-bold">So funktioniert die Löschanfrage</p>
          </div>
          <div className="space-y-3">
            {STEPS.map((step, index) => (
              <div key={step} className="flex items-start gap-3" data-testid={`delete-account-step-${index + 1}`}>
                <div className="h-6 w-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[11px] font-bold text-[#8FEFFF] flex-shrink-0 mt-0.5">
                  {index + 1}
                </div>
                <p className="text-sm text-white/72 leading-6">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4" data-testid="delete-account-contact-card">
          <div className="flex items-center gap-2 mb-3 text-white">
            <CheckCircle2 size={16} className="text-[#00E89D]" />
            <p className="text-sm font-bold">Offizielle Kanäle</p>
          </div>
          <p className="text-sm text-white/72 leading-6">
            Datenlöschung & Datenschutz: <a className="text-[#8FEFFF]" href="mailto:privacy@bidblitz.ae">privacy@bidblitz.ae</a>
          </p>
          <p className="text-sm text-white/72 leading-6 mt-2">
            Allgemeiner Support: <a className="text-[#8FEFFF]" href="mailto:support@bidblitz.ae">support@bidblitz.ae</a>
          </p>
        </div>
      </div>
    </div>
  );
}
