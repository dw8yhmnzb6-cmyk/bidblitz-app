/**
 * BidBlitz V2 — Shared form input component.
 * Standardized premium input used in login, register, top-up, settings, etc.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";

export const FormInput = ({
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  testId,
  autoFocus,
  autoComplete,
  disabled,
}) => {
  const [focused, setFocused] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const isPw = type === "password";

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
    >
      <div
        className={`flex items-center gap-3 px-4 py-[14px] rounded-[14px] transition-all duration-200 ${
          focused
            ? "bg-white/[0.04] border border-[#00C2FF]/25"
            : "bg-white/[0.02] border border-white/[0.05]"
        } ${disabled ? "opacity-40 pointer-events-none" : ""}`}
      >
        {Icon && (
          <Icon
            size={16}
            strokeWidth={1.5}
            className={focused ? "text-[#00C2FF]" : "text-[#333]"}
          />
        )}
        <input
          data-testid={testId}
          type={isPw && !showPw ? "password" : type === "password" ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 bg-transparent text-[13px] text-white placeholder:text-[#2A2A2A] outline-none font-medium"
          autoComplete={autoComplete || (isPw ? "current-password" : "off")}
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

export default FormInput;
