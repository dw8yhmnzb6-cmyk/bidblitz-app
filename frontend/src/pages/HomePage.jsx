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
      className="px-6 pt-8 pb-4"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.header 
        className="flex items-center justify-between mb-10"
        variants={itemVariants}
      >
        <div className="flex items-center gap-4">
          <motion.div
            className="relative"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <img
              src={userData.avatar}
              alt="Profile"
              className="w-14 h-14 rounded-full object-cover"
              style={{
                border: "2px solid rgba(0, 194, 255, 0.3)",
                boxShadow: "0 0 20px rgba(0, 194, 255, 0.2)"
              }}
            />
            {/* Online indicator */}
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#00D26A] rounded-full border-2 border-[#0A0A0A]" />
          </motion.div>
          <div>
            <p className="text-[#666] text-sm font-medium">{getGreeting()}</p>
            <h2 className="text-white font-semibold font-outfit text-xl tracking-tight">{userData.name}</h2>
          </div>
        </div>
        
        <motion.button
          data-testid="notification-btn"
          className="w-12 h-12 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center relative"
          whileHover={{ scale: 1.08, backgroundColor: "#1A1A1A" }}
          whileTap={{ scale: 0.95 }}
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
        >
          <Bell size={20} strokeWidth={1.5} className="text-white" />
          <motion.span 
            className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#00C2FF] rounded-full"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ boxShadow: "0 0 8px rgba(0, 194, 255, 0.8)" }}
          />
        </motion.button>
      </motion.header>

      {/* Hero Card - Premium Glass */}
      <motion.div
        variants={itemVariants}
        className="hero-glass p-7 mb-8 relative overflow-hidden"
      >
        {/* Animated background glow */}
        <motion.div 
          className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(0,194,255,0.2) 0%, transparent 70%)" }}
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        
        <motion.div 
          className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full blur-2xl bg-white/5"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[#888] text-sm font-medium">Total Balance</p>
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Sparkles size={14} className="text-[#00C2FF]" />
            </motion.div>
          </div>
          
          <motion.h1 
            className="amount-display large mb-4"
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
            <span className="px-4 py-1.5 bg-[#00D26A]/10 text-[#00D26A] text-xs font-semibold rounded-full border border-[#00D26A]/20 flex items-center gap-1.5">
              <TrendingUp size={12} />
              +12.5% this month
            </span>
          </motion.div>
        </div>
      </motion.div>

      {/* Tagline Section */}
      <motion.div variants={itemVariants} className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-outfit font-bold text-white leading-tight tracking-tight">
          All-in-One App for{" "}
          <span className="gradient-text">Payments, Mobility</span> & More
        </h2>
        <p className="text-[#666] text-base mt-3 font-medium">Pay. Ride. Book. Earn.</p>
      </motion.div>

      {/* CTA Button - Premium */}
      <motion.button
        data-testid="get-started-btn"
        className="w-full py-4.5 bg-gradient-to-r from-[#00C2FF] to-[#00A8CC] text-[#0A0A0A] font-bold rounded-full mb-10 flex items-center justify-center gap-2.5 relative overflow-hidden btn-premium"
        variants={itemVariants}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onNavigate("/wallet")}
        style={{
          boxShadow: "0 8px 32px rgba(0, 194, 255, 0.35), 0 0 0 1px rgba(0, 194, 255, 0.1)"
        }}
      >
        <span className="relative z-10 text-base">Get Started</span>
        <motion.div
          className="relative z-10"
          animate={{ x: [0, 4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <ChevronRight size={22} strokeWidth={2.5} />
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
        className="mt-10 p-6 rounded-3xl relative overflow-hidden cursor-pointer"
        style={{
          background: "linear-gradient(135deg, rgba(0, 194, 255, 0.08) 0%, rgba(0, 194, 255, 0.02) 100%)",
          border: "1px solid rgba(0, 194, 255, 0.15)"
        }}
        whileHover={{ scale: 1.02, borderColor: "rgba(0, 194, 255, 0.3)" }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl bg-[#00C2FF]/20" />
        
        <div className="flex items-center gap-5 relative z-10">
          <motion.div 
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(0, 194, 255, 0.2) 0%, rgba(0, 194, 255, 0.1) 100%)",
              boxShadow: "0 0 20px rgba(0, 194, 255, 0.2)"
            }}
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <span className="text-2xl">💳</span>
          </motion.div>
          <div className="flex-1">
            <h4 className="font-semibold text-white font-outfit text-base mb-1">
              Everything runs through your BidBlitz Wallet
            </h4>
            <p className="text-sm text-[#888]">
              One wallet for all your payments
            </p>
          </div>
          <motion.div
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <ChevronRight size={22} className="text-[#00C2FF]" />
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default HomePage;
