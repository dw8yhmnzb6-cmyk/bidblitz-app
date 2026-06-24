import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function TwoFactorSettingsPage({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [step, setStep] = useState("overview"); // overview, setup, verify
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/2fa/status`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setLoading(false);
      }
    } catch (err) {
      toast.error("Fehler beim Laden");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleStartSetup = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/2fa/totp/setup`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setQrCode(data.qr_code);
        setSecret(data.secret);
        setStep("setup");
      }
    } catch (err) {
      toast.error("Fehler beim Setup");
    }
  };

  const handleVerifyAndEnable = async () => {
    if (verifyCode.length !== 6) {
      toast.error("Code muss 6 Ziffern haben");
      return;
    }
    
    setVerifying(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/2fa/totp/verify-and-enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: verifyCode }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setBackupCodes(data.backup_codes);
        setStep("verify");
        toast.success("2FA aktiviert!");
        fetchStatus();
      } else {
        const err = await res.json();
        toast.error(err.detail || "Ungültiger Code");
      }
    } catch (err) {
      toast.error("Fehler bei Verifizierung");
    }
    setVerifying(false);
  };

  const handleDisable = async () => {
    if (!window.confirm("2FA wirklich deaktivieren? Dein Konto wird weniger sicher.")) return;
    
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/2fa/disable`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        toast.success("2FA deaktiviert");
        fetchStatus();
        setStep("overview");
      }
    } catch (err) {
      toast.error("Fehler beim Deaktivieren");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Kopiert!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-[#00E0FF] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white font-outfit pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-black">Zwei-Faktor-Authentifizierung</h1>
          <div className="w-9" />
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-6">
        {/* Overview */}
        {step === "overview" && (
          <div className="space-y-4">
            <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00E0FF] to-[#0088CC] flex items-center justify-center text-3xl">
                  🔐
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-black">2FA Status</h2>
                  <p className={`text-sm font-semibold ${status?.enabled ? "text-[#10B981]" : "text-red-500"}`}>
                    {status?.enabled ? "✓ Aktiviert" : "Nicht aktiviert"}
                  </p>
                </div>
              </div>

              {status?.enabled && (
                <div className="space-y-2 mb-4 pt-4 border-t border-white/5">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Methode:</span>
                    <span className="font-semibold">Authenticator App (TOTP)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Aktiviert am:</span>
                    <span className="font-mono text-xs">
                      {status.enabled_at ? new Date(status.enabled_at).toLocaleDateString("de-DE") : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Backup-Codes:</span>
                    <span className="font-semibold">{status.backup_codes_remaining} übrig</span>
                  </div>
                </div>
              )}

              {!status?.enabled ? (
                <button
                  onClick={handleStartSetup}
                  className="w-full py-3 bg-[#00E0FF] hover:bg-[#00E0FF]/90 text-black rounded-xl font-bold transition"
                >
                  2FA aktivieren
                </button>
              ) : (
                <button
                  onClick={handleDisable}
                  className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-xl font-bold transition"
                >
                  2FA deaktivieren
                </button>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <h3 className="font-bold mb-2">Was ist 2FA?</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Zwei-Faktor-Authentifizierung erhöht die Sicherheit deines Kontos. Nach der Aktivierung
                benötigst du neben deinem Passwort einen 6-stelligen Code aus einer Authenticator-App
                (Google Authenticator, Authy, etc.).
              </p>
            </div>
          </div>
        )}

        {/* Setup Step */}
        {step === "setup" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-4">Schritt 1: QR-Code scannen</h2>
              
              {/* QR Code */}
              <div className="bg-white p-4 rounded-2xl mb-4">
                <img src={qrCode} alt="QR Code" className="w-full" />
              </div>

              {/* Manual Entry */}
              <div className="mb-4">
                <p className="text-sm text-white/60 mb-2">Oder manuell eingeben:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white/5 px-3 py-2 rounded-xl text-sm font-mono break-all">
                    {secret}
                  </code>
                  <button
                    onClick={() => copyToClipboard(secret)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition"
                  >
                    📋
                  </button>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4">
                <p className="text-sm text-blue-400">
                  💡 Scanne diesen QR-Code mit Google Authenticator, Authy oder einer ähnlichen App
                </p>
              </div>

              <h3 className="font-bold mb-3">Schritt 2: Code eingeben</h3>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6-stelliger Code"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:border-[#00E0FF] mb-4"
              />

              <button
                onClick={handleVerifyAndEnable}
                disabled={verifyCode.length !== 6 || verifying}
                className="w-full py-3 bg-[#00E0FF] hover:bg-[#00E0FF]/90 text-black rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifying ? "Verifiziere..." : "Bestätigen & Aktivieren"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Backup Codes */}
        {step === "verify" && backupCodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6">
              <div className="text-center mb-6">
                <span className="text-5xl mb-3 block">🎉</span>
                <h2 className="text-xl font-black mb-2">2FA aktiviert!</h2>
                <p className="text-sm text-white/60">Speichere diese Backup-Codes sicher</p>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-4">
                <p className="text-sm text-yellow-400 font-semibold mb-2">⚠️ WICHTIG</p>
                <p className="text-xs text-yellow-400/80">
                  Diese Codes werden nur einmal angezeigt. Speichere sie an einem sicheren Ort.
                  Du brauchst sie, wenn du dein Gerät verlierst.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {backupCodes.map((code, idx) => (
                  <div
                    key={idx}
                    className="bg-white/5 px-3 py-2 rounded-xl text-center font-mono text-sm"
                  >
                    {code}
                  </div>
                ))}
              </div>

              <button
                onClick={() => copyToClipboard(backupCodes.join("\n"))}
                className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl font-semibold transition mb-2"
              >
                📋 Alle kopieren
              </button>

              <button
                onClick={() => {
                  setStep("overview");
                  fetchStatus();
                }}
                className="w-full py-3 bg-[#00E0FF] hover:bg-[#00E0FF]/90 text-black rounded-xl font-bold transition"
              >
                Fertig
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
