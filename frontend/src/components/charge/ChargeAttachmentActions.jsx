import { Download, Eye, Trash2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export const ChargeAttachmentActions = ({ attachments = [], onPreview, onDelete, deletingId, testidPrefix }) => {
  if (!attachments.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2" data-testid={testidPrefix}>
      {attachments.map((item, index) => (
        <div key={item.attachment_id || `${item.original_filename}-${index}`} className="flex flex-wrap items-center gap-2">
          {item.preview_supported ? (
            <button
              type="button"
              onClick={() => onPreview?.(item)}
              className="inline-flex items-center gap-2 rounded-full border border-[#0A1626]/10 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700"
              data-testid={`${testidPrefix}-preview-${index}`}
            >
              <Eye size={12} />Vorschau
            </button>
          ) : null}
          <a
            href={`${API}${item.download_path}`}
            className="inline-flex items-center gap-2 rounded-full border border-[#0A1626]/10 bg-[#F4F8FB] px-3 py-1 text-[11px] font-semibold text-slate-700"
            data-testid={`${testidPrefix}-download-${index}`}
          >
            <Download size={12} />{item.original_filename}
          </a>
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(item)}
              disabled={deletingId === item.attachment_id}
              className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-700 disabled:opacity-50"
              data-testid={`${testidPrefix}-delete-${index}`}
            >
              <Trash2 size={12} />{deletingId === item.attachment_id ? "Löscht..." : "Entfernen"}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
};