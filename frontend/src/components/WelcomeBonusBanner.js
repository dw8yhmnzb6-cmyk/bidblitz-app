/**
 * Welcome Bonus Banner - Shows first-time buyer bonus offer
 * Displays prominently for new/unregistered users
 */
import { useState, useEffect, memo } from 'react';
import { Gift, Sparkles, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const translations = {
  de: {
    title: 'Willkommensbonus!',
    subtitle: 'Nur für Neukunden',
    offer: '50% EXTRA-GEBOTE',
    description: 'auf deine erste Einzahlung',
    cta: 'Jetzt sichern',
    limitedTime: 'Nur noch heute!',
    terms: '*Gilt für Ersteinzahlung. Max. 100 Bonus-Gebote.'
  },
  en: {
    title: 'Welcome Bonus!',
    subtitle: 'New customers only',
    offer: '50% EXTRA BIDS',
    description: 'on your first deposit',
    cta: 'Claim Now',
    limitedTime: 'Today only!',
    terms: '*Applies to first deposit. Max 100 bonus bids.'
  },
  tr: {
    title: 'Hoş Geldin Bonusu!',
    subtitle: 'Sadece yeni müşteriler için',
    offer: '%50 EKSTRA TEKLİF',
    description: 'ilk yatırımında',
    cta: 'Şimdi Al',
    limitedTime: 'Sadece bugün!',
    terms: '*İlk yatırım için geçerlidir. Maks. 100 bonus teklif.'
  },
  sq: {
    title: 'Bonus Mirëseardhje!',
    subtitle: 'Vetëm për klientë të rinj',
    offer: '50% OFERTA SHTESË',
    description: 'në depozitën tënde të parë',
    cta: 'Merr Tani',
    limitedTime: 'Vetëm sot!',
    terms: '*Vlen për depozitën e parë. Maks. 100 oferta bonus.'
  },
  fr: {
    title: 'Bonus de Bienvenue!',
    subtitle: 'Nouveaux clients uniquement',
    offer: '50% D\'ENCHÈRES BONUS',
    description: 'sur votre premier dépôt',
    cta: 'Réclamez Maintenant',
    limitedTime: "Aujourd'hui seulement!",
    terms: '*Valable sur le premier dépôt. Max. 100 enchères bonus.'
  }
};

const WelcomeBonusBanner = memo(({ language = 'de' }) => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [hasClaimedBonus, setHasClaimedBonus] = useState(false);
  
  const t = translations[language] || translations.de;
  
  // Check if user has already made a purchase
  useEffect(() => {
    if (isAuthenticated && user) {
      // Check localStorage for bonus status
      const bonusClaimed = localStorage.getItem(`welcome_bonus_${user.id}`);
      if (bonusClaimed) {
        setHasClaimedBonus(true);
      }
    }
  }, [isAuthenticated, user]);
  
  // Don't show if authenticated user has already purchased or dismissed
  if (dismissed || (isAuthenticated && hasClaimedBonus)) {
    return null;
  }
  
  const handleClaim = () => {
    if (!isAuthenticated) {
      // Navigate to auctions page with scroll target
      navigate('/?scrollTo=quick-register');
    } else {
      navigate('/buy-bids');
    }
  };
  
  return (
    <div 
      className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 text-white"
      data-testid="welcome-bonus-banner"
    >
      {/* Animated background sparkles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-white/10 rounded-full blur-xl animate-pulse" />
        <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-yellow-400/20 rounded-full blur-lg" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left: Icon + Title */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 p-2 bg-white/20 rounded-full">
              <Gift className="w-6 h-6 text-yellow-300" />
            </div>
            <div className="text-center sm:text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white/80">{t.subtitle}</span>
                <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold">
                {t.title} <span className="text-yellow-300">{t.offer}</span>
              </h3>
              <p className="text-sm text-white/90">{t.description}</p>
            </div>
          </div>
          
          {/* Middle: Limited time badge */}
          <div className="hidden md:flex items-center">
            <div className="px-3 py-1 bg-red-500 rounded-full text-sm font-bold animate-pulse">
              🔥 {t.limitedTime}
            </div>
          </div>
          
          {/* Right: CTA Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleClaim}
              className="flex items-center gap-2 px-5 py-3 sm:py-2.5 bg-white text-emerald-600 font-bold rounded-full 
                hover:bg-yellow-300 hover:text-emerald-700 transition-all transform hover:scale-105 shadow-lg
                active:scale-95 touch-manipulation min-h-[44px]"
              data-testid="welcome-bonus-cta"
            >
              {t.cta}
              <ArrowRight className="w-4 h-4" />
            </button>
            
            {/* Dismiss button */}
            <button
              onClick={() => setDismissed(true)}
              className="p-2 sm:p-1.5 hover:bg-white/20 rounded-full transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
        
        {/* Terms */}
        <p className="text-[10px] text-white/60 text-center mt-2 hidden sm:block">
          {t.terms}
        </p>
      </div>
    </div>
  );
});

WelcomeBonusBanner.displayName = 'WelcomeBonusBanner';

export default WelcomeBonusBanner;
