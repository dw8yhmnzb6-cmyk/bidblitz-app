import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";

const FeatureFlagContext = createContext(null);

function resolveRole(user) {
  if (!user) return "public";
  return user.role || "user";
}

function resolveCountry(user) {
  return (user?.country || "ALL").toUpperCase();
}

function resolvePlatform() {
  const ua = (navigator?.userAgent || "").toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad")) return "ios";
  if (ua.includes("android")) return "android";
  return "web";
}

export function FeatureFlagProvider({ children }) {
  const [features, setFeatures] = useState([]);
  const [navigation, setNavigation] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const loadFlags = useCallback(async () => {
    try {
      const platform = resolvePlatform();
      const publicData = await api.getPublicFeatures(`platform=${platform}`);
      const navData = await api.getFeatureNavigation(`platform=${platform}`);
      setFeatures(publicData.features || []);
      setNavigation(navData.items || []);
    } catch {
      setFeatures([]);
      setNavigation([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const featuresMap = useMemo(() => {
    const map = new Map();
    for (const feature of features) map.set(feature.key, feature);
    return map;
  }, [features]);

  const evaluate = useCallback((featureKey, user, options = {}) => {
    const flag = featuresMap.get(featureKey);
    if (!flag) return true;
    const role = resolveRole(user);
    const country = (options.country || resolveCountry(user)).toUpperCase();
    const platform = (options.platform || resolvePlatform()).toLowerCase();
    const status = String(flag.status || "enabled").toLowerCase();
    const roles = flag.roles || [];
    const platforms = (flag.platforms || []).map((value) => String(value).toLowerCase());
    const countries = (flag.countries || ["ALL"]).map((value) => String(value).toUpperCase());
    const excludedCountries = (flag.excluded_countries || []).map((value) => String(value).toUpperCase());

    if (flag.enabled === false || status === "disabled" || status === "maintenance") return false;
    if (status === "internal" && !["admin", "manager"].includes(role)) return false;
    if (status === "beta" && !["admin", "beta_tester", "merchant", "manager"].includes(role)) return false;
    if (platforms.length && !platforms.includes(platform)) return false;
    if (roles.length && !roles.includes(role) && !roles.includes("all")) return false;
    if (excludedCountries.includes(country)) return false;
    if (!countries.includes("ALL") && !countries.includes(country)) return false;
    if (options.route === true && flag.allow_direct_route === false) return false;
    if (options.api === true && flag.allow_api === false) return false;
    if (flag.scheduled_start && new Date(flag.scheduled_start).getTime() > Date.now()) return false;
    if (flag.scheduled_end && new Date(flag.scheduled_end).getTime() < Date.now()) return false;
    return true;
  }, [featuresMap]);

  const isEnabled = useCallback((featureKey, user, options = {}) => evaluate(featureKey, user, options), [evaluate]);
  const canAccessRoute = useCallback((featureKey, user, options = {}) => evaluate(featureKey, user, { ...options, route: true }), [evaluate]);
  const canAccessApi = useCallback((featureKey, user, options = {}) => evaluate(featureKey, user, { ...options, api: true }), [evaluate]);

  const getVisibleNavigation = useCallback((user, options = {}) => {
    return navigation.filter((item) => isEnabled(item.key, user, options));
  }, [isEnabled, navigation]);

  const getVisibleModules = useCallback((user, options = {}) => {
    return features.filter((item) => item.type === "module" && isEnabled(item.key, user, options));
  }, [features, isEnabled]);

  const getVisibleProducts = useCallback((user, options = {}) => {
    return features.filter((item) => item.type === "product" && isEnabled(item.key, user, options));
  }, [features, isEnabled]);

  return (
    <FeatureFlagContext.Provider
      value={useMemo(() => ({
        features,
        navigation,
        loaded,
        isEnabled,
        canAccessRoute,
        canAccessApi,
        getVisibleNavigation,
        getVisibleModules,
        getVisibleProducts,
        refreshFlags: loadFlags,
      }), [features, navigation, loaded, isEnabled, canAccessRoute, canAccessApi, getVisibleNavigation, getVisibleModules, getVisibleProducts, loadFlags])}
    >
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  const ctx = useContext(FeatureFlagContext);
  if (!ctx) throw new Error("useFeatureFlags must be used within FeatureFlagProvider");
  return ctx;
}