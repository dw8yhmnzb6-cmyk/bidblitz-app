import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Crown,
  Gift,
  Loader2,
  RotateCcw,
  Shield,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  Wallet,
  Coins,
  Gem,
  RefreshCw,
  ChevronRight,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useI18n, useUser } from "../store";

const panel = "rounded-[28px] border border-white/10 bg-[rgba(10,14,24,0.88)] backdrop-blur-xl";

const copy = {
  de: {
    title: "Reward Hub",
    subtitle: "Mystery Boxen, Glücksrad, Cashback und Coupons an einem Ort.",
    spinTitle: "Spin Wheel",
    boxTitle: "Mystery Boxen",
    overviewTitle: "Übersicht",
    activityTitle: "Letzte Rewards",
    leaderboardTitle: "Top Spieler",
    adminTitle: "Admin Konfiguration",
    couponsTitle: "Deine Coupons",
    spinNow: "Jetzt drehen",
    spinBusy: "Dreht...",
    openNow: "Jetzt öffnen",
    opening: "Öffnet...",
    premium: "Premium",
    freeToday: "heute frei",
    remaining: "übrig",
    walletBalance: "Wallet",
    bidCredits: "Bid Credits",
    bidCoins: "BidCoins",
    cashback: "Cashback",
    streak: "Streak",
    boxesOpened: "Boxen geöffnet",
    noCoupons: "Noch keine Coupons",
    noActivity: "Noch keine Reward-Aktivität",
    save: "Speichern",
    saving: "Speichert...",
    refresh: "Aktualisieren",
    audits: "Audit Logs",
    suspicious: "Auffällige Nutzer",
    rewardsConfig: "Rewards V3",
    rewardHubConfig: "Reward Hub",
    premiumHint: "Premium-Nutzer erhalten mehr Freispiele und Gratis-Boxen.",
    couponCode: "Code",
    expires: "Läuft ab",
    spins: "Spins",
    boxHistory: "Box-Verlauf",
    spinHistory: "Spin-Verlauf",
    won: "Gewonnen",
  },
  en: {
    title: "Reward Hub",
    subtitle: "Mystery boxes, wheel spins, cashback and coupons in one place.",
    spinTitle: "Spin Wheel",
    boxTitle: "Mystery Boxes",
    overviewTitle: "Overview",
    activityTitle: "Recent rewards",
    leaderboardTitle: "Top players",
    adminTitle: "Admin configuration",
    couponsTitle: "Your coupons",
    spinNow: "Spin now",
    spinBusy: "Spinning...",
    openNow: "Open now",
    opening: "Opening...",
    premium: "Premium",
    freeToday: "free today",
    remaining: "left",
    walletBalance: "Wallet",
    bidCredits: "Bid Credits",
    bidCoins: "BidCoins",
    cashback: "Cashback",
    streak: "Streak",
    boxesOpened: "Boxes opened",
    noCoupons: "No coupons yet",
    noActivity: "No reward activity yet",
    save: "Save",
    saving: "Saving...",
    refresh: "Refresh",
    audits: "Audit logs",
    suspicious: "Suspicious users",
    rewardsConfig: "Rewards V3",
    rewardHubConfig: "Reward Hub",
    premiumHint: "Premium users get more free spins and free boxes.",
    couponCode: "Code",
    expires: "Expires",
    spins: "Spins",
    boxHistory: "Box history",
    spinHistory: "Spin history",
    won: "Won",
  },
};

const tierStyles = {
  bronze: { accent: "#C48757", glow: "rgba(196,135,87,0.28)" },
  silber: { accent: "#D9E3F0", glow: "rgba(217,227,240,0.26)" },
  gold: { accent: "#FFD766", glow: "rgba(255,215,102,0.3)" },
  diamond: { accent: "#8FEFFF", glow: "rgba(143,239,255,0.34)" },
};

const StatCard = ({ icon: Icon, label, value, accent, testId }) => (
  <div data-testid={testId} className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
      <Icon size={13} style={{ color: accent }} />
      <span>{label}</span>
    </div>
    <div className="text-[24px] font-black text-white">{value}</div>
  </div>
);

const RewardChip = ({ reward }) => (
  <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-[11px] text-white/80" data-testid={`reward-chip-${reward.reward_type || reward.type || "item"}`}>
    {reward.label || reward.description || reward.reward_type}
  </div>
);

export default function RewardsPage({ onBack }) {
  const { lang } = useI18n();
  const user = useUser();
  const ui = copy[lang?.startsWith("de") ? "de" : "en"];
  const [hub, setHub] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [spinRotation, setSpinRotation] = useState(0);
  const [openingBox, setOpeningBox] = useState("");
  const [boxReveal, setBoxReveal] = useState(null);
  const [lastSpinPrize, setLastSpinPrize] = useState(null);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminRewardConfig, setAdminRewardConfig] = useState({
    streak_bonus_3: 3,
    streak_bonus_7: 8,
    streak_bonus_30: 30,
    max_daily_reward_credits: 25,
  });
  const [adminHubConfig, setAdminHubConfig] = useState({
    free_daily_spins: 1,
    premium_daily_spins: 3,
    premium_cashback_multiplier: 1.5,
    spin_enabled: true,
  });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [hubData, adminRes] = await Promise.all([
        api.getRewardHub(),
        user?.role === "admin" ? api.getRewardsAdminConfig().catch(() => null) : Promise.resolve(null),
      ]);
      setHub(hubData);
      if (adminRes) {
        setAdminData(adminRes);
        setAdminRewardConfig((prev) => ({ ...prev, ...(adminRes.config || {}) }));
        setAdminHubConfig((prev) => ({ ...prev, ...(adminRes.reward_hub_config || {}) }));
      }
    } catch (error) {
      toast.error(error.message || "Reward Hub konnte nicht geladen werden");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.role]);

  useEffect(() => {
    load();
  }, [load]);

  const spinSegments = hub?.spin?.prizes || [];
  const overview = hub?.overview || {};
  const mysteryBoxes = hub?.mystery_boxes?.boxes || [];
  const rewardCoupons = hub?.coupons || [];
  const recentActivity = hub?.recent_activity || [];
  const spinHistory = hub?.spin?.history || [];
  const handleSpin = async () => {
    if (!hub?.spin?.remaining || spinning) return;
    setSpinning(true);
    setLastSpinPrize(null);
    try {
      const result = await api.spinRewardWheel();
      const count = spinSegments.length || 1;
      const angle = 360 / count;
      const target = 360 * 6 + (360 - (result.prize_index * angle + angle / 2));
      setSpinRotation((prev) => prev + target);
      setTimeout(async () => {
        setLastSpinPrize(result.prize);
        toast.success(`${ui.won}: ${result.prize.label}`);
        await load(true);
        setSpinning(false);
      }, 4200);
    } catch (error) {
      toast.error(error.message || "Spin fehlgeschlagen");
      setSpinning(false);
    }
  };

  const handleOpenBox = async (boxKey) => {
    if (openingBox) return;
    setOpeningBox(boxKey);
    try {
      const result = await api.openMysteryBox({ box_key: boxKey });
      setTimeout(async () => {
        setBoxReveal(result);
        toast.success(result.reward?.label || result.reward?.coupon?.code || "Box geöffnet");
        await load(true);
        setOpeningBox("");
      }, 1800);
    } catch (error) {
      toast.error(error.message || "Box konnte nicht geöffnet werden");
      setOpeningBox("");
    }
  };

  const handleSaveAdmin = async () => {
    setSavingAdmin(true);
    try {
      await Promise.all([
        api.updateRewardsAdminConfig({
          streak_bonus_3: Number(adminRewardConfig.streak_bonus_3 || 0),
          streak_bonus_7: Number(adminRewardConfig.streak_bonus_7 || 0),
          streak_bonus_30: Number(adminRewardConfig.streak_bonus_30 || 0),
          max_daily_reward_credits: Number(adminRewardConfig.max_daily_reward_credits || 1),
        }),
        api.updateRewardHubAdminConfig({
          free_daily_spins: Number(adminHubConfig.free_daily_spins || 0),
          premium_daily_spins: Number(adminHubConfig.premium_daily_spins || 1),
          premium_cashback_multiplier: Number(adminHubConfig.premium_cashback_multiplier || 1),
          spin_enabled: !!adminHubConfig.spin_enabled,
        }),
      ]);
      toast.success("Reward Konfiguration gespeichert");
      await load(true);
    } catch (error) {
      toast.error(error.message || "Speichern fehlgeschlagen");
    } finally {
      setSavingAdmin(false);
    }
  };

  if (loading && !hub) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050816]" data-testid="reward-hub-loading">
        <Loader2 className="animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div
      data-testid="reward-hub-page"
      className="min-h-screen pb-28 text-white"
      style={{ background: "radial-gradient(circle at top left, rgba(0,194,255,0.18), transparent 26%), radial-gradient(circle at top right, rgba(255,215,102,0.12), transparent 22%), #050816" }}
    >
      <div className="sticky top-0 z-30 border-b border-white/8 bg-[rgba(5,8,22,0.8)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 pt-[max(env(safe-area-inset-top,0px),18px)]">
          <button onClick={onBack} data-testid="reward-hub-back-button" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
            <ArrowLeft size={16} className="text-white/80" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black sm:text-3xl">{ui.title}</h1>
            <p data-testid="reward-hub-subtitle" className="text-sm text-white/55">{ui.subtitle}</p>
          </div>
          <button onClick={() => load(true)} data-testid="reward-hub-refresh-button" className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-white/80">
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            <span>{ui.refresh}</span>
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">
        <section className={`${panel} overflow-hidden p-5`} data-testid="reward-hub-hero-card">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD766]/20 bg-[#FFD766]/10 px-3 py-1 text-xs font-bold text-[#FFD766]" data-testid="reward-hub-premium-hint">
                <Crown size={14} /> {ui.premiumHint}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard icon={Coins} label={ui.bidCoins} value={overview.bidcoins_balance ?? 0} accent="#00C2FF" testId="reward-stat-bidcoins" />
                <StatCard icon={Ticket} label={ui.bidCredits} value={overview.bid_credits ?? 0} accent="#FFD766" testId="reward-stat-bidcredits" />
                <StatCard icon={Wallet} label={ui.walletBalance} value={`€${Number(overview.wallet_balance || 0).toFixed(2)}`} accent="#00D26A" testId="reward-stat-wallet" />
                <StatCard icon={Sparkles} label={ui.cashback} value={`${Number(overview.cashback_total || 0).toFixed(2)}%`} accent="#FF74B8" testId="reward-stat-cashback" />
                <StatCard icon={Trophy} label={ui.streak} value={overview.active_streak ?? 0} accent="#FF6B6B" testId="reward-stat-streak" />
                <StatCard icon={Gift} label={ui.boxesOpened} value={overview.boxes_opened ?? 0} accent="#8FEFFF" testId="reward-stat-boxes" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid="reward-hub-spin-summary-card">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/45">{ui.spinTitle}</p>
                    <p className="mt-1 text-3xl font-black text-[#FFD766]" data-testid="reward-hub-spin-remaining">{hub?.spin?.remaining ?? 0}</p>
                    <p className="text-sm text-white/55">{ui.remaining} / {hub?.spin?.limit ?? 0} {ui.spins}</p>
                  </div>
                  {overview.is_premium && (
                    <div className="rounded-full border border-[#8FEFFF]/20 bg-[#8FEFFF]/10 px-3 py-1 text-xs font-bold text-[#8FEFFF]" data-testid="reward-hub-premium-badge">
                      {ui.premium}
                    </div>
                  )}
                </div>
                <p className="text-sm text-white/65" data-testid="reward-hub-next-reset">Reset: {hub?.spin?.next_reset?.slice(0, 16)?.replace("T", " ")}</p>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid="reward-hub-coupons-summary-card">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white/85"><Ticket size={16} className="text-[#FF74B8]" /> {ui.couponsTitle}</div>
                <div className="space-y-2">
                  {rewardCoupons.slice(0, 3).map((coupon) => (
                    <div key={coupon.coupon_id} className="flex items-center justify-between rounded-2xl border border-white/6 bg-black/20 px-3 py-2" data-testid={`reward-coupon-summary-${coupon.coupon_id}`}>
                      <div>
                        <div className="text-sm font-bold text-white/85">{coupon.code}</div>
                        <div className="text-xs text-white/45">{coupon.description || `${coupon.value} €`}</div>
                      </div>
                      <ChevronRight size={14} className="text-white/35" />
                    </div>
                  ))}
                  {!rewardCoupons.length && <div className="text-sm text-white/45" data-testid="reward-coupons-empty">{ui.noCoupons}</div>}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className={`${panel} p-5`} data-testid="reward-spin-section">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">{ui.spinTitle}</h2>
                <p className="text-sm text-white/55">{hub?.spin?.remaining ?? 0} {ui.remaining}</p>
              </div>
              <button onClick={handleSpin} disabled={!hub?.spin?.remaining || spinning} data-testid="reward-spin-button" className="rounded-2xl bg-gradient-to-r from-[#FFD766] to-[#FFB800] px-4 py-3 text-sm font-black text-[#0B1120] disabled:opacity-50">
                {spinning ? ui.spinBusy : ui.spinNow}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-[320px_1fr]">
              <div className="mx-auto flex w-full max-w-[320px] flex-col items-center">
                <div className="relative h-[310px] w-[310px]" data-testid="reward-spin-wheel-wrap">
                  <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2" style={{ width: 0, height: 0, borderLeft: "14px solid transparent", borderRight: "14px solid transparent", borderTop: "24px solid #FFD766" }} />
                  <motion.div
                    data-testid="reward-spin-wheel"
                    className="relative h-full w-full overflow-hidden rounded-full border-4 border-[#FFD766]"
                    animate={{ rotate: spinRotation }}
                    transition={{ duration: 4, ease: [0.23, 1, 0.32, 1] }}
                    style={{ boxShadow: "0 0 40px rgba(255,215,102,0.22)" }}
                  >
                    {spinSegments.map((segment, index) => {
                      const angle = 360 / (spinSegments.length || 1);
                      const startAngle = index * angle;
                      return (
                        <div
                          key={`${segment.label}-${index}`}
                          className="absolute inset-0"
                          style={{
                            clipPath: `polygon(50% 50%, ${50 + 60 * Math.sin((startAngle * Math.PI) / 180)}% ${50 - 60 * Math.cos((startAngle * Math.PI) / 180)}%, ${50 + 60 * Math.sin(((startAngle + angle) * Math.PI) / 180)}% ${50 - 60 * Math.cos(((startAngle + angle) * Math.PI) / 180)}%)`,
                            background: segment.color || ["#00D26A", "#00C2FF", "#A855F7", "#FFB800"][index % 4],
                          }}
                        >
                          <div className="absolute left-1/2 top-[11%] text-center" style={{ transform: `translateX(-50%) rotate(${startAngle + angle / 2}deg)`, transformOrigin: "50% 144px" }}>
                            <span className="block max-w-[90px] text-[11px] font-black text-white">{segment.label}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-[#FFD766] bg-[#0A1020]">
                      <RotateCcw size={22} className="text-[#FFD766]" />
                    </div>
                  </motion.div>
                </div>

                <AnimatePresence>
                  {lastSpinPrize && (
                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="mt-3 w-full rounded-[24px] border border-[#00D26A]/20 bg-[#00D26A]/10 p-4 text-center" data-testid="reward-spin-result-card">
                      <div className="text-xs uppercase tracking-[0.18em] text-[#98FFBC]">{ui.won}</div>
                      <div className="mt-2 text-2xl font-black text-[#98FFBC]">{lastSpinPrize.label}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid="reward-spin-history-card">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white/85"><Sparkles size={15} className="text-[#FFD766]" /> {ui.spinHistory}</div>
                  <div className="space-y-2">
                    {spinHistory.slice(0, 6).map((item, idx) => (
                      <div key={item.spin_id || idx} className="flex items-center justify-between rounded-2xl border border-white/6 bg-black/20 px-3 py-2" data-testid={`reward-spin-history-${idx}`}>
                        <div>
                          <div className="text-sm font-semibold text-white/85">{item.prize_label}</div>
                          <div className="text-xs text-white/45">{item.created_at?.slice(0, 16)?.replace("T", " ")}</div>
                        </div>
                        <div className="text-sm font-black text-[#FFD766]">{item.prize_value}</div>
                      </div>
                    ))}
                    {!spinHistory.length && <div className="text-sm text-white/45">{ui.noActivity}</div>}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={`${panel} p-5`} data-testid="reward-mystery-box-section">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">{ui.boxTitle}</h2>
                <p className="text-sm text-white/55">{hub?.mystery_boxes?.bidcoins_balance ?? 0} {ui.bidCoins}</p>
              </div>
              <div className="rounded-full border border-[#8FEFFF]/15 bg-[#8FEFFF]/10 px-3 py-1 text-xs font-bold text-[#8FEFFF]" data-testid="reward-box-free-counter">
                {hub?.mystery_boxes?.premium_free_used_this_month ?? 0} / {overview.is_premium ? ui.freeToday : ui.premium}
              </div>
            </div>

            <div className="space-y-3">
              {mysteryBoxes.map((box) => {
                const tier = tierStyles[box.tier] || tierStyles.bronze;
                const opening = openingBox === box.box_key;
                return (
                  <motion.div
                    key={box.box_key}
                    layout
                    className="overflow-hidden rounded-[26px] border p-4"
                    data-testid={`reward-box-card-${box.box_key}`}
                    style={{
                      borderColor: `${tier.accent}40`,
                      background: `linear-gradient(135deg, ${box.gradient?.[0] || tier.accent}22, rgba(8,12,20,0.85), ${box.gradient?.[1] || tier.accent}12)`,
                      boxShadow: `0 18px 38px -24px ${tier.glow}`,
                    }}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-white/10" data-testid={`reward-box-icon-${box.box_key}`}>
                          <Gem size={28} style={{ color: tier.accent }} />
                        </div>
                        <div>
                          <div className="text-lg font-black text-white">{box.name}</div>
                          <div className="text-sm text-white/60">{box.price_bidcoins} {ui.bidCoins}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(box.rewards || []).slice(0, 3).map((reward, idx) => <RewardChip key={`${box.box_key}-${idx}`} reward={reward} />)}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-stretch gap-2 sm:min-w-[180px]">
                        <button
                          onClick={() => handleOpenBox(box.box_key)}
                          disabled={opening || (!box.can_open_with_bidcoins && !box.premium_can_open_free)}
                          data-testid={`reward-box-open-button-${box.box_key}`}
                          className="rounded-2xl px-4 py-3 text-sm font-black text-[#07111E] disabled:opacity-50"
                          style={{ background: `linear-gradient(135deg, ${tier.accent}, #ffffff)` }}
                        >
                          {opening ? ui.opening : ui.openNow}
                        </button>
                        <div className="text-center text-xs text-white/60" data-testid={`reward-box-meta-${box.box_key}`}>
                          {box.premium_can_open_free ? `${ui.premium} ${ui.freeToday}` : `${box.price_bidcoins} ${ui.bidCoins}`}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className={`${panel} p-5`} data-testid="reward-coupon-list-section">
            <h2 className="mb-4 text-xl font-black">{ui.couponsTitle}</h2>
            <div className="space-y-3">
              {rewardCoupons.map((coupon) => (
                <div key={coupon.coupon_id} className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid={`reward-coupon-card-${coupon.coupon_id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{ui.couponCode}</div>
                      <div className="mt-1 text-lg font-black text-white">{coupon.code}</div>
                      <div className="mt-1 text-sm text-white/55">{coupon.description || `${coupon.value} €`}</div>
                    </div>
                    <div className="rounded-full border border-[#FF74B8]/20 bg-[#FF74B8]/10 px-3 py-1 text-xs font-bold text-[#FF74B8]">{coupon.value} €</div>
                  </div>
                  <div className="mt-3 text-xs text-white/45" data-testid={`reward-coupon-expiry-${coupon.coupon_id}`}>{ui.expires}: {coupon.expires_at?.slice(0, 10)}</div>
                </div>
              ))}
              {!rewardCoupons.length && <div className="text-sm text-white/45">{ui.noCoupons}</div>}
            </div>
          </section>

          <section className={`${panel} p-5`} data-testid="reward-activity-section">
            <h2 className="mb-4 text-xl font-black">{ui.activityTitle}</h2>
            <div className="space-y-3">
              {recentActivity.map((item, idx) => (
                <div key={item.event_id || idx} className="flex items-center justify-between rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-3" data-testid={`reward-activity-item-${idx}`}>
                  <div>
                    <div className="text-sm font-semibold text-white/85">{item.description || item.source_type}</div>
                    <div className="text-xs text-white/45">{item.created_at?.slice(0, 16)?.replace("T", " ")}</div>
                  </div>
                  <div className="text-sm font-black text-[#00D26A]">+{item.bidcoins || 0}</div>
                </div>
              ))}
              {!recentActivity.length && <div className="text-sm text-white/45">{ui.noActivity}</div>}
            </div>
          </section>
        </div>

        {user?.role === "admin" && adminData && (
          <section className={`${panel} p-5`} data-testid="reward-admin-section">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">{ui.adminTitle}</h2>
                <p className="text-sm text-white/55">{ui.audits} · {adminData.stats?.spin_count || 0} Spins · {adminData.stats?.box_open_count || 0} Boxen</p>
              </div>
              <button onClick={handleSaveAdmin} disabled={savingAdmin} data-testid="reward-admin-save-button" className="rounded-2xl bg-[#00C2FF] px-4 py-3 text-sm font-black text-[#07111E] disabled:opacity-50">
                {savingAdmin ? ui.saving : ui.save}
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3 rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid="reward-admin-rewards-config-card">
                <div className="flex items-center gap-2 text-sm font-bold text-white/85"><Gift size={16} className="text-[#FFD766]" /> {ui.rewardsConfig}</div>
                {[
                  ["streak_bonus_3", "Streak Bonus 3"],
                  ["streak_bonus_7", "Streak Bonus 7"],
                  ["streak_bonus_30", "Streak Bonus 30"],
                  ["max_daily_reward_credits", "Max Daily Credits"],
                ].map(([key, label]) => (
                  <label key={key} className="block text-sm text-white/70">
                    <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-white/40">{label}</span>
                    <input
                      type="number"
                      value={adminRewardConfig[key] ?? ""}
                      onChange={(e) => setAdminRewardConfig((prev) => ({ ...prev, [key]: Number(e.target.value || 0) }))}
                      data-testid={`reward-admin-input-${key}`}
                      className="w-full rounded-2xl border border-white/10 bg-[#08101D] px-3 py-3 text-white outline-none"
                    />
                  </label>
                ))}
              </div>

              <div className="space-y-3 rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid="reward-admin-hub-config-card">
                <div className="flex items-center gap-2 text-sm font-bold text-white/85"><Shield size={16} className="text-[#8FEFFF]" /> {ui.rewardHubConfig}</div>
                {[
                  ["free_daily_spins", "Free Daily Spins", "number"],
                  ["premium_daily_spins", "Premium Daily Spins", "number"],
                  ["premium_cashback_multiplier", "Premium Cashback Multiplier", "number"],
                ].map(([key, label, type]) => (
                  <label key={key} className="block text-sm text-white/70">
                    <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-white/40">{label}</span>
                    <input
                      type={type}
                      value={adminHubConfig[key] ?? ""}
                      onChange={(e) => setAdminHubConfig((prev) => ({ ...prev, [key]: Number(e.target.value || 0) }))}
                      data-testid={`reward-admin-input-${key}`}
                      className="w-full rounded-2xl border border-white/10 bg-[#08101D] px-3 py-3 text-white outline-none"
                    />
                  </label>
                ))}
                <button
                  onClick={() => setAdminHubConfig((prev) => ({ ...prev, spin_enabled: !prev.spin_enabled }))}
                  data-testid="reward-admin-toggle-spin-enabled"
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#08101D] px-4 py-3 text-sm font-semibold text-white/85"
                >
                  <span>Spin Enabled</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${adminHubConfig.spin_enabled ? "bg-[#00D26A]/20 text-[#8FFFC2]" : "bg-[#FF6B6B]/20 text-[#FFB3B3]"}`}>{adminHubConfig.spin_enabled ? "ON" : "OFF"}</span>
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid="reward-admin-audits-card">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white/85"><Check size={16} className="text-[#00D26A]" /> {ui.audits}</div>
                <div className="space-y-2">
                  {(adminData.recent_audits || []).slice(0, 8).map((audit, idx) => (
                    <div key={`${audit.timestamp}-${idx}`} className="rounded-2xl border border-white/6 bg-black/20 px-3 py-2" data-testid={`reward-admin-audit-${idx}`}>
                      <div className="text-sm font-semibold text-white/85">{audit.event}</div>
                      <div className="text-xs text-white/45">{audit.timestamp?.slice(0, 16)?.replace("T", " ")}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid="reward-admin-suspicious-card">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white/85"><Star size={16} className="text-[#FF74B8]" /> {ui.suspicious}</div>
                <div className="space-y-2">
                  {(adminData.suspicious_users || []).slice(0, 8).map((row, idx) => (
                    <div key={`${row._id}-${idx}`} className="flex items-center justify-between rounded-2xl border border-white/6 bg-black/20 px-3 py-2" data-testid={`reward-admin-suspicious-${idx}`}>
                      <div className="text-sm text-white/85">{row._id}</div>
                      <div className="text-xs text-white/45">{row.coins || 0} Coins · {row.count || 0} Events</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <AnimatePresence>
        {!!boxReveal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="reward-box-reveal-modal">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} className="w-full max-w-md rounded-[32px] border border-white/10 bg-[#08101D] p-6 text-center shadow-2xl">
              <motion.div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-[28px] border border-[#8FEFFF]/20 bg-[#8FEFFF]/10" animate={{ rotateY: [0, 180, 360], scale: [1, 1.08, 1] }} transition={{ duration: 1.4 }} data-testid="reward-box-reveal-icon">
                <Gift size={42} className="text-[#8FEFFF]" />
              </motion.div>
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">{ui.won}</div>
              <div className="mt-2 text-3xl font-black text-white" data-testid="reward-box-reveal-title">{boxReveal.reward?.label || boxReveal.reward?.coupon?.code}</div>
              {boxReveal.reward?.coupon?.code && <div className="mt-2 text-sm text-[#FF74B8]" data-testid="reward-box-reveal-coupon-code">{boxReveal.reward.coupon.code}</div>}
              <button onClick={() => setBoxReveal(null)} data-testid="reward-box-reveal-close-button" className="mt-5 w-full rounded-2xl bg-[#00C2FF] px-4 py-3 text-sm font-black text-[#07111E]">
                Schließen
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}