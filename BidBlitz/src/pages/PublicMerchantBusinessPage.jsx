import { useEffect, useState } from "react";
import { ArrowLeft, Phone, Mail, Globe, Gift, QrCode, Star } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function PublicMerchantBusinessPage({ slug, onBack, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API}/api/merchant/public/${slug}`, { credentials: "include" });
        if (res.ok) {
          const json = await res.json();
          if (mounted) setData(json);
        }
      } catch (error) {
        void error;
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug]);

  if (loading) {
    return <div className="min-h-screen bg-[#05070A] text-white flex items-center justify-center">Lädt…</div>;
  }

  if (!data) {
    return <div className="min-h-screen bg-[#05070A] text-white flex items-center justify-center">Business nicht gefunden</div>;
  }

  return (
    <div className="min-h-screen bg-[#05070A] text-white pb-24" data-testid="public-merchant-page">
      <div className="sticky top-0 z-40 bg-[#05070A]/95 backdrop-blur-xl border-b border-white/5 p-4 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="public-merchant-back-btn">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold">{data.business_name}</h1>
          <p className="text-[11px] text-white/50">bidblitz.ae/business/{data.slug}</p>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        <div className="rounded-3xl border border-white/5 bg-[#111118] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">{data.business_name}</h2>
              <p className="text-sm text-white/60 mt-2">{data.description || "Keine Beschreibung vorhanden."}</p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-white/5 overflow-hidden flex items-center justify-center">
              {data.logo_url ? <img src={data.logo_url} alt="" className="w-full h-full object-cover" /> : <StorePlaceholder />}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-[12px]">
            <div className="rounded-xl bg-white/5 p-3 flex items-center gap-2"><Phone size={14} className="text-[#10B981]" /> {data.phone || "—"}</div>
            <div className="rounded-xl bg-white/5 p-3 flex items-center gap-2"><Mail size={14} className="text-[#3B82F6]" /> {data.email || "—"}</div>
            <div className="rounded-xl bg-white/5 p-3 flex items-center gap-2"><Globe size={14} className="text-[#A855F7]" /> {data.website || "—"}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/5 bg-[#111118] p-4" data-testid="public-merchant-products">
            <h3 className="text-sm font-bold mb-3">Produkte</h3>
            <div className="space-y-2">
              {(data.products || []).slice(0, 8).map((product) => (
                <div key={product.product_id} className="rounded-xl bg-white/5 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-[12px] font-semibold">{product.name}</p>
                    <p className="text-[10px] text-white/50">{product.barcode || product.qr_code || product.sku || "—"}</p>
                  </div>
                  <span className="text-sm font-bold text-[#10B981]">€{(product.price || 0).toFixed(2)}</span>
                </div>
              ))}
              {!(data.products || []).length && <p className="text-[11px] text-white/40">Keine Produkte</p>}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/5 bg-[#111118] p-4" data-testid="public-merchant-promotions">
              <div className="flex items-center gap-2 mb-3"><Gift size={16} className="text-[#F59E0B]" /><h3 className="text-sm font-bold">Offers & Promotions</h3></div>
              <div className="space-y-2">
                {(data.promotions || []).slice(0, 4).map((promo) => (
                  <div key={promo.name} className="rounded-xl bg-white/5 p-3">
                    <p className="text-[12px] font-semibold">{promo.name}</p>
                    <p className="text-[10px] text-white/50">{promo.description || promo.type}</p>
                  </div>
                ))}
                {!(data.promotions || []).length && <p className="text-[11px] text-white/40">Keine Aktionen</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#111118] p-4" data-testid="public-merchant-vouchers">
              <div className="flex items-center gap-2 mb-3"><QrCode size={16} className="text-[#00C2FF]" /><h3 className="text-sm font-bold">Gutscheine & QR Pay</h3></div>
              <div className="space-y-2 text-[11px] text-white/70">
                {(data.vouchers || []).slice(0, 3).map((voucher) => (
                  <div key={voucher.voucher_code} className="rounded-xl bg-white/5 p-3 flex items-center justify-between">
                    <span>{voucher.voucher_code}</span>
                    <span className="font-bold text-[#00C2FF]">€{(voucher.amount || 0).toFixed(2)}</span>
                  </div>
                ))}
                <button onClick={() => onNavigate?.("/wallet")} className="w-full py-2 rounded-xl bg-[#00C2FF] text-black font-bold" data-testid="public-merchant-open-wallet-pay">Mit Wallet zahlen</button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-[#111118] p-4" data-testid="public-merchant-reviews">
          <div className="flex items-center gap-2 mb-3"><Star size={16} className="text-[#F59E0B]" /><h3 className="text-sm font-bold">Reviews</h3></div>
          <div className="space-y-2">
            {(data.reviews || []).slice(0, 5).map((review, idx) => (
              <div key={`${review.created_at}-${idx}`} className="rounded-xl bg-white/5 p-3">
                <p className="text-[12px] font-semibold">{review.reviewer_name || "Gast"}</p>
                <p className="text-[10px] text-white/50">{review.comment || "—"}</p>
              </div>
            ))}
            {!(data.reviews || []).length && <p className="text-[11px] text-white/40">Noch keine Reviews</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function StorePlaceholder() {
  return <div className="text-xl font-bold text-white/30">B</div>;
}