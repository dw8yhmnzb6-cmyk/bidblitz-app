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
        <h3 className="font-taxi-heading font-bold text-zinc-900 text-sm uppercase tracking-[0.22em]">
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
              className={`w-full p-4 rounded-[24px] border transition-all overflow-hidden ${
                isActive
                  ? "bg-[#F6F8FF] border-[#002FA7]/25 shadow-[0_10px_24px_rgba(0,47,167,0.10)]"
                  : "bg-white border-zinc-200 hover:border-zinc-300 shadow-[0_6px_18px_rgba(15,23,42,0.05)]"
              } ${isExpanded ? "rounded-b-none" : ""}`}
            >
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div
                    className={`shrink-0 w-16 h-11 rounded-2xl flex items-center justify-center ${
                      isActive ? "bg-white" : "bg-zinc-100"
                    }`}
                  >
                    <VehicleIcon type={est.vehicle_type} className="w-11 h-6" active={isActive} />
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className={`font-taxi-heading font-black text-[16px] leading-tight truncate ${isActive ? "text-zinc-950" : "text-zinc-900"}`}>
                        {est.name}
                      </p>
                      {isActive && priority === "fastest" && (
                        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#002FA7] bg-[#002FA7]/10 px-2 py-1 rounded-full">
                          schnell
                        </span>
                      )}
                      {isActive && priority === "cheapest" && (
                        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                          günstig
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-zinc-500 truncate mt-0.5">{est.description}</p>
                    <p className="text-[11px] text-zinc-400 mt-1 whitespace-nowrap">
                      {est.capacity}&nbsp;P · {est.eta_minutes}&nbsp;Min
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-1">
                  <p className={`text-lg font-black tabular-nums whitespace-nowrap ${isActive ? "text-[#002FA7]" : "text-zinc-950"}`}>
                    €{est.fare.toFixed(2)}
                  </p>
                  {est.fare_discount > 0 && est.fare_original && (
                    <p className="text-[10px] text-emerald-600 font-semibold whitespace-nowrap tabular-nums">
                      <span className="line-through text-zinc-400 mr-1">€{est.fare_original.toFixed(2)}</span>
                      −€{est.fare_discount.toFixed(2)}
                    </p>
                  )}
                  {!est.fare_discount && est.fare_range && (
                    <p className="text-[10px] text-zinc-400 whitespace-nowrap tabular-nums">
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
                  className="mt-3 pt-3 border-t border-zinc-200 flex items-center justify-between text-[11px] text-[#002FA7] hover:text-[#001f6b]"
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
                  className="overflow-hidden bg-white border border-t-0 border-[#002FA7]/25 rounded-b-[24px] shadow-[0_10px_24px_rgba(0,47,167,0.08)]"
                >
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-semibold mb-2">
                        Priorität
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {PRIORITIES.map((p) => (
                          <button
                            key={p.key}
                            onClick={() => onChangePriority?.(p.key)}
                            className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                              priority === p.key
                                ? "bg-[#002FA7] text-white"
                                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
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
                      <div className="bg-zinc-100 rounded-xl px-3 py-2">
                        <p className="text-zinc-500 text-[10px]">Max. Sitzplätze</p>
                        <p className="text-zinc-950 font-semibold">{est.capacity}</p>
                      </div>
                      <div className="bg-zinc-100 rounded-xl px-3 py-2">
                        <p className="text-zinc-500 text-[10px]">Geschätzte Ankunft</p>
                        <p className="text-zinc-950 font-semibold">~{est.eta_minutes} Min</p>
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
