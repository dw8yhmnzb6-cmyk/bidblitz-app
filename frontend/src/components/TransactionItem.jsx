import { motion } from "framer-motion";
import { 
  Car, 
  ShoppingBag, 
  Wallet, 
  Play, 
  Coffee, 
  Send, 
  Zap, 
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  PlusCircle,
  Download
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

const categoryConfig = {
  transport: { color: "#FFB800", gradient: ["#FFB800", "#FF9500"] },
  shopping: { color: "#A855F7", gradient: ["#A855F7", "#9333EA"] },
  income: { color: "#00D26A", gradient: ["#00D26A", "#00B85C"] },
  entertainment: { color: "#FF4757", gradient: ["#FF4757", "#FF3344"] },
  food: { color: "#FF6B6B", gradient: ["#FF6B6B", "#FF5252"] },
  transfer: { color: "#00C2FF", gradient: ["#00C2FF", "#0099FF"] },
  payment: { color: "#FF4757", gradient: ["#FF4757", "#FF3344"] },
};

export const TransactionItem = ({ transaction, index }) => {
  const Icon = iconMap[transaction.icon] || Wallet;
  const config = categoryConfig[transaction.category] || categoryConfig.transfer;
  const isPositive = transaction.amount > 0;

  return (
    <motion.div
      data-testid={`transaction-${transaction.id}`}
      className="transaction-item group"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ x: 4 }}
    >
      {/* Icon with gradient background */}
      <motion.div
        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 relative"
        style={{ 
          background: `linear-gradient(135deg, ${config.color}15 0%, ${config.color}08 100%)` 
        }}
        whileHover={{ scale: 1.08 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        <Icon size={18} strokeWidth={1.5} style={{ color: config.color }} className="sm:w-5 sm:h-5" />
        
        {/* Direction indicator */}
        <div 
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center"
          style={{
            background: isPositive 
              ? "linear-gradient(135deg, #00D26A 0%, #00B85C 100%)" 
              : "linear-gradient(135deg, #333 0%, #222 100%)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
          }}
        >
          {isPositive ? (
            <ArrowDownLeft size={8} className="text-white sm:w-2.5 sm:h-2.5" strokeWidth={2.5} />
          ) : (
            <ArrowUpRight size={8} className="text-white/70 sm:w-2.5 sm:h-2.5" strokeWidth={2.5} />
          )}
        </div>
      </motion.div>

      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-white text-xs sm:text-sm truncate group-hover:text-[#00C2FF] transition-colors">
          {transaction.merchantName}
        </h4>
        <p className="text-[10px] sm:text-xs text-[#555] font-medium">
          {formatTime(transaction.date)}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <span
          className={`font-bold text-xs sm:text-sm tracking-tight ${
            isPositive ? "text-[#00D26A]" : "text-white"
          }`}
        >
          {formatCurrency(transaction.amount)}
        </span>
        {transaction.status === 'failed' && (
          <p className="text-[9px] text-[#FF4757]">Failed</p>
        )}
      </div>
    </motion.div>
  );
};

export default TransactionItem;
