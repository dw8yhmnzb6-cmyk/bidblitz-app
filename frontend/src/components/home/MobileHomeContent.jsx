import { Car, ChevronRight, Compass, Cpu, Gavel, Gift, ShoppingBag, Star, Wallet, Zap } from "lucide-react";
import { useI18n, useWallet } from "../../store";
import { getMobileHomeCopy } from "../../models/mobileHomeCopy";
import { filterStoreSafeItems } from "../../config/release";

const panel = "rounded-2xl border border-white/10 bg-white/[0.04]";
const action = "min-h-[48px] rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00C2FF]";

export default function MobileHomeContent({ isGuest, onNavigate, onRegister, onLogin, gt, balanceHidden = false }) {
  const { t, lang } = useI18n();
  const { transactions, currency, isLoading, error } = useWallet();
  const copy = getMobileHomeCopy(lang);
  const recent = [...(transactions || [])].sort((a, b) => {
    const date = value => Date.parse(value) || 0;
    return date(b.date) - date(a.date);
  }).slice(0, 3);
  const services = filterStoreSafeItems([
    { id: "auctions", label: t("home.f_auctions") || "Auktionen", icon: Gavel, route: "/auctions" },
    { id: "mining", label: t("home.f_mining") || "Mining", icon: Cpu, route: "/mining" },
    { id: "mobility", label: t("home.mobility_center"), icon: Car, route: "/mobility-center" },
    { id: "marketplace", label: t("home.f_marketplace"), icon: ShoppingBag, route: "/marketplace" },
    { id: "rewards", label: copy.rewards, icon: Gift, route: "/loyalty" },
    { id: "all-services", label: t("home.all_services"), icon: Compass, route: "/all-services" },
  ]);
  const miningVisible = services.some(service => service.id === "mining");
  const getTransactionRoute = transaction => {
    const haystack = [
      transaction?.type,
      transaction?.category,
      transaction?.merchantName,
      transaction?.description,
      transaction?.reference,
    ].filter(Boolean).join(" ").toLowerCase();

    if (haystack.includes("mining") || haystack.includes("miner") || haystack.includes("blz")) return "/mining";
    if (haystack.includes("auction") || haystack.includes("auktion") || haystack.includes("bid credit")) return "/auctions";
    if (haystack.includes("taxi") || haystack.includes("scooter") || haystack.includes("mobility") || haystack.includes("ride") || haystack.includes("ev charging")) return "/mobility-center";
    if (haystack.includes("marketplace")) return "/marketplace";
    if (haystack.includes("reward") || haystack.includes("loyalty") || haystack.includes("präm")) return "/loyalty";
    return "/wallet";
  };

  const formatAmount = amount => {
    if (balanceHidden) return "••••";
    const value = Number(amount);
    if (!Number.isFinite(value)) return "—";
    return new Intl.NumberFormat(lang, { style: "currency", currency: currency || "EUR" }).format(value);
  };

  return (
    <div className="space-y-5 pb-32 text-white" data-testid="mobile-home-content">
      {isGuest && (
        <section className={panel + " p-5"} data-testid="mobile-home-intro">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">BidBlitz Wallet</p>
          <h1 className="mt-3 text-[30px] font-bold leading-tight">
            {gt("gp.p2p_headline_1")} {gt("gp.p2p_headline_2")}
          </h1>
          <p className="mt-3 text-base leading-6 text-white/75">{copy.intro}</p>
          <div className="mt-5 flex flex-col gap-2">
            <button type="button" className={action + " bg-[#00C2FF] text-black"} onClick={onRegister}>
              {t("auth.register")}
            </button>
            <button type="button" className={action + " border border-white/15 text-white"} onClick={onLogin}>
              {t("auth.signin")}
            </button>
          </div>
        </section>
      )}

      {miningVisible && (
        <section
          className="overflow-hidden rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/[0.09] via-cyan-400/[0.05] to-amber-300/[0.05] p-4"
          data-testid="mobile-home-mining-spotlight"
          aria-labelledby="mobile-mining-title"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10">
              <Cpu size={21} className="text-emerald-300" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="mobile-mining-title" className="text-base font-black text-white">Mining</h2>
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-amber-200">
                  Preview
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-white/60">
                Level, Mining-Power und beliebte Miner direkt ansehen.
              </p>
            </div>
          </div>
  
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {[
              ["Bronze", "#CD7F32"],
              ["Silber", "#C0C0C0"],
              ["Gold", "#FFD700"],
              ["Platin", "#E5E4E2"],
              ["Diamant", "#B9F2FF"],
            ].map(([label, color], index) => (
              <div key={label} className="min-w-0 rounded-xl border border-white/[0.06] bg-black/10 px-1 py-2 text-center">
                <Star size={11} className="mx-auto mb-1" style={{ color }} aria-hidden="true" />
                <p className="truncate text-[8px] font-bold" style={{ color }}>{label}</p>
                {index === 0 && <p className="mt-0.5 text-[7px] font-semibold text-white/30">START</p>}
              </div>
            ))}
          </div>
  
          <button
            type="button"
            onClick={() => onNavigate("/mining")}
            data-testid="mobile-home-mining-open"
            className="mt-3 flex min-h-[48px] w-full items-center justify-between rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2">
              <Zap size={15} className="text-[#00E89D]" aria-hidden="true" />
              <span>
                <span className="block text-[11px] font-black text-white">Mining öffnen</span>
                <span className="block text-[8px] text-white/40">Menü, Level und Quick-Buy</span>
              </span>
            </span>
            <ChevronRight size={16} className="text-emerald-300" aria-hidden="true" />
          </button>
        </section>
      )}

      <section aria-labelledby="mobile-services-title">
        <h2 id="mobile-services-title" className="mb-3 text-base font-semibold">{copy.services}</h2>
        <div className="grid grid-cols-2 gap-3">
          {services.map(({ label, icon: Icon, route }) => (
            <button type="button" key={route} className={panel + " flex min-h-[88px] flex-col items-start gap-3 p-4 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"}
              onClick={() => onNavigate(route)} data-testid={"mobile-service-" + route.slice(1)}>
              <Icon size={22} className="text-cyan-300" aria-hidden="true" />
              <span className="text-sm font-semibold leading-5">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {!isGuest && (
        <section className={panel + " p-4"} data-testid="mobile-home-activity">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{copy.activity}</h2>
            <button type="button" className="min-h-[44px] text-sm font-semibold text-cyan-300" onClick={() => onNavigate("/wallet")}>{copy.all}</button>
          </div>
          {isLoading || error ? (
            <button type="button" className={action + " mt-2 w-full border border-white/10"} onClick={() => onNavigate("/wallet")}>{t("nav.wallet")}</button>
          ) : recent.length === 0 ? (
            <p className="py-3 text-sm text-white/65">{copy.empty}</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {recent.map((transaction, index) => (
                <li key={transaction.id || index}>
                  <button type="button" onClick={() => onNavigate(getTransactionRoute(transaction))} className="flex min-h-[60px] w-full items-center gap-3 py-3 text-start" data-testid="mobile-recent-transaction">
                    <Wallet size={18} className="shrink-0 text-cyan-300" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm">{transaction.merchantName || transaction.description || t("nav.wallet")}</span>
                    <span className="shrink-0 text-sm font-semibold" dir="ltr">{formatAmount(transaction.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <nav aria-label={t("nav.more")} className="flex flex-wrap gap-x-5 gap-y-1 border-t border-white/10 pt-2">
        <button type="button" className="min-h-[44px] text-sm text-white/75" onClick={() => onNavigate("/about-bidblitz")}>{copy.about}</button>
        <button type="button" className="min-h-[44px] text-sm text-white/75" onClick={() => onNavigate("/merchant-landing")}>{t("home.f_merchant")}</button>
        <button type="button" className="min-h-[44px] text-sm text-white/75" onClick={() => onNavigate("/investieren")}>{copy.investors}</button>
        <button type="button" className="min-h-[44px] text-sm text-white/75" onClick={() => onNavigate("/support")} data-testid="mobile-home-support-link">{t("more.support")}</button>
      </nav>
    </div>
  );
}
