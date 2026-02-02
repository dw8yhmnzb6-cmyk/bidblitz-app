import { Link } from 'react-router-dom';
import { Gavel, Mail, Phone, MapPin, Facebook, Twitter, Instagram, Youtube } from 'lucide-react';
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
    influencerLogin: 'Influencer Login',
    wholesale: 'Großkunden (B2B)',
    vipMembership: 'VIP Mitgliedschaft',
    investors: 'Für Investoren',
    winners: 'Gewinner',
    legal: 'Rechtliches',
    imprint: 'Impressum',
    privacy: 'Datenschutz',
    terms: 'AGB',
    contact: 'Kontakt',
    allRights: 'Alle Rechte vorbehalten'
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
    winners: 'Winners',
    legal: 'Legal',
    imprint: 'Imprint',
    privacy: 'Privacy Policy',
    terms: 'Terms & Conditions',
    contact: 'Contact',
    allRights: 'All rights reserved'
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
    influencerLogin: 'Hyrja e Influencer',
    wholesale: 'Klientë B2B',
    vipMembership: 'Anëtarësim VIP',
    winners: 'Fituesit',
    legal: 'Ligjore',
    imprint: 'Impresi',
    privacy: 'Privatësia',
    terms: 'Kushtet',
    contact: 'Kontakti',
    allRights: 'Të gjitha të drejtat e rezervuara'
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
    legal: 'Yasal',
    imprint: 'Künye',
    privacy: 'Gizlilik Politikası',
    terms: 'Şartlar ve Koşullar',
    contact: 'İletişim',
    allRights: 'Tüm hakları saklıdır'
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
    legal: 'Juridique',
    imprint: 'Mentions Légales',
    privacy: 'Politique de Confidentialité',
    terms: 'CGV',
    contact: 'Contact',
    allRights: 'Tous droits réservés'
  }
};

export const Footer = () => {
  const { language } = useLanguage();
  const ft = footerTexts[language] || footerTexts.de;
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0A0A0F] border-t border-white/10 mt-20">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFD700] to-[#FF4D4D] flex items-center justify-center">
                <Gavel className="w-5 h-5 text-black" />
              </div>
              <span className="text-xl font-bold text-white">BidBlitz</span>
            </Link>
            <p className="text-[#94A3B8] text-sm">
              {ft.description}
            </p>
            {/* Social Links */}
            <div className="flex gap-3">
              <a href="#" className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-[#94A3B8] hover:bg-[#FFD700] hover:text-black transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-[#94A3B8] hover:bg-[#FFD700] hover:text-black transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-[#94A3B8] hover:bg-[#FFD700] hover:text-black transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-[#94A3B8] hover:bg-[#FFD700] hover:text-black transition-colors">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-white font-bold">{ft.quickLinks}</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/auctions" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                {ft.liveAuctions}
              </Link>
              <Link to="/buy-bids" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                {ft.buyBids}
              </Link>
              <Link to="/register" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                {ft.register}
              </Link>
              <Link to="/login" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                {ft.login}
              </Link>
            </nav>
          </div>

          {/* Extras */}
          <div className="space-y-4">
            <h4 className="text-white font-bold">{ft.extras}</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/influencer-werden" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                {ft.becomeInfluencer}
              </Link>
              <Link to="/influencer-login" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                {ft.influencerLogin}
              </Link>
              <Link to="/wholesale/apply" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                {ft.wholesale}
              </Link>
              <Link to="/vip" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                {ft.vipMembership}
              </Link>
              <Link to="/winners" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                {ft.winners}
              </Link>
            </nav>
          </div>
          <div className="space-y-4">
            <h4 className="text-white font-bold">{ft.legal}</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/impressum" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                {ft.imprint}
              </Link>
              <Link to="/datenschutz" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                {ft.privacy}
              </Link>
              <Link to="/agb" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                {ft.terms}
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="text-white font-bold">{ft.contact}</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-[#94A3B8]">
                <Mail className="w-5 h-5 text-[#FFD700]" />
                <a href="mailto:info@bidblitz.ae" className="hover:text-[#FFD700] transition-colors">
                  info@bidblitz.ae
                </a>
              </div>
              <div className="flex items-center gap-3 text-[#94A3B8]">
                <Phone className="w-5 h-5 text-[#FFD700]" />
                <span>+971 4 501 2345</span>
              </div>
              <div className="flex items-start gap-3 text-[#94A3B8]">
                <MapPin className="w-5 h-5 text-[#FFD700] flex-shrink-0" />
                <span>Dubai Silicon Oasis<br />DDP Building A1, Dubai, UAE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[#94A3B8] text-sm">
            © {currentYear} BidBlitz FZCO. {ft.allRights}. CEO: Afrim Krasniqi
          </p>
          <div className="flex items-center gap-4">
            <img src="https://cdn-icons-png.flaticon.com/128/349/349221.png" alt="Visa" className="h-6 opacity-70" />
            <img src="https://cdn-icons-png.flaticon.com/128/349/349228.png" alt="Mastercard" className="h-6 opacity-70" />
            <img src="https://cdn-icons-png.flaticon.com/128/5968/5968382.png" alt="PayPal" className="h-6 opacity-70" />
            <img src="https://cdn-icons-png.flaticon.com/128/5968/5968382.png" alt="Stripe" className="h-6 opacity-70" />
          </div>
        </div>
      </div>
    </footer>
  );
};
