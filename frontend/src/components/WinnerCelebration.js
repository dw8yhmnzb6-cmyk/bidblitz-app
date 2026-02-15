import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

/**
 * Winner Celebration Component
 * Shows confetti animation and sound when user wins an auction
 */

const WinnerCelebration = ({ isWinner, productName, finalPrice, onClose }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isWinner) {
      setShow(true);
      
      // Fire confetti
      const duration = 3000;
      const end = Date.now() + duration;

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

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());

      // Play win sound (if available)
      try {
        const audio = new Audio('/sounds/win.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (e) {}

      // Auto-close after 5 seconds
      const timeout = setTimeout(() => {
        setShow(false);
        onClose?.();
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [isWinner, onClose]);

  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => { setShow(false); onClose?.(); }}
      data-testid="winner-celebration"
    >
      <div 
        className="bg-gradient-to-b from-yellow-400 via-amber-500 to-orange-500 rounded-3xl p-1 animate-bounce-in max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gray-900 rounded-3xl p-8 text-center">
          {/* Trophy Icon */}
          <div className="text-8xl mb-4 animate-bounce">🏆</div>
          
          {/* Title */}
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500 mb-2">
            DU HAST GEWONNEN!
          </h1>
          
          {/* Product */}
          <p className="text-white text-xl mb-4">{productName}</p>
          
          {/* Price */}
          <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 mb-4">
            <p className="text-green-400 text-sm">Endpreis</p>
            <p className="text-4xl font-black text-green-400">
              €{finalPrice?.toFixed(2)}
            </p>
          </div>
          
          {/* Share Button */}
          <button 
            className="w-full py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold rounded-xl hover:from-yellow-400 hover:to-amber-400 transition-all"
            onClick={() => {
              // Share functionality
              if (navigator.share) {
                navigator.share({
                  title: 'Ich habe gewonnen!',
                  text: `Ich habe ${productName} für nur €${finalPrice?.toFixed(2)} bei bidblitz.ae gewonnen! 🎉`,
                  url: window.location.href
                });
              }
            }}
          >
            🎉 Teilen & Feiern!
          </button>
          
          <p className="text-gray-500 text-xs mt-4">
            Klicke irgendwo um zu schließen
          </p>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes bounce-in {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          50% {
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};

// Hook to trigger celebration
export const useWinnerCelebration = () => {
  const [celebrationData, setCelebrationData] = useState(null);

  const celebrate = (productName, finalPrice) => {
    setCelebrationData({ productName, finalPrice });
  };

  const closeCelebration = () => {
    setCelebrationData(null);
  };

  const CelebrationComponent = celebrationData ? (
    <WinnerCelebration
      isWinner={true}
      productName={celebrationData.productName}
      finalPrice={celebrationData.finalPrice}
      onClose={closeCelebration}
    />
  ) : null;

  return { celebrate, CelebrationComponent };
};

export default WinnerCelebration;
