import { motion } from "framer-motion";
import {
  Car, ShoppingBag, Wallet, Play, Coffee, Send, Zap, Package,
  ArrowUpRight, ArrowDownLeft, CreditCard, PlusCircle, Download, Check, X as XIcon
} from "lucide-react";
import { formatCurrency, formatTime } from "../models";

const iconMap = {
  car: Car,
  "shopping-bag": ShoppingBag,
  wallet: Wallet,
  play: Play,
  coffee: Coffee,
  send: Send,
  zap: Zap,
  package: Package,
  "credit-card": CreditCard,
  "plus-circle": PlusCircle,
  download: Download,
};

const categoryColor = {
  transport: "#FFB800",
  shopping: "#A855F7",
  income: "#00D26A",
  entertainment: "#FF4757",
  food: "#FF6B6B",
  transfer: "#00C2FF",
  payment: "#FF4757",
};

const statusConfig = {
  success: { label: "Completed", color: "#00D26A", Icon: Check },
  failed: { label: "Failed", color: "#FF4757", Icon: XIcon },
  pending: { label: "Pending", color: "#00C2FF", Icon: null },
};

export const TransactionItem = ({ transaction, index, isLast, onClick }) => {
  const Icon = iconMap[transaction.icon] || Wallet;
  const color = categoryColor[transaction.category] || "#00C2FF";
  const isPositive = transaction.amount > 0;
  const status = statusConfig[transaction.status];

  return (
    <motion.div
      data-testid={`transaction-${transaction.id}`}
      className={`flex items-center gap-3.5 px-4 py-[14px] cursor-pointer group transition-colors duration-200 hover:bg-white/[0.015] ${!isLast ? "border-b border-white/[0.03]" : ""}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      onClick={() => onClick && onClick(transaction)}
    >
      {/* Icon */}
      <div className="relative flex-shrink-0">
        <div
          className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
          style={{ background: `${color}08`, border: `1px solid ${color}10` }}
        >
          <Icon size={17} strokeWidth={1.6} style={{ color }} />
        </div>
        {/* Direction dot */}
        <div
          className="absolute -bottom-0.5 -right-0.5 w-[16px] h-[16px] rounded-full flex items-center justify-center"
          style={{
            background: isPositive ? "#00D26A" : "rgba(255,255,255,0.06)",
            border: isPositive ? "2px solid #030303" : "2px solid #030303",
          }}
        >
          {isPositive ? (
            <ArrowDownLeft size={7} className="text-white" strokeWidth={3} />
          ) : (
            <ArrowUpRight size={7} className="text-white/50" strokeWidth={3} />
          )}
        </div>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-white/90 truncate group-hover:text-white transition-colors">
          {transaction.merchantName}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-[#333] font-medium">{formatTime(transaction.date)}</span>
          {status && transaction.status !== "success" && (
            <>
              <span className="text-[#222]">·</span>
              <span
                className="text-[9px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: status.color }}
              >
                {status.label}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <span
          className={`text-[14px] font-bold font-outfit tracking-tight ${
            isPositive ? "text-[#00D26A]" : "text-white/90"
          }`}
        >
          {formatCurrency(transaction.amount)}
        </span>
      </div>
    </motion.div>
  );
};

export default TransactionItem;
