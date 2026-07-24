/**
 * BidBlitz — KYC Verification Flow
 * 4-stage wizard: Start → Upload → Review → Status
 * Wraps the existing backend /api/kyc/* endpoints (single-shot multipart submit).
 */
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Shield, Upload, Camera, CheckCircle2, XCircle, Clock,
  Loader2, AlertCircle, Image as ImageIcon, ChevronRight, RefreshCw,
  CreditCard, FileText, User, Calendar, Globe, Hash,
} from "lucide-react";
import { KYC_ACCEPT_ATTR, getKycImageValidationMessage, isAlreadySubmittedKycError, isSupportedKycImage } from "../utils/kycUpload";
import { KYCImageIssueGrid, buildKycSlotFeedback } from "../components/KYCImageIssueGrid";
import { inspectKycImage } from "../utils/kycImageInspector";

const API = process.env.REACT_APP_BACKEND_URL;

async function logKycSubmissionIssue(payload) {
  if (!API) return;
  try {
    await fetch(`${API}/api/monitoring/log-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn("[KYCFlow] Monitoring logging failed", error);
  }
}

function normalizeSubmitError(detail) {
  if (detail && typeof detail === "object" && detail.detail) {
    return normalizeSubmitError(detail.detail);
  }
  if (detail && Array.isArray(detail.user_feedback) && detail.user_feedback.length) {
    return detail.user_feedback.filter(Boolean).join(" ");
  }
  if (detail && detail.detail && Array.isArray(detail.detail.user_feedback) && detail.detail.user_feedback.length) {
    return detail.detail.user_feedback.filter(Boolean).join(" ");
  }
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => {
      const loc = Array.isArray(item?.loc) ? item.loc.join(".") : "";
      const msg = item?.msg || item?.message || "Ungültige Eingabe";
      if (loc.includes("id_front")) return "Bitte lade die Vorderseite deines Ausweises hoch.";
      if (loc.includes("id_back")) return "Bitte lade die Rückseite deines Ausweises hoch.";
      if (loc.includes("selfie")) return "Bitte lade dein Selfie mit Ausweis hoch.";
      if (loc.includes("document_type")) return "Bitte wähle eine gültige Ausweisart.";
      return msg;
    }).join(" ");
  }
  if (detail && typeof detail.message === "string") return detail.message;
  if (detail && typeof detail.msg === "string") return detail.msg;
  if (detail && typeof detail.error === "string") return detail.error;
  return "Die Verifizierung konnte gerade nicht verarbeitet werden. Bitte prüfe deine Angaben und versuche es erneut.";
}

function extractSubmitFeedback(detail) {
  if (!detail) return [];
  if (detail?.detail) return extractSubmitFeedback(detail.detail);
  if (Array.isArray(detail?.user_feedback)) return detail.user_feedback.filter(Boolean);
  if (Array.isArray(detail?.detail?.user_feedback)) return detail.detail.user_feedback.filter(Boolean);
  if (typeof detail === "string") return [detail];
  if (typeof detail?.message === "string") return [detail.message];
  if (typeof detail?.detail === "string") return [detail.detail];
  return [];
}

function buildSubmitProblem(detail, fallbackMessage) {
  const messages = extractSubmitFeedback(detail);
  const primaryMessage = normalizeSubmitError(detail) || fallbackMessage;
  const dedupedMessages = messages.length ? [...new Set(messages)] : [primaryMessage];
  return {
    primaryMessage,
    messages: dedupedMessages,
    incidentCode: detail?.incident_code || detail?.detail?.incident_code || "",
    supportHint: detail?.support_hint || detail?.detail?.support_hint || "",
    failureReasons: detail?.failure_reasons || detail?.detail?.failure_reasons || [],
    failedAttempts: Number(detail?.failed_attempts || detail?.detail?.failed_attempts || 0),
    canRequestManualReview: Boolean(detail?.can_request_manual_review || detail?.detail?.can_request_manual_review),
    retryable: Boolean(detail?.retryable || detail?.detail?.retryable),
  };
}

const PREVIEW_OVERLAY_STYLES = {
  error: { bg: "rgba(255,71,87,0.90)", text: "#fff", label: "Fehler" },
  warning: { bg: "rgba(255,184,0,0.92)", text: "#111", label: "Hinweis" },
  ok: { bg: "rgba(0,210,106,0.90)", text: "#04110A", label: "OK" },
};

function getPreviewOverlayMeta({ hasPreview, warnings = [], feedbackMessages = [], slotTone = "ok" }) {
  if (!hasPreview) return null;
  if (feedbackMessages.length) {
    return slotTone === "error" ? PREVIEW_OVERLAY_STYLES.error : PREVIEW_OVERLAY_STYLES.ok;
  }
  return warnings.length ? PREVIEW_OVERLAY_STYLES.warning : PREVIEW_OVERLAY_STYLES.ok;
}

// ── Country list (most common — ISO 2 + label) ──
const COUNTRIES = [
  { code: "DE", label: "Deutschland" },
  { code: "AT", label: "Österreich" },
  { code: "CH", label: "Schweiz" },
  { code: "FR", label: "Frankreich" },
  { code: "IT", label: "Italien" },
  { code: "ES", label: "Spanien" },
  { code: "NL", label: "Niederlande" },
  { code: "BE", label: "Belgien" },
  { code: "GB", label: "Vereinigtes Königreich" },
  { code: "US", label: "USA" },
  { code: "AE", label: "VAE" },
  { code: "PL", label: "Polen" },
  { code: "TR", label: "Türkei" },
  { code: "AL", label: "Albanien" },
  { code: "XK", label: "Kosovo" },
];

// ────────────────────────────────────────────────────────────────────────
// Main component — orchestrates the 4 stages
// ────────────────────────────────────────────────────────────────────────
export default function KYCFlow({ onBack, onComplete }) {
  const [stage, setStage] = useState("loading"); // loading|start|upload|review|status
  const [statusData, setStatusData] = useState(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    country: "DE",
    id_type: "national_id",  // backend allowed: national_id | passport | driver_license
    id_number: "",
    address: "",
  });
  const [files, setFiles] = useState({ front: null, back: null, selfie: null });
  const [previews, setPreviews] = useState({ front: null, back: null, selfie: null });
  const [submitting, setSubmitting] = useState(false);
  const [manualReviewSubmitting, setManualReviewSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState(null);
  const [liveWarnings, setLiveWarnings] = useState({ front: [], back: [], selfie: [] });

  // On mount, load existing KYC status — show status page if already submitted
  useEffect(() => { loadStatus(); }, []);

  const loadStatus = async () => {
    try {
      const r = await fetch(`${API}/api/kyc/status`, { credentials: "include" });
      if (!r.ok) {
        setStage("start");
        return;
      }
      const d = await r.json();
      setStatusData(d);
      // Already done? show status. Otherwise start
      if (["approved", "pending", "rejected"].includes(d.kyc_status)) {
        setStage("status");
      } else {
        setStage("start");
      }
    } catch {
      setStage("start");
    }
  };

  const onFileSelect = (slot) => async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError("Datei zu groß (max. 10 MB)");
      return;
    }
    if (!isSupportedKycImage(f)) {
      setError(getKycImageValidationMessage());
      return;
    }
    setError(null);
    setReviewFeedback(null);
    setFiles((p) => ({ ...p, [slot]: f }));
    const url = URL.createObjectURL(f);
    setPreviews((p) => ({ ...p, [slot]: url }));
    const warnings = await inspectKycImage(f);
    setLiveWarnings((prev) => ({ ...prev, [slot]: warnings }));
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setReviewFeedback(null);
    try {
      const fd = new FormData();
      fd.append("id_front", files.front);
      fd.append("id_back", files.back);
      fd.append("selfie", files.selfie);
      fd.append("document_type", form.id_type);
      // Pass extra metadata as fields the backend accepts (or stores in user doc later)
      fd.append("first_name", form.first_name);
      fd.append("last_name", form.last_name);
      fd.append("date_of_birth", form.date_of_birth);
      fd.append("country", form.country);
      fd.append("id_number", form.id_number);
      fd.append("address", form.address);

      const r = await fetch(`${API}/api/kyc/submit`, {
        method: "POST", credentials: "include", body: fd,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const payload = d.detail || d.message || d;
        const submitProblem = buildSubmitProblem(payload, "Die Verifizierung konnte gerade nicht verarbeitet werden. Bitte versuche es erneut.");
        const errMsg = submitProblem.primaryMessage;
        if (isAlreadySubmittedKycError(errMsg)) {
          await loadStatus();
          setSubmitting(false);
          return;
        }
        await logKycSubmissionIssue({
          message: errMsg,
          page: "/kyc/review",
          level: "error",
          meta: {
            flow: "kyc_submit",
            status: r.status,
            incident_code: submitProblem.incidentCode,
            retryable: submitProblem.retryable,
          },
        });
        setReviewFeedback({
          messages: submitProblem.messages,
          failedAttempts: submitProblem.failedAttempts,
          canRequestManualReview: submitProblem.canRequestManualReview,
          failureReasons: submitProblem.failureReasons,
          incidentCode: submitProblem.incidentCode,
          supportHint: submitProblem.supportHint,
        });
        setError(errMsg);
        setSubmitting(false);
        return;
      }
      if (d?.status === "rejected") {
        const submitProblem = buildSubmitProblem(d, "Bitte korrigiere die markierten Punkte und sende die Bilder erneut.");
        setReviewFeedback({
          messages: submitProblem.messages,
          failedAttempts: submitProblem.failedAttempts,
          canRequestManualReview: submitProblem.canRequestManualReview,
          failureReasons: submitProblem.failureReasons,
          incidentCode: submitProblem.incidentCode,
          supportHint: submitProblem.supportHint,
        });
        setError(submitProblem.primaryMessage);
        setSubmitting(false);
        return;
      }
      if (d?.status === "pending") {
        setError(null);
      }
      // Refresh status page
      await loadStatus();
      onComplete?.();
    } catch (e) {
      const fallback = "Netzwerkfehler bei der Übermittlung. Bitte Verbindung prüfen und erneut versuchen.";
      setReviewFeedback({
        messages: [fallback],
        failedAttempts: 0,
        canRequestManualReview: false,
        failureReasons: [],
        incidentCode: "",
        supportHint: "Wenn das Problem bestehen bleibt, versuche es bitte später erneut.",
      });
      setError(fallback);
    }
    setSubmitting(false);
  };

  const requestManualReview = async () => {
    setManualReviewSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/kyc/manual-review/request`, {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(normalizeSubmitError(d.detail || d.message));
        setManualReviewSubmitting(false);
        return;
      }
      await loadStatus();
    } catch {
      setError("Manuelle Prüfung konnte gerade nicht angefordert werden.");
    }
    setManualReviewSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white" data-testid="kyc-flow">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <motion.button
          data-testid="kyc-back"
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
          <ArrowLeft size={16} />
        </motion.button>
        <div className="flex items-center gap-2 flex-1">
          <Shield size={18} className="text-[#00C2FF]" />
          <h1 className="text-base font-bold">KYC Verifizierung</h1>
        </div>
        {stage !== "status" && stage !== "loading" && (
          <span className="text-[10px] text-white/40 font-medium">
            {stage === "start" ? "1/3" : stage === "upload" ? "2/3" : "3/3"}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {stage === "loading" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" />
          </motion.div>
        )}

        {stage === "start" && (
          <KYCStartPage key="start" onStart={() => setStage("upload")} />
        )}

        {stage === "upload" && (
          <KYCUploadPage
            key="upload"
            form={form}
            setForm={setForm}
            files={files}
            previews={previews}
            liveWarnings={liveWarnings}
            onFileSelect={onFileSelect}
            error={error}
            setError={setError}
            onContinue={() => {
              // Validate
              if (!form.first_name || !form.last_name || !form.date_of_birth ||
                  !form.country || !form.id_type || !form.id_number) {
                setError("Bitte alle Felder ausfüllen");
                return;
              }
              if (!files.front || !files.back || !files.selfie) {
                setError("Bitte alle 3 Fotos hochladen");
                return;
              }
              setError(null);
              setStage("review");
            }}
          />
        )}

        {stage === "review" && (
          <KYCReviewPage
            key="review"
            form={form}
            previews={previews}
          liveWarnings={liveWarnings}
            submitting={submitting}
            error={error}
          reviewFeedback={reviewFeedback}
            onBack={() => setStage("upload")}
            onSubmit={submit}
          onRequestManualReview={requestManualReview}
          manualReviewSubmitting={manualReviewSubmitting}
          />
        )}

        {stage === "status" && (
          <KYCStatusPage
            key="status"
            status={statusData}
            onRetry={() => { setStatusData(null); setStage("start"); }}
            onBack={onBack}
            onRequestManualReview={requestManualReview}
            manualReviewSubmitting={manualReviewSubmitting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Stage 1 — Start Page
// ────────────────────────────────────────────────────────────────────────
function KYCStartPage({ onStart }) {
  return (
    <motion.div data-testid="kyc-start-page"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="p-5 max-w-md mx-auto pb-24">
      <div className="text-center mb-7">
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-20 h-20 mx-auto mb-5 rounded-3xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(0,194,255,0.15) 0%, rgba(168,85,247,0.15) 100%)",
            border: "1px solid rgba(0,194,255,0.20)",
          }}>
          <Shield size={36} className="text-[#00C2FF]" />
        </motion.div>
        <h2 className="text-2xl font-bold mb-2">Identität verifizieren</h2>
        <p className="text-sm text-white/50 leading-relaxed">
          Schalte Karten, hohe Limits und alle Premium-Features frei.
          Dauert weniger als 3 Minuten.
        </p>
      </div>

      <div className="space-y-3 mb-7">
        {[
          { icon: CreditCard, label: "Virtuelle Debit-Karten erstellen", color: "#00C2FF" },
          { icon: Shield, label: "Höhere Wallet-Limits (bis 50.000 €/Tag)", color: "#A855F7" },
          { icon: CheckCircle2, label: "Stripe Issuing & Crypto-Funktionen", color: "#00D26A" },
        ].map((b, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.07 }}
            className="flex items-center gap-3 p-3 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${b.color}15`, border: `1px solid ${b.color}25` }}>
              <b.icon size={16} style={{ color: b.color }} />
            </div>
            <span className="text-sm text-white/80 font-medium">{b.label}</span>
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl p-4 mb-5" style={{ background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.15)" }}>
        <p className="text-xs text-[#FFB800] font-semibold mb-1">Was du brauchst:</p>
        <ul className="text-xs text-white/60 space-y-1 leading-relaxed">
          <li>• Personalausweis oder Reisepass (Vorder- + Rückseite)</li>
          <li>• Selfie mit Ausweis in der Hand</li>
          <li>• Gute Beleuchtung, keine Spiegelungen</li>
        </ul>
      </div>

      <motion.button
        data-testid="kyc-start-btn"
        whileTap={{ scale: 0.97 }}
        onClick={onStart}
        className="w-full py-4 rounded-2xl bg-[#00C2FF] text-black font-bold flex items-center justify-center gap-2"
        style={{ boxShadow: "0 8px 32px rgba(0,194,255,0.35)" }}>
        Verifizierung starten
        <ChevronRight size={18} />
      </motion.button>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Stage 2 — Upload Page (form + 3 file uploads)
// ────────────────────────────────────────────────────────────────────────
function KYCFormField({ form, setForm, label, icon: Icon, name, type = "text", placeholder, options }) {
  return (
  <div className="mb-3">
    <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1.5 flex items-center gap-1.5">
      <Icon size={10} /> {label}
    </label>
    {options ? (
      <select
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        data-testid={`kyc-input-${name}`}
        className="w-full px-3.5 py-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-[#00C2FF] outline-none">
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#0a0a0f]">{o.label}</option>
        ))}
      </select>
    ) : (
      <input
        type={type}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        placeholder={placeholder}
        data-testid={`kyc-input-${name}`}
        className="w-full px-3.5 py-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-[#00C2FF] outline-none placeholder:text-white/25"
      />
    )}
  </div>
  );
}

function KYCUploadPage({ form, setForm, files, previews, liveWarnings, onFileSelect, error, setError, onContinue }) {

  return (
    <motion.div data-testid="kyc-upload-page"
      initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
      className="p-5 max-w-md mx-auto pb-32">
      <h2 className="text-xl font-bold mb-1">Persönliche Daten</h2>
      <p className="text-xs text-white/45 mb-5">Genau wie auf deinem Ausweis.</p>

      {/* Personal info */}
      <div className="grid grid-cols-2 gap-2.5">
        <KYCFormField form={form} setForm={setForm} label="Vorname" icon={User} name="first_name" placeholder="Max" />
        <KYCFormField form={form} setForm={setForm} label="Nachname" icon={User} name="last_name" placeholder="Mustermann" />
      </div>
      <KYCFormField form={form} setForm={setForm} label="Geburtsdatum" icon={Calendar} name="date_of_birth" type="date" />
      <KYCFormField form={form} setForm={setForm} label="Land" icon={Globe} name="country"
        options={COUNTRIES.map((c) => ({ value: c.code, label: c.label }))} />

      <KYCFormField form={form} setForm={setForm} label="Ausweisart" icon={FileText} name="id_type"
        options={[
          { value: "national_id", label: "Personalausweis" },
          { value: "passport", label: "Reisepass" },
          { value: "driver_license", label: "Führerschein" },
        ]} />
      <KYCFormField form={form} setForm={setForm} label="Ausweis-Nummer" icon={Hash} name="id_number" placeholder="LX12345678" />
      <KYCFormField form={form} setForm={setForm} label="Adresse (optional)" icon={Globe} name="address" placeholder="Straße, PLZ Ort" />

      {/* Document Uploads */}
      <h3 className="text-sm font-bold mt-6 mb-3 flex items-center gap-2">
        <Camera size={14} className="text-[#00C2FF]" /> Foto-Upload
      </h3>

      {[
        { slot: "front", label: "Ausweis Vorderseite", icon: FileText },
        { slot: "back", label: "Ausweis Rückseite", icon: FileText },
        { slot: "selfie", label: "Selfie mit Ausweis in der Hand", icon: Camera },
      ].map(({ slot, label, icon: Icon }) => (
        <FileUpload
          key={slot} slot={slot} label={label} Icon={Icon}
          file={files[slot]} preview={previews[slot]}
          warnings={liveWarnings?.[slot] || []}
          onChange={onFileSelect(slot)}
        />
      ))}

      {error && (
        <div data-testid="kyc-upload-error"
          className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mt-4">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      <motion.button
        data-testid="kyc-continue-btn"
        whileTap={{ scale: 0.97 }}
        onClick={onContinue}
        className="w-full py-4 rounded-2xl bg-[#00C2FF] text-black font-bold flex items-center justify-center gap-2 mt-6"
        style={{ boxShadow: "0 8px 32px rgba(0,194,255,0.35)" }}>
        Weiter zur Überprüfung
        <ChevronRight size={18} />
      </motion.button>
    </motion.div>
  );
}

function FileUpload({ slot, label, Icon, file, preview, warnings, onChange }) {
  const inputRef = useRef(null);
  const overlayMeta = getPreviewOverlayMeta({ hasPreview: !!preview, warnings });
  return (
    <div className="mb-3">
      <input ref={inputRef} type="file" accept={KYC_ACCEPT_ATTR}
        onChange={onChange} className="hidden"
        data-testid={`kyc-file-input-${slot}`} />
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={() => inputRef.current?.click()}
        data-testid={`kyc-upload-${slot}`}
        className="w-full rounded-2xl overflow-hidden relative group"
        style={{
          background: preview ? "transparent" : "rgba(255,255,255,0.025)",
          border: preview ? "2px solid rgba(0,194,255,0.40)" : "2px dashed rgba(255,255,255,0.12)",
          minHeight: "100px",
        }}>
        {preview ? (
          <div className="relative">
            <img src={preview} alt={label} className="w-full max-h-44 object-cover" />
            {overlayMeta && (
              <div
                className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-lg"
                style={{ background: overlayMeta.bg, color: overlayMeta.text }}
                data-testid={`kyc-preview-overlay-${slot}`}
              >
                {overlayMeta.label}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-3">
              <div className="flex items-center gap-2 text-white">
                <CheckCircle2 size={14} className="text-[#00D26A]" />
                <span className="text-xs font-semibold">{label}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(0,194,255,0.10)", border: "1px solid rgba(0,194,255,0.20)" }}>
              <Icon size={20} className="text-[#00C2FF]" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-white/90">{label}</p>
              <p className="text-[10px] text-white/40">Tap zum Hochladen · max 10 MB</p>
            </div>
            <Upload size={14} className="text-white/40" />
          </div>
        )}
      </motion.button>
      {!!warnings?.length && (
        <div className="mt-2 rounded-xl border border-amber-400/20 bg-amber-300/10 px-3 py-2" data-testid={`kyc-live-warning-${slot}`}>
          <p className="text-[10px] font-semibold text-amber-200">Sofort-Hinweis vor dem Absenden</p>
          <ul className="mt-1 space-y-1">
            {warnings.map((warning, index) => (
              <li key={`${slot}-warning-${index}`} className="text-[10px] text-amber-100/85">• {warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Stage 3 — Review Page
// ────────────────────────────────────────────────────────────────────────
function KYCReviewRow({ label, value }) {
  return (
  <div className="flex justify-between py-2.5 border-b border-white/5">
    <span className="text-xs text-white/40">{label}</span>
    <span className="text-xs text-white/90 font-semibold text-right max-w-[60%] break-words">{value || "—"}</span>
  </div>
  );
}

function KYCReviewPage({ form, previews, liveWarnings, submitting, error, reviewFeedback, onBack, onSubmit, onRequestManualReview, manualReviewSubmitting }) {
  const country = COUNTRIES.find((c) => c.code === form.country)?.label || form.country;
  const idType = { national_id: "Personalausweis", passport: "Reisepass", driver_license: "Führerschein" }[form.id_type] || form.id_type;
  const feedbackMessages = Array.isArray(reviewFeedback?.messages) ? reviewFeedback.messages.filter(Boolean) : [];
  const canRequestManualReview = !!reviewFeedback?.canRequestManualReview;
  const failedAttempts = Number(reviewFeedback?.failedAttempts || 0);
  const incidentCode = reviewFeedback?.incidentCode || "";
  const supportHint = reviewFeedback?.supportHint || "";
  const slotFeedback = buildKycSlotFeedback(reviewFeedback?.failureReasons || [], feedbackMessages);
  const slotFeedbackMap = Object.fromEntries(slotFeedback.map((item) => [item.id, item]));

  return (
    <motion.div data-testid="kyc-review-page"
      initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
      className="p-5 max-w-md mx-auto pb-32">
      <h2 className="text-xl font-bold mb-1">Daten prüfen</h2>
      <p className="text-xs text-white/45 mb-5">Letzter Schritt — alles korrekt?</p>

      <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <KYCReviewRow label="Vorname" value={form.first_name} />
        <KYCReviewRow label="Nachname" value={form.last_name} />
        <KYCReviewRow label="Geburtsdatum" value={form.date_of_birth} />
        <KYCReviewRow label="Land" value={country} />
        <KYCReviewRow label="Ausweisart" value={idType} />
        <KYCReviewRow label="Ausweis-Nr." value={form.id_number} />
        {form.address && <KYCReviewRow label="Adresse" value={form.address} />}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {["front", "back", "selfie"].map((slot) => {
          const overlayMeta = getPreviewOverlayMeta({
            hasPreview: !!previews[slot],
            warnings: liveWarnings?.[slot] || [],
            feedbackMessages,
            slotTone: slotFeedbackMap[slot]?.tone,
          });
          return (
            <div
              key={slot}
              className="rounded-xl overflow-hidden aspect-square relative"
              style={{
                border: feedbackMessages.length > 0
                  ? `2px solid ${slotFeedbackMap[slot]?.tone === "error" ? "rgba(255,71,87,0.45)" : "rgba(0,210,106,0.30)"}`
                  : `2px solid ${(liveWarnings?.[slot] || []).length ? "rgba(255,184,0,0.35)" : "rgba(0,210,106,0.25)"}`,
              }}
            >
              {previews[slot] ? (
                <img src={previews[slot]} alt={slot} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5">
                  <ImageIcon size={20} className="text-white/30" />
                </div>
              )}
              {overlayMeta && (
                <div
                  className="absolute right-2 top-2 rounded-full px-2 py-1 text-[9px] font-bold shadow-lg"
                  style={{ background: overlayMeta.bg, color: overlayMeta.text }}
                  data-testid={`kyc-review-preview-overlay-${slot}`}
                >
                  {overlayMeta.label}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl p-3 mb-4" style={{ background: "rgba(0,194,255,0.06)", border: "1px solid rgba(0,194,255,0.15)" }}>
        <p className="text-xs text-[#00C2FF] leading-relaxed">
          Mit dem Absenden bestätigst du, dass die Angaben korrekt sind. Wir prüfen
          deine Identität automatisch via KI — Ergebnis innerhalb weniger Minuten.
        </p>
      </div>

      {error && (
        <div data-testid="kyc-review-error"
          className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {feedbackMessages.length > 0 && (
        <div className="mb-4">
          <KYCImageIssueGrid
            failureReasons={reviewFeedback?.failureReasons || []}
            userFeedback={feedbackMessages}
            dataTestidPrefix="kyc-review-image-issue"
          />
        </div>
      )}

      {feedbackMessages.length > 0 && (
        <div data-testid="kyc-review-feedback-card" className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 mb-4">
          <p className="text-[11px] font-bold text-red-300">Bitte diese Punkte korrigieren</p>
          <ul className="mt-2 space-y-2">
            {feedbackMessages.map((item, idx) => (
              <li key={`${item}-${idx}`} className="flex items-start gap-2 text-xs text-red-200" data-testid={`kyc-review-feedback-item-${idx}`}>
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(incidentCode || supportHint) && (
        <div data-testid="kyc-review-incident-card" className="rounded-xl bg-cyan-500/10 border border-cyan-400/20 p-3 mb-4">
          <p className="text-[11px] font-bold text-cyan-300">Was gerade passiert ist</p>
          {supportHint && <p className="mt-2 text-xs text-cyan-100/80">{supportHint}</p>}
          {incidentCode && (
            <p data-testid="kyc-review-incident-code" className="mt-2 text-[11px] font-mono text-cyan-200/90">
              Problemcode: {incidentCode}
            </p>
          )}
        </div>
      )}

      {(feedbackMessages.length > 0 || canRequestManualReview) && (
        <div data-testid="kyc-review-manual-review-card" className="rounded-xl bg-cyan-500/10 border border-cyan-400/20 p-3 mb-4">
          <p className="text-[11px] font-bold text-cyan-300">Nächster Schritt</p>
          <p className="mt-1 text-xs text-cyan-100/80">
            {canRequestManualReview
              ? `Du hast ${failedAttempts} von 2 automatischen Fehlversuchen erreicht. Du kannst jetzt direkt eine manuelle Prüfung anfordern.`
              : "Korrigiere bitte die genannten Punkte und sende die Bilder danach erneut ab."}
          </p>
          {canRequestManualReview && (
            <motion.button
              type="button"
              data-testid="kyc-review-manual-review-btn"
              whileTap={{ scale: 0.97 }}
              onClick={onRequestManualReview}
              disabled={manualReviewSubmitting}
              className="mt-3 w-full py-3 rounded-2xl bg-amber-300 text-black font-bold disabled:opacity-60"
            >
              {manualReviewSubmitting ? "Manuelle Prüfung wird angefordert…" : "Manuelle Prüfung anfordern"}
            </motion.button>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <motion.button
          data-testid="kyc-review-back"
          whileTap={{ scale: 0.97 }}
          onClick={onBack}
          disabled={submitting}
          className="flex-1 py-4 rounded-2xl bg-white/5 text-white/70 font-bold disabled:opacity-50">
          Zurück
        </motion.button>
        <motion.button
          data-testid="kyc-submit-btn"
          whileTap={{ scale: 0.97 }}
          onClick={onSubmit}
          disabled={submitting}
          className="flex-1 py-4 rounded-2xl bg-[#00D26A] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-70"
          style={{ boxShadow: "0 8px 32px rgba(0,210,106,0.35)" }}>
          {submitting ? <><Loader2 size={16} className="animate-spin" /> Sende...</> : <>Absenden <CheckCircle2 size={18} /></>}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Stage 4 — Status Page
// ────────────────────────────────────────────────────────────────────────
function KYCStatusPage({ status, onRetry, onBack, onRequestManualReview, manualReviewSubmitting }) {
  if (!status) return null;
  const s = status.kyc_status;
  const feedbackList = Array.isArray(status.user_feedback) ? status.user_feedback.filter(Boolean) : [];
  const failedAttempts = Number(status.failed_attempts || 0);
  const canRequestManualReview = !!status.can_request_manual_review;
  const manualReviewRequested = !!status.manual_review_requested;
  const adminRequestedReupload = !!status.reupload_requested;
  const config = {
    approved: {
      icon: CheckCircle2, color: "#00D26A", bg: "rgba(0,210,106,0.10)", border: "rgba(0,210,106,0.25)",
      title: "Verifiziert",
      message: "Deine Identität wurde erfolgreich verifiziert. Alle Premium-Features sind jetzt freigeschaltet.",
    },
    pending: {
      icon: Clock, color: "#FFB800", bg: "rgba(255,184,0,0.10)", border: "rgba(255,184,0,0.25)",
      title: "In Prüfung",
      message: manualReviewRequested
        ? "Deine manuelle Prüfung wurde angefordert. Ein Admin prüft deine Unterlagen jetzt persönlich."
        : "Deine Verifizierung läuft. KI-Prüfung benötigt meist nur wenige Minuten — manuelle Prüfung bis zu 48h.",
    },
    rejected: {
      icon: XCircle, color: "#FF4060", bg: "rgba(255,64,96,0.10)", border: "rgba(255,64,96,0.25)",
      title: "Abgelehnt",
      message: status.rejection_reason || "Verifizierung fehlgeschlagen. Bitte erneut einreichen mit klareren Fotos.",
    },
  }[s] || {
    icon: Shield, color: "#888", bg: "rgba(136,136,136,0.10)", border: "rgba(136,136,136,0.25)",
    title: "Nicht gestartet", message: "Bitte starte die Verifizierung, um Premium-Features freizuschalten.",
  };
  const Icon = config.icon;

  return (
    <motion.div data-testid="kyc-status-page"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="p-5 max-w-md mx-auto pb-24">
      <div className="mb-4 rounded-[20px] border border-[#00C2FF]/20 bg-[#07131D] px-4 py-3" data-testid="kyc-authenticated-status-banner">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={18} className="mt-0.5 text-[#00C2FF]" />
          <div>
            <div className="text-sm font-bold text-white">Erfolgreich angemeldet</div>
            <div className="mt-1 text-xs leading-relaxed text-white/65">
              Dein Konto ist aktiv. Aktuell ist nur deine Verifizierung noch {s === "pending" ? "in Prüfung" : s === "rejected" ? "zur Korrektur offen" : "freigegeben"}.
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-3xl p-6 text-center mb-5" style={{ background: config.bg, border: `1px solid ${config.border}` }}>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 12 }}
          className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
          style={{ background: `${config.color}20`, border: `1px solid ${config.color}40` }}>
          <Icon size={32} style={{ color: config.color }} />
        </motion.div>
        <h2 className="text-xl font-bold mb-2" style={{ color: config.color }}>{config.title}</h2>
        <p className="text-sm text-white/70 leading-relaxed">{config.message}</p>
      </div>

      {/* Capabilities matrix */}
      {(feedbackList.length > 0 || (status.failure_reasons || []).length > 0) && (
        <div className="mb-5">
          <KYCImageIssueGrid
            failureReasons={status.failure_reasons || []}
            userFeedback={feedbackList}
            dataTestidPrefix="kyc-status-image-issue"
          />
        </div>
      )}

      {feedbackList.length > 0 && (
        <div className="rounded-2xl p-4 mb-5" style={{ background: "rgba(255,71,87,0.05)", border: "1px solid rgba(255,71,87,0.16)" }} data-testid="kyc-detailed-feedback-card">
          <p className="text-[10px] uppercase tracking-wider text-[#FF7C87] mb-3 font-semibold">Bitte genau so korrigieren</p>
          <ul className="space-y-2">
            {feedbackList.map((item, idx) => (
              <li key={`${item}-${idx}`} className="text-xs text-white/80 flex items-start gap-2" data-testid={`kyc-feedback-item-${idx}`}>
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#FF7C87]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {adminRequestedReupload && (
        <div className="rounded-2xl p-4 mb-5" style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.20)" }} data-testid="kyc-admin-reupload-card">
          <p className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">Admin-Nachupload angefordert</p>
          <p className="mt-2 text-sm font-bold text-white">Bitte diese Hinweise vor dem neuen Upload umsetzen</p>
          <p className="mt-2 text-xs leading-relaxed text-white/70">{status.admin_note || status.rejection_reason || "Ein Admin hat einen neuen Upload mit genauerem Foto angefordert."}</p>
        </div>
      )}

      {(s === "rejected" || manualReviewRequested) && (
        <div className="rounded-2xl p-4 mb-5" style={{ background: "rgba(0,194,255,0.05)", border: "1px solid rgba(0,194,255,0.16)" }} data-testid="kyc-attempts-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#00C2FF] font-semibold">Prüfstatus</p>
              <p className="mt-1 text-sm font-bold text-white">{failedAttempts} von 2 automatischen Fehlversuchen</p>
            </div>
            {canRequestManualReview && <span className="rounded-full bg-[#00C2FF]/10 px-3 py-1 text-[10px] font-bold text-[#00C2FF]">Manuelle Prüfung verfügbar</span>}
            {manualReviewRequested && <span className="rounded-full bg-amber-400/10 px-3 py-1 text-[10px] font-bold text-amber-300">Admin prüft jetzt</span>}
          </div>
          <p className="mt-2 text-xs text-white/65">
            {manualReviewRequested
              ? "Deine Unterlagen wurden in die Admin-Prüfliste gelegt."
              : canRequestManualReview
                ? "Du kannst jetzt statt weiterer KI-Versuche eine manuelle Prüfung durch das Admin-Team anfordern."
                : "Bitte korrigiere zuerst die Punkte oben und lade die Bilder erneut hoch."}
          </p>
        </div>
      )}

      {status.can_use_features && (
        <div className="rounded-2xl p-4 mb-5" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-3 font-semibold">Freigeschaltete Funktionen</p>
          {Object.entries(status.can_use_features).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-white/70 capitalize">{k.replace(/_/g, " ")}</span>
              {v ? <CheckCircle2 size={14} className="text-[#00D26A]" /> : <XCircle size={14} className="text-white/20" />}
            </div>
          ))}
        </div>
      )}

      {status.ai_confidence != null && (
        <div className="rounded-xl p-3 mb-5" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }}>
          <p className="text-[10px] uppercase tracking-wider text-[#A855F7] mb-1 font-semibold">KI-Konfidenz</p>
          <p className="text-lg font-bold">{Math.round(status.ai_confidence)}%</p>
        </div>
      )}

      <div className="flex gap-2">
        {s === "rejected" && (
          <>
            <motion.button
              data-testid="kyc-retry-btn"
              whileTap={{ scale: 0.97 }}
              onClick={onRetry}
              className="flex-1 py-4 rounded-2xl bg-[#00C2FF] text-black font-bold flex items-center justify-center gap-2">
              <RefreshCw size={16} /> Erneut versuchen
            </motion.button>
            {canRequestManualReview && (
              <motion.button
                data-testid="kyc-manual-review-btn"
                whileTap={{ scale: 0.97 }}
                onClick={onRequestManualReview}
                disabled={manualReviewSubmitting}
                className="flex-1 py-4 rounded-2xl bg-amber-300 text-black font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                {manualReviewSubmitting ? <><Loader2 size={16} className="animate-spin" /> Wird angefragt…</> : <>Manuelle Prüfung anfordern</>}
              </motion.button>
            )}
          </>
        )}
        <motion.button
          data-testid="kyc-status-back"
          whileTap={{ scale: 0.97 }}
          onClick={onBack}
          className={`${s === "rejected" ? "" : "flex-1"} py-4 px-6 rounded-2xl bg-white/5 text-white/70 font-bold`}>
          Zurück
        </motion.button>
      </div>
    </motion.div>
  );
}
