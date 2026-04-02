import { motion } from "framer-motion";
import { Plus, Send, Clock } from "lucide-react";

const iconMap = {
  add: Plus,
  send: Send,
  history: Clock,
};

export const QuickAction = ({ id, icon, label, onClick }) => {
  const Icon = iconMap[icon] || Plus;

  return (
    <motion.button
      data-testid={`quick-action-${id}`}
      className="quick-action"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="quick-action-icon">
        <Icon size={22} strokeWidth={1.5} className="text-[#00C2FF]" />
      </div>
      <span className="text-xs text-[#A1A1AA]">{label}</span>
    </motion.button>
  );
};

export default QuickAction;
