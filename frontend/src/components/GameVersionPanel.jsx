import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, CheckCircle2, FileArchive, Loader2, Send, Trash2, Upload, XCircle } from "lucide-react";

const API_ROOT = `${process.env.REACT_APP_BACKEND_URL || ""}/api/game-studio/drafts`;
const MAX_ZIP_BYTES = 50 * 1024 * 1024;

const COPY = {
  de: {
    open: "Versionen & Upload", title: "HTML5-Versionen", close: "Schließen",
    hint: "ZIP bis 50 MB · index.html im Hauptverzeichnis · wird zuerst nur in Quarantäne gespeichert.",
    choose: "ZIP-Version hochladen", uploading: "Upload läuft…", empty: "Noch keine Version hochgeladen.",
    loadError: "Versionen konnten nicht geladen werden.", uploadError: "ZIP-Version konnte nicht hochgeladen werden.",
    invalid: "Bitte eine ZIP-Datei bis maximal 50 MB auswählen.", uploaded: "Version sicher in Quarantäne gespeichert.",
    files: "Dateien", packed: "ZIP", unpacked: "entpackt", duplicate: "Diese Datei war bereits vorhanden.",
    submit: "Zur Prüfung einreichen", submitted: "Zur Prüfung eingereicht", submitError: "Version konnte nicht eingereicht werden.",
    remove: "Löschen", removeConfirm: "Diese hochgeladene Version löschen?", removeError: "Version konnte nicht gelöscht werden.", withdraw: "Prüfung zurückziehen", withdrawError: "Prüfung konnte nicht zurückgezogen werden.",
    quarantined: "Quarantäne", validated: "Archiv geprüft", blocked: "Ausführung gesperrt", approved: "Archiv akzeptiert", changes: "Änderungen erforderlich", rejected: "Abgelehnt", uploadNew: "Bitte eine neue Version hochladen.", previewLink: "Preview-Link erzeugen", openPreview: "Private Vorschau öffnen", previewError: "Preview-Link konnte nicht erzeugt werden.", revokePreview: "Link widerrufen", revokePreviewError: "Preview-Link konnte nicht widerrufen werden.",
    noPreview: "Fremder Spielcode wird noch nicht ausgeführt. Eine private Vorschau folgt erst auf einer getrennten, cookie-freien Games-Origin.",
  },
  en: {
    open: "Versions & upload", title: "HTML5 versions", close: "Close",
    hint: "ZIP up to 50 MB · index.html at ZIP root · stored in quarantine first.",
    choose: "Upload ZIP version", uploading: "Uploading…", empty: "No version uploaded yet.",
    loadError: "Could not load versions.", uploadError: "Could not upload ZIP version.",
    invalid: "Choose a ZIP file up to 50 MB.", uploaded: "Version stored safely in quarantine.",
    files: "Files", packed: "ZIP", unpacked: "unpacked", duplicate: "This exact file already exists.",
    submit: "Submit for review", submitted: "Submitted for review", submitError: "Could not submit version.",
    remove: "Delete", removeConfirm: "Delete this uploaded version?", removeError: "Could not delete version.", withdraw: "Withdraw review", withdrawError: "Could not withdraw review.",
    quarantined: "Quarantine", validated: "Archive validated", blocked: "Execution blocked", approved: "Archive approved", changes: "Changes requested", rejected: "Rejected", uploadNew: "Please upload a new version.", previewLink: "Create preview link", openPreview: "Open private preview", previewError: "Could not create preview link.", revokePreview: "Revoke link", revokePreviewError: "Could not revoke preview link.",
    noPreview: "Third-party game code is not executed yet. Private preview follows only on a separate cookie-free Games origin.",
  },
  sq: {
    open: "Versionet & ngarkimi", title: "Versionet HTML5", close: "Mbyll",
    hint: "ZIP deri 50 MB · index.html në rrënjë · fillimisht ruhet vetëm në karantinë.",
    choose: "Ngarko version ZIP", uploading: "Po ngarkohet…", empty: "Ende nuk ka version të ngarkuar.",
    loadError: "Versionet nuk u ngarkuan.", uploadError: "Versioni ZIP nuk u ngarkua.",
    invalid: "Zgjidh një skedar ZIP deri në 50 MB.", uploaded: "Versioni u ruajt në karantinë.",
    files: "Skedarë", packed: "ZIP", unpacked: "i shpaketuar", duplicate: "Ky skedar ekziston tashmë.",
    submit: "Dërgo për kontroll", submitted: "U dërgua për kontroll", submitError: "Versioni nuk u dërgua për kontroll.",
    remove: "Fshi", removeConfirm: "Ta fshij këtë version?", removeError: "Versioni nuk u fshi.", withdraw: "Tërhiq kontrollin", withdrawError: "Kontrolli nuk u tërhoq.",
    quarantined: "Karantinë", validated: "Arkivi u kontrollua", blocked: "Ekzekutimi i bllokuar", approved: "Arkivi u pranua", changes: "Kërkohen ndryshime", rejected: "Refuzuar", uploadNew: "Ngarko një version të ri.", previewLink: "Krijo linkun e provës", openPreview: "Hap provën private", previewError: "Linku i provës nuk u krijua.", revokePreview: "Çaktivizo linkun", revokePreviewError: "Linku i provës nuk u çaktivizua.",
    noPreview: "Kodi i lojës së palës së tretë ende nuk ekzekutohet. Prova private vjen vetëm në një Games-origin të ndarë pa cookie.",
  },
};

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(typeof body.detail === "string" ? body.detail : "Request failed"), { status: response.status });
  return body;
}

export default function GameVersionPanel({ draftId, locale = "en" }) {
  const c = COPY[locale] || COPY.en;
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewLinks, setPreviewLinks] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${API_ROOT}/${encodeURIComponent(draftId)}/versions`, { credentials: "include" });
      const body = await readResponse(response);
      setVersions(Array.isArray(body.versions) ? body.versions : []);
    } catch {
      setError(c.loadError);
    } finally {
      setLoading(false);
    }
  }, [draftId, c.loadError]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip") || file.size < 64 || file.size > MAX_ZIP_BYTES) {
      setError(c.invalid); return;
    }
    setBusy("upload"); setError(""); setNotice("");
    try {
      const data = new FormData();
      data.append("file", file, file.name);
      const response = await fetch(`${API_ROOT}/${encodeURIComponent(draftId)}/versions`, {
        method: "POST", credentials: "include", body: data,
      });
      const body = await readResponse(response);
      setNotice(body.duplicate ? c.duplicate : c.uploaded);
      await load();
    } catch (uploadError) {
      setError(uploadError?.message || c.uploadError);
    } finally {
      setBusy("");
    }
  };

  const submit = async (versionId) => {
    setBusy(versionId); setError(""); setNotice("");
    try {
      const response = await fetch(`${API_ROOT}/${encodeURIComponent(draftId)}/versions/${encodeURIComponent(versionId)}/submit-review`, {
        method: "POST", credentials: "include",
      });
      await readResponse(response);
      setNotice(c.submitted);
      await load();
    } catch (submitError) {
      setError(submitError?.message || c.submitError);
    } finally {
      setBusy("");
    }
  };

  const createPreviewLink = async (versionId) => {
    setBusy(versionId); setError(""); setNotice("");
    try {
      const response = await fetch(`${API_ROOT}/${encodeURIComponent(draftId)}/versions/${encodeURIComponent(versionId)}/preview-link`, {
        method: "POST", credentials: "include",
      });
      const body = await readResponse(response);
      if (!body.url) throw new Error(c.previewError);
      setPreviewLinks((current) => ({ ...current, [versionId]: body.url }));
    } catch (previewError) {
      setError(previewError?.message || c.previewError);
    } finally {
      setBusy("");
    }
  };

  const revokePreviewLink = async (versionId) => {
    setBusy(versionId); setError(""); setNotice("");
    try {
      const response = await fetch(`${API_ROOT}/${encodeURIComponent(draftId)}/versions/${encodeURIComponent(versionId)}/preview-links`, {
        method: "DELETE", credentials: "include",
      });
      await readResponse(response);
      setPreviewLinks((current) => {
        const next = { ...current };
        delete next[versionId];
        return next;
      });
    } catch (revokeError) {
      setError(revokeError?.message || c.revokePreviewError);
    } finally {
      setBusy("");
    }
  };

  const withdraw = async (versionId) => {
    setBusy(versionId); setError(""); setNotice("");
    try {
      const response = await fetch(`${API_ROOT}/${encodeURIComponent(draftId)}/versions/${encodeURIComponent(versionId)}/withdraw-review`, {
        method: "POST", credentials: "include",
      });
      await readResponse(response);
      await load();
    } catch (withdrawError) {
      setError(withdrawError?.message || c.withdrawError);
    } finally {
      setBusy("");
    }
  };

  const remove = async (versionId) => {
    if (!window.confirm(c.removeConfirm)) return;
    setBusy(versionId); setError(""); setNotice("");
    try {
      const response = await fetch(`${API_ROOT}/${encodeURIComponent(draftId)}/versions/${encodeURIComponent(versionId)}`, {
        method: "DELETE", credentials: "include",
      });
      await readResponse(response);
      await load();
    } catch (removeError) {
      setError(removeError?.message || c.removeError);
    } finally {
      setBusy("");
    }
  };

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/5 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10"><Archive size={15} />{c.open}</button>;
  }

  return (
    <section className="mt-4 rounded-2xl border border-cyan-200/15 bg-[#07182d]/80 p-4" aria-label={c.title}>
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-sm font-bold"><FileArchive size={17} className="text-cyan-300" />{c.title}</h4>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-white/55 hover:bg-white/10" aria-label={c.close}><XCircle size={17} /></button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-white/45">{c.hint}</p>
      <p className="mt-2 rounded-xl border border-amber-200/15 bg-amber-200/5 p-3 text-xs leading-relaxed text-amber-100/75">{c.noPreview}</p>

      <input ref={inputRef} type="file" accept=".zip,application/zip" onChange={upload} className="hidden" />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={Boolean(busy)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-xs font-bold text-[#061329] disabled:opacity-50">
        {busy === "upload" ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {busy === "upload" ? c.uploading : c.choose}
      </button>

      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-300/25 bg-rose-400/10 p-3 text-xs text-rose-100">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-3 text-xs text-emerald-100">{notice}</p>}

      {loading ? <div className="mt-4 flex items-center gap-2 text-xs text-white/50"><Loader2 size={15} className="animate-spin" />{c.title}…</div>
        : versions.length === 0 ? <p className="mt-4 text-xs text-white/45">{c.empty}</p>
          : <div className="mt-4 space-y-3">{versions.map((version) => {
            const submitted = version.review_status === "submitted";
            const approved = version.review_status === "archive_approved";
            const changesRequested = version.review_status === "changes_requested";
            const rejected = version.review_status === "rejected";
            const canSubmit = version.review_status === "not_submitted";
            const canDelete = !submitted && !approved && version.preview_status !== "prepared";
            const statusLabel = submitted ? c.submitted : approved ? c.approved : changesRequested ? c.changes : rejected ? c.rejected : c.quarantined;
            return <article key={version.id} className="rounded-xl border border-white/10 bg-white/[.03] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate text-xs font-semibold text-white/85">{version.original_filename || `Version ${version.version_number || ""}`}</p><p className="mt-1 text-[11px] text-white/45">{version.file_count} {c.files} · {formatBytes(version.archive_bytes)} {c.packed} · {formatBytes(version.unpacked_bytes)} {c.unpacked}</p></div>
                <span className="shrink-0 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-2 py-1 text-[10px] text-cyan-100">{statusLabel}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-white/45"><span className="inline-flex items-center gap-1"><CheckCircle2 size={12} />{c.validated}</span><span>·</span><span>{c.blocked}</span></div>
              {version.review_note && <p className="mt-3 rounded-lg border border-white/10 bg-white/[.03] p-2 text-[11px] leading-relaxed text-white/60">{version.review_note}</p>}
              {(changesRequested || rejected) && <p className="mt-2 text-[11px] text-amber-100/75">{c.uploadNew}</p>}
              {approved && version.preview_status === "prepared" && <div className="mt-3">
                {previewLinks[version.id]
                  ? <div className="grid grid-cols-[1fr_auto] gap-2"><a href={previewLinks[version.id]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-[11px] font-semibold text-emerald-100">{c.openPreview}</a><button type="button" onClick={() => revokePreviewLink(version.id)} disabled={Boolean(busy)} className="rounded-lg border border-white/10 px-3 py-2 text-[11px] text-white/55 disabled:opacity-45">{c.revokePreview}</button></div>
                  : <button type="button" onClick={() => createPreviewLink(version.id)} disabled={Boolean(busy)} className="inline-flex w-full items-center justify-center rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-[11px] font-semibold text-emerald-100 disabled:opacity-45">{c.previewLink}</button>}
              </div>}
              <div className="mt-3 flex gap-2">
                {submitted && <button type="button" onClick={() => withdraw(version.id)} disabled={Boolean(busy)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-300/10 px-3 py-2 text-[11px] font-semibold text-amber-100 disabled:opacity-45"><Send size={13} />{c.withdraw}</button>}
                {canSubmit && <button type="button" onClick={() => submit(version.id)} disabled={Boolean(busy)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-cyan-300/10 px-3 py-2 text-[11px] font-semibold text-cyan-100 disabled:opacity-45"><Send size={13} />{c.submit}</button>}
                {canDelete && <button type="button" onClick={() => remove(version.id)} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-[11px] text-white/60 disabled:opacity-45"><Trash2 size={13} />{c.remove}</button>}
              </div>
            </article>;
          })}</div>}
    </section>
  );
}
