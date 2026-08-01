import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { api } from "../services/api";

const initialForm = { title: "", summary: "", category: "general", version: "v1.0", download_url: "", requires_acknowledgement: false, is_active: true, audience_statuses: ["new", "review_pending", "documents_shared", "call_scheduled", "identification_required", "contract_preparation", "waitlist", "completed"] };

export default function AdminInvestorDocumentsPage({ onBack }) {
  const [documents, setDocuments] = useState([]);
  const [form, setForm] = useState(initialForm);
  const load = async () => { try { const data = await api.getAdminInvestorDocuments(); setDocuments(data.documents || []); } catch (error) { toast.error(error.message || "Dokumente konnten nicht geladen werden."); } };
  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="admin-investor-documents-page">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3"><button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="admin-investor-documents-back-button"><ArrowLeft size={18} /></button><div><h1 className="text-3xl font-black text-white">Investor Dokumente</h1><p className="text-sm text-white/62">Versionen, Aktivstatus, Download-Link und Bestätigungspflicht.</p></div></div>
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 space-y-3" data-testid="admin-investor-document-form">
            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Titel" className="border-white/10 bg-white/5 text-white" data-testid="admin-investor-document-title-input" />
            <Textarea value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} placeholder="Kurzbeschreibung" className="min-h-[120px] border-white/10 bg-white/5 text-white" data-testid="admin-investor-document-summary-input" />
            <div className="grid gap-3 md:grid-cols-3">
              <Input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="Kategorie" className="border-white/10 bg-white/5 text-white" data-testid="admin-investor-document-category-input" />
              <Input value={form.version} onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))} placeholder="Version" className="border-white/10 bg-white/5 text-white" data-testid="admin-investor-document-version-input" />
              <Input value={form.download_url} onChange={(e) => setForm((p) => ({ ...p, download_url: e.target.value }))} placeholder="Download URL" className="border-white/10 bg-white/5 text-white" data-testid="admin-investor-document-download-url-input" />
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-white/72">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.requires_acknowledgement} onChange={(e) => setForm((p) => ({ ...p, requires_acknowledgement: e.target.checked }))} data-testid="admin-investor-document-requires-ack-checkbox" /> Bestätigung erforderlich</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} data-testid="admin-investor-document-active-checkbox" /> Aktiv</label>
            </div>
            <Button className="rounded-full bg-[#06B6D4] text-[#041018] hover:bg-[#33c7e0]" onClick={async () => { await api.createAdminInvestorDocument(form); toast.success("Dokument gespeichert."); setForm(initialForm); load(); }} data-testid="admin-investor-document-submit-button">Dokument anlegen</Button>
          </div>
          <div className="space-y-4">{documents.map((doc, index) => <div key={doc.document_id} className="rounded-[24px] border border-white/8 bg-[#071019]/92 p-5" data-testid={`admin-investor-document-card-${index + 1}`}><h3 className="text-xl font-black text-white">{doc.title}</h3><p className="mt-2 text-sm text-white/72">{doc.summary}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-white/56"><span>{doc.version}</span><span>•</span><span>{doc.category}</span><span>•</span><span>{doc.is_active ? "Aktiv" : "Inaktiv"}</span></div></div>)}</div>
        </div>
      </div>
    </div>
  );
}