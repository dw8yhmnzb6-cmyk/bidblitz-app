import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  User, 
  Settings, 
  HelpCircle, 
  Shield, 
  Bell, 
  CreditCard,
  Moon,
  LogOut,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { useUser } from "../store";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
  }
};

const menuItems = [
  { id: "profile", icon: User, label: "Profile", description: "Manage your account", color: "#00C2FF" },
  { id: "cards", icon: CreditCard, label: "Cards", description: "Manage payment cards", color: "#A855F7" },
  { id: "notifications", icon: Bell, label: "Notifications", description: "Notification preferences", color: "#FFB800" },
  { id: "security", icon: Shield, label: "Security", description: "Password & authentication", color: "#00D26A" },
  { id: "appearance", icon: Moon, label: "Appearance", description: "Dark mode enabled", color: "#6366F1" },
  { id: "settings", icon: Settings, label: "Settings", description: "App preferences", color: "#888" },
  { id: "help", icon: HelpCircle, label: "Help & Support", description: "Get assistance", color: "#FF6B6B" },
];

export const MorePage = ({ onNavigate }) => {
  const user = useUser();

  return (
    <motion.div
      data-testid="more-page"
      className="px-4 sm:px-6 pt-6 sm:pt-8"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.header 
        className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8"
        variants={itemVariants}
      >
        <motion.button
          data-testid="more-back-btn"
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center"
          whileHover={{ scale: 1.08, backgroundColor: "#1A1A1A" }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate("/")}
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
        >
          <ArrowLeft size={18} strokeWidth={1.5} className="text-white" />
        </motion.button>
        <h1 className="text-lg sm:text-xl font-semibold font-outfit text-white tracking-tight">More</h1>
      </motion.header>

      {/* Profile Card */}
      <motion.div
        className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8 flex items-center gap-4 sm:gap-5 relative overflow-hidden cursor-pointer"
        variants={itemVariants}
        style={{
          background: "linear-gradient(145deg, #111111 0%, #0A0A0A 100%)",
          border: "1px solid rgba(255, 255, 255, 0.05)"
        }}
        whileHover={{ scale: 1.02, borderColor: "rgba(0, 194, 255, 0.2)" }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="absolute -top-10 -left-10 w-24 sm:w-32 h-24 sm:h-32 rounded-full blur-3xl bg-[#00C2FF]/10" />
        
        <div className="relative">
          <img
            src={user.avatar}
            alt="Profile"
            className="rounded-full object-cover"
            style={{
              width: "60px",
              height: "60px",
              border: "3px solid rgba(0, 194, 255, 0.3)",
              boxShadow: "0 0 30px rgba(0, 194, 255, 0.2)"
            }}
          />
          {user.isPremium && (
            <motion.div 
              className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                boxShadow: "0 2px 10px rgba(255, 215, 0, 0.4)"
              }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles size={12} className="text-white" />
            </motion.div>
          )}
        </div>
        
        <div className="flex-1 relative z-10 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold font-outfit text-white truncate">{user.name}</h2>
          <p className="text-xs sm:text-sm text-[#666] truncate">{user.email}</p>
          {user.isPremium && (
            <span 
              className="inline-block mt-1.5 sm:mt-2 text-[9px] sm:text-[10px] uppercase tracking-widest font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full"
              style={{
                background: "linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 215, 0, 0.05) 100%)",
                color: "#FFD700",
                border: "1px solid rgba(255, 215, 0, 0.2)"
              }}
            >
              Premium
            </span>
          )}
        </div>
        <ChevronRight size={20} className="text-[#555] flex-shrink-0" />
      </motion.div>

      {/* Menu Items */}
      <motion.div 
        className="rounded-2xl sm:rounded-3xl overflow-hidden"
        variants={itemVariants}
        style={{
          background: "linear-gradient(145deg, #111111 0%, #0A0A0A 100%)",
          border: "1px solid rgba(255, 255, 255, 0.05)"
        }}
      >
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              data-testid={`menu-${item.id}-btn`}
              className="w-full flex items-center gap-3 sm:gap-4 p-4 sm:p-5 hover:bg-white/[0.02] transition-all duration-300 border-b border-white/5 last:border-b-0 group"
              variants={itemVariants}
              whileTap={{ scale: 0.98 }}
              whileHover={{ x: 4 }}
            >
              <motion.div 
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ 
                  background: `linear-gradient(135deg, ${item.color}15 0%, ${item.color}08 100%)` 
                }}
                whileHover={{ scale: 1.1 }}
              >
                <Icon size={18} strokeWidth={1.5} style={{ color: item.color }} className="sm:w-5 sm:h-5" />
              </motion.div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-medium text-white text-xs sm:text-sm group-hover:text-[#00C2FF] transition-colors truncate">{item.label}</p>
                <p className="text-[10px] sm:text-xs text-[#555] truncate">{item.description}</p>
              </div>
              <ChevronRight size={16} className="text-[#333] group-hover:text-[#555] transition-colors flex-shrink-0" />
            </motion.button>
          );
        })}
      </motion.div>

      {/* Logout Button */}
      <motion.button
        data-testid="logout-btn"
        className="w-full mt-6 sm:mt-8 py-3.5 sm:py-4 font-semibold rounded-full flex items-center justify-center gap-2 relative overflow-hidden text-sm"
        variants={itemVariants}
        style={{
          background: "linear-gradient(135deg, rgba(255, 71, 87, 0.1) 0%, rgba(255, 71, 87, 0.05) 100%)",
          border: "1px solid rgba(255, 71, 87, 0.2)"
        }}
        whileHover={{ scale: 1.02, borderColor: "rgba(255, 71, 87, 0.4)" }}
        whileTap={{ scale: 0.98 }}
        onClick={user.logout}
      >
        <LogOut size={18} strokeWidth={1.5} className="text-[#FF4757]" />
        <span className="text-[#FF4757]">Log Out</span>
      </motion.button>

      {/* App Version */}
      <motion.p 
        className="text-center text-[10px] sm:text-xs text-[#444] mt-6 sm:mt-8 font-medium"
        variants={itemVariants}
      >
        BidBlitz V2 · Version 2.0.0
      </motion.p>
    </motion.div>
  );
};

export default MorePage;
