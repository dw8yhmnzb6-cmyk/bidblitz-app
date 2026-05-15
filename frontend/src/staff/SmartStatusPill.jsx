/**
 * SmartStatusPill — moderner Live-Status mit Animation.
 *
 * Status-Werte (kombiniert clock + geofence presence):
 *   working   – aktiv arbeitend
 *   break     – in Pause
 *   arrived   – angekommen, noch nicht eingecheckt
 *   approaching – in Annäherung (Radius x3)
 *   off       – Feierabend / nicht aktiv
 *   commuting – unterwegs (Platzhalter, künftig Bewegungserkennung)
 */
import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Coffee, MapPin, Navigation, Moon, Activity } from "lucide-react";

const CONFIG = {
  working:     { label: "Aktiv",       color: "#10B981", soft: "#D1FAE5", icon: CheckCircle2, dot: true },
  break:       { label: "Pause",       color: "#F59E0B", soft: "#FEF3C7", icon: Coffee,       dot: true },
  arrived:     { label: "Angekommen",  color: "#0EA5E9", soft: "#E0F2FE", icon: MapPin,       dot: true },
  approaching: { label: "In Nähe",     color: "#A855F7", soft: "#F3E8FF", icon: Navigation,   dot: true },
  commuting:   { label: "Unterwegs",   color: "#6366F1", soft: "#E0E7FF", icon: Navigation,   dot: true },
  off:         { label: "Feierabend",  color: "#64748B", soft: "#F1F5F9", icon: Moon,         dot: false },
  unknown:     { label: "Bereit",      color: "#64748B", soft: "#F1F5F9", icon: Activity,     dot: false },
};

export function SmartStatusPill({ status = "unknown", label, size = "md", testid = "smart-status-pill" }) {
  const cfg = CONFIG[status] || CONFIG.unknown;
  const Icon = cfg.icon;
  const sizes = {
    sm: { box: "px-2.5 py-1 text-[11px] gap-1.5", icon: 11 },
    md: { box: "px-3 py-1.5 text-xs gap-2",       icon: 13 },
    lg: { box: "px-4 py-2 text-sm gap-2",         icon: 15 },
  };
  const s = sizes[size] || sizes.md;
  return (
    <motion.span
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid={testid}
      className={`inline-flex items-center rounded-full font-bold border ${s.box}`}
      style={{ background: cfg.soft, color: cfg.color, borderColor: `${cfg.color}33` }}
    >
      {cfg.dot ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping" style={{ background: cfg.color }} />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: cfg.color }} />
        </span>
      ) : (
        <Icon size={s.icon} />
      )}
      {label || cfg.label}
    </motion.span>
  );
}

export default SmartStatusPill;
