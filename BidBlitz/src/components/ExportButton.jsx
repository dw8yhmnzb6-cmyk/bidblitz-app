import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Loader2, Check, AlertCircle } from "lucide-react";

const ExportButton = ({ label, onExport, testId, compact = false }) => {
  const [state, setState] = useState("idle"); // idle | loading | success | error

  const handleClick = async () => {
    if (state === "loading") return;
    setState("loading");
    try {
      await onExport();
      setState("success");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  };

  const icon = {
    idle: <Download size={14} strokeWidth={1.8} />,
    loading: <Loader2 size={14} className="animate-spin" />,
    success: <Check size={14} />,
    error: <AlertCircle size={14} />,
  }[state];

  const bg = {
    idle: "rgba(0,194,255,0.06)",
    loading: "rgba(0,194,255,0.08)",
    success: "rgba(0,210,106,0.1)",
    error: "rgba(255,75,75,0.1)",
  }[state];

  const border = {
    idle: "rgba(0,194,255,0.12)",
    loading: "rgba(0,194,255,0.15)",
    success: "rgba(0,210,106,0.2)",
    error: "rgba(255,75,75,0.2)",
  }[state];

  const color = {
    idle: "#00C2FF",
    loading: "#00C2FF",
    success: "#00D26A",
    error: "#FF4B4B",
  }[state];

  return (
    <motion.button
      data-testid={testId}
      className={`flex items-center gap-2 rounded-xl font-medium transition-all duration-200 ${
        compact ? "px-3 py-2 text-[11px]" : "px-4 py-2.5 text-[12px]"
      }`}
      style={{ background: bg, border: `1px solid ${border}`, color }}
      whileTap={{ scale: 0.96 }}
      onClick={handleClick}
      disabled={state === "loading"}
    >
      {icon}
      {label}
    </motion.button>
  );
};

export default ExportButton;
