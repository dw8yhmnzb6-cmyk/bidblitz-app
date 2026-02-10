import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Zap, Gift, Shield, X, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Button } from './ui/button';

const benefitTexts = {
  de: {
    title: 'VIP-Vorteile freischalten',
    subtitle: 'Exklusive Vorteile für VIP-Mitglieder',
    benefit1: 'Exklusive VIP-Auktionen',
    benefit2: '10% Rabatt auf alle Gebote',
    benefit3: 'Prioritäts-Support',
    benefit4: 'Keine Wartezeiten',
    cta: 'Jetzt VIP werden',
    close: 'Schließen'
  },
  sq: {
    title: 'Aktivizo përfitimet VIP',
    subtitle: 'Përfitime ekskluzive për anëtarët VIP',
    benefit1: 'Ankande ekskluzive VIP',
    benefit2: '10% zbritje në të gjitha ofertat',
    benefit3: 'Mbështetje me prioritet',
    benefit4: 'Pa kohë pritjeje',
    cta: 'Bëhu VIP tani',
    close: 'Mbyll'
  },
  en: {
    title: 'Unlock VIP Benefits',
    subtitle: 'Exclusive benefits for VIP members',
    benefit1: 'Exclusive VIP auctions',
    benefit2: '10% discount on all bids',
    benefit3: 'Priority support',
    benefit4: 'No waiting times',
    cta: 'Become VIP now',
    close: 'Close'
  }
};

export default function VIPBenefitsBanner({ onClose, isVIP = false }) {
  const { language } = useLanguage();
  const t = benefitTexts[language] || benefitTexts.de;
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible || isVIP) return null;

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  const benefits = [
    { icon: Crown, text: t.benefit1, color: 'text-amber-500' },
    { icon: Zap, text: t.benefit2, color: 'text-cyan-500' },
    { icon: Shield, text: t.benefit3, color: 'text-green-500' },
    { icon: Gift, text: t.benefit4, color: 'text-purple-500' }
  ];

  return (
    <div className="relative bg-gradient-to-r from-purple-900/20 via-amber-900/20 to-purple-900/20 border border-amber-500/30 rounded-xl p-4 mb-6 overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/5 to-transparent animate-pulse" />
      
      {/* Close button */}
      <button 
        onClick={handleClose}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label={t.close}
      >
        <X className="w-4 h-4" />
      </button>

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/30">
          <Crown className="w-7 h-7 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            {t.title}
            <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">VIP</span>
          </h3>
          <p className="text-gray-500 text-sm mb-3">{t.subtitle}</p>
          
          {/* Benefits grid */}
          <div className="grid grid-cols-2 gap-2">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2">
                <benefit.icon className={`w-4 h-4 ${benefit.color}`} />
                <span className="text-xs text-gray-600">{benefit.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <Link to="/vip" className="flex-shrink-0 w-full sm:w-auto">
          <Button className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white font-bold shadow-lg shadow-amber-500/30">
            {t.cta}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
