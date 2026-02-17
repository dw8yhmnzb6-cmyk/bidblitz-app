/**
 * HowItWorks Component
 * Explains how penny auctions work - accessible without login
 */
import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { X, Zap, Clock, Trophy, Target, Gift, ChevronRight, Play, HelpCircle } from 'lucide-react';
import { Button } from './ui/button';

const translations = {
  de: {
    title: 'Wie funktioniert BidBlitz?',
    subtitle: 'In 4 einfachen Schritten zum Schnäppchen',
    step1Title: 'Auktion wählen',
    step1Desc: 'Wähle ein Produkt das dich interessiert. Alle Auktionen starten bei €0,00!',
    step2Title: 'Gebot abgeben',
    step2Desc: 'Jedes Gebot kostet nur wenige Cent und erhöht den Preis um 1 Cent. Der Timer wird um 10-20 Sekunden verlängert.',
    step3Title: 'Strategie nutzen',
    step3Desc: 'Nutze den Bid Buddy - er bietet automatisch für dich wenn du überboten wirst. So verpasst du nichts!',
    step4Title: 'Gewinnen & Sparen',
    step4Desc: 'Wer das letzte Gebot abgibt wenn der Timer abläuft, gewinnt! Spare bis zu 99% auf Top-Produkte.',
    example: 'Beispiel',
    exampleText: 'Ein iPhone 15 Pro (UVP €1.199) wurde für nur €12,47 verkauft. Der Gewinner hat 95 Gebote verwendet (Wert: ~€47) und insgesamt nur €59,47 bezahlt - eine Ersparnis von über €1.100!',
    cta: 'Jetzt kostenlos starten',
    freeBids: '50 Gratis-Gebote für neue Spieler!',
    close: 'Schließen',
    howItWorks: 'Wie funktioniert es?'
  },
  en: {
    title: 'How does BidBlitz work?',
    subtitle: 'Get amazing deals in 4 simple steps',
    step1Title: 'Choose an auction',
    step1Desc: 'Pick a product you like. All auctions start at €0.00!',
    step2Title: 'Place a bid',
    step2Desc: 'Each bid costs just a few cents and raises the price by 1 cent. The timer extends by 10-20 seconds.',
    step3Title: 'Use strategy',
    step3Desc: 'Use Bid Buddy - it automatically bids for you when you\'re outbid. Never miss out!',
    step4Title: 'Win & Save',
    step4Desc: 'The last bidder when the timer hits zero wins! Save up to 99% on top products.',
    example: 'Example',
    exampleText: 'An iPhone 15 Pro (RRP €1,199) sold for just €12.47. The winner used 95 bids (worth ~€47) and paid only €59.47 total - saving over €1,100!',
    cta: 'Start for free now',
    freeBids: '50 Free bids for new players!',
    close: 'Close',
    howItWorks: 'How does it work?'
  },
  tr: {
    title: 'BidBlitz nasıl çalışır?',
    subtitle: '4 basit adımda harika fırsatlar yakalayın',
    step1Title: 'Müzayede seçin',
    step1Desc: 'Beğendiğiniz bir ürün seçin. Tüm müzayedeler €0,00\'dan başlar!',
    step2Title: 'Teklif verin',
    step2Desc: 'Her teklif sadece birkaç sent tutar ve fiyatı 1 sent artırır. Zamanlayıcı 10-20 saniye uzar.',
    step3Title: 'Strateji kullanın',
    step3Desc: 'Bid Buddy kullanın - geçildiğinizde otomatik teklif verir. Hiçbir şeyi kaçırmayın!',
    step4Title: 'Kazanın & Tasarruf edin',
    step4Desc: 'Zamanlayıcı sıfırlandığında son teklifi veren kazanır! En iyi ürünlerde %99\'a kadar tasarruf edin.',
    example: 'Örnek',
    exampleText: 'Bir iPhone 15 Pro (PBF €1.199) sadece €12,47\'ye satıldı. Kazanan 95 teklif kullandı (~€47 değerinde) ve toplamda sadece €59,47 ödedi - €1.100\'den fazla tasarruf!',
    cta: 'Şimdi ücretsiz başlayın',
    freeBids: 'Yeni oyuncular için 50 ücretsiz teklif!',
    close: 'Kapat',
    howItWorks: 'Nasıl çalışır?'
  },
  sq: {
    title: 'Si funksionon BidBlitz?',
    subtitle: 'Merrni oferta të mrekullueshme në 4 hapa të thjeshtë',
    step1Title: 'Zgjidhni një ankand',
    step1Desc: 'Zgjidhni një produkt që ju pëlqen. Të gjitha ankandat fillojnë në €0,00!',
    step2Title: 'Bëni një ofertë',
    step2Desc: 'Çdo ofertë kushton vetëm disa cent dhe rrit çmimin me 1 cent. Kohëmatësi zgjatet me 10-20 sekonda.',
    step3Title: 'Përdorni strategji',
    step3Desc: 'Përdorni Bid Buddy - ai oferton automatikisht për ju kur tejkaloheni. Mos humbisni asgjë!',
    step4Title: 'Fitoni & Kurseni',
    step4Desc: 'Ofertuesi i fundit kur kohëmatësi arrin zero fiton! Kurseni deri në 99% në produktet më të mira.',
    example: 'Shembull',
    exampleText: 'Një iPhone 15 Pro (ÇMRRP €1,199) u shit për vetëm €12,47. Fituesi përdori 95 oferta (~€47 vlerë) dhe pagoi vetëm €59,47 gjithsej - duke kursyer mbi €1,100!',
    cta: 'Filloni falas tani',
    freeBids: '50 Oferta falas për lojtarë të rinj!',
    close: 'Mbyll',
    howItWorks: 'Si funksionon?'
  },
  fr: {
    title: 'Comment fonctionne BidBlitz?',
    subtitle: 'Obtenez des offres incroyables en 4 étapes simples',
    step1Title: 'Choisir une enchère',
    step1Desc: 'Choisissez un produit qui vous plaît. Toutes les enchères commencent à 0,00€!',
    step2Title: 'Placer une enchère',
    step2Desc: 'Chaque enchère ne coûte que quelques centimes et augmente le prix de 1 centime. Le minuteur s\'étend de 10-20 secondes.',
    step3Title: 'Utiliser une stratégie',
    step3Desc: 'Utilisez Bid Buddy - il enchérit automatiquement pour vous. Ne manquez rien!',
    step4Title: 'Gagner & Économiser',
    step4Desc: 'Le dernier enchérisseur quand le minuteur atteint zéro gagne! Économisez jusqu\'à 99% sur les meilleurs produits.',
    example: 'Exemple',
    exampleText: 'Un iPhone 15 Pro (PVC 1 199€) vendu pour seulement 12,47€. Le gagnant a utilisé 95 enchères (~47€ de valeur) et n\'a payé que 59,47€ au total - une économie de plus de 1 100€!',
    cta: 'Commencer gratuitement',
    freeBids: '50 Enchères gratuites pour les nouveaux joueurs!',
    close: 'Fermer',
    howItWorks: 'Comment ça marche?'
  }
};

const steps = [
  { icon: Target, color: 'from-blue-500 to-cyan-500' },
  { icon: Zap, color: 'from-yellow-500 to-orange-500' },
  { icon: Clock, color: 'from-purple-500 to-pink-500' },
  { icon: Trophy, color: 'from-green-500 to-emerald-500' }
];

// Floating Button Component
export const HowItWorksButton = ({ onClick }) => {
  const { language } = useLanguage();
  const t = translations[language] || translations.de;
  
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-4 z-40 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all animate-pulse hover:animate-none"
      data-testid="how-it-works-btn"
    >
      <HelpCircle className="w-5 h-5" />
      <span className="font-bold text-sm">{t.howItWorks}</span>
    </button>
  );
};

// Modal Component
const HowItWorksModal = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  const t = translations[language] || translations.de;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="how-it-works-modal">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <Play className="w-8 h-8" />
            <h2 className="text-2xl font-bold">{t.title}</h2>
          </div>
          <p className="text-white/90">{t.subtitle}</p>
        </div>
        
        {/* Steps */}
        <div className="p-6 space-y-6">
          {[t.step1Title, t.step2Title, t.step3Title, t.step4Title].map((title, index) => {
            const StepIcon = steps[index].icon;
            const desc = [t.step1Desc, t.step2Desc, t.step3Desc, t.step4Desc][index];
            
            return (
              <div key={index} className="flex gap-4">
                <div className={`flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${steps[index].color} flex items-center justify-center shadow-lg`}>
                  <StepIcon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-800 mb-1">{title}</h3>
                  <p className="text-gray-600">{desc}</p>
                </div>
              </div>
            );
          })}
          
          {/* Example Box */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-5 h-5 text-green-600" />
              <span className="font-bold text-green-800">{t.example}</span>
            </div>
            <p className="text-green-700 text-sm leading-relaxed">{t.exampleText}</p>
          </div>
          
          {/* CTA */}
          <div className="text-center pt-4">
            <p className="text-amber-600 font-bold mb-4 flex items-center justify-center gap-2">
              <Gift className="w-5 h-5" />
              {t.freeBids}
            </p>
            <Button
              onClick={() => {
                onClose();
                window.location.href = '/register';
              }}
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-full shadow-lg"
            >
              {t.cta}
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Combined Export with State Management
const HowItWorks = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <HowItWorksButton onClick={() => setIsOpen(true)} />
      <HowItWorksModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export default HowItWorks;
