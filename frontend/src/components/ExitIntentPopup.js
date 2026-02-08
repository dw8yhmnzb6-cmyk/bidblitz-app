import React, { useState, useEffect, memo } from 'react';
import { X, Gift, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const translations = {
  de: {
    wait: "Warte!",
    title: "Hier sind 5 Gratis-Gebote",
    subtitle: "für deinen Start bei BidBlitz!",
    description: "Registriere dich jetzt und erhalte sofort 5 kostenlose Gebote, um deine erste Auktion zu gewinnen.",
    cta: "Jetzt Gratis-Gebote sichern",
    noThanks: "Nein, danke",
    limited: "Nur für kurze Zeit verfügbar!"
  },
  en: {
    wait: "Wait!",
    title: "Here are 5 Free Bids",
    subtitle: "for your start at BidBlitz!",
    description: "Register now and instantly receive 5 free bids to win your first auction.",
    cta: "Claim Free Bids Now",
    noThanks: "No, thanks",
    limited: "Available for a limited time only!"
  },
  sq: {
    wait: "Prit!",
    title: "Ja 5 Oferta Falas",
    subtitle: "për fillimin tënd në BidBlitz!",
    description: "Regjistrohu tani dhe merr menjëherë 5 oferta falas për të fituar ankadin e parë.",
    cta: "Merr Ofertat Falas Tani",
    noThanks: "Jo, faleminderit",
    limited: "E disponueshme vetëm për kohë të kufizuar!"
  },
  xk: {
    wait: "Prit!",
    title: "Ja 5 Oferta Falas",
    subtitle: "për fillimin tënd në BidBlitz!",
    description: "Regjistrohu tani dhe merr menjëherë 5 oferta falas për të fituar ankadin e parë.",
    cta: "Merr Ofertat Falas Tani",
    noThanks: "Jo, faleminderit",
    limited: "E disponueshme vetëm për kohë të kufizuar!"
  },
  tr: {
    wait: "Bekle!",
    title: "İşte 5 Ücretsiz Teklif",
    subtitle: "BidBlitz'e başlangıcın için!",
    description: "Şimdi kayıt ol ve ilk açık artırmanı kazanmak için anında 5 ücretsiz teklif al.",
    cta: "Şimdi Ücretsiz Teklifleri Al",
    noThanks: "Hayır, teşekkürler",
    limited: "Sadece sınırlı süre için geçerli!"
  },
  fr: {
    wait: "Attendez!",
    title: "Voici 5 Enchères Gratuites",
    subtitle: "pour votre début chez BidBlitz!",
    description: "Inscrivez-vous maintenant et recevez instantanément 5 enchères gratuites pour gagner votre première vente aux enchères.",
    cta: "Réclamez les Enchères Gratuites",
    noThanks: "Non, merci",
    limited: "Disponible pour une durée limitée!"
  }
};

const ExitIntentPopup = memo(() => {
  const { isAuthenticated } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const [isVisible, setIsVisible] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  
  const t = translations[langKey] || translations.de;
  
  useEffect(() => {
    // Don't show to authenticated users
    if (isAuthenticated) return;
    
    // Check if already shown in this session
    const alreadyShown = sessionStorage.getItem('exitIntentShown');
    if (alreadyShown) return;
    
    // Exit intent detection
    const handleMouseLeave = (e) => {
      // Only trigger when mouse leaves from the top
      if (e.clientY <= 0 && !hasShown) {
        setIsVisible(true);
        setHasShown(true);
        sessionStorage.setItem('exitIntentShown', 'true');
      }
    };
    
    // Also show after 30 seconds on page (for mobile)
    const timer = setTimeout(() => {
      if (!hasShown && !sessionStorage.getItem('exitIntentShown')) {
        setIsVisible(true);
        setHasShown(true);
        sessionStorage.setItem('exitIntentShown', 'true');
      }
    }, 30000);
    
    document.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeout(timer);
    };
  }, [isAuthenticated, hasShown]);
  
  const handleClose = () => {
    setIsVisible(false);
  };
  
  const handleCTA = () => {
    setIsVisible(false);
    window.location.href = '/register?bonus=5bids';
  };
  
  if (!isVisible) return null;
  
  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      data-testid="exit-intent-popup"
    >
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn">
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors z-10"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-3">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <p className="text-cyan-100 text-sm font-medium">{t.wait}</p>
          <h2 className="text-2xl font-black text-white mt-1">{t.title}</h2>
          <p className="text-cyan-100">{t.subtitle}</p>
        </div>
        
        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 text-center mb-6">
            {t.description}
          </p>
          
          {/* Animated Bids */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div 
                key={i}
                className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg animate-bounce"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <Zap className="w-6 h-6 text-white" />
              </div>
            ))}
          </div>
          
          {/* Limited Time Badge */}
          <div className="flex justify-center mb-4">
            <span className="bg-red-100 text-red-600 text-xs font-bold px-3 py-1 rounded-full animate-pulse">
              ⏰ {t.limited}
            </span>
          </div>
          
          {/* CTA Button */}
          <button
            onClick={handleCTA}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]"
          >
            {t.cta} 🎁
          </button>
          
          {/* No Thanks */}
          <button
            onClick={handleClose}
            className="w-full mt-3 py-2 text-gray-400 hover:text-gray-600 text-sm transition-colors"
          >
            {t.noThanks}
          </button>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
});

export default ExitIntentPopup;
