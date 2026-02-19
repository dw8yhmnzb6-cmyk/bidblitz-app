/**
 * OnboardingTour Component - ENHANCED INTERACTIVE VERSION
 * Shows a step-by-step tutorial with UI highlights and animations
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight, ChevronLeft, Zap, Trophy, Clock, Gift, Target, Sparkles, MousePointer2, Play, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import confetti from 'canvas-confetti';

const API = process.env.REACT_APP_BACKEND_URL;

const translations = {
  de: {
    welcome: 'Willkommen bei BidBlitz!',
    welcomeDesc: 'Lerne in 30 Sekunden, wie du bis zu 99% sparen kannst.',
    step1Title: '1. Wie funktioniert es?',
    step1Desc: 'Bei jeder Auktion startet der Preis bei €0,00. Jedes Gebot erhöht den Preis um nur 1 Cent und verlängert den Timer um 10-20 Sekunden.',
    step1Tip: '💡 Tipp: Schau auf den Timer - je niedriger, desto spannender!',
    step2Title: '2. So gewinnst du',
    step2Desc: 'Wer das letzte Gebot abgibt, wenn der Timer abläuft, gewinnt das Produkt zum aktuellen Preis - oft nur wenige Euro!',
    step2Tip: '💡 Tipp: Beobachte erst, bevor du bietest!',
    step3Title: '3. Deine Strategie',
    step3Desc: 'Nutze den Bid Buddy (Autobidder) - er bietet automatisch für dich, wenn du überboten wirst. So verpasst du keine Auktion!',
    step3Tip: '💡 Tipp: Setze ein Budget-Limit beim Bid Buddy!',
    step4Title: '🎉 Du bist bereit!',
    step4Desc: 'Du erhältst 10 kostenlose Gebote zum Testen. Klicke auf "Jetzt bieten" bei einer Auktion und erlebe den Nervenkitzel!',
    skip: 'Überspringen',
    next: 'Weiter',
    back: 'Zurück',
    startBidding: 'Zu den Auktionen!',
    freeBids: '10 Gratis-Gebote',
    gotIt: 'Verstanden!',
    clickToTry: 'Klicke zum Ausprobieren',
    completed: 'Tour abgeschlossen!',
    reward: 'Du hast 10 Gratis-Gebote erhalten!',
    dontShowAgain: 'Nicht mehr anzeigen'
  },
  en: {
    welcome: 'Welcome to BidBlitz!',
    welcomeDesc: 'Learn how to save up to 99% in just 30 seconds.',
    step1Title: '1. How does it work?',
    step1Desc: 'Each auction starts at €0.00. Every bid raises the price by just 1 cent and extends the timer by 10-20 seconds.',
    step1Tip: '💡 Tip: Watch the timer - the lower it gets, the more exciting!',
    step2Title: '2. How to win',
    step2Desc: 'The last person to bid when the timer runs out wins the product at the current price - often just a few euros!',
    step2Tip: '💡 Tip: Watch first before bidding!',
    step3Title: '3. Your strategy',
    step3Desc: 'Use the Bid Buddy (auto-bidder) - it automatically bids for you when you\'re outbid. Never miss an auction!',
    step3Tip: '💡 Tip: Set a budget limit with Bid Buddy!',
    step4Title: '🎉 You\'re ready!',
    step4Desc: 'You get 10 free bids to try it out. Click "Bid now" on any auction and experience the thrill!',
    skip: 'Skip',
    next: 'Next',
    back: 'Back',
    startBidding: 'Go to Auctions!',
    freeBids: '10 Free Bids',
    gotIt: 'Got it!',
    clickToTry: 'Click to try',
    completed: 'Tour completed!',
    reward: 'You received 10 free bids!',
    dontShowAgain: 'Don\'t show again'
  },
  tr: {
    welcome: 'BidBlitz\'e Hoş Geldiniz!',
    welcomeDesc: '30 saniyede %99\'a kadar nasıl tasarruf edeceğinizi öğrenin.',
    step1Title: '1. Nasıl çalışır?',
    step1Desc: 'Her müzayede €0,00\'dan başlar. Her teklif fiyatı sadece 1 sent artırır ve zamanlayıcıyı 10-20 saniye uzatır.',
    step1Tip: '💡 İpucu: Zamanlayıcıyı izleyin - ne kadar düşükse o kadar heyecanlı!',
    step2Title: '2. Nasıl kazanılır',
    step2Desc: 'Zamanlayıcı sona erdiğinde son teklifi veren kişi, ürünü mevcut fiyattan kazanır - genellikle sadece birkaç euro!',
    step2Tip: '💡 İpucu: Önce izleyin, sonra teklif verin!',
    step3Title: '3. Stratejiniz',
    step3Desc: 'Bid Buddy\'yi kullanın - geçildiğinizde otomatik olarak sizin için teklif verir. Hiçbir müzayedeyi kaçırmayın!',
    step3Tip: '💡 İpucu: Bid Buddy\'de bir bütçe limiti belirleyin!',
    step4Title: '🎉 Hazırsınız!',
    step4Desc: 'Denemek için 10 ücretsiz teklif alırsınız. Herhangi bir müzayedede "Şimdi teklif ver"e tıklayın!',
    skip: 'Atla',
    next: 'İleri',
    back: 'Geri',
    startBidding: 'Müzayedelere Git!',
    freeBids: '10 Ücretsiz Teklif',
    gotIt: 'Anladım!',
    clickToTry: 'Denemek için tıklayın',
    completed: 'Tur tamamlandı!',
    reward: '10 ücretsiz teklif aldınız!',
    dontShowAgain: 'Bir daha gösterme'
  },
  sq: {
    welcome: 'Mirë se vini në BidBlitz!',
    welcomeDesc: 'Mësoni si të kurseni deri në 99% në vetëm 30 sekonda.',
    step1Title: '1. Si funksionon?',
    step1Desc: 'Çdo ankand fillon në €0,00. Çdo ofertë rrit çmimin me vetëm 1 cent dhe zgjat kohëmatësin me 10-20 sekonda.',
    step1Tip: '💡 Këshillë: Shikoni kohëmatësin - sa më i ulët, aq më emocionues!',
    step2Title: '2. Si të fitoni',
    step2Desc: 'Personi i fundit që oferton kur kohëmatësi mbaron fiton produktin me çmimin aktual - shpesh vetëm disa euro!',
    step2Tip: '💡 Këshillë: Shikoni fillimisht para se të ofroni!',
    step3Title: '3. Strategjia juaj',
    step3Desc: 'Përdorni Bid Buddy - ai oferton automatikisht për ju kur tejkaloheni. Mos humbisni asnjë ankand!',
    step3Tip: '💡 Këshillë: Vendosni një limit buxheti me Bid Buddy!',
    step4Title: '🎉 Jeni gati!',
    step4Desc: 'Merrni 10 oferta falas për ta provuar. Klikoni "Oferto tani" në çdo ankand!',
    skip: 'Kalo',
    next: 'Tjetër',
    back: 'Prapa',
    startBidding: 'Shko te Ankandat!',
    freeBids: '10 Oferta Falas',
    gotIt: 'E kuptova!',
    clickToTry: 'Klikoni për të provuar',
    completed: 'Turi u përfundua!',
    reward: 'Morët 10 oferta falas!',
    dontShowAgain: 'Mos e shfaq më'
  },
  fr: {
    welcome: 'Bienvenue sur BidBlitz!',
    welcomeDesc: 'Apprenez à économiser jusqu\'à 99% en 30 secondes.',
    step1Title: '1. Comment ça marche?',
    step1Desc: 'Chaque enchère commence à 0,00€. Chaque offre augmente le prix de seulement 1 centime et prolonge le minuteur de 10-20 secondes.',
    step1Tip: '💡 Astuce: Regardez le minuteur - plus il est bas, plus c\'est excitant!',
    step2Title: '2. Comment gagner',
    step2Desc: 'La dernière personne à enchérir quand le minuteur expire gagne le produit au prix actuel - souvent quelques euros!',
    step2Tip: '💡 Astuce: Observez d\'abord avant d\'enchérir!',
    step3Title: '3. Votre stratégie',
    step3Desc: 'Utilisez le Bid Buddy - il enchérit automatiquement pour vous. Ne manquez jamais une enchère!',
    step3Tip: '💡 Astuce: Définissez une limite de budget avec Bid Buddy!',
    step4Title: '🎉 Vous êtes prêt!',
    step4Desc: 'Vous recevez 10 enchères gratuites pour essayer. Cliquez sur "Enchérir" sur n\'importe quelle enchère!',
    skip: 'Passer',
    next: 'Suivant',
    back: 'Retour',
    startBidding: 'Aller aux Enchères!',
    freeBids: '10 Enchères Gratuites',
    gotIt: 'Compris!',
    clickToTry: 'Cliquez pour essayer',
    completed: 'Visite terminée!',
    reward: 'Vous avez reçu 10 enchères gratuites!',
    dontShowAgain: 'Ne plus afficher'
  }
};

// Animated demo component for step visualization
const StepDemo = ({ step }) => {
  const [price, setPrice] = useState(0);
  const [timer, setTimer] = useState(15);
  const [bids, setBids] = useState(0);
  
  useEffect(() => {
    if (step === 0) {
      // Simulate price going up with bids
      const interval = setInterval(() => {
        setPrice(p => {
          const newPrice = p + 0.01;
          if (newPrice > 0.25) return 0;
          return newPrice;
        });
        setBids(b => (b + 1) % 26);
        setTimer(t => {
          const newTimer = t - 1;
          if (newTimer <= 5) return 15;
          return newTimer;
        });
      }, 800);
      return () => clearInterval(interval);
    }
  }, [step]);
  
  if (step === 0) {
    return (
      <div className="bg-white/10 rounded-xl p-4 mt-4 backdrop-blur-sm">
        <div className="flex justify-between items-center text-white/80 text-sm mb-2">
          <span>Live Demo</span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Live
          </span>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <div className="text-white/60 text-xs">Aktueller Preis</div>
            <div className="text-2xl font-bold text-white">€{price.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-white/60 text-xs">Gebote</div>
            <div className="text-xl font-bold text-yellow-400">{bids}</div>
          </div>
          <div className="text-right">
            <div className="text-white/60 text-xs">Timer</div>
            <div className={`text-2xl font-bold ${timer <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {timer}s
            </div>
          </div>
        </div>
        <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-400 to-yellow-400 transition-all duration-300"
            style={{ width: `${(timer / 15) * 100}%` }}
          />
        </div>
      </div>
    );
  }
  
  return null;
};

const OnboardingTour = () => {
  const { isAuthenticated, user, token } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const langKey = language === 'xk' ? 'sq' : (translations[language] ? language : 'de');
  const t = translations[langKey];
  
  const [showTour, setShowTour] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Check if user should see onboarding
  useEffect(() => {
    const checkOnboarding = async () => {
      // Check for permanent skip first
      const permanentSkip = localStorage.getItem('bidblitz_onboarding_permanent_skip');
      if (permanentSkip === 'true') return;
      
      const hasSeenTour = localStorage.getItem('bidblitz_onboarding_completed');
      if (hasSeenTour) return;
      
      if (isAuthenticated && user) {
        const totalBids = user.total_bids_placed || 0;
        if (totalBids < 5) {
          setTimeout(() => setShowTour(true), 2000);
        }
      } else {
        setTimeout(() => setShowTour(true), 5000);
      }
    };
    
    checkOnboarding();
  }, [isAuthenticated, user]);

  const triggerConfetti = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4']
    });
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowTour(false);
      // Always mark as completed when closing
      localStorage.setItem('bidblitz_onboarding_completed', 'true');
      // If "don't show again" is checked, set permanent skip
      if (dontShowAgain) {
        localStorage.setItem('bidblitz_onboarding_permanent_skip', 'true');
      }
    }, 300);
  };

  const handleComplete = () => {
    triggerConfetti();
    setShowCompletion(true);
    setTimeout(() => {
      handleClose();
      navigate('/auctions');
    }, 2500);
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const steps = [
    {
      title: t.step1Title,
      description: t.step1Desc,
      tip: t.step1Tip,
      icon: <Zap className="w-10 h-10 text-yellow-400" />,
      color: 'from-yellow-500 to-orange-500',
      hasDemo: true
    },
    {
      title: t.step2Title,
      description: t.step2Desc,
      tip: t.step2Tip,
      icon: <Trophy className="w-10 h-10 text-green-400" />,
      color: 'from-green-500 to-emerald-500',
      hasDemo: false
    },
    {
      title: t.step3Title,
      description: t.step3Desc,
      tip: t.step3Tip,
      icon: <Target className="w-10 h-10 text-purple-400" />,
      color: 'from-purple-500 to-pink-500',
      hasDemo: false
    },
    {
      title: t.step4Title,
      description: t.step4Desc,
      tip: null,
      icon: <Gift className="w-10 h-10 text-cyan-400" />,
      color: 'from-cyan-500 to-blue-500',
      hasDemo: false
    }
  ];

  if (!showTour) return null;

  // Completion screen
  if (showCompletion) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative w-full max-w-md bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-2xl p-8 text-center text-white animate-bounce-in">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-white/20">
              <CheckCircle className="w-16 h-16 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">{t.completed}</h2>
          <p className="text-white/90 text-lg mb-4">{t.reward}</p>
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 rounded-full">
            <Sparkles className="w-6 h-6" />
            <span className="font-bold text-xl">{t.freeBids}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      data-testid="onboarding-tour"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className={`relative w-full max-w-lg bg-gradient-to-br ${steps[currentStep].color} rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-500 ${
        isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
      }`}>
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-0 w-60 h-60 bg-white rounded-full blur-3xl animate-pulse delay-1000" />
        </div>
        
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors z-10"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        
        {/* Content */}
        <div className="relative p-8 text-center text-white">
          {/* Progress bar */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  index === currentStep 
                    ? 'w-12 bg-white' 
                    : index < currentStep 
                      ? 'w-6 bg-white/80' 
                      : 'w-6 bg-white/30'
                }`}
              />
            ))}
          </div>
          
          {/* Step counter */}
          <div className="text-white/60 text-sm mb-4">
            {currentStep + 1} / {steps.length}
          </div>
          
          {/* Icon with animation */}
          <div className="flex justify-center mb-6">
            <div className={`p-5 rounded-2xl bg-white/20 transform transition-all duration-500 ${
              currentStep === 3 ? 'animate-bounce scale-110' : 'hover:scale-105'
            }`}>
              {steps[currentStep].icon}
            </div>
          </div>
          
          {/* Title with animation */}
          <h2 className="text-2xl font-bold mb-4 animate-fade-in">
            {steps[currentStep].title}
          </h2>
          
          {/* Description */}
          <p className="text-white/90 text-lg leading-relaxed mb-4">
            {steps[currentStep].description}
          </p>
          
          {/* Tip box */}
          {steps[currentStep].tip && (
            <div className="bg-white/10 rounded-xl p-3 mb-4 text-left backdrop-blur-sm border border-white/20">
              <p className="text-white/90 text-sm">
                {steps[currentStep].tip}
              </p>
            </div>
          )}
          
          {/* Interactive Demo */}
          {steps[currentStep].hasDemo && <StepDemo step={currentStep} />}
          
          {/* Free bids badge on last step */}
          {currentStep === 3 && (
            <div className="inline-flex items-center gap-2 px-5 py-3 bg-white/20 rounded-full mb-6 animate-pulse border-2 border-white/40">
              <Sparkles className="w-6 h-6" />
              <span className="font-bold text-lg">{t.freeBids}</span>
            </div>
          )}
          
          {/* Navigation */}
          <div className="flex flex-col gap-4 mt-6">
            {/* Don't show again checkbox */}
            <label className="flex items-center justify-center gap-3 cursor-pointer text-white/80 hover:text-white transition-colors">
              <span className="text-base font-medium">{t.dontShowAgain}</span>
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-5 h-5 rounded border-white/30 bg-white/10 text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
              />
            </label>
            
            {/* Navigation buttons */}
            <div className="flex justify-between items-center">
            <Button
              onClick={handleBack}
              variant="ghost"
              className={`text-white hover:bg-white/20 ${currentStep === 0 ? 'invisible' : ''}`}
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              {t.back}
            </Button>
            
            <Button
              onClick={handleClose}
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/20"
            >
              {t.skip}
            </Button>
            
            <Button
              onClick={handleNext}
              className={`font-bold px-6 transition-all ${
                currentStep === 3 
                  ? 'bg-white text-gray-900 hover:bg-white/90 animate-pulse' 
                  : 'bg-white/20 text-white hover:bg-white/30 border border-white/40'
              }`}
            >
              {currentStep === 3 ? (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  {t.startBidding}
                </>
              ) : (
                <>
                  {t.next}
                  <ChevronRight className="w-5 h-5 ml-1" />
                </>
              )}
            </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
