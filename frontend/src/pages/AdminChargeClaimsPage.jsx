import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CalendarClock, CheckCircle2, Clock3, Download, Loader2, MessageCircle, Search,
  ShieldAlert, ShieldCheck, Wrench, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_OPTIONS = [
  { value: "", label: "Alle" },
  { value: "open", label: "Offen" },
  { value: "in_review", label: "In Prüfung" },
  { value: "approved", label: "Freigegeben" },
  { value: "rejected", label: "Abgelehnt" },
  { value: "resolved", label: "Abgeschlossen" },
  { value: "cancelled", label: "Storniert" },
];

const SERVICE_STATUS_OPTIONS = [
  { value: "", label: "Alle" },
  { value: "requested", label: "Angefragt" },
  { value: "confirmed", label: "Bestätigt" },
  { value: "reschedule_requested", label: "Neuer Termin" },
  { value: "in_service", label: "Im Service" },
  { value: "completed", label: "Abgeschlossen" },
  { value: "rejected", label: "Abgelehnt" },
  { value: "cancelled", label: "Storniert" },
];

export default function AdminChargeClaimsPage({ onBack, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState({ claims: [], summary: {} });
  const [drafts, setDrafts] = useState({});
  const [serviceLoading, setServiceLoading] = useState(true);
  const [serviceStatusFilter, setServiceStatusFilter] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [serviceData, setServiceData] = useState({ service_requests: [], summary: {} });
  const [serviceDrafts, setServiceDrafts] = useState({});

  const load = useCallback(async (status = "") => {
    setLoading(true);
    try {
      const response = await api.getChargeClaimsAdmin(status);
      setData(response || { claims: [], summary: {} });
      const next = {};
      for (const claim of response?.claims || []) {
        next[claim.claim_id] = {
          status: claim.status || "open",
          note: claim.admin_note || "",
        };
      }
      setDrafts(next);
    } catch (error) {
      toast.error(error.message || "Charge Care Fälle konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(statusFilter);
  }, [load, statusFilter]);

  const loadServices = useCallback(async (status = "") => {
    setServiceLoading(true);
    try {
      const response = await api.getChargeServiceRequestsAdmin(status);
      setServiceData(response || { service_requests: [], summary: {} });
      const next = {};
      for (const item of response?.service_requests || []) {
        next[item.request_id] = {
          scheduled_date: item.scheduled_date || item.preferred_date || "",
          scheduled_time: item.scheduled_time || item.preferred_time || "",
          note: item.merchant_note || "",
        };
      }
      setServiceDrafts(next);
    } catch (error) {
      toast.error(error.message || "Charge Servicetermine konnten nicht geladen werden");
    } finally {
      setServiceLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices(serviceStatusFilter);
  }, [loadServices, serviceStatusFilter]);

  const filtered = useMemo(() => {
    if (!query.trim()) return data.claims || [];
    const q = query.trim().toLowerCase();
    return (data.claims || []).filter((claim) =>
      [
        claim.claim_id,
        claim.subject,
        claim.product_name,
        claim.serial_number,
        claim.merchant_name,
        claim.user_id,
      ].join(" ").toLowerCase().includes(q)
    );
  }, [data.claims, query]);

  const serviceFiltered = useMemo(() => {
    if (!serviceQuery.trim()) return serviceData.service_requests || [];
    const q = serviceQuery.trim().toLowerCase();
    return (serviceData.service_requests || []).filter((item) =>
      [
        item.request_id,
        item.product_name,
        item.serial_number,
        item.merchant_name,
        item.customer_email,
        item.service_type,
        item.status,
      ].join(" ").toLowerCase().includes(q)
    );
  }, [serviceData.service_requests, serviceQuery]);

  const setServiceDraft = useCallback((requestId, patch) => {
    setServiceDrafts((current) => ({
      ...current,
      [requestId]: { ...(current[requestId] || {}), ...patch },
    }));
  }, []);

  const updateService = useCallback(async (item, status) => {
    const draft = serviceDrafts[item.request_id] || {};
    const scheduledDate = draft.scheduled_date ?? item.scheduled_date ?? item.preferred_date ?? "";
    const scheduledTime = draft.scheduled_time ?? item.scheduled_time ?? item.preferred_time ?? "";
    if (["confirmed", "reschedule_requested"].includes(status) && !scheduledDate) {
      toast.error("Bitte zuerst ein Servicedatum auswählen");
      return;
    }
    setBusy(`service:${item.request_id}`);
    try {
      await api.updateMerchantDealerServiceRequestStatus(item.request_id, {
        status,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        note: (draft.note ?? item.merchant_note ?? "").trim(),
      });
      toast.success(status === "completed" ? "Service abgeschlossen" : "Servicetermin aktualisiert");
      await loadServices(serviceStatusFilter);
    } catch (error) {
      toast.error(error.message || "Servicetermin konnte nicht aktualisiert werden");
    } finally {
      setBusy("");
    }
  }, [serviceDrafts, loadServices, serviceStatusFilter]);

  const setDraft = useCallback((claimId, patch) => {
    setDrafts((current) => ({
      ...current,
      [claimId]: { ...(current[claimId] || {}), ...patch },
    }));
  }, []);

  const save = useCallback(async (claimId) => {
    const draft = drafts[claimId];
    if (!draft) return;
    setBusy(claimId);
    try {
      await api.updateChargeClaimStatusAdmin(claimId, draft);
      toast.success("Garantiefall aktualisiert");
      await load(statusFilter);
    } catch (error) {
      toast.error(error.message || "Garantiefall konnte nicht aktualisiert werden");
    } finally {
      setBusy("");
    }
  }, [drafts, load, statusFilter]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08131D]" data-testid="admin-charge-claims-loading">
        <Loader2 size={26} className="animate-spin text-[#6EE7F9]" />
      </div>
    );
  }

  const summary = data.summary || {};

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#08131D_0%,#102233_30%,#F4F0E8_30%,#F4F0E8_100%)] pb-24" data-testid="admin-charge-claims-page">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#08131dcc] px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5" data-testid="admin-charge-claims-back">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#6EE7F9]">Charge Care Admin</p>
            <h1 className="truncate text-xl font-black text-white">Charge Care verwalten</h1>
          </div>
          <button
            onClick={() => onNavigate?.("/admin/charge-catalog")}
            className="rounded-full border border-[#6EE7F9]/20 bg-[#6EE7F9]/10 px-4 py-2 text-xs font-black text-[#D8FCFF]"
          >
            Katalog
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <section className="grid gap-3 sm:grid-cols-4">
          <Stat label="Gesamt" value={summary.total || 0} icon={ShieldAlert} />
          <Stat label="Offen" value={summary.open || 0} icon={Clock3} />
          <Stat label="In Prüfung" value={summary.in_review || 0} icon={MessageCircle} />
          <Stat label="Erledigt" value={summary.resolved || 0} icon={CheckCircle2} />
        </section>

        <section className="mt-6 rounded-[30px] border border-[#D9CFC0] bg-[#F8F3EA] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Fall, Produkt, Seriennummer oder Händler suchen"
                className="h-12 w-full rounded-2xl border border-[#D9CFC0] bg-white pl-11 pr-4 text-sm outline-none"
                data-testid="admin-charge-claims-search"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-12 rounded-2xl border border-[#D9CFC0] bg-white px-4 text-sm font-bold text-slate-700"
              data-testid="admin-charge-claims-filter"
            >
              {STATUS_OPTIONS.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
            </select>
          </div>

          <div className="mt-5 space-y-4">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D9CFC0] bg-white/60 px-4 py-10 text-center text-sm text-slate-500">
                Keine Garantiefälle gefunden
              </div>
            ) : filtered.map((claim, index) => {
              const draft = drafts[claim.claim_id] || { status: claim.status, note: claim.admin_note || "" };
              const isBusy = busy === claim.claim_id;
              return (
                <article key={claim.claim_id} className="rounded-[26px] border border-[#E1D7C7] bg-white p-5" data-testid={`admin-charge-claim-${index}`}>
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={claim.status} />
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{claim.claim_id}</span>
                      </div>
                      <h2 className="mt-3 text-lg font-black text-slate-900">{claim.subject}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{claim.description}</p>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <Info label="Produkt" value={claim.product_name} />
                        <Info label="Seriennummer" value={claim.serial_number || "—"} />
                        <Info label="Händler" value={claim.merchant_name} />
                        <Info label="Wunsch" value={claim.preferred_resolution} />
                      </div>

                      {(claim.messages || []).length ? (
                        <div className="mt-4 rounded-2xl border border-[#E1D7C7] bg-[#FBF8F2] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Letzte Nachricht</p>
                          <p className="mt-2 text-sm text-slate-700">{claim.messages[claim.messages.length - 1]?.message}</p>
                        </div>
                      ) : null}

                      {(claim.attachments || []).length ? (
                        <div className="mt-4 rounded-2xl border border-[#E1D7C7] bg-[#FBF8F2] p-4" data-testid={`admin-charge-claim-attachments-${index}`}>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Beweisdateien · {claim.attachments.length}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(claim.attachments || []).map((item) => (
                              <a
                                key={item.attachment_id}
                                href={`${API}${item.download_path}`}
                                className="inline-flex h-9 items-center gap-2 rounded-2xl border border-[#D9CFC0] bg-white px-3 text-[11px] font-black text-slate-700"
                              >
                                <Download size={12} />{item.original_filename}
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3 rounded-[22px] border border-[#E1D7C7] bg-[#FBF8F2] p-4">
                      <select
                        value={draft.status}
                        onChange={(e) => setDraft(claim.claim_id, { status: e.target.value })}
                        className="h-11 w-full rounded-2xl border border-[#D9CFC0] bg-white px-4 text-sm font-bold text-slate-700"
                        data-testid={`admin-charge-claim-status-${index}`}
                      >
                        {claimStatusOptions(claim.status).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                      <textarea
                        value={draft.note}
                        onChange={(e) => setDraft(claim.claim_id, { note: e.target.value })}
                        rows={5}
                        placeholder="Nachricht / Entscheidung für den Kunden"
                        className="w-full rounded-2xl border border-[#D9CFC0] bg-white px-4 py-3 text-sm outline-none"
                        data-testid={`admin-charge-claim-note-${index}`}
                      />
                      <button
                        onClick={() => save(claim.claim_id)}
                        disabled={isBusy}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#0A1626] text-sm font-black text-[#D8FCFF] disabled:opacity-50"
                        data-testid={`admin-charge-claim-save-${index}`}
                      >
                        {isBusy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                        Entscheidung speichern
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-[30px] border border-[#D9CFC0] bg-[#F8F3EA] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]" data-testid="admin-charge-service-section">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">Charge Service Admin</p>
              <h2 className="mt-1 text-xl font-black text-slate-900">Servicetermine überwachen</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <MiniStat label="Gesamt" value={serviceData.summary?.total || 0} />
              <MiniStat label="Angefragt" value={serviceData.summary?.requested || 0} />
              <MiniStat label="Bestätigt" value={serviceData.summary?.confirmed || 0} />
              <MiniStat label="Im Service" value={serviceData.summary?.in_service || 0} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={serviceQuery}
                onChange={(e) => setServiceQuery(e.target.value)}
                placeholder="Service-ID, Produkt, Seriennummer, Händler oder Kunde suchen"
                className="h-12 w-full rounded-2xl border border-[#D9CFC0] bg-white pl-11 pr-4 text-sm outline-none"
                data-testid="admin-charge-service-search"
              />
            </div>
            <select
              value={serviceStatusFilter}
              onChange={(e) => setServiceStatusFilter(e.target.value)}
              className="h-12 rounded-2xl border border-[#D9CFC0] bg-white px-4 text-sm font-bold text-slate-700"
              data-testid="admin-charge-service-filter"
            >
              {SERVICE_STATUS_OPTIONS.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
            </select>
          </div>

          <div className="mt-5 space-y-3">
            {serviceLoading ? (
              <div className="flex items-center justify-center rounded-2xl border border-[#D9CFC0] bg-white/60 py-10">
                <Loader2 size={22} className="animate-spin text-cyan-700" />
              </div>
            ) : serviceFiltered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D9CFC0] bg-white/60 px-4 py-10 text-center text-sm text-slate-500">
                Keine Servicetermine gefunden
              </div>
            ) : serviceFiltered.map((item, index) => {
              const serviceDraft = serviceDrafts[item.request_id] || {};
              const serviceActions = {
                requested: [["confirmed", "Bestätigen"], ["reschedule_requested", "Neuer Termin"], ["rejected", "Ablehnen"]],
                reschedule_requested: [["confirmed", "Bestätigen"], ["reschedule_requested", "Termin ändern"], ["rejected", "Ablehnen"]],
                confirmed: [["reschedule_requested", "Neuer Termin"], ["in_service", "Im Service"], ["rejected", "Ablehnen"]],
                in_service: [["completed", "Abschließen"], ["rejected", "Ablehnen"]],
              }[item.status] || [];
              const serviceBusy = busy === `service:${item.request_id}`;
              return (
              <article key={item.request_id} className="rounded-[24px] border border-[#E1D7C7] bg-white p-4" data-testid={`admin-charge-service-item-${index}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ServiceStatusBadge status={item.status} />
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{item.request_id}</span>
                    </div>
                    <h3 className="mt-3 text-base font-black text-slate-900">{item.product_name || "Charge Produkt"}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.merchant_name || "Charge Händler"} · SN {item.serial_number || "—"} · {item.customer_email || "Kunde"}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <Info label="Service" value={serviceTypeLabel(item.service_type)} />
                      <Info label="Wunschtermin" value={formatServiceSchedule(item.preferred_date, item.preferred_time)} />
                      <Info label="Bestätigter Termin" value={formatServiceSchedule(item.scheduled_date, item.scheduled_time)} />
                    </div>
                    {item.note ? <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{item.note}</p> : null}
                    {item.merchant_note ? <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{item.merchant_note}</p> : null}

                    {serviceActions.length ? (
                      <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/40 p-3" data-testid={`admin-charge-service-controls-${index}`}>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Admin-Steuerung</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <input
                            type="date"
                            value={serviceDraft.scheduled_date ?? item.scheduled_date ?? item.preferred_date ?? ""}
                            onChange={(e) => setServiceDraft(item.request_id, { scheduled_date: e.target.value })}
                            className="h-10 rounded-2xl border border-cyan-100 bg-white px-3 text-xs text-slate-800 outline-none"
                            data-testid={`admin-charge-service-date-${index}`}
                          />
                          <input
                            type="time"
                            value={serviceDraft.scheduled_time ?? item.scheduled_time ?? item.preferred_time ?? ""}
                            onChange={(e) => setServiceDraft(item.request_id, { scheduled_time: e.target.value })}
                            className="h-10 rounded-2xl border border-cyan-100 bg-white px-3 text-xs text-slate-800 outline-none"
                            data-testid={`admin-charge-service-time-${index}`}
                          />
                        </div>
                        <textarea
                          value={serviceDraft.note ?? item.merchant_note ?? ""}
                          onChange={(e) => setServiceDraft(item.request_id, { note: e.target.value })}
                          rows={2}
                          placeholder="Hinweis an Kunde / Händler"
                          className="mt-2 w-full rounded-2xl border border-cyan-100 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                          data-testid={`admin-charge-service-note-${index}`}
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          {serviceActions.map(([status, label]) => (
                            <button
                              key={status}
                              onClick={() => updateService(item, status)}
                              disabled={serviceBusy}
                              className="rounded-full border border-[#0A1626]/10 bg-[#0A1626] px-3 py-1.5 text-[11px] font-black text-[#D8FCFF] disabled:opacity-40"
                              data-testid={`admin-charge-service-action-${status}-${index}`}
                            >
                              {serviceBusy ? "..." : label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {(item.status_history || []).length ? (
                    <div className="w-full rounded-2xl border border-[#E1D7C7] bg-[#FBF8F2] p-3 lg:w-[360px]">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Letzte Statusänderungen</p>
                      <div className="mt-2 space-y-2">
                        {[...(item.status_history || [])].slice(-4).reverse().map((entry, historyIndex) => (
                          <div key={`${entry.created_at || historyIndex}-${entry.status || "status"}`} className="flex gap-2">
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-500" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-slate-700">{serviceStatusLabel(entry.status)} · {serviceActorLabel(entry.actor_role)}</p>
                              {entry.note ? <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{entry.note}</p> : null}
                              {entry.created_at ? <p className="mt-0.5 text-[10px] text-slate-400">{formatDateTime(entry.created_at)}</p> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#10283B] p-4 text-white">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">{label}</span>
        <Icon size={16} className="text-[#6EE7F9]" />
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#E1D7C7] bg-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 truncate text-sm font-black text-slate-900">{value || "—"}</p>
    </div>
  );
}

function claimStatusOptions(currentStatus) {
  const allowed = {
    open: ["open", "in_review", "approved", "rejected", "cancelled"],
    in_review: ["in_review", "approved", "rejected", "resolved", "cancelled"],
    approved: ["approved", "resolved", "rejected", "cancelled"],
    rejected: ["rejected"],
    resolved: ["resolved"],
    cancelled: ["cancelled"],
  }[currentStatus] || [currentStatus || "open"];
  const labels = Object.fromEntries(STATUS_OPTIONS.filter((item) => item.value).map((item) => [item.value, item.label]));
  return allowed.map((value) => ({ value, label: labels[value] || value }));
}

function StatusBadge({ status }) {
  const labels = {
    open: "Offen",
    in_review: "In Prüfung",
    approved: "Freigegeben",
    rejected: "Abgelehnt",
    resolved: "Abgeschlossen",
    cancelled: "Storniert",
  };
  const classes = {
    approved: "bg-emerald-50 text-emerald-700",
    resolved: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
    cancelled: "bg-red-50 text-red-700",
    in_review: "bg-amber-50 text-amber-700",
    open: "bg-sky-50 text-sky-700",
  };
  const Icon = ["approved", "resolved"].includes(status) ? CheckCircle2 : ["rejected", "cancelled"].includes(status) ? XCircle : Clock3;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black ${classes[status] || classes.open}`}>
      <Icon size={12} />{labels[status] || status}
    </span>
  );
}


function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#D9CFC0] bg-white px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}

function ServiceStatusBadge({ status }) {
  const classes = {
    requested: "bg-sky-50 text-sky-700",
    confirmed: "bg-emerald-50 text-emerald-700",
    reschedule_requested: "bg-amber-50 text-amber-700",
    in_service: "bg-violet-50 text-violet-700",
    completed: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
    cancelled: "bg-red-50 text-red-700",
  };
  const Icon = status === "completed" ? CheckCircle2 : ["rejected", "cancelled"].includes(status) ? XCircle : status === "in_service" ? Wrench : CalendarClock;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black ${classes[status] || classes.requested}`}>
      <Icon size={12} />{serviceStatusLabel(status)}
    </span>
  );
}

function serviceStatusLabel(status) {
  const labels = {
    requested: "Angefragt",
    confirmed: "Bestätigt",
    reschedule_requested: "Neuer Termin",
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

function serviceActorLabel(role) {
  const labels = { customer: "Kunde", merchant: "Händler", admin: "BidBlitz", system: "System" };
  return labels[role] || role || "System";
}

function formatServiceSchedule(date, time) {
  if (!date) return "—";
  return `${date}${time ? ` · ${time}` : ""}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
