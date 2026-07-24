import { Bell, Clock3, Gift, Lock, Shield, Sparkles, Trophy, Wallet } from "lucide-react";

const cardBase = "rounded-2xl p-4 border";

export const ParentDashboardOverview = ({ dashboard, onOpenActivity, onOpenTime }) => {
  if (!dashboard) {
    return <div className="text-center text-[12px] text-gray-500 py-8" data-testid="parent-overview-loading">Übersicht lädt…</div>;
  }

  const { summary, alerts = [], allowance = {} } = dashboard;
  return (
    <div className="p-4 pt-2 space-y-3" data-testid="parent-overview-tab">
      <div className="grid grid-cols-2 gap-2">
        <div className={`${cardBase} bg-white/5 border-white/10`} data-testid="parent-overview-modules-card">
          <div className="flex items-center gap-2 mb-1"><Shield size={14} className="text-[#00D26A]" /><span className="text-[10px] text-gray-500 uppercase">Module frei</span></div>
          <p className="text-[24px] font-black text-white">{summary.active_modules}</p>
          <p className="text-[10px] text-gray-400">{summary.blocked_modules} gesperrt</p>
        </div>
        <button className={`${cardBase} bg-white/5 border-white/10 text-left`} onClick={onOpenActivity} data-testid="parent-overview-usage-card">
          <div className="flex items-center gap-2 mb-1"><Clock3 size={14} className="text-[#00C2FF]" /><span className="text-[10px] text-gray-500 uppercase">Nutzung</span></div>
          <p className="text-[24px] font-black text-white">{summary.today_minutes}m</p>
          <p className="text-[10px] text-gray-400">7 Tage: {summary.week_minutes}m</p>
        </button>
        <div className={`${cardBase} bg-white/5 border-white/10`} data-testid="parent-overview-balance-card">
          <div className="flex items-center gap-2 mb-1"><Wallet size={14} className="text-[#FFB800]" /><span className="text-[10px] text-gray-500 uppercase">Wallet</span></div>
          <p className="text-[20px] font-black text-white">€{summary.balance_eur.toFixed(2)}</p>
          <p className="text-[10px] text-gray-400">{summary.balance_blz} BLZ</p>
        </div>
        <button className={`${cardBase} bg-white/5 border-white/10 text-left`} onClick={onOpenTime} data-testid="parent-overview-lock-card">
          <div className="flex items-center gap-2 mb-1"><Lock size={14} className={summary.lock_all ? "text-red-400" : "text-violet-400"} /><span className="text-[10px] text-gray-500 uppercase">Status</span></div>
          <p className="text-[16px] font-black text-white">{summary.lock_all ? "Alles gesperrt" : summary.bedtime_now ? "Bettzeit aktiv" : "Freigaben aktiv"}</p>
          <p className="text-[10px] text-gray-400">Tippe für Zeitregeln</p>
        </button>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2" data-testid="parent-overview-alerts">
          {alerts.map((alert, idx) => (
            <div key={`${alert.title}-${idx}`} className={`rounded-2xl p-3 border ${alert.tone === "red" ? "bg-red-500/10 border-red-500/25 text-red-300" : alert.tone === "amber" ? "bg-amber-500/10 border-amber-500/25 text-amber-300" : alert.tone === "violet" ? "bg-violet-500/10 border-violet-500/25 text-violet-300" : "bg-cyan-500/10 border-cyan-500/25 text-cyan-300"}`} data-testid={`parent-alert-${idx}`}>
              <div className="flex items-start gap-2"><Bell size={14} className="mt-0.5 shrink-0" /><div><p className="text-[12px] font-bold">{alert.title}</p><p className="text-[11px] opacity-80 mt-0.5">{alert.text}</p></div></div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className={`${cardBase} bg-white/5 border-white/10`} data-testid="parent-overview-approvals-card">
          <div className="flex items-center gap-2 mb-1"><Sparkles size={14} className="text-[#A855F7]" /><span className="text-[10px] text-gray-500 uppercase">Freigaben</span></div>
          <p className="text-[20px] font-black text-white">{summary.approvals_pending}</p>
          <p className="text-[10px] text-gray-400">Offene Kaufanfragen</p>
        </div>
        <div className={`${cardBase} bg-white/5 border-white/10`} data-testid="parent-overview-chores-card">
          <div className="flex items-center gap-2 mb-1"><Gift size={14} className="text-[#00D26A]" /><span className="text-[10px] text-gray-500 uppercase">Aufgaben</span></div>
          <p className="text-[20px] font-black text-white">{summary.submitted_chores}</p>
          <p className="text-[10px] text-gray-400">{summary.open_chores} offen</p>
        </div>
        <div className={`${cardBase} bg-white/5 border-white/10`} data-testid="parent-overview-badges-card">
          <div className="flex items-center gap-2 mb-1"><Trophy size={14} className="text-[#FFB800]" /><span className="text-[10px] text-gray-500 uppercase">Badges</span></div>
          <p className="text-[20px] font-black text-white">{summary.badges_earned}</p>
          <p className="text-[10px] text-gray-400">Schon freigespielt</p>
        </div>
        <div className={`${cardBase} bg-white/5 border-white/10`} data-testid="parent-overview-allowance-card">
          <div className="flex items-center gap-2 mb-1"><Wallet size={14} className="text-[#00C2FF]" /><span className="text-[10px] text-gray-500 uppercase">Taschengeld</span></div>
          <p className="text-[16px] font-black text-white">{allowance?.amount_eur ? `€${Number(allowance.amount_eur).toFixed(2)}` : "Nicht aktiv"}</p>
          <p className="text-[10px] text-gray-400">{allowance?.frequency || "Kein Rhythmus"}</p>
        </div>
      </div>

      {summary.top_module_label && (
        <div className={`${cardBase} bg-gradient-to-br from-[#00C2FF]/10 to-[#A855F7]/10 border-white/10`} data-testid="parent-overview-top-module">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Top-Modul letzte 7 Tage</p>
          <p className="text-[14px] font-bold text-white mt-1">{summary.top_module_label}</p>
          <p className="text-[11px] text-gray-400 mt-1">Geschenke gesamt: €{summary.gifts_total_eur.toFixed(2)}</p>
        </div>
      )}
    </div>
  );
};