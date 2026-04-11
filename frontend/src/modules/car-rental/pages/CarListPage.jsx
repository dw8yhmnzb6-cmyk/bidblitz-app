/**
 * BidBlitz V2 - Car Rental List Page
 * Browse and filter available rental cars
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, Filter, MapPin, Calendar, Car, Fuel, Settings2,
  Users, Star, ChevronRight, Loader2, X, SlidersHorizontal
} from "lucide-react";
import { searchCars, calculateCarPrice } from "../api";

const FUEL_TYPES = [
  { value: "", label: "Alle" },
  { value: "petrol", label: "Benzin" },
  { value: "diesel", label: "Diesel" },
  { value: "electric", label: "Elektro" },
  { value: "hybrid", label: "Hybrid" },
];

const GEARBOX_TYPES = [
  { value: "", label: "Alle" },
  { value: "manual", label: "Schaltung" },
  { value: "automatic", label: "Automatik" },
];

const SORT_OPTIONS = [
  { value: "price", label: "Preis (niedrig)" },
  { value: "-price", label: "Preis (hoch)" },
  { value: "newest", label: "Neueste" },
  { value: "popular", label: "Beliebteste" },
];

export default function CarListPage({ onBack, onNavigate }) {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState({
    city: "",
    start_date: "",
    end_date: "",
    min_price: "",
    max_price: "",
    fuel_type: "",
    gearbox: "",
    min_seats: "",
    brand: "",
    sort_by: "price",
  });

  const loadCars = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters, page, limit: 20 };
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });
      
      const data = await searchCars(params);
      setCars(data.cars || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Error loading cars:", err);
    }
    setLoading(false);
  }, [filters, page]);

  useEffect(() => {
    loadCars();
  }, [loadCars]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      city: "",
      start_date: "",
      end_date: "",
      min_price: "",
      max_price: "",
      fuel_type: "",
      gearbox: "",
      min_seats: "",
      brand: "",
      sort_by: "price",
    });
    setPage(1);
  };

  const getFuelLabel = (type) => {
    const fuel = FUEL_TYPES.find(f => f.value === type);
    return fuel ? fuel.label : type;
  };

  const getGearboxLabel = (type) => {
    const gearbox = GEARBOX_TYPES.find(g => g.value === type);
    return gearbox ? gearbox.label : type;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="p-2 rounded-xl bg-white/5 border border-white/10"
            >
              <ArrowLeft size={20} />
            </motion.button>
            <div>
              <h1 className="text-lg font-bold">Mietwagen</h1>
              <p className="text-xs text-[#666]">{total} Fahrzeuge verfügbar</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFilters(!showFilters)}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 relative"
          >
            <SlidersHorizontal size={18} />
            {Object.values(filters).filter(v => v && v !== "price").length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#00C2FF] rounded-full text-[10px] flex items-center justify-center font-bold">
                {Object.values(filters).filter(v => v && v !== "price").length}
              </span>
            )}
          </motion.button>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
            <input
              type="text"
              placeholder="Stadt oder Marke suchen..."
              value={filters.city}
              onChange={(e) => handleFilterChange("city", e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-[#666] outline-none focus:border-[#00C2FF]/50"
            />
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-[#111118] border-b border-white/5"
          >
            <div className="p-4 space-y-4">
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Abholdatum</label>
                  <input
                    type="date"
                    value={filters.start_date}
                    onChange={(e) => handleFilterChange("start_date", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Rückgabedatum</label>
                  <input
                    type="date"
                    value={filters.end_date}
                    onChange={(e) => handleFilterChange("end_date", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm outline-none"
                  />
                </div>
              </div>

              {/* Price Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Min. Preis/Tag</label>
                  <input
                    type="number"
                    placeholder="€0"
                    value={filters.min_price}
                    onChange={(e) => handleFilterChange("min_price", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Max. Preis/Tag</label>
                  <input
                    type="number"
                    placeholder="€500"
                    value={filters.max_price}
                    onChange={(e) => handleFilterChange("max_price", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm outline-none"
                  />
                </div>
              </div>

              {/* Fuel & Gearbox */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Kraftstoff</label>
                  <select
                    value={filters.fuel_type}
                    onChange={(e) => handleFilterChange("fuel_type", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm outline-none cursor-pointer"
                  >
                    {FUEL_TYPES.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Getriebe</label>
                  <select
                    value={filters.gearbox}
                    onChange={(e) => handleFilterChange("gearbox", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm outline-none cursor-pointer"
                  >
                    {GEARBOX_TYPES.map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Min Seats & Sort */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Min. Sitze</label>
                  <select
                    value={filters.min_seats}
                    onChange={(e) => handleFilterChange("min_seats", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm outline-none cursor-pointer"
                  >
                    <option value="">Alle</option>
                    <option value="2">2+</option>
                    <option value="4">4+</option>
                    <option value="5">5+</option>
                    <option value="7">7+</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Sortierung</label>
                  <select
                    value={filters.sort_by}
                    onChange={(e) => handleFilterChange("sort_by", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm outline-none cursor-pointer"
                  >
                    {SORT_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Clear Filters */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={clearFilters}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-[#666] bg-white/5 border border-white/10"
              >
                Filter zurücksetzen
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Car List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" />
          </div>
        ) : cars.length === 0 ? (
          <div className="text-center py-20">
            <Car size={48} className="mx-auto text-[#333] mb-4" />
            <h3 className="text-lg font-semibold text-white/70">Keine Fahrzeuge gefunden</h3>
            <p className="text-sm text-[#666] mt-2">Versuche andere Suchkriterien</p>
          </div>
        ) : (
          cars.map((car, idx) => (
            <motion.div
              key={car.car_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onNavigate(`/car-rental/car/${car.car_id}`)}
              className="bg-[#111118] rounded-2xl overflow-hidden border border-white/5 cursor-pointer active:scale-[0.98] transition-transform"
            >
              {/* Car Image */}
              <div className="relative h-40 bg-gradient-to-br from-[#1a1a25] to-[#0f0f15]">
                {car.main_image ? (
                  <img
                    src={car.main_image}
                    alt={car.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Car size={64} className="text-[#333]" />
                  </div>
                )}
                
                {/* Price Badge */}
                <div className="absolute top-3 right-3 bg-[#00C2FF] text-black px-3 py-1.5 rounded-xl">
                  <span className="text-lg font-bold">€{car.price_per_day}</span>
                  <span className="text-xs">/Tag</span>
                </div>

                {/* Rating */}
                {car.rating > 0 && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg">
                    <Star size={12} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-xs font-medium">{car.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {/* Car Info */}
              <div className="p-4">
                <h3 className="font-semibold text-white">{car.title}</h3>
                <p className="text-xs text-[#666] mt-0.5">{car.brand} {car.model} · {car.year}</p>

                <div className="flex items-center gap-4 mt-3 text-xs text-[#888]">
                  <span className="flex items-center gap-1">
                    <Fuel size={12} />
                    {getFuelLabel(car.fuel_type)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Settings2 size={12} />
                    {getGearboxLabel(car.gearbox)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {car.seats} Sitze
                  </span>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-1 text-xs text-[#666]">
                    <MapPin size={12} />
                    {car.city}
                  </div>
                  <div className="flex items-center gap-1 text-[#00C2FF] text-xs font-medium">
                    Details <ChevronRight size={14} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2 p-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm disabled:opacity-50"
          >
            Zurück
          </motion.button>
          <span className="px-4 py-2 text-sm text-[#666]">
            Seite {page} von {Math.ceil(total / 20)}
          </span>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm disabled:opacity-50"
          >
            Weiter
          </motion.button>
        </div>
      )}
    </div>
  );
}
