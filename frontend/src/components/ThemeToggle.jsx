import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../store/ThemeContext";

/**
 * Premium Dark/Light Mode Toggle
 * Animated switch with sun/moon icons.
 */
export const ThemeToggle = ({ compact = false }) => {
  const { isDark, toggle } = useTheme();

  return (
    <motion.button
      data-testid="theme-toggle-btn"
      onClick={toggle}
      className={`relative flex items-center ${compact ? "gap-2 px-3 py-1.5" : "gap-3 px-4 py-3"} rounded-full`}
      style={{
        background: isDark ? "rgba(255,255,255,0.04)" : "#F1F3F5",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#E8EBF0"}`,
      }}
      whileTap={{ scale: 0.96 }}
    >
      <div
        className={`${compact ? "w-8 h-4" : "w-10 h-5"} rounded-full relative transition-colors`}
        style={{ background: isDark ? "#00C2FF" : "#FFB800" }}
      >
        <motion.div
          className={`absolute top-0.5 ${compact ? "w-3 h-3" : "w-4 h-4"} rounded-full bg-white shadow flex items-center justify-center`}
          animate={{ left: isDark ? `calc(100% - ${compact ? "14px" : "18px"})` : "2px" }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          {isDark ? <Moon size={compact ? 7 : 9} className="text-[#0088CC]" /> : <Sun size={compact ? 7 : 9} className="text-[#FF8C00]" />}
        </motion.div>
      </div>
      {!compact && (
        <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
          {isDark ? "Dunkler Modus" : "Heller Modus"}
        </span>
      )}
    </motion.button>
  );
};

export default ThemeToggle;
