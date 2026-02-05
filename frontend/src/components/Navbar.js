import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { languageList } from '../i18n/translations';
import { Zap, User, LogOut, Shield, Menu, X, Globe, Gift, Trophy, Heart, Crown, Star, Sparkles, Sun, Moon } from 'lucide-react';
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
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className={`backdrop-blur-md shadow-sm fixed top-0 left-0 right-0 z-50 border-b transition-colors duration-300 ${
      isDarkMode 
        ? 'bg-[#0D0D14]/95 border-white/10' 
        : 'bg-white/95 border-gray-200'
    }`} data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group" data-testid="logo-link">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className={`text-xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              Bid<span className="text-amber-500">Blitz</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link 
              to="/auctions" 
              className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors font-medium`}
              data-testid="nav-auctions"
            >
              {t('nav.auctions')}
            </Link>
            <Link 
              to="/how-it-works" 
              className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors font-medium`}
              data-testid="nav-how-it-works"
            >
              {t('nav.howItWorks') || "So funktioniert's"}
            </Link>
            <Link 
              to="/buy-bids" 
              className="text-amber-600 hover:text-amber-700 transition-colors font-medium"
              data-testid="nav-buy-bids"
            >
              {t('nav.buyBids')}
            </Link>
            <Link 
              to="/giftcards" 
              className="text-orange-600 hover:text-orange-700 transition-colors font-medium flex items-center gap-1"
              data-testid="nav-giftcards"
            >
              <Gift className="w-4 h-4" />
              {t('nav.giftCards') || 'Geschenkkarten'}
            </Link>
            <Link 
              to="/leaderboard" 
              className="text-purple-600 hover:text-purple-700 transition-colors font-medium flex items-center gap-1"
              data-testid="nav-leaderboard"
            >
              <Trophy className="w-4 h-4" />
              {language === 'de' ? 'Rangliste' : 'Leaderboard'}
            </Link>
            {isAuthenticated && (
              <button 
                onClick={() => setWheelOpen(true)}
                className="text-amber-500 hover:text-amber-600 transition-colors font-medium flex items-center gap-1"
                data-testid="nav-wheel"
              >
                <Sparkles className="w-4 h-4" />
                {language === 'de' ? 'Glücksrad' : 'Lucky Wheel'}
              </button>
            )}
            <Link 
              to="/vip-auctions" 
              className="text-orange-500 hover:text-orange-600 transition-colors font-medium flex items-center gap-1"
              data-testid="nav-vip-auctions"
            >
              <Crown className="w-4 h-4" />
              {t('nav.vipAuctions') || 'VIP Auktionen'}
            </Link>
            <Link 
              to="/winners" 
              className="text-gray-600 hover:text-gray-900 transition-colors font-medium flex items-center gap-1"
              data-testid="nav-winners"
            >
              <Trophy className="w-4 h-4" />
              {t('nav.winners')}
            </Link>
            {isAuthenticated && (
              <Link 
                to="/dashboard" 
                className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
                data-testid="nav-dashboard"
              >
                {t('nav.dashboard')}
              </Link>
            )}
            {isAdmin && (
              <Link 
                to="/admin" 
                className="text-orange-600 hover:text-orange-700 transition-colors font-medium flex items-center gap-1"
                data-testid="nav-admin"
              >
                <Shield className="w-4 h-4" />
                {t('nav.admin')}
              </Link>
            )}
            {isInfluencer && (
              <Link 
                to="/influencer-dashboard" 
                className="text-amber-600 hover:text-amber-700 transition-colors font-medium flex items-center gap-1"
                data-testid="nav-influencer"
              >
                <Star className="w-4 h-4" />
                Influencer
              </Link>
            )}
            {isManager && (
              <Link 
                to="/manager-dashboard" 
                className="text-purple-600 hover:text-purple-700 transition-colors font-medium flex items-center gap-1"
                data-testid="nav-manager"
              >
                <Shield className="w-4 h-4" />
                Manager
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-4">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-all ${
                isDarkMode 
                  ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              data-testid="dark-mode-toggle"
              title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className={`${isDarkMode ? 'text-gray-300 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`} data-testid="language-selector">
                  <Globe className="w-4 h-4 mr-2" />
                  {languageList[language]?.flag} {languageList[language]?.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className={`${isDarkMode ? 'bg-[#181824] border-white/10' : 'bg-white border-gray-200'} max-h-80 overflow-y-auto shadow-lg`}>
                {Object.keys(languageList).map((lang) => (
                  <DropdownMenuItem 
                    key={lang} 
                    onClick={() => {
                      changeLanguage(lang);
                    }}
                    className={`${isDarkMode ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'} cursor-pointer ${language === lang ? (isDarkMode ? 'bg-white/5' : 'bg-gray-50') : ''}`}
                  >
                    {languageList[lang]?.flag} {languageList[lang]?.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {isAuthenticated ? (
              <>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${isDarkMode ? 'bg-cyan-500/20 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
                  <Zap className="w-4 h-4 text-cyan-500" />
                  <span className="font-mono font-bold text-cyan-500" data-testid="bids-balance">
                    {user?.bids_balance || 0}
                  </span>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t('nav.bids')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'} data-testid="user-name">{user?.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className={`${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
                    data-testid="logout-btn"
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-gray-600 hover:text-gray-900" data-testid="login-btn">
                    {t('nav.login')}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold" data-testid="register-btn">
                    {t('nav.register')}
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-gray-700"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 shadow-lg">
          <div className="px-4 py-4 space-y-3">
            
            {/* AUTH SECTION - Prominent at top */}
            {isAuthenticated ? (
              <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl p-4 mb-4 border border-cyan-200">
                {/* User Info & Balance */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-gray-800 font-semibold text-sm">{user?.name || 'Benutzer'}</p>
                      <p className="text-gray-500 text-xs">{user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-cyan-100 px-3 py-1.5 rounded-full">
                    <Zap className="w-4 h-4 text-cyan-600" />
                    <span className="font-mono font-bold text-cyan-600">{user?.bids_balance || 0}</span>
                  </div>
                </div>
                
                {/* Quick Actions Row */}
                <div className="flex gap-2">
                  <Link 
                    to="/dashboard" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 bg-amber-500 text-white py-2.5 px-3 rounded-lg font-semibold text-center text-sm"
                  >
                    Dashboard
                  </Link>
                  {isAdmin && (
                    <Link 
                      to="/admin" 
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex-1 bg-orange-500 text-white py-2.5 px-3 rounded-lg font-semibold text-center text-sm flex items-center justify-center gap-1"
                    >
                      <Shield className="w-4 h-4" />
                      Admin
                    </Link>
                  )}
                  {isInfluencer && (
                    <Link 
                      to="/influencer-dashboard" 
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex-1 bg-amber-400 text-white py-2.5 px-3 rounded-lg font-semibold text-center text-sm flex items-center justify-center gap-1"
                    >
                      <Star className="w-4 h-4" />
                      Influencer
                    </Link>
                  )}
                  <button 
                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                    className="bg-red-500 text-white py-2.5 px-4 rounded-lg font-semibold text-sm"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl p-4 mb-4 border border-cyan-200">
                <p className="text-gray-600 text-sm mb-3 text-center">{t('home.ctaBid') || 'Melde dich an, um zu bieten!'}</p>
                <div className="flex gap-2">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="flex-1">
                    <Button variant="outline" className="w-full border-amber-500 text-amber-600 py-3 text-base font-bold">
                      {t('nav.login')}
                    </Button>
                  </Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="flex-1">
                    <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 text-base font-bold">
                      {t('nav.register')}
                    </Button>
                  </Link>
                </div>
              </div>
            )}
            
            {/* Mobile Language Selector - at the top */}
            <div className="pb-3 border-b border-gray-200">
              <p className="text-gray-700 text-sm font-semibold mb-2 flex items-center gap-2">
                <Globe className="w-4 h-4" />
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
                    className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs font-medium transition-all ${
                      language === code 
                        ? 'bg-amber-500 text-white border-2 border-amber-600' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    <span className="text-lg">{flag}</span>
                    <span className="truncate w-full text-center">{code.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Navigation Links */}
            <Link 
              to="/auctions" 
              className="block text-gray-600 hover:text-gray-900 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.auctions')}
            </Link>
            <Link 
              to="/how-it-works" 
              className="block text-gray-600 hover:text-gray-900 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.howItWorks') || "So funktioniert's"}
            </Link>
            <Link 
              to="/buy-bids" 
              className="block text-amber-600 hover:text-amber-700 py-2 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.buyBids')}
            </Link>
            <Link 
              to="/vip-auctions" 
              className="block text-orange-500 hover:text-orange-600 py-2 font-medium flex items-center gap-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Crown className="w-4 h-4" />
              {t('nav.vipAuctions') || 'VIP Auktionen'}
            </Link>
            <Link 
              to="/winners" 
              className="block text-gray-600 hover:text-gray-900 py-2 flex items-center gap-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Trophy className="w-4 h-4" />
              {t('nav.winners')}
            </Link>
            <Link 
              to="/leaderboard" 
              className="block text-purple-600 hover:text-purple-700 py-2 flex items-center gap-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Trophy className="w-4 h-4" />
              {language === 'de' ? 'Rangliste' : 'Leaderboard'}
            </Link>
            {isAuthenticated && (
              <button 
                onClick={() => { setWheelOpen(true); setMobileMenuOpen(false); }}
                className="block text-amber-500 hover:text-amber-600 py-2 flex items-center gap-2 w-full text-left"
              >
                <Sparkles className="w-4 h-4" />
                {language === 'de' ? 'Glücksrad' : 'Lucky Wheel'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Spin Wheel Modal */}
      {wheelOpen && (
        <SpinWheel onClose={() => setWheelOpen(false)} />
      )}
    </nav>
  );
};
