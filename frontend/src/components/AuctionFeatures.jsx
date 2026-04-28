import { useState, useEffect } from "react";
import { Bell, BellOff, Heart } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

async function apiCall(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

export function WatchlistButton({ auctionId, size = "md" }) {
  const [watching, setWatching] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkWatchlist();
  }, [auctionId]);

  const checkWatchlist = async () => {
    try {
      const data = await apiCall("/api/auctions/watchlist");
      const isWatching = data.watchlist.some((w) => w.auction_id === auctionId);
      setWatching(isWatching);
    } catch (e) {
      console.error("Watchlist check failed:", e);
    }
  };

  const toggleWatchlist = async () => {
    setLoading(true);
    try {
      if (watching) {
        await apiCall("/api/auctions/watchlist/remove", {
          method: "DELETE",
          body: { auction_id: auctionId },
        });
        toast.success("Von Watchlist entfernt");
        setWatching(false);
      } else {
        await apiCall("/api/auctions/watchlist/add", {
          method: "POST",
          body: { auction_id: auctionId },
        });
        toast.success("Zur Watchlist hinzugefügt");
        setWatching(true);
      }
    } catch (e) {
      toast.error(e.message);
    }
    setLoading(false);
  };

  const iconSize = size === "sm" ? 14 : size === "lg" ? 20 : 16;
  const btnClass = size === "sm" 
    ? "p-1.5 text-xs" 
    : size === "lg" 
    ? "p-3 text-base" 
    : "p-2 text-sm";

  return (
    <button
      onClick={toggleWatchlist}
      disabled={loading}
      className={`${btnClass} rounded-xl transition-all ${
        watching
          ? "bg-[#FF4060]/15 border border-[#FF4060]/30 text-[#FF4060]"
          : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
      }`}
      title={watching ? "Von Watchlist entfernen" : "Zur Watchlist hinzufügen"}
    >
      <Heart size={iconSize} fill={watching ? "#FF4060" : "none"} />
    </button>
  );
}

export function NotificationPreferencesPanel() {
  const [prefs, setPrefs] = useState({
    outbid: true,
    won: true,
    ending_soon: true,
    price_drop: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const data = await apiCall("/api/auctions/notifications/preferences");
      setPrefs(data.preferences);
    } catch (e) {
      console.error("Failed to load preferences:", e);
    }
  };

  const savePreferences = async (newPrefs) => {
    setLoading(true);
    try {
      await apiCall("/api/auctions/notifications/preferences", {
        method: "POST",
        body: newPrefs,
      });
      toast.success("Einstellungen gespeichert");
      setPrefs(newPrefs);
    } catch (e) {
      toast.error(e.message);
    }
    setLoading(false);
  };

  const togglePref = (key) => {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    savePreferences(newPrefs);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
        <Bell size={16} />
        Benachrichtigungen
      </h3>
      <div className="space-y-2">
        <PreferenceToggle
          label="Überboten"
          description="Wenn jemand dein Gebot überbietet"
          enabled={prefs.outbid}
          onToggle={() => togglePref("outbid")}
          disabled={loading}
        />
        <PreferenceToggle
          label="Gewonnen"
          description="Wenn du eine Auktion gewinnst"
          enabled={prefs.won}
          onToggle={() => togglePref("won")}
          disabled={loading}
        />
        <PreferenceToggle
          label="Endet bald"
          description="5 Minuten vor Ende"
          enabled={prefs.ending_soon}
          onToggle={() => togglePref("ending_soon")}
          disabled={loading}
        />
        <PreferenceToggle
          label="Preis-Alarm"
          description="Bei deutlichem Preisrückgang"
          enabled={prefs.price_drop}
          onToggle={() => togglePref("price_drop")}
          disabled={loading}
        />
      </div>
    </div>
  );
}

function PreferenceToggle({ label, description, enabled, onToggle, disabled }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
    >
      <div className="flex-1 text-left">
        <p className="text-xs font-bold text-white/90">{label}</p>
        <p className="text-[10px] text-white/40">{description}</p>
      </div>
      <div
        className={`w-10 h-5 rounded-full transition-all ${
          enabled ? "bg-[#00E89D]" : "bg-white/20"
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white transition-all ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          } mt-0.5`}
        />
      </div>
    </button>
  );
}

export function AuctionFilters({ onFilter }) {
  const [filters, setFilters] = useState({
    category: "",
    min_price: "",
    max_price: "",
    status: "active",
    sort_by: "ending_soon",
  });

  const categories = [
    { value: "", label: "Alle Kategorien" },
    { value: "electronics", label: "Elektronik" },
    { value: "fashion", label: "Mode" },
    { value: "home", label: "Haushalt" },
    { value: "sports", label: "Sport" },
    { value: "toys", label: "Spielzeug" },
    { value: "books", label: "Bücher" },
  ];

  const sortOptions = [
    { value: "ending_soon", label: "Endet bald" },
    { value: "newest", label: "Neueste" },
    { value: "price_low", label: "Preis: Niedrig → Hoch" },
    { value: "price_high", label: "Preis: Hoch → Niedrig" },
    { value: "popular", label: "Beliebteste" },
  ];

  const applyFilters = async () => {
    try {
      const cleanFilters = { ...filters };
      if (!cleanFilters.category) delete cleanFilters.category;
      if (!cleanFilters.min_price) delete cleanFilters.min_price;
      if (!cleanFilters.max_price) delete cleanFilters.max_price;
      
      // Convert price strings to numbers
      if (cleanFilters.min_price) cleanFilters.min_price = parseFloat(cleanFilters.min_price);
      if (cleanFilters.max_price) cleanFilters.max_price = parseFloat(cleanFilters.max_price);

      const data = await apiCall("/api/auctions/filter", {
        method: "POST",
        body: cleanFilters,
      });
      onFilter(data.auctions);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const updateFilter = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
      <h3 className="text-sm font-bold">Filter</h3>
      
      <div>
        <label className="text-[10px] text-white/40 mb-1 block">Kategorie</label>
        <select
          value={filters.category}
          onChange={(e) => updateFilter("category", e.target.value)}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white"
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-white/40 mb-1 block">Min €</label>
          <input
            type="number"
            step="0.01"
            value={filters.min_price}
            onChange={(e) => updateFilter("min_price", e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/40 mb-1 block">Max €</label>
          <input
            type="number"
            step="0.01"
            value={filters.max_price}
            onChange={(e) => updateFilter("max_price", e.target.value)}
            placeholder="2000.00"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-white/40 mb-1 block">Sortierung</label>
        <select
          value={filters.sort_by}
          onChange={(e) => updateFilter("sort_by", e.target.value)}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white"
        >
          {sortOptions.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <button
        onClick={applyFilters}
        className="w-full py-2.5 rounded-xl bg-[#00C2FF] text-black text-xs font-bold hover:bg-[#00C2FF]/90 transition-all"
      >
        Filter anwenden
      </button>
    </div>
  );
}
