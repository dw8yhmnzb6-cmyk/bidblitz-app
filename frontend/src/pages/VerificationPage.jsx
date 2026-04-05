import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Upload, Camera, CreditCard, Shield, Check, Loader2,
  Clock, X, AlertCircle, ChevronRight
} from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { api } from "../services/api";

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

  const load = useCallback(async () => {
    try {
      const res = await api.getVerificationStatus();
      setData(res);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleFile = (key, file) => {
    if (!file) return;
    setFiles(p => ({ ...p, [key]: file }));
    const reader = new FileReader();
    reader.onload = (e) => setPreviews(p => ({ ...p, [key]: e.target.result }));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!files.id_front || !files.id_back || !files.selfie) {
      setError(t("verify.all_required") || "All 3 documents required");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("id_front", files.id_front);
      fd.append("id_back", files.id_back);
      fd.append("selfie", files.selfie);
      await api.uploadVerification(fd);
      setSuccess(true);
      await load();
    } catch (e) {
      setError(e.message);
    }
    setUploading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#040610" }}>
        <Loader2 size={24} className="text-white/20 animate-spin" />
      </div>
    );
  }

  const ver = data?.verification;
  const roleReq = data?.role_request;
  const status = ver?.status;
  const requestedRole = data?.requested_role || roleReq?.requested_role || "";

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

        {/* Status Banner */}
        {status === "pending" && (
          <motion.div className={`rounded-2xl p-4 text-center ${glass}`} style={{ background: "rgba(255,184,0,0.04)", border: "1px solid rgba(255,184,0,0.12)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Clock size={28} className="text-[#FFB800] mx-auto mb-2" />
            <p className="text-[13px] font-bold text-[#FFB800]">{t("verify.pending_title") || "Under Review"}</p>
            <p className="text-[10px] text-white/30 mt-1">{t("verify.pending_desc") || "Your documents are being reviewed. This may take a few hours."}</p>
            <p className="text-[9px] text-white/15 mt-2">{t("verify.requested_role") || "Requested Role"}: <span className="text-[#00E0FF] font-bold">{requestedRole || ver?.requested_role}</span></p>
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
          <motion.div className={`rounded-2xl p-4 text-center ${glass}`} style={{ background: "rgba(255,71,87,0.04)", border: "1px solid rgba(255,71,87,0.12)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <X size={28} className="text-[#FF4757] mx-auto mb-2" />
            <p className="text-[13px] font-bold text-[#FF4757]">{t("verify.rejected_title") || "Verification Rejected"}</p>
            <p className="text-[10px] text-white/30 mt-1">{ver?.reason || t("verify.rejected_desc") || "Please re-submit clear documents."}</p>
          </motion.div>
        )}

        {/* Upload Form — only show if no pending/approved verification */}
        {(!status || status === "rejected") && !success && (
          <>
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
                      accept="image/jpeg,image/png,image/webp"
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
                <span className="text-[10px] text-[#FF4757]">{error}</span>
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

        {success && !status && (
          <motion.div className={`rounded-2xl p-4 text-center ${glass}`} style={{ background: "rgba(0,232,157,0.04)", border: "1px solid rgba(0,232,157,0.12)" }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Check size={28} className="text-[#00E89D] mx-auto mb-2" />
            <p className="text-[13px] font-bold text-[#00E89D]">{t("verify.submitted") || "Documents Submitted"}</p>
            <p className="text-[10px] text-white/30 mt-1">{t("verify.wait_review") || "Please wait for admin review."}</p>
          </motion.div>
        )}

      </div>
    </motion.div>
  );
};

export default VerificationPage;
