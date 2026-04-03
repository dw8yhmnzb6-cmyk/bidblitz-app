import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, TrendingUp, Plus, ArrowUpRight, Store,
  ChevronRight, Check, Clock, AlertTriangle, Banknote,
  BarChart3, Users, CircleDollarSign
} from "lucide-react";
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useMerchant } from "../store";
import { useMerchantStats } from "../hooks";
import { formatRelativeTime } from "../models";

const slide = { duration: 0.35, ease: [0.32, 0.72, 0, 1] };

// Skeleton shimmer
const Skeleton = ({ className, style }) => (
  <div className={`relative overflow-hidden rounded-xl ${className}`} style={{ background: "rgba(255,255,255,0.025)", ...style }}>
    <motion.div
      className="absolute inset-0"
      style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)" }}
      animate={{ x: ["-100%", "100%"] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);

// Stat card
const StatCard = ({ icon: Icon, label, value, sub, color, delay = 0 }) => (
  <motion.div
    className="rounded-2xl p-4 relative overflow-hidden"
    style={{
      background: "rgba(255,255,255,0.018)",
      border: "1px solid rgba(255,255,255,0.04)",
    }}
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, ...slide }}
    whileHover={{ borderColor: `${color}25` }}
  >
    {/* Corner glow */}
    <div
      className="absolute -top-8 -right-8 w-20 h-20 rounded-full pointer-events-none"
      style={{ background: color, filter: "blur(40px)", opacity: 0.08 }}
    />
    <div className="flex items-center gap-2 mb-2.5 relative z-10">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: `${color}10`, border: `1px solid ${color}15` }}
      >
        <Icon size={13} style={{ color }} />
      </div>
      <span className="text-[9px] text-[#3A3A3A] uppercase tracking-[0.12em] font-semibold">{label}</span>
    </div>
    <p className="text-[17px] font-bold font-outfit text-white/90 relative z-10 leading-tight">{value}</p>
    {sub && (
      <p className="text-[10px] text-[#333] font-medium mt-1 relative z-10">{sub}</p>
    )}
  </motion.div>
);

// Activity dot
const ActivityRow = ({ label, count, color, delay = 0 }) => (
  <motion.div
    className="flex items-center justify-between py-[11px]"
    initial={{ opacity: 0, x: -8 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, ...slide }}
  >
    <div className="flex items-center gap-2.5">
      <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}40` }} />
      <span className="text-[12px] text-white/60 font-medium">{label}</span>
    </div>
    <span className="text-[13px] font-semibold font-outfit text-white/80">{count}</span>
  </motion.div>
);

// Chart tooltip
const ChartTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="px-3 py-2 rounded-xl"
        style={{
          background: "rgba(15,15,15,0.95)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        <p className="text-[#00C2FF] font-bold font-outfit text-[14px]">
          &euro;{payload[0].value.toLocaleString("de-DE")}
        </p>
      </div>
    );
  }
  return null;
};

export const MerchantPage = ({ onNavigate }) => {
  const merchant = useMerchant();
  const stats = useMerchantStats();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const recentPayments = merchant.payments.slice(0, 6).map((p) => ({
    ...p,
    time: formatRelativeTime(p.date),
  }));

  const successCount = merchant.payments.length;
  const failedCount = 0;

  return (
    <motion.div
      data-testid="merchant-page"
      className="min-h-screen relative overflow-hidden"
      style={{ background: "#030303" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Ambient glow */}
      <motion.div
        className="absolute top-[-18%] left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{ filter: "blur(140px)", background: "rgba(0,210,106,0.035)" }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
        <div className="flex items-center gap-3">
          <motion.button
            data-testid="merchant-back-btn"
            className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
            whileTap={{ scale: 0.88 }}
            onClick={() => onNavigate("/")}
          >
            <ArrowLeft size={15} strokeWidth={1.5} className="text-white/50" />
          </motion.button>
          <div>
            <motion.h1
              className="text-[15px] font-semibold font-outfit text-white tracking-tight"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
            >
              Dashboard
            </motion.h1>
            <motion.p
              className="text-[10px] text-[#333] font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {merchant.businessName}
            </motion.p>
          </div>
        </div>
        <motion.div
          className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08 }}
        >
          <Store size={15} strokeWidth={1.5} className="text-[#00D26A]/60" />
        </motion.div>
      </div>

      {/* Content */}
      <div className="px-5 pb-8 relative z-10">

        {/* ── Earnings Hero ── */}
        <motion.div
          className="text-center pt-4 pb-5 relative"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, ...slide }}
        >
          <p className="text-[10px] text-[#3A3A3A] font-semibold tracking-[0.14em] uppercase mb-3">Today's Earnings</p>
          <AnimatePresence mode="wait">
            {isLoading ? (
              <Skeleton className="h-[48px] w-40 mx-auto" />
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-[24px] text-[#2A2A2A] font-outfit font-light">&euro;</span>
                  <motion.span
                    className="text-[46px] font-bold font-outfit text-white tracking-[-0.03em] leading-none"
                    key={stats.todayEarnings}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  >
                    {stats.todayEarnings.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                  </motion.span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!isLoading && (
            <motion.div
              className="flex items-center justify-center gap-1.5 mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
            >
              <TrendingUp size={11} className="text-[#00D26A]" />
              <span className="text-[11px] font-medium text-[#00D26A]">
                +{stats.changeFromYesterday}% vs yesterday
              </span>
            </motion.div>
          )}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-36 pointer-events-none"
            style={{ filter: "blur(80px)", background: "radial-gradient(ellipse, rgba(0,210,106,0.06), transparent 70%)" }}
          />
        </motion.div>

        {/* ── Stat Cards Grid ── */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2.5 mb-6">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[100px]" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 mb-6">
            <StatCard
              icon={CircleDollarSign}
              label="Total Earnings"
              value={`\u20AC${stats.totalEarnings.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`}
              sub="All time"
              color="#00C2FF"
              delay={0.12}
            />
            <StatCard
              icon={Users}
              label="Payments"
              value={stats.todayPaymentCount.toString()}
              sub="Today"
              color="#A855F7"
              delay={0.16}
            />
            <StatCard
              icon={BarChart3}
              label="Avg. Transaction"
              value={`\u20AC${parseFloat(stats.averageTransactionValue).toLocaleString("de-DE", { minimumFractionDigits: 2 })}`}
              sub="Per payment"
              color="#FFB800"
              delay={0.20}
            />
            <StatCard
              icon={Banknote}
              label="Total Payments"
              value={merchant.payments.length.toString()}
              sub="All time"
              color="#00D26A"
              delay={0.24}
            />
          </div>
        )}

        {/* ── Weekly Chart ── */}
        <motion.div
          className="rounded-2xl p-4 mb-6 relative overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.015)",
            border: "1px solid rgba(255,255,255,0.035)",
          }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, ...slide }}
        >
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-20 pointer-events-none"
            style={{ filter: "blur(50px)", background: "rgba(0,194,255,0.04)" }}
          />
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-[12px] font-semibold font-outfit text-white/80">Weekly Overview</h3>
            <span className="text-[10px] text-[#333] font-medium">Last 7 days</span>
          </div>
          <div className="h-[140px] relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.weeklyData}>
                <defs>
                  <linearGradient id="merchantGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00C2FF" stopOpacity={0.3} />
                    <stop offset="50%" stopColor="#00C2FF" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#00C2FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#2A2A2A", fontSize: 10, fontWeight: 500 }}
                  dy={8}
                />
                <Tooltip content={<ChartTooltip />} cursor={false} />
                <Area
                  type="monotone"
                  dataKey="earnings"
                  stroke="#00C2FF"
                  strokeWidth={2}
                  fill="url(#merchantGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#00C2FF", stroke: "#030303", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* ── Create Payment CTA ── */}
        <motion.button
          data-testid="create-payment-btn"
          className="w-full py-[13px] rounded-[14px] bg-[#00C2FF] text-[#020202] font-semibold text-[13px] flex items-center justify-center gap-2 mb-6 relative overflow-hidden"
          style={{ boxShadow: "0 6px 36px rgba(0,194,255,0.3), 0 2px 10px rgba(0,194,255,0.15)" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, ...slide }}
          whileTap={{ scale: 0.96 }}
          onClick={() => onNavigate("/scan")}
        >
          <Plus size={16} strokeWidth={2.5} />
          Create Payment
        </motion.button>

        {/* ── Activity Status ── */}
        <motion.div
          className="rounded-2xl p-4 mb-6"
          style={{
            background: "rgba(255,255,255,0.012)",
            border: "1px solid rgba(255,255,255,0.03)",
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, ...slide }}
        >
          <h3 className="text-[11px] font-semibold font-outfit text-[#444] uppercase tracking-[0.1em] mb-1">Activity</h3>
          <div className="divide-y divide-white/[0.03]">
            <ActivityRow label="Payments today" count={stats.todayPaymentCount} color="#00C2FF" delay={0.36} />
            <ActivityRow label="Successful" count={successCount} color="#00D26A" delay={0.38} />
            <ActivityRow label="Failed" count={failedCount} color="#FF4757" delay={0.40} />
          </div>
        </motion.div>

        {/* ── Recent Payments ── */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.42 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-semibold font-outfit text-white">Recent Payments</h3>
            <motion.span
              className="text-[11px] text-[#00C2FF] font-medium cursor-pointer flex items-center gap-0.5"
              whileHover={{ x: 3 }}
            >
              View All <ChevronRight size={12} strokeWidth={2} />
            </motion.span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[58px] w-full" />)}
            </div>
          ) : recentPayments.length === 0 ? (
            /* Empty state */
            <motion.div
              className="py-12 text-center rounded-2xl"
              style={{ background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.03)" }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.03] flex items-center justify-center">
                <Banknote size={20} className="text-[#2A2A2A]" />
              </div>
              <p className="text-[13px] text-[#333] font-medium mb-1">No payments yet</p>
              <p className="text-[11px] text-[#222]">Create your first payment to get started</p>
            </motion.div>
          ) : (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.015)",
                border: "1px solid rgba(255,255,255,0.035)",
              }}
            >
              {recentPayments.map((payment, i) => (
                <motion.div
                  key={payment.id}
                  data-testid={`payment-${payment.id}`}
                  className={`flex items-center gap-3.5 px-4 py-[13px] group transition-colors duration-200 hover:bg-white/[0.015] ${
                    i < recentPayments.length - 1 ? "border-b border-white/[0.03]" : ""
                  }`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.44 + i * 0.04, duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                >
                  {/* Icon */}
                  <div
                    className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center flex-shrink-0 relative"
                    style={{ background: "rgba(0,210,106,0.06)", border: "1px solid rgba(0,210,106,0.1)" }}
                  >
                    <ArrowUpRight size={17} strokeWidth={1.6} className="text-[#00D26A]" />
                    {/* Success dot */}
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-[16px] h-[16px] rounded-full flex items-center justify-center"
                      style={{ background: "#00D26A", border: "2px solid #030303" }}
                    >
                      <Check size={7} className="text-white" strokeWidth={3} />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-white/90 truncate group-hover:text-white transition-colors">
                      {payment.customerId}
                    </p>
                    <p className="text-[10px] text-[#333] font-medium mt-0.5">{payment.time}</p>
                  </div>

                  {/* Amount */}
                  <span className="text-[14px] font-bold font-outfit text-[#00D26A] tracking-tight flex-shrink-0">
                    +&euro;{payment.amount.toFixed(2)}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </motion.div>
  );
};

export default MerchantPage;
