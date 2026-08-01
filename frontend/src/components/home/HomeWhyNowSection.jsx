import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Globe2,
  Lightbulb,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wallet,
} from "lucide-react";

const progressMeta = {
  completed: { badge: "gp.why_now_state_completed", barClass: "from-emerald-400 to-emerald-200", railClass: "bg-emerald-500/12", width: "100%", icon: CheckCircle2 },
  advanced: { badge: "gp.why_now_state_advanced", barClass: "from-[#06B6D4] to-[#9BE8FF]", railClass: "bg-[#06B6D4]/12", width: "86%", icon: Rocket },
  beta: { badge: "gp.why_now_state_beta", barClass: "from-[#3B82F6] to-[#93C5FD]", railClass: "bg-[#3B82F6]/12", width: "74%", icon: Sparkles },
  in_progress: { badge: "gp.why_now_state_in_progress", barClass: "from-amber-400 to-amber-200", railClass: "bg-amber-500/12", width: "56%", icon: Target },
  planned: { badge: "gp.why_now_state_planned", barClass: "from-white/80 to-white/45", railClass: "bg-white/8", width: "34%", icon: Users },
  long_term: { badge: "gp.why_now_state_long_term", barClass: "from-violet-400 to-violet-200", railClass: "bg-violet-500/12", width: "18%", icon: Globe2 },
};

const cardIcons = [Lightbulb, Target, Wallet, Globe2];
const focusIcons = [Sparkles, Users, ShieldCheck, Building2, Rocket, Globe2];

export const HomeWhyNowSection = ({ gt, onInterest, onContact }) => {
  const progressItems = [
    ["gp.why_now_progress_1_label", "completed"],
    ["gp.why_now_progress_2_label", "advanced"],
    ["gp.why_now_progress_3_label", "beta"],
    ["gp.why_now_progress_4_label", "beta"],
    ["gp.why_now_progress_5_label", "beta"],
    ["gp.why_now_progress_6_label", "beta"],
    ["gp.why_now_progress_7_label", "in_progress"],
    ["gp.why_now_progress_8_label", "planned"],
    ["gp.why_now_progress_9_label", "planned"],
    ["gp.why_now_progress_10_label", "long_term"],
  ];

  const whyNowCards = [
    { title: gt("gp.why_now_card_1_title"), desc: gt("gp.why_now_card_1_desc") },
    { title: gt("gp.why_now_card_2_title"), desc: gt("gp.why_now_card_2_desc") },
    { title: gt("gp.why_now_card_3_title"), desc: gt("gp.why_now_card_3_desc") },
    { title: gt("gp.why_now_card_4_title"), desc: gt("gp.why_now_card_4_desc") },
  ];

  const milestones = [
    gt("gp.why_now_milestone_1"),
    gt("gp.why_now_milestone_2"),
    gt("gp.why_now_milestone_3"),
    gt("gp.why_now_milestone_4"),
    gt("gp.why_now_milestone_5"),
    gt("gp.why_now_milestone_6"),
  ];

  const focusItems = [
    gt("gp.why_now_focus_1"),
    gt("gp.why_now_focus_2"),
    gt("gp.why_now_focus_3"),
    gt("gp.why_now_focus_4"),
    gt("gp.why_now_focus_5"),
    gt("gp.why_now_focus_6"),
  ];

  return (
    <section
      className="relative mt-7 overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_26%),linear-gradient(145deg,rgba(4,8,14,0.99),rgba(6,13,20,0.98)_45%,rgba(4,7,11,1))] px-4 py-6 sm:px-5 sm:py-7 lg:mt-8 lg:px-8 lg:py-9"
      data-testid="home-why-now-section"
    >
      <div className="pointer-events-none absolute -right-16 top-10 h-40 w-40 rounded-full bg-[#06B6D4]/12 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-10 h-36 w-36 rounded-full bg-[#3B82F6]/10 blur-3xl" />

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.34 }} className="relative z-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#06B6D4]/20 bg-[#06B6D4]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#9BE8FF]" data-testid="why-now-badge">
          <Rocket size={12} />
          {gt("gp.why_now_badge")}
        </div>
        <h2 className="mt-4 max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl" data-testid="why-now-title">
          {gt("gp.why_now_title")}
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-white/72 sm:text-base" data-testid="why-now-support">
          {gt("gp.why_now_support")}
        </p>
      </motion.div>

      <div className="relative z-10 mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        <motion.div className="rounded-[30px] border border-white/8 bg-[#071019]/92 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.34 }} data-testid="why-now-progress-section">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-[#06B6D4]/50 to-transparent" />
            <h3 className="text-[24px] font-black text-white sm:text-[30px]" data-testid="why-now-progress-title">
              {gt("gp.why_now_progress_title")}
            </h3>
          </div>
          <div className="mt-5 space-y-3">
            {progressItems.map(([labelKey, stateKey], index) => {
              const meta = progressMeta[stateKey];
              const Icon = meta.icon;
              return (
                <motion.div
                  key={labelKey}
                  className="rounded-[22px] border border-white/8 bg-white/5 p-4"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12 + index * 0.04, duration: 0.28 }}
                  data-testid={`why-now-progress-item-${index + 1}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-white/8 bg-[#041018]/70 text-[#9BE8FF]">
                        <Icon size={16} />
                      </div>
                      <span className="truncate text-sm font-bold text-white/88" data-testid={`why-now-progress-label-${index + 1}`}>
                        {gt(labelKey)}
                      </span>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${meta.railClass} border-white/10 text-white/82`} data-testid={`why-now-progress-state-${index + 1}`}>
                      {gt(meta.badge)}
                    </span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/8">
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r ${meta.barClass}`}
                      initial={{ width: 0 }}
                      animate={{ width: meta.width }}
                      transition={{ delay: 0.18 + index * 0.04, duration: 0.55, ease: "easeOut" }}
                      data-testid={`why-now-progress-bar-${index + 1}`}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div className="rounded-[30px] border border-[#06B6D4]/16 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.12),transparent_34%),linear-gradient(145deg,rgba(3,10,15,0.98),rgba(5,11,18,0.98))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.34 }} data-testid="why-now-cards-section">
          <h3 className="text-[24px] font-black text-white sm:text-[30px]" data-testid="why-now-cards-title">
            {gt("gp.why_now_cards_title")}
          </h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {whyNowCards.map((card, index) => {
              const Icon = cardIcons[index] || Lightbulb;
              return (
                <motion.article
                  key={card.title}
                  className="rounded-[22px] border border-white/8 bg-white/5 p-4"
                  whileHover={{ y: -4, borderColor: "rgba(6,182,212,0.24)" }}
                  data-testid={`why-now-card-${index + 1}`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[#06B6D4]/12 bg-[#06B6D4]/10 text-[#9BE8FF]">
                    <Icon size={16} />
                  </div>
                  <h4 className="mt-3 text-[18px] font-black text-white" data-testid={`why-now-card-${index + 1}-title`}>{card.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-white/70" data-testid={`why-now-card-${index + 1}-desc`}>{card.desc}</p>
                </motion.article>
              );
            })}
          </div>
        </motion.div>
      </div>

      <div className="relative z-10 mt-6 grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <motion.div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.34 }} data-testid="why-now-milestones-section">
          <h3 className="text-[24px] font-black text-white sm:text-[30px]" data-testid="why-now-milestones-title">{gt("gp.why_now_milestones_title")}</h3>
          <div className="mt-5 space-y-3">
            {milestones.map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-[20px] border border-white/8 bg-[#071019]/88 p-4" data-testid={`why-now-milestone-${index + 1}`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#06B6D4]/12 bg-[#06B6D4]/10 text-sm font-black text-[#9BE8FF]">
                  {index + 1}
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-[#06B6D4]/30 to-transparent" />
                <div className="min-w-0 flex-1 text-sm font-bold text-white/82">{item}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div className="rounded-[28px] border border-white/8 bg-[#071019]/92 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26, duration: 0.34 }} data-testid="why-now-focus-section">
          <h3 className="text-[24px] font-black text-white sm:text-[30px]" data-testid="why-now-focus-title">{gt("gp.why_now_focus_title")}</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {focusItems.map((item, index) => {
              const Icon = focusIcons[index] || Sparkles;
              return (
                <motion.div key={item} className="rounded-[22px] border border-white/8 bg-white/5 p-4" whileHover={{ y: -3, borderColor: "rgba(6,182,212,0.24)" }} data-testid={`why-now-focus-card-${index + 1}`}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[#06B6D4]/12 bg-[#06B6D4]/10 text-[#9BE8FF]">
                    <Icon size={16} />
                  </div>
                  <p className="mt-3 text-sm font-bold leading-6 text-white/82">{item}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      <motion.div className="relative z-10 mt-6 rounded-[30px] border border-[#06B6D4]/16 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.12),transparent_32%),linear-gradient(145deg,rgba(3,10,15,0.98),rgba(5,11,18,0.98))] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.22)]" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34, duration: 0.34 }} data-testid="why-now-cta-section">
        <div className="max-w-3xl">
          <h3 className="text-[28px] font-black leading-tight text-white" data-testid="why-now-cta-title">{gt("gp.why_now_cta_title")}</h3>
          <p className="mt-3 text-sm leading-6 text-white/72" data-testid="why-now-cta-support">{gt("gp.why_now_cta_support")}</p>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button onClick={onInterest} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#06B6D4] px-5 text-sm font-black text-[#041018] shadow-[0_14px_38px_rgba(6,182,212,0.28)] transition-colors duration-200 hover:bg-[#33c7e0]" data-testid="why-now-interest-button">
            {gt("gp.why_now_cta_interest")}
            <ArrowRight size={15} />
          </button>
          <button onClick={onContact} className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 text-sm font-bold text-white backdrop-blur-xl transition-colors duration-200 hover:bg-white/8" data-testid="why-now-contact-button">
            {gt("gp.why_now_cta_contact")}
          </button>
        </div>
      </motion.div>
    </section>
  );
};