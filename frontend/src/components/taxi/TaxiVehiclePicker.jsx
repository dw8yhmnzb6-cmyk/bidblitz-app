/**
 * TaxiVehiclePicker — list of vehicle estimate cards (Standard/Premium/Van/etc.)
 * with selectable highlight, fare display and price-range subtitle.
 */
import React from "react";
import { motion } from "framer-motion";
import { VehicleIcon } from "./TaxiVehicleIcon";

export default function TaxiVehiclePicker({ estimates, selectedVehicle, onSelect }) {
  if (!estimates || estimates.length === 0) return null;
  return (
    <div className="space-y-3" data-testid="taxi-vehicle-picker">
      <h3 className="font-semibold text-gray-300 text-sm uppercase tracking-wider">
        Wähle dein Fahrzeug
      </h3>
      {estimates.map((est) => {
        const isActive = selectedVehicle === est.vehicle_type;
        return (
          <motion.button
            key={est.vehicle_type}
            onClick={() => onSelect(est.vehicle_type)}
            whileTap={{ scale: 0.98 }}
            data-testid={`vehicle-card-${est.vehicle_type}`}
            className={`w-full p-4 rounded-2xl border-2 transition-all ${
              isActive
                ? "bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border-cyan-400/70 shadow-[0_0_24px_rgba(0,194,255,0.15)]"
                : "bg-[#0F1218] border-white/5 hover:border-white/15"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className={`shrink-0 w-20 h-12 rounded-xl flex items-center justify-center ${
                    isActive ? "bg-cyan-500/10" : "bg-white/[0.03]"
                  }`}
                >
                  <VehicleIcon type={est.vehicle_type} className="w-16 h-8" active={isActive} />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <p className={`font-bold text-base ${isActive ? "text-white" : "text-gray-200"}`}>
                    {est.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{est.description}</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    {est.capacity} Pers. · {est.eta_minutes} Min
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-lg font-bold ${isActive ? "text-cyan-400" : "text-gray-300"}`}>
                  €{est.fare.toFixed(2)}
                </p>
                {est.fare_range && (
                  <p className="text-[10px] text-gray-600">
                    €{est.fare_range.min.toFixed(2)}–€{est.fare_range.max.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
