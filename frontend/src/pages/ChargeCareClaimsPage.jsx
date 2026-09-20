import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CheckCircle2, Clock3, Loader2, MessageCircle, Send, ShieldAlert,
  ShieldCheck, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";

const EMPTY_FORM = {
  issue_type: "defect",
  subject: "",
  description: "",
  preferred_resolution: "repair",
};

export default function ChargeCareClaimsPage({ registrationId, claimId, onBack, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [claims, setClaims] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await api.getChargeClaims();
      const rows = response?.claims || [];
      setClaims(rows);
      if (claimId) {
        const detail = await api.getChargeClaim(claimId);
        setSelected(detail?.claim || null);
      } else {
        setSelected(null);
      }
    } catch (error) {
      toast.error(error.message || "Charge Care Garantiefälle konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeForWarranty = useMemo(() => {
    if (!registrationId) return null;
    return claims.find((item) =>
      item.registration_id === registrationId &&
      ["open", "in_review", "approved"].includes(item.status)
    ) || null;
  }, [claims, registrationId]);

  const createClaim = useCallback(async () => {
    if (!registrationId) return;
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error("Bitte Betreff und Beschreibung ausfüllen");
      return;
    }
    setBusy("create");
    try {
      const response = await api.createChargeWarrantyClaim(registrationId, form);
      const created = response?.claim;
      if (created?.claim_id) {
        toast.success(response?.duplicate ? "Bestehender Garantiefall geöffnet" : "Garantiefall eröffnet");
        onNavigate?.(`/charge-app/claims?claim_id=${encodeURIComponent(created.claim_id)}`);
      } else {
        await load();
      }
    } catch (error) {
      toast.error(error.message || "Garantiefall konnte nicht eröffnet werden");
    } finally {
      setBusy("");
    }
  }, [registrationId, form, onNavigate, load]);

  const sendMessage = useCallback(async () => {
    if (!selected?.claim_id || !message.trim()) return;
    setBusy("message");
    try {
      await api.addChargeClaimMessage(selected.claim_id, { message });
      setMessage("");
      await load();
      toast.success("Nachricht gesendet");
    } catch (error) {
      toast.error(error.message || "Nachricht konnte nicht gesendet werden");
    } finally {
      setBusy("");
    }
  }, [selected?.claim_id, message, load]);

  const cancelClaim = useCallback(async () => {
    if (!selected?.claim_id) return;
    if (!window.confirm("Diesen Garantiefall wirklich stornieren?")) return;
    setBusy("cancel");
    try {
      await api.cancelChargeClaim(selected.claim_id);
      await load();
      toast.success("Garantiefall storniert");
    } catch (error) {
      toast.error(error.message || "Garantiefall konnte nicht storniert werden");
    } finally {
      setBusy("");
    }
  }, [selected?.claim_id, load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08131D]" data-testid="charge-care-claims-loading">
        <Loader2 size={26} className="animate-spin text-[#6EE7F9]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#06101B_0%,#0C1623_35%,#F3EFE7_35%,#F3EFE7_100%)] pb-24" data-testid="charge-care-claims-page">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#08131dcc] px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5" data-testid="charge-care-claims-back">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#6EE7F9]">BidBlitz Charge Care</p>
            <h1 className="truncate text-xl font-black text-white">Garantiefälle & Reklamationen</h1>
          </div>
          <span className="rounded-full border border-[#6EE7F9]/20 bg-[#6EE7F9]/10 px-4 py-2 text-xs font-black text-[#D8FCFF]">
            {claims.length} Fälle
          </span>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {selected ? (
          <ClaimDetail
            claim={selected}
            message={message}
            onMessageChange={setMessage}
            onSend={sendMessage}
            onCancel={cancelClaim}
            busy={busy}
          />
        ) : registrationId ? (
          activeForWarranty ? (
            <section className="rounded-[30px] border border-[#D9CFC0] bg-[#F8F3EA] p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
              <p className="text-sm font-black text-slate-900">Für diese Garantie gibt es bereits einen aktiven Fall.</p>
              <p className="mt-2 text-sm text-slate-600">{activeForWarranty.subject}</p>
              <button
                onClick={() => onNavigate?.(`/charge-app/claims?claim_id=${encodeURIComponent(activeForWarranty.claim_id)}`)}
                className="mt-4 h-11 rounded-2xl bg-[#0A1626] px-5 text-sm font-black text-[#D8FCFF]"
                data-testid="charge-care-existing-claim-button"
              >
                Fall öffnen
              </button>
            </section>
          ) : (
            <CreateClaimCard form={form} setForm={setForm} onSubmit={createClaim} busy={busy === "create"} />
          )
        ) : (
          <ClaimsList claims={claims} onOpen={(id) => onNavigate?.(`/charge-app/claims?claim_id=${encodeURIComponent(id)}`)} />
        )}
      </main>
    </div>
  );
}

function CreateClaimCard({ form, setForm, onSubmit, busy }) {
  return (
    <section className="rounded-[30px] border border-[#D9CFC0] bg-[#F8F3EA] p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)]" data-testid="charge-care-create-card">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0A1626] text-[#6EE7F9]">
          <ShieldAlert size={19} />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900">Garantiefall eröffnen</h2>
          <p className="mt-1 text-sm text-slate-500">Beschreibe das Problem und die gewünschte Lösung.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <select
          value={form.issue_type}
          onChange={(e) => setForm((prev) => ({ ...prev, issue_type: e.target.value }))}
          className="h-11 rounded-2xl border border-[#D9CFC0] bg-white px-4 text-sm text-slate-800"
          data-testid="charge-care-issue-type"
        >
          <option value="defect">Defekt</option>
          <option value="charging_problem">Ladeproblem</option>
          <option value="cable_damage">Kabel / Stecker beschädigt</option>
          <option value="overheating">Überhitzung</option>
          <option value="compatibility">Kompatibilität</option>
          <option value="other">Sonstiges</option>
        </select>
        <select
          value={form.preferred_resolution}
          onChange={(e) => setForm((prev) => ({ ...prev, preferred_resolution: e.target.value }))}
          className="h-11 rounded-2xl border border-[#D9CFC0] bg-white px-4 text-sm text-slate-800"
          data-testid="charge-care-resolution"
        >
          <option value="repair">Reparatur</option>
          <option value="replacement">Austausch</option>
          <option value="refund">Erstattung prüfen</option>
          <option value="support">Technische Hilfe</option>
        </select>
      </div>

      <input
        value={form.subject}
        onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
        placeholder="Betreff"
        className="mt-3 h-11 w-full rounded-2xl border border-[#D9CFC0] bg-white px-4 text-sm outline-none"
        data-testid="charge-care-subject"
      />
      <textarea
        value={form.description}
        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
        placeholder="Was ist mit dem Produkt passiert?"
        rows={6}
        className="mt-3 w-full rounded-2xl border border-[#D9CFC0] bg-white px-4 py-3 text-sm outline-none"
        data-testid="charge-care-description"
      />
      <button
        onClick={onSubmit}
        disabled={busy}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#0A1626] text-sm font-black text-[#D8FCFF] disabled:opacity-50"
        data-testid="charge-care-submit"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
        Garantiefall absenden
      </button>
    </section>
  );
}

function ClaimsList({ claims, onOpen }) {
  if (!claims.length) {
    return (
      <div className="rounded-[30px] border border-dashed border-[#D9CFC0] bg-[#F8F3EA] px-4 py-12 text-center text-sm text-slate-500" data-testid="charge-care-empty">
        Noch keine Garantiefälle vorhanden.
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="charge-care-list">
      {claims.map((claim, index) => (
        <button
          key={claim.claim_id}
          onClick={() => onOpen(claim.claim_id)}
          className="flex w-full items-center gap-4 rounded-[26px] border border-[#D9CFC0] bg-[#F8F3EA] p-4 text-left shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
          data-testid={`charge-care-list-item-${index}`}
        >
          <StatusIcon status={claim.status} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-900">{claim.subject}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{claim.product_name} · {claim.merchant_name}</p>
            <p className="mt-2 text-[11px] font-bold text-slate-400">{statusLabel(claim.status)} · {claim.claim_id}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function ClaimDetail({ claim, message, onMessageChange, onSend, onCancel, busy }) {
  const closed = ["resolved", "cancelled"].includes(claim.status);
  return (
    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]" data-testid="charge-care-detail">
      <section className="rounded-[30px] border border-[#D9CFC0] bg-[#F8F3EA] p-5">
        <div className="flex items-start gap-3">
          <StatusIcon status={claim.status} />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{claim.claim_id}</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">{claim.subject}</h2>
            <p className="mt-2 text-sm text-slate-600">{claim.description}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Info label="Status" value={statusLabel(claim.status)} />
          <Info label="Produkt" value={claim.product_name} />
          <Info label="Seriennummer" value={claim.serial_number || "—"} />
          <Info label="Händler" value={claim.merchant_name} />
          <Info label="Problem" value={claim.issue_type} />
          <Info label="Wunsch" value={claim.preferred_resolution} />
        </div>

        {claim.admin_note ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" data-testid="charge-care-admin-note">
            <strong>Charge Care:</strong> {claim.admin_note}
          </div>
        ) : null}

        {!closed ? (
          <button
            onClick={onCancel}
            disabled={busy === "cancel"}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-xs font-black text-red-700 disabled:opacity-50"
            data-testid="charge-care-cancel"
          >
            <XCircle size={14} />Fall stornieren
          </button>
        ) : null}
      </section>

      <section className="rounded-[30px] border border-[#D9CFC0] bg-[#F8F3EA] p-5">
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle size={18} className="text-slate-600" />
          <h3 className="text-lg font-black text-slate-900">Nachrichtenverlauf</h3>
        </div>
        <div className="max-h-[440px] space-y-3 overflow-y-auto pr-1">
          {(claim.messages || []).map((entry) => (
            <div key={entry.message_id} className={`rounded-2xl p-4 text-sm ${entry.author_role === "customer" ? "ml-8 bg-white text-slate-700" : "mr-8 bg-[#0A1626] text-white"}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-60">{entry.author_role === "customer" ? "Du" : "Charge Care"}</p>
              <p className="mt-2 whitespace-pre-wrap">{entry.message}</p>
            </div>
          ))}
        </div>
        {!closed ? (
          <div className="mt-4 flex gap-2">
            <textarea
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder="Nachricht an Charge Care..."
              rows={3}
              className="min-h-[76px] flex-1 rounded-2xl border border-[#D9CFC0] bg-white px-4 py-3 text-sm outline-none"
              data-testid="charge-care-message-input"
            />
            <button
              onClick={onSend}
              disabled={busy === "message" || !message.trim()}
              className="flex w-12 items-center justify-center rounded-2xl bg-[#0A1626] text-[#D8FCFF] disabled:opacity-40"
              data-testid="charge-care-message-send"
            >
              {busy === "message" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function StatusIcon({ status }) {
  const common = "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl";
  if (status === "resolved" || status === "approved") return <div className={`${common} bg-emerald-50 text-emerald-700`}><CheckCircle2 size={20} /></div>;
  if (status === "rejected" || status === "cancelled") return <div className={`${common} bg-red-50 text-red-700`}><XCircle size={20} /></div>;
  return <div className={`${common} bg-amber-50 text-amber-700`}><Clock3 size={20} /></div>;
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#E1D7C7] bg-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-slate-900">{value || "—"}</p>
    </div>
  );
}

function statusLabel(status) {
  const labels = {
    open: "Offen",
    in_review: "In Prüfung",
    approved: "Freigegeben",
    rejected: "Abgelehnt",
    resolved: "Abgeschlossen",
    cancelled: "Storniert",
  };
  return labels[status] || status || "Offen";
}
