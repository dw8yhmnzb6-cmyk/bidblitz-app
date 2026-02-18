import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import GlobalJackpot from '../components/GlobalJackpot';
import { HappyHourBanner, LuckyBidCounter, ExcitementStatusBar } from '../components/ExcitementFeatures';
import LeaderboardWidget from '../components/LeaderboardWidget';
import PersonalizedRecommendations from '../components/PersonalizedRecommendations';
import WinnerGallery from '../components/WinnerGallery';
import DailyQuestsWidget from '../components/DailyQuestsWidget';
import { VIPPromoBanner } from '../components/VIPBadge';
import FlashSaleBanner from '../components/FlashSaleBanner';
import MysteryBoxSection from '../components/MysteryBoxSection';
import LiveWinnerTicker from '../components/LiveWinnerTicker';
import VIPBenefitsBanner from '../components/VIPBenefitsBanner';
import DailyLoginStreak from '../components/DailyLoginStreak';
import ShareAndWin from '../components/ShareAndWin';
import WinnerGalleryHome from '../components/WinnerGalleryHome';
import SustainabilitySection from '../components/SustainabilitySection';
import { 
  Trophy, Gift, Zap, Target, Star, Users, 
  Swords, Brain, Ticket, Bell, Crown, TrendingUp,
  Calendar, Award, Shield, Gamepad2, Coins, Utensils
} from 'lucide-react';

const translations = {
  de: {
    title: 'Funktionen & Extras',
    subtitle: 'Entdecke alle BidBlitz.ae Vorteile',
    gamification: 'Spielfeatures',
    social: 'Soziale Funktionen',
    rewards: 'Belohnungen',
    extras: 'Extras',
    utilities: 'Nützliche Funktionen',
    duels: 'Duelle',
    duelsDesc: '1v1 gegen andere Bieter',
    betting: 'Soziale Wetten',
    bettingDesc: 'Wette auf Auktionsgewinner',
    teams: 'Team-Bieten',
    teamsDesc: 'Bilde ein Team und gewinne zusammen',
    battles: 'Freunde-Kämpfe',
    battlesDesc: 'Kämpfe gegen deine Freunde',
    aiAdvisor: 'KI-Berater',
    aiAdvisorDesc: 'Intelligente Gebot-Empfehlungen',
    vouchers: 'Gutschein-Auktionen',
    vouchersDesc: 'Ersteigere Gutscheine',
    gifts: 'Geschenkkarten',
    giftsDesc: 'Verschenke BidBlitz.ae Gebote',
    alarm: 'Gebot-Alarm',
    alarmDesc: 'Benachrichtigungen für Auktionen',
    restaurantVouchers: 'Restaurant-Gutscheine',
    restaurantVouchersDesc: 'Spare bei Partner-Restaurants',
    dailyQuests: 'Tägliche Aufgaben',
    dailyRewards: 'Tägliche Belohnungen',
    battlePass: 'Saison-Pass',
    achievements: 'Erfolge',
    tournaments: 'Turniere',
    dealRadar: 'Angebots-Radar',
    priceAlerts: 'Preis-Benachrichtigungen',
    vipDashboard: 'VIP-Übersicht',
    goToAuctions: 'Zu den Auktionen',
    explore: 'Entdecken',
    comingSoon: 'Demnächst',
    newBadge: 'NEU'
  },
  en: {
    title: 'Features & Extras',
    subtitle: 'Discover all BidBlitz.ae benefits',
    gamification: 'Gamification',
    social: 'Social Features',
    rewards: 'Rewards',
    extras: 'Extras',
    utilities: 'Utilities',
    duels: 'Duels',
    duelsDesc: '1v1 against other bidders',
    betting: 'Social Betting',
    bettingDesc: 'Bet on auction winners',
    teams: 'Team Bidding',
    teamsDesc: 'Form a team and win together',
    battles: 'Friend Battles',
    battlesDesc: 'Battle against your friends',
    aiAdvisor: 'AI Advisor',
    aiAdvisorDesc: 'Smart bid recommendations',
    vouchers: 'Voucher Auctions',
    vouchersDesc: 'Bid on vouchers',
    gifts: 'Gift Cards',
    giftsDesc: 'Gift BidBlitz.ae bids',
    alarm: 'Bid Alarm',
    alarmDesc: 'Notifications for auctions',
    restaurantVouchers: 'Restaurant Vouchers',
    restaurantVouchersDesc: 'Save at partner restaurants',
    dailyQuests: 'Daily Quests',
    dailyRewards: 'Daily Rewards',
    battlePass: 'Battle Pass',
    achievements: 'Achievements',
    tournaments: 'Tournaments',
    dealRadar: 'Deal Radar',
    priceAlerts: 'Price Alerts',
    vipDashboard: 'VIP Dashboard',
    goToAuctions: 'Go to Auctions',
    explore: 'Explore',
    comingSoon: 'Coming Soon',
    newBadge: 'NEW'
  },
  sq: {
    title: 'Veçoritë & Ekstra',
    subtitle: 'Zbulo të gjitha përfitimet e BidBlitz.ae',
    gamification: 'Lojëzimi',
    social: 'Veçori Sociale',
    rewards: 'Shpërblimet',
    extras: 'Ekstra',
    utilities: 'Veglat',
    duels: 'Duelet',
    duelsDesc: '1v1 kundër ofertuesve të tjerë',
    betting: 'Bastet Sociale',
    bettingDesc: 'Bast në fituesit e ankandeve',
    teams: 'Ofertimi në Ekip',
    teamsDesc: 'Krijo ekip dhe fito së bashku',
    battles: 'Betejat me Miq',
    battlesDesc: 'Lufto kundër miqve',
    aiAdvisor: 'Këshilltari AI',
    aiAdvisorDesc: 'Rekomandime të zgjuara',
    vouchers: 'Ankandet e Kuponave',
    vouchersDesc: 'Oferto për kupona',
    gifts: 'Kartat e Dhuratave',
    giftsDesc: 'Dhuro ofertat BidBlitz.ae',
    alarm: 'Alarmi i Ofertave',
    alarmDesc: 'Njoftime për ankande',
    restaurantVouchers: 'Kuponat e Restoranteve',
    restaurantVouchersDesc: 'Kurse te restorantet partnere',
    dailyQuests: 'Detyrat Ditore',
    dailyRewards: 'Shpërblimet Ditore',
    battlePass: 'Pasaporta e Sezonit',
    achievements: 'Arritjet',
    tournaments: 'Turnetë',
    dealRadar: 'Radari i Ofertave',
    priceAlerts: 'Alarmet e Çmimit',
    vipDashboard: 'Paneli VIP',
    goToAuctions: 'Shko te Ankandat',
    explore: 'Eksploro',
    comingSoon: 'Së Shpejti',
    newBadge: 'E RE'
  },
  // Kosovo uses same as Albanian
  xk: {
    title: 'Veçoritë & Ekstra',
    subtitle: 'Zbulo të gjitha përfitimet e BidBlitz.ae',
    gamification: 'Lojëzimi',
    social: 'Veçori Sociale',
    rewards: 'Shpërblimet',
    extras: 'Ekstra',
    utilities: 'Veglat',
    duels: 'Duelet',
    duelsDesc: '1v1 kundër ofertuesve të tjerë',
    betting: 'Bastet Sociale',
    bettingDesc: 'Bast në fituesit e ankandeve',
    teams: 'Ofertimi në Ekip',
    teamsDesc: 'Krijo ekip dhe fito së bashku',
    battles: 'Betejat me Miq',
    battlesDesc: 'Lufto kundër miqve',
    aiAdvisor: 'Këshilltari AI',
    aiAdvisorDesc: 'Rekomandime të zgjuara',
    vouchers: 'Ankandet e Kuponave',
    vouchersDesc: 'Oferto për kupona',
    gifts: 'Kartat e Dhuratave',
    giftsDesc: 'Dhuro ofertat BidBlitz.ae',
    alarm: 'Alarmi i Ofertave',
    alarmDesc: 'Njoftime për ankande',
    restaurantVouchers: 'Kuponat e Restoranteve',
    restaurantVouchersDesc: 'Kurse te restorantet partnere',
    dailyQuests: 'Detyrat Ditore',
    dailyRewards: 'Shpërblimet Ditore',
    battlePass: 'Pasaporta e Sezonit',
    achievements: 'Arritjet',
    tournaments: 'Turnetë',
    dealRadar: 'Radari i Ofertave',
    priceAlerts: 'Alarmet e Çmimit',
    vipDashboard: 'Paneli VIP',
    goToAuctions: 'Shko te Ankandat',
    explore: 'Eksploro',
    comingSoon: 'Së Shpejti',
    newBadge: 'E RE'
  },
  // Arabic
  ar: {
    title: 'المميزات والإضافات',
    subtitle: 'اكتشف جميع مزايا BidBlitz.ae',
    gamification: 'ميزات اللعب',
    social: 'الميزات الاجتماعية',
    rewards: 'المكافآت',
    extras: 'إضافات',
    utilities: 'أدوات مفيدة',
    duels: 'المبارزات',
    duelsDesc: '1 ضد 1 مع مزايدين آخرين',
    betting: 'الرهانات الاجتماعية',
    bettingDesc: 'راهن على الفائز بالمزاد',
    teams: 'المزايدة الجماعية',
    teamsDesc: 'شكّل فريقًا وافز معًا',
    battles: 'معارك الأصدقاء',
    battlesDesc: 'حارب ضد أصدقائك',
    aiAdvisor: 'المستشار الذكي',
    aiAdvisorDesc: 'توصيات ذكية للمزايدة',
    vouchers: 'مزادات القسائم',
    vouchersDesc: 'زايد على القسائم',
    gifts: 'بطاقات الهدايا',
    giftsDesc: 'أهدِ عروض BidBlitz.ae',
    alarm: 'تنبيه المزايدة',
    alarmDesc: 'إشعارات المزادات',
    restaurantVouchers: 'قسائم المطاعم',
    restaurantVouchersDesc: 'وفّر في المطاعم الشريكة',
    dailyQuests: 'المهام اليومية',
    dailyRewards: 'المكافآت اليومية',
    battlePass: 'بطاقة الموسم',
    achievements: 'الإنجازات',
    tournaments: 'البطولات',
    dealRadar: 'رادار الصفقات',
    priceAlerts: 'تنبيهات الأسعار',
    vipDashboard: 'لوحة VIP',
    goToAuctions: 'اذهب للمزادات',
    explore: 'استكشف',
    comingSoon: 'قريبًا',
    newBadge: 'جديد'
  },
  // Turkish
  tr: {
    title: 'Özellikler & Ekstralar',
    subtitle: 'Tüm BidBlitz.ae avantajlarını keşfet',
    gamification: 'Oyun Özellikleri',
    social: 'Sosyal Özellikler',
    rewards: 'Ödüller',
    extras: 'Ekstralar',
    utilities: 'Faydalı Araçlar',
    duels: 'Düellolar',
    duelsDesc: 'Diğer teklif verenlerle 1v1',
    betting: 'Sosyal Bahisler',
    bettingDesc: 'Müzayede kazananına bahis yap',
    teams: 'Takım Teklifi',
    teamsDesc: 'Bir takım kur ve birlikte kazan',
    battles: 'Arkadaş Savaşları',
    battlesDesc: 'Arkadaşlarınla savaş',
    aiAdvisor: 'AI Danışman',
    aiAdvisorDesc: 'Akıllı teklif önerileri',
    vouchers: 'Kupon Müzayedeleri',
    vouchersDesc: 'Kuponlar için teklif ver',
    gifts: 'Hediye Kartları',
    giftsDesc: 'BidBlitz.ae teklifleri hediye et',
    alarm: 'Teklif Alarmı',
    alarmDesc: 'Müzayede bildirimleri',
    restaurantVouchers: 'Restoran Kuponları',
    restaurantVouchersDesc: 'Partner restoranlarda tasarruf et',
    dailyQuests: 'Günlük Görevler',
    dailyRewards: 'Günlük Ödüller',
    battlePass: 'Sezon Kartı',
    achievements: 'Başarılar',
    tournaments: 'Turnuvalar',
    dealRadar: 'Fırsat Radarı',
    priceAlerts: 'Fiyat Alarmları',
    vipDashboard: 'VIP Paneli',
    goToAuctions: 'Müzayedelere Git',
    explore: 'Keşfet',
    comingSoon: 'Yakında',
    newBadge: 'YENİ'
  },
  // French
  fr: {
    title: 'Fonctionnalités & Extras',
    subtitle: 'Découvrez tous les avantages BidBlitz.ae',
    gamification: 'Fonctionnalités de Jeu',
    social: 'Fonctionnalités Sociales',
    rewards: 'Récompenses',
    extras: 'Extras',
    utilities: 'Outils Utiles',
    duels: 'Duels',
    duelsDesc: '1v1 contre d\'autres enchérisseurs',
    betting: 'Paris Sociaux',
    bettingDesc: 'Pariez sur le gagnant',
    teams: 'Enchères en Équipe',
    teamsDesc: 'Formez une équipe et gagnez ensemble',
    battles: 'Batailles d\'Amis',
    battlesDesc: 'Combattez vos amis',
    aiAdvisor: 'Conseiller IA',
    aiAdvisorDesc: 'Recommandations intelligentes',
    vouchers: 'Enchères de Coupons',
    vouchersDesc: 'Enchérissez sur des coupons',
    gifts: 'Cartes Cadeaux',
    giftsDesc: 'Offrez des enchères BidBlitz.ae',
    alarm: 'Alarme d\'Enchère',
    alarmDesc: 'Notifications d\'enchères',
    restaurantVouchers: 'Coupons Restaurant',
    restaurantVouchersDesc: 'Économisez chez nos partenaires',
    dailyQuests: 'Quêtes Quotidiennes',
    dailyRewards: 'Récompenses Quotidiennes',
    battlePass: 'Pass de Saison',
    achievements: 'Succès',
    tournaments: 'Tournois',
    dealRadar: 'Radar des Offres',
    priceAlerts: 'Alertes Prix',
    vipDashboard: 'Tableau VIP',
    goToAuctions: 'Voir les Enchères',
    explore: 'Explorer',
    comingSoon: 'Bientôt',
    newBadge: 'NOUVEAU'
  }
};

const FeatureCard = ({ icon: Icon, title, description, route, colorClass, isNew, navigate, newBadge }) => (
  <div
    onClick={() => navigate(route)}
    className={`relative bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-gray-700 hover:border-opacity-50 transition-all cursor-pointer group hover:shadow-lg ${colorClass.hover}`}
  >
    {isNew && (
      <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
        {newBadge || 'NEU'}
      </span>
    )}
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${colorClass.bg}`}>
      <Icon className={`w-6 h-6 ${colorClass.text}`} />
    </div>
    <h3 className="text-white font-bold mb-1">{title}</h3>
    <p className="text-gray-400 text-sm">{description}</p>
  </div>
);

// Define color classes for each feature type
const colorClasses = {
  orange: { bg: 'bg-orange-500/20', text: 'text-orange-400', hover: 'hover:shadow-orange-500/20' },
  yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', hover: 'hover:shadow-yellow-500/20' },
  green: { bg: 'bg-green-500/20', text: 'text-green-400', hover: 'hover:shadow-green-500/20' },
  red: { bg: 'bg-red-500/20', text: 'text-red-400', hover: 'hover:shadow-red-500/20' },
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', hover: 'hover:shadow-purple-500/20' },
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', hover: 'hover:shadow-blue-500/20' },
  pink: { bg: 'bg-pink-500/20', text: 'text-pink-400', hover: 'hover:shadow-pink-500/20' },
  cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', hover: 'hover:shadow-cyan-500/20' },
  amber: { bg: 'bg-amber-500/20', text: 'text-amber-400', hover: 'hover:shadow-amber-500/20' },
};

const FeaturesPage = () => {
  const { isAuthenticated, user } = useAuth();
  const { language, mappedLanguage } = useLanguage();
  const navigate = useNavigate();
  const langKey = mappedLanguage || language;
  const t = translations[langKey] || translations.de;

  const gamificationFeatures = [
    { icon: Swords, title: t.duels, description: t.duelsDesc, route: '/duels', colorClass: colorClasses.orange, isNew: true },
    { icon: Coins, title: t.betting, description: t.bettingDesc, route: '/betting', colorClass: colorClasses.yellow, isNew: true },
    { icon: Users, title: t.teams, description: t.teamsDesc, route: '/teams', colorClass: colorClasses.green, isNew: true },
    { icon: Gamepad2, title: t.battles, description: t.battlesDesc, route: '/friend-battles', colorClass: colorClasses.red, isNew: true },
    { icon: Trophy, title: t.tournaments, description: '', route: '/tournaments', colorClass: colorClasses.purple },
    { icon: Award, title: t.achievements, description: '', route: '/achievements', colorClass: colorClasses.blue },
  ];

  const utilityFeatures = [
    { icon: Brain, title: t.aiAdvisor, description: t.aiAdvisorDesc, route: '/ki-berater', colorClass: colorClasses.blue, isNew: true },
    { icon: Store, title: language === 'de' ? 'Händler-Gutscheine' : 'Merchant Vouchers', description: language === 'de' ? 'Ersteigere Gutscheine bei lokalen Partnern' : 'Bid on vouchers from local partners', route: '/haendler-gutscheine', colorClass: colorClasses.amber, isNew: true },
    { icon: Ticket, title: t.vouchers, description: t.vouchersDesc, route: '/gutscheine', colorClass: colorClasses.purple, isNew: true },
    { icon: Utensils, title: t.restaurantVouchers, description: t.restaurantVouchersDesc, route: '/restaurant-gutscheine', colorClass: colorClasses.orange, isNew: true },
    { icon: Gift, title: t.gifts, description: t.giftsDesc, route: '/gift-cards', colorClass: colorClasses.pink, isNew: true },
    { icon: Bell, title: t.alarm, description: t.alarmDesc, route: '/alarm', colorClass: colorClasses.red, isNew: true },
    { icon: Target, title: t.dealRadar, description: '', route: '/deal-radar', colorClass: colorClasses.cyan },
    { icon: TrendingUp, title: t.priceAlerts, description: '', route: '/price-alerts', colorClass: colorClasses.green },
  ];

  const rewardFeatures = [
    { icon: Calendar, title: t.dailyQuests, description: '', route: '/daily-rewards', colorClass: colorClasses.orange },
    { icon: Star, title: t.battlePass, description: '', route: '/battle-pass', colorClass: colorClasses.yellow },
    { icon: Crown, title: t.vipDashboard, description: '', route: '/vip-dashboard', colorClass: colorClasses.amber },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 pt-20 pb-24" data-testid="features-page">
      {/* Header */}
      <div className="text-center mb-8 px-4">
        <h1 className="text-3xl font-black text-white mb-2">{t.title}</h1>
        <p className="text-gray-400">{t.subtitle}</p>
        <button
          onClick={() => navigate('/auktionen')}
          className="mt-4 px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-all"
        >
          {t.goToAuctions} →
        </button>
      </div>

      {/* Happy Hour & Jackpot */}
      <div className="max-w-4xl mx-auto mb-6 px-4 space-y-4">
        <HappyHourBanner />
        <GlobalJackpot />
      </div>

      {/* Live Winner Ticker */}
      <div className="max-w-7xl mx-auto mb-6 px-4">
        <LiveWinnerTicker />
      </div>

      {/* Gamification Section */}
      <div className="max-w-7xl mx-auto mb-8 px-4">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Gamepad2 className="w-6 h-6 text-orange-500" />
          {t.gamification}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {gamificationFeatures.map((feature, idx) => (
            <FeatureCard key={idx} {...feature} navigate={navigate} newBadge={t.newBadge} />
          ))}
        </div>
      </div>

      {/* Utility Features Section */}
      <div className="max-w-7xl mx-auto mb-8 px-4">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="w-6 h-6 text-blue-500" />
          {t.utilities}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {utilityFeatures.map((feature, idx) => (
            <FeatureCard key={idx} {...feature} navigate={navigate} newBadge={t.newBadge} />
          ))}
        </div>
      </div>

      {/* Rewards Section */}
      <div className="max-w-7xl mx-auto mb-8 px-4">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Star className="w-6 h-6 text-yellow-500" />
          {t.rewards}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {rewardFeatures.map((feature, idx) => (
            <FeatureCard key={idx} {...feature} navigate={navigate} newBadge={t.newBadge} />
          ))}
        </div>
      </div>

      {/* Daily Login Streak */}
      {isAuthenticated && (
        <div className="max-w-4xl mx-auto mb-6 px-4">
          <DailyLoginStreak />
        </div>
      )}

      {/* VIP Promo Banner - Only for non-VIP users */}
      {isAuthenticated && !user?.is_vip && (
        <div className="max-w-4xl mx-auto mb-6 px-4">
          <VIPPromoBanner onJoin={() => navigate('/vip')} />
        </div>
      )}

      {/* VIP Benefits Banner */}
      <div className="max-w-4xl mx-auto mb-6 px-4">
        <VIPBenefitsBanner />
      </div>

      {/* Leaderboard */}
      <div className="max-w-4xl mx-auto mb-6 px-4">
        <LeaderboardWidget language={language} />
      </div>

      {/* Daily Quests Widget - For logged-in users */}
      {isAuthenticated && (
        <div className="max-w-4xl mx-auto mb-6 px-4">
          <DailyQuestsWidget />
        </div>
      )}

      {/* Personalized Recommendations */}
      <div className="max-w-7xl mx-auto mb-6 px-4">
        <PersonalizedRecommendations />
      </div>

      {/* Flash Sales Banner */}
      <div className="max-w-7xl mx-auto mb-6 px-4">
        <FlashSaleBanner />
      </div>

      {/* Mystery Box Section */}
      <div className="max-w-7xl mx-auto mb-6 px-4">
        <MysteryBoxSection />
      </div>

      {/* Share and Win */}
      <div className="max-w-4xl mx-auto mb-6 px-4">
        <ShareAndWin />
      </div>

      {/* Winner Gallery */}
      <div className="max-w-7xl mx-auto mb-6 px-4">
        <WinnerGalleryHome />
      </div>

      {/* Sustainability Section */}
      <SustainabilitySection />

      {/* Winner Gallery (Full) */}
      <WinnerGallery limit={6} />
    </div>
  );
};

export default FeaturesPage;
