import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { languageList } from '../i18n/translations';
import { Zap, User, LogOut, Shield, Menu, X, Globe, Gift, Trophy, Heart, Crown, Star, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import SpinWheel from './SpinWheel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export const Navbar = () => {
  const { user, isAuthenticated, isAdmin, isInfluencer, isManager, logout } = useAuth();
  const { t, language, changeLanguage, languages } = useLanguage();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);

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

          {/* Desktop Navigation - Cyber Style */}
          <div className="hidden md:flex items-center gap-4">
            <Link 
              to="/auctions" 
              className="text-gray-400 hover:text-acid transition-colors font-body font-medium text-sm"
              data-testid="nav-auctions"
            >
              {t('nav.auctions')}
            </Link>
            <Link 
              to="/deal-radar" 
              className="text-cyber hover:text-cyber-hover transition-colors font-body font-medium text-sm flex items-center gap-1"
              data-testid="nav-deal-radar"
            >
              <Radar className="w-4 h-4" />
              Deal Radar
            </Link>
            <Link 
              to="/buy-bids" 
              className="text-acid hover:text-acid-hover transition-colors font-body font-medium text-sm"
              data-testid="nav-buy-bids"
            >
              {t('nav.buyBids')}
            </Link>
            <Link 
              to="/vip-auctions" 
              className="text-hot-pink hover:text-hot-pink-hover transition-colors font-body font-medium text-sm flex items-center gap-1"
              data-testid="nav-vip-auctions"
            >
              <Crown className="w-4 h-4" />
              VIP
            </Link>
            <Link 
              to="/leaderboard" 
              className="text-gray-400 hover:text-white transition-colors font-body font-medium text-sm flex items-center gap-1"
              data-testid="nav-leaderboard"
            >
              <Trophy className="w-4 h-4" />
              {language === 'de' ? 'Rangliste' : 'Leaderboard'}
            </Link>
            {isAuthenticated && (
              <>
                <button 
                  onClick={() => setWheelOpen(true)}
                  className="text-acid hover:text-acid-hover transition-colors font-body font-medium text-sm flex items-center gap-1"
                  data-testid="nav-wheel"
                >
                  <Sparkles className="w-4 h-4" />
                  {language === 'de' ? 'Glücksrad' : 'Wheel'}
                </button>
                <Link 
                  to="/ai-bids" 
                  className="text-cyber hover:text-cyber-hover transition-colors font-body font-medium text-sm flex items-center gap-1"
                  data-testid="nav-ai-bids"
                >
                  <TrendingUp className="w-4 h-4" />
                  KI
                </Link>
                <Link 
                  to="/dashboard" 
                  className="text-gray-400 hover:text-white transition-colors font-body font-medium text-sm"
                  data-testid="nav-dashboard"
                >
                  {t('nav.dashboard')}
                </Link>
              </>
            )}
            {isAdmin && (
              <Link 
                to="/admin" 
                className="text-hot-pink hover:text-hot-pink-hover transition-colors font-body font-medium text-sm flex items-center gap-1"
                data-testid="nav-admin"
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
            {isInfluencer && (
              <Link 
                to="/influencer-dashboard" 
                className="text-acid hover:text-acid-hover transition-colors font-body font-medium text-sm flex items-center gap-1"
                data-testid="nav-influencer"
              >
                <Star className="w-4 h-4" />
                Influencer
              </Link>
            )}
            {isManager && (
              <Link 
                to="/manager-dashboard" 
                className="text-cyber hover:text-cyber-hover transition-colors font-body font-medium text-sm flex items-center gap-1"
                data-testid="nav-manager"
              >
                <Shield className="w-4 h-4" />
                Manager
              </Link>
            )}
          </div>

          {/* Right side - Cyber Style */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-white/10" data-testid="language-selector">
                  <Globe className="w-4 h-4 mr-1" />
                  {languageList[language]?.flag}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-obsidian-paper border-white/10 max-h-80 overflow-y-auto">
                {Object.keys(languageList).map((lang) => (
                  <DropdownMenuItem 
                    key={lang} 
                    onClick={() => {
                      changeLanguage(lang);
                    }}
                    className={`text-white hover:bg-white/10 cursor-pointer ${language === lang ? 'bg-acid/10 text-acid' : ''}`}
                  >
                    {languageList[lang]?.flag} {languageList[lang]?.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {isAuthenticated ? (
              <>
                {/* Bids Balance - Cyber Style */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-obsidian-subtle border border-acid/30 shadow-neon-acid">
                  <Zap className="w-4 h-4 text-acid" />
                  <span className="font-mono font-bold text-acid" data-testid="bids-balance">
                    {user?.bids_balance || 0}
                  </span>
                  <span className="text-gray-400 text-xs">{t('nav.bids')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm" data-testid="user-name">{user?.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="text-gray-400 hover:text-hot-pink hover:bg-white/5"
                    data-testid="logout-btn"
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-gray-400 hover:text-white font-body" data-testid="login-btn">
                    {t('nav.login')}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button className="bg-acid text-black font-heading font-bold uppercase tracking-wider hover:bg-acid-hover hover:shadow-neon-acid transition-all" data-testid="register-btn">
                    {t('nav.register')}
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-white hover:text-acid transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu - Cyber Style */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-obsidian-paper border-t border-white/10">
          <div className="px-4 py-4 space-y-3">
            
            {/* AUTH SECTION - Cyber Style */}
            {isAuthenticated ? (
              <div className="bg-obsidian-subtle rounded-xl p-4 mb-4 border border-acid/20 shadow-neon-acid">
                {/* User Info & Balance */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-md bg-gradient-to-br from-acid to-cyber flex items-center justify-center">
                      <User className="w-5 h-5 text-black" />
                    </div>
                    <div>
                      <p className="text-white font-heading font-bold text-sm">{user?.name || 'Benutzer'}</p>
                      <p className="text-gray-500 text-xs font-mono">{user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-acid/20 px-3 py-1.5 rounded-md border border-acid/30">
                    <Zap className="w-4 h-4 text-acid" />
                    <span className="font-mono font-bold text-acid">{user?.bids_balance || 0}</span>
                  </div>
                </div>
                
                {/* Quick Actions Row */}
                <div className="flex gap-2">
                  <Link 
                    to="/dashboard" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 bg-acid text-black py-2.5 px-3 rounded-md font-heading font-bold text-center text-sm uppercase tracking-wider"
                  >
                    Dashboard
                  </Link>
                  {isAdmin && (
                    <Link 
                      to="/admin" 
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex-1 bg-hot-pink text-white py-2.5 px-3 rounded-md font-heading font-bold text-center text-sm flex items-center justify-center gap-1 uppercase"
                    >
                      <Shield className="w-4 h-4" />
                      Admin
                    </Link>
                  )}
                  {isInfluencer && (
                    <Link 
                      to="/influencer-dashboard" 
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex-1 bg-cyber text-black py-2.5 px-3 rounded-md font-heading font-bold text-center text-sm flex items-center justify-center gap-1 uppercase"
                    >
                      <Star className="w-4 h-4" />
                      Influencer
                    </Link>
                  )}
                  <button 
                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                    className="bg-red-500 text-white py-2.5 px-4 rounded-md font-bold text-sm hover:bg-red-400 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-obsidian-subtle rounded-xl p-4 mb-4 border border-white/10">
                <p className="text-gray-400 text-sm mb-3 text-center font-body">{t('home.ctaBid') || 'Melde dich an, um zu bieten!'}</p>
                <div className="flex gap-2">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="flex-1">
                    <Button variant="outline" className="w-full border-acid text-acid py-3 text-base font-heading font-bold uppercase hover:bg-acid hover:text-black transition-all">
                      {t('nav.login')}
                    </Button>
                  </Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="flex-1">
                    <Button className="w-full bg-acid hover:bg-acid-hover text-black py-3 text-base font-heading font-bold uppercase">
                      {t('nav.register')}
                    </Button>
                  </Link>
                </div>
              </div>
            )}
            
            {/* Mobile Language Selector - Cyber Style */}
            <div className="pb-3 border-b border-white/10">
              <p className="text-white text-sm font-heading font-bold mb-2 flex items-center gap-2 uppercase tracking-wider">
                <Globe className="w-4 h-4 text-acid" />
                {t('nav.language') || 'Sprache'}
              </p>
              <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto">
                {Object.entries(languageList).map(([code, { flag, name }]) => (
                  <button
                    key={code}
                    onClick={() => {
                      localStorage.setItem('language', code);
                      setMobileMenuOpen(false);
                      setTimeout(() => window.location.href = window.location.pathname, 100);
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-md text-xs font-medium transition-all ${
                      language === code 
                        ? 'bg-acid text-black border border-acid shadow-neon-acid' 
                        : 'bg-obsidian text-gray-400 hover:bg-obsidian-subtle border border-white/10 hover:border-acid/30'
                    }`}
                  >
                    <span className="text-lg">{flag}</span>
                    <span className="truncate w-full text-center font-mono">{code.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Navigation Links - Cyber Style */}
            <Link 
              to="/auctions" 
              className="block text-gray-400 hover:text-acid py-2 font-body transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.auctions')}
            </Link>
            <Link 
              to="/deal-radar" 
              className="block text-cyber hover:text-cyber-hover py-2 font-body flex items-center gap-2 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Radar className="w-4 h-4" />
              Deal Radar
            </Link>
            <Link 
              to="/buy-bids" 
              className="block text-acid hover:text-acid-hover py-2 font-body font-medium transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.buyBids')}
            </Link>
            <Link 
              to="/vip-auctions" 
              className="block text-hot-pink hover:text-hot-pink-hover py-2 font-body font-medium flex items-center gap-2 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Crown className="w-4 h-4" />
              VIP Auktionen
            </Link>
            {isAuthenticated && (
              <>
                <Link 
                  to="/ai-bids" 
                  className="block text-cyber hover:text-cyber-hover py-2 font-body flex items-center gap-2 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <TrendingUp className="w-4 h-4" />
                  KI-Empfehlungen
                </Link>
                <button 
                  onClick={() => { setWheelOpen(true); setMobileMenuOpen(false); }}
                  className="block text-acid hover:text-acid-hover py-2 font-body flex items-center gap-2 w-full text-left transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  {language === 'de' ? 'Glücksrad' : 'Lucky Wheel'}
                </button>
              </>
            )}
            <Link 
              to="/leaderboard" 
              className="block text-gray-400 hover:text-white py-2 font-body flex items-center gap-2 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Trophy className="w-4 h-4" />
              {language === 'de' ? 'Rangliste' : 'Leaderboard'}
            </Link>
            <Link 
              to="/faq" 
              className="block text-gray-400 hover:text-white py-2 font-body transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              FAQ
            </Link>
            <Link 
              to="/contact" 
              className="block text-gray-400 hover:text-white py-2 font-body transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.contact') || "Kontakt"}
            </Link>
          </div>
        </div>
      )}
      
      {/* Spin Wheel Modal */}
      <SpinWheel isOpen={wheelOpen} onClose={() => setWheelOpen(false)} />
    </nav>
  );
};
