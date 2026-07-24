/**
 * BidBlitz V2 - Quick Access Bar
 * Personalized shortcut row on HomePage. User picks their own favorites.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car, Zap, Hotel, UtensilsCrossed, Ticket, MapPin, Wallet,
  Gamepad2, ShoppingBag, CreditCard, Bot, Bitcoin, PiggyBank,
  Heart, Baby, Star, Phone, Globe, Settings, Plus, X, Check,
  GripVertical, Pencil, Shield, Calendar, MessageCircle, Briefcase,
  Plane, Package, Building2, Users, GraduationCap, Wrench, Film,
  Stethoscope, CarFront, Sparkles, Truck, Dog, Dumbbell, Palmtree,
  BatteryCharging, TrendingUp
} from "lucide-react";
import { filterStoreSafeItems } from "../config/release";
import { useI18n } from "../store";

const API = process.env.REACT_APP_BACKEND_URL;

// All available shortcuts
const ALL_SHORTCUTS = filterStoreSafeItems([
  { id: "taxi", icon: Car, labelKey: "shortcut.taxi", route: "/taxi", color: "#F59E0B" },
  { id: "scooter", icon: Zap, labelKey: "shortcut.scooter", route: "/scooter", color: "#10B981" },
  { id: "hotels", icon: Hotel, labelKey: "shortcut.hotels", route: "/hotels", color: "#3B82F6" },
  { id: "restaurants", icon: UtensilsCrossed, labelKey: "shortcut.restaurants", route: "/restaurants", color: "#EF4444" },
  { id: "events", icon: Ticket, labelKey: "shortcut.events", route: "/events", color: "#A855F7" },
  { id: "food", icon: UtensilsCrossed, labelKey: "shortcut.food", route: "/food", color: "#F97316" },
  { id: "map", icon: MapPin, labelKey: "shortcut.map", route: "/mobility-map", color: "#06B6D4" },
  { id: "wallet", icon: Wallet, labelKey: "shortcut.wallet", route: "/wallet", color: "#00C2FF" },
  { id: "gaming", icon: Gamepad2, labelKey: "shortcut.gaming", route: "/gaming", color: "#EC4899" },
  { id: "marketplace", icon: ShoppingBag, labelKey: "shortcut.marketplace", route: "/marketplace", color: "#8B5CF6" },
  { id: "car-rental", icon: Car, labelKey: "shortcut.car_rental", route: "/car-rental", color: "#14B8A6" },
  { id: "crypto", icon: Bitcoin, labelKey: "shortcut.crypto", route: "/crypto", color: "#F59E0B" },
  { id: "budget", icon: PiggyBank, labelKey: "shortcut.budget", route: "/budget", color: "#10B981" },
  { id: "ai", icon: Bot, labelKey: "shortcut.ai", route: "/ai-assistant", color: "#6366F1" },
  { id: "kids", icon: Baby, labelKey: "shortcut.kids", route: "/kids", color: "#F472B6" },
  { id: "loyalty", icon: Star, labelKey: "shortcut.loyalty", route: "/loyalty", color: "#FBBF24" },
  { id: "contacts", icon: Phone, labelKey: "shortcut.contacts", route: "/contacts", color: "#22D3EE" },
  { id: "currency", icon: Globe, labelKey: "shortcut.currency", route: "/currency", color: "#34D399" },
  { id: "credit", icon: CreditCard, labelKey: "shortcut.credit", route: "/credit-score", color: "#F87171" },
  { id: "tips", icon: Heart, labelKey: "shortcut.tips", route: "/more", color: "#FB923C" },
  { id: "insurance", icon: Shield, labelKey: "shortcut.insurance", route: "/insurance", color: "#EF4444" },
  { id: "appointments", icon: Calendar, labelKey: "shortcut.appointments", route: "/appointments", color: "#3B82F6" },
  { id: "social", icon: MessageCircle, labelKey: "shortcut.social", route: "/social", color: "#EC4899" },
  { id: "jobs", icon: Briefcase, labelKey: "shortcut.jobs", route: "/jobs", color: "#6366F1" },
  { id: "flights", icon: Plane, labelKey: "shortcut.flights", route: "/flights", color: "#06B6D4" },
  { id: "parcels", icon: Package, labelKey: "shortcut.parcels", route: "/parcels", color: "#F97316" },
  { id: "nearby", icon: MapPin, labelKey: "shortcut.nearby", route: "/nearby", color: "#10B981" },
  { id: "real-estate", icon: Building2, labelKey: "shortcut.real_estate", route: "/real-estate", color: "#059669" },
  { id: "freelancer", icon: Users, labelKey: "shortcut.freelancer", route: "/freelancer", color: "#7C3AED" },
  { id: "elearning", icon: GraduationCap, labelKey: "shortcut.elearning", route: "/elearning", color: "#2563EB" },
  { id: "handwerker", icon: Wrench, labelKey: "shortcut.handwerker", route: "/handwerker", color: "#D97706" },
  { id: "streaming", icon: Film, labelKey: "shortcut.streaming", route: "/streaming", color: "#DC2626" },
  { id: "telemedizin", icon: Stethoscope, labelKey: "shortcut.telemedizin", route: "/telemedizin", color: "#059669" },
  { id: "dating", icon: Heart, labelKey: "shortcut.dating", route: "/dating", color: "#EC4899" },
  { id: "gebrauchtwagen", icon: CarFront, labelKey: "shortcut.used_cars", route: "/gebrauchtwagen", color: "#0891B2" },
  { id: "reinigung", icon: Sparkles, labelKey: "shortcut.cleaning", route: "/reinigung", color: "#8B5CF6" },
  { id: "umzug", icon: Truck, labelKey: "shortcut.moving", route: "/umzug", color: "#EA580C" },
  { id: "tierbetreuung", icon: Dog, labelKey: "shortcut.pets", route: "/tierbetreuung", color: "#F59E0B" },
  { id: "fitness", icon: Dumbbell, labelKey: "shortcut.fitness", route: "/fitness", color: "#EF4444" },
  { id: "reiseplaner", icon: Palmtree, labelKey: "shortcut.travel", route: "/reiseplaner", color: "#0D9488" },
  { id: "ladesaeulen", icon: BatteryCharging, labelKey: "shortcut.charging", route: "/ladesaeulen", color: "#10B981" },
  { id: "stocks", icon: TrendingUp, labelKey: "shortcut.stocks", route: "/stocks", color: "#10B981" },
  { id: "reselling", icon: ShoppingBag, labelKey: "shortcut.reselling", route: "/reselling", color: "#F43F5E" },
  { id: "blitzjobs", icon: Briefcase, labelKey: "shortcut.blitzjobs", route: "/blitzjobs", color: "#22C55E" },
  { id: "cashback", icon: Star, labelKey: "shortcut.cashback", route: "/cashback", color: "#F59E0B" },
  { id: "live-auctions", icon: Zap, labelKey: "shortcut.live_auctions", route: "/live-auctions", color: "#EF4444" },
  { id: "stories", icon: MessageCircle, labelKey: "shortcut.feed", route: "/stories", color: "#6366F1" },
  { id: "blitz-boost", icon: TrendingUp, labelKey: "shortcut.blitzboost", route: "/blitz-boost", color: "#E1306C" },
  { id: "blitz-transfer", icon: Package, labelKey: "shortcut.blitztransfer", route: "/blitz-transfer", color: "#00B2FF" },
  { id: "blitz-mine", icon: Zap, labelKey: "shortcut.blitzmine", route: "/blitz-mine", color: "#FFD700" },
]);

const DEFAULT_SHORTCUTS = ["taxi", "scooter", "hotels", "restaurants"];

const QuickAccessBar = ({ onNavigate }) => {
  const { t } = useI18n();
  const [shortcuts, setShortcuts] = useState([]);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/user/quick-access`, { credentials: "include" });
        if (!mounted) return;
        if (res.ok) {
          const d = await res.json();
          if (!mounted) return;
          setShortcuts(d.shortcuts?.length > 0 ? d.shortcuts : DEFAULT_SHORTCUTS);
        } else {
          setShortcuts(DEFAULT_SHORTCUTS);
        }
      } catch (_err) {
        if (!mounted) return;
        setShortcuts(DEFAULT_SHORTCUTS);
      }
      if (mounted) setLoaded(true);
    };
    load();
    return () => { mounted = false; };
  }, []);

  const save = async (newShortcuts) => {
    try {
      await fetch(`${API}/api/user/quick-access`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortcuts: newShortcuts }),
      });
    } catch (_err) { return; }
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
    setShortcuts(selected);
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
            <h3 className="text-[13px] font-semibold font-outfit text-white">{t("more.quick_access")}</h3>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={startEdit}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/18"
            data-testid="quick-access-edit"
          >
            <Pencil size={10} /> {t("common.edit")}
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
              <span className="text-[9px] text-white/72 font-medium text-center leading-tight truncate w-full">
                {t(s.labelKey)}
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
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-white/[0.06] border border-dashed border-white/16">
              <Plus size={16} className="text-white/60" />
            </div>
            <span className="text-[9px] text-white/60 font-medium">{t("nav.more")}</span>
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
            className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setEditing(false)}
            data-testid="quick-access-modal"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#171b22] rounded-t-3xl border-t border-white/12 max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-4 pb-3 flex items-center justify-between border-b border-white/8 flex-shrink-0">
                <div>
                  <h3 className="text-[14px] font-bold text-white">{t("quick_access.edit_title")}</h3>
                  <p className="text-[10px] text-white/55">{t("quick_access.selected_count", { count: selected.length })}</p>
                </div>
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditing(false)}
                    className="p-2 rounded-xl bg-white/8 border border-white/10">
                    <X size={16} className="text-white/65" />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={confirmEdit}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#F59E0B] text-black text-xs font-bold"
                    data-testid="quick-access-save">
                    <Check size={14} /> {t("common.save")}
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
                            : "border-white/8 bg-white/[0.05] hover:border-white/14"
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
                          {t(s.labelKey)}
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
