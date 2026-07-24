import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ResetPasswordPage({ onBack, onNavigate }) {
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") || "", []);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    const verifyToken = async () => {
      if (!token) {
        setError("Reset-Link fehlt oder ist ungültig.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API}/api/auth/reset-password/verify?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Reset-Link ist ungültig");
        if (!active) return;
        setVerified(true);
        setEmail(data.email || "");
      } catch (err) {
        if (active) setError(err.message);
      }
      if (active) setLoading(false);
    };
    verifyToken();
    return () => { active = false; };
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Mindestens 6 Zeichen"); return; }
    if (password !== confirmPassword) { toast.error("Passwörter stimmen nicht überein"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirm_password: confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Passwort konnte nicht gesetzt werden");
      setDone(true);
      toast.success("Passwort erfolgreich aktualisiert");
    } catch (err) {
      toast.error(err.message);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#040610] text-white px-4 py-6" data-testid="reset-password-page">
      <div className="mx-auto max-w-md">
        <button onClick={() => onBack ? onBack() : onNavigate ? onNavigate("/") : window.history.back()} data-testid="reset-password-back-button" className="mb-6 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
          <ArrowLeft size={16} />
        </button>
        <div className="rounded-[28px] border border-white/10 bg-[rgba(11,15,24,0.92)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF]">
              {done ? <CheckCircle2 size={20} /> : <Lock size={20} />}
            </div>
            <div>
              <h1 className="text-xl font-black">Passwort zurücksetzen</h1>
              <p className="text-sm text-white/55">Sicherer Reset mit E-Mail-Verifizierung und Ablaufzeit.</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white/40" /></div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4" data-testid="reset-password-error-box">
              <div className="mb-2 flex items-center gap-2 text-red-300"><ShieldAlert size={16} /> Link ungültig</div>
              <p className="text-sm text-red-200/85">{error}</p>
            </div>
          ) : done ? (
            <div className="space-y-4" data-testid="reset-password-success-box">
              <p className="text-sm text-white/70">Dein Passwort wurde erfolgreich aktualisiert. Du kannst dich jetzt mit dem neuen Passwort anmelden.</p>
              <button onClick={() => onNavigate ? onNavigate("/") : window.location.assign("/")} data-testid="reset-password-login-button" className="w-full rounded-2xl bg-[#00C2FF] px-4 py-3 text-sm font-bold text-[#041018]">
                Zum Login
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3" data-testid="reset-password-form">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/75" data-testid="reset-password-email-box">
                Verifiziert für: <span className="font-semibold text-white">{email}</span>
              </div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Neues Passwort" data-testid="reset-password-new-input" className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none" />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Passwort bestätigen" data-testid="reset-password-confirm-input" className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none" />
              <button type="submit" disabled={!verified || submitting} data-testid="reset-password-submit-button" className="w-full rounded-2xl bg-[#00C2FF] px-4 py-3 text-sm font-bold text-[#041018] disabled:opacity-50">
                {submitting ? "Speichert..." : "Neues Passwort speichern"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}