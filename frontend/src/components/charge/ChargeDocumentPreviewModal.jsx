import { useMemo } from "react";
import { Download, ExternalLink, FileText, X } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export const ChargeDocumentPreviewModal = ({ document, onClose }) => {
  const previewMode = useMemo(() => {
    if (!document?.contentType) return document?.previewMode || "download";
    if (document.contentType.startsWith("image/")) return "image";
    if (document.contentType === "application/pdf") return "pdf";
    return document?.previewMode || "download";
  }, [document]);

  if (!document) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#08131D]/80 px-4 py-6 backdrop-blur-sm" data-testid="charge-document-preview-modal">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/10 bg-[#07111C] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#6EE7F9]">Charge Vorschau</p>
            <h3 className="mt-1 truncate text-lg font-black text-white" data-testid="charge-document-preview-title">{document.title || document.fileName || "Dokument"}</h3>
            <p className="mt-1 truncate text-xs text-slate-400" data-testid="charge-document-preview-meta">{document.subtitle || document.fileName || document.contentType || "Dateivorschau"}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="charge-document-preview-close">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="mb-4 flex flex-wrap gap-3">
            <a href={`${API}${document.downloadPath}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-[#6EE7F9] px-4 text-xs font-black text-slate-950" data-testid="charge-document-preview-download">
              <Download size={14} />Download
            </a>
            {document.objectUrl ? (
              <a href={document.objectUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black text-white" data-testid="charge-document-preview-open-new-tab">
                <ExternalLink size={14} />Neu öffnen
              </a>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#02060B] p-3" data-testid="charge-document-preview-body">
            {previewMode === "image" ? (
              <img src={document.objectUrl} alt={document.fileName || "Charge Vorschau"} className="max-h-[70vh] w-full rounded-[20px] object-contain" data-testid="charge-document-preview-image" />
            ) : previewMode === "pdf" ? (
              <iframe src={document.objectUrl} title={document.fileName || "PDF Vorschau"} className="h-[70vh] w-full rounded-[20px] bg-white" data-testid="charge-document-preview-pdf" />
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[20px] bg-[#07111C] text-center" data-testid="charge-document-preview-fallback">
                <FileText size={30} className="text-[#6EE7F9]" />
                <p className="mt-4 text-base font-black text-white">Für diesen Dateityp gibt es keine direkte Vorschau.</p>
                <p className="mt-2 max-w-md text-sm text-slate-400">Du kannst das Dokument direkt herunterladen und extern öffnen.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};