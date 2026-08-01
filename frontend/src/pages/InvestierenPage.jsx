import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Mail,
  MessageSquareText,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../store";
import { useGuestTranslations } from "../models/homeTranslations";
import { HomeInvestorOpportunitySection } from "../components/home/HomeInvestorOpportunitySection";
import { api } from "../services/api";

const initialForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  company: "",
  message: "",
  consent: false,
};

export default function InvestierenPage({ onBack }) {
  const { language } = useI18n();
  const gt = useGuestTranslations(language);
  const [intent, setIntent] = useState("interest");
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [submittedLead, setSubmittedLead] = useState(null);

  const scrollToForm = (nextIntent) => {
    setIntent(nextIntent);
    if (typeof document !== "undefined") {
      const formSection = document.getElementById("investor-interest-form");
      if (formSection) {
        formSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.consent) {
      toast.error(gt("gp.invest_form_consent_error"));
      return;
    }
    setLoading(true);
    try {
      const response = await api.submitInvestorInterest({
        ...form,
        intent,
        locale: language,
        source_page: "/investieren",
      });
      setSubmittedLead(response.lead || null);
      setForm(initialForm);
      toast.success(gt("gp.invest_form_success"));
    } catch (error) {
      toast.error(error?.message || gt("gp.invest_form_error"));
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = intent === "documents"
    ? gt("gp.invest_form_submit_documents")
    : gt("gp.invest_form_submit_interest");

  return (
    <motion.div
      data-testid="investieren-page"
      className="min-h-screen bg-[#030507]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="sticky top-0 z-20 border-b border-white/6 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-3 pt-[max(env(safe-area-inset-top,0px),16px)] sm:px-5 lg:px-8">
          <motion.button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/5"
            whileTap={{ scale: 0.92 }}
            data-testid="investieren-back-button"
          >
            <ArrowLeft size={18} className="text-white/80" />
          </motion.button>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#82E7FF]">BidBlitz Invest</p>
            <h1 className="truncate text-[16px] font-bold text-white">{gt("gp.invest_page_title")}</h1>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-[#06B6D4]/10 blur-[120px]" />
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-5 lg:px-8 lg:pb-16">
          <HomeInvestorOpportunitySection
            gt={gt}
            standalone
            onInterest={() => scrollToForm("interest")}
            onRequestDocuments={() => scrollToForm("documents")}
          />

          <section
            id="investor-interest-form"
            className="mt-6 rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.22)]"
            data-testid="investor-interest-form-section"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#82E7FF]" data-testid="investor-interest-form-badge">
                  {gt("gp.invest_form_badge")}
                </p>
                <h2 className="mt-3 text-[28px] font-black leading-tight text-white" data-testid="investor-interest-form-title">
                  {gt("gp.invest_form_title")}
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/72" data-testid="investor-interest-form-text">
                  {gt("gp.invest_form_text")}
                </p>
              </div>

              <div className="inline-flex w-full flex-wrap items-center gap-2 rounded-[22px] border border-white/8 bg-black/30 p-2 lg:w-auto" data-testid="investor-interest-intent-toggle">
                <button
                  type="button"
                  onClick={() => setIntent("interest")}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition-colors duration-200 ${intent === "interest" ? "bg-[#06B6D4] text-[#041018]" : "bg-transparent text-white/78"}`}
                  data-testid="investor-interest-intent-interest"
                >
                  {gt("gp.invest_cta_interest")}
                </button>
                <button
                  type="button"
                  onClick={() => setIntent("documents")}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition-colors duration-200 ${intent === "documents" ? "bg-[#06B6D4] text-[#041018]" : "bg-transparent text-white/78"}`}
                  data-testid="investor-interest-intent-documents"
                >
                  {gt("gp.invest_cta_documents")}
                </button>
              </div>
            </div>

            {submittedLead && (
              <div
                className="mt-5 rounded-[24px] border border-emerald-400/18 bg-emerald-500/10 p-4 text-sm text-emerald-50"
                data-testid="investor-interest-success-card"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-emerald-200">{gt("gp.invest_form_success")}</p>
                    <p className="mt-1 text-emerald-50/85">{gt("gp.invest_form_success_detail")}</p>
                  </div>
                  <div className="rounded-full border border-emerald-300/20 bg-black/20 px-3 py-1 text-xs font-semibold text-emerald-100" data-testid="investor-interest-success-status">
                    {submittedLead.status}
                  </div>
                </div>
              </div>
            )}

            <form className="mt-5 grid gap-3 md:grid-cols-2" onSubmit={handleSubmit} data-testid="investor-interest-form">
              <Field
                label={gt("gp.invest_form_first_name")}
                value={form.first_name}
                onChange={(value) => handleChange("first_name", value)}
                icon={User}
                autoComplete="given-name"
                testId="investor-interest-first-name"
                required
              />
              <Field
                label={gt("gp.invest_form_last_name")}
                value={form.last_name}
                onChange={(value) => handleChange("last_name", value)}
                icon={User}
                autoComplete="family-name"
                testId="investor-interest-last-name"
                required
              />
              <Field
                label={gt("gp.invest_form_email")}
                type="email"
                value={form.email}
                onChange={(value) => handleChange("email", value)}
                icon={Mail}
                autoComplete="email"
                testId="investor-interest-email"
                required
              />
              <Field
                label={gt("gp.invest_form_phone")}
                type="tel"
                value={form.phone}
                onChange={(value) => handleChange("phone", value)}
                icon={Phone}
                autoComplete="tel"
                testId="investor-interest-phone"
                required
              />
              <Field
                label={gt("gp.invest_form_company")}
                value={form.company}
                onChange={(value) => handleChange("company", value)}
                icon={Building2}
                autoComplete="organization"
                testId="investor-interest-company"
                className="md:col-span-2"
              />
              <TextAreaField
                label={gt("gp.invest_form_message")}
                value={form.message}
                onChange={(value) => handleChange("message", value)}
                icon={MessageSquareText}
                testId="investor-interest-message"
              />

              <div className="md:col-span-2 rounded-[24px] border border-white/8 bg-black/20 p-4" data-testid="investor-interest-consent-box">
                <label className="flex items-start gap-3 text-sm text-white/78" data-testid="investor-interest-consent-label">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(event) => handleChange("consent", event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-[#06B6D4]"
                    data-testid="investor-interest-consent-checkbox"
                  />
                  <span>{gt("gp.invest_form_consent")}</span>
                </label>
                <div className="mt-3 flex items-start gap-2 text-xs text-[#9BB2C4]" data-testid="investor-interest-privacy-note">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#82E7FF]" />
                  <span>{gt("gp.invest_disclaimer")}</span>
                </div>
              </div>

              <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-white/55" data-testid="investor-interest-form-hint">
                  {gt("gp.invest_form_hint")}
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#06B6D4] px-5 text-sm font-black text-[#041018] shadow-[0_14px_38px_rgba(6,182,212,0.28)] disabled:cursor-not-allowed disabled:opacity-70"
                  data-testid="investor-interest-submit-button"
                >
                  {loading ? "..." : submitLabel}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </motion.div>
  );
}

const Field = ({
  label,
  value,
  onChange,
  icon: Icon,
  type = "text",
  autoComplete,
  testId,
  className = "",
  required = false,
}) => (
  <label className={`rounded-[24px] border border-white/8 bg-black/20 p-4 ${className}`} data-testid={`${testId}-field`}>
    <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#82E7FF]">
      <Icon size={14} />
      {label}
    </span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete={autoComplete}
      className="w-full border-none bg-transparent text-sm text-white outline-none placeholder:text-white/25"
      data-testid={testId}
      required={required}
    />
  </label>
);

const TextAreaField = ({ label, value, onChange, icon: Icon, testId }) => (
  <label className="rounded-[24px] border border-white/8 bg-black/20 p-4 md:col-span-2" data-testid={`${testId}-field`}>
    <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#82E7FF]">
      <Icon size={14} />
      {label}
    </span>
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={5}
      className="w-full resize-y border-none bg-transparent text-sm text-white outline-none placeholder:text-white/25"
      data-testid={testId}
    />
  </label>
);