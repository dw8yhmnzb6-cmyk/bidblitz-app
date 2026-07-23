import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Upload, Camera, CreditCard, Shield, Check, Loader2,
  Clock, X, AlertCircle, RefreshCcw
} from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { api } from "../services/api";
import { KYC_ACCEPT_ATTR, getKycImageValidationMessage, isAlreadySubmittedKycError, isSupportedKycImage } from "../utils/kycUpload";
import { KYCImageIssueGrid } from "../components/KYCImageIssueGrid";

const glass = "backdrop-blur-xl";
const panelBg = "rgba(8,12,20,0.7)";
const panelBorder = "1px solid rgba(255,255,255,0.04)";

const VerificationPage = ({ onBack }) => {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState({ id_front: null, id_back: null, selfie: null });
  const [previews, setPreviews] = useState({ id_front: null, id_back: null, selfie: null });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [manualReviewSubmitting, setManualReviewSubmitting] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [submitFeedback, setSubmitFeedback] = useState(null);

  const load = useCallback(async () => {
    const res = await api.getKycStatus();
    return res;
  }, []);

  const refreshStatus = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      const res = await load();
      setData(res);
      setLastSyncAt(new Date());
      return res;
    } catch (loadError) {
      setError(loadError?.message || "KYC-Status konnte nicht geladen werden");
      return null;
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!data?.kyc_status || !["pending", "submitted"].includes(data.kyc_status)) return;
    const timer = setInterval(() => {
      refreshStatus({ silent: true });
    }, 15000);
    return () => clearInterval(timer);
  }, [data?.kyc_status, refreshStatus]);

  const resetUploads = useCallback(() => {
    setFiles({ id_front: null, id_back: null, selfie: null });
    setPreviews({ id_front: null, id_back: null, selfie: null });
    setError("");
    setSuccess(false);
    setSubmitFeedback(null);
  }, []);

  const handleFile = (key, file) => {
    if (!file) return;
    if (!isSupportedKycImage(file)) {
      setError(getKycImageValidationMessage());
      return;
    }
    setFiles(p => ({ ...p, [key]: file }));
    setPreviews(p => ({ ...p, [key]: URL.createObjectURL(file) }));
  };

  const submit = async () => {
    if (!files.id_front || !files.id_back || !files.selfie) {
      setError(t("verify.all_required") || "All 3 documents required");
      return;
    }
    setUploading(true);
    setError("");
    setSubmitFeedback(null);
    try {
      const fd = new FormData();
      fd.append("id_front", files.id_front);
      fd.append("id_back", files.id_back);
      fd.append("selfie", files.selfie);
      fd.append("document_type", "national_id");
      const response = await api.submitKycFormData(fd);
      setSuccess(response?.status !== "rejected");
      setSubmitFeedback({
        tone: response?.status === "approved" ? "success" : response?.status === "rejected" ? "error" : "pending",
        title: response?.status === "approved" ? "Verifizierung abgeschlossen" : response?.status === "rejected" ? "Verifizierung abgelehnt" : "Dokumente eingereicht",
        message: response?.message || "KYC-Status aktualisiert.",
      });
      const nextStatus = await refreshStatus({ silent: true });
      if (nextStatus?.kyc_status === "approved") {
        setSuccess(false);
      }
    } catch (e) {
      if (isAlreadySubmittedKycError(e?.message)) {
        await refreshStatus({ silent: true });
        setUploading(false);
        return;
      }
      setError(e?.message || "KYC Upload fehlgeschlagen");
      setSubmitFeedback({ tone: "error", title: "Upload fehlgeschlagen", message: e?.message || "KYC Upload fehlgeschlagen" });
    }
    setUploading(false);
  };

  const requestManualReview = async () => {
    setManualReviewSubmitting(true);
    setError("");
    try {
      const response = await api.requestKycManualReview();
      setSubmitFeedback({
        tone: "pending",
        title: "Manuelle Prüfung angefordert",
        message: response?.message || "Ein Admin prüft deine Unterlagen jetzt persönlich.",
      });
      await refreshStatus({ silent: true });
    } catch (e) {
      setError(e?.message || "Manuelle Prüfung konnte nicht angefordert werden");
    }
    setManualReviewSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#040610" }}>
        <Loader2 size={24} className="text-white/20 animate-spin" />
      </div>
    );
  }

  const status = data?.kyc_status;
  const requestedRole = "Identität";
  const canRetryUpload = !status || status === "rejected";
  const statusTone = status === "approved"
    ? { title: "Verifiziert", color: "#00E89D", bg: "rgba(0,232,157,0.04)", border: "1px solid rgba(0,232,157,0.12)", icon: Check }
    : status === "rejected"
      ? { title: "Verifizierung abgelehnt", color: "#FF4757", bg: "rgba(255,71,87,0.04)", border: "1px solid rgba(255,71,87,0.12)", icon: X }
      : { title: "In Prüfung", color: "#FFB800", bg: "rgba(255,184,0,0.04)", border: "1px solid rgba(255,184,0,0.12)", icon: Clock };
  const StatusIcon = statusTone.icon;
  const syncLabel = lastSyncAt
    ? `Zuletzt aktualisiert: ${lastSyncAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "Status wird geladen";
  const autoRefreshActive = ["pending", "submitted"].includes(status);
  const detailedFeedback = Array.isArray(data?.user_feedback) ? data.user_feedback.filter(Boolean) : [];
  const failedAttempts = Number(data?.failed_attempts || 0);
  const canRequestManualReview = !!data?.can_request_manual_review;
  const manualReviewRequested = !!data?.manual_review_requested;
  const infoTone = submitFeedback?.tone === "error"
    ? { bg: "rgba(255,71,87,0.06)", border: "1px solid rgba(255,71,87,0.14)", color: "#FF7C87", icon: AlertCircle }
    : submitFeedback?.tone === "success"
      ? { bg: "rgba(0,232,157,0.06)", border: "1px solid rgba(0,232,157,0.14)", color: "#00E89D", icon: Check }
      : { bg: "rgba(0,224,255,0.06)", border: "1px solid rgba(0,224,255,0.14)", color: "#00E0FF", icon: Clock };
  const FeedbackIcon = infoTone.icon;

  return (
    <motion.div data-testid="verification-page" className="min-h-screen pb-24" style={{ background: "#040610" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: "rgba(4,6,16,0.85)", borderBottom: panelBorder }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <motion.button data-testid="verify-back" onClick={onBack} whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
            <ArrowLeft size={15} className="text-white/40" />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-[15px] font-bold text-white/90 font-outfit">{t("verify.title") || "Identity Verification"}</h1>
            <p className="text-[9px] text-white/25">{t("verify.subtitle") || "Verify your identity to unlock your role"}</p>
          </div>
          <Shield size={18} className="text-[#00E0FF]/30" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">

        <motion.div
          className={`rounded-2xl p-4 ${glass}`}
          style={{ background: panelBg, border: panelBorder }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          data-testid="kyc-status-actions-card"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">KYC Status</p>
              <p className="text-[13px] font-bold mt-1" style={{ color: statusTone.color }} data-testid="kyc-status-title">{statusTone.title}</p>
              <p className="text-[10px] text-white/30 mt-1" data-testid="kyc-last-sync-label">{syncLabel}</p>
            </div>
            <button
              onClick={() => refreshStatus({ silent: true })}
              className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/70 text-[11px] font-semibold flex items-center gap-2 disabled:opacity-40"
              disabled={refreshing || uploading}
              data-testid="kyc-refresh-button"
            >
              <RefreshCcw size={13} className={refreshing ? "animate-spin" : ""} />
              Aktualisieren
            </button>
          </div>
          {autoRefreshActive && (
            <p className="text-[10px] text-cyan-300/80 mt-3" data-testid="kyc-auto-refresh-hint">
              Auto-Refresh ist aktiv. Der Status wird alle 15 Sekunden erneut geprüft.
            </p>
          )}
        </motion.div>

        {submitFeedback && (
          <motion.div
            data-testid="kyc-submit-feedback-card"
            className={`rounded-2xl p-4 ${glass}`}
            style={{ background: infoTone.bg, border: infoTone.border }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                <FeedbackIcon size={18} style={{ color: infoTone.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold" style={{ color: infoTone.color }} data-testid="kyc-submit-feedback-title">{submitFeedback.title}</p>
                <p className="text-[11px] text-white/70 mt-1" data-testid="kyc-submit-feedback-message">{submitFeedback.message}</p>
              </div>
              {submitFeedback.tone === "error" && (
                <button
                  onClick={() => setSubmitFeedback(null)}
                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/70 text-[10px] font-semibold"
                  data-testid="kyc-feedback-dismiss-button"
                >
                  Schließen
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Status Banner */}
        {status === "pending" && (
          <motion.div className={`rounded-2xl p-4 text-center ${glass}`} style={{ background: "rgba(255,184,0,0.04)", border: "1px solid rgba(255,184,0,0.12)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Clock size={28} className="text-[#FFB800] mx-auto mb-2" />
            <p className="text-[13px] font-bold text-[#FFB800]">{t("verify.pending_title") || "Under Review"}</p>
            <p className="text-[10px] text-white/30 mt-1">{manualReviewRequested ? "Deine manuelle Prüfung läuft jetzt durch einen Admin." : (t("verify.pending_desc") || "Your documents are being reviewed. This may take a few hours.")}</p>
            <p className="text-[9px] text-white/15 mt-2">{t("verify.requested_role") || "Requested Role"}: <span className="text-[#00E0FF] font-bold">{requestedRole}</span></p>
          </motion.div>
        )}

        {status === "approved" && (
          <motion.div className={`rounded-2xl p-4 text-center ${glass}`} style={{ background: "rgba(0,232,157,0.04)", border: "1px solid rgba(0,232,157,0.12)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Check size={28} className="text-[#00E89D] mx-auto mb-2" />
            <p className="text-[13px] font-bold text-[#00E89D]">{t("verify.approved_title") || "Verified"}</p>
            <p className="text-[10px] text-white/30 mt-1">{t("verify.approved_desc") || "Your identity has been verified. Your role is now active."}</p>
          </motion.div>
        )}

        {status === "rejected" && (
          <motion.div data-testid="kyc-rejected-banner" className={`rounded-2xl p-4 text-center ${glass}`} style={{ background: "rgba(255,71,87,0.04)", border: "1px solid rgba(255,71,87,0.12)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <X size={28} className="text-[#FF4757] mx-auto mb-2" />
            <p className="text-[13px] font-bold text-[#FF4757]">{t("verify.rejected_title") || "Verification Rejected"}</p>
            <p className="text-[10px] text-white/30 mt-1">{data?.rejection_reason || t("verify.rejected_desc") || "Please re-submit clear documents."}</p>
            <div className="flex gap-2 mt-3 justify-center">
              <button
                onClick={() => refreshStatus({ silent: true })}
                className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/70 text-[11px] font-semibold"
                data-testid="kyc-rejected-refresh-button"
              >
                Status neu laden
              </button>
              <button
                onClick={resetUploads}
                className="px-3 py-2 rounded-xl bg-[#FF4757]/10 border border-[#FF4757]/20 text-[#FF7C87] text-[11px] font-semibold"
                data-testid="kyc-retry-upload-button"
              >
                Neu hochladen
              </button>
            </div>
          </motion.div>
        )}

        {detailedFeedback.length > 0 && (
          <motion.div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <KYCImageIssueGrid
              failureReasons={data?.failure_reasons || []}
              userFeedback={detailedFeedback}
              dataTestidPrefix="verification-image-issue"
            />
          </motion.div>
        )}

        {detailedFeedback.length > 0 && (
          <motion.div data-testid="kyc-detailed-feedback-card" className={`rounded-2xl p-4 ${glass}`} style={{ background: "rgba(255,71,87,0.04)", border: "1px solid rgba(255,71,87,0.12)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-[11px] font-bold text-[#FF7C87]">Was genau korrigiert werden muss</p>
            <ul className="mt-3 space-y-2">
              {detailedFeedback.map((item, index) => (
                <li key={`${item}-${index}`} className="flex items-start gap-2 text-[11px] text-white/75" data-testid={`kyc-feedback-item-${index}`}>
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#FF7C87]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {(status === "rejected" || manualReviewRequested) && (
          <motion.div data-testid="kyc-manual-review-card" className={`rounded-2xl p-4 ${glass}`} style={{ background: "rgba(0,224,255,0.03)", border: "1px solid rgba(0,224,255,0.1)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-[#00E0FF]">Manuelle Prüfung</p>
                <p className="mt-1 text-[10px] text-white/55">{failedAttempts} von 2 automatischen Fehlversuchen erreicht.</p>
              </div>
              {manualReviewRequested && <span className="rounded-full bg-amber-400/10 px-3 py-1 text-[10px] font-bold text-amber-300">Admin prüft</span>}
            </div>
            <p className="mt-3 text-[10px] text-white/60">
              {manualReviewRequested
                ? "Deine Unterlagen liegen jetzt beim Admin-Team. Weitere Uploads sind aktuell nicht nötig."
                : canRequestManualReview
                  ? "Du kannst jetzt statt weiterer KI-Versuche eine persönliche Prüfung durch das Admin-Team anfordern."
                  : "Falls die KI dich zweimal nicht sauber erkennt, wird der manuelle Prüf-Button automatisch freigeschaltet."}
            </p>
            {canRequestManualReview && !manualReviewRequested && (
              <button
                onClick={requestManualReview}
                disabled={manualReviewSubmitting}
                className="mt-3 w-full rounded-xl bg-[#FFB800] px-4 py-3 text-[11px] font-bold text-black disabled:opacity-60"
                data-testid="kyc-request-manual-review-button"
              >
                {manualReviewSubmitting ? "Wird angefordert…" : "Manuelle Prüfung anfordern"}
              </button>
            )}
          </motion.div>
        )}

        {/* Upload Form — only show if no pending/approved verification */}
        {(!status || status === "rejected") && !success && (
          <>
            <motion.div data-testid="kyc-upload-guidance-card" className={`rounded-2xl p-4 ${glass}`} style={{ background: "rgba(0,224,255,0.03)", border: "1px solid rgba(0,224,255,0.1)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-[#00E0FF]">Klare Fotos beschleunigen die Prüfung</p>
                  <p className="text-[10px] text-white/55 mt-1">Alle 3 Bilder müssen gut lesbar, vollständig und ohne starke Spiegelung sein.</p>
                </div>
                <button
                  onClick={resetUploads}
                  className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/70 text-[11px] font-semibold"
                  data-testid="kyc-reset-upload-button"
                >
                  Reset
                </button>
              </div>
            </motion.div>

            <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-3">{t("verify.upload_docs") || "Upload Documents"}</p>

              {[
                { key: "id_front", icon: CreditCard, label: t("verify.id_front") || "ID Front" },
                { key: "id_back", icon: CreditCard, label: t("verify.id_back") || "ID Back" },
                { key: "selfie", icon: Camera, label: t("verify.selfie") || "Selfie with ID" },
              ].map(({ key, icon: Icon, label }) => (
                <div key={key} data-testid={`upload-${key}`} className="mb-3">
                  <label className="block">
                    <div className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/[0.02]" style={{ background: previews[key] ? "rgba(0,224,255,0.03)" : "rgba(255,255,255,0.01)", border: `1px solid ${previews[key] ? "rgba(0,224,255,0.1)" : "rgba(255,255,255,0.03)"}` }}>
                      {previews[key] ? (
                        <img src={previews[key]} alt={label} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/[0.02]">
                          <Icon size={16} className="text-white/15" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-[11px] font-semibold text-white/70">{label}</p>
                        <p className="text-[8px] text-white/20">{files[key] ? files[key].name : (t("verify.tap_upload") || "Tap to upload")}</p>
                      </div>
                      {previews[key] ? <Check size={14} className="text-[#00E89D]" /> : <Upload size={14} className="text-white/15" />}
                    </div>
                    <input
                      type="file"
                      accept={KYC_ACCEPT_ATTR}
                      className="hidden"
                      onChange={(e) => handleFile(key, e.target.files[0])}
                    />
                  </label>
                </div>
              ))}
            </motion.div>

            {error && (
              <motion.div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(255,71,87,0.04)", border: "1px solid rgba(255,71,87,0.1)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AlertCircle size={12} className="text-[#FF4757]" />
                <span className="text-[10px] text-[#FF4757] flex-1" data-testid="kyc-error-message">{error}</span>
                <button
                  onClick={() => canRetryUpload ? submit() : refreshStatus({ silent: true })}
                  className="px-2.5 py-1 rounded-lg bg-[#FF4757]/10 border border-[#FF4757]/15 text-[#FF9AA3] text-[10px] font-semibold"
                  data-testid="kyc-inline-retry-button"
                >
                  Erneut versuchen
                </button>
              </motion.div>
            )}

            <motion.button
              data-testid="submit-verification-btn"
              onClick={submit}
              disabled={uploading || !files.id_front || !files.id_back || !files.selfie}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 rounded-xl text-[12px] font-bold disabled:opacity-20"
              style={{ background: "rgba(0,224,255,0.08)", border: "1px solid rgba(0,224,255,0.15)", color: "#00E0FF" }}
            >
              {uploading ? <Loader2 size={14} className="animate-spin mx-auto" /> : (t("verify.submit") || "Submit for Review")}
            </motion.button>
          </>
        )}

        {success && status !== "approved" && (
          <motion.div className={`rounded-2xl p-4 text-center ${glass}`} style={{ background: "rgba(0,232,157,0.04)", border: "1px solid rgba(0,232,157,0.12)" }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} data-testid="kyc-success-card">
            <Check size={28} className="text-[#00E89D] mx-auto mb-2" />
            <p className="text-[13px] font-bold text-[#00E89D]">{t("verify.submitted") || "Documents Submitted"}</p>
            <p className="text-[10px] text-white/30 mt-1">{t("verify.wait_review") || "Please wait for admin review."}</p>
            <p className="text-[10px] text-cyan-300/80 mt-2" data-testid="kyc-success-refresh-hint">Status wird automatisch aktualisiert. Du kannst zusätzlich jederzeit manuell prüfen.</p>
            <div className="flex gap-2 justify-center mt-3">
              <button
                onClick={() => refreshStatus({ silent: true })}
                className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/70 text-[11px] font-semibold"
                data-testid="kyc-success-refresh-button"
              >
                Jetzt prüfen
              </button>
              <button
                onClick={resetUploads}
                className="px-3 py-2 rounded-xl bg-[#00E89D]/10 border border-[#00E89D]/20 text-[#00E89D] text-[11px] font-semibold"
                data-testid="kyc-success-reset-button"
              >
                Neue Dateien wählen
              </button>
            </div>
          </motion.div>
        )}

      </div>
    </motion.div>
  );
};

export default VerificationPage;
