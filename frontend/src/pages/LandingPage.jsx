import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Smartphone, Zap, Shield, Globe, Star, TrendingUp, Gift, Users, ArrowRight, Play, Check, Apple, Download } from 'lucide-react';
import { LandingChatbot } from '../components/LandingChatbot';
import { TEST_MODE } from '../config/testMode';

/**
 * Landing Page — Marketing/SEO für BidBlitz Super-App
 * Competitor-Level Design (Uber/Bolt/Lieferando Style)
 */
export default function LandingPage({ onGetStarted }) {
  const [activeFeature, setActiveFeature] = useState(0);

  const features = [
    { icon: '🚕', title: 'Taxi', desc: 'Günstig & schnell', color: '#00E0FF' },
    { icon: '🍕', title: 'Food Delivery', desc: 'Lieblingsessen bestellen', color: '#FFD166' },
    { icon: '🛴', title: 'E-Scooter', desc: 'Flexibel unterwegs', color: '#00E89D' },
    { icon: '🎁', title: 'Penny Auctions', desc: 'iPhone für €4.99 gewinnen', color: '#B068FF' },
    { icon: '💳', title: 'Wallet', desc: 'Digital bezahlen & verdienen', color: '#FF6B9D' },
    { icon: '🏪', title: 'POS System', desc: 'Für dein Business', color: '#00C2FF' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#030303] via-[#0a0a0f] to-[#030303] text-white font-outfit overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-20 pb-32 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-10 w-96 h-96 bg-cyan-500/30 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/30 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          {/* Logo */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500 to-purple-600 shadow-2xl mb-6">
              <span className="text-5xl">⚡</span>
            </div>
            <h1 className="text-7xl md:text-8xl font-black mb-4 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              BidBlitz
            </h1>
          </motion.div>

          {/* Tagline */}
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-3xl md:text-5xl font-bold mb-6 text-white/90"
          >
            Die Super-App für alles
          </motion.h2>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-xl md:text-2xl text-white/60 mb-12 max-w-3xl mx-auto"
          >
            Taxi buchen • Essen bestellen • E-Scooter mieten • Auktionen gewinnen • Bezahlen — alles in einer App
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <button
              onClick={onGetStarted}
              className="group px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl font-bold text-lg flex items-center gap-3 shadow-2xl hover:shadow-cyan-500/50 transition-all hover:scale-105"
            >
              <span>App öffnen</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>

            <button className="px-8 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl font-semibold text-lg flex items-center gap-3 hover:bg-white/10 transition-all">
              <Play size={20} />
              <span>Demo ansehen</span>
            </button>
          </motion.div>

          {/* App Store Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-center gap-4"
          >
            <a href="#" className="opacity-60 hover:opacity-100 transition-opacity">
              <img src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/de-de?size=250x83" alt="App Store" className="h-12" />
            </a>
            <a href="#" className="opacity-60 hover:opacity-100 transition-opacity">
              <img src="https://play.google.com/intl/en_us/badges/static/images/badges/de_badge_web_generic.png" alt="Google Play" className="h-[52px]" />
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-20 grid grid-cols-3 gap-8 max-w-2xl mx-auto"
          >
            {[
              { value: '50K+', label: 'Aktive Nutzer' },
              { value: '100K+', label: 'Bestellungen' },
              { value: '4.9★', label: 'App Rating' },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-white/40">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-white/40 rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* Features Showcase */}
      <section className="py-32 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl font-black mb-4">6 Apps in einer</h2>
            <p className="text-xl text-white/60">Alles was du brauchst, an einem Ort</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group p-8 rounded-3xl bg-white/[0.02] backdrop-blur-xl border border-white/5 hover:border-white/20 transition-all hover:scale-105 cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, ${feature.color}08, transparent)`,
                }}
              >
                <div className="text-6xl mb-4">{feature.icon}</div>
                <h3 className="text-2xl font-bold mb-2" style={{ color: feature.color }}>
                  {feature.title}
                </h3>
                <p className="text-white/60">{feature.desc}</p>
                <div className="mt-6 flex items-center gap-2 text-sm font-semibold" style={{ color: feature.color }}>
                  Mehr erfahren
                  <ChevronRight size={16} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-32 px-4 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-5xl font-black mb-6">Warum BidBlitz?</h2>
          <p className="text-xl text-white/60 mb-16">Die sicherste & schnellste Super-App</p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Shield, title: 'Sicher', desc: 'Verschlüsselte Zahlungen & Datenschutz' },
              { icon: Zap, title: 'Schnell', desc: 'Blitzschnelle Lieferung & Service' },
              { icon: Star, title: 'Beste Bewertungen', desc: '4.9★ von 50.000+ Nutzern' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 rounded-2xl bg-white/[0.02] border border-white/5"
              >
                <item.icon size={48} className="text-cyan-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">{item.title}</h3>
                <p className="text-white/60">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 blur-3xl" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h2 className="text-6xl font-black mb-6">Bereit loszulegen?</h2>
          <p className="text-2xl text-white/60 mb-12">
            Jetzt kostenlos starten und 10€ Willkommensbonus erhalten
          </p>
          <button
            onClick={onGetStarted}
            className="px-12 py-5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-cyan-500/50 transition-all hover:scale-105"
          >
            App jetzt öffnen
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto text-center text-white/40 text-sm">
          <p>© 2026 BidBlitz. Alle Rechte vorbehalten.</p>
          <div className="flex items-center justify-center gap-6 mt-4">
            <a href="/datenschutz" className="hover:text-white/80 transition-colors" data-testid="footer-privacy-link">Datenschutz</a>
            <a href="/agb" className="hover:text-white/80 transition-colors" data-testid="footer-terms-link">AGB</a>
            <a href="/contact" className="hover:text-white/80 transition-colors" data-testid="footer-contact-link">Kontakt</a>
          </div>
        </div>
      </footer>

      {/* AI Landing Chatbot */}
      {!TEST_MODE && <LandingChatbot />}
    </div>
  );
}
