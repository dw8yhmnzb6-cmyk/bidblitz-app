import { AlertCircle, Printer, Wifi, WifiOff } from "lucide-react";

export const PosConnectionStatus = ({ label, testId = "merchant-pos-connection-status" }) => {
  const meta = label === "Online"
    ? { icon: Wifi, tone: "border-emerald-400/30 bg-emerald-400/12 text-emerald-100" }
    : label === "Offline"
      ? { icon: WifiOff, tone: "border-rose-400/30 bg-rose-400/12 text-rose-100" }
      : label?.includes("Drucker")
        ? { icon: Printer, tone: "border-amber-400/30 bg-amber-400/12 text-amber-100" }
        : { icon: AlertCircle, tone: "border-amber-400/30 bg-amber-400/12 text-amber-100" };
  const Icon = meta.icon;

  return (
    <div className={`inline-flex min-h-12 items-center gap-3 rounded-full border px-4 py-3 text-sm font-bold ${meta.tone}`} data-testid={testId} role="status" aria-live="polite">
      <Icon size={16} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
};