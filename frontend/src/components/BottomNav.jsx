import { motion } from "framer-motion";
import { Home, Wallet, QrCode, Store, MoreHorizontal } from "lucide-react";
import { useI18n } from "../store";

const navItems = [
  { id: "home", tKey: "nav.home", icon: Home, path: "/" },
  { id: "wallet", tKey: "nav.wallet", icon: Wallet, path: "/wallet" },
  { id: "scan", tKey: "nav.scan", icon: QrCode, path: "/scan", center: true },
  { id: "merchant", tKey: "nav.merchant", icon: Store, path: "/merchant" },
  { id: "more", tKey: "nav.more", icon: MoreHorizontal, path: "/more" },
];

export const BottomNav = ({ currentPath, onNavigate }) => {
  const { t } = useI18n();
  return (
  <motion.nav
    className="bottom-nav"
    data-testid="bottom-nav"
    initial={{ y: 80, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ delay: 0.2, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
  >
    {navItems.map((item) => {
      const Icon = item.icon;
      const isActive = currentPath === item.path;

      if (item.center) {
        return (
          <motion.button
            key={item.id}
            data-testid={`nav-${item.id}-btn`}
            className="nav-center"
            onClick={() => onNavigate(item.path)}
            whileTap={{ scale: 0.9 }}
            aria-label="Scan"
          >
            <Icon size={21} strokeWidth={2.5} />
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-[#00C2FF]"
              initial={{ scale: 1, opacity: 0.4 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
            />
          </motion.button>
        );
      }

      return (
        <motion.button
          key={item.id}
          data-testid={`nav-${item.id}-btn`}
          className={`nav-item ${isActive ? "active" : ""}`}
          onClick={() => onNavigate(item.path)}
          whileTap={{ scale: 0.9 }}
        >
          <motion.div animate={isActive ? { y: -1 } : { y: 0 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
            <Icon size={17} strokeWidth={isActive ? 2 : 1.5} />
          </motion.div>
          <span className="uppercase tracking-[0.06em] font-medium">{t(item.tKey)}</span>
          {isActive && (
            <motion.div
              className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-[#00C2FF]"
              layoutId="navDot"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              style={{ boxShadow: "0 0 6px rgba(0,194,255,0.7)" }}
            />
          )}
        </motion.button>
      );
    })}
  </motion.nav>
  );
};

export default BottomNav;
