import { motion } from "framer-motion";
import { Plus, Send, Clock, ArrowDownLeft, ArrowUpRight } from "lucide-react";

const iconMap = {
  add: { icon: Plus, gradient: ["#00C2FF", "#0088CC"] },
  send: { icon: ArrowUpRight, gradient: ["#A855F7", "#7C3AED"] },
  history: { icon: Clock, gradient: ["#22C55E", "#16A34A"] },
};

export const QuickAction = ({ id, icon, label, onClick }) => {
  const config = iconMap[icon] || iconMap.add;
  const Icon = config.icon;

  return (
    <motion.button
      data-testid={`quick-action-${id}`}
      className="quick-action group"
      onClick={onClick}
      whileHover={{ scale: 1.05, y: -4 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="quick-action-icon relative">
        {/* Background gradient on hover */}
        <motion.div
          className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `linear-gradient(135deg, ${config.gradient[0]}20 0%, ${config.gradient[1]}10 100%)`
          }}
        />
        
        {/* Icon */}
        <motion.div
          whileHover={{ rotate: icon === 'send' ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <Icon 
            size={24} 
            strokeWidth={1.5} 
            style={{ color: config.gradient[0] }} 
            className="relative z-10"
          />
        </motion.div>

        {/* Glow effect */}
        <motion.div
          className="absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-300"
          style={{ backgroundColor: config.gradient[0] }}
        />
      </div>
      
      <span className="text-xs text-[#888] group-hover:text-white transition-colors duration-300 font-medium">
        {label}
      </span>
    </motion.button>
  );
};

export default QuickAction;
