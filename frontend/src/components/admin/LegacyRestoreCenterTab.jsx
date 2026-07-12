import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, DatabaseBackup, History, Loader2, RefreshCcw, Search, ShieldCheck, UserRoundCog } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.message || `Error ${response.status}`);
  return data;
}

const fmtMoney = (value) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
const fmtDate = (value) => value ? new Date(value).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "—";

const statusTheme = {
  missing: { label: "Fehlt", fg: "#fb923c", bg: "rgba(249,115,22,0.14)" },
  needs_review: { label: "Review", fg: "#facc15", bg: "rgba(250,204,21,0.12)" },
  restored: { label: "Wiederhergestellt", fg: "#34d399", bg: "rgba(52,211,153,0.14)" },
};

const candidateCategoryTheme = {
  real_customer: { label: "Echter Kunde", fg: "#22c55e", bg: "rgba(34,197,94,0.14)" },
  possible_real_customer: { label: "Möglicher Kunde", fg: "#14b8a6", bg: "rgba(20,184,166,0.14)" },
  review_required: { label: "Review nötig", fg: "#f59e0b", bg: "rgba(245,158,11,0.16)" },
  synthetic_test: { label: "Test/System", fg: "#94a3b8", bg: "rgba(148,163,184,0.14)" },
  attack_trace: { label: "Lockout/Attacke", fg: "#ef4444", bg: "rgba(239,68,68,0.15)" },
};

export const LegacyRestoreCenterTab = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [viewMode, setViewMode] = useState("real_only");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState({
    primary_email: "",
    display_name: "",
    alias_emails: "",
    balance_eur: "0",
    balance_blz: "0",
    registered_at: "",
    source_note: "",
    admin_password: "",
  });
  const [preview, setPreview] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkPassword, setBulkPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const response = await api(`/api/admin/legacy-restore/overview?q=${encodeURIComponent(q)}&view=${encodeURIComponent(viewMode)}`);
      setSummary(response.summary || null);
      setCandidates(response.candidates || []);
      setHistory(response.history || []);
      setSelectedKeys((current) => current.filter((key) => (response.candidates || []).some((candidate) => candidate.candidate_key === key)));
      if (!selectedKey && response.candidates?.length) {
        setSelectedKey(response.candidates[0].candidate_key);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedKey, viewMode]);

  const loadDetail = useCallback(async (candidateKey) => {
    if (!candidateKey) return;
    setDetailLoading(true);
    try {
      const response = await api(`/api/admin/legacy-restore/candidates/${encodeURIComponent(candidateKey)}`);
      const candidate = response.candidate || null;
      setDetail(candidate);
      setForm({
        primary_email: candidate?.primary_email || "",
        display_name: candidate?.display_name || "",
        alias_emails: (candidate?.alias_emails || []).join(", "),
        balance_eur: String(candidate?.balance_eur ?? 0),
        balance_blz: String(candidate?.balance_blz ?? 0),
        registered_at: candidate?.registered_at || "",
        source_note: candidate?.restore_hint || candidate?.source_type || "",
        admin_password: "",
      });
      setPreview(null);
      setBulkPreview(null);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(query), 250);
    return () => clearTimeout(timer);
  }, [query, load, viewMode]);

  useEffect(() => {
    if (selectedKey) loadDetail(selectedKey);
  }, [selectedKey, loadDetail]);

  const selectedTheme = statusTheme[detail?.status || "missing"] || statusTheme.missing;
  const selectedCategoryTheme = candidateCategoryTheme[detail?.candidate_category || "review_required"] || candidateCategoryTheme.review_required;
  const canPreview = useMemo(() => Boolean(selectedKey), [selectedKey]);
  const selectedCount = selectedKeys.length;

  const toggleSelectedKey = (candidateKey) => {
    setSelectedKeys((current) => current.includes(candidateKey)
      ? current.filter((key) => key !== candidateKey)
      : [...current, candidateKey]
    );
  };

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const createPreview = async () => {
    if (!selectedKey) return toast.error("Bitte zuerst einen Kandidaten auswählen.");
    setBusy(true);
    try {
      const response = await api("/api/admin/legacy-restore/preview", {
        method: "POST",
        body: JSON.stringify({
          candidate_key: selectedKey,
          primary_email: form.primary_email,
          display_name: form.display_name,
          alias_emails: form.alias_emails.split(",").map((item) => item.trim()).filter(Boolean),
          balance_eur: Number(form.balance_eur || 0),
          balance_blz: Number(form.balance_blz || 0),
          registered_at: form.registered_at || null,
          source_note: form.source_note || null,
        }),
      });
      setPreview(response.preview || null);
      toast.success(response.message || "Restore-Vorschau erstellt.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmRestore = async () => {
    if (!preview?.restore_ready) return toast.error("Restore ist noch nicht freigegeben.");
    if (!form.admin_password.trim()) return toast.error("Admin-Passwort erforderlich.");
    setBusy(true);
    try {
      const response = await api("/api/admin/legacy-restore/confirm", {
        method: "POST",
        body: JSON.stringify({
          candidate_key: selectedKey,
          primary_email: form.primary_email,
          display_name: form.display_name,
          alias_emails: form.alias_emails.split(",").map((item) => item.trim()).filter(Boolean),
          balance_eur: Number(form.balance_eur || 0),
          balance_blz: Number(form.balance_blz || 0),
          registered_at: form.registered_at || null,
          source_note: form.source_note || null,
          admin_password: form.admin_password,
        }),
      });
      toast.success(`Restore abgeschlossen. Temporäres Passwort: ${response.temporary_password}`);
      setForm((current) => ({ ...current, admin_password: "" }));
      setPreview(null);
      await load(query);
      await loadDetail(selectedKey);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const previewBulkRestore = async () => {
    if (!selectedKeys.length) return toast.error("Bitte mindestens einen Kandidaten markieren.");
    setBusy(true);
    try {
      const response = await api("/api/admin/legacy-restore/bulk-preview", {
        method: "POST",
        body: JSON.stringify({ candidate_keys: selectedKeys }),
      });
      setBulkPreview(response);
      toast.success(`Bulk-Vorschau erstellt: ${response.summary?.restoreable || 0} restorebar.`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmBulkRestore = async () => {
    if (!bulkPreview?.summary?.restoreable) return toast.error("Keine restorebaren Kandidaten in der Bulk-Vorschau.");
    if (!bulkPassword.trim()) return toast.error("Admin-Passwort für Bulk-Restore erforderlich.");
    setBusy(true);
    try {
      const response = await api("/api/admin/legacy-restore/bulk-confirm", {
        method: "POST",
        body: JSON.stringify({ candidate_keys: selectedKeys, admin_password: bulkPassword }),
      });
      toast.success(`Bulk-Restore abgeschlossen: ${response.summary?.restored || 0} Konten wiederhergestellt.`);
      setBulkPassword("");
      setBulkPreview(null);
      setSelectedKeys([]);
      await load(query);
      if (selectedKey) await loadDetail(selectedKey);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="legacy-restore-tab">
      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4" data-testid="legacy-restore-header-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200/75 font-bold">Legacy Restore Center</p>
            <p className="mt-1 text-sm text-white/80">Fehlende Alt-Konten erkennen, Spuren prüfen und kontrolliert wiederherstellen.</p>
          </div>
          <button data-testid="legacy-restore-refresh-button" onClick={() => load(query)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white hover:bg-white/[0.08] flex items-center gap-2">
            <RefreshCcw size={13} /> Neu scannen
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-white/8 bg-black/20 p-3" data-testid="legacy-summary-total"><p className="text-[10px] text-white/35">Kandidaten</p><p className="mt-1 text-lg font-bold text-white">{summary?.total_candidates ?? 0}</p></div>
          <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/5 p-3" data-testid="legacy-summary-visible"><p className="text-[10px] text-cyan-200/60">Sichtbar</p><p className="mt-1 text-lg font-bold text-cyan-300">{summary?.visible_candidates ?? 0}</p></div>
          <div className="rounded-xl border border-orange-400/10 bg-orange-400/5 p-3" data-testid="legacy-summary-missing"><p className="text-[10px] text-orange-200/60">Fehlend</p><p className="mt-1 text-lg font-bold text-orange-300">{summary?.missing_candidates ?? 0}</p></div>
          <div className="rounded-xl border border-yellow-400/10 bg-yellow-400/5 p-3" data-testid="legacy-summary-review"><p className="text-[10px] text-yellow-200/60">Review nötig</p><p className="mt-1 text-lg font-bold text-yellow-300">{summary?.needs_review_candidates ?? 0}</p></div>
          <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-3" data-testid="legacy-summary-restored"><p className="text-[10px] text-emerald-200/60">Wiederhergestellt</p><p className="mt-1 text-lg font-bold text-emerald-300">{summary?.restored_candidates ?? 0}</p></div>
          <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-3" data-testid="legacy-summary-real"><p className="text-[10px] text-emerald-200/60">Echte Kunden</p><p className="mt-1 text-lg font-bold text-emerald-300">{summary?.real_customer_candidates ?? 0}</p></div>
          <div className="rounded-xl border border-fuchsia-400/10 bg-fuchsia-400/5 p-3" data-testid="legacy-summary-last-scan"><p className="text-[10px] text-fuchsia-200/60">Letzter Scan</p><p className="mt-1 text-[11px] font-bold text-fuchsia-200">{fmtDate(summary?.last_scan_at)}</p></div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" data-testid="legacy-view-filter-group">
          {[
            { id: "real_only", label: "Nur echte Kunden" },
            { id: "review", label: "Nur Review-Fälle" },
            { id: "noise_only", label: "Nur Test/Attacke" },
            { id: "all", label: "Alle Spuren" },
          ].map((option) => (
            <button
              key={option.id}
              data-testid={`legacy-view-filter-${option.id}`}
              onClick={() => setViewMode(option.id)}
              className="rounded-full px-3 py-2 text-[11px] font-semibold transition"
              style={{
                background: viewMode === option.id ? "rgba(34,194,255,0.18)" : "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: viewMode === option.id ? "#7dd3fc" : "rgba(255,255,255,0.78)",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-white/50" data-testid="legacy-filter-summary">Ansicht: {summary?.view_mode || viewMode} · sichtbar {summary?.visible_candidates ?? 0} von {summary?.total_candidates ?? 0}</p>

        {summary?.top_candidates?.length ? (
          <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4" data-testid="legacy-top-candidates-card">
            <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-cyan-300" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Prioritätenliste</p></div>
            <p className="mt-2 text-[11px] text-white/50">Oben stehen zuerst die sicheren Screenshot-/Wallet-Treffer. Bereits reparierte Konten bleiben hier sichtbar.</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {summary.top_candidates.map((candidate, index) => (
                <button key={candidate.candidate_key} data-testid={`legacy-top-candidate-${index}`} onClick={() => setSelectedKey(candidate.candidate_key)} className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-left hover:bg-white/[0.06]">
                  <div className="flex items-center justify-between gap-2"><p className="text-[11px] font-semibold text-white truncate">{candidate.display_name}</p><span className="text-[10px] font-bold text-cyan-300">{candidate.priority_rank}</span></div>
                  <p className="mt-1 text-[10px] text-white/45 break-all">{candidate.primary_email || candidate.candidate_key}</p>
                  <p className="mt-2 text-[10px] text-white/65">{candidate.priority_label} · Score {candidate.priority_score} · {candidate.status}</p>
                </button>
              ))}
            </div>
            {summary?.top_missing_candidates?.length ? (
              <div className="mt-4 rounded-xl border border-amber-400/10 bg-amber-400/5 p-3" data-testid="legacy-top-missing-card">
                <p className="text-[10px] uppercase tracking-[0.16em] text-amber-200/70 font-bold">Noch fehlende Kandidaten</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {summary.top_missing_candidates.map((candidate, index) => (
                    <button key={candidate.candidate_key} data-testid={`legacy-top-missing-${index}`} onClick={() => setSelectedKey(candidate.candidate_key)} className="rounded-lg border border-white/8 bg-black/20 p-3 text-left hover:bg-white/[0.06]">
                      <div className="flex items-center justify-between gap-2"><p className="text-[11px] font-semibold text-white truncate">{candidate.display_name}</p><span className="text-[10px] font-bold text-amber-300">{candidate.priority_rank}</span></div>
                      <p className="mt-1 text-[10px] text-white/45 break-all">{candidate.primary_email || candidate.candidate_key}</p>
                      <p className="mt-2 text-[10px] text-white/65">{candidate.priority_label} · Score {candidate.priority_score}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4" data-testid="legacy-bulk-restore-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/75 font-bold">Bulk Restore Workflow</p>
            <p className="mt-1 text-sm text-white/80">Mehrere sichere Kandidaten markieren, gemeinsam prüfen und mit einem Passwort freigeben.</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-white/75" data-testid="legacy-bulk-selected-count">Ausgewählt: <span className="font-bold text-white">{selectedCount}</span></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button data-testid="legacy-bulk-preview-button" onClick={previewBulkRestore} disabled={!selectedCount || busy} className="rounded-xl bg-cyan-400 px-3 py-2 text-[11px] font-bold text-black disabled:opacity-40">{busy ? "Prüft…" : "Bulk-Vorschau"}</button>
          <input data-testid="legacy-bulk-password-input" type="password" value={bulkPassword} onChange={(event) => setBulkPassword(event.target.value)} placeholder="Admin Passwort für Bulk" className="min-w-[240px] flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none" />
          <button data-testid="legacy-bulk-confirm-button" onClick={confirmBulkRestore} disabled={!bulkPreview?.summary?.restoreable || busy} className="rounded-xl bg-emerald-400 px-3 py-2 text-[11px] font-bold text-black disabled:opacity-40">{busy ? "Stellt wieder her…" : "Bulk-Restore bestätigen"}</button>
        </div>
        {bulkPreview ? (
          <div className="mt-3 grid gap-3 xl:grid-cols-2" data-testid="legacy-bulk-preview-card">
            <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-200/70 font-bold">Restorebar ({bulkPreview.summary?.restoreable || 0})</p>
              <div className="mt-2 space-y-2">
                {(bulkPreview.restoreable || []).map((item, index) => (
                  <div key={item.candidate_key} className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-white/80" data-testid={`legacy-bulk-ready-${index}`}>
                    <p className="font-semibold text-white">{item.display_name}</p>
                    <p className="text-[10px] text-white/45">{item.primary_email} · {fmtMoney(item.balance_eur)}€ · {fmtMoney(item.balance_blz)} BLZ</p>
                  </div>
                ))}
                {!bulkPreview.restoreable?.length ? <p className="text-[11px] text-white/40">Keine restorebaren Kandidaten.</p> : null}
              </div>
            </div>
            <div className="rounded-xl border border-amber-400/10 bg-amber-400/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-amber-200/70 font-bold">Blockiert ({bulkPreview.summary?.blocked || 0})</p>
              <div className="mt-2 space-y-2">
                {(bulkPreview.blocked || []).map((item, index) => (
                  <div key={item.candidate_key} className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-white/80" data-testid={`legacy-bulk-blocked-${index}`}>
                    <p className="font-semibold text-white">{item.candidate_key}</p>
                    <p className="text-[10px] text-white/45">{item.reason === "existiert_bereits" ? "Schon vorhanden" : `Fehlende Felder: ${(item.missing_fields || []).join(', ') || 'n/a'}`}</p>
                  </div>
                ))}
                {!bulkPreview.blocked?.length ? <p className="text-[11px] text-white/40">Keine blockierten Kandidaten.</p> : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative" data-testid="legacy-restore-search-wrapper">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          data-testid="legacy-restore-search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nach E-Mail, Alias oder Name suchen"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 py-2.5 text-[12px] text-white outline-none focus:border-[#00C2FF]"
        />
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-white/40" /></div> : null}

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-3" data-testid="legacy-candidate-list">
          {!loading && !candidates.length ? <p className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-[11px] text-white/45">Keine Legacy-Kandidaten gefunden.</p> : null}
          {candidates.map((candidate, index) => {
            const theme = statusTheme[candidate.status] || statusTheme.missing;
            const categoryTheme = candidateCategoryTheme[candidate.candidate_category] || candidateCategoryTheme.review_required;
            const active = candidate.candidate_key === selectedKey;
            return (
              <div
                key={candidate.candidate_key}
                data-testid={`legacy-candidate-card-${index}`}
                className="w-full rounded-2xl border p-4 transition"
                style={{
                  borderColor: active ? theme.fg : "rgba(255,255,255,0.08)",
                  background: active ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => setSelectedKey(candidate.candidate_key)} className="min-w-0 flex-1 text-left" data-testid={`legacy-candidate-open-${index}`}>
                    <p className="text-[12px] font-bold text-white truncate" data-testid={`legacy-candidate-name-${index}`}>{candidate.display_name || candidate.primary_email || candidate.candidate_key}</p>
                    <p className="text-[10px] text-white/45 break-all" data-testid={`legacy-candidate-email-${index}`}>{candidate.primary_email || candidate.candidate_key}</p>
                    {(candidate.alias_emails || []).length ? <p className="mt-1 text-[10px] text-cyan-200/70 break-all">Alias: {candidate.alias_emails.join(", ")}</p> : null}
                  </button>
                  <div className="flex flex-col items-end gap-2">
                    <span data-testid={`legacy-candidate-status-${index}`} className="rounded-full px-2 py-1 text-[10px] font-bold uppercase" style={{ color: theme.fg, background: theme.bg }}>{theme.label}</span>
                    <span data-testid={`legacy-candidate-category-${index}`} className="rounded-full px-2 py-1 text-[10px] font-bold uppercase" style={{ color: categoryTheme.fg, background: categoryTheme.bg }}>{categoryTheme.label}</span>
                    <button data-testid={`legacy-candidate-toggle-${index}`} onClick={() => toggleSelectedKey(candidate.candidate_key)} className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-white/80 hover:bg-white/[0.08]">
                      {selectedKeys.includes(candidate.candidate_key) ? "Ausgewählt" : "Markieren"}
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/70 md:grid-cols-4">
                  <div className="rounded-xl border border-white/8 bg-black/20 p-2" data-testid={`legacy-candidate-eur-${index}`}><p className="text-white/35">EUR</p><p className="mt-1 font-bold text-white">{fmtMoney(candidate.balance_eur)}€</p></div>
                  <div className="rounded-xl border border-white/8 bg-black/20 p-2" data-testid={`legacy-candidate-blz-${index}`}><p className="text-white/35">BLZ</p><p className="mt-1 font-bold text-white">{fmtMoney(candidate.balance_blz)}</p></div>
                  <div className="rounded-xl border border-white/8 bg-black/20 p-2" data-testid={`legacy-candidate-logins-${index}`}><p className="text-white/35">Fehl-Logins</p><p className="mt-1 font-bold text-white">{candidate.failed_login_count || 0}</p></div>
                  <div className="rounded-xl border border-white/8 bg-black/20 p-2" data-testid={`legacy-candidate-evidence-${index}`}><p className="text-white/35">Spuren</p><p className="mt-1 font-bold text-white">{(candidate.evidence || []).length}</p></div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-white/55" data-testid={`legacy-candidate-hint-${index}`}>{candidate.restore_hint} · {candidate.category_reason}</p>
                  <span data-testid={`legacy-candidate-priority-${index}`} className="text-[10px] font-bold text-cyan-300">{candidate.priority_rank} · {candidate.priority_score}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-3" data-testid="legacy-detail-panel">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4" data-testid="legacy-detail-card">
            {detailLoading ? <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-white/40" /></div> : null}
            {!detailLoading && !detail ? <p className="text-[11px] text-white/45">Wähle links einen Kandidaten aus.</p> : null}
            {!detailLoading && detail ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-bold">Legacy Candidate</p>
                    <p className="mt-1 text-lg font-bold text-white" data-testid="legacy-detail-name">{detail.display_name || detail.primary_email || detail.candidate_key}</p>
                    <p className="text-[11px] text-white/50 break-all" data-testid="legacy-detail-email">{detail.primary_email || detail.candidate_key}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span data-testid="legacy-detail-status" className="rounded-full px-3 py-1 text-[10px] font-bold uppercase" style={{ color: selectedTheme.fg, background: selectedTheme.bg }}>{selectedTheme.label}</span>
                    <span data-testid="legacy-detail-category" className="rounded-full px-3 py-1 text-[10px] font-bold uppercase" style={{ color: selectedCategoryTheme.fg, background: selectedCategoryTheme.bg }}>{selectedCategoryTheme.label}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  <div className="rounded-xl border border-white/8 bg-black/20 p-3" data-testid="legacy-detail-balance-card"><p className="text-[10px] text-white/35">Snapshot Werte</p><p className="mt-1 text-[12px] font-bold text-white">{fmtMoney(detail.balance_eur)}€ · {fmtMoney(detail.balance_blz)} BLZ</p><p className="mt-1 text-[10px] text-white/45">Registriert: {fmtDate(detail.registered_at)}</p></div>
                  <div className="rounded-xl border border-white/8 bg-black/20 p-3" data-testid="legacy-detail-state-card"><p className="text-[10px] text-white/35">Aktueller Zustand</p><p className="mt-1 text-[12px] font-bold text-white">{detail.existing_user ? `Aktiver User ${detail.existing_user.email}` : "Noch kein aktiver User"}</p><p className="mt-1 text-[10px] text-white/45">{detail.restore_hint}</p><p className="mt-1 text-[10px] text-white/45">{detail.category_reason}</p></div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4" data-testid="legacy-evidence-list">
                  <div className="flex items-center gap-2"><DatabaseBackup size={14} className="text-cyan-300" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Beweisspuren</p></div>
                  <div className="mt-3 space-y-2">
                    {(detail.evidence || []).map((entry, index) => (
                      <div key={`${entry.source}-${index}`} className="rounded-xl border border-white/8 bg-white/[0.03] p-3" data-testid={`legacy-evidence-item-${index}`}>
                        <div className="flex items-center justify-between gap-2"><p className="text-[11px] font-semibold text-white">{entry.label}</p><span className="text-[10px] text-cyan-200/70">{entry.confidence}%</span></div>
                        <p className="mt-1 text-[10px] text-white/55">{entry.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4" data-testid="legacy-restore-form-card">
                  <div className="flex items-center gap-2"><UserRoundCog size={14} className="text-amber-300" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Controlled Restore</p></div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <input data-testid="legacy-form-email-input" value={form.primary_email} onChange={(event) => updateForm("primary_email", event.target.value)} placeholder="Primäre E-Mail" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none" />
                    <input data-testid="legacy-form-name-input" value={form.display_name} onChange={(event) => updateForm("display_name", event.target.value)} placeholder="Name / Anzeigename" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none" />
                    <input data-testid="legacy-form-aliases-input" value={form.alias_emails} onChange={(event) => updateForm("alias_emails", event.target.value)} placeholder="Alias-E-Mails, kommasepariert" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none" />
                    <input data-testid="legacy-form-registered-input" value={form.registered_at} onChange={(event) => updateForm("registered_at", event.target.value)} placeholder="Registriert am ISO" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none" />
                    <input data-testid="legacy-form-balance-eur-input" value={form.balance_eur} onChange={(event) => updateForm("balance_eur", event.target.value)} placeholder="EUR-Saldo" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none" />
                    <input data-testid="legacy-form-balance-blz-input" value={form.balance_blz} onChange={(event) => updateForm("balance_blz", event.target.value)} placeholder="BLZ-Saldo" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none" />
                  </div>
                  <input data-testid="legacy-form-source-note-input" value={form.source_note} onChange={(event) => updateForm("source_note", event.target.value)} placeholder="Restore-Quelle / Notiz" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button data-testid="legacy-preview-button" onClick={createPreview} disabled={!canPreview || busy} className="rounded-xl bg-amber-300 px-3 py-2 text-[11px] font-bold text-black disabled:opacity-40">{busy ? "Prüft…" : "Restore-Vorschau"}</button>
                    <button data-testid="legacy-reload-detail-button" onClick={() => loadDetail(selectedKey)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white hover:bg-white/[0.08]">Detail neu laden</button>
                  </div>

                  {preview ? (
                    <div className="mt-3 rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4" data-testid="legacy-preview-card">
                      <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-cyan-300" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Restore Preview</p></div>
                      <p className="mt-2 text-[11px] text-white/80" data-testid="legacy-preview-status">{preview.restore_ready ? "Restore ist freigegeben." : `Es fehlen noch: ${(preview.missing_fields || []).join(", ") || "weitere Daten"}`}</p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2 text-[11px] text-white/75">
                        <div className="rounded-xl border border-white/8 bg-black/20 p-3" data-testid="legacy-preview-email">E-Mail: <span className="font-semibold text-white">{preview.primary_email || "—"}</span></div>
                        <div className="rounded-xl border border-white/8 bg-black/20 p-3" data-testid="legacy-preview-password">Temp Passwort: <span className="font-semibold text-white">{preview.temporary_password}</span></div>
                        <div className="rounded-xl border border-white/8 bg-black/20 p-3" data-testid="legacy-preview-eur">EUR: <span className="font-semibold text-white">{fmtMoney(preview.balance_eur)}€</span></div>
                        <div className="rounded-xl border border-white/8 bg-black/20 p-3" data-testid="legacy-preview-blz">BLZ: <span className="font-semibold text-white">{fmtMoney(preview.balance_blz)}</span></div>
                      </div>
                      <input data-testid="legacy-confirm-password-input" type="password" value={form.admin_password} onChange={(event) => updateForm("admin_password", event.target.value)} placeholder="Admin Passwort zur Freigabe" className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none" />
                      <button data-testid="legacy-confirm-button" onClick={confirmRestore} disabled={!preview.restore_ready || busy} className="mt-3 w-full rounded-xl bg-cyan-400 px-3 py-2 text-[11px] font-bold text-black disabled:opacity-40">{busy ? "Stellt wieder her…" : "Restore bestätigen"}</button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4" data-testid="legacy-history-card">
            <div className="flex items-center gap-2"><History size={14} className="text-white/70" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Restore History</p></div>
            <div className="mt-3 space-y-2 max-h-[260px] overflow-y-auto">
              {history.map((item, index) => (
                <div key={`${item.candidate_key}-${index}`} className="rounded-xl border border-white/8 bg-black/20 px-3 py-2" data-testid={`legacy-history-item-${index}`}>
                  <p className="text-[11px] font-semibold text-white">{item.restored_email || item.candidate_key}</p>
                  <p className="text-[10px] text-white/45">{item.action_type} · {item.status}</p>
                  <p className="text-[10px] text-white/35">{item.approved_by || "—"} · {fmtDate(item.created_at)}</p>
                </div>
              ))}
              {!history.length ? <p className="text-[11px] text-white/35">Noch keine Restore-Aktionen protokolliert.</p> : null}
            </div>
            <div className="mt-3 rounded-xl border border-red-400/10 bg-red-400/5 p-3 text-[10px] text-white/65" data-testid="legacy-history-warning">
              <div className="flex items-center gap-2"><AlertTriangle size={12} className="text-red-300" /><span>Restore nur mit Admin-Passwort. Child-only Spuren bleiben read-only, bis genug Daten vorliegen.</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};