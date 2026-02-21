import React, { useState, useEffect } from 'react';
import { 
  Shield, Zap, CreditCard, Gift, QrCode, 
  Users, ArrowRight, Check, ChevronDown, ChevronUp,
  Wallet, RefreshCw, Lock, Sparkles, Send, Smartphone,
  Star, Award, MessageCircle, Phone, Mail, Clock, BadgeCheck,
  TrendingUp, Heart, ShieldCheck, Headphones, Trophy, Crown,
  Timer, MapPin, Eye, PartyPopper, Flame, AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { getTranslation } from './translations/bidblitzPayInfoTranslations';

const BidBlitzPayInfo = () => {
  const navigate = useNavigate();
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'de');
  
  // Listen for language changes
  useEffect(() => {
    const handleStorageChange = () => {
      const newLang = localStorage.getItem('language') || 'de';
      setLanguage(newLang);
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically for changes (for same-tab updates)
    const interval = setInterval(() => {
      const currentLang = localStorage.getItem('language') || 'de';
      if (currentLang !== language) {
        setLanguage(currentLang);
      }
    }, 500);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [language]);
  const [openFaq, setOpenFaq] = useState(null);
  
  // Countdown Timer State
  const [timeLeft, setTimeLeft] = useState({ hours: 2, minutes: 45, seconds: 30 });
  
  // Live Ticker State
  const [currentSignup, setCurrentSignup] = useState(0);
  const [viewerCount, setViewerCount] = useState(47);
  
  // Lucky Wheel State
  const [showWheel, setShowWheel] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelResult, setWheelResult] = useState(null);
  
  // Fake signups for social proof
  const recentSignups = [
    { name: 'Sarah M.', city: 'München', time: 'vor 2 Min.' },
    { name: 'Thomas K.', city: 'Berlin', time: 'vor 3 Min.' },
    { name: 'Lisa B.', city: 'Hamburg', time: 'vor 5 Min.' },
    { name: 'Max W.', city: 'Frankfurt', time: 'vor 7 Min.' },
    { name: 'Anna S.', city: 'Köln', time: 'vor 8 Min.' },
    { name: 'Jan P.', city: 'Wien', time: 'vor 10 Min.' },
    { name: 'Maria G.', city: 'Zürich', time: 'vor 12 Min.' },
  ];
  
  // Countdown Timer Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return { hours: 2, minutes: 45, seconds: 30 }; // Reset
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Live Ticker Effect
  useEffect(() => {
    const ticker = setInterval(() => {
      setCurrentSignup(prev => (prev + 1) % recentSignups.length);
    }, 4000);
    
    const viewerUpdate = setInterval(() => {
      setViewerCount(prev => prev + Math.floor(Math.random() * 3) - 1);
    }, 5000);
    
    return () => {
      clearInterval(ticker);
      clearInterval(viewerUpdate);
    };
  }, []);
  
  // Spin the wheel
  const spinWheel = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setWheelResult(null);
    
    setTimeout(() => {
      const prizes = ['€5', '€10', '€2', '25 Gebote', '50 Gebote', '€3', '10 Gebote', '€7'];
      const result = prizes[Math.floor(Math.random() * prizes.length)];
      setWheelResult(result);
      setIsSpinning(false);
    }, 3000);
  };

  const translations = {
    de: {
      // Bonus Banner
      bonusBanner: '🎁 Willkommensbonus: €5 + 50 Gratis-Gebote!',
      limitedOffer: 'Zeitlich begrenzt',
      
      heroTitle: 'BidBlitz Pay',
      heroSubtitle: 'Einfach. Sicher. Schnell.',
      heroDescription: 'Dein digitales Wallet für Auktionen, Überweisungen und mehr.',
      startNow: 'Jetzt €5 Bonus sichern',
      learnMore: 'Mehr erfahren',
      
      // Countdown
      countdownTitle: 'Angebot endet in:',
      hours: 'Std',
      minutes: 'Min',
      seconds: 'Sek',
      
      // Live Ticker
      justSignedUp: 'hat sich gerade angemeldet',
      viewingNow: 'Personen schauen sich diese Seite an',
      
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
      
      // Lucky Wheel
      wheelTitle: '🎰 Glücksrad für Neukunden',
      wheelDesc: 'Drehe das Rad und gewinne bis zu €50!',
      spinButton: 'Jetzt drehen!',
      spinning: 'Dreht...',
      youWon: 'Du gewinnst:',
      claimPrize: 'Jetzt einlösen',
      
      // VIP Section
      vipTitle: '👑 VIP Early Access',
      vipDesc: 'Die ersten 1.000 Nutzer werden automatisch VIP!',
      vipBenefit1: 'Exklusive Bonus-Aktionen',
      vipBenefit2: 'Prioritäts-Support',
      vipBenefit3: 'Höhere Cashback-Raten',
      vipSpots: 'VIP-Plätze noch verfügbar',
      
      // App Store
      appStoreTitle: '📱 Bald in den App Stores',
      appStoreDesc: 'Melde dich jetzt an und werde benachrichtigt!',
      comingSoon: 'Bald verfügbar',
      
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
      
      ctaTitle: 'Jetzt €5 Bonus sichern!',
      ctaDesc: 'Schließe dich tausenden zufriedenen Nutzern an.',
      ctaButton: '🎁 Kostenlos starten',
      ctaLogin: 'Schon Mitglied? Anmelden',
      
      footerNote: 'BidBlitz Pay - Die smarte Art zu bezahlen',
      trustedBy: 'Vertrauenswürdige Partner'
    },
    en: {
      bonusBanner: '🎁 Welcome Bonus: €5 + 50 Free Bids!',
      limitedOffer: 'Limited time',
      heroTitle: 'BidBlitz Pay',
      heroSubtitle: 'Simple. Secure. Fast.',
      heroDescription: 'Your digital wallet for auctions, transfers and more.',
      startNow: 'Claim €5 Bonus Now',
      learnMore: 'Learn More',
      countdownTitle: 'Offer ends in:',
      hours: 'Hrs',
      minutes: 'Min',
      seconds: 'Sec',
      justSignedUp: 'just signed up',
      viewingNow: 'people are viewing this page',
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
      wheelTitle: '🎰 Lucky Wheel for New Users',
      wheelDesc: 'Spin the wheel and win up to €50!',
      spinButton: 'Spin Now!',
      spinning: 'Spinning...',
      youWon: 'You win:',
      claimPrize: 'Claim Now',
      vipTitle: '👑 VIP Early Access',
      vipDesc: 'The first 1,000 users become VIP automatically!',
      vipBenefit1: 'Exclusive bonus promotions',
      vipBenefit2: 'Priority support',
      vipBenefit3: 'Higher cashback rates',
      vipSpots: 'VIP spots still available',
      appStoreTitle: '📱 Coming to App Stores',
      appStoreDesc: 'Sign up now and get notified!',
      comingSoon: 'Coming Soon',
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
      ctaTitle: 'Claim €5 Bonus Now!',
      ctaDesc: 'Join thousands of satisfied users.',
      ctaButton: '🎁 Start for free',
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
      {/* Sticky Bonus Banner */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-green-500 to-emerald-600 py-2 px-4">
        <div className="flex items-center justify-center gap-2 text-white text-sm font-bold">
          <PartyPopper className="w-4 h-4 animate-bounce" />
          <span>{t.bonusBanner}</span>
          <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{t.limitedOffer}</span>
        </div>
      </div>
      
      {/* Live Ticker - Floating */}
      <div className="fixed bottom-20 left-4 z-40 bg-white rounded-xl shadow-2xl p-3 max-w-[200px] animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {recentSignups[currentSignup].name.charAt(0)}
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900">{recentSignups[currentSignup].name}</p>
            <p className="text-[10px] text-gray-500">
              <MapPin className="w-2 h-2 inline" /> {recentSignups[currentSignup].city} • {recentSignups[currentSignup].time}
            </p>
            <p className="text-[10px] text-green-600 font-medium">{t.justSignedUp}</p>
          </div>
        </div>
      </div>
      
      {/* Viewer Count - Floating */}
      <div className="fixed bottom-20 right-4 z-40 bg-red-500 text-white rounded-full px-3 py-1.5 text-xs font-bold flex items-center gap-1 shadow-lg">
        <Eye className="w-3 h-3" />
        <span>{viewerCount} {t.viewingNow}</span>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-500 via-orange-500 to-orange-600">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/10 rounded-full translate-x-1/4 translate-y-1/4" />
        
        <div className="relative px-5 pt-8 pb-12">
          {/* Countdown Timer */}
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 mb-6 max-w-sm mx-auto">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Flame className="w-5 h-5 text-yellow-300 animate-pulse" />
              <span className="text-white font-bold text-sm">{t.countdownTitle}</span>
            </div>
            <div className="flex justify-center gap-3">
              <div className="bg-white rounded-lg px-3 py-2 text-center min-w-[50px]">
                <div className="text-2xl font-black text-orange-600">{String(timeLeft.hours).padStart(2, '0')}</div>
                <div className="text-[10px] text-gray-500">{t.hours}</div>
              </div>
              <div className="text-white text-2xl font-bold">:</div>
              <div className="bg-white rounded-lg px-3 py-2 text-center min-w-[50px]">
                <div className="text-2xl font-black text-orange-600">{String(timeLeft.minutes).padStart(2, '0')}</div>
                <div className="text-[10px] text-gray-500">{t.minutes}</div>
              </div>
              <div className="text-white text-2xl font-bold">:</div>
              <div className="bg-white rounded-lg px-3 py-2 text-center min-w-[50px]">
                <div className="text-2xl font-black text-orange-600">{String(timeLeft.seconds).padStart(2, '0')}</div>
                <div className="text-[10px] text-gray-500">{t.seconds}</div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-2xl flex items-center justify-center">
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
              className="w-full bg-white text-orange-600 hover:bg-gray-100 text-lg py-6 rounded-xl font-bold shadow-lg animate-pulse"
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

      {/* Lucky Wheel Section */}
      <section className="py-10 px-5 bg-gradient-to-b from-purple-600 to-indigo-700">
        <div className="text-center max-w-sm mx-auto">
          <h2 className="text-2xl font-black text-white mb-2">{t.wheelTitle}</h2>
          <p className="text-purple-200 text-sm mb-6">{t.wheelDesc}</p>
          
          {/* Wheel Visual */}
          <div className="relative w-48 h-48 mx-auto mb-6">
            <div className={`w-full h-full rounded-full bg-gradient-to-br from-yellow-400 via-red-500 to-purple-600 shadow-2xl flex items-center justify-center ${isSpinning ? 'animate-spin' : ''}`}
                 style={{ animationDuration: '0.5s' }}>
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
                {wheelResult ? (
                  <span className="text-2xl font-black text-purple-600">{wheelResult}</span>
                ) : (
                  <Trophy className="w-10 h-10 text-yellow-500" />
                )}
              </div>
            </div>
            {/* Arrow pointer */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-b-[20px] border-l-transparent border-r-transparent border-b-white" />
          </div>
          
          {wheelResult ? (
            <div className="space-y-3">
              <p className="text-white text-lg">{t.youWon} <span className="font-black text-2xl text-yellow-300">{wheelResult}</span></p>
              <Button 
                onClick={() => navigate('/register')}
                className="w-full bg-yellow-400 text-purple-900 hover:bg-yellow-300 text-lg py-5 rounded-xl font-bold"
              >
                {t.claimPrize}
                <Gift className="w-5 h-5 ml-2" />
              </Button>
            </div>
          ) : (
            <Button 
              onClick={spinWheel}
              disabled={isSpinning}
              className="w-full bg-white text-purple-600 hover:bg-gray-100 text-lg py-5 rounded-xl font-bold"
            >
              {isSpinning ? t.spinning : t.spinButton}
              <Sparkles className="w-5 h-5 ml-2" />
            </Button>
          )}
        </div>
      </section>

      {/* VIP Early Access */}
      <section className="py-10 px-5 bg-gradient-to-b from-yellow-500 to-amber-600">
        <div className="max-w-sm mx-auto">
          <div className="text-center mb-6">
            <Crown className="w-12 h-12 text-white mx-auto mb-3" />
            <h2 className="text-2xl font-black text-white mb-2">{t.vipTitle}</h2>
            <p className="text-yellow-100 text-sm">{t.vipDesc}</p>
          </div>
          
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 space-y-3">
            {[t.vipBenefit1, t.vipBenefit2, t.vipBenefit3].map((benefit, i) => (
              <div key={i} className="flex items-center gap-3 text-white">
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-sm font-medium">{benefit}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-4 bg-black/20 rounded-xl p-3 text-center">
            <p className="text-yellow-200 text-xs">{t.vipSpots}</p>
            <p className="text-white text-2xl font-black">847 / 1.000</p>
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

      {/* App Store Section */}
      <section className="py-10 px-5 bg-gray-900">
        <div className="text-center max-w-sm mx-auto">
          <Smartphone className="w-12 h-12 text-blue-500 mx-auto mb-3" />
          <h2 className="text-xl font-black text-white mb-2">{t.appStoreTitle}</h2>
          <p className="text-gray-400 text-sm mb-6">{t.appStoreDesc}</p>
          
          <div className="flex justify-center gap-3">
            {/* App Store Badge */}
            <div className="bg-black rounded-xl px-4 py-2 flex items-center gap-2 border border-gray-700">
              <div className="text-white">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </div>
              <div className="text-left">
                <div className="text-[8px] text-gray-400">{t.comingSoon}</div>
                <div className="text-xs font-bold text-white">App Store</div>
              </div>
            </div>
            
            {/* Play Store Badge */}
            <div className="bg-black rounded-xl px-4 py-2 flex items-center gap-2 border border-gray-700">
              <div className="text-white">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                </svg>
              </div>
              <div className="text-left">
                <div className="text-[8px] text-gray-400">{t.comingSoon}</div>
                <div className="text-xs font-bold text-white">Google Play</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By - Payment Partners */}
      <section className="py-6 px-5 bg-gray-900 border-y border-gray-800">
        <p className="text-center text-xs text-gray-500 mb-4">{t.trustedBy}</p>
        <div className="flex justify-center items-center gap-6 flex-wrap">
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
          <PartyPopper className="w-12 h-12 text-white mx-auto mb-4 animate-bounce" />
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
