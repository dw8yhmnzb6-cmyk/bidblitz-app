/**
 * Staff Mobile — Training Tab (IMG_1105 Connecteam-Style)
 * ========================================================
 * Kurse mit Text/Video/Quiz Lessons + Progress.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, CheckCircle2, Loader2, Play, X, Award, BookOpen, Star } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "./StaffShifts";

const API = process.env.REACT_APP_BACKEND_URL;

export default function StaffTraining() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openCourse, setOpenCourse] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/staff/training/me/courses`, { credentials: "include" });
      if (r.ok) setCourses((await r.json()).courses || []);
    } catch (e) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div data-testid="staff-training-tab" className="px-5 pt-6 pb-2 space-y-3">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 font-semibold">Training & Onboarding</p>
        <h2 className="text-2xl font-bold mt-1 font-outfit">Lerne & wachse</h2>
      </div>
      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 size={22} className="animate-spin text-[#7E5BF6]" /></div>
      ) : courses.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Keine Kurse zugewiesen" sub="Sobald dein Manager Kurse hinzufügt, erscheinen sie hier." />
      ) : (
        courses.map((c) => (
          <CourseTile key={c.id} course={c} onOpen={() => setOpenCourse(c)} />
        ))
      )}
      <AnimatePresence>
        {openCourse && (
          <CourseRunner course={openCourse} onClose={() => setOpenCourse(null)} onProgress={load} />
        )}
      </AnimatePresence>
    </div>
  );
}

function CourseTile({ course, onOpen }) {
  const completed = course.progress?.status === "completed";
  const inProgress = course.progress?.status === "in_progress";
  return (
    <button onClick={onOpen} data-testid={`staff-course-tile-${course.id}`}
      className={`w-full p-4 rounded-2xl border text-left ${
        completed ? "bg-[#10D981]/10 border-[#10D981]/30" :
        inProgress ? "bg-[#7E5BF6]/10 border-[#7E5BF6]/30" :
        "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]"
      }`}>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{
            background: completed ? "rgba(16,217,129,0.18)" : inProgress ? "rgba(126,91,246,0.18)" : "rgba(255,255,255,0.04)",
            color: completed ? "#10D981" : inProgress ? "#7E5BF6" : "rgba(255,255,255,0.5)"
          }}>
          {completed ? <Award size={18} /> : <BookOpen size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold truncate">{course.title}</p>
            {course.mandatory && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[#F31260]/20 text-[#F31260]">Pflicht</span>}
          </div>
          <p className="text-[11px] text-white/55 line-clamp-1">{course.description || `${course.lessons.length} Lektionen`}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${course.completion_pct}%`,
                background: completed ? "#10D981" : "linear-gradient(90deg, #00D4FF, #7E5BF6)",
              }} />
            </div>
            <span className="text-[10px] text-white/50 tabular-nums w-10 text-right">{course.completion_pct}%</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function CourseRunner({ course, onClose, onProgress }) {
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizResult, setQuizResult] = useState(null);
  const lesson = course.lessons[idx];

  const completeLesson = async () => {
    setBusy(true);
    try {
      const body = { lesson_index: idx };
      if (lesson.type === "quiz") body.quiz_answers = quizAnswers;
      const r = await fetch(`${API}/api/staff/training/me/courses/${course.id}/progress`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (lesson.type === "quiz" && !j.passed) {
        setQuizResult({ failed: true, score: j.score, required: j.required });
        return;
      }
      onProgress();
      if (idx < course.lessons.length - 1) {
        setIdx(idx + 1);
        setQuizAnswers([]); setQuizResult(null);
        toast.success("Lektion abgeschlossen");
      } else {
        toast.success("Kurs abgeschlossen 🎓");
        onClose();
      }
    } catch (e) { toast.error("Fortschritt nicht gespeichert"); }
    setBusy(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center"
      onClick={onClose} data-testid="staff-course-runner"
    >
      <motion.div
        initial={{ y: 240 }} animate={{ y: 0 }} exit={{ y: 240 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90vh] bg-[#0A0B10] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
      >
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-white/40">Lektion {idx + 1} von {course.lessons.length}</p>
            <p className="text-base font-bold truncate">{lesson.title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {lesson.type === "text" && (
            <div className="prose prose-invert max-w-none text-sm text-white/80 whitespace-pre-wrap" data-testid="staff-lesson-text">
              {lesson.content}
            </div>
          )}
          {lesson.type === "video" && lesson.video_url && (
            <div className="aspect-video rounded-2xl overflow-hidden bg-black flex items-center justify-center" data-testid="staff-lesson-video">
              <video controls src={lesson.video_url} className="w-full h-full" />
            </div>
          )}
          {lesson.type === "quiz" && (
            <div data-testid="staff-lesson-quiz" className="space-y-4">
              {(lesson.questions || []).map((q, qi) => (
                <div key={qi}>
                  <p className="text-sm font-bold mb-2">{qi + 1}. {q.q}</p>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oi) => {
                      const selected = quizAnswers[qi] === oi;
                      return (
                        <button
                          key={oi}
                          onClick={() => setQuizAnswers((arr) => { const n = [...arr]; n[qi] = oi; return n; })}
                          data-testid={`quiz-q${qi}-o${oi}`}
                          className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${
                            selected ? "bg-[#7E5BF6]/15 border-[#7E5BF6]/50 text-white" : "bg-white/[0.03] border-white/[0.08] text-white/70 hover:bg-white/[0.05]"
                          }`}
                        >{opt}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {quizResult?.failed && (
                <div className="p-3 rounded-xl bg-[#F31260]/10 border border-[#F31260]/30 text-[#F31260] text-xs">
                  Quiz nicht bestanden — {quizResult.score}% erreicht (min. {quizResult.required}%). Versuche es nochmal.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-white/[0.06] flex gap-2">
          <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0 || busy}
            className="h-11 px-4 rounded-2xl bg-white/[0.05] border border-white/10 text-sm disabled:opacity-40">Zurück</button>
          <button
            onClick={completeLesson} disabled={busy || (lesson.type === "quiz" && quizAnswers.length !== (lesson.questions || []).length)}
            data-testid="staff-lesson-next"
            className="flex-1 h-11 rounded-2xl font-bold text-sm text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #00D4FF, #7E5BF6)" }}
          >
            {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> :
             idx === course.lessons.length - 1 ? "Kurs abschließen" : "Weiter →"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
