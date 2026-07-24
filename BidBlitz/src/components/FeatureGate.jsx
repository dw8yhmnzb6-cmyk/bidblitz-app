import { motion } from "framer-motion";
import { Lock, Sparkles, ChevronLeft } from "lucide-react";
import { useFeatureFlags } from "../store/FeatureFlagContext";
import { useUser, useI18n } from "../store";

const slide = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

export const FeatureGate = ({ flag, children, onBack }) => {
  const { isEnabled } = useFeatureFlags();
  const user = useUser();
  const { t } = useI18n();

  const allowed = isEnabled(flag, user.role);

  if (allowed) return children;

  return (
    <motion.div
      data-testid={`feature-gate-${flag}`}
      className="min-h-screen flex flex-col"
      style={{ background: "#030303" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {onBack && (
        <div className="px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3">
          <motion.button
            data-testid="feature-gate-back-btn"
            className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
            whileTap={{ scale: 0.88 }}
            onClick={onBack}
          >
            <ChevronLeft size={15} strokeWidth={1.5} className="text-white/50" />
          </motion.button>
        </div>
      )}
      <div className="flex-1 flex items-center justify-center px-8">
        <motion.div
          className="text-center max-w-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ...slide }}
        >
          <motion.div
            className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center relative"
            style={{ background: "rgba(0,194,255,0.04)", border: "1px solid rgba(0,194,255,0.08)" }}
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Lock size={28} strokeWidth={1.5} className="text-[#00C2FF]/60" />
            <motion.div
              className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.25)" }}
            >
              <Sparkles size={11} className="text-purple-400" />
            </motion.div>
          </motion.div>
          <h2 className="text-[18px] font-semibold text-white font-outfit mb-2 tracking-tight">
            {t("feature_gate.title")}
          </h2>
          <p className="text-[13px] text-[#555] font-medium leading-relaxed mb-6">
            {t("feature_gate.desc")}
          </p>
          <div
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-[11px] font-semibold"
            style={{ background: "rgba(0,194,255,0.06)", border: "1px solid rgba(0,194,255,0.12)", color: "#00C2FF" }}
          >
            <Sparkles size={11} />
            {t("feature_gate.badge")}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default FeatureGate;
