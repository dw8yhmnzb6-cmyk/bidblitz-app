/**
 * BidBlitz V2 - Support Chat Page
 * Ticket-based support chat with threaded messages
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, MessageCircle, Plus, Loader2, Check,
  Clock, X, Headphones, ChevronRight, Search
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_CFG = {
  open: { label: "Offen", color: "#00C2FF", bg: "rgba(0,194,255,0.1)" },
  resolved: { label: "Gelöst", color: "#00D26A", bg: "rgba(0,210,106,0.1)" },
  closed: { label: "Geschlossen", color: "#666", bg: "rgba(102,102,102,0.1)" },
};

const CATEGORIES = [
  { id: "general", label: "Allgemein" },
  { id: "payment", label: "Zahlung" },
  { id: "car_rental", label: "Autovermietung" },
  { id: "account", label: "Konto" },
  { id: "technical", label: "Technisch" },
];

export default function SupportChatPage({ onBack, isAdmin = false }) {
  const [view, setView] = useState("list"); // list | chat | new
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  // New ticket form
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [creating, setCreating] = useState(false);

  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const loadTickets = useCallback(async () => {
    try {
      const endpoint = isAdmin ? "/api/support/admin/tickets" : "/api/support/tickets";
      const res = await fetch(`${API}${endpoint}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [isAdmin]);

  const loadMessages = useCallback(async (ticketId) => {
    try {
      const res = await fetch(`${API}/api/support/tickets/${ticketId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setActiveTicket(data.ticket);
        setMessages(data.messages || []);
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) { console.error(err); }
  }, []);

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!msgText.trim() || !activeTicket || sending) return;
    setSending(true);
    const text = msgText;
    setMsgText("");
    try {
      const res = await fetch(`${API}/api/support/tickets/${activeTicket.ticket_id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        setTimeout(scrollToBottom, 100);
      } else {
        setMsgText(text);
      }
    } catch (err) { setMsgText(text); }
    setSending(false);
  };

  const createTicket = async () => {
    if (!newSubject.trim() || !newMessage.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/api/support/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subject: newSubject, message: newMessage, category: newCategory }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewSubject("");
        setNewMessage("");
        setNewCategory("general");
        await loadTickets();
        // Open the new ticket
        setView("chat");
        await loadMessages(data.ticket_id);
      }
    } catch (err) { console.error(err); }
    setCreating(false);
  };

  const closeTicket = async () => {
    if (!activeTicket) return;
    try {
      await fetch(`${API}/api/support/tickets/${activeTicket.ticket_id}/close`, {
        method: "POST",
        credentials: "include",
      });
      loadTickets();
      loadMessages(activeTicket.ticket_id);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => {
    if (view === "chat" && activeTicket) {
      pollRef.current = setInterval(() => loadMessages(activeTicket.ticket_id), 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [view, activeTicket, loadMessages]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const openTicket = (ticket) => {
    setView("chat");
    setActiveTicket(ticket);
    loadMessages(ticket.ticket_id);
  };

  const filteredTickets = tickets.filter(t =>
    !search || t.subject?.toLowerCase().includes(search.toLowerCase()) ||
    t.user_name?.toLowerCase().includes(search.toLowerCase())
  );

  const fmtTime = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    const now = new Date();
    const diffH = (now - dt) / 3600000;
    if (diffH < 1) return `${Math.floor(diffH * 60)} Min.`;
    if (diffH < 24) return `${Math.floor(diffH)} Std.`;
    return dt.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  };

  // ── NEW TICKET VIEW ──
  if (view === "new") {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
        <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4 flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setView("list")}
            className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="new-ticket-back">
            <ArrowLeft size={20} />
          </motion.button>
          <h1 className="text-lg font-bold">Neue Anfrage</h1>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-[#666] mb-1 block">Kategorie</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <motion.button key={c.id} whileTap={{ scale: 0.95 }}
                  onClick={() => setNewCategory(c.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium ${
                    newCategory === c.id ? "bg-[#00C2FF] text-black" : "bg-white/5 text-[#888]"
                  }`} data-testid={`category-${c.id}`}>
                  {c.label}
                </motion.button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1 block">Betreff *</label>
            <input type="text" value={newSubject} onChange={e => setNewSubject(e.target.value)}
              placeholder="Worum geht es?"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-[#00C2FF]/50"
              data-testid="ticket-subject" />
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1 block">Nachricht *</label>
            <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)}
              rows={5} placeholder="Beschreibe dein Anliegen..."
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none resize-none focus:border-[#00C2FF]/50"
              data-testid="ticket-message" />
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={createTicket}
            disabled={!newSubject.trim() || !newMessage.trim() || creating}
            className="w-full py-4 rounded-xl bg-[#00C2FF] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="submit-ticket-btn">
            {creating ? <Loader2 size={20} className="animate-spin" /> : <><Send size={20} /> Anfrage senden</>}
          </motion.button>
        </div>
      </div>
    );
  }

  // ── CHAT VIEW ──
  if (view === "chat" && activeTicket) {
    const st = STATUS_CFG[activeTicket.status] || STATUS_CFG.open;
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => { setView("list"); setActiveTicket(null); setMessages([]); }}
              className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="chat-back">
              <ArrowLeft size={20} />
            </motion.button>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold truncate">{activeTicket.subject}</h2>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                <span className="text-[10px] text-[#666]">#{activeTicket.ticket_id}</span>
                {isAdmin && <span className="text-[10px] text-[#888]">· {activeTicket.user_name}</span>}
              </div>
            </div>
            {activeTicket.status === "open" && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={closeTicket}
                className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium"
                data-testid="close-ticket-btn">
                <Check size={14} />
              </motion.button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => {
            const isMe = msg.sender_role === (isAdmin ? "admin" : "user");
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  isMe
                    ? "bg-[#00C2FF] text-black rounded-br-md"
                    : msg.sender_role === "admin"
                    ? "bg-purple-500/20 text-white rounded-bl-md border border-purple-500/30"
                    : "bg-white/5 text-white rounded-bl-md border border-white/10"
                }`} data-testid={`msg-${i}`}>
                  {!isMe && (
                    <p className="text-[10px] font-medium mb-0.5 opacity-60">
                      {msg.sender_role === "admin" ? "Support" : msg.sender_name}
                    </p>
                  )}
                  <p className="text-sm leading-relaxed">{msg.message}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? "text-black/50" : "text-[#555]"}`}>
                    {fmtTime(msg.created_at)}
                  </p>
                </div>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {activeTicket.status !== "resolved" || true ? (
          <form onSubmit={sendMessage}
            className="sticky bottom-0 bg-[#0A0A0F]/95 backdrop-blur-xl border-t border-white/5 p-4">
            <div className="flex gap-2">
              <input ref={inputRef} type="text" value={msgText}
                onChange={e => setMsgText(e.target.value)}
                placeholder="Nachricht schreiben..."
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-[#00C2FF]/50"
                data-testid="chat-input" />
              <motion.button type="submit" whileTap={{ scale: 0.9 }}
                disabled={!msgText.trim() || sending}
                className="p-3 rounded-xl bg-[#00C2FF] text-black disabled:opacity-50"
                data-testid="chat-send-btn">
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </motion.button>
            </div>
          </form>
        ) : null}
      </div>
    );
  }

  // ── TICKET LIST VIEW ──
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
              className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="support-back">
              <ArrowLeft size={20} />
            </motion.button>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Headphones size={20} className="text-[#00C2FF]" />
                {isAdmin ? "Support Tickets" : "Support"}
              </h1>
              <p className="text-xs text-[#666]">{tickets.length} Anfragen</p>
            </div>
          </div>
          {!isAdmin && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setView("new")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00C2FF] text-black text-sm font-medium"
              data-testid="new-ticket-btn">
              <Plus size={16} /> Neu
            </motion.button>
          )}
        </div>
        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Suchen..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm outline-none"
              data-testid="support-search" />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" /></div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-20">
            <Headphones size={48} className="mx-auto text-[#333] mb-4" />
            <h3 className="text-white/70 font-semibold">Keine Anfragen</h3>
            <p className="text-sm text-[#666] mt-2">
              {isAdmin ? "Keine offenen Tickets" : "Hast du eine Frage? Erstelle eine neue Anfrage."}
            </p>
            {!isAdmin && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setView("new")}
                className="mt-4 px-6 py-3 rounded-xl bg-[#00C2FF] text-black font-semibold">
                Neue Anfrage
              </motion.button>
            )}
          </div>
        ) : filteredTickets.map((ticket, idx) => {
          const st = STATUS_CFG[ticket.status] || STATUS_CFG.open;
          const cat = CATEGORIES.find(c => c.id === ticket.category)?.label || ticket.category;
          return (
            <motion.div key={ticket.ticket_id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              onClick={() => openTicket(ticket)}
              className="bg-[#111118] rounded-2xl p-4 border border-white/5 cursor-pointer active:scale-[0.98] transition-transform"
              data-testid={`ticket-${ticket.ticket_id}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 mr-3">
                  <h3 className="font-semibold text-sm truncate">{ticket.subject}</h3>
                  {isAdmin && <p className="text-xs text-[#888]">{ticket.user_name} · {ticket.user_email}</p>}
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
                  style={{ background: st.bg, color: st.color }}>{st.label}</span>
              </div>
              <p className="text-xs text-[#666] truncate mb-2">{ticket.last_message}</p>
              <div className="flex items-center justify-between text-[10px] text-[#555]">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-white/5">{cat}</span>
                  <span>{ticket.message_count || 0} Nachrichten</span>
                </div>
                <span>{fmtTime(ticket.last_message_at || ticket.updated_at)}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
