import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Clock3, Flame, Gavel, PlayCircle, Radio, ShoppingBag, Sparkles, TicketPercent, TrendingUp, Trophy } from "lucide-react";
import { toast } from "sonner";

import { api } from "../services/api";
import { useUser } from "../store";

const statCards = [
  { key: "active_marketplace", label: "Marketplace", icon: ShoppingBag, color: "#10b981" },
  { key: "active_flash_sales", label: "Flash Sales", icon: TicketPercent, color: "#f97316" },
  { key: "active_penny_auctions", label: "Penny Auktionen", icon: Gavel, color: "#8b5cf6" },
  { key: "active_live_streams", label: "Live Streams", icon: Radio, color: "#ef4444" },
];

const formatSeconds = (seconds) => {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return minutes > 0 ? `${minutes}:${String(remaining).padStart(2, "0")}` : `${remaining}s`;
};

const Currency = ({ value, testId, className = "" }) => (
  <span data-testid={testId} className={className}>€{Number(value || 0).toFixed(2)}</span>
);

const formatInsightValue = (item) => {
  if (!item) return "—";
  if (item.value_type === "seconds") return formatSeconds(item.value);
  if (item.value_type === "percent") return `${item.value || 0}%`;
  if (item.value_type === "count") return String(item.value || 0);
  return item.value || "—";
};

const categoryKeysFromOverview = (overview) => [
  { key: "all", label: "Alle", accent: "#ffffff" },
  ...((overview?.category_mix || []).slice(0, 5).map((item) => ({ key: item.key, label: item.label, accent: item.accent }))),
];

const matchesCategory = (item, activeCategory) => {
  if (activeCategory === "all") return true;
  return (item?.category || "").toLowerCase() === activeCategory;
};

export default function CommerceCenterPage({ onBack, onNavigate }) {
  const user = useUser();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buyingSaleId, setBuyingSaleId] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getCommerceCenterOverview();
      setOverview(data);
    } catch (error) {
      toast.error(error.message || "Commerce Center konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const heroStats = useMemo(() => statCards.map((item) => ({ ...item, value: overview?.stats?.[item.key] || 0 })), [overview]);
  const categoryTabs = useMemo(() => categoryKeysFromOverview(overview), [overview]);
  const filteredFlashSales = useMemo(() => (overview?.flash_sales || []).filter((item) => matchesCategory(item, activeCategory)), [overview, activeCategory]);
  const filteredAuctions = useMemo(() => (overview?.penny_auctions || []).filter((item) => matchesCategory(item, activeCategory)), [overview, activeCategory]);
  const filteredMarketplace = useMemo(() => (overview?.marketplace || []).filter((item) => matchesCategory(item, activeCategory)), [overview, activeCategory]);

  const trackEvent = useCallback((eventType, targetType, targetId = "", metadata = {}) => {
    api.trackCommerceCenterEvent({ event_type: eventType, target_type: targetType, target_id: targetId, source: "commerce_center", metadata }).catch(() => {});
  }, []);

  useEffect(() => {
    trackEvent("page_view", "hub", "overview");
  }, [trackEvent]);

  const openMarketplaceDetail = (listingId) => {
    trackEvent("cta_click", "marketplace_listing", listingId);
    onNavigate(`/marketplace?listing_id=${listingId}&source=commerce-center`);
  };
  const openAuctionDetail = (auctionId) => {
    trackEvent("cta_click", "penny_auction", auctionId);
    onNavigate(`/auctions?auction_id=${auctionId}&source=commerce-center`);
  };
  const openLiveAuctionDetail = (auctionId) => {
    trackEvent("cta_click", "live_auction", auctionId || "overview");
    onNavigate(auctionId ? `/live-auctions?auction_id=${auctionId}&source=commerce-center` : "/live-auctions");
  };
  const openSpotlight = () => {
    const route = overview?.spotlight?.route;
    if (route) {
      trackEvent("cta_click", overview?.spotlight?.type || "spotlight", overview?.spotlight?.title || "spotlight");
      onNavigate(route);
    }
  };

  const handleBuyFlashSale = async (saleId) => {
    if (!user?.isAuthenticated) {
      toast.error("Bitte zuerst anmelden, um einen Flash Sale zu kaufen.");
      return;
    }
    setBuyingSaleId(saleId);
    trackEvent("cta_click", "flash_sale_buy", saleId);
    try {
      const result = await api.buyCommerceFlashSale(saleId, { use_shipping: false });
      toast.success(result.message || "Flash Sale gekauft.");
      await loadOverview();
    } catch (error) {
      toast.error(error.message || "Kauf fehlgeschlagen.");
    } finally {
      setBuyingSaleId("");
    }
  };

  if (loading && !overview) {
    return (
      <div className="min-h-screen bg-[#060915] text-white flex items-center justify-center" data-testid="commerce-center-loading">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full border-2 border-white/10 border-t-[#ff7a18] animate-spin" />
          <p className="mt-4 text-sm text-white/60">Commerce Center lädt…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060915] text-white pb-24 overflow-x-hidden" data-testid="commerce-center-page">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-[#ff7a18]/20 blur-[140px]" />
        <div className="absolute top-64 right-[-8rem] h-72 w-72 rounded-full bg-[#6d28d9]/20 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-[max(env(safe-area-inset-top,0px),20px)] space-y-6">
        <motion.header className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl p-5 sm:p-7" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <button onClick={onBack} data-testid="commerce-center-back-button" className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
                <ArrowRight className="h-4 w-4 rotate-180" /> Zurück
              </button>
              <div data-testid="commerce-center-hero-badge" className="inline-flex items-center gap-2 rounded-full bg-[#ff7a18]/15 px-3 py-1 text-xs font-semibold text-[#ffd8b5]">
                <Sparkles className="h-4 w-4" /> Commerce Center V1
              </div>
              <h1 data-testid="commerce-center-title" className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight">Deals, Auktionen und Live-Commerce in einem Flow.</h1>
              <p data-testid="commerce-center-subtitle" className="mt-4 max-w-xl text-sm sm:text-base text-white/70">Marketplace, Penny Auctions, Flash Sales und Live Shopping sind jetzt in einem zentralen Hub gebündelt — mit echten Wallet-Käufen und direkten Sprüngen in die vorhandenen Module.</p>
            </div>
            <div className="grid w-full max-w-md grid-cols-2 gap-3">
              {heroStats.map((item) => (
                <div key={item.key} data-testid={`commerce-stat-${item.key}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">{item.label}</span>
                    <item.icon className="h-4 w-4" style={{ color: item.color }} />
                  </div>
                  <p className="mt-3 text-3xl font-black">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { id: "marketplace", label: "Marketplace öffnen", route: "/marketplace", icon: ShoppingBag },
              { id: "auctions", label: "Penny Auktionen", route: "/auctions", icon: Gavel },
              { id: "live-auctions", label: "Live Auktionen", route: "/live-auctions", icon: Flame },
              { id: "live-shopping", label: "Live Shopping", route: "/live", icon: PlayCircle },
            ].map((cta) => (
              <button key={cta.id} onClick={() => onNavigate(cta.route)} data-testid={`commerce-center-cta-${cta.id}`} className="group flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-left transition hover:border-white/20 hover:bg-black/35">
                <div>
                  <p className="text-sm font-semibold">{cta.label}</p>
                  <p className="mt-1 text-xs text-white/50">Direkt in den bestehenden Flow</p>
                </div>
                <cta.icon className="h-5 w-5 text-white/70 transition group-hover:translate-x-1" />
              </button>
            ))}
          </div>

          {user?.isAuthenticated && (
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => onNavigate("/marketplace-dashboard?tab=flash-sales")} data-testid="commerce-center-flash-dashboard-button" className="rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white">
                Flash-Sales Dashboard öffnen
              </button>
              <button onClick={() => onNavigate("/mobility-center")} data-testid="commerce-center-mobility-button" className="rounded-full border border-white/10 px-4 py-3 text-sm font-semibold text-white/75">
                Zum Mobility Center
              </button>
            </div>
          )}
        </motion.header>

        <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <motion.div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(56,189,248,0.14),rgba(11,14,28,0.92))] p-5 sm:p-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#bfeaff]" data-testid="commerce-center-spotlight-badge">
                  <TrendingUp className="h-4 w-4" /> Spotlight Deal
                </div>
                <h2 className="mt-4 text-2xl sm:text-3xl font-black" data-testid="commerce-center-spotlight-title">{overview?.spotlight?.title || "Commerce Spotlight lädt…"}</h2>
                <p className="mt-2 text-sm text-white/70" data-testid="commerce-center-spotlight-subtitle">{overview?.spotlight?.subtitle || "Deals, Auktionen und Live-Momente werden hier priorisiert."}</p>
                <div className="mt-5 flex flex-wrap items-end gap-4">
                  <div>
                    <Currency value={overview?.spotlight?.price} testId="commerce-center-spotlight-price" className="block text-3xl font-black text-white" />
                    {overview?.spotlight?.original_price ? <Currency value={overview?.spotlight?.original_price} testId="commerce-center-spotlight-original-price" className="block text-sm text-white/35 line-through" /> : null}
                  </div>
                  <div className="rounded-2xl bg-black/25 px-4 py-3" data-testid="commerce-center-spotlight-timer">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Timing</p>
                    <p className="mt-1 text-sm font-bold text-[#8fefff]">{formatSeconds(overview?.spotlight?.remaining_seconds || 0)}</p>
                  </div>
                </div>
              </div>
              <button onClick={openSpotlight} data-testid="commerce-center-spotlight-cta" className="rounded-full bg-white px-5 py-3 text-sm font-bold text-[#06111f] transition hover:scale-[1.02]">
                {overview?.spotlight?.cta || "Jetzt öffnen"}
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2" data-testid="commerce-center-category-tabs">
              {categoryTabs.map((tab) => {
                const active = activeCategory === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveCategory(tab.key);
                      trackEvent("category_filter", "category", tab.key);
                    }}
                    data-testid={`commerce-center-category-tab-${tab.key}`}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "text-black" : "text-white/72"}`}
                    style={{
                      borderColor: active ? tab.accent : "rgba(255,255,255,0.12)",
                      background: active ? tab.accent : "rgba(0,0,0,0.18)",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </motion.div>

          <motion.div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Commerce Pulse</p>
                <h2 className="mt-2 text-base md:text-lg font-bold">Was gerade am stärksten zieht</h2>
              </div>
              <div className="rounded-full bg-white/5 px-3 py-2 text-xs text-white/60" data-testid="commerce-center-category-mix-count">{overview?.category_mix?.length || 0} Kategorien</div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(overview?.live_insights || []).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4" data-testid={`commerce-center-insight-${item.id}`}>
                  <p className="text-xs text-white/55">{item.label}</p>
                  <p className="mt-3 text-2xl font-black text-white">{formatInsightValue(item)}</p>
                  <p className="mt-2 text-xs text-white/45">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/15 p-4" data-testid="commerce-center-category-mix-panel">
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Mix im Hub</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(overview?.category_mix || []).map((item) => (
                  <div key={item.key} className="rounded-full px-3 py-2 text-xs font-semibold" data-testid={`commerce-center-category-pill-${item.key}`} style={{ background: `${item.accent}22`, color: item.accent }}>
                    {item.label} · {item.count}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <motion.div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-6 xl:col-span-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Commerce Analytics</p>
                <h2 className="mt-2 text-base md:text-lg font-bold">Conversion, Umsatz und Hub-Interaktion auf einen Blick</h2>
              </div>
              <div className="rounded-full bg-white/5 px-3 py-2 text-xs text-white/60" data-testid="commerce-center-analytics-badge">24h Fokus</div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(overview?.analytics_cards || []).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4" data-testid={`commerce-center-analytics-${item.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-white/55">{item.label}</p>
                    <BarChart3 className="h-4 w-4 text-white/45" />
                  </div>
                  <p className="mt-3 text-2xl font-black">
                    {item.value_type === "currency" ? `€${Number(item.value || 0).toFixed(2)}` : formatInsightValue(item)}
                  </p>
                  <p className="mt-2 text-xs text-white/45">{item.detail}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div className="rounded-[2rem] border border-[#ff7a18]/20 bg-[linear-gradient(180deg,rgba(255,122,24,0.12),rgba(7,10,22,0.9))] p-5 sm:p-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[#ffd8b5]">Flash Sales</p>
                <h2 className="mt-2 text-base md:text-lg font-bold">Kurzfristige Commerce-Deals mit echtem Wallet-Checkout</h2>
              </div>
              <button onClick={() => onNavigate("/marketplace")} data-testid="commerce-flash-more-button" className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/70">Mehr Produkte</button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {filteredFlashSales.map((sale) => (
                <div key={sale.sale_id} data-testid={`flash-sale-card-${sale.sale_id}`} className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-[#ff7a18]/15 px-3 py-1 text-[11px] font-semibold text-[#ffd8b5]" data-testid={`flash-sale-discount-${sale.sale_id}`}>
                        <TicketPercent className="h-3.5 w-3.5" /> -{sale.discount_pct}%
                      </div>
                      <h3 className="mt-3 text-lg font-bold" data-testid={`flash-sale-title-${sale.sale_id}`}>{sale.title}</h3>
                      <p className="mt-1 text-xs text-white/55" data-testid={`flash-sale-category-${sale.sale_id}`}>{sale.category_label} · {sale.location || "Online Deal"}</p>
                    </div>
                    <div className="rounded-2xl bg-white/5 px-3 py-2 text-right" data-testid={`flash-sale-timer-${sale.sale_id}`}>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">endet in</p>
                      <p className="mt-1 text-sm font-black text-[#ffb36f]">{formatSeconds(sale.remaining_seconds)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div>
                      <Currency value={sale.sale_price} testId={`flash-sale-price-${sale.sale_id}`} className="block text-2xl font-black text-white" />
                      <Currency value={sale.original_price} testId={`flash-sale-original-price-${sale.sale_id}`} className="block text-sm text-white/35 line-through" />
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button onClick={() => openMarketplaceDetail(sale.listing_id)} data-testid={`flash-sale-detail-${sale.sale_id}`} className="rounded-full border border-white/10 px-4 py-3 text-sm font-semibold text-white/80">
                        Details
                      </button>
                      <button
                        onClick={() => handleBuyFlashSale(sale.sale_id)}
                        disabled={buyingSaleId === sale.sale_id}
                        data-testid={`flash-sale-buy-${sale.sale_id}`}
                        className="rounded-full bg-[#ff7a18] px-4 py-3 text-sm font-bold text-black transition hover:scale-[1.02] disabled:opacity-50"
                      >
                        {buyingSaleId === sale.sale_id ? "Kaufe…" : "Jetzt kaufen"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredFlashSales.length === 0 && (
                <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/55" data-testid="commerce-center-flash-empty-filter">
                  Für diese Kategorie läuft aktuell kein Flash Sale. Wechsle den Filter oder öffne den Marketplace.
                </div>
              )}
            </div>
          </motion.div>

          <motion.div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Live Commerce</p>
                <h2 className="mt-2 text-base md:text-lg font-bold">Streams und Live-Auktionen</h2>
              </div>
              <button onClick={() => onNavigate("/live")} data-testid="commerce-live-open-button" className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/70">Zum Live Hub</button>
            </div>

            <div className="mt-5 space-y-3">
              {(overview?.live_streams || []).slice(0, 3).map((stream) => (
                <button key={stream.stream_id} onClick={() => onNavigate("/live")} data-testid={`commerce-live-stream-${stream.stream_id}`} className="w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">{stream.title}</p>
                      <p className="mt-1 text-xs text-white/55">@{stream.host_handle || stream.host_name || "Host"}</p>
                    </div>
                    <div className="rounded-full bg-red-500/15 px-3 py-1 text-[11px] font-semibold text-red-300" data-testid={`commerce-live-viewers-${stream.stream_id}`}>
                      {stream.viewer_count || 0} live
                    </div>
                  </div>
                </button>
              ))}

              {(overview?.live_streams || []).length === 0 && (
                <div data-testid="commerce-live-empty" className="rounded-2xl border border-dashed border-white/10 bg-black/15 p-5 text-sm text-white/55">Aktuell kein Live-Stream aktiv. Du kannst direkt einen neuen Stream im Live-Hub starten.</div>
              )}

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4" data-testid="commerce-upcoming-streams">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Nächste Streams</p>
                <div className="mt-3 space-y-2">
                  {(overview?.upcoming_streams || []).slice(0, 2).map((stream) => (
                    <div key={stream.stream_id} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{stream.title}</p>
                        <p className="text-xs text-white/50">{stream.host_name || stream.host_handle || "Creator"}</p>
                      </div>
                      <div className="text-xs text-white/60">{stream.scheduled_start ? new Date(stream.scheduled_start).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Bald"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <motion.div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Programmplanung</p>
                <h2 className="mt-2 text-base md:text-lg font-bold">Streams, Flash Drops und Live-Auktionen im Ablauf</h2>
              </div>
              <button onClick={() => { trackEvent("cta_click", "live_hub", "program-board"); onNavigate('/live'); }} data-testid="commerce-program-open-live-button" className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/70">Live Hub öffnen</button>
            </div>

            <div className="mt-5 space-y-3" data-testid="commerce-program-schedule-list">
              {(overview?.program_schedule || []).map((item) => (
                <div key={item.schedule_id} className="rounded-2xl border border-white/10 bg-black/20 p-4" data-testid={`commerce-program-item-${item.schedule_id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: `${item.accent}22`, color: item.accent }}>
                        {item.state === 'live' ? 'LIVE' : item.state === 'scheduled' ? 'Geplant' : 'Aktiv'}
                      </div>
                      <h3 className="mt-3 text-sm font-bold">{item.title}</h3>
                      <p className="mt-1 text-xs text-white/55">{item.subtitle}</p>
                      <p className="mt-2 text-[11px] text-white/40">{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Jetzt'}</p>
                    </div>
                    <button onClick={() => { trackEvent("cta_click", item.type, item.schedule_id); onNavigate(item.route); }} data-testid={`commerce-program-open-${item.schedule_id}`} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white">{item.cta_label}</button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Performance Board</p>
                <h2 className="mt-2 text-base md:text-lg font-bold">Welche Commerce-Formate gerade vorne liegen</h2>
              </div>
              <Trophy className="h-5 w-5 text-[#ffd8b5]" />
            </div>

            <div className="mt-5 space-y-3" data-testid="commerce-performance-list">
              {(overview?.performance_rankings || []).map((item, index) => (
                <button key={item.rank_id} onClick={() => { trackEvent("cta_click", "performance_rank", item.rank_id); onNavigate(item.route); }} data-testid={`commerce-performance-item-${item.rank_id}`} className="w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl font-black" style={{ background: `${item.accent}22`, color: item.accent }}>{index + 1}</div>
                      <div>
                        <p className="text-xs text-white/50">{item.label}</p>
                        <h3 className="mt-1 text-sm font-bold">{item.title}</h3>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/50">{item.metric_label}</p>
                      <p className="mt-1 text-lg font-black" style={{ color: item.accent }}>{item.metric_value}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <motion.div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Penny Auctions</p>
                <h2 className="mt-2 text-base md:text-lg font-bold">Countdown-Auktionen aus dem bestehenden System</h2>
              </div>
              <button onClick={() => onNavigate("/auctions")} data-testid="commerce-penny-open-button" className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/70">Auktionen öffnen</button>
            </div>

            <div className="mt-5 space-y-3">
              {filteredAuctions.map((auction) => (
                <button key={auction.auction_id} onClick={() => openAuctionDetail(auction.auction_id)} data-testid={`commerce-penny-auction-${auction.auction_id}`} className="w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">{auction.title}</p>
                      <p className="mt-1 text-xs text-white/55">{auction.bid_count || 0} Gebote · {auction.watchers || 0} Watcher</p>
                    </div>
                    <div className="text-right">
                      <Currency value={auction.current_price} testId={`commerce-penny-price-${auction.auction_id}`} className="block text-lg font-black text-[#8fefff]" />
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[11px] text-white/60">
                        <Clock3 className="h-3.5 w-3.5" /> {formatSeconds(auction.remaining_seconds)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {filteredAuctions.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 p-5 text-sm text-white/55" data-testid="commerce-center-auctions-empty-filter">
                  Für diese Kategorie sind aktuell keine Penny Auktionen sichtbar.
                </div>
              )}
            </div>
          </motion.div>

          <motion.div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Marketplace Highlights</p>
                <h2 className="mt-2 text-base md:text-lg font-bold">Schneller Einstieg in kaufen, stöbern und verkaufen</h2>
              </div>
              <button onClick={() => onNavigate("/marketplace")} data-testid="commerce-marketplace-open-button" className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/70">Marketplace öffnen</button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {filteredMarketplace.slice(0, 4).map((item) => (
                <button key={item.listing_id} onClick={() => openMarketplaceDetail(item.listing_id)} data-testid={`commerce-market-item-${item.listing_id}`} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left">
                  <p className="text-sm font-bold line-clamp-2">{item.title}</p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <Currency value={item.price} testId={`commerce-market-price-${item.listing_id}`} className="block text-xl font-black text-white" />
                      <p className="text-xs text-white/55">{item.category_label || item.category}</p>
                    </div>
                    <div className="text-xs text-white/45">{item.shipping_available ? "Versand" : "Abholung"}</div>
                  </div>
                </button>
              ))}
              {filteredMarketplace.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 p-5 text-sm text-white/55" data-testid="commerce-center-market-empty-filter">
                  Gerade keine Marketplace Highlights für diese Kategorie — wechsel den Filter oder öffne den gesamten Marketplace.
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/15 p-4" data-testid="commerce-live-auctions-strip">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Live Auktionen</p>
                  <p className="mt-1 text-sm text-white/65">Echtzeit-Bieten mit verlängertem Countdown im eigenen Live-Modul.</p>
                  {overview?.live_auctions?.[0] && <p className="mt-1 text-xs text-white/40">Direktlink: {overview.live_auctions[0].title}</p>}
                </div>
                <button onClick={() => openLiveAuctionDetail(overview?.live_auctions?.[0]?.auction_id)} data-testid="commerce-live-auctions-button" className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold">Öffnen</button>
              </div>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}