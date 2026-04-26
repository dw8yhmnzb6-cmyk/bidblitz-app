/**
 * BidBlitz V2 - Real Restaurant Dashboard
 * For approved restaurants only - Full order & menu management
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Power, Clock, DollarSign, CheckCircle, XCircle,
  Phone, Loader2, Star, TrendingUp, AlertCircle, ChevronRight,
  UtensilsCrossed, Package, Bell, RefreshCw, Wallet, Plus,
  Edit2, Trash2, Check, X, ShoppingBag, Timer, MapPin, User,
  Car, Truck
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const panelBg = "rgba(12, 14, 26, 0.95)";
const panelBorder = "1px solid rgba(255,255,255,0.04)";

const RestaurantDashboardPage = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("orders"); // orders | menu | stats

  // Menu Management
  const [menuItems, setMenuItems] = useState([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({ name: "", description: "", price: "", category: "main" });

  // Order History
  const [orderHistory, setOrderHistory] = useState([]);

  // Driver Assignment
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [showDriverModal, setShowDriverModal] = useState(null); // order_id to assign driver
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  useEffect(() => {
    loadStatus();
    // Poll for updates every 15 seconds
    const interval = setInterval(loadStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchAPI = async (path, options = {}) => {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Anfrage fehlgeschlagen");
    }
    return res.json();
  };

  const loadStatus = async () => {
    try {
      const data = await fetchAPI("/api/restaurant-dashboard/status");
      setStatus(data);
      setError(null);
    } catch (err) {
      if (err.message?.includes("Kein genehmigtes")) {
        setError("Du hast kein genehmigtes Restaurant. Bitte beantrage die Restaurant-Genehmigung.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMenu = async () => {
    try {
      const data = await fetchAPI("/api/restaurant-dashboard/menu");
      setMenuItems(data.items || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await fetchAPI("/api/restaurant-dashboard/orders/history?limit=50");
      setOrderHistory(data.orders || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (activeTab === "menu") loadMenu();
    if (activeTab === "stats") loadHistory();
  }, [activeTab]);

  const toggleOpen = async () => {
    setActionLoading(true);
    try {
      const res = await fetchAPI("/api/restaurant-dashboard/toggle-open", { method: "POST" });
      setSuccess(res.message);
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    setActionLoading(true);
    try {
      const res = await fetchAPI(`/api/restaurant-dashboard/orders/${orderId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      setSuccess(res.message);
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  // Load available drivers
  const loadAvailableDrivers = async () => {
    setLoadingDrivers(true);
    try {
      const data = await fetchAPI("/api/restaurant-dashboard/available-drivers");
      setAvailableDrivers(data.drivers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDrivers(false);
    }
  };

  // Assign driver to order
  const assignDriver = async (orderId, driverId) => {
    setActionLoading(true);
    try {
      const res = await fetchAPI(`/api/restaurant-dashboard/orders/${orderId}/assign-driver`, {
        method: "POST",
        body: JSON.stringify({ driver_id: driverId }),
      });
      setSuccess(res.message);
      setShowDriverModal(null);
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
      setTimeout(() => { setSuccess(null); setError(null); }, 2000);
    }
  };

  // Remove driver from order
  const removeDriver = async (orderId) => {
    setActionLoading(true);
    try {
      const res = await fetchAPI(`/api/restaurant-dashboard/orders/${orderId}/remove-driver`, {
        method: "POST",
      });
      setSuccess(res.message);
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  // Open driver assignment modal
  const openDriverAssignment = (orderId) => {
    setShowDriverModal(orderId);
    loadAvailableDrivers();
  };

  const addMenuItem = async () => {
    if (!newItem.name || !newItem.price) {
      setError("Name und Preis erforderlich");
      return;
    }
    setActionLoading(true);
    try {
      await fetchAPI("/api/restaurant-dashboard/menu", {
        method: "POST",
        body: JSON.stringify({ ...newItem, price: parseFloat(newItem.price) }),
      });
      setSuccess("Artikel hinzugefügt");
      setNewItem({ name: "", description: "", price: "", category: "main" });
      setShowAddItem(false);
      await loadMenu();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
      setTimeout(() => { setSuccess(null); setError(null); }, 2000);
    }
  };

  const deleteMenuItem = async (itemId) => {
    if (!confirm("Artikel wirklich löschen?")) return;
    try {
      await fetchAPI(`/api/restaurant-dashboard/menu/${itemId}`, { method: "DELETE" });
      setSuccess("Artikel gelöscht");
      await loadMenu();
    } catch (err) {
      setError(err.message);
    }
    setTimeout(() => { setSuccess(null); setError(null); }, 2000);
  };

  const toggleItemAvailability = async (itemId) => {
    try {
      await fetchAPI(`/api/restaurant-dashboard/menu/${itemId}/toggle`, { method: "POST" });
      await loadMenu();
    } catch (err) {
      setError(err.message);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#030303" }}>
        <Loader2 size={32} className="text-orange-500 animate-spin" />
      </div>
    );
  }

  // Error state (not approved)
  if (error && !status) {
    return (
      <div className="min-h-screen p-4" style={{ background: "#030303" }}>
        <div className="flex items-center gap-3 mb-6">
          <motion.button
            onClick={() => onNavigate?.("food")}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <ArrowLeft size={18} className="text-white/60" />
          </motion.button>
          <h1 className="text-lg font-bold text-white">Restaurant Dashboard</h1>
        </div>
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-400 font-medium mb-2">{error}</p>
          <p className="text-sm text-gray-500">Kontaktiere den Support für die Genehmigung.</p>
        </div>
      </div>
    );
  }

  const pendingCount = status?.pending_orders?.length || 0;
  const activeCount = status?.active_orders?.length || 0;

  return (
    <div data-testid="restaurant-dashboard" className="min-h-screen pb-24" style={{ background: "#030303" }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 pt-4 pb-3" style={{ background: panelBg, borderBottom: panelBorder }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => onNavigate?.("food")}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <ArrowLeft size={16} className="text-white/60" />
            </motion.button>
            <div>
              <h1 className="text-[15px] font-bold text-white">{status?.name || "Restaurant"}</h1>
              <div className="flex items-center gap-2">
                <Star size={12} className="text-yellow-400" />
                <span className="text-[11px] text-yellow-400">{status?.rating?.toFixed(1)}</span>
                <span className="text-[11px] text-gray-500">• {status?.category}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={loadStatus}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <RefreshCw size={14} className="text-white/50" />
            </motion.button>
            <motion.button
              onClick={toggleOpen}
              disabled={actionLoading}
              className={`px-4 py-2 rounded-full text-[12px] font-bold flex items-center gap-2 ${
                status?.is_open
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-red-500/20 text-red-400 border border-red-500/30"
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <Power size={14} />
              {status?.is_open ? "GEÖFFNET" : "GESCHLOSSEN"}
            </motion.button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { key: "orders", label: "Bestellungen", icon: Package, badge: pendingCount + activeCount },
            { key: "menu", label: "Speisekarte", icon: UtensilsCrossed },
            { key: "stats", label: "Statistik", icon: TrendingUp },
          ].map((tab) => (
            <motion.button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-[12px] font-semibold relative ${
                activeTab === tab.key
                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                  : "bg-white/5 text-white/50"
              }`}
              whileTap={{ scale: 0.97 }}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {(success || error) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 left-4 right-4 z-50"
          >
            {success && (
              <div className="px-4 py-3 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center gap-2">
                <CheckCircle size={16} className="text-green-400" />
                <span className="text-green-400 text-[12px] font-medium">{success}</span>
              </div>
            )}
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-400" />
                <span className="text-red-400 text-[12px] font-medium">{error}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 space-y-4">
        {/* ════════════════════════════════════════════════════════════════════════
            ORDERS TAB
        ════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "orders" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
                <p className="text-[10px] text-green-400/70 uppercase tracking-wider mb-1">Heute</p>
                <p className="text-[24px] font-bold text-green-400">€{status?.stats?.today_revenue?.toFixed(2) || "0.00"}</p>
                <p className="text-[10px] text-gray-500">{status?.stats?.today_orders || 0} Bestellungen</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                <p className="text-[10px] text-blue-400/70 uppercase tracking-wider mb-1">Diese Woche</p>
                <p className="text-[24px] font-bold text-blue-400">€{status?.stats?.week_revenue?.toFixed(2) || "0.00"}</p>
                <p className="text-[10px] text-gray-500">{status?.stats?.week_orders || 0} Bestellungen</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20">
                <p className="text-[10px] text-orange-400/70 uppercase tracking-wider mb-1">Guthaben</p>
                <p className="text-[24px] font-bold text-orange-400">€{status?.balance?.toFixed(2) || "0.00"}</p>
                <p className="text-[10px] text-gray-500">Auszahlbar</p>
              </div>
            </div>

            {/* Pending Orders */}
            {pendingCount > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Bell size={14} className="text-red-400" />
                  <p className="text-[12px] text-red-400 font-semibold uppercase tracking-wider">
                    Neue Bestellungen ({pendingCount})
                  </p>
                </div>
                <div className="space-y-3">
                  {status?.pending_orders?.map((order) => (
                    <OrderCard
                      key={order.order_id}
                      order={order}
                      isPending
                      onAccept={() => updateOrderStatus(order.order_id, "accepted")}
                      onReject={() => updateOrderStatus(order.order_id, "rejected")}
                      loading={actionLoading}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Active Orders */}
            {activeCount > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Timer size={14} className="text-orange-400" />
                  <p className="text-[12px] text-orange-400 font-semibold uppercase tracking-wider">
                    In Bearbeitung ({activeCount})
                  </p>
                </div>
                <div className="space-y-3">
                  {status?.active_orders?.map((order) => (
                    <OrderCard
                      key={order.order_id}
                      order={order}
                      onStatusUpdate={(newStatus) => updateOrderStatus(order.order_id, newStatus)}
                      onAssignDriver={openDriverAssignment}
                      onRemoveDriver={removeDriver}
                      loading={actionLoading}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {pendingCount === 0 && activeCount === 0 && (
              <div className="py-16 text-center">
                <Package size={48} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Keine aktiven Bestellungen</p>
                <p className="text-[12px] text-gray-600 mt-1">
                  {status?.is_open ? "Warte auf neue Bestellungen..." : "Öffne dein Restaurant, um Bestellungen zu erhalten"}
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════════
            MENU TAB
        ════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "menu" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Add Item Button */}
            <motion.button
              onClick={() => setShowAddItem(true)}
              className="w-full py-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 font-semibold text-[13px] flex items-center justify-center gap-2"
              whileTap={{ scale: 0.98 }}
            >
              <Plus size={16} /> Neuen Artikel hinzufügen
            </motion.button>

            {/* Add Item Form */}
            <AnimatePresence>
              {showAddItem && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3"
                >
                  <p className="text-[12px] text-white font-semibold">Neuer Artikel</p>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="Name *"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-[13px] placeholder-gray-600 outline-none"
                  />
                  <input
                    type="text"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder="Beschreibung (optional)"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-[13px] placeholder-gray-600 outline-none"
                  />
                  <div className="flex gap-3">
                    <input
                      type="number"
                      step="0.50"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                      placeholder="Preis € *"
                      className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-[13px] placeholder-gray-600 outline-none"
                    />
                    <select
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-[13px] outline-none"
                    >
                      <option value="starter">Vorspeise</option>
                      <option value="main">Hauptgericht</option>
                      <option value="side">Beilage</option>
                      <option value="dessert">Dessert</option>
                      <option value="drink">Getränk</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <motion.button
                      onClick={addMenuItem}
                      disabled={actionLoading}
                      className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-[12px] font-bold flex items-center justify-center gap-2"
                      whileTap={{ scale: 0.98 }}
                    >
                      {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Hinzufügen
                    </motion.button>
                    <motion.button
                      onClick={() => setShowAddItem(false)}
                      className="px-4 py-2.5 bg-white/5 text-gray-400 rounded-xl text-[12px] font-medium"
                      whileTap={{ scale: 0.98 }}
                    >
                      Abbrechen
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Menu Items */}
            <div className="space-y-2">
              {menuItems.length === 0 ? (
                <div className="py-12 text-center">
                  <UtensilsCrossed size={40} className="text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500">Noch keine Artikel</p>
                </div>
              ) : (
                menuItems.map((item) => (
                  <div
                    key={item.item_id}
                    className={`p-4 rounded-xl flex items-center gap-3 ${
                      item.is_available ? "bg-white/[0.02] border border-white/5" : "bg-red-500/5 border border-red-500/10 opacity-60"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-semibold text-white">{item.name}</p>
                        {!item.is_available && (
                          <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] font-bold">AUSVERKAUFT</span>
                        )}
                      </div>
                      {item.description && <p className="text-[11px] text-gray-500 mt-0.5">{item.description}</p>}
                      <p className="text-[10px] text-gray-600 mt-1 capitalize">{item.category}</p>
                    </div>
                    <p className="text-[16px] font-bold text-orange-400">€{item.price?.toFixed(2)}</p>
                    <div className="flex items-center gap-1">
                      <motion.button
                        onClick={() => toggleItemAvailability(item.item_id)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          item.is_available ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"
                        }`}
                        whileTap={{ scale: 0.9 }}
                      >
                        {item.is_available ? <Check size={14} /> : <X size={14} />}
                      </motion.button>
                      <motion.button
                        onClick={() => deleteMenuItem(item.item_id)}
                        className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center"
                        whileTap={{ scale: 0.9 }}
                      >
                        <Trash2 size={14} />
                      </motion.button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════════
            STATS TAB
        ════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "stats" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Summary */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-500/10 to-yellow-500/5 border border-orange-500/20">
              <p className="text-[11px] text-orange-400/70 uppercase tracking-wider mb-2">Gesamtumsatz</p>
              <p className="text-[36px] font-bold text-white">€{status?.stats?.total_revenue?.toFixed(2) || "0.00"}</p>
              <p className="text-[12px] text-gray-500 mt-1">{status?.stats?.total_orders || 0} Bestellungen insgesamt</p>
            </div>

            {/* Order History */}
            <div>
              <p className="text-[12px] text-gray-400 font-semibold uppercase tracking-wider mb-3">Letzte Bestellungen</p>
              {orderHistory.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock size={40} className="text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500">Noch keine Bestellhistorie</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {orderHistory.slice(0, 20).map((order) => (
                    <div key={order.order_id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        order.status === "delivered" ? "bg-green-500/20" : order.status === "canceled" ? "bg-red-500/20" : "bg-gray-500/20"
                      }`}>
                        {order.status === "delivered" ? (
                          <CheckCircle size={18} className="text-green-400" />
                        ) : order.status === "canceled" ? (
                          <XCircle size={18} className="text-red-400" />
                        ) : (
                          <Clock size={18} className="text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-white">#{order.order_id?.slice(-6)}</p>
                        <p className="text-[10px] text-gray-500">
                          {new Date(order.created_at).toLocaleDateString("de-DE", {
                            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                          })}
                        </p>
                      </div>
                      <p className={`text-[14px] font-bold ${order.status === "delivered" ? "text-green-400" : "text-gray-400"}`}>
                        €{order.total?.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          DRIVER SELECTION MODAL
      ════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showDriverModal && (
          <motion.div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowDriverModal(null)} />
            <motion.div
              className="relative w-full max-w-md bg-[#0A0A0A] rounded-2xl border border-white/10 p-5 max-h-[80vh] overflow-y-auto"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-bold text-white">Fahrer zuweisen</h3>
                <motion.button
                  onClick={() => setShowDriverModal(null)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={16} className="text-gray-400" />
                </motion.button>
              </div>

              <p className="text-[12px] text-gray-500 mb-4">
                Wähle einen verfügbaren Fahrer für Bestellung #{showDriverModal?.slice(-6)}
              </p>

              {loadingDrivers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="text-blue-400 animate-spin" />
                </div>
              ) : availableDrivers.length === 0 ? (
                <div className="py-8 text-center">
                  <Car size={32} className="text-gray-700 mx-auto mb-2" />
                  <p className="text-gray-500 text-[13px]">Keine Fahrer verfügbar</p>
                  <p className="text-gray-600 text-[11px] mt-1">Versuche es später erneut</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableDrivers.map((driver) => (
                    <motion.button
                      key={driver.driver_id}
                      onClick={() => assignDriver(showDriverModal, driver.driver_id)}
                      disabled={actionLoading}
                      className="w-full p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all flex items-center gap-3"
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Car size={20} className="text-blue-400" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-[14px] font-semibold text-white">{driver.name}</p>
                        <div className="flex items-center gap-3 text-[11px] text-gray-500">
                          <span className="flex items-center gap-1">
                            <Star size={10} className="text-yellow-400" />
                            {driver.rating?.toFixed(1)}
                          </span>
                          <span>{driver.completed_deliveries || 0} Lieferungen</span>
                          <span className="capitalize">{driver.vehicle_type}</span>
                        </div>
                      </div>
                      {actionLoading ? (
                        <Loader2 size={16} className="text-blue-400 animate-spin" />
                      ) : (
                        <ChevronRight size={16} className="text-gray-500" />
                      )}
                    </motion.button>
                  ))}
                </div>
              )}

              <motion.button
                onClick={() => { setShowDriverModal(null); loadAvailableDrivers(); }}
                className="w-full mt-4 py-2.5 bg-white/5 rounded-xl text-[12px] text-gray-400 font-medium flex items-center justify-center gap-2"
                whileTap={{ scale: 0.98 }}
              >
                <RefreshCw size={14} /> Aktualisieren
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ORDER CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const OrderCard = ({ order, isPending, onAccept, onReject, onStatusUpdate, onAssignDriver, onRemoveDriver, loading }) => {
  const statusColors = {
    pending: "bg-yellow-500/20 text-yellow-400",
    accepted: "bg-blue-500/20 text-blue-400",
    preparing: "bg-orange-500/20 text-orange-400",
    ready: "bg-green-500/20 text-green-400",
  };

  const statusLabels = {
    pending: "Neu",
    accepted: "Angenommen",
    preparing: "In Zubereitung",
    ready: "Fertig",
  };

  const nextStatus = {
    accepted: "preparing",
    preparing: "ready",
    ready: "picked_up",
  };

  const hasDriver = !!order.driver_id;

  return (
    <motion.div
      className={`p-4 rounded-2xl ${isPending ? "bg-red-500/5 border-2 border-red-500/30" : "bg-white/[0.02] border border-white/5"}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold text-white">#{order.order_id?.slice(-6)}</span>
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${statusColors[order.status]}`}>
            {statusLabels[order.status]}
          </span>
        </div>
        <p className="text-[18px] font-bold text-orange-400">€{order.total?.toFixed(2)}</p>
      </div>

      {/* Customer Info */}
      <div className="flex items-center gap-2 mb-3 text-[11px] text-gray-400">
        <User size={12} />
        <span>{order.customer_name || "Kunde"}</span>
        <span>•</span>
        <Clock size={12} />
        <span>{new Date(order.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>

      {/* Driver Info (if assigned) */}
      {hasDriver && (
        <div className="flex items-center justify-between p-2.5 mb-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2">
            <Car size={14} className="text-green-400" />
            <span className="text-[12px] text-green-400 font-medium">{order.driver_name}</span>
            {order.driver_phone && (
              <a href={`tel:${order.driver_phone}`} className="text-[10px] text-green-400/70">
                📞 {order.driver_phone}
              </a>
            )}
          </div>
          <motion.button
            onClick={() => onRemoveDriver?.(order.order_id)}
            className="text-[10px] text-red-400 px-2 py-1 rounded bg-red-500/10"
            whileTap={{ scale: 0.95 }}
          >
            Entfernen
          </motion.button>
        </div>
      )}

      {/* Items */}
      <div className="space-y-1 mb-3">
        {order.items?.slice(0, 5).map((item, i) => (
          <div key={i} className="flex items-center justify-between text-[12px]">
            <span className="text-gray-300">{item.quantity}x {item.name}</span>
            <span className="text-gray-500">€{(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        {order.items?.length > 5 && (
          <p className="text-[11px] text-gray-500">+ {order.items.length - 5} weitere Artikel</p>
        )}
      </div>

      {/* Actions */}
      {isPending ? (
        <div className="flex gap-2">
          <motion.button
            onClick={onAccept}
            disabled={loading}
            className="flex-1 py-3 bg-green-500 text-white rounded-xl text-[12px] font-bold flex items-center justify-center gap-2"
            whileTap={{ scale: 0.98 }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Annehmen
          </motion.button>
          <motion.button
            onClick={onReject}
            disabled={loading}
            className="flex-1 py-3 bg-red-500/20 text-red-400 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2"
            whileTap={{ scale: 0.98 }}
          >
            <XCircle size={14} />
            Ablehnen
          </motion.button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Assign Driver Button (if no driver yet) */}
          {!hasDriver && order.status !== "pending" && (
            <motion.button
              onClick={() => onAssignDriver?.(order.order_id)}
              className="w-full py-2.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2"
              whileTap={{ scale: 0.98 }}
            >
              <Truck size={14} />
              Fahrer zuweisen
            </motion.button>
          )}
          
          {/* Status Update Button */}
          {nextStatus[order.status] && (
            <motion.button
              onClick={() => onStatusUpdate(nextStatus[order.status])}
              disabled={loading}
              className="w-full py-3 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2"
              whileTap={{ scale: 0.98 }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
              {order.status === "accepted" && "Zubereitung starten"}
              {order.status === "preparing" && "Fertig melden"}
              {order.status === "ready" && "Abgeholt"}
            </motion.button>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default RestaurantDashboardPage;
