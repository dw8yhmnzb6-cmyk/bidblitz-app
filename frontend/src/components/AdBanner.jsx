import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.REACT_APP_BACKEND_URL;

const AdBanner = ({ onNavigate }) => {
  const [ads, setAds] = useState([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    fetch(`${API}/api/pro/ads/active`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setAds(d.ads || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(() => setCurrent(c => (c + 1) % ads.length), 5000);
    return () => clearInterval(timer);
  }, [ads.length]);

  if (ads.length === 0) return null;
  const ad = ads[current];

  const handleClick = () => {
    fetch(`${API}/api/pro/ads/click/${ad.ad_id}`, { method: "POST" }).catch(() => {});
    if (ad.link_route) onNavigate(ad.link_route);
  };

  return (
    <motion.div
      key={ad.ad_id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={handleClick}
      className="relative rounded-2xl overflow-hidden cursor-pointer"
      style={{ background: `linear-gradient(135deg, ${ad.color}15, ${ad.color}08)`, border: `1px solid ${ad.color}20` }}
      data-testid="ad-banner"
    >
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${ad.color}20` }}>
          <span className="text-lg">📢</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-white truncate">{ad.title}</p>
          {ad.description && <p className="text-[10px] text-gray-400 truncate">{ad.description}</p>}
        </div>
        <span className="text-[7px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 shrink-0">Anzeige</span>
      </div>
      {ads.length > 1 && (
        <div className="flex gap-1 justify-center pb-2">
          {ads.map((_, i) => (
            <div key={i} className={`w-1 h-1 rounded-full ${i === current ? "bg-white/60" : "bg-white/15"}`} />
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default AdBanner;
