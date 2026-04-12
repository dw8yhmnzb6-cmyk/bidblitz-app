/**
 * BidBlitz V2 - Quick Access Bar
 * Personalized shortcut row on HomePage. User picks their own favorites.
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car, Zap, Hotel, UtensilsCrossed, Ticket, MapPin, Wallet,
  Gamepad2, ShoppingBag, CreditCard, Bot, Bitcoin, PiggyBank,
  Heart, Baby, Star, Phone, Globe, Settings, Plus, X, Check,
  GripVertical, Pencil, Shield, Calendar, MessageCircle, Briefcase,
  Plane, Package
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// All available shortcuts
const ALL_SHORTCUTS = [
  { id: "taxi", icon: Car, label: "Taxi", route: "/taxi", color: "#F59E0B" },
  { id: "scooter", icon: Zap, label: "Scooter", route: "/scooter", color: "#10B981" },
  { id: "hotels", icon: Hotel, label: "Hotels", route: "/hotels", color: "#3B82F6" },
  { id: "restaurants", icon: UtensilsCrossed, label: "Restaurant", route: "/restaurants", color: "#EF4444" },
  { id: "events", icon: Ticket, label: "Events", route: "/events", color: "#A855F7" },
  { id: "food", icon: UtensilsCrossed, label: "Essen", route: "/food", color: "#F97316" },
  { id: "map", icon: MapPin, label: "Karte", route: "/mobility-map", color: "#06B6D4" },
  { id: "wallet", icon: Wallet, label: "Wallet", route: "/wallet", color: "#00C2FF" },
  { id: "gaming", icon: Gamepad2, label: "Gaming", route: "/gaming", color: "#EC4899" },
  { id: "marketplace", icon: ShoppingBag, label: "Marktplatz", route: "/marketplace", color: "#8B5CF6" },
  { id: "car-rental", icon: Car, label: "Mietwagen", route: "/car-rental", color: "#14B8A6" },
  { id: "crypto", icon: Bitcoin, label: "Crypto", route: "/crypto", color: "#F59E0B" },
  { id: "budget", icon: PiggyBank, label: "Budget", route: "/budget", color: "#10B981" },
  { id: "ai", icon: Bot, label: "KI-Berater", route: "/ai-assistant", color: "#6366F1" },
  { id: "kids", icon: Baby, label: "Kids", route: "/kids", color: "#F472B6" },
  { id: "loyalty", icon: Star, label: "Loyalty", route: "/loyalty", color: "#FBBF24" },
  { id: "contacts", icon: Phone, label: "Kontakte", route: "/contacts", color: "#22D3EE" },
  { id: "currency", icon: Globe, label: "Währung", route: "/currency", color: "#34D399" },
  { id: "credit", icon: CreditCard, label: "Kredit", route: "/credit-score", color: "#F87171" },
  { id: "tips", icon: Heart, label: "Trinkgeld", route: "/more", color: "#FB923C" },
  { id: "insurance", icon: Shield, label: "Versicherung", route: "/insurance", color: "#EF4444" },
  { id: "appointments", icon: Calendar, label: "Termine", route: "/appointments", color: "#3B82F6" },
  { id: "social", icon: MessageCircle, label: "Community", route: "/social", color: "#EC4899" },
  { id: "jobs", icon: Briefcase, label: "Jobs", route: "/jobs", color: "#6366F1" },
  { id: "flights", icon: Plane, label: "Flüge", route: "/flights", color: "#06B6D4" },
  { id: "parcels", icon: Package, label: "Pakete", route: "/parcels", color: "#F97316" },
  { id: "nearby", icon: MapPin, label: "In der Nähe", route: "/nearby", color: "#10B981" },
];

const DEFAULT_SHORTCUTS = ["taxi", "scooter", "hotels", "restaurants"];

const QuickAccessBar = ({ onNavigate }) => {
  const [shortcuts, setShortcuts] = useState([]);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/user/quick-access`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setShortcuts(d.shortcuts?.length > 0 ? d.shortcuts : DEFAULT_SHORTCUTS);
      } else {
        setShortcuts(DEFAULT_SHORTCUTS);
      }
    } catch {
      setShortcuts(DEFAULT_SHORTCUTS);
    }
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (newShortcuts) => {
    setShortcuts(newShortcuts);
    try {
      await fetch(`${API}/api/user/quick-access`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortcuts: newShortcuts }),
      });
    } catch {}
  };

  const startEdit = () => {
    setSelected([...shortcuts]);
    setEditing(true);
  };

  const toggleItem = (id) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= 8) return prev;
      return [...prev, id];
    });
  };

  const confirmEdit = () => {
    save(selected);
    setEditing(false);
  };

  if (!loaded) return null;

  const activeShortcuts = shortcuts
    .map(id => ALL_SHORTCUTS.find(s => s.id === id))
    .filter(Boolean);

  return (
    <>
      {/* Quick Access Row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24 }}
        className="mb-5"
        data-testid="quick-access-bar"
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-[#F59E0B]" />
            <h3 className="text-[13px] font-semibold font-outfit text-white">Schnellzugriff</h3>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={startEdit}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium text-[#F59E0B] bg-[#F59E0B]/5 border border-[#F59E0B]/10"
            data-testid="quick-access-edit"
          >
            <Pencil size={10} /> Bearbeiten
          </motion.button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {activeShortcuts.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.26 + i * 0.04 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onNavigate(s.route)}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 w-[62px]"
              data-testid={`quick-${s.id}`}
            >
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center relative"
                style={{ background: `${s.color}12`, border: `1px solid ${s.color}20` }}
              >
                <s.icon size={18} style={{ color: s.color }} />
                <div className="absolute inset-0 rounded-2xl opacity-20 pointer-events-none" style={{ background: s.color, filter: "blur(12px)" }} />
              </div>
              <span className="text-[9px] text-[#777] font-medium text-center leading-tight truncate w-full">
                {s.label}
              </span>
            </motion.button>
          ))}

          {/* Add button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            whileTap={{ scale: 0.9 }}
            onClick={startEdit}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 w-[62px]"
            data-testid="quick-add-more"
          >
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-white/[0.03] border border-dashed border-white/10">
              <Plus size={16} className="text-[#444]" />
            </div>
            <span className="text-[9px] text-[#444] font-medium">Mehr</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setEditing(false)}
            data-testid="quick-access-modal"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#111118] rounded-t-3xl border-t border-white/10 max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-4 pb-3 flex items-center justify-between border-b border-white/5 flex-shrink-0">
                <div>
                  <h3 className="text-[14px] font-bold text-white">Schnellzugriff bearbeiten</h3>
                  <p className="text-[10px] text-gray-500">{selected.length}/8 ausgewählt</p>
                </div>
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditing(false)}
                    className="p-2 rounded-xl bg-white/5">
                    <X size={16} className="text-gray-400" />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={confirmEdit}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#F59E0B] text-black text-xs font-bold"
                    data-testid="quick-access-save">
                    <Check size={14} /> Speichern
                  </motion.button>
                </div>
              </div>

              {/* Grid of all shortcuts */}
              <div className="p-3 overflow-y-auto flex-1 pb-20">
                <div className="grid grid-cols-4 gap-2">
                  {ALL_SHORTCUTS.map((s) => {
                    const isActive = selected.includes(s.id);
                    const idx = selected.indexOf(s.id);
                    return (
                      <motion.button
                        key={s.id}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => toggleItem(s.id)}
                        className={`relative p-2.5 rounded-xl flex flex-col items-center gap-1 border transition-all ${
                          isActive
                            ? "border-[#F59E0B]/40 bg-[#F59E0B]/5"
                            : "border-white/5 bg-white/[0.02] hover:border-white/10"
                        }`}
                        data-testid={`quick-option-${s.id}`}
                      >
                        {isActive && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#F59E0B] flex items-center justify-center">
                            <span className="text-[7px] font-bold text-black">{idx + 1}</span>
                          </div>
                        )}
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: `${s.color}${isActive ? "20" : "10"}` }}
                        >
                          <s.icon size={14} style={{ color: s.color }} />
                        </div>
                        <span className={`text-[8px] font-medium text-center leading-tight ${isActive ? "text-white" : "text-[#666]"}`}>
                          {s.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default QuickAccessBar;
