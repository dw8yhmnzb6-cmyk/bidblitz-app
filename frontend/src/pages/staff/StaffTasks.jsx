/**
 * Staff Mobile — Tasks (Connecteam-Style Cards)
 * ==============================================
 * Status-Farben, Priorität, Kommentar/Attachment Placeholder.
 */
import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Clock, MessageSquare, Paperclip, Loader2, ListChecks, AlertTriangle, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "./StaffShifts";
import TaskDetailSheet from "../../components/staff/TaskDetailSheet";

const API = process.env.REACT_APP_BACKEND_URL;

function priorityOf(task) {
  // Heuristik: wenn due_date < heute → hoch, <= 24h → mittel, sonst niedrig
  if (!task.due_date) return { label: "Normal", color: "#6B7280", priority: 0 };
  const due = new Date(task.due_date).getTime();
  const now = Date.now();
  if (due < now) return { label: "Überfällig", color: "#EF4444", priority: 3 };
  if (due - now < 86400000) return { label: "Heute fällig", color: "#F59E0B", priority: 2 };
  if (due - now < 3 * 86400000) return { label: "Bald", color: "#00D4FF", priority: 1 };
  return { label: "Normal", color: "#6B7280", priority: 0 };
}

export default function StaffTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");
  const [busy, setBusy] = useState(null);
  const [openTaskId, setOpenTaskId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/staff/tasks/me?status=${filter}`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setTasks(d.tasks || []);
      }
    } catch (e) {}
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const complete = async (id) => {
    setBusy(id);
    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: "done", completed_at: new Date().toISOString() } : t));
    try {
      const r = await fetch(`${API}/api/staff/tasks/${id}/complete`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error("fail");
      toast.success("Aufgabe erledigt 🎯");
      if (filter === "open") setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      toast.error("Fehler – bitte erneut versuchen");
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div data-testid="staff-tasks-tab" className="px-5 pt-6 pb-2">
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-white/40">Aufgaben</p>
          <h2 className="text-2xl font-bold mt-1 font-outfit">Deine To-Dos</h2>
        </div>
        <div className="flex bg-white/[0.04] border border-white/[0.08] rounded-2xl p-0.5 text-xs">
          {[
            { id: "open", label: "Offen" },
            { id: "done", label: "Erledigt" },
            { id: "all",  label: "Alle"   },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              data-testid={`staff-tasks-filter-${f.id}`}
              className={`px-3 py-1.5 rounded-xl transition-all ${filter === f.id ? "bg-[#00D4FF] text-black font-bold" : "text-white/60"}`}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 size={22} className="animate-spin text-[#00D4FF]" /></div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={filter === "open" ? "Keine offenen Aufgaben" : "Nichts zu zeigen"}
          sub={filter === "open" ? "Du bist auf dem neuesten Stand 🎯" : "Wechsle den Filter um andere Aufgaben zu sehen."}
        />
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {tasks.map((t) => (
              <TaskCard
                key={t.id} task={t}
                onComplete={complete} busy={busy === t.id}
                onOpen={() => setOpenTaskId(t.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {openTaskId && (
          <TaskDetailSheet
            taskId={openTaskId}
            onClose={() => setOpenTaskId(null)}
            onChange={load}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TaskCard({ task, onComplete, busy, onOpen }) {
  const prio = priorityOf(task);
  const done = task.status === "done";
  const commentCount = task.comment_count || 0;
  const photoCount = (task.attachments || []).length;
  const subTotal = (task.subtasks || []).length;
  const subDone = (task.subtasks || []).filter((s) => s.done).length;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40 }}
      data-testid="staff-task-card"
      className={`relative overflow-hidden rounded-2xl p-4 border ${
        done ? "bg-white/[0.02] border-white/[0.05] opacity-60"
             : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]"
      }`}
    >
      {!done && prio.priority > 1 && (
        <div className="absolute top-0 left-0 bottom-0 w-1" style={{ background: prio.color }} />
      )}
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => { e.stopPropagation(); !done && onComplete(task.id); }}
          disabled={done || busy}
          data-testid={`staff-task-complete-${task.id}`}
          className="mt-0.5 w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-90"
        >
          {busy ? <Loader2 size={20} className="animate-spin text-[#00D4FF]" />
                : done ? <CheckCircle2 size={24} className="text-[#10B981]" />
                       : <Circle size={24} className="text-white/30 hover:text-[#00D4FF]" />}
        </button>
        <button onClick={onOpen} data-testid={`staff-task-open-${task.id}`} className="flex-1 min-w-0 text-left">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-bold ${done ? "line-through text-white/50" : ""}`}>{task.title}</p>
            {!done && (
              <span
                className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: `${prio.color}1F`, color: prio.color }}
              >{prio.label}</span>
            )}
          </div>
          {task.description && <p className={`text-[12px] mt-0.5 line-clamp-2 ${done ? "text-white/30" : "text-white/55"}`}>{task.description}</p>}

          {/* Tags */}
          {(task.tags || []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {task.tags.slice(0, 3).map((t) => (
                <span key={t} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/30">
                  <TagIcon size={8} /> {t}
                </span>
              ))}
              {task.tags.length > 3 && <span className="text-[9px] text-white/40">+{task.tags.length - 3}</span>}
            </div>
          )}

          {/* Sub-Task progress */}
          {subTotal > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] text-white/45 mb-0.5">
                <span>Sub-Tasks</span>
                <span className="tabular-nums">{subDone}/{subTotal}</span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${(subDone / subTotal) * 100}%`,
                  background: "linear-gradient(90deg, #00D4FF, #7E5BF6)",
                }} />
              </div>
            </div>
          )}

          <div className="mt-2 flex items-center gap-3 text-[10px] text-white/40">
            {task.due_date && (
              <span className={`flex items-center gap-1 ${prio.priority === 3 ? "text-[#EF4444]" : ""}`}>
                {prio.priority === 3 ? <AlertTriangle size={10} /> : <Clock size={10} />}
                {new Date(task.due_date).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
              </span>
            )}
            <span data-testid="task-comment-count" className={`flex items-center gap-1 ${commentCount > 0 ? "text-[#10D981]" : ""}`}>
              <MessageSquare size={10} /> {commentCount}
            </span>
            <span data-testid="task-photo-count" className={`flex items-center gap-1 ${photoCount > 0 ? "text-[#A855F7]" : ""}`}>
              <Paperclip size={10} /> {photoCount}
            </span>
          </div>
        </button>
      </div>
    </motion.div>
  );
}
