import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Baby, Store, ChevronDown, Check, Lock } from "lucide-react";
import { useUser } from "../store";

const MODE_CONFIG = {
  personal: { label: "Persoenlich", icon: User, color: "#00C2FF", bg: "rgba(0,194,255,0.12)" },
  kids: { label: "Kids", icon: Baby, color: "#F472B6", bg: "rgba(244,114,182,0.12)" },
  merchant: { label: "Haendler", icon: Store, color: "#FFB800", bg: "rgba(255,184,0,0.12)" },
};

const ModeSwitcher = ({ onModeChange }) => {
  const user = useUser();
  const [open, setOpen] = useState(false);

  if (!user.isAuthenticated || user.modes.length <= 1) return null;

  const current = MODE_CONFIG[user.currentMode] || MODE_CONFIG.personal;
  const CurrentIcon = current.icon;

  const handleSelect = (mode) => {
    if (mode !== user.currentMode && user.modes.includes(mode)) {
      user.setMode(mode);
      if (onModeChange) onModeChange(mode);
    }
    setOpen(false);
  };

  return (
    <div className="relative" data-testid="mode-switcher">
      <motion.button
        data-testid="mode-switcher-trigger"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
        style={{ background: current.bg, border: `1px solid ${current.color}25` }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
      >
        <CurrentIcon size={13} strokeWidth={2} style={{ color: current.color }} />
        <span className="text-[10px] font-bold" style={{ color: current.color }}>{current.label}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={10} style={{ color: current.color }} />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="absolute top-full right-0 mt-2 z-50 rounded-2xl p-1.5 min-w-[180px]"
              style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              {Object.entries(MODE_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon;
                const isActive = key === user.currentMode;
                const hasAccess = user.modes.includes(key);

                return (
                  <motion.button
                    key={key}
                    data-testid={`mode-option-${key}`}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                    style={{
                      background: isActive ? cfg.bg : "transparent",
                      opacity: hasAccess ? 1 : 0.35,
                    }}
                    whileTap={hasAccess ? { scale: 0.97 } : {}}
                    onClick={() => hasAccess && handleSelect(key)}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}20` }}
                    >
                      <Icon size={15} strokeWidth={1.8} style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[12px] font-semibold text-white">{cfg.label}</p>
                    </div>
                    {isActive && <Check size={14} style={{ color: cfg.color }} />}
                    {!hasAccess && <Lock size={12} className="text-white/30" />}
                  </motion.button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModeSwitcher;
