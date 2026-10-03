import { useState } from "react";
import { ArrowLeft, ShieldAlert, Trash2, CheckCircle2, Loader2 } from "lucide-react";

const STEPS = [
  "Öffne in der App: Mehr → Einstellungen → Datenschutz.",
  "Wähle „Konto löschen“ oder sende eine Anfrage an privacy@bidblitz.ae.",
  "Wir bestätigen den Eingang und prüfen offene regulatorische Pflichten (z. B. Transaktions- oder KYC-Aufbewahrung).",
  "Sobald keine gesetzlichen Sperrfristen entgegenstehen, wird dein Konto deaktiviert und personenbezogene Daten werden gemäß Datenschutzrichtlinie gelöscht oder anonymisiert.",
];

export default function DeleteAccountPage({ onBack }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const requestDeletion = async () => {
    if (!password || !["DELETE", "LÖSCHEN", "LOESCHEN"].includes(confirmation.trim().toUpperCase())) {
      setError("Bitte Passwort eingeben und mit DELETE oder LÖSCHEN bestätigen.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/deletion-request`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: password,
          confirmation,
          reason: reason.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = typeof data.detail === "string" ? data.detail : data.detail?.message;
        throw new Error(detail || "Löschanfrage konnte nicht erstellt werden.");
      }
      setResult(data);
      setPassword("");
      setConfirmation("");
      setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    } catch (e) {
      setError(e.message || "Löschanfrage konnte nicht erstellt werden.");
    } finally {
      setLoading(false);
    }
  };

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

        <div className="rounded-2xl border border-[#FF6B6B]/20 bg-[#FF6B6B]/[0.04] p-4" data-testid="delete-account-action-card">
          <div className="flex items-center gap-2 mb-3">
            <Trash2 size={16} className="text-[#FF6B6B]" />
            <p className="text-sm font-bold">Löschanfrage senden</p>
          </div>
          <p className="text-xs text-white/55 leading-5 mb-4">
            Aus Sicherheitsgründen bestätigst du die Anfrage mit deinem aktuellen Passwort. Dein Login wird danach sofort deaktiviert; gesetzlich aufzubewahrende Zahlungs-/KYC-Daten bleiben bis zum Ablauf der jeweiligen Frist gesperrt erhalten.
          </p>

          <div className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Aktuelles Passwort"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-[#FF6B6B]/40"
              data-testid="delete-account-password"
            />
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="DELETE oder LÖSCHEN eingeben"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-[#FF6B6B]/40"
              data-testid="delete-account-confirmation"
            />
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="Grund (optional)"
              className="min-h-24 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-[#FF6B6B]/40"
              data-testid="delete-account-reason"
            />
          </div>

          {error ? <p className="mt-3 text-sm text-[#FF6B6B]" data-testid="delete-account-error">{error}</p> : null}
          {result ? <p className="mt-3 text-sm text-[#00E89D]" data-testid="delete-account-success">Anfrage {result.request_id} wurde erstellt. Du wirst abgemeldet.</p> : null}

          <button
            onClick={requestDeletion}
            disabled={loading || Boolean(result)}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FF6B6B] px-4 text-sm font-black text-black disabled:opacity-50"
            data-testid="delete-account-submit"
          >
            {loading ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
            Konto deaktivieren & Löschung beantragen
          </button>
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
