import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Briefcase,
  Building2,
  CheckCircle2,
  Globe2,
  Layers3,
  Lightbulb,
  Lock,
  QrCode,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Wallet,
} from "lucide-react";

const missionIcons = [Wallet, Sparkles, Globe2, Rocket];
const valueIcons = [ShieldCheck, Lock, Lightbulb, Layers3, BadgeCheck, Briefcase];
const standardIcons = [Building2, Sparkles, ShieldCheck, Rocket, Globe2];

export const HomeVisionSection = ({ gt, onRegister, onInvestor }) => {
  const missionCards = [
    { title: gt("gp.vision_mission_1_title"), desc: gt("gp.vision_mission_1_desc") },
    { title: gt("gp.vision_mission_2_title"), desc: gt("gp.vision_mission_2_desc") },
    { title: gt("gp.vision_mission_3_title"), desc: gt("gp.vision_mission_3_desc") },
    { title: gt("gp.vision_mission_4_title"), desc: gt("gp.vision_mission_4_desc") },
  ];

  const phases = [
    {
      title: gt("gp.vision_phase_1_title"),
      items: [
        gt("gp.vision_phase_1_item_1"),
        gt("gp.vision_phase_1_item_2"),
        gt("gp.vision_phase_1_item_3"),
        gt("gp.vision_phase_1_item_4"),
        gt("gp.vision_phase_1_item_5"),
        gt("gp.vision_phase_1_item_6"),
      ],
    },
    {
      title: gt("gp.vision_phase_2_title"),
      items: [
        gt("gp.vision_phase_2_item_1"),
        gt("gp.vision_phase_2_item_2"),
        gt("gp.vision_phase_2_item_3"),
        gt("gp.vision_phase_2_item_4"),
      ],
    },
    {
      title: gt("gp.vision_phase_3_title"),
      items: [
        gt("gp.vision_phase_3_item_1"),
        gt("gp.vision_phase_3_item_2"),
        gt("gp.vision_phase_3_item_3"),
      ],
    },
  ];

  const values = [
    gt("gp.vision_value_1"),
    gt("gp.vision_value_2"),
    gt("gp.vision_value_3"),
    gt("gp.vision_value_4"),
    gt("gp.vision_value_5"),
    gt("gp.vision_value_6"),
  ];

  const standards = [
    gt("gp.vision_standard_1"),
    gt("gp.vision_standard_2"),
    gt("gp.vision_standard_3"),
    gt("gp.vision_standard_4"),
    gt("gp.vision_standard_5"),
  ];

  return (
    <section
      className="relative mt-7 overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.17),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_24%),linear-gradient(145deg,rgba(4,8,14,0.99),rgba(6,13,20,0.98)_45%,rgba(4,7,11,1))] px-4 py-6 sm:px-5 sm:py-7 lg:mt-8 lg:px-8 lg:py-9"
      data-testid="home-vision-section"
    >
      <div className="pointer-events-none absolute -right-16 top-10 h-40 w-40 rounded-full bg-[#06B6D4]/12 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-10 h-36 w-36 rounded-full bg-[#3B82F6]/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34 }}
        className="relative z-10"
      >
        <div
          className="inline-flex items-center gap-2 rounded-full border border-[#06B6D4]/20 bg-[#06B6D4]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#9BE8FF]"
          data-testid="vision-badge"
        >
          <Star size={12} />
          {gt("gp.vision_badge")}
        </div>
        <h2
          className="mt-4 max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl"
          data-testid="vision-title"
        >
          {gt("gp.vision_title")}
        </h2>
        <p
          className="mt-4 max-w-3xl text-sm leading-6 text-white/72 sm:text-base"
          data-testid="vision-support"
        >
          {gt("gp.vision_support")}
        </p>
      </motion.div>

      <div className="relative z-10 mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-[#06B6D4]/50 to-transparent" />
          <h3 className="text-[24px] font-black text-white sm:text-[30px]" data-testid="vision-mission-title">
            {gt("gp.vision_mission_title")}
          </h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {missionCards.map((card, index) => {
            const Icon = missionIcons[index] || Wallet;
            return (
              <motion.article
                key={card.title}
                className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_16px_34px_rgba(0,0,0,0.22)] backdrop-blur-xl"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + index * 0.04, duration: 0.34 }}
                whileHover={{ y: -4, borderColor: "rgba(6,182,212,0.24)" }}
                data-testid={`vision-mission-card-${index + 1}`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-[#06B6D4]/12 bg-[#06B6D4]/10 text-[#9BE8FF]">
                  <Icon size={18} />
                </div>
                <h4 className="mt-4 text-[20px] font-black leading-tight text-white" data-testid={`vision-mission-card-${index + 1}-title`}>
                  {card.title}
                </h4>
                <p className="mt-2 text-sm leading-6 text-white/70" data-testid={`vision-mission-card-${index + 1}-desc`}>
                  {card.desc}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 mt-6 rounded-[30px] border border-white/8 bg-[#071019]/92 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]" data-testid="vision-roadmap-section">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-[#06B6D4]/50 to-transparent" />
          <h3 className="text-[24px] font-black text-white sm:text-[30px]" data-testid="vision-roadmap-title">
            {gt("gp.vision_roadmap_title")}
          </h3>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {phases.map((phase, index) => (
            <motion.div
              key={phase.title}
              className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 + index * 0.06, duration: 0.34 }}
              data-testid={`vision-roadmap-phase-${index + 1}`}
            >
              <div className="inline-flex rounded-full border border-[#06B6D4]/18 bg-[#06B6D4]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#9BE8FF]">
                {phase.title}
              </div>
              <div className="mt-4 space-y-2.5">
                {phase.items.map((item, itemIndex) => (
                  <div key={`${phase.title}-${item}`} className="flex items-start gap-2.5 text-sm leading-6 text-white/75" data-testid={`vision-roadmap-phase-${index + 1}-item-${itemIndex + 1}`}>
                    <CheckCircle2 size={15} className="mt-1 shrink-0 text-[#06B6D4]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-6 grid gap-4 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
        <motion.div
          className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.34 }}
          data-testid="vision-values-section"
        >
          <h3 className="text-[24px] font-black text-white sm:text-[30px]" data-testid="vision-values-title">
            {gt("gp.vision_values_title")}
          </h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {values.map((value, index) => {
              const Icon = valueIcons[index] || ShieldCheck;
              return (
                <motion.div
                  key={value}
                  className="rounded-[22px] border border-white/8 bg-[#06111B]/86 p-4"
                  whileHover={{ y: -3, borderColor: "rgba(6,182,212,0.24)" }}
                  data-testid={`vision-value-card-${index + 1}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[#06B6D4]/12 bg-[#06B6D4]/10 text-[#9BE8FF]">
                      <Icon size={16} />
                    </div>
                    <span className="text-[16px] font-black text-white">{value}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          className="rounded-[28px] border border-[#06B6D4]/16 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.12),transparent_34%),linear-gradient(145deg,rgba(3,10,15,0.98),rgba(5,11,18,0.98))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.34 }}
          data-testid="vision-why-build-section"
        >
          <h3 className="text-[24px] font-black text-white sm:text-[30px]" data-testid="vision-why-build-title">
            {gt("gp.vision_why_build_title")}
          </h3>
          <p className="mt-4 text-sm leading-7 text-white/76" data-testid="vision-why-build-support">
            {gt("gp.vision_why_build_support")}
          </p>
        </motion.div>
      </div>

      <div className="relative z-10 mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
        <motion.div
          className="rounded-[28px] border border-white/8 bg-[#071019]/92 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.34 }}
          data-testid="vision-standards-section"
        >
          <h3 className="text-[24px] font-black text-white sm:text-[30px]" data-testid="vision-standards-title">
            {gt("gp.vision_standards_title")}
          </h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {standards.map((item, index) => {
              const Icon = standardIcons[index] || Building2;
              return (
                <motion.div
                  key={item}
                  className="rounded-[22px] border border-white/8 bg-white/5 p-4"
                  whileHover={{ y: -3, borderColor: "rgba(6,182,212,0.24)" }}
                  data-testid={`vision-standard-card-${index + 1}`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[#06B6D4]/12 bg-[#06B6D4]/10 text-[#9BE8FF]">
                    <Icon size={16} />
                  </div>
                  <p className="mt-3 text-sm font-bold leading-6 text-white/82">{item}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          className="rounded-[30px] border border-[#06B6D4]/16 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.12),transparent_32%),linear-gradient(145deg,rgba(3,10,15,0.98),rgba(5,11,18,0.98))] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.22)]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.46, duration: 0.34 }}
          data-testid="vision-cta-section"
        >
          <h3 className="text-[28px] font-black leading-tight text-white" data-testid="vision-cta-title">
            {gt("gp.vision_cta_title")}
          </h3>
          <p className="mt-3 text-sm leading-6 text-white/72" data-testid="vision-cta-support">
            {gt("gp.vision_cta_support")}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              onClick={onRegister}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#06B6D4] px-5 text-sm font-black text-[#041018] shadow-[0_14px_38px_rgba(6,182,212,0.28)] transition-colors duration-200 hover:bg-[#33c7e0]"
              data-testid="vision-cta-start-button"
            >
              {gt("gp.vision_cta_start")}
              <ArrowRight size={15} />
            </button>
            <button
              onClick={onInvestor}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 text-sm font-bold text-white backdrop-blur-xl transition-colors duration-200 hover:bg-white/8"
              data-testid="vision-cta-investor-button"
            >
              {gt("gp.vision_cta_investor")}
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};