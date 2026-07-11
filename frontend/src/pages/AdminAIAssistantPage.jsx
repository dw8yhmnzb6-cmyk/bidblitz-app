import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Mic, MicOff, Loader2, Sparkles, ShieldCheck, Wand2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;
const STORAGE_KEY = "bidblitz-admin-ai-conversation";

const QUICK_PROMPTS = [
  "Mach 10 neue Premium-Tech-Auktionen für 2026.",
  "Lösch die alten Auktionen und erstelle 12 neue Premium-Auktionen mit Smartphones, Laptops und VR.",
  "Prüfe bitte die Webseite, Login und Registrierung und zeig mir die Fehlerlage.",
  "Aktualisiere den Titel der iPhone Auktion und prüfe danach die Plattform.",
  "Sende für agimk@me.com einen Passwort-Reset.",
  "Schreibe reviewer@bidblitz.ae 25 EUR gut.",
  "Wer konnte sich heute nicht anmelden?",
  "Welche Fehler sind heute am schlimmsten?",
];

const MessageBubble = ({ message, onConfirm, confirming }) => {
  const isUser = message.role === "user";
  const plan = message.plan;
  const results = message.execution_results || [];
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`} data-testid={`admin-ai-message-${message.role}`}>
      <div className={`max-w-[88%] rounded-[24px] px-4 py-3 ${isUser ? "bg-[#00C2FF] text-black" : "bg-white/[0.04] border border-white/[0.08] text-white"}`}>
        <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{message.content}</p>

        {plan && (
          <div className="mt-3 rounded-2xl bg-black/20 border border-white/8 p-3" data-testid="admin-ai-plan-card">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="text-[12px] font-bold text-white flex items-center gap-2"><Wand2 size={14} className="text-[#00C2FF]" /> {plan.assistant_title}</p>
                <p className="text-[10px] text-white/55 mt-1">{plan.assistant_message}</p>
              </div>
              <span className="rounded-full px-2 py-1 text-[9px] font-bold uppercase bg-amber-500/15 text-amber-300">Vorschlag</span>
            </div>

            {(plan.warnings || []).length > 0 && (
              <div className="mb-2 space-y-1">
                {plan.warnings.map((warning, idx) => (
                  <div key={idx} className="rounded-xl px-3 py-2 bg-amber-500/10 text-amber-200 text-[10px] flex items-start gap-2" data-testid={`admin-ai-warning-${idx}`}>
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 mb-3">
              {(plan.operations || []).map((op, idx) => (
                <div key={idx} className="rounded-xl bg-white/[0.04] px-3 py-2" data-testid={`admin-ai-operation-${idx}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-white">{op.type}</p>
                    {op.items?.length ? <span className="text-[10px] text-[#00C2FF]">{op.items.length} Items</span> : null}
                  </div>
                  <p className="text-[10px] text-white/45 mt-1">{op.reason || "Kein Grund angegeben"}</p>
                  {op.match_titles?.length ? <p className="text-[10px] text-white/55 mt-1">Treffer: {op.match_titles.join(", ")}</p> : null}
                  {op.items?.length ? <p className="text-[10px] text-white/55 mt-1">Beispiele: {op.items.slice(0, 3).map((item) => item.title).join(", ")}</p> : null}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onConfirm?.(message.plan_action_id)}
              disabled={confirming}
              data-testid="admin-ai-confirm-plan-btn"
              className="w-full rounded-2xl py-3 bg-[#00C2FF] text-black text-[12px] font-black disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {confirming ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              Vorschlag ausführen
            </button>
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/15 p-3" data-testid="admin-ai-results-card">
            <p className="text-[12px] font-bold text-emerald-300 flex items-center gap-2"><CheckCircle2 size={14} /> Ausgeführt</p>
            <div className="space-y-2 mt-2">
              {results.map((result, idx) => (
                <div key={idx} className="rounded-xl bg-black/15 px-3 py-2 text-[10px] text-white/75" data-testid={`admin-ai-result-${idx}`}>
                  <p className="font-semibold text-white">{result.type}</p>
                  <p className="mt-1 whitespace-pre-wrap">{JSON.stringify(result)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function AdminAIAssistantPage({ onBack }) {
  const [conversationId, setConversationId] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmingActionId, setConfirmingActionId] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const scrollRef = useRef(null);

  const browserSpeechSupported = useMemo(() => typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window), []);

  useEffect(() => {
    if (!conversationId) return;
    localStorage.setItem(STORAGE_KEY, conversationId);
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!conversationId) return;
    const loadHistory = async () => {
      try {
        const res = await fetch(`${API}/api/admin/ai-assistant/history?conversation_id=${encodeURIComponent(conversationId)}`, { credentials: "include" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Verlauf konnte nicht geladen werden");
        setMessages(data.messages || []);
      } catch (error) {
        console.error(error);
      }
    };
    loadHistory();
  }, [conversationId]);

  useEffect(() => {
    if (!browserSpeechSupported) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "de-DE";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      setInput(transcript);
      if (event.results[current].isFinal) setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
  }, [browserSpeechSupported]);

  const sendPrompt = async (messageText = input) => {
    const trimmed = messageText.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/ai-assistant/plan`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversation_id: conversationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Vorschlag konnte nicht erstellt werden");
      if (!conversationId && data.conversation_id) setConversationId(data.conversation_id);
      const now = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmed, created_at: now },
        { role: "assistant", content: data.plan?.assistant_message || "Vorschlag bereit.", created_at: now, plan: data.plan, plan_action_id: data.action_id },
      ]);
      setInput("");
    } catch (error) {
      toast.error(error.message || "KI Vorschlag fehlgeschlagen");
    }
    setLoading(false);
  };

  const confirmPlan = async (actionId) => {
    if (!actionId) return;
    setConfirmingActionId(actionId);
    try {
      const res = await fetch(`${API}/api/admin/ai-assistant/confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_id: actionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Ausführung fehlgeschlagen");
      setMessages((prev) => prev.map((msg) => msg.plan_action_id === actionId ? { ...msg, execution_results: data.results, plan: null } : msg));
      toast.success("Aktion ausgeführt");
    } catch (error) {
      toast.error(error.message || "Ausführung fehlgeschlagen");
    }
    setConfirmingActionId("");
  };

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      toast.error("Spracherkennung wird auf diesem Browser nicht unterstützt.");
      return;
    }
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setInput("");
      recognitionRef.current.start();
      setListening(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#05060A] text-white pb-24" data-testid="admin-ai-assistant-page">
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#05060A]/90 border-b border-white/[0.08] px-4 py-3 flex items-center justify-between">
        <button type="button" onClick={onBack} data-testid="admin-ai-back-btn" className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
          <ArrowLeft size={16} className="text-white/70" />
        </button>
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">Admin KI</p>
          <h1 className="text-[16px] font-black flex items-center gap-2 justify-center"><Bot size={16} className="text-[#00C2FF]" /> Armend Assistent</h1>
        </div>
        <div className="w-10" />
      </div>

      <div className="px-4 py-4 space-y-4 max-w-5xl mx-auto">
        <div className="rounded-[28px] p-5 border border-white/[0.08]" style={{ background: "linear-gradient(135deg, rgba(0,194,255,0.14), rgba(168,85,247,0.14), rgba(255,255,255,0.04))" }}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-bold">Vorschlag vor Ausführung</p>
          <h2 className="text-[24px] font-black mt-1">Sag einfach, was du im Admin brauchst.</h2>
          <p className="text-[12px] text-white/60 mt-2 max-w-[760px]">Zum Beispiel: „Mach 10 neue Auktionen“, „Lösch die alten Auktionen und erstelle neue“, „Prüfe Login und Registrierung“. Die KI zeigt erst einen sicheren Plan, dann bestätigst du.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button key={idx} type="button" onClick={() => sendPrompt(prompt)} data-testid={`admin-ai-quick-prompt-${idx}`} className="rounded-2xl px-3 py-3 text-left bg-black/20 border border-white/8 hover:border-[#00C2FF]/35 transition-all">
                <span className="text-[11px] text-white/80">{prompt}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.03] overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-bold">Konversation</p>
              <p className="text-[10px] text-white/45">Alles wird gespeichert, damit spätere Befehle den Verlauf verstehen.</p>
            </div>
            <span className="rounded-full px-3 py-1 bg-[#00C2FF]/12 text-[#00C2FF] text-[10px] font-bold" data-testid="admin-ai-status-chip">Vorschlag zuerst</span>
          </div>

          <div className="p-4 space-y-3 min-h-[360px] max-h-[56vh] overflow-y-auto" data-testid="admin-ai-messages-list">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-white/45 text-[12px]">
                Gib einen Admin-Befehl ein oder nutze Sprache. Die KI zeigt dir erst den Plan.
              </div>
            ) : messages.map((message, idx) => <MessageBubble key={`${message.created_at || idx}-${idx}`} message={message} onConfirm={confirmPlan} confirming={confirmingActionId === message.plan_action_id} />)}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-[12px] flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-[#00C2FF]" /> KI baut den Vorschlag...
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="p-4 border-t border-white/[0.06] bg-black/20">
            <div className="flex items-end gap-3">
              <div className="flex-1 rounded-[24px] bg-white/[0.04] border border-white/[0.08] px-4 py-3">
                <textarea
                  data-testid="admin-ai-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Zum Beispiel: Mach mir 10 neue Auktionen mit Premium-Handys und Laptops..."
                  className="w-full bg-transparent resize-none min-h-[88px] text-[13px] text-white placeholder-white/30 focus:outline-none"
                />
                <div className="flex items-center justify-between gap-3 mt-3">
                  <button type="button" onClick={toggleVoice} data-testid="admin-ai-voice-btn" className={`rounded-full px-3 py-2 text-[11px] font-bold flex items-center gap-2 ${listening ? "bg-red-500/15 text-red-300" : "bg-white/[0.06] text-white/70"}`}>
                    {listening ? <MicOff size={14} /> : <Mic size={14} />}
                    {listening ? "Höre zu..." : "Sprache"}
                  </button>
                  <p className="text-[10px] text-white/35">Browser-Spracheingabe füllt das Textfeld automatisch.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => sendPrompt()}
                disabled={loading || !input.trim()}
                data-testid="admin-ai-send-btn"
                className="rounded-[24px] px-5 py-4 bg-[#00C2FF] text-black text-[13px] font-black disabled:opacity-50 min-w-[140px] flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                Vorschlag holen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}