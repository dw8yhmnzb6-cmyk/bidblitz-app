/**
 * Staff UI Component Library — Single source of truth.
 * Verwende diese statt eigener Card/Button-Styles.
 *
 * Alle Komponenten:
 *   - light-theme by default
 *   - mobile-first (44/56px touch targets)
 *   - keine hardcoded Farben — Tokens aus ./tokens
 *   - data-testid auf jeder interaktiven Stelle
 */
import React from "react";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { BUTTON_SIZE, STATUS_COLORS } from "./tokens";

// ═══════════════════════════════════════════════════════════
// StaffCard — base container for content groups
// ═══════════════════════════════════════════════════════════
export function StaffCard({ children, className = "", as: As = "div", testid, padded = true, interactive = false }) {
  const baseCls =
    "bg-white border border-slate-200 rounded-2xl shadow-sm";
  const pad = padded ? "p-5" : "";
  const hover = interactive ? "hover:shadow-md transition-shadow cursor-pointer" : "";
  return (
    <As data-testid={testid} className={`${baseCls} ${pad} ${hover} ${className}`}>
      {children}
    </As>
  );
}

// ═══════════════════════════════════════════════════════════
// StaffButton — primary touch-target enforced
// ═══════════════════════════════════════════════════════════
const VARIANT_CLASSES = {
  primary: "bg-slate-900 text-white hover:bg-slate-700 shadow-md",
  secondary: "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50",
  success: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/25",
  danger: "bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-500/25",
  warning: "bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-500/25",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
  outline: "bg-transparent text-slate-900 border border-slate-300 hover:bg-slate-50",
};

export function StaffButton({
  children, onClick, type = "button", variant = "primary",
  size = "md", disabled, loading, icon, iconRight, fullWidth, testid, className = "",
}) {
  const sizeCls = BUTTON_SIZE[size] || BUTTON_SIZE.md;
  const variantCls = VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary;
  const widthCls = fullWidth ? "w-full" : "";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      data-testid={testid}
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${sizeCls} ${variantCls} ${widthCls} ${className}`}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
      {iconRight}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════
// StaffKpiCard — single big number with label
// ═══════════════════════════════════════════════════════════
export function StaffKpiCard({ label, value, sub, icon, accent = "text-slate-900", testid }) {
  return (
    <StaffCard testid={testid} className="!p-5">
      {icon && (
        <div className="mb-3 inline-flex w-11 h-11 rounded-2xl bg-slate-100 items-center justify-center text-slate-700">
          {icon}
        </div>
      )}
      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{label}</div>
      <div className={`text-3xl font-bold tabular-nums mt-1 ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </StaffCard>
  );
}

// ═══════════════════════════════════════════════════════════
// StaffStatusBadge — pill with semantic color
// ═══════════════════════════════════════════════════════════
export function StaffStatusBadge({ status, label, size = "sm", testid }) {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.off;
  const sizes = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };
  return (
    <span
      data-testid={testid}
      className={`inline-flex items-center font-bold rounded-full ${sizes[size]}`}
      style={{ background: cfg.soft, color: cfg.color }}
    >
      {label || cfg.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════
// StaffPageHeader — sticky header with back, title, actions
// ═══════════════════════════════════════════════════════════
export function StaffPageHeader({ title, subtitle, onBack, right, children }) {
  return (
    <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-lg border-b border-slate-200">
      <div className="px-5 py-4 flex items-center gap-3 max-w-6xl mx-auto">
        {onBack && (
          <button
            onClick={onBack}
            data-testid="staff-header-back"
            className="p-2 -ml-2 rounded-xl hover:bg-slate-200/60 transition"
          >
            <ArrowLeft size={20} className="text-slate-700" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// StaffBottomNav — max 4 items, mobile only
// ═══════════════════════════════════════════════════════════
export function StaffBottomNav({ items, current, onChange }) {
  // Enforce max 4 items rule
  const limited = items.slice(0, 4);
  if (items.length > 4) {
    console.warn("[StaffBottomNav] Mehr als 4 Items übergeben — gekürzt auf 4. Mobile-First Regel.");
  }
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-2 py-2 safe-area-pb">
      <div className="max-w-md mx-auto grid gap-1" style={{ gridTemplateColumns: `repeat(${limited.length}, minmax(0, 1fr))` }}>
        {limited.map((it) => {
          const Icon = it.icon;
          const active = current === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              data-testid={`staff-bottom-${it.id}`}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl min-h-[56px] transition ${
                active ? "text-blue-600" : "text-slate-400"
              }`}
            >
              <Icon size={20} />
              <span className={`text-[10px] font-medium ${active ? "font-bold" : ""}`}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════
// StaffEmptyState — generic empty placeholder
// ═══════════════════════════════════════════════════════════
export function StaffEmptyState({ icon: Icon, title, description, action, testid }) {
  return (
    <div data-testid={testid} className="py-16 px-6 flex flex-col items-center text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Icon size={28} className="text-slate-400" strokeWidth={1.6} />
        </div>
      )}
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-[300px]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// StaffListItem — list row with avatar, content, chevron
// ═══════════════════════════════════════════════════════════
export function StaffListItem({ avatar, title, subtitle, right, badge, onClick, testid }) {
  const Wrap = onClick ? "button" : "div";
  return (
    <Wrap
      onClick={onClick}
      data-testid={testid}
      className={`w-full flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-left ${
        onClick ? "hover:bg-slate-50 transition cursor-pointer" : ""
      }`}
    >
      {avatar && <div className="shrink-0">{avatar}</div>}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-900 truncate">{title}</div>
        {subtitle && <div className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</div>}
      </div>
      {badge}
      {right || (onClick && <ChevronRight size={16} className="text-slate-300 shrink-0" />)}
    </Wrap>
  );
}

// ═══════════════════════════════════════════════════════════
// StaffActionButton — big colored action with icon + subtitle
// ═══════════════════════════════════════════════════════════
const ACTION_COLORS = {
  green:  "from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/25",
  blue:   "from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25",
  orange: "from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/25",
  red:    "from-red-500 to-red-600 text-white shadow-md shadow-red-500/25",
  slate:  "from-slate-100 to-slate-200 text-slate-900 shadow-sm",
};

export function StaffActionButton({ color = "blue", icon, title, subtitle, onClick, disabled, testid }) {
  const cls = `bg-gradient-to-b ${ACTION_COLORS[color]}`;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      className={`w-full flex items-center gap-4 px-5 py-4 min-h-[64px] rounded-2xl font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${cls}`}
    >
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          {icon}
        </div>
      )}
      <div className="flex-1 text-left">
        <p className="text-base font-bold tracking-wide">{title}</p>
        {subtitle && <p className="text-xs font-normal opacity-80">{subtitle}</p>}
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════
// StaffSegmented — pill segmented control (parent or sub tabs)
// ═══════════════════════════════════════════════════════════
export function StaffSegmented({ options, current, onChange, size = "md", testid }) {
  if (options.length > 4) {
    console.warn(`[StaffSegmented] ${options.length} Optionen — Mobile-First Regel: max 4.`);
  }
  const sizeCls = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-sm",
  }[size];
  return (
    <div data-testid={testid} className="inline-flex p-1 rounded-xl bg-white border border-slate-200 shadow-sm">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          data-testid={`segmented-${opt.id}`}
          className={`font-semibold rounded-lg transition whitespace-nowrap ${sizeCls} ${
            current === opt.id
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
