import React, { useState } from 'react';
import { 
  Shield, Zap, CreditCard, Gift, QrCode, 
  Users, ArrowRight, Check, ChevronDown, ChevronUp,
  Wallet, RefreshCw, Lock, Sparkles, Send, Smartphone,
  Star, Award, MessageCircle, Phone, Mail, Clock, BadgeCheck,
  TrendingUp, Heart, ShieldCheck, Headphones
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';

const BidBlitzPayInfo = () => {
  const navigate = useNavigate();
  const [language] = useState(() => localStorage.getItem('language') || 'de');
  const [openFaq, setOpenFaq] = useState(null);

  const translations = {
    de: {
      heroTitle: 'BidBlitz Pay',
      heroSubtitle: 'Einfach. Sicher. Schnell.',
      heroDescription: 'Dein digitales Wallet für Auktionen, Überweisungen und mehr.',
      startNow: 'Jetzt starten',
      learnMore: 'Mehr erfahren',
      
      // Trust Stats
      statsUsers: 'Aktive Nutzer',
      statsTransactions: 'Überwiesen',
      statsRating: 'Bewertung',
      statsYears: 'Jahre Erfahrung',
      
      featuresTitle: 'So funktioniert\'s',
      featuresSubtitle: 'Alle Vorteile auf einen Blick',
      
      feature1Title: 'Digitales Wallet',
      feature1Desc: 'Smartphone statt Portemonnaie',
      feature2Title: 'Geld senden',
      feature2Desc: 'Sofort & kostenlos',
      feature3Title: 'Kontakte speichern',
      feature3Desc: 'Mit einem Klick überweisen',
      feature4Title: 'Übersicht',
      feature4Desc: 'Alle Zahlungen im Blick',
      feature5Title: 'Bonus',
      feature5Desc: 'Bis zu 6% extra',
      feature6Title: 'Sicher',
      feature6Desc: 'Modernste Verschlüsselung',
      
      // Trust Section
      trustTitle: 'Warum uns vertrauen?',
      trustSubtitle: 'Sicherheit und Vertrauen sind unsere Priorität',
      
      // Guarantees
      guaranteesTitle: 'Unsere Garantien',
      guarantee1Title: '100% Geld-zurück',
      guarantee1Desc: 'Volle Erstattung bei Problemen',
      guarantee2Title: 'Käuferschutz',
      guarantee2Desc: 'Sichere Transaktionen garantiert',
      guarantee3Title: 'Betrugsschutz',
      guarantee3Desc: '24/7 Überwachung & Schutz',
      guarantee4Title: 'Datenschutz',
      guarantee4Desc: 'DSGVO-konform & verschlüsselt',
      
      // Testimonials
      testimonialsTitle: 'Das sagen unsere Kunden',
      
      howToTitle: 'In 3 Schritten starten',
      step1Title: 'Registrieren',
      step1Desc: 'Kostenlos mit E-Mail',
      step2Title: 'Aufladen',
      step2Desc: 'Per Karte oder Überweisung',
      step3Title: 'Loslegen',
      step3Desc: 'Senden, bieten, bezahlen',
      
      benefitsTitle: 'Deine Vorteile',
      benefit1: 'Kostenlose Überweisungen',
      benefit2: 'Bis zu 6% Bonus',
      benefit3: 'Gratis-Gebote',
      benefit4: 'Tägliche Belohnungen',
      benefit5: 'Ranglisten & Abzeichen',
      benefit6: 'Freunde einladen',
      
      securityTitle: 'Bank-Level Sicherheit',
      securityDesc: 'Dein Geld ist bei uns sicher.',
      security1: '256-bit SSL',
      security2: '2-Faktor-Auth',
      security3: 'EU-Server',
      security4: 'DSGVO',
      
      // Support
      supportTitle: 'Immer für dich da',
      supportDesc: 'Unser Support-Team hilft dir',
      support247: '24/7 Erreichbar',
      supportChat: 'Live-Chat',
      supportEmail: 'E-Mail Support',
      supportPhone: 'Telefon Hotline',
      
      faqTitle: 'FAQ',
      faq1Q: 'Wie lade ich auf?',
      faq1A: 'Per Kreditkarte, Überweisung, PayPal oder bar im Geschäft.',
      faq2Q: 'Ist es kostenlos?',
      faq2A: 'Ja! Registrierung und Nutzung sind komplett kostenlos.',
      faq3Q: 'Wie sicher ist mein Geld?',
      faq3A: 'Modernste Verschlüsselung und sichere EU-Server schützen dich.',
      faq4Q: 'An wen kann ich senden?',
      faq4A: 'An jeden BidBlitz-Nutzer per E-Mail oder Kundennummer.',
      faq5Q: 'Was sind Gratis-Gebote?',
      faq5A: 'Kostenlose Gebote für Auktionen bei Aufladungen und Aktionen.',
      
      ctaTitle: 'Bereit?',
      ctaDesc: 'Schließe dich tausenden zufriedenen Nutzern an.',
      ctaButton: 'Kostenlos starten',
      ctaLogin: 'Schon Mitglied? Anmelden',
      
      footerNote: 'BidBlitz Pay - Die smarte Art zu bezahlen',
      trustedBy: 'Vertrauenswürdige Partner'
    },
    en: {
      heroTitle: 'BidBlitz Pay',
      heroSubtitle: 'Simple. Secure. Fast.',
      heroDescription: 'Your digital wallet for auctions, transfers and more.',
      startNow: 'Get Started',
      learnMore: 'Learn More',
      statsUsers: 'Active Users',
      statsTransactions: 'Transferred',
      statsRating: 'Rating',
      statsYears: 'Years Experience',
      featuresTitle: 'How it works',
      featuresSubtitle: 'All benefits at a glance',
      feature1Title: 'Digital Wallet',
      feature1Desc: 'Phone instead of wallet',
      feature2Title: 'Send Money',
      feature2Desc: 'Instant & free',
      feature3Title: 'Save Contacts',
      feature3Desc: 'One-click transfers',
      feature4Title: 'Overview',
      feature4Desc: 'All payments tracked',
      feature5Title: 'Bonus',
      feature5Desc: 'Up to 6% extra',
      feature6Title: 'Secure',
      feature6Desc: 'Latest encryption',
      trustTitle: 'Why trust us?',
      trustSubtitle: 'Security and trust are our priority',
      guaranteesTitle: 'Our Guarantees',
      guarantee1Title: '100% Money-back',
      guarantee1Desc: 'Full refund if problems occur',
      guarantee2Title: 'Buyer Protection',
      guarantee2Desc: 'Secure transactions guaranteed',
      guarantee3Title: 'Fraud Protection',
      guarantee3Desc: '24/7 monitoring & protection',
      guarantee4Title: 'Data Privacy',
      guarantee4Desc: 'GDPR compliant & encrypted',
      testimonialsTitle: 'What our customers say',
      howToTitle: 'Start in 3 Steps',
      step1Title: 'Register',
      step1Desc: 'Free with email',
      step2Title: 'Top Up',
      step2Desc: 'Card or transfer',
      step3Title: 'Go!',
      step3Desc: 'Send, bid, pay',
      benefitsTitle: 'Your Benefits',
      benefit1: 'Free transfers',
      benefit2: 'Up to 6% bonus',
      benefit3: 'Free bids',
      benefit4: 'Daily rewards',
      benefit5: 'Rankings & badges',
      benefit6: 'Invite friends',
      securityTitle: 'Bank-Level Security',
      securityDesc: 'Your money is safe with us.',
      security1: '256-bit SSL',
      security2: '2-Factor Auth',
      security3: 'EU Servers',
      security4: 'GDPR',
      supportTitle: 'Always here for you',
      supportDesc: 'Our support team helps you',
      support247: '24/7 Available',
      supportChat: 'Live Chat',
      supportEmail: 'Email Support',
      supportPhone: 'Phone Hotline',
      faqTitle: 'FAQ',
      faq1Q: 'How to top up?',
      faq1A: 'Credit card, transfer, PayPal or cash in-store.',
      faq2Q: 'Is it free?',
      faq2A: 'Yes! Registration and use are completely free.',
      faq3Q: 'How safe is my money?',
      faq3A: 'Latest encryption and secure EU servers protect you.',
      faq4Q: 'Who can I send to?',
      faq4A: 'Any BidBlitz user via email or customer number.',
      faq5Q: 'What are free bids?',
      faq5A: 'Free auction bids with top-ups and promotions.',
      ctaTitle: 'Ready?',
      ctaDesc: 'Join thousands of satisfied users.',
      ctaButton: 'Start for free',
      ctaLogin: 'Already a member? Log in',
      footerNote: 'BidBlitz Pay - The smart way to pay',
      trustedBy: 'Trusted Partners'
    }
  };

  const t = translations[language] || translations.de;

  const features = [
    { icon: Wallet, title: t.feature1Title, desc: t.feature1Desc, color: 'bg-gradient-to-br from-amber-400 to-orange-500' },
    { icon: Send, title: t.feature2Title, desc: t.feature2Desc, color: 'bg-gradient-to-br from-green-400 to-emerald-500' },
    { icon: Users, title: t.feature3Title, desc: t.feature3Desc, color: 'bg-gradient-to-br from-blue-400 to-indigo-500' },
    { icon: CreditCard, title: t.feature4Title, desc: t.feature4Desc, color: 'bg-gradient-to-br from-purple-400 to-violet-500' },
    { icon: Gift, title: t.feature5Title, desc: t.feature5Desc, color: 'bg-gradient-to-br from-pink-400 to-rose-500' },
    { icon: Shield, title: t.feature6Title, desc: t.feature6Desc, color: 'bg-gradient-to-br from-teal-400 to-cyan-500' },
  ];

  const testimonials = [
    {
      name: 'Sarah M.',
      role: language === 'de' ? 'Verifizierter Nutzer' : 'Verified User',
      text: language === 'de' 
        ? 'Super einfach zu benutzen! Ich überweise jetzt immer mit BidBlitz Pay an meine Familie.' 
        : 'Super easy to use! I now always transfer to my family with BidBlitz Pay.',
      rating: 5,
      avatar: 'S'
    },
    {
      name: 'Thomas K.',
      role: language === 'de' ? 'Seit 2 Jahren dabei' : 'Member for 2 years',
      text: language === 'de'
        ? 'Die Bonus-Gebote bei Aufladungen sind genial! Habe schon viele Auktionen gewonnen.'
        : 'The bonus bids on top-ups are brilliant! I have already won many auctions.',
      rating: 5,
      avatar: 'T'
    },
    {
      name: 'Lisa B.',
      role: language === 'de' ? 'Premium Nutzerin' : 'Premium User',
      text: language === 'de'
        ? 'Schnell, sicher und der Support ist wirklich hilfsbereit. Kann ich nur empfehlen!'
        : 'Fast, secure and the support is really helpful. I can only recommend it!',
      rating: 5,
      avatar: 'L'
    }
  ];

  const guarantees = [
    { icon: RefreshCw, title: t.guarantee1Title, desc: t.guarantee1Desc, color: 'text-green-500' },
    { icon: ShieldCheck, title: t.guarantee2Title, desc: t.guarantee2Desc, color: 'text-blue-500' },
    { icon: Lock, title: t.guarantee3Title, desc: t.guarantee3Desc, color: 'text-purple-500' },
    { icon: BadgeCheck, title: t.guarantee4Title, desc: t.guarantee4Desc, color: 'text-amber-500' },
  ];

  const faqs = [
    { q: t.faq1Q, a: t.faq1A },
    { q: t.faq2Q, a: t.faq2A },
    { q: t.faq3Q, a: t.faq3A },
    { q: t.faq4Q, a: t.faq4A },
    { q: t.faq5Q, a: t.faq5A },
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-500 via-orange-500 to-orange-600">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/10 rounded-full translate-x-1/4 translate-y-1/4" />
        
        <div className="relative px-5 pt-16 pb-12">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-2xl flex items-center justify-center animate-pulse">
              <Wallet className="w-10 h-10 text-orange-500" />
            </div>
          </div>
          
          <h1 className="text-4xl font-black text-white text-center mb-3">
            {t.heroTitle}
          </h1>
          
          <div className="flex justify-center mb-5">
            <span className="bg-black/20 backdrop-blur-sm text-white px-5 py-2 rounded-full text-lg font-bold">
              {t.heroSubtitle}
            </span>
          </div>
          
          <p className="text-white/90 text-center text-base mb-8 px-4 max-w-sm mx-auto">
            {t.heroDescription}
          </p>
          
          <div className="flex flex-col gap-3 px-4 max-w-sm mx-auto">
            <Button 
              onClick={() => navigate('/register')}
              className="w-full bg-white text-orange-600 hover:bg-gray-100 text-lg py-6 rounded-xl font-bold shadow-lg"
            >
              {t.startNow}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              variant="ghost"
              onClick={() => navigate('/login')}
              className="w-full text-white hover:bg-white/10 text-base py-5 rounded-xl"
            >
              {t.ctaLogin}
            </Button>
          </div>
          
          {/* Phone Preview */}
          <div className="mt-10 flex justify-center">
            <div className="relative w-48">
              <div className="bg-gray-900 rounded-[28px] p-2 shadow-2xl">
                <div className="bg-gradient-to-b from-orange-100 to-amber-100 rounded-[22px] overflow-hidden">
                  <div className="h-5 bg-gray-900 flex justify-center items-center">
                    <div className="w-14 h-3 bg-gray-800 rounded-full" />
                  </div>
                  <div className="p-3 space-y-3">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500">Guthaben</p>
                      <p className="text-xl font-bold text-gray-900">€2,059</p>
                    </div>
                    <div className="bg-white rounded-xl p-2 shadow-sm flex items-center gap-2">
                      <div className="w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center">
                        <Zap className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900">1,345</p>
                        <p className="text-[8px] text-gray-500">Gebote</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {['Senden', 'Aufladen', 'Scannen'].map((item, i) => (
                        <div key={i} className="bg-white rounded-lg p-1.5 text-center shadow-sm">
                          <div className="w-5 h-5 bg-orange-100 rounded-full mx-auto mb-1 flex items-center justify-center">
                            {i === 0 && <ArrowRight className="w-3 h-3 text-orange-600" />}
                            {i === 1 && <CreditCard className="w-3 h-3 text-orange-600" />}
                            {i === 2 && <QrCode className="w-3 h-3 text-orange-600" />}
                          </div>
                          <p className="text-[7px] text-gray-600">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Stats */}
      <section className="py-8 px-5 bg-gray-800">
        <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
          <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-700">
            <div className="text-2xl font-black text-amber-500">10.000+</div>
            <div className="text-xs text-gray-400">{t.statsUsers}</div>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-700">
            <div className="text-2xl font-black text-green-500">€500K+</div>
            <div className="text-xs text-gray-400">{t.statsTransactions}</div>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-700">
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-black text-yellow-500">4.8</span>
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            </div>
            <div className="text-xs text-gray-400">{t.statsRating}</div>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-700">
            <div className="text-2xl font-black text-blue-500">3+</div>
            <div className="text-xs text-gray-400">{t.statsYears}</div>
          </div>
        </div>
      </section>

      {/* Trusted By - Payment Partners */}
      <section className="py-6 px-5 bg-gray-900 border-y border-gray-800">
        <p className="text-center text-xs text-gray-500 mb-4">{t.trustedBy}</p>
        <div className="flex justify-center items-center gap-6 flex-wrap">
          {/* Payment Partner Logos as styled text badges */}
          <div className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">VISA</div>
          <div className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold">Mastercard</div>
          <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">Stripe</div>
          <div className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold">PayPal</div>
          <div className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
            <Lock className="w-3 h-3" /> SSL
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 px-5 bg-gray-900">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-white mb-2">
            {t.featuresTitle}
          </h2>
          <p className="text-gray-400 text-sm">{t.featuresSubtitle}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="bg-gray-800 rounded-2xl p-4 border border-gray-700"
            >
              <div className={`w-11 h-11 ${feature.color} rounded-xl flex items-center justify-center mb-3 shadow-lg`}>
                <feature.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{feature.title}</h3>
              <p className="text-xs text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Guarantees Section */}
      <section className="py-12 px-5 bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-500 rounded-xl mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">{t.guaranteesTitle}</h2>
        </div>
        
        <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
          {guarantees.map((item, index) => (
            <div key={index} className="bg-gray-900 rounded-2xl p-4 border border-gray-700">
              <item.icon className={`w-8 h-8 ${item.color} mb-2`} />
              <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
              <p className="text-xs text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-12 px-5 bg-gray-800">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-white mb-2">{t.testimonialsTitle}</h2>
        </div>
        
        <div className="space-y-4 max-w-sm mx-auto">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-gray-900 rounded-2xl p-4 border border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white">{testimonial.name}</p>
                    <BadgeCheck className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-xs text-gray-500">{testimonial.role}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300 mb-3">"{testimonial.text}"</p>
              <div className="flex gap-0.5">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How To Section */}
      <section className="py-12 px-5 bg-gradient-to-b from-orange-500 to-amber-500">
        <h2 className="text-2xl font-black text-white text-center mb-8">
          {t.howToTitle}
        </h2>
        
        <div className="space-y-4 max-w-sm mx-auto">
          {[
            { num: '1', title: t.step1Title, desc: t.step1Desc, icon: Smartphone },
            { num: '2', title: t.step2Title, desc: t.step2Desc, icon: CreditCard },
            { num: '3', title: t.step3Title, desc: t.step3Desc, icon: Sparkles },
          ].map((step, index) => (
            <div key={index} className="flex items-center gap-4 bg-white/20 backdrop-blur-sm rounded-2xl p-4">
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-lg">
                  <step.icon className="w-7 h-7 text-orange-500" />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {step.num}
                </div>
              </div>
              <div>
                <h3 className="text-white font-bold text-base">{step.title}</h3>
                <p className="text-white/80 text-sm">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Support Section */}
      <section className="py-12 px-5 bg-gray-900">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-500 rounded-xl mb-4">
            <Headphones className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">{t.supportTitle}</h2>
          <p className="text-gray-400 text-sm">{t.supportDesc}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          <div className="bg-gray-800 rounded-xl p-3 text-center border border-gray-700">
            <Clock className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-white text-xs font-medium">{t.support247}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center border border-gray-700">
            <MessageCircle className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-white text-xs font-medium">{t.supportChat}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center border border-gray-700">
            <Mail className="w-6 h-6 text-purple-500 mx-auto mb-2" />
            <p className="text-white text-xs font-medium">{t.supportEmail}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center border border-gray-700">
            <Phone className="w-6 h-6 text-amber-500 mx-auto mb-2" />
            <p className="text-white text-xs font-medium">{t.supportPhone}</p>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-12 px-5 bg-black">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl mb-4 animate-pulse">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">{t.securityTitle}</h2>
          <p className="text-gray-400 text-sm">{t.securityDesc}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          {[t.security1, t.security2, t.security3, t.security4].map((item, index) => (
            <div key={index} className="bg-gray-900 rounded-xl p-3 text-center border border-green-900">
              <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <Shield className="w-4 h-4 text-green-400" />
              </div>
              <p className="text-white text-xs font-medium">{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 px-5 bg-gray-900">
        <h2 className="text-2xl font-black text-white text-center mb-8">
          {t.faqTitle}
        </h2>
        
        <div className="space-y-3 max-w-sm mx-auto">
          {faqs.map((faq, index) => (
            <div 
              key={index}
              className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700"
            >
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <span className="font-bold text-white text-sm pr-2">{faq.q}</span>
                {openFaq === index ? (
                  <ChevronUp className="w-5 h-5 text-orange-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                )}
              </button>
              {openFaq === index && (
                <div className="px-4 pb-4 text-gray-400 text-sm">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-12 px-5 bg-gradient-to-b from-orange-500 to-amber-600">
        <div className="text-center max-w-sm mx-auto">
          <h2 className="text-3xl font-black text-white mb-3">{t.ctaTitle}</h2>
          <p className="text-white/90 mb-6">{t.ctaDesc}</p>
          
          <Button 
            onClick={() => navigate('/register')}
            className="w-full bg-white text-orange-600 hover:bg-gray-100 text-lg py-6 rounded-xl font-bold shadow-lg mb-3"
          >
            {t.ctaButton}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <Button 
            variant="ghost"
            onClick={() => navigate('/login')}
            className="w-full text-white hover:bg-white/10 text-base py-4 rounded-xl"
          >
            {t.ctaLogin}
          </Button>
          
          {/* Trust badges at bottom */}
          <div className="mt-8 flex justify-center items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 text-white/70 text-xs">
              <ShieldCheck className="w-4 h-4" />
              <span>DSGVO</span>
            </div>
            <div className="flex items-center gap-1 text-white/70 text-xs">
              <Lock className="w-4 h-4" />
              <span>SSL</span>
            </div>
            <div className="flex items-center gap-1 text-white/70 text-xs">
              <BadgeCheck className="w-4 h-4" />
              <span>Verifiziert</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="bg-black py-6 text-center">
        <p className="text-gray-500 text-sm">{t.footerNote}</p>
      </div>
    </div>
  );
};

export default BidBlitzPayInfo;
