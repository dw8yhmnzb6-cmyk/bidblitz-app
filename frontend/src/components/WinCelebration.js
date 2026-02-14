/**
 * Confetti Animation - Celebration effect when user wins an auction
 */
import { useEffect, useState, memo } from 'react';
import confetti from 'canvas-confetti';

// Hook to trigger confetti
export const useConfetti = () => {
  const fireConfetti = (options = {}) => {
    const defaults = {
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    };
    
    confetti({
      ...defaults,
      ...options
    });
  };
  
  const fireWinConfetti = () => {
    // Multiple bursts for big celebration
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    
    const colors = ['#FFD700', '#FFA500', '#FF6347', '#00FF00', '#00CED1'];
    
    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });
      
      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    }());
    
    // Center burst
    setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5, x: 0.5 },
        colors: colors
      });
    }, 500);
  };
  
  return { fireConfetti, fireWinConfetti };
};

// Win celebration overlay component
const WinCelebration = memo(({ 
  show, 
  onClose, 
  auctionName = 'Auktion', 
  finalPrice = 0,
  savings = 0,
  language = 'de' 
}) => {
  const { fireWinConfetti } = useConfetti();
  const [visible, setVisible] = useState(false);
  
  const translations = {
    de: {
      congratulations: 'HERZLICHEN GLÜCKWUNSCH!',
      youWon: 'Du hast gewonnen',
      finalPrice: 'Endpreis',
      saved: 'Du hast gespart',
      amazing: 'Unglaublich!',
      close: 'Weiter'
    },
    en: {
      congratulations: 'CONGRATULATIONS!',
      youWon: 'You won',
      finalPrice: 'Final price',
      saved: 'You saved',
      amazing: 'Amazing!',
      close: 'Continue'
    },
    sq: {
      congratulations: 'URIME!',
      youWon: 'Ke fituar',
      finalPrice: 'Çmimi përfundimtar',
      saved: 'Ke kursyer',
      amazing: 'Fantastike!',
      close: 'Vazhdo'
    },
    tr: {
      congratulations: 'TEBRİKLER!',
      youWon: 'Kazandın',
      finalPrice: 'Son fiyat',
      saved: 'Tasarruf ettin',
      amazing: 'Harika!',
      close: 'Devam'
    }
  };
  
  const t = translations[language] || translations.de;
  
  useEffect(() => {
    if (show) {
      setVisible(true);
      fireWinConfetti();
      
      // Auto-close after 10 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [show]);
  
  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose?.(), 300);
  };
  
  if (!show && !visible) return null;
  
  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300
        ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      data-testid="win-celebration"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Content */}
      <div className={`relative bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400 
        rounded-3xl p-8 max-w-md w-full shadow-2xl transform transition-all duration-500
        ${visible ? 'scale-100 rotate-0' : 'scale-50 rotate-12'}`}
      >
        {/* Trophy icon */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2">
          <div className="w-16 h-16 bg-yellow-300 rounded-full flex items-center justify-center 
            shadow-lg border-4 border-white animate-bounce">
            <span className="text-4xl">🏆</span>
          </div>
        </div>
        
        {/* Text */}
        <div className="text-center mt-6">
          <h2 className="text-2xl sm:text-3xl font-black text-white drop-shadow-lg animate-pulse">
            {t.congratulations}
          </h2>
          
          <p className="text-white/90 mt-2 text-lg">{t.youWon}:</p>
          
          <p className="text-xl sm:text-2xl font-bold text-white mt-2 px-4 py-2 bg-white/20 rounded-xl">
            {auctionName}
          </p>
          
          <div className="flex justify-center gap-6 mt-6">
            <div className="text-center">
              <p className="text-white/70 text-sm">{t.finalPrice}</p>
              <p className="text-3xl font-black text-white">€{finalPrice.toFixed(2)}</p>
            </div>
            
            {savings > 0 && (
              <div className="text-center">
                <p className="text-white/70 text-sm">{t.saved}</p>
                <p className="text-3xl font-black text-green-300">€{savings.toFixed(2)}</p>
              </div>
            )}
          </div>
          
          <p className="mt-4 text-lg text-white/80">{t.amazing} 🎉</p>
        </div>
        
        {/* Close button */}
        <button
          onClick={handleClose}
          className="mt-6 w-full py-3 bg-white text-amber-600 font-bold rounded-xl
            hover:bg-amber-50 transition-colors shadow-lg"
        >
          {t.close}
        </button>
        
        {/* Decorative stars */}
        <div className="absolute top-4 left-4 text-2xl animate-spin" style={{ animationDuration: '3s' }}>⭐</div>
        <div className="absolute top-4 right-4 text-2xl animate-spin" style={{ animationDuration: '4s' }}>✨</div>
        <div className="absolute bottom-4 left-8 text-xl animate-bounce">🎊</div>
        <div className="absolute bottom-4 right-8 text-xl animate-bounce" style={{ animationDelay: '0.5s' }}>🎉</div>
      </div>
    </div>
  );
});

WinCelebration.displayName = 'WinCelebration';

export { WinCelebration };
export default WinCelebration;
