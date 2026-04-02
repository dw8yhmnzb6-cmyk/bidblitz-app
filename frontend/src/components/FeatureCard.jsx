import { motion } from "framer-motion";
import { 
  Wallet, 
  Car, 
  Zap, 
  UtensilsCrossed, 
  Gavel 
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
      className={`bento-item cursor-pointer ${feature.large ? "large" : ""} ${hasImage ? "min-h-[140px]" : ""}`}
      style={{
        backgroundImage: hasImage ? `linear-gradient(to bottom, rgba(20,20,20,0.7), rgba(10,10,10,0.95)), url(${feature.image})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      <div className="relative z-10 flex flex-col h-full">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
          style={{ backgroundColor: `${feature.color}20` }}
        >
          <Icon 
            size={24} 
            strokeWidth={1.5} 
            style={{ color: feature.color }} 
          />
        </div>
        <h3 className="font-outfit text-lg font-semibold text-white mb-1">
          {feature.title}
        </h3>
        <p className="text-sm text-[#A1A1AA]">{feature.description}</p>
        
        {feature.large && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-[#00C2FF] font-medium">View Balance</span>
            <motion.span 
              className="text-[#00C2FF]"
              animate={{ x: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              →
            </motion.span>
          </div>
        )}
      </div>

      {/* Accent glow for large card */}
      {feature.large && (
        <div 
          className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: feature.color }}
        />
      )}
    </motion.div>
  );
};

export default FeatureCard;
