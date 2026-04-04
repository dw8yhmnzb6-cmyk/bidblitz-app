import { motion } from "framer-motion";
import { LogIn, UserPlus, FlaskConical } from "lucide-react";

const slide = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

export const GuestCTABar = ({ onLogin, onRegister, onStartDemo, isDemoMode }) => (
  <motion.div
    data-testid="guest-cta-bar"
    className="flex items-center gap-2 px-5 py-3 mb-1"
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.08, ...slide }}
  >
    <motion.button
      data-testid="page-register-btn"
      className="flex-1 py-[10px] rounded-xl bg-[#00C2FF] text-[#020202] font-semibold text-[11px] flex items-center justify-center gap-1.5"
      style={{ boxShadow: "0 4px 20px rgba(0,194,255,0.2)" }}
      whileTap={{ scale: 0.95 }}
      onClick={onRegister}
    >
      <UserPlus size={13} strokeWidth={2} />
      Register
    </motion.button>
    <motion.button
      data-testid="page-login-btn"
      className="flex-1 py-[10px] rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#fff" }}
      whileTap={{ scale: 0.95 }}
      onClick={onLogin}
    >
      <LogIn size={13} strokeWidth={2} />
      Login
    </motion.button>
    {!isDemoMode && (
      <motion.button
        data-testid="page-demo-btn"
        className="py-[10px] px-3 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5"
        style={{ background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.12)", color: "#FFB800" }}
        whileTap={{ scale: 0.95 }}
        onClick={onStartDemo}
      >
        <FlaskConical size={13} strokeWidth={1.8} />
        Demo
      </motion.button>
    )}
  </motion.div>
);

export default GuestCTABar;
