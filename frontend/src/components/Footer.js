import { Link } from 'react-router-dom';
import { Zap, Mail, Phone, MapPin, Facebook, Twitter, Instagram, Youtube, TrendingUp, Radar, Crown, Car, Store, Users, Award, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// Footer translations
const footerTexts = {
  de: {
    description: 'Die führende Penny-Auktion-Plattform in Dubai. Bieten Sie auf Premium-Produkte und sparen Sie bis zu 95%!',
    quickLinks: 'Schnelllinks',
    liveAuctions: 'Live Auktionen',
    buyBids: 'Gebote kaufen',
    register: 'Registrieren',
    login: 'Anmelden',
    extras: 'Extras',
    becomeInfluencer: 'Influencer werden',
    carAdvertising: 'Auto-Werbung (€50/Mo)',
    influencerLogin: 'Influencer Login',
    wholesale: 'Großkunden (B2B)',
    vipMembership: 'VIP Mitgliedschaft',
    investors: 'Für Investoren',
    partnerPortal: 'Partner Portal',
    winners: 'Gewinner',
    features: 'Features',
    dealRadar: 'Deal Radar',
    aiRecommendations: 'KI-Empfehlungen',
    legal: 'Rechtliches',
    imprint: 'Impressum',
    privacy: 'Datenschutz',
    terms: 'AGB',
    contact: 'Kontakt',
    allRights: 'Alle Rechte vorbehalten',
    leaderboard: 'Rangliste'
  },
  en: {
    description: 'The leading penny auction platform in Dubai. Bid on premium products and save up to 95%!',
    quickLinks: 'Quick Links',
    liveAuctions: 'Live Auctions',
    buyBids: 'Buy Bids',
    register: 'Register',
    login: 'Login',
    extras: 'Extras',
    becomeInfluencer: 'Become Influencer',
    influencerLogin: 'Influencer Login',
    wholesale: 'Wholesale (B2B)',
    vipMembership: 'VIP Membership',
    investors: 'For Investors',
    partnerPortal: 'Partner Portal',
    winners: 'Winners',
    features: 'Features',
    dealRadar: 'Deal Radar',
    aiRecommendations: 'AI Recommendations',
    legal: 'Legal',
    imprint: 'Imprint',
    privacy: 'Privacy Policy',
    terms: 'Terms & Conditions',
    contact: 'Contact',
    allRights: 'All rights reserved',
    leaderboard: 'Leaderboard',
    carAdvertising: 'Car Advertising (€50/Mo)'
  },
  sq: {
    description: 'Platforma kryesore e ankandeve penny në Dubai. Ofroni për produkte premium dhe kurseni deri në 95%!',
    quickLinks: 'Lidhje të Shpejta',
    liveAuctions: 'Ankande Live',
    buyBids: 'Bli Oferta',
    register: 'Regjistrohu',
    login: 'Hyr',
    extras: 'Ekstra',
    becomeInfluencer: 'Bëhu Influencer',
    carAdvertising: 'Reklamë në Makinë (€50/Muaj)',
    influencerLogin: 'Hyrja e Influencer',
    wholesale: 'Klientë B2B',
    vipMembership: 'Anëtarësim VIP',
    investors: 'Për Investitorët',
    winners: 'Fituesit',
    features: 'Veçoritë',
    dealRadar: 'Radari i Ofertave',
    aiRecommendations: 'Rekomandimet AI',
    legal: 'Ligjore',
    imprint: 'Impresi',
    privacy: 'Privatësia',
    terms: 'Kushtet',
    contact: 'Kontakti',
    allRights: 'Të gjitha të drejtat e rezervuara',
    leaderboard: 'Renditja'
  },
  xk: {
    description: 'Platforma kryesore e ankandeve penny në Dubai. Ofroni për produkte premium dhe kurseni deri në 95%!',
    quickLinks: 'Lidhje të Shpejta',
    liveAuctions: 'Ankande Live',
    buyBids: 'Bli Oferta',
    register: 'Regjistrohu',
    login: 'Hyr',
    extras: 'Ekstra',
    becomeInfluencer: 'Bëhu Influencer',
    influencerLogin: 'Hyrja e Influencer',
    wholesale: 'Klientë B2B',
    vipMembership: 'Anëtarësim VIP',
    investors: 'Për Investitorët',
    winners: 'Fituesit',
    features: 'Veçoritë',
    dealRadar: 'Radari i Ofertave',
    aiRecommendations: 'Rekomandimet AI',
    legal: 'Ligjore',
    imprint: 'Impresi',
    privacy: 'Privatësia',
    terms: 'Kushtet',
    contact: 'Kontakti',
    allRights: 'Të gjitha të drejtat e rezervuara',
    leaderboard: 'Renditja'
  },
  tr: {
    description: 'Dubai\'nin önde gelen kuruş açık artırma platformu. Premium ürünlere teklif verin ve %95\'e kadar tasarruf edin!',
    quickLinks: 'Hızlı Linkler',
    liveAuctions: 'Canlı Açık Artırmalar',
    buyBids: 'Teklif Satın Al',
    register: 'Kayıt Ol',
    login: 'Giriş',
    extras: 'Ekstralar',
    becomeInfluencer: 'Influencer Ol',
    influencerLogin: 'Influencer Girişi',
    wholesale: 'Toptan (B2B)',
    vipMembership: 'VIP Üyelik',
    winners: 'Kazananlar',
    features: 'Özellikler',
    dealRadar: 'Fırsat Radarı',
    aiRecommendations: 'YZ Önerileri',
    legal: 'Yasal',
    imprint: 'Künye',
    privacy: 'Gizlilik Politikası',
    terms: 'Şartlar ve Koşullar',
    contact: 'İletişim',
    allRights: 'Tüm hakları saklıdır',
    leaderboard: 'Sıralama'
  },
  fr: {
    description: 'La principale plateforme d\'enchères au centime à Dubaï. Enchérissez sur des produits premium et économisez jusqu\'à 95%!',
    quickLinks: 'Liens Rapides',
    liveAuctions: 'Enchères en Direct',
    buyBids: 'Acheter des Enchères',
    register: 'S\'inscrire',
    login: 'Connexion',
    extras: 'Extras',
    becomeInfluencer: 'Devenir Influenceur',
    influencerLogin: 'Connexion Influenceur',
    wholesale: 'Grossistes (B2B)',
    vipMembership: 'Adhésion VIP',
    winners: 'Gagnants',
    features: 'Fonctionnalités',
    dealRadar: 'Radar Bons Plans',
    aiRecommendations: 'Recommandations IA',
    legal: 'Juridique',
    imprint: 'Mentions Légales',
    privacy: 'Politique de Confidentialité',
    terms: 'CGV',
    contact: 'Contact',
    allRights: 'Tous droits réservés',
    leaderboard: 'Classement'
  },
  ar: {
    description: 'منصة المزادات الرائدة في دبي. قدم عروضك على المنتجات المميزة ووفر حتى 95%!',
    quickLinks: 'روابط سريعة',
    liveAuctions: 'مزادات مباشرة',
    buyBids: 'شراء العروض',
    register: 'التسجيل',
    login: 'تسجيل الدخول',
    extras: 'إضافات',
    becomeInfluencer: 'كن مؤثرًا',
    influencerLogin: 'دخول المؤثرين',
    wholesale: 'البيع بالجملة (B2B)',
    vipMembership: 'عضوية VIP',
    investors: 'للمستثمرين',
    winners: 'الفائزون',
    features: 'المميزات',
    dealRadar: 'رادار الصفقات',
    aiRecommendations: 'توصيات الذكاء الاصطناعي',
    legal: 'قانوني',
    imprint: 'البصمة',
    privacy: 'سياسة الخصوصية',
    terms: 'الشروط والأحكام',
    contact: 'اتصل بنا',
    allRights: 'جميع الحقوق محفوظة',
    leaderboard: 'قائمة المتصدرين'
  }
};

export const Footer = () => {
  const { language , mappedLanguage, t } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const ft = footerTexts[langKey] || footerTexts.de;
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-obsidian border-t border-white/10 mt-20" data-testid="footer">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand - Cyber Style */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-md bg-acid flex items-center justify-center shadow-neon-acid transition-all group-hover:shadow-[0_0_30px_rgba(212,255,0,0.5)]">
                <Zap className="w-5 h-5 text-black" />
              </div>
              <span className="text-xl font-heading font-black text-white">
                BidBlitz<span className="text-acid">.ae</span>
              </span>
            </Link>
            <p className="text-gray-400 text-sm font-body">
              {ft.description}
            </p>
            {/* Social Links - Cyber Style */}
            <div className="flex gap-3">
              <a href="#" className="w-10 h-10 rounded-md bg-obsidian-subtle border border-white/10 flex items-center justify-center text-gray-400 hover:bg-acid hover:text-black hover:border-acid hover:shadow-neon-acid transition-all">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-md bg-obsidian-subtle border border-white/10 flex items-center justify-center text-gray-400 hover:bg-cyber hover:text-black hover:border-cyber hover:shadow-neon-cyber transition-all">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-md bg-obsidian-subtle border border-white/10 flex items-center justify-center text-gray-400 hover:bg-hot-pink hover:text-white hover:border-hot-pink hover:shadow-neon-pink transition-all">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-md bg-obsidian-subtle border border-white/10 flex items-center justify-center text-gray-400 hover:bg-acid hover:text-black hover:border-acid hover:shadow-neon-acid transition-all">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links - Cyber Style */}
          <div className="space-y-4">
            <h4 className="text-white font-heading font-bold uppercase tracking-wider text-sm">{ft.quickLinks}</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/auctions" className="text-gray-400 hover:text-acid transition-colors font-body text-sm">
                {ft.liveAuctions}
              </Link>
              <Link to="/buy-bids" className="text-gray-400 hover:text-acid transition-colors font-body text-sm">
                {ft.buyBids}
              </Link>
              <Link to="/register" className="text-gray-400 hover:text-acid transition-colors font-body text-sm">
                {ft.register}
              </Link>
              <Link to="/login" className="text-gray-400 hover:text-acid transition-colors font-body text-sm">
                {ft.login}
              </Link>
            </nav>
          </div>

          {/* Features - NEW */}
          <div className="space-y-4">
            <h4 className="text-white font-heading font-bold uppercase tracking-wider text-sm">{ft.extras || 'Extras'}</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/influencer-werden" className="text-gray-400 hover:text-white transition-colors font-body text-sm">
                {ft.becomeInfluencer}
              </Link>
              <Link to="/auto-werbung" className="text-gray-400 hover:text-white transition-colors font-body text-sm flex items-center gap-2">
                <Car className="w-3.5 h-3.5" />
                {ft.carAdvertising}
              </Link>
              <Link to="/influencer-login" className="text-gray-400 hover:text-white transition-colors font-body text-sm">
                {ft.influencerLogin}
              </Link>
              <Link to="/wholesale" className="text-gray-400 hover:text-white transition-colors font-body text-sm flex items-center gap-2">
                <Users className="w-3.5 h-3.5" />
                {ft.wholesale}
              </Link>
              <Link to="/investoren" className="text-gray-400 hover:text-white transition-colors font-body text-sm flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" />
                {ft.investors}
              </Link>
              <Link to="/vip" className="text-gray-400 hover:text-white transition-colors font-body text-sm flex items-center gap-2">
                <Crown className="w-3.5 h-3.5" />
                {ft.vipMembership}
              </Link>
              <a href="/partner-portal" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors font-body text-sm flex items-center gap-2">
                <Store className="w-3.5 h-3.5" />
                {ft.partnerPortal || 'Partner Portal'}
              </a>
            </nav>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h4 className="text-white font-heading font-bold uppercase tracking-wider text-sm">{ft.features || 'Features'}</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/deal-radar" className="text-cyber hover:text-cyber-hover transition-colors font-body text-sm flex items-center gap-1">
                <Radar className="w-3 h-3" />
                {ft.dealRadar || 'Deal Radar'}
              </Link>
              <Link to="/vip-auctions" className="text-hot-pink hover:text-hot-pink-hover transition-colors font-body text-sm flex items-center gap-1">
                <Crown className="w-3 h-3" />
                {ft.vipMembership || t('nav.vipAuctions') || 'VIP Auktionen'}
              </Link>
              <Link to="/winners" className="text-gray-400 hover:text-acid transition-colors font-body text-sm">
                {ft.winners}
              </Link>
              <Link to="/leaderboard" className="text-gray-400 hover:text-acid transition-colors font-body text-sm">
                {ft.leaderboard || t('nav.leaderboard')}
              </Link>
            </nav>
          </div>

          {/* Legal - Cyber Style */}
          <div className="space-y-4">
            <h4 className="text-white font-heading font-bold uppercase tracking-wider text-sm">{ft.legal}</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/impressum" className="text-gray-400 hover:text-acid transition-colors font-body text-sm">
                {ft.imprint}
              </Link>
              <Link to="/datenschutz" className="text-gray-400 hover:text-acid transition-colors font-body text-sm">
                {ft.privacy}
              </Link>
              <Link to="/agb" className="text-gray-400 hover:text-acid transition-colors font-body text-sm">
                {ft.terms}
              </Link>
              <Link to="/faq" className="text-gray-400 hover:text-acid transition-colors font-body text-sm">
                FAQ
              </Link>
            </nav>
          </div>

          {/* Contact - Cyber Style */}
          <div className="space-y-4">
            <h4 className="text-white font-heading font-bold uppercase tracking-wider text-sm">{ft.contact}</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-400">
                <Mail className="w-4 h-4 text-acid" />
                <a href="mailto:info@bidblitz.ae" className="hover:text-acid transition-colors font-body text-sm">
                  info@bidblitz.ae
                </a>
              </div>
              <div className="flex items-center gap-3 text-gray-400">
                <Phone className="w-4 h-4 text-cyber" />
                <span className="font-body text-sm">+971 4 501 2345</span>
              </div>
              <div className="flex items-start gap-3 text-gray-400">
                <MapPin className="w-4 h-4 text-hot-pink flex-shrink-0 mt-0.5" />
                <span className="font-body text-sm">Dubai Silicon Oasis<br />DDP Building A1, Dubai, UAE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom - Cyber Style */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm font-body">
            © {currentYear} BidBlitz.ae FZCO. {ft.allRights}. CEO: Afrim Krasniqi
          </p>
          <div className="flex items-center gap-4">
            <img src="https://cdn-icons-png.flaticon.com/128/349/349221.png" alt="Visa" className="h-5 opacity-50 hover:opacity-100 transition-opacity" />
            <img src="https://cdn-icons-png.flaticon.com/128/349/349228.png" alt="Mastercard" className="h-5 opacity-50 hover:opacity-100 transition-opacity" />
            <img src="https://cdn-icons-png.flaticon.com/128/5968/5968382.png" alt="PayPal" className="h-5 opacity-50 hover:opacity-100 transition-opacity" />
            <img src="https://cdn-icons-png.flaticon.com/128/5968/5968382.png" alt="Stripe" className="h-5 opacity-50 hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>
    </footer>
  );
};
