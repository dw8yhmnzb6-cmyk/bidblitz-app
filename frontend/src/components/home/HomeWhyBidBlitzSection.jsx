import { motion } from "framer-motion";
import {
  Briefcase,
  Building2,
  Car,
  Check,
  CreditCard,
  Hotel,
  MapPinned,
  QrCode,
  ShoppingBag,
  Store,
  Wallet,
  X,
} from "lucide-react";

const cardIcons = [Wallet, Store, CreditCard, Car, Hotel, ShoppingBag, Briefcase, Building2];

export const HomeWhyBidBlitzSection = ({ gt }) => {
  const features = [
    {
      title: gt("gp.why_feature_1_title"),
      points: [gt("gp.why_feature_1_point_1"), gt("gp.why_feature_1_point_2"), gt("gp.why_feature_1_point_3")],
    },
    {
      title: gt("gp.why_feature_2_title"),
      points: [gt("gp.why_feature_2_point_1"), gt("gp.why_feature_2_point_2"), gt("gp.why_feature_2_point_3"), gt("gp.why_feature_2_point_4")],
    },
    {
      title: gt("gp.why_feature_3_title"),
      points: [gt("gp.why_feature_3_point_1"), gt("gp.why_feature_3_point_2"), gt("gp.why_feature_3_point_3")],
    },
    {
      title: gt("gp.why_feature_4_title"),
      points: [gt("gp.why_feature_4_point_1"), gt("gp.why_feature_4_point_2"), gt("gp.why_feature_4_point_3"), gt("gp.why_feature_4_point_4")],
    },
    {
      title: gt("gp.why_feature_5_title"),
      points: [gt("gp.why_feature_5_point_1"), gt("gp.why_feature_5_point_2"), gt("gp.why_feature_5_point_3"), gt("gp.why_feature_5_point_4")],
    },
    {
      title: gt("gp.why_feature_6_title"),
      points: [gt("gp.why_feature_6_point_1"), gt("gp.why_feature_6_point_2"), gt("gp.why_feature_6_point_3"), gt("gp.why_feature_6_point_4")],
    },
    {
      title: gt("gp.why_feature_7_title"),
      points: [gt("gp.why_feature_7_point_1"), gt("gp.why_feature_7_point_2"), gt("gp.why_feature_7_point_3"), gt("gp.why_feature_7_point_4"), gt("gp.why_feature_7_point_5")],
    },
    {
      title: gt("gp.why_feature_8_title"),
      points: [gt("gp.why_feature_8_point_1")],
    },
  ];

  const compareOther = [
    gt("gp.why_compare_other_1"),
    gt("gp.why_compare_other_2"),
    gt("gp.why_compare_other_3"),
    gt("gp.why_compare_other_4"),
  ];

  const compareBidBlitz = [
    gt("gp.why_compare_bidblitz_1"),
    gt("gp.why_compare_bidblitz_2"),
    gt("gp.why_compare_bidblitz_3"),
    gt("gp.why_compare_bidblitz_4"),
  ];

  const audiences = [
    gt("gp.why_audience_1"),
    gt("gp.why_audience_2"),
    gt("gp.why_audience_3"),
    gt("gp.why_audience_4"),
    gt("gp.why_audience_5"),
  ];

  return (
    <section
      className="relative mt-7 overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.15),transparent_28%),linear-gradient(145deg,rgba(4,8,14,0.98),rgba(6,13,20,0.98)_45%,rgba(4,7,11,1))] px-4 py-6 sm:px-5 sm:py-7 lg:mt-8 lg:px-8 lg:py-9"
      data-testid="home-why-bidblitz-section"
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
          data-testid="why-bidblitz-badge"
        >
          <MapPinned size={12} />
          {gt("gp.why_badge")}
        </div>

        <h2
          className="mt-4 max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl"
          data-testid="why-bidblitz-title"
        >
          {gt("gp.why_title")}
        </h2>
        <p
          className="mt-4 max-w-3xl text-sm leading-6 text-white/72 sm:text-base"
          data-testid="why-bidblitz-support"
        >
          {gt("gp.why_support")}
        </p>
      </motion.div>

      <div className="relative z-10 mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {features.map((feature, index) => {
          const Icon = cardIcons[index] || Wallet;
          return (
            <motion.article
              key={feature.title}
              className="group rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_16px_34px_rgba(0,0,0,0.22)] backdrop-blur-xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + index * 0.04, duration: 0.34 }}
              whileHover={{ y: -4, borderColor: "rgba(6,182,212,0.24)" }}
              data-testid={`why-feature-card-${index + 1}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-[18px] border border-[#06B6D4]/12 bg-[#06B6D4]/10 text-[#9BE8FF]">
                  <Icon size={18} />
                  <div className="absolute inset-0 rounded-[18px] bg-[#06B6D4]/8 opacity-0 blur-xl transition-opacity duration-200 group-hover:opacity-100" />
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black text-white/72">
                  0{index + 1}
                </div>
              </div>
              <h3 className="mt-4 text-[20px] font-black leading-tight text-white" data-testid={`why-feature-card-${index + 1}-title`}>
                {feature.title}
              </h3>
              <div className="mt-3 space-y-2">
                {feature.points.map((point, pointIndex) => (
                  <div className="flex items-start gap-2.5 text-sm leading-6 text-white/70" key={`${feature.title}-${point}`} data-testid={`why-feature-card-${index + 1}-point-${pointIndex + 1}`}>
                    <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-[#06B6D4]" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </motion.article>
          );
        })}
      </div>

      <div className="relative z-10 mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        <motion.div
          className="rounded-[28px] border border-white/8 bg-[#071019]/92 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24, duration: 0.34 }}
          data-testid="why-bidblitz-comparison-section"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#82E7FF]" data-testid="why-bidblitz-comparison-badge">
            {gt("gp.why_compare_badge")}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-[24px] border border-white/8 bg-white/5 p-4" data-testid="why-bidblitz-compare-other-apps">
              <div className="flex items-center gap-2 text-white">
                <X size={16} className="text-[#F87171]" />
                <h3 className="text-[18px] font-black">{gt("gp.why_compare_other_title")}</h3>
              </div>
              <div className="mt-4 space-y-3">
                {compareOther.map((item, index) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-white/68" data-testid={`why-bidblitz-compare-other-row-${index + 1}`}>
                    <X size={15} className="mt-1 shrink-0 text-[#F87171]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-[#06B6D4]/16 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.12),transparent_35%),linear-gradient(145deg,rgba(3,10,15,0.98),rgba(5,11,18,0.98))] p-4" data-testid="why-bidblitz-compare-bidblitz">
              <div className="flex items-center gap-2 text-white">
                <Check size={16} className="text-[#06B6D4]" />
                <h3 className="text-[18px] font-black">{gt("gp.why_compare_bidblitz_title")}</h3>
              </div>
              <div className="mt-4 space-y-3">
                {compareBidBlitz.map((item, index) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-white/82" data-testid={`why-bidblitz-compare-bidblitz-row-${index + 1}`}>
                    <Check size={15} className="mt-1 shrink-0 text-[#06B6D4]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.34 }}
          data-testid="why-bidblitz-audience-section"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#82E7FF]" data-testid="why-bidblitz-audience-badge">
            {gt("gp.why_audience_badge")}
          </p>
          <h3 className="mt-3 text-[28px] font-black leading-tight text-white" data-testid="why-bidblitz-audience-title">
            {gt("gp.why_audience_title")}
          </h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {audiences.map((audience, index) => (
              <motion.div
                key={audience}
                className="rounded-[22px] border border-white/8 bg-[#06111B]/86 p-4"
                whileHover={{ y: -3, borderColor: "rgba(6,182,212,0.24)" }}
                data-testid={`why-bidblitz-audience-card-${index + 1}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[#06B6D4]/12 bg-[#06B6D4]/10 text-[#9BE8FF]">
                    {index === 0 && <Wallet size={16} />}
                    {index === 1 && <Building2 size={16} />}
                    {index === 2 && <Store size={16} />}
                    {index === 3 && <Briefcase size={16} />}
                    {index === 4 && <QrCode size={16} />}
                  </div>
                  <span className="text-[16px] font-black text-white">{audience}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};