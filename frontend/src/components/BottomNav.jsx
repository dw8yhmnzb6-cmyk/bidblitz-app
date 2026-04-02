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
    <nav className="bottom-nav" data-testid="bottom-nav">
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
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              aria-label="Scan QR Code"
            >
              <Icon size={24} strokeWidth={2} />
            </motion.button>
          );
        }

        return (
          <motion.button
            key={item.id}
            data-testid={`nav-${item.id}-btn`}
            className={`nav-item ${isActive ? "active" : ""}`}
            onClick={() => onNavigate(item.path)}
            whileTap={{ scale: 0.95 }}
          >
            <Icon size={20} strokeWidth={1.5} />
            <span className="uppercase tracking-wider">{item.label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
