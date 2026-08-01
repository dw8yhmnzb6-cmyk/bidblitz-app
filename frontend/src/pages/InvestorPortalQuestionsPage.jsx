import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { api } from "../services/api";
import { useInvestorPortalSession } from "../components/investor/useInvestorPortalSession";
import { InvestorPortalShell } from "../components/investor/InvestorPortalShell";

export default function InvestorPortalQuestionsPage({ onNavigate }) {
  const { account, loading } = useInvestorPortalSession(onNavigate);
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState({ subject: "", message: "" });
  const [replyText, setReplyText] = useState({});

  const loadQuestions = async () => {
    try {
      const data = await api.getInvestorPortalQuestions();
      setQuestions(data.questions || []);
    } catch (error) {
      toast.error(error.message || "Fragen konnten nicht geladen werden.");
    }
  };

  useEffect(() => { if (account) loadQuestions(); }, [account]);
  const handleLogout = async () => { await api.investorPortalLogout(); onNavigate("/investor-login"); };
  if (loading || !account) return <div className="min-h-screen bg-[#030507]" />;

  return (
    <InvestorPortalShell account={account} title="Fragen & Nachrichten" subtitle="Private Kommunikation pro Investor-Konto. Du siehst nur deine eigenen Fragen, Antworten und Follow-ups." activePath="/investor-portal/questions" onNavigate={onNavigate} onLogout={handleLogout}>
      <div className="rounded-[24px] border border-white/8 bg-white/5 p-5" data-testid="investor-question-form-card">
        <div className="grid gap-3 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Betreff" className="border-white/10 bg-white/5 text-white" data-testid="investor-question-subject-input" />
          <Textarea value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} placeholder="Nachricht" className="min-h-[120px] border-white/10 bg-white/5 text-white md:col-span-2" data-testid="investor-question-message-input" />
          <Button className="rounded-full bg-[#06B6D4] text-[#041018] hover:bg-[#33c7e0] md:col-span-2" onClick={async () => { await api.createInvestorPortalQuestion(form); toast.success("Frage gesendet."); setForm({ subject: "", message: "" }); loadQuestions(); }} data-testid="investor-question-submit-button">Frage senden</Button>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {questions.map((question, index) => (
          <div key={question.question_id} className="rounded-[24px] border border-white/8 bg-[#071019]/92 p-5" data-testid={`investor-question-thread-${index + 1}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-white">{question.subject}</h3>
                <p className="mt-1 text-xs text-white/56">{question.updated_at?.slice(0, 16).replace("T", " ")}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/76">{question.status}</span>
            </div>
            <div className="mt-4 space-y-3">
              {(question.messages || []).map((message, msgIndex) => (
                <div key={`${question.question_id}-${msgIndex}`} className={`rounded-[18px] border p-3 text-sm leading-6 ${message.author_type === "admin" ? "border-[#06B6D4]/18 bg-[#06B6D4]/10 text-white/82" : "border-white/8 bg-white/5 text-white/72"}`} data-testid={`investor-question-thread-${index + 1}-message-${msgIndex + 1}`}>
                  <div className="mb-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{message.author_type === "admin" ? "Admin" : "Investor"}</div>
                  {message.message}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Textarea value={replyText[question.question_id] || ""} onChange={(e) => setReplyText((p) => ({ ...p, [question.question_id]: e.target.value }))} placeholder="Follow-up senden" className="min-h-[90px] border-white/10 bg-white/5 text-white" data-testid={`investor-question-reply-input-${index + 1}`} />
              <Button className="rounded-full bg-[#06B6D4] text-[#041018] hover:bg-[#33c7e0]" onClick={async () => { await api.replyInvestorPortalQuestion(question.question_id, { message: replyText[question.question_id] || "" }); toast.success("Antwort gesendet."); setReplyText((p) => ({ ...p, [question.question_id]: "" })); loadQuestions(); }} data-testid={`investor-question-reply-button-${index + 1}`}>Antwort senden</Button>
            </div>
          </div>
        ))}
      </div>
    </InvestorPortalShell>
  );
}