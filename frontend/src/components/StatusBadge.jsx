import { motion } from "framer-motion";
import { Check, X, Clock } from "lucide-react";

const statusConfig = {
  success: {
    icon: Check,
    className: "status-badge success",
    label: "Success"
  },
  error: {
    icon: X,
    className: "status-badge error",
    label: "Failed"
  },
  pending: {
    icon: Clock,
    className: "status-badge pending",
    label: "Pending"
  }
};

export const StatusBadge = ({ status, label }) => {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <motion.span
      data-testid={`status-badge-${status}`}
      className={config.className}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Icon size={14} strokeWidth={2} />
      {label || config.label}
    </motion.span>
  );
};

export default StatusBadge;
