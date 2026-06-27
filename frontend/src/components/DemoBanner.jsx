import { motion } from "framer-motion";
import { FlaskConical, X } from "lucide-react";

export const DemoBanner = ({ onExit }) => (
  <motion.div
    data-testid="demo-banner"
    className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 py-2"
    style={{
      background: "linear-gradient(90deg, rgba(255,184,0,0.12) 0%, rgba(255,184,0,0.06) 100%)",
      borderBottom: "1px solid rgba(255,184,0,0.15)",
      backdropFilter: "blur(16px)",
    }}
    initial={{ y: -40, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: -40, opacity: 0 }}
    transition={{ type: "spring", stiffness: 400, damping: 30 }}
  >
    <div className="flex items-center gap-2">
      <FlaskConical size={13} className="text-[#FFB800]" />
      <span className="text-[11px] font-semibold text-[#FFB800] tracking-wide uppercase">
        Vorschau
      </span>
      <span className="text-[10px] text-[#FFB800]/60 font-medium hidden sm:inline">
        — keine Live-Transaktionen
      </span>
    </div>
    <motion.button
      data-testid="demo-exit-btn"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
      style={{
        background: "rgba(255,184,0,0.1)",
        border: "1px solid rgba(255,184,0,0.2)",
        color: "#FFB800",
      }}
      whileTap={{ scale: 0.92 }}
      onClick={onExit}
    >
      Schließen
      <X size={10} />
    </motion.button>
  </motion.div>
);

export default DemoBanner;
