import { motion } from "framer-motion";
import { Wifi, Nfc } from "lucide-react";

export const PremiumCard = ({ cardNumber, expiry, holder }) => {
  return (
    <motion.div
      data-testid="premium-card"
      className="premium-card holographic"
      initial={{ opacity: 0, y: 30, rotateX: -10 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ scale: 1.02, rotateX: 2 }}
    >
      {/* Animated gradient overlay */}
      <motion.div 
        className="absolute inset-0 opacity-35"
        style={{
          background: "linear-gradient(135deg, rgba(0, 194, 255, 0.06) 0%, transparent 40%, rgba(139, 92, 246, 0.04) 100%)"
        }}
        animate={{
          background: [
            "linear-gradient(135deg, rgba(0, 194, 255, 0.08) 0%, transparent 40%, rgba(0, 194, 255, 0.05) 100%)",
            "linear-gradient(225deg, rgba(0, 194, 255, 0.08) 0%, transparent 40%, rgba(0, 194, 255, 0.05) 100%)",
            "linear-gradient(135deg, rgba(0, 194, 255, 0.08) 0%, transparent 40%, rgba(0, 194, 255, 0.05) 100%)"
          ]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />
      
      {/* Light reflection */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/8 to-transparent pointer-events-none" />
      
      {/* Noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Card glow edges */}
      <div className="absolute inset-0 rounded-[1.25rem] pointer-events-none"
        style={{
          boxShadow: "inset 0 0 22px rgba(0, 194, 255, 0.04), inset 0 1px 0 rgba(255,255,255,0.55)"
        }}
      />

      {/* Top row - Logo & NFC */}
      <div className="relative flex justify-between items-start z-10">
        <div>
          <motion.div 
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00C2FF] to-[#0088CC] flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">BB</span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-[0.25em] text-slate-600 font-semibold block">
                BidBlitz
              </span>
              <span className="text-sm font-semibold text-slate-900 font-outfit">
                Premium
              </span>
            </div>
          </motion.div>
        </div>
        
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Nfc size={20} className="text-[#008fc7]" strokeWidth={1.5} />
          </motion.div>
          <motion.div
            animate={{ rotate: [0, 10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Wifi size={22} className="text-slate-700 rotate-90" strokeWidth={1.5} />
          </motion.div>
        </div>
      </div>

      {/* Card chip - Ultra realistic */}
      <div className="relative z-10 my-1 sm:my-4">
        <motion.div 
          className="w-9 h-6 sm:w-12 sm:h-9 rounded-md overflow-hidden"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          style={{
            background: "linear-gradient(135deg, #D4AF37 0%, #F4E5B0 25%, #D4AF37 50%, #B8860B 75%, #D4AF37 100%)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4)"
          }}
        >
          <div className="w-full h-full grid grid-cols-4 gap-[1px] p-[3px]">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className="rounded-[1px]"
                style={{ 
                  background: i % 2 === 0 
                    ? "linear-gradient(180deg, #B8860B 0%, #8B6914 100%)" 
                    : "linear-gradient(180deg, #DAA520 0%, #B8860B 100%)"
                }} 
              />
            ))}
          </div>
        </motion.div>
      </div>

      {/* Card number */}
      <motion.div 
        className="relative z-10 flex items-center gap-2 sm:gap-4 mb-2 sm:mb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {[1, 2, 3].map((group) => (
          <div key={group} className="flex gap-1 sm:gap-1.5">
            {[1, 2, 3, 4].map((dot) => (
              <div
                key={dot}
                className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-slate-500/55"
              />
            ))}
          </div>
        ))}
        <span className="text-base sm:text-xl font-medium tracking-[0.15em] text-slate-900 font-outfit">
          {cardNumber.split(" ").pop()}
        </span>
      </motion.div>

      {/* Bottom row - Holder & Expiry */}
      <motion.div 
        className="relative z-10 flex justify-between items-end"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="min-w-0 flex-1 mr-2">
          <span className="text-[9px] uppercase tracking-[0.2em] text-slate-600 block mb-1 font-semibold">
            Card Holder
          </span>
          <span className="text-slate-900 font-medium text-xs sm:text-sm tracking-wide font-outfit truncate block">
            {holder}
          </span>
        </div>
        <div className="text-right mr-2">
          <span className="text-[9px] uppercase tracking-[0.2em] text-slate-600 block mb-1 font-semibold">
            Valid Thru
          </span>
          <span className="text-slate-900 font-medium text-xs sm:text-sm tracking-wide font-outfit whitespace-nowrap">
            {expiry}
          </span>
        </div>
        
        {/* Card network logo */}
        <div className="flex -space-x-2 shrink-0">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#EB001B]/90" />
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#F79E1B]/90" />
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PremiumCard;
