import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Search, ChevronDown, ChevronUp,
  CreditCard, Shield, User, Store, Send, MessageCircle,
  HelpCircle, BookOpen, Headphones
} from "lucide-react";
import { useI18n } from "../store";

const slide = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

const CATEGORIES = [
  { id: "payments", icon: CreditCard, color: "#00C2FF" },
  { id: "account", icon: User, color: "#A855F7" },
  { id: "security", icon: Shield, color: "#00D26A" },
  { id: "merchant", icon: Store, color: "#FFB800" },
];

const FAQ_KEYS = {
  payments: ["faq_pay_1", "faq_pay_2", "faq_pay_3"],
  account: ["faq_acc_1", "faq_acc_2", "faq_acc_3"],
  security: ["faq_sec_1", "faq_sec_2", "faq_sec_3"],
  merchant: ["faq_mer_1", "faq_mer_2", "faq_mer_3"],
};

// Single FAQ accordion item
const FaqItem = ({ questionKey, answerKey, t }) => {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      data-testid={`faq-item-${questionKey}`}
      className="border-b border-white/[0.03] last:border-b-0"
      initial={false}
    >
      <button
        data-testid={`faq-toggle-${questionKey}`}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left group"
        onClick={() => setOpen(!open)}
      >
        <span className="text-[13px] font-medium text-white/85 group-hover:text-white transition-colors pr-3">
          {t(`support.${questionKey}_q`)}
        </span>
        {open ? (
          <ChevronUp size={14} className="text-[#444] flex-shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-[#444] flex-shrink-0" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-4 pb-3.5 text-[12px] text-[#555] leading-relaxed">
              {t(`support.${questionKey}_a`)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Contact form
const ContactForm = ({ t }) => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSend = (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSent(true);
    setTimeout(() => { setSent(false); setSubject(""); setMessage(""); }, 3000);
  };

  return (
    <motion.form
      data-testid="support-contact-form"
      onSubmit={handleSend}
      className="rounded-2xl overflow-hidden p-4 space-y-3"
      style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22, ...slide }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Headphones size={14} className="text-[#00C2FF]" />
        <span className="text-[13px] font-semibold text-white/90">{t("support.contact_title")}</span>
      </div>
      <input
        data-testid="support-subject-input"
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder={t("support.subject_placeholder")}
        className="w-full px-3 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-[#333] font-medium outline-none"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
      />
      <textarea
        data-testid="support-message-input"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t("support.message_placeholder")}
        rows={4}
        className="w-full px-3 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-[#333] font-medium outline-none resize-none"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
      />
      <motion.button
        data-testid="support-send-btn"
        type="submit"
        disabled={sent}
        className="w-full py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors"
        style={{
          background: sent ? "rgba(0,210,106,0.1)" : "rgba(0,194,255,0.1)",
          border: `1px solid ${sent ? "rgba(0,210,106,0.2)" : "rgba(0,194,255,0.15)"}`,
          color: sent ? "#00D26A" : "#00C2FF",
        }}
        whileTap={{ scale: 0.97 }}
      >
        {sent ? (
          <>{t("support.sent")}</>
        ) : (
          <><Send size={13} /> {t("support.send_btn")}</>
        )}
      </motion.button>
    </motion.form>
  );
};

export const SupportPage = ({ onBack }) => {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);

  // Filter FAQs by search
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return activeCategory ? [activeCategory] : Object.keys(FAQ_KEYS);
    const term = search.toLowerCase();
    const result = [];
    for (const cat of Object.keys(FAQ_KEYS)) {
      const hasMatch = FAQ_KEYS[cat].some(
        (k) =>
          t(`support.${k}_q`).toLowerCase().includes(term) ||
          t(`support.${k}_a`).toLowerCase().includes(term)
      );
      if (hasMatch) result.push(cat);
    }
    return result;
  }, [search, activeCategory, t]);

  const filteredFaqs = (cat) => {
    if (!search.trim()) return FAQ_KEYS[cat];
    const term = search.toLowerCase();
    return FAQ_KEYS[cat].filter(
      (k) =>
        t(`support.${k}_q`).toLowerCase().includes(term) ||
        t(`support.${k}_a`).toLowerCase().includes(term)
    );
  };

  return (
    <motion.div
      data-testid="support-page"
      className="min-h-screen relative"
      style={{ background: "#030303" }}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={slide}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
        <motion.button
          data-testid="support-back-btn"
          className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          whileTap={{ scale: 0.88 }}
          onClick={onBack}
        >
          <ChevronLeft size={15} strokeWidth={1.5} className="text-white/50" />
        </motion.button>
        <h1 className="text-[15px] font-semibold font-outfit text-white tracking-tight">{t("support.title")}</h1>
      </div>

      <div className="px-5 pb-8 relative z-10 space-y-5">
        {/* Hero card */}
        <motion.div
          className="rounded-2xl p-5 relative overflow-hidden"
          style={{ background: "rgba(0,194,255,0.03)", border: "1px solid rgba(0,194,255,0.08)" }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, ...slide }}
        >
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none" style={{ background: "rgba(0,194,255,0.1)", filter: "blur(30px)" }} />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 rounded-[14px] flex items-center justify-center" style={{ background: "rgba(0,194,255,0.08)", border: "1px solid rgba(0,194,255,0.12)" }}>
              <BookOpen size={18} strokeWidth={1.5} className="text-[#00C2FF]" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-white font-outfit">{t("support.hero_title")}</h2>
              <p className="text-[11px] text-[#444] font-medium">{t("support.hero_desc")}</p>
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ...slide }}
        >
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333]" />
          <input
            data-testid="support-search-input"
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveCategory(null); }}
            placeholder={t("support.search_placeholder")}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-[#333] font-medium outline-none"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
          />
        </motion.div>

        {/* Category chips */}
        <motion.div
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, ...slide }}
        >
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <motion.button
                key={cat.id}
                data-testid={`support-cat-${cat.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all flex-shrink-0"
                style={{
                  background: active ? `${cat.color}15` : "rgba(255,255,255,0.025)",
                  border: `1px solid ${active ? `${cat.color}30` : "rgba(255,255,255,0.04)"}`,
                  color: active ? cat.color : "rgba(255,255,255,0.5)",
                }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setActiveCategory(active ? null : cat.id); setSearch(""); }}
              >
                <cat.icon size={11} />
                {t(`support.cat_${cat.id}`)}
              </motion.button>
            );
          })}
        </motion.div>

        {/* FAQ sections */}
        {filteredCategories.length === 0 ? (
          <motion.div
            className="text-center py-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <HelpCircle size={28} className="text-[#222] mx-auto mb-3" />
            <p className="text-[13px] text-[#333] font-medium">{t("support.no_results")}</p>
          </motion.div>
        ) : (
          filteredCategories.map((catId, ci) => {
            const cat = CATEGORIES.find((c) => c.id === catId);
            const faqs = filteredFaqs(catId);
            if (!faqs.length) return null;
            return (
              <motion.div
                key={catId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 + ci * 0.04, ...slide }}
              >
                <div className="flex items-center gap-2 mb-2 pl-1">
                  {cat && <cat.icon size={12} style={{ color: cat.color }} />}
                  <p className="text-[10px] text-[#444] uppercase tracking-[0.12em] font-semibold">
                    {t(`support.cat_${catId}`)}
                  </p>
                </div>
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
                >
                  {faqs.map((faqKey) => (
                    <FaqItem key={faqKey} questionKey={faqKey} t={t} />
                  ))}
                </div>
              </motion.div>
            );
          })
        )}

        {/* Contact form */}
        <div className="mt-2">
          <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2.5 pl-1">{t("support.contact_section")}</p>
          <ContactForm t={t} />
        </div>

        {/* Footer info */}
        <motion.div
          className="flex items-center justify-center gap-2 pt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <MessageCircle size={11} className="text-[#222]" />
          <p className="text-[10px] text-[#222] font-medium">{t("support.response_time")}</p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default SupportPage;
