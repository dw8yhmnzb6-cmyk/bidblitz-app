import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, Shield
} from "lucide-react";
import { useUser, useI18n } from "../store";
import KYCVerificationModal from "../components/KYCVerificationModal";
import { TEST_MODE, TEST_MODE_FULL_ACCESS, isTestModeUser } from "../config/testMode";

const slide = { duration: 0.35, ease: [0.32, 0.72, 0, 1] };

// Floating input
const Field = ({ icon: Icon, type, value, onChange, placeholder, testId, autoFocus, inputRef, name }) => {
  const [focused, setFocused] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const isPw = type === "password";
  const handleBlur = (e) => {
    const liveValue = e.currentTarget.value;
    if (liveValue !== value) {
      onChange(liveValue);
    }
    setFocused(false);
  };

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={slide}
    >
      <div
        className={`flex items-center gap-3 px-4 py-[14px] rounded-[14px] transition-all duration-200 overflow-hidden ${
          focused
            ? "bg-white/[0.06] border border-[#00C2FF]/35 shadow-[0_0_0_1px_rgba(0,194,255,0.08)]"
            : "bg-white/[0.035] border border-white/[0.1]"
        }`}
      >
        <Icon size={16} strokeWidth={1.5} className={`flex-shrink-0 ${focused ? "text-[#00C2FF]" : "text-white/70"}`} />
        <input
          ref={inputRef}
          name={name}
          data-testid={testId}
          type={isPw ? (showPw ? "text" : "password") : (type || "text")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onInput={(e) => onChange(e.currentTarget.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          inputMode={type === "email" ? "email" : undefined}
          className="flex-1 min-w-0 w-full bg-transparent text-[13px] text-white placeholder:text-white/60 outline-none font-medium"
          style={{ WebkitTextFillColor: "#fff" }}
          autoComplete={isPw ? (placeholder && placeholder.toLowerCase().includes("confirm") || placeholder && placeholder.toLowerCase().includes("bestätigen") ? "new-password" : "current-password") : "email"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint={isPw ? "go" : "next"}
        />
        {isPw && value && (
          <motion.button
            type="button"
            className="text-white/55 hover:text-white/80 transition-colors"
            whileTap={{ scale: 0.85 }}
            onClick={() => setShowPw(!showPw)}
            tabIndex={-1}
          >
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

export const AuthPage = ({ onBack, initialMode, onAuthSuccess }) => {
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const loginSnapshotRef = useRef({ email: "", password: "" });
  const [mode, setMode] = useState(initialMode || "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [requestedRole, setRequestedRole] = useState("customer");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true); // Default to true for better UX
  const [otpCode, setOtpCode] = useState("");
  const [showKYC, setShowKYC] = useState(false);
  const previousValuesRef = useRef({ email: "", password: "", otpCode: "", name: "", confirm: "" });
  const { t } = useI18n();

  const user = useUser();
  const pendingKycUser = !TEST_MODE && !TEST_MODE_FULL_ACCESS && !isTestModeUser(user) && user?.isAuthenticated && user?.kyc_status && user?.kyc_status !== "approved";

  useEffect(() => {
    if (!user.error) return;
    const previous = previousValuesRef.current;
    const hasRealInputChange = (
      previous.email !== email ||
      previous.password !== password ||
      previous.otpCode !== otpCode ||
      previous.name !== name ||
      previous.confirm !== confirm
    );
    if (hasRealInputChange && typeof user.clearError === "function") {
      user.clearError();
    }
    previousValuesRef.current = { email, password, otpCode, name, confirm };
  }, [email, password, otpCode, name, confirm, user]);

  useEffect(() => {
    previousValuesRef.current = { email, password, otpCode, name, confirm };
  }, [email, password, otpCode, name, confirm]);

  const captureLoginSnapshot = () => {
    loginSnapshotRef.current = {
      email: String(emailRef.current?.value || email || "").trim(),
      password: String(passwordRef.current?.value || password || ""),
    };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const liveEmail = String(formData.get("login-email") || loginSnapshotRef.current.email || emailRef.current?.value || email || "").trim();
    const livePassword = String(formData.get("login-password") || loginSnapshotRef.current.password || passwordRef.current?.value || password || "");
    if (liveEmail !== email) setEmail(liveEmail);
    if (livePassword !== password) setPassword(livePassword);
    if (typeof user.clearError === "function") user.clearError();
    const result = await user.login(liveEmail, livePassword, rememberMe);
    if (result === true && typeof onAuthSuccess === "function") {
      onAuthSuccess();
    }
    // If result is '2fa_required', the UserContext will set requires2FA=true
    // which triggers the 2FA UI automatically
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    const ok = await user.verify2FA(otpCode);
    if (ok && typeof onAuthSuccess === "function") {
      onAuthSuccess();
    }
  };

  const handleCancel2FA = () => {
    setOtpCode("");
    user.cancel2FA();
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const ok = await user.register(name, email, password, confirm, requestedRole);
    if (ok) {
      if (typeof onAuthSuccess === "function") {
        onAuthSuccess();
      }
      // Check for ?ref= in URL and auto-claim referral bonus
      try {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get("ref");
        if (ref) {
          fetch(`${process.env.REACT_APP_BACKEND_URL}/api/affiliate/claim-signup-bonus`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: ref }),
          }).catch(() => {});
        }
      } catch (refError) {
        void refError;
      }
      // Nach Registrierung erst stabil einloggen lassen; KYC später manuell starten
      setShowKYC(false);
    }
  };

  const handleKYCComplete = async (result) => {
    // Refresh user profile to pick up kyc_status
    try {
      if (typeof user.refresh === "function") {
        await user.refresh();
      } else if (typeof user.fetchProfile === "function") {
        await user.fetchProfile();
      }
    } catch (refreshError) {
      void refreshError;
    }
    setShowKYC(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotError("");
    if (!email.trim()) {
      setForgotError("Bitte E-Mail eingeben");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (res.ok) {
        setForgotSent(true);
      } else {
        const d = await res.json().catch(() => ({}));
        setForgotError(d.detail || "Fehler beim Senden");
      }
    } catch (forgotPasswordError) {
      void forgotPasswordError;
      setForgotError("Netzwerkfehler");
    }
    setForgotLoading(false);
  };

  const switchMode = (m) => {
    setMode(m);
    setEmail("");
    setPassword("");
    setName("");
    setConfirm("");
    setRequestedRole("customer");
    setShowForgotPassword(false);
    setForgotSent(false);
  };

  const authTips = mode === "login"
    ? [
        "Nutze dieselbe E-Mail wie bei der Registrierung.",
        "Wenn du dein Passwort vergessen hast, tippe auf Passwort vergessen.",
        "Nach falscher Eingabe bleibt die Meldung sichtbar, bis du erneut etwas änderst.",
      ]
    : [
        "Nach der Registrierung bist du sofort angemeldet.",
        "Verwende eine echte E-Mail, damit Reset-Links später zugestellt werden.",
        "Das Passwort sollte mindestens 6 Zeichen haben.",
      ];

  return (
    <motion.div
      data-testid="auth-page"
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "#030303" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Ambient glow */}
      <motion.div
        className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[80vw] max-w-[500px] h-[80vw] max-h-[500px] rounded-full pointer-events-none"
        style={{ filter: "blur(140px)", background: "rgba(0,194,255,0.05)" }}
      />

      <div className="flex-1 flex flex-col justify-center px-5 py-10 relative z-10 max-w-[400px] mx-auto w-full overflow-x-hidden">

        {/* ── Back Button (when opened from public browsing) ── */}
        {onBack && (
          <motion.button
            data-testid="auth-back-btn"
            className="absolute top-[max(env(safe-area-inset-top,0px),16px)] left-4 z-20 flex items-center gap-1.5 text-[12px] text-white/60 font-medium"
            whileTap={{ scale: 0.92 }}
            onClick={onBack}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            {t("common.back") || "Back"}
          </motion.button>
        )}

        {/* ── Logo / Brand ── */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, ...slide }}
        >
          <motion.div
            className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #00C2FF 0%, #0088CC 100%)",
              boxShadow: "0 8px 32px rgba(0,194,255,0.25), 0 0 0 1px rgba(0,194,255,0.1)",
            }}
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 18 }}
          >
            <span className="text-[18px] font-bold text-white font-outfit">BB</span>
          </motion.div>
          <motion.h1
            className="text-[24px] font-bold font-outfit text-white tracking-tight mb-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
          >
            BidBlitz
          </motion.h1>
          <motion.p
            className="text-[13px] text-white/70 font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.22 }}
          >
            {mode === "login" ? t("auth.welcome") || "Willkommen zurück" : t("auth.create") || "Konto erstellen"}
          </motion.p>
        </motion.div>

        {/* ── Form ── */}
        <AnimatePresence mode="wait">
          {/* ── 2FA Verification Form ── */}
          {user.requires2FA ? (
            <motion.form
              key="2fa"
              onSubmit={handleVerify2FA}
              className="space-y-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={slide}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00C2FF]/10 flex items-center justify-center">
                  <Shield size={28} className="text-[#00C2FF]" />
                </div>
                <h2 className="text-[16px] font-semibold text-white mb-1">Bestätigungscode eingeben</h2>
                <p className="text-[12px] text-[#555]">
                  Code an {user.twoFAEmailHint || "deine E-Mail"} gesendet
                </p>
              </div>

              <div className="relative">
                <input
                  data-testid="otp-code-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  autoFocus
                  className="w-full text-center text-[28px] font-mono font-bold tracking-[0.5em] py-4 px-4 bg-white/[0.02] border border-white/[0.05] rounded-[14px] text-white placeholder:text-[#1a1a1a] outline-none focus:border-[#00C2FF]/25"
                />
              </div>

              {user.error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-[12px]"
                >
                  <AlertCircle size={14} />
                  {user.error}
                </motion.div>
              )}

              <motion.button
                data-testid="verify-2fa-btn"
                type="submit"
                disabled={user.isLoading || otpCode.length !== 6}
                className="w-full flex items-center justify-center gap-2 py-[14px] rounded-[14px] text-[13px] font-semibold transition-all disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #00C2FF 0%, #0088CC 100%)",
                  color: "#000",
                }}
                whileTap={{ scale: 0.98 }}
              >
                {user.isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>Bestätigen <ArrowRight size={14} /></>
                )}
              </motion.button>

              <motion.button
                type="button"
                onClick={handleCancel2FA}
                className="w-full py-3 text-[12px] text-[#555] hover:text-white/60 transition-colors"
                whileTap={{ scale: 0.98 }}
              >
                Abbrechen
              </motion.button>
            </motion.form>
          ) : mode === "login" ? (
            <motion.form
              key="login"
              onSubmit={handleLogin}
              className="space-y-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={slide}
            >
              {pendingKycUser ? (
                <div className="rounded-[18px] border border-[#00C2FF]/20 bg-[#08131A] px-4 py-3" data-testid="auth-pending-kyc-banner">
                  <div className="flex items-start gap-3">
                    <Shield size={16} className="mt-0.5 text-[#00C2FF]" />
                    <div>
                      <div className="text-[13px] font-bold text-white">Du bist erfolgreich angemeldet</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-white/60">
                        Dein Konto ist aktiv. Einige Bereiche bleiben bis zur KYC-Freigabe geschützt.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              <Field
                icon={Mail}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder={t("auth.email") || "E-Mail-Adresse"}
                testId="login-email-input"
                autoFocus
                inputRef={emailRef}
                name="login-email"
              />
              <Field
                icon={Lock}
                type="password"
                value={password}
                onChange={setPassword}
                placeholder={t("auth.password") || "Passwort"}
                testId="login-password-input"
                inputRef={passwordRef}
                name="login-password"
              />

              {/* Remember Me + Forgot Password Row */}
              <div className="flex items-center justify-between pt-1">
                {/* Remember Me Toggle */}
                <motion.button
                  type="button"
                  data-testid="remember-me-toggle"
                  className="flex items-center gap-2.5"
                  onClick={() => setRememberMe(!rememberMe)}
                  whileTap={{ scale: 0.98 }}
                >
                  <div 
                    className={`w-10 h-5 rounded-full relative transition-all duration-200 ${
                      rememberMe 
                        ? "bg-[#00C2FF]" 
                        : "bg-white/[0.08] border border-white/[0.1]"
                    }`}
                  >
                    <motion.div
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                      animate={{ left: rememberMe ? "calc(100% - 18px)" : "2px" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </div>
                  <span className={`text-[11px] font-medium ${rememberMe ? "text-white/80" : "text-white/55"}`}>
                    {t("auth.remember_me") || "Angemeldet bleiben"}
                  </span>
                </motion.button>

                {/* Forgot Password Link */}
                <motion.button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-[11px] text-[#00C2FF] font-medium"
                  whileTap={{ scale: 0.98 }}
                >
                  {t("auth.forgot") || "Passwort vergessen?"}
                </motion.button>
              </div>

              {/* Error */}
              <AnimatePresence>
                {(forgotError || user.error) && (
                  <motion.div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,71,87,0.06)", border: "1px solid rgba(255,71,87,0.12)" }}
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                  >
                    <AlertCircle size={13} className="text-[#FF4757] flex-shrink-0" />
                    <p className="text-[11px] text-[#FF4757] font-medium">{forgotError || user.error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Login Button */}
              <motion.button
                data-testid="login-submit-btn"
                type="submit"
                onMouseDownCapture={captureLoginSnapshot}
                onTouchStartCapture={captureLoginSnapshot}
                onPointerDownCapture={captureLoginSnapshot}
                disabled={user.isLoading || forgotLoading}
                className="mt-2 flex w-[88%] mx-auto items-center justify-center gap-1 rounded-[12px] bg-[#00C2FF] py-[10px] text-[11px] font-semibold text-[#020202] disabled:opacity-50"
                style={{ boxShadow: "0 6px 36px rgba(0,194,255,0.3), 0 2px 10px rgba(0,194,255,0.15)" }}
                whileTap={!user.isLoading ? { scale: 0.96 } : {}}
              >
                {user.isLoading || forgotLoading ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <Loader2 size={15} />
                    </motion.div>
                    {t("auth.signing") || "Anmeldung..."}
                  </>
                ) : (
                  <>
                    {t("auth.signin") || "Anmelden"} <ArrowRight size={12} strokeWidth={2.5} />
                  </>
                )}
              </motion.button>

              {/* Switch to register */}
              <motion.p
                className="text-center text-[12px] text-white/50 mt-4 pt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {t("auth.no_account") || "Noch kein Konto?"}{" "}
                <button
                  type="button"
                  data-testid="switch-to-register-btn"
                  className="text-[#00C2FF] font-semibold hover:underline"
                  onClick={() => switchMode("register")}
                >
                  {t("auth.create_link") || "Registrieren"}
                </button>
              </motion.p>
            </motion.form>
          ) : (
            <motion.form
              key="register"
              onSubmit={handleRegister}
              className="space-y-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={slide}
            >
              <Field
                icon={User}
                type="text"
                value={name}
                onChange={setName}
                placeholder={t("auth.name") || "Vollständiger Name"}
                testId="register-name-input"
                autoFocus
              />
              <Field
                icon={Mail}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder={t("auth.email") || "E-Mail-Adresse"}
                testId="register-email-input"
              />
              <Field
                icon={Lock}
                type="password"
                value={password}
                onChange={setPassword}
                placeholder={t("auth.password") || "Passwort"}
                testId="register-password-input"
              />
              <Field
                icon={Lock}
                type="password"
                value={confirm}
                onChange={setConfirm}
                placeholder={t("auth.confirm") || "Passwort bestätigen"}
                testId="register-confirm-password-input"
              />

              {/* Role Selector */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={slide}>
                <div className="flex items-center gap-3 px-4 py-[14px] rounded-[14px] bg-white/[0.02] border border-white/[0.05]">
                  <Shield size={16} strokeWidth={1.5} className="text-white/70" />
                  <select
                    data-testid="register-role-select"
                    value={requestedRole}
                    onChange={e => setRequestedRole(e.target.value)}
                    className="flex-1 bg-transparent text-[13px] text-white/90 font-medium outline-none appearance-none cursor-pointer"
                    style={{ WebkitAppearance: "none" }}
                  >
                    <option value="customer" style={{ background: "#111", color: "#fff" }}>{t("role.customer") || "Customer"}</option>
                    <option value="merchant" style={{ background: "#111", color: "#fff" }}>{t("role.merchant") || "Merchant"}</option>
                    <option value="influencer" style={{ background: "#111", color: "#fff" }}>{t("role.influencer") || "Influencer"}</option>
                    <option value="manager" style={{ background: "#111", color: "#fff" }}>{t("role.manager") || "Manager"}</option>
                    <option value="investor" style={{ background: "#111", color: "#fff" }}>{t("role.investor") || "Investor"}</option>
                  </select>
                </div>
                {requestedRole !== "customer" && (
                  <p className="text-[9px] text-[#FFB800] mt-1 pl-1">{t("role.pending_hint") || "Role requires admin approval"}</p>
                )}
              </motion.div>

              {/* Error */}
              <AnimatePresence>
                {user.error && (
                  <motion.div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,71,87,0.06)", border: "1px solid rgba(255,71,87,0.12)" }}
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                  >
                    <AlertCircle size={13} className="text-[#FF4757] flex-shrink-0" />
                    <p className="text-[11px] text-[#FF4757] font-medium">{user.error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Register Button */}
              <motion.button
                data-testid="register-submit-btn"
                type="submit"
                disabled={user.isLoading}
                className="w-full py-[13px] rounded-[14px] bg-[#00C2FF] text-[#020202] font-semibold text-[13px] flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                style={{ boxShadow: "0 6px 36px rgba(0,194,255,0.3), 0 2px 10px rgba(0,194,255,0.15)" }}
                whileTap={!user.isLoading ? { scale: 0.96 } : {}}
              >
                {user.isLoading ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <Loader2 size={15} />
                    </motion.div>
                    {t("auth.registering") || "Konto wird erstellt..."}
                  </>
                ) : (
                  <>
                    {t("auth.register") || "Konto erstellen"} <ArrowRight size={15} strokeWidth={2.5} />
                  </>
                )}
              </motion.button>

              {/* Switch to login */}
              <motion.p
                className="text-center text-[12px] text-white/50 mt-4 pt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {t("auth.has_account") || "Bereits ein Konto?"}{" "}
                <button
                  type="button"
                  data-testid="switch-to-login-btn"
                  className="text-[#00C2FF] font-semibold hover:underline"
                  onClick={() => switchMode("login")}
                >
                  {t("auth.signin_link") || "Anmelden"}
                </button>
              </motion.p>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Security badge */}
        <motion.div
          className="mt-5 rounded-[18px] border border-white/[0.08] bg-white/[0.025] px-4 py-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          data-testid="auth-help-card"
        >
          <p className="text-[11px] font-semibold text-white/80 mb-2">Schnellhilfe</p>
          <div className="space-y-1.5">
            {authTips.map((tip, idx) => (
              <div key={idx} className="flex items-start gap-2 text-[10px] text-white/55">
                <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-[#00C2FF] shrink-0" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="flex items-center justify-center gap-1.5 mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Shield size={10} className="text-[#00D26A]/50" />
          <span className="text-[10px] text-white/40 font-medium">Secured with end-to-end encryption</span>
        </motion.div>
      </div>

      <KYCVerificationModal
        open={showKYC}
        onClose={() => setShowKYC(false)}
        onComplete={handleKYCComplete}
      />
    </motion.div>
  );
};

export default AuthPage;
