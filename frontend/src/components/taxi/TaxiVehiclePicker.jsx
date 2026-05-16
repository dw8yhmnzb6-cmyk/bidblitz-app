/**
 * TaxiVehiclePicker — list of vehicle estimate cards (Standard/Premium/Van/etc.)
 * with selectable highlight, fare display, price-range subtitle, and an
 * expandable "Anpassen" sub-panel (taxi.eu-parity) showing fastest/cheapest
 * priority + service speed metadata for the currently selected card.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { VehicleIcon } from "./TaxiVehicleIcon";

const PRIORITIES = [
  { key: "fastest", label: "Schnellster", icon: "⚡" },
  { key: "cheapest", label: "Günstigster", icon: "💰" },
  { key: "rated", label: "Best bewertet", icon: "★" },
];

export default function TaxiVehiclePicker({
  estimates, selectedVehicle, onSelect,
  priority = "fastest", onChangePriority,
}) {
  const [expandedKey, setExpandedKey] = useState(null);
  if (!estimates || estimates.length === 0) return null;
  return (
    <div className="space-y-3" data-testid="taxi-vehicle-picker">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-300 text-sm uppercase tracking-wider">
          {estimates.length === 1 ? "Ein Produkt verfügbar" : `${estimates.length} Produkte verfügbar`}
        </h3>
      </div>

      {estimates.map((est) => {
        const isActive = selectedVehicle === est.vehicle_type;
        const isExpanded = expandedKey === est.vehicle_type && isActive;
        return (
          <div key={est.vehicle_type}>
            <motion.button
              onClick={() => onSelect(est.vehicle_type)}
              whileTap={{ scale: 0.98 }}
              data-testid={`vehicle-card-${est.vehicle_type}`}
              className={`w-full p-3 rounded-2xl border-2 transition-all overflow-hidden ${
                isActive
                  ? "bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border-cyan-400/70 shadow-[0_0_24px_rgba(0,194,255,0.15)]"
                  : "bg-[#0F1218] border-white/5 hover:border-white/15"
              } ${isExpanded ? "rounded-b-none" : ""}`}
            >
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div
                    className={`shrink-0 w-14 h-10 rounded-lg flex items-center justify-center ${
                      isActive ? "bg-cyan-500/10" : "bg-white/[0.03]"
                    }`}
                  >
                    <VehicleIcon type={est.vehicle_type} className="w-11 h-6" active={isActive} />
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className={`font-bold text-[15px] leading-tight truncate ${isActive ? "text-white" : "text-gray-200"}`}>
                        {est.name}
                      </p>
                      {isActive && priority === "fastest" && (
                        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded-md">
                          schnell
                        </span>
                      )}
                      {isActive && priority === "cheapest" && (
                        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded-md">
                          günstig
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">{est.description}</p>
                    <p className="text-[11px] text-gray-600 mt-0.5 whitespace-nowrap">
                      {est.capacity}&nbsp;P · {est.eta_minutes}&nbsp;Min
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-1">
                  <p className={`text-base font-bold tabular-nums whitespace-nowrap ${isActive ? "text-cyan-400" : "text-gray-200"}`}>
                    €{est.fare.toFixed(2)}
                  </p>
                  {est.fare_discount > 0 && est.fare_original && (
                    <p className="text-[10px] text-emerald-400 font-semibold whitespace-nowrap tabular-nums">
                      <span className="line-through text-gray-500 mr-1">€{est.fare_original.toFixed(2)}</span>
                      −€{est.fare_discount.toFixed(2)}
                    </p>
                  )}
                  {!est.fare_discount && est.fare_range && (
                    <p className="text-[10px] text-gray-600 whitespace-nowrap tabular-nums">
                      €{Math.round(est.fare_range.min)}–€{Math.round(est.fare_range.max)}
                    </p>
                  )}
                </div>
              </div>

              {isActive && (
                <div
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedKey(isExpanded ? null : est.vehicle_type);
                  }}
                  className="mt-2.5 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-cyan-400 hover:text-cyan-300"
                  data-testid={`vehicle-customize-${est.vehicle_type}`}
                >
                  <span className="font-medium">Anpassen</span>
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </div>
              )}
            </motion.button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden bg-[#0F1218] border-2 border-t-0 border-cyan-400/70 rounded-b-2xl"
                >
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
                        Priorität
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {PRIORITIES.map((p) => (
                          <button
                            key={p.key}
                            onClick={() => onChangePriority?.(p.key)}
                            className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                              priority === p.key
                                ? "bg-cyan-500 text-black"
                                : "bg-white/5 text-gray-300 hover:bg-white/10"
                            }`}
                            data-testid={`priority-${p.key}`}
                          >
                            <span className="mr-1">{p.icon}</span>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white/5 rounded-xl px-3 py-2">
                        <p className="text-gray-500 text-[10px]">Max. Sitzplätze</p>
                        <p className="text-white font-semibold">{est.capacity}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl px-3 py-2">
                        <p className="text-gray-500 text-[10px]">Geschätzte Ankunft</p>
                        <p className="text-white font-semibold">~{est.eta_minutes} Min</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
