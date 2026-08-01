import { useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Input } from "../components/ui/input";
import { api } from "../services/api";
import { InvestorStatusBadge } from "../components/investor/InvestorStatusBadge";

export default function AdminInvestorLeadsPage({ onBack }) {
  const [leads, setLeads] = useState([]);
  const [statusChoices, setStatusChoices] = useState([]);
  const [notes, setNotes] = useState({});
  const [message, setMessage] = useState({});
  const load = async () => {
    try {
      const data = await api.getAdminInvestorLeads();
      setLeads(data.leads || []);
      setStatusChoices(data.status_choices || []);
    } catch (error) {
      toast.error(error.message || "Investor-Leads konnten nicht geladen werden.");
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="admin-investor-leads-page">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="admin-investor-leads-back-button"><ArrowLeft size={18} /></button>
            <div><h1 className="text-3xl font-black text-white">Investor Leads</h1><p className="text-sm text-white/62">Status, Qualifizierung, Audit-nahe Notizen und CSV-Export.</p></div>
          </div>
          <Button className="rounded-full bg-[#06B6D4] text-[#041018] hover:bg-[#33c7e0]" onClick={() => api.exportAdminInvestorLeads()} data-testid="admin-investor-leads-export-button"><Download size={15} className="mr-2" />CSV Export</Button>
        </div>
        <div className="mt-5 space-y-4">
          {leads.map((lead, index) => (
            <div key={lead.account_id} className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5" data-testid={`admin-investor-lead-card-${index + 1}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-white">{lead.first_name} {lead.last_name}</h2>
                  <p className="mt-1 text-sm text-white/62">{lead.email} · {lead.phone} · {lead.company || "Keine Firma"}</p>
                </div>
                <InvestorStatusBadge status={lead.status} dataTestId={`admin-investor-lead-status-${index + 1}`} />
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
                <Select value={lead.status} onValueChange={async (value) => { await api.updateAdminInvestorLeadStatus(lead.account_id, { status: value, note: notes[lead.account_id] || "" }); toast.success("Status gespeichert."); load(); }}>
                  <SelectTrigger className="border-white/10 bg-white/5 text-white" data-testid={`admin-investor-lead-status-select-${index + 1}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{statusChoices.map((choice) => <SelectItem key={choice} value={choice}>{choice}</SelectItem>)}</SelectContent>
                </Select>
                <Textarea value={notes[lead.account_id] || lead.admin_note || ""} onChange={(e) => setNotes((p) => ({ ...p, [lead.account_id]: e.target.value }))} placeholder="Interne Notiz" className="min-h-[110px] border-white/10 bg-white/5 text-white" data-testid={`admin-investor-lead-note-${index + 1}`} />
                <div className="space-y-3 rounded-[20px] border border-white/8 bg-white/5 p-4">
                  <Input value={message[`${lead.account_id}-subject`] || ""} onChange={(e) => setMessage((p) => ({ ...p, [`${lead.account_id}-subject`]: e.target.value }))} placeholder="Betreff" className="border-white/10 bg-white/5 text-white" data-testid={`admin-investor-lead-message-subject-${index + 1}`} />
                  <Textarea value={message[`${lead.account_id}-body`] || ""} onChange={(e) => setMessage((p) => ({ ...p, [`${lead.account_id}-body`]: e.target.value }))} placeholder="Private Nachricht" className="min-h-[90px] border-white/10 bg-white/5 text-white" data-testid={`admin-investor-lead-message-body-${index + 1}`} />
                  <Button className="rounded-full bg-[#06B6D4] text-[#041018] hover:bg-[#33c7e0]" onClick={async () => { await api.messageAdminInvestorLead(lead.account_id, { subject: message[`${lead.account_id}-subject`] || "Investor Nachricht", message: message[`${lead.account_id}-body`] || "" }); toast.success("Nachricht angelegt."); setMessage((p) => ({ ...p, [`${lead.account_id}-subject`]: "", [`${lead.account_id}-body`]: "" })); }} data-testid={`admin-investor-lead-message-send-${index + 1}`}>Nachricht senden</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}