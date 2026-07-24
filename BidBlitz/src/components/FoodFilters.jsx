import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, X, Check } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function FoodFilters({ onApply, onClose }) {
  const [filters, setFilters] = useState({
    cuisine: [],
    dietary: [],
    rating_min: 0,
    delivery_time_max: null,
    free_delivery: false,
  });
  
  const [cuisines, setCuisines] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCuisines();
  }, []);

  const fetchCuisines = async () => {
    try {
      const res = await fetch(`${API}/api/filters/food/cuisines`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCuisines(data.cuisines || []);
      }
    } catch {}
  };

  const toggleFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter(v => v !== value)
        : [...prev[key], value],
    }));
  };

  const applyFilters = () => {
    onApply(filters);
  };

  const resetFilters = () => {
    setFilters({
      cuisine: [],
      dietary: [],
      rating_min: 0,
      delivery_time_max: null,
      free_delivery: false,
    });
  };

  const dietaryOptions = ['vegan', 'vegetarian', 'halal', 'gluten_free'];

  return (
    <motion.div
      initial={{ y: 400 }}
      animate={{ y: 0 }}
      exit={{ y: 400 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#0B0B0F] rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto"
    >
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SlidersHorizontal size={24} className="text-[#00C2FF]" />
            <h3 className="text-xl font-bold text-white">Filters</h3>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#121218] flex items-center justify-center"
          >
            <X size={16} className="text-gray-400" />
          </motion.button>
        </div>

        {/* Cuisine */}
        <div className="space-y-3">
          <h4 className="text-white font-medium">Cuisine</h4>
          <div className="flex flex-wrap gap-2">
            {cuisines.map(cuisine => (
              <motion.button
                key={cuisine}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleFilter('cuisine', cuisine)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  filters.cuisine.includes(cuisine)
                    ? 'bg-[#00C2FF] text-white'
                    : 'bg-[#121218] text-gray-400'
                }`}
              >
                {cuisine}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Dietary */}
        <div className="space-y-3">
          <h4 className="text-white font-medium">Dietary Options</h4>
          <div className="flex flex-wrap gap-2">
            {dietaryOptions.map(option => (
              <motion.button
                key={option}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleFilter('dietary', option)}
                className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition ${
                  filters.dietary.includes(option)
                    ? 'bg-green-500/20 text-green-400 border-2 border-green-500'
                    : 'bg-[#121218] text-gray-400'
                }`}
              >
                {option.replace('_', ' ')}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Rating */}
        <div className="space-y-3">
          <h4 className="text-white font-medium">Minimum Rating</h4>
          <div className="flex gap-2">
            {[3, 3.5, 4, 4.5, 5].map(rating => (
              <motion.button
                key={rating}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilters(prev => ({ ...prev, rating_min: rating }))}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                  filters.rating_min === rating
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-[#121218] text-gray-400'
                }`}
              >
                {rating}★
              </motion.button>
            ))}
          </div>
        </div>

        {/* Delivery Time */}
        <div className="space-y-3">
          <h4 className="text-white font-medium">Max Delivery Time</h4>
          <div className="flex gap-2">
            {[20, 30, 45, 60].map(time => (
              <motion.button
                key={time}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilters(prev => ({ ...prev, delivery_time_max: time }))}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                  filters.delivery_time_max === time
                    ? 'bg-[#00C2FF] text-white'
                    : 'bg-[#121218] text-gray-400'
                }`}
              >
                {time}min
              </motion.button>
            ))}
          </div>
        </div>

        {/* Free Delivery */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setFilters(prev => ({ ...prev, free_delivery: !prev.free_delivery }))}
          className={`w-full p-4 rounded-2xl flex items-center justify-between transition ${
            filters.free_delivery
              ? 'bg-[#00C2FF]/20 border-2 border-[#00C2FF]'
              : 'bg-[#121218]'
          }`}
        >
          <span className="text-white font-medium">Free Delivery Only</span>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
            filters.free_delivery ? 'bg-[#00C2FF]' : 'bg-gray-700'
          }`}>
            {filters.free_delivery && <Check size={16} className="text-white" />}
          </div>
        </motion.button>

        {/* Actions */}
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={resetFilters}
            className="flex-1 py-4 bg-[#121218] text-white rounded-full font-medium"
          >
            Reset
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={applyFilters}
            className="flex-1 py-4 bg-gradient-to-r from-[#00C2FF] to-[#7B2CFF] text-white rounded-full font-bold"
          >
            Apply Filters
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
