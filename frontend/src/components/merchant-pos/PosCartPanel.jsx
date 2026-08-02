import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";

const lineClampStyle = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };

function TotalsRow({ label, value, emphasized, testId }) {
  return <div className={`flex items-center justify-between gap-3 ${emphasized ? "pt-2 text-base font-black text-white" : "text-sm text-white/70"}`} data-testid={testId}><span>{label}</span><span>{Number(value || 0).toFixed(2)} €</span></div>;
}

export const PosCartPanel = ({ copy, cart, totals, locked, onDecrease, onIncrease, onRemove, onPay, onClose, mobile = false, testId = "merchant-pos-cart-panel" }) => (
  <div className={`rounded-[28px] border border-white/10 bg-white/5 p-4 ${mobile ? "max-h-[85vh] overflow-y-auto" : "h-full"}`} data-testid={testId}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-black text-white">{copy.cart}</h2>
        {locked ? <p className="mt-2 text-sm text-amber-100">{copy.cartLocked}</p> : null}
      </div>
      {mobile && onClose ? <Button onClick={onClose} variant="outline" className="min-h-12 border-white/10 bg-white/5 text-white" data-testid="merchant-pos-cart-close-button">{copy.cancel}</Button> : null}
    </div>
    {cart.length ? (
      <div className="mt-4 space-y-3" data-testid="merchant-pos-cart-items-list">
        {cart.map((item, index) => (
          <div key={item.product_id} className="rounded-[20px] border border-white/10 bg-[#071019] p-4" data-testid={`merchant-pos-cart-item-${index + 1}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-black text-white" style={lineClampStyle}>{item.name}</div>
                <div className="mt-1 text-sm text-white/54">{Number(item.price || 0).toFixed(2)} € · {copy.qty} {item.quantity}</div>
              </div>
              <button onClick={() => onRemove(item.product_id)} disabled={locked} className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/72 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50" data-testid={`merchant-pos-cart-remove-${index + 1}`} aria-label={`${item.name} entfernen`}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button onClick={() => onDecrease(item.product_id)} disabled={locked || item.quantity <= 1} className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50" data-testid={`merchant-pos-cart-decrease-${index + 1}`} aria-label={`${item.name} reduzieren`}><Minus size={16} aria-hidden="true" /></button>
                <div className="w-10 text-center text-lg font-black text-white" data-testid={`merchant-pos-cart-quantity-${index + 1}`}>{item.quantity}</div>
                <button onClick={() => onIncrease(item.product_id)} disabled={locked} className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50" data-testid={`merchant-pos-cart-increase-${index + 1}`} aria-label={`${item.name} erhöhen`}><Plus size={16} aria-hidden="true" /></button>
              </div>
              <div className="text-lg font-black text-white">{Number(item.line_total || item.price * item.quantity || 0).toFixed(2)} €</div>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="mt-4 rounded-[22px] border border-dashed border-white/10 bg-[#071019] p-5 text-center" data-testid="merchant-pos-cart-empty-state">
        <div className="text-lg font-black text-white">{copy.cartEmpty}</div>
        <p className="mt-2 text-sm text-white/58">{copy.cartHint}</p>
      </div>
    )}
    <div className="mt-5 space-y-2 rounded-[22px] border border-white/10 bg-[#071019] p-4">
      <TotalsRow label={copy.subtotal} value={totals.subtotal} testId="merchant-pos-subtotal" />
      <TotalsRow label={copy.discount} value={totals.discount} testId="merchant-pos-discount" />
      <TotalsRow label={copy.tax} value={totals.tax} testId="merchant-pos-tax" />
      <TotalsRow label={copy.total} value={totals.total} emphasized testId="merchant-pos-total" />
    </div>
    <div className="mt-4">
      <Button onClick={onPay} disabled={!cart.length || locked} className="min-h-14 w-full rounded-full bg-[#06B6D4] text-lg font-black text-black disabled:opacity-50" data-testid="merchant-pos-pay-button">{copy.pay}</Button>
    </div>
  </div>
);