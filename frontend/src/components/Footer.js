import { Link } from 'react-router-dom';
import { Gavel, Mail, Phone, MapPin, Facebook, Twitter, Instagram, Youtube } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const Footer = () => {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0A0A0F] border-t border-white/10 mt-20">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFD700] to-[#FF4D4D] flex items-center justify-center">
                <Gavel className="w-5 h-5 text-black" />
              </div>
              <span className="text-xl font-bold text-white">BidBlitz</span>
            </Link>
            <p className="text-[#94A3B8] text-sm">
              Die führende Penny-Auktion-Plattform in Deutschland. Bieten Sie auf Premium-Produkte 
              und sparen Sie bis zu 95%!
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
            <h4 className="text-white font-bold">Schnelllinks</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/auctions" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                Live Auktionen
              </Link>
              <Link to="/buy-bids" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                Gebote kaufen
              </Link>
              <Link to="/register" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                Registrieren
              </Link>
              <Link to="/login" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                Anmelden
              </Link>
            </nav>
          </div>

          {/* Extras */}
          <div className="space-y-4">
            <h4 className="text-white font-bold">Extras</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/influencer-werden" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                Influencer werden
              </Link>
              <Link to="/influencer-login" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                Influencer Login
              </Link>
              <Link to="/vip" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                VIP Mitgliedschaft
              </Link>
              <Link to="/winners" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                Gewinner
              </Link>
            </nav>
          </div>
          <div className="space-y-4">
            <h4 className="text-white font-bold">Rechtliches</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/impressum" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                Impressum
              </Link>
              <Link to="/datenschutz" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                Datenschutz
              </Link>
              <Link to="/agb" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
                AGB
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="text-white font-bold">Kontakt</h4>
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
                <span>Dubai Silicon Oasis<br />DDP Building A1, Dubai, VAE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[#94A3B8] text-sm">
            © {currentYear} BidBlitz FZCO. Alle Rechte vorbehalten. CEO: Afrim Krasniqi
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
