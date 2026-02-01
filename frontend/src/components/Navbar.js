import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { languageList } from '../i18n/translations';
import { Zap, User, LogOut, Shield, Menu, X, Globe, Gift, Trophy, Heart, Crown, Star } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export const Navbar = () => {
  const { user, isAuthenticated, isAdmin, isInfluencer, logout } = useAuth();
  const { t, language, changeLanguage, languages } = useLanguage();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="glass fixed top-0 left-0 right-0 z-50" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group" data-testid="logo-link">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FFD700] to-[#FF4D4D] flex items-center justify-center">
              <Zap className="w-6 h-6 text-black" />
            </div>
            <span className="text-xl font-bold tracking-tight font-['Poppins']">
              Bid<span className="text-[#FFD700]">Blitz</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link 
              to="/auctions" 
              className="text-[#94A3B8] hover:text-white transition-colors font-medium"
              data-testid="nav-auctions"
            >
              {t('nav.auctions')}
            </Link>
            <Link 
              to="/how-it-works" 
              className="text-[#94A3B8] hover:text-white transition-colors font-medium"
              data-testid="nav-how-it-works"
            >
              {t('nav.howItWorks') || "So funktioniert's"}
            </Link>
            <Link 
              to="/buy-bids" 
              className="text-[#FFD700] hover:text-[#FCD34D] transition-colors font-medium"
              data-testid="nav-buy-bids"
            >
              {t('nav.buyBids')}
            </Link>
            <Link 
              to="/giftcards" 
              className="text-[#F59E0B] hover:text-[#FBBF24] transition-colors font-medium flex items-center gap-1"
              data-testid="nav-giftcards"
            >
              <Gift className="w-4 h-4" />
              {t('nav.giftCards') || 'Geschenkkarten'}
            </Link>
            <Link 
              to="/vip-auctions" 
              className="text-[#FFA500] hover:text-[#FFD700] transition-colors font-medium flex items-center gap-1"
              data-testid="nav-vip-auctions"
            >
              <Crown className="w-4 h-4" />
              {t('nav.vipAuctions') || 'VIP Auktionen'}
            </Link>
            <Link 
              to="/vip" 
              className="text-[#94A3B8] hover:text-white transition-colors font-medium"
              data-testid="nav-vip"
            >
              {t('nav.vip') || "VIP Mitgliedschaft"}
            </Link>
            <Link 
              to="/faq" 
              className="text-[#94A3B8] hover:text-white transition-colors font-medium"
              data-testid="nav-faq"
            >
              {t('nav.faq') || "FAQ"}
            </Link>
            <Link 
              to="/winners" 
              className="text-[#94A3B8] hover:text-white transition-colors font-medium flex items-center gap-1"
              data-testid="nav-winners"
            >
              <Trophy className="w-4 h-4" />
              {t('nav.winners')}
            </Link>
            {isAuthenticated && (
              <>
                <Link 
                  to="/dashboard" 
                  className="text-[#94A3B8] hover:text-white transition-colors font-medium"
                  data-testid="nav-dashboard"
                >
                  {t('nav.dashboard')}
                </Link>
              </>
            )}
            {isAdmin && (
              <Link 
                to="/admin" 
                className="text-[#F59E0B] hover:text-[#FCD34D] transition-colors font-medium flex items-center gap-1"
                data-testid="nav-admin"
              >
                <Shield className="w-4 h-4" />
                {t('nav.admin')}
              </Link>
            )}
            {isInfluencer && (
              <Link 
                to="/influencer-dashboard" 
                className="text-[#FFD700] hover:text-[#FCD34D] transition-colors font-medium flex items-center gap-1"
                data-testid="nav-influencer"
              >
                <Star className="w-4 h-4" />
                Influencer
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-4">
            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-[#94A3B8] hover:text-white hover:bg-white/10" data-testid="language-selector">
                  <Globe className="w-4 h-4 mr-2" />
                  {languageList[language]?.flag} {languageList[language]?.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#181824] border-white/10 max-h-80 overflow-y-auto">
                {Object.keys(languageList).map((lang) => (
                  <DropdownMenuItem 
                    key={lang} 
                    onClick={() => changeLanguage(lang)}
                    className={`text-white hover:bg-white/10 cursor-pointer ${language === lang ? 'bg-white/5' : ''}`}
                  >
                    {languageList[lang]?.flag} {languageList[lang]?.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#181824] border border-white/10">
                  <Zap className="w-4 h-4 text-[#06B6D4]" />
                  <span className="font-mono font-bold text-[#06B6D4]" data-testid="bids-balance">
                    {user?.bids_balance || 0}
                  </span>
                  <span className="text-[#94A3B8] text-sm">{t('nav.bids')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#94A3B8]" data-testid="user-name">{user?.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="text-[#94A3B8] hover:text-white hover:bg-white/10"
                    data-testid="logout-btn"
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-[#94A3B8] hover:text-white" data-testid="login-btn">
                    {t('nav.login')}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button className="btn-primary" data-testid="register-btn">
                    {t('nav.register')}
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0F0F16] border-t border-white/10">
          <div className="px-4 py-4 space-y-3">
            
            {/* AUTH SECTION - Prominent at top */}
            {isAuthenticated ? (
              <div className="bg-gradient-to-r from-[#1a2a42] to-[#0d1829] rounded-xl p-4 mb-4 border border-white/10">
                {/* User Info & Balance */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{user?.name || 'Benutzer'}</p>
                      <p className="text-gray-400 text-xs">{user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-[#06B6D4]/20 px-3 py-1.5 rounded-full">
                    <Zap className="w-4 h-4 text-[#06B6D4]" />
                    <span className="font-mono font-bold text-[#06B6D4]">{user?.bids_balance || 0}</span>
                  </div>
                </div>
                
                {/* Quick Actions Row */}
                <div className="flex gap-2">
                  <Link 
                    to="/dashboard" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 bg-[#7C3AED] text-white py-2.5 px-3 rounded-lg font-semibold text-center text-sm"
                  >
                    Dashboard
                  </Link>
                  {isAdmin && (
                    <Link 
                      to="/admin" 
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex-1 bg-[#F59E0B] text-black py-2.5 px-3 rounded-lg font-semibold text-center text-sm flex items-center justify-center gap-1"
                    >
                      <Shield className="w-4 h-4" />
                      Admin
                    </Link>
                  )}
                  {isInfluencer && (
                    <Link 
                      to="/influencer-dashboard" 
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex-1 bg-[#FFD700] text-black py-2.5 px-3 rounded-lg font-semibold text-center text-sm flex items-center justify-center gap-1"
                    >
                      <Star className="w-4 h-4" />
                      Influencer
                    </Link>
                  )}
                  <button 
                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                    className="bg-[#EF4444] text-white py-2.5 px-4 rounded-lg font-semibold text-sm"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-[#1a2a42] to-[#0d1829] rounded-xl p-4 mb-4 border border-white/10">
                <p className="text-gray-300 text-sm mb-3 text-center">{t('home.ctaBid') || 'Melde dich an, um zu bieten!'}</p>
                <div className="flex gap-2">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="flex-1">
                    <Button variant="outline" className="w-full border-[#7C3AED] text-[#7C3AED] py-3 text-base font-bold">
                      {t('nav.login')}
                    </Button>
                  </Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="flex-1">
                    <Button className="w-full bg-[#FFD700] hover:bg-[#FCD34D] text-black py-3 text-base font-bold">
                      {t('nav.register')}
                    </Button>
                  </Link>
                </div>
              </div>
            )}
            
            {/* Language selector mobile - Bigger flags */}
            <div className="flex flex-wrap gap-2 pb-3 border-b border-white/10">
              {Object.keys(languageList).map((lang) => (
                <button
                  key={lang}
                  onClick={() => changeLanguage(lang)}
                  className={`px-3 py-2 rounded-lg text-xl ${language === lang ? 'bg-[#7C3AED] ring-2 ring-[#7C3AED]' : 'bg-white/10'}`}
                >
                  {languageList[lang]?.flag}
                </button>
              ))}
            </div>
            
            {/* Navigation Links */}
            <Link 
              to="/auctions" 
              className="block text-[#94A3B8] hover:text-white py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.auctions')}
            </Link>
            <Link 
              to="/how-it-works" 
              className="block text-[#94A3B8] hover:text-white py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.howItWorks') || "So funktioniert's"}
            </Link>
            <Link 
              to="/buy-bids" 
              className="block text-[#FFD700] hover:text-[#FCD34D] py-2 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.buyBids')}
            </Link>
            <Link 
              to="/vip-auctions" 
              className="block text-[#FFA500] hover:text-[#FFD700] py-2 font-medium flex items-center gap-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Crown className="w-4 h-4" />
              VIP Auktionen
            </Link>
            <Link 
              to="/vip" 
              className="block text-[#94A3B8] hover:text-white py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.vip') || "VIP Mitgliedschaft"}
            </Link>
            <Link 
              to="/faq" 
              className="block text-[#94A3B8] hover:text-white py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.faq') || "FAQ"}
            </Link>
            <Link 
              to="/contact" 
              className="block text-[#94A3B8] hover:text-white py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.contact') || "Kontakt"}
            </Link>
            <Link 
              to="/winners" 
              className="block text-[#94A3B8] hover:text-white py-2 flex items-center gap-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Trophy className="w-4 h-4" />
              {t('nav.winners')}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};
