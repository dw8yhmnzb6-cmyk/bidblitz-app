/**
 * StaffChat — 1:1 Manager ↔ Staff Chat MVP.
 * Polling-basiert (alle 6s aktiv, 30s im Hintergrund).
 *
 * Zwei Modi:
 *   <StaffChatInbox role="manager|staff" onOpen={(thread) => ...} />
 *   <StaffChatThread role={...} threadId={...} onBack={() => ...} />
 *
 * Wird in StaffPortalPage (Mehr-Tab + FAB) und StaffManagementPage genutzt.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MessageCircle, Send, Loader2, Plus, Search, CheckCheck, User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

// ════════════════════════════════════════════════════════════════
// API helpers
// ════════════════════════════════════════════════════════════════
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...opts });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.detail || `HTTP ${res.status}`);
  return d;
}

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 1) return "Gestern";
  if (diffDays < 7) return d.toLocaleDateString("de-DE", { weekday: "short" });
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

// ════════════════════════════════════════════════════════════════
// Inbox — Liste aller Threads
// ════════════════════════════════════════════════════════════════
export function StaffChatInbox({ role = "manager", onOpen, onBack, onNew }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api("/api/staff/chat/threads");
      setThreads(d.threads || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-lg border-b border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button onClick={onBack} data-testid="chat-back-btn" className="p-2 -ml-2 rounded-xl hover:bg-slate-100 transition">
                <ArrowLeft size={20} className="text-slate-700" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Nachrichten</h1>
              <p className="text-xs text-slate-500">{role === "manager" ? "Team-Chat" : "Mit deinem Manager"}</p>
            </div>
          </div>
          {role === "manager" && (
            <button
              onClick={() => setShowNew(true)}
              data-testid="chat-new-thread-btn"
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 transition shadow-sm"
            >
              <Plus size={14} /> Neuer Chat
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-3 py-4">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        )}

        {!loading && threads.length === 0 && (
          <div className="py-16 px-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <MessageCircle size={32} className="text-blue-500" strokeWidth={1.8} />
            </div>
            <p className="text-base font-bold text-slate-900">Noch keine Nachrichten</p>
            <p className="text-sm text-slate-500 mt-1 max-w-[260px]">
              {role === "manager"
                ? "Starte einen Chat mit einem Mitarbeiter über den Button oben rechts."
                : "Dein Manager wird hier mit dir kommunizieren."}
            </p>
          </div>
        )}

        <div className="space-y-1">
          {threads.map((t) => (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onOpen?.(t)}
              data-testid={`chat-thread-${t.id}`}
              className="w-full p-3 flex items-center gap-3 rounded-2xl bg-white hover:bg-slate-50 border border-transparent hover:border-slate-200 transition text-left"
            >
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white font-bold flex items-center justify-center">
                  {(t.staff?.name || "?").charAt(0).toUpperCase()}
                </div>
                {t.unread > 0 && (
                  <span
                    data-testid={`chat-unread-badge-${t.id}`}
                    className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white"
                  >
                    {t.unread}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900 truncate">{t.staff?.name || "Mitarbeiter"}</p>
                  {t.last_message_at && (
                    <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{formatTime(t.last_message_at)}</span>
                  )}
                </div>
                <p className={`text-xs truncate mt-0.5 ${t.unread > 0 ? "text-slate-900 font-semibold" : "text-slate-500"}`}>
                  {t.last_sender_role === (role === "manager" ? "manager" : "staff") && <span className="text-slate-400">Du: </span>}
                  {t.last_message_preview || "—"}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {showNew && <NewThreadDialog onClose={() => setShowNew(false)} onCreated={(t) => { setShowNew(false); onOpen?.(t); load(); }} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// NewThreadDialog (Manager-only)
// ════════════════════════════════════════════════════════════════
function NewThreadDialog({ onClose, onCreated }) {
  const [members, setMembers] = useState([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await api("/api/staff/members");
        setMembers((d.members || []).filter((m) => m.active !== false));
      } catch (e) {
        toast.error(e.message);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => (m.name || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q));
  }, [members, filter]);

  const create = async (m) => {
    setBusy(true);
    try {
      const d = await api("/api/staff/chat/threads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staff_id: m.id }) });
      onCreated?.(d.thread);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        data-testid="chat-new-dialog"
      >
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold">Neuer Chat</h2>
          <p className="text-xs text-slate-500 mt-0.5">Wähle einen Mitarbeiter</p>
        </div>
        <div className="px-6 py-3 border-b border-slate-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder="Suchen…"
              data-testid="chat-new-search"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:bg-white focus:border-blue-300"
            />
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-3 py-2">
          {filtered.length === 0 && <p className="text-center text-sm text-slate-500 py-10">Keine Mitarbeiter</p>}
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => create(m)}
              disabled={busy}
              data-testid={`chat-new-pick-${m.id}`}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition text-left disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white font-bold flex items-center justify-center shrink-0">
                {(m.name || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{m.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{m.email}</p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Thread — Conversation View
// ════════════════════════════════════════════════════════════════
export function StaffChatThread({ role = "manager", threadId, onBack }) {
  const [messages, setMessages] = useState([]);
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const me = role;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await api(`/api/staff/chat/threads/${threadId}/messages`);
      setMessages(d.messages || []);
      setThread(d.thread || null);
      // Mark as read
      try { await api(`/api/staff/chat/threads/${threadId}/read`, { method: "PATCH" }); } catch {}
    } catch (e) {
      if (!silent) toast.error(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 5000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    // optimistic
    const optimistic = {
      id: `tmp-${Date.now()}`,
      thread_id: threadId,
      sender_role: me,
      text,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((m) => [...m, optimistic]);
    try {
      await api(`/api/staff/chat/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      await load(true);
    } catch (err) {
      toast.error(err.message);
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const peerName = thread?.staff?.name || (role === "staff" ? "Manager" : "Mitarbeiter");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
          <button onClick={onBack} data-testid="chat-thread-back" className="p-2 -ml-2 rounded-xl hover:bg-slate-100 transition">
            <ArrowLeft size={20} className="text-slate-700" />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white font-bold flex items-center justify-center">
            {peerName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 truncate" data-testid="chat-thread-peer-name">
              {role === "staff" ? "Manager" : peerName}
            </p>
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 max-w-3xl w-full mx-auto" data-testid="chat-messages">
        {loading && (
          <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-blue-500" /></div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center py-20 text-slate-500 text-sm">
            Beginne die Unterhaltung
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, idx) => {
            const isMine = m.sender_role === me;
            const prev = messages[idx - 1];
            const showGroup = !prev || prev.sender_role !== m.sender_role || new Date(m.created_at) - new Date(prev.created_at) > 5 * 60 * 1000;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                data-testid={`chat-message-${m.sender_role}`}
                className={`flex ${isMine ? "justify-end" : "justify-start"} ${showGroup ? "mt-3" : "mt-1"}`}
              >
                <div
                  className={`max-w-[78%] px-3.5 py-2.5 ${
                    isMine
                      ? "bg-blue-500 text-white rounded-2xl rounded-br-md"
                      : "bg-white text-slate-900 border border-slate-200 rounded-2xl rounded-bl-md shadow-sm"
                  } ${m._optimistic ? "opacity-70" : ""}`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                  <div className={`flex items-center gap-1 mt-1 text-[10px] ${isMine ? "text-blue-100" : "text-slate-400"}`}>
                    <span className="tabular-nums">
                      {new Date(m.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isMine && m.read_at && <CheckCheck size={11} />}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Composer */}
      <form
        onSubmit={send}
        className="sticky bottom-0 z-[70] bg-white border-t border-slate-200 px-3 py-3 max-w-3xl w-full mx-auto"
        data-testid="chat-composer"
      >
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Nachricht schreiben…"
            data-testid="chat-input"
            className="flex-1 resize-none px-4 py-3 rounded-2xl bg-slate-100 border border-transparent focus:bg-white focus:border-blue-300 focus:outline-none text-sm max-h-32"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            data-testid="chat-send-btn"
            className="w-12 h-12 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Combined Page (Inbox → Thread)
// ════════════════════════════════════════════════════════════════
export default function StaffChatPage({ role = "manager", onBack }) {
  const [activeThread, setActiveThread] = useState(null);

  if (activeThread) {
    return <StaffChatThread role={role} threadId={activeThread.id} onBack={() => setActiveThread(null)} />;
  }
  return <StaffChatInbox role={role} onBack={onBack} onOpen={setActiveThread} />;
}
