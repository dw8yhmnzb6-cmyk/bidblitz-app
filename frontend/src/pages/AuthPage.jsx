import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, Shield
} from "lucide-react";
import { useUser, useI18n } from "../store";

const slide = { duration: 0.35, ease: [0.32, 0.72, 0, 1] };

// Floating input
const Field = ({ icon: Icon, type, value, onChange, placeholder, testId, autoFocus }) => {
  const [focused, setFocused] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const isPw = type === "password";

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={slide}
    >
      <div
        className={`flex items-center gap-3 px-4 py-[14px] rounded-[14px] transition-all duration-200 ${
          focused
            ? "bg-white/[0.04] border border-[#00C2FF]/25"
            : "bg-white/[0.02] border border-white/[0.05]"
        }`}
      >
        <Icon size={16} strokeWidth={1.5} className={focused ? "text-[#00C2FF]" : "text-[#333]"} />
        <input
          data-testid={testId}
          type={isPw && !showPw ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 bg-transparent text-[13px] text-white placeholder:text-[#2A2A2A] outline-none font-medium"
          autoComplete={isPw ? "current-password" : "email"}
        />
        {isPw && value && (
          <motion.button
            type="button"
            className="text-[#333] hover:text-[#555] transition-colors"
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

export const AuthPage = ({ onBack, initialMode }) => {
  const [mode, setMode] = useState(initialMode || "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [requestedRole, setRequestedRole] = useState("customer");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const { t } = useI18n();

  const user = useUser();

  const handleLogin = async (e) => {
    e.preventDefault();
    await user.login(email, password);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const ok = await user.register(name, email, password, confirm, requestedRole);
    if (ok) {
      // auto-logged in
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    // TODO: Backend integration
    setForgotSent(true);
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
        className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ filter: "blur(140px)", background: "rgba(0,194,255,0.05)" }}
      />

      <div className="flex-1 flex flex-col justify-center px-6 py-10 relative z-10 max-w-[400px] mx-auto w-full">

        {/* ── Back Button (when opened from public browsing) ── */}
        {onBack && (
          <motion.button
            data-testid="auth-back-btn"
            className="absolute top-[max(env(safe-area-inset-top,0px),16px)] left-4 z-20 flex items-center gap-1.5 text-[12px] text-[#555] font-medium"
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
            className="text-[12px] text-[#333] font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.22 }}
          >
            {mode === "login" ? t("auth.welcome") || "Willkommen zurück" : t("auth.create") || "Konto erstellen"}
          </motion.p>
        </motion.div>

        {/* ── Form ── */}
        <AnimatePresence mode="wait">
          {mode === "login" ? (
            <motion.form
              key="login"
              onSubmit={handleLogin}
              className="space-y-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={slide}
            >
              <Field
                icon={Mail}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder={t("auth.email") || "E-Mail-Adresse"}
                testId="login-email-input"
                autoFocus
              />
              <Field
                icon={Lock}
                type="password"
                value={password}
                onChange={setPassword}
                placeholder={t("auth.password") || "Passwort"}
                testId="login-password-input"
              />

              {/* Forgot Password Link */}
              <motion.button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-[11px] text-[#00C2FF] font-medium text-right w-full -mt-1"
                whileTap={{ scale: 0.98 }}
              >
                {t("auth.forgot") || "Passwort vergessen?"}
              </motion.button>

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

              {/* Login Button */}
              <motion.button
                data-testid="login-submit-btn"
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
                    {t("auth.signing") || "Anmeldung..."}
                  </>
                ) : (
                  <>
                    {t("auth.signin") || "Anmelden"} <ArrowRight size={15} strokeWidth={2.5} />
                  </>
                )}
              </motion.button>

              {/* Switch to register */}
              <motion.p
                className="text-center text-[12px] text-[#444] mt-4 pt-2"
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
                testId="register-confirm-input"
              />

              {/* Role Selector */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={slide}>
                <div className="flex items-center gap-3 px-4 py-[14px] rounded-[14px] bg-white/[0.02] border border-white/[0.05]">
                  <Shield size={16} strokeWidth={1.5} className="text-[#333]" />
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
                className="text-center text-[12px] text-[#444] mt-4 pt-2"
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
          className="flex items-center justify-center gap-1.5 mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Shield size={10} className="text-[#00D26A]/50" />
          <span className="text-[10px] text-[#222] font-medium">Secured with end-to-end encryption</span>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default AuthPage;
