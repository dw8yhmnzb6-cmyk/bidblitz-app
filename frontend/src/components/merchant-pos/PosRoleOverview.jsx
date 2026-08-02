import { AlertTriangle, BarChart3, Receipt, ShoppingCart, Store, UserPlus, Wallet } from "lucide-react";

const ICONS = {
  revenue: Wallet,
  sales: Receipt,
  payouts: Wallet,
  stock: AlertTriangle,
  devices: AlertTriangle,
  tasks: ShoppingCart,
  shifts: Store,
  refunds: Receipt,
};

export const PosRoleOverview = ({ copy, role, metrics = [], actions = [], onNavigate }) => {
  if (role === "cashier") return null;
  const title = role === "manager" ? copy.managerTitle : copy.ownerTitle;
  const subtitle = role === "manager" ? copy.managerSubtitle : copy.ownerSubtitle;

  return (
    <section className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-5" data-testid="merchant-pos-role-overview">
      <div>
        <h2 className="text-2xl font-black text-white">{title}</h2>
        <p className="mt-2 text-sm text-white/62">{subtitle}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric, index) => {
          const Icon = ICONS[metric.icon] || BarChart3;
          return (
            <div key={metric.label} className="rounded-[22px] border border-white/10 bg-[#071019] p-4" data-testid={`merchant-pos-role-metric-${index + 1}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-cyan-400/20 bg-cyan-400/10 text-cyan-100"><Icon size={18} aria-hidden="true" /></div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{metric.label}</div>
                  <div className="mt-2 text-2xl font-black text-white">{metric.value}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2" data-testid="merchant-pos-role-actions">
        {actions.map((action, index) => {
          const Icon = action.icon === "invite" ? UserPlus : action.icon === "report" ? BarChart3 : action.icon === "receipt" ? Receipt : Store;
          return (
            <button
              key={action.label}
              onClick={() => onNavigate?.(action.path)}
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              data-testid={`merchant-pos-role-action-${index + 1}`}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};