import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  QrCode,
  ShieldCheck,
  Smartphone,
  UserRound,
  Zap,
} from "lucide-react";

const phoneFrameStyle = {
  background: "linear-gradient(180deg, rgba(8,18,28,0.98), rgba(3,9,14,0.98))",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 28px 70px rgba(0,0,0,0.32)",
};

const trustIconMap = [Zap, ShieldCheck, Clock3];
const stepIconMap = [UserRound, Smartphone, CheckCircle2];

export const P2PHeroSection = ({ gt, onRegister }) => {
  const reduceMotion = useReducedMotion();

  const trustItems = [
    gt("gp.p2p_trust_fast"),
    gt("gp.p2p_trust_secure"),
    gt("gp.p2p_trust_always"),
  ];

  const steps = [
    { title: gt("gp.how_step1_t"), desc: gt("gp.how_step1_d") },
    { title: gt("gp.how_step2_t"), desc: gt("gp.how_step2_d") },
    { title: gt("gp.how_step3_t"), desc: gt("gp.how_step3_d") },
  ];

  const scrollToHow = () => {
    const el = document.getElementById("home-how-it-works");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <section
        className="mb-6 overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(0,194,255,0.18),transparent_26%),linear-gradient(145deg,rgba(5,9,15,0.98),rgba(8,16,25,0.98)_45%,rgba(5,8,12,1))] px-4 pb-6 pt-6 sm:px-5 sm:pb-7 sm:pt-7 lg:mb-8 lg:px-8 lg:pb-8 lg:pt-8"
        data-testid="home-p2p-hero"
      >
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,460px)] lg:items-center lg:gap-10">
          <div style={{ textAlign: "start" }}>
            <motion.div
              className="inline-flex items-center gap-2 rounded-full border border-[#00C2FF]/20 bg-[#00C2FF]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#8BE6FF]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32 }}
              data-testid="home-p2p-hero-badge"
            >
              <QrCode size={12} />
              {gt("gp.p2p_badge")}
            </motion.div>

            <motion.h1
              className="mt-4 text-4xl font-black leading-[0.95] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.36 }}
              data-testid="home-p2p-hero-headline"
            >
              <span className="block">{gt("gp.p2p_headline_1")}</span>
              <span className="mt-1 block text-[#D9F8FF]">{gt("gp.p2p_headline_2")}</span>
              <span className="mt-1 block text-[#00C2FF]">{gt("gp.p2p_headline_3")}</span>
            </motion.h1>

            <motion.p
              className="mt-4 max-w-2xl text-sm leading-6 text-white/74 sm:text-base"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.36 }}
              data-testid="home-p2p-hero-support"
            >
              {gt("gp.p2p_support")}
            </motion.p>
            <motion.p
              className="mt-3 max-w-xl text-xs leading-5 text-[#8BA5B4] sm:text-sm"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16, duration: 0.36 }}
              data-testid="home-p2p-hero-note"
            >
              {gt("gp.p2p_note")}
            </motion.p>

            <motion.div
              className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.36 }}
            >
              <button
                onClick={onRegister}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#00C2FF] px-5 text-sm font-black text-[#041018] shadow-[0_12px_40px_rgba(0,194,255,0.28)]"
                data-testid="home-p2p-hero-primary-button"
              >
                {gt("gp.p2p_primary")}
                <ArrowRight size={15} />
              </button>
              <button
                onClick={scrollToHow}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 text-sm font-bold text-white backdrop-blur-xl"
                data-testid="home-p2p-hero-secondary-button"
              >
                {gt("gp.p2p_secondary")}
              </button>
            </motion.div>

            <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-md sm:gap-3" data-testid="home-p2p-hero-trust-row">
              {trustItems.map((item, index) => {
                const Icon = trustIconMap[index] || ShieldCheck;
                return (
                  <motion.div
                    key={item}
                    className="rounded-[20px] border border-white/8 bg-white/5 px-3 py-3 text-center backdrop-blur-xl"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.26 + index * 0.05, duration: 0.32 }}
                    data-testid={`home-p2p-hero-trust-${index}`}
                  >
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#00C2FF]/12 text-[#8BE6FF]">
                      <Icon size={14} />
                    </div>
                    <span className="text-[11px] font-bold text-white sm:text-xs">{item}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <motion.div
            className="relative rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-3 backdrop-blur-xl sm:p-4"
            initial={{ opacity: 0, scale: 0.98, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.42 }}
            data-testid="home-p2p-hero-demo"
          >
            <div className="pointer-events-none absolute -left-6 top-8 h-20 w-20 rounded-full bg-[#00C2FF]/12 blur-3xl" />
            <div className="pointer-events-none absolute -right-6 bottom-8 h-20 w-20 rounded-full bg-[#00D26A]/10 blur-3xl" />
            <div className="relative grid gap-4 sm:grid-cols-2 sm:items-center sm:gap-5">
              <PhoneMockup
                name="Lena"
                title={gt("gp.p2p_sender_title")}
                amount="50 €"
                status={gt("gp.p2p_sender_status")}
                accent="#00C2FF"
                chipLabel="BidBlitz-ID"
                testid="home-p2p-phone-sender"
              />
              <div className="flex justify-center sm:hidden" data-testid="home-p2p-transfer-pill-mobile-wrap">
                <motion.div
                  className="flex items-center gap-2 rounded-full border border-[#00C2FF]/18 bg-[#06121B]/95 px-4 py-2 text-xs font-black text-[#9EEBFF] shadow-[0_10px_28px_rgba(0,194,255,0.18)]"
                  animate={reduceMotion ? {} : { opacity: [0.84, 1, 0.84] }}
                  transition={reduceMotion ? undefined : { duration: 2.4, ease: "easeInOut", repeat: Infinity }}
                  data-testid="home-p2p-transfer-pill-mobile"
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-[#00C2FF] shadow-[0_0_14px_rgba(0,194,255,0.7)]" />
                  {gt("gp.p2p_transfer_status")}
                </motion.div>
              </div>
              <PhoneMockup
                name="Jonas"
                title={gt("gp.p2p_receiver_title")}
                amount="50 €"
                status={gt("gp.p2p_receiver_status")}
                accent="#00D26A"
                chipLabel="QR-Code"
                received
                testid="home-p2p-phone-receiver"
              />

              <motion.div
                className="pointer-events-none absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 sm:flex"
                animate={reduceMotion ? {} : { x: [0, 12, 24, 12, 0], y: [0, -6, 0, 6, 0], opacity: [0.84, 1, 1, 1, 0.84] }}
                transition={reduceMotion ? undefined : { duration: 2.7, ease: "easeInOut", repeat: Infinity }}
                data-testid="home-p2p-transfer-pill"
              >
                <div className="rounded-full border border-[#00C2FF]/18 bg-[#06121B]/95 px-4 py-2 text-xs font-black text-[#9EEBFF] shadow-[0_10px_28px_rgba(0,194,255,0.18)]">
                  {gt("gp.p2p_transfer_status")}
                </div>
                <div className="h-2 w-2 rounded-full bg-[#00C2FF] shadow-[0_0_16px_rgba(0,194,255,0.7)]" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <section
        id="home-how-it-works"
        className="mb-7 rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-4 py-5 backdrop-blur-xl sm:px-5 sm:py-6 lg:mb-8 lg:px-6"
        data-testid="home-how-it-works"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.34 }}
        >
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#7EDFFF]" data-testid="home-how-it-works-badge">
            {gt("gp.p2p_badge")}
          </p>
          <h2 className="mt-3 text-[28px] font-black leading-tight text-white sm:text-[32px]" data-testid="home-how-it-works-title">
            {gt("gp.how_title")}
          </h2>
        </motion.div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = stepIconMap[index] || Smartphone;
            return (
              <motion.div
                key={step.title}
                className="rounded-[24px] border border-white/8 bg-[#06111B]/88 p-4 shadow-[0_12px_26px_rgba(0,0,0,0.2)]"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + index * 0.06, duration: 0.34 }}
                data-testid={`home-how-step-${index + 1}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#00C2FF]/12 text-[#8BE6FF]">
                    <Icon size={18} />
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black text-white/74">
                    0{index + 1}
                  </div>
                </div>
                <h3 className="mt-4 text-[18px] font-black leading-tight text-white" data-testid={`home-how-step-${index + 1}-title`}>
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/68" data-testid={`home-how-step-${index + 1}-desc`}>
                  {step.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>
    </>
  );
};

const PhoneMockup = ({ name, title, amount, status, accent, chipLabel, received = false, testid }) => {
  return (
    <div className="relative mx-auto w-full max-w-[248px] rounded-[32px] border border-white/10 bg-[#02070B] p-2.5" style={phoneFrameStyle} data-testid={testid}>
      <div className="mx-auto mb-2 h-1.5 w-20 rounded-full bg-white/12" />
      <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,16,24,0.96),rgba(4,9,14,0.98))] px-4 pb-4 pt-3.5">
        <div className="flex items-center justify-between text-[11px] text-white/68">
          <span>09:41</span>
          <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[10px] font-bold text-white/86">{chipLabel}</span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/5 text-lg font-black text-white">
            {name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-white/58">{received ? "Empfänger" : "Sender"}</p>
            <p className="mt-1 truncate text-lg font-black text-white">{name}</p>
            <p className="mt-1 text-[12px] font-medium text-white/72">{title}</p>
          </div>
        </div>

        <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.06] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/62">BidBlitz Wallet</p>
            <div className="rounded-full px-3 py-1 text-[11px] font-black" style={{ background: `${accent}18`, color: accent }}>
              {received ? "Empfangen" : "Senden"}
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="text-[32px] font-black leading-none text-white">{amount}</p>
            <span className="text-[11px] font-semibold text-white/56">EUR</span>
          </div>
          <p className="mt-2.5 text-[14px] font-semibold leading-5" style={{ color: received ? "#88F7B7" : "#8EDFFF" }} data-testid={`${testid}-status`}>
            {status}
          </p>
        </div>

        <div className="mt-3.5 flex items-center gap-2 text-[12px] text-white/68">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5">
            <Smartphone size={14} />
          </span>
          <span className="font-medium">{received ? "BidBlitz Wallet aktiv" : "Telefonnummer / BidBlitz-ID"}</span>
        </div>
      </div>
    </div>
  );
};
