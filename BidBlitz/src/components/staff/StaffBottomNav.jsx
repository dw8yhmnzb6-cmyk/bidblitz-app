/**
 * Staff Mobile — Bottom Navigation (Floating Premium Pill)
 * =========================================================
 * 5 Tabs: Home / Shifts / Tasks / Wallet / Profile
 * Floating glassmorphic style — iOS-feeling.
 */
import React from "react";
import { motion } from "framer-motion";
import { Home, Calendar, ListChecks, Wallet, User, Fingerprint } from "lucide-react";

const TABS = [
  { id: "home", label: "Home", Icon: Home },
  { id: "shifts", label: "Schichten", Icon: Calendar },
  { id: "biotime", label: "BioTime", Icon: Fingerprint },
  { id: "tasks", label: "Aufgaben", Icon: ListChecks },
  { id: "wallet", label: "Wallet", Icon: Wallet },
  { id: "profile", label: "Profil", Icon: User },
];

export default function StaffBottomNav({ tab, onTab, taskBadge = 0 }) {
  return (
    <nav
      data-testid="staff-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
    >
      <div className="max-w-md mx-auto px-4 pointer-events-auto">
        <div
          className="relative grid rounded-[28px] overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))`,
            background: "linear-gradient(180deg, rgba(20,21,28,0.92) 0%, rgba(11,12,16,0.96) 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            boxShadow: "0 22px 50px -10px rgba(0,0,0,0.65), 0 2px 0 rgba(255,255,255,0.04) inset",
          }}
        >
          {/* Active indicator pill */}
          <motion.div
            layout
            className="absolute top-1.5 bottom-1.5 rounded-[20px] pointer-events-none"
            initial={false}
            animate={{ left: `calc(${Math.max(0, TABS.findIndex((t) => t.id === tab))} * ${100 / TABS.length}%)`, width: `${100 / TABS.length}%` }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            style={{
              background: "linear-gradient(135deg, rgba(0,212,255,0.16) 0%, rgba(126,91,246,0.16) 100%)",
              boxShadow: "inset 0 0 0 1px rgba(0,212,255,0.32)",
            }}
          />

          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            const showBadge = id === "tasks" && taskBadge > 0;
            return (
              <button
                key={id}
                onClick={() => onTab(id)}
                data-testid={`staff-nav-${id}`}
                className="relative py-2.5 flex flex-col items-center justify-center gap-1 touch-manipulation active:scale-95 transition-transform"
              >
                <div className="relative">
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.4 : 2}
                    className={`transition-colors ${active ? "text-[#00D4FF]" : "text-white/40"}`}
                    style={active ? { filter: "drop-shadow(0 0 6px rgba(0,212,255,0.6))" } : null}
                  />
                  {showBadge && (
                    <span
                      data-testid="staff-nav-task-badge"
                      className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#F31260] text-white text-[9px] font-bold flex items-center justify-center"
                      style={{ boxShadow: "0 0 10px rgba(243,18,96,0.6)" }}
                    >
                      {taskBadge > 9 ? "9+" : taskBadge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold tracking-wide transition-colors ${active ? "text-white" : "text-white/40"}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
