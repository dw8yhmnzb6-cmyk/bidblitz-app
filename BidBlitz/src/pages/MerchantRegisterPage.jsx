/**
 * BidBlitz V2 - Merchant Registration Page
 * Full merchant onboarding flow
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, Store, User, Mail, Phone, MapPin,
  Check, Loader2, Star, Zap, Shield, TrendingUp,
  Package, CreditCard, BarChart3
} from 'lucide-react';
import { useI18n, useUser } from '../store';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function MerchantRegisterPage({ onBack, onNavigate }) {
  const { t } = useI18n();
  const user = useUser();
  
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [merchantStatus, setMerchantStatus] = useState(null);
  const [step, setStep] = useState(1);
  
  const [form, setForm] = useState({
    business_name: '',
    owner_name: user?.name || '',
    email: user?.email || '',
    phone: '',
    business_type: 'retail',
    description: '',
    address: '',
  });

  // Check existing merchant status
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch(`${API}/api/merchant/status`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMerchantStatus(data);
      }
    } catch (e) {}
    setCheckingStatus(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.business_name || !form.owner_name || !form.email) {
      toast.error('Bitte fülle alle Pflichtfelder aus');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/merchant/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      
      const data = await res.json();
      
      if (res.ok && data.ok) {
        toast.success('Registrierung erfolgreich!');
        setMerchantStatus({ is_merchant: true, status: 'pending', merchant: data.merchant });
      } else {
        toast.error(data.detail || 'Registrierung fehlgeschlagen');
      }
    } catch (e) {
      toast.error('Verbindungsfehler');
    }
    setLoading(false);
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#030303" }}>
        <Loader2 size={32} className="text-cyan-400 animate-spin" />
      </div>
    );
  }

  // Already registered
  if (merchantStatus?.is_merchant) {
    const status = merchantStatus.status;
    
    return (
      <motion.div
        className="min-h-screen pb-20"
        style={{ background: "#030303" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-4">
          <div className="flex items-center gap-3">
            <motion.button onClick={onBack} className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center" whileTap={{ scale: 0.9 }}>
              <ChevronLeft size={18} className="text-white/50" />
            </motion.button>
            <h1 className="text-[18px] font-bold text-white">Händler-Status</h1>
          </div>
        </div>

        <div className="px-5">
          <motion.div
            className="rounded-2xl p-6 text-center"
            style={{ 
              background: status === 'approved' 
                ? "rgba(0,210,106,0.06)" 
                : status === 'pending' 
                  ? "rgba(255,184,0,0.06)" 
                  : "rgba(255,71,87,0.06)",
              border: `1px solid ${
                status === 'approved' 
                  ? "rgba(0,210,106,0.2)" 
                  : status === 'pending' 
                    ? "rgba(255,184,0,0.2)" 
                    : "rgba(255,71,87,0.2)"
              }`
            }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
              status === 'approved' ? 'bg-[#00D26A]/20' : status === 'pending' ? 'bg-[#FFB800]/20' : 'bg-[#FF4757]/20'
            }`}>
              {status === 'approved' ? (
                <Check size={32} className="text-[#00D26A]" />
              ) : status === 'pending' ? (
                <Loader2 size={32} className="text-[#FFB800] animate-spin" />
              ) : (
                <Store size={32} className="text-[#FF4757]" />
              )}
            </div>
            
            <h2 className="text-[18px] font-bold text-white mb-2">
              {status === 'approved' && "Händlerkonto aktiv!"}
              {status === 'pending' && "Warte auf Genehmigung"}
              {status === 'rejected' && "Registrierung abgelehnt"}
            </h2>
            
            <p className="text-[13px] text-[#555] mb-4">
              {status === 'approved' && "Du kannst jetzt verkaufen und dein Dashboard nutzen."}
              {status === 'pending' && "Deine Registrierung wird geprüft. Du wirst benachrichtigt."}
              {status === 'rejected' && `Grund: ${merchantStatus.merchant?.rejection_reason || 'Nicht angegeben'}`}
            </p>
            
            {status === 'approved' && (
              <div className="space-y-3">
                <motion.button
                  onClick={() => onNavigate?.('/dashboard/merchant')}
                  className="w-full py-3 rounded-xl text-[13px] font-bold"
                  style={{ background: "rgba(0,194,255,0.15)", color: "#00C2FF" }}
                  whileTap={{ scale: 0.97 }}
                >
                  Zum Dashboard
                </motion.button>
                <motion.button
                  onClick={() => onNavigate?.('/marketplace')}
                  className="w-full py-3 rounded-xl text-[13px] font-semibold"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#fff" }}
                  whileTap={{ scale: 0.97 }}
                >
                  Anzeige erstellen
                </motion.button>
              </div>
            )}
          </motion.div>

          {/* Merchant Info Card */}
          {merchantStatus.merchant && (
            <motion.div
              className="mt-5 rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h3 className="text-[12px] font-semibold text-white mb-3">Dein Händlerprofil</h3>
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#555]">Geschäftsname</span>
                  <span className="text-white">{merchantStatus.merchant.business_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555]">Plan</span>
                  <span className="text-cyan-400 font-semibold">{merchantStatus.plan || 'Basic'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555]">Registriert</span>
                  <span className="text-white">{new Date(merchantStatus.merchant.created_at).toLocaleDateString('de-DE')}</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="min-h-screen pb-20"
      style={{ background: "#030303" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-4">
        <div className="flex items-center gap-3">
          <motion.button onClick={onBack} className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center" whileTap={{ scale: 0.9 }}>
            <ChevronLeft size={18} className="text-white/50" />
          </motion.button>
          <div>
            <h1 className="text-[18px] font-bold text-white">Händler werden</h1>
            <p className="text-[11px] text-[#555]">Starte dein Business</p>
          </div>
        </div>
      </div>

      <div className="px-5">
        {step === 1 && (
          <>
            {/* Benefits */}
            <motion.div
              className="rounded-2xl p-5 mb-5"
              style={{ background: "linear-gradient(135deg, rgba(0,194,255,0.08), rgba(168,85,247,0.04))", border: "1px solid rgba(0,194,255,0.15)" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-[15px] font-bold text-white mb-4 flex items-center gap-2">
                <Store size={18} className="text-cyan-400" />
                Warum Händler werden?
              </h2>
              <div className="space-y-3">
                {[
                  { icon: Package, text: "Anzeigen auf dem Marketplace", color: "#00C2FF" },
                  { icon: TrendingUp, text: "Boost-System für mehr Sichtbarkeit", color: "#FFB800" },
                  { icon: BarChart3, text: "Detaillierte Analytics", color: "#A855F7" },
                  { icon: CreditCard, text: "Direkte Wallet-Zahlungen", color: "#00D26A" },
                  { icon: Shield, text: "Verifiziertes Händler-Badge", color: "#FF6B6B" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${item.color}15` }}>
                      <item.icon size={14} style={{ color: item.color }} />
                    </div>
                    <span className="text-[12px] text-[#888]">{item.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Plans Preview */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <motion.div
                className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h3 className="text-[13px] font-bold text-white mb-1">Basic</h3>
                <p className="text-[20px] font-bold text-cyan-400">Gratis</p>
                <p className="text-[10px] text-[#555] mt-2">10 Anzeigen, 2.5% Gebühr</p>
              </motion.div>
              
              <motion.div
                className="rounded-xl p-4"
                style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)" }}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
              >
                <div className="flex items-center gap-1 mb-1">
                  <h3 className="text-[13px] font-bold text-white">Pro</h3>
                  <Star size={12} className="text-[#FFD700]" />
                </div>
                <p className="text-[20px] font-bold text-[#A855F7]">€29.99<span className="text-[10px] text-[#555]">/Mo</span></p>
                <p className="text-[10px] text-[#555] mt-2">Unbegrenzt, 1.5% Gebühr</p>
              </motion.div>
            </div>

            <motion.button
              onClick={() => setStep(2)}
              className="w-full py-4 rounded-xl text-[14px] font-bold"
              style={{ background: "linear-gradient(135deg, #00C2FF, #A855F7)", color: "#000" }}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Jetzt registrieren
            </motion.button>
          </>
        )}

        {step === 2 && (
          <motion.form
            onSubmit={handleSubmit}
            className="space-y-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div>
              <label className="text-[11px] text-[#555] mb-1.5 block flex items-center gap-1">
                <Store size={12} /> Geschäftsname *
              </label>
              <input
                type="text"
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                placeholder="z.B. Max's Shop"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[13px]"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#555] mb-1.5 block flex items-center gap-1">
                <User size={12} /> Inhaber Name *
              </label>
              <input
                type="text"
                value={form.owner_name}
                onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                placeholder="Vor- und Nachname"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[13px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[#555] mb-1.5 block flex items-center gap-1">
                  <Mail size={12} /> E-Mail *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[13px]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#555] mb-1.5 block flex items-center gap-1">
                  <Phone size={12} /> Telefon
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[13px]"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-[#555] mb-1.5 block">Geschäftsart</label>
              <select
                value={form.business_type}
                onChange={(e) => setForm({ ...form, business_type: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[13px]"
              >
                <option value="retail">Einzelhandel</option>
                <option value="services">Dienstleistungen</option>
                <option value="food">Gastronomie</option>
                <option value="fashion">Mode</option>
                <option value="electronics">Elektronik</option>
                <option value="other">Sonstiges</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-[#555] mb-1.5 block flex items-center gap-1">
                <MapPin size={12} /> Adresse
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Straße, PLZ, Stadt"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[13px]"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#555] mb-1.5 block">Beschreibung</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Erzähle etwas über dein Geschäft..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[13px] resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <motion.button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl text-[13px] font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", color: "#fff" }}
                whileTap={{ scale: 0.97 }}
              >
                Zurück
              </motion.button>
              <motion.button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #00C2FF, #A855F7)", color: "#000" }}
                whileTap={{ scale: 0.97 }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Registrieren
              </motion.button>
            </div>
          </motion.form>
        )}
      </div>
    </motion.div>
  );
}
