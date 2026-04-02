import { motion } from "framer-motion";
import { 
  Wallet, 
  Car, 
  Zap, 
  UtensilsCrossed, 
  Gavel,
  ArrowUpRight
} from "lucide-react";

const iconMap = {
  wallet: Wallet,
  car: Car,
  zap: Zap,
  utensils: UtensilsCrossed,
  gavel: Gavel,
};

export const FeatureCard = ({ feature, index, onClick }) => {
  const Icon = iconMap[feature.icon] || Wallet;
  const hasImage = feature.image;

  return (
    <motion.div
      data-testid={`feature-${feature.id}-card`}
      className={`bento-item cursor-pointer ${feature.large ? "large" : ""} ${hasImage ? "min-h-[160px]" : ""}`}
      style={{
        backgroundImage: hasImage 
          ? `linear-gradient(to bottom, rgba(20,20,20,0.6), rgba(10,10,10,0.95)), url(${feature.image})` 
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        delay: index * 0.08, 
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1]
      }}
      whileHover={{ scale: 1.03, y: -6 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      {/* Glow effect on hover */}
      <motion.div
        className="absolute inset-0 rounded-[1.5rem] opacity-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${feature.color}20 0%, transparent 70%)`
        }}
        whileHover={{ opacity: 1 }}
      />

      <div className="relative z-10 flex flex-col h-full">
        {/* Icon with glow */}
        <motion.div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 relative"
          style={{ backgroundColor: `${feature.color}15` }}
          whileHover={{ scale: 1.1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          <Icon 
            size={26} 
            strokeWidth={1.5} 
            style={{ color: feature.color }} 
          />
          {/* Icon glow */}
          <div 
            className="absolute inset-0 rounded-2xl blur-xl opacity-40"
            style={{ backgroundColor: feature.color }}
          />
        </motion.div>

        <h3 className="font-outfit text-lg font-semibold text-white mb-1 tracking-tight">
          {feature.title}
        </h3>
        <p className="text-sm text-[#888]">{feature.description}</p>
        
        {feature.large && (
          <motion.div 
            className="mt-auto pt-4 flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-sm text-[#00C2FF] font-medium">View Balance</span>
            <motion.div
              animate={{ x: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            >
              <ArrowUpRight size={16} className="text-[#00C2FF]" />
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Large card accent glow */}
      {feature.large && (
        <>
          <motion.div 
            className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ background: feature.color }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-2xl opacity-10 pointer-events-none bg-white" />
        </>
      )}
    </motion.div>
  );
};

export default FeatureCard;
