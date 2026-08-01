import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { api } from "../services/api";
import { useInvestorPortalSession } from "../components/investor/useInvestorPortalSession";
import { InvestorPortalShell } from "../components/investor/InvestorPortalShell";

export default function InvestorPortalMeetingsPage({ onNavigate }) {
  const { account, loading } = useInvestorPortalSession(onNavigate);
  const [meetings, setMeetings] = useState([]);
  const [form, setForm] = useState({ preferred_date: "", meeting_mode: "video", note: "" });
  const loadMeetings = async () => {
    try {
      const data = await api.getInvestorPortalMeetings();
      setMeetings(data.meetings || []);
    } catch (error) {
      toast.error(error.message || "Meetings konnten nicht geladen werden.");
    }
  };
  useEffect(() => { if (account) loadMeetings(); }, [account]);
  const handleLogout = async () => { await api.investorPortalLogout(); onNavigate("/investor-login"); };
  if (loading || !account) return <div className="min-h-screen bg-[#030507]" />;

  return (
    <InvestorPortalShell account={account} title="Meetings & Gespräche" subtitle="Meeting-Anfragen, Vorschläge und Bestätigungen im separaten Investor-Prozess." activePath="/investor-portal/meetings" onNavigate={onNavigate} onLogout={handleLogout}>
      <div className="rounded-[24px] border border-white/8 bg-white/5 p-5" data-testid="investor-meeting-request-card">
        <div className="grid gap-3 md:grid-cols-2">
          <Input value={form.preferred_date} onChange={(e) => setForm((p) => ({ ...p, preferred_date: e.target.value }))} placeholder="Bevorzugter Termin / Zeitraum" className="border-white/10 bg-white/5 text-white" data-testid="investor-meeting-date-input" />
          <Select value={form.meeting_mode} onValueChange={(value) => setForm((p) => ({ ...p, meeting_mode: value }))}>
            <SelectTrigger className="border-white/10 bg-white/5 text-white" data-testid="investor-meeting-mode-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="phone">Telefon</SelectItem>
              <SelectItem value="onsite">Vor Ort</SelectItem>
            </SelectContent>
          </Select>
          <Textarea value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="Wunsch, Thema oder Rückfrage" className="min-h-[120px] border-white/10 bg-white/5 text-white md:col-span-2" data-testid="investor-meeting-note-input" />
          <Button className="rounded-full bg-[#06B6D4] text-[#041018] hover:bg-[#33c7e0] md:col-span-2" onClick={async () => { await api.createInvestorPortalMeetingRequest(form); toast.success("Meeting-Anfrage gesendet."); setForm({ preferred_date: "", meeting_mode: "video", note: "" }); loadMeetings(); }} data-testid="investor-meeting-submit-button">Meeting anfragen</Button>
        </div>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {meetings.map((meeting, index) => (
          <div key={meeting.meeting_id} className="rounded-[24px] border border-white/8 bg-[#071019]/92 p-5" data-testid={`investor-meeting-card-${index + 1}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-black text-white">{meeting.meeting_title}</h3>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/76">{meeting.status}</span>
            </div>
            <div className="mt-3 space-y-2 text-sm text-white/72">
              <p>Termin: {meeting.scheduled_for || meeting.preferred_date}</p>
              <p>Format: {meeting.meeting_mode}</p>
              {meeting.meeting_link ? <p>Link: {meeting.meeting_link}</p> : null}
              {meeting.note ? <p>{meeting.note}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </InvestorPortalShell>
  );
}