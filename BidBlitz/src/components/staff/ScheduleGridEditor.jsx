/**
 * BidBlitz Staff — Visual Drag&Drop Schedule Editor (Wochenansicht)
 * ==================================================================
 * Manager-Ansicht: Schichtraster Mo–So × Mitarbeiter
 * Drag & Drop:
 *  - Click auf leere Zelle → neue Schicht anlegen
 *  - Drag einer Schicht in andere Zelle → start_time + staff_id ändern
 *  - Click auf bestehende Schicht → bearbeiten/löschen
 *
 * Backend:
 *  GET    /api/staff/shifts?start_date&end_date
 *  POST   /api/staff/shifts
 *  PATCH  /api/staff/shifts/:id
 *  DELETE /api/staff/shifts/:id
 */
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, ChevronLeft, ChevronRight, Plus, X, Trash2, Save,
  Loader2, Clock, MapPin, GripVertical, AlertTriangle, CopyPlus,
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d, n) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

function fmtDayShort(d) {
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

export default function ScheduleGridEditor({ members = [], onMembersReload }) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { staff_id, date, shift?, isNew }
  const [draggedShift, setDraggedShift] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null); // "staffId|YYYY-MM-DD"
  const [resizingShift, setResizingShift] = useState(null); // {id, startY, originalEnd}
  const [showRepeat, setShowRepeat] = useState(false);

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sd = weekStart.toISOString();
      const ed = weekEnd.toISOString();
      const r = await fetch(`${API}/api/staff/shifts?start_date=${encodeURIComponent(sd)}&end_date=${encodeURIComponent(ed)}`, { credentials: "include" });
      if (r.ok) setShifts((await r.json()).shifts || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [weekStart, weekEnd]);

  useEffect(() => { load(); }, [load]);

  // Bucket shifts by `${staff_id}|YYYY-MM-DD`
  const buckets = useMemo(() => {
    const m = new Map();
    for (const s of shifts) {
      const day = (s.start_time || "").slice(0, 10);
      const key = `${s.staff_id}|${day}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(s);
    }
    return m;
  }, [shifts]);

  const handleDrop = async (staffId, dayDate, e) => {
    e.preventDefault();
    setDragOverCell(null);
    if (!draggedShift) return;
    const oldStart = new Date(draggedShift.start_time);
    const oldEnd = new Date(draggedShift.end_time);
    const duration = oldEnd - oldStart;
    const newStart = new Date(dayDate);
    newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
    const newEnd = new Date(newStart.getTime() + duration);

    // Skip if no change
    if (
      draggedShift.staff_id === staffId &&
      isoDay(oldStart) === isoDay(dayDate)
    ) {
      setDraggedShift(null);
      return;
    }

    const movingShift = draggedShift;
    // Optimistic update
    setShifts((prev) => prev.map((s) => s.id === movingShift.id
      ? { ...s, staff_id: staffId, start_time: newStart.toISOString(), end_time: newEnd.toISOString() }
      : s));
    setDraggedShift(null);

    await patchShiftWithConflict(movingShift.id, {
      staff_id: staffId,
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
    }, "Schicht verschoben");
  };

  const patchShiftWithConflict = async (shiftId, payload, successMsg) => {
    try {
      const r = await fetch(`${API}/api/staff/shifts/${shiftId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (r.ok) { toast.success(successMsg || "Aktualisiert"); load(); return true; }
      if (r.status === 409) {
        const d = await r.json();
        const ok = window.confirm(`⚠️ Konflikt: ${d.detail?.message || "Überschneidung."} Trotzdem zuweisen?`);
        if (ok) {
          const r2 = await fetch(`${API}/api/staff/shifts/${shiftId}?force=true`, {
            method: "PATCH", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (r2.ok) { toast.success("Trotz Konflikt zugewiesen"); load(); return true; }
        }
        load();
        return false;
      }
      toast.error("Aktualisieren fehlgeschlagen");
      load();
    } catch (e) { toast.error("Netzwerkfehler"); load(); }
    return false;
  };

  const openNew = (staff_id, date) => {
    setEditingCell({ staff_id, date: isoDay(date), isNew: true });
  };

  const openEdit = (shift) => {
    setEditingCell({
      staff_id: shift.staff_id, date: (shift.start_time || "").slice(0, 10),
      shift, isNew: false,
    });
  };

  return (
    <div data-testid="schedule-grid-editor" className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 font-semibold">Schichtplaner</p>
          <h2 className="text-xl font-bold mt-0.5 font-outfit flex items-center gap-2">
            <Calendar size={20} className="text-[#00C2FF]" />
            Visueller Schichtplan
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowRepeat(true)}
            data-testid="schedule-repeat-week-btn"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#A855F7]/15 border border-[#A855F7]/40 text-[#A855F7] text-xs font-semibold hover:bg-[#A855F7]/25"
            title="Diese Woche in zukünftige Wochen klonen"
          >
            <CopyPlus size={12} /> Woche wiederholen
          </button>
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            data-testid="schedule-prev-week"
            className="p-2 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08]"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            data-testid="schedule-today"
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-semibold hover:bg-white/[0.08]"
          >
            Heute
          </button>
          <span className="px-3 text-sm font-semibold text-white/80 min-w-[160px] text-center">
            {fmtDayShort(weekStart)} – {fmtDayShort(addDays(weekStart, 6))}
          </span>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            data-testid="schedule-next-week"
            className="p-2 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <p className="text-[11px] text-white/45">
        💡 <strong>Tipp:</strong> Klicke auf eine leere Zelle, um eine Schicht anzulegen. Ziehe bestehende Schichten per Drag&amp;Drop in andere Zellen.
      </p>

      {/* Grid */}
      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 size={22} className="animate-spin text-[#00C2FF]" /></div>
      ) : members.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10">
          <p className="text-sm font-semibold text-white/70">Keine Mitarbeiter vorhanden</p>
          <p className="text-[11px] text-white/40 mt-1">Lege Mitarbeiter im Tab „Mitarbeiter" an, um Schichten zu planen.</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="min-w-[820px] rounded-2xl border border-white/[0.08] overflow-hidden">
            {/* Day Header */}
            <div className="grid bg-white/[0.04]" style={{ gridTemplateColumns: "160px repeat(7, 1fr)" }}>
              <div className="p-2.5 text-[10px] uppercase tracking-widest text-white/40 font-semibold border-r border-white/[0.06]">Mitarbeiter</div>
              {days.map((d, i) => {
                const today = isoDay(d) === isoDay(new Date());
                return (
                  <div key={i} className={`p-2.5 text-center border-r border-white/[0.06] last:border-r-0 ${today ? "bg-[#00C2FF]/10" : ""}`}>
                    <p className={`text-[10px] uppercase tracking-widest font-semibold ${today ? "text-[#00C2FF]" : "text-white/40"}`}>{DAY_LABELS[i]}</p>
                    <p className={`text-xs font-bold mt-0.5 ${today ? "text-[#00C2FF]" : "text-white/80"}`}>{fmtDayShort(d)}</p>
                  </div>
                );
              })}
            </div>

            {/* Rows: one per member */}
            {members.map((m) => (
              <div key={m.id} className="grid border-t border-white/[0.06]" style={{ gridTemplateColumns: "160px repeat(7, 1fr)" }}>
                <div className="p-2.5 border-r border-white/[0.06] flex items-center gap-2 bg-white/[0.02]">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${m.color || "#00C2FF"}55, ${m.color || "#A855F7"}55)` }}
                  >
                    {(m.name || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold truncate">{m.name}</p>
                    <p className="text-[10px] text-white/40 truncate">{m.staff_role || m.role || "Mitarbeiter"}</p>
                  </div>
                </div>
                {days.map((d, i) => {
                  const cellKey = `${m.id}|${isoDay(d)}`;
                  const cellShifts = buckets.get(cellKey) || [];
                  const isOver = dragOverCell === cellKey;
                  return (
                    <div
                      key={i}
                      data-testid={`schedule-cell-${m.id}-${isoDay(d)}`}
                      onClick={(e) => {
                        // only fire on empty/whitespace, not on shift card
                        if (e.target === e.currentTarget) openNew(m.id, d);
                      }}
                      onDragOver={(e) => { e.preventDefault(); setDragOverCell(cellKey); }}
                      onDragLeave={() => setDragOverCell((p) => p === cellKey ? null : p)}
                      onDrop={(e) => handleDrop(m.id, d, e)}
                      className={`relative min-h-[88px] p-1.5 border-r border-white/[0.06] last:border-r-0 cursor-cell transition-colors ${
                        isOver ? "bg-[#00C2FF]/12 ring-1 ring-inset ring-[#00C2FF]/40" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="space-y-1 pointer-events-none">
                        {cellShifts.map((s) => {
                          // detect overlap warning (same staff, same day, overlapping interval)
                          const others = cellShifts.filter((o) => o.id !== s.id && !(new Date(o.end_time) <= new Date(s.start_time) || new Date(o.start_time) >= new Date(s.end_time)));
                          const hasOverlap = others.length > 0;
                          return (
                          <div
                            key={s.id}
                            draggable
                            onDragStart={(e) => { setDraggedShift(s); e.dataTransfer.effectAllowed = "move"; }}
                            onDragEnd={() => setDraggedShift(null)}
                            onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                            data-testid={`schedule-shift-${s.id}`}
                            className="relative w-full text-left p-1.5 rounded-lg text-[10px] font-semibold pointer-events-auto cursor-grab active:cursor-grabbing"
                            style={{
                              background: hasOverlap
                                ? "linear-gradient(135deg, rgba(248,113,113,0.20), rgba(245,158,11,0.20))"
                                : "linear-gradient(135deg, rgba(0,194,255,0.18), rgba(168,85,247,0.18))",
                              border: hasOverlap ? "1px solid rgba(248,113,113,0.45)" : "1px solid rgba(0,194,255,0.35)",
                              color: "#fff",
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <GripVertical size={10} className="opacity-60 shrink-0" />
                              <span className="truncate">{s.title || "Schicht"}</span>
                              {hasOverlap && <AlertTriangle size={10} className="text-amber-300 shrink-0" data-testid={`schedule-shift-conflict-${s.id}`} />}
                            </div>
                            <div className="text-[9px] opacity-80 ml-3.5 mt-0.5 flex items-center gap-1">
                              <Clock size={9} /> {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                            </div>
                            {s.location && (
                              <div className="text-[9px] opacity-70 ml-3.5 flex items-center gap-1 truncate">
                                <MapPin size={9} /> {s.location}
                              </div>
                            )}
                            {/* Resize handle (bottom) */}
                            <div
                              data-testid={`schedule-shift-resize-${s.id}`}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const startY = e.clientY;
                                const orig = new Date(s.end_time);
                                let latestEnd = orig.toISOString();
                                const onMove = (ev) => {
                                  const dy = ev.clientY - startY;
                                  // 1 px = 1 minute (round to 15)
                                  const minutesAdded = Math.round(dy / 15) * 15;
                                  const ne = new Date(orig.getTime() + minutesAdded * 60000);
                                  if (ne <= new Date(s.start_time)) return;
                                  latestEnd = ne.toISOString();
                                  setShifts((prev) => prev.map((x) => x.id === s.id ? { ...x, end_time: latestEnd } : x));
                                };
                                const onUp = async () => {
                                  window.removeEventListener("mousemove", onMove);
                                  window.removeEventListener("mouseup", onUp);
                                  if (latestEnd !== orig.toISOString()) {
                                    await patchShiftWithConflict(s.id, { end_time: latestEnd }, "Schichtdauer angepasst");
                                  }
                                };
                                window.addEventListener("mousemove", onMove);
                                window.addEventListener("mouseup", onUp);
                              }}
                              className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize rounded-b-lg bg-white/15 hover:bg-[#00C2FF]/60"
                              title="Ziehen, um Schichtdauer anzupassen"
                            />
                          </div>
                        );})}
                      </div>
                      {cellShifts.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <Plus size={14} className="text-white/15" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {editingCell && (
          <ShiftEditor
            cell={editingCell}
            members={members}
            onClose={() => setEditingCell(null)}
            onSaved={() => { setEditingCell(null); load(); }}
          />
        )}
        {showRepeat && (
          <RepeatWeekModal
            weekStart={weekStart}
            shiftCount={shifts.length}
            onClose={() => setShowRepeat(false)}
            onDone={() => { setShowRepeat(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ShiftEditor({ cell, members, onClose, onSaved }) {
  const { isNew, shift, date: dateStr } = cell;
  const [form, setForm] = useState(() => {
    const baseDate = dateStr;
    const startH = shift?.start_time ? new Date(shift.start_time) : (() => { const d = new Date(`${baseDate}T09:00:00`); return d; })();
    const endH = shift?.end_time ? new Date(shift.end_time) : (() => { const d = new Date(`${baseDate}T17:00:00`); return d; })();
    return {
      staff_id: shift?.staff_id || cell.staff_id,
      title: shift?.title || "Schicht",
      location: shift?.location || "",
      date: baseDate,
      start: startH.toTimeString().slice(0, 5),
      end: endH.toTimeString().slice(0, 5),
    };
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    if (!form.title.trim()) return toast.error("Titel fehlt");
    if (!form.start || !form.end) return toast.error("Start- und Endzeit fehlen");
    const start_time = new Date(`${form.date}T${form.start}:00`).toISOString();
    const end_time = new Date(`${form.date}T${form.end}:00`).toISOString();
    if (new Date(end_time) <= new Date(start_time)) return toast.error("Endzeit muss nach Startzeit liegen");

    setSaving(true);
    const payload = {
      staff_id: form.staff_id,
      title: form.title,
      location: form.location || null,
      start_time, end_time,
    };
    const doFetch = async (force) => {
      const url = isNew
        ? `${API}/api/staff/shifts${force ? "?force=true" : ""}`
        : `${API}/api/staff/shifts/${shift.id}${force ? "?force=true" : ""}`;
      return fetch(url, {
        method: isNew ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    };
    try {
      const r = await doFetch(false);
      if (r.ok) { toast.success(isNew ? "Schicht erstellt" : "Aktualisiert"); onSaved(); }
      else if (r.status === 409) {
        const d = await r.json();
        const ok = window.confirm(`⚠️ Konflikt: ${d.detail?.message || "Überschneidung."} Trotzdem speichern?`);
        if (ok) {
          const r2 = await doFetch(true);
          if (r2.ok) { toast.success("Trotz Konflikt gespeichert"); onSaved(); }
          else toast.error("Speichern fehlgeschlagen");
        }
      } else toast.error("Speichern fehlgeschlagen");
    } catch (e) { toast.error("Netzwerkfehler"); }
    setSaving(false);
  };

  const remove = async () => {
    if (!shift?.id) return;
    if (!window.confirm("Schicht wirklich löschen?")) return;
    setDeleting(true);
    try {
      const r = await fetch(`${API}/api/staff/shifts/${shift.id}`, { method: "DELETE", credentials: "include" });
      if (r.ok) { toast.success("Gelöscht"); onSaved(); }
      else toast.error("Löschen fehlgeschlagen");
    } catch (e) { toast.error("Netzwerkfehler"); }
    setDeleting(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
      data-testid="shift-editor-overlay"
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[#0A0A0A] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-3 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold font-outfit">{isNew ? "Neue Schicht" : "Schicht bearbeiten"}</h3>
          <button onClick={onClose} data-testid="shift-editor-close" className="p-1.5 rounded-lg hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        <Lbl>Mitarbeiter</Lbl>
        <select
          value={form.staff_id}
          onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
          data-testid="shift-editor-staff"
          className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm outline-none focus:border-[#00C2FF]/40"
        >
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <Lbl>Titel</Lbl>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          data-testid="shift-editor-title"
          className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm outline-none focus:border-[#00C2FF]/40"
        />

        <div className="grid grid-cols-3 gap-2">
          <div>
            <Lbl>Datum</Lbl>
            <input
              type="date" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              data-testid="shift-editor-date"
              className="w-full px-2 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm outline-none focus:border-[#00C2FF]/40"
            />
          </div>
          <div>
            <Lbl>Start</Lbl>
            <input
              type="time" value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
              data-testid="shift-editor-start"
              className="w-full px-2 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm outline-none focus:border-[#00C2FF]/40"
            />
          </div>
          <div>
            <Lbl>Ende</Lbl>
            <input
              type="time" value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
              data-testid="shift-editor-end"
              className="w-full px-2 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm outline-none focus:border-[#00C2FF]/40"
            />
          </div>
        </div>

        <Lbl>Ort (optional)</Lbl>
        <input
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          data-testid="shift-editor-location"
          placeholder="z.B. Filiale Mitte"
          className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm outline-none focus:border-[#00C2FF]/40"
        />

        <div className="flex gap-2 pt-2">
          {!isNew && (
            <button
              onClick={remove} disabled={deleting}
              data-testid="shift-editor-delete"
              className="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Löschen
            </button>
          )}
          <button
            onClick={save} disabled={saving}
            data-testid="shift-editor-save"
            className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #00C2FF 0%, #A855F7 100%)" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isNew ? "Anlegen" : "Speichern"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Lbl({ children }) {
  return <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">{children}</label>;
}


function RepeatWeekModal({ weekStart, shiftCount, onClose, onDone }) {
  const [weeks, setWeeks] = useState(1);
  const [skipConflicts, setSkipConflicts] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/staff/shifts/repeat`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_start: weekStart.toISOString().slice(0, 10),
          weeks,
          skip_conflicts: skipConflicts,
        }),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(`${d.created} Schicht(en) angelegt${d.skipped ? `, ${d.skipped} übersprungen` : ""}`);
        onDone();
      } else if (r.status === 409) {
        toast.error('Konflikte vorhanden — aktiviere „Konflikte überspringen" oder bereinige sie.');
      } else toast.error(d.detail || "Fehler");
    } catch (e) { toast.error("Netzwerkfehler"); }
    setBusy(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
      data-testid="schedule-repeat-overlay"
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[#0A0A0A] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold font-outfit flex items-center gap-2">
            <CopyPlus size={16} className="text-[#A855F7]" /> Woche wiederholen
          </h3>
          <button onClick={onClose} data-testid="schedule-repeat-close" className="p-1.5 rounded-lg hover:bg-white/5">
            <X size={16} />
          </button>
        </div>
        <p className="text-[12px] text-white/55">
          Quellwoche: <strong>{weekStart.toLocaleDateString("de-DE")}</strong> · {shiftCount} Schicht(en) in dieser Woche
        </p>

        <Lbl>Anzahl Folgewochen</Lbl>
        <div className="flex items-center gap-2">
          <input
            type="number" min={1} max={12}
            value={weeks}
            onChange={(e) => setWeeks(Math.max(1, Math.min(12, parseInt(e.target.value || "1"))))}
            data-testid="schedule-repeat-weeks"
            className="w-24 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm outline-none"
          />
          <span className="text-[12px] text-white/50">Wochen (1–12)</span>
        </div>

        <label className="flex items-center gap-2 text-[12px] text-white/75 cursor-pointer">
          <input
            type="checkbox" checked={skipConflicts}
            onChange={(e) => setSkipConflicts(e.target.checked)}
            data-testid="schedule-repeat-skip-conflicts"
            className="accent-[#00C2FF]"
          />
          Konflikte überspringen (statt Fehler werfen)
        </label>

        <button
          onClick={submit} disabled={busy}
          data-testid="schedule-repeat-submit"
          className="w-full py-3 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #A855F7 0%, #00C2FF 100%)" }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <CopyPlus size={14} />}
          {weeks} {weeks === 1 ? "Woche" : "Wochen"} klonen
        </button>
      </motion.div>
    </motion.div>
  );
}
