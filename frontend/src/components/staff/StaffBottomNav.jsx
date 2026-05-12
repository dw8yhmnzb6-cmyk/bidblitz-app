/**
 * Staff Mobile — Bottom Navigation
 * =================================
 * 5 Tabs: Home / Shifts / Tasks / Wallet / Profile
 * Mobile-first, große Touch-Targets, Türkis als Aktiv-Farbe.
 */
import React from "react";
import { Home, Calendar, ListChecks, Wallet, User } from "lucide-react";

const TABS = [
  { id: "home", label: "Home", Icon: Home },
  { id: "shifts", label: "Schichten", Icon: Calendar },
  { id: "tasks", label: "Aufgaben", Icon: ListChecks },
  { id: "wallet", label: "Wallet", Icon: Wallet },
  { id: "profile", label: "Profil", Icon: User },
];

export default function StaffBottomNav({ tab, onTab, taskBadge = 0 }) {
  return (
    <nav
      data-testid="staff-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-white/5"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="max-w-md mx-auto grid grid-cols-5">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          const showBadge = id === "tasks" && taskBadge > 0;
          return (
            <button
              key={id}
              onClick={() => onTab(id)}
              data-testid={`staff-nav-${id}`}
              className="relative py-3 flex flex-col items-center justify-center gap-1 touch-manipulation"
            >
              <div
                className={`relative w-11 h-7 rounded-2xl flex items-center justify-center transition-colors ${
                  active ? "bg-[#00D4FF]/15" : ""
                }`}
              >
                <Icon size={20} className={active ? "text-[#00D4FF]" : "text-white/45"} strokeWidth={active ? 2.4 : 2} />
                {showBadge && (
                  <span
                    data-testid="staff-nav-task-badge"
                    className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#EF4444] text-white text-[9px] font-bold flex items-center justify-center"
                  >
                    {taskBadge > 9 ? "9+" : taskBadge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium ${active ? "text-white" : "text-white/45"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
