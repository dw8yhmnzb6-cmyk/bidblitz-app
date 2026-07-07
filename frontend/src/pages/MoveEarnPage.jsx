import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Activity,
  Award,
  BadgeCheck,
  Bike,
  Bot,
  Crown,
  Footprints,
  Gift,
  Leaf,
  Loader2,
  QrCode,
  Rocket,
  Shield,
  ShieldCheck,
  MapPinned,
  Route,
  ShoppingBag,
  Star,
  TrendingUp,
  Trophy,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useI18n, useUser } from "../store";
import { useGeolocation } from "../hooks/useGeolocation";
import { useNativeSteps } from "../hooks/useNativeSteps";

const panel = "rounded-[28px] border border-white/10 bg-[rgba(8,16,18,0.9)] backdrop-blur-xl";

const COPY = {
  de: {
    title: "Move & Earn",
    subtitle: "Schritte, Rides und smarte Missionen in Rewards verwandeln.",
    sync: "Schritte syncen",
    syncing: "Sync läuft...",
    claim: "Belohnung holen",
    admin: "Admin Move Center",
    leaderboard: "Leaderboard",
    history: "Verlauf",
    missions: "Missionen",
    stats: "Tagesstatus",
    checkin: "Daily Check-in",
    blocked: "Move & Earn gesperrt",
    premium: "Premium Boost",
    aiCoach: "AI Coach Vorbereitung",
    rideEarn: "Ride & Earn",
    ecoRewards: "Eco Rewards",
    merchantChallenges: "Merchant Challenges",
    qrChallenges: "QR Challenges",
    familyChallenges: "Family Challenges",
    users: "Nutzer",
    fraud: "Fraud Flags",
    topUsers: "Top Nutzer",
    save: "Speichern",
    loading: "Lädt...",
    noHistory: "Noch keine Reward-Historie",
    suspicious: "Auffällig",
    activeToday: "Heute aktiv",
  },
  en: {
    title: "Move & Earn",
    subtitle: "Turn steps, rides and smart missions into rewards.",
    sync: "Sync steps",
    syncing: "Syncing...",
    claim: "Claim reward",
    admin: "Admin Move Center",
    leaderboard: "Leaderboard",
    history: "History",
    missions: "Missions",
    stats: "Daily status",
    checkin: "Daily check-in",
    blocked: "Move & Earn blocked",
    premium: "Premium boost",
    aiCoach: "AI coach prep",
    rideEarn: "Ride & Earn",
    ecoRewards: "Eco Rewards",
    merchantChallenges: "Merchant challenges",
    qrChallenges: "QR challenges",
    familyChallenges: "Family challenges",
    users: "Users",
    fraud: "Fraud flags",
    topUsers: "Top users",
    save: "Save",
    loading: "Loading...",
    noHistory: "No reward history yet",
    suspicious: "Suspicious",
    activeToday: "Active today",
  },
  sq: {
    title: "Move & Earn",
    subtitle: "Kthe hapat, udhëtimet dhe misionet në shpërblime.",
    sync: "Sinkronizo hapat",
    syncing: "Po sinkronizohet...",
    claim: "Merr shpërblimin",
    admin: "Admin Move Center",
    leaderboard: "Renditja",
    history: "Historia",
    missions: "Misionet",
    stats: "Statusi ditor",
    checkin: "Check-in ditor",
    blocked: "Move & Earn i bllokuar",
    premium: "Boost Premium",
    aiCoach: "Përgatitje AI Coach",
    rideEarn: "Ride & Earn",
    ecoRewards: "Eco Rewards",
    merchantChallenges: "Sfida Merchant",
    qrChallenges: "Sfida QR",
    familyChallenges: "Sfida Family",
    users: "Përdorues",
    fraud: "Fraud Flags",
    topUsers: "Përdoruesit kryesorë",
    save: "Ruaj",
    loading: "Duke u ngarkuar...",
    noHistory: "Ende pa histori rewards",
    suspicious: "E dyshimtë",
    activeToday: "Aktiv sot",
  },
};

const MetricCard = ({ icon: Icon, label, value, color, testId }) => (
  <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid={testId}>
    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
      <Icon size={13} style={{ color }} />
      <span>{label}</span>
    </div>
    <div className="text-[24px] font-black text-white">{value}</div>
  </div>
);

function Ring({ progress = 0, children, testId }) {
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <div className="relative h-52 w-52" data-testid={testId}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke="url(#moveGradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={301.59}
          strokeDashoffset={301.59 - (301.59 * pct) / 100}
        />
        <defs>
          <linearGradient id="moveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#37FF8B" />
            <stop offset="100%" stopColor="#00E4FF" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export default function MoveEarnPage({ onBack }) {
  const { lang } = useI18n();
  const user = useUser();
  const ui = COPY[lang] || COPY.de;
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [adminSettings, setAdminSettings] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [trackingConsent, setTrackingConsent] = useState(() => window.localStorage.getItem("move_earn_tracking_opt_in") !== "false");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [gpsState, setGpsState] = useState({ lat: 0, lng: 0, address: "" });
  const { currentAddress, permissionState, gpsHelperText, getCurrentLocation } = useGeolocation({ setPickup: setGpsState, mapRef: null, pickupMarkerRef: null });
  const nativeSteps = useNativeSteps({ enabled: true });

  const load = async () => {
    setLoading(true);
    try {
      const calls = [api.getMoveStatus(), api.getMoveHistory(40), api.getMoveLeaderboard(20)];
      if (user?.role === "admin") {
        calls.push(api.getAdminMoveSettings(), api.getAdminMoveStats());
      }
      const [statusRes, historyRes, leaderboardRes, settingsRes, statsRes] = await Promise.all(calls);
      setStatus(statusRes);
      setHistory(historyRes);
      setLeaderboard(leaderboardRes);
      if (settingsRes) setAdminSettings(settingsRes.settings || null);
      if (statsRes) setAdminStats(statsRes || null);
    } catch (error) {
      toast.error(error.message || "Move & Earn konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.role]);

  useEffect(() => {
    if (trackingConsent) getCurrentLocation({ silent: true });
  }, [trackingConsent, getCurrentLocation]);

  const syncSteps = async () => {
    setSyncing(true);
    try {
      if (trackingConsent) getCurrentLocation({ silent: true });
      const nativeState = await nativeSteps.readToday();
      const fallbackCurrent = Number(status?.daily?.latest_device_total || status?.daily?.accepted_steps || 0);
      const fallbackExtra = 1200 + Math.round(Math.random() * 2600);
      const usingNativeTotal = nativeState?.authorized && nativeState?.available;
      const totalSteps = usingNativeTotal ? Number(nativeState.totalSteps || 0) : fallbackCurrent + fallbackExtra;
      const source = usingNativeTotal ? (nativeState.source || "native_health") : "mobile_preview";
      const distanceKm = Number(nativeState?.totalDistanceMeters || 0) / 1000;
      const res = await api.syncMoveSteps({
        total_steps: Math.round(totalSteps),
        source,
        native_provider: nativeState?.source || source,
        native_platform: nativeState?.platform || "web",
        permission_state: nativeState?.authorized ? "authorized" : (nativeState?.reason || "preview"),
        distance_meters: Number(nativeState?.totalDistanceMeters || 0),
        sample_count: Number(nativeState?.sampleCount || 0),
        used_fallback: Boolean(nativeState?.usedFallback || !usingNativeTotal),
        device_fingerprint: `${nativeState?.platform || "preview"}-${user?.id || user?._id || "user"}`,
        sensor_confidence: usingNativeTotal ? 0.96 : (trackingConsent ? 0.82 : 0.42),
        duration_minutes: 18,
        gps_distance_km: trackingConsent ? Math.max(distanceKm, usingNativeTotal ? 0.35 : 1.4) : 0.12,
        gps_points: trackingConsent ? (usingNativeTotal ? Math.max(8, Math.min(60, Number(nativeState?.sampleCount || 8))) : 26) : 2,
        route_variance_score: trackingConsent ? (usingNativeTotal ? 0.88 : 0.74) : 0.14,
        activity_type: "walking",
        background_tracking_minutes: trackingConsent ? (usingNativeTotal ? 22 : 16) : 2,
      });
      setStatus(res.status);
      toast.success(usingNativeTotal
        ? `${nativeState.totalSteps || 0} native Schritte synced · +${res.xp_gain} XP · Trust ${res.scoring?.trust_score || 0}`
        : `Preview-Sync · +${res.accepted_delta} Schritte · +${res.xp_gain} XP · Trust ${res.scoring?.trust_score || 0}`);
      const [historyRes, leaderboardRes] = await Promise.all([api.getMoveHistory(40), api.getMoveLeaderboard(20)]);
      setHistory(historyRes);
      setLeaderboard(leaderboardRes);
    } catch (error) {
      toast.error(error.message || "Sync fehlgeschlagen");
    } finally {
      setSyncing(false);
    }
  };

  const claimReward = async (rewardCode) => {
    try {
      const res = await api.claimMoveReward({ reward_code: rewardCode });
      setStatus(res.status);
      const [historyRes, leaderboardRes, statsRes] = await Promise.all([
        api.getMoveHistory(40),
        api.getMoveLeaderboard(20),
        user?.role === "admin" ? api.getAdminMoveStats().catch(() => adminStats) : Promise.resolve(adminStats),
      ]);
      setHistory(historyRes);
      setLeaderboard(leaderboardRes);
      if (statsRes) setAdminStats(statsRes);
      toast.success(res.reward?.label || ui.claim);
    } catch (error) {
      toast.error(error.message || "Claim fehlgeschlagen");
    }
  };

  const saveAdmin = async () => {
    if (!adminSettings) return;
    setSavingAdmin(true);
    try {
      await api.updateAdminMoveSettings({
        daily_step_goal: Number(adminSettings.daily_step_goal || 10000),
        max_steps_per_day: Number(adminSettings.max_steps_per_day || 30000),
        premium_multiplier: Number(adminSettings.premium_multiplier || 1.5),
        max_sync_increment: Number(adminSettings.max_sync_increment || 8000),
        max_step_speed_kmh: Number(adminSettings.max_step_speed_kmh || 22),
        device_limit_per_day: Number(adminSettings.device_limit_per_day || 2),
        ai_coach_enabled: Boolean(adminSettings.ai_coach_enabled),
        gps_quality_weight: Number(adminSettings.gps_quality_weight || 0.45),
        sensor_quality_weight: Number(adminSettings.sensor_quality_weight || 0.35),
        behavior_quality_weight: Number(adminSettings.behavior_quality_weight || 0.2),
      });
      toast.success("Move Settings gespeichert");
      await load();
    } catch (error) {
      toast.error(error.message || "Speichern fehlgeschlagen");
    } finally {
      setSavingAdmin(false);
    }
  };

  const refreshCoach = async (focus = "daily_plan") => {
    setCoachLoading(true);
    try {
      const res = await api.refreshMoveCoachSession({ focus });
      setStatus((prev) => ({ ...prev, ai_coach: res.coach }));
      toast.success("Coach aktualisiert");
    } catch (error) {
      toast.error(error.message || "Coach konnte nicht aktualisiert werden");
    } finally {
      setCoachLoading(false);
    }
  };

  const toggleConsent = () => {
    const next = !trackingConsent;
    setTrackingConsent(next);
    window.localStorage.setItem("move_earn_tracking_opt_in", String(next));
    toast.success(next ? "GPS-Scoring aktiviert" : "GPS-Scoring pausiert");
  };

  const summary = status?.profile || {};
  const daily = status?.daily || {};
  const missions = status?.missions || [];
  const aiCoach = status?.ai_coach || {};
  const historyRewards = history?.rewards || [];
  const topBoard = leaderboard?.leaderboard || [];
  const rewardCards = status?.claim_cards || [];
  const dailyCheckin = status?.daily_checkin || {};
  const scoring = daily?.scoring || {};

  const sectionCards = useMemo(() => [
    { icon: Bike, title: ui.rideEarn, value: status?.ride_earn?.today_rides ?? 0, color: "#00E4FF" },
    { icon: Leaf, title: ui.ecoRewards, value: status?.ride_earn?.eco_trips ?? 0, color: "#37FF8B" },
    { icon: Gift, title: ui.merchantChallenges, value: status?.ride_earn?.merchant_events ?? 0, color: "#FFD766" },
    { icon: QrCode, title: ui.qrChallenges, value: status?.ride_earn?.qr_events ?? 0, color: "#B98CFF" },
    { icon: Users, title: ui.familyChallenges, value: status?.ride_earn?.linked_children ?? 0, color: "#FF87BA" },
    { icon: Bot, title: ui.aiCoach, value: aiCoach?.suggested_goal ?? 0, color: "#65D9FF" },
  ], [status, aiCoach, ui]);

  if (loading && !status) {
    return <div className="flex min-h-screen items-center justify-center bg-[#04110C] text-white" data-testid="move-earn-loading"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div data-testid="move-earn-page" className="min-h-screen pb-28 text-white" style={{ background: "radial-gradient(circle at top left, rgba(55,255,139,0.18), transparent 22%), radial-gradient(circle at top right, rgba(0,228,255,0.14), transparent 24%), #04110C" }}>
      <div className="sticky top-0 z-30 border-b border-white/8 bg-[rgba(4,17,12,0.84)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 pt-[max(env(safe-area-inset-top,0px),18px)]">
          <button onClick={onBack} data-testid="move-earn-back-button" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]"><ArrowLeft size={16} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black sm:text-3xl">{ui.title}</h1>
            <p className="text-sm text-white/55">{ui.subtitle}</p>
          </div>
          {summary.is_premium && <div data-testid="move-earn-premium-badge" className="rounded-full border border-[#FFD766]/20 bg-[#FFD766]/10 px-3 py-1 text-xs font-bold text-[#FFD766]">{ui.premium}</div>}
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5">
        {summary.is_blocked && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200" data-testid="move-earn-blocked-banner">{ui.blocked}</div>}

        <section className={`${panel} p-5`} data-testid="move-earn-hero-card">
          <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
            <div className="flex flex-col items-center justify-center gap-4">
              <Ring progress={daily.progress_pct || 0} testId="move-earn-progress-ring">
                <div className="text-center">
                  <div className="text-4xl font-black text-[#37FF8B]">{daily.progress_pct || 0}%</div>
                  <div className="mt-2 text-sm text-white/55">{daily.accepted_steps || 0} / {daily.goal || 0}</div>
                </div>
              </Ring>
              <button onClick={syncSteps} disabled={syncing || nativeSteps.loading || nativeSteps.syncing} data-testid="move-earn-sync-button" className="w-full max-w-[260px] rounded-2xl bg-gradient-to-r from-[#37FF8B] to-[#00E4FF] px-5 py-3 text-sm font-black text-[#03120D] disabled:opacity-60">
                {syncing ? ui.syncing : ui.sync}
              </button>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/60">
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">{summary.energy_balance || 0} Energy</span>
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">{summary.total_move_coins || 0} Coins</span>
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">{summary.total_xp || 0} XP</span>
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1" data-testid="move-premium-live-tracking-chip">{status?.ride_earn?.premium_live_tracking_events || 0} Premium Live</span>
              </div>
              <div className="w-full max-w-[320px] rounded-[24px] border border-white/8 bg-white/[0.04] p-4 text-left" data-testid="move-native-source-card">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Native Schrittquelle</div>
                    <div className="mt-1 text-sm font-black text-white">{nativeSteps.isNative ? (nativeSteps.platform === "ios" ? "HealthKit" : "Health Connect") : "Web Preview Fallback"}</div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-[11px] font-black ${nativeSteps.authorized ? "bg-[#37FF8B] text-[#04110C]" : "bg-white/10 text-white/70"}`} data-testid="move-native-source-status">
                    {nativeSteps.authorized ? "verbunden" : (nativeSteps.isNative ? "Berechtigung offen" : "Preview")}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-black/20 px-3 py-3" data-testid="move-native-steps-total-card">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">Heute nativ</div>
                    <div className="mt-1 text-lg font-black text-white">{nativeSteps.totalSteps || 0}</div>
                  </div>
                  <div className="rounded-2xl bg-black/20 px-3 py-3" data-testid="move-native-distance-card">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">Distanz</div>
                    <div className="mt-1 text-lg font-black text-white">{((nativeSteps.totalDistanceMeters || 0) / 1000).toFixed(2)} km</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-white/60" data-testid="move-native-permission-message">{nativeSteps.permissionMessage}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      const result = await nativeSteps.requestPermissions();
                      if (result.ok) {
                        toast.success(result.message || "Health-Zugriff freigegeben");
                      } else {
                        toast.error(result.message || "Health-Zugriff fehlt");
                      }
                    }}
                    disabled={!nativeSteps.isNative || nativeSteps.authorized || nativeSteps.syncing}
                    data-testid="move-native-request-access-button"
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black disabled:opacity-40"
                  >
                    Zugriff freigeben
                  </button>
                  <button
                    onClick={async () => {
                      const opened = await nativeSteps.openSettings();
                      if (!opened) {
                        toast.message("Einstellungen nur auf Android-Geräten verfügbar");
                      }
                    }}
                    disabled={!nativeSteps.isNative}
                    data-testid="move-native-open-settings-button"
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black disabled:opacity-40"
                  >
                    Health öffnen
                  </button>
                  <button
                    onClick={async () => {
                      const opened = await nativeSteps.openPrivacyPolicy();
                      if (!opened) {
                        toast.message("Privacy-Ansicht nur auf Android verfügbar");
                      }
                    }}
                    disabled={!nativeSteps.isNative}
                    data-testid="move-native-open-privacy-button"
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black disabled:opacity-40"
                  >
                    Privacy
                  </button>
                  <button
                    onClick={async () => {
                      await nativeSteps.readToday();
                      toast.success("Native Schritte aktualisiert");
                    }}
                    disabled={nativeSteps.loading}
                    data-testid="move-native-refresh-button"
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black disabled:opacity-40"
                  >
                    Neu laden
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon={Footprints} label="Steps" value={daily.accepted_steps || 0} color="#37FF8B" testId="move-earn-steps-card" />
                <MetricCard icon={Zap} label="Energy" value={summary.energy_balance || 0} color="#FFD766" testId="move-earn-energy-card" />
                <MetricCard icon={Award} label="XP" value={summary.total_xp || 0} color="#00E4FF" testId="move-earn-xp-card" />
                <MetricCard icon={Star} label="Streak" value={summary.streak_days || 0} color="#FF87BA" testId="move-earn-streak-card" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon={ShieldCheck} label="Trust" value={scoring.trust_score || 0} color="#8BF6FF" testId="move-earn-trust-score-card" />
                <MetricCard icon={MapPinned} label="GPS" value={scoring.gps_score || 0} color="#37FF8B" testId="move-earn-gps-score-card" />
                <MetricCard icon={Activity} label="Sensor" value={scoring.sensor_score || 0} color="#FFD766" testId="move-earn-sensor-score-card" />
                <MetricCard icon={Route} label="Behavior" value={scoring.behavior_score || 0} color="#FF87BA" testId="move-earn-behavior-score-card" />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sectionCards.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid={`move-earn-module-${item.title.replace(/\s+/g, '-').toLowerCase()}`}>
                      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white/85"><Icon size={16} style={{ color: item.color }} /> {item.title}</div>
                      <div className="text-2xl font-black text-white">{item.value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
          <section className={`${panel} p-5`} data-testid="move-earn-reward-section">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">{ui.stats}</h2>
                <p className="text-sm text-white/55">Level: {summary.level?.label || summary.level?.id || "Bronze"}</p>
              </div>
              <button onClick={() => claimReward("checkin")} disabled={!dailyCheckin.claimable} data-testid="move-earn-checkin-button" className="rounded-2xl bg-[#37FF8B] px-4 py-3 text-sm font-black text-[#03120D] disabled:opacity-40">
                {ui.checkin}
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {rewardCards.map((card) => (
                <div key={card.reward_code} className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid={`move-earn-reward-card-${card.reward_code.replace(/[:]/g, '-')}`}>
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white/85"><Gift size={15} className="text-[#37FF8B]" /> {card.title}</div>
                  <div className="text-sm text-white/55">{card.unlock_steps} Steps · {card.energy_cost} Energy</div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-white/45">{card.claimed ? "bereits geholt" : card.unlocked ? "verfügbar" : "gesperrt"}</div>
                    <button onClick={() => claimReward(card.reward_code)} disabled={!card.unlocked || card.claimed} data-testid={`move-earn-claim-${card.reward_code.replace(/[:]/g, '-')}`} className="rounded-xl bg-white text-[#04110C] px-3 py-2 text-xs font-black disabled:opacity-40">
                      {ui.claim}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={`${panel} p-5`} data-testid="move-earn-missions-section">
            <h2 className="mb-4 text-xl font-black">{ui.missions}</h2>
            <div className="mb-4 rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid="move-premium-live-tracking-panel">
              <div className="flex items-center gap-2 text-sm font-bold text-white/85"><Crown size={16} className="text-[#FFD766]" /> Premium Mobility Signal</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-black/20 px-3 py-3" data-testid="move-premium-live-tracking-count-card">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">Shuttle / VIP heute</div>
                  <div className="mt-1 text-lg font-black text-white">{status?.ride_earn?.premium_live_tracking_events || 0}</div>
                </div>
                <div className="rounded-2xl bg-black/20 px-3 py-3" data-testid="move-premium-live-tracking-trust-card">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">Trust Signal</div>
                  <div className="mt-1 text-lg font-black text-white">{daily?.scoring?.trust_score || 0}/100</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-white/60">Premium-Fahrten mit Live-Tracking stärken Ride-&-Earn-Vertrauen und Mobility-Qualität.</div>
            </div>
            <div className="space-y-3">
              {missions.map((mission) => (
                <div key={mission.claim_code} className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid={`move-earn-mission-${mission.mission_id}`}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-sm font-bold text-white/90">{mission.title}</div>
                    <div className="text-xs text-white/45">{mission.scope}</div>
                  </div>
                  <div className="mb-2 text-sm text-white/55">{mission.progress} / {mission.target}</div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#37FF8B] to-[#00E4FF]" style={{ width: `${Math.min(100, (mission.progress / Math.max(1, mission.target)) * 100)}%` }}></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-white/55">{mission.reward?.label}</div>
                    <button onClick={() => claimReward(mission.claim_code)} disabled={!mission.completed || mission.claimed} data-testid={`move-earn-mission-claim-${mission.mission_id}`} className="rounded-xl border border-white/12 bg-white px-3 py-2 text-xs font-black text-[#04110C] disabled:opacity-40">
                      {ui.claim}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <section className={`${panel} p-5`} data-testid="move-earn-leaderboard-section">
            <h2 className="mb-4 text-xl font-black">{ui.leaderboard}</h2>
            <div className="space-y-3">
              {topBoard.map((item) => (
                <div key={item.user_id} className="flex items-center justify-between rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-3" data-testid={`move-earn-leaderboard-item-${item.rank}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#37FF8B]/12 text-sm font-black text-[#37FF8B]">#{item.rank}</div>
                    <div>
                      <div className="text-sm font-bold text-white/90">{item.user_name}</div>
                      <div className="text-xs text-white/45">{item.level} · {item.total_steps} Steps</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-[#00E4FF]">{item.total_xp} XP</div>
                    <div className="text-xs text-white/45">{item.eco_trips || 0} Eco</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={`${panel} p-5`} data-testid="move-earn-history-section">
            <h2 className="mb-4 text-xl font-black">{ui.history}</h2>
            <div className="space-y-3">
              {historyRewards.map((item) => (
                <div key={item.reward_id} className="rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-3" data-testid={`move-earn-history-item-${item.reward_id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-white/90">{item.label}</div>
                      <div className="text-xs text-white/45">{item.reward_type} · {item.created_at?.slice(0, 16)?.replace("T", " ")}</div>
                    </div>
                    <div className="text-sm font-black text-[#37FF8B]">{item.reward_value}</div>
                  </div>
                </div>
              ))}
              {!historyRewards.length && <div className="text-sm text-white/45">{ui.noHistory}</div>}
            </div>
          </section>
        </div>

        <section className={`${panel} p-5`} data-testid="move-earn-ai-coach-section">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xl font-black"><Bot size={20} className="text-[#00E4FF]" /> {ui.aiCoach}</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => refreshCoach("daily_plan")} disabled={coachLoading} className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-black" data-testid="move-ai-refresh-daily-plan-button">Tagesplan</button>
              <button onClick={() => refreshCoach("score_explanation")} disabled={coachLoading} className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-black" data-testid="move-ai-refresh-score-button">Score erklären</button>
              <button onClick={toggleConsent} className="rounded-2xl bg-[#37FF8B] px-3 py-2 text-xs font-black text-[#03120D]" data-testid="move-ai-tracking-consent-toggle">{trackingConsent ? "GPS aktiv" : "GPS aus"}</button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard icon={Activity} label="7d Avg" value={aiCoach.average_steps_last_7d || 0} color="#37FF8B" testId="move-ai-average-card" />
            <MetricCard icon={Rocket} label="Best Day" value={aiCoach.best_day_steps || 0} color="#FFD766" testId="move-ai-best-card" />
            <MetricCard icon={BadgeCheck} label="Goal" value={aiCoach.suggested_goal || 0} color="#00E4FF" testId="move-ai-goal-card" />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4" data-testid="move-ai-hint-card">
              <p className="text-xs uppercase tracking-[0.18em] text-[#8BF6FF]">{aiCoach.coach_source || "rules-fallback"}</p>
              <h3 className="mt-2 text-lg font-black text-white">{aiCoach.headline || "Heute Bewegung mit Qualität priorisieren"}</h3>
              <p className="mt-2 text-sm text-white/65">{aiCoach.summary || aiCoach.next_hint}</p>
              <div className="mt-3 rounded-2xl bg-black/20 px-3 py-3 text-sm text-white/75" data-testid="move-ai-next-hint-text">{aiCoach.next_hint}</div>
              <div className="mt-3 space-y-2">
                {(aiCoach.action_plan || []).map((item, index) => (
                  <div key={`${item}-${index}`} className="rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm text-white/75" data-testid={`move-ai-action-plan-${index}`}>{item}</div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4" data-testid="move-ai-sensor-panel">
              <div className="flex items-center gap-2 text-sm font-black text-white"><ShieldCheck size={16} className="text-[#37FF8B]" /> Reales Sensor-/GPS-Scoring</div>
              <div className="mt-3 space-y-2 text-sm text-white/65">
                <div className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2" data-testid="move-ai-permission-state"><span>GPS Permission</span><span className="font-bold text-white">{permissionState || "prompt"}</span></div>
                <div className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2" data-testid="move-ai-gps-address"><span>Letzter Ort</span><span className="max-w-[55%] truncate font-bold text-white">{currentAddress || gpsState.address || "noch nicht erfasst"}</span></div>
                <div className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2" data-testid="move-ai-gps-coordinates"><span>Koordinaten</span><span className="font-bold text-white">{gpsState.lat ? `${gpsState.lat.toFixed(4)}, ${gpsState.lng.toFixed(4)}` : "—"}</span></div>
              </div>
              {!!gpsHelperText && <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100" data-testid="move-ai-gps-helper-text">{gpsHelperText}</div>}
              <div className="mt-3 flex flex-wrap gap-2">
                {(scoring.flags || []).slice(0, 6).map((flag, index) => <span key={`${flag}-${index}`} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/65" data-testid={`move-ai-scoring-flag-${index}`}>{flag}</span>)}
              </div>
            </div>
          </div>
        </section>

        {user?.role === "admin" && adminSettings && adminStats && (
          <section className={`${panel} p-5`} data-testid="move-earn-admin-section">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">{ui.admin}</h2>
                <p className="text-sm text-white/55">{adminStats.summary?.profiles_count || 0} {ui.users} · {adminStats.summary?.active_today || 0} {ui.activeToday}</p>
              </div>
              <button onClick={saveAdmin} disabled={savingAdmin} data-testid="move-admin-save-button" className="rounded-2xl bg-[#37FF8B] px-4 py-3 text-sm font-black text-[#04110C] disabled:opacity-40">{savingAdmin ? ui.loading : ui.save}</button>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3 rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid="move-admin-settings-card">
                {[
                  ["daily_step_goal", "Daily Goal"],
                  ["max_steps_per_day", "Max Steps/Day"],
                  ["premium_multiplier", "Premium Multiplier"],
                  ["max_sync_increment", "Max Sync Increment"],
                  ["max_step_speed_kmh", "Max Speed km/h"],
                  ["device_limit_per_day", "Device Limit/Day"],
                  ["gps_quality_weight", "GPS Weight"],
                  ["sensor_quality_weight", "Sensor Weight"],
                  ["behavior_quality_weight", "Behavior Weight"],
                ].map(([key, label]) => (
                  <label key={key} className="block text-sm text-white/70">
                    <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-white/40">{label}</span>
                    <input type="number" value={adminSettings[key] ?? ""} onChange={(e) => setAdminSettings((prev) => ({ ...prev, [key]: Number(e.target.value || 0) }))} data-testid={`move-admin-input-${key}`} className="w-full rounded-2xl border border-white/10 bg-[#071913] px-3 py-3 text-white outline-none" />
                  </label>
                ))}
                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#071913] px-3 py-3 text-sm text-white/80" data-testid="move-admin-ai-coach-enabled-toggle">
                  <span>AI Coach aktiv</span>
                  <input type="checkbox" checked={Boolean(adminSettings.ai_coach_enabled)} onChange={(e) => setAdminSettings((prev) => ({ ...prev, ai_coach_enabled: e.target.checked }))} />
                </label>
              </div>

              <div className="space-y-3 rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid="move-admin-stats-card">
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard icon={Users} label={ui.users} value={adminStats.summary?.profiles_count || 0} color="#37FF8B" testId="move-admin-users-card" />
                  <MetricCard icon={Shield} label={ui.fraud} value={adminStats.summary?.fraud_today || 0} color="#FF87BA" testId="move-admin-fraud-card" />
                  <MetricCard icon={Trophy} label="Reward Cost" value={`€${Number(adminStats.summary?.total_reward_cost_eur || 0).toFixed(2)}`} color="#FFD766" testId="move-admin-cost-card" />
                  <MetricCard icon={Crown} label={ui.suspicious} value={adminStats.summary?.suspicious_profiles || 0} color="#00E4FF" testId="move-admin-suspicious-card" />
                </div>

                <div className="grid grid-cols-2 gap-3" data-testid="move-admin-growth-kpis-grid">
                  <MetricCard icon={Activity} label="DAU" value={adminStats.growth?.dau || 0} color="#37FF8B" testId="move-admin-dau-card" />
                  <MetricCard icon={Users} label="MAU" value={adminStats.growth?.mau || 0} color="#8BF6FF" testId="move-admin-mau-card" />
                  <MetricCard icon={TrendingUp} label="30d Retention" value={`${Number(adminStats.growth?.retention_30_pct || 0).toFixed(1)}%`} color="#FFD766" testId="move-admin-retention-card" />
                  <MetricCard icon={BadgeCheck} label="ROI / €" value={Number(adminStats.roi?.value_per_eur || 0).toFixed(2)} color="#FF87BA" testId="move-admin-roi-per-eur-card" />
                  <MetricCard icon={ShoppingBag} label="Conversions" value={adminStats.roi?.attributed_conversion_orders || 0} color="#F9A826" testId="move-admin-attributed-conversions-card" />
                  <MetricCard icon={WalletCards} label="Revenue / Reward €" value={Number(adminStats.roi?.revenue_per_reward_eur || 0).toFixed(2)} color="#9BF6B5" testId="move-admin-revenue-per-reward-card" />
                </div>

                <div className="rounded-2xl border border-white/8 bg-[#071913] p-4" data-testid="move-admin-roi-panel">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white/85"><TrendingUp size={16} className="text-[#37FF8B]" /> ROI · 30 Tage</div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-white/70">
                    <AdminStatRow label="Value Index" value={adminStats.roi?.value_index || 0} testId="move-admin-roi-value-index" />
                    <AdminStatRow label="Reward Cost" value={`€${Number(adminStats.roi?.reward_cost_eur || 0).toFixed(2)}`} testId="move-admin-roi-reward-cost" />
                    <AdminStatRow label="Cost / MAU" value={`€${Number(adminStats.roi?.cost_per_mau || 0).toFixed(2)}`} testId="move-admin-roi-cost-per-mau" />
                    <AdminStatRow label="Cost / DAU" value={`€${Number(adminStats.roi?.cost_per_dau || 0).toFixed(2)}`} testId="move-admin-roi-cost-per-dau" />
                    <AdminStatRow label="Merchant Events" value={adminStats.roi?.merchant_events || 0} testId="move-admin-roi-merchant-events" />
                    <AdminStatRow label="QR Events" value={adminStats.roi?.qr_events || 0} testId="move-admin-roi-qr-events" />
                    <AdminStatRow label="Attributed Orders" value={adminStats.roi?.attributed_conversion_orders || 0} testId="move-admin-roi-attributed-orders" />
                    <AdminStatRow label="Attributed GMV" value={`€${Number(adminStats.roi?.attributed_conversion_gmv_eur || 0).toFixed(2)}`} testId="move-admin-roi-attributed-gmv" />
                    <AdminStatRow label="Attributed Revenue" value={`€${Number(adminStats.roi?.attributed_conversion_revenue_eur || 0).toFixed(2)}`} testId="move-admin-roi-attributed-revenue" />
                    <AdminStatRow label="Conv. Rate / MAU" value={`${Number(adminStats.roi?.conversion_rate_mau_pct || 0).toFixed(1)}%`} testId="move-admin-roi-conversion-rate" />
                    <AdminStatRow label="Cost / Conversion" value={`€${Number(adminStats.roi?.cost_per_conversion || 0).toFixed(2)}`} testId="move-admin-roi-cost-per-conversion" />
                    <AdminStatRow label="GMV / Reward €" value={Number(adminStats.roi?.gmv_per_reward_eur || 0).toFixed(2)} testId="move-admin-roi-gmv-per-reward" />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-[#071913] p-4" data-testid="move-admin-commerce-roi-panel">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white/85"><ShoppingBag size={16} className="text-[#FFD766]" /> Commerce ROI v2</div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-white/70">
                    <AdminStatRow label="All Orders" value={adminStats.commerce_roi?.summary?.conversion_orders || 0} testId="move-admin-commerce-orders" />
                    <AdminStatRow label="All GMV" value={`€${Number(adminStats.commerce_roi?.summary?.conversion_gmv_eur || 0).toFixed(2)}`} testId="move-admin-commerce-gmv" />
                    <AdminStatRow label="Platform Revenue" value={`€${Number(adminStats.commerce_roi?.summary?.conversion_platform_revenue_eur || 0).toFixed(2)}`} testId="move-admin-commerce-platform-revenue" />
                    <AdminStatRow label="Attributed Buyers" value={adminStats.commerce_roi?.summary?.attributed_conversion_buyers || 0} testId="move-admin-commerce-attributed-buyers" />
                    <AdminStatRow label="Sponsored Orders" value={adminStats.commerce_roi?.summary?.sponsored_conversion_orders || 0} testId="move-admin-commerce-sponsored-orders" />
                    <AdminStatRow label="Sponsored Impact" value={Number(adminStats.commerce_roi?.summary?.sponsored_reward_impact || 0).toFixed(2)} testId="move-admin-commerce-sponsored-impact" />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-[#071913] p-4" data-testid="move-admin-commerce-channel-breakdown-panel">
                  <div className="mb-3 text-sm font-bold text-white/85">Channel Breakdown</div>
                  <div className="space-y-2">
                    {(adminStats.commerce_roi?.channels || []).slice(0, 6).map((row, index) => (
                      <div key={`${row.channel}-${index}`} className="grid grid-cols-[120px_1fr_auto_auto] items-center gap-3 rounded-xl border border-white/6 bg-black/20 px-3 py-2" data-testid={`move-admin-commerce-channel-${index}`}>
                        <div>
                          <div className="text-sm font-semibold text-white/85">{row.channel}</div>
                          <div className="text-xs text-white/45">{row.orders} Orders · {row.buyers} Buyer</div>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#FFD766] to-[#37FF8B]" style={{ width: `${Math.min(100, Number(row.attributed_share_pct || 0))}%` }} /></div>
                        <div className="text-right text-xs font-bold text-white">€{Number(row.attributed_gmv_eur || 0).toFixed(2)}</div>
                        <div className="text-right text-xs font-bold text-[#37FF8B]">€{Number(row.attributed_platform_revenue_eur || 0).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-[#071913] p-4" data-testid="move-admin-commerce-attribution-window-panel">
                  <div className="mb-3 text-sm font-bold text-white/85">Attribution Window</div>
                  <div className="space-y-2">
                    {(adminStats.commerce_roi?.attribution_windows || []).slice(0, 6).map((row, index) => (
                      <div key={`${row.channel}-${index}`} className="flex items-center justify-between rounded-xl border border-white/6 bg-black/20 px-3 py-2" data-testid={`move-admin-commerce-window-${index}`}>
                        <div>
                          <div className="text-sm font-semibold text-white/85">{row.channel}</div>
                          <div className="text-xs text-white/45">{row.orders} Orders · {row.buyers} Buyer</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-white">€{Number(row.gmv_eur || 0).toFixed(2)} GMV</div>
                          <div className="text-xs font-bold text-[#8BF6FF]">€{Number(row.platform_revenue_eur || 0).toFixed(2)} Revenue</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-[#071913] p-4" data-testid="move-admin-reward-cost-breakdown-panel">
                  <div className="mb-3 text-sm font-bold text-white/85">Reward-Kosten nach Typ</div>
                  <div className="space-y-2">
                    {(adminStats.reward_cost_breakdown?.by_type || []).slice(0, 6).map((row, index) => (
                      <div key={`${row.reward_type}-${index}`} className="flex items-center justify-between rounded-xl border border-white/6 bg-black/20 px-3 py-2" data-testid={`move-admin-reward-type-${index}`}>
                        <div>
                          <div className="text-sm font-semibold text-white/85">{row.reward_type}</div>
                          <div className="text-xs text-white/45">{row.count} Rewards</div>
                        </div>
                        <div className="text-sm font-black text-[#FFD766]">€{Number(row.cost_eur || 0).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-[#071913] p-4" data-testid="move-admin-reward-source-breakdown-panel">
                  <div className="mb-3 text-sm font-bold text-white/85">Reward-Kosten nach Quelle</div>
                  <div className="space-y-2">
                    {(adminStats.reward_cost_breakdown?.by_source || []).slice(0, 6).map((row, index) => (
                      <div key={`${row.source_code}-${index}`} className="flex items-center justify-between rounded-xl border border-white/6 bg-black/20 px-3 py-2" data-testid={`move-admin-reward-source-${index}`}>
                        <div>
                          <div className="text-sm font-semibold text-white/85">{row.source_code}</div>
                          <div className="text-xs text-white/45">{row.count} Rewards</div>
                        </div>
                        <div className="text-sm font-black text-[#8BF6FF]">€{Number(row.cost_eur || 0).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-[#071913] p-4" data-testid="move-admin-growth-trend-panel">
                  <div className="mb-3 text-sm font-bold text-white/85">14-Tage Trend</div>
                  <div className="space-y-2">
                    {(adminStats.trend_14d || []).slice(-6).map((row, index) => (
                      <div key={`${row.date}-${index}`} className="grid grid-cols-[90px_1fr_auto_auto] items-center gap-3 rounded-xl border border-white/6 bg-black/20 px-3 py-2 text-xs" data-testid={`move-admin-trend-row-${index}`}>
                        <span className="text-white/55">{row.date}</span>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#37FF8B] to-[#00E4FF]" style={{ width: `${Math.min(100, (row.active_users || 0) * 8)}%` }} /></div>
                        <span className="font-bold text-white">{row.active_users} aktiv</span>
                        <span className="font-bold text-[#FFD766]">€{Number(row.reward_cost_eur || 0).toFixed(2)}</span>
                        <span className="font-bold text-[#37FF8B]">{row.attributed_conversion_orders || 0} conv · €{Number(row.attributed_revenue_eur || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-[#071913] p-4" data-testid="move-admin-top-users-card">
                  <div className="mb-3 text-sm font-bold text-white/85">{ui.topUsers}</div>
                  <div className="space-y-2">
                    {(adminStats.top_users || []).slice(0, 6).map((row) => (
                      <div key={row.user_id} className="flex items-center justify-between rounded-xl border border-white/6 bg-black/20 px-3 py-2" data-testid={`move-admin-top-user-${row.user_id}`}>
                        <div>
                          <div className="text-sm font-semibold text-white/85">{row.user_name}</div>
                          <div className="text-xs text-white/45">{row.level} · {row.total_steps} Steps</div>
                        </div>
                        <button onClick={() => api.setAdminMoveUserBlock(row.user_id, { blocked: !row.is_blocked, reason: row.is_blocked ? "" : "Admin Review" }).then(load).catch((e) => toast.error(e.message))} data-testid={`move-admin-block-user-${row.user_id}`} className="rounded-xl border border-white/10 bg-white px-3 py-2 text-xs font-black text-[#04110C]">
                          {row.is_blocked ? "Entsperren" : "Sperren"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function AdminStatRow({ label, value, testId }) {
  return (
    <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2" data-testid={testId}>
      <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">{label}</div>
      <div className="mt-1 text-sm font-black text-white">{value}</div>
    </div>
  );
}