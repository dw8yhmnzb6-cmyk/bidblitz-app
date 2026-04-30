import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MenuItemExtrasModal({
  item,
  selectedSize,
  selectedExtras,
  onSelectSize,
  onToggleExtra,
  onConfirm,
  onClose,
}) {
  if (!item) return null;

  const base = item.price;
  const sizeExtra = selectedSize?.price || 0;
  const extrasTotal = selectedExtras.reduce((s, e) => s + e.price, 0);
  const total = base + sizeExtra + extrasTotal;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end"
        onClick={onClose}
        data-testid="food-extras-modal"
      >
        <motion.div
          initial={{ y: 300 }}
          animate={{ y: 0 }}
          exit={{ y: 300 }}
          className="w-full bg-[#111] rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-bold mb-1">{item.name}</h3>
          <p className="text-sm text-gray-400 mb-4">{item.description}</p>

          {item.sizes?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 font-bold mb-2">Größe wählen</p>
              <div className="space-y-1.5">
                {item.sizes.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onSelectSize(s)}
                    className={`w-full p-3 rounded-xl flex justify-between text-sm ${
                      selectedSize?.id === s.id
                        ? 'bg-orange-500/20 border border-orange-500/30 text-orange-400'
                        : 'bg-white/5 border border-white/5 text-gray-400'
                    }`}
                  >
                    <span>{s.name}</span>
                    <span>{s.price > 0 ? `+€${s.price.toFixed(2)}` : 'Inkl.'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {item.extras?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 font-bold mb-2">Extras</p>
              <div className="space-y-1.5">
                {item.extras.map((e) => {
                  const isSelected = selectedExtras.some((se) => se.id === e.id);
                  return (
                    <button
                      key={e.id}
                      onClick={() => onToggleExtra(e)}
                      className={`w-full p-3 rounded-xl flex justify-between text-sm ${
                        isSelected
                          ? 'bg-orange-500/20 border border-orange-500/30 text-orange-400'
                          : 'bg-white/5 border border-white/5 text-gray-400'
                      }`}
                    >
                      <span>{isSelected ? '✓ ' : ''}{e.name}</span>
                      <span>+€{e.price.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            data-testid="food-extras-confirm-btn"
            onClick={() => onConfirm(total)}
            className="w-full py-4 bg-orange-500 rounded-xl font-bold text-black"
          >
            In den Warenkorb · €{total.toFixed(2)}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
