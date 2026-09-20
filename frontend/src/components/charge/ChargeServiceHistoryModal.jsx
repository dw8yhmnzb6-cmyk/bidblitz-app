import { CheckCircle2, Clock3, History, ShieldCheck, X } from "lucide-react";

export function ChargeServiceHistoryModal({ history, onClose }) {
  if (!history) return null;

  return (
    <div className="fixed inset-0 z-[88] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4" data-testid="charge-service-history-modal">
      <div className="max-h-[88vh] w-full max-w-xl overflow-hidden rounded-t-[30px] bg-[#F8F3EA] shadow-2xl sm:rounded-[30px]">
        <div className="flex items-center gap-3 border-b border-[#E1D7C7] px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0A1626] text-[#6EE7F9]">
            <History size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Charge Care</p>
            <h2 className="truncate text-lg font-black text-slate-900">Servicehistorie · {history.product_name}</h2>
            <p className="mt-1 text-xs text-slate-500">SN {history.serial_number || "—"} · {history.service_events_total || 0} Ereignisse</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D9CFC0] bg-white" data-testid="charge-service-history-close">
            <X size={15} />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Summary label="Garantie" value={statusLabel(history.warranty_status)} />
            <Summary label="Gültig bis" value={formatDate(history.valid_until)} />
            <Summary label="Fälle" value={String(history.claims_total || 0)} />
          </div>

          <div className="mt-5 space-y-3">
            {(history.service_events || []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D9CFC0] bg-white/60 px-4 py-8 text-center text-sm text-slate-500">
                Noch keine Serviceereignisse vorhanden
              </div>
            ) : (history.service_events || []).map((event, index) => (
              <div key={event.event_id || index} className="flex gap-3" data-testid={`charge-service-history-event-${index}`}>
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0A1626] text-[#6EE7F9]">
                  {event.event_type === "warranty_registered" ? <ShieldCheck size={14} /> : event.status === "resolved" ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                </div>
                <div className="min-w-0 flex-1 rounded-2xl border border-[#E1D7C7] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-900">{event.title}</p>
                    <p className="text-[10px] font-bold text-slate-400">{formatDateTime(event.created_at)}</p>
                  </div>
                  {event.description ? <p className="mt-2 text-xs leading-5 text-slate-600">{event.description}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#F4F0E8] px-3 py-1 text-[10px] font-bold text-slate-600">{statusLabel(event.status)}</span>
                    <span className="rounded-full bg-cyan-50 px-3 py-1 text-[10px] font-bold text-cyan-700">{actorLabel(event.actor_role)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#E1D7C7] bg-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-slate-900">{value || "—"}</p>
    </div>
  );
}

function statusLabel(status) {
  const labels = {
    active: "Aktiv",
    expired: "Abgelaufen",
    open: "Offen",
    in_review: "In Prüfung",
    approved: "Freigegeben",
    rejected: "Abgelehnt",
    resolved: "Abgeschlossen",
    cancelled: "Storniert",
    completed: "Abgeschlossen",
  };
  return labels[status] || status || "—";
}

function actorLabel(role) {
  const labels = {
    customer: "Kunde",
    merchant: "Händler",
    admin: "Charge Care",
    system: "System",
  };
  return labels[role] || role || "System";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("de-DE");
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}
