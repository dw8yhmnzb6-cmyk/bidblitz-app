/**
 * OpenShifts — Schichttausch UI (Staff + Manager).
 *
 * Staff-View:  Liste offener Schichten (von Kollegen freigegeben) + eigene freigegebene
 * Manager-View: Pending Claims approve/reject
 *
 * Wird in StaffPortalPage (Tab "Schichten" Erweiterung) und in StaffManagementPage
 * (Manager Shifts-Tab) eingebunden.
 */
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Clock, MapPin, RotateCcw, CheckCircle2, X, Send, ArrowRightLeft,
  Loader2, AlertCircle, User as UserIcon, MessageSquare, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { credentials: "include", ...opts });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
  return d;
}

function fmtRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const date = s.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "short" });
  const sH = s.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const eH = e.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `${date} · ${sH} – ${eH}` : `${date} ${sH} → …`;
}

function durationLabel(start, end) {
  const ms = new Date(end) - new Date(start);
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

// ════════════════════════════════════════════════════════════════
// STAFF SIDE — Open Shifts feed
// ════════════════════════════════════════════════════════════════
export function StaffOpenShifts({ onClose }) {
  const [data, setData] = useState({ open: [], released_by_me: [] });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await api("/api/staff/open-shifts");
      setData(d);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, [load]);

  const claim = async (shiftId) => {
    setBusyId(shiftId);
    try {
      await api(`/api/staff/open-shifts/claim/${shiftId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "" }),
      });
      toast.success("Anfrage gesendet — Manager entscheidet in Kürze");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const withdrawClaim = async (claimId) => {
    setBusyId(claimId);
    try {
      await api(`/api/staff/open-shifts/withdraw-claim/${claimId}`, { method: "POST" });
      toast.success("Anfrage zurückgezogen");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const cancelRelease = async (shiftId) => {
    setBusyId(shiftId);
    try {
      await api(`/api/staff/open-shifts/cancel-release/${shiftId}`, { method: "POST" });
      toast.success("Freigabe zurückgenommen");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-5" data-testid="staff-open-shifts">
      {/* Released by me */}
      {data.released_by_me.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 px-1">Von dir freigegeben</h3>
          <div className="space-y-2">
            {data.released_by_me.map((s) => (
              <ReleasedShiftCard key={s.id} shift={s} busy={busyId === s.id} onCancel={() => cancelRelease(s.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Open from colleagues */}
      <section>
        <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 px-1">
          {data.open.length > 0 ? `${data.open.length} offene Schicht${data.open.length === 1 ? "" : "en"}` : "Keine offenen Schichten"}
        </h3>
        {data.open.length === 0 && (
          <div className="py-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <ArrowRightLeft size={20} className="text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-900">Aktuell nichts zu übernehmen</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[260px]">
              Wenn ein Kollege seine Schicht freigibt, erscheint sie hier mit einem Tippt-zum-Übernehmen Button.
            </p>
          </div>
        )}
        <div className="space-y-2">
          {data.open.map((s) => (
            <OpenShiftCard
              key={s.id}
              shift={s}
              busy={busyId === s.id || busyId === s.my_claim?.id}
              onClaim={() => claim(s.id)}
              onWithdraw={() => s.my_claim && withdrawClaim(s.my_claim.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ReleasedShiftCard({ shift, busy, onCancel }) {
  const pending = shift.pending_claims || 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      data-testid={`released-shift-${shift.id}`}
      className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-amber-700 font-bold flex items-center gap-1">
            <ArrowRightLeft size={11} /> Freigegeben · {pending > 0 ? `${pending} Anfrage${pending === 1 ? "" : "n"}` : "Keine Anfragen"}
          </p>
          <p className="text-base font-bold text-slate-900 mt-0.5 truncate">{shift.title || "Schicht"}</p>
          <p className="text-xs text-slate-600 mt-0.5">{fmtRange(shift.start_time, shift.end_time)}</p>
          {shift.location && (
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1"><MapPin size={10} /> {shift.location}</p>
          )}
        </div>
      </div>
      <button
        disabled={busy || pending > 0}
        onClick={onCancel}
        data-testid={`cancel-release-${shift.id}`}
        className="mt-3 w-full py-2.5 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition disabled:opacity-40"
      >
        {pending > 0 ? "Anfragen offen — kann nicht zurückgezogen werden" : (busy ? "…" : "Freigabe zurücknehmen")}
      </button>
    </motion.div>
  );
}

function OpenShiftCard({ shift, busy, onClaim, onWithdraw }) {
  const released = shift.released_by_staff;
  const alreadyClaimed = !!shift.my_claim;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      data-testid={`open-shift-${shift.id}`}
      className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-slate-900 truncate">{shift.title || "Schicht"}</p>
          <p className="text-xs text-slate-500 mt-0.5">{fmtRange(shift.start_time, shift.end_time)}</p>
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
            <Clock size={11} />
            <span>{durationLabel(shift.start_time, shift.end_time)}</span>
            {shift.location && (<><span>·</span><MapPin size={11} /><span className="truncate">{shift.location}</span></>)}
          </div>
          {released && (
            <p className="text-[11px] text-slate-400 mt-1.5">
              Von <span className="font-semibold text-slate-700">{released.name}</span>
              {shift.release_reason && ` · „${shift.release_reason}“`}
            </p>
          )}
        </div>
      </div>
      {alreadyClaimed ? (
        <button
          disabled={busy}
          onClick={onWithdraw}
          data-testid={`withdraw-claim-${shift.id}`}
          className="mt-3 w-full py-2.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition disabled:opacity-40"
        >
          {busy ? "…" : "Anfrage zurückziehen (wartet auf Manager)"}
        </button>
      ) : (
        <button
          disabled={busy}
          onClick={onClaim}
          data-testid={`claim-shift-${shift.id}`}
          className="mt-3 w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Schicht übernehmen
        </button>
      )}
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════
// Release Sheet — Mitarbeiter gibt eigene Schicht frei
// ════════════════════════════════════════════════════════════════
export function ReleaseShiftSheet({ open, shift, onClose, onReleased }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) setReason(""); }, [open]);

  if (!open || !shift) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await api(`/api/staff/open-shifts/release/${shift.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      toast.success("Schicht freigegeben — Kollegen wurden informiert");
      onReleased?.();
      onClose?.();
    } catch (e) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[75] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center"
      >
        <motion.div
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          data-testid="release-shift-sheet"
          className="w-full sm:max-w-md bg-white sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl"
        >
          <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Schicht freigeben</p>
              <h2 className="text-lg font-bold text-slate-900">{shift.title || "Schicht"}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{fmtRange(shift.start_time, shift.end_time)}</p>
            </div>
            <button onClick={onClose} data-testid="release-sheet-close" className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
              <X size={16} className="text-slate-700" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600">
              Kollegen bekommen eine Push-Benachrichtigung und können deine Schicht übernehmen.
              Dein Manager bestätigt den Tausch.
            </p>
            <div>
              <label className="text-xs font-bold text-slate-700">Grund (optional)</label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="z.B. Arzttermin"
                data-testid="release-sheet-reason"
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm resize-none focus:outline-none focus:bg-white focus:border-blue-300"
              />
            </div>
            <button
              disabled={busy}
              onClick={submit}
              data-testid="release-sheet-submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-b from-amber-500 to-orange-500 text-white text-sm font-bold shadow-md hover:shadow-lg active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Jetzt freigeben
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ════════════════════════════════════════════════════════════════
// MANAGER SIDE — Pending Claims overview
// ════════════════════════════════════════════════════════════════
export default function ManagerOpenShifts() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await api("/api/staff/open-shifts/manager/pending");
      setClaims(d.claims || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, [load]);

  const decide = async (claim, approve) => {
    setBusyId(claim.id);
    try {
      await api(`/api/staff/open-shifts/manager/decide/${claim.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve }),
      });
      toast.success(approve ? "Tausch bestätigt" : "Anfrage abgelehnt");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-blue-500" /></div>;
  }

  return (
    <div data-testid="manager-open-shifts" className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Schichttausch</p>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft size={16} className="text-amber-500" />
            Offene Anfragen ({claims.length})
          </h2>
        </div>
      </div>

      {claims.length === 0 && (
        <div className="py-14 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
            <CheckCircle2 size={22} className="text-emerald-500" strokeWidth={1.8} />
          </div>
          <p className="text-base font-bold text-slate-900">Alles bestätigt</p>
          <p className="text-sm text-slate-500 mt-1 max-w-[280px]">
            Keine offenen Tausch-Anfragen. Wenn Mitarbeiter eine Schicht übernehmen wollen, erscheinen die Anfragen hier.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {claims.map((c) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            data-testid={`claim-${c.id}`}
            className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white font-bold flex items-center justify-center shrink-0">
                {(c.claimer?.name || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">
                  {c.claimer?.name || "Mitarbeiter"} <span className="font-medium text-slate-500">möchte übernehmen</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Von <span className="font-semibold">{c.releaser?.name || "Mitarbeiter"}</span> · {c.shift && fmtRange(c.shift.start_time, c.shift.end_time)}
                </p>
                {c.shift?.location && (
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <MapPin size={10} /> {c.shift.location}
                  </p>
                )}
                {c.message && (
                  <p className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5 italic">„{c.message}“</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                disabled={busyId === c.id}
                onClick={() => decide(c, false)}
                data-testid={`reject-${c.id}`}
                className="py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition disabled:opacity-40"
              >
                Ablehnen
              </button>
              <button
                disabled={busyId === c.id}
                onClick={() => decide(c, true)}
                data-testid={`approve-${c.id}`}
                className="py-2.5 rounded-xl text-xs font-bold bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-sm hover:shadow-md transition disabled:opacity-40"
              >
                Bestätigen
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
