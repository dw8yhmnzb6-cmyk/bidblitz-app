import { motion } from "framer-motion";
import { Home, Wallet, QrCode, Store, MoreHorizontal } from "lucide-react";

const navItems = [
  { id: "home", label: "Home", icon: Home, path: "/" },
  { id: "wallet", label: "Wallet", icon: Wallet, path: "/wallet" },
  { id: "scan", label: "Scan", icon: QrCode, path: "/scan", center: true },
  { id: "merchant", label: "Händler", icon: Store, path: "/merchant" },
  { id: "more", label: "More", icon: MoreHorizontal, path: "/more" },
];

export const BottomNav = ({ currentPath, onNavigate }) => {
  return (
    <motion.nav 
      className="bottom-nav" 
      data-testid="bottom-nav"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      {navItems.map((item, index) => {
        const Icon = item.icon;
        const isActive = currentPath === item.path;

        if (item.center) {
          return (
            <motion.button
              key={item.id}
              data-testid={`nav-${item.id}-btn`}
              className="nav-center"
              onClick={() => onNavigate(item.path)}
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.05 }}
              aria-label="Scan QR Code"
              initial={{ scale: 0, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 20 }}
            >
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                <Icon size={22} strokeWidth={2.5} className="sm:w-6 sm:h-6" />
              </motion.div>
              
              {/* Pulse ring effect */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-[#00C2FF]"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
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
            whileTap={{ scale: 0.92 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.05 }}
          >
            <motion.div
              animate={isActive ? { scale: [1, 1.15, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Icon size={18} strokeWidth={isActive ? 2 : 1.5} className="sm:w-5 sm:h-5" />
            </motion.div>
            <span className="uppercase tracking-wider font-medium">{item.label}</span>
            
            {/* Active indicator dot */}
            {isActive && (
              <motion.div
                className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-[#00C2FF]"
                layoutId="activeIndicator"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                style={{ boxShadow: "0 0 8px rgba(0, 194, 255, 0.8)" }}
              />
            )}
          </motion.button>
        );
      })}
    </motion.nav>
  );
};

export default BottomNav;
