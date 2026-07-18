/**
 * AIChatWidget - Schwebender AI-Chatbot, immer verfügbar
 * Bottom-right floating bubble that opens a chat sheet
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, Sparkles, Trash2 } from "lucide-react";
import { TEST_MODE } from "../config/testMode";

const API = process.env.REACT_APP_BACKEND_URL;
const STORAGE_KEY = "bb_ai_chat_session";
const SUPPRESSED_PATHS = new Set(["/", "/home", "/wallet", "/all-services", "/more"]);

const QUICK_PROMPTS = [
  "Was kann ich heute machen?",
  "Wie funktioniert die Lotterie?",
  "Restaurants in meiner Nähe",
  "Wie verdiene ich BLZ-Token?",
];

export default function AIChatWidget({ hidden = false }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
  });
  const scrollRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const send = useCallback(async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: msg, session_id: sessionId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Fehler");
      if (j.session_id && j.session_id !== sessionId) {
        setSessionId(j.session_id);
        try { localStorage.setItem(STORAGE_KEY, j.session_id); } catch (storageError) { void storageError; }
      }
      setMessages((m) => [...m, { role: "assistant", content: j.response }]);
    } catch (e) {
      setMessages((m) => [...m, {
        role: "assistant",
        content: "Entschuldigung, ich bin gerade nicht erreichbar. Bitte versuche es später erneut.",
        error: true,
      }]);
    }
    setBusy(false);
  }, [input, busy, sessionId]);

  const reset = async () => {
    if (sessionId) {
      try {
        await fetch(`${API}/api/ai/chat/${sessionId}`, { method: "DELETE", credentials: "include" });
      } catch (deleteError) { void deleteError; }
    }
    setSessionId(null);
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch (storageError) { void storageError; }
  };

  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
  if (hidden || TEST_MODE || SUPPRESSED_PATHS.has(currentPath)) return null;

  return (
    <>
      {/* Floating Bubble */}
      <AnimatePresence>
        {!open && (
          <motion.button
            data-testid="ai-chat-fab"
            onClick={() => setOpen(true)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.9 }}
            className="fixed right-4 z-40 w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              bottom: "calc(var(--app-bottom-nav-offset, 5.5rem) + 0.75rem)",
              background: "linear-gradient(135deg,#A855F7 0%,#EC4899 100%)",
              boxShadow: "0 8px 32px rgba(168,85,247,0.5), 0 0 0 1px rgba(255,255,255,0.1)",
            }}
            aria-label="AI-Assistent öffnen"
          >
            <Sparkles size={22} className="text-white" />
            <motion.span
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400"
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            data-testid="ai-chat-sheet"
            className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="w-full sm:max-w-md h-[85vh] sm:h-[600px] bg-[#0a0a0a] border-t sm:border border-white/[0.08] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]"
                   style={{ background: "linear-gradient(135deg,rgba(168,85,247,0.18),rgba(236,72,153,0.12))" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center"
                       style={{ background: "linear-gradient(135deg,#A855F7,#EC4899)" }}>
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[14px] font-black text-white leading-none">BidBlitz AI</p>
                    <p className="text-[10px] text-emerald-400 mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Online · gpt-5.2
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <button
                      data-testid="ai-chat-reset"
                      onClick={reset}
                      className="w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center"
                      title="Verlauf löschen"
                    >
                      <Trash2 size={14} className="text-white/60" />
                    </button>
                  )}
                  <button
                    data-testid="ai-chat-close"
                    onClick={() => setOpen(false)}
                    className="w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center"
                  >
                    <X size={16} className="text-white/70" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && !busy && (
                  <div className="text-center pt-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3"
                         style={{ background: "linear-gradient(135deg,#A855F7,#EC4899)" }}>
                      <MessageCircle size={28} className="text-white" />
                    </div>
                    <p className="text-[15px] font-bold text-white">Wie kann ich helfen?</p>
                    <p className="text-[12px] text-white/50 mt-1 mb-4">Frag mich alles über BidBlitz</p>
                    <div className="space-y-2">
                      {QUICK_PROMPTS.map((p) => (
                        <button
                          key={p}
                          data-testid={`ai-quick-${p.slice(0,10).replace(/\s/g,'-')}`}
                          onClick={() => send(p)}
                          className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-[12px] text-white/85 transition-all"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      data-testid={`ai-msg-${m.role}`}
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                        m.role === "user"
                          ? "text-white"
                          : m.error
                          ? "bg-red-500/10 border border-red-500/30 text-red-300"
                          : "bg-white/[0.05] border border-white/[0.08] text-white/95"
                      }`}
                      style={m.role === "user" ? {
                        background: "linear-gradient(135deg,#A855F7,#EC4899)",
                      } : undefined}
                    >
                      {m.content}
                    </div>
                  </motion.div>
                ))}

                {busy && (
                  <div className="flex justify-start">
                    <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-3.5 py-2.5 flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-purple-400" />
                      <span className="text-[12px] text-white/50">denkt...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-white/[0.06] p-3 bg-[#050505]">
                <div className="flex items-end gap-2">
                  <textarea
                    data-testid="ai-chat-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Frag den BidBlitz Assistent..."
                    rows={1}
                    className="flex-1 resize-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white placeholder-white/40 focus:outline-none focus:border-purple-400/50 max-h-24"
                  />
                  <motion.button
                    data-testid="ai-chat-send"
                    onClick={() => send()}
                    disabled={busy || !input.trim()}
                    whileTap={{ scale: 0.92 }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg,#A855F7,#EC4899)" }}
                  >
                    {busy ? <Loader2 size={15} className="animate-spin text-white" /> : <Send size={15} className="text-white" />}
                  </motion.button>
                </div>
                <p className="text-[9px] text-white/30 mt-1.5 text-center">
                  Antworten generiert von KI · können fehlerhaft sein
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
