import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, TrendingUp, Users, Globe, ChevronRight,
  Shield, Zap, DollarSign, Target, Building2, Upload,
  Check, Loader2, CreditCard, FileText, User, Mail, Phone,
  MapPin, Calendar, CheckCircle2
} from "lucide-react";
import { useI18n } from "../store";
import { api } from "../services/api";

const slide = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

// Investment Highlights
const HIGHLIGHTS = [
  { icon: Users, title: "Fast", subtitle: "Growing User Base", color: "#00C2FF" },
  { icon: TrendingUp, title: "High-Margin", subtitle: "Auction Model", color: "#FFB800" },
  { icon: Globe, title: "Scalable", subtitle: "Worldwide System", color: "#00D26A" },
];

// Why BidBlitz Points
const WHY_POINTS = [
  {
    title: "Penny Auction Model",
    desc: "Users pay per bid, creating high-margin revenue with every interaction. The more exciting the product, the more users bid."
  },
  {
    title: "Integrated Payment System", 
    desc: "Full fintech wallet, Stripe integration, and one-click payments. Users stay in the ecosystem."
  },
  {
    title: "Multi-Level Growth Engine",
    desc: "Built-in influencer and referral system drives viral organic growth with commission-based incentives."
  },
  {
    title: "Global Scalability",
    desc: "12+ languages, multi-currency support, and cloud infrastructure ready for worldwide expansion."
  },
];

// Investment Tiers
const INVESTMENT_TIERS = [
  { amount: 1000, equity: "0.01%", perks: "Early Access + Updates", color: "#3B82F6" },
  { amount: 5000, equity: "0.05%", perks: "Quarterly Reports + Calls", color: "#8B5CF6" },
  { amount: 25000, equity: "0.25%", perks: "Advisory Board Access", color: "#F59E0B" },
  { amount: 100000, equity: "1.0%", perks: "Board Observer Rights", color: "#EF4444" },
];

const InvestorPage = ({ onBack }) => {
  const { t } = useI18n();
  const [showRegister, setShowRegister] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "Deutschland",
    city: "",
    investmentAmount: 5000,
    idType: "passport",
    idFront: null,
    idBack: null,
    selfie: null,
    acceptTerms: false,
    accreditedInvestor: false,
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (field, e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, [field]: file }));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Simulate API call for investor registration
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In production, this would submit to backend
      // await api.registerInvestor(formData);
      
      setSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const canProceedStep1 = formData.firstName && formData.lastName && formData.email && formData.phone;
  const canProceedStep2 = formData.country && formData.city && formData.investmentAmount >= 1000;
  const canProceedStep3 = formData.idFront && formData.acceptTerms;

  return (
    <motion.div 
      data-testid="invest-page"
      className="min-h-screen relative"
      style={{ background: "#030303" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-black/80 border-b border-white/5">
        <div className="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top,0px),16px)] pb-3">
          <motion.button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <ArrowLeft size={18} className="text-white/60" />
          </motion.button>
          <div>
            <h1 className="text-[15px] font-semibold text-white">Invest in BidBlitz</h1>
            <p className="text-[11px] text-white/40">bidblitz.ae</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pb-32">
        {!showRegister && !success ? (
          <>
            {/* Hero Section */}
            <motion.div 
              className="py-8 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="w-20 h-20 rounded-2xl bg-[#00C2FF]/10 border border-[#00C2FF]/20 flex items-center justify-center mx-auto mb-4">
                <TrendingUp size={36} className="text-[#00C2FF]" />
              </div>
              <h2 className="text-[28px] font-bold text-white mb-2">
                Invest in <span className="text-[#00C2FF]">BidBlitz</span>
              </h2>
              <p className="text-[14px] text-white/50 leading-relaxed max-w-sm mx-auto">
                We are building a global auction and payment platform. Fast growing, high-margin, scalable worldwide.
              </p>
            </motion.div>

            {/* Highlights Grid */}
            <motion.div 
              className="grid grid-cols-3 gap-3 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {HIGHLIGHTS.map((h, i) => (
                <div 
                  key={i}
                  className="p-4 rounded-2xl text-center"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <h.icon size={28} className="mx-auto mb-2" style={{ color: h.color }} />
                  <p className="text-[14px] font-bold" style={{ color: h.color }}>{h.title}</p>
                  <p className="text-[10px] text-white/40">{h.subtitle}</p>
                </div>
              ))}
            </motion.div>

            {/* Why BidBlitz Section */}
            <motion.div 
              className="rounded-2xl p-5 mb-6"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="text-[12px] font-bold text-white/40 uppercase tracking-wider mb-4">WHY BIDBLITZ</h3>
              <div className="space-y-4">
                {WHY_POINTS.map((point, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#00C2FF]/10 border border-[#00C2FF]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ChevronRight size={14} className="text-[#00C2FF]" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-white mb-1">{point.title}</p>
                      <p className="text-[12px] text-white/40 leading-relaxed">{point.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Investment Tiers */}
            <motion.div 
              className="mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="text-[12px] font-bold text-white/40 uppercase tracking-wider mb-3 px-1">INVESTMENT TIERS</h3>
              <div className="space-y-2">
                {INVESTMENT_TIERS.map((tier, i) => (
                  <div 
                    key={i}
                    className="flex items-center gap-3 p-4 rounded-xl"
                    style={{ background: `${tier.color}08`, border: `1px solid ${tier.color}20` }}
                  >
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: `${tier.color}15` }}
                    >
                      <DollarSign size={20} style={{ color: tier.color }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[16px] font-bold text-white">€{tier.amount.toLocaleString()}</p>
                      <p className="text-[11px] text-white/40">{tier.perks}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] font-bold" style={{ color: tier.color }}>{tier.equity}</p>
                      <p className="text-[10px] text-white/30">equity</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div 
              className="grid grid-cols-3 gap-2 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-center">
                <Shield size={18} className="text-green-400 mx-auto mb-1" />
                <p className="text-[10px] text-white/50">Regulated</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-center">
                <Building2 size={18} className="text-blue-400 mx-auto mb-1" />
                <p className="text-[10px] text-white/50">UAE Licensed</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-center">
                <Target size={18} className="text-purple-400 mx-auto mb-1" />
                <p className="text-[10px] text-white/50">€5M Target</p>
              </div>
            </motion.div>

            {/* CTA Button */}
            <motion.button
              onClick={() => setShowRegister(true)}
              className="w-full py-4 rounded-2xl bg-[#00C2FF] text-black font-bold text-[15px] flex items-center justify-center gap-2"
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <TrendingUp size={18} />
              Als Investor registrieren
            </motion.button>
            <p className="text-center text-[11px] text-white/30 mt-3">
              KYC-Verifizierung mit Ausweis erforderlich
            </p>
          </>
        ) : success ? (
          /* Success State */
          <motion.div 
            className="py-16 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={48} className="text-green-400" />
            </div>
            <h2 className="text-[24px] font-bold text-white mb-2">Registrierung erfolgreich!</h2>
            <p className="text-[14px] text-white/50 mb-6 max-w-xs mx-auto">
              Ihre Investor-Anfrage wird geprüft. Sie erhalten in 24-48 Stunden eine E-Mail.
            </p>
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] mb-6 max-w-xs mx-auto">
              <p className="text-[12px] text-white/40 mb-2">Ihre Investitionssumme</p>
              <p className="text-[28px] font-bold text-[#00C2FF]">€{formData.investmentAmount.toLocaleString()}</p>
            </div>
            <motion.button
              onClick={onBack}
              className="px-8 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white font-semibold"
              whileTap={{ scale: 0.98 }}
            >
              Zurück zur App
            </motion.button>
          </motion.div>
        ) : (
          /* Registration Form */
          <motion.div 
            className="py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center gap-2">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-all ${
                      step >= s 
                        ? 'bg-[#00C2FF] text-black' 
                        : 'bg-white/[0.05] text-white/40'
                    }`}
                  >
                    {step > s ? <Check size={14} /> : s}
                  </div>
                  {s < 3 && (
                    <div className={`w-12 h-0.5 ${step > s ? 'bg-[#00C2FF]' : 'bg-white/10'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Personal Info */}
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-[18px] font-bold text-white mb-4">Persönliche Daten</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-white/40 mb-1 block">Vorname</label>
                      <div className="relative">
                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          placeholder="Max"
                          className="w-full pl-10 pr-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[14px] placeholder-white/20 outline-none focus:border-[#00C2FF]/50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-white/40 mb-1 block">Nachname</label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        placeholder="Mustermann"
                        className="w-full px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[14px] placeholder-white/20 outline-none focus:border-[#00C2FF]/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-white/40 mb-1 block">E-Mail</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="max@beispiel.de"
                        className="w-full pl-10 pr-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[14px] placeholder-white/20 outline-none focus:border-[#00C2FF]/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-white/40 mb-1 block">Telefon</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="+49 123 456 789"
                        className="w-full pl-10 pr-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[14px] placeholder-white/20 outline-none focus:border-[#00C2FF]/50"
                      />
                    </div>
                  </div>

                  <motion.button
                    onClick={() => setStep(2)}
                    disabled={!canProceedStep1}
                    className="w-full py-4 rounded-xl bg-[#00C2FF] text-black font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-40 mt-6"
                    whileTap={{ scale: 0.98 }}
                  >
                    Weiter <ChevronRight size={18} />
                  </motion.button>
                </motion.div>
              )}

              {/* Step 2: Investment Amount */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-[18px] font-bold text-white mb-4">Investment Details</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-white/40 mb-1 block">Land</label>
                      <select
                        value={formData.country}
                        onChange={(e) => handleInputChange('country', e.target.value)}
                        className="w-full px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[14px] outline-none appearance-none cursor-pointer"
                      >
                        <option value="Deutschland">Deutschland</option>
                        <option value="Österreich">Österreich</option>
                        <option value="Schweiz">Schweiz</option>
                        <option value="VAE">VAE</option>
                        <option value="Kosovo">Kosovo</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-white/40 mb-1 block">Stadt</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        placeholder="Berlin"
                        className="w-full px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[14px] placeholder-white/20 outline-none focus:border-[#00C2FF]/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-white/40 mb-2 block">Investitionsbetrag</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[1000, 5000, 25000, 100000].map(amount => (
                        <motion.button
                          key={amount}
                          onClick={() => handleInputChange('investmentAmount', amount)}
                          className={`p-4 rounded-xl text-center transition-all ${
                            formData.investmentAmount === amount
                              ? 'bg-[#00C2FF]/20 border-[#00C2FF]/50'
                              : 'bg-white/[0.02] border-white/[0.06]'
                          } border`}
                          whileTap={{ scale: 0.98 }}
                        >
                          <p className={`text-[18px] font-bold ${
                            formData.investmentAmount === amount ? 'text-[#00C2FF]' : 'text-white'
                          }`}>
                            €{amount.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-white/40">
                            {INVESTMENT_TIERS.find(t => t.amount === amount)?.equity} equity
                          </p>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6">
                    <motion.button
                      onClick={() => setStep(1)}
                      className="flex-1 py-4 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white font-semibold text-[14px]"
                      whileTap={{ scale: 0.98 }}
                    >
                      Zurück
                    </motion.button>
                    <motion.button
                      onClick={() => setStep(3)}
                      disabled={!canProceedStep2}
                      className="flex-1 py-4 rounded-xl bg-[#00C2FF] text-black font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-40"
                      whileTap={{ scale: 0.98 }}
                    >
                      Weiter <ChevronRight size={18} />
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: KYC / ID Upload */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-[18px] font-bold text-white mb-4">KYC Verifizierung</h3>
                  <p className="text-[12px] text-white/40 mb-4">
                    Laden Sie Ihren Ausweis hoch, um Ihre Identität zu bestätigen.
                  </p>

                  <div>
                    <label className="text-[11px] text-white/40 mb-2 block">Ausweistyp</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "passport", label: "Reisepass" },
                        { key: "id_card", label: "Personalausweis" },
                      ].map(type => (
                        <motion.button
                          key={type.key}
                          onClick={() => handleInputChange('idType', type.key)}
                          className={`p-3 rounded-xl text-center transition-all ${
                            formData.idType === type.key
                              ? 'bg-[#00C2FF]/20 border-[#00C2FF]/50'
                              : 'bg-white/[0.02] border-white/[0.06]'
                          } border`}
                          whileTap={{ scale: 0.98 }}
                        >
                          <FileText size={20} className={`mx-auto mb-1 ${
                            formData.idType === type.key ? 'text-[#00C2FF]' : 'text-white/40'
                          }`} />
                          <p className={`text-[12px] font-medium ${
                            formData.idType === type.key ? 'text-[#00C2FF]' : 'text-white/60'
                          }`}>{type.label}</p>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* ID Front Upload */}
                  <div>
                    <label className="text-[11px] text-white/40 mb-2 block">
                      {formData.idType === 'passport' ? 'Reisepass Foto' : 'Ausweis Vorderseite'}
                    </label>
                    <label className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                      formData.idFront 
                        ? 'border-green-500/50 bg-green-500/10' 
                        : 'border-white/10 bg-white/[0.02] hover:border-[#00C2FF]/30'
                    }`}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload('idFront', e)}
                        className="hidden"
                      />
                      {formData.idFront ? (
                        <>
                          <Check size={24} className="text-green-400 mb-2" />
                          <p className="text-[12px] text-green-400 font-medium">{formData.idFront.name}</p>
                        </>
                      ) : (
                        <>
                          <Upload size={24} className="text-white/30 mb-2" />
                          <p className="text-[12px] text-white/40">Klicken zum Hochladen</p>
                        </>
                      )}
                    </label>
                  </div>

                  {/* Terms */}
                  <div className="space-y-3 pt-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.acceptTerms}
                        onChange={(e) => handleInputChange('acceptTerms', e.target.checked)}
                        className="mt-1 w-5 h-5 rounded bg-white/10 border-white/20 text-[#00C2FF] focus:ring-[#00C2FF]"
                      />
                      <span className="text-[12px] text-white/50 leading-relaxed">
                        Ich akzeptiere die <span className="text-[#00C2FF]">Investmentbedingungen</span> und 
                        <span className="text-[#00C2FF]"> Datenschutzerklärung</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.accreditedInvestor}
                        onChange={(e) => handleInputChange('accreditedInvestor', e.target.checked)}
                        className="mt-1 w-5 h-5 rounded bg-white/10 border-white/20 text-[#00C2FF] focus:ring-[#00C2FF]"
                      />
                      <span className="text-[12px] text-white/50 leading-relaxed">
                        Ich bestätige, dass ich die finanziellen Risiken von Startup-Investments verstehe
                      </span>
                    </label>
                  </div>

                  <div className="flex gap-2 mt-6">
                    <motion.button
                      onClick={() => setStep(2)}
                      className="flex-1 py-4 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white font-semibold text-[14px]"
                      whileTap={{ scale: 0.98 }}
                    >
                      Zurück
                    </motion.button>
                    <motion.button
                      onClick={handleSubmit}
                      disabled={!canProceedStep3 || loading}
                      className="flex-1 py-4 rounded-xl bg-[#00C2FF] text-black font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-40"
                      whileTap={{ scale: 0.98 }}
                    >
                      {loading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <>
                          <Check size={18} /> Absenden
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default InvestorPage;
