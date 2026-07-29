import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Building2, Globe, Mail, MapPin, Phone, ReceiptText, ShieldCheck, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";


export default function ChargeMerchantDetailPage({ slug, onBack, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      const response = await api.getChargeMerchantDetail(slug);
      setData(response);
    } catch (error) {
      toast.error(error.message || "Händlerdetail konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#06101B]" data-testid="charge-merchant-detail-loading"><Loader2 size={24} className="animate-spin text-[#6EE7F9]" /></div>;
  }

  if (!data?.merchant) {
    return <div className="min-h-screen flex items-center justify-center bg-[#06101B] text-white" data-testid="charge-merchant-detail-empty">Händler nicht gefunden</div>;
  }

  const merchant = data.merchant;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#06101B_0%,#0C1623_38%,#F3EFE7_38%,#F3EFE7_100%)] pb-24" data-testid="charge-merchant-detail-page">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#08131dcc] px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5" data-testid="charge-merchant-detail-back-button"><ArrowLeft size={18} className="text-white" /></button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#6EE7F9]">Charge Finder</p>
            <h1 className="truncate text-xl font-black text-white">{merchant.business_name}</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(110,231,249,0.22),transparent_30%),linear-gradient(135deg,rgba(8,19,29,1),rgba(14,26,43,0.96))] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]" data-testid="charge-merchant-detail-hero">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <p className="inline-flex rounded-full border border-[#6EE7F9]/20 bg-[#6EE7F9]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#D8FCFF]">{merchant.category || "Charge Partner"}</p>
              <h2 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">{merchant.business_name}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">{merchant.description || "BidBlitz Charge Händler mit Fokus auf hochwertiges Zubehör, klare Produktberatung und digitale Garantiebetreuung."}</p>
              <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-200">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2" data-testid="charge-merchant-detail-city">{merchant.city || "Deutschland"}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2" data-testid="charge-merchant-detail-support">Digitale Garantie verfügbar</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2" data-testid="charge-merchant-detail-offers-count">{(data.promotions || []).length} Angebote</span>
              </div>
            </div>
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] bg-white/5 text-[#6EE7F9]">
              {merchant.logo_url ? <img src={merchant.logo_url} alt="" className="h-full w-full object-cover" /> : <Building2 size={28} />}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <DetailCard title="Kontakt" icon={MapPin} testid="charge-merchant-detail-contact-card">
              <MetaRow icon={MapPin} value={merchant.address || merchant.city || "Adresse folgt"} testid="charge-merchant-detail-address" />
              <MetaRow icon={Phone} value={merchant.phone || "Kein Telefon hinterlegt"} testid="charge-merchant-detail-phone" />
              <MetaRow icon={Mail} value={merchant.email || "Keine E-Mail hinterlegt"} testid="charge-merchant-detail-email" />
              <MetaRow icon={Globe} value={merchant.website || "Keine Website hinterlegt"} testid="charge-merchant-detail-website" />
            </DetailCard>

            <DetailCard title="Warum dieser Händler?" icon={Star} testid="charge-merchant-detail-highlights-card">
              {(data.highlights || []).map((item, index) => (
                <div key={item} className="rounded-2xl border border-[#E1D7C7] bg-white px-4 py-3 text-sm text-slate-700" data-testid={`charge-merchant-detail-highlight-${index}`}>{item}</div>
              ))}
            </DetailCard>
          </div>

          <div className="space-y-6">
            <DetailCard title="Beliebte Produkte" icon={ShieldCheck} testid="charge-merchant-detail-products-card">
              {(data.products || []).length === 0 ? <EmptyCard label="Noch keine Produkte sichtbar" testid="charge-merchant-detail-empty-products" /> : (data.products || []).map((item, index) => (
                <div key={item.product_id || `${item.name}-${index}`} className="flex items-center justify-between rounded-2xl border border-[#E1D7C7] bg-white px-4 py-3" data-testid={`charge-merchant-detail-product-${index}`}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{item.name || item.product_name}</p>
                    <p className="truncate text-xs text-slate-500">{item.barcode || item.sku || item.qr_code || "Charge Produkt"}</p>
                  </div>
                  <span className="rounded-full bg-[#0A1626] px-3 py-1 text-xs font-black text-[#6EE7F9]">€{Number(item.price || 0).toFixed(2)}</span>
                </div>
              ))}
            </DetailCard>

            <DetailCard title="Aktuelle Angebote" icon={ReceiptText} testid="charge-merchant-detail-promotions-card">
              {(data.promotions || []).length === 0 ? <EmptyCard label="Aktuell keine Angebote" testid="charge-merchant-detail-empty-promotions" /> : (data.promotions || []).map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-2xl border border-[#E1D7C7] bg-[linear-gradient(145deg,#FFF7E9,#FFFFFF)] px-4 py-3" data-testid={`charge-merchant-detail-promotion-${index}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-amber-600">{item.offer_type || item.type || "offer"}</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{item.title || item.name}</p>
                    </div>
                    <span className="rounded-full bg-[#0A1626] px-3 py-1 text-xs font-black text-[#6EE7F9]">{item.value || 0}{typeof item.value === "number" ? "%" : ""}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{item.description || "Exklusiver Vorteil für BidBlitz Charge Kunden."}</p>
                </div>
              ))}
            </DetailCard>

            <button onClick={() => onNavigate?.("/charge-app")} className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[#0A1626] text-sm font-black text-[#D8FCFF]" data-testid="charge-merchant-detail-back-to-charge-button">Zurück zur Charge App</button>
          </div>
        </div>
      </div>
    </div>
  );
}


function DetailCard({ title, icon: Icon, children, testid }) {
  return (
    <div className="rounded-[30px] border border-[#D9CFC0] bg-[#F8F3EA] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]" data-testid={testid}>
      <div className="mb-4 flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0A1626] text-[#6EE7F9]"><Icon size={16} /></div><h3 className="text-lg font-black text-slate-900">{title}</h3></div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function MetaRow({ icon: Icon, value, testid }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-[#E1D7C7] bg-white px-4 py-3 text-sm text-slate-700" data-testid={testid}><Icon size={15} className="text-[#0A1626]" /><span>{value}</span></div>;
}

function EmptyCard({ label, testid }) {
  return <div className="rounded-2xl border border-dashed border-[#D9CFC0] bg-white/60 px-4 py-8 text-center text-sm text-slate-500" data-testid={testid}>{label}</div>;
}