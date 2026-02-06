import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import { 
  UserPlus, 
  CreditCard, 
  Gavel, 
  Trophy,
  Clock,
  ArrowRight,
  CheckCircle,
  Zap
} from 'lucide-react';
import { Button } from '../components/ui/button';

// How It Works translations
const howItWorksTranslations = {
  de: {
    title: "So funktioniert",
    subtitle: "In nur 4 einfachen Schritten zu Top-Produkten für einen Bruchteil des Preises",
    step1Title: "1. Registrieren",
    step1Desc: "Erstellen Sie kostenlos ein Konto in nur wenigen Sekunden. Keine versteckten Gebühren.",
    step2Title: "2. Gebote kaufen",
    step2Desc: "Wählen Sie ein Gebotspaket. Jedes Gebot kostet ab 0,50€. Mehr Gebote = mehr Bonus!",
    step3Title: "3. Bieten",
    step3Desc: "Klicken Sie auf 'Bieten' bei einer Auktion. Jedes Gebot erhöht den Preis um nur 0,01€ und verlängert die Zeit.",
    step4Title: "4. Gewinnen!",
    step4Desc: "Der letzte Bieter gewinnt, wenn der Timer abläuft. Sparen Sie bis zu 99% auf Top-Produkte!",
    howBiddingWorks: "Wie funktioniert das Bieten?",
    priceIncrease: "Preiserhöhung",
    priceIncreaseDesc: "Jedes Gebot erhöht den Preis um nur 1 Cent",
    timeBonus: "Zeit-Bonus",
    timeBonusDesc: "Der Timer wird um 10-15 Sekunden verlängert",
    savings: "Ersparnis",
    savingsDesc: "Sparen Sie bis zu 99% auf Top-Marken",
    whyBidBlitz: "Warum BidBlitz?",
    fairAuctions: "Faire Auktionen",
    fairAuctionsDesc: "Jeder hat die gleiche Chance zu gewinnen. Kein Glücksspiel, nur Strategie.",
    realTimeUpdates: "Echtzeit-Updates",
    realTimeUpdatesDesc: "Verfolgen Sie alle Gebote live. Keine Verzögerungen, keine Überraschungen.",
    timerExtension: "Timer-Verlängerung",
    timerExtensionDesc: "Bei jedem Gebot wird der Timer um 10-15 Sekunden verlängert.",
    exampleCalc: "Beispiel-Rechnung",
    retailPrice: "iPhone 17 Pro (UVP)",
    auctionEndPrice: "Auktions-Endpreis",
    yourBids: "Ihre Gebote (25 Stück)",
    totalPrice: "Ihr Gesamtpreis",
    youSave: "Sie sparen",
    readyToSave: "Bereit zum Sparen?",
    registerNowCTA: "Jetzt registrieren und sofort mit dem Bieten beginnen!",
    registerButton: "Jetzt registrieren",
    viewAuctions: "Auktionen ansehen",
    // Badge descriptions
    badgesTitle: "Auktions-Badges erklärt",
    badgesSubtitle: "Diese Symbole zeigen dir spezielle Auktionstypen:",
    badgeDiscount: "Rabatt-Badge",
    badgeDiscountDesc: "Zeigt den aktuellen Rabatt gegenüber dem UVP",
    badgeBeginner: "🎓 Anfänger-Auktion",
    badgeBeginnerDesc: "Nur für Nutzer mit weniger als 10 gewonnenen Auktionen. Perfekt zum Einstieg!",
    badgeFree: "🎁 Gratis-Auktion",
    badgeFreeDesc: "Keine Gebote erforderlich! Jeder kann kostenlos teilnehmen.",
    badgeVip: "⭐ VIP-Auktion",
    badgeVipDesc: "Exklusiv für VIP-Mitglieder. Weniger Konkurrenz, bessere Chancen!",
    badgeNight: "🌙 Nacht-Auktion",
    badgeNightDesc: "Läuft zwischen 22:00 und 6:00 Uhr. Reduzierte Gebotskosten!",
    badgeReminder: "🔔 Erinnerung",
    badgeReminderDesc: "Klicken Sie darauf um 5 Minuten vor Ende benachrichtigt zu werden."
  },
  en: {
    title: "How it works",
    subtitle: "Get top products for a fraction of the price in just 4 simple steps",
    step1Title: "1. Register",
    step1Desc: "Create a free account in just a few seconds. No hidden fees.",
    step2Title: "2. Buy Bids",
    step2Desc: "Choose a bid package. Each bid costs from €0.50. More bids = more bonus!",
    step3Title: "3. Bid",
    step3Desc: "Click 'Bid' on an auction. Each bid increases the price by only €0.01 and extends the time.",
    step4Title: "4. Win!",
    step4Desc: "The last bidder wins when the timer runs out. Save up to 99% on top products!",
    howBiddingWorks: "How does bidding work?",
    priceIncrease: "Price Increase",
    priceIncreaseDesc: "Each bid increases the price by only 1 cent",
    timeBonus: "Time Bonus",
    timeBonusDesc: "The timer is extended by 10-15 seconds",
    savings: "Savings",
    savingsDesc: "Save up to 99% on top brands",
    whyBidBlitz: "Why BidBlitz?",
    fairAuctions: "Fair Auctions",
    fairAuctionsDesc: "Everyone has an equal chance to win. No gambling, just strategy.",
    realTimeUpdates: "Real-time Updates",
    realTimeUpdatesDesc: "Follow all bids live. No delays, no surprises.",
    timerExtension: "Timer Extension",
    timerExtensionDesc: "The timer is extended by 10-15 seconds with each bid.",
    exampleCalc: "Example Calculation",
    retailPrice: "iPhone 17 Pro (RRP)",
    auctionEndPrice: "Auction End Price",
    yourBids: "Your Bids (25 pieces)",
    totalPrice: "Your Total Price",
    youSave: "You save",
    readyToSave: "Ready to save?",
    registerNowCTA: "Register now and start bidding immediately!",
    registerButton: "Register Now",
    viewAuctions: "View Auctions",
    // Badge descriptions
    badgesTitle: "Auction Badges Explained",
    badgesSubtitle: "These symbols show you special auction types:",
    badgeDiscount: "Discount Badge",
    badgeDiscountDesc: "Shows the current discount compared to RRP",
    badgeBeginner: "🎓 Beginner Auction",
    badgeBeginnerDesc: "Only for users with less than 10 won auctions. Perfect for getting started!",
    badgeFree: "🎁 Free Auction",
    badgeFreeDesc: "No bids required! Anyone can participate for free.",
    badgeVip: "⭐ VIP Auction",
    badgeVipDesc: "Exclusive for VIP members. Less competition, better chances!",
    badgeNight: "🌙 Night Auction",
    badgeNightDesc: "Runs between 10pm and 6am. Reduced bid costs!",
    badgeReminder: "🔔 Reminder",
    badgeReminderDesc: "Click to be notified 5 minutes before the auction ends."
  },
  sq: {
    title: "Si funksionon",
    subtitle: "Merrni produkte të shkëlqyera me një pjesë të çmimit në vetëm 4 hapa të thjeshtë",
    step1Title: "1. Regjistrohu",
    step1Desc: "Krijoni një llogari falas në vetëm disa sekonda. Pa tarifa të fshehura.",
    step2Title: "2. Bli Oferta",
    step2Desc: "Zgjidhni një paketë ofertash. Çdo ofertë kushton nga 0.50€. Më shumë oferta = më shumë bonus!",
    step3Title: "3. Oferoni",
    step3Desc: "Klikoni 'Oferoni' në një ankand. Çdo ofertë rrit çmimin me vetëm 0.01€ dhe zgjat kohën.",
    step4Title: "4. Fitoni!",
    step4Desc: "Ofertuesi i fundit fiton kur koha përfundon. Kurseni deri në 99% në produktet më të mira!",
    howBiddingWorks: "Si funksionon ofertimi?",
    priceIncrease: "Rritja e Çmimit",
    priceIncreaseDesc: "Çdo ofertë rrit çmimin me vetëm 1 cent",
    timeBonus: "Bonus Kohe",
    timeBonusDesc: "Koha zgjatet me 10-15 sekonda",
    savings: "Kursime",
    savingsDesc: "Kurseni deri në 99% në markat më të mira",
    whyBidBlitz: "Pse BidBlitz?",
    fairAuctions: "Ankande të Drejta",
    fairAuctionsDesc: "Të gjithë kanë shanse të barabarta për të fituar. Nuk është bixhoz, vetëm strategji.",
    realTimeUpdates: "Përditësime në Kohë Reale",
    realTimeUpdatesDesc: "Ndiqni të gjitha ofertat live. Pa vonesa, pa surpriza.",
    timerExtension: "Zgjatje e Kohës",
    timerExtensionDesc: "Koha zgjatet me 10-15 sekonda me çdo ofertë.",
    exampleCalc: "Shembull Llogaritjeje",
    retailPrice: "iPhone 17 Pro (Çmimi)",
    auctionEndPrice: "Çmimi Përfundimtar",
    yourBids: "Ofertat Tuaja (25 copë)",
    totalPrice: "Çmimi Juaj Total",
    youSave: "Ju kurseni",
    readyToSave: "Gati për të kursyer?",
    registerNowCTA: "Regjistrohuni tani dhe filloni të ofertoni menjëherë!",
    registerButton: "Regjistrohu Tani",
    viewAuctions: "Shiko Ankandet"
  },
  tr: {
    title: "Nasıl Çalışır",
    subtitle: "Sadece 4 basit adımda en iyi ürünleri çok düşük fiyata alın",
    step1Title: "1. Kayıt Ol",
    step1Desc: "Sadece birkaç saniyede ücretsiz hesap oluşturun. Gizli ücret yok.",
    step2Title: "2. Teklif Satın Al",
    step2Desc: "Bir teklif paketi seçin. Her teklif 0,50€'dan başlar. Daha fazla teklif = daha fazla bonus!",
    step3Title: "3. Teklif Ver",
    step3Desc: "Bir açık artırmada 'Teklif Ver'e tıklayın. Her teklif fiyatı sadece 0,01€ artırır ve süreyi uzatır.",
    step4Title: "4. Kazan!",
    step4Desc: "Süre dolduğunda son teklif veren kazanır. En iyi ürünlerde %99'a kadar tasarruf edin!",
    howBiddingWorks: "Teklif verme nasıl çalışır?",
    priceIncrease: "Fiyat Artışı",
    priceIncreaseDesc: "Her teklif fiyatı sadece 1 sent artırır",
    timeBonus: "Süre Bonusu",
    timeBonusDesc: "Zamanlayıcı 10-15 saniye uzatılır",
    savings: "Tasarruf",
    savingsDesc: "En iyi markalarda %99'a kadar tasarruf edin",
    whyBidBlitz: "Neden BidBlitz?",
    fairAuctions: "Adil Açık Artırmalar",
    fairAuctionsDesc: "Herkesin kazanma şansı eşit. Kumar değil, sadece strateji.",
    realTimeUpdates: "Gerçek Zamanlı Güncellemeler",
    realTimeUpdatesDesc: "Tüm teklifleri canlı takip edin. Gecikme yok, sürpriz yok.",
    timerExtension: "Süre Uzatma",
    timerExtensionDesc: "Her teklifle zamanlayıcı 10-15 saniye uzatılır.",
    exampleCalc: "Örnek Hesaplama",
    retailPrice: "iPhone 17 Pro (PEF)",
    auctionEndPrice: "Açık Artırma Bitiş Fiyatı",
    yourBids: "Teklifleriniz (25 adet)",
    totalPrice: "Toplam Fiyatınız",
    youSave: "Tasarrufunuz",
    readyToSave: "Tasarruf etmeye hazır mısınız?",
    registerNowCTA: "Şimdi kaydolun ve hemen teklif vermeye başlayın!",
    registerButton: "Şimdi Kayıt Ol",
    viewAuctions: "Açık Artırmaları Gör"
  },
  ar: {
    title: "كيف يعمل",
    subtitle: "احصل على أفضل المنتجات بجزء من السعر في 4 خطوات بسيطة فقط",
    step1Title: "1. التسجيل",
    step1Desc: "أنشئ حسابًا مجانيًا في ثوانٍ معدودة. لا رسوم خفية.",
    step2Title: "2. شراء العروض",
    step2Desc: "اختر حزمة عروض. كل عرض يكلف من 0.50€. المزيد من العروض = المزيد من المكافآت!",
    step3Title: "3. قدم عرضًا",
    step3Desc: "انقر على 'عرض' في المزاد. كل عرض يزيد السعر بـ 0.01€ فقط ويمدد الوقت.",
    step4Title: "4. اربح!",
    step4Desc: "آخر مقدم عرض يفوز عند انتهاء الوقت. وفر حتى 99% على أفضل المنتجات!",
    howBiddingWorks: "كيف يعمل تقديم العروض؟",
    priceIncrease: "زيادة السعر",
    priceIncreaseDesc: "كل عرض يزيد السعر بسنت واحد فقط",
    timeBonus: "مكافأة الوقت",
    timeBonusDesc: "يتم تمديد المؤقت بـ 10-15 ثانية",
    savings: "التوفير",
    savingsDesc: "وفر حتى 99% على أفضل العلامات التجارية",
    whyBidBlitz: "لماذا BidBlitz؟",
    fairAuctions: "مزادات عادلة",
    fairAuctionsDesc: "الجميع لديه فرصة متساوية للفوز. ليس قمارًا، فقط استراتيجية.",
    realTimeUpdates: "تحديثات فورية",
    realTimeUpdatesDesc: "تابع جميع العروض مباشرة. لا تأخير، لا مفاجآت.",
    timerExtension: "تمديد المؤقت",
    timerExtensionDesc: "يتم تمديد المؤقت بـ 10-15 ثانية مع كل عرض.",
    exampleCalc: "مثال على الحساب",
    retailPrice: "iPhone 17 Pro (السعر)",
    auctionEndPrice: "سعر نهاية المزاد",
    yourBids: "عروضك (25 قطعة)",
    totalPrice: "السعر الإجمالي",
    youSave: "توفيرك",
    readyToSave: "مستعد للتوفير؟",
    registerNowCTA: "سجل الآن وابدأ بتقديم العروض فورًا!",
    registerButton: "سجل الآن",
    viewAuctions: "عرض المزادات"
  },
  fr: {
    title: "Comment ça marche",
    subtitle: "Obtenez les meilleurs produits à une fraction du prix en seulement 4 étapes simples",
    step1Title: "1. Inscription",
    step1Desc: "Créez un compte gratuit en quelques secondes. Pas de frais cachés.",
    step2Title: "2. Acheter des enchères",
    step2Desc: "Choisissez un forfait d'enchères. Chaque enchère coûte à partir de 0,50€. Plus d'enchères = plus de bonus!",
    step3Title: "3. Enchérir",
    step3Desc: "Cliquez sur 'Enchérir' lors d'une vente. Chaque enchère augmente le prix de seulement 0,01€ et prolonge le temps.",
    step4Title: "4. Gagner!",
    step4Desc: "Le dernier enchérisseur gagne quand le temps est écoulé. Économisez jusqu'à 99% sur les meilleurs produits!",
    howBiddingWorks: "Comment fonctionnent les enchères?",
    priceIncrease: "Augmentation du prix",
    priceIncreaseDesc: "Chaque enchère augmente le prix de seulement 1 centime",
    timeBonus: "Bonus de temps",
    timeBonusDesc: "Le minuteur est prolongé de 10-15 secondes",
    savings: "Économies",
    savingsDesc: "Économisez jusqu'à 99% sur les meilleures marques",
    whyBidBlitz: "Pourquoi BidBlitz?",
    fairAuctions: "Enchères équitables",
    fairAuctionsDesc: "Tout le monde a une chance égale de gagner. Pas de jeu de hasard, juste de la stratégie.",
    realTimeUpdates: "Mises à jour en temps réel",
    realTimeUpdatesDesc: "Suivez toutes les enchères en direct. Pas de retard, pas de surprises.",
    timerExtension: "Extension du minuteur",
    timerExtensionDesc: "Le minuteur est prolongé de 10-15 secondes à chaque enchère.",
    exampleCalc: "Exemple de calcul",
    retailPrice: "iPhone 17 Pro (Prix)",
    auctionEndPrice: "Prix final de l'enchère",
    yourBids: "Vos enchères (25 pièces)",
    totalPrice: "Votre prix total",
    youSave: "Vous économisez",
    readyToSave: "Prêt à économiser?",
    registerNowCTA: "Inscrivez-vous maintenant et commencez à enchérir immédiatement!",
    registerButton: "S'inscrire maintenant",
    viewAuctions: "Voir les enchères"
  }
};

export default function HowItWorks() {
  const { language } = useLanguage();
  const { isDarkMode } = useTheme();
  
  // Get translations for current language, fallback to German
  const t = howItWorksTranslations[language] || howItWorksTranslations.de;

  const steps = [
    {
      icon: UserPlus,
      title: t.step1Title,
      description: t.step1Desc,
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: CreditCard,
      title: t.step2Title,
      description: t.step2Desc,
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: Gavel,
      title: t.step3Title,
      description: t.step3Desc,
      color: "from-yellow-500 to-orange-500"
    },
    {
      icon: Trophy,
      title: t.step4Title,
      description: t.step4Desc,
      color: "from-purple-500 to-pink-500"
    }
  ];

  const features = [
    {
      title: t.fairAuctions,
      description: t.fairAuctionsDesc,
      icon: CheckCircle
    },
    {
      title: t.realTimeUpdates,
      description: t.realTimeUpdatesDesc,
      icon: Zap
    },
    {
      title: t.timerExtension,
      description: t.timerExtensionDesc,
      icon: Clock
    }
  ];

  return (
    <div className={`min-h-screen pt-20 pb-16 ${isDarkMode ? 'bg-[#050509]' : 'bg-gradient-to-b from-cyan-50 to-cyan-100'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            {t.title} <span className="text-amber-500">BidBlitz</span>
          </h1>
          <p className={`text-lg max-w-2xl mx-auto ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {t.subtitle}
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {steps.map((step, index) => (
            <div 
              key={index}
              className={`rounded-2xl p-6 border transition-all group ${
                isDarkMode 
                  ? 'bg-[#181824]/50 border-white/10 hover:border-amber-500/30' 
                  : 'bg-white border-gray-200 shadow-sm hover:border-amber-300 hover:shadow-md'
              }`}
            >
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <step.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{step.title}</h3>
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{step.description}</p>
            </div>
          ))}
        </div>

        {/* How Bidding Works */}
        <div className={`rounded-2xl p-8 mb-16 border ${isDarkMode ? 'bg-[#181824]/30 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
          <h2 className={`text-2xl font-bold mb-6 text-center ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            {t.howBiddingWorks}
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-[#FFD700]/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-[#FFD700]">0,01€</span>
              </div>
              <h4 className="text-white font-semibold mb-2">{t.priceIncrease}</h4>
              <p className="text-gray-400 text-sm">{t.priceIncreaseDesc}</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-cyan-400">+10s</span>
              </div>
              <h4 className="text-white font-semibold mb-2">{t.timeBonus}</h4>
              <p className="text-gray-400 text-sm">{t.timeBonusDesc}</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-green-400">99%</span>
              </div>
              <h4 className="text-white font-semibold mb-2">{t.savings}</h4>
              <p className="text-gray-400 text-sm">{t.savingsDesc}</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">{t.whyBidBlitz}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="flex items-start gap-4 p-4"
              >
                <div className="w-10 h-10 rounded-lg bg-[#FFD700]/20 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-[#FFD700]" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">{feature.title}</h4>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Example Calculation */}
        <div className="bg-gradient-to-r from-[#FFD700]/10 to-[#FF4D4D]/10 rounded-2xl p-8 mb-16 border border-[#FFD700]/30">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            {t.exampleCalc}
          </h2>
          
          <div className="max-w-lg mx-auto">
            {/* iPhone Image */}
            <div className="flex justify-center mb-6">
              <img 
                src="https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300&h=300&fit=crop" 
                alt="iPhone 17 Pro"
                className="w-32 h-32 object-cover rounded-xl shadow-lg"
              />
            </div>
            
            <div className="flex justify-between items-center py-3 border-b border-gray-700/50">
              <span className="text-gray-400">{t.retailPrice}</span>
              <span className="text-white font-semibold">1.299,00 €</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-700/50">
              <span className="text-gray-400">{t.auctionEndPrice}</span>
              <span className="text-[#FFD700] font-semibold">14,87 €</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-700/50">
              <span className="text-gray-400">{t.yourBids}</span>
              <span className="text-white font-semibold">12,50 €</span>
            </div>
            <div className="flex justify-between items-center py-3 text-lg">
              <span className="text-white font-bold">{t.totalPrice}</span>
              <span className="text-green-400 font-bold">27,37 €</span>
            </div>
            <div className="text-center mt-4">
              <span className="inline-block bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-semibold">
                {t.youSave}: 1.271,63 € (98%)
              </span>
            </div>
          </div>
        </div>

        {/* Badges Explained Section */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-4 text-center">{t.badgesTitle || "Auktions-Badges erklärt"}</h2>
          <p className="text-gray-400 text-center mb-8">{t.badgesSubtitle || "Diese Symbole zeigen dir spezielle Auktionstypen:"}</p>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Discount Badge */}
            <div className="bg-[#1E293B] rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">-95%</span>
                <span className="text-white font-semibold text-sm">{t.badgeDiscount || "Rabatt-Badge"}</span>
              </div>
              <p className="text-gray-400 text-sm">{t.badgeDiscountDesc || "Zeigt den aktuellen Rabatt gegenüber dem UVP"}</p>
            </div>
            
            {/* Beginner Badge */}
            <div className="bg-[#1E293B] rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded">🎓</span>
                <span className="text-white font-semibold text-sm">{t.badgeBeginner || "Anfänger-Auktion"}</span>
              </div>
              <p className="text-gray-400 text-sm">{t.badgeBeginnerDesc || "Nur für Nutzer mit weniger als 10 gewonnenen Auktionen"}</p>
            </div>
            
            {/* Free Badge */}
            <div className="bg-[#1E293B] rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">🎁</span>
                <span className="text-white font-semibold text-sm">{t.badgeFree || "Gratis-Auktion"}</span>
              </div>
              <p className="text-gray-400 text-sm">{t.badgeFreeDesc || "Keine Gebote erforderlich! Kostenlose Teilnahme."}</p>
            </div>
            
            {/* VIP Badge */}
            <div className="bg-[#1E293B] rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">⭐ VIP</span>
                <span className="text-white font-semibold text-sm">{t.badgeVip || "VIP-Auktion"}</span>
              </div>
              <p className="text-gray-400 text-sm">{t.badgeVipDesc || "Exklusiv für VIP-Mitglieder"}</p>
            </div>
            
            {/* Night Badge */}
            <div className="bg-[#1E293B] rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded">🌙</span>
                <span className="text-white font-semibold text-sm">{t.badgeNight || "Nacht-Auktion"}</span>
              </div>
              <p className="text-gray-400 text-sm">{t.badgeNightDesc || "Läuft zwischen 22:00 und 6:00 Uhr"}</p>
            </div>
            
            {/* Reminder Badge */}
            <div className="bg-[#1E293B] rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-gray-600 text-white text-xs font-bold px-2 py-1 rounded">🔔</span>
                <span className="text-white font-semibold text-sm">{t.badgeReminder || "Erinnerung"}</span>
              </div>
              <p className="text-gray-400 text-sm">{t.badgeReminderDesc || "Benachrichtigung 5 Min. vor Ende"}</p>
            </div>
            
            {/* Activity Index */}
            <div className="bg-[#1E293B] rounded-xl p-4 border border-gray-700/50 sm:col-span-2 lg:col-span-3">
              <div className="flex items-center gap-3 mb-3">
                <div style={{ 
                  width: '80px', 
                  height: '8px', 
                  borderRadius: '4px',
                  background: 'linear-gradient(to right, #22C55E 0%, #84CC16 25%, #EAB308 50%, #F97316 75%, #EF4444 100%)'
                }} />
                <span className="text-white font-semibold text-sm">📊 {language === 'en' ? 'Activity Index' : language === 'sq' ? 'Indeksi i Aktivitetit' : language === 'tr' ? 'Aktivite Endeksi' : language === 'fr' ? "Indice d'Activité" : 'Aktivitätsindex'}</span>
              </div>
              <p className="text-gray-400 text-sm mb-3">
                {language === 'en' ? 'The activity index shows you how active an auction currently is:' : 
                 language === 'sq' ? 'Indeksi i aktivitetit tregon se sa aktiv është një ankand:' :
                 language === 'tr' ? 'Aktivite endeksi size bir açık artırmanın ne kadar aktif olduğunu gösterir:' :
                 language === 'fr' ? "L'indice d'activité vous montre l'activité actuelle d'une vente:" :
                 'Der Aktivitätsindex zeigt dir, wie aktiv eine Auktion gerade ist:'}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-300">{language === 'en' ? 'Green = Low Activity' : language === 'sq' ? 'Jeshile = Aktivitet i Ulët' : language === 'tr' ? 'Yeşil = Düşük Aktivite' : language === 'fr' ? 'Vert = Faible Activité' : 'Grün = Wenig Aktivität'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-gray-300">{language === 'en' ? 'Yellow = Medium Activity' : language === 'sq' ? 'Verdhë = Aktivitet Mesatar' : language === 'tr' ? 'Sarı = Orta Aktivite' : language === 'fr' ? 'Jaune = Activité Moyenne' : 'Gelb = Mittlere Aktivität'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-gray-300">{language === 'en' ? 'Orange = High Activity' : language === 'sq' ? 'Portokalli = Aktivitet i Lartë' : language === 'tr' ? 'Turuncu = Yüksek Aktivite' : language === 'fr' ? 'Orange = Haute Activité' : 'Orange = Hohe Aktivität'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-gray-300">{language === 'en' ? 'Red = Very High Activity' : language === 'sq' ? 'Kuq = Aktivitet Shumë i Lartë' : language === 'tr' ? 'Kırmızı = Çok Yüksek Aktivite' : language === 'fr' ? 'Rouge = Très Haute Activité' : 'Rot = Sehr hohe Aktivität'}</span>
                </div>
              </div>
              <p className="text-gray-500 text-xs mt-3">
                💡 {language === 'en' ? 'Tip: You have better chances to win with low activity!' : 
                    language === 'sq' ? 'Këshillë: Ke shanse më të mira për të fituar me aktivitet të ulët!' :
                    language === 'tr' ? 'İpucu: Düşük aktivitede kazanma şansınız daha yüksek!' :
                    language === 'fr' ? 'Conseil: Vous avez de meilleures chances avec une faible activité!' :
                    'Tipp: Bei niedriger Aktivität hast du bessere Chancen zu gewinnen!'}
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            {t.readyToSave}
          </h2>
          <p className="text-gray-400 mb-6">
            {t.registerNowCTA}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button className="bg-[#FFD700] hover:bg-[#FCD34D] text-black font-bold px-8 py-3 text-lg">
                {t.registerButton}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/auctions">
              <Button variant="outline" className="border-gray-600 text-white hover:bg-white/10 px-8 py-3 text-lg">
                {t.viewAuctions}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
