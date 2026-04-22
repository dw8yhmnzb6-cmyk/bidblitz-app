import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../services/api";

const FeatureFlagContext = createContext(null);

export function FeatureFlagProvider({ children }) {
  const [flags, setFlags] = useState({});
  const [loaded, setLoaded] = useState(false);

  const loadFlags = useCallback(async () => {
    try {
      const data = await api.getFeatureFlags();
      setFlags(data.flags || {});
    } catch {
      // Fallback: all enabled
      setFlags({});
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { loadFlags(); }, [loadFlags]);

  const isEnabled = useCallback((flagName, userRole = "user") => {
    const flag = flags[flagName];
    if (!flag) return true; // Unknown flags default to enabled
    if (!flag.enabled) return false;
    const access = flag.access || "all";
    if (access === "all") return true;
    if (access === "admin" && userRole === "admin") return true;
    if (access === "merchant" && (userRole === "merchant" || userRole === "admin")) return true;
    if (access === "beta" && (userRole === "admin" || userRole === "beta")) return true;
    return false;
  }, [flags]);

  const refreshFlags = loadFlags;

  return (
    <FeatureFlagContext.Provider value={React.useMemo(() => ({ flags, isEnabled, loaded, refreshFlags }), [flags, isEnabled, loaded, refreshFlags])}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  const ctx = useContext(FeatureFlagContext);
  if (!ctx) throw new Error("useFeatureFlags must be used within FeatureFlagProvider");
  return ctx;
}
