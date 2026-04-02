import { motion } from "framer-motion";
import { Wifi } from "lucide-react";

export const PremiumCard = ({ cardNumber, expiry, holder }) => {
  return (
    <motion.div
      data-testid="premium-card"
      className="premium-card"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      whileHover={{ scale: 1.02 }}
    >
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#00C2FF]/10 via-transparent to-transparent opacity-60 pointer-events-none" />
      
      {/* Decorative circles */}
      <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-[#00C2FF]/5 blur-2xl" />
      <div className="absolute -left-10 -bottom-10 w-32 h-32 rounded-full bg-white/5 blur-xl" />

      {/* Top row */}
      <div className="relative flex justify-between items-start">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#A1A1AA] font-bold">
            BidBlitz
          </span>
          <div className="text-lg font-semibold text-white mt-1 font-outfit">
            Premium
          </div>
        </div>
        <motion.div
          animate={{ rotate: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        >
          <Wifi size={24} className="text-[#00C2FF] rotate-90" strokeWidth={1.5} />
        </motion.div>
      </div>

      {/* Card number */}
      <div className="relative flex items-center gap-3 my-4">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-white/40"
            />
          ))}
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-white/40"
            />
          ))}
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-white/40"
            />
          ))}
        </div>
        <span className="text-white font-medium tracking-wider text-lg">
          {cardNumber.split(" ").pop()}
        </span>
      </div>

      {/* Bottom row */}
      <div className="relative flex justify-between items-end">
        <div>
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#A1A1AA] block mb-0.5">
            Card Holder
          </span>
          <span className="text-white font-medium text-sm tracking-wide">
            {holder}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#A1A1AA] block mb-0.5">
            Expires
          </span>
          <span className="text-white font-medium text-sm">
            {expiry}
          </span>
        </div>
      </div>

      {/* Card chip */}
      <div className="absolute top-1/2 left-6 -translate-y-1/2">
        <div className="w-10 h-8 rounded-md bg-gradient-to-br from-yellow-400/80 to-yellow-600/80 border border-yellow-500/50">
          <div className="w-full h-full grid grid-cols-3 gap-px p-1">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-yellow-700/30 rounded-sm" />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PremiumCard;
