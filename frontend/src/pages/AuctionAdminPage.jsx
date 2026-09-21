import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Gavel, Play, Pause, Square, Clock, Plus,
  Trash2, Settings, BarChart3, TrendingUp, Users, RefreshCw,
  Calendar, Bot, Zap, Package, ChevronRight, Check, X,
  Timer, DollarSign, Target, Layers, AlertCircle, Activity,
  Sliders, Power, Eye, Edit3, Save, Truck, Crown
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../store";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const error = new Error(typeof data.detail === "string" ? data.detail : data.message || "Request failed");
    error.detail = data.detail;
    throw error;
  }
  return data;
}

const AuctionAdminPage = ({ onBack }) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [auctions, setAuctions] = useState([]);
  const [stats, setStats] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [config, setConfig] = useState(null);
  const botControlsEffective = config?.bot_controls_effective === true;
  const [orders, setOrders] = useState([]);
  const [fulfillmentDrafts, setFulfillmentDrafts] = useState({});
  const [updatingOrder, setUpdatingOrder] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState({
    featured: false,
    bidValue: 0.50,
    increment: 0.01,
    revenueTarget: 50.00,
    productCost: 0.00,
    shippingCost: 0.00,
    otherCosts: 0.00,
    targetNetProfit: 50.00,
    duration: 48,
  });
  const [showBotModal, setShowBotModal] = useState(null); // auction object or null
  const [botConfig, setBotConfig] = useState({ enabled: true, target: 0, minSeconds: 60 });
  const [showEngineModal, setShowEngineModal] = useState(null);
  const [engineConfig, setEngineConfig] = useState({
    featured: false,
    bidValue: 0.50,
    increment: 0.01,
    revenueTarget: 50.00,
    productCost: 0.00,
    shippingCost: 0.00,
    otherCosts: 0.00,
    targetNetProfit: 50.00,
  });
  const [showImageModal, setShowImageModal] = useState(null); // auction object or null
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageUploading, setImageUploading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [auctionsRes, statsRes, catalogRes, configRes, ordersRes] = await Promise.all([
        api("/api/auctions/admin/list"),
        api("/api/auctions/admin/stats/overview"),
        api("/api/auctions/admin/catalog"),
        api("/api/auctions/admin/automation/config"),
        api("/api/auctions/admin/orders"),
      ]);
      
      setAuctions(auctionsRes.auctions || []);
      setStats(statsRes);
      setCatalog(catalogRes.catalog || []);
      setConfig(configRes);
      setOrders(ordersRes.orders || []);
      setFulfillmentDrafts((prev) => {
        const next = { ...prev };
        for (const order of (ordersRes.orders || [])) {
          if (!next[order.order_id]) {
            next[order.order_id] = {
              carrier: order.carrier || "",
              tracking_number: order.tracking_number || "",
            };
          }
        }
        return next;
      });
    } catch (err) {
      toast.error("Fehler beim Laden");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const updateFulfillment = async (order, status) => {
    const orderId = order.order_id;
    const draft = fulfillmentDrafts[orderId] || {};
    setUpdatingOrder(orderId);
    try {
      const body = { status };
      if (status === "shipped") {
        body.carrier = String(draft.carrier || "").trim();
        body.tracking_number = String(draft.tracking_number || "").trim();
        if (!body.carrier || body.tracking_number.length < 4) {
          toast.error("Carrier und echte Trackingnummer erforderlich");
          setUpdatingOrder(null);
          return;
        }
      }
      await api(`/api/auctions/admin/orders/${orderId}/fulfillment`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success(status === "processing" ? "Fulfillment gestartet" : status === "shipped" ? "Als versendet markiert" : "Als zugestellt markiert");
      await loadData();
    } catch (err) {
      toast.error(err?.detail || err?.message || "Fulfillment konnte nicht aktualisiert werden");
    }
    setUpdatingOrder(null);
  };

  // ─── Bot Actions ───
  const openBotConfig = (auction) => {
    if (!botControlsEffective && !auction?.bot_only) {
      toast.info("Production-Bots sind für normale Kundenauktionen deaktiviert.");
      return;
    }
    setBotConfig({
      enabled: auction.bot_enabled || false,
      target: auction.bot_target_price || Math.round(auction.retail_price * 0.15),
      minSeconds: auction.bot_min_seconds || 60,
    });
    setShowBotModal(auction);
  };

  const saveBotConfig = async () => {
    if (!showBotModal) return;
    if (!botControlsEffective && !showBotModal.bot_only) {
      toast.info("Production-Bots sind für normale Kundenauktionen deaktiviert.");
      return;
    }
    const res = await api("/api/auctions/admin/bot-config", {
      method: "POST",
      body: JSON.stringify({
        auction_id: showBotModal.auction_id,
        bot_enabled: botConfig.enabled,
        bot_target_price: botConfig.target,
        bot_min_seconds: botConfig.minSeconds,
      }),
    });
    if (res.ok) {
      toast.success(`Bot-Konfiguration gespeichert. Geschätzter Umsatz: €${res.estimated_revenue}`);
      setShowBotModal(null);
      loadData();
    } else {
      toast.error(res.detail || "Fehler");
    }
  };

  const toggleBotQuick = async (auction) => {
    if (!botControlsEffective && !auction?.bot_only) {
      toast.info("Production-Bots sind für normale Kundenauktionen deaktiviert.");
      return;
    }
    const res = await api("/api/auctions/admin/bot-config", {
      method: "POST",
      body: JSON.stringify({
        auction_id: auction.auction_id,
        bot_enabled: !auction.bot_enabled,
        bot_target_price: auction.bot_target_price || Math.round(auction.retail_price * 0.15),
        bot_min_seconds: auction.bot_min_seconds || 60,
      }),
    });
    if (res.ok) {
      toast.success(res.bot_enabled ? "Bot aktiviert" : "Bot deaktiviert");
      loadData();
    }
  };

  // ─── Auction Engine ───
  const openEngineConfig = (auction) => {
    setEngineConfig({
      featured: Boolean(auction.featured),
      bidValue: Number(auction.bid_value_eur ?? 0.50),
      increment: Number(auction.price_increment ?? 0.01),
      revenueTarget: Number(auction.revenue_target_eur ?? 50.00),
      productCost: Number(auction.product_cost_eur ?? 0),
      shippingCost: Number(auction.shipping_cost_eur ?? 0),
      otherCosts: Number(auction.other_costs_eur ?? 0),
      targetNetProfit: Number(auction.target_net_profit_eur ?? 50.00),
    });
    setShowEngineModal(auction);
  };

  const saveEngineConfig = async () => {
    if (!showEngineModal) return;
    try {
      await api(`/api/auctions/admin/auction/${showEngineModal.auction_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          featured: Boolean(engineConfig.featured),
          bid_value_eur: Number(engineConfig.bidValue),
          price_increment: Number(engineConfig.increment),
          revenue_target_eur: Number(engineConfig.revenueTarget),
          product_cost_eur: Number(engineConfig.productCost),
          shipping_cost_eur: Number(engineConfig.shippingCost),
          other_costs_eur: Number(engineConfig.otherCosts),
          target_net_profit_eur: Number(engineConfig.targetNetProfit),
        }),
      });
      toast.success("Auktions-Engine gespeichert");
      setShowEngineModal(null);
      await loadData();
    } catch (err) {
      toast.error(err?.detail || err?.message || "Engine-Einstellungen konnten nicht gespeichert werden");
    }
  };

  // ─── Image Edit ───
  const openImageEditor = (auction) => {
    const realBidCount = Math.max(
      0,
      Number(auction.total_bids || 0) - Number(auction.bot_bids_placed || 0),
    );
    if (auction.status === "ended" || auction.winner_id || realBidCount > 0) {
      toast.error("Produktdaten sind nach dem ersten echten Gebot gesperrt.");
      return;
    }
    setImageUrlInput(auction.image_url || "");
    setShowImageModal(auction);
  };

  const saveImageUrl = async () => {
    if (!showImageModal) return;
    const res = await api(`/api/auctions/admin/auction/${showImageModal.auction_id}`, {
      method: "PATCH",
      body: JSON.stringify({ image_url: imageUrlInput.trim() }),
    });
    if (res.ok) {
      toast.success("Bild aktualisiert");
      setShowImageModal(null);
      loadData();
    } else {
      toast.error(res.detail || "Fehler beim Speichern");
    }
  };

  const uploadImageFile = async (file) => {
    if (!showImageModal || !file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Datei zu groß (max 10MB)");
      return;
    }
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/api/auctions/admin/auction/${showImageModal.auction_id}/upload-image`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Bild hochgeladen");
        setImageUrlInput(data.image_url);
        loadData();
      } else {
        toast.error(data.detail || "Upload fehlgeschlagen");
      }
    } catch (err) {
      toast.error("Netzwerkfehler");
    }
    setImageUploading(false);
  };

  // ─── Auction Actions ───
  const handlePause = async (auctionId) => {
    const res = await api(`/api/auctions/admin/auction/${auctionId}/pause`, { method: "POST" });
    if (res.ok) {
      toast.success("Auktion pausiert");
      loadData();
    } else {
      toast.error(res.detail || "Fehler");
    }
  };

  const handleResume = async (auctionId) => {
    const res = await api(`/api/auctions/admin/auction/${auctionId}/resume`, { method: "POST" });
    if (res.ok) {
      toast.success("Auktion fortgesetzt");
      loadData();
    } else {
      toast.error(res.detail || "Fehler");
    }
  };

  const handleEnd = async (auctionId) => {
    if (!window.confirm("Auktion wirklich beenden?")) return;
    const res = await api(`/api/auctions/admin/auction/${auctionId}/end`, { method: "POST" });
    if (res.ok) {
      toast.success(`Beendet. Gewinner: ${res.winner_name || "Keiner"}, Preis: €${res.final_price?.toFixed(2)}`);
      loadData();
    } else {
      toast.error(res.detail || "Fehler");
    }
  };

  const handleDelete = async (auctionId) => {
    if (!window.confirm("Auktion löschen? (Nur ohne echte Gebote)")) return;
    const res = await api(`/api/auctions/admin/auction/${auctionId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Gelöscht");
      loadData();
    } else {
      toast.error(res.detail || "Fehler");
    }
  };

  const handleSchedule = async (productIndex, options = scheduleConfig) => {
    const res = await api("/api/auctions/admin/auction/schedule", {
      method: "POST",
      body: JSON.stringify({
        product_index: productIndex,
        duration_hours: Number(options.duration || 48),
        bot_enabled: false,
        featured: Boolean(options.featured),
        bid_value_eur: Number(options.bidValue || 0.50),
        price_increment: Number(options.increment || 0.01),
        revenue_target_eur: Number(options.revenueTarget || 0),
        product_cost_eur: Number(options.productCost || 0),
        shipping_cost_eur: Number(options.shippingCost || 0),
        other_costs_eur: Number(options.otherCosts || 0),
        target_net_profit_eur: Number(options.targetNetProfit || 0),
      }),
    });
    if (res.ok) {
      const botNote = res.auction?.bot_enabled
        ? ` · Bot-Ziel €${res.auction.bot_target_price}`
        : res.bot_policy === "test_only"
          ? " · Production-Bots deaktiviert"
          : "";
      toast.success(`"${res.auction.title}" gestartet${botNote}`);
      setShowScheduleModal(false);
      loadData();
    } else {
      toast.error(res.detail || "Fehler");
    }
  };

  const handleRefreshAll = async () => {
    if (!window.confirm("Alle aktiven Auktionen beenden und neue starten?")) return;
    const res = await api("/api/auctions/admin/refresh", { method: "POST" });
    if (res.refreshed) {
      toast.success(`${res.refreshed} neue Auktionen gestartet`);
      loadData();
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return "Beendet";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const activeAuctions = auctions.filter(a => ["active", "paused"].includes(a.status));
  const botEnabledAuctions = auctions.filter(a => a.bot_enabled && a.status === "active");

  return (
    <div className="min-h-screen bg-[#030303] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 px-4 pt-4 pb-3" style={{ background: "linear-gradient(to bottom, #030303 80%, transparent)" }}>
        <div className="flex items-center gap-3">
          <motion.button onClick={onBack} className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5" whileTap={{ scale: 0.95 }}>
            <ArrowLeft size={20} />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Auktions-Admin</h1>
            <p className="text-xs text-white/40">Steuerung & Bot-System</p>
          </div>
          <motion.button onClick={loadData} className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5" whileTap={{ scale: 0.95 }}>
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </motion.button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="px-4 mb-4">
          <div className="grid grid-cols-4 gap-2">
            <MiniStat icon={<Gavel size={14} />} value={stats.auctions?.active || 0} label="Aktiv" color="#00D26A" />
            <MiniStat icon={<Bot size={14} />} value={botEnabledAuctions.length} label="Mit Bot" color="#A855F7" />
            <MiniStat icon={<Users size={14} />} value={stats.bids?.real_users || 0} label="Echte Gebote" color="#00C2FF" />
            <MiniStat icon={<DollarSign size={14} />} value={`€${stats.revenue?.total_credit_purchases || 0}`} label="Umsatz" color="#FFB800" />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: "overview", label: "Übersicht", icon: <BarChart3 size={14} /> },
            { id: "engine", label: "Auktions-Engine", icon: <Target size={14} /> },
            { id: "bots", label: "Bot-System", icon: <Bot size={14} /> },
            { id: "active", label: `Aktiv/Pausiert (${activeAuctions.length})`, icon: <Play size={14} /> },
            { id: "orders", label: `Bestellungen (${orders.length})`, icon: <Truck size={14} /> },
            { id: "catalog", label: "Katalog", icon: <Package size={14} /> },
          ].map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id ? "bg-white/10 text-white" : "bg-white/[0.03] text-white/50"
              }`}
              whileTap={{ scale: 0.97 }}
            >
              {tab.icon}
              {tab.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4">
        
        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Quick Actions */}
            <Card title="Schnellaktionen" icon={<Zap size={16} className="text-yellow-400" />}>
              <div className="grid grid-cols-2 gap-2">
                <ActionBtn icon={<Plus size={16} />} label="Neue Auktion" onClick={() => setShowScheduleModal(true)} color="#00D26A" />
                <ActionBtn icon={<RefreshCw size={16} />} label="Alle neu starten" onClick={handleRefreshAll} color="#00C2FF" />
              </div>
            </Card>

            {/* Bot Overview */}
            <Card title="Bot-Status" icon={<Bot size={16} className="text-purple-400" />}>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Bots aktiv auf</span>
                  <span className="font-semibold text-purple-400">{botEnabledAuctions.length} Auktionen</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Bot-Gebote heute</span>
                  <span className="font-semibold">{stats?.bids?.bots || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Bot vs. Echte Ratio</span>
                  <span className="font-semibold">
                    {stats?.bids?.real_users > 0 
                      ? `1:${(stats.bids.bots / stats.bids.real_users).toFixed(1)}`
                      : "N/A"}
                  </span>
                </div>
              </div>
            </Card>

            {/* Active Auctions Preview */}
            <Card title="Aktive Auktionen" icon={<Play size={16} className="text-green-400" />}>
              {activeAuctions.length === 0 ? (
                <p className="text-white/40 text-sm py-4 text-center">Keine aktiven Auktionen</p>
              ) : (
                <div className="space-y-2">
                  {activeAuctions.slice(0, 5).map((a) => (
                    <AuctionMiniRow key={a.auction_id} auction={a} formatTime={formatTime} onBotClick={() => openBotConfig(a)} onImageClick={() => openImageEditor(a)} onEngineClick={() => openEngineConfig(a)} />
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ═══ AUCTION ENGINE TAB ═══ */}
        {activeTab === "engine" && (
          <div className="space-y-3" data-testid="auction-admin-engine">
            <Card title="Auktions-Engine" icon={<Target size={16} className="text-cyan-400" />}>
              <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.06] p-3 text-xs leading-relaxed text-cyan-100/70">
                Pro Angebot steuerst du Premium, nominalen Gebotswert und sichtbaren Preis-Schritt. Zusätzlich kalkuliert die Engine Produktkosten, Versand, sonstige Kosten und dein Nettoziel. Die Kalkulation verändert nicht automatisch Timer oder Gewinner.
              </div>
            </Card>
            {activeAuctions.length === 0 ? (
              <EmptyState icon={<Target size={32} />} text="Keine aktiven oder pausierten Auktionen" />
            ) : activeAuctions.map((auction) => {
              const bidValue = Number(auction.bid_value_eur ?? 0.50);
              const increment = Number(auction.price_increment ?? 0.01);
              const target = Number(auction.revenue_target_eur ?? 0);
              const costs = Number(auction.product_cost_eur ?? 0) + Number(auction.shipping_cost_eur ?? 0) + Number(auction.other_costs_eur ?? 0);
              const netTarget = Number(auction.target_net_profit_eur ?? 0);
              const currentPrice = Number(auction.current_price || 0);
              const bidsForRevenue = target > 0 && bidValue > 0 ? Math.ceil(target / bidValue) : 0;
              const bidsForNet = netTarget > 0 && (bidValue + increment) > 0
                ? Math.max(0, Math.ceil((costs + netTarget - currentPrice) / (bidValue + increment)))
                : 0;
              const bidsNeeded = Math.max(bidsForRevenue, bidsForNet);
              const visibleEnd = currentPrice + bidsNeeded * increment;
              const estimatedBidRevenue = bidsNeeded * bidValue;
              const estimatedContribution = estimatedBidRevenue + visibleEnd - costs;
              return (
                <div key={auction.auction_id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      {auction.featured ? <Crown size={18} className="text-yellow-400" /> : <Gavel size={18} className="text-cyan-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{auction.title}</p>
                        {auction.featured && <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2 py-0.5 text-[9px] font-black text-yellow-300">PREMIUM</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/40">
                        <span>Gebot: €{bidValue.toFixed(2)}</span>
                        <span>Preis +€{increment.toFixed(2)}</span>
                        <span>Gebotsumsatz: €{target.toFixed(2)}</span>
                        <span>Nettoziel: €{netTarget.toFixed(2)}</span>
                      </div>
                      {bidsNeeded > 0 && (
                        <p className="mt-1 text-[10px] text-cyan-300/70">
                          ≈ {bidsNeeded} Gebote · sichtbarer Preis ≈ €{visibleEnd.toFixed(2)} · Deckungsbeitrag ≈ €{estimatedContribution.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <motion.button
                      onClick={() => openEngineConfig(auction)}
                      className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[10px] font-black text-cyan-300"
                      whileTap={{ scale: 0.96 }}
                      data-testid={`auction-engine-open-${auction.auction_id}`}
                    >
                      Konfigurieren
                    </motion.button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ FULFILLMENT TAB ═══ */}
        {activeTab === "orders" && (
          <div className="space-y-3" data-testid="auction-admin-orders">
            {orders.length === 0 ? (
              <Card title="Gewinner-Bestellungen" icon={<Truck size={16} className="text-cyan-400" />}>
                <p className="py-5 text-center text-sm text-white/40">Noch keine bezahlten Gewinner-Bestellungen.</p>
              </Card>
            ) : orders.map((order) => {
              const status = order.fulfillment_status || "pending";
              const draft = fulfillmentDrafts[order.order_id] || {};
              const busy = updatingOrder === order.order_id;
              return (
                <div key={order.order_id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4" data-testid={`auction-order-${order.order_id}`}>
                  <div className="flex items-start gap-3">
                    {order.image_url ? <img src={order.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/5"><Package size={18} /></div>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{order.product_title}</p>
                      <p className="mt-1 text-xs text-white/40">{order.order_id} · €{Number(order.final_price || 0).toFixed(2)}</p>
                      <p className="mt-1 text-[11px] text-cyan-300">Fulfillment: {status}</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-white/6 bg-black/20 p-3 text-xs text-white/55">
                    <p className="font-semibold text-white/75">{order.shipping_address?.full_name}</p>
                    <p>{order.shipping_address?.address_line1}{order.shipping_address?.address_line2 ? `, ${order.shipping_address.address_line2}` : ""}</p>
                    <p>{order.shipping_address?.postal_code} {order.shipping_address?.city} · {order.shipping_address?.country}</p>
                  </div>

                  {status === "processing" && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <input
                        value={draft.carrier || ""}
                        onChange={(e) => setFulfillmentDrafts((prev) => ({ ...prev, [order.order_id]: { ...(prev[order.order_id] || {}), carrier: e.target.value } }))}
                        placeholder="Carrier, z. B. DHL"
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs outline-none focus:border-cyan-400/40"
                        data-testid={`auction-carrier-${order.order_id}`}
                      />
                      <input
                        value={draft.tracking_number || ""}
                        onChange={(e) => setFulfillmentDrafts((prev) => ({ ...prev, [order.order_id]: { ...(prev[order.order_id] || {}), tracking_number: e.target.value } }))}
                        placeholder="Echte Sendungsnummer"
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs outline-none focus:border-cyan-400/40"
                        data-testid={`auction-tracking-${order.order_id}`}
                      />
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    {status === "pending" && (
                      <button onClick={() => updateFulfillment(order, "processing")} disabled={busy} className="flex-1 rounded-xl bg-blue-500/10 py-2 text-xs font-semibold text-blue-300 disabled:opacity-40">
                        Vorbereitung
                      </button>
                    )}
                    {status === "processing" && (
                      <button onClick={() => updateFulfillment(order, "shipped")} disabled={busy} className="flex-1 rounded-xl bg-cyan-500/10 py-2 text-xs font-semibold text-cyan-300 disabled:opacity-40">
                        {busy ? "Speichert…" : "Versendet"}
                      </button>
                    )}
                    {status === "shipped" && (
                      <button onClick={() => updateFulfillment(order, "delivered")} disabled={busy} className="flex-1 rounded-xl bg-green-500/10 py-2 text-xs font-semibold text-green-300 disabled:opacity-40">
                        {busy ? "Speichert…" : "Zugestellt"}
                      </button>
                    )}
                  </div>

                  {order.tracking_number && (
                    <div className="mt-2 text-[11px] text-white/45">
                      {order.carrier}: <span className="font-mono text-white/70">{order.tracking_number}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ BOT SYSTEM TAB ═══ */}
        {activeTab === "bots" && (
          <div className="space-y-4">
            {!botControlsEffective && (
              <div
                className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs text-amber-200"
                data-testid="auction-bot-production-policy"
              >
                Production: Bot-Steuerung ist für normale Kundenauktionen deaktiviert. Nur klar markierte bot_only Demo-/Testauktionen dürfen Bot-Funktionen verwenden.
              </div>
            )}
            {/* Bot Stats Card */}
            <Card title="Bot-Statistiken" icon={<Activity size={16} className="text-purple-400" />}>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-xl bg-purple-500/10">
                  <p className="text-2xl font-bold text-purple-400">{stats?.bids?.bots || 0}</p>
                  <p className="text-xs text-white/40">Bot-Gebote gesamt</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-green-500/10">
                  <p className="text-2xl font-bold text-green-400">{botEnabledAuctions.length}</p>
                  <p className="text-xs text-white/40">Aktive Bot-Auktionen</p>
                </div>
              </div>
              
              <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <p className="text-xs text-white/40 mb-2">Wie der Bot funktioniert:</p>
                <ul className="text-xs text-white/60 space-y-1">
                  <li>• Bot bietet nur wenn <span className="text-purple-400">bot_enabled=true</span></li>
                  <li>• Bot stoppt bei <span className="text-yellow-400">Zielpreis</span></li>
                  <li>• Bot wartet bis <span className="text-blue-400">min_seconds</span> verbleiben</li>
                  <li>• Bot-Namen sind zufällig (Max_B, Sophie_K, etc.)</li>
                </ul>
              </div>
            </Card>

            {/* Bot-Enabled Auctions */}
            <Card title="Auktionen mit Bot" icon={<Bot size={16} className="text-purple-400" />}>
              {activeAuctions.length === 0 ? (
                <p className="text-white/40 text-sm py-4 text-center">Keine aktiven Auktionen</p>
              ) : (
                <div className="space-y-2">
                  {activeAuctions.map((a) => (
                    <BotAuctionRow 
                      key={a.auction_id} 
                      auction={a} 
                      formatTime={formatTime}
                      onToggle={() => toggleBotQuick(a)}
                      onConfigure={() => openBotConfig(a)}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* ═══ Win-Rate Steering (iter102) ═══ */}
            <Card title="🎯 Gewinn-Steuerung (Win-Rate)" icon={<Target size={16} className="text-amber-400" />}>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/60">Wie viel Prozent der Auktionen sollen ECHTE KUNDEN gewinnen?</span>
                    <span className="text-2xl font-bold text-amber-400" data-testid="winrate-display">
                      {config?.customer_win_rate_percent ?? 20}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={config?.customer_win_rate_percent ?? 20}
                    disabled={!botControlsEffective}
                    onChange={(e) => {
                      if (!botControlsEffective) return;
                      const v = Number(e.target.value);
                      setConfig((c) => ({ ...(c || {}), customer_win_rate_percent: v }));
                    }}
                    onMouseUp={async (e) => {
                      if (!botControlsEffective) return;
                      const v = Number(e.target.value);
                      try {
                        await api("/api/auctions/admin/automation/config", {
                          method: "POST",
                          body: JSON.stringify({ ...config, customer_win_rate_percent: v }),
                        });
                        toast.success(`Kunden-Gewinnrate: ${v}%`);
                      } catch (err) {
                        toast.error("Speichern fehlgeschlagen");
                      }
                    }}
                    onTouchEnd={async (e) => {
                      if (!botControlsEffective) return;
                      const v = Number(e.target.value);
                      try {
                        await api("/api/auctions/admin/automation/config", {
                          method: "POST",
                          body: JSON.stringify({ ...config, customer_win_rate_percent: v }),
                        });
                        toast.success(`Kunden-Gewinnrate: ${v}%`);
                      } catch (err) {
                        toast.error("Speichern fehlgeschlagen");
                      }
                    }}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-400 disabled:cursor-not-allowed disabled:opacity-35"
                    data-testid="winrate-slider"
                  />
                  <div className="flex justify-between text-[10px] text-white/40 mt-1">
                    <span>Nur Bots gewinnen</span>
                    <span>50/50</span>
                    <span>Nur Kunden gewinnen</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                  <div className="text-center p-2 rounded-lg bg-green-500/10">
                    <p className="text-[10px] text-white/50 uppercase">Kunden heute</p>
                    <p className="text-lg font-bold text-green-400" data-testid="customer-wins-today">
                      {config?.stats?.customer_wins_today ?? 0}
                    </p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/5">
                    <p className="text-[10px] text-white/50 uppercase">Bots heute</p>
                    <p className="text-lg font-bold text-white" data-testid="bot-wins-today">
                      {config?.stats?.bot_wins_today ?? 0}
                    </p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-amber-500/10">
                    <p className="text-[10px] text-white/50 uppercase">Echt heute</p>
                    <p className="text-lg font-bold text-amber-400" data-testid="actual-winrate-today">
                      {config?.stats?.actual_customer_win_rate ?? 0}%
                    </p>
                  </div>
                </div>

                <p className="text-[10px] text-white/40 italic">
                  {botControlsEffective
                    ? 'Diese Einstellung gilt nur im freigeschalteten Bot-Testmodus.'
                    : 'Production-Kundenauktionen werden nicht über eine Win-Rate-Steuerung beeinflusst.'}
                </p>
              </div>
            </Card>

            {/* ═══ Bot-Aggressivität (iter103) ═══ */}
            <Card title="🤖 Bot-Aggressivität (Phase 3)" icon={<Zap size={16} className="text-cyan-400" />}>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/60">Wie schnell schießen die Bots in den letzten 5 Min?</span>
                    <span className="text-2xl font-bold text-cyan-400" data-testid="aggression-display">
                      {config?.bot_aggression_level ?? 50}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={config?.bot_aggression_level ?? 50}
                    disabled={!botControlsEffective}
                    onChange={(e) => {
                      if (!botControlsEffective) return;
                      const v = Number(e.target.value);
                      setConfig((c) => ({ ...(c || {}), bot_aggression_level: v }));
                    }}
                    onMouseUp={async (e) => {
                      if (!botControlsEffective) return;
                      const v = Number(e.target.value);
                      try {
                        await api("/api/auctions/admin/automation/config", {
                          method: "POST",
                          body: JSON.stringify({ ...config, bot_aggression_level: v }),
                        });
                        toast.success(`Bot-Aggressivität: ${v}`);
                      } catch (err) {
                        toast.error("Speichern fehlgeschlagen");
                      }
                    }}
                    onTouchEnd={async (e) => {
                      if (!botControlsEffective) return;
                      const v = Number(e.target.value);
                      try {
                        await api("/api/auctions/admin/automation/config", {
                          method: "POST",
                          body: JSON.stringify({ ...config, bot_aggression_level: v }),
                        });
                        toast.success(`Bot-Aggressivität: ${v}`);
                      } catch (err) {
                        toast.error("Speichern fehlgeschlagen");
                      }
                    }}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-35"
                    data-testid="aggression-slider"
                  />
                  <div className="flex justify-between text-[10px] text-white/40 mt-1">
                    <span>Relaxed (8-15s)</span>
                    <span>Balanced</span>
                    <span>Sniper (0.5-1.5s)</span>
                  </div>
                </div>
                <p className="text-[10px] text-white/40 italic">
                  {botControlsEffective
                    ? 'Bot-Aggressivität gilt nur im freigeschalteten Bot-Testmodus.'
                    : 'Production-Kundenauktionen nutzen keine Bot-Aggressivitätssteuerung.'}
                </p>
              </div>
            </Card>

            {/* Global Bot Settings */}
            <Card title="Globale Bot-Einstellungen" icon={<Settings size={16} className="text-white/40" />}>
              <div className="space-y-3">
                <SettingRow
                  label="Standard Bot aktiv"
                  value={config?.bot_policy === "test_only" ? "Production: deaktiviert" : (config?.bot_default_enabled ? "Ja" : "Nein")}
                />
                <SettingRow label="Standard Zielpreis" value={`${config?.bot_default_target_percent || 15}% vom UVP`} />
                <SettingRow label="Mindestzeit vor Bid" value="60 Sekunden" />
                <SettingRow label="Bid-Wahrscheinlichkeit" value="30-40%" />
              </div>
            </Card>
          </div>
        )}

        {/* ═══ ACTIVE AUCTIONS TAB ═══ */}
        {activeTab === "active" && (
          <div className="space-y-3">
            {activeAuctions.length === 0 ? (
              <EmptyState icon={<Play size={32} />} text="Keine aktiven Auktionen" />
            ) : (
              activeAuctions.map((a) => (
                <AuctionFullCard 
                  key={a.auction_id} 
                  auction={a}
                  formatTime={formatTime}
                  onPause={handlePause}
                  onResume={handleResume}
                  onEnd={handleEnd}
                  onDelete={handleDelete}
                  onBotConfig={() => openBotConfig(a)}
                  onEngineConfig={() => openEngineConfig(a)}
                />
              ))
            )}
          </div>
        )}

        {/* ═══ CATALOG TAB ═══ */}
        {activeTab === "catalog" && (
          <div className="space-y-2">
            <p className="text-xs text-white/40 mb-3">{catalog.length} Produkte im Katalog. Klicke um Auktion zu starten.</p>
            {catalog.map((product, idx) => (
              <motion.div
                key={idx}
                className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-white/5 to-white/[0.02] flex items-center justify-center">
                  <Package size={20} className="text-white/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.title}</p>
                  <p className="text-xs text-white/40">UVP €{product.retail_price} • Bot-Ziel ~€{Math.round(product.retail_price * 0.15)}</p>
                </div>
                <motion.button
                  onClick={() => handleSchedule(idx)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/15 text-green-400"
                  whileTap={{ scale: 0.95 }}
                >
                  Starten
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ SCHEDULE MODAL ═══ */}
      <AnimatePresence>
        {showScheduleModal && (
          <Modal onClose={() => setShowScheduleModal(false)} title="Neue Auktion starten">
            <div className="mb-4 space-y-3 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.05] p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Engine-Voreinstellungen</p>
                  <p className="text-[10px] text-white/40">Diese Werte gelten für das ausgewählte Angebot.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleConfig(v => ({ ...v, featured: !v.featured }))}
                  className={`rounded-full px-3 py-1 text-[10px] font-black ${scheduleConfig.featured ? "bg-yellow-400 text-black" : "bg-white/10 text-white/50"}`}
                >
                  {scheduleConfig.featured ? "PREMIUM AN" : "Premium"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-xl border border-white/5 bg-black/10 p-2.5">
                  <span className="text-[9px] uppercase tracking-wider text-white/35">Gebotswert €</span>
                  <input type="number" min="0.01" max="10" step="0.01" value={scheduleConfig.bidValue}
                    onChange={e => setScheduleConfig(v => ({ ...v, bidValue: e.target.value }))}
                    className="mt-1 w-full bg-transparent text-base font-black text-cyan-300 outline-none" />
                </label>
                <label className="rounded-xl border border-white/5 bg-black/10 p-2.5">
                  <span className="text-[9px] uppercase tracking-wider text-white/35">Preis-Schritt €</span>
                  <input type="number" min="0.01" max="1" step="0.01" value={scheduleConfig.increment}
                    onChange={e => setScheduleConfig(v => ({ ...v, increment: e.target.value }))}
                    className="mt-1 w-full bg-transparent text-base font-black text-cyan-300 outline-none" />
                </label>
                <label className="rounded-xl border border-white/5 bg-black/10 p-2.5">
                  <span className="text-[9px] uppercase tracking-wider text-white/35">Gebotsumsatz-Ziel €</span>
                  <input type="number" min="0" max="100000" step="1" value={scheduleConfig.revenueTarget}
                    onChange={e => setScheduleConfig(v => ({ ...v, revenueTarget: e.target.value }))}
                    className="mt-1 w-full bg-transparent text-base font-black text-yellow-300 outline-none" />
                </label>
                <label className="rounded-xl border border-white/5 bg-black/10 p-2.5">
                  <span className="text-[9px] uppercase tracking-wider text-white/35">Nettoziel €</span>
                  <input data-testid="auction-schedule-net-profit" type="number" min="0" max="100000" step="1" value={scheduleConfig.targetNetProfit}
                    onChange={e => setScheduleConfig(v => ({ ...v, targetNetProfit: e.target.value }))}
                    className="mt-1 w-full bg-transparent text-base font-black text-emerald-300 outline-none" />
                </label>
                <label className="rounded-xl border border-white/5 bg-black/10 p-2.5">
                  <span className="text-[9px] uppercase tracking-wider text-white/35">Produktkosten €</span>
                  <input type="number" min="0" max="100000" step="1" value={scheduleConfig.productCost}
                    onChange={e => setScheduleConfig(v => ({ ...v, productCost: e.target.value }))}
                    className="mt-1 w-full bg-transparent text-base font-black text-white outline-none" />
                </label>
                <label className="rounded-xl border border-white/5 bg-black/10 p-2.5">
                  <span className="text-[9px] uppercase tracking-wider text-white/35">Versand €</span>
                  <input type="number" min="0" max="10000" step="1" value={scheduleConfig.shippingCost}
                    onChange={e => setScheduleConfig(v => ({ ...v, shippingCost: e.target.value }))}
                    className="mt-1 w-full bg-transparent text-base font-black text-white outline-none" />
                </label>
                <label className="rounded-xl border border-white/5 bg-black/10 p-2.5">
                  <span className="text-[9px] uppercase tracking-wider text-white/35">Sonstige Kosten €</span>
                  <input type="number" min="0" max="10000" step="1" value={scheduleConfig.otherCosts}
                    onChange={e => setScheduleConfig(v => ({ ...v, otherCosts: e.target.value }))}
                    className="mt-1 w-full bg-transparent text-base font-black text-white outline-none" />
                </label>
                <label className="rounded-xl border border-white/5 bg-black/10 p-2.5">
                  <span className="text-[9px] uppercase tracking-wider text-white/35">Dauer Stunden</span>
                  <select value={scheduleConfig.duration}
                    onChange={e => setScheduleConfig(v => ({ ...v, duration: Number(e.target.value) }))}
                    className="mt-1 w-full bg-transparent text-base font-black text-white outline-none">
                    <option value={48} className="bg-[#0a0a0a]">48</option>
                    <option value={72} className="bg-[#0a0a0a]">72</option>
                  </select>
                </label>
              </div>
              {(() => {
                const bidValue = Math.max(0.01, Number(scheduleConfig.bidValue) || 0.50);
                const increment = Math.max(0.01, Number(scheduleConfig.increment) || 0.01);
                const revenueTarget = Math.max(0, Number(scheduleConfig.revenueTarget) || 0);
                const costs = Math.max(0, Number(scheduleConfig.productCost) || 0)
                  + Math.max(0, Number(scheduleConfig.shippingCost) || 0)
                  + Math.max(0, Number(scheduleConfig.otherCosts) || 0);
                const netTarget = Math.max(0, Number(scheduleConfig.targetNetProfit) || 0);
                const bidsForRevenue = revenueTarget > 0 ? Math.ceil(revenueTarget / bidValue) : 0;
                const bidsForNet = netTarget > 0 ? Math.max(0, Math.ceil((costs + netTarget) / (bidValue + increment))) : 0;
                const bids = Math.max(bidsForRevenue, bidsForNet);
                const visiblePrice = bids * increment;
                const bidRevenue = bids * bidValue;
                const contribution = bidRevenue + visiblePrice - costs;
                return (
                  <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-3 text-[10px] text-white/55">
                    <p><span className="font-black text-emerald-300">{bids} Gebote</span> · Gebotsumsatz ≈ €{bidRevenue.toFixed(2)} · sichtbarer Preis ≈ €{visiblePrice.toFixed(2)}</p>
                    <p className="mt-1">Geschätzter Deckungsbeitrag ≈ <span className="font-black text-emerald-300">€{contribution.toFixed(2)}</span> bei Kosten von €{costs.toFixed(2)}.</p>
                    <p className="mt-1 text-white/35">Nur Kalkulation. Rabatte auf Credit-Pakete, Steuern und weitere Gebühren bitte unter „Sonstige Kosten“ berücksichtigen.</p>
                  </div>
                );
              })()}
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {catalog.map((product, idx) => (
                <motion.button
                  key={idx}
                  onClick={() => handleSchedule(idx)}
                  className="w-full rounded-xl p-3 flex items-center gap-3 text-left bg-white/[0.02] border border-white/5"
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{product.title}</p>
                    <p className="text-xs text-white/40">€{product.retail_price} • Bot-Ziel €{Math.round(product.retail_price * 0.15)}</p>
                  </div>
                  <ChevronRight size={18} className="text-white/30" />
                </motion.button>
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ═══ AUCTION ENGINE MODAL ═══ */}
      <AnimatePresence>
        {showEngineModal && (
          <Modal onClose={() => setShowEngineModal(null)} title="Auktions-Engine konfigurieren">
            <div className="space-y-4" data-testid="auction-engine-modal">
              <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
                <p className="text-sm font-semibold">{showEngineModal.title}</p>
                <p className="mt-1 text-xs text-white/40">Vor dem ersten echten Gebot editierbar.</p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-yellow-400/15 bg-yellow-400/[0.05] p-3">
                <div>
                  <p className="text-sm font-semibold text-yellow-200">Premium-Auktion</p>
                  <p className="text-[10px] text-white/40">Als große Top-Deal-Karte hervorheben</p>
                </div>
                <motion.button
                  type="button"
                  onClick={() => setEngineConfig(v => ({ ...v, featured: !v.featured }))}
                  className={`flex h-7 w-12 items-center rounded-full px-1 ${engineConfig.featured ? "bg-yellow-400" : "bg-white/10"}`}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div className="h-5 w-5 rounded-full bg-white" animate={{ x: engineConfig.featured ? 20 : 0 }} />
                </motion.button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">Gebotswert</span>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      data-testid="auction-engine-bid-value"
                      type="number"
                      min="0.01"
                      max="10"
                      step="0.01"
                      value={engineConfig.bidValue}
                      onChange={e => setEngineConfig(v => ({ ...v, bidValue: e.target.value }))}
                      className="w-full bg-transparent text-lg font-black text-cyan-300 outline-none"
                    />
                    <span className="text-sm text-white/40">€</span>
                  </div>
                </label>
                <label className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">Preis-Schritt</span>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      data-testid="auction-engine-increment"
                      type="number"
                      min="0.01"
                      max="1"
                      step="0.01"
                      value={engineConfig.increment}
                      onChange={e => setEngineConfig(v => ({ ...v, increment: e.target.value }))}
                      className="w-full bg-transparent text-lg font-black text-cyan-300 outline-none"
                    />
                    <span className="text-sm text-white/40">€</span>
                  </div>
                </label>
                <label className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">Gebotsumsatz-Ziel</span>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      data-testid="auction-engine-revenue-target"
                      type="number"
                      min="0"
                      max="100000"
                      step="1"
                      value={engineConfig.revenueTarget}
                      onChange={e => setEngineConfig(v => ({ ...v, revenueTarget: e.target.value }))}
                      className="w-full bg-transparent text-lg font-black text-yellow-300 outline-none"
                    />
                    <span className="text-sm text-white/40">€</span>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Produktkosten", "productCost", 100000],
                  ["Versand", "shippingCost", 10000],
                  ["Sonstige Kosten", "otherCosts", 10000],
                  ["Nettoziel", "targetNetProfit", 100000],
                ].map(([label, key, max]) => (
                  <label key={key} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/35">{label}</span>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        data-testid={`auction-engine-${key}`}
                        type="number"
                        min="0"
                        max={max}
                        step="1"
                        value={engineConfig[key]}
                        onChange={e => setEngineConfig(v => ({ ...v, [key]: e.target.value }))}
                        className={`w-full bg-transparent text-base font-black outline-none ${key === "targetNetProfit" ? "text-emerald-300" : "text-white"}`}
                      />
                      <span className="text-sm text-white/40">€</span>
                    </div>
                  </label>
                ))}
              </div>

              {(() => {
                const bidValue = Math.max(0.01, Number(engineConfig.bidValue) || 0.50);
                const increment = Math.max(0.01, Number(engineConfig.increment) || 0.01);
                const revenueTarget = Math.max(0, Number(engineConfig.revenueTarget) || 0);
                const costs = Math.max(0, Number(engineConfig.productCost) || 0)
                  + Math.max(0, Number(engineConfig.shippingCost) || 0)
                  + Math.max(0, Number(engineConfig.otherCosts) || 0);
                const netTarget = Math.max(0, Number(engineConfig.targetNetProfit) || 0);
                const currentPrice = Number(showEngineModal.current_price || 0);
                const bidsForRevenue = revenueTarget > 0 ? Math.ceil(revenueTarget / bidValue) : 0;
                const bidsForNet = netTarget > 0
                  ? Math.max(0, Math.ceil((costs + netTarget - currentPrice) / (bidValue + increment)))
                  : 0;
                const bidsNeeded = Math.max(bidsForRevenue, bidsForNet);
                const visibleIncrease = bidsNeeded * increment;
                const estimatedEnd = currentPrice + visibleIncrease;
                const bidRevenue = bidsNeeded * bidValue;
                const estimatedContribution = bidRevenue + estimatedEnd - costs;
                return (
                  <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] p-4">
                    <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-white/35">Benötigte Gebote</p>
                        <p className="mt-1 text-lg font-black text-white">{bidsNeeded}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-white/35">Gebotsumsatz</p>
                        <p className="mt-1 text-lg font-black text-cyan-300">€{bidRevenue.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-white/35">Sichtbarer Preis</p>
                        <p className="mt-1 text-lg font-black text-yellow-300">€{estimatedEnd.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-white/35">Deckungsbeitrag</p>
                        <p className="mt-1 text-lg font-black text-emerald-300">€{estimatedContribution.toFixed(2)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-[10px] leading-relaxed text-white/35">
                      Nettoziel €{netTarget.toFixed(2)} · Kosten €{costs.toFixed(2)}. Kalkulation mit nominalem Gebotswert; Credit-Rabatte, Steuern und Payment-Gebühren müssen in den Kosten berücksichtigt werden. Der Rechner steuert weder Timer noch Gewinner.
                    </p>
                  </div>
                );
              })()}

              <motion.button
                type="button"
                data-testid="auction-engine-save"
                onClick={saveEngineConfig}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 py-3 font-black text-[#03131A]"
                whileTap={{ scale: 0.98 }}
              >
                <Save size={17} /> Engine speichern
              </motion.button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ═══ BOT CONFIG MODAL - 3-PHASE SYSTEM ═══ */}
      <AnimatePresence>
        {showBotModal && (
          <Modal onClose={() => setShowBotModal(null)} title="Bot-Konfiguration (3-Phasen)">
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <p className="text-sm font-semibold">{showBotModal.title}</p>
                <p className="text-xs text-white/40">UVP: €{showBotModal.retail_price} • Aktuell: €{showBotModal.current_price?.toFixed(2)}</p>
              </div>

              {/* Bot Enable Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <Power size={18} className={botConfig.enabled ? "text-green-400" : "text-white/30"} />
                  <span className="text-sm font-medium">Bot aktiv</span>
                </div>
                <motion.button
                  onClick={() => setBotConfig(c => ({ ...c, enabled: !c.enabled }))}
                  className={`w-12 h-7 rounded-full flex items-center px-1 transition-colors ${
                    botConfig.enabled ? "bg-green-500" : "bg-white/10"
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div 
                    className="w-5 h-5 rounded-full bg-white"
                    animate={{ x: botConfig.enabled ? 20 : 0 }}
                  />
                </motion.button>
              </div>

              {/* 3-Phase Explanation */}
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-300 font-semibold mb-2">3-PHASEN BOT-STRATEGIE:</p>
                <div className="space-y-1 text-xs text-blue-200/70">
                  <p>1. START: Bot bietet bis €{botConfig.initialTarget || 5} (Aktivität starten)</p>
                  <p>2. PAUSE: Bot stoppt, echte Kunden bieten</p>
                  <p>3. FINAL: Letzte 5 Min → Bot bis €{botConfig.target?.toFixed(2) || "?"}</p>
                </div>
              </div>

              {/* Phase 1: Initial Target (€3-5) */}
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-green-300">Phase 1: Start-Ziel</span>
                  <span className="text-sm font-bold text-green-400">€{botConfig.initialTarget || 5}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={botConfig.initialTarget || 5}
                  onChange={(e) => setBotConfig(c => ({ ...c, initialTarget: parseFloat(e.target.value) }))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-green-400"
                />
                <p className="text-xs text-green-300/50 mt-1">Bot bietet bis dieser Preis erreicht ist</p>
              </div>

              {/* Phase 3: Final Target Price */}
              <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-yellow-300">Phase 3: End-Ziel</span>
                  <span className="text-sm font-bold text-yellow-400">€{botConfig.target?.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max={Math.min(showBotModal.retail_price * 0.5, 500)}
                  step="0.5"
                  value={botConfig.target}
                  onChange={(e) => setBotConfig(c => ({ ...c, target: parseFloat(e.target.value) }))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                />
                <div className="flex justify-between text-xs text-yellow-300/50 mt-1">
                  <span>€5</span>
                  <span>~{((botConfig.target / showBotModal.retail_price) * 100).toFixed(0)}% vom UVP</span>
                  <span>€{Math.min(showBotModal.retail_price * 0.5, 500).toFixed(0)}</span>
                </div>
              </div>

              {/* Final Phase Duration */}
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-purple-300">Final-Phase startet bei</span>
                  <span className="text-sm font-bold text-purple-400">{Math.floor((botConfig.minSeconds || 300) / 60)} Min verbleibend</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="600"
                  step="30"
                  value={botConfig.minSeconds || 300}
                  onChange={(e) => setBotConfig(c => ({ ...c, minSeconds: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-400"
                />
                <div className="flex justify-between text-xs text-purple-300/50 mt-1">
                  <span>1 Min</span>
                  <span>10 Min</span>
                </div>
              </div>

              {/* Estimated Revenue */}
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={16} className="text-cyan-400" />
                  <span className="text-sm text-cyan-300">Geschätzter Umsatz</span>
                </div>
                <p className="text-xl font-bold text-cyan-400">
                  €{(Math.round(botConfig.target / 0.01) * 0.50).toFixed(2)}
                </p>
                <p className="text-xs text-cyan-300/60">
                  ~{Math.round(botConfig.target / 0.01)} Gebote × €0.50 pro Gebot
                </p>
              </div>

              {/* Save Button */}
              <motion.button
                onClick={saveBotConfig}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold flex items-center justify-center gap-2"
                whileTap={{ scale: 0.98 }}
              >
                <Save size={18} />
                Speichern
              </motion.button>
            </div>
          </Modal>
        )}

        {/* ═══ IMAGE EDIT MODAL ═══ */}
        {showImageModal && (
          <Modal onClose={() => setShowImageModal(null)} title="Produktbild bearbeiten">
            <div className="space-y-4">
              {/* Current preview */}
              <div className="rounded-xl overflow-hidden bg-black/30 border border-white/10 h-48 flex items-center justify-center">
                {imageUrlInput ? (
                  <img
                    src={imageUrlInput.startsWith('http') ? imageUrlInput : `${API}${imageUrlInput}`}
                    alt={showImageModal.title}
                    className="w-full h-full object-contain"
                    onError={(e) => { e.target.style.opacity = '0.3'; }}
                  />
                ) : (
                  <div className="text-white/30 text-sm">Kein Bild</div>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold">{showImageModal.title}</p>
                <p className="text-xs text-white/40">{showImageModal.description}</p>
              </div>

              {/* URL Input */}
              <div>
                <label className="text-xs text-white/60 block mb-1.5">Bild-URL (https://...)</label>
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://example.com/produktbild.jpg"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:border-cyan-400 outline-none"
                  data-testid="image-url-input"
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="text-xs text-white/60 block mb-1.5">Oder Datei hochladen (max. 10 MB)</label>
                <label className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm cursor-pointer hover:bg-cyan-500/20 transition-colors">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => uploadImageFile(e.target.files?.[0])}
                    disabled={imageUploading}
                    data-testid="image-file-input"
                  />
                  {imageUploading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Lädt hoch...
                    </>
                  ) : (
                    <>
                      <Package size={16} />
                      JPG / PNG / WEBP auswählen
                    </>
                  )}
                </label>
              </div>

              {/* Save Button */}
              <motion.button
                onClick={saveImageUrl}
                disabled={imageUploading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                whileTap={{ scale: 0.98 }}
                data-testid="save-image-btn"
              >
                <Save size={18} />
                Speichern
              </motion.button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═══ SUB-COMPONENTS ═══

const MiniStat = ({ icon, value, label, color }) => (
  <div className="rounded-xl p-2 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
    <div className="flex items-center justify-center gap-1 mb-0.5" style={{ color }}>{icon}</div>
    <p className="text-lg font-bold" style={{ color }}>{value}</p>
    <p className="text-[10px] text-white/40">{label}</p>
  </div>
);

const Card = ({ title, icon, children }) => (
  <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">{icon}{title}</h3>
    {children}
  </div>
);

const ActionBtn = ({ icon, label, onClick, color }) => (
  <motion.button
    onClick={onClick}
    className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
    style={{ background: `${color}15`, color }}
    whileTap={{ scale: 0.97 }}
  >
    {icon}{label}
  </motion.button>
);

const AuctionMiniRow = ({ auction, formatTime, onBotClick, onImageClick, onEngineClick }) => (
  <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
    {/* Thumbnail (click to edit) */}
    <button
      onClick={onImageClick}
      disabled={
        auction.status === "ended" ||
        Boolean(auction.winner_id) ||
        Math.max(0, Number(auction.total_bids || 0) - Number(auction.bot_bids_placed || 0)) > 0
      }
      className="relative w-12 h-12 rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:border-cyan-400 shrink-0 group disabled:cursor-not-allowed disabled:opacity-40"
      title={
        auction.status === "ended" ||
        Boolean(auction.winner_id) ||
        Math.max(0, Number(auction.total_bids || 0) - Number(auction.bot_bids_placed || 0)) > 0
          ? "Produktdaten nach echtem Gebot gesperrt"
          : "Bild bearbeiten"
      }
      data-testid={`edit-image-${auction.auction_id}`}
    >
      {auction.image_url ? (
        <img
          src={auction.image_url.startsWith('http') ? auction.image_url : `${API}${auction.image_url}`}
          alt={auction.title}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/30">
          <Package size={18} />
        </div>
      )}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Edit3 size={14} className="text-cyan-400" />
      </div>
    </button>

    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{auction.title}</p>
      <p className="text-xs text-white/40">€{auction.current_price?.toFixed(2)} • {auction.total_bids} Gebote</p>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-xs text-yellow-400 font-mono">{formatTime(auction.remaining_seconds)}</span>
      <motion.button
        onClick={onEngineClick}
        className="p-1.5 rounded-lg bg-cyan-500/10"
        whileTap={{ scale: 0.9 }}
        title="Auktions-Engine"
      >
        <Target size={14} className="text-cyan-400" />
      </motion.button>
      <motion.button 
        onClick={onBotClick} 
        className={`p-1.5 rounded-lg ${auction.bot_enabled ? "bg-purple-500/20" : "bg-white/5"}`}
        whileTap={{ scale: 0.9 }}
      >
        <Bot size={14} className={auction.bot_enabled ? "text-purple-400" : "text-white/30"} />
      </motion.button>
    </div>
  </div>
);

const BotAuctionRow = ({ auction, formatTime, onToggle, onConfigure }) => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${auction.bot_enabled ? "bg-green-400" : "bg-white/20"}`} />
        <p className="text-sm font-medium truncate">{auction.title}</p>
      </div>
      <div className="flex items-center gap-3 text-xs text-white/40">
        <span>Ziel: €{auction.bot_target_price?.toFixed(2) || "N/A"}</span>
        <span>Bot-Bids: {auction.bot_bids_placed || 0}</span>
        <span className="text-yellow-400">{formatTime(auction.remaining_seconds)}</span>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <motion.button
        onClick={onToggle}
        className={`p-2 rounded-lg ${auction.bot_enabled ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/30"}`}
        whileTap={{ scale: 0.9 }}
        title={auction.bot_enabled ? "Bot deaktivieren" : "Bot aktivieren"}
      >
        <Power size={16} />
      </motion.button>
      <motion.button
        onClick={onConfigure}
        className="p-2 rounded-lg bg-purple-500/20 text-purple-400"
        whileTap={{ scale: 0.9 }}
        title="Bot konfigurieren"
      >
        <Sliders size={16} />
      </motion.button>
    </div>
  </div>
);

const AuctionFullCard = ({ auction, formatTime, onPause, onResume, onEnd, onDelete, onBotConfig, onEngineConfig }) => (
  <motion.div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }} layout>
    <div className="flex items-start gap-3 mb-3">
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] flex items-center justify-center flex-shrink-0">
        <Gavel size={24} className="text-white/40" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            auction.status === "active" ? "bg-green-500/20 text-green-400" :
            auction.status === "paused" ? "bg-yellow-500/20 text-yellow-400" : "bg-white/10 text-white/40"
          }`}>
            {auction.status.toUpperCase()}
          </span>
          {auction.bot_enabled && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400 flex items-center gap-1">
              <Bot size={10} /> BOT
            </span>
          )}
        </div>
        <p className="text-sm font-semibold truncate">{auction.title}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
          <span>€{auction.current_price?.toFixed(2)}</span>
          <span>{auction.total_bids} Gebote</span>
          {auction.status === "active" && <span className="text-yellow-400 font-mono">{formatTime(auction.remaining_seconds)}</span>}
        </div>
      </div>
    </div>

    {/* Bot Info */}
    {auction.bot_enabled && (
      <div className="mb-3 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs">
        <div className="flex justify-between">
          <span className="text-purple-300">Bot-Ziel: €{auction.bot_target_price?.toFixed(2)}</span>
          <span className="text-purple-300">Bot-Bids: {auction.bot_bids_placed || 0}</span>
        </div>
      </div>
    )}

    {/* Actions */}
    <div className="flex items-center gap-2 pt-3 border-t border-white/5">
      {auction.status === "active" && (
        <motion.button onClick={() => onPause(auction.auction_id)} className="flex-1 py-2 rounded-lg bg-yellow-500/10 text-yellow-400 text-xs font-medium" whileTap={{ scale: 0.97 }}>
          <Pause size={12} className="inline mr-1" /> Pause
        </motion.button>
      )}
      {auction.status === "paused" && (
        <motion.button onClick={() => onResume(auction.auction_id)} className="flex-1 py-2 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium" whileTap={{ scale: 0.97 }}>
          <Play size={12} className="inline mr-1" /> Weiter
        </motion.button>
      )}
      <motion.button onClick={onEngineConfig} className="flex-1 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs font-medium" whileTap={{ scale: 0.97 }}>
        <Target size={12} className="inline mr-1" /> Engine
      </motion.button>
      <motion.button onClick={onBotConfig} className="flex-1 py-2 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium" whileTap={{ scale: 0.97 }}>
        <Bot size={12} className="inline mr-1" /> Bot
      </motion.button>
      <motion.button onClick={() => onEnd(auction.auction_id)} className="py-2 px-3 rounded-lg bg-red-500/10 text-red-400 text-xs" whileTap={{ scale: 0.97 }}>
        <Square size={12} />
      </motion.button>
      <motion.button onClick={() => onDelete(auction.auction_id)} className="py-2 px-3 rounded-lg bg-white/5 text-white/40 text-xs" whileTap={{ scale: 0.97 }}>
        <Trash2 size={12} />
      </motion.button>
    </div>
  </motion.div>
);

const EmptyState = ({ icon, text }) => (
  <div className="flex flex-col items-center justify-center py-16 text-white/20">
    {icon}
    <p className="mt-3 text-sm">{text}</p>
  </div>
);

const SettingRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
    <span className="text-sm text-white/60">{label}</span>
    <span className="text-sm font-medium">{value}</span>
  </div>
);

const Modal = ({ onClose, title, children }) => (
  <motion.div
    className="fixed inset-0 z-[10000] flex items-end justify-center"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <div className="absolute inset-0 bg-black/70" onClick={onClose} />
    <motion.div
      className="relative w-full max-w-lg rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
      style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)" }}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <motion.button onClick={onClose} className="p-2 rounded-lg bg-white/5" whileTap={{ scale: 0.9 }}>
          <X size={18} />
        </motion.button>
      </div>
      {children}
    </motion.div>
  </motion.div>
);

export default AuctionAdminPage;
