/**
 * RecommendAppCard — Kompakte "App empfehlen"-Karte für die HomePage.
 * Nutzt das existierende Affiliate-Programm → /api/affiliate/me für Tracking.
 * Native Web Share API + Copy-Fallback + Direkt-Links zu WhatsApp & SMS.
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Share2, Copy, Check, Gift, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function RecommendAppCard({ isGuest, onNavigate }) {
  const [code, setCode] = useState(null);
  const [link, setLink] = useState("https://bidblitz.ae/");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isGuest) return;
    fetch(`${API}/api/affiliate/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.code) {
          setCode(d.code);
          setLink(d.link || `https://bidblitz.ae/?ref=${d.code}`);
        }
      })
      .catch(() => {});
  }, [isGuest]);

  const shareText = `Hey! Komm zu BidBlitz — Bezahlen, Verdienen, Fahren, Einkaufen in einer App. 5€ Willkommens-Bonus: ${link}`;

  const doShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "BidBlitz — Die Super-App",
          text: "Komm zu BidBlitz und hol dir 5€ Willkommens-Bonus!",
          url: link,
        });
      } catch {} // user cancelled
      return;
    }
    // Desktop / fallback
    await copyLink();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link kopiert!");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("Kopieren fehlgeschlagen"); }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const smsUrl = `sms:?&body=${encodeURIComponent(shareText)}`;

  if (isGuest) return null;

  return (
    <motion.div
      data-testid="recommend-app-card"
      className="rounded-2xl p-4 mb-4 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(255,107,157,0.18) 0%, rgba(168,85,247,0.12) 100%)",
        border: "1px solid rgba(255,107,157,0.25)",
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start gap-3 mb-3">
        <motion.div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#FF6B9D,#A855F7)" }}
          animate={{ rotate: [0, -6, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
        >
          <Gift size={18} className="text-white" strokeWidth={2.5} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-white leading-tight">BidBlitz empfehlen</p>
          <p className="text-[11px] text-white/70 leading-tight mt-0.5">
            5€ pro Anmeldung + 10% Provision — teile mit Freunden
          </p>
        </div>
      </div>

      <div className="bg-black/30 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
        <p className="text-[11px] text-[#00C2FF] font-mono truncate flex-1" data-testid="recommend-link">
          {link}
        </p>
        <button onClick={copyLink} data-testid="recommend-copy" className="p-1">
          {copied ? <Check size={13} className="text-[#00D26A]" /> : <Copy size={13} className="text-white/60" />}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <motion.button
          data-testid="recommend-share"
          onClick={doShare}
          whileTap={{ scale: 0.95 }}
          className="py-2.5 rounded-lg text-[11px] font-bold text-white flex items-center justify-center gap-1"
          style={{ background: "linear-gradient(135deg,#FF6B9D,#A855F7)" }}
        >
          <Share2 size={12} /> Teilen
        </motion.button>
        <motion.a
          data-testid="recommend-whatsapp"
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          whileTap={{ scale: 0.95 }}
          className="py-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1"
          style={{ background: "rgba(37,211,102,0.15)", color: "#25D366", border: "1px solid rgba(37,211,102,0.3)" }}
        >
          WhatsApp
        </motion.a>
        <motion.a
          data-testid="recommend-sms"
          href={smsUrl}
          whileTap={{ scale: 0.95 }}
          className="py-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1"
          style={{ background: "rgba(0,194,255,0.12)", color: "#00C2FF", border: "1px solid rgba(0,194,255,0.25)" }}
        >
          <MessageCircle size={12} /> SMS
        </motion.a>
        <motion.button
          data-testid="recommend-details"
          onClick={() => onNavigate && onNavigate("/affiliate")}
          whileTap={{ scale: 0.95 }}
          className="py-2.5 rounded-lg text-[11px] font-bold text-white/80 border border-white/10 bg-white/5"
        >
          Details
        </motion.button>
      </div>

      {code && (
        <p className="text-[9px] text-white/40 uppercase tracking-wider mt-2 text-center">
          Dein Code: <span className="font-mono text-white/70">{code}</span>
        </p>
      )}
    </motion.div>
  );
}
