const statusMap = {
  new: { label: "Neu registriert", className: "bg-[#06B6D4]/15 text-[#9BE8FF] border-[#06B6D4]/20" },
  review_pending: { label: "Unterlagen werden geprüft", className: "bg-amber-500/12 text-amber-200 border-amber-400/20" },
  documents_shared: { label: "Unterlagen freigegeben", className: "bg-emerald-500/12 text-emerald-200 border-emerald-400/20" },
  call_scheduled: { label: "Gespräch geplant", className: "bg-violet-500/12 text-violet-200 border-violet-400/20" },
  identification_required: { label: "Identifikation erforderlich", className: "bg-rose-500/12 text-rose-200 border-rose-400/20" },
  contract_preparation: { label: "Vertrag wird vorbereitet", className: "bg-cyan-500/12 text-cyan-200 border-cyan-400/20" },
  waitlist: { label: "Warteliste", className: "bg-white/10 text-white/80 border-white/10" },
  rejected: { label: "Abgelehnt", className: "bg-red-500/12 text-red-200 border-red-400/20" },
  completed: { label: "Abgeschlossen", className: "bg-emerald-500/12 text-emerald-200 border-emerald-400/20" },
};

export const InvestorStatusBadge = ({ status, dataTestId = "investor-status-badge" }) => {
  const meta = statusMap[status] || { label: status || "Offen", className: "bg-white/10 text-white/80 border-white/10" };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${meta.className}`}
      data-testid={dataTestId}
    >
      {meta.label}
    </span>
  );
};