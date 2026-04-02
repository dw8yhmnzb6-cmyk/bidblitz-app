import { motion } from "framer-motion";
import { 
  Car, 
  ShoppingBag, 
  Wallet, 
  Play, 
  Coffee, 
  Send, 
  Zap, 
  Package 
} from "lucide-react";
import { formatCurrency, formatTime } from "../data/mockData";

const iconMap = {
  car: Car,
  "shopping-bag": ShoppingBag,
  wallet: Wallet,
  play: Play,
  coffee: Coffee,
  send: Send,
  zap: Zap,
  package: Package,
};

const categoryColors = {
  transport: "#FFB800",
  shopping: "#A855F7",
  income: "#22C55E",
  entertainment: "#EF4444",
  food: "#FF6B6B",
  transfer: "#00C2FF",
};

export const TransactionItem = ({ transaction, index }) => {
  const Icon = iconMap[transaction.icon] || Wallet;
  const color = categoryColors[transaction.category] || "#00C2FF";
  const isPositive = transaction.amount > 0;

  return (
    <motion.div
      data-testid={`transaction-${transaction.id}`}
      className="transaction-item"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon size={20} strokeWidth={1.5} style={{ color }} />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-white text-sm truncate">
          {transaction.merchant}
        </h4>
        <p className="text-xs text-[#A1A1AA]">
          {formatTime(transaction.date)}
        </p>
      </div>

      <div className="text-right">
        <span
          className={`font-semibold text-sm ${
            isPositive ? "text-[#22C55E]" : "text-white"
          }`}
        >
          {formatCurrency(transaction.amount)}
        </span>
      </div>
    </motion.div>
  );
};

export default TransactionItem;
