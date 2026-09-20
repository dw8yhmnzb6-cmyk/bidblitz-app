import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, Building2, CheckCircle2, ChevronRight, Loader2, MapPin,
  Package, ShieldCheck, ShoppingBag, Tag, Heart, BookOpen, LifeBuoy, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";

export default function ChargeProductDetailPage({ productId, onBack, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!productId) {
      setLoading(false);
      return;
    }
    try {
      const response = await api.getChargeCatalogProduct(productId);
      setData(response);
    } catch (error) {
      toast.error(error.message || "Charge-Produkt konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08131D]" data-testid="charge-product-detail-loading">
        <Loader2 size={26} className="animate-spin text-[#6EE7F9]" />
      </div>
    );
  }

  if (!data?.product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08131D] px-4 text-white" data-testid="charge-product-detail-empty">
        Produkt nicht gefunden
      </div>
    );
  }

  const product = data.product;
  const merchant = data.merchant || {};
  const related = data.related_products || [];

  const toggleSaved = async () => {
    if (!product?.product_id || saving) return;
    setSaving(true);
    try {
      if (product.saved) {
        await api.unsaveChargeProduct(product.product_id);
        setData((current) => current ? { ...current, product: { ...current.product, saved: false } } : current);
        toast.success("Produkt aus Merkliste entfernt");
      } else {
        await api.saveChargeProduct(product.product_id);
        setData((current) => current ? { ...current, product: { ...current.product, saved: true } } : current);
        toast.success("Produkt gemerkt");
      }
    } catch (error) {
      toast.error(error.message || "Merkliste konnte nicht aktualisiert werden");
    } finally {
      setSaving(false);
    }
  };


  const openMerchant = () => {
    if (!merchant.public_slug) return;
    onNavigate?.(`/charge-app/merchant?slug=${encodeURIComponent(merchant.public_slug)}`);
  };

  const openProduct = (item) => {
    if (!item?.product_id) return;
    onNavigate?.(`/charge-app/product?product_id=${encodeURIComponent(item.product_id)}`);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#06101B_0%,#0C1623_38%,#F3EFE7_38%,#F3EFE7_100%)] pb-24" data-testid="charge-product-detail-page">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#08131dcc] px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5" data-testid="charge-product-detail-back">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#6EE7F9]">BidBlitz Charge</p>
            <h1 className="truncate text-xl font-black text-white">{product.name}</h1>
          </div>
          <button onClick={() => onNavigate?.("/charge-app")} className="rounded-full border border-[#6EE7F9]/20 bg-[#6EE7F9]/10 px-4 py-2 text-xs font-black text-[#D8FCFF]">
            Charge Home
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(110,231,249,0.22),transparent_30%),linear-gradient(135deg,#08131D,#10283B)] text-white shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex min-h-[320px] items-center justify-center bg-white/5">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name || ""} className="h-full max-h-[480px] w-full object-cover" />
              ) : (
                <Package size={76} className="text-[#6EE7F9]" />
              )}
            </div>
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#D8FCFF]">{product.brand || "BidBlitz Charge"}</span>
                {(product.charge_categories || []).map((category) => (
                  <span key={category} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold text-slate-300">{categoryLabel(category)}</span>
                ))}
              </div>

              <h2 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">{product.name}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                {product.description || "Premium Charge-Zubehör aus dem BidBlitz Händlernetz."}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="rounded-2xl bg-[#6EE7F9] px-5 py-3 text-xl font-black text-slate-950">€{Number(product.price || 0).toFixed(2)}</span>
                <span className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ${product.in_stock ? "bg-emerald-500/15 text-emerald-200" : "bg-red-500/15 text-red-200"}`}>
                  <CheckCircle2 size={16} />{product.in_stock ? "Verfügbar" : "Aktuell ausverkauft"}
                </span>
                {product.featured ? <span className="rounded-2xl bg-amber-400/15 px-4 py-3 text-sm font-black text-amber-200">Empfohlen</span> : null}
                <button
                  type="button"
                  onClick={toggleSaved}
                  disabled={saving}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black disabled:opacity-50 ${product.saved ? "border-rose-400/30 bg-rose-400/15 text-rose-100" : "border-white/10 bg-white/5 text-white"}`}
                  data-testid="charge-product-detail-save-button"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Heart size={16} fill={product.saved ? "currentColor" : "none"} />}
                  {product.saved ? "Gemerkt" : "Merken"}
                </button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <DetailPill label="SKU" value={product.sku || "—"} />
                <DetailPill label="Barcode" value={product.barcode || "—"} />
                <DetailPill label="Kategorie" value={product.category || "Charge Zubehör"} />
                <DetailPill label="Bestand" value={product.track_stock ? String(Number(product.stock || 0)) : "nicht verfolgt"} />
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[30px] border border-[#D9CFC0] bg-[#F8F3EA] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]" data-testid="charge-product-detail-merchant-card">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-[#0A1626] text-[#6EE7F9]">
                {merchant.logo_url ? <img src={merchant.logo_url} alt="" className="h-full w-full object-cover" /> : <Building2 size={20} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Händler</p>
                <h3 className="truncate text-lg font-black text-slate-900">{merchant.business_name || product.merchant_name}</h3>
                <p className="truncate text-xs text-slate-500">{merchant.city || product.city || "BidBlitz Charge Netzwerk"}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {merchant.address ? <MetaRow icon={MapPin} value={merchant.address} /> : null}
              <MetaRow icon={ShieldCheck} value="Digitale Garantie und Rechnungsablage über BidBlitz Charge" />
              <MetaRow icon={Tag} value={product.category || "Charge Zubehör"} />
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onNavigate?.(`/charge-app?activate_product_id=${encodeURIComponent(product.product_id)}`)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#6EE7F9] text-sm font-black text-slate-950"
                data-testid="charge-product-detail-activate-warranty"
              >
                <ShieldCheck size={15} />Garantie aktivieren
              </button>
              <button
                type="button"
                onClick={openMerchant}
                disabled={!merchant.public_slug}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0A1626] text-sm font-black text-[#D8FCFF] disabled:opacity-40"
                data-testid="charge-product-detail-merchant-button"
              >
                <ShoppingBag size={15} />Zum Händler
              </button>
            </div>

            {(product.support_steps || []).length ? (
              <div className="mt-4 rounded-[22px] border border-cyan-200 bg-cyan-50 p-4" data-testid="charge-product-detail-troubleshooting">
                <div className="flex items-center gap-2">
                  <LifeBuoy size={16} className="text-cyan-800" />
                  <div>
                    <p className="text-sm font-black text-cyan-950">Schnellhilfe</p>
                    <p className="mt-1 text-xs text-cyan-700">Kurze Schritte für typische Probleme mit diesem Produkt.</p>
                  </div>
                </div>
                <ol className="mt-4 space-y-2">
                  {(product.support_steps || []).map((step, index) => (
                    <li key={`${step}-${index}`} className="flex gap-3 rounded-2xl bg-white px-3 py-3 text-sm text-slate-700" data-testid={`charge-product-detail-troubleshooting-step-${index}`}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0A1626] text-[10px] font-black text-[#6EE7F9]">{index + 1}</span>
                      <span className="leading-5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {(product.manual_url || product.support_url) ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="charge-product-detail-support-links">
                {product.manual_url ? (
                  <a
                    href={product.manual_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#D9CFC0] bg-white text-sm font-black text-slate-700"
                    data-testid="charge-product-detail-manual-link"
                  >
                    <BookOpen size={15} />Anleitung<ExternalLink size={13} />
                  </a>
                ) : null}
                {product.support_url ? (
                  <a
                    href={product.support_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 text-sm font-black text-cyan-800"
                    data-testid="charge-product-detail-support-link"
                  >
                    <LifeBuoy size={15} />Produkthilfe<ExternalLink size={13} />
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-[30px] border border-[#D9CFC0] bg-[#F8F3EA] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]" data-testid="charge-product-detail-related-card">
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Passend dazu</p>
              <h3 className="mt-1 text-lg font-black text-slate-900">Ähnliche Charge-Produkte</h3>
            </div>
            {related.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D9CFC0] bg-white/60 px-4 py-8 text-center text-sm text-slate-500">
                Noch keine ähnlichen Produkte gefunden
              </div>
            ) : (
              <div className="space-y-3">
                {related.map((item, index) => (
                  <button
                    key={item.product_id || `${item.name}-${index}`}
                    type="button"
                    onClick={() => openProduct(item)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-[#E1D7C7] bg-white p-3 text-left transition hover:-translate-y-0.5"
                    data-testid={`charge-product-detail-related-${index}`}
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#EFF5F6]">
                      {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <Package size={20} className="text-slate-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900">{item.name}</p>
                      <p className="truncate text-xs text-slate-500">{item.merchant_name}</p>
                    </div>
                    <span className="rounded-full bg-[#0A1626] px-3 py-1 text-xs font-black text-[#6EE7F9]">€{Number(item.price || 0).toFixed(2)}</span>
                    <ChevronRight size={17} className="text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function DetailPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function MetaRow({ icon: Icon, value }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#E1D7C7] bg-white px-4 py-3 text-sm text-slate-600">
      <Icon size={15} className="mt-0.5 shrink-0 text-slate-400" />
      <span>{value}</span>
    </div>
  );
}

function categoryLabel(value) {
  const labels = {
    charger: "Ladegeräte",
    cable: "Kabel",
    powerbank: "Powerbanks",
    wireless: "Wireless / MagSafe",
    dock: "Halterungen / Docks",
    car: "Auto",
    audio: "Audio",
    "charge-accessories": "Charge Zubehör",
  };
  return labels[value] || String(value || "Charge Zubehör").replace(/_/g, " ");
}
