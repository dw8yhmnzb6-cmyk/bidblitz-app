import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, Plus, DollarSign, ArrowUpRight, Store } from "lucide-react";
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useState, useEffect } from "react";
import { api } from "../services/api";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 25 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
  }
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <motion.div 
        className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl"
        style={{
          background: "linear-gradient(135deg, #1A1A1A 0%, #111111 100%)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <p className="text-[#00C2FF] font-bold font-outfit text-base sm:text-lg">
          €{payload[0].value.toLocaleString()}
        </p>
      </motion.div>
    );
  }
  return null;
};

export const MerchantPage = ({ onNavigate }) => {
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    api.getMerchantDashboard().then(setDashboard).catch(() => {});
  }, []);

  const businessName = dashboard?.business_name ?? "My Store";
  const todayEarnings = dashboard?.today_earnings ?? 0;
  const totalEarnings = dashboard?.total_earnings ?? 0;
  const recentPayments = (dashboard?.recent_payments ?? []).slice(0, 5);

  // Dummy weekly chart data (no real weekly stats endpoint yet)
  const weeklyData = [
    { day: "Mon", earnings: 120 },
    { day: "Tue", earnings: 340 },
    { day: "Wed", earnings: 280 },
    { day: "Thu", earnings: 450 + totalEarnings * 0.1 },
    { day: "Fri", earnings: 380 },
    { day: "Sat", earnings: 520 },
    { day: "Sun", earnings: 290 + todayEarnings },
  ];

  return (
    <motion.div
      data-testid="merchant-page"
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
          data-testid="merchant-back-btn"
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center"
          whileHover={{ scale: 1.08, backgroundColor: "#1A1A1A" }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate("/")}
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
        >
          <ArrowLeft size={18} strokeWidth={1.5} className="text-white" />
        </motion.button>
        <div>
          <h1 className="text-lg sm:text-xl font-semibold font-outfit text-white tracking-tight">Händler Dashboard</h1>
          <p className="text-[10px] sm:text-xs text-[#666] font-medium">{businessName}</p>
        </div>
      </motion.header>

      {/* Stats Cards */}
      <motion.div 
        className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8"
        variants={itemVariants}
      >
        {/* Today's Earnings */}
        <motion.div 
          className="rounded-xl sm:rounded-2xl p-4 sm:p-5 relative overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #111111 0%, #0D0D0D 100%)",
            border: "1px solid rgba(255, 255, 255, 0.05)"
          }}
          whileHover={{ scale: 1.02, borderColor: "rgba(0, 210, 106, 0.2)" }}
        >
          <div className="absolute -top-10 -right-10 w-20 sm:w-24 h-20 sm:h-24 rounded-full blur-2xl bg-[#00D26A]/10" />
          
          <div className="flex items-center gap-2 mb-2 sm:mb-3 relative z-10">
            <div 
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(0, 210, 106, 0.2) 0%, rgba(0, 210, 106, 0.1) 100%)" }}
            >
              <TrendingUp size={16} className="text-[#00D26A]" />
            </div>
            <span className="text-[9px] sm:text-[10px] text-[#666] uppercase tracking-widest font-bold">Today</span>
          </div>
          
          <p className="text-xl sm:text-2xl font-bold font-outfit text-white relative z-10">
            €{todayEarnings.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] sm:text-xs text-[#00D26A] mt-1 sm:mt-1.5 font-semibold flex items-center gap-1">
            <ArrowUpRight size={10} className="sm:w-3 sm:h-3" />
            +12% vs yesterday
          </p>
        </motion.div>

        {/* Total Earnings */}
        <motion.div 
          className="rounded-xl sm:rounded-2xl p-4 sm:p-5 relative overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #111111 0%, #0D0D0D 100%)",
            border: "1px solid rgba(255, 255, 255, 0.05)"
          }}
          whileHover={{ scale: 1.02, borderColor: "rgba(0, 194, 255, 0.2)" }}
        >
          <div className="absolute -top-10 -right-10 w-20 sm:w-24 h-20 sm:h-24 rounded-full blur-2xl bg-[#00C2FF]/10" />
          
          <div className="flex items-center gap-2 mb-2 sm:mb-3 relative z-10">
            <div 
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(0, 194, 255, 0.2) 0%, rgba(0, 194, 255, 0.1) 100%)" }}
            >
              <Store size={16} className="text-[#00C2FF]" />
            </div>
            <span className="text-[9px] sm:text-[10px] text-[#666] uppercase tracking-widest font-bold">Total</span>
          </div>
          
          <p className="text-xl sm:text-2xl font-bold font-outfit text-white relative z-10">
            €{totalEarnings.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] sm:text-xs text-[#666] mt-1 sm:mt-1.5 font-medium">All time earnings</p>
        </motion.div>
      </motion.div>

      {/* Chart */}
      <motion.div 
        className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8 relative overflow-hidden"
        variants={itemVariants}
        style={{
          background: "linear-gradient(145deg, #111111 0%, #0A0A0A 100%)",
          border: "1px solid rgba(255, 255, 255, 0.05)"
        }}
      >
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-24 sm:h-32 blur-3xl bg-[#00C2FF]/5" />
        
        <h3 className="font-semibold font-outfit text-white mb-4 sm:mb-6 relative z-10 text-sm sm:text-base">Weekly Overview</h3>
        <div className="h-40 sm:h-52 relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00C2FF" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="#00C2FF" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#00C2FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="day" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#555', fontSize: 10 }}
                dy={10}
              />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Area
                type="monotone"
                dataKey="earnings"
                stroke="#00C2FF"
                strokeWidth={2}
                fill="url(#colorEarnings)"
                dot={false}
                activeDot={{ r: 5, fill: "#00C2FF", stroke: "#0A0A0A", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Create Payment Button */}
      <motion.button
        data-testid="create-payment-btn"
        className="w-full py-4 sm:py-5 bg-gradient-to-r from-[#00C2FF] to-[#00A8CC] text-[#0A0A0A] font-bold rounded-full flex items-center justify-center gap-2 sm:gap-3 mb-8 sm:mb-10 btn-premium relative overflow-hidden text-sm sm:text-base"
        variants={itemVariants}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onNavigate("/scan")}
        style={{
          boxShadow: "0 8px 32px rgba(0, 194, 255, 0.35)"
        }}
      >
        <Plus size={20} strokeWidth={2.5} />
        <span>Create Payment</span>
      </motion.button>

      {/* Recent Payments */}
      <motion.section variants={itemVariants}>
        <div className="section-header">
          <h3 className="section-title text-sm sm:text-base">Recent Payments</h3>
          <motion.span 
            className="section-link text-xs sm:text-sm"
            whileHover={{ x: 4 }}
          >
            View All
          </motion.span>
        </div>

        <div 
          className="rounded-xl sm:rounded-2xl px-4 sm:px-5 border border-white/5"
          style={{
            background: "linear-gradient(145deg, #111111 0%, #0D0D0D 100%)"
          }}
        >
          {recentPayments.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-[#555] text-sm">No payments yet</p>
            </div>
          ) : (
            recentPayments.map((payment, index) => (
              <motion.div
                key={payment.id || index}
                data-testid={`payment-${payment.id || index}`}
                className="flex items-center justify-between py-3 sm:py-4 border-b border-white/5 last:border-b-0"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                whileHover={{ x: 4 }}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div
                    className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, rgba(0, 210, 106, 0.15) 0%, rgba(0, 210, 106, 0.05) 100%)" }}
                  >
                    <DollarSign size={18} className="text-[#00D26A]" />
                  </div>
                  <div>
                    <p className="font-medium text-white text-xs sm:text-sm">{payment.description || payment.reference}</p>
                    <p className="text-[10px] sm:text-xs text-[#555]">{new Date(payment.created_at).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
                <span className="font-bold text-[#00D26A] text-sm">
                  +€{Math.abs(payment.amount).toFixed(2)}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </motion.section>
    </motion.div>
  );
};

export default MerchantPage;
