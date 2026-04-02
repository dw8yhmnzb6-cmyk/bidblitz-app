import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, Plus, DollarSign } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { merchantData } from "../data/mockData";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2">
        <p className="text-[#00C2FF] font-semibold">
          €{payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export const MerchantPage = ({ onNavigate }) => {
  return (
    <motion.div
      data-testid="merchant-page"
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
          data-testid="merchant-back-btn"
          className="w-10 h-10 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate("/")}
        >
          <ArrowLeft size={18} strokeWidth={1.5} className="text-white" />
        </motion.button>
        <h1 className="text-xl font-semibold font-outfit text-white">Händler Dashboard</h1>
      </motion.header>

      {/* Stats Cards */}
      <motion.div 
        className="grid grid-cols-2 gap-4 mb-6"
        variants={itemVariants}
      >
        <div className="bg-[#141414] rounded-2xl p-5 border border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#22C55E]/15 flex items-center justify-center">
              <TrendingUp size={16} className="text-[#22C55E]" />
            </div>
            <span className="text-xs text-[#A1A1AA] uppercase tracking-wider">Today</span>
          </div>
          <p className="text-2xl font-semibold font-outfit text-white">
            €{merchantData.todayEarnings.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-[#22C55E] mt-1">+18.5% vs yesterday</p>
        </div>

        <div className="bg-[#141414] rounded-2xl p-5 border border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#00C2FF]/15 flex items-center justify-center">
              <DollarSign size={16} className="text-[#00C2FF]" />
            </div>
            <span className="text-xs text-[#A1A1AA] uppercase tracking-wider">Total</span>
          </div>
          <p className="text-2xl font-semibold font-outfit text-white">
            €{merchantData.totalEarnings.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-[#A1A1AA] mt-1">All time earnings</p>
        </div>
      </motion.div>

      {/* Chart */}
      <motion.div 
        className="bg-[#141414] rounded-3xl p-5 border border-white/5 mb-6"
        variants={itemVariants}
      >
        <h3 className="font-semibold font-outfit text-white mb-4">Weekly Overview</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={merchantData.weeklyData}>
              <defs>
                <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00C2FF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00C2FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="day" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A1A1AA', fontSize: 12 }}
                dy={10}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="earnings"
                stroke="#00C2FF"
                strokeWidth={2}
                fill="url(#colorEarnings)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Create Payment Button */}
      <motion.button
        data-testid="create-payment-btn"
        className="w-full py-4 bg-[#00C2FF] text-[#0A0A0A] font-semibold rounded-full flex items-center justify-center gap-2 mb-8"
        variants={itemVariants}
        whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(0, 194, 255, 0.4)" }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onNavigate("/scan")}
      >
        <Plus size={20} strokeWidth={2} />
        Create Payment
      </motion.button>

      {/* Recent Payments */}
      <motion.section variants={itemVariants}>
        <div className="section-header">
          <h3 className="section-title">Recent Payments</h3>
          <span className="section-link">View All</span>
        </div>

        <div className="bg-[#141414] rounded-2xl px-4 border border-white/5">
          {merchantData.recentPayments.map((payment, index) => (
            <motion.div
              key={payment.id}
              data-testid={`payment-${payment.id}`}
              className="flex items-center justify-between py-4 border-b border-white/5 last:border-b-0"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#22C55E]/15 flex items-center justify-center">
                  <DollarSign size={18} className="text-[#22C55E]" />
                </div>
                <div>
                  <p className="font-medium text-white text-sm">{payment.customer}</p>
                  <p className="text-xs text-[#A1A1AA]">{payment.time}</p>
                </div>
              </div>
              <span className="font-semibold text-[#22C55E]">
                +€{payment.amount.toFixed(2)}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
};

export default MerchantPage;
