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
  ChevronRight
} from "lucide-react";
import { userData } from "../data/mockData";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 }
};

const menuItems = [
  { id: "profile", icon: User, label: "Profile", description: "Manage your account" },
  { id: "cards", icon: CreditCard, label: "Cards", description: "Manage payment cards" },
  { id: "notifications", icon: Bell, label: "Notifications", description: "Notification preferences" },
  { id: "security", icon: Shield, label: "Security", description: "Password & authentication" },
  { id: "appearance", icon: Moon, label: "Appearance", description: "Dark mode enabled" },
  { id: "settings", icon: Settings, label: "Settings", description: "App preferences" },
  { id: "help", icon: HelpCircle, label: "Help & Support", description: "Get assistance" },
];

export const MorePage = ({ onNavigate }) => {
  return (
    <motion.div
      data-testid="more-page"
      className="px-5 pt-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.header 
        className="flex items-center gap-4 mb-6"
        variants={itemVariants}
      >
        <motion.button
          data-testid="more-back-btn"
          className="w-10 h-10 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate("/")}
        >
          <ArrowLeft size={18} strokeWidth={1.5} className="text-white" />
        </motion.button>
        <h1 className="text-xl font-semibold font-outfit text-white">More</h1>
      </motion.header>

      {/* Profile Card */}
      <motion.div
        className="bg-[#141414] rounded-3xl p-5 border border-white/5 mb-6 flex items-center gap-4"
        variants={itemVariants}
        whileHover={{ scale: 1.01 }}
      >
        <img
          src={userData.avatar}
          alt="Profile"
          className="w-16 h-16 rounded-full object-cover border-2 border-[#00C2FF]/30"
        />
        <div className="flex-1">
          <h2 className="text-lg font-semibold font-outfit text-white">{userData.name}</h2>
          <p className="text-sm text-[#A1A1AA]">{userData.email}</p>
        </div>
        <ChevronRight size={20} className="text-[#A1A1AA]" />
      </motion.div>

      {/* Menu Items */}
      <motion.div 
        className="bg-[#141414] rounded-3xl border border-white/5 overflow-hidden"
        variants={itemVariants}
      >
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              data-testid={`menu-${item.id}-btn`}
              className="w-full flex items-center gap-4 p-4 hover:bg-[#1A1A1A] transition-colors border-b border-white/5 last:border-b-0"
              variants={itemVariants}
              whileTap={{ scale: 0.98 }}
            >
              <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] flex items-center justify-center">
                <Icon size={20} strokeWidth={1.5} className="text-[#00C2FF]" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-white text-sm">{item.label}</p>
                <p className="text-xs text-[#A1A1AA]">{item.description}</p>
              </div>
              <ChevronRight size={18} className="text-[#A1A1AA]" />
            </motion.button>
          );
        })}
      </motion.div>

      {/* Logout Button */}
      <motion.button
        data-testid="logout-btn"
        className="w-full mt-6 py-4 bg-[#EF4444]/10 text-[#EF4444] font-semibold rounded-full flex items-center justify-center gap-2 border border-[#EF4444]/20"
        variants={itemVariants}
        whileHover={{ scale: 1.02, background: "rgba(239, 68, 68, 0.15)" }}
        whileTap={{ scale: 0.98 }}
      >
        <LogOut size={20} strokeWidth={1.5} />
        Log Out
      </motion.button>

      {/* App Version */}
      <motion.p 
        className="text-center text-xs text-[#A1A1AA] mt-6"
        variants={itemVariants}
      >
        BidBlitz V2 · Version 2.0.0
      </motion.p>
    </motion.div>
  );
};

export default MorePage;
