/**
 * BidBlitz V2 - Admin Panel (Full Layout)
 * - Toggleable between this list-style layout and AdminPage grid layout.
 * - Section data lives in /components/admin/sections.js
 * - Detail data fetchers live in /components/admin/dataLoaders.js
 * - Detail rendering lives in /components/admin/AdminDetailRouter.jsx
 */
import { useState, useEffect, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard, BarChart3, ArrowLeft, X, Menu, Loader2,
  Search, Settings, LayoutGrid,
} from "lucide-react";

import { ADMIN_SECTIONS } from "../components/admin/sections";
import AdminDetailRouter from "../components/admin/AdminDetailRouter";
import { loadAdminDetail, api } from "../components/admin/dataLoaders";

const AdminPageGrid = lazy(() => import("./AdminPage"));

const AdminPanelFullPage = ({ onNavigate, onBack }) => {
  const [menuOpen, setMenuOpen] = useState(true);
  const [activeItem, setActiveItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [layoutMode, setLayoutMode] = useState(
    () => localStorage.getItem("admin_layout_mode") || "full",
  );

  const toggleLayout = () => {
    const newMode = layoutMode === "full" ? "grid" : "full";
    setLayoutMode(newMode);
    localStorage.setItem("admin_layout_mode", newMode);
  };

  // Load overview stats
  useEffect(() => {
    (async () => {
      try {
        const d = await api("/api/admin/stats");
        setStats(d);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const handleItemClick = async (item) => {
    setMenuOpen(false);
    setActiveItem(item);
    setLoading(true);
    setData(null);
    setError(null);

    try {
      const result = await loadAdminDetail(item, onNavigate);
      if (result === null) {
        // Was a navigation, reset state
        setActiveItem(null);
        setMenuOpen(true);
      } else {
        setData(result);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const filteredSections = ADMIN_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter(
      (i) => !search || i.label.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((s) => s.items.length > 0);

  /* ─── Grid Layout Mode (delegates to AdminPage) ──────────────────────── */
  if (layoutMode === "grid") {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#10B981]" size={32} />
          </div>
        }
      >
        <AdminPageGrid onNavigate={onNavigate} onBack={onBack} layoutMode={layoutMode} onToggleLayout={toggleLayout} />
      </Suspense>
    );
  }

  /* ─── Full (List) Layout Mode ────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#F0F4FA] text-[#111]" data-testid="admin-panel-full">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between w-full">
          {/* LEFT - Back + Title */}
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBack || (() => onNavigate("/more"))}
              className="p-2 rounded-xl bg-gray-100"
              data-testid="admin-back"
            >
              <ArrowLeft size={18} className="text-gray-600" />
            </motion.button>
            <div className="flex items-center gap-2">
              <Settings size={20} className="text-[#A855F7]" />
              <h1 className="text-[16px] font-bold">Admin Panel</h1>
            </div>
          </div>

          {/* RIGHT - Toggle + Menu */}
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleLayout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-medium"
              data-testid="layout-toggle"
              title={layoutMode === "full" ? "Zu Grid-Layout wechseln" : "Zu Standard-Layout wechseln"}
            >
              {layoutMode === "full"
                ? <LayoutGrid size={14} className="text-[#10B981]" />
                : <LayoutDashboard size={14} className="text-[#3B82F6]" />}
              <span className="text-gray-700">{layoutMode === "full" ? "Grid" : "Liste"}</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { setMenuOpen(!menuOpen); setActiveItem(null); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-medium"
              data-testid="admin-menu-toggle"
            >
              {menuOpen ? <X size={14} /> : <Menu size={14} />} Menü
            </motion.button>
          </div>
        </div>

        {/* Search */}
        {menuOpen && (
          <div className="mt-3 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Admin-Funktionen suchen..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-100 border border-gray-200 text-xs outline-none"
              data-testid="admin-search"
            />
          </div>
        )}
      </div>

      {/* Overview Stats */}
      {menuOpen && !activeItem && stats && (
        <div className="px-4 pt-3">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center gap-2">
              <LayoutDashboard size={16} className="text-[#A855F7]" />
              <span className="text-[11px] font-semibold text-gray-700">Übersicht</span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center gap-2">
              <BarChart3 size={16} className="text-[#3B82F6]" />
              <span className="text-[11px] font-semibold text-gray-700">Analytics</span>
            </div>
          </div>
        </div>
      )}

      {/* Grid Menu */}
      {menuOpen && !activeItem && (
        <div className="px-4 pb-24 space-y-4">
          {filteredSections.map((section, si) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: si * 0.05 }}
            >
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="h-[3px] flex-1 rounded-full" style={{ background: `${section.color}20` }} />
                <span className="text-[12px] font-bold" style={{ color: section.color }}>
                  {section.title}
                </span>
                <span className="text-[10px] text-gray-400">({section.items.length})</span>
                <div className="h-[3px] flex-1 rounded-full" style={{ background: `${section.color}20` }} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.key}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => handleItemClick(item)}
                      className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex flex-col items-center gap-1.5 hover:border-gray-300 hover:shadow-md transition-all min-h-[80px] justify-center"
                      data-testid={`admin-item-${item.key}`}
                    >
                      <Icon size={20} className="text-gray-500" />
                      <span className="text-[9px] font-medium text-gray-700 text-center leading-tight">{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail View */}
      {!menuOpen && activeItem && (
        <div className="p-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { setMenuOpen(true); setActiveItem(null); }}
            className="flex items-center gap-2 text-xs text-[#A855F7] font-medium mb-4"
            data-testid="admin-detail-back"
          >
            <ArrowLeft size={14} /> Zurück zum Menü
          </motion.button>

          <h2 className="text-lg font-bold mb-4">{activeItem.label}</h2>

          <AdminDetailRouter
            data={data}
            setData={setData}
            loading={loading}
            error={error}
            onNavigate={onNavigate}
          />
        </div>
      )}
    </div>
  );
};

export default AdminPanelFullPage;
