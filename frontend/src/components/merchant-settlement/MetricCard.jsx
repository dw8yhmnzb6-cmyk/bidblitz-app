export const MetricCard = ({ label, value, tone = "default", testId }) => {
  const toneMap = {
    default: "border-white/10 bg-white/5 text-white",
    success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-50",
    warning: "border-amber-400/20 bg-amber-400/10 text-amber-50",
    danger: "border-rose-400/20 bg-rose-400/10 text-rose-50",
  };
  return (
    <div className={`rounded-[24px] border p-4 ${toneMap[tone] || toneMap.default}`} data-testid={testId}>
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
};