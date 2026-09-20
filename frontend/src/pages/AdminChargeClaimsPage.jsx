import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CheckCircle2, Clock3, Loader2, MessageCircle, Search,
  ShieldAlert, ShieldCheck, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";

const STATUS_OPTIONS = [
  { value: "", label: "Alle" },
  { value: "open", label: "Offen" },
  { value: "in_review", label: "In Prüfung" },
  { value: "approved", label: "Freigegeben" },
  { value: "rejected", label: "Abgelehnt" },
  { value: "resolved", label: "Abgeschlossen" },
  { value: "cancelled", label: "Storniert" },
];

export default function AdminChargeClaimsPage({ onBack, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState({ claims: [], summary: {} });
  const [drafts, setDrafts] = useState({});

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
            <h1 className="truncate text-xl font-black text-white">Garantiefälle bearbeiten</h1>
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
                    </div>

                    <div className="space-y-3 rounded-[22px] border border-[#E1D7C7] bg-[#FBF8F2] p-4">
                      <select
                        value={draft.status}
                        onChange={(e) => setDraft(claim.claim_id, { status: e.target.value })}
                        className="h-11 w-full rounded-2xl border border-[#D9CFC0] bg-white px-4 text-sm font-bold text-slate-700"
                        data-testid={`admin-charge-claim-status-${index}`}
                      >
                        {STATUS_OPTIONS.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
