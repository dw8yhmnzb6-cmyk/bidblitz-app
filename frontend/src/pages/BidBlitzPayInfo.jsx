import React, { useState } from 'react';
import { 
  Smartphone, Shield, Zap, CreditCard, Gift, QrCode, 
  Users, ArrowRight, Check, ChevronDown, ChevronUp,
  Wallet, Store, Bell, Trophy, RefreshCw, Lock, Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';

const HowItWorks = () => {
  const navigate = useNavigate();
  const [language] = useState(() => localStorage.getItem('language') || 'de');
  const [openFaq, setOpenFaq] = useState(null);

  const translations = {
    de: {
      heroTitle: 'BidBlitz Pay',
      heroSubtitle: 'Einfach. Sicher. Schnell.',
      heroDescription: 'Mit BidBlitz Pay ist das Bezahlen und Geld senden so einfach wie noch nie. Nutze dein digitales Wallet für Auktionen, Überweisungen und vieles mehr.',
      startNow: 'Jetzt starten',
      learnMore: 'Mehr erfahren',
      
      // Features Section
      featuresTitle: 'So funktioniert\'s',
      featuresSubtitle: 'BidBlitz Pay hat viele Vorteile für dich:',
      
      feature1Title: 'Digitales Wallet',
      feature1Desc: 'Du brauchst nur dein Smartphone und kannst dein Portemonnaie zu Hause lassen.',
      
      feature2Title: 'Geld senden & empfangen',
      feature2Desc: 'Überweise Geld an Freunde und Familie - sofort und kostenlos.',
      
      feature3Title: 'Kontakte speichern',
      feature3Desc: 'Speichere häufige Empfänger und überweise mit nur einem Klick.',
      
      feature4Title: 'Transaktionsübersicht',
      feature4Desc: 'Du findest alle Zahlungen in deiner detaillierten Transaktionsübersicht.',
      
      feature5Title: 'Bonus & Cashback',
      feature5Desc: 'Bei jeder Aufladung erhältst du Bonus-Guthaben und Cashback.',
      
      feature6Title: 'Sicher bezahlen',
      feature6Desc: 'Deine Daten sind durch modernste Verschlüsselung geschützt.',
      
      // How To Section
      howToTitle: 'In 3 Schritten loslegen',
      step1Title: 'Konto erstellen',
      step1Desc: 'Registriere dich kostenlos mit deiner E-Mail-Adresse.',
      step2Title: 'Guthaben aufladen',
      step2Desc: 'Lade dein Wallet per Karte, Überweisung oder im Geschäft auf.',
      step3Title: 'Loslegen!',
      step3Desc: 'Sende Geld, biete bei Auktionen oder bezahle in Partnergeschäften.',
      
      // Benefits Section
      benefitsTitle: 'Deine Vorteile',
      benefit1: 'Kostenlose Überweisungen an andere BidBlitz-Nutzer',
      benefit2: 'Bis zu 6% Bonus bei Aufladungen',
      benefit3: 'Gratis-Gebote für Auktionen',
      benefit4: 'Tägliche Login-Belohnungen',
      benefit5: 'Ranglisten & Abzeichen sammeln',
      benefit6: 'Freunde einladen und verdienen',
      
      // Security Section
      securityTitle: 'Sicherheit hat Priorität',
      securityDesc: 'Bei BidBlitz Pay ist dein Geld sicher. Wir verwenden die neuesten Sicherheitstechnologien, um deine Daten und Transaktionen zu schützen.',
      security1: '256-bit SSL-Verschlüsselung',
      security2: 'Zwei-Faktor-Authentifizierung',
      security3: 'Sichere Server in der EU',
      security4: 'DSGVO-konform',
      
      // FAQ Section
      faqTitle: 'Häufig gestellte Fragen',
      faq1Q: 'Wie lade ich mein Guthaben auf?',
      faq1A: 'Du kannst dein Guthaben per Kreditkarte, Banküberweisung, PayPal oder bar im Partnergeschäft aufladen. Bei höheren Beträgen erhältst du automatisch Bonus-Guthaben.',
      faq2Q: 'Ist BidBlitz Pay kostenlos?',
      faq2A: 'Ja! Die Registrierung und Nutzung von BidBlitz Pay ist komplett kostenlos. Überweisungen an andere Nutzer sind ebenfalls gebührenfrei.',
      faq3Q: 'Wie sicher ist mein Geld?',
      faq3A: 'Dein Geld ist durch modernste Verschlüsselung und Sicherheitsmaßnahmen geschützt. Wir arbeiten nur mit vertrauenswürdigen Zahlungsanbietern zusammen.',
      faq4Q: 'Kann ich Geld an jeden senden?',
      faq4A: 'Du kannst Geld an jeden BidBlitz-Nutzer senden. Der Empfänger benötigt lediglich ein BidBlitz-Konto mit seiner E-Mail-Adresse oder Kundennummer.',
      faq5Q: 'Was sind Gratis-Gebote?',
      faq5A: 'Gratis-Gebote sind kostenlose Gebote für unsere Auktionen. Du erhältst sie bei Aufladungen, täglichen Logins und durch Aktionen.',
      
      // CTA Section
      ctaTitle: 'Bereit loszulegen?',
      ctaDesc: 'Erstelle jetzt dein kostenloses BidBlitz Pay Konto und entdecke die Vorteile.',
      ctaButton: 'Kostenlos registrieren',
      ctaLogin: 'Bereits Mitglied? Anmelden',
      
      // Footer
      footerNote: 'BidBlitz Pay - Die smarte Art zu bezahlen'
    },
    en: {
      heroTitle: 'BidBlitz Pay',
      heroSubtitle: 'Simple. Secure. Fast.',
      heroDescription: 'With BidBlitz Pay, paying and sending money has never been easier. Use your digital wallet for auctions, transfers and much more.',
      startNow: 'Get Started',
      learnMore: 'Learn More',
      featuresTitle: 'How it works',
      featuresSubtitle: 'BidBlitz Pay has many benefits for you:',
      feature1Title: 'Digital Wallet',
      feature1Desc: 'You only need your smartphone and can leave your wallet at home.',
      feature2Title: 'Send & Receive Money',
      feature2Desc: 'Transfer money to friends and family - instantly and free.',
      feature3Title: 'Save Contacts',
      feature3Desc: 'Save frequent recipients and transfer with just one click.',
      feature4Title: 'Transaction Overview',
      feature4Desc: 'Find all payments in your detailed transaction overview.',
      feature5Title: 'Bonus & Cashback',
      feature5Desc: 'Get bonus credit and cashback with every top-up.',
      feature6Title: 'Pay Securely',
      feature6Desc: 'Your data is protected by state-of-the-art encryption.',
      howToTitle: 'Get started in 3 steps',
      step1Title: 'Create Account',
      step1Desc: 'Register for free with your email address.',
      step2Title: 'Top Up Balance',
      step2Desc: 'Top up your wallet via card, transfer or in-store.',
      step3Title: 'Get Started!',
      step3Desc: 'Send money, bid at auctions or pay at partner stores.',
      benefitsTitle: 'Your Benefits',
      benefit1: 'Free transfers to other BidBlitz users',
      benefit2: 'Up to 6% bonus on top-ups',
      benefit3: 'Free bids for auctions',
      benefit4: 'Daily login rewards',
      benefit5: 'Collect rankings & badges',
      benefit6: 'Invite friends and earn',
      securityTitle: 'Security is Priority',
      securityDesc: 'At BidBlitz Pay, your money is safe. We use the latest security technologies to protect your data and transactions.',
      security1: '256-bit SSL encryption',
      security2: 'Two-factor authentication',
      security3: 'Secure servers in the EU',
      security4: 'GDPR compliant',
      faqTitle: 'Frequently Asked Questions',
      faq1Q: 'How do I top up my balance?',
      faq1A: 'You can top up your balance via credit card, bank transfer, PayPal or cash at partner stores. You automatically receive bonus credit for higher amounts.',
      faq2Q: 'Is BidBlitz Pay free?',
      faq2A: 'Yes! Registration and use of BidBlitz Pay is completely free. Transfers to other users are also free of charge.',
      faq3Q: 'How safe is my money?',
      faq3A: 'Your money is protected by state-of-the-art encryption and security measures. We only work with trusted payment providers.',
      faq4Q: 'Can I send money to anyone?',
      faq4A: 'You can send money to any BidBlitz user. The recipient only needs a BidBlitz account with their email address or customer number.',
      faq5Q: 'What are free bids?',
      faq5A: 'Free bids are free bids for our auctions. You get them with top-ups, daily logins and promotions.',
      ctaTitle: 'Ready to get started?',
      ctaDesc: 'Create your free BidBlitz Pay account now and discover the benefits.',
      ctaButton: 'Register for free',
      ctaLogin: 'Already a member? Log in',
      footerNote: 'BidBlitz Pay - The smart way to pay'
    }
  };

  const t = translations[language] || translations.de;

  const features = [
    { icon: Wallet, title: t.feature1Title, desc: t.feature1Desc, color: 'from-amber-400 to-orange-500' },
    { icon: RefreshCw, title: t.feature2Title, desc: t.feature2Desc, color: 'from-green-400 to-emerald-500' },
    { icon: Users, title: t.feature3Title, desc: t.feature3Desc, color: 'from-blue-400 to-indigo-500' },
    { icon: CreditCard, title: t.feature4Title, desc: t.feature4Desc, color: 'from-purple-400 to-violet-500' },
    { icon: Gift, title: t.feature5Title, desc: t.feature5Desc, color: 'from-pink-400 to-rose-500' },
    { icon: Shield, title: t.feature6Title, desc: t.feature6Desc, color: 'from-teal-400 to-cyan-500' },
  ];

  const faqs = [
    { q: t.faq1Q, a: t.faq1A },
    { q: t.faq2Q, a: t.faq2A },
    { q: t.faq3Q, a: t.faq3A },
    { q: t.faq4Q, a: t.faq4A },
    { q: t.faq5Q, a: t.faq5A },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-16">
          <div className="text-center">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-2xl mb-6 transform hover:scale-105 transition-transform">
              <Wallet className="w-10 h-10 text-white" />
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-4">
              {t.heroTitle}
            </h1>
            
            <div className="inline-block bg-black text-white px-6 py-2 text-xl md:text-2xl font-bold mb-6">
              {t.heroSubtitle}
            </div>
            
            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-8">
              {t.heroDescription}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => navigate('/register')}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all"
              >
                {t.startNow}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button 
                variant="outline"
                onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
                className="text-lg px-8 py-6 rounded-full border-2 border-gray-300 hover:border-amber-500 hover:text-amber-600"
              >
                {t.learnMore}
              </Button>
            </div>
          </div>
          
          {/* Phone Mockup */}
          <div className="mt-12 flex justify-center">
            <div className="relative">
              <div className="w-64 h-[500px] bg-gray-900 rounded-[40px] p-3 shadow-2xl transform hover:scale-105 transition-transform">
                <div className="w-full h-full bg-gradient-to-b from-amber-100 to-orange-100 rounded-[32px] overflow-hidden">
                  {/* Status Bar */}
                  <div className="h-6 bg-gray-900 flex items-center justify-center">
                    <div className="w-20 h-4 bg-gray-800 rounded-full" />
                  </div>
                  {/* App Content Preview */}
                  <div className="p-4 space-y-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Verfügbares Guthaben</p>
                      <p className="text-3xl font-bold text-gray-900">€2,059.01</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                          <Zap className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">1,345</p>
                          <p className="text-xs text-gray-500">Gratis-Gebote</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {['Senden', 'Anfordern', 'Aufladen', 'Scannen'].map((item, i) => (
                        <div key={i} className="bg-white rounded-xl p-2 text-center shadow">
                          <div className="w-8 h-8 bg-amber-100 rounded-full mx-auto mb-1 flex items-center justify-center">
                            {i === 0 && <ArrowRight className="w-4 h-4 text-amber-600" />}
                            {i === 1 && <RefreshCw className="w-4 h-4 text-amber-600" />}
                            {i === 2 && <CreditCard className="w-4 h-4 text-amber-600" />}
                            {i === 3 && <QrCode className="w-4 h-4 text-amber-600" />}
                          </div>
                          <p className="text-[10px] text-gray-600">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-amber-400 rounded-full blur-2xl opacity-50" />
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-orange-400 rounded-full blur-xl opacity-50" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              <span className="bg-black text-white px-4 py-1">{t.featuresTitle}</span>
            </h2>
            <p className="text-lg text-gray-600">{t.featuresSubtitle}</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 border border-gray-100"
              >
                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 shadow-lg`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How To Section */}
      <section className="py-16 px-4 bg-gradient-to-r from-amber-500 to-orange-600">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-white text-center mb-12">
            {t.howToTitle}
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: '1', title: t.step1Title, desc: t.step1Desc, icon: Smartphone },
              { num: '2', title: t.step2Title, desc: t.step2Desc, icon: CreditCard },
              { num: '3', title: t.step3Title, desc: t.step3Desc, icon: Sparkles },
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className="relative inline-block mb-4">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl">
                    <step.icon className="w-10 h-10 text-amber-600" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold text-lg">
                    {step.num}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                <p className="text-amber-100">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 text-center mb-12">
            <span className="bg-black text-white px-4 py-1">{t.benefitsTitle}</span>
          </h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            {[t.benefit1, t.benefit2, t.benefit3, t.benefit4, t.benefit5, t.benefit6].map((benefit, index) => (
              <div key={index} className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-gray-700 font-medium">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-16 px-4 bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">{t.securityTitle}</h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">{t.securityDesc}</p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[t.security1, t.security2, t.security3, t.security4].map((item, index) => (
              <div key={index} className="bg-gray-800 rounded-xl p-4 text-center">
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Shield className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-white font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 text-center mb-12">
            <span className="bg-black text-white px-4 py-1">{t.faqTitle}</span>
          </h2>
          
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index}
                className="bg-white rounded-xl shadow-md overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-bold text-gray-900">{faq.q}</span>
                  {openFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-amber-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-5 pb-5 text-gray-600">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">{t.ctaTitle}</h2>
          <p className="text-lg text-amber-100 mb-8">{t.ctaDesc}</p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate('/register')}
              className="bg-white text-amber-600 hover:bg-gray-100 text-lg px-8 py-6 rounded-full shadow-lg font-bold"
            >
              {t.ctaButton}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate('/login')}
              className="bg-transparent border-2 border-white text-white hover:bg-white/10 text-lg px-8 py-6 rounded-full"
            >
              {t.ctaLogin}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer Note */}
      <div className="bg-gray-900 py-6 text-center">
        <p className="text-gray-400">{t.footerNote}</p>
      </div>
    </div>
  );
};

export default HowItWorks;
