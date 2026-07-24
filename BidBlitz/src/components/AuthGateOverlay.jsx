import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock } from "lucide-react";
import { useUser, useI18n } from "../store";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export const AuthGateOverlay = ({ isOpen, onClose, message, initialMode }) => {
  const [mode, setMode] = useState(initialMode || "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const user = useUser();
  const { t } = useI18n();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const ok = await user.login(email, password);
        if (!ok) throw new Error(user.error || "Anmeldung fehlgeschlagen");
        toast.success(t("auth.welcome_back") || "Welcome back!");
      } else {
        const ok = await user.register(name, email, password, password, "customer");
        if (!ok) throw new Error(user.error || "Registrierung fehlgeschlagen");
        toast.success(t("auth.welcome") || "Welcome to BidBlitz!");
      }
      onClose();
    } catch (err) {
      toast.error(err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        data-testid="auth-gate-overlay"
        className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        {/* Sheet */}
        <motion.div
          className="relative w-full max-w-[420px] rounded-t-[24px] sm:rounded-[24px] p-6 pb-8"
          style={{
            background: "#0A0A0A",
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
          }}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 350 }}
        >
          {/* Close */}
          <button
            data-testid="auth-gate-close"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center"
            onClick={onClose}
          >
            <X size={14} className="text-white/40" />
          </button>

          {/* Lock icon + message */}
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(0,194,255,0.08)", border: "1px solid rgba(0,194,255,0.15)" }}
            >
              <Lock size={16} className="text-[#00C2FF]" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white font-outfit">
                {mode === "login" ? (t("auth.signin") || "Sign In") : (t("auth.create") || "Create Account")}
              </p>
              <p className="text-[10px] text-[#555]">{message || (t("auth.gate_hint") || "Sign in to use this feature")}</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <input
                data-testid="gate-name"
                className="w-full px-4 py-3 rounded-xl text-[13px] text-white bg-white/[0.03] border border-white/[0.06] outline-none focus:border-[#00C2FF]/30 placeholder:text-[#333] font-outfit"
                placeholder={t("auth.name_placeholder") || "Full Name"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            <input
              data-testid="gate-email"
              type="email"
              className="w-full px-4 py-3 rounded-xl text-[13px] text-white bg-white/[0.03] border border-white/[0.06] outline-none focus:border-[#00C2FF]/30 placeholder:text-[#333] font-outfit"
              placeholder={t("auth.email_placeholder") || "Email"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              data-testid="gate-password"
              type="password"
              className="w-full px-4 py-3 rounded-xl text-[13px] text-white bg-white/[0.03] border border-white/[0.06] outline-none focus:border-[#00C2FF]/30 placeholder:text-[#333] font-outfit"
              placeholder={t("auth.password_placeholder") || "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {mode === "register" && (
              <input
                data-testid="gate-invite"
                className="w-full px-4 py-3 rounded-xl text-[13px] text-white bg-white/[0.03] border border-white/[0.06] outline-none focus:border-[#00C2FF]/30 placeholder:text-[#333] font-outfit"
                placeholder={t("auth.invite_placeholder") || "Invite Code (optional)"}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
            )}
            <motion.button
              data-testid="gate-submit"
              type="submit"
              className="w-full py-3 rounded-xl bg-[#00C2FF] text-[#020202] font-semibold text-[13px] font-outfit"
              style={{ boxShadow: "0 4px 20px rgba(0,194,255,0.25)" }}
              whileTap={{ scale: 0.97 }}
              disabled={loading}
            >
              {loading ? "..." : mode === "login" ? (t("auth.signin") || "Sign In") : (t("auth.create") || "Create Account")}
            </motion.button>
          </form>

          {/* Toggle mode */}
          <p className="text-center text-[11px] text-[#444] mt-4">
            {mode === "login" ? (t("auth.no_account") || "No account?") : (t("auth.has_account") || "Already registered?")}
            {" "}
            <button
              data-testid="gate-toggle-mode"
              className="text-[#00C2FF] font-medium"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? (t("auth.create") || "Create Account") : (t("auth.signin") || "Sign In")}
            </button>
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AuthGateOverlay;
