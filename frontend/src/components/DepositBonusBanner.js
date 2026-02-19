/**
 * DepositBonusBanner - Homepage banner for deposit bonus offers
 * Attracts users to the deposit bonus system with eye-catching design
 */
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, TrendingUp, Sparkles, ArrowRight, Percent, Star } from 'lucide-react';
import { Button } from './ui/button';

const translations = {
  de: {
    title: 'Bonus auf Einzahlungen',
    subtitle: 'Bis zu 20% Bonus + 5% Zinsen p.a.',
    cta: 'Jetzt Bonus sichern',
    offers: [
      { bonus: '5%', interest: '2%', label: 'Starter' },
      { bonus: '10%', interest: '3%', label: 'Standard' },
      { bonus: '15%', interest: '4%', label: 'Premium' },
      { bonus: '20%', interest: '5%', label: 'VIP' }
    ],
    highlight: 'Sofort-Gutschrift',
    interestLabel: 'Zinsen p.a.'
  },
  en: {
    title: 'Deposit Bonus',
    subtitle: 'Up to 20% Bonus + 5% Interest p.a.',
    cta: 'Get Your Bonus',
    offers: [
      { bonus: '5%', interest: '2%', label: 'Starter' },
      { bonus: '10%', interest: '3%', label: 'Standard' },
      { bonus: '15%', interest: '4%', label: 'Premium' },
      { bonus: '20%', interest: '5%', label: 'VIP' }
    ],
    highlight: 'Instant Credit',
    interestLabel: 'Interest p.a.'
  },
  sq: {
    title: 'Bonus për Depozita',
    subtitle: 'Deri në 20% Bonus + 5% Interes vjetor',
    cta: 'Merr Bonusin Tënd',
    offers: [
      { bonus: '5%', interest: '2%', label: 'Starter' },
      { bonus: '10%', interest: '3%', label: 'Standard' },
      { bonus: '15%', interest: '4%', label: 'Premium' },
      { bonus: '20%', interest: '5%', label: 'VIP' }
    ],
    highlight: 'Kreditim i Menjëhershëm',
    interestLabel: 'Interes vjetor'
  },
  tr: {
    title: 'Yatırım Bonusu',
    subtitle: '%20\'ye kadar Bonus + %5 Yıllık Faiz',
    cta: 'Bonusunu Al',
    offers: [
      { bonus: '5%', interest: '2%', label: 'Starter' },
      { bonus: '10%', interest: '3%', label: 'Standard' },
      { bonus: '15%', interest: '4%', label: 'Premium' },
      { bonus: '20%', interest: '5%', label: 'VIP' }
    ],
    highlight: 'Anında Kredi',
    interestLabel: 'Yıllık Faiz'
  }
};

const DepositBonusBanner = memo(({ language = 'de', className = '' }) => {
  const navigate = useNavigate();
  const t = translations[language] || translations.de;

  const handleClick = () => {
    navigate('/pay');
    // Set a small delay to ensure navigation completes, then trigger bonus tab
    setTimeout(() => {
      const bonusBtn = document.querySelector('button[class*="bonus"]');
      if (bonusBtn) bonusBtn.click();
    }, 500);
  };

  return (
    <div 
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 p-6 mb-6 ${className}`}
      data-testid="deposit-bonus-banner"
    >
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
      
      {/* Sparkle decorations */}
      <Sparkles className="absolute top-4 right-4 w-6 h-6 text-white/30 animate-pulse" />
      <Star className="absolute bottom-4 left-4 w-5 h-5 text-white/30 animate-pulse" />
      
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left: Title & CTA */}
        <div className="flex-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
            <Gift className="w-8 h-8 text-white" />
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              {t.title}
            </h2>
          </div>
          <p className="text-white/90 text-lg mb-4 flex items-center justify-center md:justify-start gap-2">
            <TrendingUp className="w-5 h-5" />
            {t.subtitle}
          </p>
          
          {/* Highlight badge */}
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-yellow-200" />
            <span className="text-white font-semibold">{t.highlight}</span>
          </div>
          
          <div className="mt-4">
            <Button
              onClick={handleClick}
              className="bg-white text-orange-600 hover:bg-orange-50 font-bold text-lg px-8 py-3 h-auto rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              data-testid="deposit-bonus-cta"
            >
              {t.cta}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
        
        {/* Right: Offer cards */}
        <div className="flex gap-2 md:gap-3">
          {t.offers.map((offer, index) => (
            <div 
              key={index}
              className={`relative bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center min-w-[70px] md:min-w-[80px] transform transition-transform hover:scale-105 ${
                index === 3 ? 'ring-2 ring-yellow-300 ring-offset-2 ring-offset-orange-500' : ''
              }`}
            >
              {index === 3 && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-yellow-400 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  VIP
                </div>
              )}
              <div className="text-2xl md:text-3xl font-black text-white">
                {offer.bonus}
              </div>
              <div className="text-xs text-white/80 font-medium">
                Bonus
              </div>
              <div className="mt-2 pt-2 border-t border-white/20">
                <div className="flex items-center justify-center gap-1 text-green-200">
                  <Percent className="w-3 h-3" />
                  <span className="text-sm font-bold">{offer.interest}</span>
                </div>
                <div className="text-[10px] text-white/70">{t.interestLabel}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

DepositBonusBanner.displayName = 'DepositBonusBanner';

export default DepositBonusBanner;
