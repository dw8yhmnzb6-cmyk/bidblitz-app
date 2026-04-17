/**
 * BlitzMinePage — Pi-Network style tap-to-earn mining.
 * Dedicated experience with Security Circle, Lockup, Roles, Referral bonus.
 * Uses BLZ token (same wallet as existing mining).
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  ChevronLeft, Zap, Users, Lock, Trophy, TrendingUp, Plus, X,
  Flame, Sparkles, Share2, Shield, Clock, Check, Loader2,
  ChevronRight, Unlock, Award, Star, UserPlus, Crown, Copy,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  let d = {};
  try { d = await r.clone().json(); } catch {}
  if (!r.ok) throw new Error(d.detail || d.message || `Error ${r.status}`);
  return d;
}

const ROLE_META = {
  pioneer:     { label: "Pioneer",     color: "#94A3B8", icon: Star,    desc: "Starter-Rolle. Tippe täglich, um PI zu verdienen." },
  contributor: { label: "Contributor", color: "#00C2FF", icon: Shield,  desc: "3+ Sessions & 1+ Circle-Mitglied. +20% Rate." },
  ambassador:  { label: "Ambassador",  color: "#A855F7", icon: Crown,   desc: "5+ aktive Referrals. +30% Rate." },
  node:        { label: "Node",        color: "#FFD700", icon: Sparkles, desc: "30+ Sessions, 5 Refs, 3 Circle. +50% Rate." },
};

const fmt = (n, d = 4) => Number(n || 0).toFixed(d);
const fmtTime = (sec) => {
  if (sec <= 0) return "00:00:00";
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(Math.floor(sec % 60)).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

// ── Top big tap-button with countdown & orbit particles ──
const TapButton = ({ data, onTap, onClaim, loading }) => {
  const [countdown, setCountdown] = useState(data?.session?.remaining_seconds || 0);
  const active = !!data?.session;
  const ready = data?.session?.ready_to_claim || countdown <= 0;
  const hasSession = active && !ready;

  useEffect(() => {
    setCountdown(data?.session?.remaining_seconds || 0);
  }, [data?.session?.remaining_seconds]);

  useEffect(() => {
    if (!hasSession) return;
    const iv = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(iv);
  }, [hasSession]);

  const onClick = () => {
    if (loading) return;
    if (!active) onTap();
    else if (ready) onClaim();
  };

  const label =
    !active ? "Jetzt Mining starten"
    : ready ? "Belohnung abholen"
    : fmtTime(countdown);

  const ringColor = !active ? "#FFD700" : ready ? "#00E89D" : "#00C2FF";

  return (
    <div className="relative flex flex-col items-center">
      {/* Orbit rings */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      >
        <div className="w-[280px] h-[280px] rounded-full border border-dashed" style={{ borderColor: `${ringColor}30` }} />
      </motion.div>
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        animate={{ rotate: -360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        <div className="w-[240px] h-[240px] rounded-full border border-dashed" style={{ borderColor: `${ringColor}20` }} />
      </motion.div>

      <motion.button
        data-testid="blitz-mine-tap-btn"
        onClick={onClick}
        disabled={loading}
        whileTap={{ scale: 0.94 }}
        className="relative w-[200px] h-[200px] rounded-full flex flex-col items-center justify-center overflow-hidden"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${ringColor}35, #050505 70%)`,
          border: `2px solid ${ringColor}`,
          boxShadow: `0 0 40px ${ringColor}40, inset 0 0 60px ${ringColor}20`,
        }}
      >
        {loading ? (
          <Loader2 size={40} className="animate-spin text-white/80" />
        ) : (
          <>
            <Zap size={44} strokeWidth={1.6} style={{ color: ringColor }} />
            <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-white/90">
              {!active ? "TAP" : ready ? "CLAIM" : "MINING"}
            </p>
            <p className="mt-1 text-[12px] font-mono text-white/70">{label}</p>
            {active && !ready && (
              <p className="text-[9px] text-white/50 mt-0.5">
                +{fmt(data?.rate?.estimated_session_earnings, 4)} BLZ
              </p>
            )}
          </>
        )}
      </motion.button>
    </div>
  );
};

// ── Stats Row ──
const StatChip = ({ icon: Icon, label, value, color }) => (
  <div
    className="flex items-center gap-2 rounded-xl px-3 py-2"
    style={{ background: `${color}10`, border: `1px solid ${color}25` }}
  >
    <Icon size={14} style={{ color }} />
    <div className="min-w-0">
      <p className="text-[9px] uppercase text-white/50 tracking-wider font-semibold">{label}</p>
      <p className="text-[12px] font-bold text-white truncate">{value}</p>
    </div>
  </div>
);

// ── Rate Breakdown ──
const RateBreakdown = ({ rate }) => {
  if (!rate) return null;
  const rows = [
    { label: "Base Rate", val: `${fmt(rate.base_rate_per_hour * 24, 4)} BLZ/Tag`, color: "#94A3B8" },
    { label: `Role (${rate.role})`, val: `×${rate.role_multiplier}`, color: ROLE_META[rate.role]?.color || "#94A3B8" },
    { label: `Security Circle (${rate.circle_count})`, val: `+${(rate.circle_bonus * 100).toFixed(0)}%`, color: "#00C2FF" },
    { label: `Referrals (${rate.referrals_active})`, val: `+${(rate.referral_bonus * 100).toFixed(0)}%`, color: "#A855F7" },
    { label: "Lockup Bonus", val: `+${(rate.lockup_bonus * 100).toFixed(0)}%`, color: "#FFD700" },
  ];
  return (
    <div
      className="rounded-2xl p-4 space-y-2"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="flex justify-between items-center mb-2">
        <p className="text-[11px] font-semibold uppercase text-white/60 tracking-wider">Deine Rate</p>
        <p className="text-[14px] font-bold text-[#00E89D]">
          {fmt(rate.rate_per_hour, 5)} BLZ/h
        </p>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between items-center text-[11px]">
          <span className="text-white/70">{r.label}</span>
          <span style={{ color: r.color }} className="font-semibold">{r.val}</span>
        </div>
      ))}
      <div className="border-t border-white/5 pt-2 flex justify-between items-center">
        <span className="text-[11px] font-semibold text-white">Gesamt-Multiplikator</span>
        <span className="text-[13px] font-bold text-[#FFD700]">×{rate.total_multiplier}</span>
      </div>
    </div>
  );
};

// ── Security Circle Widget ──
const SecurityCircleWidget = ({ circle, onAdd, onRemove }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const members = circle?.members || [];
  const slots = Array.from({ length: circle?.max || 5 });

  const submit = async () => {
    if (!input.trim()) return;
    setBusy(true);
    try {
      await onAdd(input.trim());
      setInput("");
      setShowAdd(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(0,194,255,0.04)", border: "1px solid rgba(0,194,255,0.15)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-[#00C2FF]" />
          <p className="text-[13px] font-bold text-white">Security Circle</p>
        </div>
        <p className="text-[10px] text-[#00C2FF] font-semibold">
          +{((circle?.current_bonus || 0) * 100).toFixed(0)}%
        </p>
      </div>
      <div className="grid grid-cols-5 gap-2 mb-3">
        {slots.map((_, i) => {
          const m = members[i];
          return m ? (
            <motion.button
              data-testid={`circle-member-${i}`}
              key={m.user_id}
              onClick={() => onRemove(m.user_id)}
              whileTap={{ scale: 0.9 }}
              className="aspect-square rounded-full flex flex-col items-center justify-center relative group"
              style={{ background: "linear-gradient(135deg,#00C2FF,#00E89D)" }}
            >
              <p className="text-[11px] font-bold text-black uppercase">
                {m.username?.[0] || "P"}
              </p>
              <X size={12} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition" />
            </motion.button>
          ) : (
            <motion.button
              data-testid={`circle-slot-${i}`}
              key={i}
              onClick={() => setShowAdd(true)}
              whileTap={{ scale: 0.9 }}
              className="aspect-square rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }}
            >
              <Plus size={16} className="text-white/40" />
            </motion.button>
          );
        })}
      </div>
      <p className="text-[10px] text-white/50 leading-relaxed">
        Füge bis zu {circle?.max || 5} vertrauenswürdige Pioneers hinzu. Jedes Mitglied gibt dir
        +{((circle?.bonus_per_member || 0.2) * 100).toFixed(0)}% Mining-Rate.
      </p>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <div className="flex gap-2">
              <input
                data-testid="circle-add-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Username, E-Mail oder Code"
                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-[#00C2FF]"
              />
              <button
                data-testid="circle-add-submit"
                onClick={submit}
                disabled={busy}
                className="px-4 rounded-lg bg-[#00C2FF] text-black text-[12px] font-bold disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : "Hinzufügen"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Lockup Widget ──
const LockupWidget = ({ lockups, constants, balance, onCreate, onRelease }) => {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState(365);
  const [busy, setBusy] = useState(false);
  const durations = constants?.durations || [];
  const active = (lockups || []).filter((l) => l.status === "active");
  const totalLocked = active.reduce((s, l) => s + (l.amount || 0), 0);
  const totalBonus = active.reduce((s, l) => s + (l.bonus_rate || 0), 0);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Bitte Betrag angeben.");
    if (amt > balance) return toast.error("Nicht genug BLZ im Wallet.");
    setBusy(true);
    try {
      await onCreate(amt, duration);
      setAmount("");
      setShowForm(false);
      toast.success("Lockup erstellt! Rate wurde erhöht.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(255,215,0,0.03)", border: "1px solid rgba(255,215,0,0.15)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lock size={15} className="text-[#FFD700]" />
          <p className="text-[13px] font-bold text-white">Lockup</p>
        </div>
        <p className="text-[10px] text-[#FFD700] font-semibold">
          +{(totalBonus * 100).toFixed(0)}% Bonus
        </p>
      </div>

      {totalLocked > 0 && (
        <div className="flex justify-between text-[11px] text-white/60 mb-3">
          <span>{fmt(totalLocked, 2)} BLZ gelockt</span>
          <span>{active.length} aktiv</span>
        </div>
      )}

      <div className="space-y-1.5 mb-3">
        {active.slice(0, 3).map((l, i) => (
          <div key={i} className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2">
            <div>
              <p className="text-[11px] text-white font-semibold">{fmt(l.amount, 2)} BLZ</p>
              <p className="text-[9px] text-white/50">
                +{(l.bonus_rate * 100).toFixed(0)}% · bis {new Date(l.ends_at).toLocaleDateString("de-DE")}
              </p>
            </div>
            <button
              data-testid={`lockup-release-${i}`}
              onClick={() => onRelease(l._id || l.id)}
              className="text-[10px] text-red-400 hover:text-red-300"
            >
              <Unlock size={14} />
            </button>
          </div>
        ))}
      </div>

      {!showForm ? (
        <motion.button
          data-testid="lockup-new-btn"
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowForm(true)}
          className="w-full rounded-xl py-2.5 bg-[#FFD700]/10 border border-[#FFD700]/30 text-[12px] font-bold text-[#FFD700]"
        >
          + Neuer Lockup (Balance: {fmt(balance, 2)} BLZ)
        </motion.button>
      ) : (
        <div className="space-y-2">
          <input
            data-testid="lockup-amount-input"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="BLZ Betrag"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            {durations.map((d) => (
              <button
                key={d.days}
                data-testid={`lockup-duration-${d.days}`}
                onClick={() => setDuration(d.days)}
                className="rounded-lg py-2 text-[11px] font-semibold"
                style={{
                  background: duration === d.days ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${duration === d.days ? "#FFD700" : "rgba(255,255,255,0.08)"}`,
                  color: duration === d.days ? "#FFD700" : "#fff",
                }}
              >
                {d.label} · +{(d.multiplier * 100).toFixed(0)}%
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-[11px] text-white/70">Abbrechen</button>
            <button
              data-testid="lockup-submit-btn"
              onClick={submit}
              disabled={busy}
              className="flex-1 py-2 rounded-lg bg-[#FFD700] text-black text-[11px] font-bold disabled:opacity-50"
            >
              {busy ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Lockup erstellen"}
            </button>
          </div>
        </div>
      )}
      <p className="text-[9px] text-white/40 mt-2 leading-relaxed">
        Vorzeitiges Auflösen: {((constants?.early_release_penalty || 0.25) * 100).toFixed(0)}% Strafe.
      </p>
    </div>
  );
};

// ── Referral summary widget ──
const ReferralWidget = ({ data, referralCode, onShare, onShowQr }) => {
  if (!data) return null;
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.2)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-[#A855F7]" />
          <p className="text-[13px] font-bold text-white">Referral Team</p>
        </div>
        <p className="text-[10px] text-[#A855F7] font-semibold">+{(data.current_bonus * 100).toFixed(0)}%</p>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-2 rounded-lg bg-black/30">
          <p className="text-[16px] font-bold text-white">{data.total}</p>
          <p className="text-[9px] text-white/50 uppercase">Team</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-black/30">
          <p className="text-[16px] font-bold text-[#00E89D]">{data.active_last_7d}</p>
          <p className="text-[9px] text-white/50 uppercase">Aktiv 7d</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-black/30">
          <p className="text-[16px] font-bold text-[#FFD700]">
            +{(data.bonus_per_active * 100).toFixed(0)}%
          </p>
          <p className="text-[9px] text-white/50 uppercase">Pro aktiv</p>
        </div>
      </div>
      {referralCode && (
        <div className="mb-3 rounded-lg bg-black/40 border border-white/5 px-3 py-2 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[9px] text-white/40 uppercase">Dein Code</p>
            <p className="text-[13px] font-bold text-[#A855F7] font-mono truncate">{referralCode}</p>
          </div>
          <button
            data-testid="mine-copy-code"
            onClick={() => {
              navigator.clipboard.writeText(referralCode);
              toast.success("Code kopiert!");
            }}
            className="text-white/60 hover:text-white"
          >
            <Copy size={14} />
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <motion.button
          data-testid="mine-share-btn"
          whileTap={{ scale: 0.96 }}
          onClick={onShare}
          className="rounded-xl py-2.5 bg-[#A855F7]/10 border border-[#A855F7]/30 text-[12px] font-bold text-[#A855F7] flex items-center justify-center gap-2"
        >
          <Share2 size={14} /> Teilen
        </motion.button>
        <motion.button
          data-testid="mine-qr-btn"
          whileTap={{ scale: 0.96 }}
          onClick={onShowQr}
          className="rounded-xl py-2.5 bg-white text-black text-[12px] font-bold flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="3" height="3" />
            <rect x="18" y="14" width="3" height="3" /><rect x="14" y="18" width="3" height="3" />
          </svg> QR-Code
        </motion.button>
      </div>
    </div>
  );
};

// ── QR Code Modal ──
const QrModal = ({ open, onClose, url, code, onShare }) => {
  if (!open) return null;
  return (
    <motion.div
      data-testid="mine-qr-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 relative"
        style={{
          background: "linear-gradient(160deg, #1a0f2e 0%, #050505 100%)",
          border: "1px solid rgba(168,85,247,0.25)",
        }}
      >
        <button
          data-testid="mine-qr-close"
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
          onClick={onClose}
        >
          <X size={14} />
        </button>
        <div className="text-center mb-4">
          <p className="text-[11px] text-[#A855F7] font-bold uppercase tracking-wider">BlitzMine</p>
          <p className="text-[18px] font-bold text-white mt-1">Lad deine Freunde ein</p>
          <p className="text-[11px] text-white/50 mt-1">
            +{(0.05 * 100).toFixed(0)}% Rate pro aktivem Referral
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 mx-auto w-fit">
          <QRCodeSVG
            value={url}
            size={220}
            level="M"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#0a0a0a"
          />
        </div>
        {code && (
          <p className="text-center text-white/70 text-[11px] mt-3">
            Code: <span className="font-mono font-bold text-[#A855F7]">{code}</span>
          </p>
        )}
        <div className="flex gap-2 mt-5">
          <button
            data-testid="mine-qr-copy-link"
            onClick={() => {
              navigator.clipboard.writeText(url);
              toast.success("Link kopiert!");
            }}
            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-[12px] font-semibold text-white flex items-center justify-center gap-2"
          >
            <Copy size={14} /> Link kopieren
          </button>
          <button
            data-testid="mine-qr-share"
            onClick={onShare}
            className="flex-1 py-3 rounded-xl bg-[#A855F7] text-white text-[12px] font-bold flex items-center justify-center gap-2"
          >
            <Share2 size={14} /> Jetzt teilen
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Leaderboard ──
const LeaderboardWidget = ({ items }) => {
  if (!items?.length) return null;
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(255,215,0,0.03)", border: "1px solid rgba(255,215,0,0.12)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Trophy size={15} className="text-[#FFD700]" />
        <p className="text-[13px] font-bold text-white">Top Pioneers</p>
      </div>
      <div className="space-y-1.5">
        {items.slice(0, 5).map((u, i) => (
          <div key={u.user_id} className="flex items-center gap-3">
            <p className="w-5 text-[11px] font-bold" style={{ color: ["#FFD700", "#C0C0C0", "#CD7F32", "#fff", "#fff"][i] }}>#{i + 1}</p>
            <p className="flex-1 text-[12px] text-white truncate">{u.username}</p>
            <p className="text-[11px] text-[#00E89D] font-bold">{fmt(u.total_mined, 2)} BLZ</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main Page ──
const BlitzMinePage = ({ onBack, onNavigate }) => {
  const [data, setData] = useState(null);
  const [circle, setCircle] = useState(null);
  const [lockups, setLockups] = useState([]);
  const [refs, setRefs] = useState(null);
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [showQr, setShowQr] = useState(false);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const [s, c, l, r, lb, mc] = await Promise.all([
        api("/api/blitz-mine/status"),
        api("/api/blitz-mine/circle"),
        api("/api/blitz-mine/lockup"),
        api("/api/blitz-mine/referrals"),
        api("/api/blitz-mine/leaderboard"),
        api("/api/referral/my-code").catch(() => ({})),
      ]);
      setData(s);
      setCircle(c);
      setLockups(l.lockups || []);
      setRefs(r);
      setBoard(lb.leaderboard || []);
      setReferralCode(mc?.code || mc?.referral_code || "");
    } catch (e) {
      if (firstLoad.current) toast.error(e.message);
    } finally {
      firstLoad.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const onTap = async () => {
    setLoading(true);
    try {
      const res = await api("/api/blitz-mine/tap", { method: "POST" });
      toast.success(res.message);
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const onClaim = async () => {
    setLoading(true);
    try {
      const res = await api("/api/blitz-mine/claim", { method: "POST" });
      toast.success(`+${fmt(res.amount_blz, 4)} BLZ gesammelt! 🎉`);
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const onAddCircle = async (identifier) => {
    await api("/api/blitz-mine/circle/add", {
      method: "POST",
      body: JSON.stringify({ identifier }),
    });
    toast.success("Mitglied hinzugefügt.");
    await load();
  };

  const onRemoveCircle = async (member_id) => {
    await api(`/api/blitz-mine/circle/${member_id}`, { method: "DELETE" });
    toast.success("Entfernt.");
    await load();
  };

  const onCreateLockup = async (amount, duration_days) => {
    await api("/api/blitz-mine/lockup", {
      method: "POST",
      body: JSON.stringify({ amount, duration_days }),
    });
    await load();
  };

  const onReleaseLockup = async (id) => {
    if (!id) return;
    if (!window.confirm("Lockup jetzt auflösen? Es kann eine Strafe anfallen.")) return;
    try {
      const res = await api(`/api/blitz-mine/lockup/${id}/release`, { method: "POST" });
      toast.success(`+${fmt(res.refund_blz, 2)} BLZ zurückerstattet (Strafe: ${fmt(res.penalty_blz, 2)}).`);
      await load();
    } catch (e) { toast.error(e.message); }
  };

  const refLink = referralCode
    ? `${window.location.origin}?ref=${encodeURIComponent(referralCode)}`
    : window.location.origin;

  const onShare = () => {
    const text = referralCode
      ? `Mine kostenlos BLZ auf BidBlitz! Nutze meinen Code: ${referralCode}`
      : "Mine kostenlos BLZ auf BidBlitz!";
    if (navigator.share) {
      navigator.share({ title: "BlitzMine", text, url: refLink }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text}\n${refLink}`);
      toast.success("Link kopiert!");
    }
  };

  const RoleIcon = ROLE_META[data?.profile?.role]?.icon || Star;
  const roleColor = ROLE_META[data?.profile?.role]?.color || "#94A3B8";

  return (
    <motion.div
      data-testid="blitz-mine-page"
      className="min-h-screen"
      style={{ background: "#050505", color: "white" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 sticky top-0 z-20 backdrop-blur-xl" style={{ background: "rgba(5,5,5,0.85)" }}>
        <motion.button
          data-testid="blitz-mine-back"
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
        >
          <ChevronLeft size={18} />
        </motion.button>
        <div className="flex-1">
          <p className="text-[11px] text-white/50 uppercase tracking-[0.2em] font-bold">BlitzMine</p>
          <p className="text-[16px] font-bold">Tap-to-Earn</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-white/40 uppercase">Balance</p>
          <p className="text-[13px] font-bold text-[#00E89D]">{fmt(data?.balance_blz, 2)} BLZ</p>
        </div>
      </div>

      <div className="px-5 pb-24 space-y-5">
        {/* Tap button */}
        <div className="flex flex-col items-center pt-4 pb-2">
          <TapButton data={data} onTap={onTap} onClaim={onClaim} loading={loading} />
        </div>

        {/* Role strip */}
        {data?.profile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: `${roleColor}08`, border: `1px solid ${roleColor}30` }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: `${roleColor}20`, border: `1px solid ${roleColor}` }}
            >
              <RoleIcon size={20} style={{ color: roleColor }} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold" style={{ color: roleColor }}>
                {ROLE_META[data.profile.role]?.label}
              </p>
              <p className="text-[10px] text-white/50">
                {ROLE_META[data.profile.role]?.desc}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-white/40 uppercase">Streak</p>
              <p className="text-[14px] font-bold text-[#FFD700] flex items-center gap-1">
                <Flame size={12} /> {data.profile.streak_days}d
              </p>
            </div>
          </motion.div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatChip icon={Award} label="Total Mined" value={`${fmt(data?.profile?.total_mined, 2)} BLZ`} color="#00E89D" />
          <StatChip icon={Clock} label="Sessions" value={data?.profile?.total_sessions || 0} color="#00C2FF" />
          <StatChip icon={Sparkles} label="Multiplier" value={`×${data?.rate?.total_multiplier || 1}`} color="#FFD700" />
        </div>

        {/* Rate breakdown */}
        <RateBreakdown rate={data?.rate} />

        {/* Security Circle */}
        <SecurityCircleWidget circle={circle} onAdd={onAddCircle} onRemove={onRemoveCircle} />

        {/* Referral */}
        <ReferralWidget data={refs} referralCode={referralCode} onShare={onShare} onShowQr={() => setShowQr(true)} />

        {/* Lockup */}
        <LockupWidget
          lockups={lockups}
          constants={data?.constants}
          balance={data?.balance_blz || 0}
          onCreate={onCreateLockup}
          onRelease={onReleaseLockup}
        />

        {/* Leaderboard */}
        <LeaderboardWidget items={board} />

        {/* Link to classic mining */}
        <motion.button
          data-testid="goto-classic-mining"
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate?.("/mining")}
          className="w-full rounded-2xl p-4 flex items-center justify-between"
          style={{ background: "rgba(0,194,255,0.03)", border: "1px solid rgba(0,194,255,0.15)" }}
        >
          <div className="flex items-center gap-3 text-left">
            <Shield size={18} className="text-[#00C2FF]" />
            <div>
              <p className="text-[12px] font-bold text-white">Hardware Mining aktivieren</p>
              <p className="text-[10px] text-white/50">Miner-Rigs kaufen & passiv mehr BLZ verdienen</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-white/40" />
        </motion.button>
      </div>

      {/* QR Modal */}
      <AnimatePresence>
        {showQr && (
          <QrModal
            open={showQr}
            onClose={() => setShowQr(false)}
            url={refLink}
            code={referralCode}
            onShare={onShare}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BlitzMinePage;
