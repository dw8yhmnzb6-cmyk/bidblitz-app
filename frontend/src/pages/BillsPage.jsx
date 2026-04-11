/**
 * BidBlitz V2 - Bills & Utilities Page
 * Pay utility bills: eSIM, Mobile top-up, Gas, Electricity, etc.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Smartphone, Wifi, Zap, Flame, Phone, CreditCard,
  CheckCircle, AlertCircle, Loader2, ChevronRight, Euro, Globe,
  Signal, Clock, Shield
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const BILL_CATEGORIES = [
  {
    id: "esim",
    name: "eSIM",
    icon: Smartphone,
    color: "purple",
    description: "Sofort aktivierbare eSIM",
    products: [
      { id: "esim_eu_1gb", name: "EU 1GB", data: "1 GB", days: 7, price: 4.99 },
      { id: "esim_eu_3gb", name: "EU 3GB", data: "3 GB", days: 15, price: 9.99 },
      { id: "esim_eu_10gb", name: "EU 10GB", data: "10 GB", days: 30, price: 19.99 },
      { id: "esim_world_5gb", name: "Weltweit 5GB", data: "5 GB", days: 30, price: 29.99 },
    ],
  },
  {
    id: "mobile",
    name: "Handy Guthaben",
    icon: Phone,
    color: "green",
    description: "Prepaid Aufladung",
    products: [
      { id: "mobile_10", name: "€10 Guthaben", amount: 10, price: 10.00 },
      { id: "mobile_20", name: "€20 Guthaben", amount: 20, price: 20.00 },
      { id: "mobile_50", name: "€50 Guthaben", amount: 50, price: 50.00 },
    ],
  },
  {
    id: "electricity",
    name: "Strom",
    icon: Zap,
    color: "yellow",
    description: "Stromrechnung bezahlen",
    isCustom: true,
  },
  {
    id: "gas",
    name: "Gas",
    icon: Flame,
    color: "orange",
    description: "Gasrechnung bezahlen",
    isCustom: true,
  },
  {
    id: "internet",
    name: "Internet",
    icon: Wifi,
    color: "blue",
    description: "Internetrechnung bezahlen",
    isCustom: true,
  },
];

const BillsPage = ({ onBack, onNavigate }) => {
  const [loading, setLoading] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customAmount, setCustomAmount] = useState("");
  const [customRef, setCustomRef] = useState(""); // Customer number/reference
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadBalance();
  }, []);

  const loadBalance = async () => {
    try {
      const res = await fetch(`${API_URL}/api/wallet/balance`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUserBalance(data.balance || 0);
      }
    } catch {}
  };

  const purchaseProduct = async () => {
    if (!selectedProduct && !customAmount) return;
    
    const amount = selectedProduct?.price || parseFloat(customAmount);
    if (amount > userBalance) {
      setError("Nicht genug Guthaben");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/bills/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category: selectedCategory.id,
          product_id: selectedProduct?.id,
          amount,
          reference: customRef || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Zahlung fehlgeschlagen");
      }

      const data = await res.json();
      setSuccess({
        message: "Zahlung erfolgreich!",
        details: selectedCategory.id === "esim" 
          ? "Deine eSIM wird per E-Mail gesendet."
          : "Die Zahlung wurde verarbeitet.",
        transaction_id: data.transaction_id,
      });
      loadBalance();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const colorClasses = {
    purple: { bg: "bg-purple-500/20", border: "border-purple-500/30", text: "text-purple-400" },
    green: { bg: "bg-green-500/20", border: "border-green-500/30", text: "text-green-400" },
    yellow: { bg: "bg-yellow-500/20", border: "border-yellow-500/30", text: "text-yellow-400" },
    orange: { bg: "bg-orange-500/20", border: "border-orange-500/30", text: "text-orange-400" },
    blue: { bg: "bg-blue-500/20", border: "border-blue-500/30", text: "text-blue-400" },
  };

  return (
    <div data-testid="bills-page" className="min-h-screen bg-[#030303] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 py-3 bg-[#0A0A0F] border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              onClick={selectedCategory ? () => {
                setSelectedCategory(null);
                setSelectedProduct(null);
                setSuccess(null);
              } : onBack}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <ArrowLeft size={16} className="text-white/60" />
            </motion.button>
            <h1 className="text-[17px] font-bold text-white">
              {selectedCategory ? selectedCategory.name : "Rechnungen & eSIM"}
            </h1>
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 text-[12px]">
            <Euro size={12} className="text-green-400" />
            <span className="text-green-400 font-semibold">{userBalance.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2"
          >
            <AlertCircle size={16} className="text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Screen */}
      {success && (
        <motion.div
          className="p-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="p-8 rounded-3xl bg-green-500/10 border border-green-500/20 text-center">
            <CheckCircle size={64} className="text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">{success.message}</h2>
            <p className="text-gray-400 mb-4">{success.details}</p>
            {success.transaction_id && (
              <p className="text-xs text-gray-500 mb-6">TX: {success.transaction_id}</p>
            )}
            <motion.button
              onClick={() => {
                setSuccess(null);
                setSelectedCategory(null);
                setSelectedProduct(null);
              }}
              className="px-8 py-3 bg-green-500 text-white font-bold rounded-xl"
              whileTap={{ scale: 0.98 }}
            >
              Fertig
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Category Selection */}
      {!selectedCategory && !success && (
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-500 mb-4">Wähle eine Kategorie</p>
          {BILL_CATEGORIES.map((cat) => {
            const colors = colorClasses[cat.color];
            const Icon = cat.icon;
            return (
              <motion.button
                key={cat.id}
                onClick={() => setSelectedCategory(cat)}
                className={`w-full p-4 rounded-2xl ${colors.bg} border ${colors.border} flex items-center gap-4`}
                whileTap={{ scale: 0.98 }}
              >
                <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center`}>
                  <Icon size={24} className={colors.text} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[15px] font-semibold text-white">{cat.name}</p>
                  <p className="text-xs text-gray-500">{cat.description}</p>
                </div>
                <ChevronRight size={20} className="text-gray-500" />
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Product Selection */}
      {selectedCategory && !success && (
        <div className="p-4 space-y-4">
          {/* Products */}
          {selectedCategory.products && (
            <div className="space-y-2">
              {selectedCategory.products.map((product) => {
                const isSelected = selectedProduct?.id === product.id;
                const canAfford = userBalance >= product.price;
                return (
                  <motion.button
                    key={product.id}
                    onClick={() => setSelectedProduct(isSelected ? null : product)}
                    disabled={!canAfford}
                    className={`w-full p-4 rounded-xl flex items-center gap-3 ${
                      isSelected
                        ? "bg-cyan-500/20 border-2 border-cyan-500"
                        : canAfford
                        ? "bg-white/[0.02] border border-white/10"
                        : "bg-white/[0.01] border border-white/5 opacity-50"
                    }`}
                    whileTap={canAfford ? { scale: 0.98 } : {}}
                  >
                    <div className="flex-1 text-left">
                      <p className="text-[14px] font-semibold text-white">{product.name}</p>
                      {product.data && (
                        <p className="text-xs text-gray-500">{product.data} • {product.days} Tage</p>
                      )}
                    </div>
                    <p className="text-lg font-bold text-cyan-400">€{product.price.toFixed(2)}</p>
                    {isSelected && <CheckCircle size={20} className="text-cyan-400" />}
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* Custom Amount (for utilities) */}
          {selectedCategory.isCustom && (
            <div className="space-y-3">
              <input
                type="text"
                value={customRef}
                onChange={(e) => setCustomRef(e.target.value)}
                placeholder="Kundennummer / Referenz"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 outline-none"
              />
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Betrag in €"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 outline-none"
              />
            </div>
          )}

          {/* Purchase Button */}
          {(selectedProduct || (selectedCategory.isCustom && customAmount)) && (
            <motion.button
              onClick={purchaseProduct}
              disabled={processing}
              className="w-full py-4 bg-cyan-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.98 }}
            >
              {processing ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <CreditCard size={20} />
                  Jetzt bezahlen €{(selectedProduct?.price || parseFloat(customAmount) || 0).toFixed(2)}
                </>
              )}
            </motion.button>
          )}

          {/* eSIM Info */}
          {selectedCategory.id === "esim" && (
            <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 space-y-2">
              <div className="flex items-center gap-2 text-purple-400">
                <Shield size={14} />
                <span className="text-xs font-semibold">eSIM Vorteile</span>
              </div>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Sofort nach Kauf per E-Mail</li>
                <li>• Keine physische SIM notwendig</li>
                <li>• In über 100 Ländern nutzbar</li>
                <li>• Kein Vertrag, keine Bindung</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BillsPage;
