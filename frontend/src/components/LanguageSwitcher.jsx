import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Check } from "lucide-react";
import { useI18n, LANGUAGES } from "../store";

const slide = { duration: 0.2, ease: [0.32, 0.72, 0, 1] };

// Filter out sq-XK (handled internally as sq)
const displayLangs = LANGUAGES.filter(l => l.code !== "sq-XK");

export const LanguageSwitcher = () => {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = displayLangs.find(l => l.code === lang) || displayLangs[0];

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (code) => {
    setLang(code);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative" data-testid="language-switcher">
      <motion.button
        data-testid="language-switcher-btn"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all"
        style={{
          background: open ? "rgba(0,194,255,0.08)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${open ? "rgba(0,194,255,0.15)" : "rgba(255,255,255,0.05)"}`,
        }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen(!open)}
      >
        <Globe size={13} strokeWidth={1.5} className={open ? "text-[#00C2FF]" : "text-white/40"} />
        <span className="text-[11px] font-semibold tracking-wide" style={{ color: open ? "#00C2FF" : "rgba(255,255,255,0.6)" }}>
          {current.flag}
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            data-testid="language-dropdown"
            className="absolute top-full right-0 mt-2 w-[200px] max-h-[320px] overflow-y-auto rounded-2xl z-50 scrollbar-hide"
            style={{
              background: "rgba(12,12,12,0.98)",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
              backdropFilter: "blur(24px)",
            }}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={slide}
          >
            <div className="p-1.5">
              {displayLangs.map((l) => {
                const active = l.code === lang;
                return (
                  <motion.button
                    key={l.code}
                    data-testid={`lang-option-${l.code}`}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors"
                    style={{
                      background: active ? "rgba(0,194,255,0.08)" : "transparent",
                    }}
                    whileHover={{ backgroundColor: active ? "rgba(0,194,255,0.1)" : "rgba(255,255,255,0.03)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect(l.code)}
                  >
                    <span className="text-[13px] w-6 text-center flex-shrink-0">{l.flag}</span>
                    <span
                      className="text-[12px] font-medium flex-1"
                      style={{ color: active ? "#00C2FF" : "rgba(255,255,255,0.65)" }}
                    >
                      {l.label}
                    </span>
                    {active && <Check size={13} className="text-[#00C2FF] flex-shrink-0" />}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageSwitcher;
