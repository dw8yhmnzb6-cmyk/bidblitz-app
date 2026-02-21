import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { languageList } from '../i18n/translations';
import { Zap, User, LogOut, Shield, Menu, X, Globe, Gift, Trophy, Heart, Crown, Star, Sparkles, Sun, Moon, ChevronDown } from 'lucide-react';
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
              BidBlitz<span className="text-amber-500">.ae</span>
            </span>
          </Link>

          {/* Desktop Navigation - Only on large screens */}
          <div className="hidden lg:flex items-center gap-3 xl:gap-5">
            <Link 
              to="/auctions" 
              className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors font-medium text-sm xl:text-base`}
              data-testid="nav-auctions"
            >
              {t('nav.auctions')}
            </Link>
            <Link 
              to="/buy-bids" 
              className="text-amber-600 hover:text-amber-700 transition-colors font-medium text-sm xl:text-base"
              data-testid="nav-buy-bids"
            >
              {t('nav.buyBids')}
            </Link>
            <Link 
              to="/leaderboard" 
              className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors font-medium flex items-center gap-1 text-sm xl:text-base`}
              data-testid="nav-leaderboard"
            >
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="hidden xl:inline">{t('nav.leaderboard')}</span>
            </Link>
            {isAuthenticated && (
              <button
                onClick={() => setWheelOpen(true)}
                className="text-green-600 hover:text-green-700 transition-colors font-medium flex items-center gap-1 text-sm xl:text-base"
                data-testid="nav-wheel"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden xl:inline">{t('nav.luckyWheel') || 'Glücksrad'}</span>
              </button>
            )}
            {isAuthenticated && (
              <Link 
                to="/referral" 
                className="text-pink-600 hover:text-pink-700 transition-colors font-medium flex items-center gap-1 text-sm xl:text-base"
                data-testid="nav-referral"
              >
                <Gift className="w-4 h-4" />
                <span className="hidden xl:inline">{t('nav.inviteFriends') || 'Freunde werben'}</span>
              </Link>
            )}
            <Link 
              to="/vip-auctions" 
              className="text-purple-600 hover:text-purple-700 transition-colors font-medium flex items-center gap-1 text-sm xl:text-base"
              data-testid="nav-vip-auctions"
            >
              <Crown className="w-4 h-4" />
              <span className="hidden xl:inline">{t('nav.vipAuctions')}</span>
            </Link>
            <Link 
              to="/winners" 
              className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors font-medium flex items-center gap-1 text-sm xl:text-base`}
              data-testid="nav-winners"
            >
              <Heart className="w-4 h-4 text-red-500" />
              <span className="hidden xl:inline">{t('nav.winners')}</span>
            </Link>
            {isAuthenticated && (
              <Link 
                to="/dashboard" 
                className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors font-medium text-sm xl:text-base`}
                data-testid="nav-dashboard"
              >
                {t('nav.dashboard')}
              </Link>
            )}
            {isAdmin && (
              <Link 
                to="/admin" 
                className="text-orange-600 hover:text-orange-700 active:text-orange-800 transition-colors font-medium flex items-center gap-1 text-sm xl:text-base p-2 -m-2 touch-manipulation"
                data-testid="nav-admin"
                style={{ WebkitTapHighlightColor: 'rgba(234, 88, 12, 0.2)', touchAction: 'manipulation' }}
              >
                <Shield className="w-4 h-4" />
                <span className="hidden xl:inline">{t('nav.admin')}</span>
              </Link>
            )}
            {isInfluencer && (
              <Link 
                to="/influencer-dashboard" 
                className="text-amber-600 hover:text-amber-700 active:text-amber-800 transition-colors font-medium flex items-center gap-1 text-sm xl:text-base p-2 -m-2 touch-manipulation"
                data-testid="nav-influencer"
                style={{ WebkitTapHighlightColor: 'rgba(245, 158, 11, 0.2)', touchAction: 'manipulation' }}
              >
                <Star className="w-4 h-4" />
              </Link>
            )}
            {isManager && (
              <Link 
                to="/manager-dashboard" 
                className="text-purple-600 hover:text-purple-700 active:text-purple-800 transition-colors font-medium flex items-center gap-1 p-2 -m-2 touch-manipulation"
                data-testid="nav-manager"
                style={{ WebkitTapHighlightColor: 'rgba(147, 51, 234, 0.2)', touchAction: 'manipulation' }}
              >
                <Shield className="w-4 h-4" />
                {t('nav.manager')}
              </Link>
            )}
          </div>

          {/* Right side */}
          {/* Desktop Right Side - Only on large screens */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-4">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className={`p-1.5 xl:p-2 rounded-lg transition-all ${
                isDarkMode 
                  ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              data-testid="dark-mode-toggle"
              title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 xl:w-5 xl:h-5" /> : <Moon className="w-4 h-4 xl:w-5 xl:h-5" />}
            </button>

            {/* Language Selector - Compact version */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className={`px-2 ${isDarkMode ? 'text-gray-300 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`} data-testid="language-selector">
                  <span className="text-lg">{languageList[language]?.flag}</span>
                  <ChevronDown className="w-3 h-3 ml-1" />
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
                  <Button variant="ghost" className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`} data-testid="login-btn">
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

          {/* Mobile/Tablet menu button - Shows on screens smaller than lg (1024px) */}
          <button
            className={`lg:hidden ${isDarkMode ? 'text-white' : 'text-gray-700'}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile/Tablet menu - Shows on screens smaller than lg (1024px) */}
      {mobileMenuOpen && (
        <div className={`lg:hidden border-t shadow-lg ${isDarkMode ? 'bg-[#0D0D14] border-white/10' : 'bg-white border-gray-200'}`}>
          <div className="px-4 py-4 space-y-3">
            
            {/* Dark Mode Toggle - Mobile */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-white/10">
              <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                {isDarkMode ? `☀️ ${t('nav.lightMode')}` : `🌙 ${t('nav.darkMode')}`}
              </span>
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-lg transition-all ${
                  isDarkMode 
                    ? 'bg-yellow-500/20 text-yellow-400' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
            
            {/* AUTH SECTION - Prominent at top */}
            {isAuthenticated ? (
              <div className={`rounded-xl p-4 mb-4 border ${isDarkMode ? 'bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border-cyan-500/30' : 'bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200'}`}>
                {/* User Info & Balance */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{user?.name || t('nav.user')}</p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{user?.email}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full ${isDarkMode ? 'bg-cyan-500/20' : 'bg-cyan-100'}`}>
                    <Zap className="w-4 h-4 text-cyan-500" />
                    <span className="font-mono font-bold text-cyan-500">{user?.bids_balance || 0}</span>
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
                  <Link 
                    to="/pay" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white py-2.5 px-3 rounded-lg font-semibold text-center text-sm flex items-center justify-center gap-1"
                  >
                    💳 {t('nav.wallet')}
                  </Link>
                  {isAdmin && (
                    <Link 
                      to="/admin" 
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white py-3 px-4 rounded-lg font-semibold text-center text-sm flex items-center justify-center gap-2 touch-manipulation min-h-[48px]"
                      style={{ WebkitTapHighlightColor: 'rgba(0,0,0,0.1)', touchAction: 'manipulation' }}
                    >
                      <Shield className="w-5 h-5" />
                      Admin
                    </Link>
                  )}
                  {isInfluencer && (
                    <Link 
                      to="/influencer-dashboard" 
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex-1 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-white py-3 px-4 rounded-lg font-semibold text-center text-sm flex items-center justify-center gap-2 touch-manipulation min-h-[48px]"
                      style={{ WebkitTapHighlightColor: 'rgba(0,0,0,0.1)', touchAction: 'manipulation' }}
                    >
                      <Star className="w-5 h-5" />
                      {t('nav.influencer')}
                    </Link>
                  )}
                  <button 
                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                    className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white py-3 px-4 rounded-lg font-semibold text-sm touch-manipulation min-h-[48px]"
                    style={{ WebkitTapHighlightColor: 'rgba(0,0,0,0.1)', touchAction: 'manipulation' }}
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
            
            {/* Mobile Language Selector - improved layout */}
            <div className="pb-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-800 font-bold flex items-center gap-2">
                  <Globe className="w-5 h-5 text-amber-500" />
                  {t('nav.language') || 'Sprache'}
                </p>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 rounded-full">
                  <span className="text-lg">{languageList[language]?.flag}</span>
                  <span className="text-sm font-bold text-amber-700">{languageList[language]?.name}</span>
                </div>
              </div>
              
              {/* Language Grid - 3 columns for better touch targets */}
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(languageList).map(([code, { flag, name }]) => (
                  <button
                    key={code}
                    onClick={() => {
                      localStorage.setItem('language', code);
                      changeLanguage(code);
                      setMobileMenuOpen(false);
                      // Force reload for full translation update
                      window.location.reload();
                    }}
                    className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium transition-all ${
                      language === code 
                        ? 'bg-amber-500 text-white shadow-lg ring-2 ring-amber-300' 
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <span className="text-xl">{flag}</span>
                    <span className="truncate">{name}</span>
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
              {t('nav.leaderboard')}
            </Link>
            {isAuthenticated && (
              <button 
                onClick={() => { setWheelOpen(true); setMobileMenuOpen(false); }}
                className="block text-amber-500 hover:text-amber-600 py-2 flex items-center gap-2 w-full text-left"
              >
                <Sparkles className="w-4 h-4" />
                {t('nav.luckyWheel')}
              </button>
            )}
            {isAuthenticated && (
              <Link 
                to="/referral" 
                className="block text-pink-600 hover:text-pink-700 py-2 flex items-center gap-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Gift className="w-4 h-4" />
                {t('nav.inviteFriends') || 'Freunde werben'}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Spin Wheel Modal */}
      {wheelOpen && (
        <SpinWheel isOpen={wheelOpen} onClose={() => setWheelOpen(false)} />
      )}
    </nav>
  );
};
