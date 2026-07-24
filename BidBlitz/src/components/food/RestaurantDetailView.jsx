import React from 'react';
import { motion } from 'framer-motion';
import { getFoodImage } from './foodConstants';

export default function RestaurantDetailView({
  restaurant,
  menuCat,
  stamps,
  cart,
  cartTotal,
  onSetMenuCat,
  onAddItem,
  onOpenExtras,
  onOpenCart,
}) {
  if (!restaurant) return null;

  return (
    <motion.div
      key="restaurant"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="-mx-4 -mt-6">
        <div className="h-48 bg-gray-800 relative">
          {restaurant.image ? (
            <img src={restaurant.image} alt={restaurant.name} className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />
        </div>
        <div className="px-4 -mt-12 relative z-10">
          <h2 className="text-2xl font-bold">{restaurant.name}</h2>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <span className="text-yellow-400">★</span>
              {restaurant.rating}
            </span>
            <span>•</span>
            <span>{restaurant.delivery_time} Min</span>
            <span>•</span>
            <span>Min. €{(restaurant.min_order || 10).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Menu category tabs */}
      {restaurant.menu_categories?.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => onSetMenuCat('')}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold ${!menuCat ? 'bg-orange-500 text-black' : 'bg-white/5 text-gray-400'}`}
          >
            Alle
          </button>
          {restaurant.menu_categories.map((c) => (
            <button
              key={c.id}
              onClick={() => onSetMenuCat(c.id)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold ${menuCat === c.id ? 'bg-orange-500 text-black' : 'bg-white/5 text-gray-400'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Loyalty */}
      {restaurant.stamps_enabled && (
        <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-3">
          <span className="text-xl">🎟️</span>
          <div className="flex-1">
            <p className="text-[11px] font-bold text-orange-400">Treuekarte aktiv</p>
            <p className="text-[9px] text-gray-500">{restaurant.stamps_needed}x bestellen = Gratis-Essen!</p>
          </div>
          <div className="flex gap-0.5">
            {Array(restaurant.stamps_needed || 10).fill(0).map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i < (stamps || 0) ? 'bg-orange-500' : 'bg-white/10'}`} />
            ))}
          </div>
        </div>
      )}

      {/* Menu items */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-300">Speisekarte</h3>

        {(restaurant.menu || []).filter((item) => !menuCat || item.category === menuCat).map((item) => (
          <div key={item.id} className="p-4 bg-[#111] rounded-xl border border-white/10 flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-800">
              {(item.image || getFoodImage(item.name)) && (
                <img
                  src={item.image || getFoodImage(item.name)}
                  alt={item.name || ''}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.onerror = null; e.target.src = getFoodImage(''); }}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white">{item.name}</p>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
              <p className="text-orange-400 font-bold mt-2">€{item.price.toFixed(2)}</p>
            </div>
            <button
              data-testid={`food-add-item-${item.id}`}
              onClick={() => {
                if ((item.extras?.length > 0) || (item.sizes?.length > 0)) {
                  onOpenExtras(item);
                } else {
                  onAddItem(item);
                }
              }}
              className="ml-2 w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-black font-bold text-xl flex-shrink-0 hover:bg-orange-400 transition-colors"
            >
              +
            </button>
          </div>
        ))}
      </div>

      {/* Cart preview (sticky) */}
      {cart.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto"
        >
          <button
            data-testid="food-cart-preview-btn"
            onClick={onOpenCart}
            className="w-full p-4 bg-orange-500 rounded-2xl text-black font-bold flex items-center justify-between shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-black/20 rounded-full flex items-center justify-center">
                {cart.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
              <span>Warenkorb ansehen</span>
            </div>
            <span>€{cartTotal.toFixed(2)}</span>
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
