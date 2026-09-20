import { Car, Compass, Cpu, Gavel, Gift, ShoppingBag, Wallet } from "lucide-react";
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
    <div className="space-y-5 pb-4 text-white" data-testid="mobile-home-content">
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
        <button type="button" className="min-h-[44px] text-sm text-white/75" onClick={() => onNavigate("/support")}>{t("more.support")}</button>
      </nav>
    </div>
  );
}
