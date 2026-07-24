import { motion } from "framer-motion";

const API = process.env.REACT_APP_BACKEND_URL;

export const slide = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

export async function adminApi(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) throw new Error("Sitzung abgelaufen. Bitte neu anmelden.");
  if (!r.ok) throw new Error(d.detail || "Request failed");
  return d;
}

export const Skeleton = ({ className }) => (
  <div className={`relative overflow-hidden rounded-xl ${className}`} style={{ background: "rgba(255,255,255,0.025)" }}>
    <motion.div
      className="absolute inset-0"
      style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)" }}
      animate={{ x: ["-100%", "100%"] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);

export const StatCard = ({ icon: Icon, label, value, sub, color, delay = 0 }) => (
  <motion.div
    className="rounded-2xl p-3.5 relative overflow-hidden"
    style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.04)" }}
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, ...slide }}
  >
    <div
      className="absolute -top-6 -right-6 w-16 h-16 rounded-full pointer-events-none"
      style={{ background: color, filter: "blur(30px)", opacity: 0.08 }}
    />
    <div className="flex items-center gap-1.5 mb-2 relative z-10">
      <Icon size={12} style={{ color }} />
      <span className="text-[8px] text-[#3A3A3A] uppercase tracking-[0.1em] font-semibold">{label}</span>
    </div>
    <p className="text-[15px] font-bold font-outfit text-white/90 relative z-10">{value}</p>
    {sub && <p className="text-[9px] text-[#333] font-medium mt-0.5 relative z-10">{sub}</p>}
  </motion.div>
);

export const statusColors = {
  pending: "#FFB800",
  approved: "#00C2FF",
  processed: "#00D26A",
  failed: "#FF4757",
  cancelled: "#666",
  completed: "#00D26A",
};
