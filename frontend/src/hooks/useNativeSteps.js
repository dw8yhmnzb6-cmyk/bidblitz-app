import { useCallback, useEffect, useMemo, useState } from "react";
import { getNativePlatform, isNativeApp, loadNativeHealthBridge } from "@/services/capacitorBridge";

const HEALTH_READ_SCOPE = ["steps", "distance"];

const startOfLocalDay = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const sumSamples = (samples = []) => {
  return samples.reduce((total, sample) => total + Number(sample?.value || 0), 0);
};

export function useNativeSteps({ enabled = true } = {}) {
  const [state, setState] = useState({
    loading: false,
    syncing: false,
    available: false,
    authorized: false,
    source: isNativeApp() ? "native_health" : "web_preview",
    platform: getNativePlatform(),
    totalSteps: 0,
    totalDistanceMeters: 0,
    sampleCount: 0,
    permissionMessage: isNativeApp() ? "Native Schritte noch nicht freigegeben" : "Web-Vorschau nutzt keinen nativen Schrittzähler",
    reason: isNativeApp() ? "not_checked" : "web_only",
    historyAccessAuthorized: false,
    historyAccessAvailable: false,
    lastSyncAt: null,
    usedFallback: !isNativeApp(),
  });

  const readToday = useCallback(async () => {
    if (!enabled) return null;
    if (!isNativeApp()) {
      const webState = {
        loading: false,
        syncing: false,
        available: false,
        authorized: false,
        source: "web_preview",
        platform: "web",
        totalSteps: 0,
        totalDistanceMeters: 0,
        sampleCount: 0,
        permissionMessage: "Web-Vorschau nutzt keinen nativen Schrittzähler",
        reason: "web_only",
        historyAccessAuthorized: false,
        historyAccessAvailable: false,
        lastSyncAt: new Date().toISOString(),
        usedFallback: true,
      };
      setState((prev) => ({ ...prev, ...webState }));
      return webState;
    }

    setState((prev) => ({ ...prev, loading: true }));

    try {
      const Health = await loadNativeHealthBridge();
      if (!Health) {
        const unsupported = {
          available: false,
          authorized: false,
          source: "native_health",
          platform: getNativePlatform(),
          totalSteps: 0,
          totalDistanceMeters: 0,
          sampleCount: 0,
          permissionMessage: "Native Health-Bridge konnte nicht geladen werden",
          reason: "bridge_missing",
          historyAccessAuthorized: false,
          historyAccessAvailable: false,
          lastSyncAt: new Date().toISOString(),
          usedFallback: true,
        };
        setState((prev) => ({ ...prev, loading: false, ...unsupported }));
        return unsupported;
      }

      const availability = await Health.isAvailable();
      if (!availability?.available) {
        const unavailable = {
          available: false,
          authorized: false,
          source: "native_health",
          platform: availability?.platform || getNativePlatform(),
          totalSteps: 0,
          totalDistanceMeters: 0,
          sampleCount: 0,
          permissionMessage: availability?.reason || "HealthKit / Health Connect ist auf diesem Gerät nicht verfügbar",
          reason: availability?.reason || "unavailable",
          historyAccessAuthorized: false,
          historyAccessAvailable: false,
          lastSyncAt: new Date().toISOString(),
          usedFallback: true,
        };
        setState((prev) => ({ ...prev, loading: false, ...unavailable }));
        return unavailable;
      }

      const auth = await Health.checkAuthorization({
        read: HEALTH_READ_SCOPE,
        write: [],
        requestHistoryAccess: true,
      });

      const readAuthorized = Array.isArray(auth?.readAuthorized) ? auth.readAuthorized : [];
      const authorized = readAuthorized.includes("steps");

      if (!authorized) {
        const permissionState = {
          available: true,
          authorized: false,
          source: "native_health",
          platform: availability?.platform || getNativePlatform(),
          totalSteps: 0,
          totalDistanceMeters: 0,
          sampleCount: 0,
          permissionMessage: "Schrittzugriff noch nicht freigegeben",
          reason: "permission_required",
          historyAccessAuthorized: Boolean(auth?.historyAccessAuthorized),
          historyAccessAvailable: Boolean(auth?.historyAccessAvailable),
          lastSyncAt: new Date().toISOString(),
          usedFallback: false,
        };
        setState((prev) => ({ ...prev, loading: false, ...permissionState }));
        return permissionState;
      }

      const startDate = startOfLocalDay().toISOString();
      const endDate = new Date().toISOString();
      const [{ samples: stepSamples = [] }, { samples: distanceSamples = [] }] = await Promise.all([
        Health.readSamples({ dataType: "steps", startDate, endDate, limit: 1000, ascending: true }),
        Health.readSamples({ dataType: "distance", startDate, endDate, limit: 1000, ascending: true }).catch(() => ({ samples: [] })),
      ]);

      const nextState = {
        available: true,
        authorized: true,
        source: availability?.platform === "ios" ? "healthkit" : "health_connect",
        platform: availability?.platform || getNativePlatform(),
        totalSteps: Math.max(0, Math.round(sumSamples(stepSamples))),
        totalDistanceMeters: Math.max(0, Number(sumSamples(distanceSamples).toFixed(2))),
        sampleCount: stepSamples.length,
        permissionMessage: availability?.platform === "ios" ? "HealthKit verbunden" : "Health Connect verbunden",
        reason: "ok",
        historyAccessAuthorized: Boolean(auth?.historyAccessAuthorized),
        historyAccessAvailable: Boolean(auth?.historyAccessAvailable),
        lastSyncAt: new Date().toISOString(),
        usedFallback: false,
      };
      setState((prev) => ({ ...prev, loading: false, ...nextState }));
      return nextState;
    } catch (error) {
      const failed = {
        available: true,
        authorized: false,
        source: "native_health",
        platform: getNativePlatform(),
        totalSteps: 0,
        totalDistanceMeters: 0,
        sampleCount: 0,
        permissionMessage: error?.message || "Native Schritte konnten nicht gelesen werden",
        reason: "read_failed",
        historyAccessAuthorized: false,
        historyAccessAvailable: false,
        lastSyncAt: new Date().toISOString(),
        usedFallback: true,
      };
      setState((prev) => ({ ...prev, loading: false, ...failed }));
      return failed;
    }
  }, [enabled]);

  const requestPermissions = useCallback(async () => {
    if (!isNativeApp()) {
      return { ok: false, reason: "web_only", message: "In der Web-Vorschau gibt es keine nativen Health-Berechtigungen" };
    }
    setState((prev) => ({ ...prev, syncing: true }));
    try {
      const Health = await loadNativeHealthBridge();
      if (!Health) {
        throw new Error("Health-Bridge fehlt");
      }
      const result = await Health.requestAuthorization({
        read: HEALTH_READ_SCOPE,
        write: [],
        requestHistoryAccess: true,
      });
      const readAuthorized = Array.isArray(result?.readAuthorized) ? result.readAuthorized : [];
      const ok = readAuthorized.includes("steps");
      await readToday();
      return {
        ok,
        reason: ok ? "granted" : "denied",
        message: ok ? "Schrittzugriff freigegeben" : "Schrittzugriff wurde nicht freigegeben",
        status: result,
      };
    } catch (error) {
      setState((prev) => ({ ...prev, syncing: false, permissionMessage: error?.message || "Berechtigung fehlgeschlagen", reason: "permission_failed" }));
      return { ok: false, reason: "permission_failed", message: error?.message || "Berechtigung fehlgeschlagen" };
    } finally {
      setState((prev) => ({ ...prev, syncing: false }));
    }
  }, [readToday]);

  const openSettings = useCallback(async () => {
    if (!isNativeApp()) {
      return false;
    }
    try {
      const Health = await loadNativeHealthBridge();
      if (!Health) return false;
      if (getNativePlatform() === "android") {
        await Health.openHealthConnectSettings();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const openPrivacyPolicy = useCallback(async () => {
    if (!isNativeApp()) {
      return false;
    }
    try {
      const Health = await loadNativeHealthBridge();
      if (!Health) return false;
      if (getNativePlatform() === "android") {
        await Health.showPrivacyPolicy();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      readToday();
    }
  }, [enabled, readToday]);

  return useMemo(() => ({
    ...state,
    isNative: isNativeApp(),
    readToday,
    requestPermissions,
    openSettings,
    openPrivacyPolicy,
  }), [state, readToday, requestPermissions, openSettings, openPrivacyPolicy]);
}