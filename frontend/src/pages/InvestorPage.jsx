import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, TrendingUp, Globe, Users, Zap, Shield, Mail, Send, Check, Loader2, ChevronRight } from "lucide-react";
import { api } from "../services/api";

const InvestorPage = ({ onBack }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSending(true);
    try {
      await api.submitInvestorContact({ name, email, company, message });
      setSent(true);
    } catch {}
    setSending(false);
  };

  return (
    <motion.div data-testid="investor-page" className="min-h-screen" style={{ background: "#040610" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: "rgba(4,6,16,0.85)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <motion.button data-testid="investor-back" onClick={onBack} whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
            <ArrowLeft size={15} className="text-white/40" />
          </motion.button>
          <div>
            <h1 className="text-[15px] font-bold text-white/90 font-outfit">Invest in BidBlitz</h1>
            <p className="text-[9px] text-white/25">bidblitz.ae</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Hero */}
        <motion.div className="text-center mb-8" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <motion.div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "rgba(0,224,255,0.05)", border: "1px solid rgba(0,224,255,0.1)" }}
            animate={{ boxShadow: ["0 0 0px rgba(0,224,255,0)", "0 0 30px rgba(0,224,255,0.08)", "0 0 0px rgba(0,224,255,0)"] }}
            transition={{ duration: 3, repeat: Infinity }}>
            <TrendingUp size={24} className="text-[#00E0FF]" />
          </motion.div>
          <h2 className="text-[22px] font-black text-white/90 font-outfit mb-1.5">Invest in <span className="text-[#00E0FF]">BidBlitz</span></h2>
          <p className="text-[12px] text-white/30 max-w-sm mx-auto leading-relaxed">We are building a global auction and payment platform. Fast growing, high-margin, scalable worldwide.</p>
        </motion.div>

        {/* Key Metrics */}
        <motion.div className="grid grid-cols-3 gap-2.5 mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {[
            { icon: Users, label: "Growing User Base", value: "Fast", color: "#00E0FF" },
            { icon: TrendingUp, label: "Auction Model", value: "High-Margin", color: "#FFD166" },
            { icon: Globe, label: "Worldwide System", value: "Scalable", color: "#00E89D" },
          ].map((m, i) => (
            <motion.div key={i} className="rounded-xl p-3 text-center backdrop-blur-xl"
              style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.04)" }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
              <m.icon size={16} className="mx-auto mb-1.5" style={{ color: `${m.color}60` }} />
              <p className="text-[12px] font-bold" style={{ color: m.color }}>{m.value}</p>
              <p className="text-[8px] text-white/20 mt-0.5">{m.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Why Invest */}
        <motion.div className="rounded-2xl p-5 mb-6 backdrop-blur-xl" style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.04)" }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-4">Why BidBlitz</p>
          <div className="space-y-3">
            {[
              { title: "Penny Auction Model", desc: "Users pay per bid, creating high-margin revenue with every interaction. The more exciting the product, the more users bid." },
              { title: "Integrated Payment System", desc: "Full fintech wallet, Stripe integration, and one-click payments. Users stay in the ecosystem." },
              { title: "Multi-Level Growth Engine", desc: "Built-in influencer and referral system drives viral organic growth with commission-based incentives." },
              { title: "Global Scalability", desc: "12-language support, multi-currency ready. One platform, worldwide reach." },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-md bg-[#00E0FF]/5 border border-[#00E0FF]/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ChevronRight size={9} className="text-[#00E0FF]/50" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white/70">{item.title}</p>
                  <p className="text-[9px] text-white/25 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Contact Form */}
        <motion.div className="rounded-2xl p-5 mb-8 backdrop-blur-xl" style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.04)" }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-4">Contact Us</p>
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div key="sent" className="text-center py-6" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: "rgba(0,232,157,0.08)", border: "1px solid rgba(0,232,157,0.15)" }}>
                  <Check size={20} className="text-[#00E89D]" />
                </div>
                <p className="text-[14px] font-bold text-white/80 mb-1">Thank you!</p>
                <p className="text-[10px] text-white/30">We will be in touch shortly.</p>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={submit} className="space-y-3" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <input data-testid="investor-name" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name *" required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 placeholder:text-white/15 outline-none focus:border-[#00E0FF]/15" />
                <input data-testid="investor-email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email *" type="email" required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 placeholder:text-white/15 outline-none focus:border-[#00E0FF]/15" />
                <input data-testid="investor-company" value={company} onChange={e => setCompany(e.target.value)} placeholder="Company (optional)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 placeholder:text-white/15 outline-none focus:border-[#00E0FF]/15" />
                <textarea data-testid="investor-message" value={message} onChange={e => setMessage(e.target.value)} placeholder="Your message..." rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/80 placeholder:text-white/15 outline-none focus:border-[#00E0FF]/15 resize-none" />
                <motion.button data-testid="investor-submit" type="submit" disabled={sending || !name.trim() || !email.trim()}
                  className="w-full py-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 disabled:opacity-30"
                  style={{ background: "rgba(0,224,255,0.08)", border: "1px solid rgba(0,224,255,0.15)", color: "#00E0FF" }}
                  whileTap={{ scale: 0.97 }}>
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
                  Send Message
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer */}
        <div className="text-center pb-8">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Shield size={10} className="text-[#00E89D]/30" />
            <span className="text-[9px] text-white/15 font-medium">Secure & Confidential</span>
          </div>
          <p className="text-[10px] text-white/10">bidblitz.ae</p>
        </div>
      </div>
    </motion.div>
  );
};

export default InvestorPage;
