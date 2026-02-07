import React, { memo } from 'react';
import { Crown, Star, Sparkles } from 'lucide-react';

/**
 * VIP Badge Component
 * Shows VIP status next to username with different tiers
 */
const VIPBadge = memo(({ tier = 'gold', size = 'sm', showText = false }) => {
  const tiers = {
    bronze: {
      bg: 'bg-gradient-to-r from-amber-600 to-amber-700',
      text: 'Bronze',
      icon: Star
    },
    silver: {
      bg: 'bg-gradient-to-r from-gray-400 to-gray-500',
      text: 'Silber',
      icon: Star
    },
    gold: {
      bg: 'bg-gradient-to-r from-amber-400 to-yellow-500',
      text: 'Gold',
      icon: Crown
    },
    platinum: {
      bg: 'bg-gradient-to-r from-purple-400 to-indigo-500',
      text: 'Platin',
      icon: Crown
    },
    diamond: {
      bg: 'bg-gradient-to-r from-cyan-400 to-blue-500',
      text: 'Diamant',
      icon: Sparkles
    }
  };
  
  const tierConfig = tiers[tier] || tiers.gold;
  const Icon = tierConfig.icon;
  
  const sizes = {
    xs: 'w-4 h-4 text-[8px]',
    sm: 'w-5 h-5 text-[10px]',
    md: 'w-6 h-6 text-xs',
    lg: 'w-8 h-8 text-sm'
  };
  
  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  };
  
  return (
    <div 
      className={`inline-flex items-center gap-1 ${tierConfig.bg} text-white rounded-full px-1.5 py-0.5 shadow-sm`}
      title={`VIP ${tierConfig.text}`}
    >
      <Icon className={iconSizes[size]} />
      {showText && (
        <span className={`font-bold ${sizes[size].split(' ').pop()}`}>
          {tierConfig.text}
        </span>
      )}
    </div>
  );
});

/**
 * VIP Promotion Banner
 * Shows benefits of VIP membership
 */
const VIPPromoBanner = memo(({ onJoin }) => {
  return (
    <div 
      className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 rounded-xl p-4 mb-4 relative overflow-hidden"
      data-testid="vip-promo-banner"
    >
      {/* Sparkle Effects */}
      <div className="absolute inset-0 opacity-30">
        {[...Array(5)].map((_, i) => (
          <Sparkles 
            key={i}
            className="absolute w-6 h-6 text-white animate-pulse"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.2}s`
            }}
          />
        ))}
      </div>
      
      <div className="relative flex items-center gap-4">
        {/* Icon */}
        <div className="p-3 rounded-xl bg-white/30 backdrop-blur">
          <Crown className="w-8 h-8 text-amber-800" />
        </div>
        
        {/* Content */}
        <div className="flex-1">
          <h3 className="text-lg font-black text-amber-900 flex items-center gap-2">
            Werde VIP-Mitglied
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              -20%
            </span>
          </h3>
          <p className="text-sm text-amber-800 mt-0.5">
            Exklusive Auktionen • Weniger Konkurrenz • Bonus-Gebote
          </p>
        </div>
        
        {/* CTA Button */}
        <button
          onClick={onJoin}
          className="px-4 py-2 bg-amber-900 hover:bg-amber-800 text-white font-bold rounded-lg shadow-lg transition-colors whitespace-nowrap"
        >
          Jetzt VIP werden
        </button>
      </div>
      
      {/* Benefits List */}
      <div className="relative mt-3 flex flex-wrap gap-2">
        {['🎯 Exklusive Auktionen', '💎 VIP-Badge', '🎁 Monatliche Bonus-Gebote', '⚡ Prioritäts-Support'].map((benefit, i) => (
          <span key={i} className="bg-white/40 backdrop-blur text-amber-900 text-xs font-medium px-2 py-1 rounded-full">
            {benefit}
          </span>
        ))}
      </div>
    </div>
  );
});

export { VIPBadge, VIPPromoBanner };
export default VIPBadge;
