/**
 * BidBlitz V2 - Marketplace Dashboard
 * Merchant view for managing listings, boosts, and VIP upgrades
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Package, Eye, Zap, Star, TrendingUp, 
  Trash2, Edit, Sparkles, Crown, Loader2, Plus,
  BarChart3, Euro, Clock, Check, TicketPercent
} from 'lucide-react';
import { useI18n, useUser } from '../store';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function MarketplaceDashboardPage({ onBack, onNavigate }) {
  const { t } = useI18n();
  const user = useUser();
  
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState({});
  const [balance, setBalance] = useState(0);
  const [boostOptions, setBoostOptions] = useState([]);
  const [vipPrice, setVipPrice] = useState(4.99);
  const [selectedListing, setSelectedListing] = useState(null);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [flashSales, setFlashSales] = useState([]);
  const [eligibleListings, setEligibleListings] = useState([]);
  const [flashStats, setFlashStats] = useState({});
  const [showFlashModal, setShowFlashModal] = useState(false);
  const [selectedFlashListing, setSelectedFlashListing] = useState(null);
  const [flashPrice, setFlashPrice] = useState('');
  const [flashDuration, setFlashDuration] = useState('180');
  const [savingFlash, setSavingFlash] = useState(false);

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dashRes, balRes, optRes, flashRes] = await Promise.all([
        fetch(`${API}/api/marketplace/dashboard/my`, { credentials: 'include' }),
        fetch(`${API}/api/wallet/balance`, { credentials: 'include' }),
        fetch(`${API}/api/marketplace/boost-options`),
        fetch(`${API}/api/commerce-center/merchant-dashboard`, { credentials: 'include' }),
      ]);

      if (dashRes.ok) {
        const data = await dashRes.json();
        setListings(data.listings || []);
        setStats(data.stats || {});
      }
      
      if (balRes.ok) {
        const data = await balRes.json();
        setBalance(data.balance || 0);
      }
      
      if (optRes.ok) {
        const data = await optRes.json();
        setBoostOptions(data.options || []);
        setVipPrice(data.vip_price || 4.99);
      }

      if (flashRes.ok) {
        const data = await flashRes.json();
        setFlashSales(data.flash_sales || []);
        setEligibleListings(data.eligible_listings || []);
        setFlashStats(data.stats || {});
      }
    } catch (e) {
      console.error('Failed to load dashboard', e);
    }
    setLoading(false);
  };

  const openFlashModal = (listing) => {
    setSelectedFlashListing(listing);
    setFlashPrice((Math.max(0.5, (listing.price || 0) * 0.85)).toFixed(2));
    setFlashDuration('180');
    setShowFlashModal(true);
  };

  const createFlashSale = async () => {
    if (!selectedFlashListing) return;
    setSavingFlash(true);
    try {
      const res = await fetch(`${API}/api/commerce-center/flash-sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          listing_id: selectedFlashListing.listing_id,
          sale_price: parseFloat(flashPrice),
          duration_minutes: parseInt(flashDuration, 10),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success('Flash Sale gestartet');
        setShowFlashModal(false);
        fetchData();
      } else {
        toast.error(data.detail || 'Flash Sale konnte nicht erstellt werden');
      }
    } catch (error) {
      toast.error('Verbindungsfehler');
      void error;
    }
    setSavingFlash(false);
  };

  const cancelFlashSale = async (saleId) => {
    try {
      const res = await fetch(`${API}/api/commerce-center/flash-sales/${saleId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success('Flash Sale beendet');
        fetchData();
      } else {
        toast.error(data.detail || 'Beenden fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Verbindungsfehler');
      void error;
    }
  };

  // Boost listing
  const boostListing = async (listingId, boostType) => {
    setBoosting(true);
    try {
      const res = await fetch(`${API}/api/marketplace/boost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listing_id: listingId, type: boostType }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.ok) {
        toast.success(data.message || 'Boost aktiviert!');
        setBalance(data.new_balance);
        setShowBoostModal(false);
        fetchData();
      } else {
        toast.error(data.detail || 'Boost fehlgeschlagen');
      }
    } catch (e) {
      toast.error('Verbindungsfehler');
    }
    setBoosting(false);
  };

  // VIP upgrade
  const upgradeToVip = async (listingId) => {
    setBoosting(true);
    try {
      const res = await fetch(`${API}/api/marketplace/vip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listing_id: listingId }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.ok) {
        toast.success('VIP aktiviert!');
        setBalance(data.new_balance);
        fetchData();
      } else {
        toast.error(data.detail || 'VIP Upgrade fehlgeschlagen');
      }
    } catch (e) {
      toast.error('Verbindungsfehler');
    }
    setBoosting(false);
  };

  // Delete listing
  const deleteListing = async (listingId) => {
    if (!window.confirm('Anzeige wirklich löschen?')) return;
    
    try {
      const res = await fetch(`${API}/api/marketplace/${listingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (res.ok) {
        toast.success('Anzeige gelöscht');
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Löschen fehlgeschlagen');
      }
    } catch (e) {
      toast.error('Verbindungsfehler');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#030303" }}>
        <Loader2 size={32} className="text-cyan-400 animate-spin" />
      </div>
    );
  }

  const now = new Date().toISOString();
  const activeFlashSales = flashSales.filter((sale) => sale.status === 'active' && (sale.remaining_seconds || 0) > 0);
  const activeFlashListingIds = new Set(activeFlashSales.map((sale) => sale.listing_id));
  const formatRemaining = (seconds) => {
    const total = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <motion.div
      data-testid="marketplace-dashboard"
      className="min-h-screen pb-24"
      style={{ background: "#030303" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="px-5 pt-[max(env(safe-area-inset-top,0px),12px)] pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.button
                onClick={onBack}
                className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
              >
                <ChevronLeft size={18} className="text-white/50" />
              </motion.button>
              <div>
                <h1 className="text-[17px] font-bold text-white">Mein Marketplace</h1>
                <p className="text-[11px] text-[#555]">Dashboard & Verwaltung</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#555]">Guthaben</p>
              <p className="text-[16px] font-bold text-cyan-400">€{balance.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            className="rounded-xl p-4"
            style={{ background: "rgba(0,194,255,0.05)", border: "1px solid rgba(0,194,255,0.15)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Package size={16} className="text-cyan-400" />
              <span className="text-[10px] text-[#555] uppercase">Anzeigen</span>
            </div>
            <p className="text-[24px] font-bold text-white">{stats.total_listings || 0}</p>
            <p className="text-[10px] text-[#00D26A]">{stats.active_listings || 0} aktiv</p>
          </motion.div>

          <motion.div
            className="rounded-xl p-4"
            style={{ background: "rgba(255,184,0,0.05)", border: "1px solid rgba(255,184,0,0.15)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-yellow-400" />
              <span className="text-[10px] text-[#555] uppercase">Geboostet</span>
            </div>
            <p className="text-[24px] font-bold text-white">{stats.boosted_listings || 0}</p>
            <p className="text-[10px] text-[#FFB800]">{stats.vip_listings || 0} VIP</p>
          </motion.div>

          <motion.div
            className="rounded-xl p-4"
            style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.15)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Eye size={16} className="text-purple-400" />
              <span className="text-[10px] text-[#555] uppercase">Views</span>
            </div>
            <p className="text-[24px] font-bold text-white">{stats.total_views || 0}</p>
            <p className="text-[10px] text-[#555]">Gesamt</p>
          </motion.div>

          <motion.div
            className="rounded-xl p-4"
            style={{ background: "rgba(0,210,106,0.05)", border: "1px solid rgba(0,210,106,0.15)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Euro size={16} className="text-green-400" />
              <span className="text-[10px] text-[#555] uppercase">Ausgegeben</span>
            </div>
            <p className="text-[24px] font-bold text-white">€{stats.total_spent_on_boost?.toFixed(2) || '0.00'}</p>
            <p className="text-[10px] text-[#555]">für Werbung</p>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <motion.button
            onClick={() => onNavigate?.('/marketplace')}
            className="flex-1 py-3 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2"
            style={{ background: "rgba(0,194,255,0.1)", color: "#00C2FF" }}
            whileTap={{ scale: 0.97 }}
            data-testid="marketplace-dashboard-new-listing-button"
          >
            <Plus size={16} />
            Neue Anzeige
          </motion.button>
          <motion.button
            onClick={() => onNavigate?.('/wallet')}
            className="flex-1 py-3 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2"
            style={{ background: "rgba(255,255,255,0.05)", color: "#fff" }}
            whileTap={{ scale: 0.97 }}
            data-testid="marketplace-dashboard-wallet-button"
          >
            <Euro size={16} />
            Aufladen
          </motion.button>
          <motion.button
            onClick={() => eligibleListings[0] ? openFlashModal(eligibleListings[0]) : onNavigate?.('/commerce-center')}
            className="flex-1 py-3 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2"
            style={{ background: "rgba(249,115,22,0.12)", color: "#FDBA74" }}
            whileTap={{ scale: 0.97 }}
            data-testid="marketplace-dashboard-create-flash-sale-button"
          >
            <TicketPercent size={16} />
            Flash Sale
          </motion.button>
        </div>

        <div className="rounded-xl p-4" style={{ background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.18)" }} data-testid="flash-sales-dashboard-section">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[14px] font-semibold text-white flex items-center gap-2">
                <TicketPercent size={16} className="text-[#FDBA74]" /> Flash Sales Cockpit
              </h2>
              <p className="text-[11px] text-[#8A8A8A] mt-1">Eigene Listings als Flash Sale planen, live schalten und direkt aus dem Commerce Center verlinken.</p>
            </div>
            <motion.button onClick={() => eligibleListings[0] && openFlashModal(eligibleListings[0])} disabled={eligibleListings.length === 0} className="px-3 py-2 rounded-lg text-[11px] font-semibold" style={{ background: "rgba(249,115,22,0.14)", color: "#FDBA74", opacity: eligibleListings.length === 0 ? 0.5 : 1 }} whileTap={eligibleListings.length > 0 ? { scale: 0.97 } : {}} data-testid="flash-sales-open-create-modal-button">
              Neuer Sale
            </motion.button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Aktiv', value: flashStats.active_flash_sales || 0 },
              { label: 'Eligible', value: flashStats.eligible_listings || 0 },
              { label: 'Beendet', value: flashStats.completed_flash_sales || 0 },
              { label: 'Umsatz', value: `€${Number(flashStats.flash_sale_revenue || 0).toFixed(2)}` },
            ].map((item) => (
              <div key={item.label} className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.22)' }} data-testid={`flash-sales-stat-${item.label.toLowerCase()}`}>
                <p className="text-[10px] uppercase text-[#8A8A8A]">{item.label}</p>
                <p className="text-[22px] font-bold text-white mt-1">{item.value}</p>
              </div>
            ))}
          </div>

          {activeFlashSales.length > 0 ? (
            <div className="space-y-3">
              {activeFlashSales.map((sale) => (
                <div key={sale.sale_id} className="rounded-xl p-4 border border-white/6 bg-black/20" data-testid={`merchant-flash-sale-${sale.sale_id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-semibold text-white">{sale.title}</p>
                      <p className="text-[11px] text-[#8A8A8A] mt-1">{sale.discount_pct}% günstiger · endet in {formatRemaining(sale.remaining_seconds)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[18px] font-bold text-[#FDBA74]">€{Number(sale.sale_price || 0).toFixed(2)}</p>
                      <p className="text-[10px] text-[#6E6E6E] line-through">€{Number(sale.original_price || 0).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <motion.button onClick={() => onNavigate?.(`/marketplace?listing_id=${sale.listing_id}&source=merchant-dashboard`)} className="px-3 py-2 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: '#fff' }} whileTap={{ scale: 0.97 }} data-testid={`merchant-flash-sale-open-listing-${sale.sale_id}`}>
                      Listing öffnen
                    </motion.button>
                    <motion.button onClick={() => onNavigate?.('/commerce-center')} className="px-3 py-2 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(0,194,255,0.12)', color: '#8EEBFF' }} whileTap={{ scale: 0.97 }} data-testid={`merchant-flash-sale-open-center-${sale.sale_id}`}>
                      Im Commerce Center ansehen
                    </motion.button>
                    <motion.button onClick={() => cancelFlashSale(sale.sale_id)} className="px-3 py-2 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(255,71,87,0.12)', color: '#FF8A95' }} whileTap={{ scale: 0.97 }} data-testid={`merchant-flash-sale-cancel-${sale.sale_id}`}>
                      Beenden
                    </motion.button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-4 text-center text-[12px] text-[#8A8A8A]" style={{ background: 'rgba(0,0,0,0.22)' }} data-testid="merchant-flash-sales-empty">
              Noch kein aktiver Flash Sale. Wähle unten ein aktives Listing und starte deinen ersten Deal.
            </div>
          )}

          {eligibleListings.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/6">
              <p className="text-[11px] uppercase text-[#8A8A8A] mb-3">Eligible Listings</p>
              <div className="grid gap-3 md:grid-cols-2">
                {eligibleListings.slice(0, 4).map((listing) => (
                  <button key={listing.listing_id} onClick={() => openFlashModal(listing)} className="rounded-xl p-3 text-left border border-white/6 bg-black/20" data-testid={`merchant-flash-sale-eligible-${listing.listing_id}`}>
                    <p className="text-[12px] font-semibold text-white truncate">{listing.title}</p>
                    <p className="text-[11px] text-[#8A8A8A] mt-1">Basispreis €{Number(listing.price || 0).toFixed(2)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Listings */}
        <div>
          <h2 className="text-[14px] font-semibold text-white mb-3 flex items-center gap-2">
            <Package size={16} className="text-cyan-400" />
            Meine Anzeigen
          </h2>

          {listings.length === 0 ? (
            <div className="text-center py-12 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}>
              <Package size={40} className="mx-auto mb-3 text-[#333]" />
              <p className="text-[#555] text-sm">Noch keine Anzeigen</p>
              <motion.button
                onClick={() => onNavigate?.('/marketplace')}
                className="mt-4 px-4 py-2 rounded-lg text-[12px] font-semibold"
                style={{ background: "rgba(0,194,255,0.15)", color: "#00C2FF" }}
                whileTap={{ scale: 0.97 }}
              >
                Erste Anzeige erstellen
              </motion.button>
            </div>
          ) : (
            <div className="space-y-3">
              {listings.map((listing, i) => {
                const hasBoost = listing.boost && listing.boost.expires_at > now;
                const isVip = listing.is_vip;
                const isActive = listing.status === 'active';

                return (
                  <motion.div
                    key={listing.listing_id}
                    className={`rounded-xl p-4 ${
                      hasBoost 
                        ? 'border-2 border-yellow-500/40 shadow-[0_0_15px_rgba(255,200,0,0.1)]' 
                        : isVip 
                          ? 'border border-[#FFD700]/30'
                          : 'border border-white/5'
                    }`}
                    style={{ background: "rgba(255,255,255,0.02)" }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex gap-3">
                      {/* Image */}
                      <div className="w-20 h-20 rounded-lg bg-[#111] flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {listing.images?.[0] ? (
                          <img src={listing.images[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package size={24} className="text-[#333]" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-[13px] font-semibold text-white truncate">{listing.title}</h3>
                            <p className="text-[16px] font-bold text-cyan-400">€{listing.price?.toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {hasBoost && (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-yellow-500/20 text-yellow-400 flex items-center gap-1">
                                <Sparkles size={10} /> BOOST
                              </span>
                            )}
                            {isVip && (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#FFD700]/20 text-[#FFD700] flex items-center gap-1">
                                <Crown size={10} /> VIP
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 mt-2 text-[10px] text-[#555]">
                          <span className="flex items-center gap-1">
                            <Eye size={12} /> {listing.views || 0}
                          </span>
                          <span className={`flex items-center gap-1 ${isActive ? 'text-[#00D26A]' : 'text-[#FF6B6B]'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#00D26A]' : 'bg-[#FF6B6B]'}`} />
                            {listing.status === 'active' ? 'Aktiv' : listing.status === 'sold' ? 'Verkauft' : 'Inaktiv'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {isActive && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                        {!hasBoost && (
                          <motion.button
                            onClick={() => { setSelectedListing(listing); setShowBoostModal(true); }}
                            className="flex-1 py-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1"
                            style={{ background: "rgba(255,184,0,0.1)", color: "#FFB800" }}
                            whileTap={{ scale: 0.97 }}
                          >
                            <Zap size={12} /> Boost
                          </motion.button>
                        )}
                        {!isVip && (
                          <motion.button
                            onClick={() => upgradeToVip(listing.listing_id)}
                            disabled={boosting}
                            className="flex-1 py-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1"
                            style={{ background: "rgba(255,215,0,0.1)", color: "#FFD700" }}
                            whileTap={{ scale: 0.97 }}
                          >
                            <Crown size={12} /> VIP €{vipPrice}
                          </motion.button>
                        )}
                        {!activeFlashListingIds.has(listing.listing_id) && (
                          <motion.button
                            onClick={() => openFlashModal(listing)}
                            className="flex-1 py-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1"
                            style={{ background: "rgba(249,115,22,0.12)", color: "#FDBA74" }}
                            whileTap={{ scale: 0.97 }}
                            data-testid={`listing-start-flash-sale-${listing.listing_id}`}
                          >
                            <TicketPercent size={12} /> Flash Sale
                          </motion.button>
                        )}
                        <motion.button
                          onClick={() => deleteListing(listing.listing_id)}
                          className="px-3 py-2 rounded-lg"
                          style={{ background: "rgba(255,71,87,0.1)", color: "#FF4757" }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <Trash2 size={14} />
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Boost Info */}
        <motion.div
          className="rounded-xl p-4"
          style={{ background: "rgba(255,184,0,0.04)", border: "1px solid rgba(255,184,0,0.1)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-[12px] font-semibold text-white mb-2 flex items-center gap-2">
            <TrendingUp size={14} className="text-[#FFB800]" />
            Mehr Verkäufe?
          </h3>
          <p className="text-[11px] text-[#555] leading-relaxed mb-3">
            Boost deine Anzeigen für mehr Sichtbarkeit! Geboostete Anzeigen erscheinen ganz oben in der Liste.
          </p>
          <div className="flex gap-2">
            {boostOptions.map((opt) => (
              <div key={opt.id} className="flex-1 text-center p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                <p className="text-[14px] font-bold text-[#FFB800]">€{opt.price}</p>
                <p className="text-[9px] text-[#555]">{opt.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Boost Modal */}
      <AnimatePresence>
        {showFlashModal && selectedFlashListing && (
          <motion.div className="fixed inset-0 z-[10001] flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowFlashModal(false)} />
            <motion.div className="relative w-full max-w-lg rounded-t-3xl p-5" style={{ background: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)' }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}>
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
              <h2 className="text-[16px] font-bold text-white mb-2">Flash Sale starten</h2>
              <p className="text-[12px] text-[#555] mb-4">{selectedFlashListing.title}</p>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-[#8A8A8A] block mb-1">Flash-Sale-Preis</label>
                  <input value={flashPrice} onChange={(e) => setFlashPrice(e.target.value)} type="number" step="0.01" min="0.5" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white" data-testid="flash-sale-price-input" />
                </div>
                <div>
                  <label className="text-[11px] text-[#8A8A8A] block mb-1">Laufzeit in Minuten</label>
                  <select value={flashDuration} onChange={(e) => setFlashDuration(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white" data-testid="flash-sale-duration-select">
                    <option value="60">60 Minuten</option>
                    <option value="120">120 Minuten</option>
                    <option value="180">180 Minuten</option>
                    <option value="360">360 Minuten</option>
                    <option value="720">12 Stunden</option>
                  </select>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'rgba(249,115,22,0.08)' }} data-testid="flash-sale-preview-box">
                  <p className="text-[11px] text-[#8A8A8A]">Originalpreis €{Number(selectedFlashListing.price || 0).toFixed(2)}</p>
                  <p className="text-[13px] font-semibold text-[#FDBA74] mt-1">Dealpreis €{Number(flashPrice || 0).toFixed(2)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <motion.button onClick={() => setShowFlashModal(false)} className="py-3 rounded-xl text-[12px] font-semibold" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }} whileTap={{ scale: 0.97 }} data-testid="flash-sale-cancel-modal-button">Abbrechen</motion.button>
                <motion.button onClick={createFlashSale} disabled={savingFlash} className="py-3 rounded-xl text-[12px] font-semibold" style={{ background: 'rgba(249,115,22,0.16)', color: '#FDBA74', opacity: savingFlash ? 0.6 : 1 }} whileTap={{ scale: 0.97 }} data-testid="flash-sale-submit-button">{savingFlash ? 'Startet…' : 'Flash Sale starten'}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showBoostModal && selectedListing && (
          <motion.div
            className="fixed inset-0 z-[10000] flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowBoostModal(false)} />
            <motion.div
              className="relative w-full max-w-lg rounded-t-3xl p-5"
              style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)" }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
              
              <h2 className="text-[16px] font-bold text-white mb-2">Anzeige boosten</h2>
              <p className="text-[12px] text-[#555] mb-4">„{selectedListing.title}“</p>

              <div className="space-y-3">
                {boostOptions.map((opt) => (
                  <motion.button
                    key={opt.id}
                    onClick={() => boostListing(selectedListing.listing_id, opt.id)}
                    disabled={boosting || balance < opt.price}
                    className="w-full p-4 rounded-xl flex items-center justify-between"
                    style={{ 
                      background: balance >= opt.price ? "rgba(255,184,0,0.08)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${balance >= opt.price ? "rgba(255,184,0,0.2)" : "rgba(255,255,255,0.05)"}`,
                      opacity: balance < opt.price ? 0.5 : 1
                    }}
                    whileTap={balance >= opt.price ? { scale: 0.98 } : {}}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#FFB800]/10 flex items-center justify-center">
                        <Zap size={18} className="text-[#FFB800]" />
                      </div>
                      <div className="text-left">
                        <p className="text-[13px] font-semibold text-white">{opt.label}</p>
                        <p className="text-[10px] text-[#555]">{opt.duration_days} Tag{opt.duration_days > 1 ? 'e' : ''} Top-Platzierung</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[16px] font-bold text-[#FFB800]">€{opt.price}</p>
                      {balance < opt.price && (
                        <p className="text-[9px] text-[#FF6B6B]">Nicht genug</p>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>

              <motion.button
                onClick={() => setShowBoostModal(false)}
                className="w-full mt-4 py-3 rounded-xl text-[12px] font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", color: "#fff" }}
                whileTap={{ scale: 0.97 }}
              >
                Abbrechen
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
