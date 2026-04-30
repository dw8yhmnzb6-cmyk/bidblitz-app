import React from 'react';
import { motion } from 'framer-motion';
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from './foodConstants';

export default function OrderHistoryView({ orderHistory, onReviewOrder }) {
  return (
    <motion.div
      key="orders"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <h2 className="text-xl font-bold">Bestellverlauf</h2>

      {orderHistory.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-400">Noch keine Bestellungen</p>
        </div>
      ) : (
        orderHistory.map((order) => (
          <div key={order.order_id} className="p-4 bg-[#111] rounded-xl border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <img src={order.restaurant_image} alt={order.restaurant_name} className="w-12 h-12 rounded-lg object-cover" />
              <div className="flex-1">
                <p className="font-semibold">{order.restaurant_name}</p>
                <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString('de-DE')}</p>
              </div>
              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
                {ORDER_STATUS_LABELS[order.status]}
              </span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-white/5">
              <span className="text-sm text-gray-400">{order.items?.length || 0} Artikel</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-orange-400">€{order.total?.toFixed(2)}</span>
                {order.status === 'delivered' && (
                  <button
                    data-testid={`food-review-btn-${order.order_id}`}
                    onClick={(e) => { e.stopPropagation(); onReviewOrder(order.order_id); }}
                    className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-bold"
                  >
                    ⭐ Bewerten
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </motion.div>
  );
}
