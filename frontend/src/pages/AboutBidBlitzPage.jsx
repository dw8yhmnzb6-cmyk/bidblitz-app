import { useI18n } from "../store";
import { useGuestTranslations } from "../models/homeTranslations";
import { getMobileHomeCopy } from "../models/mobileHomeCopy";
import { HomeWhyBidBlitzSection } from "../components/home/HomeWhyBidBlitzSection";
import { HomeVisionSection } from "../components/home/HomeVisionSection";
import { HomeWhyNowSection } from "../components/home/HomeWhyNowSection";

export default function AboutBidBlitzPage({ onNavigate, onRegister }) {
  const { lang, t } = useI18n();
  const gt = useGuestTranslations(lang);
  const copy = getMobileHomeCopy(lang);
  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 text-white" data-testid="about-bidblitz-page">
      <h1 className="mb-6 text-2xl font-bold">{copy.about}</h1>
      <HomeWhyBidBlitzSection gt={gt} />
      <HomeVisionSection gt={gt} onRegister={onRegister} onInvestor={() => onNavigate("/investieren")} />
      <HomeWhyNowSection gt={gt} onInterest={() => onNavigate("/investieren")} onContact={() => onNavigate("/contact")} />
      <button type="button" className="mt-6 min-h-[48px] rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-black" onClick={() => onNavigate("/")}>{t("nav.home")}</button>
    </main>
  );
}
