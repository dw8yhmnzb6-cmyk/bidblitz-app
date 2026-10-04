import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ExternalLink, FileArchive, Loader2, RefreshCw, Rocket, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { resolveLocale } from "../config/languagePolicy.mjs";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api/admin/game-studio/versions`;
const COPY = {
  de: {
    back: "Zurück", eyebrow: "BIDBLITZ GAMES · ADMIN-PRÜFUNG", title: "Spielversionen prüfen.",
    subtitle: "Archive prüfen und den nächsten Schritt freigeben. Fremder Code wird hier weder ausgeführt noch veröffentlicht.",
    submitted: "Eingereicht", approved: "Archiv akzeptiert", previewApproved: "Preview akzeptiert", changes: "Änderungen erforderlich", rejected: "Abgelehnt",
    empty: "Keine Versionen in diesem Status.", loadError: "Prüfliste konnte nicht geladen werden.", retry: "Neu laden",
    files: "Dateien", packed: "ZIP", unpacked: "entpackt", hash: "SHA-256", note: "Prüfnotiz",
    notePlaceholder: "Begründung für Änderungen oder Ablehnung…", approve: "Archiv akzeptieren",
    requestChanges: "Änderungen verlangen", reject: "Ablehnen", saveError: "Prüfentscheidung konnte nicht gespeichert werden.",
    blocked: "Ausführung bleibt isoliert", game: "Spiel", languages: "Sprachen", category: "Kategorie", prepare: "Vorschau vorbereiten", prepared: "Vorschau vorbereitet", prepareError: "Vorschau konnte nicht vorbereitet werden.", openPreview: "Private Vorschau öffnen", previewError: "Preview-Link konnte nicht erzeugt werden.", approvePreview: "Preview freigeben", publish: "Im Katalog veröffentlichen", rollback: "Diese Version aktivieren", unpublish: "Veröffentlichung stoppen", publishError: "Veröffentlichungsstatus konnte nicht geändert werden.", published: "Veröffentlicht",
  },
  en: {
    back: "Back", eyebrow: "BIDBLITZ GAMES · ADMIN REVIEW", title: "Review game versions.",
    subtitle: "Review archives and advance the workflow. Third-party code is neither executed nor published here.",
    submitted: "Submitted", approved: "Archive approved", previewApproved: "Preview approved", changes: "Changes requested", rejected: "Rejected",
    empty: "No versions in this status.", loadError: "Could not load review queue.", retry: "Reload",
    files: "Files", packed: "ZIP", unpacked: "unpacked", hash: "SHA-256", note: "Review note",
    notePlaceholder: "Reason for changes or rejection…", approve: "Approve archive",
    requestChanges: "Request changes", reject: "Reject", saveError: "Could not save review decision.",
    blocked: "Execution remains isolated", game: "Game", languages: "Languages", category: "Category", prepare: "Prepare preview", prepared: "Preview prepared", prepareError: "Could not prepare preview.", openPreview: "Open private preview", previewError: "Could not create preview link.", approvePreview: "Approve preview", publish: "Publish to catalog", rollback: "Make this version active", unpublish: "Stop publication", publishError: "Could not change publication status.", published: "Published",
  },
  sq: {
    back: "Kthehu", eyebrow: "BIDBLITZ GAMES · KONTROLLI ADMIN", title: "Kontrollo versionet e lojërave.",
    subtitle: "Kontrollo arkivat dhe vazhdo procesin. Kodi i palës së tretë nuk ekzekutohet dhe nuk publikohet këtu.",
    submitted: "Dërguar", approved: "Arkivi u pranua", previewApproved: "Prova u pranua", changes: "Kërkohen ndryshime", rejected: "Refuzuar",
    empty: "Nuk ka versione në këtë status.", loadError: "Lista e kontrollit nuk u ngarkua.", retry: "Ringarko",
    files: "Skedarë", packed: "ZIP", unpacked: "i shpaketuar", hash: "SHA-256", note: "Shënimi i kontrollit",
    notePlaceholder: "Arsyeja për ndryshime ose refuzim…", approve: "Prano arkivin",
    requestChanges: "Kërko ndryshime", reject: "Refuzo", saveError: "Vendimi nuk u ruajt.",
    blocked: "Ekzekutimi mbetet i izoluar", game: "Loja", languages: "Gjuhët", category: "Kategoria", prepare: "Përgatit provën", prepared: "Prova u përgatit", prepareError: "Prova nuk u përgatit.", openPreview: "Hap provën private", previewError: "Linku i provës nuk u krijua.", approvePreview: "Prano provën", publish: "Publiko në katalog", rollback: "Aktivizo këtë version", unpublish: "Ndalo publikimin", publishError: "Statusi i publikimit nuk u ndryshua.", published: "Publikuar",
  },
};

const FILTERS = [
  ["submitted", "submitted"],
  ["archive_approved", "approved"],
  ["preview_approved", "previewApproved"],
  ["changes_requested", "changes"],
  ["rejected", "rejected"],
];

function bytes(value) {
  const n = Number(value || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function read(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Request failed");
  return body;
}

export default function AdminGamesReviewPage({ onBack }) {
  const { lang } = useI18n();
  const locale = resolveLocale(lang, Object.keys(COPY));
  const c = COPY[locale];
  const [status, setStatus] = useState("submitted");
  const [versions, setVersions] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [previewLinks, setPreviewLinks] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${API}?review_status=${encodeURIComponent(status)}&limit=100`, { credentials: "include" });
      const body = await read(response);
      setVersions(Array.isArray(body.versions) ? body.versions : []);
    } catch (loadError) {
      setError(loadError?.message || c.loadError);
    } finally {
      setLoading(false);
    }
  }, [status, c.loadError]);

  useEffect(() => { load(); }, [load]);

  const prepare = async (versionId) => {
    setBusy(versionId); setError("");
    try {
      const response = await fetch(`${API}/${encodeURIComponent(versionId)}/prepare-preview`, {
        method: "POST", credentials: "include",
      });
      await read(response);
      await load();
    } catch (prepareError) {
      setError(prepareError?.message || c.prepareError);
    } finally {
      setBusy("");
    }
  };

  const openPrivatePreview = async (versionId) => {
    setBusy(versionId); setError("");
    try {
      const response = await fetch(`${API}/${encodeURIComponent(versionId)}/preview-link`, {
        method: "POST", credentials: "include",
      });
      const body = await read(response);
      if (!body.url) throw new Error(c.previewError);
      setPreviewLinks((current) => ({ ...current, [versionId]: body.url }));
      const opened = window.open(body.url, "_blank", "noopener,noreferrer");
      if (opened) opened.opener = null;
    } catch (previewError) {
      setError(previewError?.message || c.previewError);
    } finally {
      setBusy("");
    }
  };

  const changePublication = async (version, action) => {
    setBusy(version.id); setError("");
    try {
      let url;
      if (action === "publish") url = `${API}/${encodeURIComponent(version.id)}/publish`;
      else if (action === "rollback") url = `${process.env.REACT_APP_BACKEND_URL || ""}/api/admin/game-studio/games/${encodeURIComponent(version.draft_id)}/rollback/${encodeURIComponent(version.id)}`;
      else url = `${process.env.REACT_APP_BACKEND_URL || ""}/api/admin/game-studio/games/${encodeURIComponent(version.draft_id)}/unpublish`;
      const response = await fetch(url, { method: "POST", credentials: "include" });
      await read(response);
      await load();
    } catch (publishError) {
      setError(publishError?.message || c.publishError);
    } finally {
      setBusy("");
    }
  };

  const decide = async (versionId, action) => {
    const note = (notes[versionId] || "").trim();
    if ((action === "request_changes" || action === "reject") && note.length < 5) {
      setError(c.notePlaceholder); return;
    }
    setBusy(versionId); setError("");
    try {
      const response = await fetch(`${API}/${encodeURIComponent(versionId)}/review`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      await read(response);
      setNotes((current) => ({ ...current, [versionId]: "" }));
      await load();
    } catch (saveError) {
      setError(saveError?.message || c.saveError);
    } finally {
      setBusy("");
    }
  };

  return (
    <main lang={locale} className="min-h-screen bg-[#061329] pb-24 text-white" data-testid="admin-games-review-page">
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-7">
        <header className="flex items-center justify-between gap-3">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"><ArrowLeft size={17} />{c.back}</button>
          <div className="flex items-center gap-2 text-sm font-black tracking-[.15em]"><span className="rounded-xl bg-cyan-300 px-2 py-1 text-[#061329]">B</span>BIDBLITZ <span className="text-cyan-300">GAMES</span></div>
        </header>

        <section className="mt-8 rounded-[30px] border border-cyan-200/15 bg-gradient-to-br from-[#113d73] via-[#14294c] to-[#091c35] p-6 sm:p-9">
          <p className="text-[11px] font-bold tracking-[.2em] text-cyan-200">{c.eyebrow}</p>
          <h1 className="mt-4 text-3xl font-black sm:text-5xl">{c.title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-sky-100/70 sm:text-base">{c.subtitle}</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/5 px-4 py-2 text-xs text-amber-100"><ShieldCheck size={15} />{c.blocked}</div>
        </section>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {FILTERS.map(([value, key]) => <button key={value} onClick={() => setStatus(value)} aria-pressed={status === value} className={`rounded-full border px-4 py-2 text-sm font-semibold ${status === value ? "border-cyan-300 bg-cyan-300 text-[#061329]" : "border-white/15 bg-white/5 text-white/70"}`}>{c[key]}</button>)}
          <button onClick={load} disabled={loading} className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""} />{c.retry}</button>
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-300/25 bg-rose-400/10 p-4 text-sm text-rose-100">{error}</p>}

        {loading ? <div className="mt-8 flex items-center gap-3 text-white/60"><Loader2 size={20} className="animate-spin" />{c.submitted}…</div>
          : versions.length === 0 ? <div className="mt-6 rounded-3xl border border-dashed border-white/15 px-6 py-12 text-center text-white/50">{c.empty}</div>
            : <div className="mt-6 grid gap-5 lg:grid-cols-2">{versions.map((version) => {
              const game = version.game || {};
              const pending = status === "submitted";
              const archiveApproved = status === "archive_approved";
              const previewApproved = status === "preview_approved";
              return <article key={version.id} className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#15345a] to-[#0b1e37] p-5 shadow-xl">
                <div className="flex items-start gap-4"><div className="rounded-2xl bg-cyan-300/10 p-4 text-cyan-200"><FileArchive size={30} /></div><div className="min-w-0"><p className="text-xs uppercase tracking-wider text-cyan-200">{c.game}</p><h2 className="truncate text-xl font-bold">{game.title || version.draft_id}</h2><p className="mt-1 text-xs text-white/45">{c.category}: {game.category || "—"} · {c.languages}: {(game.languages || []).length}</p></div></div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-xs text-white/55 sm:grid-cols-4"><div><b className="block text-white/85">{version.file_count || 0}</b>{c.files}</div><div><b className="block text-white/85">{bytes(version.archive_bytes)}</b>{c.packed}</div><div><b className="block text-white/85">{bytes(version.unpacked_bytes)}</b>{c.unpacked}</div><div><b className="block truncate text-white/85">{String(version.sha256 || "").slice(0, 10)}…</b>{c.hash}</div></div>
                {pending && <><label className="mt-5 block text-xs font-semibold text-white/70">{c.note}<textarea value={notes[version.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [version.id]: event.target.value }))} maxLength={1000} rows={3} placeholder={c.notePlaceholder} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#06182d] p-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60" /></label><div className="mt-4 grid gap-2 sm:grid-cols-3"><button onClick={() => decide(version.id, "approve_archive")} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-300 px-3 py-2 text-xs font-bold text-[#06231c] disabled:opacity-50"><CheckCircle2 size={15} />{c.approve}</button><button onClick={() => decide(version.id, "request_changes")} disabled={Boolean(busy)} className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-50">{c.requestChanges}</button><button onClick={() => decide(version.id, "reject")} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-100 disabled:opacity-50"><XCircle size={15} />{c.reject}</button></div></>}
                {!pending && version.review_note && <p className="mt-5 rounded-xl border border-white/10 bg-white/[.03] p-3 text-xs leading-relaxed text-white/60">{version.review_note}</p>}
                {archiveApproved && <>
                  <button onClick={() => prepare(version.id)} disabled={Boolean(busy) || version.preview_status === "prepared"} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-xs font-semibold text-cyan-100 disabled:opacity-50"><ShieldCheck size={15} />{version.preview_status === "prepared" ? c.prepared : c.prepare}</button>
                  {version.preview_status === "prepared" && <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <button onClick={() => openPrivatePreview(version.id)} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-semibold text-white/80 disabled:opacity-50"><ExternalLink size={15} />{c.openPreview}</button>
                    <button onClick={() => decide(version.id, "approve_preview")} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-3 text-xs font-bold text-[#06231c] disabled:opacity-50"><CheckCircle2 size={15} />{c.approvePreview}</button>
                  </div>}
                  {version.preview_status === "prepared" && <><label className="mt-3 block text-xs font-semibold text-white/70">{c.note}<textarea value={notes[version.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [version.id]: event.target.value }))} maxLength={1000} rows={2} placeholder={c.notePlaceholder} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#06182d] p-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60" /></label><div className="mt-2 grid gap-2 sm:grid-cols-2"><button onClick={() => decide(version.id, "request_changes")} disabled={Boolean(busy)} className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-50">{c.requestChanges}</button><button onClick={() => decide(version.id, "reject")} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-100 disabled:opacity-50"><XCircle size={15} />{c.reject}</button></div></>}
                </>}
                {previewApproved && <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-xs text-emerald-100"><CheckCircle2 size={14} />{version.publication_status === "published" ? c.published : c.previewApproved}</div>
                  {version.publication_status === "published"
                    ? <button onClick={() => changePublication(version, "unpublish")} disabled={Boolean(busy)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-xs font-semibold text-rose-100 disabled:opacity-50"><XCircle size={15} />{c.unpublish}</button>
                    : <button onClick={() => changePublication(version, version.publication_status === "inactive" ? "rollback" : "publish")} disabled={Boolean(busy)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-xs font-bold text-[#061329] disabled:opacity-50">{version.publication_status === "inactive" ? <RotateCcw size={15} /> : <Rocket size={15} />}{version.publication_status === "inactive" ? c.rollback : c.publish}</button>}
                </div>}
              </article>;
            })}</div>}
      </div>
    </main>
  );
}
