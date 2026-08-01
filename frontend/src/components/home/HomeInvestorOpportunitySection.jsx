import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Blocks,
  Building2,
  FileText,
  Globe2,
  Languages,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
  Wrench,
} from "lucide-react";

const cardIcons = [Wrench, TrendingUp, WalletCards, Languages, Blocks, Rocket];
const allocationIcons = [Wrench, WalletCards, ShieldCheck, Building2, Sparkles, FileText];

export const HomeInvestorOpportunitySection = ({
  gt,
  onInterest,
  onRequestDocuments,
  standalone = false,
}) => {
  const reduceMotion = useReducedMotion();

  const cards = [
    { title: gt("gp.invest_card1_title"), desc: gt("gp.invest_card1_desc") },
    { title: gt("gp.invest_card2_title"), desc: gt("gp.invest_card2_desc") },
    { title: gt("gp.invest_card3_title"), desc: gt("gp.invest_card3_desc") },
    { title: gt("gp.invest_card4_title"), desc: gt("gp.invest_card4_desc") },
    { title: gt("gp.invest_card5_title"), desc: gt("gp.invest_card5_desc") },
    { title: gt("gp.invest_card6_title"), desc: gt("gp.invest_card6_desc") },
  ];

  const allocations = [
    { label: gt("gp.capital_tech"), value: 30, color: "#06B6D4" },
    { label: gt("gp.capital_wallet"), value: 20, color: "#3B82F6" },
    { label: gt("gp.capital_legal"), value: 15, color: "#7DD3FC" },
    { label: gt("gp.capital_merchant"), value: 15, color: "#38BDF8" },
    { label: gt("gp.capital_marketing"), value: 10, color: "#60A5FA" },
    { label: gt("gp.capital_reserve"), value: 10, color: "#93C5FD" },
  ];

  const roadmap = [
    {
      year: "2026",
      items: [
        gt("gp.roadmap_2026_1"),
        gt("gp.roadmap_2026_2"),
        gt("gp.roadmap_2026_3"),
        gt("gp.roadmap_2026_4"),
        gt("gp.roadmap_2026_5"),
      ],
    },
    {
      year: "2027",
      items: [
        gt("gp.roadmap_2027_1"),
        gt("gp.roadmap_2027_2"),
        gt("gp.roadmap_2027_3"),
        gt("gp.roadmap_2027_4"),
      ],
    },
    {
      year: "2028+",
      items: [
        gt("gp.roadmap_2028_1"),
        gt("gp.roadmap_2028_2"),
        gt("gp.roadmap_2028_3"),
      ],
    },
  ];

  return (
    <section
      className={`${standalone ? "" : "mt-7 lg:mt-8"} relative overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.18),transparent_28%),linear-gradient(145deg,rgba(4,8,14,0.98),rgba(6,13,20,0.98)_45%,rgba(4,7,11,1))] px-4 py-6 sm:px-5 sm:py-7 lg:px-8 lg:py-9`}
      data-testid={standalone ? "investor-opportunity-section-page" : "home-investor-opportunity-section"}
    >
      <div className="pointer-events-none absolute -right-16 top-10 h-40 w-40 rounded-full bg-[#06B6D4]/12 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-10 h-36 w-36 rounded-full bg-[#3B82F6]/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36 }}
        className="relative z-10"
      >
        <div
          className="inline-flex items-center gap-2 rounded-full border border-[#06B6D4]/20 bg-[#06B6D4]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#9BE8FF]"
          data-testid="investor-opportunity-badge"
        >
          <Building2 size={12} />
          BIDBLITZ INVEST
        </div>

        <h2
          className="mt-4 max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl"
          data-testid="investor-opportunity-title"
        >
          {gt("gp.invest_title")}
        </h2>
        <p
          className="mt-4 max-w-3xl text-sm leading-6 text-white/72 sm:text-base"
          data-testid="investor-opportunity-support"
        >
          {gt("gp.invest_support")}
        </p>
      </motion.div>

      <div className="relative z-10 mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, index) => {
          const Icon = cardIcons[index] || Building2;
          return (
            <motion.article
              key={card.title}
              className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_16px_34px_rgba(0,0,0,0.22)] backdrop-blur-xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + index * 0.05, duration: 0.34 }}
              data-testid={`investor-opportunity-card-${index + 1}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-[#06B6D4]/12 bg-[#06B6D4]/10 text-[#9BE8FF]">
                  <Icon size={18} />
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black text-white/72">
                  0{index + 1}
                </div>
              </div>
              <h3 className="mt-4 text-[20px] font-black leading-tight text-white" data-testid={`investor-opportunity-card-${index + 1}-title`}>
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/68" data-testid={`investor-opportunity-card-${index + 1}-desc`}>
                {card.desc}
              </p>
            </motion.article>
          );
        })}
      </div>

      <div className="relative z-10 mt-6 grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <motion.div
          className="rounded-[28px] border border-white/8 bg-[#071019]/92 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24, duration: 0.34 }}
          data-testid="investor-capital-section"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#82E7FF]" data-testid="investor-capital-badge">
            Kapital
          </p>
          <h3 className="mt-3 text-[28px] font-black leading-tight text-white" data-testid="investor-capital-title">
            {gt("gp.capital_title")}
          </h3>
          <div className="mt-5 space-y-4">
            {allocations.map((item, index) => {
              const Icon = allocationIcons[index] || Building2;
              return (
                <div key={item.label} data-testid={`investor-capital-row-${index + 1}`}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-white/8 bg-white/5" style={{ color: item.color }}>
                        <Icon size={15} />
                      </div>
                      <span className="text-sm font-semibold text-white/88" data-testid={`investor-capital-label-${index + 1}`}>
                        {item.label}
                      </span>
                    </div>
                    <span className="text-sm font-black text-[#9BE8FF]" data-testid={`investor-capital-value-${index + 1}`}>
                      {item.value} %
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${item.color}, rgba(255,255,255,0.88))` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${item.value}%` }}
                      transition={reduceMotion ? { duration: 0 } : { delay: 0.18 + index * 0.06, duration: 0.65, ease: "easeOut" }}
                      data-testid={`investor-capital-bar-${index + 1}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.34 }}
          data-testid="investor-roadmap-section"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#82E7FF]" data-testid="investor-roadmap-badge">
            Roadmap
          </p>
          <h3 className="mt-3 text-[28px] font-black leading-tight text-white" data-testid="investor-roadmap-title">
            {gt("gp.roadmap_title")}
          </h3>
          <div className="mt-5 space-y-4">
            {roadmap.map((entry, index) => (
              <div
                key={entry.year}
                className="rounded-[22px] border border-white/8 bg-[#06111b]/86 p-4"
                data-testid={`investor-roadmap-card-${index + 1}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 min-w-[76px] items-center justify-center rounded-full border border-[#06B6D4]/18 bg-[#06B6D4]/10 px-4 text-sm font-black text-[#9BE8FF]">
                    {entry.year}
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-[#06B6D4]/30 to-transparent" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {entry.items.map((item, itemIndex) => (
                    <div
                      key={`${entry.year}-${item}`}
                      className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-2 text-xs font-semibold text-white/82"
                      data-testid={`investor-roadmap-card-${index + 1}-item-${itemIndex + 1}`}
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#06B6D4]" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div
        className="relative z-10 mt-6 rounded-[30px] border border-[#06B6D4]/16 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.12),transparent_32%),linear-gradient(145deg,rgba(3,10,15,0.98),rgba(5,11,18,0.98))] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.22)]"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.36, duration: 0.34 }}
        data-testid="investor-opportunity-cta-section"
      >
        <div className="max-w-3xl">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#82E7FF]" data-testid="investor-opportunity-cta-badge">
            Investor Relations
          </p>
          <h3 className="mt-3 text-[28px] font-black leading-tight text-white" data-testid="investor-opportunity-cta-title">
            {gt("gp.invest_cta_title")}
          </h3>
          <p className="mt-3 text-sm leading-6 text-white/72" data-testid="investor-opportunity-cta-text">
            {gt("gp.invest_cta_text")}
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            onClick={onInterest}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#06B6D4] px-5 text-sm font-black text-[#041018] shadow-[0_14px_38px_rgba(6,182,212,0.28)] transition-colors duration-200 hover:bg-[#33c7e0]"
            data-testid="investor-opportunity-interest-button"
          >
            {gt("gp.invest_cta_interest")}
            <ArrowRight size={15} />
          </button>
          <button
            onClick={onRequestDocuments}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 text-sm font-bold text-white backdrop-blur-xl transition-colors duration-200 hover:bg-white/8"
            data-testid="investor-opportunity-documents-button"
          >
            {gt("gp.invest_cta_documents")}
          </button>
        </div>

        <p className="mt-4 max-w-3xl text-xs leading-5 text-[#9BB2C4]" data-testid="investor-opportunity-disclaimer">
          {gt("gp.invest_disclaimer")}
        </p>
      </motion.div>
    </section>
  );
};