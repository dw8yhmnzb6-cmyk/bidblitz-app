/**
 * Staff Mobile — Knowledge Base Tab (Employee Read-Only)
 * =======================================================
 * Tutorials, Standards, Rezepte durchsuchen + lesen (Markdown).
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Search, Loader2, ChevronRight, Pin, X, Eye, Calendar, Tag, Sparkles, HelpCircle, CheckCircle2, XCircle, Award } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "./StaffShifts";

const API = process.env.REACT_APP_BACKEND_URL;

export default function StaffKnowledge() {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (cat) params.set("category", cat);
      const [r1, r2] = await Promise.all([
        fetch(`${API}/api/staff/knowledge/me/articles?${params}`, { credentials: "include" }),
        fetch(`${API}/api/staff/knowledge/me/categories`, { credentials: "include" }),
      ]);
      if (r1.ok) setArticles((await r1.json()).articles || []);
      if (r2.ok) setCategories((await r2.json()).categories || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [query, cat]);

  return (
    <div data-testid="staff-knowledge-tab" className="px-5 pt-6 pb-2 space-y-3">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 font-semibold">Knowledge</p>
        <h2 className="text-2xl font-bold mt-1 font-outfit flex items-center gap-2">
          <BookOpen size={22} className="text-[#00D4FF]" />
          Wissens-Datenbank
        </h2>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suche Tutorials, Rezepte, Standards…"
          data-testid="staff-kb-search"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm outline-none focus:border-[#00D4FF]/40"
        />
      </div>

      {/* Category Chips */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          <Chip active={!cat} onClick={() => setCat("")} testId="staff-kb-chip-all">Alle</Chip>
          {categories.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)} testId={`staff-kb-chip-${c}`}>{c}</Chip>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 size={22} className="animate-spin text-[#00D4FF]" /></div>
      ) : articles.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Keine Artikel"
          sub="Sobald dein Manager Wissens-Artikel veröffentlicht, erscheinen sie hier."
        />
      ) : (
        articles.map((a) => (
          <button
            key={a.id}
            onClick={() => setOpen(a)}
            data-testid={`staff-kb-card-${a.id}`}
            className="w-full p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] text-left active:scale-[0.99] transition-all"
          >
            <div className="flex items-start gap-3">
              {a.cover_url ? (
                <img src={`${API}${a.cover_url}`} alt="" className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-white/10" />
              ) : (
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                     style={{ background: "rgba(0,212,255,0.12)", color: "#00D4FF" }}>
                  <BookOpen size={18} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00D4FF]/10 text-[#00D4FF] font-semibold uppercase tracking-wide">{a.category || "Allgemein"}</span>
                  {a.pinned && <Pin size={10} className="text-amber-400 fill-amber-400" />}
                  {a.ai_summary && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#A855F7]/15 text-[#A855F7] font-semibold flex items-center gap-0.5"><Sparkles size={8} /> AI</span>}
                  {a.quiz_count > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#10D981]/15 text-[#10D981] font-semibold flex items-center gap-0.5"><HelpCircle size={8} /> Quiz</span>}
                </div>
                <p className="text-sm font-bold mt-1">{a.title}</p>
                {a.ai_summary && <p className="text-[11px] text-white/55 mt-0.5 line-clamp-2">{a.ai_summary}</p>}
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/45">
                  <span className="flex items-center gap-1"><Eye size={10} /> {a.view_count || 0}</span>
                  <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(a.updated_at || a.created_at).toLocaleDateString("de-DE")}</span>
                  {a.tags?.length > 0 && (
                    <span className="flex items-center gap-1 truncate"><Tag size={10} /> {a.tags.slice(0, 2).join(", ")}</span>
                  )}
                </div>
              </div>
              <ChevronRight size={14} className="text-white/30 mt-1 shrink-0" />
            </div>
          </button>
        ))
      )}

      <AnimatePresence>
        {open && <ArticleReader article={open} onClose={() => { setOpen(null); load(); }} />}
      </AnimatePresence>
    </div>
  );
}

function Chip({ active, onClick, children, testId }) {
  return (
    <button
      onClick={onClick} data-testid={testId}
      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
        active ? "bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40"
               : "bg-white/[0.03] text-white/55 border border-white/[0.06] hover:bg-white/[0.06]"
      }`}
    >
      {children}
    </button>
  );
}

function ArticleReader({ article, onClose }) {
  const [full, setFull] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/api/staff/knowledge/me/articles/${article.id}`, { credentials: "include" });
        if (r.ok) setFull((await r.json()).article);
        else toast.error("Artikel nicht ladbar");
      } catch (e) { toast.error("Netzwerkfehler"); }
      setLoading(false);
    })();
  }, [article.id]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end justify-center"
      onClick={onClose}
      data-testid="staff-kb-reader"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[92vh] bg-[#0A0A0A] border-t border-white/10 rounded-t-3xl overflow-y-auto"
      >
        <div className="sticky top-0 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen size={16} className="text-[#00D4FF] shrink-0" />
            <p className="text-sm font-semibold truncate">{full?.title || article.title}</p>
          </div>
          <button onClick={onClose} data-testid="staff-kb-reader-close" className="p-1.5 rounded-lg hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 size={22} className="animate-spin text-[#00D4FF]" /></div>
        ) : full ? (
          <div className="px-5 py-4 space-y-3">
            {full.cover_url && (
              <img src={`${API}${full.cover_url}`} alt="" className="w-full h-44 object-cover rounded-2xl border border-white/[0.06]" data-testid="staff-kb-reader-cover" />
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#00D4FF]/12 text-[#00D4FF] font-semibold uppercase">{full.category || "Allgemein"}</span>
              {full.pinned && <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-400 font-semibold flex items-center gap-0.5"><Pin size={9} /> Pin</span>}
              <span className="text-[10px] text-white/40 ml-auto flex items-center gap-1"><Eye size={10} /> {full.view_count || 0}</span>
            </div>
            <h1 className="text-xl font-bold font-outfit">{full.title}</h1>
            {full.ai_summary && (
              <div className="rounded-2xl p-3 bg-gradient-to-br from-[#00D4FF]/10 to-[#A855F7]/10 border border-[#00D4FF]/20" data-testid="staff-kb-reader-ai-summary">
                <p className="text-[10px] uppercase tracking-widest text-[#00D4FF] font-semibold flex items-center gap-1 mb-1"><Sparkles size={10} /> Kurzfassung (AI)</p>
                <p className="text-[12.5px] leading-relaxed text-white/85">{full.ai_summary}</p>
              </div>
            )}
            <MarkdownLite text={full.content || ""} />
            {full.quiz?.length > 0 && (
              <QuizSection articleId={full.id} quiz={full.quiz} lastAttempt={full.last_quiz_attempt} />
            )}
            {full.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-3 border-t border-white/[0.06]">
                {full.tags.map((t) => (
                  <span key={t} className="text-[10px] px-2 py-1 rounded-md bg-[#A855F7]/12 text-[#A855F7] font-medium">#{t}</span>
                ))}
              </div>
            )}
            <p className="text-[10px] text-white/30 pt-2">
              Zuletzt aktualisiert: {new Date(full.updated_at || full.created_at).toLocaleString("de-DE")}
            </p>
          </div>
        ) : (
          <div className="py-16 text-center text-white/50 text-sm">Artikel nicht gefunden.</div>
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * Minimal Markdown renderer (no extra dependency).
 * Supports: H1/H2/H3, bold (**), italic (*), lists (- / *), inline code (`), code blocks (```),
 *           blockquotes (>), links [text](url), line-breaks, paragraphs.
 */
function MarkdownLite({ text }) {
  const blocks = parseBlocks(text);
  return (
    <div className="prose prose-invert prose-sm max-w-none text-sm text-white/85 leading-relaxed">
      {blocks.map((b, i) => renderBlock(b, i))}
    </div>
  );
}

function parseBlocks(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let buf = [];
  let inCode = false;
  let codeLang = "";
  let codeBuf = [];

  const flushPara = () => {
    if (buf.length) {
      blocks.push({ type: "p", content: buf.join("\n") });
      buf = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        blocks.push({ type: "code", lang: codeLang, content: codeBuf.join("\n") });
        codeBuf = []; codeLang = ""; inCode = false;
      } else {
        flushPara();
        codeLang = line.slice(3).trim();
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    if (/^#{1,3}\s+/.test(line)) {
      flushPara();
      const m = line.match(/^(#{1,3})\s+(.+)$/);
      blocks.push({ type: `h${m[1].length}`, content: m[2] });
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushPara();
      blocks.push({ type: "quote", content: line.replace(/^>\s?/, "") });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      // start/continue list
      const prev = blocks[blocks.length - 1];
      const item = line.replace(/^[-*]\s+/, "");
      if (prev && prev.type === "ul") prev.items.push(item);
      else { flushPara(); blocks.push({ type: "ul", items: [item] }); }
      continue;
    }
    if (/^\s*$/.test(line)) { flushPara(); continue; }
    buf.push(line);
  }
  flushPara();
  return blocks;
}

function renderBlock(b, i) {
  switch (b.type) {
    case "h1": return <h1 key={i} className="text-xl font-bold font-outfit mt-2 mb-1">{inline(b.content)}</h1>;
    case "h2": return <h2 key={i} className="text-base font-bold font-outfit mt-3 mb-1">{inline(b.content)}</h2>;
    case "h3": return <h3 key={i} className="text-sm font-bold mt-2 mb-1 text-white/90">{inline(b.content)}</h3>;
    case "ul":
      return <ul key={i} className="list-disc pl-5 space-y-1 my-1">{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>;
    case "quote":
      return <blockquote key={i} className="border-l-2 border-[#00D4FF] pl-3 py-1 text-white/70 italic text-sm">{inline(b.content)}</blockquote>;
    case "code":
      return (
        <pre key={i} className="bg-black/50 border border-white/[0.06] rounded-xl p-3 text-[11px] overflow-x-auto font-mono">
          <code>{b.content}</code>
        </pre>
      );
    default:
      return <p key={i} className="whitespace-pre-line">{inline(b.content)}</p>;
  }
}

function inline(text) {
  // escape order: code, links, bold, italic
  const parts = [];
  let rest = text;
  // very simple tokenizer
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\(([^)]+)\))/;
  let m, key = 0;
  while ((m = rest.match(re))) {
    if (m.index > 0) parts.push(rest.slice(0, m.index));
    const token = m[0];
    if (token.startsWith("`")) {
      parts.push(<code key={++key} className="px-1 py-0.5 rounded bg-white/[0.08] text-[#00D4FF] text-[12px] font-mono">{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      parts.push(<strong key={++key} className="font-semibold text-white">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={++key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("[")) {
      parts.push(
        <a key={++key} href={m[3]} target="_blank" rel="noopener noreferrer" className="text-[#00D4FF] underline">
          {m[2]}
        </a>
      );
    }
    rest = rest.slice(m.index + token.length);
  }
  if (rest) parts.push(rest);
  return parts;
}


function QuizSection({ articleId, quiz, lastAttempt }) {
  const [answers, setAnswers] = useState(() => Array(quiz.length).fill(-1));
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (answers.some((a) => a === -1)) {
      toast.error("Bitte alle Fragen beantworten");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/api/staff/knowledge/me/articles/${articleId}/quiz-attempt`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        setResult(d);
        if (d.passed) toast.success(`Bestanden! ${d.score}/${d.total}`);
        else toast(`${d.score}/${d.total} richtig — versuche es nochmal!`);
      } else toast.error(d.detail || "Fehler");
    } catch (e) { toast.error("Netzwerkfehler"); }
    setSubmitting(false);
  };

  const reset = () => { setAnswers(Array(quiz.length).fill(-1)); setResult(null); };

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-3" data-testid="staff-kb-quiz">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-widest text-white/55 font-semibold flex items-center gap-1.5">
          <HelpCircle size={12} className="text-[#10D981]" /> Quiz · {quiz.length} Frage{quiz.length === 1 ? "" : "n"}
        </p>
        {lastAttempt && (
          <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${lastAttempt.passed ? "bg-[#10D981]/15 text-[#10D981]" : "bg-amber-400/15 text-amber-400"}`}>
            Letzter Versuch: {lastAttempt.score}/{lastAttempt.total}
          </span>
        )}
      </div>

      {quiz.map((q, i) => {
        const r = result?.results?.[i];
        return (
          <div key={i} className="rounded-xl bg-black/30 border border-white/[0.05] p-3" data-testid={`staff-kb-quiz-q-${i}`}>
            <p className="text-[13px] font-semibold mb-2">{i + 1}. {q.question}</p>
            <div className="space-y-1.5">
              {q.options.map((opt, oIdx) => {
                const selected = answers[i] === oIdx;
                let cls = "border-white/[0.08] bg-white/[0.02] text-white/80";
                if (result) {
                  if (oIdx === r.correct) cls = "border-[#10D981]/50 bg-[#10D981]/12 text-white";
                  else if (oIdx === r.given && !r.ok) cls = "border-red-500/50 bg-red-500/12 text-white";
                } else if (selected) {
                  cls = "border-[#00D4FF]/50 bg-[#00D4FF]/12 text-white";
                }
                return (
                  <button
                    key={oIdx}
                    onClick={() => !result && setAnswers((a) => a.map((v, j) => j === i ? oIdx : v))}
                    disabled={!!result}
                    data-testid={`staff-kb-quiz-opt-${i}-${oIdx}`}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-[12px] flex items-center gap-2 ${cls}`}
                  >
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-bold ${selected || (result && (oIdx === r.correct || oIdx === r.given)) ? "border-current" : "border-white/30"}`}>
                      {String.fromCharCode(65 + oIdx)}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {result && oIdx === r.correct && <CheckCircle2 size={12} className="text-[#10D981]" />}
                    {result && oIdx === r.given && !r.ok && <XCircle size={12} className="text-red-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {result ? (
        <div className="rounded-xl bg-gradient-to-br from-[#10D981]/10 to-[#00D4FF]/10 border border-[#10D981]/25 p-3 flex items-center gap-3">
          <Award size={22} className={result.passed ? "text-[#10D981]" : "text-amber-400"} />
          <div className="flex-1">
            <p className="text-sm font-bold">{result.passed ? "Quiz bestanden! 🎉" : "Knapp daneben"}</p>
            <p className="text-[11px] text-white/60">{result.score}/{result.total} richtige Antworten</p>
          </div>
          <button onClick={reset} data-testid="staff-kb-quiz-retry" className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] font-semibold">
            Nochmal
          </button>
        </div>
      ) : (
        <button
          onClick={submit} disabled={submitting}
          data-testid="staff-kb-quiz-submit"
          className="w-full py-3 rounded-2xl text-white font-semibold text-sm disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #00D4FF 0%, #A855F7 100%)" }}
        >
          {submitting ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Antworten prüfen"}
        </button>
      )}
    </div>
  );
}
