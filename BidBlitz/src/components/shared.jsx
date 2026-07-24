/**
 * BidBlitz V2 — Shared UI pattern components.
 * Standardized loading, empty, error, and success states
 * used consistently across all pages.
 */

import { motion } from "framer-motion";
import { Clock, AlertCircle, CheckCircle2 } from "lucide-react";

// ── Skeleton Shimmer ──
export const Skeleton = ({ className = "", style }) => (
  <div
    className={`relative overflow-hidden rounded-xl ${className}`}
    style={{ background: "rgba(255,255,255,0.025)", ...style }}
  >
    <motion.div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
      }}
      animate={{ x: ["-100%", "100%"] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);

// ── Empty State ──
export const EmptyState = ({
  icon: Icon = Clock,
  title = "Nothing here yet",
  description = "",
  action,
  actionLabel,
}) => (
  <motion.div
    data-testid="empty-state"
    className="py-12 text-center rounded-2xl"
    style={{
      background: "rgba(255,255,255,0.012)",
      border: "1px solid rgba(255,255,255,0.03)",
    }}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.03] flex items-center justify-center">
      <Icon size={20} className="text-[#2A2A2A]" />
    </div>
    <p className="text-[13px] text-[#333] font-medium mb-1">{title}</p>
    {description && (
      <p className="text-[11px] text-[#222]">{description}</p>
    )}
    {action && actionLabel && (
      <motion.button
        className="mt-4 px-4 py-2 rounded-xl bg-[#00C2FF] text-[#020202] text-[12px] font-semibold"
        whileTap={{ scale: 0.95 }}
        onClick={action}
      >
        {actionLabel}
      </motion.button>
    )}
  </motion.div>
);

// ── Error Inline ──
export const ErrorInline = ({ message, onRetry }) => (
  <motion.div
    data-testid="error-inline"
    className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
    style={{
      background: "rgba(255,71,87,0.06)",
      border: "1px solid rgba(255,71,87,0.12)",
    }}
    initial={{ opacity: 0, y: -6 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <AlertCircle size={13} className="text-[#FF4757] flex-shrink-0" />
    <p className="text-[11px] text-[#FF4757] font-medium flex-1">{message}</p>
    {onRetry && (
      <motion.button
        className="text-[10px] text-[#FF4757] font-bold underline"
        whileTap={{ scale: 0.9 }}
        onClick={onRetry}
      >
        Retry
      </motion.button>
    )}
  </motion.div>
);

// ── Success Inline ──
export const SuccessInline = ({ message }) => (
  <motion.div
    data-testid="success-inline"
    className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
    style={{
      background: "rgba(0,210,106,0.06)",
      border: "1px solid rgba(0,210,106,0.12)",
    }}
    initial={{ opacity: 0, y: -6 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <CheckCircle2 size={13} className="text-[#00D26A] flex-shrink-0" />
    <p className="text-[11px] text-[#00D26A] font-medium">{message}</p>
  </motion.div>
);

// ── Section Header ──
export const SectionHeader = ({ title, action, actionLabel }) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-[13px] font-semibold font-outfit text-white">{title}</h3>
    {actionLabel && (
      <motion.span
        className="text-[11px] text-[#00C2FF] font-medium cursor-pointer"
        whileHover={{ x: 3 }}
        onClick={action}
      >
        {actionLabel}
      </motion.span>
    )}
  </div>
);

// ── Page Header (back + title) ──
export const PageHeader = ({ title, subtitle, onBack, right }) => (
  <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
    <div className="flex items-center gap-3">
      {onBack && (
        <motion.button
          data-testid="page-back-btn"
          className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          whileTap={{ scale: 0.88 }}
          onClick={onBack}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </motion.button>
      )}
      <div>
        <motion.h1
          className="text-[15px] font-semibold font-outfit text-white tracking-tight"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            className="text-[10px] text-[#333] font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {subtitle}
          </motion.p>
        )}
      </div>
    </div>
    {right}
  </div>
);

// ── Glass Card wrapper ──
export const GlassCard = ({ children, className = "", ...props }) => (
  <motion.div
    className={`rounded-2xl overflow-hidden ${className}`}
    style={{
      background: "rgba(255,255,255,0.015)",
      border: "1px solid rgba(255,255,255,0.035)",
    }}
    {...props}
  >
    {children}
  </motion.div>
);
