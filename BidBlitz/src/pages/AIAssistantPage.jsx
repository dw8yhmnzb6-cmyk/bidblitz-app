/**
 * BidBlitz V2 - AI Financial Assistant Page
 * GPT-4o-mini powered chatbot with wallet context
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Loader2, Bot, User, Trash2, Sparkles, Wallet, Coins } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const AIAssistantPage = ({ onBack }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [balance, setBalance] = useState(0);
  const [coins, setCoins] = useState(0);
  const chatEndRef = useRef(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API}/api/ai-assistant/history`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        if (d.messages?.length) setMessages(d.messages);
      }
    } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/ai-assistant/chat`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, session_id: sessionId }),
      });
      if (res.ok) {
        const d = await res.json();
        setMessages(prev => [...prev, { role: "assistant", content: d.response }]);
        if (d.session_id) setSessionId(d.session_id);
        if (d.balance) setBalance(d.balance);
        if (d.coins) setCoins(d.coins);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Entschuldigung, ein Fehler ist aufgetreten. Bitte versuche es erneut." }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Verbindungsfehler. Bitte prüfe deine Internetverbindung." }]);
    }
    setLoading(false);
  };

  const clearHistory = async () => {
    try {
      await fetch(`${API}/api/ai-assistant/history`, { method: "DELETE", credentials: "include" });
      setMessages([]);
      setSessionId("");
    } catch {}
  };

  const quickQuestions = [
    "Wie viel habe ich diese Woche ausgegeben?",
    "Gib mir Spartipps",
    "Wie ist mein Kontostand?",
    "Analysiere meine Ausgaben",
  ];

  return (
    <div className="h-screen flex flex-col bg-[#0A0A0F]" data-testid="ai-assistant-page">
      {/* Header */}
      <div className="bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
              className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="ai-back">
              <ArrowLeft size={18} className="text-white/60" />
            </motion.button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00C2FF] to-[#A855F7] flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-[15px] font-bold text-white">BlitzBot</h1>
                <p className="text-[10px] text-gray-500">KI-Finanzassistent</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {balance > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#00C2FF]/10 text-[10px] text-[#00C2FF] font-semibold">
                <Wallet size={10} /> €{balance.toFixed(2)}
              </div>
            )}
            <motion.button whileTap={{ scale: 0.9 }} onClick={clearHistory}
              className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="clear-chat">
              <Trash2 size={14} className="text-white/40" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00C2FF]/20 to-[#A855F7]/20 flex items-center justify-center mx-auto mb-3">
              <Bot size={22} className="text-[#00C2FF]" />
            </div>
            <h2 className="text-[15px] font-bold text-white mb-0.5">Hallo! Ich bin BlitzBot</h2>
            <p className="text-[11px] text-gray-500 mb-4 px-4">Dein KI-Finanzassistent. Frag mich zu Ausgaben, Spartipps oder Kontostand.</p>
            <div className="space-y-1.5">
              {quickQuestions.map((q, i) => (
                <motion.button key={i} whileTap={{ scale: 0.97 }}
                  onClick={() => { setInput(q); }}
                  className="block w-full text-left px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[12px] text-white/70 hover:bg-white/[0.06] transition-colors"
                  data-testid={`quick-q-${i}`}>
                  {q}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#00C2FF] text-black rounded-br-md"
                  : "bg-[#111118] text-white/90 border border-white/5 rounded-bl-md"
              }`}>
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-[#111118] border border-white/5">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#00C2FF] animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#00C2FF] animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#00C2FF] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-[#0A0A0F] border-t border-white/5">
        <div className="flex gap-2">
          <input type="text" value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Frag BlitzBot..."
            className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none placeholder:text-gray-600"
            data-testid="ai-input" />
          <motion.button whileTap={{ scale: 0.9 }} onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="w-12 h-12 rounded-xl bg-[#00C2FF] flex items-center justify-center disabled:opacity-30"
            data-testid="ai-send">
            {loading ? <Loader2 size={18} className="animate-spin text-black" /> : <Send size={18} className="text-black" />}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPage;
