import { motion } from "framer-motion";
import { Home, Wallet, QrCode, Store, MoreHorizontal, Gavel, Car, Compass, Baby, ShoppingBag } from "lucide-react";
import { useI18n, useUser } from "../store";

// Customer navigation
const customerNavItems = [
  { id: "home", tKey: "nav.home", icon: Home, path: "/" },
  { id: "wallet", tKey: "nav.wallet", icon: Wallet, path: "/wallet" },
  { id: "pay", tKey: "nav.pay", icon: QrCode, path: "/receive-money", center: true },
  { id: "discover", label: "ENTDECKEN", icon: Compass, path: "/all-services" },
  { id: "more", tKey: "nav.more", icon: MoreHorizontal, path: "/more" },
];

// Kids mode navigation (parent view)
const kidsNavItems = [
  { id: "home", label: "KIDS", icon: Baby, path: "/kids" },
  { id: "wallet", tKey: "nav.wallet", icon: Wallet, path: "/wallet" },
  { id: "pay", tKey: "nav.pay", icon: QrCode, path: "/receive-money", center: true },
  { id: "discover", label: "ENTDECKEN", icon: Compass, path: "/all-services" },
  { id: "more", tKey: "nav.more", icon: MoreHorizontal, path: "/more" },
];

// Merchant mode navigation
const merchantModeNavItems = [
  { id: "home", tKey: "nav.home", icon: Home, path: "/" },
  { id: "wallet", tKey: "nav.wallet", icon: Wallet, path: "/wallet" },
  { id: "scan", tKey: "nav.scan", icon: QrCode, path: "/scan", center: true },
  { id: "merchant", label: "PORTAL", icon: Store, path: "/merchant-portal" },
  { id: "more", tKey: "nav.more", icon: MoreHorizontal, path: "/more" },
];

// Merchant navigation (role-based, legacy)
const merchantNavItems = [
  { id: "home", tKey: "nav.home", icon: Home, path: "/" },
  { id: "wallet", tKey: "nav.wallet", icon: Wallet, path: "/wallet" },
  { id: "scan", tKey: "nav.scan", icon: QrCode, path: "/scan", center: true },
  { id: "merchant", tKey: "nav.merchant", icon: Store, path: "/merchant" },
  { id: "more", tKey: "nav.more", icon: MoreHorizontal, path: "/more" },
];

// Driver navigation
const driverNavItems = [
  { id: "home", tKey: "nav.home", icon: Home, path: "/" },
  { id: "wallet", tKey: "nav.wallet", icon: Wallet, path: "/wallet" },
  { id: "pay", tKey: "nav.pay", icon: QrCode, path: "/receive-money", center: true },
  { id: "rides", label: "FAHRTEN", icon: Car, path: "/taxi" },
  { id: "more", tKey: "nav.more", icon: MoreHorizontal, path: "/more" },
];

// Admin navigation - full access
const adminNavItems = [
  { id: "home", tKey: "nav.home", icon: Home, path: "/" },
  { id: "wallet", tKey: "nav.wallet", icon: Wallet, path: "/wallet" },
  { id: "scan", tKey: "nav.scan", icon: QrCode, path: "/scan", center: true },
  { id: "merchant", tKey: "nav.merchant", icon: Store, path: "/merchant" },
  { id: "more", tKey: "nav.more", icon: MoreHorizontal, path: "/more" },
];

export const BottomNav = ({ currentPath, onNavigate, onShowBarcode }) => {
  const { t } = useI18n();
  const user = useUser();
  
  // Determine user type
  const isMerchantOrAdmin = user.role === "admin" || user.role === "merchant" || user.currentMode === "merchant";
  
  // Select navigation based on current MODE first, then role
  let navItems;
  if (user.currentMode === "kids") {
    navItems = kidsNavItems;
  } else if (user.currentMode === "merchant") {
    navItems = merchantModeNavItems;
  } else if (user.role === "admin") {
    navItems = adminNavItems;
  } else if (user.role === "merchant") {
    navItems = merchantNavItems;
  } else if (user.role === "driver") {
    navItems = driverNavItems;
  } else {
    navItems = customerNavItems;
  }

  // Handle center button click - role-based behavior
  const handleCenterButtonClick = () => {
    if (isMerchantOrAdmin) {
      // Merchant/Admin: Open scanner to scan customer barcodes
      onNavigate("/scan");
    } else {
      // Customer: Open receive-money page
      onNavigate("/receive-money");
    }
  };

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
            onClick={handleCenterButtonClick}
            whileTap={{ scale: 0.9 }}
            aria-label={isMerchantOrAdmin ? "Scan" : "Mein QR"}
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
          <span className="uppercase tracking-[0.06em] font-medium">{item.label || t(item.tKey)}</span>
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
