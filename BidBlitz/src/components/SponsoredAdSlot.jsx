/**
 * SponsoredAdSlot — zeigt aktive bezahlte Werbebanner auf der HomePage
 * Rotiert alle 7 Sekunden durch die Anzeigen, trackt Clicks
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, ChevronRight } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function SponsoredAdSlot({ onNavigate }) {
  const [ads, setAds] = useState([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    fetch(`${API}/api/pro/ads/active`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setAds((d?.ads || []).slice(0, 5)))
      .catch(() => {});
  }, []);

  // Rotate
  useEffect(() => {
    if (ads.length < 2) return;
    const i = setInterval(() => setIdx(p => (p + 1) % ads.length), 7000);
    return () => clearInterval(i);
  }, [ads.length]);

  if (ads.length === 0) return null;
  const ad = ads[idx];

  const clickAd = async () => {
    try { fetch(`${API}/api/pro/ads/click/${ad.ad_id}`, { method: "POST" }); } catch (_err) { return; }
    if (ad.link_route) onNavigate && onNavigate(ad.link_route);
  };

  return (
    <div className="mb-4" data-testid="sponsored-slot">
      <p className="text-[9px] text-white/48 uppercase tracking-wider mb-1 ml-1">Anzeige</p>
      <AnimatePresence mode="wait">
        <motion.button
          key={ad.ad_id}
          onClick={clickAd}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
          className="w-full rounded-2xl p-4 relative overflow-hidden text-left"
          style={{
            background: `linear-gradient(135deg, ${ad.color || "#00C2FF"}32, ${ad.color || "#00C2FF"}12)`,
            border: `1px solid ${ad.color || "#00C2FF"}50`,
          }}
          data-testid={`ad-${ad.ad_id}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${ad.color || "#00C2FF"}38` }}>
              <Megaphone size={18} style={{ color: ad.color || "#00C2FF" }}/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-white truncate">{ad.title}</p>
              {ad.description && (
                <p className="text-[11px] text-white/82 truncate mt-0.5">{ad.description}</p>
              )}
              {ad.merchant_name && (
                <p className="text-[9px] text-white/58 mt-0.5">von {ad.merchant_name}</p>
              )}
            </div>
            {ad.link_route && <ChevronRight size={15} className="text-white/58"/>}
          </div>
          {/* Dots */}
          {ads.length > 1 && (
            <div className="flex justify-center gap-1 mt-2">
              {ads.map((_, i) => (
                <div key={i} className="h-1 rounded-full transition-all"
                  style={{
                    width: i === idx ? 16 : 4,
                    background: i === idx ? (ad.color || "#00C2FF") : "rgba(255,255,255,0.2)",
                  }}/>
              ))}
            </div>
          )}
        </motion.button>
      </AnimatePresence>
    </div>
  );
}
