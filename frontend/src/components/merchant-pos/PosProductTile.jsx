import { ImageIcon, Layers3 } from "lucide-react";

export const PosProductTile = ({ product, copy, onClick, disabled, testId }) => {
  const outOfStock = Number(product.stock || 0) <= 0 && product.track_stock;
  const lowStock = !outOfStock && Number(product.stock || 0) > 0 && Number(product.stock || 0) <= Number(product.minimum_stock || 0);
  const hasVariants = Boolean(product.variants?.length || product.has_variants || product.variant_count);
  const promo = product.promotion_badge || product.promo_label;

  return (
    <button
      onClick={onClick}
      disabled={disabled || outOfStock}
      className={`group min-h-[160px] rounded-[24px] border p-4 text-left text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${disabled || outOfStock ? "cursor-not-allowed border-white/8 bg-[#0A1118] opacity-60" : "border-white/10 bg-[#071019] hover:border-cyan-400/30 active:scale-[0.99]"}`}
      data-testid={testId}
      aria-label={`${product.name} ${Number(product.price || 0).toFixed(2)} Euro`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-white/5">
          {product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={18} className="text-white/42" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-base font-black leading-tight" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{product.name}</div>
              <div className="mt-2 text-xs text-white/54" style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{product.category || "Allgemein"}</div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-black whitespace-nowrap">{Number(product.price || 0).toFixed(2)} €</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
            {promo ? <span className="rounded-full border border-cyan-400/20 bg-cyan-400/12 px-2 py-1 text-cyan-100">{promo || copy.promo}</span> : null}
            {hasVariants ? <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white/75"><Layers3 size={12} aria-hidden="true" />{copy.variant}</span> : null}
            {lowStock ? <span className="rounded-full border border-amber-400/30 bg-amber-400/12 px-2 py-1 text-amber-100">{copy.lowStock}</span> : null}
            {outOfStock ? <span className="rounded-full border border-rose-400/30 bg-rose-400/12 px-2 py-1 text-rose-100">{copy.outOfStock}</span> : null}
          </div>
        </div>
      </div>
    </button>
  );
};