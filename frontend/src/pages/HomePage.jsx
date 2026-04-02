import { motion } from "framer-motion";
import { Bell, ChevronRight } from "lucide-react";
import { userData, walletData, features, getGreeting } from "../data/mockData";
import { FeatureCard } from "../components/FeatureCard";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export const HomePage = ({ onNavigate }) => {
  return (
    <motion.div
      data-testid="home-page"
      className="px-5 pt-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.header 
        className="flex items-center justify-between mb-8"
        variants={itemVariants}
      >
        <div className="flex items-center gap-3">
          <motion.img
            src={userData.avatar}
            alt="Profile"
            className="w-12 h-12 rounded-full object-cover border-2 border-[#141414]"
            whileHover={{ scale: 1.05 }}
          />
          <div>
            <p className="text-[#A1A1AA] text-sm">{getGreeting()}</p>
            <h2 className="text-white font-semibold font-outfit">{userData.name}</h2>
          </div>
        </div>
        <motion.button
          data-testid="notification-btn"
          className="w-10 h-10 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Bell size={18} strokeWidth={1.5} className="text-white" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-[#00C2FF] rounded-full" />
        </motion.button>
      </motion.header>

      {/* Hero Card */}
      <motion.div
        variants={itemVariants}
        className="glass rounded-3xl p-6 mb-6 relative overflow-hidden"
      >
        {/* Background glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#00C2FF]/20 rounded-full blur-3xl" />
        
        <p className="text-[#A1A1AA] text-sm mb-2">Total Balance</p>
        <motion.h1 
          className="text-4xl sm:text-5xl font-semibold font-outfit text-white tracking-tight mb-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {walletData.currency}{walletData.balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
        </motion.h1>
        
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-[#22C55E]/15 text-[#22C55E] text-xs font-medium rounded-full">
            +12.5% this month
          </span>
        </div>
      </motion.div>

      {/* Tagline */}
      <motion.div variants={itemVariants} className="mb-6">
        <h2 className="text-xl sm:text-2xl font-outfit font-semibold text-white leading-tight">
          All-in-One App for{" "}
          <span className="gradient-text">Payments, Mobility</span> & More
        </h2>
        <p className="text-[#A1A1AA] text-sm mt-2">Pay. Ride. Book. Earn.</p>
      </motion.div>

      {/* CTA Button */}
      <motion.button
        data-testid="get-started-btn"
        className="w-full py-4 bg-[#00C2FF] text-[#0A0A0A] font-semibold rounded-full mb-8 flex items-center justify-center gap-2"
        variants={itemVariants}
        whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(0, 194, 255, 0.4)" }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onNavigate("/wallet")}
      >
        Get Started
        <ChevronRight size={20} strokeWidth={2} />
      </motion.button>

      {/* Feature Grid */}
      <motion.section variants={itemVariants}>
        <div className="section-header">
          <h3 className="section-title">Services</h3>
          <span className="section-link">View All</span>
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

      {/* Highlight Section */}
      <motion.div
        variants={itemVariants}
        className="mt-8 p-5 bg-gradient-to-r from-[#141414] to-[#1A1A1A] rounded-3xl border border-white/5"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#00C2FF]/15 flex items-center justify-center">
            <span className="text-2xl">💳</span>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-white font-outfit">
              Everything runs through your BidBlitz Wallet
            </h4>
            <p className="text-sm text-[#A1A1AA] mt-1">
              One wallet for all your payments
            </p>
          </div>
          <ChevronRight size={20} className="text-[#A1A1AA]" />
        </div>
      </motion.div>
    </motion.div>
  );
};

export default HomePage;
