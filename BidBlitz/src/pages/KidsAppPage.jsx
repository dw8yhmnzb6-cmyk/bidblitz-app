/**
 * BidBlitz Kids App — Kinderfreundliches Interface
 * Bunte Farben, große Buttons, Chat & Anrufen, Quiz, Aufgaben, Wallet
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Home, Wallet, ClipboardList, Gamepad2, MessageCircle,
  Phone, PhoneCall, Send, Star, Trophy, Heart, Shield, Target,
  Loader2, Check, X, AlertTriangle, Smile, Zap, Gift
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const AVATARS = ["🦁", "🐼", "🦊", "🐸", "🦄", "🐶", "🐱", "🐰"];
const COLORS = { bg: "#FFF7ED", pink: "#F472B6", cyan: "#22D3EE", yellow: "#FBBF24", green: "#34D399", purple: "#A78BFA", red: "#F87171" };

const KidsAppPage = ({ onBack, childId: propChildId }) => {
  const [tab, setTab] = useState("home");
  const [child, setChild] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [childId, setChildId] = useState(propChildId || "");
  const [children, setChildren] = useState([]);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [lastTimestamp, setLastTimestamp] = useState("");
  const chatEnd = useRef(null);
  const pollRef = useRef(null);

  // Quiz
  const [quiz, setQuiz] = useState(null);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [quizReward, setQuizReward] = useState(0);
  const [answered, setAnswered] = useState(null);

  // Load children list
  useEffect(() => {
    fetch(`${API}/api/kids/children`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        const kids = d.children || [];
        setChildren(kids);
        if (!childId && kids.length > 0) setChildId(kids[0].child_id);
      }).catch(() => {});
  }, [childId]);

  // Load dashboard
  const loadDash = useCallback(async () => {
    if (!childId) { setLoading(false); return; }
    try {
      const res = await fetch(`${API}/api/kids-app/dashboard/${childId}`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setChild(d.child);
        setTasks(d.tasks || []);
      }
    } catch {}
    setLoading(false);
  }, [childId]);

  useEffect(() => { loadDash(); }, [loadDash]);

  // Load chat (initial full load)
  const loadChat = useCallback(async () => {
    if (!childId) return;
    try {
      const res = await fetch(`${API}/api/kids-app/chat/${childId}`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        const msgs = d.messages || [];
        setMessages(msgs);
        if (msgs.length > 0) setLastTimestamp(msgs[msgs.length - 1].created_at || "");
      }
    } catch {}
  }, [childId]);

  // Poll for new messages only
  const pollChat = useCallback(async () => {
    if (!childId) return;
    try {
      const res = await fetch(`${API}/api/kids-app/chat/${childId}/poll?after=${encodeURIComponent(lastTimestamp)}`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        const newMsgs = d.messages || [];
        if (newMsgs.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.message_id));
            const unique = newMsgs.filter(m => !existingIds.has(m.message_id));
            return unique.length > 0 ? [...prev, ...unique] : prev;
          });
          setLastTimestamp(newMsgs[newMsgs.length - 1].created_at || "");
        }
      }
      // Check typing
      const tRes = await fetch(`${API}/api/kids-app/chat/${childId}/typing`, { credentials: "include" });
      if (tRes.ok) {
        const tData = await tRes.json();
        setTypingIndicator((tData.typing || []).some(t => t.sender === "parent"));
      }
    } catch {}
  }, [childId, lastTimestamp]);

  useEffect(() => {
    if (tab === "chat") {
      loadChat();
      pollRef.current = setInterval(pollChat, 3000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [tab, loadChat, pollChat]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async () => {
    if (!newMsg.trim()) return;
    setSending(true);
    try {
      await fetch(`${API}/api/kids-app/chat/send`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ child_id: childId, text: newMsg, sender: "child" }),
      });
      setNewMsg("");
      loadChat();
    } catch {}
    setSending(false);
  };

  const callParent = async (type) => {
    try {
      const res = await fetch(`${API}/api/kids-app/call`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ child_id: childId, call_type: type }),
      });
      if (res.ok) {
        const d = await res.json();
        alert(`Anruf an ${d.call?.parent_name || "Mama/Papa"} gestartet!`);
      }
    } catch {}
  };

  // Quiz
  const startQuiz = async () => {
    try {
      const res = await fetch(`${API}/api/kids-app/quiz`);
      if (res.ok) {
        const d = await res.json();
        setQuiz(d.questions);
        setQuizIdx(0); setQuizScore(0); setQuizDone(false); setAnswered(null);
      }
    } catch {}
  };

  const answerQuiz = async (answer) => {
    if (answered !== null) return;
    const correct = quiz[quizIdx].answer === answer;
    const newScore = correct ? quizScore + 1 : quizScore;
    setAnswered(answer);
    setQuizScore(newScore);

    setTimeout(async () => {
      if (quizIdx + 1 >= quiz.length) {
        setQuizDone(true);
        try {
          const res = await fetch(`${API}/api/kids-app/quiz/submit`, {
            method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ child_id: childId, score: newScore, total: quiz.length }),
          });
          if (res.ok) { const d = await res.json(); setQuizReward(d.reward); loadDash(); }
        } catch {}
      } else {
        setQuizIdx(quizIdx + 1);
        setAnswered(null);
      }
    }, 1000);
  };

  const avatar = child?.avatar || AVATARS[0];
  const balance = child?.balance || 0;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.bg }}>
      <Loader2 size={40} className="animate-spin" style={{ color: COLORS.pink }} />
    </div>
  );

  if (!childId || !child) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: COLORS.bg }}>
      <p className="text-2xl mb-4">Wähle dein Profil!</p>
      {children.length === 0 && <p className="text-gray-500">Noch keine Kids-Profile. Erstelle eines in den Einstellungen!</p>}
      <div className="flex gap-4 flex-wrap justify-center">
        {children.map(c => (
          <motion.button key={c.child_id} whileTap={{ scale: 0.9 }} onClick={() => setChildId(c.child_id)}
            className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-white shadow-lg border-2 border-transparent hover:border-pink-300">
            <span className="text-5xl">{c.avatar || "🦁"}</span>
            <span className="text-sm font-bold">{c.name}</span>
          </motion.button>
        ))}
      </div>
      <motion.button whileTap={{ scale: 0.95 }} onClick={onBack} className="mt-6 px-6 py-2 rounded-full bg-gray-200 text-gray-600 text-sm font-medium">Zurück</motion.button>
    </div>
  );

  const TABS = [
    { id: "home", label: "Home", icon: Home, color: COLORS.yellow },
    { id: "wallet", label: "Geld", icon: Wallet, color: COLORS.green },
    { id: "tasks", label: "Aufgaben", icon: ClipboardList, color: COLORS.cyan },
    { id: "chat", label: "Chat", icon: MessageCircle, color: COLORS.pink },
    { id: "games", label: "Spiele", icon: Gamepad2, color: COLORS.purple },
  ];

  return (
    <div className="min-h-screen pb-20" style={{ background: COLORS.bg }} data-testid="kids-app-page">

      {/* ═══ HOME ═══ */}
      {tab === "home" && (
        <div className="p-5">
          <div className="flex items-center justify-between mb-6">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="w-10 h-10 rounded-full bg-white shadow flex items-center justify-center"><ArrowLeft size={18} className="text-gray-600" /></motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => callParent("voice")}
              className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center" style={{ background: COLORS.green }}
              data-testid="kids-call-parent">
              <Phone size={22} className="text-white" />
            </motion.button>
          </div>

          {/* Welcome */}
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="text-center mb-6">
            <div className="text-7xl mb-2">{avatar}</div>
            <h1 className="text-2xl font-black" style={{ color: "#1a1a2e" }}>Hallo {child.name}!</h1>
            <p className="text-sm text-gray-500 mt-1">Was möchtest du heute machen?</p>
          </motion.div>

          {/* Wallet Preview */}
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
            onClick={() => setTab("wallet")}
            className="bg-white rounded-3xl shadow-lg p-5 mb-4 cursor-pointer border-2 border-transparent hover:border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${COLORS.green}20` }}>
                  <Wallet size={24} style={{ color: COLORS.green }} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Mein Geld</p>
                  <p className="text-2xl font-black" style={{ color: COLORS.green }}>€{balance.toFixed(2)}</p>
                </div>
              </div>
              <span className="text-3xl">💰</span>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Mama/Papa\nanrufen", icon: "📞", color: COLORS.green, action: () => callParent("voice") },
              { label: "Nachricht\nsenden", icon: "💬", color: COLORS.pink, action: () => setTab("chat") },
              { label: "Aufgaben\nerledigen", icon: "📋", color: COLORS.cyan, action: () => setTab("tasks") },
              { label: "Quiz\nspielen", icon: "🧠", color: COLORS.purple, action: () => { setTab("games"); startQuiz(); } },
            ].map((a, i) => (
              <motion.button key={a.label} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15 + i * 0.05 }}
                whileTap={{ scale: 0.9 }} onClick={a.action}
                className="bg-white rounded-3xl shadow-md p-4 text-center border-2 border-transparent hover:shadow-lg transition-shadow"
                style={{ borderColor: `${a.color}30` }}>
                <span className="text-4xl block mb-2">{a.icon}</span>
                <span className="text-[11px] font-bold whitespace-pre-line" style={{ color: a.color }}>{a.label}</span>
              </motion.button>
            ))}
          </div>

          {/* SOS Button */}
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => callParent("voice")}
            className="w-full mt-5 py-4 rounded-3xl shadow-lg flex items-center justify-center gap-3" style={{ background: COLORS.red }}
            data-testid="kids-sos">
            <AlertTriangle size={24} className="text-white" />
            <span className="text-lg font-black text-white">SOS - Hilfe rufen!</span>
          </motion.button>
        </div>
      )}

      {/* ═══ WALLET ═══ */}
      {tab === "wallet" && (
        <div className="p-5">
          <div className="flex items-center gap-3 mb-6">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setTab("home")} className="w-10 h-10 rounded-full bg-white shadow flex items-center justify-center"><ArrowLeft size={18} /></motion.button>
            <h2 className="text-xl font-black" style={{ color: "#1a1a2e" }}>Mein Geld 💰</h2>
          </div>

          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
            className="rounded-3xl p-6 text-center mb-5 shadow-lg" style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.cyan})` }}>
            <p className="text-white/80 text-sm mb-1">Mein Guthaben</p>
            <p className="text-5xl font-black text-white">€{balance.toFixed(2)}</p>
            <p className="text-white/60 text-xs mt-2">Wöchentliches Limit: €{child.weekly_limit || 10}</p>
          </motion.div>

          {/* Savings Goal */}
          <div className="bg-white rounded-3xl shadow-md p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target size={18} style={{ color: COLORS.purple }} />
              <span className="text-sm font-bold">Sparziel</span>
            </div>
            <div className="w-full h-4 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (balance / 50) * 100)}%`, background: `linear-gradient(90deg, ${COLORS.purple}, ${COLORS.pink})` }} />
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">€{balance.toFixed(2)} von €50.00 gespart</p>
          </div>
        </div>
      )}

      {/* ═══ TASKS ═══ */}
      {tab === "tasks" && (
        <div className="p-5">
          <div className="flex items-center gap-3 mb-6">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setTab("home")} className="w-10 h-10 rounded-full bg-white shadow flex items-center justify-center"><ArrowLeft size={18} /></motion.button>
            <h2 className="text-xl font-black" style={{ color: "#1a1a2e" }}>Meine Aufgaben 📋</h2>
          </div>

          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-6xl block mb-3">🎉</span>
              <p className="text-lg font-bold text-gray-800">Alle Aufgaben erledigt!</p>
              <p className="text-sm text-gray-500">Super gemacht!</p>
            </div>
          ) : tasks.map((t, i) => (
            <motion.div key={t.task_id || i} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}
              className={`bg-white rounded-3xl shadow-md p-4 mb-3 flex items-center gap-3 border-2 ${t.status === "completed" ? "border-green-200" : "border-transparent"}`}>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl ${t.status === "completed" ? "bg-green-100" : "bg-yellow-100"}`}>
                {t.status === "completed" ? "✅" : "⭐"}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold ${t.status === "completed" ? "line-through text-gray-400" : "text-gray-800"}`}>{t.title || t.task}</p>
                {t.reward && <p className="text-xs font-bold" style={{ color: COLORS.green }}>+€{t.reward} Belohnung</p>}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ═══ CHAT ═══ */}
      {tab === "chat" && (
        <div className="flex flex-col h-screen" style={{ background: COLORS.bg }}>
          <div className="flex items-center gap-3 p-4 bg-white shadow-sm">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setTab("home")} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"><ArrowLeft size={18} /></motion.button>
            <div className="flex items-center gap-2">
              <span className="text-2xl">👨‍👩‍👧</span>
              <div>
                <p className="text-sm font-bold">Mama & Papa</p>
                <p className="text-[10px] text-green-500">Online</p>
              </div>
            </div>
            <div className="ml-auto flex gap-2">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => callParent("voice")}
                className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${COLORS.green}20` }}
                data-testid="kids-chat-call">
                <Phone size={18} style={{ color: COLORS.green }} />
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => callParent("video")}
                className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${COLORS.cyan}20` }}>
                <PhoneCall size={18} style={{ color: COLORS.cyan }} />
              </motion.button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <span className="text-5xl block mb-3">💬</span>
                <p className="text-sm text-gray-500">Schreib deinen Eltern eine Nachricht!</p>
              </div>
            )}
            {messages.map((m, i) => (
              <motion.div key={m.message_id || i} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className={`flex ${m.sender === "child" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-3xl px-4 py-3 shadow-sm ${
                  m.sender === "child"
                    ? "bg-gradient-to-r from-pink-400 to-purple-400 text-white rounded-br-lg"
                    : "bg-white text-gray-800 rounded-bl-lg"
                }`}>
                  <p className="text-[13px]">{m.text}</p>
                  <p className={`text-[9px] mt-1 ${m.sender === "child" ? "text-white/60" : "text-gray-400"}`}>
                    {m.created_at ? new Date(m.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : ""}
                  </p>
                </div>
              </motion.div>
            ))}
            <div ref={chatEnd} />
            {typingIndicator && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 px-4 py-2">
                <div className="flex gap-1">
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2 h-2 rounded-full" style={{ background: COLORS.pink }} />
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }} className="w-2 h-2 rounded-full" style={{ background: COLORS.pink }} />
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} className="w-2 h-2 rounded-full" style={{ background: COLORS.pink }} />
                </div>
                <span className="text-xs text-gray-400">Mama/Papa tippt...</span>
              </motion.div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
            <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Nachricht tippen..."
              className="flex-1 px-4 py-3 rounded-full bg-gray-100 text-sm outline-none" data-testid="kids-chat-input"
              onKeyDown={e => e.key === "Enter" && sendMessage()} />
            <motion.button whileTap={{ scale: 0.9 }} onClick={sendMessage} disabled={!newMsg.trim() || sending}
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-md disabled:opacity-30"
              style={{ background: `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.purple})` }} data-testid="kids-chat-send">
              <Send size={18} className="text-white" />
            </motion.button>
          </div>
        </div>
      )}

      {/* ═══ GAMES / QUIZ ═══ */}
      {tab === "games" && (
        <div className="p-5">
          <div className="flex items-center gap-3 mb-6">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setTab("home"); setQuiz(null); }} className="w-10 h-10 rounded-full bg-white shadow flex items-center justify-center"><ArrowLeft size={18} /></motion.button>
            <h2 className="text-xl font-black" style={{ color: "#1a1a2e" }}>Lernspiele 🧠</h2>
          </div>

          {!quiz ? (
            <div className="space-y-4">
              {[
                { label: "Mathe-Quiz", desc: "Rechne richtig und verdiene Geld!", icon: "🧮", color: COLORS.cyan },
                { label: "Geld-Quiz", desc: "Lerne wie Geld funktioniert!", icon: "💰", color: COLORS.green },
                { label: "Wissens-Quiz", desc: "Teste dein Allgemeinwissen!", icon: "🌍", color: COLORS.purple },
              ].map((g, i) => (
                <motion.button key={g.label} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.1 }}
                  whileTap={{ scale: 0.95 }} onClick={startQuiz}
                  className="w-full bg-white rounded-3xl shadow-md p-5 flex items-center gap-4 text-left border-2 border-transparent hover:shadow-lg"
                  style={{ borderColor: `${g.color}30` }}>
                  <span className="text-5xl">{g.icon}</span>
                  <div>
                    <p className="text-base font-bold" style={{ color: g.color }}>{g.label}</p>
                    <p className="text-xs text-gray-500">{g.desc}</p>
                    <p className="text-[10px] font-bold mt-1" style={{ color: COLORS.green }}>€0.50 pro richtige Antwort!</p>
                  </div>
                </motion.button>
              ))}
            </div>
          ) : quizDone ? (
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center py-8">
              <span className="text-7xl block mb-4">{quizScore >= 4 ? "🏆" : quizScore >= 2 ? "⭐" : "💪"}</span>
              <h3 className="text-2xl font-black mb-2" style={{ color: "#1a1a2e" }}>
                {quizScore >= 4 ? "Super gemacht!" : quizScore >= 2 ? "Gut gemacht!" : "Weiter üben!"}
              </h3>
              <p className="text-lg font-bold" style={{ color: COLORS.purple }}>{quizScore}/{quiz.length} richtig</p>
              {quizReward > 0 && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }}
                  className="mt-4 inline-block px-6 py-3 rounded-full" style={{ background: `${COLORS.green}20` }}>
                  <p className="text-lg font-black" style={{ color: COLORS.green }}>+€{quizReward.toFixed(2)} verdient!</p>
                </motion.div>
              )}
              <motion.button whileTap={{ scale: 0.95 }} onClick={startQuiz}
                className="mt-6 px-8 py-3 rounded-full text-white font-bold text-sm shadow-lg"
                style={{ background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.pink})` }}>
                Nochmal spielen!
              </motion.button>
            </motion.div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-gray-500">Frage {quizIdx + 1}/{quiz.length}</span>
                <span className="text-sm font-bold" style={{ color: COLORS.green }}>{quizScore} richtig</span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-200 mb-6">
                <div className="h-full rounded-full transition-all" style={{ width: `${((quizIdx + 1) / quiz.length) * 100}%`, background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.purple})` }} />
              </div>
              <div className="bg-white rounded-3xl shadow-lg p-6 mb-4">
                <p className="text-lg font-black text-center" style={{ color: "#1a1a2e" }}>{quiz[quizIdx].q}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {quiz[quizIdx].options.map((opt, oi) => {
                  const isCorrect = opt === quiz[quizIdx].answer;
                  const isSelected = answered === opt;
                  let bg = "bg-white";
                  if (answered !== null) {
                    if (isCorrect) bg = "bg-green-100 border-green-400";
                    else if (isSelected) bg = "bg-red-100 border-red-400";
                  }
                  return (
                    <motion.button key={oi} whileTap={{ scale: 0.95 }} onClick={() => answerQuiz(opt)}
                      className={`${bg} rounded-2xl shadow-md p-4 text-center font-bold text-base border-2 ${answered === null ? "border-transparent hover:shadow-lg" : ""}`}
                      style={answered === null ? { color: "#1a1a2e" } : {}}>
                      {opt}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ BOTTOM TAB BAR ═══ */}
      {tab !== "chat" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-2 flex justify-around z-30 shadow-lg">
          {TABS.map(t => (
            <motion.button key={t.id} whileTap={{ scale: 0.85 }} onClick={() => setTab(t.id)}
              className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition-colors"
              style={tab === t.id ? { background: `${t.color}15` } : {}}
              data-testid={`kids-tab-${t.id}`}>
              <t.icon size={20} style={{ color: tab === t.id ? t.color : "#999" }} />
              <span className="text-[9px] font-bold" style={{ color: tab === t.id ? t.color : "#999" }}>{t.label}</span>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};

export default KidsAppPage;
