/**
 * BidBlitz Staff — Task Detail Bottom Sheet
 * ==========================================
 * Comments-Stream, Sub-Tasks, Photo-Attachments, Tags.
 * Wird sowohl von Staff (StaffTasks) als auch Merchant nutzbar.
 */
import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Send, Loader2, CheckCircle2, Circle, Paperclip, Image as ImageIcon, Trash2, MessageSquare,
  ListChecks, Tag as TagIcon, Calendar, AlertTriangle, Camera, Plus,
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;
const PRIO_META = {
  high:   { label: "Hoch",   color: "#F31260" },
  normal: { label: "Normal", color: "#71717A" },
  low:    { label: "Niedrig", color: "#10D981" },
};

export default function TaskDetailSheet({ taskId, onClose, onChange }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/staff/tasks/${taskId}`, { credentials: "include" });
      if (r.ok) setTask((await r.json()).task);
    } catch (e) {}
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [taskId]);

  const postComment = async () => {
    if (!newComment.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/staff/tasks/${taskId}/comments`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newComment.trim() }),
      });
      if (!r.ok) throw new Error("fail");
      const j = await r.json();
      setTask((t) => ({ ...t, comments: [...(t?.comments || []), j.comment], comment_count: (t?.comment_count || 0) + 1 }));
      setNewComment("");
      onChange && onChange();
    } catch (e) { toast.error("Kommentar fehlgeschlagen"); }
    setBusy(false);
  };

  const toggleSubtask = async (idx, done) => {
    // Optimistic
    setTask((t) => {
      const subs = [...(t.subtasks || [])];
      subs[idx] = { ...subs[idx], done };
      return { ...t, subtasks: subs };
    });
    try {
      await fetch(`${API}/api/staff/tasks/${taskId}/subtasks/toggle`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: idx, done }),
      });
      onChange && onChange();
    } catch (e) { toast.error("Subtask Update fehlgeschlagen"); load(); }
  };

  const addSubtaskInline = async () => {
    if (!newSubtask.trim()) return;
    const subs = [...(task.subtasks || []), { title: newSubtask.trim(), done: false }];
    setTask((t) => ({ ...t, subtasks: subs }));
    setNewSubtask("");
    try {
      await fetch(`${API}/api/staff/tasks/${taskId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks: subs }),
      });
      onChange && onChange();
    } catch (e) { toast.error("Sub-Task konnte nicht hinzugefügt werden"); }
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    if (file.size > 5_000_000) return toast.error("Bild zu groß (max 5MB)");
    setBusy(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const res = await fetch(`${API}/api/staff/tasks/${taskId}/attachments`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: dataUrl, name: file.name, type: file.type || "image" }),
      });
      if (!res.ok) throw new Error("fail");
      const j = await res.json();
      setTask((t) => ({ ...t, attachments: [...(t.attachments || []), j.attachment] }));
      toast.success("Foto hochgeladen 📸");
      onChange && onChange();
    } catch (e) { toast.error("Upload fehlgeschlagen"); }
    setBusy(false);
  };

  const removeAttachment = async (idx) => {
    if (!window.confirm("Foto wirklich löschen?")) return;
    try {
      await fetch(`${API}/api/staff/tasks/${taskId}/attachments/${idx}`, {
        method: "DELETE", credentials: "include",
      });
      setTask((t) => ({ ...t, attachments: (t.attachments || []).filter((_, i) => i !== idx) }));
      onChange && onChange();
    } catch (e) { toast.error("Löschen fehlgeschlagen"); }
  };

  const completed = task?.status === "done";
  const prio = PRIO_META[task?.priority || "normal"];
  const totalSubs = task?.subtasks?.length || 0;
  const doneSubs = (task?.subtasks || []).filter((s) => s.done).length;
  const subProgress = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
      data-testid="task-detail-sheet"
    >
      <motion.div
        initial={{ y: 240, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 240, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90vh] bg-[#0A0B10] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-1 bg-white/15 rounded-full mx-auto sm:hidden" />
            <button onClick={onClose} data-testid="task-detail-close" className="ml-auto p-2 rounded-xl hover:bg-white/5 active:scale-90">
              <X size={18} className="text-white/60" />
            </button>
          </div>

          {loading || !task ? (
            <div className="py-8 flex justify-center"><Loader2 size={20} className="animate-spin text-[#00D4FF]" /></div>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <h3 className={`text-lg font-bold tracking-tight flex-1 ${completed ? "line-through text-white/50" : ""}`}>{task.title}</h3>
                {task.priority && task.priority !== "normal" && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: `${prio.color}1F`, color: prio.color }}>{prio.label}</span>
                )}
              </div>
              {task.description && <p className="text-[13px] text-white/65 mt-1.5">{task.description}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {task.due_date && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-white/[0.04] border border-white/10 text-white/70">
                    <Calendar size={11} /> {new Date(task.due_date).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
                  </span>
                )}
                {(task.tags || []).map((t) => (
                  <span key={t} data-testid="task-tag" className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-[#00D4FF]/10 border border-[#00D4FF]/30 text-[#00D4FF]">
                    <TagIcon size={10} /> {t}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Body */}
        {!loading && task && (
          <div className="flex-1 overflow-y-auto px-5 pb-3">
            {/* Subtasks */}
            <Section
              icon={ListChecks}
              title="Sub-Tasks"
              meta={totalSubs > 0 && `${doneSubs}/${totalSubs} · ${subProgress}%`}
              color="#00D4FF"
            >
              {totalSubs > 0 && (
                <div className="space-y-1.5">
                  {task.subtasks.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleSubtask(idx, !s.done)}
                      data-testid={`task-subtask-${idx}`}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-colors text-left"
                    >
                      {s.done ? <CheckCircle2 size={18} className="text-[#10D981] flex-shrink-0" /> : <Circle size={18} className="text-white/30 flex-shrink-0" />}
                      <span className={`text-sm flex-1 ${s.done ? "line-through text-white/40" : ""}`}>{s.title}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <input
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSubtaskInline()}
                  placeholder="Neuer Sub-Task…"
                  data-testid="task-subtask-input"
                  className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm outline-none focus:border-[#00D4FF]/40"
                />
                <button
                  onClick={addSubtaskInline}
                  disabled={!newSubtask.trim()}
                  data-testid="task-subtask-add"
                  className="px-3 rounded-xl bg-[#00D4FF]/15 border border-[#00D4FF]/30 text-[#00D4FF] disabled:opacity-40"
                ><Plus size={16} /></button>
              </div>
            </Section>

            {/* Photos */}
            <Section icon={ImageIcon} title="Fotos" meta={(task.attachments?.length || 0) > 0 && `${task.attachments.length}`} color="#A855F7">
              {(task.attachments || []).length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {task.attachments.map((a, idx) => (
                    <div key={idx} data-testid={`task-photo-${idx}`} className="relative group aspect-square rounded-xl overflow-hidden bg-white/5">
                      <img src={a.url} alt={a.name || "Foto"} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeAttachment(idx)}
                        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      ><Trash2 size={12} className="text-white" /></button>
                    </div>
                  ))}
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => uploadPhoto(e.target.files?.[0])}
                data-testid="task-photo-input"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                data-testid="task-photo-upload"
                className="w-full py-2.5 rounded-xl border border-dashed border-white/15 text-white/60 text-sm flex items-center justify-center gap-2 hover:bg-white/[0.04] disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} Foto hinzufügen
              </button>
            </Section>

            {/* Comments */}
            <Section icon={MessageSquare} title="Kommentare" meta={task.comments?.length > 0 && `${task.comments.length}`} color="#10D981">
              {(task.comments || []).length === 0 ? (
                <p className="text-[11px] text-white/35 text-center py-3">Noch keine Kommentare</p>
              ) : (
                <div className="space-y-2 mb-3">
                  {task.comments.map((c) => <CommentBubble key={c.id} comment={c} />)}
                </div>
              )}
            </Section>
          </div>
        )}

        {/* Comment Input — sticky footer */}
        {!loading && task && (
          <div className="px-5 py-3 border-t border-white/[0.06] bg-[#0A0B10] flex items-end gap-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={1}
              placeholder="Kommentar schreiben…"
              data-testid="task-comment-input"
              className="flex-1 px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-sm resize-none outline-none focus:border-[#00D4FF]/40 max-h-24"
            />
            <button
              onClick={postComment}
              disabled={busy || !newComment.trim()}
              data-testid="task-comment-submit"
              className="h-11 w-11 rounded-2xl flex-shrink-0 flex items-center justify-center disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #00D4FF, #7E5BF6)" }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="text-white" />}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Section({ icon: Icon, title, meta, color, children }) {
  return (
    <div className="py-4 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon size={13} style={{ color }} />
          <p className="text-[11px] uppercase tracking-[0.15em] text-white/50 font-bold">{title}</p>
        </div>
        {meta && <span className="text-[10px] text-white/40 tabular-nums">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

function CommentBubble({ comment }) {
  const isMerchant = comment.author_type === "merchant";
  return (
    <div className={`flex gap-2 ${isMerchant ? "" : ""}`} data-testid="task-comment-bubble">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
        style={{ background: isMerchant ? "linear-gradient(135deg, #A855F7, #F31260)" : "linear-gradient(135deg, #00D4FF, #7E5BF6)" }}
      >{comment.author_name?.[0]?.toUpperCase() || "?"}</div>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl px-3 py-2 bg-white/[0.04] border border-white/[0.06]">
          <div className="flex items-baseline gap-2 mb-0.5">
            <p className="text-[11px] font-semibold text-white/85 truncate">{comment.author_name}</p>
            {isMerchant && <span className="text-[8px] uppercase font-bold text-[#A855F7] tracking-wider">Manager</span>}
          </div>
          <p className="text-[13px] text-white/85 whitespace-pre-wrap">{comment.body}</p>
        </div>
        <p className="text-[9px] text-white/30 mt-0.5 pl-1">
          {new Date(comment.created_at).toLocaleString("de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
