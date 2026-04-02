import { motion } from "framer-motion";
import { Bell, ChevronRight, Sparkles, TrendingUp } from "lucide-react";
import { userData, walletData, features, getGreeting } from "../data/mockData";
import { FeatureCard } from "../components/FeatureCard";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
  }
};

export const HomePage = ({ onNavigate }) => {
  return (
    <motion.div
      data-testid="home-page"
      className="px-4 sm:px-6 pt-6 sm:pt-8 pb-4"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.header 
        className="flex items-center justify-between mb-6 sm:mb-10"
        variants={itemVariants}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <motion.div
            className="relative"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <img
              src={userData.avatar}
              alt="Profile"
              className="w-11 h-11 sm:w-14 sm:h-14 rounded-full object-cover"
              style={{
                border: "2px solid rgba(0, 194, 255, 0.3)",
                boxShadow: "0 0 20px rgba(0, 194, 255, 0.2)"
              }}
            />
            {/* Online indicator */}
            <div className="absolute bottom-0 right-0 w-3 h-3 sm:w-4 sm:h-4 bg-[#00D26A] rounded-full border-2 border-[#0A0A0A]" />
          </motion.div>
          <div>
            <p className="text-[#666] text-xs sm:text-sm font-medium">{getGreeting()}</p>
            <h2 className="text-white font-semibold font-outfit text-lg sm:text-xl tracking-tight">{userData.name}</h2>
          </div>
        </div>
        
        <motion.button
          data-testid="notification-btn"
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center relative"
          whileHover={{ scale: 1.08, backgroundColor: "#1A1A1A" }}
          whileTap={{ scale: 0.95 }}
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
        >
          <Bell size={18} strokeWidth={1.5} className="text-white" />
          <motion.span 
            className="absolute top-2 right-2 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-[#00C2FF] rounded-full"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ boxShadow: "0 0 8px rgba(0, 194, 255, 0.8)" }}
          />
        </motion.button>
      </motion.header>

      {/* Hero Card - Premium Glass */}
      <motion.div
        variants={itemVariants}
        className="hero-glass p-5 sm:p-7 mb-6 sm:mb-8 relative overflow-hidden"
      >
        {/* Animated background glow */}
        <motion.div 
          className="absolute -top-20 -right-20 w-48 sm:w-60 h-48 sm:h-60 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(0,194,255,0.2) 0%, transparent 70%)" }}
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        
        <motion.div 
          className="absolute -bottom-10 -left-10 w-32 sm:w-40 h-32 sm:h-40 rounded-full blur-2xl bg-white/5"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <p className="text-[#888] text-xs sm:text-sm font-medium">Total Balance</p>
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Sparkles size={12} className="text-[#00C2FF]" />
            </motion.div>
          </div>
          
          <motion.h1 
            className="text-3xl sm:text-4xl md:text-5xl font-bold font-outfit text-white tracking-tight mb-3 sm:mb-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            {walletData.currency}{walletData.balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
          </motion.h1>
          
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <span className="px-3 sm:px-4 py-1 sm:py-1.5 bg-[#00D26A]/10 text-[#00D26A] text-[10px] sm:text-xs font-semibold rounded-full border border-[#00D26A]/20 flex items-center gap-1.5">
              <TrendingUp size={10} className="sm:w-3 sm:h-3" />
              +12.5% this month
            </span>
          </motion.div>
        </div>
      </motion.div>

      {/* Tagline Section */}
      <motion.div variants={itemVariants} className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-outfit font-bold text-white leading-tight tracking-tight">
          All-in-One App for{" "}
          <span className="gradient-text">Payments, Mobility</span> & More
        </h2>
        <p className="text-[#666] text-sm sm:text-base mt-2 sm:mt-3 font-medium">Pay. Ride. Book. Earn.</p>
      </motion.div>

      {/* CTA Button - Premium */}
      <motion.button
        data-testid="get-started-btn"
        className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-[#00C2FF] to-[#00A8CC] text-[#0A0A0A] font-bold rounded-full mb-8 sm:mb-10 flex items-center justify-center gap-2 relative overflow-hidden btn-premium text-sm sm:text-base"
        variants={itemVariants}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onNavigate("/wallet")}
        style={{
          boxShadow: "0 8px 32px rgba(0, 194, 255, 0.35), 0 0 0 1px rgba(0, 194, 255, 0.1)"
        }}
      >
        <span className="relative z-10">Get Started</span>
        <motion.div
          className="relative z-10"
          animate={{ x: [0, 4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <ChevronRight size={20} strokeWidth={2.5} />
        </motion.div>
      </motion.button>

      {/* Feature Grid */}
      <motion.section variants={itemVariants}>
        <div className="section-header">
          <h3 className="section-title">Services</h3>
          <motion.span 
            className="section-link"
            whileHover={{ x: 4 }}
          >
            View All
          </motion.span>
        </div>

        <div className="bento-grid">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              index={index}
              onClick={() => {
                if (feature.id === "wallet") onNavigate("/wallet");
              }}
            />
          ))}
        </div>
      </motion.section>

      {/* Highlight Section - Premium */}
      <motion.div
        variants={itemVariants}
        className="mt-6 sm:mt-10 p-4 sm:p-6 rounded-2xl sm:rounded-3xl relative overflow-hidden cursor-pointer"
        style={{
          background: "linear-gradient(135deg, rgba(0, 194, 255, 0.08) 0%, rgba(0, 194, 255, 0.02) 100%)",
          border: "1px solid rgba(0, 194, 255, 0.15)"
        }}
        whileHover={{ scale: 1.02, borderColor: "rgba(0, 194, 255, 0.3)" }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Glow */}
        <div className="absolute -top-10 -right-10 w-24 sm:w-32 h-24 sm:h-32 rounded-full blur-2xl bg-[#00C2FF]/20" />
        
        <div className="flex items-center gap-4 sm:gap-5 relative z-10">
          <motion.div 
            className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(0, 194, 255, 0.2) 0%, rgba(0, 194, 255, 0.1) 100%)",
              boxShadow: "0 0 20px rgba(0, 194, 255, 0.2)"
            }}
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <span className="text-xl sm:text-2xl">💳</span>
          </motion.div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-white font-outfit text-sm sm:text-base mb-0.5 sm:mb-1">
              Everything runs through your BidBlitz Wallet
            </h4>
            <p className="text-xs sm:text-sm text-[#888]">
              One wallet for all your payments
            </p>
          </div>
          <motion.div
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex-shrink-0"
          >
            <ChevronRight size={20} className="text-[#00C2FF]" />
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default HomePage;
