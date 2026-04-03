import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../store/AuthContext";

const AuthPage = () => {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        if (!name.trim()) {
          setError("Name is required");
          setLoading(false);
          return;
        }
        await register(email, password, name);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #0A0A0A 0%, #050505 100%)" }}
    >
      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl bg-[#00C2FF]/8 pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl bg-[#00C2FF]/5 pointer-events-none" />

      <motion.div
        className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Logo */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-3xl font-bold font-outfit tracking-tight text-white mb-1">
            Bid<span className="text-[#00C2FF]">Blitz</span>
          </h1>
          <p className="text-[#555] text-sm">Your premium fintech wallet</p>
        </motion.div>

        {/* Form */}
        <AnimatePresence mode="wait">
          <motion.form
            key={mode}
            onSubmit={handleSubmit}
            className="space-y-4"
            initial={{ opacity: 0, x: mode === "login" ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === "login" ? 20 : -20 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-xl font-semibold font-outfit text-white mb-6">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h2>

            {/* Name field (register only) */}
            {mode === "register" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]"
                  />
                  <input
                    data-testid="auth-name-input"
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-[#111] border border-white/5 text-white text-sm placeholder:text-[#444] outline-none focus:border-[#00C2FF]/30 transition-colors"
                  />
                </div>
              </motion.div>
            )}

            {/* Email */}
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]"
              />
              <input
                data-testid="auth-email-input"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-[#111] border border-white/5 text-white text-sm placeholder:text-[#444] outline-none focus:border-[#00C2FF]/30 transition-colors"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]"
              />
              <input
                data-testid="auth-password-input"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full pl-11 pr-12 py-3.5 rounded-xl bg-[#111] border border-white/5 text-white text-sm placeholder:text-[#444] outline-none focus:border-[#00C2FF]/30 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555]"
                data-testid="toggle-password-btn"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Error */}
            {error && (
              <motion.p
                data-testid="auth-error"
                className="text-[#FF4757] text-sm text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {error}
              </motion.p>
            )}

            {/* Submit */}
            <motion.button
              data-testid="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-[#00C2FF] to-[#00A8CC] text-[#0A0A0A] font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              style={{ boxShadow: "0 6px 24px rgba(0, 194, 255, 0.3)" }}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <span>{mode === "login" ? "Sign In" : "Create Account"}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </motion.button>

            {/* Switch mode */}
            <p className="text-center text-[#555] text-sm mt-4">
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={switchMode}
                className="text-[#00C2FF] font-medium"
                data-testid="auth-switch-mode"
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </motion.form>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default AuthPage;
