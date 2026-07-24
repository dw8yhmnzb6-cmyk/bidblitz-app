import React from 'react';
import { motion } from 'framer-motion';
import { TOP_CATEGORIES, CUISINES, ORDER_STATUS_ICONS } from './foodConstants';

export default function RestaurantListView({
  loading,
  restaurants,
  searchQuery,
  selectedCategory,
  filterFree,
  filterTop,
  activeOrder,
  onSearchChange,
  onFilterFreeToggle,
  onFilterTopToggle,
  onResetFilters,
  onOpenRestaurant,
  onViewOrders,
  onOpenTracking,
}) {
  return (
    <motion.div
      key="restaurants"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Search */}
      <div className="relative mb-4">
        <input
          data-testid="food-search-input"
          type="text"
          placeholder="Du suchst Restaurants?"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-12 pr-12 py-4 bg-white/10 border border-white/10 rounded-2xl text-white placeholder-gray-400 focus:border-orange-500/50 focus:outline-none"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-orange-500">🔍</span>
      </div>

      {/* Top Categories */}
      <div className="mb-6 -mx-4 px-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-4 pb-2">
          {TOP_CATEGORIES.map((cat) => (
            <button key={cat.id} data-testid={`food-top-cat-${cat.id}`} className="flex flex-col items-center shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500/10 to-red-500/10 flex items-center justify-center mb-2 hover:scale-105 transition-transform">
                <span className="text-4xl">{cat.icon}</span>
              </div>
              <span className="text-xs text-white/60 font-medium">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Entdecke Küchen */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Entdecke, was dir schmeckt</h2>
          <button className="text-sm text-orange-400 font-semibold">Alle anzeigen</button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {CUISINES.map((c, i) => (
            <button key={i} className="flex flex-col items-center">
              <div className={`w-full aspect-square rounded-2xl bg-gradient-to-br ${c.color} to-transparent flex items-center justify-center mb-2 hover:scale-105 transition-transform`}>
                <span className="text-4xl">{c.icon}</span>
              </div>
              <span className="text-[10px] text-white/60 text-center font-medium">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter badges */}
      <div className="mb-6 flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
        {[
          { id: 'deals', label: 'Angebote', icon: '🏷️', active: false, onClick: () => {} },
          { id: 'free', label: 'Kostenlose Lieferung', icon: '🚚', active: filterFree, onClick: onFilterFreeToggle },
          { id: 'vegan', label: 'Vegan', icon: '🌱', active: false, onClick: () => {} },
          { id: 'top', label: 'Top Bewertet', icon: '⭐', active: filterTop, onClick: onFilterTopToggle },
        ].map((f) => (
          <button
            key={f.id}
            data-testid={`food-filter-${f.id}`}
            onClick={f.onClick}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              f.active ? 'bg-orange-500 text-white border-orange-500' : 'bg-transparent text-white/80 border-white/20'
            }`}
          >
            <span>{f.icon}</span>
            {f.label}
          </button>
        ))}
      </div>

      <h3 className="text-lg font-bold text-white mb-4">Restaurants in deiner Nähe</h3>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Lädt Restaurants...</div>
        ) : restaurants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 mb-6 rounded-full bg-orange-500/10 flex items-center justify-center">
              <span className="text-4xl">🍽️</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Keine Restaurants</h3>
            <p className="text-gray-400 text-sm max-w-xs mb-4">
              {searchQuery || selectedCategory
                ? 'Keine Restaurants für diese Suche gefunden. Versuche andere Filter.'
                : 'Derzeit sind keine Restaurants in deiner Nähe verfügbar. Schau später nochmal vorbei!'}
            </p>
            {(searchQuery || selectedCategory) && (
              <button
                data-testid="food-reset-filters"
                onClick={onResetFilters}
                className="px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg text-sm font-medium"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>
        ) : (
          restaurants.map((r) => (
            <motion.button
              key={r.restaurant_id}
              data-testid={`food-restaurant-${r.restaurant_id}`}
              onClick={() => onOpenRestaurant(r.restaurant_id)}
              className="w-full bg-[#111] rounded-2xl border border-white/10 overflow-hidden text-left hover:border-orange-500/30 transition-all"
              whileTap={{ scale: 0.98 }}
            >
              <div className="h-32 bg-gray-800 relative">
                {r.image ? (
                  <img
                    src={r.image}
                    alt={r.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/400x200?text=Restaurant'; }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-500/10 to-red-500/10 flex items-center justify-center text-4xl">🍽️</div>
                )}
                {!r.is_open && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-red-400 font-bold">Geschlossen</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{r.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {'€'.repeat(r.price_level || 2)} • {r.delivery_time} Min
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-green-500/20 px-2 py-1 rounded-lg">
                    <span className="text-yellow-400">★</span>
                    <span className="text-green-400 font-medium">{r.rating}</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(r.free_delivery || r.delivery_fee === 0) ? (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold">Gratis Lieferung</span>
                  ) : (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500">€{(r.delivery_fee || 1.99).toFixed(2)} Lieferung</span>
                  )}
                  {r.price_guarantee && <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold">Preis-Garantie</span>}
                  {r.is_new && <span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold">NEU</span>}
                  {r.stamps_enabled && <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-bold">🎟️ Stempelkarte</span>}
                  {r.min_order && <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500">Min. €{r.min_order}</span>}
                </div>
              </div>
            </motion.button>
          ))
        )}
      </div>

      {activeOrder && (
        <button
          data-testid="food-active-order-banner"
          onClick={onOpenTracking}
          className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto p-4 bg-orange-500 rounded-2xl text-black font-bold flex items-center justify-between shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{ORDER_STATUS_ICONS[activeOrder.status]}</span>
            <span>Bestellung läuft</span>
          </div>
          <span>Anzeigen →</span>
        </button>
      )}

      <button
        data-testid="food-open-history-btn"
        onClick={onViewOrders}
        className="w-full py-3 bg-white/5 rounded-xl text-gray-400 hover:bg-white/10"
      >
        📋 Bestellverlauf
      </button>
    </motion.div>
  );
}
