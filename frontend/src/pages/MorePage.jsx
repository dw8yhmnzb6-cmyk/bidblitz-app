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
import { userData } from "../data/mockData";

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
  return (
    <motion.div
      data-testid="more-page"
      className="px-6 pt-8"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.header 
        className="flex items-center gap-4 mb-8"
        variants={itemVariants}
      >
        <motion.button
          data-testid="more-back-btn"
          className="w-11 h-11 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center"
          whileHover={{ scale: 1.08, backgroundColor: "#1A1A1A" }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate("/")}
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
        >
          <ArrowLeft size={18} strokeWidth={1.5} className="text-white" />
        </motion.button>
        <h1 className="text-xl font-semibold font-outfit text-white tracking-tight">More</h1>
      </motion.header>

      {/* Profile Card - Premium */}
      <motion.div
        className="rounded-3xl p-6 mb-8 flex items-center gap-5 relative overflow-hidden cursor-pointer"
        variants={itemVariants}
        style={{
          background: "linear-gradient(145deg, #111111 0%, #0A0A0A 100%)",
          border: "1px solid rgba(255, 255, 255, 0.05)"
        }}
        whileHover={{ scale: 1.02, borderColor: "rgba(0, 194, 255, 0.2)" }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Glow */}
        <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full blur-3xl bg-[#00C2FF]/10" />
        
        <div className="relative">
          <img
            src={userData.avatar}
            alt="Profile"
            className="w-18 h-18 rounded-full object-cover"
            style={{
              width: "72px",
              height: "72px",
              border: "3px solid rgba(0, 194, 255, 0.3)",
              boxShadow: "0 0 30px rgba(0, 194, 255, 0.2)"
            }}
          />
          {/* Premium badge */}
          <motion.div 
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
              boxShadow: "0 2px 10px rgba(255, 215, 0, 0.4)"
            }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles size={14} className="text-white" />
          </motion.div>
        </div>
        
        <div className="flex-1 relative z-10">
          <h2 className="text-lg font-semibold font-outfit text-white">{userData.name}</h2>
          <p className="text-sm text-[#666]">{userData.email}</p>
          <span 
            className="inline-block mt-2 text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full"
            style={{
              background: "linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 215, 0, 0.05) 100%)",
              color: "#FFD700",
              border: "1px solid rgba(255, 215, 0, 0.2)"
            }}
          >
            Premium
          </span>
        </div>
        <ChevronRight size={22} className="text-[#555]" />
      </motion.div>

      {/* Menu Items - Premium */}
      <motion.div 
        className="rounded-3xl overflow-hidden"
        variants={itemVariants}
        style={{
          background: "linear-gradient(145deg, #111111 0%, #0A0A0A 100%)",
          border: "1px solid rgba(255, 255, 255, 0.05)"
        }}
      >
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              data-testid={`menu-${item.id}-btn`}
              className="w-full flex items-center gap-4 p-5 hover:bg-white/[0.02] transition-all duration-300 border-b border-white/5 last:border-b-0 group"
              variants={itemVariants}
              whileTap={{ scale: 0.98 }}
              whileHover={{ x: 4 }}
            >
              <motion.div 
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ 
                  background: `linear-gradient(135deg, ${item.color}15 0%, ${item.color}08 100%)` 
                }}
                whileHover={{ scale: 1.1 }}
              >
                <Icon size={22} strokeWidth={1.5} style={{ color: item.color }} />
              </motion.div>
              <div className="flex-1 text-left">
                <p className="font-medium text-white text-sm group-hover:text-[#00C2FF] transition-colors">{item.label}</p>
                <p className="text-xs text-[#555]">{item.description}</p>
              </div>
              <ChevronRight size={18} className="text-[#333] group-hover:text-[#555] transition-colors" />
            </motion.button>
          );
        })}
      </motion.div>

      {/* Logout Button - Premium */}
      <motion.button
        data-testid="logout-btn"
        className="w-full mt-8 py-4 font-semibold rounded-full flex items-center justify-center gap-2.5 relative overflow-hidden"
        variants={itemVariants}
        style={{
          background: "linear-gradient(135deg, rgba(255, 71, 87, 0.1) 0%, rgba(255, 71, 87, 0.05) 100%)",
          border: "1px solid rgba(255, 71, 87, 0.2)"
        }}
        whileHover={{ scale: 1.02, borderColor: "rgba(255, 71, 87, 0.4)" }}
        whileTap={{ scale: 0.98 }}
      >
        <LogOut size={20} strokeWidth={1.5} className="text-[#FF4757]" />
        <span className="text-[#FF4757]">Log Out</span>
      </motion.button>

      {/* App Version */}
      <motion.p 
        className="text-center text-xs text-[#444] mt-8 font-medium"
        variants={itemVariants}
      >
        BidBlitz V2 · Version 2.0.0
      </motion.p>
    </motion.div>
  );
};

export default MorePage;
