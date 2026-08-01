import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { api } from "../services/api";
import { useInvestorPortalSession } from "../components/investor/useInvestorPortalSession";
import { InvestorPortalShell } from "../components/investor/InvestorPortalShell";

export default function InvestorPortalDocumentsPage({ onNavigate }) {
  const { account, loading } = useInvestorPortalSession(onNavigate);
  const [documents, setDocuments] = useState([]);

  const loadDocuments = async () => {
    try {
      const data = await api.getInvestorPortalDocuments();
      setDocuments(data.documents || []);
    } catch (error) {
      toast.error(error.message || "Dokumente konnten nicht geladen werden.");
    }
  };

  useEffect(() => { if (account) loadDocuments(); }, [account]);
  const handleLogout = async () => { await api.investorPortalLogout(); onNavigate("/investor-login"); };

  if (loading || !account) return <div className="min-h-screen bg-[#030507]" data-testid="investor-documents-loading" />;

  return (
    <InvestorPortalShell account={account} title="Investor Dokumente" subtitle="Nur für dein Investor-Konto freigegebene Unterlagen mit Version, Aktivstatus, Download und optionaler Bestätigung." activePath="/investor-portal/documents" onNavigate={onNavigate} onLogout={handleLogout}>
      <div className="grid gap-4 xl:grid-cols-2">
        {documents.map((doc, index) => (
          <div key={doc.document_id} className="rounded-[24px] border border-white/8 bg-white/5 p-5" data-testid={`investor-document-card-${index + 1}`}>
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/56">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{doc.version}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{doc.category}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{doc.published_at?.slice(0, 10)}</span>
            </div>
            <h3 className="mt-4 text-xl font-black text-white" data-testid={`investor-document-title-${index + 1}`}>{doc.title}</h3>
            <p className="mt-2 text-sm leading-6 text-white/70">{doc.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {doc.download_url ? <Button className="rounded-full bg-[#06B6D4] text-[#041018] hover:bg-[#33c7e0]" onClick={() => window.open(doc.download_url, "_blank")} data-testid={`investor-document-download-${index + 1}`}>Download</Button> : null}
              {doc.requires_acknowledgement ? (
                <Button variant="outline" className="rounded-full border-white/10 bg-white/5 text-white" onClick={async () => { await api.acknowledgeInvestorDocument(doc.document_id); toast.success("Dokument bestätigt."); loadDocuments(); }} data-testid={`investor-document-ack-${index + 1}`}>
                  {doc.acknowledged ? "Bereits bestätigt" : "Bestätigen"}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </InvestorPortalShell>
  );
}