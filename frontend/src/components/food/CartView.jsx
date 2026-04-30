import React from 'react';
import { motion } from 'framer-motion';

export default function CartView({ cart, cartTotal, deliveryFee, serviceFee, smallOrderFee, orderTotal, onUpdateQty, onProceedCheckout }) {
  return (
    <motion.div
      key="cart"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <h2 className="text-xl font-bold">Warenkorb</h2>

      {cart.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🛒</div>
          <p className="text-gray-400">Dein Warenkorb ist leer</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.item_id} className="p-4 bg-[#111] rounded-xl border border-white/10 flex items-center justify-between">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-orange-400 font-bold">€{(item.price * item.quantity).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    data-testid={`food-cart-minus-${item.item_id}`}
                    onClick={() => onUpdateQty(item.item_id, -1)}
                    className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="font-bold w-6 text-center">{item.quantity}</span>
                  <button
                    data-testid={`food-cart-plus-${item.item_id}`}
                    onClick={() => onUpdateQty(item.item_id, 1)}
                    className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-black"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-[#111] rounded-xl border border-white/10 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Zwischensumme</span>
              <span>€{cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Liefergebühr</span>
              <span>€{deliveryFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Servicegebühr (10%)</span>
              <span>€{serviceFee.toFixed(2)}</span>
            </div>
            {smallOrderFee > 0 && (
              <div className="flex justify-between text-sm text-yellow-400">
                <span>Kleinbestellgebühr</span>
                <span>€{smallOrderFee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-3 border-t border-white/10">
              <span>Gesamt</span>
              <span className="text-orange-400">€{orderTotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            data-testid="food-checkout-btn"
            onClick={onProceedCheckout}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl font-bold text-black text-lg"
          >
            Zur Kasse (€{orderTotal.toFixed(2)})
          </button>
        </>
      )}
    </motion.div>
  );
}
