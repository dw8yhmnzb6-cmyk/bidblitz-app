/**
 * AffiliatePage - Dashboard für Partner-Programm
 * User sieht seinen Link, Einnahmen, Tier, Leaderboard
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Copy, Share2, TrendingUp, Users, Euro, Trophy,
  Zap, Gift, CheckCircle2, Loader2, ExternalLink, Sparkles
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const TIER_COLORS = {
  bronze: { bg: "linear-gradient(135deg,#CD7F32,#8B4513)", icon: "🥉" },
  silver: { bg: "linear-gradient(135deg,#C0C0C0,#808080)", icon: "🥈" },
  gold: { bg: "linear-gradient(135deg,#FFD700,#FFB800)", icon: "🥇" },
  diamond: { bg: "linear-gradient(135deg,#00F5FF,#A855F7)", icon: "💎" },
};

export const AffiliatePage = ({ onBack }) => {
  const [data, setData] = useState(null);
  const [earnings, setEarnings] = useState([]);
  const [lb, setLb] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, earn, leaderboard] = await Promise.all([
        fetch(`${API}/api/affiliate/me`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
        fetch(`${API}/api/affiliate/earnings?limit=20`, { credentials: "include" }).then(r => r.ok ? r.json() : { earnings: [] }),
        fetch(`${API}/api/affiliate/leaderboard?limit=10`).then(r => r.json()),
      ]);
      setData(me);
      setEarnings(earn.earnings || []);
      setLb(leaderboard.leaderboard || []);
    } catch (err) {
      toast.error("Fehler beim Laden");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const copyLink = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      toast.success("Link kopiert!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Konnte nicht kopieren");
    }
  };

  const share = async () => {
    if (!data) return;
    const shareText = `Komm zu BidBlitz und kassier Bonus! ${data.link}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "BidBlitz Partner-Link",
          text: "Melde dich bei BidBlitz an und erhalte 5€ Willkommen-Bonus!",
          url: data.link,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(shareText);
      toast.success("Text in Zwischenablage");
    }
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f9fc]">
        <Loader2 size={22} className="animate-spin text-slate-400" />
      </div>
    );
  }

  const tier = data.tier || { id: "bronze", label: "Bronze", bonus_mult: 1.0 };
  const tierStyle = TIER_COLORS[tier.id] || TIER_COLORS.bronze;
  const bonus = (data.signup_bonus || 5) * (tier.bonus_mult || 1);

  return (
    <div data-testid="affiliate-page" className="min-h-screen pb-24"
      style={{ background: "radial-gradient(circle at 50% 0%, rgba(168,85,247,0.12), transparent 45%), linear-gradient(180deg, #f7f9fc 0%, #eef4fb 100%)" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/90 border-b border-slate-200">
        <div className="flex items-center justify-between px-4 py-3">
          <motion.button onClick={onBack} data-testid="affiliate-back"
            className="w-9 h-9 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center"
            whileTap={{ scale: 0.92 }}>
            <ArrowLeft size={15} className="text-slate-600" />
          </motion.button>
          <h1 className="text-[14px] font-bold text-slate-900">Partner-Programm</h1>
          <div className="w-9" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Earnings Hero */}
        <motion.div
          className="rounded-3xl p-6 text-center relative overflow-hidden"
          style={{ background: tierStyle.bg }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-[42px] mb-1">{tierStyle.icon}</div>
          <p className="text-[11px] font-bold text-white/80 uppercase tracking-wider">{tier.label} Partner</p>
          <p className="text-[48px] font-black text-white font-outfit tabular-nums leading-none mt-2">
            €{data.total_earned.toFixed(2)}
          </p>
          <p className="text-[12px] text-white/80 mt-1">Gesamt verdient</p>
          <div className="flex justify-center gap-6 mt-4">
            <div>
              <p className="text-[20px] font-bold text-white">{data.total_refs}</p>
              <p className="text-[10px] text-white/70 uppercase">Geworben</p>
            </div>
            <div>
              <p className="text-[20px] font-bold text-white">{data.clicks || 0}</p>
              <p className="text-[10px] text-white/70 uppercase">Klicks</p>
            </div>
            <div>
              <p className="text-[20px] font-bold text-white">{(tier.bonus_mult * 100).toFixed(0)}%</p>
              <p className="text-[10px] text-white/70 uppercase">Multi</p>
            </div>
          </div>
        </motion.div>

        {/* Partner-Link Box */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Dein Partner-Link</p>
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3 mb-3 border border-slate-200">
            <p className="text-[13px] font-mono text-[#00C2FF] flex-1 truncate" data-testid="affiliate-link">
              {data.link}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              data-testid="affiliate-copy-btn"
              onClick={copyLink}
              className="py-3 rounded-xl font-bold text-[12px] flex items-center justify-center gap-2"
              style={{
                background: copied ? "rgba(0,210,106,0.15)" : "rgba(0,194,255,0.15)",
                border: `1px solid ${copied ? "rgba(0,210,106,0.3)" : "rgba(0,194,255,0.3)"}`,
                color: copied ? "#00D26A" : "#00C2FF",
              }}
              whileTap={{ scale: 0.97 }}
            >
              {copied ? <><CheckCircle2 size={14} /> Kopiert!</> : <><Copy size={14} /> Link kopieren</>}
            </motion.button>
            <motion.button
              data-testid="affiliate-share-btn"
              onClick={share}
              className="py-3 rounded-xl font-bold text-[12px] flex items-center justify-center gap-2 text-white"
              style={{ background: "linear-gradient(135deg,#A855F7,#EC4899)" }}
              whileTap={{ scale: 0.97 }}
            >
              <Share2 size={14} /> Teilen
            </motion.button>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-gradient-to-br from-[#00D26A]/10 to-[#00C2FF]/10 border border-[#00D26A]/20 rounded-2xl p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-[#00D26A]" />
            <h2 className="text-[13px] font-bold text-slate-900">So verdienst Du</h2>
          </div>
          <div className="space-y-2.5">
            {[
              { icon: "🎯", title: "Teile deinen Link", desc: "WhatsApp, Instagram, TikTok — überall" },
              { icon: "🎁", title: `${bonus.toFixed(2)}€ pro Anmeldung`, desc: `Sofort auf dein Wallet (${tier.label} Bonus)` },
              { icon: "📈", title: "10% vom ersten Kauf", desc: "Zusätzlich bei jeder bezahlten Transaktion" },
              { icon: "🚀", title: "Mehr werben = höhere Stufe", desc: "Silber (5) → Gold (20) → Diamant (100)" },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-[18px] flex-shrink-0">{s.icon}</span>
                <div>
                  <p className="text-[12px] font-bold text-slate-900">{s.title}</p>
                  <p className="text-[10px] text-slate-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Earnings */}
        {earnings.length > 0 && (
          <div>
            <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Letzte Einnahmen
            </h2>
            <div className="space-y-1.5">
              {earnings.map((e, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between shadow-[0_8px_22px_rgba(15,23,42,0.04)]" data-testid={`earning-${i}`}>
                  <div>
                    <p className="text-[11px] font-bold text-slate-900">
                      {e.type === "signup" ? "🎁 Neue Anmeldung" : "💰 Transaktion"}
                    </p>
                    <p className="text-[9px] text-slate-500">{new Date(e.created_at).toLocaleDateString("de-DE")}</p>
                  </div>
                  <p className="text-[13px] font-bold text-[#00D26A]">+€{e.amount.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        {lb.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={13} className="text-amber-400" />
              <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Top Partner</h2>
            </div>
            <div className="space-y-1.5">
              {lb.map((e) => (
                <div key={e.rank} className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center gap-3 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{
                      background: e.rank === 1 ? "#FFB800" : e.rank === 2 ? "#C0C0C0" : e.rank === 3 ? "#CD7F32" : "rgba(255,255,255,0.05)",
                      color: e.rank <= 3 ? "#000" : "#fff",
                    }}>
                    {e.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-slate-900 truncate">{e.display_name}</p>
                    <p className="text-[9px] text-slate-500">{e.referrals} Referrals</p>
                  </div>
                  <p className="text-[12px] font-bold text-[#00D26A]">€{e.total_earned.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AffiliatePage;
