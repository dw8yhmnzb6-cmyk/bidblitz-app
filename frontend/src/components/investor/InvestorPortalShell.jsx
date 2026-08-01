import { Building2, CalendarDays, FileText, LayoutGrid, LifeBuoy, LogOut, MessagesSquare, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { InvestorStatusBadge } from "./InvestorStatusBadge";

const navItems = [
  { path: "/investor-portal", label: "Übersicht", icon: LayoutGrid },
  { path: "/investor-portal/documents", label: "Dokumente", icon: FileText },
  { path: "/investor-portal/updates", label: "Updates", icon: Building2 },
  { path: "/investor-portal/questions", label: "Fragen", icon: MessagesSquare },
  { path: "/investor-portal/meetings", label: "Meetings", icon: CalendarDays },
  { path: "/investor-portal/profile", label: "Profil", icon: UserRound },
];

export const InvestorPortalShell = ({ account, title, subtitle, activePath, onNavigate, onLogout, children, extraHeader }) => (
  <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="investor-portal-shell">
    <div className="mx-auto max-w-7xl">
      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.22)]" data-testid="investor-portal-sidebar">
          <div className="rounded-[24px] border border-[#06B6D4]/16 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.12),transparent_34%),linear-gradient(145deg,rgba(3,10,15,0.98),rgba(5,11,18,0.98))] p-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#06B6D4]/20 bg-[#06B6D4]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#9BE8FF]">
              <Building2 size={12} />
              Investor Portal
            </div>
            <h2 className="mt-4 text-2xl font-black text-white" data-testid="investor-portal-sidebar-name">
              {account?.full_name || `${account?.first_name || ""} ${account?.last_name || ""}`.trim() || "Investor"}
            </h2>
            <p className="mt-1 text-sm text-white/65" data-testid="investor-portal-sidebar-email">{account?.email}</p>
            <div className="mt-4">
              <InvestorStatusBadge status={account?.status} dataTestId="investor-portal-sidebar-status" />
            </div>
          </div>

          <nav className="mt-5 space-y-2" data-testid="investor-portal-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activePath === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => onNavigate(item.path)}
                  className={`flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-left text-sm font-bold transition-colors duration-200 ${active ? "bg-[#06B6D4] text-[#041018]" : "bg-white/5 text-white/82 hover:bg-white/8"}`}
                  data-testid={`investor-portal-nav-${item.path.split("/").pop() || "overview"}`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <button
            onClick={onLogout}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white"
            data-testid="investor-portal-logout-button"
          >
            <LogOut size={16} />
            Logout
          </button>
        </aside>

        <motion.main
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.22)]"
          data-testid="investor-portal-main"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#82E7FF]">BidBlitz Investor Relations</p>
              <h1 className="mt-2 text-4xl font-black leading-[0.98] tracking-[-0.04em] text-white sm:text-5xl" data-testid="investor-portal-page-title">
                {title}
              </h1>
              {subtitle ? <p className="mt-3 max-w-3xl text-sm leading-6 text-white/72" data-testid="investor-portal-page-subtitle">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-2 text-xs text-white/55">
              <LifeBuoy size={14} className="text-[#82E7FF]" />
              Keine Investments, keine Wallet-Zahlungen, nur Information und Qualifizierung.
            </div>
          </div>
          {extraHeader}
          <div className="mt-5">{children}</div>
        </motion.main>
      </div>
    </div>
  </div>
);