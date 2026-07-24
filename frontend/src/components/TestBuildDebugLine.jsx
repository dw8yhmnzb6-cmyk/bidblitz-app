import { useEffect, useMemo, useState } from "react";
import { useUser } from "../store";
import { getNativePlatform, isNativeApp } from "../services/capacitorBridge";
import { KYC_REQUIRED, SHOW_KYC_GATE, TEST_MODE_FULL_ACCESS } from "../config/testMode";

const fallbackBuild = {
  build_id: process.env.REACT_APP_BUILD_ID || "unknown",
  git_commit: process.env.REACT_APP_GIT_COMMIT || "unknown",
  environment: process.env.NODE_ENV || "unknown",
};

const getAssetSource = () => {
  if (typeof window === "undefined") return "unknown";
  const href = String(window.location.href || "").toLowerCase();
  const host = String(window.location.hostname || "").toLowerCase();
  if (isNativeApp()) {
    if (href.startsWith("capacitor://localhost") || host === "localhost") return "local";
    return "remote";
  }
  if (host.includes("bidblitz.ae") || host.includes("preview.emergentagent.com")) return "remote";
  return "local";
};

export const TestBuildDebugLine = () => {
  const user = useUser();
  const [buildInfo, setBuildInfo] = useState(fallbackBuild);
  const assetSource = useMemo(() => getAssetSource(), []);
  const platform = useMemo(() => getNativePlatform(), []);

  useEffect(() => {
    let active = true;
    fetch("/version.json", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setBuildInfo({
          build_id: data.build_id || fallbackBuild.build_id,
          git_commit: data.git_commit || fallbackBuild.git_commit,
          environment: data.environment || fallbackBuild.environment,
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!user?.isAuthenticated || user?.role !== "admin") return null;

  return (
    <div
      data-testid="test-build-debug-line"
      className="mx-auto mt-2 w-full max-w-6xl px-4"
    >
      <div className="rounded-2xl border border-[#FFD166]/25 bg-[#120f07]/90 px-3 py-2 text-[10px] font-semibold text-[#F8E7B0] shadow-[0_12px_30px_rgba(0,0,0,0.2)] backdrop-blur">
        <span data-testid="debug-build-id">build={buildInfo.build_id || "unknown"}</span>
        <span className="mx-2 text-white/30">•</span>
        <span data-testid="debug-commit-hash">commit={(buildInfo.git_commit || "unknown").slice(0, 12)}</span>
        <span className="mx-2 text-white/30">•</span>
        <span data-testid="debug-environment">env={buildInfo.environment || "unknown"}</span>
        <span className="mx-2 text-white/30">•</span>
        <span data-testid="debug-kyc-required">KYC_REQUIRED={String(KYC_REQUIRED)}</span>
        <span className="mx-2 text-white/30">•</span>
        <span data-testid="debug-show-kyc-gate">SHOW_KYC_GATE={String(SHOW_KYC_GATE)}</span>
        <span className="mx-2 text-white/30">•</span>
        <span data-testid="debug-test-mode-full-access">TEST_MODE_FULL_ACCESS={String(TEST_MODE_FULL_ACCESS)}</span>
        <span className="mx-2 text-white/30">•</span>
        <span data-testid="debug-asset-source">asset={assetSource}</span>
        <span className="mx-2 text-white/30">•</span>
        <span data-testid="debug-platform">platform={platform}</span>
      </div>
    </div>
  );
};

export default TestBuildDebugLine;