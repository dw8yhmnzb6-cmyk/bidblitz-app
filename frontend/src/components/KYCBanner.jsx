/**
 * BidBlitz V2 - KYC Banner
 * Shows a prominent banner at the top of the home/wallet pages for unverified users.
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, ChevronRight, Loader2 } from "lucide-react";
import KYCVerificationModal from "./KYCVerificationModal";
import { useI18n } from "../store/I18nContext";
import { KYC_DISABLED } from "../config/testMode";

const API = process.env.REACT_APP_BACKEND_URL;
const KYCBanner = ({ onVerified, onNavigate }) => {
  const { t } = useI18n();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    try {
      // Admin-bypass: don't show banner for admin users
      const meRes = await fetch(`${API}/api/auth/me`, { credentials: "include" });
      if (meRes.ok) {
        const me = await meRes.json();
        if (me.role === "admin" || me.is_admin) {
          setStatus({ kyc_verified: true, _admin_bypass: true });
          setLoading(false);
          return;
        }
      }
      const res = await fetch(`${API}/api/kyc/status`, { credentials: "include" });
      if (res.ok) setStatus(await res.json());
    } catch (error) {
      setStatus(null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (KYC_DISABLED) return null;
  if (loading || !status) return null;
  if (status.kyc_verified) return null; // Already verified — hide

  // Choose visual based on status
  const cfg = {
    not_started: {
      bg: "from-[#FFB800] to-[#FF8800]",
      title: t("kyc.banner.verify_title"),
      desc: t("kyc.banner.verify_desc"),
      cta: t("kyc.banner.start_cta"),
    },
    pending: {
      bg: "from-[#06B6D4] to-[#A855F7]",
      title: t("kyc.banner.pending_title"),
      desc: t("kyc.banner.pending_desc"),
      cta: t("kyc.banner.pending_cta"),
    },
    rejected: {
      bg: "from-red-500 to-pink-600",
      title: t("kyc.banner.rejected_title"),
      desc: status.rejection_reason || t("kyc.banner.rejected_desc"),
      cta: t("kyc.banner.retry_cta"),
    },
  };
  const c = cfg[status.kyc_status] || cfg.not_started;

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onNavigate ? onNavigate("/kyc") : setShowModal(true)}
        data-testid="kyc-banner"
        className={`w-full flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r ${c.bg} text-black shadow-lg`}
      >
        <div className="w-10 h-10 rounded-xl bg-black/15 flex items-center justify-center flex-shrink-0">
          <Shield size={18} className="text-black" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[12px] font-black truncate">{c.title}</p>
          <p className="text-[10px] font-medium opacity-80 truncate">{c.desc}</p>
        </div>
        <ChevronRight size={16} className="text-black flex-shrink-0" />
      </motion.button>

      <KYCVerificationModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onComplete={async (r) => {
          setShowModal(false);
          await load();
          if (r?.status === "approved" && onVerified) onVerified(r);
        }}
      />
    </>
  );
};

export default KYCBanner;
