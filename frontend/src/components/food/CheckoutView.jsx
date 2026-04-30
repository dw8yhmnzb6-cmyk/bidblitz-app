import React from 'react';
import { motion } from 'framer-motion';

const API = process.env.REACT_APP_BACKEND_URL;

export default function CheckoutView({
  deliveryAddress,
  onChangeAddress,
  userBalance,
  orderTotal,
  cart,
  selectedRestaurant,
  promoCode,
  promoApplied,
  error,
  loading,
  onSetPromoCode,
  onApplyPromo,
  onRemovePromo,
  onPlaceOrder,
  onSplitPay,
  onGroupOrder,
  onNavigate,
  onSetError,
}) {
  const hasEnough = userBalance >= orderTotal;

  const handlePromoClick = async () => {
    if (promoApplied) { onRemovePromo(); return; }
    try {
      const r = await fetch(`${API}/api/extras/promo/redeem`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode }),
      });
      const d = await r.json();
      if (r.ok) onApplyPromo({ code: promoCode, benefit: d.benefit });
      else onSetError(d.detail || 'Code ungültig');
    } catch {
      onSetError('Netzwerkfehler');
    }
  };

  return (
    <motion.div
      key="checkout"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <h2 className="text-xl font-bold">Lieferadresse</h2>

      <div className="space-y-3">
        <input
          data-testid="food-addr-street"
          type="text"
          placeholder="Straße & Hausnummer"
          value={deliveryAddress.street}
          onChange={(e) => onChangeAddress({ ...deliveryAddress, street: e.target.value })}
          className="w-full px-4 py-4 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            data-testid="food-addr-zip"
            type="text"
            placeholder="PLZ"
            value={deliveryAddress.zip}
            onChange={(e) => onChangeAddress({ ...deliveryAddress, zip: e.target.value })}
            className="px-4 py-4 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none"
          />
          <input
            data-testid="food-addr-city"
            type="text"
            placeholder="Stadt"
            value={deliveryAddress.city}
            onChange={(e) => onChangeAddress({ ...deliveryAddress, city: e.target.value })}
            className="px-4 py-4 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none"
          />
        </div>
        <input
          data-testid="food-addr-notes"
          type="text"
          placeholder="Lieferhinweise (optional)"
          value={deliveryAddress.notes}
          onChange={(e) => onChangeAddress({ ...deliveryAddress, notes: e.target.value })}
          className="w-full px-4 py-4 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none"
        />
      </div>

      <div className={`p-4 rounded-xl border ${hasEnough ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
        <p className="text-gray-400 text-sm mb-2">Zahlungsmethode</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💳</span>
            <div>
              <span className="font-medium">BidBlitz Wallet</span>
              <p className="text-xs text-gray-500">Nur Wallet-Zahlung möglich</p>
            </div>
          </div>
          <span className={`font-bold ${hasEnough ? 'text-green-400' : 'text-red-400'}`}>
            €{userBalance.toFixed(2)}
          </span>
        </div>
        {!hasEnough && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <p className="text-red-400 text-sm mb-2">Du brauchst noch €{(orderTotal - userBalance).toFixed(2)} mehr</p>
            <button
              data-testid="food-topup-btn"
              onClick={() => onNavigate('/wallet')}
              className="w-full py-2 bg-orange-500 text-black font-semibold rounded-lg"
            >
              Wallet aufladen
            </button>
          </div>
        )}
      </div>

      <div className="p-4 bg-[#111] rounded-xl border border-white/10">
        <p className="font-semibold mb-3">{selectedRestaurant?.name}</p>
        <div className="space-y-2 text-sm">
          {cart.map((item) => (
            <div key={item.item_id} className="flex justify-between text-gray-400">
              <span>{item.quantity}x {item.name}</span>
              <span>€{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-white/10 flex justify-between font-bold">
          <span>Gesamt</span>
          <span className="text-orange-400">€{orderTotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="p-4 bg-[#111] rounded-2xl border border-white/10">
        <p className="text-xs text-gray-500 font-bold mb-2">Gutschein-Code</p>
        <div className="flex gap-2">
          <input
            data-testid="food-promo-input"
            value={promoCode}
            onChange={(e) => onSetPromoCode(e.target.value.toUpperCase())}
            placeholder="WELCOME10"
            disabled={!!promoApplied}
            className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none font-mono tracking-wider placeholder-gray-600 disabled:opacity-50"
          />
          <button
            data-testid="food-promo-btn"
            onClick={handlePromoClick}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm ${promoApplied ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-green-500/20 text-green-400 border border-green-500/20'}`}
          >
            {promoApplied ? 'Entfernen' : 'Einlösen'}
          </button>
        </div>
        {promoApplied && (
          <p className="text-[10px] text-green-400 mt-1.5">✓ {promoApplied.code}: +€{promoApplied.benefit?.toFixed(2)} Guthaben!</p>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-center">{error}</div>
      )}

      <button
        data-testid="food-place-order-btn"
        onClick={onPlaceOrder}
        disabled={loading || !hasEnough}
        className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl font-bold text-black text-lg disabled:opacity-50"
      >
        {loading ? 'Wird bestellt...' : !hasEnough ? 'Nicht genug Guthaben' : 'Jetzt bestellen'}
      </button>

      <button
        data-testid="food-split-pay-btn"
        onClick={onSplitPay}
        className="w-full py-3 bg-[#121218] border border-[#00C2FF]/40 text-[#00C2FF] rounded-xl text-sm font-bold flex items-center justify-center gap-2"
      >
        👥 Mit Freunden teilen (Split Pay)
      </button>

      <button
        data-testid="food-group-order-btn"
        onClick={onGroupOrder}
        className="w-full py-3 bg-[#121218] border border-emerald-500/40 text-emerald-300 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
      >
        🍽️ Gemeinsam bestellen (Group Order)
      </button>
    </motion.div>
  );
}
