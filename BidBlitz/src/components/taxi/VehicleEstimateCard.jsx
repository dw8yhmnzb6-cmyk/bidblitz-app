import React from 'react';
import { motion } from 'framer-motion';
import VehicleIcon from './VehicleIcon';

/**
 * VehicleEstimateCard — Fahrzeugauswahl mit Preis & ETA
 */
export default function VehicleEstimateCard({
  estimate,
  isSelected,
  onSelect,
}) {
  const { vehicle_type, price, eta_minutes, surge_multiplier, capacity, description } = estimate;

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
        isSelected
          ? 'bg-cyan-500/10 border-cyan-500/50'
          : 'bg-[#111] border-white/10 hover:border-white/20'
      }`}
      data-testid={`vehicle-${vehicle_type}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4 flex-1">
          {/* Vehicle SVG Icon */}
          <VehicleIcon type={vehicle_type} className="w-20 h-10" active={isSelected} />

          <div className="flex-1">
            <h3 className="font-bold text-white capitalize mb-1">
              {vehicle_type === 'standard' ? 'Standard' : vehicle_type === 'premium' ? 'Premium' : 'Van'}
            </h3>
            <p className="text-xs text-gray-400">{description || `${capacity} Personen`}</p>
            {eta_minutes && (
              <p className="text-[10px] text-gray-500 mt-1">{eta_minutes} Min Entfernung</p>
            )}
          </div>
        </div>

        {/* Price */}
        <div className="text-right">
          <p className="text-xl font-bold text-cyan-400">€{price.toFixed(2)}</p>
          {surge_multiplier > 1 && (
            <p className="text-[9px] text-yellow-400 font-bold mt-0.5">
              🔥 {surge_multiplier}x Surge
            </p>
          )}
        </div>
      </div>

      {/* Features/Benefits */}
      <div className="flex items-center gap-2 text-[10px] text-gray-500">
        {vehicle_type === 'premium' && (
          <>
            <span className="px-2 py-0.5 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
              Luxus
            </span>
            <span>Klimaanlage</span>
          </>
        )}
        {vehicle_type === 'van' && (
          <>
            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400">
              Großraum
            </span>
            <span>Bis 7 Personen</span>
          </>
        )}
        {vehicle_type === 'standard' && (
          <>
            <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              Günstig
            </span>
            <span>Bis 4 Personen</span>
          </>
        )}
      </div>
    </motion.button>
  );
}
