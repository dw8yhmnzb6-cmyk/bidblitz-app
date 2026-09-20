import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CalendarClock, CheckCircle2, Clock3, Loader2, ShieldCheck,
  Wrench, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";

const EMPTY_FORM = {
  service_type: "repair",
  preferred_date: "",
  preferred_time: "",
  note: "",
};

export default function ChargeServiceRequestsPage({ registrationId, onBack }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      const data = await api.getChargeServiceRequests();
      setRows(data?.service_requests || []);
    } catch (error) {
      toast.error(error.message || "Serviceanfragen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeForWarranty = useMemo(() => {
    if (!registrationId) return null;
    return rows.find((item) =>
      item.registration_id === registrationId &&
      ["requested", "confirmed", "reschedule_requested", "in_service"].includes(item.status)
    ) || null;
  }, [rows, registrationId]);

  const submit = useCallback(async () => {
    if (!registrationId) return;
    if (!form.preferred_date) {
      toast.error("Bitte Wunschtermin auswählen");
      return;
    }
    setBusy("create");
    try {
      const response = await api.createChargeServiceRequest(registrationId, form);
      toast.success(response?.duplicate ? "Bestehende Serviceanfrage geöffnet" : "Serviceanfrage gesendet");
      setForm(EMPTY_FORM);
      await load();
    } catch (error) {
      toast.error(error.message || "Serviceanfrage konnte nicht gesendet werden");
    } finally {
      setBusy("");
    }
  }, [registrationId, form, load]);

  const cancel = useCallback(async (requestId) => {
    if (!window.confirm("Diese Serviceanfrage wirklich stornieren?")) return;
    setBusy(`cancel-${requestId}`);
    try {
      await api.cancelChargeServiceRequest(requestId);
      toast.success("Serviceanfrage storniert");
      await load();
    } catch (error) {
      toast.error(error.message || "Serviceanfrage konnte nicht storniert werden");
    } finally {
      setBusy("");
    }
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08131D]" data-testid="charge-service-loading">
        <Loader2 size={26} className="animate-spin text-[#6EE7F9]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#06101B_0%,#0C1623_32%,#F3EFE7_32%,#F3EFE7_100%)] pb-24" data-testid="charge-service-page">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#08131dcc] px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5" data-testid="charge-service-back">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#6EE7F9]">BidBlitz Charge Care</p>
            <h1 className="truncate text-xl font-black text-white">Service & Reparatur</h1>
          </div>
          <span className="rounded-full border border-[#6EE7F9]/20 bg-[#6EE7F9]/10 px-4 py-2 text-xs font-black text-[#D8FCFF]">
            {rows.length} Anfragen
          </span>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {registrationId ? (
          activeForWarranty ? (
            <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5" data-testid="charge-service-active-request">
              <div className="flex items-start gap-3">
                <Clock3 size={20} className="mt-0.5 text-amber-700" />
                <div>
                  <h2 className="text-lg font-black text-amber-950">Für diese Garantie läuft bereits eine Serviceanfrage.</h2>
                  <p className="mt-2 text-sm text-amber-800">{statusLabel(activeForWarranty.status)}</p>
                  <p className="mt-1 text-xs text-amber-700">{dateSummary(activeForWarranty)}</p>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-[30px] border border-[#D9CFC0] bg-[#F8F3EA] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]" data-testid="charge-service-create-card">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0A1626] text-[#6EE7F9]">
                  <Wrench size={18} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Servicetermin anfragen</h2>
                  <p className="mt-1 text-sm text-slate-500">Du wählst einen Wunschtermin. Der Händler bestätigt oder schlägt einen anderen Termin vor.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <select
                  value={form.service_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, service_type: e.target.value }))}
                  className="h-11 rounded-2xl border border-[#D9CFC0] bg-white px-4 text-sm text-slate-800"
                  data-testid="charge-service-type"
                >
                  <option value="repair">Reparatur</option>
                  <option value="inspection">Prüfung</option>
                  <option value="diagnostic">Diagnose</option>
                  <option value="replacement_assessment">Austausch prüfen</option>
                  <option value="support">Technische Hilfe</option>
                </select>
                <input
                  type="date"
                  value={form.preferred_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, preferred_date: e.target.value }))}
                  className="h-11 rounded-2xl border border-[#D9CFC0] bg-white px-4 text-sm text-slate-800"
                  data-testid="charge-service-date"
                />
                <input
                  type="time"
                  value={form.preferred_time}
                  onChange={(e) => setForm((prev) => ({ ...prev, preferred_time: e.target.value }))}
                  className="h-11 rounded-2xl border border-[#D9CFC0] bg-white px-4 text-sm text-slate-800"
                  data-testid="charge-service-time"
                />
              </div>

              <textarea
                value={form.note}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                rows={4}
                placeholder="Problem oder Hinweis für den Händler"
                className="mt-3 w-full rounded-2xl border border-[#D9CFC0] bg-white px-4 py-3 text-sm outline-none"
                data-testid="charge-service-note"
              />

              <button
                onClick={submit}
                disabled={busy === "create" || !form.preferred_date}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#0A1626] text-sm font-black text-[#D8FCFF] disabled:opacity-40"
                data-testid="charge-service-submit"
              >
                {busy === "create" ? <Loader2 size={15} className="animate-spin" /> : <CalendarClock size={15} />}
                Serviceanfrage senden
              </button>
            </section>
          )
        ) : null}

        <section className="mt-6 rounded-[30px] border border-[#D9CFC0] bg-[#F8F3EA] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]" data-testid="charge-service-list">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Deine Historie</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Serviceanfragen</h2>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D9CFC0] bg-white/60 px-4 py-10 text-center text-sm text-slate-500">
              Noch keine Serviceanfrage vorhanden
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((item, index) => {
                const active = ["requested", "confirmed", "reschedule_requested", "in_service"].includes(item.status);
                return (
                  <article key={item.request_id} className="rounded-[24px] border border-[#E1D7C7] bg-white p-4" data-testid={`charge-service-item-${index}`}>
                    <div className="flex items-start gap-3">
                      <StatusIcon status={item.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-900">{item.product_name}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.merchant_name || "Charge Händler"} · SN {item.serial_number || "—"}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full bg-[#F4F0E8] px-3 py-1 text-[10px] font-bold text-slate-600">{serviceTypeLabel(item.service_type)}</span>
                          <span className="rounded-full bg-cyan-50 px-3 py-1 text-[10px] font-bold text-cyan-700">{statusLabel(item.status)}</span>
                        </div>
                        <p className="mt-3 text-xs font-semibold text-slate-700">{dateSummary(item)}</p>
                        {item.merchant_note ? <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{item.merchant_note}</p> : null}
                      </div>
                      {active ? (
                        <button
                          onClick={() => cancel(item.request_id)}
                          disabled={busy === `cancel-${item.request_id}`}
                          className="shrink-0 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-black text-red-700 disabled:opacity-50"
                          data-testid={`charge-service-cancel-${index}`}
                        >
                          Stornieren
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === "completed") return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><CheckCircle2 size={18} /></div>;
  if (["rejected", "cancelled"].includes(status)) return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700"><XCircle size={18} /></div>;
  return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Clock3 size={18} /></div>;
}

function statusLabel(status) {
  const labels = {
    requested: "Angefragt",
    confirmed: "Bestätigt",
    reschedule_requested: "Neuer Termin vorgeschlagen",
    in_service: "Im Service",
    completed: "Abgeschlossen",
    rejected: "Abgelehnt",
    cancelled: "Storniert",
  };
  return labels[status] || status || "—";
}

function serviceTypeLabel(type) {
  const labels = {
    repair: "Reparatur",
    inspection: "Prüfung",
    diagnostic: "Diagnose",
    replacement_assessment: "Austauschprüfung",
    support: "Technische Hilfe",
  };
  return labels[type] || type || "Service";
}

function dateSummary(item) {
  const date = item.scheduled_date || item.preferred_date;
  const time = item.scheduled_time || item.preferred_time;
  if (!date) return "Noch kein Termin";
  return `${item.scheduled_date ? "Termin" : "Wunschtermin"}: ${date}${time ? ` · ${time}` : ""}`;
}
