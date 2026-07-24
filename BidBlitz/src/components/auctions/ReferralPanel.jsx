import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Share2, Check, Users, Coins, Mail, Link2, Smartphone,
  Crown, ChevronDown, ChevronUp,
} from "lucide-react";
import { api } from "../../services/api";
import { glass, panelBg, panelBorder } from "./atoms";

/**
 * ReferralPanel — Auction referral / leaderboard UI.
 * Self-contained; fetches its own data on mount.
 */
export default function ReferralPanel({ t }) {
  const [ref, setRef] = useState(null);
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState("");
  const [applyMsg, setApplyMsg] = useState(null);
  const [showApply, setShowApply] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showBoard, setShowBoard] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(null);

  useEffect(() => {
    api.getAuctionReferral().then(setRef).catch(() => {});
    api.getReferralLeaderboard().then(d => setLeaderboard(d.leaderboard || [])).catch(() => {});
  }, []);

  const shareUrl = `https://bidblitz.ae?ref=${ref?.referral_code || ""}`;
  const shareMsg = t("share.invite_msg").replace("{code}", ref?.referral_code || "");

  const showShared = (via) => { setShareSuccess(via); setTimeout(() => setShareSuccess(null), 2500); };

  const copy = () => {
    navigator.clipboard.writeText(`${shareMsg}\n${shareUrl}`).then(() => {
      setCopied(true); showShared("copy");
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMsg + "\n" + shareUrl)}`, "_blank");
    showShared("whatsapp");
  };
  const shareEmail = () => {
    window.open(`mailto:?subject=${encodeURIComponent("BidBlitz — " + t("auction.referral_title"))}&body=${encodeURIComponent(shareMsg + "\n\n" + shareUrl)}`, "_blank");
    showShared("email");
  };
  const shareNative = () => {
    if (navigator.share) {
      navigator.share({ title: "BidBlitz", text: shareMsg, url: shareUrl })
        .then(() => showShared("native")).catch(() => {});
    } else copy();
  };

  const apply = async () => {
    if (!applyCode.trim()) return;
    try {
      const r = await api.applyAuctionReferral(applyCode.trim());
      setApplyMsg({ ok: true, text: `+${r.credits_awarded} Credits!` });
      setApplyCode("");
    } catch (e) { setApplyMsg({ ok: false, text: e.message }); }
  };

  if (!ref) return null;

  return (
    <motion.div className={`rounded-2xl overflow-hidden ${glass}`} style={{ background: panelBg, border: panelBorder }}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
      <div className="p-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(0,224,255,0.06)", border: "1px solid rgba(0,224,255,0.1)" }}>
            <Share2 size={14} className="text-[#00E0FF]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-white/80">{t("auction.referral_title")}</p>
            <p className="text-[9px] text-white/25">{t("auction.referral_desc")}</p>
          </div>
          <div className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <span className="text-[12px] font-mono font-bold text-[#00E0FF] tracking-wider">{ref.referral_code}</span>
          </div>
        </div>

        <motion.button data-testid="share-primary-btn" onClick={shareNative}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl mb-2.5"
          style={{ background: "rgba(0,224,255,0.06)", border: "1px solid rgba(0,224,255,0.12)" }}
          whileTap={{ scale: 0.97 }}
          whileHover={{ background: "rgba(0,224,255,0.1)", borderColor: "rgba(0,224,255,0.2)" }}>
          <Share2 size={14} className="text-[#00E0FF]" />
          <span className="text-[12px] font-bold text-[#00E0FF]">{t("share.native")}</span>
        </motion.button>

        <AnimatePresence>
          {shareSuccess && (
            <motion.div className="flex items-center justify-center gap-2 py-2 mb-2.5 rounded-xl"
              style={{ background: "rgba(0,232,157,0.05)", border: "1px solid rgba(0,232,157,0.1)" }}
              initial={{ opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.2 }}>
              <Check size={12} className="text-[#00E89D]" />
              <span className="text-[10px] font-bold text-[#00E89D]">
                {shareSuccess === "copy" ? t("share.copied") : t("share.shared_success")}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-1.5">
          <motion.button data-testid="share-whatsapp" onClick={shareWhatsApp} whileTap={{ scale: 0.9 }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg" style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.12)" }}>
            <Smartphone size={10} className="text-[#25D366]" /><span className="text-[9px] font-bold text-[#25D366]">{t("share.whatsapp")}</span>
          </motion.button>
          <motion.button data-testid="share-email" onClick={shareEmail} whileTap={{ scale: 0.9 }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg" style={{ background: "rgba(0,224,255,0.04)", border: "1px solid rgba(0,224,255,0.08)" }}>
            <Mail size={10} className="text-[#00E0FF]" /><span className="text-[9px] font-bold text-[#00E0FF]">{t("share.email")}</span>
          </motion.button>
          <motion.button data-testid="share-copy" onClick={copy} whileTap={{ scale: 0.9 }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg" style={{ background: copied ? "rgba(0,232,157,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${copied ? "rgba(0,232,157,0.1)" : "rgba(255,255,255,0.05)"}` }}>
            {copied ? <Check size={10} className="text-[#00E89D]" /> : <Link2 size={10} className="text-white/30" />}
            <span className={`text-[9px] font-bold ${copied ? "text-[#00E89D]" : "text-white/30"}`}>{copied ? t("share.copied") : t("share.copy_link")}</span>
          </motion.button>
        </div>

        <div className="flex items-center gap-3 mt-2.5">
          <div className="flex items-center gap-1">
            <Users size={8} className="text-[#00E0FF]/50" />
            <span className="text-[9px] text-white/20">{t("auction.referral_count")}: <span className="text-[#00E0FF] font-bold">{ref.referral_count}</span></span>
          </div>
          <div className="flex items-center gap-1">
            <Coins size={8} className="text-[#FFD166]/50" />
            <span className="text-[9px] text-white/20">{t("referral.earned_total")}: <span className="text-[#FFD166] font-bold">{ref.referral_count * ref.bonus_per_referral}</span></span>
          </div>
          <div className="flex-1" />
          {!showApply ? (
            <motion.button onClick={() => setShowApply(true)} className="text-[9px] text-white/25 hover:text-white/50" whileTap={{ scale: 0.95 }}>{t("auction.referral_apply")}</motion.button>
          ) : (
            <div className="flex items-center gap-1.5">
              <input data-testid="referral-apply-input" value={applyCode} onChange={e => setApplyCode(e.target.value)} placeholder="CODE"
                className="w-20 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px] text-white/70 font-mono placeholder:text-white/10 outline-none focus:border-[#00E0FF]/20" />
              <motion.button data-testid="referral-apply-btn" onClick={apply} whileTap={{ scale: 0.95 }}
                className="px-2 py-1 rounded-lg bg-[#00E0FF]/8 border border-[#00E0FF]/15 text-[9px] font-bold text-[#00E0FF]">OK</motion.button>
            </div>
          )}
        </div>
        <AnimatePresence>{applyMsg && <motion.p className={`mt-1.5 text-[9px] font-medium ${applyMsg.ok ? "text-[#00E89D]" : "text-[#FF4060]"}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{applyMsg.text}</motion.p>}</AnimatePresence>
      </div>

      {leaderboard.length > 0 && (
        <>
          <motion.button data-testid="referral-leaderboard-toggle" onClick={() => setShowBoard(p => !p)}
            className="w-full flex items-center justify-center gap-1.5 py-2 border-t border-white/[0.03] text-[9px] text-white/20 hover:text-white/40 transition-colors"
            whileTap={{ scale: 0.98 }}>
            <Crown size={9} className="text-[#FFD166]/40" />
            <span className="font-semibold">{t("referral.leaderboard")}</span>
            {showBoard ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </motion.button>
          <AnimatePresence>
            {showBoard && (
              <motion.div className="px-3 pb-3 space-y-1" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                {leaderboard.slice(0, 5).map((l, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg" style={{ background: i === 0 ? "rgba(255,209,102,0.03)" : "transparent" }}>
                    <span className={`text-[10px] font-bold w-4 text-center ${i === 0 ? "text-[#FFD166]" : i === 1 ? "text-white/40" : "text-white/20"}`}>#{i + 1}</span>
                    <span className="text-[10px] text-white/50 flex-1">{l.name}</span>
                    <span className="text-[9px] text-[#00E0FF] font-bold">{l.referrals}</span>
                    <span className="text-[8px] text-[#FFD166]/50">+{l.bonus}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}
