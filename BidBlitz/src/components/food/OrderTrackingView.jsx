import React from 'react';
import { motion } from 'framer-motion';
import { ORDER_STATUS_ICONS, ORDER_STATUS_LABELS } from './foodConstants';

const STEPS = ['confirmed', 'preparing', 'picked_up', 'delivered'];

export default function OrderTrackingView({ activeOrder, loading, onCancel, onConfirm, onNewOrder }) {
  if (!activeOrder) return null;

  const stepIdx = STEPS.indexOf(activeOrder.status);

  return (
    <motion.div
      key="tracking"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Status */}
      <div className="text-center">
        <div className="text-6xl mb-4">{ORDER_STATUS_ICONS[activeOrder.status]}</div>
        <h2 className="text-xl font-bold">{ORDER_STATUS_LABELS[activeOrder.status]}</h2>
        <p className="text-gray-400 mt-2">
          {activeOrder.status === 'pending' && 'Restaurant prüft deine Bestellung...'}
          {activeOrder.status === 'confirmed' && 'Deine Bestellung wird vorbereitet'}
          {activeOrder.status === 'preparing' && 'Koch bei der Arbeit!'}
          {activeOrder.status === 'picked_up' && 'Fahrer ist unterwegs zu dir'}
          {activeOrder.status === 'delivered' && 'Guten Appetit!'}
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between px-4">
        {STEPS.map((status, idx) => (
          <React.Fragment key={status}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stepIdx >= idx ? 'bg-orange-500 text-black' : 'bg-white/10 text-gray-500'}`}>
              {idx + 1}
            </div>
            {idx < 3 && (
              <div className={`flex-1 h-1 mx-2 ${stepIdx > idx ? 'bg-orange-500' : 'bg-white/10'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ETA */}
      {activeOrder.estimated_delivery && !['delivered', 'cancelled'].includes(activeOrder.status) && (
        <div className="p-4 bg-[#111] rounded-xl border border-white/10 text-center">
          <p className="text-gray-400 text-sm">Geschätzte Lieferzeit</p>
          <p className="text-2xl font-bold mt-1">
            {new Date(activeOrder.estimated_delivery).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}

      {/* Courier */}
      {activeOrder.courier && (
        <div className="p-4 bg-[#111] rounded-xl border border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center text-2xl">🛵</div>
            <div>
              <p className="font-semibold">{activeOrder.courier.name}</p>
              <p className="text-sm text-gray-400">{activeOrder.courier.vehicle}</p>
            </div>
            <a href={`tel:${activeOrder.courier.phone}`} className="ml-auto p-3 bg-green-500/20 rounded-full text-green-400">📞</a>
          </div>
        </div>
      )}

      {/* Order details */}
      <div className="p-4 bg-[#111] rounded-xl border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          {activeOrder.restaurant_image ? (
            <img src={activeOrder.restaurant_image} alt={activeOrder.restaurant_name || ''} className="w-12 h-12 rounded-lg object-cover" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center text-xl">🍽️</div>
          )}
          <div>
            <p className="font-semibold">{activeOrder.restaurant_name}</p>
            <p className="text-sm text-gray-400">{activeOrder.items?.length} Artikel</p>
          </div>
        </div>
        <div className="space-y-2 text-sm border-t border-white/10 pt-4">
          {(activeOrder.items || []).map((item, idx) => (
            <div key={idx} className="flex justify-between text-gray-400">
              <span>{item.quantity}x {item.name}</span>
              <span>€{item.total?.toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold pt-2 border-t border-white/10">
            <span>Gesamt</span>
            <span className="text-orange-400">€{activeOrder.total?.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {activeOrder.status === 'picked_up' && (
        <button
          data-testid="food-confirm-delivery-btn"
          onClick={onConfirm}
          className="w-full py-4 bg-green-500 rounded-xl font-bold text-black"
        >
          ✅ Lieferung bestätigen
        </button>
      )}

      {['pending', 'confirmed'].includes(activeOrder.status) && (
        <button
          data-testid="food-cancel-order-btn"
          onClick={onCancel}
          disabled={loading}
          className="w-full py-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 font-semibold"
        >
          {loading ? 'Wird storniert...' : 'Bestellung stornieren'}
        </button>
      )}

      {activeOrder.status === 'delivered' && (
        <button
          data-testid="food-new-order-btn"
          onClick={onNewOrder}
          className="w-full py-4 bg-orange-500 rounded-xl font-bold text-black"
        >
          Neue Bestellung
        </button>
      )}
    </motion.div>
  );
}
