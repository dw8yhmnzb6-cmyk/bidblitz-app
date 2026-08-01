import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { api } from "../services/api";

const initialForm = { title: "", summary: "", body: "", is_active: true };

export default function AdminInvestorUpdatesPage({ onBack }) {
  const [updates, setUpdates] = useState([]);
  const [form, setForm] = useState(initialForm);
  const load = async () => { try { const data = await api.getAdminInvestorUpdates(); setUpdates(data.updates || []); } catch (error) { toast.error(error.message || "Updates konnten nicht geladen werden."); } };
  useEffect(() => { load(); }, []);
  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="admin-investor-updates-page">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3"><button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="admin-investor-updates-back-button"><ArrowLeft size={18} /></button><div><h1 className="text-3xl font-black text-white">Investor Updates</h1><p className="text-sm text-white/62">Private Investor-Kommunikation, Updates und Veröffentlichungen.</p></div></div>
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 space-y-3" data-testid="admin-investor-update-form">
            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Titel" className="border-white/10 bg-white/5 text-white" data-testid="admin-investor-update-title-input" />
            <Input value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} placeholder="Kurzbeschreibung" className="border-white/10 bg-white/5 text-white" data-testid="admin-investor-update-summary-input" />
            <Textarea value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} placeholder="Update-Text" className="min-h-[180px] border-white/10 bg-white/5 text-white" data-testid="admin-investor-update-body-input" />
            <label className="flex items-center gap-2 text-sm text-white/72"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} data-testid="admin-investor-update-active-checkbox" /> Aktiv</label>
            <Button className="rounded-full bg-[#06B6D4] text-[#041018] hover:bg-[#33c7e0]" onClick={async () => { await api.createAdminInvestorUpdate(form); toast.success("Update gespeichert."); setForm(initialForm); load(); }} data-testid="admin-investor-update-submit-button">Update veröffentlichen</Button>
          </div>
          <div className="space-y-4">{updates.map((item, index) => <article key={item.update_id} className="rounded-[24px] border border-white/8 bg-[#071019]/92 p-5" data-testid={`admin-investor-update-card-${index + 1}`}><div className="text-xs text-[#82E7FF]">{item.published_at?.slice(0, 10)}</div><h3 className="mt-2 text-xl font-black text-white">{item.title}</h3><p className="mt-2 text-sm font-semibold text-white/78">{item.summary}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/68">{item.body}</p></article>)}</div>
        </div>
      </div>
    </div>
  );
}