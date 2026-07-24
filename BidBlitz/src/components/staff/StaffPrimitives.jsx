/**
 * BidBlitz Staff — Premium primitives:
 * StaffSkeleton, StaffEmptyState, StaffStatusPill, GlowDot
 */
import React from "react";
import { motion } from "framer-motion";

export function Skeleton({ className = "", w, h, rounded = "rounded-2xl" }) {
  return (
    <div
      className={`bb-skeleton ${rounded} ${className}`}
      style={{ width: w, height: h }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
      <div className="flex items-center gap-3">
        <Skeleton w={44} h={44} rounded="rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton h={12} rounded="rounded-md" />
          <Skeleton h={10} w="60%" rounded="rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function PremiumEmpty({ icon: Icon, title, sub, action, testId = "staff-empty-state" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      data-testid={testId}
      className="py-12 px-6 flex flex-col items-center text-center"
    >
      <div className="relative mb-5">
        {/* Soft outer glow */}
        <div className="absolute inset-0 rounded-3xl blur-2xl opacity-40"
             style={{ background: "linear-gradient(135deg, #00D4FF40 0%, #7E5BF640 100%)" }} />
        <div className="relative w-24 h-24 rounded-3xl flex items-center justify-center bb-glass">
          {Icon ? <Icon size={36} className="text-white/60" strokeWidth={1.6} /> : null}
        </div>
      </div>
      <h3 className="text-base font-bold tracking-tight">{title}</h3>
      {sub && <p className="text-[12px] text-white/45 mt-1.5 max-w-[280px] leading-relaxed">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function GlowDot({ color = "#10D981", size = 8 }) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <span className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping" style={{ background: color }} />
      <span className="relative inline-flex rounded-full h-full w-full" style={{ background: color, boxShadow: `0 0 12px ${color}AA` }} />
    </span>
  );
}

export function StatusPill({ status }) {
  const map = {
    working:  { label: "Arbeitet",   color: "#10D981" },
    break:    { label: "Pause",      color: "#F5A524" },
    off:      { label: "Off",        color: "#71717A" },
    late:     { label: "Verspätet",  color: "#F31260" },
    approved: { label: "Genehmigt",  color: "#10D981" },
    pending:  { label: "Ausstehend", color: "#F5A524" },
    rejected: { label: "Abgelehnt",  color: "#F31260" },
  };
  const m = map[status] || { label: status, color: "#71717A" };
  return (
    <span
      data-testid={`status-pill-${status}`}
      className="bb-status"
      style={{
        background: `${m.color}1A`,
        color: m.color,
        boxShadow: `inset 0 0 0 1px ${m.color}33`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }} />
      {m.label}
    </span>
  );
}
