/**
 * BidBlitz V2 - Partner Landing Page
 * Driver & Restaurant Registration
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../store/I18nContext';
import { 
  Car, Store, ChevronRight, Check, Upload, X, 
  Clock, Wallet, Users, Shield, Zap, TrendingUp,
  Phone, Mail, MapPin, FileText, Camera
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Translations
const TEXTS = {
  de: {
    hero_title: "Verdiene Geld mit BidBlitz",
    hero_subtitle: "Werde Fahrer, Restaurant oder Händler und starte sofort",
    driver_btn: "Als Fahrer registrieren",
    restaurant_btn: "Als Restaurant registrieren",
    how_it_works: "So funktioniert's",
    step1_title: "Registrieren",
    step1_text: "Erstelle dein Konto in 2 Minuten",
    step2_title: "Dokumente hochladen",
    step2_text: "Führerschein, Ausweis & Fahrzeuginfos",
    step3_title: "Admin-Freischaltung",
    step3_text: "Wir prüfen deine Unterlagen",
    step4_title: "Geld verdienen",
    step4_text: "Starte sofort und verdiene",
    driver_section_title: "Fahrer werden",
    driver_benefit1: "Flexible Arbeitszeiten",
    driver_benefit2: "Verdiene pro Fahrt",
    driver_benefit3: "Sofort Auszahlung ins Wallet",
    driver_cta: "Jetzt Fahrer werden",
    restaurant_section_title: "Restaurant hinzufügen",
    restaurant_benefit1: "Mehr Kunden erreichen",
    restaurant_benefit2: "Online Bestellungen annehmen",
    restaurant_benefit3: "Einfaches Verwaltungssystem",
    restaurant_cta: "Restaurant registrieren",
    earnings_title: "Verdienstbeispiele",
    driver_earnings: "100 Fahrten = ~800€",
    restaurant_earnings: "50 Bestellungen = ~1000€ Umsatz",
    trust_title: "Warum BidBlitz?",
    trust1: "Sicheres Zahlungssystem",
    trust2: "Schnelle Auszahlungen",
    trust3: "Volle Kontrolle",
    form_title_driver: "Fahrer-Registrierung",
    form_title_restaurant: "Restaurant-Registrierung",
    form_name: "Vollständiger Name",
    form_phone: "Telefonnummer",
    form_vehicle: "Fahrzeugtyp",
    form_vehicle_standard: "Standard",
    form_vehicle_premium: "Premium",
    form_vehicle_van: "Van/Transporter",
    form_restaurant_name: "Restaurant-Name",
    form_address: "Adresse",
    form_category: "Kategorie",
    form_submit: "Bewerbung absenden",
    form_success: "Bewerbung eingereicht! Wir melden uns bald.",
    form_error: "Fehler beim Absenden. Bitte erneut versuchen.",
    login_required: "Bitte zuerst einloggen",
    contact: "Kontakt",
  },
  en: {
    hero_title: "Earn Money with BidBlitz",
    hero_subtitle: "Become a driver, restaurant or merchant and start immediately",
    driver_btn: "Register as Driver",
    restaurant_btn: "Register as Restaurant",
    how_it_works: "How it works",
    step1_title: "Register",
    step1_text: "Create your account in 2 minutes",
    step2_title: "Upload Documents",
    step2_text: "License, ID & vehicle info",
    step3_title: "Admin Approval",
    step3_text: "We review your documents",
    step4_title: "Start Earning",
    step4_text: "Go live and earn",
    driver_section_title: "Become a Driver",
    driver_benefit1: "Flexible working hours",
    driver_benefit2: "Earn per ride",
    driver_benefit3: "Instant wallet payout",
    driver_cta: "Become a Driver",
    restaurant_section_title: "Add Your Restaurant",
    restaurant_benefit1: "Reach more customers",
    restaurant_benefit2: "Accept online orders",
    restaurant_benefit3: "Simple management system",
    restaurant_cta: "Register Restaurant",
    earnings_title: "Earning Examples",
    driver_earnings: "100 rides = ~€800",
    restaurant_earnings: "50 orders = ~€1000 revenue",
    trust_title: "Why BidBlitz?",
    trust1: "Secure payment system",
    trust2: "Fast payouts",
    trust3: "Full control",
    form_title_driver: "Driver Registration",
    form_title_restaurant: "Restaurant Registration",
    form_name: "Full Name",
    form_phone: "Phone Number",
    form_vehicle: "Vehicle Type",
    form_vehicle_standard: "Standard",
    form_vehicle_premium: "Premium",
    form_vehicle_van: "Van",
    form_restaurant_name: "Restaurant Name",
    form_address: "Address",
    form_category: "Category",
    form_submit: "Submit Application",
    form_success: "Application submitted! We'll contact you soon.",
    form_error: "Error submitting. Please try again.",
    login_required: "Please login first",
    contact: "Contact",
  },
  sq: {
    hero_title: "Fito Para me BidBlitz",
    hero_subtitle: "Bëhu shofer, restorant ose tregtar dhe fillo menjëherë",
    driver_btn: "Regjistrohu si Shofer",
    restaurant_btn: "Regjistrohu si Restorant",
    how_it_works: "Si funksionon",
    step1_title: "Regjistrohu",
    step1_text: "Krijo llogarinë në 2 minuta",
    step2_title: "Ngarko Dokumentet",
    step2_text: "Patentë, ID & info të automjetit",
    step3_title: "Miratimi i Adminit",
    step3_text: "Shqyrtojmë dokumentet tuaja",
    step4_title: "Fillo të Fitosh",
    step4_text: "Fillo dhe fito",
    driver_section_title: "Bëhu Shofer",
    driver_benefit1: "Orare fleksibël pune",
    driver_benefit2: "Fito për çdo udhëtim",
    driver_benefit3: "Pagesë e menjëhershme në portofol",
    driver_cta: "Bëhu Shofer",
    restaurant_section_title: "Shto Restorantin Tënd",
    restaurant_benefit1: "Arrij më shumë klientë",
    restaurant_benefit2: "Prano porosi online",
    restaurant_benefit3: "Sistem i thjeshtë menaxhimi",
    restaurant_cta: "Regjistro Restorantin",
    earnings_title: "Shembuj Fitimi",
    driver_earnings: "100 udhëtime = ~800€",
    restaurant_earnings: "50 porosi = ~1000€ të ardhura",
    trust_title: "Pse BidBlitz?",
    trust1: "Sistem i sigurt pagesash",
    trust2: "Pagesa të shpejta",
    trust3: "Kontroll i plotë",
    form_title_driver: "Regjistrimi i Shoferit",
    form_title_restaurant: "Regjistrimi i Restorantit",
    form_name: "Emri i Plotë",
    form_phone: "Numri i Telefonit",
    form_vehicle: "Lloji i Automjetit",
    form_vehicle_standard: "Standard",
    form_vehicle_premium: "Premium",
    form_vehicle_van: "Furgon",
    form_restaurant_name: "Emri i Restorantit",
    form_address: "Adresa",
    form_category: "Kategoria",
    form_submit: "Dërgo Aplikimin",
    form_success: "Aplikimi u dorëzua! Do t'ju kontaktojmë së shpejti.",
    form_error: "Gabim gjatë dërgimit. Provo përsëri.",
    login_required: "Ju lutemi identifikohuni fillimisht",
    contact: "Kontakti",
  },
};

export default function PartnersPage({ onNavigate }) {
  const { lang } = useI18n();
  const t = TEXTS[lang] || TEXTS.de;
  
  const goBack = () => {
    if (onNavigate) {
      onNavigate('/');
    } else {
      window.location.href = '/';
    }
  };
  
  const [showModal, setShowModal] = useState(null); // 'driver' or 'restaurant'
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    vehicle_type: 'standard',
    restaurant_name: '',
    address: '',
    category: 'restaurant',
    owner_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const endpoint = showModal === 'driver' 
        ? `${API}/api/applications/driver/apply`
        : `${API}/api/applications/restaurant/apply`;
      
      const body = showModal === 'driver' 
        ? {
            full_name: formData.full_name,
            phone: formData.phone,
            vehicle_type: formData.vehicle_type,
          }
        : {
            restaurant_name: formData.restaurant_name,
            address: formData.address,
            phone: formData.phone,
            owner_name: formData.full_name,
            category: formData.category,
          };
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      
      if (res.status === 401) {
        setError(t.login_required);
        return;
      }
      
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setShowModal(null);
          setSuccess(false);
          setFormData({
            full_name: '',
            phone: '',
            vehicle_type: 'standard',
            restaurant_name: '',
            address: '',
            category: 'restaurant',
            owner_name: '',
          });
        }, 2000);
      } else {
        const data = await res.json();
        setError(data.detail || t.form_error);
      }
    } catch (err) {
      setError(t.form_error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-3xl" />
        
        <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
              {t.hero_title}
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
              {t.hero_subtitle}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                onClick={() => setShowModal('driver')}
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl font-bold text-black text-lg flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Car className="w-5 h-5" />
                {t.driver_btn}
              </motion.button>
              
              <motion.button
                onClick={() => setShowModal('restaurant')}
                className="px-8 py-4 bg-white/10 border border-white/20 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Store className="w-5 h-5" />
                {t.restaurant_btn}
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4 bg-[#0A0A0A]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">{t.how_it_works}</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { icon: FileText, title: t.step1_title, text: t.step1_text, num: 1 },
              { icon: Upload, title: t.step2_title, text: t.step2_text, num: 2 },
              { icon: Shield, title: t.step3_title, text: t.step3_text, num: 3 },
              { icon: Wallet, title: t.step4_title, text: t.step4_text, num: 4 },
            ].map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="relative bg-[#111] rounded-2xl p-5 border border-white/5"
              >
                <div className="absolute -top-3 -left-3 w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center font-bold text-black text-sm">
                  {step.num}
                </div>
                <step.icon className="w-8 h-8 text-cyan-400 mb-3" />
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-gray-500">{step.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Driver Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <Car className="w-6 h-6 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold">{t.driver_section_title}</h2>
              </div>
              
              <ul className="space-y-3 mb-6">
                {[t.driver_benefit1, t.driver_benefit2, t.driver_benefit3].map((benefit, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-gray-300">
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                    {benefit}
                  </li>
                ))}
              </ul>
              
              <button
                onClick={() => setShowModal('driver')}
                className="px-6 py-3 bg-green-500/20 text-green-400 rounded-xl font-semibold flex items-center gap-2 hover:bg-green-500/30 transition-colors"
              >
                {t.driver_cta}
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 rounded-3xl p-8 border border-green-500/20"
            >
              <div className="text-center">
                <div className="text-5xl mb-4">🚗</div>
                <p className="text-gray-400 mb-2">{t.earnings_title}</p>
                <p className="text-3xl font-bold text-green-400">{t.driver_earnings}</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Restaurant Section */}
      <section className="py-16 px-4 bg-[#0A0A0A]">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-2 md:order-1 bg-gradient-to-br from-orange-500/10 to-red-500/5 rounded-3xl p-8 border border-orange-500/20"
            >
              <div className="text-center">
                <div className="text-5xl mb-4">🍽️</div>
                <p className="text-gray-400 mb-2">{t.earnings_title}</p>
                <p className="text-3xl font-bold text-orange-400">{t.restaurant_earnings}</p>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-1 md:order-2"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <Store className="w-6 h-6 text-orange-400" />
                </div>
                <h2 className="text-2xl font-bold">{t.restaurant_section_title}</h2>
              </div>
              
              <ul className="space-y-3 mb-6">
                {[t.restaurant_benefit1, t.restaurant_benefit2, t.restaurant_benefit3].map((benefit, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-gray-300">
                    <Check className="w-5 h-5 text-orange-400 flex-shrink-0" />
                    {benefit}
                  </li>
                ))}
              </ul>
              
              <button
                onClick={() => setShowModal('restaurant')}
                className="px-6 py-3 bg-orange-500/20 text-orange-400 rounded-xl font-semibold flex items-center gap-2 hover:bg-orange-500/30 transition-colors"
              >
                {t.restaurant_cta}
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-10">{t.trust_title}</h2>
          
          <div className="grid grid-cols-3 gap-4 md:gap-8">
            {[
              { icon: Shield, text: t.trust1, color: 'cyan' },
              { icon: Zap, text: t.trust2, color: 'yellow' },
              { icon: TrendingUp, text: t.trust3, color: 'green' },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="p-4 md:p-6"
              >
                <div className={`w-12 h-12 mx-auto mb-3 bg-${item.color}-500/20 rounded-xl flex items-center justify-center`}>
                  <item.icon className={`w-6 h-6 text-${item.color}-400`} />
                </div>
                <p className="text-sm md:text-base text-gray-300">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-500 mb-2">{t.contact}</p>
          <a href="mailto:info@bidblitz.ae" className="text-cyan-400 flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" />
            info@bidblitz.ae
          </a>
          
          <button
            onClick={goBack}
            className="mt-6 px-6 py-2 bg-white/5 rounded-lg text-sm text-gray-400 hover:bg-white/10"
          >
            ← Zurück zur App
          </button>
        </div>
      </footer>

      {/* Registration Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => !loading && setShowModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#111] rounded-2xl border border-white/10 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  {showModal === 'driver' ? (
                    <>
                      <Car className="w-5 h-5 text-green-400" />
                      {t.form_title_driver}
                    </>
                  ) : (
                    <>
                      <Store className="w-5 h-5 text-orange-400" />
                      {t.form_title_restaurant}
                    </>
                  )}
                </h3>
                <button onClick={() => setShowModal(null)} className="p-2 text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {success ? (
                  <div className="py-8 text-center">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-green-400" />
                    </div>
                    <p className="text-green-400 font-semibold">{t.form_success}</p>
                  </div>
                ) : (
                  <>
                    {/* Name */}
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">{t.form_name} *</label>
                      <input
                        type="text"
                        required
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        className="w-full px-4 py-3 bg-[#0A0A0A] border border-white/10 rounded-xl focus:border-cyan-500/50 focus:outline-none"
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">{t.form_phone} *</label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-3 bg-[#0A0A0A] border border-white/10 rounded-xl focus:border-cyan-500/50 focus:outline-none"
                      />
                    </div>

                    {/* Driver-specific fields */}
                    {showModal === 'driver' && (
                      <div>
                        <label className="text-sm text-gray-400 mb-1 block">{t.form_vehicle} *</label>
                        <select
                          value={formData.vehicle_type}
                          onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                          className="w-full px-4 py-3 bg-[#0A0A0A] border border-white/10 rounded-xl focus:border-cyan-500/50 focus:outline-none"
                        >
                          <option value="standard">{t.form_vehicle_standard}</option>
                          <option value="premium">{t.form_vehicle_premium}</option>
                          <option value="van">{t.form_vehicle_van}</option>
                        </select>
                      </div>
                    )}

                    {/* Restaurant-specific fields */}
                    {showModal === 'restaurant' && (
                      <>
                        <div>
                          <label className="text-sm text-gray-400 mb-1 block">{t.form_restaurant_name} *</label>
                          <input
                            type="text"
                            required
                            value={formData.restaurant_name}
                            onChange={(e) => setFormData({ ...formData, restaurant_name: e.target.value })}
                            className="w-full px-4 py-3 bg-[#0A0A0A] border border-white/10 rounded-xl focus:border-cyan-500/50 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-400 mb-1 block">{t.form_address} *</label>
                          <input
                            type="text"
                            required
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-4 py-3 bg-[#0A0A0A] border border-white/10 rounded-xl focus:border-cyan-500/50 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-400 mb-1 block">{t.form_category}</label>
                          <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-4 py-3 bg-[#0A0A0A] border border-white/10 rounded-xl focus:border-cyan-500/50 focus:outline-none"
                          >
                            <option value="restaurant">Restaurant</option>
                            <option value="fastfood">Fast Food</option>
                            <option value="cafe">Café</option>
                            <option value="bakery">Bäckerei</option>
                            <option value="asian">Asiatisch</option>
                            <option value="italian">Italienisch</option>
                            <option value="kebab">Döner/Kebab</option>
                          </select>
                        </div>
                      </>
                    )}

                    {/* Error */}
                    {error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                        {error}
                      </div>
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={loading}
                      className={`w-full py-4 rounded-xl font-bold text-black ${
                        showModal === 'driver'
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : 'bg-gradient-to-r from-orange-500 to-red-500'
                      } disabled:opacity-50`}
                    >
                      {loading ? '...' : t.form_submit}
                    </button>
                  </>
                )}
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
