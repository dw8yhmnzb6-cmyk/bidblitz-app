import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { api } from "../services/api";

const initialForm = { account_id: "", meeting_title: "Investor Gespräch", status: "proposed", scheduled_for: "", meeting_mode: "video", meeting_link: "", note: "" };

export default function AdminInvestorMeetingsPage({ onBack }) {
  const [meetings, setMeetings] = useState([]);
  const [leads, setLeads] = useState([]);
  const [form, setForm] = useState(initialForm);
  const load = async () => {
    try {
      const [meetingData, leadData] = await Promise.all([api.getAdminInvestorMeetings(), api.getAdminInvestorLeads()]);
      setMeetings(meetingData.meetings || []);
      setLeads(leadData.leads || []);
      if (!form.account_id && leadData.leads?.[0]?.account_id) setForm((p) => ({ ...p, account_id: leadData.leads[0].account_id }));
    } catch (error) {
      toast.error(error.message || "Investor-Meetings konnten nicht geladen werden.");
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="admin-investor-meetings-page">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3"><button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="admin-investor-meetings-back-button"><ArrowLeft size={18} /></button><div><h1 className="text-3xl font-black text-white">Investor Meetings</h1><p className="text-sm text-white/62">Vorschläge, Bestätigungen und Gesprächsplanung.</p></div></div>
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 space-y-3" data-testid="admin-investor-meeting-form">
            <Select value={form.account_id} onValueChange={(value) => setForm((p) => ({ ...p, account_id: value }))}><SelectTrigger className="border-white/10 bg-white/5 text-white" data-testid="admin-investor-meeting-account-select"><SelectValue placeholder="Investor wählen" /></SelectTrigger><SelectContent>{leads.map((lead) => <SelectItem key={lead.account_id} value={lead.account_id}>{lead.first_name} {lead.last_name} · {lead.email}</SelectItem>)}</SelectContent></Select>
            <Input value={form.meeting_title} onChange={(e) => setForm((p) => ({ ...p, meeting_title: e.target.value }))} placeholder="Meeting Titel" className="border-white/10 bg-white/5 text-white" data-testid="admin-investor-meeting-title-input" />
            <Input value={form.scheduled_for} onChange={(e) => setForm((p) => ({ ...p, scheduled_for: e.target.value }))} placeholder="Termin / Zeitraum" className="border-white/10 bg-white/5 text-white" data-testid="admin-investor-meeting-scheduled-for-input" />
            <Input value={form.meeting_link} onChange={(e) => setForm((p) => ({ ...p, meeting_link: e.target.value }))} placeholder="Meeting Link" className="border-white/10 bg-white/5 text-white" data-testid="admin-investor-meeting-link-input" />
            <Textarea value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="Notiz" className="min-h-[120px] border-white/10 bg-white/5 text-white" data-testid="admin-investor-meeting-note-input" />
            <Button className="rounded-full bg-[#06B6D4] text-[#041018] hover:bg-[#33c7e0]" onClick={async () => { await api.createAdminInvestorMeeting(form.account_id, form); toast.success("Meeting angelegt."); setForm((p) => ({ ...initialForm, account_id: p.account_id })); load(); }} data-testid="admin-investor-meeting-submit-button">Meeting anlegen</Button>
          </div>
          <div className="space-y-4">{meetings.map((meeting, index) => <div key={meeting.meeting_id} className="rounded-[24px] border border-white/8 bg-[#071019]/92 p-5" data-testid={`admin-investor-meeting-card-${index + 1}`}><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-black text-white">{meeting.meeting_title}</h3><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/76">{meeting.status}</span></div><p className="mt-3 text-sm text-white/72">Konto: {meeting.account_id}</p><p className="mt-1 text-sm text-white/72">Termin: {meeting.scheduled_for}</p><p className="mt-1 text-sm text-white/72">Format: {meeting.meeting_mode}</p>{meeting.note ? <p className="mt-2 text-sm text-white/68">{meeting.note}</p> : null}</div>)}</div>
        </div>
      </div>
    </div>
  );
}