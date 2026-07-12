import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, ExternalLink, FileImage, FileText, Loader2, Plus, Save, ShieldAlert, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

const DOC_TYPES = [
  ["license", "Führerschein"],
  ["p_schein", "P-Schein"],
  ["insurance", "Versicherung"],
  ["tuev", "TÜV"],
  ["concession", "Konzession"],
  ["other", "Sonstiges"],
];

const initialForm = {
  type: "license",
  expires_on: "",
  file_url: "",
  file_media_id: "",
  note: "",
};

const toneClass = {
  expired: "bg-red-500/10 border-red-500/25 text-red-300",
  urgent: "bg-amber-500/10 border-amber-500/25 text-amber-300",
  warning: "bg-orange-500/10 border-orange-500/25 text-orange-300",
  notice: "bg-cyan-500/10 border-cyan-500/25 text-cyan-300",
  ok: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300",
  unknown: "bg-white/5 border-white/10 text-white/60",
};

export const DriverDocumentsPanel = ({ api, panelBg, panelBorder }) => {
  const [summary, setSummary] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, docsData] = await Promise.all([
        api("/api/taxi/driver/documents/summary"),
        api("/api/taxi/driver/documents"),
      ]);
      setSummary(summaryData);
      setDocs(docsData.items || []);
    } catch (e) {
      toast.error(e.message);
    }
    setLoading(false);
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.expires_on) {
      toast.error("Ablaufdatum fehlt");
      return;
    }
    setSaving(true);
    try {
      await api("/api/taxi/driver/documents", {
        method: "POST",
        body: JSON.stringify(form),
      });
      toast.success("Dokument gespeichert");
      setForm(initialForm);
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e.message);
    }
    setSaving(false);
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    body.append("type", form.type);
    setUploading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/taxi/driver/documents/upload`, {
        method: "POST",
        credentials: "include",
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Foto-Upload fehlgeschlagen");
      setForm((current) => ({
        ...current,
        file_url: data.file_url,
        file_media_id: data.media_id,
      }));
      toast.success("Foto hochgeladen");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Dokument wirklich löschen?")) return;
    try {
      await api(`/api/taxi/driver/documents/${id}`, { method: "DELETE" });
      toast.success("Dokument entfernt");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-3" data-testid="driver-documents-panel">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl p-3 text-center" style={{ background: panelBg, border: panelBorder }} data-testid="driver-documents-expired-count">
          <p className="text-[10px] text-white/40 uppercase">Abgelaufen</p>
          <p className="text-[20px] font-black text-red-300">{summary?.counts?.expired || 0}</p>
        </div>
        <div className="rounded-2xl p-3 text-center" style={{ background: panelBg, border: panelBorder }} data-testid="driver-documents-urgent-count">
          <p className="text-[10px] text-white/40 uppercase">≤ 7 Tage</p>
          <p className="text-[20px] font-black text-amber-300">{summary?.counts?.urgent || 0}</p>
        </div>
        <div className="rounded-2xl p-3 text-center" style={{ background: panelBg, border: panelBorder }} data-testid="driver-documents-missing-count">
          <p className="text-[10px] text-white/40 uppercase">Fehlt</p>
          <p className="text-[20px] font-black text-violet-300">{summary?.missing_required?.length || 0}</p>
        </div>
      </div>

      {summary?.alerts?.map((alert, idx) => (
        <div key={`${alert.title}-${idx}`} className={`rounded-2xl p-3 border ${alert.tone === "red" ? "bg-red-500/10 border-red-500/25 text-red-300" : alert.tone === "amber" ? "bg-amber-500/10 border-amber-500/25 text-amber-300" : "bg-violet-500/10 border-violet-500/25 text-violet-300"}`} data-testid={`driver-document-alert-${idx}`}>
          <div className="flex items-start gap-2"><ShieldAlert size={14} className="mt-0.5 shrink-0" /><div><p className="text-[12px] font-bold">{alert.title}</p><p className="text-[11px] opacity-80 mt-0.5">{alert.text}</p></div></div>
        </div>
      ))}

      {summary?.has_blocker && (
        <div className="rounded-2xl p-3 border bg-red-500/10 border-red-500/25 text-red-300" data-testid="driver-documents-blocker-banner">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] font-bold">Handlung nötig</p>
              <p className="text-[11px] opacity-80 mt-0.5">Mindestens ein Dokument ist abgelaufen oder ein Pflichtdokument fehlt.</p>
            </div>
          </div>
        </div>
      )}

      {summary?.next_expiring && (
        <div className="rounded-2xl p-3 border bg-white/5 border-white/10" data-testid="driver-next-expiring-card">
          <div className="flex items-center gap-2 text-white"><CalendarClock size={14} className="text-[#00C2FF]" /><span className="text-[12px] font-bold">Nächstes Ablaufdatum</span></div>
          <p className="text-[12px] text-white/70 mt-1">{summary.next_expiring.type_label} · {summary.next_expiring.expires_on} · {summary.next_expiring.days_until_expiry} Tage</p>
        </div>
      )}

      <button onClick={() => setShowForm((v) => !v)} className="w-full py-2.5 rounded-xl bg-[#00C2FF]/15 border border-[#00C2FF]/25 text-[#00C2FF] text-[12px] font-bold flex items-center justify-center gap-2" data-testid="driver-documents-toggle-form">
        <Plus size={14} /> Dokument hinzufügen
      </button>

      {showForm && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: panelBg, border: panelBorder }} data-testid="driver-documents-form">
          <select value={form.type} onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))} className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" data-testid="driver-documents-type">
            {DOC_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input type="date" value={form.expires_on} onChange={(e) => setForm((s) => ({ ...s, expires_on: e.target.value }))} className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white [color-scheme:dark]" data-testid="driver-documents-expires-on" />
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3" data-testid="driver-documents-photo-upload-card">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div>
                <p className="text-[12px] font-bold text-white">Foto hochladen</p>
                <p className="text-[11px] text-white/45">Kamera oder Galerie · JPG, PNG, WEBP, HEIC</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#00C2FF]/15 border border-[#00C2FF]/25 px-3 py-2 text-[12px] font-bold text-[#00C2FF]" data-testid="driver-documents-upload-button">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                Foto auswählen
                <input type="file" accept="image/*" capture="environment" className="hidden" data-testid="driver-documents-file-input" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
              </label>
            </div>
            <input value={form.file_url} onChange={(e) => setForm((s) => ({ ...s, file_url: e.target.value }))} placeholder="Datei-URL (optional)" className="mt-3 w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" data-testid="driver-documents-file-url" />
            {form.file_url && (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3" data-testid="driver-documents-preview-card">
                <p className="text-[11px] text-white/45 mb-2">Vorschau</p>
                <img src={`${process.env.REACT_APP_BACKEND_URL}${form.file_url}`} alt="Dokument Vorschau" className="w-full max-h-56 object-contain rounded-xl bg-black/30" data-testid="driver-documents-preview-image" />
              </div>
            )}
          </div>
          <textarea value={form.note} onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))} placeholder="Notiz" rows={3} className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" data-testid="driver-documents-note" />
          <button onClick={save} disabled={saving || uploading} className="w-full py-2.5 rounded-xl bg-[#00D26A] text-black text-[12px] font-black flex items-center justify-center gap-2 disabled:opacity-50" data-testid="driver-documents-save">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Speichern
          </button>
        </div>
      )}

      {loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-white/40" /></div> : docs.map((doc) => (
        <div key={doc.id} className="rounded-2xl p-4" style={{ background: panelBg, border: panelBorder }} data-testid={`driver-document-row-${doc.id}`}>
          <div className="flex items-start gap-3">
            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${toneClass[doc.alert_level] || toneClass.unknown}`}>
              {doc.alert_level === "expired" || doc.alert_level === "urgent" ? <AlertTriangle size={16} /> : <FileText size={16} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[13px] font-bold text-white" data-testid={`driver-document-type-${doc.id}`}>{doc.type_label}</p>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${toneClass[doc.alert_level] || toneClass.unknown}`} data-testid={`driver-document-alert-level-${doc.id}`}>{doc.alert_level}</span>
              </div>
              <p className="text-[11px] text-white/55 mt-1">Ablauf: {doc.expires_on} · {doc.days_until_expiry ?? "?"} Tage</p>
              {doc.note && <p className="text-[11px] text-white/40 mt-1">{doc.note}</p>}
              {doc.file_url ? (
                <div className="mt-2 space-y-2">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-2" data-testid={`driver-document-preview-${doc.id}`}>
                    <img src={`${process.env.REACT_APP_BACKEND_URL}${doc.file_url}`} alt={`${doc.type_label} Vorschau`} className="w-full max-h-40 object-contain rounded-lg bg-black/30" data-testid={`driver-document-preview-image-${doc.id}`} />
                  </div>
                  <a href={`${process.env.REACT_APP_BACKEND_URL}${doc.file_url}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#00C2FF]" data-testid={`driver-document-file-${doc.id}`}><ExternalLink size={11} /> Datei öffnen</a>
                </div>
              ) : <div className="inline-flex items-center gap-1 mt-2 text-[11px] text-white/35" data-testid={`driver-document-no-file-${doc.id}`}><FileImage size={11} /> Kein Foto hinterlegt</div>}
            </div>
            <button onClick={() => remove(doc.id)} className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 inline-flex items-center justify-center" data-testid={`driver-document-delete-${doc.id}`}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}

      {!loading && docs.length === 0 && (
        <div className="rounded-2xl p-6 text-center text-[12px] text-white/40" style={{ background: panelBg, border: panelBorder }} data-testid="driver-documents-empty">
          Noch keine Fahrer-Dokumente hinterlegt.
        </div>
      )}
    </div>
  );
};